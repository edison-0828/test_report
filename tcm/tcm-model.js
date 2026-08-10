/**
 * tcm-model.js —— 测试用例管理模块 L1 模型层（纯函数，可单测）
 *
 * 职责：
 *   1. 6 个 normalizeXxx()：把任意外部数据（远端 state / 导入文件 / AI 输出）归一化成合法实体
 *   2. 集合级归一化 normalizeXxxList()：去重 + 排序 + 唯一键约束
 *   3. buildDirectoryTree()：由资产字段派生 4 级目录树，叠加显式空目录节点
 *   4. applyFilters() / computeMetrics() / validateImportRow()
 *
 * 硬约束：本文件内所有函数必须是纯函数（不读写 global.state、不操作 DOM），
 *         这样才能被 tests/tcm-model.test.js 用 node --test 直接覆盖。
 */
(function (global) {
  "use strict";

  const TCM = global.TCM = global.TCM || {};
  const C = TCM.const;
  const U = TCM.util;

  if (!C || !U) {
    throw new Error("[tcm-model] 依赖缺失：请确保 tcm-core.js 在 tcm-model.js 之前加载。");
  }

  const D = C.DEFAULTS;

  /* ================================================================== *
   * 一、用例资产 CaseAsset
   * ================================================================== */

  /**
   * 归一化单条结构化步骤行。
   * @param {*} raw 原始行
   * @param {number} index 序号（从 0 开始）
   * @returns {{no:number,action:string,data:string,expected:string}} 步骤行
   */
  function normalizeStepRow(raw, index) {
    const item = raw && typeof raw === "object" ? raw : {};
    return {
      no: U.num(item.no, index + 1, 1),
      action: U.str(item.action),
      data: U.str(item.data),
      expected: U.str(item.expected)
    };
  }

  /**
   * 归一化关联需求引用。
   * @param {*} list 原始数组
   * @returns {Array<{type:string,id:string,name:string}>} 需求引用数组（按 type+id 去重）
   */
  function normalizeLinkedRequirements(list) {
    const seen = new Set();
    const out = [];
    U.toArray(list).forEach((raw) => {
      const item = raw && typeof raw === "object" ? raw : {};
      const id = U.str(item.id);
      if (!id) {
        return;
      }
      const type = U.oneOf(item.type, C.REQ_TYPE, D.REQ_TYPE);
      const key = `${type}::${id}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      out.push({ type, id, name: U.str(item.name) });
    });
    return out;
  }

  /**
   * 归一化关联缺陷。
   * @param {*} list 原始数组
   * @returns {Array<{id:string,title:string}>} 缺陷数组（按 id 去重，无 id 的按 title 去重）
   */
  function normalizeLinkedDefects(list) {
    const seen = new Set();
    const out = [];
    U.toArray(list).forEach((raw) => {
      const item = raw && typeof raw === "object" ? raw : {};
      const id = U.str(item.id);
      const title = U.str(item.title);
      if (!id && !title) {
        return;
      }
      const key = id || `title::${title}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      out.push({ id, title });
    });
    return out;
  }

  /**
   * 归一化执行历史（只读汇总；P0 起由 caseExecutions 派生，此处仅保留存量）。
   * @param {*} list 原始数组
   * @returns {Array<{date:string,executor:string,result:string,note:string}>} 历史数组
   */
  function normalizeExecutionHistory(list) {
    return U.toArray(list).map((raw) => {
      const item = raw && typeof raw === "object" ? raw : {};
      return {
        date: U.dateOr(item.date, ""),
        executor: U.str(item.executor, "—"),
        result: U.str(item.result, "通过"),
        note: U.str(item.note)
      };
    });
  }

  /**
   * 归一化用例资产，落地全部迁移规则（系统设计 §3.1 / T01 交付项 6）。
   *
   * 迁移规则：
   *   - product 缺失 → ""
   *   - module 缺失 → 复制 category
   *   - type 缺失 → "功能"
   *   - version 缺失 → 1；reviewId / isBaseline / baselineFrom 补默认
   *   - linkedRequirements / stepRows 缺失 → []
   *   - 旧字段 testPlans（实为 batchId 数组）→ 改名 linkedBatchIds，旧键不再出现在结果中（Q6）
   *   - createdBy / updatedBy / updatedAt 补默认
   *
   * @param {*} raw 原始资产对象
   * @param {{operator?:string, now?:string, todayDate?:string}} [options] 可选默认值（便于单测固定时间）
   * @returns {object} 归一化后的 CaseAsset（全新对象，不修改入参）
   */
  function normalizeCaseAsset(raw, options) {
    const item = raw && typeof raw === "object" ? raw : {};
    const opts = options && typeof options === "object" ? options : {};
    const operator = U.str(opts.operator, D.OPERATOR);
    const nowStamp = U.str(opts.now) || U.nowIso();
    const todayDate = U.str(opts.todayDate) || U.today();

    const category = U.str(item.category);
    // 旧字段 testPlans 存的是 batchId 数组，与新集合 state.testPlans 同名冲突 → 改名合并
    const legacyBatchIds = U.stringList(item.testPlans);
    const linkedBatchIds = U.stringList(U.toArray(item.linkedBatchIds).concat(legacyBatchIds));

    return {
      id: U.str(item.id) || U.uid(C.ID_PREFIX.CASE_ASSET),
      // —— 多级目录 ——
      business: U.oneOf(
        U.str(item.business) === "VA 设计下业务" ? "VA账户" : item.business,
        TCM.catalog && typeof TCM.catalog.get === "function" ? TCM.catalog.get().businesses : C.BUSINESS,
        D.BUSINESS
      ),
      product: U.str(item.product),
      module: U.str(item.module) || category,
      category,
      // —— 基础字段 ——
      title: U.str(item.title, "未命名基础用例"),
      type: U.oneOf(item.type, C.CASE_TYPE, D.CASE_TYPE),
      objective: U.str(item.objective),
      preconditions: U.str(item.preconditions),
      testData: U.str(item.testData),
      steps: U.str(item.steps),
      stepRows: U.toArray(item.stepRows).map(normalizeStepRow),
      expected: U.str(item.expected),
      priority: U.oneOf(item.priority, C.PRIORITY, D.PRIORITY),
      status: U.oneOf(item.status, C.CASE_STATUS, D.CASE_STATUS),
      component: U.str(item.component),
      tags: U.stringList(item.tags),
      // —— 自动化（沿用现有）——
      automationEnabled: U.bool(item.automationEnabled, false),
      automationTargetPath: U.str(item.automationTargetPath),
      automationSteps: U.toArray(item.automationSteps),
      automationLastRun: item.automationLastRun && typeof item.automationLastRun === "object"
        ? item.automationLastRun
        : null,
      // —— 关联与追溯 ——
      linkedRequirements: normalizeLinkedRequirements(item.linkedRequirements),
      linkedDefects: normalizeLinkedDefects(item.linkedDefects),
      linkedBatchIds,
      executionHistory: normalizeExecutionHistory(item.executionHistory),
      // —— 评审与版本 ——
      reviewId: U.str(item.reviewId),
      version: U.num(item.version, 1, 1),
      isBaseline: U.bool(item.isBaseline, false),
      baselineFrom: U.str(item.baselineFrom),
      // —— 审计 ——
      createdBy: U.str(item.createdBy, operator),
      createdAt: U.dateOr(item.createdAt, todayDate),
      updatedBy: U.str(item.updatedBy, U.str(item.createdBy, operator)),
      updatedAt: U.str(item.updatedAt) || nowStamp
    };
  }

  /* ================================================================== *
   * 二、测试计划 TestPlan
   * ================================================================== */

  /**
   * 归一化计划轮次。
   * @param {*} raw 原始轮次
   * @param {number} index 序号（从 0 开始）
   * @returns {{round:number,name:string,status:string,startedAt:string,finishedAt:string}} 轮次
   */
  function normalizePlanRound(raw, index) {
    const item = raw && typeof raw === "object" ? raw : {};
    const round = U.num(item.round, index + 1, 1);
    return {
      round,
      name: U.str(item.name, round === 1 ? "首轮" : `第 ${round} 轮`),
      status: U.oneOf(item.status, C.ROUND_STATUS, D.ROUND_STATUS),
      startedAt: U.str(item.startedAt),
      finishedAt: U.str(item.finishedAt)
    };
  }

  /**
   * 归一化计划条目（引用用例，不复制内容）。
   * @param {*} raw 原始条目
   * @param {number} index 序号（从 0 开始）
   * @param {string} nowStamp 兜底时间戳
   * @param {string} operator 兜底操作人
   * @returns {object} 计划条目
   */
  function normalizePlanItem(raw, index, nowStamp, operator) {
    const item = raw && typeof raw === "object" ? raw : {};
    return {
      caseAssetId: U.str(item.caseAssetId),
      executor: U.str(item.executor),
      order: U.num(item.order, index + 1, 1),
      excludedRounds: U.toArray(item.excludedRounds)
        .map((value) => U.num(value, 0, 0))
        .filter((value) => value >= 1),
      addedBy: U.str(item.addedBy, operator),
      addedAt: U.str(item.addedAt) || nowStamp
    };
  }

  /**
   * 归一化测试计划（系统设计 §3.2）。
   * 约束：rounds 至少 1 轮且 round 唯一升序；items 内 caseAssetId 唯一、order 重排为 1..n。
   * @param {*} raw 原始计划对象
   * @param {{operator?:string, now?:string}} [options] 可选默认值
   * @returns {object} 归一化后的 TestPlan
   */
  function normalizeTestPlan(raw, options) {
    const item = raw && typeof raw === "object" ? raw : {};
    const opts = options && typeof options === "object" ? options : {};
    const operator = U.str(opts.operator, D.OPERATOR);
    const nowStamp = U.str(opts.now) || U.nowIso();

    const roundSeen = new Set();
    const rounds = U.toArray(item.rounds)
      .map(normalizePlanRound)
      .filter((round) => {
        if (roundSeen.has(round.round)) {
          return false;
        }
        roundSeen.add(round.round);
        return true;
      })
      .sort((a, b) => a.round - b.round);
    if (rounds.length === 0) {
      rounds.push(normalizePlanRound({ round: 1, name: "首轮" }, 0));
    }

    const itemSeen = new Set();
    const items = [];
    U.toArray(item.items).forEach((entry, index) => {
      const normalized = normalizePlanItem(entry, index, nowStamp, operator);
      if (!normalized.caseAssetId || itemSeen.has(normalized.caseAssetId)) {
        return;
      }
      itemSeen.add(normalized.caseAssetId);
      items.push(normalized);
    });
    items.sort((a, b) => a.order - b.order);
    items.forEach((entry, index) => {
      entry.order = index + 1;
    });

    const maxRound = rounds[rounds.length - 1].round;
    const currentRound = Math.min(U.num(item.currentRound, 1, 1), maxRound);

    return {
      id: U.str(item.id) || U.uid(C.ID_PREFIX.TEST_PLAN),
      batchId: U.str(item.batchId),
      batchVersion: U.str(item.batchVersion),
      name: U.str(item.name, "未命名测试计划"),
      description: U.str(item.description),
      status: U.oneOf(item.status, C.PLAN_STATUS, D.PLAN_STATUS),
      owner: U.str(item.owner),
      startAt: U.dateOr(item.startAt, ""),
      endAt: U.dateOr(item.endAt, ""),
      currentRound,
      rounds,
      items,
      createdBy: U.str(item.createdBy, operator),
      createdAt: U.str(item.createdAt) || nowStamp,
      updatedBy: U.str(item.updatedBy, U.str(item.createdBy, operator)),
      updatedAt: U.str(item.updatedAt) || nowStamp
    };
  }

  /* ================================================================== *
   * 三、执行实例 CaseExecution
   * ================================================================== */

  /**
   * 归一化执行证据条目。
   * @param {*} raw 原始证据
   * @param {string} nowStamp 兜底时间戳
   * @returns {object} 证据条目
   */
  function normalizeEvidence(raw, nowStamp) {
    const item = raw && typeof raw === "object" ? raw : {};
    return {
      id: U.str(item.id) || U.uid("img"),
      kind: U.oneOf(item.kind, C.EVIDENCE_KIND, D.EVIDENCE_KIND),
      name: U.str(item.name),
      url: U.str(item.url),
      size: U.num(item.size, 0, 0),
      uploadedAt: U.str(item.uploadedAt) || nowStamp
    };
  }

  /**
   * 归一化执行时的资产快照（防资产改动导致历史失真）。
   * @param {*} raw 原始快照
   * @returns {object} 快照对象
   */
  function normalizeCaseSnapshot(raw) {
    const item = raw && typeof raw === "object" ? raw : {};
    return {
      title: U.str(item.title),
      business: U.str(item.business),
      product: U.str(item.product),
      module: U.str(item.module),
      type: U.oneOf(item.type, C.CASE_TYPE, D.CASE_TYPE),
      priority: U.oneOf(item.priority, C.PRIORITY, D.PRIORITY),
      version: U.num(item.version, 1, 1)
    };
  }

  /**
   * 归一化执行实例（系统设计 §3.3）。
   * 注意：id 会被用作证据目录名（POST /api/bug-images?bugId=），必须满足 ^[a-zA-Z0-9_-]{1,100}$，
   *       不合法时直接重新生成，避免服务端 assertSafePathPart 拒绝。
   * @param {*} raw 原始执行实例
   * @param {{now?:string}} [options] 可选默认值
   * @returns {object} 归一化后的 CaseExecution
   */
  function normalizeCaseExecution(raw, options) {
    const item = raw && typeof raw === "object" ? raw : {};
    const opts = options && typeof options === "object" ? options : {};
    const nowStamp = U.str(opts.now) || U.nowIso();

    const rawId = U.str(item.id);
    const id = U.isSafePathPart(rawId) ? rawId : U.uid(C.ID_PREFIX.EXECUTION);
    const createdAt = U.str(item.createdAt) || nowStamp;

    return {
      id,
      caseAssetId: U.str(item.caseAssetId),
      planId: U.str(item.planId),
      round: U.num(item.round, 1, 1),
      executor: U.str(item.executor),
      status: U.oneOf(item.status, C.EXEC_STATUS, D.EXEC_STATUS),
      startedAt: U.str(item.startedAt),
      finishedAt: U.str(item.finishedAt),
      resultNote: U.str(item.resultNote),
      linkedDefectId: U.str(item.linkedDefectId),
      evidence: U.toArray(item.evidence).map((entry) => normalizeEvidence(entry, nowStamp)),
      caseSnapshot: normalizeCaseSnapshot(item.caseSnapshot),
      createdAt,
      updatedAt: U.str(item.updatedAt) || createdAt
    };
  }

  /**
   * 计算执行实例业务唯一键 `(planId, round, caseAssetId)`。
   * @param {object} execution 执行实例
   * @returns {string} 唯一键
   */
  function executionKey(execution) {
    const item = execution && typeof execution === "object" ? execution : {};
    return `${U.str(item.planId)}::${U.num(item.round, 1, 1)}::${U.str(item.caseAssetId)}`;
  }

  /* ================================================================== *
   * 三之二、计划 ↔ 执行 派生计算（T03）
   *
   * 纯度约定：下列函数全部接受显式 `context`（plans / executions / assets），
   * 传入完整 context 时是**纯函数**（tests/tcm-model.test.js 即以此方式覆盖）。
   * 仅当浏览器宿主省略 context 时，才退化为从 TCM.store 读取当前集合，
   * 用于 `TCM.model.planProgress(planId, round)` 这种便捷调用形态。
   * ================================================================== */

  /**
   * 百分比（保留 1 位小数）。
   * @param {number} part 分子
   * @param {number} total 分母
   * @returns {number} 百分比数值，分母为 0 时返回 0
   */
  function percent(part, total) {
    const denominator = U.num(total, 0, 0);
    if (!denominator) {
      return 0;
    }
    return Math.round((U.num(part, 0, 0) / denominator) * 1000) / 10;
  }

  /**
   * 解析派生计算所需的上下文。
   * @param {{plans?:Array,executions?:Array,assets?:Array,operator?:string,now?:string,idFactory?:Function}} [context] 上下文
   * @returns {{plans:Array,executions:Array,assets:Array,operator:string,now:string,idFactory:(Function|null)}} 归一化上下文
   */
  function resolveContext(context) {
    const ctx = context && typeof context === "object" ? context : {};
    const store = TCM.store && typeof TCM.store.collection === "function" ? TCM.store : null;

    /**
     * 取集合：优先用显式传入，其次退化读 store。
     * @param {*} explicit 显式传入的数组
     * @param {string} name 集合名
     * @returns {Array<object>} 集合数组
     */
    function pick(explicit, name) {
      if (Array.isArray(explicit)) {
        return explicit;
      }
      return store ? store.collection(name) : [];
    }

    return {
      plans: pick(ctx.plans, "testPlans"),
      executions: pick(ctx.executions, "caseExecutions"),
      assets: pick(ctx.assets, "basicCaseLibrary"),
      operator: U.str(ctx.operator, D.OPERATOR),
      now: U.str(ctx.now) || U.nowIso(),
      idFactory: typeof ctx.idFactory === "function" ? ctx.idFactory : null
    };
  }

  /**
   * 按 id 取计划。
   * @param {Array<object>} plans 计划集合
   * @param {string} planId 计划 id
   * @returns {object|null} 计划对象
   */
  function findPlan(plans, planId) {
    const target = U.str(planId);
    if (!target) {
      return null;
    }
    return U.toArray(plans).find((plan) => plan && U.str(plan.id) === target) || null;
  }

  /**
   * 取某一轮实际参与执行的计划条目。
   *
   * 「多轮次增删」通过 `items[].excludedRounds` 表达：
   * 新建轮次时把不带入的条目的轮号写进 `excludedRounds`，
   * 从而在保留历史轮次数据的前提下实现「本轮移除」。
   *
   * @param {object} plan 计划对象
   * @param {number} round 轮次号
   * @returns {Array<object>} 本轮参与的条目（按 order 升序）
   */
  function planItemsForRound(plan, round) {
    const target = plan && typeof plan === "object" ? plan : {};
    const roundNo = U.num(round, U.num(target.currentRound, 1, 1), 1);
    return U.toArray(target.items)
      .filter((item) => {
        if (!item || !U.str(item.caseAssetId)) {
          return false;
        }
        return !U.toArray(item.excludedRounds).map((value) => U.num(value, 0, 0)).includes(roundNo);
      })
      .slice()
      .sort((a, b) => U.num(a.order, 0, 0) - U.num(b.order, 0, 0));
  }

  /**
   * 过滤出某计划某轮的执行实例。
   * @param {Array<object>} executions 执行实例集合
   * @param {string} planId 计划 id
   * @param {number} round 轮次号
   * @returns {Array<object>} 命中的执行实例
   */
  function executionsForRound(executions, planId, round) {
    const target = U.str(planId);
    const roundNo = U.num(round, 1, 1);
    return U.toArray(executions).filter((item) => {
      if (!item) {
        return false;
      }
      return U.str(item.planId) === target && U.num(item.round, 1, 1) === roundNo;
    });
  }

  /**
   * 由资产生成执行时快照。
   * @param {object|null} asset 用例资产
   * @returns {object} 快照
   */
  function snapshotOfAsset(asset) {
    const item = asset && typeof asset === "object" ? asset : {};
    return normalizeCaseSnapshot({
      title: item.title,
      business: item.business,
      product: item.product,
      module: item.module,
      type: item.type,
      priority: item.priority,
      version: item.version
    });
  }

  /**
   * 惰性补齐某计划某轮缺失的执行实例（业务唯一键 `(planId, round, caseAssetId)`）。
   *
   * - 已存在的执行实例**原样保留**（绝不重置结果）
   * - 缺失的组合补一条 `status:"未执行"` 记录，并写入 `caseSnapshot`
   * - 不做删除：条目被移出本轮后其历史执行记录仍保留，避免丢失结果
   *
   * @param {string} planId 计划 id
   * @param {number} round 轮次号
   * @param {{plans?:Array,executions?:Array,assets?:Array,now?:string,idFactory?:Function}} [context] 上下文
   * @returns {{executions:Array<object>, created:Array<object>, changed:boolean}} 补齐结果
   */
  function ensureExecutions(planId, round, context) {
    const ctx = resolveContext(context);
    const id = U.str(planId);
    const plan = findPlan(ctx.plans, id);
    const current = U.toArray(ctx.executions).slice();

    if (!plan) {
      return { executions: current, created: [], changed: false };
    }

    const roundNo = U.num(round, U.num(plan.currentRound, 1, 1), 1);
    const seen = new Set(
      executionsForRound(current, id, roundNo).map((item) => U.str(item.caseAssetId))
    );
    const assetMap = new Map(U.toArray(ctx.assets).map((asset) => [U.str(asset && asset.id), asset]));
    const created = [];

    planItemsForRound(plan, roundNo).forEach((item, index) => {
      const caseAssetId = U.str(item.caseAssetId);
      if (!caseAssetId || seen.has(caseAssetId)) {
        return;
      }
      seen.add(caseAssetId);
      const execId = ctx.idFactory
        ? U.str(ctx.idFactory(index, caseAssetId))
        : U.uid(C.ID_PREFIX.EXECUTION);
      created.push(normalizeCaseExecution({
        id: execId,
        caseAssetId,
        planId: id,
        round: roundNo,
        executor: U.str(item.executor),
        status: D.EXEC_STATUS,
        caseSnapshot: snapshotOfAsset(assetMap.get(caseAssetId)),
        createdAt: ctx.now,
        updatedAt: ctx.now
      }, { now: ctx.now }));
    });

    return {
      executions: created.length ? current.concat(created) : current,
      created,
      changed: created.length > 0
    };
  }

  /**
   * 聚合某计划某轮的执行进度（由 `caseExecutions` 派生，不落库）。
   *
   * - `total`：本轮应执行条目数（计划条目数与已有执行实例数取最大值，容忍数据漂移）
   * - `executed`：通过 + 失败 + 阻塞 + 跳过
   * - `executeRate`：executed / total；`passRate`：passed / executed
   *
   * @param {string} planId 计划 id
   * @param {number} round 轮次号
   * @param {{plans?:Array,executions?:Array}} [context] 上下文
   * @returns {object} 进度对象
   */
  function planProgress(planId, round, context) {
    const ctx = resolveContext(context);
    const id = U.str(planId);
    const plan = findPlan(ctx.plans, id);
    const roundNo = U.num(round, plan ? U.num(plan.currentRound, 1, 1) : 1, 1);
    const rows = executionsForRound(ctx.executions, id, roundNo);
    const byStatus = countBy(rows, "status", C.EXEC_STATUS);

    const plannedTotal = plan ? planItemsForRound(plan, roundNo).length : rows.length;
    const total = Math.max(plannedTotal, rows.length);

    const passed = byStatus["通过"] || 0;
    const failed = byStatus["失败"] || 0;
    const blocked = byStatus["阻塞"] || 0;
    const skipped = byStatus["跳过"] || 0;
    const executed = passed + failed + blocked + skipped;

    return {
      planId: id,
      round: roundNo,
      total,
      tracked: rows.length,
      planned: plannedTotal,
      byStatus,
      executed,
      notRun: Math.max(0, total - executed),
      passed,
      failed,
      blocked,
      skipped,
      defectCount: rows.filter((item) => U.str(item.linkedDefectId)).length,
      executeRate: percent(executed, total),
      passRate: percent(passed, executed),
      isFinished: total > 0 && executed >= total,
      isStarted: executed > 0
    };
  }

  /**
   * 计算新建轮次应带入的用例集合。
   * @param {object} plan 计划对象
   * @param {number} sourceRound 参照轮次（通常是上一轮）
   * @param {string} mode `all` 全量复制 / `failed` 仅失败与阻塞
   * @param {Array<object>} executions 执行实例集合
   * @returns {Array<string>} 应带入的 caseAssetId 列表
   */
  function planRoundCandidates(plan, sourceRound, mode, executions) {
    const items = planItemsForRound(plan, sourceRound).map((item) => U.str(item.caseAssetId));
    if (U.str(mode) !== "failed") {
      return items;
    }
    const planId = U.str(plan && plan.id);
    const bad = new Set(
      executionsForRound(executions, planId, sourceRound)
        .filter((item) => item.status === "失败" || item.status === "阻塞")
        .map((item) => U.str(item.caseAssetId))
    );
    return items.filter((caseAssetId) => bad.has(caseAssetId));
  }

  /**
   * 计算下一个轮次号。
   * @param {object} plan 计划对象
   * @returns {number} 下一轮次号（至少 2）
   */
  function nextRoundNumber(plan) {
    const rounds = U.toArray(plan && plan.rounds).map((item) => U.num(item && item.round, 1, 1));
    const max = rounds.length ? Math.max.apply(null, rounds) : 1;
    return max + 1;
  }

  /**
   * 由 `caseExecutions` 派生某条用例的执行历史（**只读派生，不落库**，见系统设计 §8.3）。
   * @param {string} caseAssetId 用例资产 id
   * @param {Array<object>} executions 执行实例集合
   * @param {Array<object>} [plans] 计划集合（用于补计划名）
   * @returns {Array<object>} 执行历史（按时间倒序）
   */
  function deriveExecutionHistory(caseAssetId, executions, plans) {
    const target = U.str(caseAssetId);
    if (!target) {
      return [];
    }
    return U.toArray(executions)
      .filter((item) => item && U.str(item.caseAssetId) === target && U.str(item.status) !== D.EXEC_STATUS)
      .map((item) => {
        const plan = findPlan(plans, item.planId);
        const stamp = U.str(item.finishedAt) || U.str(item.updatedAt) || U.str(item.createdAt);
        return {
          executionId: U.str(item.id),
          planId: U.str(item.planId),
          planName: plan ? U.str(plan.name, "未命名测试计划") : "",
          round: U.num(item.round, 1, 1),
          date: U.dateOr(stamp, ""),
          at: stamp,
          executor: U.str(item.executor, "—"),
          result: U.oneOf(item.status, C.EXEC_STATUS, D.EXEC_STATUS),
          note: U.str(item.resultNote),
          linkedDefectId: U.str(item.linkedDefectId),
          evidenceCount: U.toArray(item.evidence).length
        };
      })
      .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }

  /* ================================================================== *
   * 四、评审单 ReviewTicket
   * ================================================================== */

  /**
   * 归一化评审意见。
   * @param {*} raw 原始意见
   * @param {string} nowStamp 兜底时间戳
   * @returns {object} 评审意见
   */
  function normalizeReviewComment(raw, nowStamp) {
    const item = raw && typeof raw === "object" ? raw : {};
    return {
      id: U.str(item.id) || U.uid(C.ID_PREFIX.COMMENT),
      caseId: U.str(item.caseId),
      author: U.str(item.author, D.OPERATOR),
      action: U.oneOf(item.action, C.REVIEW_ACTION, D.REVIEW_ACTION),
      content: U.str(item.content),
      createdAt: U.str(item.createdAt) || nowStamp
    };
  }

  /**
   * 归一化评审单（系统设计 §3.4）。
   * @param {*} raw 原始评审单
   * @param {{operator?:string, now?:string}} [options] 可选默认值
   * @returns {object} 归一化后的 ReviewTicket
   */
  function normalizeReviewTicket(raw, options) {
    const item = raw && typeof raw === "object" ? raw : {};
    const opts = options && typeof options === "object" ? options : {};
    const operator = U.str(opts.operator, D.OPERATOR);
    const nowStamp = U.str(opts.now) || U.nowIso();

    return {
      id: U.str(item.id) || U.uid(C.ID_PREFIX.REVIEW),
      title: U.str(item.title, "未命名评审单"),
      caseIds: U.stringList(item.caseIds),
      reviewers: U.stringList(item.reviewers),
      dueAt: U.dateOr(item.dueAt, ""),
      status: U.oneOf(item.status, C.REVIEW_STATUS, D.REVIEW_STATUS),
      conclusion: U.oneOf(item.conclusion, C.REVIEW_CONCLUSION, D.REVIEW_CONCLUSION),
      comments: U.toArray(item.comments).map((entry) => normalizeReviewComment(entry, nowStamp)),
      createdBy: U.str(item.createdBy, operator),
      createdAt: U.str(item.createdAt) || nowStamp,
      finishedAt: U.str(item.finishedAt)
    };
  }

  /* ------------------------------------------------------------------ *
   * 四之二、评审结论回写（T04，系统设计 §3.4 映射表）
   * ------------------------------------------------------------------ */

  /**
   * 归一化评审判定集合，统一成 `Map<caseId, action>`。
   *
   * 支持两种入参形态：
   *   - 对象字典：`{ "bc-1": "通过", "bc-2": "打回" }`
   *   - 数组：`[{ caseId:"bc-1", action:"通过" }, ...]`（同一 caseId 后者覆盖前者）
   *
   * 只接受 `通过`/`打回`/`需修改` 三种判定，`评论` 只留痕不参与结论聚合。
   *
   * @param {object|Array<object>} verdicts 判定集合
   * @returns {Map<string,string>} caseId → 判定动作
   */
  function normalizeVerdicts(verdicts) {
    const map = new Map();
    const allowed = C.REVIEW_VERDICT_ACTIONS;

    if (Array.isArray(verdicts)) {
      verdicts.forEach((raw) => {
        const item = raw && typeof raw === "object" ? raw : {};
        const caseId = U.str(item.caseId);
        const action = U.str(item.action) || U.str(item.verdict);
        if (caseId && allowed.includes(action)) {
          map.set(caseId, action);
        }
      });
      return map;
    }

    if (verdicts && typeof verdicts === "object") {
      Object.keys(verdicts).forEach((key) => {
        const caseId = U.str(key);
        const action = U.str(verdicts[key]);
        if (caseId && allowed.includes(action)) {
          map.set(caseId, action);
        }
      });
    }
    return map;
  }

  /**
   * 聚合评审结论：存在打回 → 打回；否则存在需修改 → 需修改；全通过 → 通过。
   * @param {Array<string>} actions 已提交的判定动作列表
   * @returns {string} 聚合结论（空串表示未出结论）
   */
  function aggregateConclusion(actions) {
    const list = U.toArray(actions);
    if (list.includes("打回")) {
      return "打回";
    }
    if (list.includes("需修改")) {
      return "需修改";
    }
    if (list.length > 0 && list.every((action) => action === "通过")) {
      return "通过";
    }
    return D.REVIEW_CONCLUSION;
  }

  /**
   * 从评审单的 `comments[]` 反推每条用例的**最新**判定。
   *
   * comments 是追加写入的，天然按时间升序，因此后写的同 caseId 判定覆盖先写的。
   *
   * @param {object} ticket 评审单
   * @returns {Object<string,string>} caseId → 最新判定动作
   */
  function deriveReviewVerdicts(ticket) {
    const source = ticket && typeof ticket === "object" ? ticket : {};
    const allowed = C.REVIEW_VERDICT_ACTIONS;
    const out = {};
    U.toArray(source.comments).forEach((raw) => {
      const item = raw && typeof raw === "object" ? raw : {};
      const caseId = U.str(item.caseId);
      const action = U.str(item.action);
      if (caseId && allowed.includes(action)) {
        out[caseId] = action;
      }
    });
    return out;
  }

  /**
   * 评审单进度（已评 / 总数 / 逾期）。
   * @param {object} ticket 评审单
   * @param {{now?:string}} [options] 可选当前时间（便于单测）
   * @returns {{total:number, reviewed:number, pending:number, percent:number, overdue:boolean, verdicts:Object<string,string>}} 进度
   */
  function reviewProgress(ticket, options) {
    const source = ticket && typeof ticket === "object" ? ticket : {};
    const opts = options && typeof options === "object" ? options : {};
    const nowStamp = U.str(opts.now) || U.nowIso();

    const caseIds = U.stringList(source.caseIds);
    const verdicts = deriveReviewVerdicts(source);
    const reviewed = caseIds.filter((caseId) => Boolean(verdicts[caseId])).length;

    const dueAt = U.dateOr(source.dueAt, "");
    const status = U.oneOf(source.status, C.REVIEW_STATUS, D.REVIEW_STATUS);
    let overdue = false;
    if (dueAt && status !== "已完成" && status !== "已取消") {
      // dueAt 为日期，按当天 23:59:59.999 判定逾期
      const dueMs = Date.parse(`${dueAt}T23:59:59.999Z`);
      const nowMs = Date.parse(nowStamp);
      overdue = Number.isFinite(dueMs) && Number.isFinite(nowMs) && nowMs > dueMs;
    }

    return {
      total: caseIds.length,
      reviewed,
      pending: Math.max(caseIds.length - reviewed, 0),
      percent: percent(reviewed, caseIds.length),
      overdue,
      verdicts
    };
  }

  /**
   * 评审结论回写（**纯函数**，系统设计 §3.4 映射表）。
   *
   * | 评审结论 | 用例 status 变更 | 其他副作用 |
   * |---------|-----------------|-----------|
   * | `通过`   | `待评审` → `已确认` | `ticket.status='已完成'`、`finishedAt=now`、`asset.reviewId=ticket.id` |
   * | `打回`   | `待评审` → `草稿`   | 同上 |
   * | `需修改` | 保持 `待评审`       | `ticket.status='评审中'`，不写 finishedAt |
   *
   * 语义补充：
   *   - **逐条即时生效**：每条用例的判定一提交，就按映射产出该资产的 status 变更；
   *     不必等整单评审完（评审单结论才需要全部评审完）。
   *   - **状态机安全**：只有当资产当前 status 恰为映射的 `caseStatusFrom`（`待评审`）时才流转，
   *     避免把已确认 / 已废弃的用例误改回去（`changed:false` 标记未发生变更）。
   *   - 本函数**不写任何集合**，只产出变更集，由 tcm-review.js 调 store.commit() 落库。
   *
   * @param {object} ticket 评审单（读 id / caseIds / status）
   * @param {object|Array<object>} verdicts 判定集合，形态见 normalizeVerdicts
   * @param {{assets?:Array<object>, now?:string}} [options] 上下文；assets 用于读取当前 status
   * @returns {{ticketId:string, totalCount:number, reviewedCount:number, allReviewed:boolean,
   *            conclusion:string, ticketStatus:string, finishedAt:string, progress:number,
   *            assetChanges:Array<{caseId:string,action:string,from:string,to:string,changed:boolean,reviewId:string}>}} 变更集
   */
  function concludeReview(ticket, verdicts, options) {
    const source = ticket && typeof ticket === "object" ? ticket : {};
    const opts = options && typeof options === "object" ? options : {};
    const nowStamp = U.str(opts.now) || U.nowIso();

    const ticketId = U.str(source.id);
    const caseIds = U.stringList(source.caseIds);
    const verdictMap = normalizeVerdicts(verdicts);

    const assetById = new Map();
    U.toArray(opts.assets).forEach((asset) => {
      const id = U.str(asset && asset.id);
      if (id) {
        assetById.set(id, asset);
      }
    });

    const submitted = [];
    const assetChanges = [];

    caseIds.forEach((caseId) => {
      const action = U.str(verdictMap.get(caseId));
      if (!action) {
        return;
      }
      submitted.push(action);

      const effect = C.REVIEW_CONCLUSION_EFFECT[action];
      if (!effect) {
        return;
      }
      const asset = assetById.get(caseId) || null;
      const from = asset
        ? U.oneOf(asset.status, C.CASE_STATUS, D.CASE_STATUS)
        : effect.caseStatusFrom;
      // 仅在「待评审」态才按映射流转，其他态保持不动（状态机护栏）
      const to = from === effect.caseStatusFrom ? effect.caseStatusTo : from;
      // 「需修改」不结单，也不写 reviewId；通过 / 打回 写 reviewId 建立资产 ↔ 评审单反查
      const writeReviewId = action !== "需修改" && Boolean(ticketId);
      assetChanges.push({
        caseId,
        action,
        from,
        to,
        changed: to !== from,
        reviewId: writeReviewId ? ticketId : U.str(asset && asset.reviewId)
      });
    });

    const totalCount = caseIds.length;
    const reviewedCount = submitted.length;
    const allReviewed = totalCount > 0 && reviewedCount === totalCount;
    const conclusion = allReviewed ? aggregateConclusion(submitted) : D.REVIEW_CONCLUSION;
    const effect = conclusion ? C.REVIEW_CONCLUSION_EFFECT[conclusion] : null;

    let ticketStatus;
    if (effect) {
      ticketStatus = effect.ticketStatus;
    } else if (reviewedCount > 0) {
      ticketStatus = "评审中";
    } else {
      ticketStatus = U.oneOf(source.status, C.REVIEW_STATUS, D.REVIEW_STATUS);
    }

    return {
      ticketId,
      totalCount,
      reviewedCount,
      allReviewed,
      conclusion,
      ticketStatus,
      finishedAt: effect && effect.writeFinishedAt ? nowStamp : "",
      progress: percent(reviewedCount, totalCount),
      assetChanges
    };
  }

  /* ================================================================== *
   * 五、目录节点 CaseDirectory
   * ================================================================== */

  /**
   * 生成稳定可推导的目录节点 id：`dir-<level>-<路径拼接>`。
   * @param {string} level 层级（product|module|category）
   * @param {string} business 业务线
   * @param {string} product 产品
   * @param {string} moduleName 模块
   * @param {string} name 节点显示名
   * @returns {string} 目录 id
   */
  function directoryId(level, business, product, moduleName, name) {
    const parts = ["dir", level, business];
    if (level === "module" || level === "category") {
      parts.push(product);
    }
    if (level === "category") {
      parts.push(moduleName);
    }
    parts.push(name);
    return parts.join("-");
  }

  /**
   * 归一化目录节点（系统设计 §3.5）。business 层不入库，非法层级回退为 product。
   * @param {*} raw 原始目录节点
   * @param {{now?:string}} [options] 可选默认值
   * @returns {object} 归一化后的 CaseDirectory
   */
  function normalizeCaseDirectory(raw, options) {
    const item = raw && typeof raw === "object" ? raw : {};
    const opts = options && typeof options === "object" ? options : {};
    const nowStamp = U.str(opts.now) || U.nowIso();

    let level = U.oneOf(item.level, C.DIR_LEVEL, D.DIR_LEVEL);
    if (level === "business") {
      // business 层由 BUSINESS 枚举固定派生，不入库
      level = D.DIR_LEVEL;
    }
    const businessOptions = TCM.catalog && typeof TCM.catalog.get === "function" ? TCM.catalog.get().businesses : C.BUSINESS;
    const business = U.oneOf(item.business, businessOptions, D.BUSINESS);
    const product = U.str(item.product);
    const moduleName = U.str(item.module);
    let name = U.str(item.name);
    if (!name) {
      if (level === "product") {
        name = product;
      } else if (level === "module") {
        name = moduleName;
      }
    }

    return {
      id: U.str(item.id) || directoryId(level, business, product, moduleName, name),
      level,
      business,
      product: level === "product" ? (product || name) : product,
      module: level === "module" ? (moduleName || name) : moduleName,
      name,
      order: U.num(item.order, 0, 0),
      createdAt: U.str(item.createdAt) || nowStamp
    };
  }

  /* ================================================================== *
   * 六、版本历史 CaseVersion
   * ================================================================== */

  /**
   * 归一化版本快照（系统设计 §3.6）。snapshot 去掉 executionHistory 以控体积。
   * @param {*} raw 原始版本记录
   * @param {{operator?:string, now?:string}} [options] 可选默认值
   * @returns {object} 归一化后的 CaseVersion
   */
  function normalizeCaseVersion(raw, options) {
    const item = raw && typeof raw === "object" ? raw : {};
    const opts = options && typeof options === "object" ? options : {};
    const operator = U.str(opts.operator, D.OPERATOR);
    const nowStamp = U.str(opts.now) || U.nowIso();

    const snapshot = item.snapshot && typeof item.snapshot === "object"
      ? Object.assign({}, item.snapshot)
      : {};
    delete snapshot.executionHistory;

    return {
      id: U.str(item.id) || U.uid(C.ID_PREFIX.CASE_VERSION),
      caseAssetId: U.str(item.caseAssetId),
      version: U.num(item.version, 1, 1),
      snapshot,
      changedBy: U.str(item.changedBy, operator),
      changedAt: U.str(item.changedAt) || nowStamp,
      changeNote: U.str(item.changeNote)
    };
  }

  /* ================================================================== *
   * 七、集合级归一化（去重 / 唯一键 / 容量护栏）
   * ================================================================== */

  /**
   * 按 id 去重（后出现的覆盖先出现的，保持最后一次出现的位置顺序）。
   * @param {Array<object>} list 已归一化的实体数组
   * @returns {Array<object>} 去重后的数组
   */
  function dedupeById(list) {
    const map = new Map();
    list.forEach((entry) => {
      map.set(entry.id, entry);
    });
    return Array.from(map.values());
  }

  /**
   * 归一化用例资产集合。
   * @param {*} list 原始数组
   * @param {object} [options] 归一化选项
   * @returns {Array<object>} 归一化并按 id 去重的资产数组
   */
  function normalizeCaseAssetList(list, options) {
    return dedupeById(U.toArray(list).map((item) => normalizeCaseAsset(item, options)));
  }

  /**
   * 归一化测试计划集合。
   * @param {*} list 原始数组
   * @param {object} [options] 归一化选项
   * @returns {Array<object>} 归一化并按 id 去重的计划数组
   */
  function normalizeTestPlanList(list, options) {
    return dedupeById(U.toArray(list).map((item) => normalizeTestPlan(item, options)));
  }

  /**
   * 归一化执行实例集合。
   * 业务唯一键 `(planId, round, caseAssetId)` 去重：保留 updatedAt 更新的一条，
   * 时间相同则保留数组中靠后的一条（后写入者胜出）。
   * @param {*} list 原始数组
   * @param {object} [options] 归一化选项
   * @returns {Array<object>} 去重后的执行实例数组
   */
  function normalizeCaseExecutionList(list, options) {
    const map = new Map();
    U.toArray(list).forEach((raw) => {
      const entry = normalizeCaseExecution(raw, options);
      if (!entry.caseAssetId || !entry.planId) {
        return;
      }
      const key = executionKey(entry);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, entry);
        return;
      }
      if (String(entry.updatedAt) >= String(existing.updatedAt)) {
        map.set(key, entry);
      }
    });
    return Array.from(map.values());
  }

  /**
   * 归一化评审单集合。
   * @param {*} list 原始数组
   * @param {object} [options] 归一化选项
   * @returns {Array<object>} 归一化并按 id 去重的评审单数组
   */
  function normalizeReviewTicketList(list, options) {
    return dedupeById(U.toArray(list).map((item) => normalizeReviewTicket(item, options)));
  }

  /**
   * 归一化目录节点集合。
   * @param {*} list 原始数组
   * @param {object} [options] 归一化选项
   * @returns {Array<object>} 归一化并按 id 去重的目录数组
   */
  function normalizeCaseDirectoryList(list, options) {
    return dedupeById(U.toArray(list).map((item) => normalizeCaseDirectory(item, options)));
  }

  /**
   * 归一化版本历史集合，并施加容量护栏：
   * 每条用例最多保留 MAX_VERSIONS_PER_CASE 个版本（超出丢弃最旧的非基线版本）。
   * @param {*} list 原始数组
   * @param {object} [options] 归一化选项
   * @returns {Array<object>} 归一化后的版本数组
   */
  function normalizeCaseVersionList(list, options) {
    const normalized = dedupeById(U.toArray(list).map((item) => normalizeCaseVersion(item, options)));
    const grouped = new Map();
    normalized.forEach((entry) => {
      if (!grouped.has(entry.caseAssetId)) {
        grouped.set(entry.caseAssetId, []);
      }
      grouped.get(entry.caseAssetId).push(entry);
    });

    const keep = new Set();
    grouped.forEach((entries) => {
      const sorted = entries.slice().sort((a, b) => a.version - b.version);
      const overflow = Math.max(0, sorted.length - C.MAX_VERSIONS_PER_CASE);
      let dropped = 0;
      sorted.forEach((entry) => {
        const isBaseline = Boolean(entry.snapshot && entry.snapshot.isBaseline);
        if (dropped < overflow && !isBaseline) {
          dropped += 1;
          return;
        }
        keep.add(entry.id);
      });
    });

    return normalized.filter((entry) => keep.has(entry.id));
  }

  /* ================================================================== *
   * 八、目录树派生
   * ================================================================== */

  /**
   * 创建一个空的目录树节点。
   * @param {string} id 节点 id
   * @param {string} level 层级
   * @param {string} name 显示名
   * @param {{business:string,product:string,module:string}} path 路径信息
   * @param {boolean} explicit 是否来自显式 caseDirectories 节点
   * @param {number} order 同级排序值
   * @returns {object} 树节点
   */
  function createTreeNode(id, level, name, path, explicit, order) {
    return {
      id,
      level,
      name,
      business: path.business,
      product: path.product,
      module: path.module,
      count: 0,
      explicit: Boolean(explicit),
      order,
      children: []
    };
  }

  /**
   * 在父节点的 children 中查找或创建子节点。
   * @param {object} parent 父节点
   * @param {Map<string,object>} index 全局节点索引
   * @param {string} id 子节点 id
   * @param {string} level 子节点层级
   * @param {string} name 子节点显示名
   * @param {object} path 路径信息
   * @returns {object} 子节点
   */
  function ensureChild(parent, index, id, level, name, path) {
    let node = index.get(id);
    if (!node) {
      node = createTreeNode(id, level, name, path, false, 0);
      index.set(id, node);
      parent.children.push(node);
    }
    return node;
  }

  /**
   * 递归排序：显式 order 升序 → 名称本地化升序。
   * @param {Array<object>} nodes 节点数组
   * @returns {void}
   */
  function sortTree(nodes) {
    nodes.sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      return String(a.name).localeCompare(String(b.name), "zh-Hans-CN");
    });
    nodes.forEach((node) => sortTree(node.children));
  }

  /**
   * 由资产字段派生 4 级目录树（业务线→产品→模块→场景），并叠加显式空目录节点。
   *
   * 设计要点（Q1）：product / module / category 为空时该层自动坍缩，不生成「未分类」占位层。
   * 空目录保留：caseDirectories 中的显式节点即使没有任何资产也会出现在树上（count = 0）。
   *
   * @param {Array<object>} assets 已归一化的用例资产数组
   * @param {Array<object>} dirs 已归一化的显式目录节点数组
   * @param {{includeAllBusinesses?:boolean}} [options] 选项；includeAllBusinesses 默认 true
   * @returns {Array<object>} 业务线层级的树节点数组
   */
  function buildDirectoryTree(assets, dirs, options) {
    const opts = options && typeof options === "object" ? options : {};
    const includeAllBusinesses = opts.includeAllBusinesses !== false;
    const assetList = U.toArray(assets);
    const dirList = U.toArray(dirs);

    const roots = [];
    const index = new Map();

    /**
     * 查找或创建业务线根节点。
     * @param {string} business 业务线名称
     * @returns {object} 业务线节点
     */
    function ensureBusiness(business) {
      const id = `dir-business-${business}`;
      let node = index.get(id);
      if (!node) {
        node = createTreeNode(id, "business", business, { business, product: "", module: "" }, true, 0);
        index.set(id, node);
        roots.push(node);
      }
      return node;
    }

    if (includeAllBusinesses) {
      C.BUSINESS.forEach((business) => ensureBusiness(business));
    }

    // ① 先建显式节点（保证空目录能被保留）
    dirList.forEach((dir) => {
      const businessNode = ensureBusiness(dir.business);
      if (dir.level === "product") {
        const id = directoryId("product", dir.business, dir.name, "", dir.name);
        const node = ensureChild(businessNode, index, id, "product", dir.name, {
          business: dir.business,
          product: dir.name,
          module: ""
        });
        node.explicit = true;
        node.order = dir.order;
        return;
      }
      if (dir.level === "module") {
        const productId = directoryId("product", dir.business, dir.product, "", dir.product);
        const productNode = dir.product
          ? ensureChild(businessNode, index, productId, "product", dir.product, {
              business: dir.business,
              product: dir.product,
              module: ""
            })
          : businessNode;
        const id = directoryId("module", dir.business, dir.product, dir.name, dir.name);
        const node = ensureChild(productNode, index, id, "module", dir.name, {
          business: dir.business,
          product: dir.product,
          module: dir.name
        });
        node.explicit = true;
        node.order = dir.order;
        return;
      }
      // level === "category"
      const productId = directoryId("product", dir.business, dir.product, "", dir.product);
      const productNode = dir.product
        ? ensureChild(businessNode, index, productId, "product", dir.product, {
            business: dir.business,
            product: dir.product,
            module: ""
          })
        : businessNode;
      const moduleId = directoryId("module", dir.business, dir.product, dir.module, dir.module);
      const moduleNode = dir.module
        ? ensureChild(productNode, index, moduleId, "module", dir.module, {
            business: dir.business,
            product: dir.product,
            module: dir.module
          })
        : productNode;
      const id = directoryId("category", dir.business, dir.product, dir.module, dir.name);
      const node = ensureChild(moduleNode, index, id, "category", dir.name, {
        business: dir.business,
        product: dir.product,
        module: dir.module
      });
      node.explicit = true;
      node.order = dir.order;
    });

    // ② 再由资产聚合派生，逐级累加计数
    assetList.forEach((asset) => {
      const business = U.oneOf(asset.business, C.BUSINESS, D.BUSINESS);
      const product = U.str(asset.product);
      const moduleName = U.str(asset.module);
      const category = U.str(asset.category);

      const businessNode = ensureBusiness(business);
      businessNode.count += 1;

      let cursor = businessNode;
      if (product) {
        const id = directoryId("product", business, product, "", product);
        cursor = ensureChild(cursor, index, id, "product", product, { business, product, module: "" });
        cursor.count += 1;
      }
      if (moduleName) {
        const id = directoryId("module", business, product, moduleName, moduleName);
        cursor = ensureChild(cursor, index, id, "module", moduleName, { business, product, module: moduleName });
        cursor.count += 1;
      }
      if (category && category !== moduleName) {
        const id = directoryId("category", business, product, moduleName, category);
        cursor = ensureChild(cursor, index, id, "category", category, { business, product, module: moduleName });
        cursor.count += 1;
      }
    });

    sortTree(roots);
    return roots;
  }

  /* ================================================================== *
   * 九、筛选 / 度量 / 导入校验
   * ================================================================== */

  /**
   * 判断一条资产是否命中关键词（标题/目标/前置/数据/步骤/预期/标签/组件/产品/模块/场景）。
   * @param {object} asset 资产
   * @param {string} keyword 已小写化的关键词
   * @returns {boolean} 是否命中
   */
  function matchKeyword(asset, keyword) {
    if (!keyword) {
      return true;
    }
    const haystack = [
      asset.title,
      asset.objective,
      asset.preconditions,
      asset.testData,
      asset.steps,
      asset.expected,
      asset.component,
      asset.product,
      asset.module,
      asset.category,
      U.toArray(asset.tags).join(" ")
    ].join("\n").toLowerCase();
    return haystack.includes(keyword);
  }

  /**
   * 按多维条件筛选用例资产（系统设计 §T02 ⑥）。
   * @param {Array<object>} list 资产数组
   * @param {object} [filters] 筛选条件
   *   {keyword,business,product,module,category,type,priority,status,component,tag,automation}
   *   automation 取值：""（不限）| "yes" | "no"
   * @returns {Array<object>} 命中的资产数组
   */
  function applyFilters(list, filters) {
    const source = U.toArray(list);
    const f = filters && typeof filters === "object" ? filters : {};
    const keyword = String(f.keyword || "").trim().toLowerCase();
    const automation = String(f.automation || "");

    return source.filter((asset) => {
      if (!asset || typeof asset !== "object") {
        return false;
      }
      if (f.business && asset.business !== f.business) {
        return false;
      }
      if (f.product && U.str(asset.product) !== f.product) {
        return false;
      }
      if (f.module && U.str(asset.module) !== f.module) {
        return false;
      }
      if (f.category && U.str(asset.category) !== f.category) {
        return false;
      }
      if (f.type && asset.type !== f.type) {
        return false;
      }
      if (f.priority && asset.priority !== f.priority) {
        return false;
      }
      if (f.status && asset.status !== f.status) {
        return false;
      }
      if (f.component && U.str(asset.component) !== f.component) {
        return false;
      }
      if (f.tag && !U.toArray(asset.tags).includes(f.tag)) {
        return false;
      }
      if (automation === "yes" && !asset.automationEnabled) {
        return false;
      }
      if (automation === "no" && asset.automationEnabled) {
        return false;
      }
      return matchKeyword(asset, keyword);
    });
  }

  /**
   * 按指定字段做计数分组。
   * @param {Array<object>} list 数组
   * @param {string} field 字段名
   * @param {Array<string>} buckets 预置分桶（保证 0 值也出现）
   * @returns {Object<string,number>} 分组计数
   */
  function countBy(list, field, buckets) {
    const result = {};
    U.toArray(buckets).forEach((bucket) => {
      result[bucket] = 0;
    });
    U.toArray(list).forEach((item) => {
      const key = U.str(item && item[field], "未分类");
      result[key] = (result[key] || 0) + 1;
    });
    return result;
  }

  /* ------------------------------------------------------------------ *
   * 六之二、需求归集与数据窗口（T04）
   * ------------------------------------------------------------------ */

  /**
   * 把 app.js 的 `state.batches`（版本）+ `state.tasks`（任务）归集为统一的「需求」列表。
   *
   * 这是需求覆盖率的**分母来源**（PRD §6.7：`batches + tasks 总需求数`）。
   *
   * @param {Array<object>} batches state.batches
   * @param {Array<object>} tasks state.tasks
   * @returns {Array<{type:string,id:string,name:string,batchId:string,moduleName:string,status:string}>} 需求列表
   */
  function collectRequirements(batches, tasks) {
    const out = [];
    const seen = new Set();

    U.toArray(batches).forEach((raw) => {
      const item = raw && typeof raw === "object" ? raw : {};
      const id = U.str(item.id);
      if (!id || seen.has(id)) {
        return;
      }
      seen.add(id);
      const version = U.str(item.version);
      const name = U.str(item.name);
      const label = [name, version].filter(Boolean).join(" ") || id;
      out.push({
        type: "batch",
        id,
        name: label,
        batchId: id,
        moduleName: U.str(item.moduleName),
        status: U.str(item.status, "进行中")
      });
    });

    U.toArray(tasks).forEach((raw) => {
      const item = raw && typeof raw === "object" ? raw : {};
      const id = U.str(item.id);
      if (!id || seen.has(id)) {
        return;
      }
      seen.add(id);
      out.push({
        type: "task",
        id,
        name: U.str(item.name, id),
        batchId: U.str(item.batchId),
        moduleName: U.str(item.moduleName),
        status: U.str(item.status, "进行中")
      });
    });

    return out;
  }

  /**
   * 取一条记录的代表性时间戳（用于滚动窗口过滤）。
   * @param {object} item 记录
   * @param {Array<string>} fields 候选字段（按优先级）
   * @returns {string} 第一个非空的时间字符串
   */
  function stampOf(item, fields) {
    const source = item && typeof item === "object" ? item : {};
    const list = U.toArray(fields);
    for (let index = 0; index < list.length; index += 1) {
      const value = U.str(source[list[index]]);
      if (value) {
        return value;
      }
    }
    return "";
  }

  /**
   * 滚动窗口判定：时间戳缺失时视为「无法判定 → 保留」，避免看板被清空。
   * @param {string} stamp 时间戳
   * @param {number} nowMs 当前时间毫秒
   * @param {number} days 窗口天数
   * @returns {boolean} 是否落在窗口内
   */
  function withinRollingWindow(stamp, nowMs, days) {
    const text = U.str(stamp);
    if (!text) {
      return true;
    }
    const parsed = Date.parse(text.length === 10 ? `${text}T00:00:00.000Z` : text);
    if (!Number.isFinite(parsed)) {
      return true;
    }
    return nowMs - parsed <= U.num(days, C.ROLLING_WINDOW_DAYS, 1) * 86400000;
  }

  /**
   * 按数据窗口切分统计口径（Q5：本迭代 / 滚动 30 天 / 全部）。
   *
   * 窗口定义：
   *   - `all`：不过滤。
   *   - `rolling30`：按各实体的代表时间戳过滤最近 30 天（时间戳缺失视为保留）。
   *   - `batch`：以 `activeBatchId` 指向的版本为「本迭代」，
   *     需求 = 该版本 + 其下任务；计划 = `batchId` 命中该版本；执行 = 属于这些计划；
   *     用例 = 关联该版本 / 引用这些需求 / 出现在这些计划的 items 中；
   *     评审单 = 与上述用例有交集；缺陷 = 属于该版本 / 命中这些用例或执行。
   *     若 `activeBatchId` 为空或版本不存在，**降级为 all** 并置 `windowFallback:true`。
   *
   * @param {object} input 原始数据（assets/plans/executions/reviews/bugs/batches/tasks/activeBatchId/window/now）
   * @returns {object} 切分后的作用域
   */
  function scopeByWindow(input) {
    const source = input && typeof input === "object" ? input : {};
    const windowKey = U.oneOf(U.str(source.window, "batch"), C.METRIC_WINDOW_KEYS, "batch");
    const nowStamp = U.str(source.now) || U.nowIso();
    const parsedNow = Date.parse(nowStamp);
    const nowMs = Number.isFinite(parsedNow) ? parsedNow : Date.now();

    const assets = U.toArray(source.assets);
    const plans = U.toArray(source.plans);
    const executions = U.toArray(source.executions);
    const reviews = U.toArray(source.reviews);
    const bugs = U.toArray(source.bugs);
    const batches = U.toArray(source.batches);
    const tasks = U.toArray(source.tasks);
    const activeBatchId = U.str(source.activeBatchId);

    const labelOf = (key) => {
      const found = C.METRIC_WINDOW.find((item) => item.key === key);
      return found ? found.label : "全部";
    };

    /**
     * 组装返回值。
     * @param {object} parts 各集合
     * @param {string} effective 实际生效的窗口
     * @param {boolean} fallback 是否发生降级
     * @param {string} scopeName 作用域显示名
     * @returns {object} 作用域对象
     */
    function build(parts, effective, fallback, scopeName) {
      return {
        assets: parts.assets,
        plans: parts.plans,
        executions: parts.executions,
        reviews: parts.reviews,
        bugs: parts.bugs,
        requirements: parts.requirements,
        windowKey,
        effectiveWindow: effective,
        windowLabel: labelOf(effective),
        windowFallback: fallback,
        scopeName: U.str(scopeName)
      };
    }

    const allParts = {
      assets,
      plans,
      executions,
      reviews,
      bugs,
      requirements: collectRequirements(batches, tasks)
    };

    if (windowKey === "all") {
      return build(allParts, "all", false, "全部数据");
    }

    if (windowKey === "rolling30") {
      const days = C.ROLLING_WINDOW_DAYS;
      const scopedAssets = assets.filter((item) =>
        withinRollingWindow(stampOf(item, ["updatedAt", "createdAt"]), nowMs, days));
      const scopedPlans = plans.filter((item) =>
        withinRollingWindow(stampOf(item, ["updatedAt", "createdAt"]), nowMs, days));
      const scopedExecutions = executions.filter((item) =>
        withinRollingWindow(stampOf(item, ["finishedAt", "updatedAt", "createdAt"]), nowMs, days));
      const scopedReviews = reviews.filter((item) =>
        withinRollingWindow(stampOf(item, ["finishedAt", "createdAt"]), nowMs, days));
      const scopedBugs = bugs.filter((item) =>
        withinRollingWindow(stampOf(item, ["updatedAt", "createdAt"]), nowMs, days));
      const scopedRequirements = collectRequirements(
        batches.filter((item) => withinRollingWindow(stampOf(item, ["updatedAt", "createdAt"]), nowMs, days)),
        tasks.filter((item) => withinRollingWindow(stampOf(item, ["updatedAt", "createdAt"]), nowMs, days))
      );
      return build({
        assets: scopedAssets,
        plans: scopedPlans,
        executions: scopedExecutions,
        reviews: scopedReviews,
        bugs: scopedBugs,
        requirements: scopedRequirements
      }, "rolling30", false, `最近 ${days} 天`);
    }

    // —— batch（本迭代）——
    const batch = batches.find((item) => item && U.str(item.id) === activeBatchId) || null;
    if (!batch) {
      return build(allParts, "all", true, "未选择迭代版本，已降级为全部数据");
    }

    const iterationTasks = tasks.filter((item) => item && U.str(item.batchId) === activeBatchId);
    const requirements = collectRequirements([batch], iterationTasks);
    const requirementIds = new Set(requirements.map((item) => item.id));

    const scopedPlans = plans.filter((item) => item && U.str(item.batchId) === activeBatchId);
    const planIds = new Set(scopedPlans.map((item) => U.str(item.id)).filter(Boolean));
    const planCaseIds = new Set();
    scopedPlans.forEach((plan) => {
      U.toArray(plan && plan.items).forEach((entry) => {
        const caseId = U.str(entry && entry.caseAssetId);
        if (caseId) {
          planCaseIds.add(caseId);
        }
      });
    });

    const scopedAssets = assets.filter((asset) => {
      if (!asset) {
        return false;
      }
      const id = U.str(asset.id);
      if (planCaseIds.has(id)) {
        return true;
      }
      if (U.toArray(asset.linkedBatchIds).map((value) => U.str(value)).includes(activeBatchId)) {
        return true;
      }
      return U.toArray(asset.linkedRequirements).some((ref) => requirementIds.has(U.str(ref && ref.id)));
    });
    const scopedAssetIds = new Set(scopedAssets.map((item) => U.str(item.id)).filter(Boolean));

    const scopedExecutions = executions.filter((item) => item && planIds.has(U.str(item.planId)));
    const executionIds = new Set(scopedExecutions.map((item) => U.str(item.id)).filter(Boolean));

    const scopedReviews = reviews.filter((ticket) =>
      U.stringList(ticket && ticket.caseIds).some((caseId) => scopedAssetIds.has(caseId)));

    const scopedBugs = bugs.filter((bug) => {
      if (!bug) {
        return false;
      }
      if (U.str(bug.batchId) === activeBatchId) {
        return true;
      }
      if (scopedAssetIds.has(U.str(bug.caseAssetId))) {
        return true;
      }
      return executionIds.has(U.str(bug.executionId));
    });

    const scopeName = U.str(requirements[0] && requirements[0].name, "本迭代");
    return build({
      assets: scopedAssets,
      plans: scopedPlans,
      executions: scopedExecutions,
      reviews: scopedReviews,
      bugs: scopedBugs,
      requirements
    }, "batch", false, scopeName);
  }

  /**
   * 需求覆盖率明细：谁被覆盖了、谁还没有用例。
   *
   * 口径（PRD §6.7）：`被 linkedRequirements 引用到的需求 id 数 / (batches + tasks 总需求数)`。
   * 只统计**真实存在**的需求（引用了已删除需求的脏数据不计入分子）。
   *
   * @param {Array<object>} assets 用例资产
   * @param {Array<object>} requirements 需求列表（collectRequirements 产物）
   * @returns {{total:number, covered:number, rate:number, coveredList:Array<object>,
   *            uncovered:Array<object>, casesByRequirement:Object<string,Array<string>>}} 覆盖明细
   */
  function computeRequirementCoverage(assets, requirements) {
    const reqList = U.toArray(requirements);
    const known = new Set(reqList.map((item) => U.str(item && item.id)).filter(Boolean));
    const casesByRequirement = {};

    U.toArray(assets).forEach((asset) => {
      const caseId = U.str(asset && asset.id);
      U.toArray(asset && asset.linkedRequirements).forEach((ref) => {
        const reqId = U.str(ref && ref.id);
        if (!reqId || !known.has(reqId)) {
          return;
        }
        if (!casesByRequirement[reqId]) {
          casesByRequirement[reqId] = [];
        }
        if (caseId && !casesByRequirement[reqId].includes(caseId)) {
          casesByRequirement[reqId].push(caseId);
        }
      });
    });

    const coveredList = [];
    const uncovered = [];
    reqList.forEach((item) => {
      const reqId = U.str(item && item.id);
      const hit = U.toArray(casesByRequirement[reqId]).length > 0;
      const entry = Object.assign({}, item, { caseCount: U.toArray(casesByRequirement[reqId]).length });
      if (hit) {
        coveredList.push(entry);
      } else {
        uncovered.push(entry);
      }
    });

    return {
      total: reqList.length,
      covered: coveredList.length,
      rate: percent(coveredList.length, reqList.length),
      coveredList,
      uncovered,
      casesByRequirement
    };
  }

  /**
   * 计划执行槽位总数：`Σ 每个计划 × 每一轮实际参与的 items 数`。
   *
   * 这是「计划执行率」的分母（PRD §6.7：`plan.items 数 × 轮次`），
   * 用 planItemsForRound 精确扣除 `excludedRounds`，避免把「本轮已移除」的条目算进来。
   *
   * @param {Array<object>} plans 计划集合
   * @param {{planId?:string, round?:(number|null)}} [filters] 与 computeMetrics 一致的作用域过滤
   * @returns {number} 槽位总数
   */
  function plannedSlotCount(plans, filters) {
    const opts = filters && typeof filters === "object" ? filters : {};
    const planId = U.str(opts.planId);
    const round = opts.round === undefined || opts.round === null ? null : U.num(opts.round, 1, 1);

    let total = 0;
    U.toArray(plans).forEach((plan) => {
      if (!plan) {
        return;
      }
      if (planId && U.str(plan.id) !== planId) {
        return;
      }
      U.toArray(plan.rounds).forEach((entry) => {
        const roundNo = U.num(entry && entry.round, 1, 1);
        if (round !== null && roundNo !== round) {
          return;
        }
        total += planItemsForRound(plan, roundNo).length;
      });
    });
    return total;
  }

  /**
   * 下钻分组聚合：按资产的某个维度（业务线 / 类型 / 优先级）汇总用例数与执行结果。
   *
   * 执行实例优先按 `caseAssetId` 回查资产取维度值；
   * 资产已删除时退化用执行时的 `caseSnapshot`，保证历史数据不丢分组。
   *
   * @param {Array<object>} assets 资产集合
   * @param {Array<object>} executions 执行集合（已按作用域过滤）
   * @param {string} field 维度字段（business / type / priority）
   * @param {Array<string>} buckets 预置分桶（保证 0 值也出现）
   * @param {Map<string,object>} assetById 资产索引
   * @returns {Array<object>} 分组结果（按用例数降序，同数按分桶顺序）
   */
  function drillGroups(assets, executions, field, buckets, assetById) {
    const rows = new Map();
    const order = new Map();

    /**
     * 取或建一个分组行。
     * @param {string} key 分组键
     * @returns {object} 分组行
     */
    function ensure(key) {
      const name = U.str(key, "未分类");
      if (!rows.has(name)) {
        rows.set(name, {
          key: name,
          caseCount: 0,
          automation: 0,
          execTotal: 0,
          executed: 0,
          notRun: 0,
          passed: 0,
          failed: 0,
          blocked: 0,
          skipped: 0,
          defects: 0
        });
        order.set(name, order.size);
      }
      return rows.get(name);
    }

    U.toArray(buckets).forEach((bucket) => ensure(bucket));

    U.toArray(assets).forEach((asset) => {
      const row = ensure(U.str(asset && asset[field], "未分类"));
      row.caseCount += 1;
      if (asset && asset.automationEnabled) {
        row.automation += 1;
      }
    });

    U.toArray(executions).forEach((execution) => {
      const asset = assetById.get(U.str(execution && execution.caseAssetId)) || null;
      const snapshot = execution && execution.caseSnapshot && typeof execution.caseSnapshot === "object"
        ? execution.caseSnapshot
        : {};
      const key = U.str(asset ? asset[field] : snapshot[field], "未分类");
      const row = ensure(key);
      row.execTotal += 1;
      const status = U.oneOf(execution && execution.status, C.EXEC_STATUS, D.EXEC_STATUS);
      if (status === "未执行") {
        row.notRun += 1;
      } else {
        row.executed += 1;
        if (status === "通过") {
          row.passed += 1;
        } else if (status === "失败") {
          row.failed += 1;
        } else if (status === "阻塞") {
          row.blocked += 1;
        } else {
          row.skipped += 1;
        }
      }
      if (U.str(execution && execution.linkedDefectId)) {
        row.defects += 1;
      }
    });

    return Array.from(rows.values())
      .map((row) => Object.assign({}, row, {
        passRate: percent(row.passed, row.executed),
        executeRate: percent(row.executed, row.execTotal),
        automationRate: percent(row.automation, row.caseCount)
      }))
      .sort((a, b) => {
        if (b.caseCount !== a.caseCount) {
          return b.caseCount - a.caseCount;
        }
        return (order.get(a.key) || 0) - (order.get(b.key) || 0);
      });
  }

  /**
   * 计算看板指标（T01 基础实现 + T04 五大指标 / 数据窗口 / 下钻）。
   *
   * PRD §6.7 五大指标口径（分子 / 分母）：
   *   1. 需求覆盖率   `requirementCoverage` = 被 linkedRequirements 引用到的需求数 / (batches + tasks)
   *   2. 计划执行率   `planExecuteRate`     = status != '未执行' 的 execution / (plan.items × 轮次)
   *   3. 通过率       `passRate`            = 通过 / 已执行（已执行 = 通过+失败+阻塞+跳过）
   *   4. 缺陷拦截率   `defectInterceptRate` = 有 linkedDefectId 的 execution / 已执行
   *   5. 自动化占比   `automationRate`      = automationEnabled === true 的资产 / 资产总数
   *
   * 兼容性：T01 已有的返回字段（caseTotal / executeRate / passRate / caseCoverage …）全部保留，
   * T04 只做**增量**扩展，`window` 未显式传入时不做任何窗口过滤（保持旧调用行为）。
   *
   * @param {{assets?:Array,plans?:Array,executions?:Array,reviews?:Array,bugs?:Array,
   *          batches?:Array,tasks?:Array,activeBatchId?:string,window?:string,now?:string,
   *          planId?:string,round?:number}} input 输入
   * @returns {object} 指标对象
   */
  function computeMetrics(input) {
    const source = input && typeof input === "object" ? input : {};
    const planId = U.str(source.planId);
    const round = source.round === undefined || source.round === null ? null : U.num(source.round, 1, 1);

    // 只有显式声明 window 时才做窗口切分，保证 T01/T03 的既有调用行为不变
    const scoped = U.str(source.window)
      ? scopeByWindow(source)
      : {
          assets: U.toArray(source.assets),
          plans: U.toArray(source.plans),
          executions: U.toArray(source.executions),
          reviews: U.toArray(source.reviews),
          bugs: U.toArray(source.bugs),
          requirements: Array.isArray(source.requirements)
            ? source.requirements
            : collectRequirements(source.batches, source.tasks),
          windowKey: "all",
          effectiveWindow: "all",
          windowLabel: "全部",
          windowFallback: false,
          scopeName: "全部数据"
        };

    const assets = scoped.assets;
    const plans = scoped.plans;
    const reviews = scoped.reviews;
    const bugs = scoped.bugs;

    const executions = U.toArray(scoped.executions).filter((item) => {
      if (planId && U.str(item.planId) !== planId) {
        return false;
      }
      if (round !== null && U.num(item.round, 1, 1) !== round) {
        return false;
      }
      return true;
    });

    const statusCount = countBy(executions, "status", C.EXEC_STATUS);
    const executedTotal = executions.length;
    const notRun = statusCount["未执行"] || 0;
    const executed = executedTotal - notRun;
    const passed = statusCount["通过"] || 0;
    const failed = statusCount["失败"] || 0;
    const blocked = statusCount["阻塞"] || 0;
    const skipped = statusCount["跳过"] || 0;

    const automationCount = assets.filter((asset) => asset && asset.automationEnabled).length;
    const linkedCount = assets.filter((asset) => U.toArray(asset && asset.linkedRequirements).length > 0).length;
    const coveredCaseIds = new Set(executions.map((item) => U.str(item.caseAssetId)).filter(Boolean));

    const assetById = new Map();
    assets.forEach((asset) => {
      const id = U.str(asset && asset.id);
      if (id) {
        assetById.set(id, asset);
      }
    });

    const coverage = computeRequirementCoverage(assets, scoped.requirements);
    const plannedSlots = plannedSlotCount(plans, { planId, round });
    const defectLinkedCount = executions.filter((item) => U.str(item && item.linkedDefectId)).length;

    const reviewProgressList = reviews.map((ticket) => reviewProgress(ticket, { now: source.now }));
    const overdueReviews = reviewProgressList.filter((item) => item.overdue).length;

    return {
      // —— 数据窗口元信息（T04）——
      windowKey: scoped.windowKey,
      effectiveWindow: scoped.effectiveWindow,
      windowLabel: scoped.windowLabel,
      windowFallback: scoped.windowFallback,
      scopeName: scoped.scopeName,

      // —— 用例资产 ——
      caseTotal: assets.length,
      caseByStatus: countBy(assets, "status", C.CASE_STATUS),
      caseByType: countBy(assets, "type", C.CASE_TYPE),
      caseByPriority: countBy(assets, "priority", C.PRIORITY),
      caseByBusiness: countBy(assets, "business", C.BUSINESS),

      // —— 指标 5：自动化占比 ——
      automationCount,
      automationRate: percent(automationCount, assets.length),

      // —— 指标 1：需求覆盖率 ——
      requirementTotal: coverage.total,
      requirementCovered: coverage.covered,
      requirementCoverage: coverage.rate,
      requirementUncovered: coverage.uncovered,
      requirementCoveredList: coverage.coveredList,
      casesByRequirement: coverage.casesByRequirement,
      requirementLinkedCount: linkedCount,
      requirementLinkRate: percent(linkedCount, assets.length),

      // —— 计划 ——
      planTotal: plans.length,
      planByStatus: countBy(plans, "status", C.PLAN_STATUS),
      plannedSlots,

      // —— 评审 ——
      reviewTotal: reviews.length,
      reviewByStatus: countBy(reviews, "status", C.REVIEW_STATUS),
      reviewOverdue: overdueReviews,

      // —— 执行 ——
      executionTotal: executedTotal,
      executionByStatus: statusCount,
      executed,
      notRun,
      passed,
      failed,
      blocked,
      skipped,

      // —— 指标 2：计划执行率 ——
      planExecuteRate: percent(executed, plannedSlots),
      // T01 既有口径：已执行 / 执行实例总数（保留，勿改）
      executeRate: percent(executed, executedTotal),
      // —— 指标 3：通过率 ——
      passRate: percent(passed, executed),
      // —— 指标 4：缺陷拦截率 ——
      defectLinkedCount,
      defectInterceptRate: percent(defectLinkedCount, executed),
      defectTotal: bugs.length,

      caseCoverage: percent(coveredCaseIds.size, assets.length),

      // —— 下钻分组（纯 CSS 柱状图数据源）——
      drill: {
        business: drillGroups(assets, executions, "business", C.BUSINESS, assetById),
        type: drillGroups(assets, executions, "type", C.CASE_TYPE, assetById),
        priority: drillGroups(assets, executions, "priority", C.PRIORITY, assetById)
      }
    };
  }

  /* ------------------------------------------------------------------ *
   * 六之三、追溯图谱（T04）
   * ------------------------------------------------------------------ */

  /**
   * 构建 **需求 → 用例 → 执行 → 缺陷** 四层追溯关系图（纯函数）。
   *
   * 支持从任一层作为起点做正向 / 反向钻取：
   *   - `requirement` → 找引用它的用例 → 用例的执行 → 执行产出的缺陷
   *   - `case`        → 上溯需求，下钻执行与缺陷
   *   - `execution`   → 上溯用例与需求，下钻缺陷
   *   - `defect`      → 上溯执行 → 用例 → 需求（反向钻取）
   *
   * @param {{assets?:Array,plans?:Array,executions?:Array,bugs?:Array,batches?:Array,tasks?:Array,
   *          requirements?:Array,origin?:{kind?:string,id?:string}}} input 输入
   * @returns {{origin:{kind:string,id:string,found:boolean,label:string},
   *            requirements:Array<object>, cases:Array<object>, executions:Array<object>,
   *            defects:Array<object>, edges:Array<{from:string,to:string,kind:string}>,
   *            stats:object}} 图数据
   */
  function buildGraph(input) {
    const source = input && typeof input === "object" ? input : {};
    const assets = U.toArray(source.assets);
    const plans = U.toArray(source.plans);
    const executions = U.toArray(source.executions);
    const bugs = U.toArray(source.bugs);
    const requirements = Array.isArray(source.requirements)
      ? source.requirements
      : collectRequirements(source.batches, source.tasks);

    const originRaw = source.origin && typeof source.origin === "object" ? source.origin : {};
    const kind = U.oneOf(U.str(originRaw.kind), C.TRACE_ORIGIN_KIND, "requirement");
    const originId = U.str(originRaw.id);

    const assetById = new Map();
    assets.forEach((asset) => {
      const id = U.str(asset && asset.id);
      if (id) {
        assetById.set(id, asset);
      }
    });
    const requirementById = new Map();
    requirements.forEach((item) => {
      const id = U.str(item && item.id);
      if (id) {
        requirementById.set(id, item);
      }
    });

    /* —— 1. 由起点解析出「种子用例集合」—— */
    const seedCaseIds = new Set();
    let found = false;
    let originLabel = "";

    if (kind === "requirement") {
      const requirement = requirementById.get(originId) || null;
      found = Boolean(requirement);
      originLabel = requirement ? U.str(requirement.name, originId) : originId;
      assets.forEach((asset) => {
        const hit = U.toArray(asset && asset.linkedRequirements)
          .some((ref) => U.str(ref && ref.id) === originId);
        if (hit) {
          seedCaseIds.add(U.str(asset.id));
        }
      });
    } else if (kind === "case") {
      const asset = assetById.get(originId) || null;
      found = Boolean(asset);
      originLabel = asset ? U.str(asset.title, originId) : originId;
      if (originId) {
        seedCaseIds.add(originId);
      }
    } else if (kind === "execution") {
      const execution = executions.find((item) => item && U.str(item.id) === originId) || null;
      found = Boolean(execution);
      const snapshot = execution && execution.caseSnapshot ? execution.caseSnapshot : {};
      originLabel = execution ? U.str(snapshot.title, U.str(execution.caseAssetId, originId)) : originId;
      if (execution) {
        seedCaseIds.add(U.str(execution.caseAssetId));
      }
    } else {
      const bug = bugs.find((item) => item && U.str(item.id) === originId) || null;
      found = Boolean(bug);
      originLabel = bug ? U.str(bug.title, originId) : originId;
      if (bug) {
        const direct = U.str(bug.caseAssetId);
        if (direct) {
          seedCaseIds.add(direct);
        }
        const execution = executions.find((item) => item && U.str(item.id) === U.str(bug.executionId)) || null;
        if (execution) {
          seedCaseIds.add(U.str(execution.caseAssetId));
        }
        // 反查资产上的 linkedDefects（一键建 Bug 会追加）
        assets.forEach((asset) => {
          const hit = U.toArray(asset && asset.linkedDefects)
            .some((ref) => U.str(ref && ref.id) === originId);
          if (hit) {
            seedCaseIds.add(U.str(asset.id));
          }
        });
      }
    }
    seedCaseIds.delete("");

    /* —— 2. 用例层 —— */
    const caseNodes = [];
    seedCaseIds.forEach((caseId) => {
      const asset = assetById.get(caseId) || null;
      caseNodes.push({
        id: caseId,
        title: asset ? U.str(asset.title, caseId) : `${caseId}（用例已删除）`,
        status: asset ? U.oneOf(asset.status, C.CASE_STATUS, D.CASE_STATUS) : "已废弃",
        priority: asset ? U.oneOf(asset.priority, C.PRIORITY, D.PRIORITY) : D.PRIORITY,
        type: asset ? U.oneOf(asset.type, C.CASE_TYPE, D.CASE_TYPE) : D.CASE_TYPE,
        business: asset ? U.str(asset.business, D.BUSINESS) : D.BUSINESS,
        reviewId: asset ? U.str(asset.reviewId) : "",
        missing: !asset,
        requirementIds: asset
          ? U.toArray(asset.linkedRequirements).map((ref) => U.str(ref && ref.id)).filter(Boolean)
          : []
      });
    });
    caseNodes.sort((a, b) => String(a.title).localeCompare(String(b.title), "zh-Hans-CN"));

    /* —— 3. 需求层（种子用例引用到的全部需求，含起点需求）—— */
    const requirementIds = new Set();
    if (kind === "requirement" && originId) {
      requirementIds.add(originId);
    }
    caseNodes.forEach((node) => {
      node.requirementIds.forEach((reqId) => requirementIds.add(reqId));
    });

    const requirementNodes = [];
    requirementIds.forEach((reqId) => {
      const requirement = requirementById.get(reqId) || null;
      requirementNodes.push({
        id: reqId,
        type: requirement ? U.str(requirement.type, "batch") : "batch",
        name: requirement ? U.str(requirement.name, reqId) : `${reqId}（需求已删除）`,
        moduleName: requirement ? U.str(requirement.moduleName) : "",
        status: requirement ? U.str(requirement.status) : "",
        missing: !requirement,
        caseIds: caseNodes.filter((node) => node.requirementIds.includes(reqId)).map((node) => node.id)
      });
    });
    requirementNodes.sort((a, b) => String(a.name).localeCompare(String(b.name), "zh-Hans-CN"));

    /* —— 4. 执行层 —— */
    const planById = new Map();
    plans.forEach((plan) => {
      const id = U.str(plan && plan.id);
      if (id) {
        planById.set(id, plan);
      }
    });
    const executionNodes = executions
      .filter((item) => item && seedCaseIds.has(U.str(item.caseAssetId)))
      .map((item) => {
        const plan = planById.get(U.str(item.planId)) || null;
        return {
          id: U.str(item.id),
          caseAssetId: U.str(item.caseAssetId),
          planId: U.str(item.planId),
          planName: plan ? U.str(plan.name, "未命名测试计划") : "（计划已删除）",
          round: U.num(item.round, 1, 1),
          status: U.oneOf(item.status, C.EXEC_STATUS, D.EXEC_STATUS),
          executor: U.str(item.executor, "未指派"),
          linkedDefectId: U.str(item.linkedDefectId),
          finishedAt: U.str(item.finishedAt) || U.str(item.updatedAt),
          evidenceCount: U.toArray(item.evidence).length
        };
      })
      .sort((a, b) => {
        if (a.planName !== b.planName) {
          return String(a.planName).localeCompare(String(b.planName), "zh-Hans-CN");
        }
        return a.round - b.round;
      });
    const executionIds = new Set(executionNodes.map((item) => item.id));

    /* —— 5. 缺陷层 —— */
    const linkedDefectIds = new Set();
    caseNodes.forEach((node) => {
      const asset = assetById.get(node.id) || null;
      U.toArray(asset && asset.linkedDefects).forEach((ref) => {
        const defectId = U.str(ref && ref.id);
        if (defectId) {
          linkedDefectIds.add(defectId);
        }
      });
    });
    executionNodes.forEach((node) => {
      if (node.linkedDefectId) {
        linkedDefectIds.add(node.linkedDefectId);
      }
    });

    const defectNodes = bugs
      .filter((bug) => {
        if (!bug) {
          return false;
        }
        const id = U.str(bug.id);
        if (linkedDefectIds.has(id)) {
          return true;
        }
        if (seedCaseIds.has(U.str(bug.caseAssetId))) {
          return true;
        }
        return executionIds.has(U.str(bug.executionId));
      })
      .map((bug) => ({
        id: U.str(bug.id),
        title: U.str(bug.title, "未命名缺陷"),
        severity: U.str(bug.severity, "中"),
        status: U.str(bug.status, "新建"),
        owner: U.str(bug.owner, "未指派"),
        caseAssetId: U.str(bug.caseAssetId),
        executionId: U.str(bug.executionId),
        createdAt: U.str(bug.createdAt)
      }));

    /* —— 6. 连线 —— */
    const edges = [];
    requirementNodes.forEach((requirement) => {
      requirement.caseIds.forEach((caseId) => {
        edges.push({ from: `req:${requirement.id}`, to: `case:${caseId}`, kind: "req-case" });
      });
    });
    executionNodes.forEach((execution) => {
      edges.push({ from: `case:${execution.caseAssetId}`, to: `exec:${execution.id}`, kind: "case-exec" });
    });
    defectNodes.forEach((defect) => {
      if (defect.executionId && executionIds.has(defect.executionId)) {
        edges.push({ from: `exec:${defect.executionId}`, to: `defect:${defect.id}`, kind: "exec-defect" });
      } else if (defect.caseAssetId && seedCaseIds.has(defect.caseAssetId)) {
        edges.push({ from: `case:${defect.caseAssetId}`, to: `defect:${defect.id}`, kind: "case-defect" });
      }
    });

    return {
      origin: { kind, id: originId, found, label: originLabel },
      requirements: requirementNodes,
      cases: caseNodes,
      executions: executionNodes,
      defects: defectNodes,
      edges,
      stats: {
        requirementCount: requirementNodes.length,
        caseCount: caseNodes.length,
        executionCount: executionNodes.length,
        defectCount: defectNodes.length,
        passedCount: executionNodes.filter((item) => item.status === "通过").length,
        failedCount: executionNodes.filter((item) => item.status === "失败").length,
        orphanCaseCount: caseNodes.filter((item) => item.requirementIds.length === 0).length
      }
    };
  }

  /**
   * 可被导入覆盖的资产字段清单（字段映射下拉的候选项）。
   * key 为资产字段名，label 为界面展示名。
   * @type {ReadonlyArray<{key:string,label:string}>}
   */
  const IMPORT_TARGET_FIELDS = Object.freeze([
    Object.freeze({ key: "business", label: "业务线" }),
    Object.freeze({ key: "product", label: "产品" }),
    Object.freeze({ key: "module", label: "模块" }),
    Object.freeze({ key: "category", label: "场景" }),
    Object.freeze({ key: "title", label: "标题" }),
    Object.freeze({ key: "type", label: "用例类型" }),
    Object.freeze({ key: "priority", label: "优先级" }),
    Object.freeze({ key: "status", label: "状态" }),
    Object.freeze({ key: "objective", label: "测试目标" }),
    Object.freeze({ key: "preconditions", label: "前置条件" }),
    Object.freeze({ key: "testData", label: "测试数据" }),
    Object.freeze({ key: "steps", label: "测试步骤" }),
    Object.freeze({ key: "expected", label: "预期结果" }),
    Object.freeze({ key: "component", label: "功能组件" }),
    Object.freeze({ key: "tags", label: "标签" }),
    Object.freeze({ key: "id", label: "用例ID" }),
    Object.freeze({ key: "version", label: "版本" }),
    Object.freeze({ key: "createdBy", label: "创建人" }),
    Object.freeze({ key: "updatedAt", label: "更新时间" }),
    Object.freeze({ key: "isBaseline", label: "基线标记" })
  ]);

  /** 导入表头 → 资产字段 的默认映射（T05 扩充：覆盖导出标准列 + 云效 / TAPD 常见表头） */
  const IMPORT_FIELD_ALIASES = Object.freeze({
    "业务线": "business",
    "业务": "business",
    "产品": "product",
    "产品线": "product",
    "所属产品": "product",
    "模块": "module",
    "所属模块": "module",
    "功能模块": "module",
    "场景": "category",
    "测试场景": "category",
    "分类": "category",
    "目录": "category",
    "标题": "title",
    "用例标题": "title",
    "用例名称": "title",
    "名称": "title",
    "类型": "type",
    "用例类型": "type",
    "测试类型": "type",
    "优先级": "priority",
    "用例等级": "priority",
    "等级": "priority",
    "状态": "status",
    "用例状态": "status",
    "测试目标": "objective",
    "目标": "objective",
    "用例描述": "objective",
    "前置条件": "preconditions",
    "前提条件": "preconditions",
    "测试数据": "testData",
    "数据": "testData",
    "测试步骤": "steps",
    "步骤": "steps",
    "操作步骤": "steps",
    "预期结果": "expected",
    "预期": "expected",
    "期望结果": "expected",
    "组件": "component",
    "功能组件": "component",
    "标签": "tags",
    "关键词": "tags",
    "关联需求": "linkedRequirements",
    "需求": "linkedRequirements",
    "版本": "version",
    "创建人": "createdBy",
    "创建者": "createdBy",
    "更新时间": "updatedAt",
    "修改时间": "updatedAt",
    "用例ID": "id",
    "用例编号": "id",
    "编号": "id",
    "基线": "isBaseline",
    "基线标记": "isBaseline"
  });

  /** 目录层级名（产品 / 模块 / 场景）禁止出现的字符：路径分隔符、Windows 保留符、控制字符 */
  const UNSAFE_DIRECTORY_PATTERN = /[\\/:*?"<>|\u0000-\u001f]/;

  /**
   * 判断一个目录层级名是否安全（允许中文与常见符号，仅拦截路径穿越与文件系统保留字符）。
   * 注意：不能复用 `U.isSafePathPart`——那是给 id / 目录名（ASCII）用的，会误杀中文。
   * @param {string} value 目录层级名
   * @returns {boolean} 安全返回 true
   */
  function isSafeDirectoryLabel(value) {
    const text = U.str(value);
    if (!text) {
      return true;
    }
    if (UNSAFE_DIRECTORY_PATTERN.test(text)) {
      return false;
    }
    return !text.includes("..");
  }

  /**
   * 校验并归一化一行导入数据。
   *
   * 宽松模式（默认）：枚举非法只给 warning，归一化时回退默认值——保持 T01 行为不变。
   * 严格模式（`strictEnums: true`，导入向导使用）：枚举非法升级为 error，整行被拦截并给出原因。
   *
   * @param {object} row 一行原始数据（键为表头或资产字段名）
   * @param {{index?:number, strictEnums?:boolean, existingTitles?:Array<string>,
   *          operator?:string, now?:string, todayDate?:string}} [options] 选项
   * @returns {{ok:boolean, index:number, errors:Array<string>, warnings:Array<string>, asset:object|null}} 校验结果
   */
  function validateImportRow(row, options) {
    const opts = options && typeof options === "object" ? options : {};
    const index = U.num(opts.index, 0, 0);
    const strictEnums = U.bool(opts.strictEnums, false);
    const errors = [];
    const warnings = [];
    const source = row && typeof row === "object" ? row : {};

    // 表头别名 → 字段名
    const mapped = {};
    Object.keys(source).forEach((key) => {
      const field = IMPORT_FIELD_ALIASES[String(key).trim()] || String(key).trim();
      mapped[field] = source[key];
    });

    /**
     * 记录一条枚举问题：严格模式进 errors，宽松模式进 warnings。
     * @param {string} message 提示文案
     * @returns {void}
     */
    function reportEnum(message) {
      if (strictEnums) {
        errors.push(message);
        return;
      }
      warnings.push(message);
    }

    const title = U.str(mapped.title);
    if (!title) {
      errors.push("标题不能为空");
    } else if (title.length > 200) {
      errors.push("标题超过 200 字，请精简");
    }

    const business = U.str(mapped.business);
    if (business && !C.BUSINESS.includes(business)) {
      reportEnum(`业务线「${business}」不在枚举内（可选：${C.BUSINESS.join(" / ")}）`);
    }
    if (!business) {
      if (strictEnums) {
        errors.push("业务线不能为空，请在字段映射中指定或补齐该列");
      } else {
        warnings.push(`未填写业务线，已回退为「${D.BUSINESS}」`);
      }
    }

    const type = U.str(mapped.type);
    if (type && !C.CASE_TYPE.includes(type)) {
      reportEnum(`用例类型「${type}」不在枚举内（可选：${C.CASE_TYPE.join(" / ")}）`);
    }

    const priority = U.str(mapped.priority);
    if (priority && !C.PRIORITY.includes(priority)) {
      reportEnum(`优先级「${priority}」不在枚举内（可选：${C.PRIORITY.join(" / ")}）`);
    }

    const status = U.str(mapped.status);
    if (status && !C.CASE_STATUS.includes(status)) {
      reportEnum(`用例状态「${status}」不在枚举内（可选：${C.CASE_STATUS.join(" / ")}）`);
    }

    // 目录路径校验：product / module / category 作为目录层级，禁止路径分隔符与越权字符
    [
      { key: "product", label: "产品" },
      { key: "module", label: "模块" },
      { key: "category", label: "场景" }
    ].forEach((field) => {
      const value = U.str(mapped[field.key]);
      if (!value) {
        return;
      }
      if (value.length > 80) {
        errors.push(`${field.label}「${value.slice(0, 20)}…」超过 80 字`);
        return;
      }
      if (!isSafeDirectoryLabel(value)) {
        errors.push(`${field.label}「${value}」包含非法字符（不允许 / \\ : * ? " < > | 与 .. 等路径符号）`);
      }
    });

    const existingTitles = U.toArray(opts.existingTitles).map((item) => String(item));
    if (title && existingTitles.includes(title)) {
      warnings.push("库中已存在同名用例，导入后可能重复");
    }

    const asset = errors.length === 0
      ? normalizeCaseAsset(mapped, {
          operator: opts.operator,
          now: opts.now,
          todayDate: opts.todayDate
        })
      : null;

    return {
      ok: errors.length === 0,
      index,
      errors,
      warnings,
      asset
    };
  }

  /* ================================================================== *
   * 九、T05 —— 导入导出 / 版本快照 / 结构化步骤 / AI 建议（全部纯函数）
   * T05_MODEL_BLOCK_START
   * ================================================================== */

  /**
   * 导出标准列（云效 / TAPD 通用列序）。
   * 顺序即导出列顺序，label 同时作为 CSV 表头与 xlsx 表头。
   * @type {ReadonlyArray<{key:string,label:string}>}
   */
  const EXPORT_COLUMNS = Object.freeze([
    Object.freeze({ key: "business", label: "业务线" }),
    Object.freeze({ key: "product", label: "产品" }),
    Object.freeze({ key: "module", label: "模块" }),
    Object.freeze({ key: "category", label: "场景" }),
    Object.freeze({ key: "title", label: "标题" }),
    Object.freeze({ key: "type", label: "类型" }),
    Object.freeze({ key: "priority", label: "优先级" }),
    Object.freeze({ key: "status", label: "状态" }),
    Object.freeze({ key: "preconditions", label: "前置条件" }),
    Object.freeze({ key: "steps", label: "步骤" }),
    Object.freeze({ key: "expected", label: "预期" }),
    Object.freeze({ key: "component", label: "组件" }),
    Object.freeze({ key: "tags", label: "标签" }),
    Object.freeze({ key: "linkedRequirements", label: "关联需求" }),
    Object.freeze({ key: "version", label: "版本" }),
    Object.freeze({ key: "createdBy", label: "创建人" }),
    Object.freeze({ key: "updatedAt", label: "更新时间" })
  ]);

  /**
   * 扩展列：勾选「含扩展列」时追加，保证导出 → 导入的往返保真。
   * @type {ReadonlyArray<{key:string,label:string}>}
   */
  const EXPORT_EXTRA_COLUMNS = Object.freeze([
    Object.freeze({ key: "id", label: "用例ID" }),
    Object.freeze({ key: "objective", label: "测试目标" }),
    Object.freeze({ key: "testData", label: "测试数据" }),
    Object.freeze({ key: "isBaseline", label: "基线" })
  ]);

  /**
   * 取出资产在某一导出列上的字符串值。
   * @param {object} asset 已归一化的用例资产
   * @param {string} key 列字段名
   * @returns {string} 单元格文本
   */
  function exportCellValue(asset, key) {
    const item = asset && typeof asset === "object" ? asset : {};
    if (key === "tags") {
      return U.stringList(item.tags).join(",");
    }
    if (key === "linkedRequirements") {
      return U.toArray(item.linkedRequirements)
        .map((req) => U.str(req && req.name) || U.str(req && req.id))
        .filter(Boolean)
        .join(",");
    }
    if (key === "isBaseline") {
      return U.bool(item.isBaseline, false) ? "是" : "否";
    }
    if (key === "version") {
      return String(U.num(item.version, 1, 1));
    }
    if (key === "steps") {
      const rows = U.toArray(item.stepRows);
      return rows.length ? stepRowsToPlainText(rows) : U.str(item.steps);
    }
    return U.str(item[key]);
  }

  /**
   * 构造导出行矩阵。
   * @param {Array<object>} cases 用例资产数组
   * @param {{withExtra?:boolean, columns?:Array<{key:string,label:string}>}} [options] 选项
   * @returns {{columns:Array<{key:string,label:string}>, headers:Array<string>, rows:Array<Array<string>>}} 导出数据
   */
  function buildExportRows(cases, options) {
    const opts = options && typeof options === "object" ? options : {};
    const columns = Array.isArray(opts.columns) && opts.columns.length
      ? opts.columns.slice()
      : EXPORT_COLUMNS.concat(opts.withExtra ? EXPORT_EXTRA_COLUMNS : []);
    const headers = columns.map((column) => U.str(column.label) || U.str(column.key));
    const rows = U.toArray(cases).map((raw) => {
      const asset = normalizeCaseAsset(raw, { operator: D.OPERATOR });
      return columns.map((column) => exportCellValue(asset, U.str(column.key)));
    });
    return { columns, headers, rows };
  }

  /**
   * 转义单个 CSV 字段（RFC 4180）。
   * @param {*} value 原始值
   * @returns {string} 转义后的字段
   */
  function csvEscape(value) {
    const text = value === undefined || value === null ? "" : String(value);
    if (/[",\r\n]/.test(text)) {
      return `"${text.replaceAll('"', '""')}"`;
    }
    return text;
  }

  /**
   * 生成 CSV 文本（不含 BOM；BOM 由下载环节补，保证 Excel 中文不乱码）。
   * @param {Array<string>} headers 表头
   * @param {Array<Array<string>>} rows 数据行
   * @returns {string} CSV 文本（CRLF 换行）
   */
  function toCsvText(headers, rows) {
    const lines = [];
    lines.push(U.toArray(headers).map(csvEscape).join(","));
    U.toArray(rows).forEach((row) => {
      lines.push(U.toArray(row).map(csvEscape).join(","));
    });
    return lines.join("\r\n");
  }

  /**
   * 解析 CSV 文本为 `{headers, rows}`（rows 为对象数组，键为表头）。
   * 支持带引号字段、字段内换行、`""` 转义、BOM、CRLF。
   * @param {string} text CSV 原文
   * @returns {{headers:Array<string>, rows:Array<object>, matrix:Array<Array<string>>}} 解析结果
   */
  function parseCsvText(text) {
    const raw = String(text === undefined || text === null ? "" : text)
      .replace(/^\uFEFF/, "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");

    const matrix = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let index = 0; index < raw.length; index += 1) {
      const ch = raw[index];
      if (inQuotes) {
        if (ch === '"') {
          if (raw[index + 1] === '"') {
            field += '"';
            index += 1;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
        continue;
      }
      if (ch === '"') {
        inQuotes = true;
        continue;
      }
      if (ch === ",") {
        row.push(field);
        field = "";
        continue;
      }
      if (ch === "\n") {
        row.push(field);
        matrix.push(row);
        row = [];
        field = "";
        continue;
      }
      field += ch;
    }
    if (field !== "" || row.length > 0) {
      row.push(field);
      matrix.push(row);
    }

    const cleaned = matrix.filter((line) => line.some((cell) => U.str(cell) !== ""));
    if (!cleaned.length) {
      return { headers: [], rows: [], matrix: [] };
    }

    const headers = cleaned[0].map((cell) => U.str(cell));
    const rows = cleaned.slice(1).map((line) => {
      const record = {};
      headers.forEach((header, columnIndex) => {
        const key = header || `列${columnIndex + 1}`;
        record[key] = U.str(line[columnIndex]);
      });
      return record;
    });
    return { headers, rows, matrix: cleaned };
  }

  /**
   * XML 文本转义（OPML 用）。
   * @param {*} value 原始值
   * @returns {string} 转义后的文本
   */
  function xmlEscape(value) {
    return String(value === undefined || value === null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }

  /**
   * 把用例数组按 业务线 / 产品 / 模块 / 场景 聚合成四层树（导出脑图用）。
   * @param {Array<object>} cases 用例资产数组
   * @returns {Array<{name:string, children:Array<object>, cases:Array<object>}>} 树
   */
  function buildOutlineTree(cases) {
    const roots = [];
    const index = new Map();

    /**
     * 取（或建）某一层节点。
     * @param {Array<object>} container 父级 children 数组
     * @param {string} pathKey 唯一路径键
     * @param {string} name 节点名
     * @returns {object} 节点
     */
    function ensureNode(container, pathKey, name) {
      if (index.has(pathKey)) {
        return index.get(pathKey);
      }
      const node = { name, children: [], cases: [] };
      index.set(pathKey, node);
      container.push(node);
      return node;
    }

    U.toArray(cases).forEach((raw) => {
      const asset = normalizeCaseAsset(raw, { operator: D.OPERATOR });
      const business = U.str(asset.business) || "未分类业务";
      const product = U.str(asset.product) || "未分产品";
      const moduleName = U.str(asset.module) || "未分模块";
      const category = U.str(asset.category);

      const businessNode = ensureNode(roots, `b::${business}`, business);
      const productNode = ensureNode(businessNode.children, `b::${business}|p::${product}`, product);
      const moduleNode = ensureNode(productNode.children, `b::${business}|p::${product}|m::${moduleName}`, moduleName);
      if (category) {
        const categoryNode = ensureNode(
          moduleNode.children,
          `b::${business}|p::${product}|m::${moduleName}|c::${category}`,
          category
        );
        categoryNode.cases.push(asset);
        return;
      }
      moduleNode.cases.push(asset);
    });

    return roots;
  }

  /**
   * 生成用例摘要（OPML `_note` / Markdown 明细共用）。
   * @param {object} asset 用例资产
   * @returns {string} 摘要文本
   */
  function caseOutlineNote(asset) {
    const parts = [];
    if (U.str(asset.priority)) {
      parts.push(`优先级：${asset.priority}`);
    }
    if (U.str(asset.type)) {
      parts.push(`类型：${asset.type}`);
    }
    if (U.str(asset.status)) {
      parts.push(`状态：${asset.status}`);
    }
    if (U.str(asset.preconditions)) {
      parts.push(`前置条件：\n${asset.preconditions}`);
    }
    const steps = U.toArray(asset.stepRows).length
      ? stepRowsToPlainText(asset.stepRows)
      : U.str(asset.steps);
    if (steps) {
      parts.push(`步骤：\n${steps}`);
    }
    if (U.str(asset.expected)) {
      parts.push(`预期：\n${asset.expected}`);
    }
    return parts.join("\n");
  }

  /**
   * 生成 OPML 2.0 文本（可被 XMind / 幕布 等脑图工具导入为树）。
   * @param {Array<object>} cases 用例资产数组
   * @param {{title?:string, now?:string}} [options] 选项
   * @returns {string} OPML XML 文本
   */
  function buildOpml(cases, options) {
    const opts = options && typeof options === "object" ? options : {};
    const title = U.str(opts.title, "测试用例导出");
    const stamp = U.str(opts.now) || U.nowIso();
    const tree = buildOutlineTree(cases);

    /**
     * 递归渲染 outline 节点。
     * @param {object} node 树节点
     * @param {number} depth 缩进层级
     * @returns {string} XML 片段
     */
    function renderNode(node, depth) {
      const pad = "  ".repeat(depth);
      const childXml = node.children.map((child) => renderNode(child, depth + 1)).join("");
      const caseXml = node.cases.map((asset) => {
        const note = caseOutlineNote(asset);
        return `${pad}  <outline text="${xmlEscape(asset.title)}" _note="${xmlEscape(note)}" />\n`;
      }).join("");
      if (!childXml && !caseXml) {
        return `${pad}<outline text="${xmlEscape(node.name)}" />\n`;
      }
      return `${pad}<outline text="${xmlEscape(node.name)}">\n${childXml}${caseXml}${pad}</outline>\n`;
    }

    const body = tree.map((node) => renderNode(node, 2)).join("");
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<opml version="2.0">',
      "  <head>",
      `    <title>${xmlEscape(title)}</title>`,
      `    <dateCreated>${xmlEscape(stamp)}</dateCreated>`,
      "  </head>",
      "  <body>",
      body.replace(/\n$/, ""),
      "  </body>",
      "</opml>",
      ""
    ].join("\n");
  }

  /**
   * 生成 Markdown 大纲（同样可被脑图工具导入）。
   * @param {Array<object>} cases 用例资产数组
   * @param {{title?:string}} [options] 选项
   * @returns {string} Markdown 文本
   */
  function buildMarkdownOutline(cases, options) {
    const opts = options && typeof options === "object" ? options : {};
    const title = U.str(opts.title, "测试用例导出");
    const tree = buildOutlineTree(cases);
    const lines = [`# ${title}`, ""];

    /**
     * 递归渲染节点。
     * @param {object} node 树节点
     * @param {number} depth 层级（1 起）
     * @returns {void}
     */
    function renderNode(node, depth) {
      const heading = depth <= 5 ? `${"#".repeat(depth + 1)} ${node.name}` : `${"  ".repeat(depth - 5)}- ${node.name}`;
      lines.push(heading);
      lines.push("");
      node.cases.forEach((asset) => {
        lines.push(`- **${asset.title}**（${asset.priority} / ${asset.type} / ${asset.status}）`);
        const note = caseOutlineNote(asset);
        note.split("\n").forEach((line) => {
          if (U.str(line)) {
            lines.push(`  - ${line}`);
          }
        });
      });
      if (node.cases.length) {
        lines.push("");
      }
      node.children.forEach((child) => renderNode(child, depth + 1));
    }

    tree.forEach((node) => renderNode(node, 1));
    return lines.join("\n");
  }

  /* ------------------------------------------------------------------ *
   * 导入：字段映射 / 冲突判定 / 计划构建
   * ------------------------------------------------------------------ */

  /**
   * 判重键：`business|product|module|title`（系统设计 §6.8）。
   * @param {object} asset 用例资产
   * @returns {string} 判重键
   */
  function caseConflictKey(asset) {
    const item = asset && typeof asset === "object" ? asset : {};
    return [
      U.str(item.business),
      U.str(item.product),
      U.str(item.module),
      U.str(item.title)
    ].join("|");
  }

  /**
   * 根据表头 → 字段的映射表把原始行改写成字段行。
   * 映射值为空串表示「忽略该列」。
   * @param {object} row 原始行（键为表头）
   * @param {object} mapping 表头 → 资产字段名
   * @returns {object} 字段行
   */
  function applyImportMapping(row, mapping) {
    const source = row && typeof row === "object" ? row : {};
    const map = mapping && typeof mapping === "object" ? mapping : {};
    const out = {};
    Object.keys(source).forEach((header) => {
      const key = U.str(header);
      const field = Object.prototype.hasOwnProperty.call(map, key)
        ? U.str(map[key])
        : U.str(IMPORT_FIELD_ALIASES[key] || key);
      if (!field) {
        return;
      }
      out[field] = source[header];
    });
    return out;
  }

  /**
   * 依据表头推测默认映射。
   * @param {Array<string>} headers 表头数组
   * @returns {object} 表头 → 字段名（无法识别时为空串=忽略）
   */
  function guessImportMapping(headers) {
    const mapping = {};
    U.toArray(headers).forEach((header) => {
      const key = U.str(header);
      if (!key) {
        return;
      }
      const alias = IMPORT_FIELD_ALIASES[key];
      if (alias) {
        mapping[key] = alias;
        return;
      }
      mapping[key] = IMPORT_TARGET_FIELDS.some((field) => field.key === key) ? key : "";
    });
    return mapping;
  }

  /**
   * 构建导入计划：逐行校验 + 冲突判定 + 默认动作。
   * @param {Array<object>} rawRows 原始行数组
   * @param {Array<object>} existingList 现有资产集合
   * @param {{mapping?:object, defaultAction?:string, operator?:string, now?:string, todayDate?:string}} [options] 选项
   * @returns {{items:Array<object>, summary:{total:number,create:number,overwrite:number,skip:number,error:number}, headers:Array<string>}} 计划
   */
  function buildImportPlan(rawRows, existingList, options) {
    const opts = options && typeof options === "object" ? options : {};
    const mapping = opts.mapping && typeof opts.mapping === "object" ? opts.mapping : null;
    const defaultAction = ["create", "overwrite", "skip"].includes(U.str(opts.defaultAction))
      ? U.str(opts.defaultAction)
      : "overwrite";

    const existing = U.toArray(existingList);
    const existingByKey = new Map();
    existing.forEach((asset) => {
      existingByKey.set(caseConflictKey(asset), asset);
    });
    const existingTitles = existing.map((asset) => U.str(asset.title));

    const seenInFile = new Set();
    const items = U.toArray(rawRows).map((raw, index) => {
      const mapped = applyImportMapping(raw, mapping);
      const result = validateImportRow(mapped, {
        index,
        strictEnums: true,
        existingTitles,
        operator: opts.operator,
        now: opts.now,
        todayDate: opts.todayDate
      });

      const asset = result.asset;
      const key = asset ? caseConflictKey(asset) : "";
      const conflictAsset = key ? existingByKey.get(key) || null : null;
      const duplicateInFile = Boolean(key) && seenInFile.has(key);
      if (key) {
        seenInFile.add(key);
      }

      const warnings = result.warnings.slice();
      if (duplicateInFile) {
        warnings.push("同一份文件内存在重复用例（业务线/产品/模块/标题相同）");
      }

      return {
        index,
        rowNo: index + 1,
        ok: result.ok,
        errors: result.errors.slice(),
        warnings,
        asset,
        raw: mapped,
        conflict: Boolean(conflictAsset),
        conflictId: conflictAsset ? U.str(conflictAsset.id) : "",
        conflictKey: key,
        duplicateInFile,
        action: !result.ok ? "skip" : (conflictAsset ? defaultAction : "create")
      };
    });

    return { items, summary: summarizeImportPlan(items), headers: U.toArray(opts.headers).map((item) => U.str(item)) };
  }

  /**
   * 汇总导入计划（新增 X / 覆盖 Y / 跳过 / 错误 Z）。
   * @param {Array<object>} items 计划条目
   * @returns {{total:number,create:number,overwrite:number,skip:number,error:number}} 汇总
   */
  function summarizeImportPlan(items) {
    const summary = { total: 0, create: 0, overwrite: 0, skip: 0, error: 0 };
    U.toArray(items).forEach((item) => {
      summary.total += 1;
      if (!item.ok) {
        summary.error += 1;
        return;
      }
      if (item.action === "overwrite") {
        summary.overwrite += 1;
        return;
      }
      if (item.action === "skip") {
        summary.skip += 1;
        return;
      }
      summary.create += 1;
    });
    return summary;
  }

  /**
   * 执行导入计划，返回新的资产集合（纯函数，不写 store）。
   * @param {Array<object>} existingList 现有资产集合
   * @param {Array<object>} items 计划条目（含用户改过的 action）
   * @param {{operator?:string, now?:string, todayDate?:string}} [options] 选项
   * @returns {{next:Array<object>, created:number, overwritten:number, skipped:number, failed:number}} 执行结果
   */
  function applyImportPlan(existingList, items, options) {
    const opts = options && typeof options === "object" ? options : {};
    const operator = U.str(opts.operator, D.OPERATOR);
    const nowStamp = U.str(opts.now) || U.nowIso();
    const todayDate = U.str(opts.todayDate) || U.today();

    const next = U.toArray(existingList).map((asset) => normalizeCaseAsset(asset, opts));
    const indexById = new Map();
    next.forEach((asset, position) => {
      indexById.set(U.str(asset.id), position);
    });
    const usedIds = new Set(next.map((asset) => U.str(asset.id)));

    let created = 0;
    let overwritten = 0;
    let skipped = 0;
    let failed = 0;

    U.toArray(items).forEach((item) => {
      if (!item || !item.ok || !item.asset) {
        failed += 1;
        return;
      }
      if (item.action === "skip") {
        skipped += 1;
        return;
      }

      if (item.action === "overwrite" && item.conflictId && indexById.has(item.conflictId)) {
        const position = indexById.get(item.conflictId);
        const prev = next[position];
        next[position] = normalizeCaseAsset(Object.assign({}, item.asset, {
          id: prev.id,
          createdBy: prev.createdBy,
          createdAt: prev.createdAt,
          reviewId: prev.reviewId,
          isBaseline: prev.isBaseline,
          baselineFrom: prev.baselineFrom,
          linkedDefects: prev.linkedDefects,
          executionHistory: prev.executionHistory,
          version: U.num(prev.version, 1, 1) + 1,
          updatedBy: operator,
          updatedAt: nowStamp
        }), { operator, now: nowStamp, todayDate });
        overwritten += 1;
        return;
      }

      let newId = U.str(item.asset.id);
      if (!newId || usedIds.has(newId)) {
        newId = U.uid(C.ID_PREFIX.CASE_ASSET);
        while (usedIds.has(newId)) {
          newId = U.uid(C.ID_PREFIX.CASE_ASSET);
        }
      }
      usedIds.add(newId);
      const fresh = normalizeCaseAsset(Object.assign({}, item.asset, {
        id: newId,
        version: 1,
        createdBy: U.str(item.asset.createdBy, operator),
        createdAt: U.dateOr(item.asset.createdAt, todayDate),
        updatedBy: operator,
        updatedAt: nowStamp
      }), { operator, now: nowStamp, todayDate });
      indexById.set(newId, next.length);
      next.push(fresh);
      created += 1;
    });

    return { next, created, overwritten, skipped, failed };
  }

  /* ------------------------------------------------------------------ *
   * 版本快照 / diff / 回滚
   * ------------------------------------------------------------------ */

  /**
   * 参与版本 diff 的字段（顺序即展示顺序）。
   * @type {ReadonlyArray<{key:string,label:string}>}
   */
  const CASE_DIFF_FIELDS = Object.freeze([
    Object.freeze({ key: "title", label: "标题" }),
    Object.freeze({ key: "business", label: "业务线" }),
    Object.freeze({ key: "product", label: "产品" }),
    Object.freeze({ key: "module", label: "模块" }),
    Object.freeze({ key: "category", label: "场景" }),
    Object.freeze({ key: "type", label: "用例类型" }),
    Object.freeze({ key: "priority", label: "优先级" }),
    Object.freeze({ key: "status", label: "状态" }),
    Object.freeze({ key: "objective", label: "测试目标" }),
    Object.freeze({ key: "preconditions", label: "前置条件" }),
    Object.freeze({ key: "testData", label: "测试数据" }),
    Object.freeze({ key: "steps", label: "操作步骤" }),
    Object.freeze({ key: "stepRows", label: "结构化步骤" }),
    Object.freeze({ key: "expected", label: "预期结果" }),
    Object.freeze({ key: "component", label: "功能组件" }),
    Object.freeze({ key: "tags", label: "标签" }),
    Object.freeze({ key: "linkedRequirements", label: "关联需求" }),
    Object.freeze({ key: "automationEnabled", label: "自动化开关" }),
    Object.freeze({ key: "automationTargetPath", label: "自动化脚本路径" }),
    Object.freeze({ key: "isBaseline", label: "基线标记" })
  ]);

  /**
   * 把任意字段值格式化成可比较 / 可展示的文本。
   * @param {string} key 字段名
   * @param {*} value 字段值
   * @returns {string} 文本
   */
  function formatDiffValue(key, value) {
    if (key === "tags") {
      return U.stringList(value).join("、");
    }
    if (key === "linkedRequirements") {
      return U.toArray(value)
        .map((req) => `${U.str(req && req.type)}:${U.str(req && req.name) || U.str(req && req.id)}`)
        .join("、");
    }
    if (key === "stepRows") {
      return U.toArray(value)
        .map((row, index) => {
          const item = row && typeof row === "object" ? row : {};
          return `${U.num(item.no, index + 1, 1)}. ${U.str(item.action)} | ${U.str(item.data)} | ${U.str(item.expected)}`;
        })
        .join("\n");
    }
    if (typeof value === "boolean") {
      return value ? "是" : "否";
    }
    if (value === undefined || value === null) {
      return "";
    }
    return String(value);
  }

  /**
   * 创建一条版本快照（不写库）。
   * @param {object} asset 保存后的用例资产
   * @param {{operator?:string, now?:string, changeNote?:string, id?:string}} [options] 选项
   * @returns {object} CaseVersion
   */
  function createCaseVersion(asset, options) {
    const opts = options && typeof options === "object" ? options : {};
    const normalized = normalizeCaseAsset(asset, opts);
    const snapshot = Object.assign({}, normalized);
    delete snapshot.executionHistory;

    return normalizeCaseVersion({
      id: U.str(opts.id) || U.uid(C.ID_PREFIX.CASE_VERSION),
      caseAssetId: normalized.id,
      version: U.num(normalized.version, 1, 1),
      snapshot,
      changedBy: U.str(opts.operator) || U.str(normalized.updatedBy, D.OPERATOR),
      changedAt: U.str(opts.now) || U.str(normalized.updatedAt) || U.nowIso(),
      changeNote: U.str(opts.changeNote)
    }, opts);
  }

  /**
   * 追加一条版本快照到集合（同 caseAssetId + version 视为重写），并施加 20 版容量护栏。
   * @param {Array<object>} versions 现有版本集合
   * @param {object} asset 保存后的用例资产
   * @param {{operator?:string, now?:string, changeNote?:string}} [options] 选项
   * @returns {Array<object>} 新的版本集合
   */
  function appendCaseVersion(versions, asset, options) {
    const entry = createCaseVersion(asset, options);
    const kept = U.toArray(versions).filter((row) => {
      const item = row && typeof row === "object" ? row : {};
      return !(U.str(item.caseAssetId) === entry.caseAssetId && U.num(item.version, 0, 0) === entry.version);
    });
    return normalizeCaseVersionList(kept.concat([entry]), options);
  }

  /**
   * 取某条用例的版本历史（按 version 倒序，最新在前）。
   * @param {Array<object>} versions 版本集合
   * @param {string} caseAssetId 用例 id
   * @returns {Array<object>} 版本数组
   */
  function versionsOfCase(versions, caseAssetId) {
    const target = U.str(caseAssetId);
    if (!target) {
      return [];
    }
    return U.toArray(versions)
      .filter((row) => row && U.str(row.caseAssetId) === target)
      .slice()
      .sort((a, b) => U.num(b.version, 0, 0) - U.num(a.version, 0, 0));
  }

  /**
   * 字段级 diff：比较两份快照（或资产）。
   * @param {object} before 旧快照
   * @param {object} after 新快照
   * @returns {Array<{key:string,label:string,before:string,after:string,changed:boolean}>} diff 明细
   */
  function diffCaseSnapshots(before, after) {
    const left = before && typeof before === "object" ? before : {};
    const right = after && typeof after === "object" ? after : {};
    return CASE_DIFF_FIELDS.map((field) => {
      const beforeText = formatDiffValue(field.key, left[field.key]);
      const afterText = formatDiffValue(field.key, right[field.key]);
      return {
        key: field.key,
        label: field.label,
        before: beforeText,
        after: afterText,
        changed: beforeText !== afterText
      };
    });
  }

  /**
   * 回滚：用历史快照覆盖业务字段，但 version 继续 +1（保持线性历史）。
   * 执行事实（executionHistory / linkedDefects / reviewId）不回滚。
   * @param {object} current 当前资产
   * @param {object} snapshot 目标历史快照
   * @param {{operator?:string, now?:string, todayDate?:string}} [options] 选项
   * @returns {object} 回滚后的资产（全新对象）
   */
  function rollbackCaseAsset(current, snapshot, options) {
    const opts = options && typeof options === "object" ? options : {};
    const operator = U.str(opts.operator, D.OPERATOR);
    const nowStamp = U.str(opts.now) || U.nowIso();
    const base = normalizeCaseAsset(current, opts);
    const snap = normalizeCaseAsset(snapshot, opts);

    return normalizeCaseAsset(Object.assign({}, snap, {
      id: base.id,
      createdBy: base.createdBy,
      createdAt: base.createdAt,
      reviewId: base.reviewId,
      linkedDefects: base.linkedDefects,
      executionHistory: base.executionHistory,
      version: U.num(base.version, 1, 1) + 1,
      updatedBy: operator,
      updatedAt: nowStamp
    }), { operator, now: nowStamp, todayDate: opts.todayDate });
  }

  /* ------------------------------------------------------------------ *
   * 结构化步骤 ↔ automationSteps ↔ 纯文本
   * ------------------------------------------------------------------ */

  /** automationSteps.stepType → 中文动作前缀（系统设计 §6.2） */
  const AUTOMATION_STEP_LABELS = Object.freeze({
    openPage: "打开页面",
    click: "点击",
    input: "输入",
    waitElement: "等待元素",
    assertText: "校验文本",
    assertElement: "校验元素",
    screenshot: "截图",
    wait: "等待"
  });

  /**
   * 归一化结构化步骤数组并重排序号。
   * @param {*} rows 原始步骤数组
   * @returns {Array<{no:number,action:string,data:string,expected:string}>} 步骤数组
   */
  function normalizeStepRowList(rows) {
    return U.toArray(rows).map((row, index) => normalizeStepRow(row, index)).map((row, index) => ({
      no: index + 1,
      action: row.action,
      data: row.data,
      expected: row.expected
    }));
  }

  /**
   * 由 automationSteps 反推结构化步骤骨架。
   * @param {*} automationSteps 现有自动化步骤数组
   * @returns {Array<{no:number,action:string,data:string,expected:string}>} 步骤骨架
   */
  function stepRowsFromAutomationSteps(automationSteps) {
    const rows = [];
    U.toArray(automationSteps).forEach((raw) => {
      const step = raw && typeof raw === "object" ? raw : {};
      const stepType = U.str(step.stepType || step.type);
      if (!stepType) {
        return;
      }
      const target = U.str(step.target || step.path || step.url || step.selector);
      const inputValue = U.str(step.inputValue || step.value || step.text || step.ms);
      const label = AUTOMATION_STEP_LABELS[stepType] || stepType;
      const remark = U.str(step.remark || step.note);

      let action = label;
      let data = "";
      let expected = "";

      if (stepType === "openPage") {
        action = `${label} ${target}`.trim();
        data = target;
        expected = "页面正常打开";
      } else if (stepType === "click") {
        action = `${label} ${target}`.trim();
        data = target;
        expected = "点击生效，页面状态变化";
      } else if (stepType === "input") {
        action = `${label} ${target}`.trim();
        data = inputValue;
        expected = "输入内容正确回显";
      } else if (stepType === "waitElement") {
        action = `${label} ${target}`.trim();
        data = target;
        expected = "元素在超时前出现";
      } else if (stepType === "assertText") {
        action = `${label} ${target || "页面"}`.trim();
        data = inputValue;
        expected = inputValue ? `页面包含「${inputValue}」` : "页面文本符合预期";
      } else if (stepType === "assertElement") {
        action = `${label} ${target}`.trim();
        data = target;
        expected = "元素可见";
      } else if (stepType === "screenshot") {
        action = `${label} ${inputValue || target}`.trim();
        data = inputValue || target;
        expected = "截图已保存";
      } else if (stepType === "wait") {
        action = `${label} ${inputValue || ""}ms`.trim();
        data = inputValue;
        expected = "等待结束后继续";
      } else {
        action = `${label} ${target}`.trim();
        data = target || inputValue;
        expected = "";
      }

      rows.push({
        no: rows.length + 1,
        action: remark ? `${action}（${remark}）` : action,
        data,
        expected
      });
    });
    return rows;
  }

  /**
   * 结构化步骤 → `steps` 纯文本（向下兼容报告导出 / Lark 同步）。
   * @param {*} rows 结构化步骤数组
   * @returns {string} 每行一步的纯文本
   */
  function stepRowsToPlainText(rows) {
    return normalizeStepRowList(rows)
      .map((row) => {
        const parts = [`${row.no}. ${row.action}`.trim()];
        if (row.data) {
          parts.push(`数据：${row.data}`);
        }
        return parts.join("　");
      })
      .filter((line) => U.str(line.replace(/^\d+\.\s*/, "")))
      .join("\n");
  }

  /**
   * 结构化步骤 → `expected` 纯文本。
   * @param {*} rows 结构化步骤数组
   * @returns {string} 预期结果文本
   */
  function stepRowsToExpectedText(rows) {
    return normalizeStepRowList(rows)
      .filter((row) => U.str(row.expected))
      .map((row) => `${row.no}. ${row.expected}`)
      .join("\n");
  }

  /**
   * `steps` 纯文本 → 结构化步骤骨架（首次启用结构化编辑器时用）。
   * @param {string} text 纯文本步骤
   * @returns {Array<{no:number,action:string,data:string,expected:string}>} 步骤数组
   */
  function stepRowsFromPlainText(text) {
    const lines = U.str(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    return lines.map((line, index) => {
      const stripped = line.replace(/^\s*(\d+[.、)]|[-*])\s*/, "");
      const dataMatch = stripped.match(/^(.*?)(?:\s*[　\s]数据[:：]\s*(.*))$/);
      return {
        no: index + 1,
        action: U.str(dataMatch ? dataMatch[1] : stripped),
        data: U.str(dataMatch ? dataMatch[2] : ""),
        expected: ""
      };
    });
  }

  /**
   * 移动步骤位置（拖拽排序 / 上下移动共用），返回重排后的新数组。
   * @param {*} rows 步骤数组
   * @param {number} from 源下标
   * @param {number} to 目标下标
   * @returns {Array<object>} 新数组
   */
  function moveStepRow(rows, from, to) {
    const list = normalizeStepRowList(rows);
    const fromIndex = U.num(from, -1, -1);
    let toIndex = U.num(to, -1, -1);
    if (fromIndex < 0 || fromIndex >= list.length) {
      return list;
    }
    if (toIndex < 0) {
      toIndex = 0;
    }
    if (toIndex >= list.length) {
      toIndex = list.length - 1;
    }
    if (fromIndex === toIndex) {
      return list;
    }
    const moved = list.splice(fromIndex, 1)[0];
    list.splice(toIndex, 0, moved);
    return normalizeStepRowList(list);
  }

  /* ------------------------------------------------------------------ *
   * AI 批量补全（建议态）
   * ------------------------------------------------------------------ */

  /**
   * 把选中用例拼成给 `/api/generate-cases` 的上下文正文。
   * @param {Array<object>} cases 用例资产数组
   * @returns {string} 上下文文本
   */
  function buildAiCaseContext(cases) {
    const list = U.toArray(cases).map((raw) => normalizeCaseAsset(raw, { operator: D.OPERATOR }));
    const lines = [
      "以下是已有的测试用例清单，请为每一条补全「测试步骤」与「预期结果」。",
      "请严格按顺序输出同样数量的用例，title 必须与输入完全一致，不要新增或删除用例。",
      ""
    ];
    list.forEach((asset, index) => {
      lines.push(`【用例 ${index + 1}】`);
      lines.push(`标题：${asset.title}`);
      lines.push(`所属：${[asset.business, asset.product, asset.module, asset.category].filter(Boolean).join(" / ")}`);
      lines.push(`类型：${asset.type}　优先级：${asset.priority}`);
      lines.push(`测试目标：${asset.objective || "（未填写，请根据标题合理推断）"}`);
      lines.push(`前置条件：${asset.preconditions || "（未填写）"}`);
      lines.push(`现有步骤：${asset.steps || "（空）"}`);
      lines.push(`现有预期：${asset.expected || "（空）"}`);
      lines.push("");
    });
    return lines.join("\n");
  }

  /**
   * 把 AI 返回的用例数组对齐回本地用例，产出「建议」列表（**不落库**）。
   *
   * 对齐策略必须分两趟，顺序不可颠倒：
   *   第 1 趟：所有能按标题精确匹配的目标先认领各自的 AI 条目；
   *   第 2 趟：剩余目标再按下标顺序认领尚未被占用的条目。
   *
   * 之所以不能单趟处理：单趟时排在前面、本身没有标题匹配的目标，
   * 会先用「按下标兜底」抢走后面某个目标的精确匹配项，
   * 导致 AI 内容被错配到另一条用例上——用户一旦确认就会写坏数据。
   *
   * @param {Array<object>} cases 选中的本地用例
   * @param {Array<object>} aiCases `/api/generate-cases` 返回的 testCases
   * @returns {Array<object>} 建议数组（顺序与 cases 一致；accepted 恒为 false，需用户确认）
   */
  function buildAiSuggestions(cases, aiCases) {
    const targets = U.toArray(cases).map((raw) => normalizeCaseAsset(raw, { operator: D.OPERATOR }));
    const pool = U.toArray(aiCases).slice();

    /** 标题 → AI 条目下标（同名只认第一条） */
    const byTitle = new Map();
    pool.forEach((item, index) => {
      const title = U.str(item && item.title);
      if (title && !byTitle.has(title)) {
        byTitle.set(title, index);
      }
    });

    const used = new Set();
    /** 目标下标 → 命中的 AI 条目下标；-1 表示未命中 */
    const picked = new Array(targets.length).fill(-1);

    // 第 1 趟：标题精确匹配优先认领。
    targets.forEach((asset, index) => {
      const title = U.str(asset.title);
      if (!title || !byTitle.has(title)) {
        return;
      }
      const candidate = byTitle.get(title);
      if (used.has(candidate)) {
        return;
      }
      used.add(candidate);
      picked[index] = candidate;
    });

    // 第 2 趟：剩余目标按顺序领取尚未被占用的条目。
    let cursor = 0;
    targets.forEach((_asset, index) => {
      if (picked[index] >= 0) {
        return;
      }
      while (cursor < pool.length && used.has(cursor)) {
        cursor += 1;
      }
      if (cursor >= pool.length) {
        return;
      }
      used.add(cursor);
      picked[index] = cursor;
    });

    return targets.map((asset, index) => {
      const matchedIndex = picked[index];
      if (matchedIndex < 0 || !pool[matchedIndex]) {
        return {
          caseAssetId: asset.id,
          title: asset.title,
          matched: false,
          accepted: false,
          currentSteps: asset.steps,
          currentExpected: asset.expected,
          steps: "",
          expected: "",
          preconditions: "",
          reason: "AI 未返回与之对应的用例"
        };
      }
      const source = pool[matchedIndex] && typeof pool[matchedIndex] === "object" ? pool[matchedIndex] : {};
      const steps = Array.isArray(source.steps) ? source.steps.join("\n") : U.str(source.steps);
      return {
        caseAssetId: asset.id,
        title: asset.title,
        matched: true,
        accepted: false,
        currentSteps: asset.steps,
        currentExpected: asset.expected,
        steps,
        expected: U.str(source.expected),
        preconditions: Array.isArray(source.preconditions)
          ? source.preconditions.join("\n")
          : U.str(source.preconditions),
        reason: ""
      };
    });
  }

  /**
   * 把一条 AI 建议合并进用例资产（**仅在用户确认后调用**）。
   * @param {object} asset 原用例资产
   * @param {object} suggestion 建议对象
   * @param {{operator?:string, now?:string, fillOnly?:boolean}} [options] 选项；fillOnly=true 时只补空字段
   * @returns {object} 合并后的资产（全新对象，version 不变，由调用方决定是否 +1）
   */
  function mergeAiSuggestion(asset, suggestion, options) {
    const opts = options && typeof options === "object" ? options : {};
    const base = normalizeCaseAsset(asset, opts);
    const item = suggestion && typeof suggestion === "object" ? suggestion : {};
    const fillOnly = U.bool(opts.fillOnly, false);

    const patch = {};
    ["steps", "expected", "preconditions"].forEach((field) => {
      const value = U.str(item[field]);
      if (!value) {
        return;
      }
      if (fillOnly && U.str(base[field])) {
        return;
      }
      patch[field] = value;
    });

    if (!Object.keys(patch).length) {
      return base;
    }

    return normalizeCaseAsset(Object.assign({}, base, patch, {
      updatedBy: U.str(opts.operator, base.updatedBy),
      updatedAt: U.str(opts.now) || U.nowIso()
    }), opts);
  }

  /* T05_MODEL_BLOCK_END */


  /* ================================================================== *
   * 导出
   * ================================================================== */

  TCM.model = {
    // 单实体归一化
    normalizeCaseAsset,
    normalizeTestPlan,
    normalizeCaseExecution,
    normalizeReviewTicket,
    normalizeCaseDirectory,
    normalizeCaseVersion,
    // 集合级归一化
    normalizeCaseAssetList,
    normalizeTestPlanList,
    normalizeCaseExecutionList,
    normalizeReviewTicketList,
    normalizeCaseDirectoryList,
    normalizeCaseVersionList,
    // 别名：与 T03 任务书中的命名保持一致
    normalizeExecution: normalizeCaseExecution,
    normalizeExecutionList: normalizeCaseExecutionList,
    // 派生与计算
    buildDirectoryTree,
    directoryId,
    executionKey,
    applyFilters,
    computeMetrics,
    countBy,
    percent,
    validateImportRow,
    IMPORT_FIELD_ALIASES,
    IMPORT_TARGET_FIELDS,
    // T05 —— 导出
    EXPORT_COLUMNS,
    EXPORT_EXTRA_COLUMNS,
    buildExportRows,
    exportCellValue,
    toCsvText,
    parseCsvText,
    buildOpml,
    buildMarkdownOutline,
    // T05 —— 导入
    caseConflictKey,
    applyImportMapping,
    guessImportMapping,
    buildImportPlan,
    summarizeImportPlan,
    applyImportPlan,
    // T05 —— 版本快照 / diff / 回滚
    CASE_DIFF_FIELDS,
    createCaseVersion,
    appendCaseVersion,
    versionsOfCase,
    diffCaseSnapshots,
    rollbackCaseAsset,
    // T05 —— 结构化步骤
    AUTOMATION_STEP_LABELS,
    normalizeStepRowList,
    stepRowsFromAutomationSteps,
    stepRowsToPlainText,
    stepRowsToExpectedText,
    stepRowsFromPlainText,
    moveStepRow,
    // T05 —— AI 建议态
    buildAiCaseContext,
    buildAiSuggestions,
    mergeAiSuggestion,
    // 评审 / 看板 / 追溯（T04）
    concludeReview,
    deriveReviewVerdicts,
    reviewProgress,
    aggregateConclusion,
    normalizeVerdicts,
    collectRequirements,
    computeRequirementCoverage,
    plannedSlotCount,
    drillGroups,
    scopeByWindow,
    buildGraph,
    // 计划 ↔ 执行 派生（T03）
    planItemsForRound,
    executionsForRound,
    ensureExecutions,
    planProgress,
    planRoundCandidates,
    nextRoundNumber,
    deriveExecutionHistory,
    snapshotOfAsset
  };
})(typeof window !== "undefined" ? window : globalThis);
