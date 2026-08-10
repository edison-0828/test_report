/**
 * tcm-dashboard.js —— 测试用例管理模块 L3 视图层：统计看板（T04）
 *
 * 职责：
 *   1. 呈现 PRD §6.7 五大指标（需求覆盖率 / 计划执行率 / 通过率 / 缺陷拦截率 / 自动化占比），
 *      每个指标一张卡片 + 内联 SVG 环形图（无第三方图表库）。
 *   2. 数据窗口切换（本迭代 batch / 滚动 30 天 rolling30 / 全部 all），偏好写入
 *      `state.tcmDashboardWindow`（已在 app.js LOCAL_STATE_KEYS 白名单内）。
 *   3. 下钻：按「业务线 / 用例类型 / 优先级」三个维度做纯 CSS 柱状图，
 *      展示用例数、执行进度、通过率、缺陷数、自动化率。
 *   4. 覆盖缺口：单独列出「无用例的需求」，支持一键跳到追溯图谱定位。
 *
 * 所有指标计算都在 `TCM.model.computeMetrics()` 纯函数里完成，本文件只负责渲染与交互，
 * 保证口径可被 tests/tcm-model.test.js 直接覆盖。
 *
 * 跨模块契约（只走 TCM.bus）：
 *   订阅：case:updated / case:deleted / case:batchChanged / plan:updated /
 *         plan:itemsChanged / exec:marked / exec:bugCreated / review:concluded → 可见时重渲染
 *   广播：req:focus  { requirementId, source:'dashboard' }   // 跳追溯图谱
 *         case:focus { caseId, source:'dashboard' }          // 跳用例库
 */
(function (global) {
  "use strict";

  const TCM = global.TCM = global.TCM || {};
  const C = TCM.const;
  const U = TCM.util;

  if (!C || !U) {
    throw new Error("[tcm-dashboard] 依赖缺失：请确保 tcm-core.js 在 tcm-dashboard.js 之前加载。");
  }

  const doc = global.document;

  /** 视图根容器 */
  let rootEl = null;

  /** DOM 事件是否已绑定（mount 一次） */
  let mounted = false;

  /** bus 是否已订阅（进程内一次） */
  let busBound = false;

  /** 当前下钻维度：business / type / priority */
  let drillDim = "business";

  /** 覆盖缺口清单是否展开 */
  let gapOpen = false;

  /** 下钻维度定义 */
  const DRILL_DIMS = Object.freeze([
    { key: "business", label: "业务线" },
    { key: "type", label: "用例类型" },
    { key: "priority", label: "优先级" }
  ]);

  /** 下钻维度 key 列表 */
  const DRILL_KEYS = Object.freeze(DRILL_DIMS.map((item) => item.key));

  /** 环形图几何参数（viewBox 100×100） */
  const RING = Object.freeze({ size: 100, cx: 50, cy: 50, r: 40, width: 12 });

  /** 环形周长（2πr） */
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING.r;

  /** 执行状态 → 柱状分段修饰类 */
  const EXEC_SEGMENT_CLASS = Object.freeze({
    passed: "is-passed",
    failed: "is-failed",
    blocked: "is-blocked",
    skipped: "is-skipped",
    notRun: "is-notrun"
  });

  /* ------------------------------------------------------------------ *
   * 一、基础工具
   * ------------------------------------------------------------------ */

  /**
   * 读取全局状态对象。
   * @returns {object} state 引用
   */
  function getState() {
    return TCM.store && typeof TCM.store.getState === "function"
      ? TCM.store.getState()
      : (global.state || {});
  }

  /**
   * 读取集合。
   * @param {string} name 集合名
   * @returns {Array<object>} 集合数组
   */
  function collection(name) {
    return TCM.store && typeof TCM.store.collection === "function"
      ? TCM.store.collection(name)
      : U.toArray(getState()[name]);
  }

  /**
   * 触发本地偏好持久化（走 app.js 的 persist）。
   * @returns {void}
   */
  function persistLocal() {
    if (typeof global.persist === "function") {
      try {
        global.persist();
      } catch (error) {
        if (global.console && typeof global.console.warn === "function") {
          global.console.warn("[TCM.dashboard] 持久化本地偏好失败", error);
        }
      }
    }
  }

  /**
   * 视图是否可见。
   * @returns {boolean} 是否可见
   */
  function isVisible() {
    return Boolean(rootEl && rootEl.classList && rootEl.classList.contains("is-active"));
  }

  /**
   * 仅在视图可见时重渲染。
   * @returns {void}
   */
  function renderIfVisible() {
    if (isVisible()) {
      render();
    }
  }

  /**
   * 当前数据窗口（读本地偏好，非法值回落到默认「本迭代」）。
   * @returns {string} 窗口 key
   */
  function currentWindow() {
    return U.oneOf(U.str(getState().tcmDashboardWindow), C.METRIC_WINDOW_KEYS, C.METRIC_WINDOW_KEYS[0]);
  }

  /**
   * 切换数据窗口并持久化。
   * @param {string} key 窗口 key
   * @returns {void}
   */
  function setWindow(key) {
    const target = U.oneOf(U.str(key), C.METRIC_WINDOW_KEYS, C.METRIC_WINDOW_KEYS[0]);
    const state = getState();
    if (U.str(state.tcmDashboardWindow) === target) {
      return;
    }
    state.tcmDashboardWindow = target;
    persistLocal();
    render();
  }

  /**
   * 切换下钻维度。
   * @param {string} key 维度 key
   * @returns {void}
   */
  function setDrill(key) {
    const target = U.oneOf(U.str(key), DRILL_KEYS, DRILL_KEYS[0]);
    if (drillDim === target) {
      return;
    }
    drillDim = target;
    render();
  }

  /**
   * 汇总当前窗口的指标（全部委托 model 纯函数）。
   * @returns {object} computeMetrics 结果
   */
  function currentMetrics() {
    const state = getState();
    return TCM.model.computeMetrics({
      assets: collection("basicCaseLibrary"),
      plans: collection("testPlans"),
      executions: collection("caseExecutions"),
      reviews: collection("reviewTickets"),
      bugs: U.toArray(state.bugs),
      batches: U.toArray(state.batches),
      tasks: U.toArray(state.tasks),
      activeBatchId: U.str(state.activeBatchId),
      window: currentWindow(),
      now: U.nowIso()
    });
  }

  /**
   * 百分比数值转显示串。
   * @param {number} value 百分比（0~100）
   * @returns {string} 形如 `86.7%`
   */
  function pct(value) {
    const num = U.num(value, 0, 0);
    const fixed = Number.isInteger(num) ? String(num) : num.toFixed(1);
    return `${fixed}%`;
  }

  /* ------------------------------------------------------------------ *
   * 二、内联 SVG 环形图
   * ------------------------------------------------------------------ */

  /**
   * 渲染一个内联 SVG 环形进度图（零依赖）。
   * @param {number} value 百分比（0~100）
   * @param {string} tone 色调修饰类（tone-green / tone-blue / …）
   * @returns {string} SVG 片段
   */
  function ringHtml(value, tone) {
    const safe = Math.max(0, Math.min(100, U.num(value, 0, 0)));
    const dash = (RING_CIRCUMFERENCE * safe) / 100;
    const gap = Math.max(0, RING_CIRCUMFERENCE - dash);
    return `<svg class="tcm-db-ring ${U.escapeHtml(tone)}" viewBox="0 0 ${RING.size} ${RING.size}" role="img" aria-label="${U.escapeHtml(pct(safe))}">
      <circle class="tcm-db-ring-track" cx="${RING.cx}" cy="${RING.cy}" r="${RING.r}" fill="none" stroke-width="${RING.width}"></circle>
      <circle class="tcm-db-ring-fill" cx="${RING.cx}" cy="${RING.cy}" r="${RING.r}" fill="none" stroke-width="${RING.width}"
        stroke-linecap="round"
        stroke-dasharray="${U.escapeHtml(dash.toFixed(2))} ${U.escapeHtml(gap.toFixed(2))}"
        transform="rotate(-90 ${RING.cx} ${RING.cy})"></circle>
      <text class="tcm-db-ring-text" x="${RING.cx}" y="${RING.cy}" text-anchor="middle" dominant-baseline="central">${U.escapeHtml(pct(safe))}</text>
    </svg>`;
  }

  /**
   * 按百分比挑色调（越高越绿）。
   * @param {number} value 百分比
   * @param {{good?:number, warn?:number}} [thresholds] 阈值
   * @returns {string} 色调类
   */
  function toneOf(value, thresholds) {
    const opts = thresholds && typeof thresholds === "object" ? thresholds : {};
    const good = U.num(opts.good, 80, 0);
    const warn = U.num(opts.warn, 50, 0);
    const num = U.num(value, 0, 0);
    if (num >= good) {
      return "tone-green";
    }
    if (num >= warn) {
      return "tone-blue";
    }
    return "tone-orange";
  }

  /* ------------------------------------------------------------------ *
   * 三、指标卡片
   * ------------------------------------------------------------------ */

  /**
   * 组装 5 大指标卡片的数据模型。
   * @param {object} metrics computeMetrics 结果
   * @returns {Array<object>} 卡片模型列表
   */
  function metricCards(metrics) {
    return [
      {
        key: "requirementCoverage",
        title: "需求覆盖率",
        value: metrics.requirementCoverage,
        numerator: metrics.requirementCovered,
        denominator: metrics.requirementTotal,
        unit: "个需求",
        hint: "被用例 linkedRequirements 引用到的需求 / 版本与任务需求总数",
        action: metrics.requirementUncovered.length > 0
          ? { key: "gap", label: `${metrics.requirementUncovered.length} 个需求无用例` }
          : null
      },
      {
        key: "planExecuteRate",
        title: "计划执行率",
        value: metrics.planExecuteRate,
        numerator: metrics.executed,
        denominator: metrics.plannedSlots,
        unit: "个槽位",
        hint: "已执行的执行实例 / 计划条目 × 轮次（已扣除本轮移除项）",
        action: null
      },
      {
        key: "passRate",
        title: "用例通过率",
        value: metrics.passRate,
        numerator: metrics.passed,
        denominator: metrics.executed,
        unit: "次执行",
        hint: "通过 / 已执行（通过 + 失败 + 阻塞 + 跳过）",
        action: null
      },
      {
        key: "defectInterceptRate",
        title: "缺陷拦截率",
        value: metrics.defectInterceptRate,
        numerator: metrics.defectLinkedCount,
        denominator: metrics.executed,
        unit: "次执行",
        hint: "关联了缺陷的执行 / 已执行，窗口内缺陷总数 " + U.num(metrics.defectTotal, 0, 0),
        action: null
      },
      {
        key: "automationRate",
        title: "自动化占比",
        value: metrics.automationRate,
        numerator: metrics.automationCount,
        denominator: metrics.caseTotal,
        unit: "条用例",
        hint: "automationEnabled 为真的用例 / 用例总数",
        action: null
      }
    ];
  }

  /**
   * 渲染单张指标卡片。
   * @param {object} card 卡片模型
   * @returns {string} HTML 片段
   */
  function cardHtml(card) {
    const denominator = U.num(card.denominator, 0, 0);
    const empty = denominator <= 0;
    const tone = empty ? "tone-gray" : toneOf(card.value);
    const actionHtml = card.action
      ? `<button type="button" class="tcm-db-card-action" data-db-action="${U.escapeHtml(card.action.key)}">${U.escapeHtml(card.action.label)}</button>`
      : "";
    return `<article class="tcm-db-card${empty ? " is-empty" : ""}" data-db-metric="${U.escapeHtml(card.key)}">
      <header class="tcm-db-card-head">
        <h4 class="tcm-db-card-title">${U.escapeHtml(card.title)}</h4>
        <span class="tcm-db-card-tip" title="${U.escapeHtml(card.hint)}" aria-label="${U.escapeHtml(card.hint)}">?</span>
      </header>
      <div class="tcm-db-card-body">
        ${ringHtml(empty ? 0 : card.value, tone)}
        <div class="tcm-db-card-meta">
          <p class="tcm-db-card-frac">
            <strong>${U.escapeHtml(String(U.num(card.numerator, 0, 0)))}</strong>
            <span>/ ${U.escapeHtml(String(denominator))} ${U.escapeHtml(card.unit)}</span>
          </p>
          ${empty ? `<p class="tcm-db-card-empty">当前窗口暂无数据</p>` : ""}
          ${actionHtml}
        </div>
      </div>
    </article>`;
  }

  /* ------------------------------------------------------------------ *
   * 四、下钻柱状图（纯 CSS）
   * ------------------------------------------------------------------ */

  /**
   * 渲染一行的执行结果堆叠条。
   * @param {object} row drillGroups 的一行
   * @returns {string} HTML 片段
   */
  function stackHtml(row) {
    const total = U.num(row.execTotal, 0, 0);
    if (total <= 0) {
      return `<div class="tcm-db-stack is-blank" title="暂无执行记录"></div>`;
    }
    const segments = [
      { key: "passed", label: "通过", count: U.num(row.passed, 0, 0) },
      { key: "failed", label: "失败", count: U.num(row.failed, 0, 0) },
      { key: "blocked", label: "阻塞", count: U.num(row.blocked, 0, 0) },
      { key: "skipped", label: "跳过", count: U.num(row.skipped, 0, 0) },
      { key: "notRun", label: "未执行", count: U.num(row.notRun, 0, 0) }
    ];
    const parts = segments
      .filter((segment) => segment.count > 0)
      .map((segment) => {
        const width = (segment.count * 100) / total;
        return `<span class="tcm-db-stack-seg ${EXEC_SEGMENT_CLASS[segment.key]}"
          style="width:${U.escapeHtml(width.toFixed(2))}%"
          title="${U.escapeHtml(`${segment.label} ${segment.count}`)}"></span>`;
      })
      .join("");
    return `<div class="tcm-db-stack">${parts}</div>`;
  }

  /**
   * 渲染下钻柱状图区块。
   * @param {object} metrics computeMetrics 结果
   * @returns {string} HTML 片段
   */
  function drillHtml(metrics) {
    const rows = U.toArray(metrics.drill && metrics.drill[drillDim]);
    const maxCase = rows.reduce((max, row) => Math.max(max, U.num(row.caseCount, 0, 0)), 0);
    const tabs = DRILL_DIMS.map((dim) => `<button type="button"
        class="tcm-db-drill-tab${dim.key === drillDim ? " is-active" : ""}"
        data-db-drill="${U.escapeHtml(dim.key)}"
        aria-pressed="${dim.key === drillDim ? "true" : "false"}">${U.escapeHtml(dim.label)}</button>`).join("");

    const body = rows.length === 0
      ? `<p class="tcm-empty">当前窗口没有可下钻的数据。</p>`
      : rows.map((row) => {
        const caseCount = U.num(row.caseCount, 0, 0);
        const barWidth = maxCase > 0 ? (caseCount * 100) / maxCase : 0;
        return `<div class="tcm-db-bar-row">
          <span class="tcm-db-bar-label" title="${U.escapeHtml(row.key)}">${U.escapeHtml(row.key)}</span>
          <div class="tcm-db-bar-track">
            <div class="tcm-db-bar-fill" style="width:${U.escapeHtml(barWidth.toFixed(2))}%"></div>
            <span class="tcm-db-bar-value">${U.escapeHtml(String(caseCount))} 条</span>
          </div>
          ${stackHtml(row)}
          <span class="tcm-db-bar-rate" title="通过率">${U.escapeHtml(pct(row.passRate))}</span>
          <span class="tcm-db-bar-rate is-muted" title="自动化率">自动化 ${U.escapeHtml(pct(row.automationRate))}</span>
          <span class="tcm-db-bar-rate is-muted" title="关联缺陷数">缺陷 ${U.escapeHtml(String(U.num(row.defects, 0, 0)))}</span>
        </div>`;
      }).join("");

    return `<section class="tcm-db-section tcm-db-drill">
      <header class="tcm-db-section-head">
        <h4 class="tcm-db-section-title">维度下钻</h4>
        <div class="tcm-db-drill-tabs" role="group" aria-label="下钻维度">${tabs}</div>
      </header>
      <div class="tcm-db-legend" aria-hidden="true">
        <span class="tcm-db-legend-item"><i class="is-passed"></i>通过</span>
        <span class="tcm-db-legend-item"><i class="is-failed"></i>失败</span>
        <span class="tcm-db-legend-item"><i class="is-blocked"></i>阻塞</span>
        <span class="tcm-db-legend-item"><i class="is-skipped"></i>跳过</span>
        <span class="tcm-db-legend-item"><i class="is-notrun"></i>未执行</span>
      </div>
      <div class="tcm-db-bars">${body}</div>
    </section>`;
  }

  /* ------------------------------------------------------------------ *
   * 五、覆盖缺口 / 结构分布
   * ------------------------------------------------------------------ */

  /**
   * 渲染「无用例的需求」清单（覆盖缺口）。
   * @param {object} metrics computeMetrics 结果
   * @returns {string} HTML 片段
   */
  function gapHtml(metrics) {
    const uncovered = U.toArray(metrics.requirementUncovered);
    const total = U.num(metrics.requirementTotal, 0, 0);
    if (total === 0) {
      return `<section class="tcm-db-section tcm-db-gap">
        <header class="tcm-db-section-head">
          <h4 class="tcm-db-section-title">覆盖缺口</h4>
        </header>
        <p class="tcm-empty">当前窗口没有可统计的需求（版本 / 任务为空）。</p>
      </section>`;
    }
    if (uncovered.length === 0) {
      return `<section class="tcm-db-section tcm-db-gap">
        <header class="tcm-db-section-head">
          <h4 class="tcm-db-section-title">覆盖缺口</h4>
          <span class="tcm-badge tone-green">全部 ${U.escapeHtml(String(total))} 个需求均已覆盖</span>
        </header>
      </section>`;
    }

    const list = uncovered.map((item) => {
      const id = U.str(item.id);
      const typeLabel = U.str(item.type) === "task" ? "任务" : "版本";
      return `<li class="tcm-db-gap-item">
        <span class="tcm-badge tone-gray">${U.escapeHtml(typeLabel)}</span>
        <span class="tcm-db-gap-name" title="${U.escapeHtml(U.str(item.name, id))}">${U.escapeHtml(U.str(item.name, id))}</span>
        ${U.str(item.moduleName) ? `<span class="tcm-db-gap-module">${U.escapeHtml(U.str(item.moduleName))}</span>` : ""}
        <button type="button" class="tcm-link-btn" data-db-trace="${U.escapeHtml(id)}">追溯</button>
      </li>`;
    }).join("");

    return `<section class="tcm-db-section tcm-db-gap">
      <header class="tcm-db-section-head">
        <h4 class="tcm-db-section-title">覆盖缺口</h4>
        <span class="tcm-badge tone-orange">${U.escapeHtml(String(uncovered.length))} / ${U.escapeHtml(String(total))} 个需求无用例</span>
        <button type="button" class="tcm-link-btn" data-db-action="gap">${gapOpen ? "收起" : "展开清单"}</button>
      </header>
      ${gapOpen ? `<ul class="tcm-db-gap-list">${list}</ul>` : ""}
    </section>`;
  }

  /**
   * 渲染用例结构与评审概览（辅助信息区）。
   * @param {object} metrics computeMetrics 结果
   * @returns {string} HTML 片段
   */
  function overviewHtml(metrics) {
    const statusRows = C.CASE_STATUS.map((status) => {
      const count = U.num(metrics.caseByStatus[status], 0, 0);
      const rate = metrics.caseTotal > 0 ? (count * 100) / metrics.caseTotal : 0;
      return `<li class="tcm-db-mini-row">
        <span class="tcm-db-mini-label">${U.escapeHtml(status)}</span>
        <span class="tcm-db-mini-track"><i style="width:${U.escapeHtml(rate.toFixed(2))}%"></i></span>
        <span class="tcm-db-mini-value">${U.escapeHtml(String(count))}</span>
      </li>`;
    }).join("");

    const reviewRows = C.REVIEW_STATUS.map((status) => {
      const count = U.num(metrics.reviewByStatus[status], 0, 0);
      const rate = metrics.reviewTotal > 0 ? (count * 100) / metrics.reviewTotal : 0;
      return `<li class="tcm-db-mini-row">
        <span class="tcm-db-mini-label">${U.escapeHtml(status)}</span>
        <span class="tcm-db-mini-track"><i style="width:${U.escapeHtml(rate.toFixed(2))}%"></i></span>
        <span class="tcm-db-mini-value">${U.escapeHtml(String(count))}</span>
      </li>`;
    }).join("");

    return `<section class="tcm-db-section tcm-db-overview">
      <div class="tcm-db-mini">
        <h4 class="tcm-db-section-title">用例状态分布（共 ${U.escapeHtml(String(U.num(metrics.caseTotal, 0, 0)))} 条）</h4>
        <ul class="tcm-db-mini-list">${statusRows}</ul>
      </div>
      <div class="tcm-db-mini">
        <h4 class="tcm-db-section-title">
          评审单状态（共 ${U.escapeHtml(String(U.num(metrics.reviewTotal, 0, 0)))} 张）
          ${U.num(metrics.reviewOverdue, 0, 0) > 0
            ? `<span class="tcm-badge tone-red">${U.escapeHtml(String(metrics.reviewOverdue))} 张逾期</span>`
            : ""}
        </h4>
        <ul class="tcm-db-mini-list">${reviewRows}</ul>
      </div>
    </section>`;
  }

  /* ------------------------------------------------------------------ *
   * 六、主渲染
   * ------------------------------------------------------------------ */

  /**
   * 渲染工具条（数据窗口切换 + 作用域说明）。
   * @param {object} metrics computeMetrics 结果
   * @returns {string} HTML 片段
   */
  function toolbarHtml(metrics) {
    const active = currentWindow();
    const buttons = C.METRIC_WINDOW.map((item) => `<button type="button"
        class="tcm-db-window-btn${item.key === active ? " is-active" : ""}"
        data-db-window="${U.escapeHtml(item.key)}"
        aria-pressed="${item.key === active ? "true" : "false"}">${U.escapeHtml(item.label)}</button>`).join("");

    const fallback = metrics.windowFallback
      ? `<span class="tcm-badge tone-orange" title="未选择迭代版本，已自动降级">${U.escapeHtml(U.str(metrics.scopeName, "已降级为全部数据"))}</span>`
      : `<span class="tcm-db-scope">统计范围：${U.escapeHtml(U.str(metrics.scopeName, "全部数据"))}</span>`;

    return `<header class="tcm-db-toolbar">
      <div class="tcm-db-window" role="group" aria-label="数据窗口">${buttons}</div>
      ${fallback}
      <button type="button" class="tcm-link-btn" data-db-action="refresh">刷新</button>
    </header>`;
  }

  /**
   * 渲染整个看板（幂等：每次全量重建 innerHTML）。
   * @returns {void}
   */
  function render() {
    if (!doc) {
      return;
    }
    if (!rootEl) {
      rootEl = doc.getElementById("tcmDashboardView");
    }
    if (!rootEl) {
      return;
    }
    if (!mounted) {
      mount(rootEl);
    }

    let metrics = null;
    try {
      metrics = currentMetrics();
    } catch (error) {
      rootEl.innerHTML = `<div class="tcm-panel"><p class="tcm-empty">统计数据计算失败：${U.escapeHtml(String(error && error.message ? error.message : error))}</p></div>`;
      return;
    }

    const cards = metricCards(metrics).map(cardHtml).join("");

    rootEl.innerHTML = `<div class="tcm-db">
      ${toolbarHtml(metrics)}
      <section class="tcm-db-cards">${cards}</section>
      ${gapHtml(metrics)}
      ${drillHtml(metrics)}
      ${overviewHtml(metrics)}
    </div>`;
  }

  /* ------------------------------------------------------------------ *
   * 七、交互（容器级事件委托）
   * ------------------------------------------------------------------ */

  /**
   * 容器点击委托。
   * @param {MouseEvent} event 点击事件
   * @returns {void}
   */
  function onClick(event) {
    const target = event && event.target && typeof event.target.closest === "function"
      ? event.target
      : null;
    if (!target) {
      return;
    }

    const windowBtn = target.closest("[data-db-window]");
    if (windowBtn && rootEl.contains(windowBtn)) {
      event.preventDefault();
      setWindow(windowBtn.dataset.dbWindow);
      return;
    }

    const drillBtn = target.closest("[data-db-drill]");
    if (drillBtn && rootEl.contains(drillBtn)) {
      event.preventDefault();
      setDrill(drillBtn.dataset.dbDrill);
      return;
    }

    const traceBtn = target.closest("[data-db-trace]");
    if (traceBtn && rootEl.contains(traceBtn)) {
      event.preventDefault();
      focusRequirement(traceBtn.dataset.dbTrace);
      return;
    }

    const actionBtn = target.closest("[data-db-action]");
    if (actionBtn && rootEl.contains(actionBtn)) {
      event.preventDefault();
      const action = U.str(actionBtn.dataset.dbAction);
      if (action === "gap") {
        gapOpen = !gapOpen;
        render();
      } else if (action === "refresh") {
        render();
      }
    }
  }

  /**
   * 跳到追溯图谱并以该需求为起点（只走 bus，不直接调 trace.render）。
   * @param {string} requirementId 需求 id
   * @returns {void}
   */
  function focusRequirement(requirementId) {
    const id = U.str(requirementId);
    if (!id) {
      return;
    }
    if (TCM.bus && typeof TCM.bus.emit === "function") {
      TCM.bus.emit(C.EVENTS.REQ_FOCUS, { requirementId: id, source: "dashboard" });
    }
  }

  /* ------------------------------------------------------------------ *
   * 八、跨模块订阅
   * ------------------------------------------------------------------ */

  /**
   * 订阅数据变更事件（进程内只订阅一次）。
   * @returns {void}
   */
  function bindBusOnce() {
    if (busBound || !TCM.bus || typeof TCM.bus.on !== "function") {
      return;
    }
    [
      C.EVENTS.CASE_UPDATED,
      C.EVENTS.CASE_DELETED,
      C.EVENTS.CASE_BATCH_CHANGED,
      C.EVENTS.PLAN_CREATED,
      C.EVENTS.PLAN_UPDATED,
      C.EVENTS.PLAN_ITEMS_CHANGED,
      C.EVENTS.EXEC_MARKED,
      C.EVENTS.EXEC_BUG_CREATED,
      C.EVENTS.REVIEW_CREATED,
      C.EVENTS.REVIEW_CONCLUDED
    ].forEach((name) => TCM.bus.on(name, renderIfVisible));
    busBound = true;
  }

  /* ------------------------------------------------------------------ *
   * 九、生命周期
   * ------------------------------------------------------------------ */

  /**
   * 挂载：绑定容器级事件（只绑一次）。
   * @param {HTMLElement} [root] 视图容器；缺省时自动查找 #tcmDashboardView
   * @returns {void}
   */
  function mount(root) {
    if (!doc) {
      return;
    }
    rootEl = root || doc.getElementById("tcmDashboardView");
    if (!rootEl || mounted) {
      return;
    }
    rootEl.addEventListener("click", onClick);
    mounted = true;
  }

  /**
   * 卸载：解绑 DOM 事件（不解绑 bus，bindBusOnce 幂等）。
   * @returns {void}
   */
  function destroy() {
    if (rootEl) {
      rootEl.removeEventListener("click", onClick);
    }
    mounted = false;
  }

  bindBusOnce();

  TCM.dashboard = {
    mount,
    render,
    destroy,
    setWindow,
    setDrill,
    _internals: {
      currentMetrics,
      currentWindow,
      metricCards,
      ringHtml,
      toneOf,
      DRILL_KEYS
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
