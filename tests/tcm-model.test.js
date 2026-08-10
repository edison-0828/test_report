/**
 * tests/tcm-model.test.js —— TCM Model / Store 纯函数单测（T01）
 *
 * 覆盖：
 *   1. 迁移幂等性（连续 migrate 3 次结果完全一致）
 *   2. 枚举兜底（非法 priority / status / type 回退默认）
 *   3. asset.testPlans → asset.linkedBatchIds 改名
 *   4. buildDirectoryTree 目录聚合
 *   5. caseExecutions 业务唯一键 (planId, round, caseAssetId) 去重
 *   6. 写入守卫：execution 模块禁写 basicCaseLibrary 业务字段
 *
 * 约束（系统设计 §8.6）：必须可离线运行，不依赖网络与外部服务。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const TCM_DIR = path.join(__dirname, "..", "tcm");
const MODULE_FILES = ["tcm-core.js", "tcm-model.js", "tcm-store.js"];

/**
 * 加载 tcm 模块到一个模拟的 window 对象上（浏览器 IIFE 在 Node 下的等价执行）。
 *
 * 注意：这里用 new Function 而不是 vm.createContext，
 * 因为 vm 会创建独立 realm，跨 realm 的数组/对象无法通过 assert.deepEqual 的原型检查。
 *
 * @returns {{TCM:object, win:object, errors:Array<string>}} TCM 命名空间、模拟 window、被捕获的 console.error
 */
function loadTcm() {
  const errors = [];
  const win = {};
  win.window = win;
  win.globalThis = win;
  win.console = {
    log() {},
    warn() {},
    error(...args) {
      errors.push(args.map((item) => String(item)).join(" "));
    }
  };
  win.setTimeout = setTimeout;
  win.clearTimeout = clearTimeout;

  MODULE_FILES.forEach((fileName) => {
    const source = fs.readFileSync(path.join(TCM_DIR, fileName), "utf-8");
    // eslint-disable-next-line no-new-func
    const factory = new Function("window", "globalThis", "console", "setTimeout", "clearTimeout", source);
    factory(win, win, win.console, win.setTimeout, win.clearTimeout);
  });

  return { TCM: win.TCM, win, errors };
}

/**
 * 深拷贝助手。
 * @param {*} value 任意可序列化值
 * @returns {*} 深拷贝副本
 */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/** 固定时间参数，保证归一化结果可比较 */
const FIXED = { operator: "Edison - 测试", now: "2026-08-08T10:00:00.000Z", todayDate: "2026-08-08" };

/* ------------------------------------------------------------------ *
 * 1. 命名空间与常量
 * ------------------------------------------------------------------ */

test("tcm-core 暴露完整的枚举字典与工具函数", () => {
  const { TCM } = loadTcm();

  assert.ok(TCM.const, "TCM.const 必须存在");
  assert.ok(TCM.util, "TCM.util 必须存在");
  assert.ok(TCM.bus, "TCM.bus 必须存在");
  assert.ok(TCM.model, "TCM.model 必须存在");
  assert.ok(TCM.store, "TCM.store 必须存在");

  const enumNames = [
    "BUSINESS", "PRIORITY", "CASE_STATUS", "CASE_TYPE", "EXEC_STATUS",
    "PLAN_STATUS", "ROUND_STATUS", "REVIEW_STATUS", "REVIEW_CONCLUSION",
    "REVIEW_ACTION", "DIR_LEVEL", "EVIDENCE_KIND", "REQ_TYPE"
  ];
  assert.equal(enumNames.length, 13, "设计文档 §3.0 共 13 个枚举");
  enumNames.forEach((name) => {
    assert.ok(Array.isArray(TCM.const[name]), `枚举 ${name} 必须是数组`);
    assert.ok(TCM.const[name].length > 0, `枚举 ${name} 不能为空`);
  });

  assert.deepEqual(TCM.const.BUSINESS, ["本地收款", "本地付款", "卡收单", "代付（国际付款）", "VA账户"]);
  assert.deepEqual(TCM.const.CASE_TYPE, ["功能", "接口", "性能", "安全", "兼容", "UI", "其他"]);
  assert.deepEqual(TCM.const.COLLECTIONS, [
    "basicCaseLibrary", "testPlans", "caseExecutions", "reviewTickets", "caseDirectories", "caseVersions"
  ]);
});

test("uid 生成的 exec- id 满足服务端 assertSafePathPart 正则", () => {
  const { TCM } = loadTcm();
  const pattern = /^[a-zA-Z0-9_-]{1,100}$/;

  for (let index = 0; index < 200; index += 1) {
    const id = TCM.util.uid("exec");
    assert.match(id, pattern, `exec id 必须可用作目录名：${id}`);
    assert.match(id, /^exec-\d+-[a-z0-9]{6}$/, `exec id 格式必须是 prefix-timestamp-rand6：${id}`);
  }

  // 传入带尾横线的前缀也要归一
  assert.match(TCM.util.uid("exec-"), /^exec-\d+-[a-z0-9]{6}$/);
  // 非法字符会被清洗掉
  assert.match(TCM.util.uid("b c/"), pattern);
});

test("escapeHtml 与 app.js 行为一致，可防 XSS", () => {
  const { TCM } = loadTcm();
  assert.equal(
    TCM.util.escapeHtml('<img src=x onerror="alert(1)">&\'"'),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;&quot;"
  );
  assert.equal(TCM.util.escapeHtml(null), "");
  assert.equal(TCM.util.escapeHtml(undefined), "");
});

test("currentOperator 读 settings.currentOperator，空则回退「未指定」", () => {
  const { TCM } = loadTcm();
  assert.equal(TCM.util.currentOperator({ settings: { currentOperator: "Edison - 测试" } }), "Edison - 测试");
  assert.equal(TCM.util.currentOperator({ settings: { currentOperator: "   " } }), "未指定");
  assert.equal(TCM.util.currentOperator({}), "未指定");
  assert.equal(TCM.util.currentOperator(), "未指定");
});

test("TCM.bus 支持 on/emit/off/once，且单个订阅者异常不影响其他订阅者", () => {
  const { TCM } = loadTcm();
  const received = [];

  const offA = TCM.bus.on("case:updated", (payload) => received.push(`A:${payload.id}`));
  TCM.bus.on("case:updated", () => {
    throw new Error("订阅者内部异常");
  });
  TCM.bus.on("case:updated", (payload) => received.push(`B:${payload.id}`));

  const count = TCM.bus.emit("case:updated", { id: "bc-1" });
  assert.equal(count, 2, "抛异常的订阅者不计入成功数，但不阻断其他订阅者");
  assert.deepEqual(received, ["A:bc-1", "B:bc-1"]);

  offA();
  received.length = 0;
  TCM.bus.emit("case:updated", { id: "bc-2" });
  assert.deepEqual(received, ["B:bc-2"]);

  let onceCount = 0;
  TCM.bus.once("plan:created", () => {
    onceCount += 1;
  });
  TCM.bus.emit("plan:created", {});
  TCM.bus.emit("plan:created", {});
  assert.equal(onceCount, 1);
});

/* ------------------------------------------------------------------ *
 * 2. 枚举兜底
 * ------------------------------------------------------------------ */

test("normalizeCaseAsset 对非法 priority / status / type / business 全部回退默认值", () => {
  const { TCM } = loadTcm();
  const asset = TCM.model.normalizeCaseAsset({
    id: "bc-1",
    title: "非法枚举用例",
    business: "不存在的业务线",
    priority: "P9",
    status: "不知道什么状态",
    type: "玄学测试"
  }, FIXED);

  assert.equal(asset.business, "本地收款", "非法业务线回退第一个枚举值");
  assert.equal(asset.priority, "P1", "非法优先级回退 P1");
  assert.equal(asset.status, "草稿", "非法状态回退草稿");
  assert.equal(asset.type, "功能", "非法类型回退功能");
});

test("normalizeCaseAsset 补齐全部新增字段（product/module/type/version/reviewId 等）", () => {
  const { TCM } = loadTcm();
  const legacy = {
    id: "basic-seed-1",
    business: "本地收款",
    title: "本地收款-入账成功主流程",
    category: "入账",
    priority: "P0",
    status: "已确认",
    createdAt: "2026-08-07"
  };
  const asset = TCM.model.normalizeCaseAsset(legacy, FIXED);

  assert.equal(asset.product, "", "product 缺失 → 空串");
  assert.equal(asset.module, "入账", "module 缺失 → 复制 category");
  assert.equal(asset.type, "功能", "type 缺失 → 功能");
  assert.equal(asset.version, 1, "version 缺失 → 1");
  assert.equal(asset.reviewId, "");
  assert.equal(asset.isBaseline, false);
  assert.equal(asset.baselineFrom, "");
  assert.deepEqual(asset.linkedRequirements, [], "linkedRequirements 缺失 → []");
  assert.deepEqual(asset.stepRows, [], "stepRows 缺失 → []");
  assert.equal(asset.createdBy, FIXED.operator);
  assert.equal(asset.updatedBy, FIXED.operator);
  assert.equal(asset.updatedAt, FIXED.now);
  assert.equal(asset.createdAt, "2026-08-07", "已有 createdAt 保持 YYYY-MM-DD 不变");
});

test("normalizeCaseExecution 对非法 status 回退「未执行」，非法 id 重新生成为安全 id", () => {
  const { TCM } = loadTcm();
  const execution = TCM.model.normalizeCaseExecution({
    id: "exec/非法路径..",
    planId: "plan-1",
    caseAssetId: "bc-1",
    round: 0,
    status: "已完蛋"
  }, FIXED);

  assert.equal(execution.status, "未执行");
  assert.equal(execution.round, 1, "round 下界为 1");
  assert.match(execution.id, /^exec-\d+-[a-z0-9]{6}$/, "非法 id 必须重新生成");
  assert.match(execution.id, /^[a-zA-Z0-9_-]{1,100}$/);
});

test("normalizeTestPlan / normalizeReviewTicket 枚举兜底并保证结构完整", () => {
  const { TCM } = loadTcm();

  const plan = TCM.model.normalizeTestPlan({ id: "plan-1", name: "回归计划", status: "飞起来了" }, FIXED);
  assert.equal(plan.status, "未开始");
  assert.equal(plan.rounds.length, 1, "rounds 至少 1 轮");
  assert.equal(plan.rounds[0].round, 1);
  assert.equal(plan.rounds[0].name, "首轮");
  assert.equal(plan.currentRound, 1);

  const ticket = TCM.model.normalizeReviewTicket({
    id: "rev-1",
    title: "P0 用例评审",
    caseIds: ["bc-1", "bc-1", "bc-2"],
    status: "随便填",
    conclusion: "随便填",
    comments: [{ caseId: "bc-1", author: "YY - 后端", action: "乱写", content: "缺少并发边界" }]
  }, FIXED);
  assert.equal(ticket.status, "待评审");
  assert.equal(ticket.conclusion, "", "非法结论回退空串（未出结论）");
  assert.deepEqual(ticket.caseIds, ["bc-1", "bc-2"], "caseIds 去重");
  assert.equal(ticket.comments[0].action, "评论", "非法评审动作回退「评论」");
  assert.match(ticket.comments[0].id, /^cmt-/);
});

/* ------------------------------------------------------------------ *
 * 3. testPlans → linkedBatchIds 改名
 * ------------------------------------------------------------------ */

test("normalizeCaseAsset 把旧字段 testPlans 改名为 linkedBatchIds 并移除旧键（Q6）", () => {
  const { TCM } = loadTcm();
  const asset = TCM.model.normalizeCaseAsset({
    id: "bc-1",
    title: "旧字段迁移",
    business: "本地收款",
    testPlans: ["batch-a", "batch-b", "batch-a", ""]
  }, FIXED);

  assert.deepEqual(asset.linkedBatchIds, ["batch-a", "batch-b"], "改名 + 去重 + 去空");
  assert.equal("testPlans" in asset, false, "旧键必须消失，避免与顶层集合 state.testPlans 混淆");
});

test("已迁移过的资产再次归一化不会重复合并 linkedBatchIds", () => {
  const { TCM } = loadTcm();
  const once = TCM.model.normalizeCaseAsset({ id: "bc-1", title: "T", testPlans: ["batch-a"] }, FIXED);
  const twice = TCM.model.normalizeCaseAsset(once, FIXED);
  assert.deepEqual(twice.linkedBatchIds, ["batch-a"]);
  assert.equal("testPlans" in twice, false);
});

/* ------------------------------------------------------------------ *
 * 4. 迁移幂等性
 * ------------------------------------------------------------------ */

test("TCM.store.migrate 连续执行 3 次结果完全一致（幂等）", () => {
  const { TCM } = loadTcm();
  const rawState = {
    settings: { currentOperator: "Edison - 测试" },
    basicCaseLibrary: [
      { id: "basic-seed-1", business: "本地收款", title: "入账主流程", category: "入账", priority: "P0", status: "已确认", testPlans: ["batch-a"] },
      { id: "basic-seed-2", business: "卡收单", title: "3DS 支付", category: "支付", priority: "乱写", status: "乱写", type: "乱写" }
    ]
    // 其余 5 个集合与 _rev 全部缺失，模拟旧存量数据
  };

  const first = TCM.store.migrate(clone(rawState));
  const second = TCM.store.migrate(clone(first));
  const third = TCM.store.migrate(clone(second));

  assert.deepEqual(second, first, "第 2 次迁移结果必须与第 1 次一致");
  assert.deepEqual(third, second, "第 3 次迁移结果必须与第 2 次一致");

  // 集合与 _rev 补齐
  TCM.const.COLLECTIONS.forEach((key) => {
    assert.ok(Array.isArray(first[key]), `集合 ${key} 缺失时必须补 []`);
  });
  assert.equal(first._rev, 0, "_rev 缺失 → 0");
  assert.equal(first.basicCaseLibrary.length, 2, "无数据丢失");
  assert.deepEqual(first.basicCaseLibrary[0].linkedBatchIds, ["batch-a"]);
  assert.equal(first.basicCaseLibrary[1].priority, "P1");
  assert.equal(first.basicCaseLibrary[1].type, "功能");
  // 原有非托管字段不受影响
  assert.deepEqual(first.settings, { currentOperator: "Edison - 测试" });
});

test("migrate 对空对象 / 非对象输入安全兜底", () => {
  const { TCM } = loadTcm();

  const empty = TCM.store.migrate({});
  TCM.const.COLLECTIONS.forEach((key) => {
    assert.deepEqual(empty[key], []);
  });
  assert.equal(empty._rev, 0);

  const fromNull = TCM.store.migrate(null);
  assert.ok(fromNull && typeof fromNull === "object");
  assert.deepEqual(fromNull.basicCaseLibrary, []);
});

test("migrate 保留 _rev 已有数值，不会被重置", () => {
  const { TCM } = loadTcm();
  const migrated = TCM.store.migrate({ _rev: 7 });
  assert.equal(migrated._rev, 7);
});

/* ------------------------------------------------------------------ *
 * 5. 目录树聚合
 * ------------------------------------------------------------------ */

test("buildDirectoryTree 由资产 business/product/module 派生目录树并累加计数", () => {
  const { TCM } = loadTcm();
  const assets = [
    { business: "本地收款", product: "收款核心", module: "入账", category: "入账" },
    { business: "本地收款", product: "收款核心", module: "入账", category: "幂等" },
    { business: "本地收款", product: "收款核心", module: "对账", category: "对账" },
    { business: "本地收款", product: "", module: "退款", category: "退款" },
    { business: "卡收单", product: "收单网关", module: "支付", category: "支付" }
  ].map((item, index) => TCM.model.normalizeCaseAsset(Object.assign({ id: `bc-${index}`, title: `用例${index}` }, item), FIXED));

  const tree = TCM.model.buildDirectoryTree(assets, []);

  const localIn = tree.find((node) => node.name === "本地收款");
  assert.ok(localIn, "业务线节点必须存在");
  assert.equal(localIn.level, "business");
  assert.equal(localIn.count, 4, "业务线计数 = 该业务下全部资产数");

  const core = localIn.children.find((node) => node.name === "收款核心");
  assert.ok(core, "产品节点由资产派生");
  assert.equal(core.level, "product");
  assert.equal(core.count, 3);
  assert.equal(core.id, "dir-product-本地收款-收款核心", "目录 id 稳定可推导");

  const entry = core.children.find((node) => node.name === "入账");
  assert.equal(entry.level, "module");
  assert.equal(entry.count, 2);
  // category 与 module 同名时坍缩，不生成重复层
  assert.deepEqual(entry.children.map((node) => node.name), ["幂等"]);

  // product 为空 → 该层坍缩，module 直接挂业务线下（Q1）
  const refund = localIn.children.find((node) => node.name === "退款");
  assert.ok(refund, "product 为空的用例，module 应直接挂在业务线下");
  assert.equal(refund.level, "module");
  assert.equal(refund.count, 1);

  const card = tree.find((node) => node.name === "卡收单");
  assert.equal(card.count, 1);
});

test("buildDirectoryTree 保留没有任何资产的显式空目录", () => {
  const { TCM } = loadTcm();
  const dirs = [
    TCM.model.normalizeCaseDirectory({ level: "product", business: "本地付款", name: "付款核心", order: 1 }, FIXED),
    TCM.model.normalizeCaseDirectory({ level: "module", business: "本地付款", product: "付款核心", name: "空模块", order: 2 }, FIXED)
  ];
  const tree = TCM.model.buildDirectoryTree([], dirs);

  const pay = tree.find((node) => node.name === "本地付款");
  const core = pay.children.find((node) => node.name === "付款核心");
  assert.ok(core, "空目录必须保留");
  assert.equal(core.count, 0);
  assert.equal(core.explicit, true);
  assert.equal(core.children[0].name, "空模块");
  assert.equal(core.children[0].count, 0);
});

test("normalizeCaseDirectory 生成稳定 id 且 business 层级回退为 product", () => {
  const { TCM } = loadTcm();
  const dir = TCM.model.normalizeCaseDirectory({ level: "product", business: "本地收款", name: "收款核心" }, FIXED);
  assert.equal(dir.id, "dir-product-本地收款-收款核心");
  assert.equal(dir.product, "收款核心");

  const fallback = TCM.model.normalizeCaseDirectory({ level: "business", business: "本地收款", name: "本地收款" }, FIXED);
  assert.equal(fallback.level, "product", "business 层不入库，回退为 product");
});

/* ------------------------------------------------------------------ *
 * 6. 执行实例业务唯一键去重
 * ------------------------------------------------------------------ */

test("normalizeCaseExecutionList 按 (planId, round, caseAssetId) 去重，保留 updatedAt 更新的一条", () => {
  const { TCM } = loadTcm();
  const list = [
    { id: "exec-1", planId: "plan-1", round: 1, caseAssetId: "bc-1", status: "未执行", createdAt: "2026-08-08T10:00:00.000Z", updatedAt: "2026-08-08T10:00:00.000Z" },
    { id: "exec-2", planId: "plan-1", round: 1, caseAssetId: "bc-1", status: "通过", createdAt: "2026-08-08T10:00:00.000Z", updatedAt: "2026-08-08T11:00:00.000Z" },
    { id: "exec-3", planId: "plan-1", round: 2, caseAssetId: "bc-1", status: "失败", createdAt: "2026-08-08T12:00:00.000Z", updatedAt: "2026-08-08T12:00:00.000Z" },
    { id: "exec-4", planId: "plan-2", round: 1, caseAssetId: "bc-1", status: "阻塞", createdAt: "2026-08-08T12:00:00.000Z", updatedAt: "2026-08-08T12:00:00.000Z" },
    { id: "exec-5", planId: "plan-1", round: 1, caseAssetId: "bc-2", status: "跳过", createdAt: "2026-08-08T12:00:00.000Z", updatedAt: "2026-08-08T12:00:00.000Z" },
    { id: "exec-6", planId: "", round: 1, caseAssetId: "bc-3", status: "通过", createdAt: "2026-08-08T12:00:00.000Z", updatedAt: "2026-08-08T12:00:00.000Z" }
  ];

  const normalized = TCM.model.normalizeCaseExecutionList(list, FIXED);

  assert.equal(normalized.length, 4, "同一 (planId,round,caseAssetId) 只保留 1 条；缺 planId 的脏数据被丢弃");
  const winner = normalized.find((item) => item.planId === "plan-1" && item.round === 1 && item.caseAssetId === "bc-1");
  assert.equal(winner.id, "exec-2", "保留 updatedAt 更新的一条");
  assert.equal(winner.status, "通过");

  const keys = normalized.map((item) => TCM.model.executionKey(item));
  assert.equal(new Set(keys).size, keys.length, "唯一键不得重复");
});

test("executionKey 严格由 (planId, round, caseAssetId) 组成", () => {
  const { TCM } = loadTcm();
  assert.equal(TCM.model.executionKey({ planId: "plan-1", round: 2, caseAssetId: "bc-9" }), "plan-1::2::bc-9");
  assert.equal(TCM.model.executionKey({}), "::1::");
});

/* ------------------------------------------------------------------ *
 * 7. 筛选与度量
 * ------------------------------------------------------------------ */

test("applyFilters 支持关键词与多维度叠加筛选", () => {
  const { TCM } = loadTcm();
  const assets = [
    { id: "bc-1", title: "入账主流程", business: "本地收款", product: "收款核心", module: "入账", type: "功能", priority: "P0", status: "已确认", component: "收款核心", tags: ["主流程"], automationEnabled: true },
    { id: "bc-2", title: "重复回调幂等", business: "本地收款", product: "收款核心", module: "幂等", type: "接口", priority: "P1", status: "草稿", component: "回调处理", tags: ["边界"] },
    { id: "bc-3", title: "3DS 支付", business: "卡收单", product: "收单网关", module: "支付", type: "功能", priority: "P0", status: "已确认", component: "收单网关", tags: ["3DS"] }
  ].map((item) => TCM.model.normalizeCaseAsset(item, FIXED));

  assert.deepEqual(TCM.model.applyFilters(assets, { keyword: "幂等" }).map((a) => a.id), ["bc-2"]);
  assert.deepEqual(TCM.model.applyFilters(assets, { priority: "P0" }).map((a) => a.id), ["bc-1", "bc-3"]);
  assert.deepEqual(TCM.model.applyFilters(assets, { business: "本地收款", type: "接口" }).map((a) => a.id), ["bc-2"]);
  assert.deepEqual(TCM.model.applyFilters(assets, { tag: "3DS" }).map((a) => a.id), ["bc-3"]);
  assert.deepEqual(TCM.model.applyFilters(assets, { automation: "yes" }).map((a) => a.id), ["bc-1"]);
  assert.equal(TCM.model.applyFilters(assets, {}).length, 3, "空筛选返回全部");
  assert.equal(TCM.model.applyFilters(null, { keyword: "x" }).length, 0, "非数组输入安全兜底");
});

test("computeMetrics 计算执行率 / 通过率 / 覆盖率", () => {
  const { TCM } = loadTcm();
  const assets = ["bc-1", "bc-2", "bc-3", "bc-4"].map((id) =>
    TCM.model.normalizeCaseAsset({ id, title: id, business: "本地收款" }, FIXED));
  const executions = TCM.model.normalizeCaseExecutionList([
    { id: "exec-1", planId: "plan-1", round: 1, caseAssetId: "bc-1", status: "通过" },
    { id: "exec-2", planId: "plan-1", round: 1, caseAssetId: "bc-2", status: "失败" },
    { id: "exec-3", planId: "plan-1", round: 1, caseAssetId: "bc-3", status: "未执行" },
    { id: "exec-4", planId: "plan-2", round: 1, caseAssetId: "bc-4", status: "通过" }
  ], FIXED);

  const all = TCM.model.computeMetrics({ assets, executions });
  assert.equal(all.caseTotal, 4);
  assert.equal(all.executionTotal, 4);
  assert.equal(all.notRun, 1);
  assert.equal(all.executed, 3);
  assert.equal(all.passed, 2);
  assert.equal(all.failed, 1);
  assert.equal(all.executeRate, 75);
  assert.equal(all.passRate, 66.7);
  assert.equal(all.caseCoverage, 100);

  const scoped = TCM.model.computeMetrics({ assets, executions, planId: "plan-1", round: 1 });
  assert.equal(scoped.executionTotal, 3, "按 planId + round 过滤");
  assert.equal(scoped.passed, 1);
});

test("validateImportRow 校验必填与枚举，支持中文表头别名", () => {
  const { TCM } = loadTcm();

  const bad = TCM.model.validateImportRow({ "标题": "" }, { index: 0 });
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.errors, ["标题不能为空"]);
  assert.equal(bad.asset, null);

  const good = TCM.model.validateImportRow({
    "业务线": "本地收款",
    "产品": "收款核心",
    "模块": "入账",
    "标题": "导入用例",
    "用例类型": "玄学",
    "优先级": "P0"
  }, Object.assign({ index: 3, existingTitles: ["导入用例"] }, FIXED));

  assert.equal(good.ok, true);
  assert.equal(good.index, 3);
  assert.equal(good.asset.title, "导入用例");
  assert.equal(good.asset.product, "收款核心");
  assert.equal(good.asset.type, "功能", "非法类型回退默认值");
  assert.ok(good.warnings.some((text) => text.includes("用例类型")));
  assert.ok(good.warnings.some((text) => text.includes("同名用例")));
});

/* ------------------------------------------------------------------ *
 * 8. Store 写入口与写入守卫
 * ------------------------------------------------------------------ */

test("TCM.store.commit 是唯一写入口，且会自动归一化写入内容", () => {
  const { TCM } = loadTcm();
  const state = { settings: { currentOperator: "Edison - 测试" } };
  TCM.store.setStateProvider(() => state);
  TCM.store.migrate(state);

  const ok = TCM.store.commit("basicCaseLibrary", [{ id: "bc-1", title: "新用例", business: "本地收款", priority: "乱写" }], { source: "library" });
  assert.equal(ok, true);
  assert.equal(state.basicCaseLibrary.length, 1);
  assert.equal(state.basicCaseLibrary[0].priority, "P1", "commit 内部会归一化");
  assert.equal(state.basicCaseLibrary[0].type, "功能");

  assert.equal(TCM.store.commit("notExists", []), false, "未知集合必须被拒绝");
  assert.equal(TCM.store.commit("basicCaseLibrary", "不是数组"), false, "非数组必须被拒绝");

  TCM.store.cancelPersist();
  TCM.store.setStateProvider(null);
});

test("写入守卫：execution 模块禁止修改 basicCaseLibrary 业务字段，仅允许追加 linkedDefects", () => {
  const { TCM } = loadTcm();
  const state = {
    settings: { currentOperator: "Edison - 测试" },
    basicCaseLibrary: [{ id: "bc-1", title: "入账主流程", business: "本地收款" }]
  };
  TCM.store.setStateProvider(() => state);
  TCM.store.migrate(state);

  // ① 非法：改标题
  const tampered = clone(state.basicCaseLibrary);
  tampered[0].title = "被执行台篡改的标题";
  assert.equal(
    TCM.store.commit("basicCaseLibrary", tampered, { source: "execution" }),
    false,
    "execution 模块改业务字段必须被拒绝"
  );
  assert.equal(state.basicCaseLibrary[0].title, "入账主流程", "状态不得被污染");
  assert.match(TCM.store.getLastGuardError(), /业务字段/);

  // ② 非法：删除资产
  assert.equal(TCM.store.commit("basicCaseLibrary", [], { source: "execution" }), false);

  // ③ 合法：追加 linkedDefects（一键建 Bug 的唯一例外）
  const appended = clone(state.basicCaseLibrary);
  appended[0].linkedDefects = appended[0].linkedDefects.concat([{ id: "bug-1", title: "重复入账" }]);
  assert.equal(
    TCM.store.commit("basicCaseLibrary", appended, { source: "execution", reason: "linkDefect" }),
    true,
    "追加 linkedDefects 必须放行"
  );
  assert.deepEqual(state.basicCaseLibrary[0].linkedDefects, [{ id: "bug-1", title: "重复入账" }]);

  // ④ 非法：覆盖已有 linkedDefects
  const overwritten = clone(state.basicCaseLibrary);
  overwritten[0].linkedDefects = [{ id: "bug-2", title: "另一个缺陷" }];
  assert.equal(TCM.store.commit("basicCaseLibrary", overwritten, { source: "execution" }), false);

  // ⑤ 其他模块不受限制
  const byLibrary = clone(state.basicCaseLibrary);
  byLibrary[0].title = "库模块正常改标题";
  assert.equal(TCM.store.commit("basicCaseLibrary", byLibrary, { source: "library" }), true);
  assert.equal(state.basicCaseLibrary[0].title, "库模块正常改标题");

  // ⑥ execution 模块写自己的集合不受限制
  assert.equal(
    TCM.store.commit("caseExecutions", [{ id: "exec-1", planId: "plan-1", caseAssetId: "bc-1", status: "失败" }], { source: "execution" }),
    true
  );
  assert.equal(state.caseExecutions.length, 1);

  TCM.store.cancelPersist();
  TCM.store.setStateProvider(null);
});

test("persist 防抖合并多次写入，flush 后 _rev 只递增一次并广播 state:persisted", () => {
  const { TCM, win } = loadTcm();
  const state = { settings: { currentOperator: "Edison - 测试" }, _rev: 0 };
  TCM.store.setStateProvider(() => state);
  TCM.store.migrate(state);

  // 模拟 app.js 的全局 persist()
  let hostPersistCalls = 0;
  win.persist = function hostPersist() {
    hostPersistCalls += 1;
  };

  const events = [];
  TCM.bus.on("state:persisted", (payload) => events.push(payload));

  TCM.store.commit("caseDirectories", [{ level: "product", business: "本地收款", name: "收款核心" }], { source: "library" });
  TCM.store.commit("caseDirectories", [{ level: "product", business: "本地收款", name: "收款核心2" }], { source: "library" });
  TCM.store.commit("caseDirectories", [{ level: "product", business: "本地收款", name: "收款核心3" }], { source: "library" });
  assert.equal(state._rev, 0, "防抖窗口内不应写 _rev");
  assert.equal(hostPersistCalls, 0, "防抖窗口内不应调用 app.js persist()");

  TCM.store.flush();
  assert.equal(state._rev, 1, "3 次写入合并为 1 次 persist");
  assert.equal(hostPersistCalls, 1, "app.js persist() 只被调用一次");
  assert.equal(events.length, 1);
  assert.equal(events[0].rev, 1);
  assert.equal(state.caseDirectories[0].name, "收款核心3", "最后一次写入生效");

  TCM.store.setStateProvider(null);
});

test("collection() 对缺失集合就地补空数组，findById 可按 id 命中", () => {
  const { TCM } = loadTcm();
  const state = {};
  TCM.store.setStateProvider(() => state);

  assert.deepEqual(TCM.store.collection("testPlans"), []);
  assert.ok(Array.isArray(state.testPlans));

  state.testPlans = [{ id: "plan-1", name: "回归计划" }];
  assert.equal(TCM.store.findById("testPlans", "plan-1").name, "回归计划");
  assert.equal(TCM.store.findById("testPlans", "plan-404"), null);
  assert.equal(TCM.store.findById("testPlans", ""), null);

  TCM.store.setStateProvider(null);
});

/* ------------------------------------------------------------------ *
 * 9. 与 app.js / server.js 的契约对齐（防止 F1 复发）
 * ------------------------------------------------------------------ */

test("app.js SHARED_STATE_KEYS 与 server.js sanitizeSharedState 必须逐项对齐", () => {
  const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf-8");
  const serverSource = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf-8");

  const sharedMatch = appSource.match(/const SHARED_STATE_KEYS = \[([\s\S]*?)\];/);
  assert.ok(sharedMatch, "必须能在 app.js 中找到 SHARED_STATE_KEYS");
  const sharedKeys = (sharedMatch[1].match(/"([^"]+)"/g) || []).map((item) => item.replace(/"/g, ""));

  const sanitizeMatch = serverSource.match(/function sanitizeSharedState\(input\) \{([\s\S]*?)\n\}/);
  assert.ok(sanitizeMatch, "必须能在 server.js 中找到 sanitizeSharedState");
  const sanitizeBody = sanitizeMatch[1];

  const required = [
    "basicCaseLibrary", "testPlans", "caseExecutions",
    "reviewTickets", "caseDirectories", "caseVersions", "_rev"
  ];
  required.forEach((key) => {
    assert.ok(sharedKeys.includes(key), `SHARED_STATE_KEYS 缺少 ${key}`);
    assert.ok(
      new RegExp(`(^|\\W)${key}\\s*:`).test(sanitizeBody),
      `server.js sanitizeSharedState 缺少 ${key}（会导致该集合被静默丢弃，即 F1）`
    );
  });

  sharedKeys.forEach((key) => {
    assert.ok(
      new RegExp(`(^|\\W)${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`).test(sanitizeBody),
      `SHARED_STATE_KEYS 中的 ${key} 未在 sanitizeSharedState 放行`
    );
  });
});

test("server.js STATIC_FILE_ALLOWLIST 必须包含全部 14 个 tcm 静态资源（F2）", () => {
  const serverSource = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf-8");
  const allowlistMatch = serverSource.match(/const STATIC_FILE_ALLOWLIST = new Map\(\[([\s\S]*?)\]\);/);
  assert.ok(allowlistMatch, "必须能在 server.js 中找到 STATIC_FILE_ALLOWLIST");
  const body = allowlistMatch[1];

  const expected = [
    "tcm-core.js", "tcm-store.js", "tcm-model.js", "tcm-shell.js", "tcm-library.js",
    "tcm-case-editor.js", "tcm-plans.js", "tcm-execution.js", "tcm-review.js",
    "tcm-dashboard.js", "tcm-trace.js", "tcm-io.js", "tcm-steps.js", "tcm-ai.js"
  ];
  expected.forEach((fileName) => {
    assert.ok(body.includes(`["/tcm/${fileName}", "tcm/${fileName}"]`), `白名单缺少 /tcm/${fileName}`);
  });
  assert.ok(body.includes('["/tcm/tcm.css", "tcm/tcm.css"]'), "白名单缺少 /tcm/tcm.css");
});

test("index.html 必须在 app.js 之前按序引入 core → store → model", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf-8");
  const coreIndex = html.indexOf('src="tcm/tcm-core.js"');
  const storeIndex = html.indexOf('src="tcm/tcm-store.js"');
  const modelIndex = html.indexOf('src="tcm/tcm-model.js"');
  const appIndex = html.indexOf('src="app.js"');

  assert.ok(coreIndex > -1 && storeIndex > -1 && modelIndex > -1, "3 个基础脚本必须都被引入");
  assert.ok(coreIndex < storeIndex, "core 必须在 store 之前");
  assert.ok(storeIndex < modelIndex, "store 必须在 model 之前");
  assert.ok(modelIndex < appIndex, "app.js 必须最后加载");
  assert.ok(html.includes('href="tcm/tcm.css"'), "必须引入 tcm/tcm.css");
});

test("seedBasicCaseLibrary 的 10 条种子已补齐 product / module / type", () => {
  const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf-8");
  const start = appSource.indexOf("function seedBasicCaseLibrary()");
  assert.ok(start > -1, "必须能找到 seedBasicCaseLibrary");
  const end = appSource.indexOf("\nfunction ", start + 1);
  const body = appSource.slice(start, end);

  const businessCount = (body.match(/business: "/g) || []).length;
  const productCount = (body.match(/product: "/g) || []).length;
  const moduleCount = (body.match(/module: "/g) || []).length;
  const typeCount = (body.match(/type: "/g) || []).length;

  assert.equal(businessCount, 10, "种子应有 10 条");
  assert.equal(productCount, 10, "每条种子都要有 product");
  assert.equal(moduleCount, 10, "每条种子都要有 module");
  assert.equal(typeCount, 10, "每条种子都要有 type");

  ["收款核心", "付款核心", "收单网关", "跨境清算", "VA 核心"].forEach((product) => {
    assert.ok(body.includes(`product: "${product}"`), `种子缺少产品：${product}`);
  });
});

/* ------------------------------------------------------------------ *
 * 9. T03 · 测试计划编排 + 测试执行台闭环
 * ------------------------------------------------------------------ */

/**
 * 构造一份「计划 + 执行」的测试夹具。
 *
 * 计划 plan-1：
 *   - 4 个条目 bc-1..bc-4，其中 bc-4 在第 2 轮被移除（excludedRounds:[2]）
 *   - 已有 2 轮
 *
 * @param {object} TCM 已加载的 TCM 命名空间
 * @returns {{plans:Array<object>, assets:Array<object>, executions:Array<object>}} 夹具
 */
function seedPlanState(TCM) {
  const assets = ["bc-1", "bc-2", "bc-3", "bc-4"].map((id, index) =>
    TCM.model.normalizeCaseAsset(
      { id, title: `用例 ${index + 1}`, business: "本地收款", product: "收款核心", module: "入账", priority: "P0" },
      FIXED
    ));

  const plan = TCM.model.normalizeTestPlan({
    id: "plan-1",
    name: "2026-08 回归计划",
    owner: "Edison - 测试",
    status: "进行中",
    currentRound: 2,
    rounds: [
      { round: 1, name: "首轮", status: "已完成" },
      { round: 2, name: "第 2 轮", status: "进行中" }
    ],
    items: [
      { caseAssetId: "bc-1", executor: "Edison - 测试", order: 1 },
      { caseAssetId: "bc-2", executor: "Alice - 测试", order: 2 },
      { caseAssetId: "bc-3", executor: "", order: 3 },
      { caseAssetId: "bc-4", executor: "Edison - 测试", order: 4, excludedRounds: [2] }
    ]
  }, FIXED);

  const executions = TCM.model.normalizeCaseExecutionList([
    { id: "exec-1", planId: "plan-1", round: 1, caseAssetId: "bc-1", executor: "Edison - 测试", status: "通过", finishedAt: "2026-08-08T11:00:00.000Z", updatedAt: "2026-08-08T11:00:00.000Z" },
    { id: "exec-2", planId: "plan-1", round: 1, caseAssetId: "bc-2", executor: "Alice - 测试", status: "失败", finishedAt: "2026-08-08T12:00:00.000Z", updatedAt: "2026-08-08T12:00:00.000Z", linkedDefectId: "bug-1" },
    { id: "exec-3", planId: "plan-1", round: 1, caseAssetId: "bc-3", executor: "", status: "阻塞", finishedAt: "2026-08-08T13:00:00.000Z", updatedAt: "2026-08-08T13:00:00.000Z" },
    { id: "exec-4", planId: "plan-1", round: 1, caseAssetId: "bc-4", executor: "Edison - 测试", status: "未执行" }
  ], FIXED);

  return { plans: [plan], assets, executions };
}

test("ensureExecutions 惰性补齐执行实例：唯一键去重 + 幂等 + 尊重 excludedRounds", () => {
  const { TCM } = loadTcm();
  const seed = seedPlanState(TCM);

  let counter = 0;
  /**
   * 稳定 id 工厂，保证断言可比较。
   * @returns {string} 执行实例 id
   */
  function idFactory() {
    counter += 1;
    return `exec-gen-${counter}`;
  }

  const first = TCM.model.ensureExecutions("plan-1", 2, {
    plans: seed.plans,
    executions: seed.executions,
    assets: seed.assets,
    now: FIXED.now,
    idFactory
  });

  assert.equal(first.changed, true, "第 2 轮应补齐执行实例");
  assert.equal(first.created.length, 3, "bc-4 被 excludedRounds 排除，只补 bc-1/bc-2/bc-3");
  assert.deepEqual(
    first.created.map((item) => item.caseAssetId),
    ["bc-1", "bc-2", "bc-3"],
    "补齐顺序按计划条目 order"
  );
  first.created.forEach((item) => {
    assert.equal(item.round, 2);
    assert.equal(item.planId, "plan-1");
    assert.equal(item.status, "未执行", "新补齐的执行实例默认未执行");
    assert.ok(item.caseSnapshot && item.caseSnapshot.title, "必须写入执行时快照");
    assert.ok(/^exec-/.test(item.id), "执行实例 id 必须以 exec- 前缀");
  });

  // 幂等：再跑一次不应新增
  const second = TCM.model.ensureExecutions("plan-1", 2, {
    plans: seed.plans,
    executions: first.executions,
    assets: seed.assets,
    now: FIXED.now,
    idFactory
  });
  assert.equal(second.changed, false, "ensureExecutions 必须幂等");
  assert.equal(second.created.length, 0);
  assert.equal(second.executions.length, first.executions.length);

  // 已有结果绝不被重置
  const marked = first.executions.map((item) =>
    (item.caseAssetId === "bc-1" && item.round === 2 ? Object.assign({}, item, { status: "通过" }) : item));
  const third = TCM.model.ensureExecutions("plan-1", 2, {
    plans: seed.plans,
    executions: marked,
    assets: seed.assets,
    now: FIXED.now,
    idFactory
  });
  const kept = third.executions.find((item) => item.round === 2 && item.caseAssetId === "bc-1");
  assert.equal(kept.status, "通过", "已存在的执行结果不得被重置为未执行");

  // 唯一键全局不重复
  const keys = third.executions.map((item) => TCM.model.executionKey(item));
  assert.equal(new Set(keys).size, keys.length, "(planId, round, caseAssetId) 唯一键不得重复");

  // 未知计划安全兜底
  const missing = TCM.model.ensureExecutions("plan-not-exists", 1, { plans: seed.plans, executions: [], assets: [] });
  assert.equal(missing.changed, false);
  assert.deepEqual(missing.created, []);
});

test("planProgress 按 (planId, round) 聚合执行率 / 通过率 / 缺陷数", () => {
  const { TCM } = loadTcm();
  const seed = seedPlanState(TCM);

  const round1 = TCM.model.planProgress("plan-1", 1, { plans: seed.plans, executions: seed.executions });
  assert.equal(round1.total, 4, "首轮 4 条（bc-4 只在第 2 轮被排除）");
  assert.equal(round1.executed, 3, "通过 + 失败 + 阻塞 = 3");
  assert.equal(round1.notRun, 1);
  assert.equal(round1.passed, 1);
  assert.equal(round1.failed, 1);
  assert.equal(round1.blocked, 1);
  assert.equal(round1.skipped, 0);
  assert.equal(round1.executeRate, 75, "3/4 = 75%");
  assert.equal(round1.passRate, 33.3, "1/3 = 33.3%");
  assert.equal(round1.defectCount, 1, "已关联缺陷的执行实例数");
  assert.equal(round1.isStarted, true);
  assert.equal(round1.isFinished, false);
  assert.equal(round1.byStatus["通过"], 1);

  const round2 = TCM.model.planProgress("plan-1", 2, { plans: seed.plans, executions: seed.executions });
  assert.equal(round2.planned, 3, "第 2 轮排除 bc-4，只剩 3 条");
  assert.equal(round2.executed, 0);
  assert.equal(round2.executeRate, 0);
  assert.equal(round2.passRate, 0, "分母为 0 时通过率安全兜底为 0");
  assert.equal(round2.isStarted, false);

  const empty = TCM.model.planProgress("", 1, { plans: [], executions: [] });
  assert.equal(empty.total, 0);
  assert.equal(empty.isFinished, false, "空计划不能被判定为已完成");
});

test("planRoundCandidates 支持「全量复制上轮」与「仅导入上轮失败/阻塞」", () => {
  const { TCM } = loadTcm();
  const seed = seedPlanState(TCM);
  const plan = seed.plans[0];

  const all = TCM.model.planRoundCandidates(plan, 1, "all", seed.executions);
  assert.deepEqual(all, ["bc-1", "bc-2", "bc-3", "bc-4"], "默认复制上一轮全部条目");

  const failed = TCM.model.planRoundCandidates(plan, 1, "failed", seed.executions);
  assert.deepEqual(failed, ["bc-2", "bc-3"], "仅带入上轮失败(bc-2) + 阻塞(bc-3)");

  const noMode = TCM.model.planRoundCandidates(plan, 1, "", seed.executions);
  assert.deepEqual(noMode, all, "未指定 mode 时等价于全量");

  assert.equal(TCM.model.nextRoundNumber(plan), 3, "已有 2 轮 → 下一轮是第 3 轮");
  assert.equal(TCM.model.nextRoundNumber({}), 2, "无轮次信息时至少从第 2 轮开始");
});

test("deriveExecutionHistory 只读派生执行历史：过滤未执行 + 时间倒序 + 补计划名", () => {
  const { TCM } = loadTcm();
  const seed = seedPlanState(TCM);

  const history = TCM.model.deriveExecutionHistory("bc-1", seed.executions, seed.plans);
  assert.equal(history.length, 1, "bc-1 只有首轮一条有效执行");
  assert.equal(history[0].planName, "2026-08 回归计划", "必须补上计划名");
  assert.equal(history[0].result, "通过");
  assert.equal(history[0].round, 1);
  assert.equal(history[0].date, "2026-08-08");

  const blank = TCM.model.deriveExecutionHistory("bc-4", seed.executions, seed.plans);
  assert.equal(blank.length, 0, "未执行的记录不进入历史");

  const multi = seed.executions.concat(TCM.model.normalizeCaseExecutionList([
    { id: "exec-9", planId: "plan-1", round: 2, caseAssetId: "bc-1", status: "失败", finishedAt: "2026-08-09T09:00:00.000Z", updatedAt: "2026-08-09T09:00:00.000Z" }
  ], FIXED));
  const ordered = TCM.model.deriveExecutionHistory("bc-1", multi, seed.plans);
  assert.equal(ordered.length, 2);
  assert.equal(ordered[0].round, 2, "最新一条排在最前");
  assert.equal(ordered[1].round, 1);

  assert.deepEqual(TCM.model.deriveExecutionHistory("", seed.executions, seed.plans), [], "空 id 安全兜底");
});

test("store 允许宿主集合 bugs 写入（一键建 Bug），但 TCM 托管集合仍是 6 个", () => {
  const { TCM } = loadTcm();
  assert.equal(TCM.const.COLLECTIONS.length, 6, "TCM 托管集合数量不得变化");
  assert.equal(TCM.const.COLLECTIONS.includes("bugs"), false, "bugs 属于宿主集合，不进入 TCM 托管清单");
  assert.deepEqual(TCM.store._internals.HOST_COLLECTIONS, ["bugs"], "宿主可写集合白名单");

  const state = { settings: { currentOperator: "Edison - 测试" }, bugs: [] };
  TCM.store.setStateProvider(() => state);
  TCM.store.migrate(state);

  const ok = TCM.store.commit("bugs", [{ id: "bug-1", title: "入账失败", severity: "严重", status: "新建" }], {
    source: "execution",
    skipNormalize: true,
    reason: "createFromExecution"
  });
  assert.equal(ok, true, "execution 模块可以写 bugs");
  assert.equal(state.bugs.length, 1);
  assert.equal(state.bugs[0].id, "bug-1");
  assert.equal(state.bugs[0].severity, "严重", "skipNormalize 时原样写入宿主结构");

  assert.equal(TCM.store.commit("cases", []), false, "旧 cases 集合仍然禁止 TCM 写入");
  TCM.store.setStateProvider(null);
});

test("PRD §6.5 硬约束：标记执行结果不得改动 basicCaseLibrary 任何业务字段与 updatedAt", () => {
  const { TCM } = loadTcm();
  const seed = seedPlanState(TCM);
  const state = {
    settings: { currentOperator: "Edison - 测试" },
    basicCaseLibrary: clone(seed.assets),
    testPlans: clone(seed.plans),
    caseExecutions: clone(seed.executions),
    bugs: []
  };
  TCM.store.setStateProvider(() => state);
  TCM.store.migrate(state);

  /**
   * 计算资产指纹：去掉 linkedDefects 之后的完整快照 + updatedAt。
   * 与 TCM.execution.assetFingerprint 的口径一致，用于验证硬约束。
   * @param {object} asset 用例资产
   * @returns {{updatedAt:string, fingerprint:string, defectCount:number}} 指纹
   */
  function fingerprintOf(asset) {
    const rest = Object.assign({}, asset);
    delete rest.linkedDefects;
    return {
      updatedAt: String(asset.updatedAt || ""),
      fingerprint: JSON.stringify(rest),
      defectCount: (asset.linkedDefects || []).length
    };
  }

  const before = state.basicCaseLibrary.map(fingerprintOf);

  // ① 标记执行结果：只写 caseExecutions
  const marked = clone(state.caseExecutions).map((item) =>
    (item.id === "exec-4" ? Object.assign({}, item, { status: "通过", finishedAt: FIXED.now, updatedAt: FIXED.now }) : item));
  assert.equal(
    TCM.store.commit("caseExecutions", marked, { source: "execution", reason: "markResult" }),
    true,
    "写 caseExecutions 必须被允许"
  );
  const afterMark = state.basicCaseLibrary.map(fingerprintOf);
  assert.deepEqual(afterMark, before, "标记结果后基础用例库指纹（含 updatedAt）必须完全不变");

  // ② 一键建 Bug：唯一允许的写法是 linkedDefects 追加
  const appended = clone(state.basicCaseLibrary);
  appended[0].linkedDefects = (appended[0].linkedDefects || []).concat([{ id: "bug-1", title: "入账失败", status: "新建" }]);
  assert.equal(
    TCM.store.commit("basicCaseLibrary", appended, { source: "execution", reason: "linkDefect" }),
    true,
    "linkedDefects 追加是 §6.5 的唯一例外"
  );
  const afterLink = state.basicCaseLibrary.map(fingerprintOf);
  assert.equal(afterLink[0].updatedAt, before[0].updatedAt, "关联缺陷不得刷新 updatedAt");
  assert.equal(afterLink[0].fingerprint, before[0].fingerprint, "关联缺陷不得改动其它业务字段");
  assert.equal(afterLink[0].defectCount, before[0].defectCount + 1, "linkedDefects 应追加 1 条");

  // ③ 偷改业务字段 / updatedAt 必须被守卫拒绝
  const tampered = clone(state.basicCaseLibrary);
  tampered[1].title = "被执行台偷偷改了标题";
  assert.equal(
    TCM.store.commit("basicCaseLibrary", tampered, { source: "execution", reason: "markResult" }),
    false,
    "execution 改业务字段必须被拒绝"
  );

  const sneakyStamp = clone(state.basicCaseLibrary);
  sneakyStamp[1].updatedAt = "2099-01-01T00:00:00.000Z";
  assert.equal(
    TCM.store.commit("basicCaseLibrary", sneakyStamp, { source: "execution", reason: "markResult" }),
    false,
    "execution 偷改 updatedAt 必须被拒绝"
  );

  const removed = clone(state.basicCaseLibrary);
  removed[0].linkedDefects = [];
  assert.equal(
    TCM.store.commit("basicCaseLibrary", removed, { source: "execution", reason: "linkDefect" }),
    false,
    "linkedDefects 必须只追加不删除"
  );

  const finalFingerprint = state.basicCaseLibrary.map(fingerprintOf);
  assert.equal(finalFingerprint[1].fingerprint, before[1].fingerprint, "被拒绝的写入不得落库");
  TCM.store.setStateProvider(null);
});

test("index.html 必须在 app.js 之前引入 tcm-plans.js 与 tcm-execution.js", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf-8");
  const modelIndex = html.indexOf('src="tcm/tcm-model.js"');
  const plansIndex = html.indexOf('src="tcm/tcm-plans.js"');
  const executionIndex = html.indexOf('src="tcm/tcm-execution.js"');
  const appIndex = html.indexOf('src="app.js"');

  assert.ok(plansIndex > -1, "必须引入 tcm/tcm-plans.js");
  assert.ok(executionIndex > -1, "必须引入 tcm/tcm-execution.js");
  assert.ok(modelIndex < plansIndex, "plans 必须在 model 之后加载");
  assert.ok(modelIndex < executionIndex, "execution 必须在 model 之后加载");
  assert.ok(plansIndex < appIndex && executionIndex < appIndex, "两者都必须在 app.js 之前加载");

  assert.ok(html.includes('id="tcmPlansView"'), "缺少测试计划视图容器");
  assert.ok(html.includes('id="tcmExecutionView"'), "缺少测试执行台视图容器");
});

test("tcm-plans.js / tcm-execution.js 遵守模块契约：IIFE + use strict + window.TCM 挂载 + 生命周期", () => {
  const files = [
    { name: "tcm-plans.js", ns: "TCM.plans" },
    { name: "tcm-execution.js", ns: "TCM.execution" }
  ];

  files.forEach((entry) => {
    const source = fs.readFileSync(path.join(TCM_DIR, entry.name), "utf-8");
    assert.ok(source.includes('"use strict"'), `${entry.name} 必须开启严格模式`);
    assert.ok(/\(function\s*\(/.test(source), `${entry.name} 必须是 IIFE`);
    assert.ok(source.includes(`${entry.ns} =`), `${entry.name} 必须挂载 window.${entry.ns}`);
    ["mount", "render", "destroy"].forEach((fn) => {
      assert.ok(new RegExp(`function\\s+${fn}\\s*\\(`).test(source), `${entry.name} 必须实现 ${fn}()`);
    });
    assert.ok(source.includes("escapeHtml"), `${entry.name} 渲染前必须转义用户输入`);
    assert.ok(source.includes("TCM.store.commit") || source.includes("store.commit"), `${entry.name} 必须通过 store.commit 写入`);
    assert.equal(/localStorage\.setItem/.test(source), false, `${entry.name} 不得绕过 store 直接写 localStorage`);
  });
});

test("库 → 计划的 bus 契约：加入计划只发事件，不直接调用 TCM.plans", () => {
  const librarySource = fs.readFileSync(path.join(TCM_DIR, "tcm-library.js"), "utf-8");

  assert.ok(librarySource.includes('data-tcm-batch="plan"'), "批量工具条必须有「加入计划」按钮");
  assert.equal(
    /data-tcm-batch="plan"[^>]*disabled/.test(librarySource),
    false,
    "「加入计划」按钮不得再是 disabled 占位"
  );
  assert.ok(librarySource.includes("PLAN_ITEMS_CHANGED"), "必须发 plan:itemsChanged 事件");
  assert.ok(librarySource.includes('"request-add"'), "事件负载 action 必须是 request-add");
  assert.ok(librarySource.includes("caseAssetIds"), "事件负载必须携带 caseAssetIds（只传 id，不复制正文）");

  const plansSource = fs.readFileSync(path.join(TCM_DIR, "tcm-plans.js"), "utf-8");
  assert.ok(plansSource.includes("PLAN_ITEMS_CHANGED"), "plans 必须订阅 plan:itemsChanged");
  assert.ok(plansSource.includes("request-add"), "plans 必须处理 request-add");
});

test("tcm-shell 视图路由已覆盖 plans 与 execution", () => {
  const shellSource = fs.readFileSync(path.join(TCM_DIR, "tcm-shell.js"), "utf-8");
  assert.ok(shellSource.includes('moduleName: "plans"'), "shell 必须把 plans 视图指向 TCM.plans");
  assert.ok(shellSource.includes('moduleName: "execution"'), "shell 必须把 execution 视图指向 TCM.execution");
  assert.ok(shellSource.includes('containerId: "tcmPlansView"'), "plans 视图容器必须是 tcmPlansView");
  assert.ok(shellSource.includes('containerId: "tcmExecutionView"'), "execution 视图容器必须是 tcmExecutionView");
  assert.ok(shellSource.includes("TCM[def.moduleName]"), "shell 通过 moduleName 动态解析模块实例");
});

test("app.js 的 TCM_SHARED_COLLECTIONS 守卫已包含 testPlans 与 caseExecutions", () => {
  const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf-8");
  const start = appSource.indexOf("TCM_SHARED_COLLECTIONS");
  assert.ok(start > -1, "app.js 必须定义 TCM_SHARED_COLLECTIONS");
  const block = appSource.slice(start, start + 400);
  ["basicCaseLibrary", "testPlans", "caseExecutions", "reviewTickets", "caseDirectories", "caseVersions"].forEach((name) => {
    assert.ok(block.includes(`"${name}"`), `共享集合守卫缺少：${name}`);
  });
});

/* ================================================================== *

/* ================================================================== *

/* ================================================================== *
 * 10. T04 · 用例评审 + 统计看板 + 追溯图谱
 * ================================================================== */

/**
 * 构造一份 T04 测试夹具。
 * @param {object} TCM 已加载的 TCM 命名空间
 * @returns {object} 夹具
 */
function makeT04Fixture(TCM) {
  const requirements = [
    { id: "req-1", name: "需求A", type: "batch", moduleName: "入账", status: "进行中" },
    { id: "req-2", name: "需求B", type: "batch", moduleName: "对账", status: "进行中" },
    { id: "req-3", name: "需求C", type: "task", moduleName: "退款", status: "已上线" }
  ];
  const assets = [
    TCM.model.normalizeCaseAsset({ id: "bc-1", title: "用例1", business: "本地收款", product: "收款核心", module: "入账", type: "功能", priority: "P0", status: "待评审", automationEnabled: true, linkedRequirements: [{ id: "req-1" }] }, FIXED),
    TCM.model.normalizeCaseAsset({ id: "bc-2", title: "用例2", business: "本地收款", product: "收款核心", module: "对账", type: "接口", priority: "P1", status: "待评审", automationEnabled: false, linkedRequirements: [{ id: "req-2" }] }, FIXED),
    TCM.model.normalizeCaseAsset({ id: "bc-3", title: "用例3", business: "卡收单", product: "收单网关", module: "支付", type: "功能", priority: "P2", status: "草稿", automationEnabled: false, linkedRequirements: [] }, FIXED)
  ];
  const plans = [TCM.model.normalizeTestPlan({ id: "plan-1", name: "2026-08 回归计划", status: "进行中", batchId: "batch-1", currentRound: 1, rounds: [{ round: 1, name: "首轮", status: "进行中" }], items: [ { caseAssetId: "bc-1", executor: "Edison - 测试", order: 1 }, { caseAssetId: "bc-2", executor: "Alice - 测试", order: 2 } ] }, FIXED)];
  const executions = TCM.model.normalizeCaseExecutionList([
    { id: "exec-1", planId: "plan-1", round: 1, caseAssetId: "bc-1", status: "通过", executor: "Edison - 测试", finishedAt: FIXED.now, updatedAt: FIXED.now, caseSnapshot: { title: "用例1" } },
    { id: "exec-2", planId: "plan-1", round: 1, caseAssetId: "bc-2", status: "失败", executor: "Alice - 测试", finishedAt: FIXED.now, updatedAt: FIXED.now, linkedDefectId: "bug-1", caseSnapshot: { title: "用例2" } },
    { id: "exec-3", planId: "plan-1", round: 1, caseAssetId: "bc-3", status: "未执行", caseSnapshot: { title: "用例3" } }
  ], FIXED);
  const bugs = [{ id: "bug-1", title: "重复入账", severity: "严重", status: "新建", owner: "Edison - 测试", batchId: "batch-1", caseAssetId: "bc-1", executionId: "exec-1" }];
  const reviewTicket = TCM.model.normalizeReviewTicket({ id: "rev-1", title: "P0 用例评审", caseIds: ["bc-1", "bc-2"], status: "待评审", dueAt: "2026-08-09", comments: [] }, FIXED);
  return { requirements, assets, plans, executions, bugs, reviews: [reviewTicket], reviewTicket };
}

test("concludeReview §3.4：全部通过 → 用例流转 待评审→已确认，评审单结单 + finishedAt + reviewId", () => {
  const { TCM } = loadTcm();
  const { assets, reviewTicket } = makeT04Fixture(TCM);
  const result = TCM.model.concludeReview(reviewTicket, { "bc-1": "通过", "bc-2": "通过" }, { assets, now: FIXED.now });
  assert.equal(result.allReviewed, true, "两条都评完");
  assert.equal(result.conclusion, "通过");
  assert.equal(result.ticketStatus, "已完成");
  assert.equal(result.finishedAt, FIXED.now);
  assert.equal(result.assetChanges.length, 2);
  result.assetChanges.forEach((change) => {
    assert.equal(change.from, "待评审");
    assert.equal(change.to, "已确认");
    assert.equal(change.changed, true);
    assert.equal(change.reviewId, "rev-1", "建立资产 ↔ 评审单反查");
  });
});

test("concludeReview §3.4：打回 → 用例 待评审→草稿，评审单仍结单并建立 reviewId", () => {
  const { TCM } = loadTcm();
  const { assets, reviewTicket } = makeT04Fixture(TCM);
  const result = TCM.model.concludeReview(reviewTicket, { "bc-1": "打回", "bc-2": "通过" }, { assets, now: FIXED.now });
  assert.equal(result.conclusion, "打回", "聚合优先级：存在打回 → 打回");
  assert.equal(result.ticketStatus, "已完成");
  assert.equal(result.finishedAt, FIXED.now);
  const rejected = result.assetChanges.find((change) => change.caseId === "bc-1");
  assert.equal(rejected.from, "待评审");
  assert.equal(rejected.to, "草稿", "打回回退为草稿");
  assert.equal(rejected.reviewId, "rev-1");
});

test("concludeReview 聚合优先级：无打回时存在需修改 → 需修改", () => {
  const { TCM } = loadTcm();
  const { assets, reviewTicket } = makeT04Fixture(TCM);
  const mixed = TCM.model.concludeReview(reviewTicket, { "bc-1": "通过", "bc-2": "需修改" }, { assets, now: FIXED.now });
  assert.equal(mixed.conclusion, "需修改", "无打回且非全通过 → 需修改");
  const allPass = TCM.model.concludeReview(reviewTicket, { "bc-1": "通过", "bc-2": "通过" }, { assets, now: FIXED.now });
  assert.equal(allPass.conclusion, "通过");
});

test("concludeReview：未全部评审完 → 不结单，ticketStatus 保持评审中", () => {
  const { TCM } = loadTcm();
  const { assets, reviewTicket } = makeT04Fixture(TCM);
  const result = TCM.model.concludeReview(reviewTicket, { "bc-1": "通过" }, { assets, now: FIXED.now });
  assert.equal(result.allReviewed, false, "还有用例未评审");
  assert.equal(result.conclusion, "", "未出结论");
  assert.equal(result.ticketStatus, "评审中", "未结单");
  assert.equal(result.finishedAt, "", "不写 finishedAt");
  assert.equal(result.reviewedCount, 1);
  assert.equal(result.totalCount, 2);
});

test("concludeReview 状态机护栏：资产当前 status 非「待评审」时不做流转（changed:false）", () => {
  const { TCM } = loadTcm();
  const assets = [TCM.model.normalizeCaseAsset({ id: "bc-1", title: "已确认用例", business: "本地收款", status: "已确认" }, FIXED)];
  const ticket = TCM.model.normalizeReviewTicket({ id: "rev-1", title: "R", caseIds: ["bc-1"], status: "待评审" }, FIXED);
  const result = TCM.model.concludeReview(ticket, { "bc-1": "通过" }, { assets, now: FIXED.now });
  const change = result.assetChanges[0];
  assert.equal(change.from, "已确认");
  assert.equal(change.to, "已确认", "已确认的用例不得被误改回");
  assert.equal(change.changed, false, "未发生流转");
  assert.equal(change.reviewId, "rev-1", "通过动作仍写 reviewId 反查");
});

test("concludeReview §3.4：需修改 → 用例保持待评审，评审单不结单、不写 finishedAt / reviewId", () => {
  const { TCM } = loadTcm();
  const { assets, reviewTicket } = makeT04Fixture(TCM);
  const result = TCM.model.concludeReview(reviewTicket, { "bc-1": "需修改", "bc-2": "需修改" }, { assets, now: FIXED.now });
  assert.equal(result.conclusion, "需修改");
  assert.equal(result.ticketStatus, "评审中", "需修改不结单");
  assert.equal(result.finishedAt, "", "不写 finishedAt");
  result.assetChanges.forEach((change) => {
    assert.equal(change.to, "待评审", "保持待评审");
    assert.equal(change.changed, false, "from===to，无流转");
    assert.equal(change.reviewId, "", "需修改不写 reviewId");
  });
});

test("deriveReviewVerdicts 从 comments 反推每条用例最新判定（后写覆盖先写，非法动作忽略）", () => {
  const { TCM } = loadTcm();
  const ticket = {
    caseIds: ["bc-1", "bc-2"],
    comments: [
      { caseId: "bc-1", action: "通过" },
      { caseId: "bc-1", action: "打回" },
      { caseId: "bc-2", action: "需修改" },
      { caseId: "bc-1", action: "胡说八道" }
    ]
  };
  const verdicts = TCM.model.deriveReviewVerdicts(ticket);
  assert.equal(verdicts["bc-1"], "打回", "后写覆盖先写");
  assert.equal(verdicts["bc-2"], "需修改");
});

test("reviewProgress 计算已评 / 总数 / 逾期（dueAt 早于 now 且未完成 → overdue）", () => {
  const { TCM } = loadTcm();
  const ticket = {
    id: "rev-1", caseIds: ["bc-1", "bc-2"], dueAt: "2026-08-07", status: "待评审",
    comments: [{ caseId: "bc-1", action: "通过" }]
  };
  const open = TCM.model.reviewProgress(ticket, { now: FIXED.now });
  assert.equal(open.total, 2);
  assert.equal(open.reviewed, 1);
  assert.equal(open.pending, 1);
  assert.equal(open.percent, 50);
  assert.equal(open.overdue, true, "截止日早于现在且未完成 → 逾期");
  const done = Object.assign({}, ticket, { status: "已完成" });
  assert.equal(TCM.model.reviewProgress(done, { now: FIXED.now }).overdue, false, "已完成不判逾期");
});

test("computeRequirementCoverage：被引用需求计入 covered，未挂用例的需求计入 uncovered", () => {
  const { TCM } = loadTcm();
  const requirements = [
    { id: "req-1", name: "需求A", type: "batch" },
    { id: "req-2", name: "需求B", type: "batch" },
    { id: "req-3", name: "需求C", type: "task" }
  ];
  const assets = [
    TCM.model.normalizeCaseAsset({ id: "bc-1", title: "1", business: "本地收款", linkedRequirements: [{ id: "req-1" }] }, FIXED),
    TCM.model.normalizeCaseAsset({ id: "bc-2", title: "2", business: "本地收款", linkedRequirements: [{ id: "req-1" }, { id: "req-2" }] }, FIXED)
  ];
  const coverage = TCM.model.computeRequirementCoverage(assets, requirements);
  assert.equal(coverage.total, 3);
  assert.equal(coverage.covered, 2, "req-1 / req-2 被引用");
  assert.equal(coverage.rate, 66.7);
  assert.deepEqual(coverage.uncovered.map((item) => item.id), ["req-3"], "无用例需求进入 uncovered");
  assert.deepEqual(coverage.casesByRequirement["req-1"], ["bc-1", "bc-2"]);
  assert.deepEqual(coverage.casesByRequirement["req-2"], ["bc-2"]);
});

test("plannedSlotCount：精确扣 excludedRounds，分母不含本轮已移除条目", () => {
  const { TCM } = loadTcm();
  const plan = TCM.model.normalizeTestPlan({
    id: "plan-1", name: "P", status: "进行中", currentRound: 1,
    rounds: [{ round: 1, name: "首轮", status: "进行中" }],
    items: [
      { caseAssetId: "bc-1", order: 1 },
      { caseAssetId: "bc-2", order: 2 },
      { caseAssetId: "bc-3", order: 3, excludedRounds: [1] }
    ]
  }, FIXED);
  assert.equal(TCM.model.plannedSlotCount([plan], {}), 2, "首轮只算 bc-1 / bc-2");
  assert.equal(TCM.model.plannedSlotCount([plan], { planId: "plan-1", round: 1 }), 2);
  const twoRounds = TCM.model.normalizeTestPlan({
    id: "plan-2", name: "P2", status: "进行中", currentRound: 2,
    rounds: [
      { round: 1, name: "首轮", status: "已完成" },
      { round: 2, name: "第2轮", status: "进行中" }
    ],
    items: [{ caseAssetId: "bc-1", order: 1 }]
  }, FIXED);
  assert.equal(TCM.model.plannedSlotCount([twoRounds], {}), 2, "两轮各 1 槽");
  assert.equal(TCM.model.plannedSlotCount([twoRounds], { round: 2 }), 1);
});

test("computeMetrics 五大指标：需求覆盖率 / 计划执行率 / 通过率 / 缺陷拦截率 / 自动化占比", () => {
  const { TCM } = loadTcm();
  const { requirements, assets, plans, executions, bugs } = makeT04Fixture(TCM);
  const metrics = TCM.model.computeMetrics({ assets, plans, executions, bugs, requirements, now: FIXED.now });
  assert.equal(metrics.requirementTotal, 3);
  assert.equal(metrics.requirementCovered, 2);
  assert.equal(metrics.requirementCoverage, 66.7);
  assert.equal(metrics.plannedSlots, 2, "计划中仅 bc-1/bc-2 两个槽位（bc-3 草稿不在计划内）");
  assert.equal(metrics.executed, 2);
  assert.equal(metrics.planExecuteRate, 100, "两槽位均已执行");
  assert.equal(metrics.passed, 1);
  assert.equal(metrics.passRate, 50);
  assert.equal(metrics.defectLinkedCount, 1);
  assert.equal(metrics.defectInterceptRate, 50);
  assert.equal(metrics.automationCount, 1);
  assert.equal(metrics.automationRate, 33.3);
  assert.equal(metrics.windowKey, "all", "未传 window 默认全量");
  assert.ok(Array.isArray(metrics.drill.business));
  assert.ok(Array.isArray(metrics.drill.type));
  assert.ok(Array.isArray(metrics.drill.priority));
});

test("computeMetrics 未传 window 时不做任何窗口过滤（保持 T01 旧调用行为）", () => {
  const { TCM } = loadTcm();
  const { requirements, assets, plans, executions, bugs } = makeT04Fixture(TCM);
  const metrics = TCM.model.computeMetrics({ assets, plans, executions, bugs, requirements });
  assert.equal(metrics.effectiveWindow, "all");
  assert.equal(metrics.scopeName, "全部数据");
  assert.equal(metrics.caseTotal, 3, "全部资产计入，未按迭代裁剪");
});

test("scopeByWindow：all / rolling30 / batch 三档 + batch 未选迭代降级 all", () => {
  const { TCM } = loadTcm();
  const batches = [{ id: "batch-1", name: "迭代1", version: "v1", status: "进行中" }];
  const tasks = [{ id: "task-1", name: "任务1", batchId: "batch-1", status: "进行中" }];
  const assets = [
    TCM.model.normalizeCaseAsset({ id: "bc-1", title: "1", business: "本地收款", linkedBatchIds: ["batch-1"], updatedAt: FIXED.now }, FIXED),
    TCM.model.normalizeCaseAsset({ id: "bc-2", title: "2", business: "卡收单", product: "收单网关", module: "支付", linkedRequirements: [{ id: "task-1" }], updatedAt: FIXED.now }, FIXED),
    TCM.model.normalizeCaseAsset({ id: "bc-9", title: "9", business: "本地收款", updatedAt: FIXED.now }, FIXED)
  ];
  const plans = [TCM.model.normalizeTestPlan({ id: "plan-1", name: "P", status: "进行中", batchId: "batch-1", currentRound: 1, rounds: [{ round: 1, name: "首轮", status: "进行中" }], items: [{ caseAssetId: "bc-1", order: 1 }] }, FIXED)];
  const executions = TCM.model.normalizeCaseExecutionList([{ id: "exec-1", planId: "plan-1", round: 1, caseAssetId: "bc-1", status: "通过", finishedAt: FIXED.now }], FIXED);
  const reviews = [TCM.model.normalizeReviewTicket({ id: "rev-1", title: "R", caseIds: ["bc-1"], status: "待评审" }, FIXED)];
  const bugs = [{ id: "bug-1", title: "D", severity: "严重", status: "新建", batchId: "batch-1", caseAssetId: "bc-1" }];
  const base = { assets, plans, executions, reviews, bugs, batches, tasks, now: FIXED.now };
  const all = TCM.model.scopeByWindow(Object.assign({ activeBatchId: "batch-1", window: "all" }, base));
  assert.equal(all.windowKey, "all");
  assert.equal(all.assets.length, 3);
  const batch = TCM.model.scopeByWindow(Object.assign({ activeBatchId: "batch-1", window: "batch" }, base));
  assert.equal(batch.windowKey, "batch");
  assert.equal(batch.windowFallback, false);
  assert.deepEqual(batch.assets.map((item) => item.id).sort(), ["bc-1", "bc-2"].sort(), "命中迭代");
  assert.equal(batch.requirements.length, 2, "batch + task 需求");
  assert.equal(batch.plans.length, 1);
  assert.equal(batch.executions.length, 1);
  assert.equal(batch.reviews.length, 1);
  assert.equal(batch.bugs.length, 1);
  const fallback = TCM.model.scopeByWindow(Object.assign({ activeBatchId: "", window: "batch" }, base));
  assert.equal(fallback.effectiveWindow, "all", "未选迭代降级为 all（windowKey 仍保留请求值 batch）");
  assert.equal(fallback.windowFallback, true);
  assert.equal(fallback.assets.length, 3);
  const rolling = TCM.model.scopeByWindow(Object.assign({ activeBatchId: "batch-1", window: "rolling30" }, base));
  assert.equal(rolling.windowKey, "rolling30");
  assert.equal(rolling.assets.length, 3, "全部 updatedAt=now，保留");
  const oldAssets = [TCM.model.normalizeCaseAsset({ id: "bc-old", title: "old", business: "本地收款", updatedAt: "2026-01-01T00:00:00.000Z" }, FIXED)];
  const rollingOld = TCM.model.scopeByWindow({ assets: oldAssets, batches, tasks, now: FIXED.now, window: "rolling30" });
  assert.equal(rollingOld.assets.length, 0, "30 天前的资产被滚动窗口排除");
});

test("drillGroups：按业务线维度聚合用例数与执行结果，含 0 值预置桶", () => {
  const { TCM } = loadTcm();
  const { assets, executions } = makeT04Fixture(TCM);
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const groups = TCM.model.drillGroups(assets, executions, "business", TCM.const.BUSINESS, assetById);
  const local = groups.find((group) => group.key === "本地收款");
  const card = groups.find((group) => group.key === "卡收单");
  assert.equal(local.caseCount, 2);
  assert.equal(local.automation, 1);
  assert.equal(local.executed, 2, "本地收款的 bc-1（通过）、bc-2（失败）均执行过");
  assert.equal(local.passed, 1);
  assert.equal(local.failed, 1);
  assert.equal(local.notRun, 0);
  assert.equal(local.defects, 1);
  assert.equal(local.passRate, 50);
  assert.equal(local.automationRate, 50);
  assert.equal(card.caseCount, 1);
  assert.equal(card.notRun, 1);
  TCM.const.BUSINESS.forEach((business) => {
    assert.ok(groups.find((group) => group.key === business), "业务线桶 " + business + " 必须预置");
  });
});

test("buildGraph 正向钻取：需求 → 用例 → 执行 → 缺陷，连线形态正确", () => {
  const { TCM } = loadTcm();
  const { requirements, assets, plans, executions, bugs } = makeT04Fixture(TCM);
  const graph = TCM.model.buildGraph({ assets, plans, executions, bugs, requirements, origin: { kind: "requirement", id: "req-1" } });
  assert.equal(graph.origin.kind, "requirement");
  assert.equal(graph.origin.found, true);
  assert.equal(graph.requirements.length, 1);
  assert.equal(graph.cases.length, 1);
  assert.equal(graph.cases[0].id, "bc-1");
  assert.equal(graph.executions.length, 1);
  assert.equal(graph.defects.length, 1);
  assert.equal(graph.stats.requirementCount, 1);
  assert.equal(graph.stats.caseCount, 1);
  assert.equal(graph.stats.failedCount, 0, "缺陷 bug-1 挂在 exec-1（通过），不计失败");
  const edgeKeys = graph.edges.map((edge) => edge.from + "->" + edge.to + ":" + edge.kind);
  assert.ok(edgeKeys.includes("req:req-1->case:bc-1:req-case"));
  assert.ok(edgeKeys.includes("case:bc-1->exec:exec-1:case-exec"));
  assert.ok(edgeKeys.includes("exec:exec-1->defect:bug-1:exec-defect"));
});

test("buildGraph 反向钻取：缺陷 → 执行 → 用例 → 需求；孤儿用例（无需求）计入 orphanCaseCount", () => {
  const { TCM } = loadTcm();
  const requirements = [{ id: "req-1", name: "需求A", type: "batch" }];
  const assets = [
    TCM.model.normalizeCaseAsset({ id: "bc-1", title: "用例1", business: "本地收款", status: "已确认", linkedRequirements: [{ id: "req-1" }] }, FIXED),
    TCM.model.normalizeCaseAsset({ id: "bc-orphan", title: "孤儿", business: "本地收款", status: "草稿", linkedRequirements: [] }, FIXED)
  ];
  const plans = [TCM.model.normalizeTestPlan({ id: "plan-1", name: "P", status: "进行中", currentRound: 1, rounds: [{ round: 1, name: "首轮", status: "进行中" }], items: [{ caseAssetId: "bc-1", order: 1 }] }, FIXED)];
  const executions = TCM.model.normalizeCaseExecutionList([{ id: "exec-1", planId: "plan-1", round: 1, caseAssetId: "bc-1", status: "通过", finishedAt: FIXED.now, caseSnapshot: { title: "用例1" } }], FIXED);
  const bugs = [{ id: "bug-1", title: "缺陷1", severity: "严重", status: "新建", executionId: "exec-1", caseAssetId: "bc-1" }];
  const reverse = TCM.model.buildGraph({ assets, plans, executions, bugs, requirements, origin: { kind: "defect", id: "bug-1" } });
  assert.equal(reverse.origin.kind, "defect");
  assert.equal(reverse.origin.found, true);
  assert.equal(reverse.cases.length, 1);
  assert.equal(reverse.cases[0].id, "bc-1", "缺陷反查到执行 → 用例");
  assert.equal(reverse.requirements.length, 1);
  const orphanGraph = TCM.model.buildGraph({ assets, plans, executions, bugs, requirements, origin: { kind: "case", id: "bc-orphan" } });
  assert.equal(orphanGraph.cases.length, 1);
  assert.equal(orphanGraph.cases[0].id, "bc-orphan");
  assert.equal(orphanGraph.stats.orphanCaseCount, 1, "无关联需求的用例计入孤儿计数");
});

test("T04 视图模块契约：review / dashboard / trace 暴露 mount/render/destroy，且 IIFE + use strict", () => {
  const files = [
    { name: "tcm-review.js", ns: "TCM.review" },
    { name: "tcm-dashboard.js", ns: "TCM.dashboard" },
    { name: "tcm-trace.js", ns: "TCM.trace" }
  ];
  files.forEach((entry) => {
    const source = fs.readFileSync(path.join(TCM_DIR, entry.name), "utf-8");
    assert.ok(source.includes('"use strict"'), entry.name + " 必须开启严格模式");
    assert.ok(/\(function\s*\(/.test(source), entry.name + " 必须是 IIFE");
    assert.ok(source.includes(entry.ns + " ="), entry.name + " 必须挂载 window." + entry.ns);
    ["mount", "render", "destroy"].forEach((fn) => {
      assert.ok(source.includes("function " + fn + "("), entry.name + " 必须实现 " + fn + "()");
    });
    assert.ok(source.includes("escapeHtml"), entry.name + " 渲染前必须转义用户输入");
    assert.ok(source.includes("TCM.bus"), entry.name + " 必须走总线通信");
  });
});

test("库 → 评审 的 bus 契约：用例库「发起评审」只发 review:requested（action=request-create），不绕过 review 模块", () => {
  const librarySource = fs.readFileSync(path.join(TCM_DIR, "tcm-library.js"), "utf-8");
  assert.ok(librarySource.includes('data-tcm-batch="review"'), "批量工具条必须有「发起评审」按钮");
  assert.equal(/data-tcm-batch="review"[^>]*disabled/.test(librarySource), false, "「发起评审」按钮不得是 disabled 占位");
  assert.ok(librarySource.includes("REVIEW_REQUESTED"), "必须发 review:requested 事件");
  assert.ok(librarySource.includes('"request-create"'), "事件 action 必须是 request-create");
  assert.ok(librarySource.includes("caseAssetIds"), "事件负载必须携带 caseAssetIds（只传 id，不复制用例正文）");
  const reviewSource = fs.readFileSync(path.join(TCM_DIR, "tcm-review.js"), "utf-8");
  assert.ok(reviewSource.includes("REVIEW_REQUESTED"), "review 模块必须订阅 review:requested");
  assert.ok(reviewSource.includes('"request-create"'), "review 模块必须处理 request-create");
});

test("index.html 在 app.js 之前引入 tcm-review.js / tcm-dashboard.js / tcm-trace.js，并含三视图容器", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf-8");
  const reviewIndex = html.indexOf('src="tcm/tcm-review.js"');
  const dashIndex = html.indexOf('src="tcm/tcm-dashboard.js"');
  const traceIndex = html.indexOf('src="tcm/tcm-trace.js"');
  const appIndex = html.indexOf('src="app.js"');
  assert.ok(reviewIndex > -1 && dashIndex > -1 && traceIndex > -1, "3 个 T04 脚本必须都被引入");
  assert.ok(reviewIndex < appIndex && dashIndex < appIndex && traceIndex < appIndex, "T04 脚本必须在 app.js 之前加载");
  assert.ok(dashIndex > reviewIndex, "引入顺序：review → dashboard → trace");
  assert.ok(html.includes('id="tcmReviewView"'), "缺少评审视图容器");
  assert.ok(html.includes('id="tcmDashboardView"'), "缺少看板视图容器");
  assert.ok(html.includes('id="tcmTraceView"'), "缺少追溯视图容器");
});

test("tcm-shell 路由已覆盖 review / dashboard / trace 三模块 + 容器 id", () => {
  const shellSource = fs.readFileSync(path.join(TCM_DIR, "tcm-shell.js"), "utf-8");
  ["review", "dashboard", "trace"].forEach((name) => {
    assert.ok(shellSource.includes('moduleName: "' + name + '"'), "shell 必须把 " + name + " 视图指向 TCM." + name);
    const containerId = "tcm" + name[0].toUpperCase() + name.slice(1) + "View";
    assert.ok(shellSource.includes('containerId: "' + containerId + '"'), "shell 必须含 " + name + " 容器 id（" + containerId + "）");
  });
  assert.ok(shellSource.includes("TCM[def.moduleName]"), "shell 通过 moduleName 动态解析模块实例");
});

test("数据窗口枚举 METRIC_WINDOW_KEYS 与 app.js tcmDashboardWindow 白名单严格一致", () => {
  const { TCM } = loadTcm();
  const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf-8");
  const match = appSource.match(/target\.tcmDashboardWindow\s*=\s*\[([^\]]+)\]/);
  assert.ok(match, "必须在 app.js 找到 tcmDashboardWindow 白名单");
  const appKeys = match[1].match(/"([^"]+)"/g).map((item) => item.replace(/"/g, ""));
  assert.deepEqual(TCM.const.METRIC_WINDOW_KEYS, appKeys, "枚举键必须与 app.js 白名单逐一一致，否则本地偏好无法回读");
  TCM.const.METRIC_WINDOW.forEach((item) => {
    assert.ok(TCM.const.METRIC_WINDOW_KEYS.includes(item.key), "METRIC_WINDOW 缺少 key " + item.key);
  });
  assert.equal(TCM.const.ROLLING_WINDOW_DAYS, 30, "滚动窗口固定 30 天");
});

/* ==================================================================== *
 * T05 —— 导入导出 / 版本快照与基线 / 结构化步骤 / AI 建议态 / 自动化联动
 * 覆盖：
 *   1. 导出列矩阵与 CSV 往返保真
 *   2. 字段映射（中文别名 + 用户改映射 + 忽略列）
 *   3. 导入计划：冲突判定 / 文件内重复 / 校验失败 / 汇总
 *   4. applyImportPlan 执行结果与集合合并
 *   5. 版本快照追加（幂等重写 + 20 版护栏）与 versionsOfCase 倒序
 *   6. diffCaseSnapshots 字段级差异
 *   7. rollbackCaseAsset：业务字段回滚、执行事实不回滚、version 继续 +1
 *   8. 结构化步骤 ↔ automationSteps ↔ 纯文本 三向映射
 *   9. AI 建议对齐与合并（fillOnly 语义）
 *  10. 视图层契约：tcm-steps / tcm-io / tcm-ai 模块与 index.html / shell 挂载
 * ==================================================================== */

/**
 * 构造一条最小可用的用例资产。
 * @param {object} TCM TCM 命名空间
 * @param {object} patch 覆盖字段
 * @returns {object} 归一化后的用例资产
 */
function makeT05Case(TCM, patch) {
  return TCM.model.normalizeCaseAsset(Object.assign({
    id: "case-t05-1",
    business: "本地收款",
    product: "收银台",
    module: "下单",
    category: "正向",
    title: "微信支付下单成功",
    type: "功能测试",
    priority: "P0",
    status: "已确认",
    preconditions: "已登录且账户余额充足",
    steps: "1. 打开收银台\n2. 选择微信支付\n3. 点击确认支付",
    expected: "订单状态变为已支付",
    component: "收银台",
    tags: ["冒烟", "核心链路"],
    linkedRequirements: ["REQ-001"],
    version: 3,
    createdBy: "寇豆码",
    updatedBy: "寇豆码"
  }, patch || {}), { operator: "寇豆码" });
}

test("T05 buildExportRows：默认 17 列，withExtra 追加 4 列扩展列", () => {
  const { TCM } = loadTcm();
  const M = TCM.model;
  const asset = makeT05Case(TCM, {});

  const base = M.buildExportRows([asset]);
  assert.equal(base.columns.length, M.EXPORT_COLUMNS.length, "默认列数必须等于 EXPORT_COLUMNS");
  assert.equal(base.headers[0], "业务线", "首列表头为业务线");
  assert.equal(base.rows.length, 1, "一条资产导出一行");
  assert.equal(base.rows[0][base.headers.indexOf("标题")], "微信支付下单成功");
  // 注意：导出列用半角逗号连接数组（便于 Excel 再拆分），
  // 而版本 diff 用顿号连接（纯展示）。两处分隔符不同是刻意的，勿统一。
  assert.equal(base.rows[0][base.headers.indexOf("标签")], "冒烟,核心链路", "导出的数组字段以半角逗号连接");

  const extra = M.buildExportRows([asset], { withExtra: true });
  assert.equal(
    extra.columns.length,
    M.EXPORT_COLUMNS.length + M.EXPORT_EXTRA_COLUMNS.length,
    "含扩展列时列数 = 基础列 + 扩展列"
  );
  assert.ok(extra.headers.includes("用例ID"), "扩展列必须含用例ID，保证往返保真");
  assert.equal(extra.rows[0][extra.headers.indexOf("用例ID")], asset.id);
});

test("T05 CSV 往返：含逗号/引号/换行的字段经 toCsvText → parseCsvText 完全还原", () => {
  const { TCM } = loadTcm();
  const M = TCM.model;
  const asset = makeT05Case(TCM, {
    title: '标题含"引号"与,逗号',
    preconditions: "第一行\n第二行"
  });

  const exported = M.buildExportRows([asset], { withExtra: true });
  const csv = M.toCsvText(exported.headers, exported.rows);
  const parsed = M.parseCsvText(csv);

  assert.deepEqual(parsed.headers, exported.headers, "表头必须原样还原");
  assert.equal(parsed.rows.length, 1, "数据行数必须还原");
  assert.equal(parsed.rows[0]["标题"], '标题含"引号"与,逗号', "引号与逗号必须还原");
  assert.equal(parsed.rows[0]["前置条件"], "第一行\n第二行", "字段内换行必须还原");
});

test("T05 parseCsvText 兼容 BOM 与 CRLF", () => {
  const { TCM } = loadTcm();
  const parsed = TCM.model.parseCsvText("\uFEFF业务线,标题\r\n支付,下单成功\r\n");
  assert.deepEqual(parsed.headers, ["业务线", "标题"], "BOM 必须被剥离");
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0]["标题"], "下单成功");
});

test("T05 applyImportMapping：用户映射优先，中文别名兜底，空串表示忽略列", () => {
  const { TCM } = loadTcm();
  const M = TCM.model;
  const row = { "业务线": "本地收款", "用例名称": "下单", "备注列": "无关内容" };

  const auto = M.applyImportMapping(row, null);
  assert.equal(auto.business, "本地收款", "中文别名「业务线」应映射到 business");

  const manual = M.applyImportMapping(row, { "用例名称": "title", "备注列": "", "业务线": "business" });
  assert.equal(manual.title, "下单", "用户手工映射生效");
  assert.equal(manual.business, "本地收款");
  assert.ok(!Object.prototype.hasOwnProperty.call(manual, "备注列"), "映射为空串的列必须被忽略");
});

test("T05 guessImportMapping：识别中文别名，未知表头置空串", () => {
  const { TCM } = loadTcm();
  const mapping = TCM.model.guessImportMapping(["业务线", "标题", "优先级", "神秘列"]);
  assert.equal(mapping["业务线"], "business");
  assert.equal(mapping["标题"], "title");
  assert.equal(mapping["优先级"], "priority");
  assert.equal(mapping["神秘列"], "", "无法识别的表头默认忽略");
});

test("T05 buildImportPlan：新增 / 冲突覆盖 / 校验失败 / 文件内重复 四类判定与汇总", () => {
  const { TCM } = loadTcm();
  const M = TCM.model;
  const existing = [makeT05Case(TCM, { id: "case-exist-1", title: "微信支付下单成功" })];

  const rows = [
    { "业务线": "本地收款", "产品": "收银台", "模块": "下单", "标题": "微信支付下单成功", "步骤": "s", "预期": "e" },
    { "业务线": "本地收款", "产品": "收银台", "模块": "下单", "标题": "支付宝下单成功", "步骤": "s", "预期": "e" },
    { "业务线": "本地收款", "产品": "收银台", "模块": "下单", "标题": "支付宝下单成功", "步骤": "s", "预期": "e" },
    { "业务线": "本地收款", "产品": "收银台", "模块": "下单", "标题": "", "步骤": "s", "预期": "e" }
  ];

  const plan = M.buildImportPlan(rows, existing, { headers: Object.keys(rows[0]) });
  assert.equal(plan.items.length, 4);

  assert.equal(plan.items[0].conflict, true, "第 1 行与现有用例同键 → 冲突");
  assert.equal(plan.items[0].conflictId, "case-exist-1", "冲突必须回填被覆盖的用例 id");
  assert.equal(plan.items[0].action, "overwrite", "默认动作为覆盖");

  assert.equal(plan.items[1].conflict, false, "第 2 行无冲突");
  assert.equal(plan.items[1].action, "create");

  assert.equal(plan.items[2].duplicateInFile, true, "第 3 行与第 2 行文件内重复");
  assert.ok(
    plan.items[2].warnings.some((text) => text.includes("重复")),
    "文件内重复必须给出告警"
  );

  assert.equal(plan.items[3].ok, false, "标题为空 → 校验失败");
  assert.equal(plan.items[3].action, "skip", "校验失败强制 skip");

  assert.deepEqual(plan.summary, { total: 4, create: 2, overwrite: 1, skip: 0, error: 1 });
});

test("T05 buildImportPlan defaultAction=skip 时冲突行默认跳过", () => {
  const { TCM } = loadTcm();
  const M = TCM.model;
  const existing = [makeT05Case(TCM, { id: "case-exist-1" })];
  const plan = M.buildImportPlan(
    [{ "业务线": "本地收款", "产品": "收银台", "模块": "下单", "标题": "微信支付下单成功" }],
    existing,
    { defaultAction: "skip" }
  );
  assert.equal(plan.items[0].action, "skip");
  assert.equal(plan.summary.skip, 1);
  assert.equal(plan.summary.overwrite, 0);
});

test("T05 summarizeImportPlan 复算：用户改动 action 后汇总同步变化", () => {
  const { TCM } = loadTcm();
  const M = TCM.model;
  const items = [
    { ok: true, action: "create" },
    { ok: true, action: "overwrite" },
    { ok: true, action: "skip" },
    { ok: false, action: "skip" }
  ];
  assert.deepEqual(M.summarizeImportPlan(items), { total: 4, create: 1, overwrite: 1, skip: 1, error: 1 });
});

test("T05 applyImportPlan：create 新增、overwrite 保留原 id 并 version+1、skip 不动", () => {
  const { TCM } = loadTcm();
  const M = TCM.model;
  const existing = [makeT05Case(TCM, { id: "case-exist-1", version: 3 })];
  const plan = M.buildImportPlan(
    [
      { "业务线": "本地收款", "产品": "收银台", "模块": "下单", "标题": "微信支付下单成功", "步骤": "新步骤" },
      { "业务线": "本地收款", "产品": "收银台", "模块": "下单", "标题": "全新用例", "步骤": "s" }
    ],
    existing,
    {}
  );

  const result = M.applyImportPlan(existing, plan.items, { operator: "寇豆码" });
  assert.equal(result.created, 1, "1 条新增");
  assert.equal(result.overwritten, 1, "1 条覆盖");
  assert.equal(result.next.length, 2, "覆盖不新增条目，最终 2 条");

  const overwritten = result.next.find((item) => item.id === "case-exist-1");
  assert.ok(overwritten, "覆盖必须保留原 id，避免打断执行/缺陷关联");
  assert.equal(overwritten.steps, "新步骤", "业务字段被覆盖");
  assert.equal(overwritten.version, 4, "覆盖后 version 递增");
});

test("T05 appendCaseVersion：同 (caseAssetId, version) 视为重写而非追加", () => {
  const { TCM } = loadTcm();
  const M = TCM.model;
  const asset = makeT05Case(TCM, { version: 5 });

  let versions = M.appendCaseVersion([], asset, { operator: "寇豆码", changeNote: "首次" });
  assert.equal(versions.length, 1);

  versions = M.appendCaseVersion(versions, Object.assign({}, asset, { title: "改过的标题" }), {
    operator: "寇豆码",
    changeNote: "重写"
  });
  assert.equal(versions.length, 1, "同 version 重复保存不应产生第二条历史");
  assert.equal(versions[0].snapshot.title, "改过的标题", "重写后快照取最新内容");
});

test("T05 appendCaseVersion 施加 20 版容量护栏，仅保留最近 20 版", () => {
  const { TCM } = loadTcm();
  const M = TCM.model;
  let versions = [];
  for (let i = 1; i <= 25; i += 1) {
    versions = M.appendCaseVersion(versions, makeT05Case(TCM, { version: i, title: "T" + i }), {
      operator: "寇豆码"
    });
  }
  const mine = M.versionsOfCase(versions, "case-t05-1");
  assert.equal(mine.length, 20, "超过 20 版必须裁剪");
  assert.equal(mine[0].version, 25, "最新版本在最前");
  assert.equal(mine[mine.length - 1].version, 6, "最旧保留到第 6 版");
});

test("T05 versionsOfCase 只取指定用例并按 version 倒序", () => {
  const { TCM } = loadTcm();
  const M = TCM.model;
  let versions = [];
  versions = M.appendCaseVersion(versions, makeT05Case(TCM, { id: "case-a", version: 1 }), {});
  versions = M.appendCaseVersion(versions, makeT05Case(TCM, { id: "case-a", version: 2 }), {});
  versions = M.appendCaseVersion(versions, makeT05Case(TCM, { id: "case-b", version: 9 }), {});

  const listA = M.versionsOfCase(versions, "case-a");
  assert.deepEqual(listA.map((item) => item.version), [2, 1], "倒序返回");
  assert.deepEqual(M.versionsOfCase(versions, "").length, 0, "空 id 返回空数组");
  assert.deepEqual(M.versionsOfCase(versions, "case-none").length, 0, "不存在的 id 返回空数组");
});

test("T05 diffCaseSnapshots：仅内容不同的字段 changed=true，字段集合等于 CASE_DIFF_FIELDS", () => {
  const { TCM } = loadTcm();
  const M = TCM.model;
  const before = makeT05Case(TCM, {});
  const after = makeT05Case(TCM, { title: "新标题", priority: "P2", tags: ["冒烟"] });

  const diff = M.diffCaseSnapshots(before, after);
  assert.equal(diff.length, M.CASE_DIFF_FIELDS.length, "diff 字段数必须等于 CASE_DIFF_FIELDS");

  const changed = diff.filter((item) => item.changed).map((item) => item.key).sort();
  assert.deepEqual(changed, ["priority", "tags", "title"], "只有实际变化的三个字段标记为 changed");

  const titleRow = diff.find((item) => item.key === "title");
  assert.equal(titleRow.before, "微信支付下单成功");
  assert.equal(titleRow.after, "新标题");
  assert.equal(titleRow.label, "标题", "必须带中文标签供 UI 直接渲染");

  const tagsRow = diff.find((item) => item.key === "tags");
  assert.equal(tagsRow.before, "冒烟、核心链路", "数组字段格式化为逗号串再比较");
  assert.equal(tagsRow.after, "冒烟");
});

test("T05 diffCaseSnapshots 对空入参安全兜底（全部 changed=false）", () => {
  const { TCM } = loadTcm();
  const diff = TCM.model.diffCaseSnapshots(null, undefined);
  assert.equal(diff.length, TCM.model.CASE_DIFF_FIELDS.length);
  assert.equal(diff.some((item) => item.changed), false, "两侧皆空时不应有差异");
});

test("T05 rollbackCaseAsset：业务字段回滚，执行事实不回滚，version 继续 +1", () => {
  const { TCM } = loadTcm();
  const M = TCM.model;

  const snapshot = makeT05Case(TCM, { version: 2, title: "旧标题", priority: "P0", steps: "旧步骤" });
  const current = makeT05Case(TCM, {
    version: 7,
    title: "当前标题",
    priority: "P3",
    steps: "当前步骤",
    createdBy: "创建人甲",
    createdAt: "2025-01-01",
    reviewId: "review-9",
    linkedDefects: [{ id: "bug-1", title: "登录失败" }],
    executionHistory: [{ planId: "plan-1", round: 1, status: "失败" }]
  });

  const rolled = M.rollbackCaseAsset(current, snapshot, { operator: "寇豆码", now: "2025-08-07T10:00:00.000Z" });

  assert.equal(rolled.title, "旧标题", "业务字段回滚到快照");
  assert.equal(rolled.priority, "P0");
  assert.equal(rolled.steps, "旧步骤");

  assert.equal(rolled.id, current.id, "id 不变");
  assert.equal(rolled.createdBy, "创建人甲", "创建人不回滚");
  assert.equal(rolled.createdAt, "2025-01-01", "创建时间不回滚");
  assert.equal(rolled.reviewId, "review-9", "评审关联不回滚");
  assert.equal(rolled.linkedDefects.length, 1, "缺陷关联属执行事实，不回滚");
  assert.equal(rolled.executionHistory.length, 1, "执行历史属执行事实，不回滚");

  assert.equal(rolled.version, 8, "version 继续线性 +1，不倒退");
  assert.equal(rolled.updatedBy, "寇豆码");
  assert.equal(rolled.updatedAt, "2025-08-07T10:00:00.000Z");
  assert.notEqual(rolled, current, "必须返回全新对象，不得就地改写");
});

test("T05 结构化步骤：normalizeStepRowList 补齐字段并重排连续序号", () => {
  const { TCM } = loadTcm();
  const rows = TCM.model.normalizeStepRowList([
    { no: 9, action: "打开页面" },
    { action: "点击按钮", data: "#submit", expected: "跳转成功" },
    null
  ]);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((item) => item.no), [1, 2, 3], "序号必须重排为 1..N");
  assert.equal(rows[0].data, "", "缺失字段补空串");
  assert.equal(rows[1].expected, "跳转成功");
});

test("T05 moveStepRow 上移/下移并重排序号，越界安全", () => {
  const { TCM } = loadTcm();
  const M = TCM.model;
  const rows = M.normalizeStepRowList([
    { action: "A" }, { action: "B" }, { action: "C" }
  ]);

  const down = M.moveStepRow(rows, 0, 1);
  assert.deepEqual(down.map((item) => item.action), ["B", "A", "C"], "0 → 1 下移");
  assert.deepEqual(down.map((item) => item.no), [1, 2, 3], "移动后序号必须重排");

  const noop = M.moveStepRow(rows, 0, -1);
  assert.deepEqual(noop.map((item) => item.action), ["A", "B", "C"], "越界不改变顺序");
});

test("T05 stepRowsFromAutomationSteps：8 种 stepType 全部产出中文动作与预期", () => {
  const { TCM } = loadTcm();
  const M = TCM.model;
  const rows = M.stepRowsFromAutomationSteps([
    { stepType: "openPage", target: "https://pay.test/checkout" },
    { stepType: "click", target: "#wechat-pay" },
    { stepType: "input", target: "#amount", inputValue: "100" },
    { stepType: "waitElement", target: "#qrcode" },
    { stepType: "assertText", target: "#status", inputValue: "支付成功" },
    { stepType: "assertElement", target: "#receipt" },
    { stepType: "screenshot", inputValue: "result.png" },
    { stepType: "wait", inputValue: "500" },
    { stepType: "" }
  ]);

  assert.equal(rows.length, 8, "空 stepType 的步骤必须被跳过");
  assert.deepEqual(rows.map((item) => item.no), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(rows[0].action, "打开页面 https://pay.test/checkout");
  assert.equal(rows[0].expected, "页面正常打开");
  assert.equal(rows[2].action, "输入 #amount");
  assert.equal(rows[2].data, "100", "input 的 data 取 inputValue");
  assert.equal(rows[4].expected, "页面包含「支付成功」", "assertText 预期带断言文本");
  assert.equal(rows[7].action, "等待 500ms");

  Object.keys(M.AUTOMATION_STEP_LABELS).forEach((key) => {
    assert.ok(M.AUTOMATION_STEP_LABELS[key], "stepType " + key + " 必须有中文标签");
  });
});

test("T05 stepRowsFromAutomationSteps 支持 remark 追加括注", () => {
  const { TCM } = loadTcm();
  const rows = TCM.model.stepRowsFromAutomationSteps([
    { stepType: "click", target: "#pay", remark: "需二次确认" }
  ]);
  assert.equal(rows[0].action, "点击 #pay（需二次确认）");
});

test("T05 结构化步骤 → 纯文本 → 结构化 往返基本保真", () => {
  const { TCM } = loadTcm();
  const M = TCM.model;
  const rows = M.normalizeStepRowList([
    { action: "打开收银台", data: "https://pay.test", expected: "页面加载完成" },
    { action: "选择微信支付", data: "", expected: "出现二维码" }
  ]);

  const text = M.stepRowsToPlainText(rows);
  assert.ok(text.includes("1. 打开收银台"), "纯文本带序号");
  assert.ok(text.includes("数据：https://pay.test"), "有数据时追加数据段");
  assert.equal(text.split("\n").length, 2);

  const expectedText = M.stepRowsToExpectedText(rows);
  assert.equal(expectedText, "1. 页面加载完成\n2. 出现二维码", "预期文本逐条编号");

  const back = M.stepRowsFromPlainText(text);
  assert.equal(back.length, 2, "回解析步骤数一致");
  assert.equal(back[0].action, "打开收银台", "动作文本还原");
  assert.equal(back[0].data, "https://pay.test", "数据段还原");
});

test("T05 stepRowsFromPlainText 兼容多种项目符号与无序号行", () => {
  const { TCM } = loadTcm();
  const rows = TCM.model.stepRowsFromPlainText("1. 第一步\n2、第二步\n- 第三步\n* 第四步\n第五步\n\n");
  assert.equal(rows.length, 5, "空行被忽略");
  assert.deepEqual(rows.map((item) => item.action), ["第一步", "第二步", "第三步", "第四步", "第五步"]);
  assert.deepEqual(rows.map((item) => item.no), [1, 2, 3, 4, 5]);
});

test("T05 stepRowsToPlainText 过滤纯空步骤，不产出「3. 」这类空行", () => {
  const { TCM } = loadTcm();
  const text = TCM.model.stepRowsToPlainText([
    { action: "有效步骤" },
    { action: "", data: "", expected: "" }
  ]);
  assert.equal(text, "1. 有效步骤", "空步骤不得输出");
});

test("T05 buildAiSuggestions：标题精确匹配优先，剩余按序兜底，无对应项 matched=false", () => {
  const { TCM } = loadTcm();
  const M = TCM.model;
  const cases = [
    makeT05Case(TCM, { id: "case-1", title: "用例甲" }),
    makeT05Case(TCM, { id: "case-2", title: "用例乙" }),
    makeT05Case(TCM, { id: "case-3", title: "用例丙" })
  ];
  const aiCases = [
    { title: "用例乙", steps: ["步骤1", "步骤2"], expected: "乙的预期" },
    { title: "毫不相干", steps: "散装步骤", expected: "兜底预期" }
  ];

  const suggestions = M.buildAiSuggestions(cases, aiCases);
  assert.equal(suggestions.length, 3, "建议数必须等于选中用例数");

  const forB = suggestions.find((item) => item.caseAssetId === "case-2");
  assert.equal(forB.matched, true, "标题精确匹配命中");
  assert.equal(forB.steps, "步骤1\n步骤2", "数组步骤合并为多行文本");
  assert.equal(forB.expected, "乙的预期");

  const matchedCount = suggestions.filter((item) => item.matched).length;
  assert.equal(matchedCount, 2, "AI 只返回 2 条，最多命中 2 条");

  const unmatched = suggestions.find((item) => !item.matched);
  assert.equal(unmatched.accepted, false, "建议默认不勾选，必须用户确认");
  assert.ok(unmatched.reason.includes("未返回"), "未命中必须给出原因");

  suggestions.forEach((item) => {
    assert.equal(item.accepted, false, "buildAiSuggestions 不得自动接受任何建议");
  });
});

test("T05 mergeAiSuggestion：默认覆盖，fillOnly=true 时只补空字段", () => {
  const { TCM } = loadTcm();
  const M = TCM.model;
  const asset = makeT05Case(TCM, { steps: "原步骤", expected: "", preconditions: "原前置" });
  const suggestion = { steps: "AI步骤", expected: "AI预期", preconditions: "AI前置" };

  const overwrite = M.mergeAiSuggestion(asset, suggestion, { operator: "寇豆码" });
  assert.equal(overwrite.steps, "AI步骤", "默认覆盖非空字段");
  assert.equal(overwrite.expected, "AI预期");
  assert.equal(overwrite.preconditions, "AI前置");

  const fillOnly = M.mergeAiSuggestion(asset, suggestion, { operator: "寇豆码", fillOnly: true });
  assert.equal(fillOnly.steps, "原步骤", "fillOnly 下非空字段保持不变");
  assert.equal(fillOnly.preconditions, "原前置");
  assert.equal(fillOnly.expected, "AI预期", "fillOnly 下空字段才被补齐");

  assert.equal(fillOnly.version, asset.version, "合并不自行 +1，由调用方决定");
  assert.notEqual(fillOnly, asset, "必须返回新对象");
});

test("T05 mergeAiSuggestion 忽略空建议字段，不会把内容清空", () => {
  const { TCM } = loadTcm();
  const asset = makeT05Case(TCM, { steps: "原步骤", expected: "原预期" });
  const merged = TCM.model.mergeAiSuggestion(asset, { steps: "", expected: "   " }, {});
  assert.equal(merged.steps, "原步骤", "空建议不得清空原值");
  assert.equal(merged.expected, "原预期");
});

test("T05 buildAiCaseContext 汇总选中用例上下文（标题/前置/步骤/预期）", () => {
  const { TCM } = loadTcm();
  const text = TCM.model.buildAiCaseContext([makeT05Case(TCM, {})]);
  assert.ok(text.includes("微信支付下单成功"), "上下文必须含标题");
  assert.ok(text.includes("已登录且账户余额充足"), "上下文必须含前置条件");
  assert.ok(text.includes("现有步骤"), "上下文必须标注现有步骤");
  assert.ok(text.includes("现有预期"), "上下文必须标注现有预期");
});

test("T05 buildOpml / buildMarkdownOutline 产出结构化脑图与大纲", () => {
  const { TCM } = loadTcm();
  const M = TCM.model;
  const cases = [
    makeT05Case(TCM, { id: "c1", business: "本地收款", product: "收银台", module: "下单", title: "用例甲" }),
    makeT05Case(TCM, { id: "c2", business: "本地收款", product: "收银台", module: "退款", title: "用例乙" })
  ];

  const opml = M.buildOpml(cases, { title: "支付用例" });
  assert.ok(opml.startsWith("<?xml"), "OPML 必须是合法 XML 声明开头");
  assert.ok(opml.includes("<opml"), "含 opml 根节点");
  assert.ok(opml.includes("用例甲") && opml.includes("用例乙"), "所有用例标题都要出现");
  assert.ok(opml.includes("退款"), "模块层级要出现");

  const md = M.buildMarkdownOutline(cases, { title: "支付用例" });
  assert.ok(md.includes("# "), "Markdown 大纲含一级标题");
  assert.ok(md.includes("用例甲"), "含用例标题");
});

test("T05 buildOpml 对用户内容做 XML 转义，防止破坏文档结构", () => {
  const { TCM } = loadTcm();
  const opml = TCM.model.buildOpml([makeT05Case(TCM, { title: '<script>&"恶意"' })], {});
  assert.ok(!opml.includes("<script>"), "尖括号必须被转义");
  assert.ok(opml.includes("&lt;script&gt;") || opml.includes("&#60;"), "应产出转义实体");
});

test("T05 store：caseVersions 是 TCM 托管集合，可经 commit 写入并归一化", () => {
  const { TCM } = loadTcm();
  const state = TCM.store.migrate({});
  TCM.store.setStateProvider(() => state);

  const asset = makeT05Case(TCM, {});
  const versions = TCM.model.appendCaseVersion([], asset, { operator: "寇豆码", changeNote: "T05 快照" });
  TCM.store.commit("caseVersions", versions, { module: "caseEditor" });

  const saved = TCM.store.collection("caseVersions");
  assert.equal(saved.length, 1, "版本必须落到 store");
  assert.equal(saved[0].caseAssetId, asset.id);
  assert.equal(saved[0].version, asset.version);
  assert.equal(saved[0].changeNote, "T05 快照");
  assert.ok(saved[0].snapshot && typeof saved[0].snapshot === "object", "必须带完整快照对象");
});

test("T05 视图契约：tcm-steps / tcm-io / tcm-ai 均为 IIFE + use strict + 挂 window.TCM", () => {
  const files = { "tcm-steps.js": "steps", "tcm-io.js": "io", "tcm-ai.js": "ai" };
  Object.keys(files).forEach((fileName) => {
    const source = fs.readFileSync(path.join(TCM_DIR, fileName), "utf-8");
    assert.ok(source.includes('"use strict"'), fileName + " 必须开启严格模式");
    assert.ok(/\(function\s*\(/.test(source), fileName + " 必须用 IIFE 包裹，不得污染全局");
    assert.ok(
      source.includes("TCM." + files[fileName] + " =") || source.includes('TCM["' + files[fileName] + '"]'),
      fileName + " 必须挂载到 window.TCM." + files[fileName]
    );
  });
});

test("T05 视图契约：tcm-io / tcm-ai 暴露 mount + destroy，tcm-steps 暴露纯渲染与事件接管 API", () => {
  const ioSource = fs.readFileSync(path.join(TCM_DIR, "tcm-io.js"), "utf-8");
  ["mount", "destroy", "openExport", "openImport"].forEach((fn) => {
    assert.ok(new RegExp("\\b" + fn + "\\b").test(ioSource), "tcm-io 必须暴露 " + fn);
  });

  const aiSource = fs.readFileSync(path.join(TCM_DIR, "tcm-ai.js"), "utf-8");
  ["mount", "destroy", "open"].forEach((fn) => {
    assert.ok(new RegExp("\\b" + fn + "\\b").test(aiSource), "tcm-ai 必须暴露 " + fn);
  });

  const stepsSource = fs.readFileSync(path.join(TCM_DIR, "tcm-steps.js"), "utf-8");
  ["render", "owns", "handleClick", "handleInput", "handleDrag", "syncToDraft"].forEach((fn) => {
    assert.ok(new RegExp("\\b" + fn + "\\b").test(stepsSource), "tcm-steps 必须暴露 " + fn);
  });
});

test("T05 index.html：新增 3 个脚本在 case-editor 之后、app.js 之前，且容器 id 齐备", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf-8");
  const at = (needle) => html.indexOf(needle);

  const editorAt = at("tcm/tcm-case-editor.js");
  // 必须锚定 app.js 的 <script src> 标签本身：
  // 直接 indexOf("app.js") 会命中更靠前的注释/预加载提示，造成假失败。
  const appMatch = html.match(/<script[^>]+src=["'](?:\.\/)?app\.js/);
  assert.ok(appMatch, "index.html 必须以 <script src> 方式引入 app.js");
  const appAt = appMatch.index;
  ["tcm/tcm-steps.js", "tcm/tcm-ai.js", "tcm/tcm-io.js"].forEach((src) => {
    const pos = at(src);
    assert.ok(pos > -1, "index.html 必须引入 " + src);
    assert.ok(pos > editorAt, src + " 必须在 tcm-case-editor.js 之后加载");
    assert.ok(pos < appAt, src + " 必须在 app.js 之前加载");
  });

  assert.ok(html.includes('id="tcmIoRoot"'), "必须存在导入导出对话框挂载点 tcmIoRoot");
  assert.ok(html.includes('id="tcmAiSuggestRoot"'), "必须存在 AI 建议态挂载点 tcmAiSuggestRoot");
});

test("T05 tcm-shell 挂载并销毁 io / ai 两个单例，避免重复挂载与内存泄漏", () => {
  const shell = fs.readFileSync(path.join(TCM_DIR, "tcm-shell.js"), "utf-8");
  assert.ok(shell.includes("tcmIoRoot"), "shell 必须挂载 io 到 tcmIoRoot");
  assert.ok(shell.includes("tcmAiSuggestRoot"), "shell 必须挂载 ai 到 tcmAiSuggestRoot");
  assert.ok(/destroy/.test(shell), "shell 必须在 destroy 中回收单例");
});

test("T05 server.js：xlsx 导入导出两个路由与静态资源白名单已就位", () => {
  const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf-8");
  assert.ok(server.includes("/api/case-export-xlsx"), "必须存在 xlsx 导出路由");
  assert.ok(server.includes("/api/case-import-xlsx"), "必须存在 xlsx 导入路由");
  ["tcm/tcm-steps.js", "tcm/tcm-ai.js", "tcm/tcm-io.js"].forEach((asset) => {
    assert.ok(server.includes(asset), "静态白名单必须包含 " + asset);
  });
  assert.ok(server.includes("tcm_xlsx.py"), "必须引用 Python xlsx 桥接脚本");
});

test("T05 scripts/tcm_xlsx.py 存在且实现 export/import 双模式与 openpyxl 缺失降级", () => {
  const py = fs.readFileSync(path.join(__dirname, "..", "scripts", "tcm_xlsx.py"), "utf-8");
  assert.ok(py.includes("openpyxl"), "必须使用 openpyxl 读写 xlsx");
  assert.ok(/export/.test(py) && /import/.test(py), "必须同时支持导出与导入模式");
  assert.ok(
    py.includes("ImportError") || py.includes("ModuleNotFoundError"),
    "openpyxl 缺失时必须捕获导入异常并降级，不得直接崩溃"
  );
});
