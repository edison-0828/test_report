/**
 * tcm-trace.js —— 测试用例管理模块 L3 视图层：追溯图谱（T04 / P2）
 *
 * 职责：
 *   1. 选择起点（需求 / 用例 / 执行 / 缺陷）后，渲染 **需求 → 用例 → 执行 → 缺陷** 四层分层列表。
 *   2. 用一层绝对定位的内联 SVG 覆盖层，把相邻两层的关联节点连成贝塞尔曲线（零依赖）。
 *   3. 支持正向钻取（需求 → 缺陷）与反向钻取（缺陷 → 需求）：点任意节点即可把它设为新起点。
 *   4. 节点上的「跳转」按钮通过 TCM.bus 通知对应模块定位，绝不直接调用别的视图 render()。
 *
 * 图数据全部由 `TCM.model.buildGraph()` 纯函数产出，本文件只做渲染与交互。
 *
 * 跨模块契约（只走 TCM.bus）：
 *   订阅：req:focus / case:focus / exec:focus / defect:focus（source !== 'trace' 时切到本视图并设为起点）
 *         case:updated / case:deleted / case:batchChanged / exec:marked / exec:bugCreated / review:concluded → 可见时重渲染
 *   广播：case:focus   { caseId, source:'trace' }      // 跳用例库
 *         plan:focus   { planId, round, source:'trace' } // 跳测试计划
 *         exec:focus   { executionId, planId, round, source:'trace' } // 跳测试执行
 *         review:focus { reviewId, source:'trace' }    // 跳用例评审
 */
(function (global) {
  "use strict";

  const TCM = global.TCM = global.TCM || {};
  const C = TCM.const;
  const U = TCM.util;

  if (!C || !U) {
    throw new Error("[tcm-trace] 依赖缺失：请确保 tcm-core.js 在 tcm-trace.js 之前加载。");
  }

  const doc = global.document;

  /** 视图根容器 */
  let rootEl = null;

  /** DOM 事件是否已绑定（mount 一次） */
  let mounted = false;

  /** bus 是否已订阅（进程内一次） */
  let busBound = false;

  /** 当前起点：{kind, id} */
  let origin = { kind: "requirement", id: "" };

  /** 起点选择器里的搜索关键字 */
  let pickerKeyword = "";

  /** 连线重绘的 rAF 句柄，避免同一帧重复计算 */
  let drawHandle = 0;

  /** 窗口尺寸变化监听是否已绑定 */
  let resizeBound = false;

  /** 层定义（渲染顺序即图的层级顺序） */
  const LAYERS = Object.freeze([
    { key: "requirement", prefix: "req", label: "需求", field: "requirements" },
    { key: "case", prefix: "case", label: "用例", field: "cases" },
    { key: "execution", prefix: "exec", label: "执行", field: "executions" },
    { key: "defect", prefix: "defect", label: "缺陷", field: "defects" }
  ]);

  /** 起点类型选项 */
  const ORIGIN_OPTIONS = Object.freeze([
    { key: "requirement", label: "从需求出发" },
    { key: "case", label: "从用例出发" },
    { key: "execution", label: "从执行出发" },
    { key: "defect", label: "从缺陷出发" }
  ]);

  /** 用例状态 → 徽标色调 */
  const CASE_STATUS_TONE = Object.freeze({
    "草稿": "tone-gray",
    "待评审": "tone-orange",
    "已确认": "tone-green",
    "已废弃": "tone-red"
  });

  /** 执行状态 → 徽标色调 */
  const EXEC_STATUS_TONE = Object.freeze({
    "未执行": "tone-gray",
    "通过": "tone-green",
    "失败": "tone-red",
    "阻塞": "tone-orange",
    "跳过": "tone-blue"
  });

  /** 缺陷严重级 → 徽标色调 */
  const SEVERITY_TONE = Object.freeze({
    "致命": "tone-red",
    "严重": "tone-red",
    "一般": "tone-orange",
    "中": "tone-orange",
    "轻微": "tone-blue",
    "低": "tone-blue"
  });

  /** 连线类型 → 描边修饰类 */
  const EDGE_CLASS = Object.freeze({
    "req-case": "is-req-case",
    "case-exec": "is-case-exec",
    "exec-defect": "is-exec-defect",
    "case-defect": "is-case-defect"
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
   * 归集当前可选的需求列表（复用 model 的归集口径）。
   * @returns {Array<object>} 需求列表
   */
  function allRequirements() {
    const state = getState();
    return TCM.model.collectRequirements(U.toArray(state.batches), U.toArray(state.tasks));
  }

  /**
   * 构建当前起点的图数据。
   * @returns {object} buildGraph 结果
   */
  function currentGraph() {
    const state = getState();
    return TCM.model.buildGraph({
      assets: collection("basicCaseLibrary"),
      plans: collection("testPlans"),
      executions: collection("caseExecutions"),
      bugs: U.toArray(state.bugs),
      batches: U.toArray(state.batches),
      tasks: U.toArray(state.tasks),
      origin: { kind: origin.kind, id: origin.id }
    });
  }

  /**
   * 设置起点并重渲染。
   * @param {string} kind 起点类型
   * @param {string} id 起点 id
   * @returns {void}
   */
  function setOrigin(kind, id) {
    origin = {
      kind: U.oneOf(U.str(kind), C.TRACE_ORIGIN_KIND, "requirement"),
      id: U.str(id)
    };
    render();
  }

  /* ------------------------------------------------------------------ *
   * 二、起点选择器
   * ------------------------------------------------------------------ */

  /**
   * 生成当前起点类型下的候选项（受关键字过滤，最多 200 条防止 DOM 爆炸）。
   * @returns {Array<{id:string, label:string, meta:string}>} 候选项
   */
  function originCandidates() {
    const keyword = U.str(pickerKeyword).toLowerCase();
    const state = getState();
    let list = [];

    if (origin.kind === "requirement") {
      list = allRequirements().map((item) => ({
        id: U.str(item.id),
        label: U.str(item.name, item.id),
        meta: U.str(item.type) === "task" ? "任务" : "版本"
      }));
    } else if (origin.kind === "case") {
      list = collection("basicCaseLibrary").map((item) => ({
        id: U.str(item.id),
        label: U.str(item.title, item.id),
        meta: `${U.str(item.business, "未分类")} · ${U.str(item.status, "草稿")}`
      }));
    } else if (origin.kind === "execution") {
      const planName = new Map();
      collection("testPlans").forEach((plan) => {
        planName.set(U.str(plan && plan.id), U.str(plan && plan.name, "未命名计划"));
      });
      list = collection("caseExecutions").map((item) => {
        const snapshot = item && item.caseSnapshot ? item.caseSnapshot : {};
        return {
          id: U.str(item.id),
          label: U.str(snapshot.title, U.str(item.caseAssetId, item.id)),
          meta: `${planName.get(U.str(item.planId)) || "（计划已删除）"} · 第 ${U.num(item.round, 1, 1)} 轮 · ${U.str(item.status, "未执行")}`
        };
      });
    } else {
      list = U.toArray(state.bugs).map((item) => ({
        id: U.str(item.id),
        label: U.str(item.title, item.id),
        meta: `${U.str(item.severity, "中")} · ${U.str(item.status, "新建")}`
      }));
    }

    const filtered = keyword
      ? list.filter((item) => `${item.label} ${item.meta} ${item.id}`.toLowerCase().includes(keyword))
      : list;
    return filtered.slice(0, 200);
  }

  /**
   * 渲染起点选择器工具条。
   * @param {object} graph buildGraph 结果
   * @returns {string} HTML 片段
   */
  function pickerHtml(graph) {
    const kindBtns = ORIGIN_OPTIONS.map((option) => `<button type="button"
        class="tcm-tr-kind${option.key === origin.kind ? " is-active" : ""}"
        data-tr-kind="${U.escapeHtml(option.key)}"
        aria-pressed="${option.key === origin.kind ? "true" : "false"}">${U.escapeHtml(option.label)}</button>`).join("");

    const candidates = originCandidates();
    const options = candidates.map((item) => `<option value="${U.escapeHtml(item.id)}"${item.id === origin.id ? " selected" : ""}>${U.escapeHtml(`${item.label} — ${item.meta}`)}</option>`).join("");

    const summary = origin.id
      ? (graph.origin.found
        ? `<span class="tcm-badge tone-blue">起点：${U.escapeHtml(U.str(graph.origin.label, origin.id))}</span>`
        : `<span class="tcm-badge tone-red">起点已不存在：${U.escapeHtml(origin.id)}</span>`)
      : `<span class="tcm-badge tone-gray">未选择起点</span>`;

    return `<header class="tcm-tr-toolbar">
      <div class="tcm-tr-kinds" role="group" aria-label="起点类型">${kindBtns}</div>
      <input type="search" class="tcm-tr-search" data-tr-search value="${U.escapeHtml(pickerKeyword)}"
        placeholder="搜索起点…" aria-label="搜索起点" />
      <select class="tcm-tr-select" data-tr-origin aria-label="选择起点">
        <option value="">— 请选择 —</option>
        ${options}
      </select>
      ${summary}
      ${origin.id ? `<button type="button" class="tcm-link-btn" data-tr-action="clear">清空</button>` : ""}
    </header>`;
  }

  /* ------------------------------------------------------------------ *
   * 三、节点渲染
   * ------------------------------------------------------------------ */

  /**
   * 渲染需求节点。
   * @param {object} node 需求节点
   * @returns {string} HTML 片段
   */
  function requirementNodeHtml(node) {
    const active = origin.kind === "requirement" && origin.id === node.id;
    return `<li class="tcm-tr-node${active ? " is-origin" : ""}${node.missing ? " is-missing" : ""}"
      data-tr-node="req:${U.escapeHtml(node.id)}" data-tr-kind-node="requirement" data-tr-id="${U.escapeHtml(node.id)}"
      tabindex="0" role="button" aria-label="${U.escapeHtml(`以需求 ${node.name} 为起点`)}">
      <div class="tcm-tr-node-head">
        <span class="tcm-badge tone-gray">${U.escapeHtml(node.type === "task" ? "任务" : "版本")}</span>
        <span class="tcm-tr-node-title" title="${U.escapeHtml(node.name)}">${U.escapeHtml(node.name)}</span>
      </div>
      <div class="tcm-tr-node-meta">
        ${node.moduleName ? `<span>${U.escapeHtml(node.moduleName)}</span>` : ""}
        <span>${U.escapeHtml(String(U.toArray(node.caseIds).length))} 条用例</span>
      </div>
    </li>`;
  }

  /**
   * 渲染用例节点。
   * @param {object} node 用例节点
   * @returns {string} HTML 片段
   */
  function caseNodeHtml(node) {
    const active = origin.kind === "case" && origin.id === node.id;
    const tone = CASE_STATUS_TONE[node.status] || "tone-gray";
    return `<li class="tcm-tr-node${active ? " is-origin" : ""}${node.missing ? " is-missing" : ""}"
      data-tr-node="case:${U.escapeHtml(node.id)}" data-tr-kind-node="case" data-tr-id="${U.escapeHtml(node.id)}"
      tabindex="0" role="button" aria-label="${U.escapeHtml(`以用例 ${node.title} 为起点`)}">
      <div class="tcm-tr-node-head">
        <span class="tcm-badge ${U.escapeHtml(tone)}">${U.escapeHtml(node.status)}</span>
        <span class="tcm-tr-node-title" title="${U.escapeHtml(node.title)}">${U.escapeHtml(node.title)}</span>
      </div>
      <div class="tcm-tr-node-meta">
        <span>${U.escapeHtml(node.priority)}</span>
        <span>${U.escapeHtml(node.type)}</span>
        <span>${U.escapeHtml(node.business)}</span>
        ${U.toArray(node.requirementIds).length === 0 ? `<span class="tcm-tr-orphan">未关联需求</span>` : ""}
      </div>
      <div class="tcm-tr-node-links">
        <button type="button" class="tcm-link-btn" data-tr-jump="case" data-tr-target="${U.escapeHtml(node.id)}">用例库</button>
        ${node.reviewId ? `<button type="button" class="tcm-link-btn" data-tr-jump="review" data-tr-target="${U.escapeHtml(node.reviewId)}">评审单</button>` : ""}
      </div>
    </li>`;
  }

  /**
   * 渲染执行节点。
   * @param {object} node 执行节点
   * @returns {string} HTML 片段
   */
  function executionNodeHtml(node) {
    const active = origin.kind === "execution" && origin.id === node.id;
    const tone = EXEC_STATUS_TONE[node.status] || "tone-gray";
    return `<li class="tcm-tr-node${active ? " is-origin" : ""}"
      data-tr-node="exec:${U.escapeHtml(node.id)}" data-tr-kind-node="execution" data-tr-id="${U.escapeHtml(node.id)}"
      tabindex="0" role="button" aria-label="${U.escapeHtml(`以执行 ${node.planName} 第 ${node.round} 轮为起点`)}">
      <div class="tcm-tr-node-head">
        <span class="tcm-badge ${U.escapeHtml(tone)}">${U.escapeHtml(node.status)}</span>
        <span class="tcm-tr-node-title" title="${U.escapeHtml(node.planName)}">${U.escapeHtml(node.planName)}</span>
      </div>
      <div class="tcm-tr-node-meta">
        <span>第 ${U.escapeHtml(String(node.round))} 轮</span>
        <span>${U.escapeHtml(node.executor)}</span>
        ${node.evidenceCount > 0 ? `<span>${U.escapeHtml(String(node.evidenceCount))} 份证据</span>` : ""}
        ${node.finishedAt ? `<span>${U.escapeHtml(String(node.finishedAt).slice(0, 16).replace("T", " "))}</span>` : ""}
      </div>
      <div class="tcm-tr-node-links">
        <button type="button" class="tcm-link-btn" data-tr-jump="execution" data-tr-target="${U.escapeHtml(node.id)}"
          data-tr-plan="${U.escapeHtml(node.planId)}" data-tr-round="${U.escapeHtml(String(node.round))}">去执行</button>
        <button type="button" class="tcm-link-btn" data-tr-jump="plan" data-tr-target="${U.escapeHtml(node.planId)}"
          data-tr-round="${U.escapeHtml(String(node.round))}">看计划</button>
      </div>
    </li>`;
  }

  /**
   * 渲染缺陷节点。
   * @param {object} node 缺陷节点
   * @returns {string} HTML 片段
   */
  function defectNodeHtml(node) {
    const active = origin.kind === "defect" && origin.id === node.id;
    const tone = SEVERITY_TONE[node.severity] || "tone-orange";
    return `<li class="tcm-tr-node${active ? " is-origin" : ""}"
      data-tr-node="defect:${U.escapeHtml(node.id)}" data-tr-kind-node="defect" data-tr-id="${U.escapeHtml(node.id)}"
      tabindex="0" role="button" aria-label="${U.escapeHtml(`以缺陷 ${node.title} 为起点`)}">
      <div class="tcm-tr-node-head">
        <span class="tcm-badge ${U.escapeHtml(tone)}">${U.escapeHtml(node.severity)}</span>
        <span class="tcm-tr-node-title" title="${U.escapeHtml(node.title)}">${U.escapeHtml(node.title)}</span>
      </div>
      <div class="tcm-tr-node-meta">
        <span>${U.escapeHtml(node.status)}</span>
        <span>${U.escapeHtml(node.owner)}</span>
        ${node.createdAt ? `<span>${U.escapeHtml(String(node.createdAt).slice(0, 10))}</span>` : ""}
      </div>
      <div class="tcm-tr-node-links">
        <button type="button" class="tcm-link-btn" data-tr-jump="defect" data-tr-target="${U.escapeHtml(node.id)}">缺陷详情</button>
      </div>
    </li>`;
  }

  /**
   * 按层 key 渲染节点列表。
   * @param {object} layer 层定义
   * @param {object} graph 图数据
   * @returns {string} HTML 片段
   */
  function layerHtml(layer, graph) {
    const nodes = U.toArray(graph[layer.field]);
    let body = "";
    if (nodes.length === 0) {
      body = `<li class="tcm-tr-node is-blank">暂无${U.escapeHtml(layer.label)}</li>`;
    } else if (layer.key === "requirement") {
      body = nodes.map(requirementNodeHtml).join("");
    } else if (layer.key === "case") {
      body = nodes.map(caseNodeHtml).join("");
    } else if (layer.key === "execution") {
      body = nodes.map(executionNodeHtml).join("");
    } else {
      body = nodes.map(defectNodeHtml).join("");
    }

    return `<section class="tcm-tr-layer" data-tr-layer="${U.escapeHtml(layer.key)}">
      <header class="tcm-tr-layer-head">
        <h4 class="tcm-tr-layer-title">${U.escapeHtml(layer.label)}</h4>
        <span class="tcm-tr-layer-count">${U.escapeHtml(String(nodes.length))}</span>
      </header>
      <ul class="tcm-tr-layer-list">${body}</ul>
    </section>`;
  }

  /**
   * 渲染统计摘要条。
   * @param {object} graph 图数据
   * @returns {string} HTML 片段
   */
  function statsHtml(graph) {
    const stats = graph.stats || {};
    const items = [
      { label: "需求", value: stats.requirementCount },
      { label: "用例", value: stats.caseCount },
      { label: "执行", value: stats.executionCount },
      { label: "通过", value: stats.passedCount },
      { label: "失败", value: stats.failedCount },
      { label: "缺陷", value: stats.defectCount }
    ].map((item) => `<span class="tcm-tr-stat"><b>${U.escapeHtml(String(U.num(item.value, 0, 0)))}</b>${U.escapeHtml(item.label)}</span>`).join("");

    const orphan = U.num(stats.orphanCaseCount, 0, 0);
    return `<div class="tcm-tr-stats">
      ${items}
      ${orphan > 0 ? `<span class="tcm-badge tone-orange">${U.escapeHtml(String(orphan))} 条用例未关联需求</span>` : ""}
    </div>`;
  }

  /* ------------------------------------------------------------------ *
   * 四、SVG 连线
   * ------------------------------------------------------------------ */

  /**
   * 请求一次连线重绘（合并到下一帧，避免布局抖动时重复计算）。
   * @returns {void}
   */
  function scheduleDraw() {
    if (!global.requestAnimationFrame) {
      drawEdges();
      return;
    }
    if (drawHandle) {
      global.cancelAnimationFrame(drawHandle);
    }
    drawHandle = global.requestAnimationFrame(() => {
      drawHandle = 0;
      drawEdges();
    });
  }

  /**
   * 计算并绘制层间连线。
   *
   * 做法：读取每个节点相对画布的位置，用三次贝塞尔从上一层节点的右边缘连到
   * 下一层节点的左边缘；节点不可见（被折叠 / 未渲染）时跳过该条边。
   * @returns {void}
   */
  function drawEdges() {
    if (!rootEl) {
      return;
    }
    const canvas = rootEl.querySelector("[data-tr-canvas]");
    const svg = rootEl.querySelector("[data-tr-edges]");
    if (!canvas || !svg) {
      return;
    }

    const edges = U.toArray(currentEdges());
    const canvasRect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(canvasRect.width));
    const height = Math.max(1, Math.round(canvasRect.height));
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));

    /**
     * 取某个节点相对画布的矩形。
     * @param {string} nodeKey 形如 `req:xxx`
     * @returns {{x:number,y:number,w:number,h:number}|null} 相对矩形
     */
    function rectOf(nodeKey) {
      const el = canvas.querySelector(`[data-tr-node="${cssEscape(nodeKey)}"]`);
      if (!el) {
        return null;
      }
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        return null;
      }
      return {
        x: rect.left - canvasRect.left,
        y: rect.top - canvasRect.top,
        w: rect.width,
        h: rect.height
      };
    }

    const paths = [];
    edges.forEach((edge) => {
      const from = rectOf(edge.from);
      const to = rectOf(edge.to);
      if (!from || !to) {
        return;
      }
      const x1 = from.x + from.w;
      const y1 = from.y + from.h / 2;
      const x2 = to.x;
      const y2 = to.y + to.h / 2;
      const dx = Math.max(24, (x2 - x1) / 2);
      const d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${(x1 + dx).toFixed(1)} ${y1.toFixed(1)}, ${(x2 - dx).toFixed(1)} ${y2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
      const cls = EDGE_CLASS[edge.kind] || "is-req-case";
      paths.push(`<path class="tcm-tr-edge ${cls}" d="${d}" fill="none"></path>`);
    });

    svg.innerHTML = paths.join("");
  }

  /**
   * 转义 CSS 属性选择器里的引号 / 反斜杠。
   * @param {string} value 原始值
   * @returns {string} 可安全嵌入选择器的值
   */
  function cssEscape(value) {
    return String(value === undefined || value === null ? "" : value).replace(/["\\]/g, "\\$&");
  }

  /** 上一次渲染出的边集合（drawEdges 复用，避免重复 buildGraph） */
  let lastEdges = [];

  /**
   * 取当前边集合。
   * @returns {Array<object>} 边列表
   */
  function currentEdges() {
    return lastEdges;
  }

  /* ------------------------------------------------------------------ *
   * 五、主渲染
   * ------------------------------------------------------------------ */

  /**
   * 渲染整个追溯视图（幂等：全量重建 innerHTML，再异步补画连线）。
   * @returns {void}
   */
  function render() {
    if (!doc) {
      return;
    }
    if (!rootEl) {
      rootEl = doc.getElementById("tcmTraceView");
    }
    if (!rootEl) {
      return;
    }
    if (!mounted) {
      mount(rootEl);
    }

    let graph = null;
    try {
      graph = currentGraph();
    } catch (error) {
      rootEl.innerHTML = `<div class="tcm-panel"><p class="tcm-empty">追溯图谱构建失败：${U.escapeHtml(String(error && error.message ? error.message : error))}</p></div>`;
      return;
    }
    lastEdges = U.toArray(graph.edges);

    const hasOrigin = Boolean(origin.id);
    const body = hasOrigin
      ? `<div class="tcm-tr-canvas" data-tr-canvas>
          <svg class="tcm-tr-edges" data-tr-edges aria-hidden="true" preserveAspectRatio="none"></svg>
          <div class="tcm-tr-layers">
            ${LAYERS.map((layer) => layerHtml(layer, graph)).join("")}
          </div>
        </div>`
      : `<p class="tcm-empty">请先在上方选择一个起点（需求 / 用例 / 执行 / 缺陷），即可展开「需求 → 用例 → 执行 → 缺陷」全链路追溯。</p>`;

    rootEl.innerHTML = `<div class="tcm-tr">
      ${pickerHtml(graph)}
      ${hasOrigin ? statsHtml(graph) : ""}
      ${body}
      ${hasOrigin ? `<p class="tcm-tr-tip">提示：点击任意节点可把它设为新起点（支持缺陷 → 执行 → 用例 → 需求 的反向钻取）。</p>` : ""}
    </div>`;

    if (hasOrigin) {
      scheduleDraw();
    }
  }

  /* ------------------------------------------------------------------ *
   * 六、交互（容器级事件委托）
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
    if (!target || !rootEl) {
      return;
    }

    const jumpBtn = target.closest("[data-tr-jump]");
    if (jumpBtn && rootEl.contains(jumpBtn)) {
      event.preventDefault();
      event.stopPropagation();
      handleJump(jumpBtn);
      return;
    }

    const kindBtn = target.closest("[data-tr-kind]");
    if (kindBtn && rootEl.contains(kindBtn)) {
      event.preventDefault();
      pickerKeyword = "";
      setOrigin(kindBtn.dataset.trKind, "");
      return;
    }

    const actionBtn = target.closest("[data-tr-action]");
    if (actionBtn && rootEl.contains(actionBtn)) {
      event.preventDefault();
      if (U.str(actionBtn.dataset.trAction) === "clear") {
        setOrigin(origin.kind, "");
      }
      return;
    }

    const nodeEl = target.closest("[data-tr-node]");
    if (nodeEl && rootEl.contains(nodeEl) && !nodeEl.classList.contains("is-blank")) {
      event.preventDefault();
      pickerKeyword = "";
      setOrigin(nodeEl.dataset.trKindNode, nodeEl.dataset.trId);
    }
  }

  /**
   * 节点键盘操作（Enter / Space 等价于点击）。
   * @param {KeyboardEvent} event 键盘事件
   * @returns {void}
   */
  function onKeydown(event) {
    if (!event || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }
    const target = event.target && typeof event.target.closest === "function" ? event.target : null;
    if (!target || !rootEl) {
      return;
    }
    const nodeEl = target.closest("[data-tr-node]");
    if (nodeEl && rootEl.contains(nodeEl) && !nodeEl.classList.contains("is-blank")) {
      event.preventDefault();
      pickerKeyword = "";
      setOrigin(nodeEl.dataset.trKindNode, nodeEl.dataset.trId);
    }
  }

  /**
   * 起点下拉变化。
   * @param {Event} event change 事件
   * @returns {void}
   */
  function onChange(event) {
    const target = event && event.target ? event.target : null;
    if (!target || !target.dataset) {
      return;
    }
    if (Object.prototype.hasOwnProperty.call(target.dataset, "trOrigin")) {
      setOrigin(origin.kind, target.value);
    }
  }

  /**
   * 搜索框输入（只过滤候选项，不改起点）。
   * @param {Event} event input 事件
   * @returns {void}
   */
  function onInput(event) {
    const target = event && event.target ? event.target : null;
    if (!target || !target.dataset) {
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(target.dataset, "trSearch")) {
      return;
    }
    pickerKeyword = U.str(target.value);
    const select = rootEl ? rootEl.querySelector("[data-tr-origin]") : null;
    if (!select) {
      return;
    }
    // 只重建候选项，保留输入焦点与光标
    const candidates = originCandidates();
    select.innerHTML = `<option value="">— 请选择 —</option>` + candidates
      .map((item) => `<option value="${U.escapeHtml(item.id)}"${item.id === origin.id ? " selected" : ""}>${U.escapeHtml(`${item.label} — ${item.meta}`)}</option>`)
      .join("");
  }

  /**
   * 处理跨模块跳转（只 emit，不直接调别的视图）。
   * @param {HTMLElement} button 触发按钮
   * @returns {void}
   */
  function handleJump(button) {
    if (!TCM.bus || typeof TCM.bus.emit !== "function") {
      return;
    }
    const kind = U.str(button.dataset.trJump);
    const id = U.str(button.dataset.trTarget);
    if (!id) {
      return;
    }
    const round = U.num(button.dataset.trRound, 1, 1);

    if (kind === "case") {
      TCM.bus.emit(C.EVENTS.CASE_FOCUS, { caseId: id, source: "trace" });
    } else if (kind === "review") {
      TCM.bus.emit(C.EVENTS.REVIEW_FOCUS, { reviewId: id, source: "trace" });
    } else if (kind === "plan") {
      TCM.bus.emit(C.EVENTS.PLAN_FOCUS, { planId: id, round, source: "trace" });
    } else if (kind === "execution") {
      TCM.bus.emit(C.EVENTS.EXEC_FOCUS, {
        executionId: id,
        planId: U.str(button.dataset.trPlan),
        round,
        source: "trace"
      });
    } else if (kind === "defect") {
      TCM.bus.emit(C.EVENTS.DEFECT_FOCUS, { defectId: id, source: "trace" });
    }
  }

  /* ------------------------------------------------------------------ *
   * 七、跨模块订阅
   * ------------------------------------------------------------------ */

  /**
   * 处理外部「以 X 为起点做追溯」的请求。
   * @param {string} kind 起点类型
   * @param {string} idField 负载里承载 id 的字段名
   * @returns {function(object):void} 事件处理函数
   */
  function focusHandler(kind, idField) {
    return function handle(payload) {
      const data = payload && typeof payload === "object" ? payload : {};
      // 自己发出的跳转事件不回环
      if (U.str(data.source) === "trace") {
        return;
      }
      const id = U.str(data[idField]);
      if (!id) {
        return;
      }
      // `req:focus` 语义上专属追溯，可直接抢占视图；
      // `case:focus` / `exec:focus` / `defect:focus` 的默认语义是「定位到对应模块」，
      // 只有负载显式带 `trace:true` 才由本视图接管，避免与用例库 / 执行台抢焦点。
      if (kind !== "requirement" && !U.bool(data.trace, false)) {
        return;
      }
      if (TCM.shell && typeof TCM.shell.setActive === "function") {
        TCM.shell.setActive("trace");
      }
      pickerKeyword = "";
      setOrigin(kind, id);
    };
  }

  /**
   * 订阅跨模块事件（进程内只订阅一次）。
   * @returns {void}
   */
  function bindBusOnce() {
    if (busBound || !TCM.bus || typeof TCM.bus.on !== "function") {
      return;
    }
    TCM.bus.on(C.EVENTS.REQ_FOCUS, focusHandler("requirement", "requirementId"));
    TCM.bus.on(C.EVENTS.CASE_FOCUS, focusHandler("case", "caseId"));
    TCM.bus.on(C.EVENTS.EXEC_FOCUS, focusHandler("execution", "executionId"));
    TCM.bus.on(C.EVENTS.DEFECT_FOCUS, focusHandler("defect", "defectId"));

    [
      C.EVENTS.CASE_UPDATED,
      C.EVENTS.CASE_DELETED,
      C.EVENTS.CASE_BATCH_CHANGED,
      C.EVENTS.PLAN_ITEMS_CHANGED,
      C.EVENTS.EXEC_MARKED,
      C.EVENTS.EXEC_BUG_CREATED,
      C.EVENTS.REVIEW_CONCLUDED
    ].forEach((name) => TCM.bus.on(name, renderIfVisible));
    busBound = true;
  }

  /* ------------------------------------------------------------------ *
   * 八、生命周期
   * ------------------------------------------------------------------ */

  /**
   * 窗口尺寸变化时重画连线（布局变化会让原坐标失效）。
   * @returns {void}
   */
  function onResize() {
    if (isVisible()) {
      scheduleDraw();
    }
  }

  /**
   * 挂载：绑定容器级事件（只绑一次）。
   * @param {HTMLElement} [root] 视图容器；缺省时自动查找 #tcmTraceView
   * @returns {void}
   */
  function mount(root) {
    if (!doc) {
      return;
    }
    rootEl = root || doc.getElementById("tcmTraceView");
    if (!rootEl || mounted) {
      return;
    }
    rootEl.addEventListener("click", onClick);
    rootEl.addEventListener("change", onChange);
    rootEl.addEventListener("input", onInput);
    rootEl.addEventListener("keydown", onKeydown);
    if (!resizeBound && global.addEventListener) {
      global.addEventListener("resize", onResize);
      resizeBound = true;
    }
    mounted = true;
  }

  /**
   * 卸载：解绑 DOM 事件（不解绑 bus，bindBusOnce 幂等）。
   * @returns {void}
   */
  function destroy() {
    if (rootEl) {
      rootEl.removeEventListener("click", onClick);
      rootEl.removeEventListener("change", onChange);
      rootEl.removeEventListener("input", onInput);
      rootEl.removeEventListener("keydown", onKeydown);
    }
    if (resizeBound && global.removeEventListener) {
      global.removeEventListener("resize", onResize);
      resizeBound = false;
    }
    if (drawHandle && global.cancelAnimationFrame) {
      global.cancelAnimationFrame(drawHandle);
      drawHandle = 0;
    }
    mounted = false;
  }

  bindBusOnce();

  TCM.trace = {
    mount,
    render,
    destroy,
    setOrigin,
    /**
     * 以某个需求为起点（供 dashboard / 外部调试直接调用）。
     * @param {string} requirementId 需求 id
     * @returns {void}
     */
    focusRequirement(requirementId) {
      setOrigin("requirement", requirementId);
    },
    _internals: {
      currentGraph,
      originCandidates,
      drawEdges,
      LAYERS
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
