/**
 * tcm-plans.js —— 测试用例管理模块 L2 视图层：测试计划编排
 *
 * 职责（系统设计 §T03 交付项 1 / PRD §6.4）：
 *   1. 计划列表：按关联版本（batchId）分组，展示用例数 / 轮次 / 当前轮进度 / 负责人 / 状态
 *   2. 创建 / 编辑计划：名称 + 关联版本 + 负责人 + 起止日期 + 描述，自动建首轮 {round:1, name:"首轮"}
 *   3. 引用用例（**不复制**）：items 仅存 caseAssetId，用例正文永远实时读 basicCaseLibrary
 *   4. 指派执行人：单条 / 批量，下拉源为 state.teamMembers（app.js 由 GET /api/team-members 拉取），允许自由输入
 *   5. 多轮执行：新建轮次默认全量复制上一轮；提供「仅导入上轮失败/阻塞项」快捷入口；可切换当前轮
 *
 * 跨模块契约（系统设计 §8.2，只走 TCM.bus，禁止直接互调 render）：
 *   - 接收（来自 tcm-library.js）：
 *       bus.emit('plan:itemsChanged', { action:'request-add', caseAssetIds:[...], source:'library' })
 *     → 本模块弹出「加入计划」选择框，用户确认后写入 plan.items
 *   - 广播：
 *       bus.emit('plan:created',      { planId, name })
 *       bus.emit('plan:updated',      { planId, action })
 *       bus.emit('plan:itemsChanged', { action:'added'|'removed'|'excluded'|'executor'|'round', planId, count })
 *
 * 写入约定（系统设计 §8.3）：
 *   - 只写 state.testPlans / state.caseExecutions（删除计划时级联清理），走 TCM.store.commit()
 *   - basicCaseLibrary **只读引用**，本模块永不写入
 */
(function (global) {
  "use strict";

  const TCM = global.TCM = global.TCM || {};
  const C = TCM.const;
  const U = TCM.util;

  if (!C || !U) {
    throw new Error("[tcm-plans] 依赖缺失：请确保 tcm-core.js 在 tcm-plans.js 之前加载。");
  }

  const doc = global.document;

  /** 计划状态 → 徽标色板 */
  const PLAN_STATUS_TONE = Object.freeze({
    "未开始": "tone-gray",
    "进行中": "tone-blue",
    "已完成": "tone-green",
    "已归档": "tone-gray"
  });

  /** 轮次状态 → 徽标色板 */
  const ROUND_STATUS_TONE = Object.freeze({
    "未开始": "tone-gray",
    "进行中": "tone-blue",
    "已完成": "tone-green"
  });

  /** 优先级 → 徽标色板（与 tcm-library.js 保持一致） */
  const PRIORITY_TONE = Object.freeze({ P0: "tone-red", P1: "tone-orange", P2: "tone-blue", P3: "tone-gray" });

  /* ------------------------------------------------------------------ *
   * 模块内状态（均不持久化，除注明外）
   * ------------------------------------------------------------------ */

  /** 视图根容器 #tcmPlansView */
  let rootEl = null;

  /** 是否已挂载（DOM 事件委托只绑一次） */
  let mounted = false;

  /**
   * 是否已订阅跨模块 bus 事件。
   *
   * 注意：bus 订阅必须与 DOM 挂载**解耦**——用例库的「加入计划」可能在用户
   * 从未打开过「测试计划」子 Tab 时触发，此时本视图尚未 mount。
   * 因此订阅在模块加载时完成，而不是放在 mount() 里。
   */
  let busBound = false;

  /** 计划详情中被勾选的条目 caseAssetId */
  const itemSelection = new Set();

  /**
   * 当前弹窗描述：
   *   null                                        —— 无弹窗
   *   { kind:'plan', mode:'create'|'edit', planId, draft }  —— 计划表单
   *   { kind:'pick', caseAssetIds:[...] }         —— 「加入计划」选择框
   * @type {object|null}
   */
  let dialog = null;

  /* ------------------------------------------------------------------ *
   * 基础读写
   * ------------------------------------------------------------------ */

  /**
   * 读取全局状态。
   * @returns {object} state 引用
   */
  function getState() {
    return TCM.store && typeof TCM.store.getState === "function" ? TCM.store.getState() : (global.state || {});
  }

  /**
   * 读取测试计划集合。
   * @returns {Array<object>} 计划数组
   */
  function plans() {
    return TCM.store.collection("testPlans");
  }

  /**
   * 读取执行实例集合。
   * @returns {Array<object>} 执行实例数组
   */
  function executions() {
    return TCM.store.collection("caseExecutions");
  }

  /**
   * 读取用例资产集合（**只读**）。
   * @returns {Array<object>} 资产数组
   */
  function assets() {
    return TCM.store.collection("basicCaseLibrary");
  }

  /**
   * 触发 app.js 的本地偏好持久化。
   * @returns {void}
   */
  function persistLocal() {
    if (typeof global.persist === "function") {
      try {
        global.persist();
      } catch (error) {
        if (global.console && typeof global.console.error === "function") {
          global.console.error("[TCM.plans] persist 失败：", error);
        }
      }
    }
  }

  /**
   * 轻提示（复用 app.js showToast）。
   * @param {string} message 提示内容
   * @param {string} [tone] info|success|warning|error
   * @returns {void}
   */
  function toast(message, tone) {
    if (typeof global.showToast === "function") {
      global.showToast(message, tone || "info");
      return;
    }
    if (global.console && typeof global.console.info === "function") {
      global.console.info(`[TCM.plans] ${message}`);
    }
  }

  /**
   * 当前操作人。
   * @returns {string} 操作人名称
   */
  function operator() {
    return U.currentOperator(getState());
  }

  /**
   * 团队成员候选（app.js 已从 /api/team-members 拉取合并到 state.teamMembers）。
   * @returns {Array<string>} 成员名列表
   */
  function teamMembers() {
    const state = getState();
    const list = U.toArray(state.teamMembers).map((item) => U.str(item)).filter(Boolean);
    const extra = plans().map((plan) => U.str(plan.owner)).filter(Boolean);
    return U.stringList(list.concat(extra));
  }

  /**
   * 可关联的版本批次（排除系统工作台批次）。
   * @returns {Array<{id:string,label:string,version:string}>} 批次列表
   */
  function batchOptions() {
    return U.toArray(getState().batches)
      .filter((batch) => batch && batch.id && !batch.systemManaged && batch.id !== "batch-default-workspace")
      .map((batch) => ({
        id: U.str(batch.id),
        version: U.str(batch.version),
        label: U.str(batch.version) || U.str(batch.name, "未命名版本")
      }));
  }

  /* ------------------------------------------------------------------ *
   * 视图偏好（tcmActivePlanId / tcmActiveRound，进 LOCAL_STATE_KEYS）
   * ------------------------------------------------------------------ */

  /**
   * 当前打开的计划 id（计划不存在时自动回退为列表页）。
   * @returns {string} 计划 id，空串表示列表页
   */
  function activePlanId() {
    const id = U.str(getState().tcmActivePlanId);
    if (!id) {
      return "";
    }
    return plans().some((plan) => plan.id === id) ? id : "";
  }

  /**
   * 当前打开的计划对象。
   * @returns {object|null} 计划对象
   */
  function activePlan() {
    const id = activePlanId();
    return id ? (plans().find((plan) => plan.id === id) || null) : null;
  }

  /**
   * 设置当前打开的计划。
   * @param {string} planId 计划 id，空串返回列表
   * @returns {void}
   */
  function setActivePlan(planId) {
    const state = getState();
    const id = U.str(planId);
    state.tcmActivePlanId = id;
    itemSelection.clear();
    const plan = id ? plans().find((item) => item.id === id) : null;
    state.tcmActiveRound = plan ? U.num(plan.currentRound, 1, 1) : 1;
    persistLocal();
    render();
  }

  /**
   * 当前查看的轮次（越界时收敛到计划的最大轮次）。
   * @param {object|null} plan 计划对象
   * @returns {number} 轮次号
   */
  function activeRound(plan) {
    const target = plan || activePlan();
    const raw = U.num(getState().tcmActiveRound, 1, 1);
    if (!target) {
      return raw;
    }
    const rounds = U.toArray(target.rounds).map((item) => U.num(item.round, 1, 1));
    return rounds.includes(raw) ? raw : U.num(target.currentRound, rounds[0] || 1, 1);
  }

  /**
   * 设置当前查看的轮次。
   * @param {number} round 轮次号
   * @returns {void}
   */
  function setActiveRound(round) {
    getState().tcmActiveRound = U.num(round, 1, 1);
    itemSelection.clear();
    persistLocal();
    render();
  }

  /* ------------------------------------------------------------------ *
   * 计划写入（统一出口）
   * ------------------------------------------------------------------ */

  /**
   * 用 mutator 更新单个计划并提交（自动写审计字段）。
   * @param {string} planId 计划 id
   * @param {Function} mutator 接收计划副本，返回新的计划对象
   * @returns {object|null} 更新后的计划；计划不存在时返回 null
   */
  function updatePlan(planId, mutator) {
    const id = U.str(planId);
    const source = plans().find((plan) => plan.id === id);
    if (!source) {
      toast("计划不存在或已被删除。", "warning");
      return null;
    }
    const draft = mutator(U.clone(source));
    if (!draft) {
      return null;
    }
    draft.id = id;
    draft.updatedBy = operator();
    draft.updatedAt = U.nowIso();
    const next = plans().map((plan) => (plan.id === id ? draft : plan));
    TCM.store.commit("testPlans", next, { source: "plans" });
    return plans().find((plan) => plan.id === id) || null;
  }

  /**
   * 计划进度（当前查看轮次）。
   * @param {object} plan 计划对象
   * @param {number} round 轮次号
   * @returns {object} 进度对象
   */
  function progressOf(plan, round) {
    return TCM.model.planProgress(plan.id, round, {
      plans: plans(),
      executions: executions()
    });
  }

  /* ------------------------------------------------------------------ *
   * HTML 片段
   * ------------------------------------------------------------------ */

  /**
   * 进度条片段。
   * @param {object} progress planProgress 结果
   * @param {{compact?:boolean}} [options] compact=true 时不显示分项数字
   * @returns {string} HTML 片段
   */
  function progressBarHtml(progress, options) {
    const opts = options && typeof options === "object" ? options : {};
    const total = Math.max(1, U.num(progress.total, 0, 0));
    const segments = [
      { key: "通过", count: progress.passed, cls: "pass" },
      { key: "失败", count: progress.failed, cls: "fail" },
      { key: "阻塞", count: progress.blocked, cls: "block" },
      { key: "跳过", count: progress.skipped, cls: "skip" }
    ];
    const bars = segments
      .filter((item) => item.count > 0)
      .map((item) => `<span class="tcm-progress-seg is-${item.cls}" style="width:${(item.count / total) * 100}%" title="${U.escapeHtml(item.key)} ${U.escapeHtml(String(item.count))}"></span>`)
      .join("");
    const legend = opts.compact
      ? `<span class="tcm-progress-text">${U.escapeHtml(String(progress.executed))}/${U.escapeHtml(String(progress.total))}</span>`
      : `<span class="tcm-progress-text">
          已执行 <strong>${U.escapeHtml(String(progress.executed))}</strong>/${U.escapeHtml(String(progress.total))}
          · 执行率 ${U.escapeHtml(String(progress.executeRate))}%
          · 通过率 ${U.escapeHtml(String(progress.passRate))}%
        </span>`;
    return `<div class="tcm-progress${opts.compact ? " is-compact" : ""}">
      <div class="tcm-progress-track" role="img" aria-label="执行进度 ${U.escapeHtml(String(progress.executed))} / ${U.escapeHtml(String(progress.total))}">${bars}</div>
      ${legend}
    </div>`;
  }

  /**
   * 分项统计 chips。
   * @param {object} progress planProgress 结果
   * @returns {string} HTML 片段
   */
  function statChipsHtml(progress) {
    const items = [
      { label: "总数", value: progress.total, cls: "" },
      { label: "未执行", value: progress.notRun, cls: "is-idle" },
      { label: "通过", value: progress.passed, cls: "is-pass" },
      { label: "失败", value: progress.failed, cls: "is-fail" },
      { label: "阻塞", value: progress.blocked, cls: "is-block" },
      { label: "跳过", value: progress.skipped, cls: "is-skip" },
      { label: "关联缺陷", value: progress.defectCount, cls: "is-bug" }
    ];
    return `<div class="tcm-stat-chips">${items.map((item) => `
      <span class="tcm-stat-chip ${item.cls}">
        <span class="tcm-stat-label">${U.escapeHtml(item.label)}</span>
        <strong class="tcm-stat-value">${U.escapeHtml(String(item.value))}</strong>
      </span>`).join("")}</div>`;
  }

  /**
   * 计划卡片。
   * @param {object} plan 计划对象
   * @returns {string} HTML 片段
   */
  function planCardHtml(plan) {
    const round = U.num(plan.currentRound, 1, 1);
    const progress = progressOf(plan, round);
    const tone = PLAN_STATUS_TONE[plan.status] || "tone-gray";
    const period = [U.str(plan.startAt), U.str(plan.endAt)].filter(Boolean).join(" ~ ") || "未设置周期";
    return `<article class="tcm-plan-card" data-tcm-plan-open="${U.escapeHtml(plan.id)}" tabindex="0" role="button" aria-label="打开计划 ${U.escapeHtml(plan.name)}">
      <header class="tcm-plan-card-head">
        <h4 class="tcm-plan-card-title">${U.escapeHtml(plan.name)}</h4>
        <span class="badge ${tone}">${U.escapeHtml(plan.status)}</span>
      </header>
      <div class="tcm-plan-card-meta">
        <span>负责人：${U.escapeHtml(U.str(plan.owner, "未指派"))}</span>
        <span>· 用例 ${U.escapeHtml(String(U.toArray(plan.items).length))} 条</span>
        <span>· 共 ${U.escapeHtml(String(U.toArray(plan.rounds).length))} 轮（当前第 ${U.escapeHtml(String(round))} 轮）</span>
        <span>· ${U.escapeHtml(period)}</span>
      </div>
      ${plan.description ? `<p class="tcm-plan-card-desc">${U.escapeHtml(plan.description)}</p>` : ""}
      ${progressBarHtml(progress)}
      <footer class="tcm-plan-card-foot">
        <button type="button" class="tcm-chip-btn" data-tcm-plan-edit="${U.escapeHtml(plan.id)}">编辑</button>
        <button type="button" class="tcm-chip-btn" data-tcm-plan-execute="${U.escapeHtml(plan.id)}">去执行台</button>
        <button type="button" class="tcm-chip-btn tcm-chip-btn-ghost" data-tcm-plan-delete="${U.escapeHtml(plan.id)}">删除</button>
      </footer>
    </article>`;
  }

  /**
   * 渲染计划列表页。
   * @returns {string} HTML 片段
   */
  function listHtml() {
    const all = plans();
    const batches = batchOptions();
    const batchLabel = new Map(batches.map((item) => [item.id, item.label]));

    const groups = new Map();
    all.forEach((plan) => {
      const key = U.str(plan.batchId);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(plan);
    });

    const groupHtml = Array.from(groups.entries())
      .sort((a, b) => (a[0] ? -1 : 1) - (b[0] ? -1 : 1))
      .map(([batchId, items]) => {
        const title = batchId
          ? (batchLabel.get(batchId) || U.str(items[0].batchVersion, "未知版本"))
          : "未关联版本";
        return `<section class="tcm-plan-group">
          <h4 class="tcm-plan-group-title">
            <span>${U.escapeHtml(title)}</span>
            <span class="tcm-plan-group-count">${U.escapeHtml(String(items.length))} 个计划</span>
          </h4>
          <div class="tcm-plan-grid">${items.map(planCardHtml).join("")}</div>
        </section>`;
      })
      .join("");

    const empty = `<div class="tcm-empty">
      <p class="tcm-empty-title">还没有测试计划</p>
      <p class="tcm-empty-desc">测试计划用于「引用用例 + 指派执行人 + 多轮执行」，是用例库到执行台的桥梁。计划只保存用例引用，不复制用例内容。</p>
      <button type="button" class="tcm-btn tcm-btn-primary" data-tcm-plan-new="1">新建测试计划</button>
    </div>`;

    return `<div class="tcm-plans-page">
      <header class="tcm-page-head">
        <div>
          <h3 class="tcm-page-title">测试计划</h3>
          <p class="tcm-page-desc">共 ${U.escapeHtml(String(all.length))} 个计划 · 引用用例不复制内容，用例正文始终以用例库为唯一真相源</p>
        </div>
        <div class="tcm-page-actions">
          <button type="button" class="tcm-btn tcm-btn-primary" data-tcm-plan-new="1">＋ 新建计划</button>
        </div>
      </header>
      ${all.length ? groupHtml : empty}
    </div>`;
  }

  /**
   * 轮次条。
   * @param {object} plan 计划对象
   * @param {number} viewRound 当前查看轮次
   * @returns {string} HTML 片段
   */
  function roundsHtml(plan, viewRound) {
    const chips = U.toArray(plan.rounds).map((round) => {
      const no = U.num(round.round, 1, 1);
      const progress = progressOf(plan, no);
      const isView = no === viewRound;
      const isCurrent = no === U.num(plan.currentRound, 1, 1);
      return `<button type="button"
        class="tcm-round-chip${isView ? " is-active" : ""}${isCurrent ? " is-current" : ""}"
        data-tcm-plan-round="${U.escapeHtml(String(no))}"
        aria-pressed="${isView ? "true" : "false"}"
        title="${U.escapeHtml(round.name)}（${U.escapeHtml(round.status)}）">
        <span class="tcm-round-name">${U.escapeHtml(round.name)}</span>
        <span class="badge ${ROUND_STATUS_TONE[round.status] || "tone-gray"}">${U.escapeHtml(round.status)}</span>
        <span class="tcm-round-progress">${U.escapeHtml(String(progress.executed))}/${U.escapeHtml(String(progress.total))}</span>
        ${isCurrent ? `<span class="tcm-round-current" title="当前轮次">当前</span>` : ""}
      </button>`;
    }).join("");

    const viewRoundDef = U.toArray(plan.rounds).find((item) => U.num(item.round, 1, 1) === viewRound) || null;
    const canStart = viewRoundDef && viewRoundDef.status === "未开始";
    const canFinish = viewRoundDef && viewRoundDef.status === "进行中";

    return `<section class="tcm-rounds">
      <div class="tcm-rounds-head">
        <span class="tcm-rounds-title">轮次</span>
        <div class="tcm-rounds-actions">
          <button type="button" class="tcm-chip-btn" data-tcm-round-new="all">＋ 新建轮次（复制全量）</button>
          <button type="button" class="tcm-chip-btn" data-tcm-round-new="failed">＋ 仅导入上轮失败/阻塞项</button>
          ${viewRound !== U.num(plan.currentRound, 1, 1)
            ? `<button type="button" class="tcm-chip-btn" data-tcm-round-setcurrent="${U.escapeHtml(String(viewRound))}">设为当前轮</button>`
            : ""}
          ${canStart ? `<button type="button" class="tcm-chip-btn" data-tcm-round-status="${U.escapeHtml(String(viewRound))}|进行中">开始本轮</button>` : ""}
          ${canFinish ? `<button type="button" class="tcm-chip-btn" data-tcm-round-status="${U.escapeHtml(String(viewRound))}|已完成">完成本轮</button>` : ""}
          ${U.toArray(plan.rounds).length > 1 && viewRound === TCM.model.nextRoundNumber(plan) - 1
            ? `<button type="button" class="tcm-chip-btn tcm-chip-btn-ghost" data-tcm-round-delete="${U.escapeHtml(String(viewRound))}">删除本轮</button>`
            : ""}
        </div>
      </div>
      <div class="tcm-round-chips" role="group" aria-label="轮次切换">${chips}</div>
    </section>`;
  }

  /**
   * 计划条目表格。
   * @param {object} plan 计划对象
   * @param {number} viewRound 当前查看轮次
   * @returns {string} HTML 片段
   */
  function itemsHtml(plan, viewRound) {
    const assetMap = new Map(assets().map((asset) => [asset.id, asset]));
    const execMap = new Map(
      TCM.model.executionsForRound(executions(), plan.id, viewRound).map((item) => [U.str(item.caseAssetId), item])
    );
    const all = U.toArray(plan.items).slice().sort((a, b) => U.num(a.order, 0, 0) - U.num(b.order, 0, 0));

    if (!all.length) {
      return `<div class="tcm-empty tcm-empty-inline">
        <p class="tcm-empty-title">这个计划还没有引用任何用例</p>
        <p class="tcm-empty-desc">到「用例库」勾选用例后点击「加入计划」，即可把用例引用进本计划（不会复制用例内容）。</p>
        <button type="button" class="tcm-btn tcm-btn-primary" data-tcm-goto-library="1">去用例库挑选用例</button>
      </div>`;
    }

    const rows = all.map((item) => {
      const caseAssetId = U.str(item.caseAssetId);
      const asset = assetMap.get(caseAssetId) || null;
      const excluded = U.toArray(item.excludedRounds).map((value) => U.num(value, 0, 0)).includes(viewRound);
      const exec = execMap.get(caseAssetId) || null;
      const checked = itemSelection.has(caseAssetId);
      const breadcrumb = asset
        ? [asset.product, asset.module, asset.category].map((part) => U.str(part)).filter((part, index, list) => part && list.indexOf(part) === index).join(" / ")
        : "";
      const title = asset ? U.str(asset.title, "未命名基础用例") : "⚠ 用例已从库中删除";

      return `<tr class="tcm-plan-row${excluded ? " is-excluded" : ""}" data-case-id="${U.escapeHtml(caseAssetId)}">
        <td class="tcm-col-check">
          <input type="checkbox" data-tcm-item-check="${U.escapeHtml(caseAssetId)}" ${checked ? "checked" : ""} aria-label="选择用例 ${U.escapeHtml(title)}">
        </td>
        <td class="tcm-col-order">${U.escapeHtml(String(item.order))}</td>
        <td class="tcm-col-title">
          <span class="tcm-plan-case-title${asset ? "" : " is-missing"}">${U.escapeHtml(title)}</span>
          <span class="tcm-plan-case-meta">${U.escapeHtml(breadcrumb || "—")}</span>
        </td>
        <td class="tcm-col-badge">
          ${asset ? `<span class="badge ${PRIORITY_TONE[asset.priority] || "tone-gray"}">${U.escapeHtml(asset.priority)}</span>` : "—"}
        </td>
        <td class="tcm-col-badge">${asset ? `<span class="tcm-badge tcm-badge-type">${U.escapeHtml(asset.type)}</span>` : "—"}</td>
        <td class="tcm-col-executor">
          <input type="text" class="tcm-inline-input" list="tcmPlanMemberList"
            value="${U.escapeHtml(U.str(item.executor))}" placeholder="未指派"
            data-tcm-item-executor="${U.escapeHtml(caseAssetId)}" aria-label="指派执行人">
        </td>
        <td class="tcm-col-status">
          ${excluded
            ? `<span class="tcm-badge tcm-badge-muted">本轮已移除</span>`
            : `<span class="tcm-exec-dot is-${U.escapeHtml(execStatusClass(exec ? exec.status : C.DEFAULTS.EXEC_STATUS))}">${U.escapeHtml(exec ? exec.status : C.DEFAULTS.EXEC_STATUS)}</span>`}
        </td>
        <td class="tcm-col-ops">
          ${excluded
            ? `<button type="button" class="tcm-chip-btn" data-tcm-item-include="${U.escapeHtml(caseAssetId)}">恢复本轮</button>`
            : `<button type="button" class="tcm-chip-btn" data-tcm-item-exclude="${U.escapeHtml(caseAssetId)}">本轮移除</button>`}
          <button type="button" class="tcm-chip-btn tcm-chip-btn-ghost" data-tcm-item-remove="${U.escapeHtml(caseAssetId)}">移出计划</button>
        </td>
      </tr>`;
    }).join("");

    const allChecked = all.length > 0 && all.every((item) => itemSelection.has(U.str(item.caseAssetId)));

    return `<table class="tcm-plan-table">
      <thead>
        <tr>
          <th class="tcm-col-check"><input type="checkbox" data-tcm-item-check-all="1" ${allChecked ? "checked" : ""} aria-label="全选"></th>
          <th class="tcm-col-order">#</th>
          <th class="tcm-col-title">用例（引用自用例库）</th>
          <th class="tcm-col-badge">优先级</th>
          <th class="tcm-col-badge">类型</th>
          <th class="tcm-col-executor">执行人</th>
          <th class="tcm-col-status">本轮结果</th>
          <th class="tcm-col-ops">操作</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  /**
   * 执行状态 → CSS 修饰类。
   * @param {string} status 执行状态
   * @returns {string} 类名片段
   */
  function execStatusClass(status) {
    const map = { "未执行": "idle", "通过": "pass", "失败": "fail", "阻塞": "block", "跳过": "skip" };
    return map[U.str(status)] || "idle";
  }

  /**
   * 渲染计划详情页。
   * @param {object} plan 计划对象
   * @returns {string} HTML 片段
   */
  function detailHtml(plan) {
    const viewRound = activeRound(plan);
    const progress = progressOf(plan, viewRound);
    const batches = batchOptions();
    const batchLabel = batches.find((item) => item.id === plan.batchId);
    const period = [U.str(plan.startAt), U.str(plan.endAt)].filter(Boolean).join(" ~ ") || "未设置周期";
    const allowed = [plan.status].concat(C.PLAN_STATUS_TRANSITIONS[plan.status] || []);
    const statusOptions = C.PLAN_STATUS
      .filter((status) => allowed.includes(status))
      .map((status) => `<option value="${U.escapeHtml(status)}" ${status === plan.status ? "selected" : ""}>${U.escapeHtml(status)}</option>`)
      .join("");

    const batchText = plan.batchId
      ? (batchLabel ? batchLabel.label : U.str(plan.batchVersion, "未知版本"))
      : "未关联版本";

    return `<div class="tcm-plans-page">
      <header class="tcm-page-head">
        <div class="tcm-page-headline">
          <button type="button" class="tcm-icon-btn" data-tcm-plan-back="1" aria-label="返回计划列表">←</button>
          <div>
            <h3 class="tcm-page-title">${U.escapeHtml(plan.name)}</h3>
            <p class="tcm-page-desc">
              ${U.escapeHtml(batchText)} · 负责人 ${U.escapeHtml(U.str(plan.owner, "未指派"))} · ${U.escapeHtml(period)}
              · 引用用例 ${U.escapeHtml(String(U.toArray(plan.items).length))} 条
            </p>
          </div>
        </div>
        <div class="tcm-page-actions">
          <label class="tcm-inline-label">状态
            <select class="tcm-select" data-tcm-plan-status="${U.escapeHtml(plan.id)}" aria-label="计划状态">${statusOptions}</select>
          </label>
          <button type="button" class="tcm-btn" data-tcm-plan-edit="${U.escapeHtml(plan.id)}">编辑计划</button>
          <button type="button" class="tcm-btn tcm-btn-primary" data-tcm-plan-execute="${U.escapeHtml(plan.id)}">去执行台</button>
        </div>
      </header>

      ${plan.description ? `<p class="tcm-plan-desc">${U.escapeHtml(plan.description)}</p>` : ""}

      ${roundsHtml(plan, viewRound)}

      <section class="tcm-plan-progress">
        ${progressBarHtml(progress)}
        ${statChipsHtml(progress)}
      </section>

      <section class="tcm-plan-items">
        <div class="tcm-plan-items-head">
          <span class="tcm-plan-items-title">第 ${U.escapeHtml(String(viewRound))} 轮用例（${U.escapeHtml(String(progress.planned))} 条参与执行）</span>
          <div class="tcm-plan-items-actions">
            <button type="button" class="tcm-chip-btn" data-tcm-goto-library="1">＋ 从用例库添加</button>
            <button type="button" class="tcm-chip-btn" data-tcm-items-assign="1" ${itemSelection.size ? "" : "disabled"}>批量指派执行人${itemSelection.size ? `（${U.escapeHtml(String(itemSelection.size))}）` : ""}</button>
            <button type="button" class="tcm-chip-btn" data-tcm-items-exclude="1" ${itemSelection.size ? "" : "disabled"}>批量本轮移除</button>
            <button type="button" class="tcm-chip-btn tcm-chip-btn-ghost" data-tcm-items-remove="1" ${itemSelection.size ? "" : "disabled"}>批量移出计划</button>
          </div>
        </div>
        ${itemsHtml(plan, viewRound)}
      </section>

      <datalist id="tcmPlanMemberList">
        ${teamMembers().map((name) => `<option value="${U.escapeHtml(name)}"></option>`).join("")}
      </datalist>
    </div>`;
  }

  /* ------------------------------------------------------------------ *
   * 弹窗
   * ------------------------------------------------------------------ */

  /**
   * 生成计划表单弹窗。
   * @param {object} descriptor dialog 描述对象
   * @returns {string} HTML 片段
   */
  function planDialogHtml(descriptor) {
    const draft = descriptor.draft;
    const isEdit = descriptor.mode === "edit";
    const options = batchOptions()
      .map((item) => `<option value="${U.escapeHtml(item.id)}" ${item.id === draft.batchId ? "selected" : ""}>${U.escapeHtml(item.label)}</option>`)
      .join("");

    return `<div class="tcm-modal-backdrop" role="dialog" aria-modal="true" aria-label="${isEdit ? "编辑测试计划" : "新建测试计划"}">
      <div class="tcm-modal-mask" data-tcm-dialog-close="1"></div>
      <div class="tcm-modal tcm-modal-panel">
        <header class="tcm-modal-head">
          <h4 class="tcm-modal-title">${isEdit ? "编辑测试计划" : "新建测试计划"}</h4>
          <button type="button" class="tcm-icon-btn" data-tcm-dialog-close="1" aria-label="关闭">×</button>
        </header>
        <div class="tcm-modal-body">
          <div class="tcm-form-grid">
            <div class="tcm-field tcm-field-wide">
              <label class="tcm-field-label" for="tcmPlanName">计划名称<span class="tcm-required">*</span></label>
              <input type="text" id="tcmPlanName" class="tcm-inline-input" data-tcm-dialog-field="name"
                value="${U.escapeHtml(draft.name)}" placeholder="如：v2.3.0 回归测试计划" maxlength="120">
            </div>
            <div class="tcm-field">
              <label class="tcm-field-label" for="tcmPlanBatch">关联版本</label>
              <select id="tcmPlanBatch" class="tcm-select" data-tcm-dialog-field="batchId">
                <option value="">未关联版本</option>
                ${options}
              </select>
            </div>
            <div class="tcm-field">
              <label class="tcm-field-label" for="tcmPlanOwner">负责人</label>
              <input type="text" id="tcmPlanOwner" class="tcm-inline-input" list="tcmPlanDialogMembers"
                data-tcm-dialog-field="owner" value="${U.escapeHtml(draft.owner)}" placeholder="可自由输入">
            </div>
            <div class="tcm-field">
              <label class="tcm-field-label" for="tcmPlanStart">开始日期</label>
              <input type="date" id="tcmPlanStart" class="tcm-inline-input" data-tcm-dialog-field="startAt" value="${U.escapeHtml(draft.startAt)}">
            </div>
            <div class="tcm-field">
              <label class="tcm-field-label" for="tcmPlanEnd">结束日期</label>
              <input type="date" id="tcmPlanEnd" class="tcm-inline-input" data-tcm-dialog-field="endAt" value="${U.escapeHtml(draft.endAt)}">
            </div>
            <div class="tcm-field tcm-field-wide">
              <label class="tcm-field-label" for="tcmPlanDesc">计划说明</label>
              <textarea id="tcmPlanDesc" class="tcm-textarea" rows="3" data-tcm-dialog-field="description" placeholder="范围、风险、准入准出条件…">${U.escapeHtml(draft.description)}</textarea>
            </div>
          </div>
          <p class="tcm-field-hint">${isEdit ? "修改不会影响已有轮次与执行记录。" : "创建后自动生成「首轮」，随后可从用例库引用用例。"}</p>
          <p class="tcm-form-error" data-tcm-dialog-error hidden></p>
        </div>
        <footer class="tcm-modal-foot">
          <button type="button" class="tcm-btn tcm-btn-ghost" data-tcm-dialog-close="1">取消</button>
          <button type="button" class="tcm-btn tcm-btn-primary" data-tcm-dialog-submit="1">${isEdit ? "保存" : "创建计划"}</button>
        </footer>
      </div>
      <datalist id="tcmPlanDialogMembers">
        ${teamMembers().map((name) => `<option value="${U.escapeHtml(name)}"></option>`).join("")}
      </datalist>
    </div>`;
  }

  /**
   * 生成「加入计划」选择弹窗。
   * @param {object} descriptor dialog 描述对象
   * @returns {string} HTML 片段
   */
  function pickDialogHtml(descriptor) {
    const ids = U.toArray(descriptor.caseAssetIds);
    const assetMap = new Map(assets().map((asset) => [asset.id, asset]));
    const preview = ids.slice(0, 5)
      .map((id) => {
        const asset = assetMap.get(id);
        return `<li>${U.escapeHtml(asset ? U.str(asset.title, "未命名基础用例") : id)}</li>`;
      })
      .join("");
    const more = ids.length > 5 ? `<li class="tcm-muted">…等共 ${U.escapeHtml(String(ids.length))} 条</li>` : "";

    const openPlans = plans().filter((plan) => plan.status !== "已归档");
    const list = openPlans.length
      ? openPlans.map((plan) => {
          const exists = new Set(U.toArray(plan.items).map((item) => U.str(item.caseAssetId)));
          const dup = ids.filter((id) => exists.has(id)).length;
          return `<label class="tcm-pick-row">
            <input type="radio" name="tcmPickPlan" value="${U.escapeHtml(plan.id)}" ${plan.id === U.str(descriptor.planId) ? "checked" : ""}>
            <span class="tcm-pick-main">
              <span class="tcm-pick-title">${U.escapeHtml(plan.name)}</span>
              <span class="tcm-pick-meta">${U.escapeHtml(plan.status)} · 已有 ${U.escapeHtml(String(U.toArray(plan.items).length))} 条${dup ? ` · ${U.escapeHtml(String(dup))} 条重复将自动跳过` : ""}</span>
            </span>
          </label>`;
        }).join("")
      : `<p class="tcm-muted">当前没有可用计划，请先新建一个。</p>`;

    return `<div class="tcm-modal-backdrop" role="dialog" aria-modal="true" aria-label="加入测试计划">
      <div class="tcm-modal-mask" data-tcm-dialog-close="1"></div>
      <div class="tcm-modal tcm-modal-panel">
        <header class="tcm-modal-head">
          <h4 class="tcm-modal-title">加入测试计划</h4>
          <button type="button" class="tcm-icon-btn" data-tcm-dialog-close="1" aria-label="关闭">×</button>
        </header>
        <div class="tcm-modal-body">
          <p class="tcm-field-hint">将以下 <strong>${U.escapeHtml(String(ids.length))}</strong> 条用例<strong>引用</strong>进计划（不复制用例内容，正文仍以用例库为准）：</p>
          <ul class="tcm-pick-preview">${preview}${more}</ul>
          <div class="tcm-pick-list" role="radiogroup" aria-label="选择目标计划">${list}</div>
          <p class="tcm-form-error" data-tcm-dialog-error hidden></p>
        </div>
        <footer class="tcm-modal-foot">
          <button type="button" class="tcm-btn tcm-btn-ghost" data-tcm-dialog-close="1">取消</button>
          <button type="button" class="tcm-btn" data-tcm-pick-new="1">新建计划并加入</button>
          <button type="button" class="tcm-btn tcm-btn-primary" data-tcm-dialog-submit="1" ${openPlans.length ? "" : "disabled"}>加入所选计划</button>
        </footer>
      </div>
    </div>`;
  }

  /**
   * 当前弹窗 HTML。
   * @returns {string} HTML 片段
   */
  function dialogHtml() {
    if (!dialog) {
      return "";
    }
    if (dialog.kind === "plan") {
      return planDialogHtml(dialog);
    }
    if (dialog.kind === "pick") {
      return pickDialogHtml(dialog);
    }
    if (dialog.kind === "round") {
      return roundDialogHtml(dialog);
    }
    return "";
  }

  /**
   * 生成「新建轮次」弹窗。
   *
   * 用页内弹窗替代原生 prompt()：原生弹窗会阻塞渲染、无法样式化，
   * 且在部分嵌入式环境（iframe / 自动化）中被静默拦截。
   * @param {object} descriptor dialog 描述对象
   * @returns {string} HTML 片段
   */
  function roundDialogHtml(descriptor) {
    const isFailedOnly = U.str(descriptor.mode) === "failed";
    return `<div class="tcm-modal-backdrop" role="dialog" aria-modal="true" aria-label="新建测试轮次">
      <div class="tcm-modal-mask" data-tcm-dialog-close="1"></div>
      <div class="tcm-modal tcm-modal-panel">
        <header class="tcm-modal-head">
          <h4 class="tcm-modal-title">新建第 ${U.escapeHtml(String(descriptor.nextRound))} 轮</h4>
          <button type="button" class="tcm-icon-btn" data-tcm-dialog-close="1" aria-label="关闭">×</button>
        </header>
        <div class="tcm-modal-body">
          <p class="tcm-field-hint">
            将从第 ${U.escapeHtml(String(descriptor.sourceRound))} 轮带入
            <strong>${U.escapeHtml(String(descriptor.keepCount))}</strong> 条用例${isFailedOnly ? "（仅上轮<strong>失败 / 阻塞</strong>项）" : "（<strong>全量</strong>复制）"}。
            历史轮次的执行记录会完整保留。
          </p>
          <label class="tcm-field">
            <span class="tcm-field-label">轮次名称</span>
            <input type="text" id="tcmRoundName" class="tcm-input" data-tcm-dialog-field="name"
              value="${U.escapeHtml(U.str(descriptor.name))}" maxlength="40" autocomplete="off">
          </label>
          <p class="tcm-form-error" data-tcm-dialog-error hidden></p>
        </div>
        <footer class="tcm-modal-foot">
          <button type="button" class="tcm-btn tcm-btn-ghost" data-tcm-dialog-close="1">取消</button>
          <button type="button" class="tcm-btn tcm-btn-primary" data-tcm-dialog-submit="1">创建轮次</button>
        </footer>
      </div>
    </div>`;
  }

  /* ------------------------------------------------------------------ *
   * 主渲染
   * ------------------------------------------------------------------ */

  /**
   * 记录焦点，重渲染后恢复（避免输入执行人时失焦）。
   * @returns {{id:string,selector:string,start:number,end:number}|null} 焦点快照
   */
  function captureFocus() {
    if (!doc || !doc.activeElement || !rootEl || !rootEl.contains(doc.activeElement)) {
      return null;
    }
    const el = doc.activeElement;
    const executorKey = el.getAttribute ? el.getAttribute("data-tcm-item-executor") : "";
    const fieldKey = el.getAttribute ? el.getAttribute("data-tcm-dialog-field") : "";
    let selector = "";
    if (executorKey) {
      selector = `[data-tcm-item-executor="${executorKey}"]`;
    } else if (fieldKey) {
      selector = `[data-tcm-dialog-field="${fieldKey}"]`;
    } else if (el.id) {
      selector = `#${el.id}`;
    }
    if (!selector) {
      return null;
    }
    const snapshot = { selector, start: 0, end: 0 };
    if (typeof el.selectionStart === "number") {
      snapshot.start = el.selectionStart;
      snapshot.end = typeof el.selectionEnd === "number" ? el.selectionEnd : el.selectionStart;
    }
    return snapshot;
  }

  /**
   * 恢复焦点。
   * @param {{selector:string,start:number,end:number}|null} snapshot 焦点快照
   * @returns {void}
   */
  function restoreFocus(snapshot) {
    if (!snapshot || !rootEl) {
      return;
    }
    let el = null;
    try {
      el = rootEl.querySelector(snapshot.selector);
    } catch (_error) {
      el = null;
    }
    if (!el || typeof el.focus !== "function") {
      return;
    }
    el.focus();
    if (typeof el.setSelectionRange === "function") {
      try {
        el.setSelectionRange(snapshot.start, snapshot.end);
      } catch (_error) {
        // date / number 等类型不支持，忽略
      }
    }
  }

  /**
   * 渲染测试计划视图（幂等）。
   * @returns {void}
   */
  function render() {
    if (!doc) {
      return;
    }
    if (!rootEl) {
      rootEl = doc.getElementById("tcmPlansView");
    }
    if (!rootEl) {
      return;
    }

    const plan = activePlan();
    if (plan) {
      // 清理已被移出计划的选中项
      const live = new Set(U.toArray(plan.items).map((item) => U.str(item.caseAssetId)));
      Array.from(itemSelection).forEach((id) => {
        if (!live.has(id)) {
          itemSelection.delete(id);
        }
      });
    } else if (itemSelection.size) {
      itemSelection.clear();
    }

    const snapshot = captureFocus();
    rootEl.innerHTML = (plan ? detailHtml(plan) : listHtml()) + dialogHtml();
    rootEl.dataset.tcmRendered = plan ? `plan:${plan.id}` : "plan:list";
    restoreFocus(snapshot);
  }

  /**
   * 视图当前是否可见（bus 回调里避免无谓重渲染）。
   * @returns {boolean} 是否可见
   */
  function isVisible() {
    return Boolean(rootEl && rootEl.classList && rootEl.classList.contains("is-active"));
  }

  /**
   * bus 触发的惰性重渲染。
   * @returns {void}
   */
  function renderIfVisible() {
    if (isVisible()) {
      render();
    }
  }

  /* ------------------------------------------------------------------ *
   * 业务动作：计划 CRUD
   * ------------------------------------------------------------------ */

  /**
   * 打开计划表单弹窗。
   * @param {string} planId 计划 id，空串表示新建
   * @param {Array<string>} [pendingCaseIds] 创建成功后立即加入的用例 id（来自「新建计划并加入」）
   * @returns {void}
   */
  function openPlanDialog(planId, pendingCaseIds) {
    const id = U.str(planId);
    const source = id ? plans().find((plan) => plan.id === id) : null;
    dialog = {
      kind: "plan",
      mode: source ? "edit" : "create",
      planId: id,
      pendingCaseIds: U.toArray(pendingCaseIds).map((value) => U.str(value)).filter(Boolean),
      draft: {
        name: source ? U.str(source.name) : "",
        batchId: source ? U.str(source.batchId) : U.str(getState().activeBatchId),
        owner: source ? U.str(source.owner) : operator(),
        startAt: source ? U.str(source.startAt) : U.today(),
        endAt: source ? U.str(source.endAt) : "",
        description: source ? U.str(source.description) : ""
      }
    };
    render();
    const first = rootEl ? rootEl.querySelector('[data-tcm-dialog-field="name"]') : null;
    if (first && typeof first.focus === "function") {
      first.focus();
    }
  }

  /**
   * 关闭弹窗。
   * @returns {void}
   */
  function closeDialog() {
    dialog = null;
    render();
  }

  /**
   * 在弹窗内显示错误。
   * @param {string} message 错误文案
   * @returns {void}
   */
  function showDialogError(message) {
    if (!rootEl) {
      return;
    }
    const el = rootEl.querySelector("[data-tcm-dialog-error]");
    if (!el) {
      toast(message, "warning");
      return;
    }
    el.textContent = message;
    el.hidden = false;
  }

  /**
   * 从弹窗 DOM 收集最新草稿（避免每次输入都重渲染）。
   * @returns {void}
   */
  function syncDialogDraft() {
    if (!dialog || dialog.kind !== "plan" || !rootEl) {
      return;
    }
    const fields = rootEl.querySelectorAll("[data-tcm-dialog-field]");
    Array.prototype.forEach.call(fields, (el) => {
      dialog.draft[el.dataset.tcmDialogField] = U.str(el.value);
    });
  }

  /**
   * 提交计划表单。
   * @returns {void}
   */
  function submitPlanDialog() {
    syncDialogDraft();
    const draft = dialog.draft;
    const name = U.str(draft.name);
    if (!name) {
      showDialogError("请填写计划名称。");
      return;
    }
    if (draft.startAt && draft.endAt && draft.startAt > draft.endAt) {
      showDialogError("结束日期不能早于开始日期。");
      return;
    }

    const batch = batchOptions().find((item) => item.id === U.str(draft.batchId)) || null;
    const stamp = U.nowIso();
    const who = operator();

    if (dialog.mode === "edit") {
      const planId = dialog.planId;
      updatePlan(planId, (plan) => {
        plan.name = name;
        plan.batchId = batch ? batch.id : "";
        plan.batchVersion = batch ? batch.version : "";
        plan.owner = U.str(draft.owner);
        plan.startAt = U.dateOr(draft.startAt, "");
        plan.endAt = U.dateOr(draft.endAt, "");
        plan.description = U.str(draft.description);
        return plan;
      });
      dialog = null;
      TCM.bus.emit(C.EVENTS.PLAN_UPDATED, { planId, action: "edit" });
      toast("计划已更新。", "success");
      render();
      return;
    }

    const created = TCM.model.normalizeTestPlan({
      id: U.uid(C.ID_PREFIX.TEST_PLAN),
      name,
      batchId: batch ? batch.id : "",
      batchVersion: batch ? batch.version : "",
      owner: U.str(draft.owner),
      startAt: U.dateOr(draft.startAt, ""),
      endAt: U.dateOr(draft.endAt, ""),
      description: U.str(draft.description),
      status: "未开始",
      currentRound: 1,
      rounds: [{ round: 1, name: "首轮", status: "未开始" }],
      items: [],
      createdBy: who,
      createdAt: stamp,
      updatedBy: who,
      updatedAt: stamp
    }, { operator: who, now: stamp });

    TCM.store.commit("testPlans", plans().concat([created]), { source: "plans" });
    const pending = U.toArray(dialog.pendingCaseIds);
    dialog = null;
    TCM.bus.emit(C.EVENTS.PLAN_CREATED, { planId: created.id, name: created.name });

    if (pending.length) {
      addCasesToPlan(created.id, pending, { silentRender: true });
    }
    getState().tcmActivePlanId = created.id;
    getState().tcmActiveRound = 1;
    persistLocal();
    toast(pending.length ? `计划「${created.name}」已创建，并加入 ${pending.length} 条用例。` : `计划「${created.name}」已创建。`, "success");
    render();
  }

  /**
   * 删除计划（级联清理其执行实例）。
   * @param {string} planId 计划 id
   * @returns {void}
   */
  function deletePlan(planId) {
    const id = U.str(planId);
    const plan = plans().find((item) => item.id === id);
    if (!plan) {
      return;
    }
    const relatedExecs = executions().filter((item) => U.str(item.planId) === id);
    const message = relatedExecs.length
      ? `确认删除计划「${plan.name}」？将同时删除 ${relatedExecs.length} 条执行记录，此操作不可撤销。`
      : `确认删除计划「${plan.name}」？此操作不可撤销。`;
    if (typeof global.confirm === "function" && !global.confirm(message)) {
      return;
    }
    TCM.store.commit("testPlans", plans().filter((item) => item.id !== id), { source: "plans" });
    if (relatedExecs.length) {
      TCM.store.commit("caseExecutions", executions().filter((item) => U.str(item.planId) !== id), { source: "plans" });
    }
    if (activePlanId() === id) {
      getState().tcmActivePlanId = "";
      persistLocal();
    }
    TCM.bus.emit(C.EVENTS.PLAN_UPDATED, { planId: id, action: "delete" });
    toast("计划已删除。", "info");
    render();
  }

  /**
   * 切换计划状态。
   * @param {string} planId 计划 id
   * @param {string} nextStatus 目标状态
   * @returns {void}
   */
  function setPlanStatus(planId, nextStatus) {
    const status = U.oneOf(nextStatus, C.PLAN_STATUS, "");
    if (!status) {
      return;
    }
    updatePlan(planId, (plan) => {
      if (plan.status === status) {
        return plan;
      }
      const allowed = C.PLAN_STATUS_TRANSITIONS[plan.status] || [];
      if (!allowed.includes(status)) {
        toast(`不允许从「${plan.status}」直接切换到「${status}」。`, "warning");
        return null;
      }
      plan.status = status;
      return plan;
    });
    TCM.bus.emit(C.EVENTS.PLAN_UPDATED, { planId: U.str(planId), action: "status" });
    render();
  }

  /* ------------------------------------------------------------------ *
   * 业务动作：条目（引用用例）
   * ------------------------------------------------------------------ */

  /**
   * 向计划批量引用用例（去重；仅存 caseAssetId，**不复制用例内容**）。
   * @param {string} planId 计划 id
   * @param {Array<string>} caseAssetIds 用例 id 列表
   * @param {{silentRender?:boolean}} [options] silentRender=true 时不触发本模块 render
   * @returns {number} 实际新增条数
   */
  function addCasesToPlan(planId, caseAssetIds, options) {
    const opts = options && typeof options === "object" ? options : {};
    const ids = U.stringList(caseAssetIds);
    if (!ids.length) {
      return 0;
    }
    const liveAssets = new Set(assets().map((asset) => asset.id));
    const valid = ids.filter((id) => liveAssets.has(id));
    if (!valid.length) {
      toast("选中的用例在用例库中已不存在。", "warning");
      return 0;
    }

    let added = 0;
    const updated = updatePlan(planId, (plan) => {
      const exists = new Set(U.toArray(plan.items).map((item) => U.str(item.caseAssetId)));
      const current = U.num(plan.currentRound, 1, 1);
      // 历史轮次不追溯：新加入的用例只从「当前轮」开始参与
      const pastRounds = U.toArray(plan.rounds)
        .map((item) => U.num(item.round, 1, 1))
        .filter((round) => round < current);
      const stamp = U.nowIso();
      const who = operator();
      let order = U.toArray(plan.items).length;
      valid.forEach((caseAssetId) => {
        if (exists.has(caseAssetId)) {
          return;
        }
        exists.add(caseAssetId);
        order += 1;
        added += 1;
        plan.items.push({
          caseAssetId,
          executor: U.str(plan.owner),
          order,
          excludedRounds: pastRounds.slice(),
          addedBy: who,
          addedAt: stamp
        });
      });
      return plan;
    });

    if (!updated) {
      return 0;
    }
    if (added) {
      TCM.bus.emit(C.EVENTS.PLAN_ITEMS_CHANGED, {
        action: "added",
        planId: U.str(planId),
        caseAssetIds: valid,
        count: added
      });
    }
    if (!opts.silentRender) {
      const skipped = valid.length - added;
      toast(
        added
          ? `已引用 ${added} 条用例${skipped ? `（${skipped} 条已在计划中，自动跳过）` : ""}。`
          : "选中的用例已全部在该计划中。",
        added ? "success" : "info"
      );
      render();
    }
    return added;
  }

  /**
   * 从计划中彻底移除条目（同时清理其执行记录）。
   * @param {Array<string>} caseAssetIds 用例 id 列表
   * @returns {void}
   */
  function removeItems(caseAssetIds) {
    const plan = activePlan();
    if (!plan) {
      return;
    }
    const ids = new Set(U.stringList(caseAssetIds));
    if (!ids.size) {
      return;
    }
    const relatedExecs = executions().filter(
      (item) => U.str(item.planId) === plan.id && ids.has(U.str(item.caseAssetId))
    );
    const executed = relatedExecs.filter((item) => U.str(item.status) !== C.DEFAULTS.EXEC_STATUS).length;
    const message = executed
      ? `确认将 ${ids.size} 条用例移出计划？其中 ${executed} 条已有执行结果，记录会一并删除。`
      : `确认将 ${ids.size} 条用例移出计划？`;
    if (typeof global.confirm === "function" && !global.confirm(message)) {
      return;
    }

    updatePlan(plan.id, (draft) => {
      draft.items = U.toArray(draft.items).filter((item) => !ids.has(U.str(item.caseAssetId)));
      draft.items.forEach((item, index) => {
        item.order = index + 1;
      });
      return draft;
    });
    if (relatedExecs.length) {
      const execIds = new Set(relatedExecs.map((item) => item.id));
      TCM.store.commit("caseExecutions", executions().filter((item) => !execIds.has(item.id)), { source: "plans" });
    }
    itemSelection.clear();
    TCM.bus.emit(C.EVENTS.PLAN_ITEMS_CHANGED, {
      action: "removed",
      planId: plan.id,
      caseAssetIds: Array.from(ids),
      count: ids.size
    });
    toast(`已移出 ${ids.size} 条用例。`, "info");
    render();
  }

  /**
   * 将条目移出 / 恢复到某一轮（写 excludedRounds，不影响其他轮次数据）。
   * @param {Array<string>} caseAssetIds 用例 id 列表
   * @param {number} round 轮次号
   * @param {boolean} excluded true=本轮移除，false=恢复本轮
   * @returns {void}
   */
  function setItemsExcluded(caseAssetIds, round, excluded) {
    const plan = activePlan();
    if (!plan) {
      return;
    }
    const ids = new Set(U.stringList(caseAssetIds));
    if (!ids.size) {
      return;
    }
    const roundNo = U.num(round, 1, 1);
    updatePlan(plan.id, (draft) => {
      U.toArray(draft.items).forEach((item) => {
        if (!ids.has(U.str(item.caseAssetId))) {
          return;
        }
        const set = new Set(U.toArray(item.excludedRounds).map((value) => U.num(value, 0, 0)));
        if (excluded) {
          set.add(roundNo);
        } else {
          set.delete(roundNo);
        }
        item.excludedRounds = Array.from(set).sort((a, b) => a - b);
      });
      return draft;
    });
    itemSelection.clear();
    TCM.bus.emit(C.EVENTS.PLAN_ITEMS_CHANGED, {
      action: "excluded",
      planId: plan.id,
      round: roundNo,
      caseAssetIds: Array.from(ids),
      count: ids.size
    });
    toast(excluded ? `已将 ${ids.size} 条用例移出第 ${roundNo} 轮。` : `已恢复 ${ids.size} 条用例到第 ${roundNo} 轮。`, "info");
    render();
  }

  /**
   * 指派执行人（单条 / 批量）。
   * @param {Array<string>} caseAssetIds 用例 id 列表
   * @param {string} executor 执行人（空串表示取消指派）
   * @param {{quiet?:boolean}} [options] quiet=true 时不弹提示、不重渲染
   * @returns {void}
   */
  function assignExecutor(caseAssetIds, executor, options) {
    const opts = options && typeof options === "object" ? options : {};
    const plan = activePlan();
    if (!plan) {
      return;
    }
    const ids = new Set(U.stringList(caseAssetIds));
    if (!ids.size) {
      return;
    }
    const name = U.str(executor);
    const round = activeRound(plan);

    updatePlan(plan.id, (draft) => {
      U.toArray(draft.items).forEach((item) => {
        if (ids.has(U.str(item.caseAssetId))) {
          item.executor = name;
        }
      });
      return draft;
    });

    // 同步「未执行」的执行实例执行人（已出结果的保留历史执行人）
    let touched = false;
    const nextExecs = executions().map((item) => {
      if (U.str(item.planId) !== plan.id || U.num(item.round, 1, 1) !== round) {
        return item;
      }
      if (!ids.has(U.str(item.caseAssetId)) || U.str(item.status) !== C.DEFAULTS.EXEC_STATUS) {
        return item;
      }
      touched = true;
      return Object.assign({}, item, { executor: name, updatedAt: U.nowIso() });
    });
    if (touched) {
      TCM.store.commit("caseExecutions", nextExecs, { source: "plans" });
    }

    TCM.bus.emit(C.EVENTS.PLAN_ITEMS_CHANGED, {
      action: "executor",
      planId: plan.id,
      caseAssetIds: Array.from(ids),
      executor: name,
      count: ids.size
    });

    if (!opts.quiet) {
      itemSelection.clear();
      toast(name ? `已指派 ${ids.size} 条用例给「${name}」。` : `已取消 ${ids.size} 条用例的执行人指派。`, "success");
      render();
    }
  }

  /* ------------------------------------------------------------------ *
   * 业务动作：轮次
   * ------------------------------------------------------------------ */

  /**
   * 新建轮次。
   * @param {string} mode `all` 复制上一轮全量 / `failed` 仅上一轮失败与阻塞
   * @returns {void}
   */
  function createRound(mode) {
    const plan = activePlan();
    if (!plan) {
      return;
    }
    const sourceRound = U.num(plan.currentRound, 1, 1);
    const nextRound = TCM.model.nextRoundNumber(plan);
    const keep = new Set(TCM.model.planRoundCandidates(plan, sourceRound, mode, executions()));

    if (!keep.size) {
      toast(
        mode === "failed"
          ? `第 ${sourceRound} 轮没有失败或阻塞的用例，无需新建复测轮。`
          : "计划里还没有用例，请先从用例库引用用例。",
        "warning"
      );
      return;
    }

    dialog = {
      kind: "round",
      mode: U.str(mode, "all"),
      sourceRound,
      nextRound,
      keepCount: keep.size,
      name: mode === "failed" ? `复测轮 ${nextRound}` : `回归轮 ${nextRound}`
    };
    render();
  }

  /**
   * 提交「新建轮次」弹窗：真正写入新轮次。
   * @returns {void}
   */
  function submitRoundDialog() {
    if (!dialog || dialog.kind !== "round" || !rootEl) {
      return;
    }
    const plan = activePlan();
    if (!plan) {
      dialog = null;
      render();
      return;
    }
    const field = rootEl.querySelector('[data-tcm-dialog-field="name"]');
    const defaultName = U.str(dialog.name, `回归轮 ${dialog.nextRound}`);
    const name = U.str(field ? field.value : "", defaultName).trim() || defaultName;

    const mode = U.str(dialog.mode, "all");
    const sourceRound = U.num(dialog.sourceRound, 1, 1);
    const nextRound = U.num(dialog.nextRound, 2, 2);
    const keep = new Set(TCM.model.planRoundCandidates(plan, sourceRound, mode, executions()));
    if (!keep.size) {
      showDialogError("上一轮没有可带入的用例。");
      return;
    }
    dialog = null;

    updatePlan(plan.id, (draft) => {
      draft.rounds.push({ round: nextRound, name, status: "未开始", startedAt: "", finishedAt: "" });
      U.toArray(draft.items).forEach((item) => {
        if (keep.has(U.str(item.caseAssetId))) {
          return;
        }
        const set = new Set(U.toArray(item.excludedRounds).map((value) => U.num(value, 0, 0)));
        set.add(nextRound);
        item.excludedRounds = Array.from(set).sort((a, b) => a - b);
      });
      draft.currentRound = nextRound;
      if (draft.status === "已完成") {
        draft.status = "进行中";
      }
      return draft;
    });

    getState().tcmActiveRound = nextRound;
    itemSelection.clear();
    persistLocal();
    TCM.bus.emit(C.EVENTS.PLAN_ITEMS_CHANGED, { action: "round", planId: plan.id, round: nextRound, count: keep.size });
    toast(`已创建「${name}」，带入 ${keep.size} 条用例。`, "success");
    render();
  }

  /**
   * 删除最后一轮（连同其执行记录）。
   * @param {number} round 轮次号
   * @returns {void}
   */
  function deleteRound(round) {
    const plan = activePlan();
    if (!plan) {
      return;
    }
    const roundNo = U.num(round, 1, 1);
    if (U.toArray(plan.rounds).length <= 1) {
      toast("至少保留 1 个轮次。", "warning");
      return;
    }
    if (typeof global.confirm === "function" && !global.confirm(`确认删除第 ${roundNo} 轮？该轮的执行记录会一并删除。`)) {
      return;
    }
    updatePlan(plan.id, (draft) => {
      draft.rounds = U.toArray(draft.rounds).filter((item) => U.num(item.round, 1, 1) !== roundNo);
      U.toArray(draft.items).forEach((item) => {
        item.excludedRounds = U.toArray(item.excludedRounds)
          .map((value) => U.num(value, 0, 0))
          .filter((value) => value !== roundNo);
      });
      const remain = draft.rounds.map((item) => U.num(item.round, 1, 1));
      if (!remain.includes(U.num(draft.currentRound, 1, 1))) {
        draft.currentRound = Math.max.apply(null, remain);
      }
      return draft;
    });
    TCM.store.commit(
      "caseExecutions",
      executions().filter((item) => !(U.str(item.planId) === plan.id && U.num(item.round, 1, 1) === roundNo)),
      { source: "plans" }
    );
    const refreshed = plans().find((item) => item.id === plan.id);
    getState().tcmActiveRound = refreshed ? U.num(refreshed.currentRound, 1, 1) : 1;
    itemSelection.clear();
    persistLocal();
    TCM.bus.emit(C.EVENTS.PLAN_ITEMS_CHANGED, { action: "round", planId: plan.id, round: roundNo, count: 0 });
    toast(`第 ${roundNo} 轮已删除。`, "info");
    render();
  }

  /**
   * 设置当前轮次。
   * @param {number} round 轮次号
   * @returns {void}
   */
  function setCurrentRound(round) {
    const plan = activePlan();
    if (!plan) {
      return;
    }
    const roundNo = U.num(round, 1, 1);
    updatePlan(plan.id, (draft) => {
      draft.currentRound = roundNo;
      return draft;
    });
    getState().tcmActiveRound = roundNo;
    persistLocal();
    TCM.bus.emit(C.EVENTS.PLAN_UPDATED, { planId: plan.id, action: "currentRound", round: roundNo });
    toast(`已切换当前轮次为第 ${roundNo} 轮。`, "success");
    render();
  }

  /**
   * 切换轮次状态。
   * @param {number} round 轮次号
   * @param {string} status 目标状态
   * @returns {void}
   */
  function setRoundStatus(round, status) {
    const plan = activePlan();
    if (!plan) {
      return;
    }
    const roundNo = U.num(round, 1, 1);
    const target = U.oneOf(status, C.ROUND_STATUS, "");
    if (!target) {
      return;
    }
    const stamp = U.nowIso();
    updatePlan(plan.id, (draft) => {
      U.toArray(draft.rounds).forEach((item) => {
        if (U.num(item.round, 1, 1) !== roundNo) {
          return;
        }
        item.status = target;
        if (target === "进行中" && !item.startedAt) {
          item.startedAt = stamp;
        }
        if (target === "已完成") {
          item.finishedAt = stamp;
        }
      });
      if (target === "进行中" && draft.status === "未开始") {
        draft.status = "进行中";
      }
      return draft;
    });
    TCM.bus.emit(C.EVENTS.PLAN_UPDATED, { planId: plan.id, action: "roundStatus", round: roundNo, status: target });
    render();
  }

  /* ------------------------------------------------------------------ *
   * bus：来自用例库的「加入计划」请求
   * ------------------------------------------------------------------ */

  /**
   * 处理 plan:itemsChanged 事件。只响应 action==='request-add'，
   * 其余（本模块自己广播的 added/removed/...）直接忽略，避免事件回环。
   * @param {{action?:string, caseAssetIds?:Array<string>}} payload 事件负载
   * @returns {void}
   */
  function onItemsChanged(payload) {
    const data = payload && typeof payload === "object" ? payload : {};
    if (U.str(data.action) !== "request-add") {
      return;
    }
    const ids = U.stringList(data.caseAssetIds);
    if (!ids.length) {
      toast("请先在用例库勾选要加入计划的用例。", "warning");
      return;
    }
    // 切到「测试计划」子 Tab 才能看到选择框（shell 是容器所有者，允许调用）
    if (TCM.shell && typeof TCM.shell.setActive === "function") {
      TCM.shell.setActive("plans");
    }
    dialog = { kind: "pick", caseAssetIds: ids, planId: activePlanId() };
    render();
  }

  /**
   * 提交「加入计划」选择框。
   * @returns {void}
   */
  function submitPickDialog() {
    if (!rootEl) {
      return;
    }
    const checked = rootEl.querySelector('input[name="tcmPickPlan"]:checked');
    if (!checked) {
      showDialogError("请选择一个目标计划。");
      return;
    }
    const planId = U.str(checked.value);
    const ids = U.toArray(dialog.caseAssetIds);
    dialog = null;
    getState().tcmActivePlanId = planId;
    const plan = plans().find((item) => item.id === planId);
    getState().tcmActiveRound = plan ? U.num(plan.currentRound, 1, 1) : 1;
    persistLocal();
    addCasesToPlan(planId, ids);
  }

  /* ------------------------------------------------------------------ *
   * 事件委托
   * ------------------------------------------------------------------ */

  /**
   * 点击事件总处理。
   * @param {MouseEvent} event 事件对象
   * @returns {void}
   */
  function onClick(event) {
    const target = event.target;
    if (!target || typeof target.closest !== "function") {
      return;
    }

    if (target.closest("[data-tcm-dialog-close]")) {
      closeDialog();
      return;
    }
    if (target.closest("[data-tcm-dialog-submit]")) {
      if (dialog && dialog.kind === "plan") {
        submitPlanDialog();
      } else if (dialog && dialog.kind === "pick") {
        submitPickDialog();
      } else if (dialog && dialog.kind === "round") {
        submitRoundDialog();
      }
      return;
    }
    if (target.closest("[data-tcm-pick-new]")) {
      const ids = dialog && dialog.kind === "pick" ? U.toArray(dialog.caseAssetIds) : [];
      openPlanDialog("", ids);
      return;
    }
    if (target.closest("[data-tcm-plan-new]")) {
      openPlanDialog("", []);
      return;
    }

    const editBtn = target.closest("[data-tcm-plan-edit]");
    if (editBtn) {
      event.stopPropagation();
      openPlanDialog(editBtn.dataset.tcmPlanEdit, []);
      return;
    }

    const deleteBtn = target.closest("[data-tcm-plan-delete]");
    if (deleteBtn) {
      event.stopPropagation();
      deletePlan(deleteBtn.dataset.tcmPlanDelete);
      return;
    }

    const execBtn = target.closest("[data-tcm-plan-execute]");
    if (execBtn) {
      event.stopPropagation();
      const planId = U.str(execBtn.dataset.tcmPlanExecute);
      const plan = plans().find((item) => item.id === planId);
      getState().tcmActivePlanId = planId;
      getState().tcmActiveRound = plan ? U.num(plan.currentRound, 1, 1) : 1;
      persistLocal();
      if (TCM.shell && typeof TCM.shell.setActive === "function") {
        TCM.shell.setActive("execution");
      }
      return;
    }

    if (target.closest("[data-tcm-plan-back]")) {
      setActivePlan("");
      return;
    }

    if (target.closest("[data-tcm-goto-library]")) {
      toast("在用例库勾选用例后点击「加入计划」，即可引用到本计划。", "info");
      if (TCM.shell && typeof TCM.shell.setActive === "function") {
        TCM.shell.setActive("library");
      }
      return;
    }

    const roundBtn = target.closest("[data-tcm-plan-round]");
    if (roundBtn) {
      setActiveRound(roundBtn.dataset.tcmPlanRound);
      return;
    }

    const newRoundBtn = target.closest("[data-tcm-round-new]");
    if (newRoundBtn) {
      createRound(newRoundBtn.dataset.tcmRoundNew);
      return;
    }

    const setCurrentBtn = target.closest("[data-tcm-round-setcurrent]");
    if (setCurrentBtn) {
      setCurrentRound(setCurrentBtn.dataset.tcmRoundSetcurrent);
      return;
    }

    const roundStatusBtn = target.closest("[data-tcm-round-status]");
    if (roundStatusBtn) {
      const parts = String(roundStatusBtn.dataset.tcmRoundStatus).split("|");
      setRoundStatus(parts[0], parts[1]);
      return;
    }

    const roundDeleteBtn = target.closest("[data-tcm-round-delete]");
    if (roundDeleteBtn) {
      deleteRound(roundDeleteBtn.dataset.tcmRoundDelete);
      return;
    }

    const excludeBtn = target.closest("[data-tcm-item-exclude]");
    if (excludeBtn) {
      setItemsExcluded([excludeBtn.dataset.tcmItemExclude], activeRound(null), true);
      return;
    }

    const includeBtn = target.closest("[data-tcm-item-include]");
    if (includeBtn) {
      setItemsExcluded([includeBtn.dataset.tcmItemInclude], activeRound(null), false);
      return;
    }

    const removeBtn = target.closest("[data-tcm-item-remove]");
    if (removeBtn) {
      removeItems([removeBtn.dataset.tcmItemRemove]);
      return;
    }

    if (target.closest("[data-tcm-items-assign]")) {
      const input = typeof global.prompt === "function"
        ? global.prompt(`为选中的 ${itemSelection.size} 条用例指派执行人（留空=取消指派）：`, operator())
        : null;
      if (input === null) {
        return;
      }
      assignExecutor(Array.from(itemSelection), input);
      return;
    }

    if (target.closest("[data-tcm-items-exclude]")) {
      setItemsExcluded(Array.from(itemSelection), activeRound(null), true);
      return;
    }

    if (target.closest("[data-tcm-items-remove]")) {
      removeItems(Array.from(itemSelection));
      return;
    }

    const card = target.closest("[data-tcm-plan-open]");
    if (card) {
      setActivePlan(card.dataset.tcmPlanOpen);
    }
  }

  /**
   * change 事件总处理。
   * @param {Event} event 事件对象
   * @returns {void}
   */
  function onChange(event) {
    const target = event.target;
    if (!target || typeof target.closest !== "function") {
      return;
    }

    const checkAll = target.closest("[data-tcm-item-check-all]");
    if (checkAll) {
      const plan = activePlan();
      if (!plan) {
        return;
      }
      itemSelection.clear();
      if (checkAll.checked) {
        U.toArray(plan.items).forEach((item) => itemSelection.add(U.str(item.caseAssetId)));
      }
      render();
      return;
    }

    const check = target.closest("[data-tcm-item-check]");
    if (check) {
      const id = U.str(check.dataset.tcmItemCheck);
      if (check.checked) {
        itemSelection.add(id);
      } else {
        itemSelection.delete(id);
      }
      render();
      return;
    }

    const executorInput = target.closest("[data-tcm-item-executor]");
    if (executorInput) {
      assignExecutor([executorInput.dataset.tcmItemExecutor], executorInput.value, { quiet: true });
      return;
    }

    const statusSelect = target.closest("[data-tcm-plan-status]");
    if (statusSelect) {
      setPlanStatus(statusSelect.dataset.tcmPlanStatus, statusSelect.value);
      return;
    }

    if (target.closest("[data-tcm-dialog-field]")) {
      syncDialogDraft();
    }
  }

  /**
   * 键盘事件：ESC 关弹窗，Enter 提交表单，卡片上 Enter/Space 打开。
   * @param {KeyboardEvent} event 事件对象
   * @returns {void}
   */
  function onKeydown(event) {
    if (event.key === "Escape" && dialog) {
      event.preventDefault();
      closeDialog();
      return;
    }
    if (event.key === "Enter" && dialog && (dialog.kind === "plan" || dialog.kind === "round")) {
      const field = event.target && typeof event.target.closest === "function"
        ? event.target.closest("[data-tcm-dialog-field]")
        : null;
      if (field && field.tagName !== "TEXTAREA") {
        event.preventDefault();
        if (dialog.kind === "round") {
          submitRoundDialog();
        } else {
          submitPlanDialog();
        }
      }
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && event.target && typeof event.target.closest === "function") {
      const card = event.target.closest("[data-tcm-plan-open]");
      if (card && card === event.target) {
        event.preventDefault();
        setActivePlan(card.dataset.tcmPlanOpen);
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * 生命周期
   * ------------------------------------------------------------------ */

  /**
   * 订阅跨模块 bus 事件（进程内只订阅一次，与 DOM 挂载解耦）。
   *
   * 之所以不放在 mount()：用例库批量「加入计划」时本视图可能尚未被访问过，
   * 若订阅依赖 mount 会导致事件被静默丢弃。
   * @returns {void}
   */
  function bindBusOnce() {
    if (busBound || !TCM.bus || typeof TCM.bus.on !== "function") {
      return;
    }
    TCM.bus.on(C.EVENTS.PLAN_ITEMS_CHANGED, onItemsChanged);
    TCM.bus.on(C.EVENTS.EXEC_MARKED, renderIfVisible);
    TCM.bus.on(C.EVENTS.CASE_DELETED, renderIfVisible);
    TCM.bus.on(C.EVENTS.PLAN_FOCUS, onPlanFocus);
    busBound = true;
  }

  /**
   * 处理「定位到某个计划」请求（T04 追溯图谱发起）。
   *
   * 只切换当前打开的计划并激活本视图，**不改任何业务数据**。
   * @param {{planId?:string, source?:string}} payload 事件负载
   * @returns {void}
   */
  function onPlanFocus(payload) {
    const data = payload && typeof payload === "object" ? payload : {};
    if (U.str(data.source) === "plans") {
      return;
    }
    const planId = U.str(data.planId);
    if (!planId || !plans().some((plan) => U.str(plan.id) === planId)) {
      return;
    }
    if (TCM.shell && typeof TCM.shell.setActive === "function") {
      TCM.shell.setActive("plans");
    }
    setActivePlan(planId);
  }

  /**
   * 挂载视图：绑定 DOM 事件委托（只绑一次）。
   * @param {HTMLElement} [root] #tcmPlansView 容器
   * @returns {void}
   */
  function mount(root) {
    if (!doc) {
      return;
    }
    bindBusOnce();
    rootEl = root || doc.getElementById("tcmPlansView");
    if (!rootEl || mounted) {
      return;
    }
    rootEl.addEventListener("click", onClick);
    rootEl.addEventListener("change", onChange);
    rootEl.addEventListener("keydown", onKeydown);
    mounted = true;
  }

  /**
   * 卸载：解绑 DOM 事件。
   *
   * 注意：**不解绑 bus**——跨模块入口（加入计划）必须在整个页面生命周期内可用，
   * 且 bindBusOnce 有幂等保护，重新 mount 不会重复订阅。
   * @returns {void}
   */
  function destroy() {
    if (rootEl) {
      rootEl.removeEventListener("click", onClick);
      rootEl.removeEventListener("change", onChange);
      rootEl.removeEventListener("keydown", onKeydown);
    }
    itemSelection.clear();
    dialog = null;
    mounted = false;
  }

  // 模块加载即订阅跨模块事件，保证「库 → 计划」链路不依赖视图是否被访问过。
  bindBusOnce();

  TCM.plans = {
    mount,
    render,
    destroy,
    // 供其他模块（执行台 / 看板）只读复用
    addCasesToPlan,
    openPlanDialog,
    setActivePlan,
    activePlanId,
    activeRound,
    progressOf
  };
})(typeof window !== "undefined" ? window : globalThis);
