/**
 * tcm-execution.js —— 测试用例管理模块 L3 视图层：测试执行台（T03）
 *
 * 职责（系统设计 §5.3 / §6.4 / §6.5）：
 *   1. 按「执行人 × 计划 × 轮次」组织执行清单，支持「我的 / 全部」两种作用域
 *   2. 惰性补齐执行实例：进入某计划某轮时按 (planId, round, caseAssetId) 唯一键补空档
 *   3. 标记执行结果（未执行 / 通过 / 失败 / 阻塞 / 跳过）+ 结果备注 + 执行人认领
 *   4. 失败一键建 Bug：写 state.bugs → 回填 execution.linkedDefectId → 追加资产 linkedDefects
 *   5. 证据上传：复用 POST /api/bug-images?bugId={executionId}
 *   6. 进度汇总：TCM.model.planProgress 派生（执行率 / 通过率），不落库
 *   7. 执行历史：TCM.model.deriveExecutionHistory 由 caseExecutions 实时派生，不写库
 *
 * 🔒 硬约束（PRD §6.5 / 系统设计 §6.5）：
 *   标记执行结果**严禁**修改 basicCaseLibrary 的任何业务字段与 updatedAt。
 *   本模块对 basicCaseLibrary 的**唯一**写入是「一键建 Bug 时向 linkedDefects 追加」，
 *   且必须通过 TCM.store 的 checkExecutionAssetGuard（source=execution）校验：
 *     - 条数不变、不新增/删除资产
 *     - linkedDefects 只能追加（旧数组是新数组的前缀）
 *     - 除 linkedDefects 外所有字段（含 updatedAt）JSON 全等
 *   任一条不满足，commit() 直接返回 false 并在控制台报错，写入不会落地。
 *
 * 模块契约：
 *   - IIFE + "use strict"，挂载 window.TCM.execution
 *   - 暴露 {mount, render, destroy}，render() 幂等
 *   - 事件委托只在 mount 时绑定一次
 *   - 所有用户输入渲染前必须 U.escapeHtml()
 *   - 跨模块通信只走 TCM.bus，不直接调用其它视图模块
 */
(function (global) {
  "use strict";

  const TCM = global.TCM = global.TCM || {};
  const C = TCM.const;
  const U = TCM.util;

  if (!C || !U || !TCM.bus || !TCM.store || !TCM.model) {
    throw new Error("[tcm-execution] 依赖缺失：请确保 tcm-core.js / tcm-store.js / tcm-model.js 在本文件之前加载。");
  }

  const S = TCM.store;
  const M = TCM.model;
  const doc = global.document || null;

  /* ------------------------------------------------------------------ *
   * 常量
   * ------------------------------------------------------------------ */

  /** 写入来源标识：store 依据它执行 basicCaseLibrary 写入守卫 */
  const SOURCE = "execution";

  /** 执行结果 → 色调 class */
  const STATUS_TONE = Object.freeze({
    "未执行": "tone-gray",
    "通过": "tone-green",
    "失败": "tone-red",
    "阻塞": "tone-orange",
    "跳过": "tone-blue"
  });

  /** 执行结果 → 按钮短标签 */
  const STATUS_ICON = Object.freeze({
    "未执行": "○",
    "通过": "✓",
    "失败": "✕",
    "阻塞": "▲",
    "跳过": "»"
  });

  /** 允许「一键建 Bug」的执行结果 */
  const BUG_TRIGGER_STATUS = Object.freeze(["失败", "阻塞"]);

  /** 视为「已执行」的结果（与 TCM.model.planProgress 口径一致） */
  const EXECUTED_STATUS = Object.freeze(["通过", "失败", "阻塞", "跳过"]);

  /** BUG 严重程度（与 index.html #bugModalSeverity 对齐） */
  const BUG_SEVERITY = Object.freeze(["严重", "中", "低"]);

  /** BUG 状态（与 index.html #bugModalStatus 对齐） */
  const BUG_STATUS = Object.freeze(["新建", "已提交", "已修复", "待回归", "已验证", "已关闭"]);

  /** 作用域选项 */
  const SCOPES = Object.freeze([
    { key: "mine", label: "我的执行" },
    { key: "all", label: "全部执行" }
  ]);

  /** 单次证据上传上限（张） */
  const MAX_EVIDENCE_PER_UPLOAD = 6;

  /* ------------------------------------------------------------------ *
   * 模块内可变状态（不落库，仅本次会话有效）
   * ------------------------------------------------------------------ */

  /** @type {HTMLElement|null} */
  let rootEl = null;
  /** 是否已挂载（DOM 事件委托只绑一次） */
  let mounted = false;
  /** 是否已订阅跨模块 bus 事件（与 DOM 挂载解耦，只订阅一次） */
  let busBound = false;
  /** 结果筛选：""=全部 */
  let statusFilter = "";
  /** 关键字筛选 */
  let keyword = "";
  /** 正在展开执行历史的用例资产 id */
  let historyAssetId = "";
  /** 一键建 Bug 弹窗态：{executionId, files:File[]} */
  let bugDialog = null;
  /** 异步操作中（上传 / 建单），期间禁用交互避免重复提交 */
  let busy = false;
  /** 顶部反馈：{text, tone} tone ∈ ok|warn|error|"" */
  let feedback = { text: "", tone: "" };
  /** 隐藏的证据文件选择器（mount 时创建一次） */
  let evidenceInput = null;
  /** 证据上传目标执行实例 id */
  let evidenceTargetId = "";

  /* ------------------------------------------------------------------ *
   * 一、状态读取（全部只读，写入一律走 TCM.store.commit）
   * ------------------------------------------------------------------ */

  /**
   * 获取宿主全局状态。
   * @returns {object} state 对象
   */
  function getState() {
    return S.getState();
  }

  /**
   * 触发本地偏好持久化（LOCAL_STATE_KEYS 走 app.js persist）。
   * @returns {void}
   */
  function persistLocal() {
    if (typeof global.persist === "function") {
      try {
        global.persist();
      } catch (error) {
        logError("持久化本地偏好失败", error);
      }
    }
  }

  /**
   * 统一错误输出。
   * @param {string} message 描述
   * @param {*} [error] 原始错误
   * @returns {void}
   */
  function logError(message, error) {
    if (global.console && typeof global.console.error === "function") {
      global.console.error(`[TCM.execution] ${message}`, error === undefined ? "" : error);
    }
  }

  /**
   * 测试计划集合（只读）。
   * @returns {Array<object>} testPlans
   */
  function plans() {
    return S.collection("testPlans");
  }

  /**
   * 执行实例集合（只读）。
   * @returns {Array<object>} caseExecutions
   */
  function executions() {
    return S.collection("caseExecutions");
  }

  /**
   * 用例资产集合（**只读**，本模块除追加 linkedDefects 外不得写入）。
   * @returns {Array<object>} basicCaseLibrary
   */
  function assets() {
    return S.collection("basicCaseLibrary");
  }

  /**
   * 宿主缺陷集合（只读；写入走 commit("bugs", ...)）。
   * @returns {Array<object>} bugs
   */
  function bugs() {
    return S.collection("bugs");
  }

  /**
   * 当前操作人。
   * @returns {string} 操作人名称
   */
  function operator() {
    return U.currentOperator(getState());
  }

  /**
   * 团队成员列表（来源 state.teamMembers，并入计划负责人与已有执行人）。
   * @returns {Array<string>} 去重后的成员名
   */
  function teamMembers() {
    const state = getState();
    const out = [];
    const seen = new Set();
    const push = (value) => {
      const name = U.str(value);
      if (!name || seen.has(name)) {
        return;
      }
      seen.add(name);
      out.push(name);
    };
    U.toArray(state.teamMembers).forEach(push);
    plans().forEach((plan) => push(plan && plan.owner));
    executions().forEach((row) => push(row && row.executor));
    push(operator());
    return out;
  }

  /**
   * 按 id 查找执行实例。
   * @param {string} executionId 执行实例 id
   * @returns {object|null} 执行实例
   */
  function findExecution(executionId) {
    const id = U.str(executionId);
    if (!id) {
      return null;
    }
    return executions().find((row) => U.str(row && row.id) === id) || null;
  }

  /**
   * 按 id 查找计划。
   * @param {string} planId 计划 id
   * @returns {object|null} 计划
   */
  function findPlan(planId) {
    const id = U.str(planId);
    if (!id) {
      return null;
    }
    return plans().find((plan) => U.str(plan && plan.id) === id) || null;
  }

  /**
   * 按 id 查找用例资产。
   * @param {string} caseAssetId 资产 id
   * @returns {object|null} 资产
   */
  function findAsset(caseAssetId) {
    const id = U.str(caseAssetId);
    if (!id) {
      return null;
    }
    return assets().find((item) => U.str(item && item.id) === id) || null;
  }

  /* ------------------------------------------------------------------ *
   * 二、视图偏好（tcmExecutionScope / tcmActivePlanId / tcmActiveRound）
   * ------------------------------------------------------------------ */

  /**
   * 当前作用域：mine（默认）或 all。
   * @returns {string} "mine" | "all"
   */
  function scope() {
    return U.str(getState().tcmExecutionScope) === "all" ? "all" : "mine";
  }

  /**
   * 切换作用域并持久化偏好。
   * @param {string} next 目标作用域
   * @returns {void}
   */
  function setScope(next) {
    const target = U.str(next) === "all" ? "all" : "mine";
    const state = getState();
    if (state.tcmExecutionScope === target) {
      return;
    }
    state.tcmExecutionScope = target;
    persistLocal();
    render();
  }

  /**
   * 可选计划列表：进行中优先，其次未开始 / 已完成，已归档置底。
   * @returns {Array<object>} 排序后的计划
   */
  function selectablePlans() {
    const weight = { "进行中": 0, "未开始": 1, "已完成": 2, "已归档": 3 };
    return plans().slice().sort((a, b) => {
      const wa = weight[U.str(a && a.status)] === undefined ? 9 : weight[U.str(a.status)];
      const wb = weight[U.str(b && b.status)] === undefined ? 9 : weight[U.str(b.status)];
      if (wa !== wb) {
        return wa - wb;
      }
      return String(U.str(b && b.updatedAt)).localeCompare(String(U.str(a && a.updatedAt)));
    });
  }

  /**
   * 当前激活的计划（偏好失效时回退到第一个可选计划）。
   * @returns {object|null} 计划对象
   */
  function activePlan() {
    const list = selectablePlans();
    if (!list.length) {
      return null;
    }
    const preferred = U.str(getState().tcmActivePlanId);
    return list.find((plan) => U.str(plan.id) === preferred) || list[0];
  }

  /**
   * 切换激活计划（同步复位轮次为该计划的当前轮）。
   * @param {string} planId 计划 id
   * @returns {void}
   */
  function setActivePlan(planId) {
    const plan = findPlan(planId);
    const state = getState();
    state.tcmActivePlanId = plan ? U.str(plan.id) : "";
    state.tcmActiveRound = plan ? U.num(plan.currentRound, 1, 1) : 1;
    persistLocal();
    render();
  }

  /**
   * 当前激活轮次（越界时回退到计划的 currentRound）。
   * @param {object|null} plan 计划对象
   * @returns {number} 轮次号
   */
  function activeRound(plan) {
    if (!plan) {
      return 1;
    }
    const rounds = U.toArray(plan.rounds).map((round) => U.num(round && round.round, 1, 1));
    const preferred = U.num(getState().tcmActiveRound, 0, 0);
    if (preferred && rounds.includes(preferred)) {
      return preferred;
    }
    const current = U.num(plan.currentRound, 1, 1);
    return rounds.includes(current) ? current : (rounds[0] || 1);
  }

  /**
   * 切换激活轮次。
   * @param {number} round 轮次号
   * @returns {void}
   */
  function setActiveRound(round) {
    getState().tcmActiveRound = U.num(round, 1, 1);
    persistLocal();
    render();
  }

  /* ------------------------------------------------------------------ *
   * 三、执行实例惰性补齐与查询
   * ------------------------------------------------------------------ */

  /**
   * 惰性补齐某计划某轮缺失的执行实例。
   *
   * 仅在真实产生新实例时才 commit，避免每次 render 触发无意义 persist。
   * 已存在的实例**不会**被重置（`ensureExecutions` 只补空档）。
   *
   * @param {string} planId 计划 id
   * @param {number} round 轮次号
   * @returns {boolean} 是否发生了写入
   */
  function ensureRound(planId, round) {
    const id = U.str(planId);
    if (!id) {
      return false;
    }
    let result = null;
    try {
      result = M.ensureExecutions(id, round, {
        plans: plans(),
        executions: executions(),
        assets: assets()
      });
    } catch (error) {
      logError("补齐执行实例失败", error);
      return false;
    }
    if (!result || !result.changed) {
      return false;
    }
    return S.commit("caseExecutions", result.executions, {
      source: SOURCE,
      reason: "ensureExecutions"
    });
  }

  /**
   * 计算某计划某轮在当前作用域 + 筛选条件下应展示的执行行。
   *
   * 作用域 mine：执行人 == 当前操作人，或尚未指派（未指派项属于「待认领」，一并展示）。
   *
   * @param {object} plan 计划
   * @param {number} round 轮次号
   * @returns {Array<object>} 执行实例数组（按计划条目顺序）
   */
  function visibleRows(plan, round) {
    const all = M.executionsForRound(executions(), plan.id, round);
    const me = operator();
    const orderMap = new Map();
    M.planItemsForRound(plan, round).forEach((item, index) => {
      orderMap.set(U.str(item.caseAssetId), index);
    });

    const scoped = scope() === "all"
      ? all.slice()
      : all.filter((row) => {
        const executor = U.str(row.executor);
        return !executor || executor === me;
      });

    const filtered = scoped.filter((row) => {
      if (statusFilter && U.str(row.status) !== statusFilter) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      const snapshot = row.caseSnapshot && typeof row.caseSnapshot === "object" ? row.caseSnapshot : {};
      const haystack = [
        U.str(snapshot.title),
        U.str(snapshot.module),
        U.str(snapshot.business),
        U.str(row.caseAssetId),
        U.str(row.executor),
        U.str(row.resultNote)
      ].join(" ").toLowerCase();
      return haystack.includes(keyword.toLowerCase());
    });

    return filtered.sort((a, b) => {
      const oa = orderMap.has(U.str(a.caseAssetId)) ? orderMap.get(U.str(a.caseAssetId)) : 9999;
      const ob = orderMap.has(U.str(b.caseAssetId)) ? orderMap.get(U.str(b.caseAssetId)) : 9999;
      if (oa !== ob) {
        return oa - ob;
      }
      return String(U.str(a.id)).localeCompare(String(U.str(b.id)));
    });
  }

  /**
   * 我的待办统计（跨全部计划，用于顶部提示）。
   * @returns {{pending:number, plans:number}} 待办条数与涉及计划数
   */
  function myPendingSummary() {
    const me = operator();
    const planIds = new Set();
    let pending = 0;
    executions().forEach((row) => {
      if (U.str(row.status) !== C.DEFAULTS.EXEC_STATUS) {
        return;
      }
      const executor = U.str(row.executor);
      if (executor && executor !== me) {
        return;
      }
      pending += 1;
      planIds.add(U.str(row.planId));
    });
    return { pending, plans: planIds.size };
  }

  /* ------------------------------------------------------------------ *
   * 四、HTML 片段构造（用户输入一律 escapeHtml）
   * ------------------------------------------------------------------ */

  /**
   * 进度条。
   * @param {object} progress TCM.model.planProgress 结果
   * @returns {string} HTML
   */
  function progressBarHtml(progress) {
    const total = U.num(progress.total, 0, 0) || 1;
    const seg = (count, cls) => {
      const width = (U.num(count, 0, 0) / total) * 100;
      if (width <= 0) {
        return "";
      }
      return `<span class="tcm-progress-seg ${cls}" style="width:${width.toFixed(2)}%"></span>`;
    };
    const byStatus = progress.byStatus && typeof progress.byStatus === "object" ? progress.byStatus : {};
    return `
      <div class="tcm-progress" role="img" aria-label="执行进度 ${U.escapeHtml(String(progress.executeRate))}%">
        ${seg(byStatus["通过"], "is-pass")}
        ${seg(byStatus["失败"], "is-fail")}
        ${seg(byStatus["阻塞"], "is-block")}
        ${seg(byStatus["跳过"], "is-skip")}
      </div>`;
  }

  /**
   * 进度统计芯片组。
   * @param {object} progress 进度对象
   * @returns {string} HTML
   */
  function statChipsHtml(progress) {
    const byStatus = progress.byStatus && typeof progress.byStatus === "object" ? progress.byStatus : {};
    const chips = [
      { label: "总数", value: progress.total, tone: "tone-gray" },
      { label: "已执行", value: progress.executed, tone: "tone-blue" },
      { label: "通过", value: byStatus["通过"] || 0, tone: "tone-green" },
      { label: "失败", value: byStatus["失败"] || 0, tone: "tone-red" },
      { label: "阻塞", value: byStatus["阻塞"] || 0, tone: "tone-orange" },
      { label: "跳过", value: byStatus["跳过"] || 0, tone: "tone-blue" },
      { label: "未执行", value: byStatus["未执行"] || 0, tone: "tone-gray" }
    ];
    return `
      <div class="tcm-stat-chips">
        ${chips.map((chip) => `
          <span class="tcm-stat-chip ${chip.tone}">
            <b>${U.escapeHtml(String(U.num(chip.value, 0, 0)))}</b>${U.escapeHtml(chip.label)}
          </span>`).join("")}
        <span class="tcm-stat-chip tone-blue"><b>${U.escapeHtml(String(progress.executeRate))}%</b>执行率</span>
        <span class="tcm-stat-chip tone-green"><b>${U.escapeHtml(String(progress.passRate))}%</b>通过率</span>
      </div>`;
  }

  /**
   * 顶部工具条（作用域 / 计划 / 轮次 / 搜索）。
   * @param {object|null} plan 当前计划
   * @param {number} round 当前轮次
   * @returns {string} HTML
   */
  function toolbarHtml(plan, round) {
    const planOptions = selectablePlans().map((item) => {
      const selected = plan && U.str(item.id) === U.str(plan.id) ? " selected" : "";
      const label = `${U.str(item.name, "未命名测试计划")}（${U.str(item.status)}）`;
      return `<option value="${U.escapeHtml(item.id)}"${selected}>${U.escapeHtml(label)}</option>`;
    }).join("");

    const roundOptions = plan
      ? U.toArray(plan.rounds).map((item) => {
        const no = U.num(item && item.round, 1, 1);
        const selected = no === round ? " selected" : "";
        const name = U.str(item && item.name) || `第 ${no} 轮`;
        return `<option value="${U.escapeHtml(String(no))}"${selected}>${U.escapeHtml(`第 ${no} 轮 · ${name}`)}</option>`;
      }).join("")
      : "";

    const summary = myPendingSummary();

    return `
      <div class="tcm-exec-toolbar">
        <div class="tcm-exec-scope" role="group" aria-label="执行作用域">
          ${SCOPES.map((item) => `
            <button type="button"
                    class="tcm-scope-btn${scope() === item.key ? " is-active" : ""}"
                    data-tcm-exec-scope="${U.escapeHtml(item.key)}"
                    aria-pressed="${scope() === item.key ? "true" : "false"}">${U.escapeHtml(item.label)}</button>`).join("")}
        </div>
        <label class="tcm-exec-field">
          <span>计划</span>
          <select data-tcm-exec-plan aria-label="选择测试计划">
            ${planOptions || `<option value="">暂无测试计划</option>`}
          </select>
        </label>
        <label class="tcm-exec-field">
          <span>轮次</span>
          <select data-tcm-exec-round aria-label="选择执行轮次"${plan ? "" : " disabled"}>
            ${roundOptions || `<option value="1">第 1 轮</option>`}
          </select>
        </label>
        <label class="tcm-exec-field tcm-exec-field-grow">
          <span>搜索</span>
          <input type="search"
                 data-tcm-exec-keyword
                 data-tcm-focus-key="keyword"
                 value="${U.escapeHtml(keyword)}"
                 placeholder="用例标题 / 模块 / 执行人 / 备注">
        </label>
        <span class="tcm-exec-mine-tip" title="全部计划中指派给我或尚未指派的未执行条目">
          我的待办 <b>${U.escapeHtml(String(summary.pending))}</b> 条 / ${U.escapeHtml(String(summary.plans))} 个计划
        </span>
      </div>`;
  }

  /**
   * 结果筛选芯片。
   * @returns {string} HTML
   */
  function filterChipsHtml() {
    const options = [{ key: "", label: "全部" }].concat(
      C.EXEC_STATUS.map((status) => ({ key: status, label: status }))
    );
    return `
      <div class="tcm-exec-filters" role="group" aria-label="按执行结果筛选">
        ${options.map((item) => `
          <button type="button"
                  class="tcm-filter-chip${statusFilter === item.key ? " is-active" : ""}"
                  data-tcm-exec-filter="${U.escapeHtml(item.key)}"
                  aria-pressed="${statusFilter === item.key ? "true" : "false"}">${U.escapeHtml(item.label)}</button>`).join("")}
      </div>`;
  }

  /**
   * 单条执行行的结果按钮组。
   * @param {object} row 执行实例
   * @returns {string} HTML
   */
  function statusButtonsHtml(row) {
    return `
      <div class="tcm-exec-marks" role="group" aria-label="标记执行结果">
        ${C.EXEC_STATUS.map((status) => {
      const isActive = U.str(row.status) === status;
      const tone = STATUS_TONE[status] || "tone-gray";
      return `<button type="button"
                        class="tcm-mark-btn ${tone}${isActive ? " is-active" : ""}"
                        data-tcm-exec-mark="${U.escapeHtml(row.id)}"
                        data-tcm-status="${U.escapeHtml(status)}"
                        title="${U.escapeHtml(`标记为${status}`)}"
                        aria-pressed="${isActive ? "true" : "false"}"
                        ${busy ? "disabled" : ""}>
                  <span class="tcm-mark-icon">${U.escapeHtml(STATUS_ICON[status] || "")}</span>${U.escapeHtml(status)}
                </button>`;
    }).join("")}
      </div>`;
  }

  /**
   * 证据缩略图 + 上传按钮。
   * @param {object} row 执行实例
   * @returns {string} HTML
   */
  function evidenceHtml(row) {
    const list = U.toArray(row.evidence);
    const thumbs = list.map((item) => {
      const url = U.str(item.url);
      const name = U.str(item.name) || "证据";
      if (U.str(item.kind) === "image" && url) {
        return `
          <span class="tcm-evidence-thumb">
            <a href="${U.escapeHtml(url)}" target="_blank" rel="noopener" title="${U.escapeHtml(name)}">
              <img src="${U.escapeHtml(url)}" alt="${U.escapeHtml(name)}" loading="lazy">
            </a>
            <button type="button"
                    class="tcm-evidence-del"
                    data-tcm-exec-evidence-del="${U.escapeHtml(row.id)}"
                    data-tcm-evidence-id="${U.escapeHtml(item.id)}"
                    title="移除该证据引用"
                    ${busy ? "disabled" : ""}>×</button>
          </span>`;
      }
      return `
        <span class="tcm-evidence-thumb is-link">
          <a href="${U.escapeHtml(url || "#")}" target="_blank" rel="noopener">${U.escapeHtml(name)}</a>
          <button type="button"
                  class="tcm-evidence-del"
                  data-tcm-exec-evidence-del="${U.escapeHtml(row.id)}"
                  data-tcm-evidence-id="${U.escapeHtml(item.id)}"
                  title="移除该证据引用"
                  ${busy ? "disabled" : ""}>×</button>
        </span>`;
    }).join("");

    return `
      <div class="tcm-evidence-cell">
        ${thumbs}
        <button type="button"
                class="tcm-evidence-add"
                data-tcm-exec-evidence="${U.escapeHtml(row.id)}"
                title="上传执行证据（图片）"
                ${busy ? "disabled" : ""}>+ 证据</button>
      </div>`;
  }

  /**
   * 缺陷单元格：已关联展示徽标，失败/阻塞未关联展示一键建 Bug。
   * @param {object} row 执行实例
   * @returns {string} HTML
   */
  function defectHtml(row) {
    const defectId = U.str(row.linkedDefectId);
    if (defectId) {
      const bug = bugs().find((item) => U.str(item && item.id) === defectId);
      const title = bug ? U.str(bug.title, defectId) : defectId;
      const severity = bug ? U.str(bug.severity) : "";
      return `
        <span class="tcm-defect-badge tone-red" title="${U.escapeHtml(`${title}（${defectId}）`)}">
          🐞 ${U.escapeHtml(title.length > 14 ? `${title.slice(0, 14)}…` : title)}${severity ? `<i>${U.escapeHtml(severity)}</i>` : ""}
        </span>`;
    }
    if (BUG_TRIGGER_STATUS.includes(U.str(row.status))) {
      return `
        <button type="button"
                class="tcm-bug-btn"
                data-tcm-exec-bug="${U.escapeHtml(row.id)}"
                title="根据本条执行结果一键创建缺陷"
                ${busy ? "disabled" : ""}>一键建 Bug</button>`;
    }
    return `<span class="tcm-badge-muted">—</span>`;
  }

  /**
   * 单条执行行。
   * @param {object} row 执行实例
   * @returns {string} HTML
   */
  function rowHtml(row) {
    const snapshot = row.caseSnapshot && typeof row.caseSnapshot === "object" ? row.caseSnapshot : {};
    const asset = findAsset(row.caseAssetId);
    const title = U.str(snapshot.title) || (asset ? U.str(asset.title, "未命名用例") : "（用例已删除）");
    const meta = [
      U.str(snapshot.business),
      U.str(snapshot.product),
      U.str(snapshot.module),
      U.str(snapshot.type)
    ].filter(Boolean).join(" · ");
    const priority = U.str(snapshot.priority) || "P1";
    const tone = STATUS_TONE[U.str(row.status)] || "tone-gray";
    const executor = U.str(row.executor);
    const isMine = executor && executor === operator();

    return `
      <tr class="tcm-exec-row ${tone}${U.str(row.status) === C.DEFAULTS.EXEC_STATUS ? "" : " is-executed"}"
          data-tcm-exec-row="${U.escapeHtml(row.id)}">
        <td class="tcm-exec-case">
          <div class="tcm-exec-title">
            <span class="tcm-priority ${U.escapeHtml(priority.toLowerCase())}">${U.escapeHtml(priority)}</span>
            ${U.escapeHtml(title)}
            ${asset ? "" : `<span class="tcm-badge-muted" title="用例资产已被删除，执行历史保留">已失效</span>`}
          </div>
          <div class="tcm-exec-meta">${U.escapeHtml(meta || "—")}<code>${U.escapeHtml(U.str(row.caseAssetId))}</code></div>
        </td>
        <td class="tcm-exec-executor-cell">
          <input type="text"
                 class="tcm-exec-executor"
                 data-tcm-exec-executor="${U.escapeHtml(row.id)}"
                 data-tcm-focus-key="executor:${U.escapeHtml(row.id)}"
                 list="tcmExecMemberOptions"
                 value="${U.escapeHtml(executor)}"
                 placeholder="未指派"
                 ${busy ? "disabled" : ""}>
          ${isMine ? "" : `<button type="button"
                  class="tcm-claim-btn"
                  data-tcm-exec-claim="${U.escapeHtml(row.id)}"
                  title="把这条指派给自己"
                  ${busy ? "disabled" : ""}>认领</button>`}
        </td>
        <td class="tcm-exec-mark-cell">${statusButtonsHtml(row)}</td>
        <td class="tcm-exec-note-cell">
          <input type="text"
                 class="tcm-exec-note"
                 data-tcm-exec-note="${U.escapeHtml(row.id)}"
                 data-tcm-focus-key="note:${U.escapeHtml(row.id)}"
                 value="${U.escapeHtml(U.str(row.resultNote))}"
                 placeholder="结果备注（失焦保存）"
                 ${busy ? "disabled" : ""}>
          <div class="tcm-exec-stamp">${U.escapeHtml(formatStamp(row))}</div>
        </td>
        <td class="tcm-exec-evidence-cell">${evidenceHtml(row)}</td>
        <td class="tcm-exec-defect-cell">${defectHtml(row)}</td>
        <td class="tcm-exec-history-cell">
          <button type="button"
                  class="tcm-link-btn"
                  data-tcm-exec-history="${U.escapeHtml(U.str(row.caseAssetId))}">历史</button>
        </td>
      </tr>`;
  }

  /**
   * 生成执行时间说明文本。
   * @param {object} row 执行实例
   * @returns {string} 文本
   */
  function formatStamp(row) {
    const finished = U.str(row.finishedAt);
    const started = U.str(row.startedAt);
    if (finished) {
      return `完成于 ${finished.slice(0, 19).replace("T", " ")}`;
    }
    if (started) {
      return `开始于 ${started.slice(0, 19).replace("T", " ")}`;
    }
    return "尚未开始";
  }

  /**
   * 执行历史抽屉（由 caseExecutions 实时派生，不落库）。
   * @returns {string} HTML
   */
  function historyHtml() {
    if (!historyAssetId) {
      return "";
    }
    const asset = findAsset(historyAssetId);
    const rows = M.deriveExecutionHistory(historyAssetId, executions(), plans());
    const title = asset ? U.str(asset.title, "未命名用例") : historyAssetId;

    const body = rows.length
      ? rows.map((item) => `
          <tr>
            <td>${U.escapeHtml(U.str(item.date) || "—")}</td>
            <td>${U.escapeHtml(U.str(item.planName) || U.str(item.planId) || "—")}</td>
            <td>第 ${U.escapeHtml(String(item.round))} 轮</td>
            <td>${U.escapeHtml(U.str(item.executor))}</td>
            <td><span class="tcm-badge ${STATUS_TONE[item.result] || "tone-gray"}">${U.escapeHtml(item.result)}</span></td>
            <td>${U.escapeHtml(U.str(item.note) || "—")}</td>
            <td>${item.linkedDefectId ? `<code>${U.escapeHtml(item.linkedDefectId)}</code>` : "—"}</td>
            <td>${U.escapeHtml(String(item.evidenceCount))}</td>
          </tr>`).join("")
      : `<tr><td colspan="8" class="tcm-empty-cell">该用例还没有已完成的执行记录。</td></tr>`;

    return `
      <div class="tcm-exec-history">
        <div class="tcm-exec-history-head">
          <h4>执行历史 · ${U.escapeHtml(title)}</h4>
          <button type="button" class="tcm-link-btn" data-tcm-exec-history-close>收起</button>
        </div>
        <div class="tcm-exec-history-body">
          <table class="tcm-table tcm-history-table">
            <thead>
              <tr><th>日期</th><th>计划</th><th>轮次</th><th>执行人</th><th>结果</th><th>备注</th><th>缺陷</th><th>证据</th></tr>
            </thead>
            <tbody>${body}</tbody>
          </table>
        </div>
        <p class="tcm-hint">执行历史由 <code>caseExecutions</code> 实时派生（系统设计 §8.3），不写入用例资产。</p>
      </div>`;
  }

  /**
   * 一键建 Bug 弹窗。
   * @returns {string} HTML
   */
  function bugDialogHtml() {
    if (!bugDialog) {
      return "";
    }
    const row = findExecution(bugDialog.executionId);
    if (!row) {
      return "";
    }
    const plan = findPlan(row.planId);
    const snapshot = row.caseSnapshot && typeof row.caseSnapshot === "object" ? row.caseSnapshot : {};
    const asset = findAsset(row.caseAssetId);
    const caseTitle = U.str(snapshot.title) || (asset ? U.str(asset.title, "未命名用例") : U.str(row.caseAssetId));
    const planName = plan ? U.str(plan.name, "未命名测试计划") : U.str(row.planId);
    const defaultTitle = `[${planName} 第${U.num(row.round, 1, 1)}轮] ${caseTitle} 执行${U.str(row.status)}`;
    const defaultNote = buildBugNote(row, asset, plan);
    const fileNames = U.toArray(bugDialog.files).map((file) => U.str(file && file.name) || "证据截图");

    return `
      <div class="tcm-modal-backdrop" data-tcm-bug-cancel>
        <div class="tcm-modal tcm-bug-modal" role="dialog" aria-modal="true" aria-label="一键创建缺陷">
          <div class="tcm-modal-head">
            <h3>一键建 Bug</h3>
            <button type="button" class="tcm-modal-close" data-tcm-bug-cancel aria-label="关闭">×</button>
          </div>
          <div class="tcm-modal-body">
            <label class="tcm-form-row">
              <span>缺陷标题<i>*</i></span>
              <input type="text" data-tcm-bug-field="title" value="${U.escapeHtml(defaultTitle)}" maxlength="200">
            </label>
            <div class="tcm-form-grid">
              <label class="tcm-form-row">
                <span>严重程度</span>
                <select data-tcm-bug-field="severity">
                  ${BUG_SEVERITY.map((item) => `<option value="${U.escapeHtml(item)}"${item === "中" ? " selected" : ""}>${U.escapeHtml(item)}</option>`).join("")}
                </select>
              </label>
              <label class="tcm-form-row">
                <span>缺陷状态</span>
                <select data-tcm-bug-field="status">
                  ${BUG_STATUS.map((item) => `<option value="${U.escapeHtml(item)}"${item === "新建" ? " selected" : ""}>${U.escapeHtml(item)}</option>`).join("")}
                </select>
              </label>
              <label class="tcm-form-row">
                <span>负责人</span>
                <input type="text" data-tcm-bug-field="owner" list="tcmExecMemberOptions" value="${U.escapeHtml(U.str(row.executor) || operator())}">
              </label>
              <label class="tcm-form-row">
                <span>外部链接</span>
                <input type="text" data-tcm-bug-field="link" placeholder="缺陷系统链接（可选）">
              </label>
            </div>
            <label class="tcm-form-row">
              <span>缺陷描述</span>
              <textarea data-tcm-bug-field="note" rows="7">${U.escapeHtml(defaultNote)}</textarea>
            </label>
            <div class="tcm-form-row">
              <span>证据截图</span>
              <div class="tcm-bug-files">
                <input type="file" data-tcm-bug-files accept="image/*" multiple>
                <span class="tcm-bug-files-label" data-tcm-bug-files-label>${
  fileNames.length ? U.escapeHtml(`已选 ${fileNames.length} 张：${fileNames.join("、")}`) : "未选择文件"
}</span>
              </div>
            </div>
            <p class="tcm-hint">
              提交后：写入 <code>state.bugs</code> → 回填 <code>execution.linkedDefectId</code> →
              向用例资产 <code>linkedDefects</code> <b>追加</b>（§6.5 唯一例外，不改任何业务字段与 updatedAt）。
              证据上传至 <code>/api/bug-images?bugId=${U.escapeHtml(row.id)}</code>。
            </p>
          </div>
          <div class="tcm-modal-foot">
            <button type="button" class="tcm-btn ghost" data-tcm-bug-cancel ${busy ? "disabled" : ""}>取消</button>
            <button type="button" class="tcm-btn primary" data-tcm-bug-submit ${busy ? "disabled" : ""}>
              ${busy ? "提交中…" : "创建缺陷"}
            </button>
          </div>
        </div>
      </div>`;
  }

  /**
   * 构造缺陷描述默认文案。
   * @param {object} row 执行实例
   * @param {object|null} asset 用例资产
   * @param {object|null} plan 计划
   * @returns {string} 描述文本
   */
  function buildBugNote(row, asset, plan) {
    const snapshot = row.caseSnapshot && typeof row.caseSnapshot === "object" ? row.caseSnapshot : {};
    const steps = asset
      ? U.toArray(asset.steps).map((step, index) => {
        const action = U.str(step && step.action);
        const expected = U.str(step && step.expected);
        return `  ${index + 1}. ${action}${expected ? ` → 预期：${expected}` : ""}`;
      }).join("\n")
      : "";
    return [
      `【测试计划】${plan ? U.str(plan.name, "未命名测试计划") : U.str(row.planId)}（第 ${U.num(row.round, 1, 1)} 轮）`,
      `【用例】${U.str(snapshot.title) || (asset ? U.str(asset.title) : "")}（${U.str(row.caseAssetId)}）`,
      `【业务/模块】${[U.str(snapshot.business), U.str(snapshot.module)].filter(Boolean).join(" / ") || "—"}`,
      `【执行人】${U.str(row.executor) || operator()}`,
      `【执行结果】${U.str(row.status)}`,
      asset && U.str(asset.preconditions) ? `【前置条件】${U.str(asset.preconditions)}` : "",
      steps ? `【复现步骤】\n${steps}` : "",
      asset && U.str(asset.expectedResult) ? `【预期结果】${U.str(asset.expectedResult)}` : "",
      U.str(row.resultNote) ? `【实际结果】${U.str(row.resultNote)}` : "【实际结果】（待补充）"
    ].filter(Boolean).join("\n");
  }

  /**
   * 空状态。
   * @param {string} title 标题
   * @param {string} desc 描述
   * @returns {string} HTML
   */
  function emptyHtml(title, desc) {
    return `
      <div class="tcm-empty">
        <div class="tcm-empty-icon">▶</div>
        <h3>${U.escapeHtml(title)}</h3>
        <p>${U.escapeHtml(desc)}</p>
      </div>`;
  }

  /**
   * 反馈条。
   * @returns {string} HTML
   */
  function feedbackHtml() {
    if (!feedback.text) {
      return "";
    }
    return `<div class="tcm-feedback ${U.escapeHtml(feedback.tone || "")}" role="status">${U.escapeHtml(feedback.text)}</div>`;
  }

  /**
   * 成员数据源（供 executor / owner 输入框补全）。
   * @returns {string} HTML
   */
  function memberDatalistHtml() {
    return `
      <datalist id="tcmExecMemberOptions">
        ${teamMembers().map((name) => `<option value="${U.escapeHtml(name)}"></option>`).join("")}
      </datalist>`;
  }

  /* ------------------------------------------------------------------ *
   * 五、渲染（幂等）
   * ------------------------------------------------------------------ */

  /**
   * 捕获当前焦点，供重渲染后恢复。
   * @returns {{key:string, start:number, end:number}|null} 焦点快照
   */
  function captureFocus() {
    if (!doc || !rootEl) {
      return null;
    }
    const active = doc.activeElement;
    if (!active || !rootEl.contains(active)) {
      return null;
    }
    const key = active.getAttribute ? active.getAttribute("data-tcm-focus-key") : "";
    if (!key) {
      return null;
    }
    let start = 0;
    let end = 0;
    try {
      start = Number(active.selectionStart) || 0;
      end = Number(active.selectionEnd) || 0;
    } catch (_error) {
      start = 0;
      end = 0;
    }
    return { key, start, end };
  }

  /**
   * 恢复焦点。
   * @param {{key:string, start:number, end:number}|null} snapshot 焦点快照
   * @returns {void}
   */
  function restoreFocus(snapshot) {
    if (!snapshot || !rootEl) {
      return;
    }
    const target = rootEl.querySelector(`[data-tcm-focus-key="${snapshot.key.replace(/"/g, "\\\"")}"]`);
    if (!target || typeof target.focus !== "function") {
      return;
    }
    target.focus();
    try {
      if (typeof target.setSelectionRange === "function") {
        target.setSelectionRange(snapshot.start, snapshot.end);
      }
    } catch (_error) {
      // 部分 input 类型不支持 setSelectionRange，忽略
    }
  }

  /**
   * 渲染执行台（幂等，可反复调用）。
   * @returns {void}
   */
  function render() {
    if (!doc) {
      return;
    }
    if (!rootEl) {
      rootEl = doc.getElementById("tcmExecutionView");
    }
    if (!rootEl) {
      return;
    }

    const focusSnapshot = captureFocus();
    const plan = activePlan();

    if (!plan) {
      rootEl.innerHTML = `
        <section class="tcm-execution">
          ${feedbackHtml()}
          ${emptyHtml("还没有测试计划", "请先到「测试计划」子 Tab 新建计划并从用例库加入用例，执行台会自动生成待执行清单。")}
        </section>`;
      rootEl.dataset.tcmRendered = "1";
      return;
    }

    const round = activeRound(plan);
    // 惰性补齐：只有真正新增实例时才落库
    ensureRound(plan.id, round);

    const progress = M.planProgress(plan.id, round, {
      plans: plans(),
      executions: executions()
    });
    const rows = visibleRows(plan, round);
    const roundMeta = U.toArray(plan.rounds).find((item) => U.num(item && item.round, 1, 1) === round) || null;

    const tableBody = rows.length
      ? rows.map(rowHtml).join("")
      : `<tr><td colspan="7" class="tcm-empty-cell">${U.escapeHtml(
        scope() === "mine"
          ? "本轮没有指派给你（或待认领）的用例，切换到「全部执行」查看其他人的进度。"
          : "本轮暂无用例，请到「测试计划」为该轮次加入用例。"
      )}</td></tr>`;

    rootEl.innerHTML = `
      <section class="tcm-execution">
        ${feedbackHtml()}
        <header class="tcm-exec-header">
          <div class="tcm-exec-headline">
            <h3>${U.escapeHtml(U.str(plan.name, "未命名测试计划"))}</h3>
            <span class="tcm-badge ${U.str(plan.status) === "进行中" ? "tone-green" : "tone-gray"}">${U.escapeHtml(U.str(plan.status))}</span>
            <span class="tcm-badge tone-blue">第 ${U.escapeHtml(String(round))} 轮${roundMeta && U.str(roundMeta.name) ? ` · ${U.escapeHtml(U.str(roundMeta.name))}` : ""}</span>
            ${roundMeta ? `<span class="tcm-badge ${U.str(roundMeta.status) === "已完成" ? "tone-green" : "tone-gray"}">${U.escapeHtml(U.str(roundMeta.status))}</span>` : ""}
          </div>
          ${progressBarHtml(progress)}
          ${statChipsHtml(progress)}
        </header>
        ${toolbarHtml(plan, round)}
        ${filterChipsHtml()}
        <div class="tcm-exec-table-wrap">
          <table class="tcm-table tcm-exec-table">
            <thead>
              <tr>
                <th class="col-case">用例</th>
                <th class="col-executor">执行人</th>
                <th class="col-mark">执行结果</th>
                <th class="col-note">备注 / 时间</th>
                <th class="col-evidence">证据</th>
                <th class="col-defect">缺陷</th>
                <th class="col-history">历史</th>
              </tr>
            </thead>
            <tbody>${tableBody}</tbody>
          </table>
        </div>
        ${historyHtml()}
        <p class="tcm-hint">
          🔒 标记执行结果只写 <code>caseExecutions</code>，不会修改用例资产的任何业务字段与 <code>updatedAt</code>（PRD §6.5）。
        </p>
        ${memberDatalistHtml()}
        ${bugDialogHtml()}
      </section>`;

    rootEl.dataset.tcmRendered = "1";
    restoreFocus(focusSnapshot);
  }

  /**
   * 仅在执行台可见时重渲染（避免后台无谓开销）。
   * @returns {void}
   */
  function renderIfVisible() {
    if (!rootEl || !rootEl.classList || !rootEl.classList.contains("is-active")) {
      return;
    }
    render();
  }

  /**
   * 设置顶部反馈并重渲染。
   * @param {string} text 文本
   * @param {string} [tone] ok|warn|error
   * @returns {void}
   */
  function setFeedback(text, tone) {
    feedback = { text: U.str(text), tone: U.str(tone) };
    if (typeof global.showToast === "function" && feedback.text) {
      try {
        global.showToast(feedback.text, tone === "error" || tone === "warn" ? "warn" : "ok");
      } catch (_error) {
        // showToast 不可用时静默降级为页面内反馈
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * 六、写操作：全部通过 TCM.store.commit
   * ------------------------------------------------------------------ */

  /**
   * 就地更新一条执行实例并提交。
   *
   * ⚠️ 本函数只写 caseExecutions，**绝不**触碰 basicCaseLibrary。
   *
   * @param {string} executionId 执行实例 id
   * @param {Function} mutator 接收克隆后的执行实例，就地修改
   * @param {string} [reason] 写入原因
   * @returns {object|null} 更新后的执行实例
   */
  function updateExecution(executionId, mutator, reason) {
    const id = U.str(executionId);
    const current = executions();
    const index = current.findIndex((row) => U.str(row && row.id) === id);
    if (index < 0) {
      return null;
    }
    const next = current.map((row) => U.clone(row));
    mutator(next[index]);
    next[index].updatedAt = U.nowIso();
    const ok = S.commit("caseExecutions", next, { source: SOURCE, reason: U.str(reason) || "updateExecution" });
    if (!ok) {
      setFeedback("执行记录写入被拒绝，请查看控制台日志。", "error");
      return null;
    }
    return findExecution(id);
  }

  /**
   * 标记执行结果。
   * @param {string} executionId 执行实例 id
   * @param {string} status 目标结果
   * @returns {void}
   */
  function markResult(executionId, status) {
    const target = U.oneOf(status, C.EXEC_STATUS, C.DEFAULTS.EXEC_STATUS);
    const row = findExecution(executionId);
    if (!row) {
      return;
    }
    const from = U.str(row.status);
    const allowed = C.EXEC_STATUS_TRANSITIONS[from] || [];
    if (from === target) {
      return;
    }
    if (!allowed.includes(target)) {
      setFeedback(`不允许从「${from}」直接流转到「${target}」。`, "warn");
      render();
      return;
    }

    const stamp = U.nowIso();
    const updated = updateExecution(executionId, (draft) => {
      draft.status = target;
      if (!U.str(draft.executor)) {
        draft.executor = operator();
      }
      if (target === C.DEFAULTS.EXEC_STATUS) {
        draft.startedAt = "";
        draft.finishedAt = "";
      } else {
        if (!U.str(draft.startedAt)) {
          draft.startedAt = stamp;
        }
        draft.finishedAt = stamp;
      }
    }, "markResult");

    if (!updated) {
      return;
    }

    TCM.bus.emit(C.EVENTS.EXEC_MARKED, {
      executionId: U.str(updated.id),
      planId: U.str(updated.planId),
      round: U.num(updated.round, 1, 1),
      caseAssetId: U.str(updated.caseAssetId),
      status: U.str(updated.status),
      from,
      executor: U.str(updated.executor),
      source: SOURCE
    });

    setFeedback(`已标记为「${target}」。`, target === "失败" || target === "阻塞" ? "warn" : "ok");
    render();
  }

  /**
   * 保存结果备注。
   * @param {string} executionId 执行实例 id
   * @param {string} note 备注
   * @returns {void}
   */
  function saveNote(executionId, note) {
    const row = findExecution(executionId);
    if (!row || U.str(row.resultNote) === U.str(note)) {
      return;
    }
    updateExecution(executionId, (draft) => {
      draft.resultNote = U.str(note);
    }, "saveNote");
    render();
  }

  /**
   * 指派执行人。
   * @param {string} executionId 执行实例 id
   * @param {string} executor 执行人（空串表示取消指派）
   * @returns {void}
   */
  function assignExecutor(executionId, executor) {
    const row = findExecution(executionId);
    const next = U.str(executor);
    if (!row || U.str(row.executor) === next) {
      return;
    }
    updateExecution(executionId, (draft) => {
      draft.executor = next;
    }, "assignExecutor");
    setFeedback(next ? `已指派给「${next}」。` : "已取消指派。", "ok");
    render();
  }

  /* ------------------------------------------------------------------ *
   * 七、证据上传
   * ------------------------------------------------------------------ */

  /**
   * 上传单个文件到指定 bucket（复用宿主 BUG 图片接口）。
   *
   * 约定（任务书）：执行证据的 bucket 使用 **executionId**，
   * 因此 exec- id 必须满足 `^[a-zA-Z0-9_-]{1,100}$`（normalizeExecution 已保证）。
   *
   * @param {string} bucketId 存储桶 id（此处为执行实例 id）
   * @param {File} file 文件对象
   * @returns {Promise<object>} 服务端返回的 image 对象
   */
  async function uploadOne(bucketId, file) {
    const response = await global.fetch(`/api/bug-images?bugId=${encodeURIComponent(bucketId)}`, {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "X-File-Name": encodeURIComponent(file.name || "证据截图")
      },
      body: file
    });
    let result = null;
    try {
      result = await response.json();
    } catch (_error) {
      result = null;
    }
    if (!response.ok || !result || result.ok === false || !result.image) {
      throw new Error((result && result.error) || "证据上传失败");
    }
    return result.image;
  }

  /**
   * 批量上传并返回归一化后的证据条目。
   * @param {string} bucketId 存储桶 id
   * @param {Array<File>} files 文件数组
   * @returns {Promise<Array<object>>} 证据条目数组
   */
  async function uploadEvidenceFiles(bucketId, files) {
    const list = U.toArray(files).slice(0, MAX_EVIDENCE_PER_UPLOAD);
    const out = [];
    for (let index = 0; index < list.length; index += 1) {
      /* eslint-disable no-await-in-loop */
      const image = await uploadOne(bucketId, list[index]);
      out.push({
        id: U.str(image.id) || U.uid("img"),
        kind: "image",
        name: U.str(image.fileName) || U.str(list[index].name) || "证据截图",
        url: U.str(image.url),
        size: U.num(image.size, 0, 0),
        uploadedAt: U.str(image.createdAt) || U.nowIso()
      });
      /* eslint-enable no-await-in-loop */
    }
    return out;
  }

  /**
   * 处理证据文件选择。
   * @param {string} executionId 执行实例 id
   * @param {FileList|Array<File>} files 文件列表
   * @returns {Promise<void>} 完成态
   */
  async function handleEvidenceUpload(executionId, files) {
    const row = findExecution(executionId);
    const list = Array.prototype.slice.call(files || []);
    if (!row || !list.length) {
      return;
    }
    if (!U.isSafePathPart(U.str(row.id))) {
      setFeedback("执行实例 id 不合法，无法上传证据。", "error");
      render();
      return;
    }
    busy = true;
    setFeedback(`正在上传 ${Math.min(list.length, MAX_EVIDENCE_PER_UPLOAD)} 个证据文件…`, "");
    render();
    try {
      const uploaded = await uploadEvidenceFiles(row.id, list);
      updateExecution(row.id, (draft) => {
        draft.evidence = U.toArray(draft.evidence).concat(uploaded);
      }, "uploadEvidence");
      setFeedback(`已上传 ${uploaded.length} 个证据。`, "ok");
    } catch (error) {
      logError("证据上传失败", error);
      setFeedback(`证据上传失败：${error && error.message ? error.message : "未知错误"}`, "error");
    } finally {
      busy = false;
      render();
    }
  }

  /**
   * 移除证据引用（仅解除执行记录引用，磁盘文件保留以免误删缺陷附件）。
   * @param {string} executionId 执行实例 id
   * @param {string} evidenceId 证据 id
   * @returns {void}
   */
  function removeEvidence(executionId, evidenceId) {
    const row = findExecution(executionId);
    if (!row) {
      return;
    }
    const id = U.str(evidenceId);
    updateExecution(executionId, (draft) => {
      draft.evidence = U.toArray(draft.evidence).filter((item) => U.str(item && item.id) !== id);
    }, "removeEvidence");
    setFeedback("已移除该证据引用。", "ok");
    render();
  }

  /* ------------------------------------------------------------------ *
   * 八、失败一键建 Bug
   * ------------------------------------------------------------------ */

  /**
   * 生成不与现有缺陷冲突的 bug id（沿用宿主 `bug-<timestamp>` 命名习惯）。
   * @returns {string} bug id
   */
  function nextBugId() {
    const used = new Set(bugs().map((item) => U.str(item && item.id)));
    let candidate = `bug-${Date.now()}`;
    while (used.has(candidate)) {
      candidate = `bug-${Date.now()}-${U.rand6()}`;
    }
    return candidate;
  }

  /**
   * 解析宿主版本信息（用于回填缺陷的 batch 字段）。
   * @param {object|null} plan 计划
   * @returns {{batchId:string, batchVersion:string, batchName:string}} 版本信息
   */
  function resolveBatch(plan) {
    const batchId = plan ? U.str(plan.batchId) : "";
    const batchVersion = plan ? U.str(plan.batchVersion) : "";
    if (!batchId) {
      return { batchId: "", batchVersion, batchName: batchVersion };
    }
    const batch = U.toArray(getState().batches).find((item) => U.str(item && item.id) === batchId) || null;
    let batchName = batchVersion;
    if (batch && typeof global.formatBatchLabel === "function") {
      try {
        batchName = U.str(global.formatBatchLabel(batch)) || batchVersion;
      } catch (_error) {
        batchName = batchVersion;
      }
    } else if (batch) {
      batchName = U.str(batch.version) || batchVersion;
    }
    return {
      batchId,
      batchVersion: batch ? (U.str(batch.version) || batchVersion) : batchVersion,
      batchName
    };
  }

  /**
   * 归一化缺陷所属业务模块（尽量复用宿主函数，缺失时降级为原值）。
   * @param {string} rawModule 原始模块名
   * @returns {{moduleName:string, moduleId:string}} 模块信息
   */
  function resolveModule(rawModule) {
    const raw = U.str(rawModule);
    let moduleName = raw;
    if (raw && typeof global.normalizeBusinessName === "function") {
      try {
        moduleName = U.str(global.normalizeBusinessName(raw)) || raw;
      } catch (_error) {
        moduleName = raw;
      }
    }
    let moduleId = "";
    if (moduleName && typeof global.slugifyBusiness === "function") {
      try {
        moduleId = U.str(global.slugifyBusiness(moduleName));
      } catch (_error) {
        moduleId = "";
      }
    }
    return { moduleName, moduleId };
  }

  /**
   * 打开一键建 Bug 弹窗。
   * @param {string} executionId 执行实例 id
   * @returns {void}
   */
  function openBugDialog(executionId) {
    const row = findExecution(executionId);
    if (!row) {
      return;
    }
    if (!BUG_TRIGGER_STATUS.includes(U.str(row.status))) {
      setFeedback("只有「失败」或「阻塞」的执行结果才能一键建 Bug。", "warn");
      render();
      return;
    }
    if (U.str(row.linkedDefectId)) {
      setFeedback(`该执行已关联缺陷 ${U.str(row.linkedDefectId)}。`, "warn");
      render();
      return;
    }
    bugDialog = { executionId: U.str(row.id), files: [] };
    setFeedback("", "");
    render();
  }

  /**
   * 关闭弹窗。
   * @returns {void}
   */
  function closeBugDialog() {
    bugDialog = null;
    render();
  }

  /**
   * 向用例资产追加缺陷关联（§6.5 的唯一例外写入）。
   *
   * 实现要点（必须通过 store 的 checkExecutionAssetGuard）：
   *   - 深克隆整个集合，只改目标资产的 linkedDefects
   *   - **不修改** updatedAt / updatedBy / 任何业务字段
   *   - 只追加不覆盖（旧数组是新数组的前缀）
   *
   * @param {string} caseAssetId 资产 id
   * @param {{id:string, title:string}} defect 缺陷摘要
   * @returns {boolean} 是否写入成功
   */
  function appendAssetDefect(caseAssetId, defect) {
    const id = U.str(caseAssetId);
    const current = assets();
    const index = current.findIndex((item) => U.str(item && item.id) === id);
    if (index < 0) {
      return false;
    }
    const existing = U.toArray(current[index].linkedDefects);
    if (existing.some((item) => U.str(item && item.id) === U.str(defect.id))) {
      return true;
    }
    const next = current.map((item) => U.clone(item));
    next[index].linkedDefects = U.toArray(next[index].linkedDefects).concat([
      { id: U.str(defect.id), title: U.str(defect.title) }
    ]);
    // 显式声明 source=execution，让 store 走 checkExecutionAssetGuard 校验
    return S.commit("basicCaseLibrary", next, { source: SOURCE, reason: "linkDefect" });
  }

  /**
   * 提交一键建 Bug。
   * @returns {Promise<void>} 完成态
   */
  async function submitBugDialog() {
    if (!bugDialog || !rootEl || busy) {
      return;
    }
    const row = findExecution(bugDialog.executionId);
    if (!row) {
      closeBugDialog();
      return;
    }

    const readField = (name) => {
      const el = rootEl.querySelector(`[data-tcm-bug-field="${name}"]`);
      return el ? U.str(el.value) : "";
    };
    const title = readField("title");
    if (!title) {
      setFeedback("请先填写缺陷标题。", "warn");
      render();
      return;
    }

    const severity = U.oneOf(readField("severity"), BUG_SEVERITY, "中");
    const status = U.oneOf(readField("status"), BUG_STATUS, "新建");
    const owner = readField("owner") || U.str(row.executor) || operator();
    const link = readField("link");
    const note = readField("note");
    const files = U.toArray(bugDialog.files);

    const plan = findPlan(row.planId);
    const asset = findAsset(row.caseAssetId);
    const snapshot = row.caseSnapshot && typeof row.caseSnapshot === "object" ? row.caseSnapshot : {};

    busy = true;
    setFeedback(files.length ? "正在上传证据并创建缺陷…" : "正在创建缺陷…", "");
    render();

    let evidence = [];
    try {
      if (files.length) {
        // 证据桶固定用 executionId（任务书要求），缺陷与执行共享同一批图片
        evidence = await uploadEvidenceFiles(row.id, files);
      }
    } catch (error) {
      logError("证据上传失败", error);
      busy = false;
      setFeedback(`证据上传失败，缺陷未创建：${error && error.message ? error.message : "未知错误"}`, "error");
      render();
      return;
    }

    const bugId = nextBugId();
    const stamp = typeof global.nowIsoString === "function" ? U.str(global.nowIsoString()) || U.nowIso() : U.nowIso();
    const batchInfo = resolveBatch(plan);
    const moduleInfo = resolveModule(U.str(snapshot.module) || (asset ? U.str(asset.module) : ""));

    let bug = {
      id: bugId,
      title,
      severity,
      status,
      batchId: batchInfo.batchId,
      batchVersion: batchInfo.batchVersion,
      batchName: batchInfo.batchName,
      taskId: "",
      taskName: "",
      // 旧 cases 模块的关联字段保持为空，避免 syncLinkedCaseByBug 误伤旧数据
      caseId: "",
      moduleName: moduleInfo.moduleName,
      moduleId: moduleInfo.moduleId,
      owner,
      link,
      note,
      images: evidence.map((item) => ({
        id: item.id,
        fileName: item.name,
        url: item.url,
        size: item.size,
        createdAt: item.uploadedAt
      })),
      completedAt: "",
      // —— TCM 扩展字段：支撑「需求 → 用例 → 执行 → 缺陷」追溯（T04 使用） ——
      caseAssetId: U.str(row.caseAssetId),
      planId: U.str(row.planId),
      planRound: U.num(row.round, 1, 1),
      executionId: U.str(row.id),
      createdFrom: "tcm-execution"
    };

    if (typeof global.applyCreateAuditFields === "function") {
      try {
        bug = global.applyCreateAuditFields(bug);
      } catch (error) {
        logError("applyCreateAuditFields 调用失败，降级为本地审计字段", error);
      }
    }
    bug.createdBy = U.str(bug.createdBy) || operator();
    bug.createdAt = U.str(bug.createdAt) || stamp;
    bug.updatedBy = U.str(bug.updatedBy) || bug.createdBy;
    bug.updatedAt = U.str(bug.updatedAt) || bug.createdAt;

    // ① 写缺陷集合（宿主自有集合，skipNormalize：由 app.js normalizeBugItem 负责）
    const bugOk = S.commit("bugs", [bug].concat(bugs()), {
      source: SOURCE,
      skipNormalize: true,
      reason: "createBugFromExecution"
    });
    if (!bugOk) {
      busy = false;
      setFeedback("缺陷写入被拒绝，请查看控制台日志。", "error");
      render();
      return;
    }

    // ② 回填执行记录：linkedDefectId + 证据
    updateExecution(row.id, (draft) => {
      draft.linkedDefectId = bugId;
      if (evidence.length) {
        draft.evidence = U.toArray(draft.evidence).concat(evidence);
      }
      if (!U.str(draft.resultNote)) {
        draft.resultNote = `已建缺陷 ${bugId}`;
      }
    }, "linkDefect");

    // ③ §6.5 唯一例外：向资产 linkedDefects 追加（不改任何业务字段与 updatedAt）
    const beforeUpdatedAt = asset ? U.str(asset.updatedAt) : "";
    const appended = appendAssetDefect(row.caseAssetId, { id: bugId, title });
    const afterAsset = findAsset(row.caseAssetId);
    const afterUpdatedAt = afterAsset ? U.str(afterAsset.updatedAt) : "";

    busy = false;
    bugDialog = null;

    TCM.bus.emit(C.EVENTS.EXEC_BUG_CREATED, {
      bugId,
      title,
      severity,
      executionId: U.str(row.id),
      planId: U.str(row.planId),
      round: U.num(row.round, 1, 1),
      caseAssetId: U.str(row.caseAssetId),
      appendedToAsset: appended,
      assetUpdatedAtUnchanged: beforeUpdatedAt === afterUpdatedAt,
      source: SOURCE
    });

    if (!appended) {
      setFeedback(`缺陷 ${bugId} 已创建并回填执行记录，但资产 linkedDefects 追加被守卫拒绝（详见控制台）。`, "warn");
    } else if (beforeUpdatedAt !== afterUpdatedAt) {
      // 理论上不可能发生：守卫会先行拦截；此处兜底告警便于排查
      setFeedback(`缺陷 ${bugId} 已创建，但检测到资产 updatedAt 变化，请立即排查。`, "error");
    } else {
      setFeedback(`缺陷 ${bugId} 已创建，已回填执行记录并追加到用例的缺陷关联。`, "ok");
    }

    // 宿主列表（BUG 看板等）同步刷新
    if (typeof global.renderAll === "function") {
      try {
        global.renderAll();
      } catch (error) {
        logError("宿主 renderAll 调用失败", error);
      }
    }
    render();
  }

  /* ------------------------------------------------------------------ *
   * 九、事件处理（委托，mount 时只绑一次）
   * ------------------------------------------------------------------ */

  /**
   * 点击事件委托。
   * @param {MouseEvent} event 事件对象
   * @returns {void}
   */
  function onClick(event) {
    const target = event.target;
    if (!target || typeof target.closest !== "function") {
      return;
    }

    const scopeBtn = target.closest("[data-tcm-exec-scope]");
    if (scopeBtn) {
      setScope(scopeBtn.dataset.tcmExecScope);
      return;
    }

    const filterBtn = target.closest("[data-tcm-exec-filter]");
    if (filterBtn) {
      statusFilter = U.str(filterBtn.getAttribute("data-tcm-exec-filter"));
      render();
      return;
    }

    const markBtn = target.closest("[data-tcm-exec-mark]");
    if (markBtn) {
      markResult(markBtn.dataset.tcmExecMark, markBtn.dataset.tcmStatus);
      return;
    }

    const claimBtn = target.closest("[data-tcm-exec-claim]");
    if (claimBtn) {
      assignExecutor(claimBtn.dataset.tcmExecClaim, operator());
      return;
    }

    const evidenceBtn = target.closest("[data-tcm-exec-evidence]");
    if (evidenceBtn) {
      evidenceTargetId = U.str(evidenceBtn.dataset.tcmExecEvidence);
      if (evidenceInput) {
        evidenceInput.value = "";
        evidenceInput.click();
      }
      return;
    }

    const evidenceDel = target.closest("[data-tcm-exec-evidence-del]");
    if (evidenceDel) {
      removeEvidence(evidenceDel.dataset.tcmExecEvidenceDel, evidenceDel.dataset.tcmEvidenceId);
      return;
    }

    const bugBtn = target.closest("[data-tcm-exec-bug]");
    if (bugBtn) {
      openBugDialog(bugBtn.dataset.tcmExecBug);
      return;
    }

    const historyBtn = target.closest("[data-tcm-exec-history]");
    if (historyBtn) {
      const next = U.str(historyBtn.dataset.tcmExecHistory);
      historyAssetId = historyAssetId === next ? "" : next;
      render();
      return;
    }

    if (target.closest("[data-tcm-exec-history-close]")) {
      historyAssetId = "";
      render();
      return;
    }

    if (target.closest("[data-tcm-bug-submit]")) {
      submitBugDialog();
      return;
    }

    // 背景与关闭按钮共用 data-tcm-bug-cancel；点击弹窗内部不关闭
    const cancelHit = target.closest("[data-tcm-bug-cancel]");
    if (cancelHit && !busy) {
      if (cancelHit.classList.contains("tcm-modal-backdrop") && target !== cancelHit) {
        return;
      }
      closeBugDialog();
    }
  }

  /**
   * change 事件委托（下拉、输入框失焦、文件选择）。
   * @param {Event} event 事件对象
   * @returns {void}
   */
  function onChange(event) {
    const target = event.target;
    if (!target || typeof target.closest !== "function") {
      return;
    }

    if (target.matches("[data-tcm-exec-plan]")) {
      setActivePlan(target.value);
      return;
    }
    if (target.matches("[data-tcm-exec-round]")) {
      setActiveRound(target.value);
      return;
    }
    if (target.matches("[data-tcm-exec-note]")) {
      saveNote(target.dataset.tcmExecNote, target.value);
      return;
    }
    if (target.matches("[data-tcm-exec-executor]")) {
      assignExecutor(target.dataset.tcmExecExecutor, target.value);
      return;
    }
    if (target.matches("[data-tcm-bug-files]")) {
      const files = Array.prototype.slice.call(target.files || []).slice(0, MAX_EVIDENCE_PER_UPLOAD);
      if (bugDialog) {
        bugDialog.files = files;
      }
      // 就地更新提示文本，避免重渲染丢失已填写的标题 / 描述
      const label = rootEl ? rootEl.querySelector("[data-tcm-bug-files-label]") : null;
      if (label) {
        label.textContent = files.length
          ? `已选 ${files.length} 张：${files.map((file) => U.str(file.name) || "证据截图").join("、")}`
          : "未选择文件";
      }
    }
  }

  /**
   * input 事件委托：搜索框实时过滤（防抖）。
   * @param {Event} event 事件对象
   * @returns {void}
   */
  function onInput(event) {
    const target = event.target;
    if (!target || typeof target.matches !== "function") {
      return;
    }
    if (target.matches("[data-tcm-exec-keyword]")) {
      keyword = U.str(target.value);
      debouncedRender();
    }
  }

  /** 搜索防抖渲染 */
  const debouncedRender = U.debounce(function debouncedRenderImpl() {
    render();
  }, 200);

  /**
   * 键盘事件：Esc 关闭弹窗 / 历史抽屉。
   * @param {KeyboardEvent} event 事件对象
   * @returns {void}
   */
  function onKeydown(event) {
    if (event.key !== "Escape") {
      return;
    }
    if (bugDialog && !busy) {
      closeBugDialog();
      return;
    }
    if (historyAssetId) {
      historyAssetId = "";
      render();
    }
  }

  /**
   * 隐藏文件选择器的 change 处理。
   * @returns {void}
   */
  function onEvidenceInputChange() {
    if (!evidenceInput || !evidenceTargetId) {
      return;
    }
    const files = Array.prototype.slice.call(evidenceInput.files || []);
    const targetId = evidenceTargetId;
    evidenceTargetId = "";
    evidenceInput.value = "";
    handleEvidenceUpload(targetId, files);
  }

  /**
   * 计划条目变化时刷新执行台（用例被加入/移出计划后需要补齐或重排）。
   * @param {object} payload 事件负载
   * @returns {void}
   */
  function onPlanItemsChanged(payload) {
    const data = payload && typeof payload === "object" ? payload : {};
    if (U.str(data.action) === "request-add") {
      // 来自用例库的「加入计划」请求由 TCM.plans 处理，执行台不响应
      return;
    }
    renderIfVisible();
  }

  /* ------------------------------------------------------------------ *
   * 十、生命周期
   * ------------------------------------------------------------------ */

  /**
   * 挂载执行台：绑定事件委托（只绑一次）+ 创建隐藏文件选择器。
   * @param {HTMLElement} [root] #tcmExecutionView 容器
   * @returns {void}
   */
  function mount(root) {
    if (!doc) {
      return;
    }
    bindBusOnce();
    rootEl = root || doc.getElementById("tcmExecutionView");
    if (!rootEl || mounted) {
      return;
    }

    rootEl.addEventListener("click", onClick);
    rootEl.addEventListener("change", onChange);
    rootEl.addEventListener("input", onInput);
    rootEl.addEventListener("keydown", onKeydown);

    evidenceInput = doc.createElement("input");
    evidenceInput.type = "file";
    evidenceInput.accept = "image/*";
    evidenceInput.multiple = true;
    evidenceInput.style.display = "none";
    evidenceInput.setAttribute("data-tcm-evidence-input", "1");
    evidenceInput.addEventListener("change", onEvidenceInputChange);
    doc.body.appendChild(evidenceInput);

    mounted = true;
  }

  /**
   * 订阅跨模块 bus 事件（进程内只订阅一次，与 DOM 挂载解耦）。
   * @returns {void}
   */
  function bindBusOnce() {
    if (busBound || !TCM.bus || typeof TCM.bus.on !== "function") {
      return;
    }
    TCM.bus.on(C.EVENTS.PLAN_ITEMS_CHANGED, onPlanItemsChanged);
    TCM.bus.on(C.EVENTS.PLAN_UPDATED, renderIfVisible);
    TCM.bus.on(C.EVENTS.PLAN_CREATED, renderIfVisible);
    TCM.bus.on(C.EVENTS.CASE_DELETED, renderIfVisible);
    TCM.bus.on(C.EVENTS.EXEC_FOCUS, onExecFocus);
    busBound = true;
  }

  /**
   * 处理「定位到某个执行实例」请求（T04 追溯图谱发起）。
   *
   * 只切换计划 / 轮次偏好并激活本视图，**不改任何业务数据**。
   * @param {{executionId?:string, planId?:string, round?:number, source?:string}} payload 事件负载
   * @returns {void}
   */
  function onExecFocus(payload) {
    const data = payload && typeof payload === "object" ? payload : {};
    if (U.str(data.source) === "execution") {
      return;
    }
    const executionId = U.str(data.executionId);
    const execution = executionId
      ? executions().find((item) => item && U.str(item.id) === executionId) || null
      : null;
    const planId = U.str(execution ? execution.planId : data.planId);
    if (!planId || !findPlan(planId)) {
      return;
    }
    if (TCM.shell && typeof TCM.shell.setActive === "function") {
      TCM.shell.setActive("execution");
    }
    const state = getState();
    state.tcmActivePlanId = planId;
    state.tcmActiveRound = U.num(execution ? execution.round : data.round, 1, 1);
    persistLocal();
    render();
  }

  /**
   * 卸载：解绑 DOM 事件、移除隐藏文件选择器。
   *
   * 注意：**不解绑 bus**，bindBusOnce 幂等，重新 mount 不会重复订阅。
   * @returns {void}
   */
  function destroy() {
    if (rootEl) {
      rootEl.removeEventListener("click", onClick);
      rootEl.removeEventListener("change", onChange);
      rootEl.removeEventListener("input", onInput);
      rootEl.removeEventListener("keydown", onKeydown);
    }
    if (evidenceInput) {
      evidenceInput.removeEventListener("change", onEvidenceInputChange);
      if (evidenceInput.parentNode) {
        evidenceInput.parentNode.removeChild(evidenceInput);
      }
      evidenceInput = null;
    }
    bugDialog = null;
    historyAssetId = "";
    busy = false;
    mounted = false;
  }

  // 模块加载即订阅跨模块事件，保证计划变更能被执行台感知。
  bindBusOnce();

  TCM.execution = {
    mount,
    render,
    destroy,
    /**
     * 当前计划 / 轮次 / 作用域 / 筛选下的可见执行行数（★ F2）。
     *
     * 供 tcm-shell 的子 Tab 徽标使用：执行台永远只展示「某计划某轮」的执行实例，
     * 用 `caseExecutions` 全量长度当徽标会严重高估。
     * @returns {number} 可见执行行数
     */
    getVisibleCount() {
      const plan = activePlan();
      if (!plan) {
        return 0;
      }
      return visibleRows(plan, activeRound(plan)).length;
    },
    // 供调试 / 验收使用
    markResult,
    openBugDialog,
    setScope,
    scope,
    /**
     * 硬约束验收辅助：返回用例资产的指纹（updatedAt + 去掉 linkedDefects 的 JSON）。
     * 标记执行结果前后调用两次，两者应完全一致。
     * @param {string} caseAssetId 资产 id
     * @returns {{updatedAt:string, fingerprint:string, defectCount:number}|null} 指纹
     */
    assetFingerprint(caseAssetId) {
      const asset = findAsset(caseAssetId);
      if (!asset) {
        return null;
      }
      const rest = U.clone(asset);
      delete rest.linkedDefects;
      return {
        updatedAt: U.str(asset.updatedAt),
        fingerprint: JSON.stringify(rest),
        defectCount: U.toArray(asset.linkedDefects).length
      };
    },
    _internals: {
      visibleRows,
      ensureRound,
      appendAssetDefect,
      buildBugNote,
      resolveBatch,
      resolveModule,
      nextBugId,
      myPendingSummary,
      BUG_TRIGGER_STATUS,
      EXECUTED_STATUS
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
