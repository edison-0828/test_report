/**
 * tcm/tcm-ai.js —— AI 批量补全步骤 / 预期（T05 · P2）
 *
 * 职责：
 *   1. 接收用例库批量选中的用例 id，拼装上下文调用 `POST /api/generate-cases`；
 *   2. 把返回结果按标题对齐回本地用例，进入「**建议态**」——
 *      建议只存在于本模块的内存中，**在用户逐条确认之前绝不写库**（PRD §10 硬约束）；
 *   3. 提供建议对照弹层：左侧现状 / 右侧 AI 建议，支持逐条勾选、全选、
 *      「仅补空字段」开关，确认后才一次性 `TCM.store.commit('basicCaseLibrary', ...)`；
 *   4. 落库时同步写 `caseVersions` 版本快照（复用 TCM.model.appendCaseVersion），
 *      保证 AI 改动同样可回滚。
 *
 * 约束：
 *   - IIFE + "use strict"，只挂载 window.TCM.ai；
 *   - 对外暴露 { mount, render, destroy, open, close, isOpen }，render() 幂等；
 *   - 事件委托到弹层根节点，mount() 只绑一次；
 *   - 所有用户输入 / AI 文本渲染前必须 TCM.util.escapeHtml()；
 *   - 跨模块只通过 TCM.bus.emit 通知，不直接调用别的视图 render。
 *
 * 依赖：tcm-core.js → tcm-store.js → tcm-model.js
 */
(function (global) {
  "use strict";

  const TCM = global.TCM;
  if (!TCM || !TCM.const || !TCM.util || !TCM.store || !TCM.model) {
    if (global.console && typeof global.console.error === "function") {
      global.console.error("[TCM.ai] 依赖缺失：请确认 tcm-core.js / tcm-store.js / tcm-model.js 已先加载。");
    }
    return;
  }

  const C = TCM.const;
  const U = TCM.util;
  const S = TCM.store;
  const M = TCM.model;
  const esc = U.escapeHtml;
  const doc = global.document || null;

  /** 弹层根容器 id（缺失时自动兜底创建） */
  const ROOT_ID = "tcmAiSuggestRoot";
  /** 单次批量补全的用例上限，避免一次请求过大 */
  const MAX_BATCH = 20;

  /* ------------------------------------------------------------------ *
   * 模块状态（建议态数据全部在这里，不进 store）
   * ------------------------------------------------------------------ */

  let rootEl = null;
  let mounted = false;
  let opened = false;
  /** 当前批次的用例快照（只读副本） */
  let targets = [];
  /** 建议列表：[{caseAssetId, title, matched, accepted, currentSteps, currentExpected, steps, expected, preconditions, reason}] */
  let suggestions = [];
  /** 请求状态：idle | loading | ready | error */
  let phase = "idle";
  let errorText = "";
  /** 仅补空字段（默认开启，最小惊讶） */
  let fillOnly = true;

  /* ------------------------------------------------------------------ *
   * 基础访问器
   * ------------------------------------------------------------------ */

  /**
   * 取全局 state。
   * @returns {object} 状态对象
   */
  function getState() {
    return S.getState() || {};
  }

  /**
   * 取用例库集合。
   * @returns {Array<object>} 用例数组
   */
  function assets() {
    return U.toArray(S.collection("basicCaseLibrary"));
  }

  /**
   * 取版本历史集合。
   * @returns {Array<object>} 版本数组
   */
  function versions() {
    return U.toArray(S.collection("caseVersions"));
  }

  /**
   * 当前操作人。
   * @returns {string} 操作人
   */
  function operator() {
    return U.currentOperator(getState());
  }

  /**
   * 轻提示。
   * @param {string} message 文案
   * @param {string} [tone] 语气
   * @returns {void}
   */
  function toast(message, tone) {
    if (typeof global.showToast === "function") {
      global.showToast(message, tone || "info");
      return;
    }
    if (global.console && typeof global.console.info === "function") {
      global.console.info(`[TCM.ai] ${message}`);
    }
  }

  /**
   * 读取 AI 配置（沿用主应用的设置面板，不另起一套）。
   * @returns {{apiKey:string, model:string}} 配置
   */
  function aiSettings() {
    const settings = getState().settings;
    const bag = settings && typeof settings === "object" ? settings : {};
    return {
      apiKey: U.str(bag.apiKey),
      model: U.str(bag.model)
    };
  }

  /* ------------------------------------------------------------------ *
   * 请求
   * ------------------------------------------------------------------ */

  /**
   * 调用 `/api/generate-cases` 获取补全建议。
   * @param {Array<object>} cases 选中的用例
   * @returns {Promise<Array<object>>} AI 返回的 testCases
   */
  async function requestSuggestions(cases) {
    const settings = aiSettings();
    const first = cases[0] || {};
    const payload = {
      documentName: `用例补全-${U.str(first.business) || "测试用例"}-${cases.length}条`,
      documentType: "测试用例补全",
      sourceType: "text",
      focusHint: "只补全每条用例的「测试步骤」与「预期结果」，保持标题与数量完全不变。",
      content: M.buildAiCaseContext(cases),
      apiKey: settings.apiKey,
      model: settings.model
    };

    const response = await global.fetch("/api/generate-cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(U.str(data && data.error) || `生成服务返回 ${response.status}`);
    }
    if (!Array.isArray(data.testCases) || !data.testCases.length) {
      throw new Error("AI 没有返回有效用例");
    }
    return data.testCases;
  }

  /* ------------------------------------------------------------------ *
   * 渲染
   * ------------------------------------------------------------------ */

  /**
   * 建议卡片中的文本对照块。
   * @param {string} label 字段名
   * @param {string} before 现状
   * @param {string} after AI 建议
   * @returns {string} HTML
   */
  function comparePairHtml(label, before, after) {
    const beforeText = U.str(before);
    const afterText = U.str(after);
    if (!afterText) {
      return "";
    }
    const same = beforeText === afterText;
    return `
      <div class="tcm-ai-pair${same ? " is-same" : ""}">
        <span class="tcm-ai-pair-label">${esc(label)}</span>
        <div class="tcm-ai-pair-body">
          <pre class="tcm-ai-text tcm-ai-text-before">${esc(beforeText) || "<span class=\"tcm-muted\">（空）</span>"}</pre>
          <span class="tcm-ai-arrow" aria-hidden="true">→</span>
          <pre class="tcm-ai-text tcm-ai-text-after">${esc(afterText)}</pre>
        </div>
      </div>
    `;
  }

  /**
   * 单条建议。
   * @param {object} item 建议
   * @param {number} index 下标
   * @returns {string} HTML
   */
  function suggestionHtml(item, index) {
    if (!item.matched) {
      return `
        <li class="tcm-ai-item is-unmatched">
          <div class="tcm-ai-item-head">
            <span class="tcm-ai-item-title">${esc(item.title)}</span>
            <span class="tcm-tag tcm-tag-warning">未匹配</span>
          </div>
          <p class="tcm-ai-item-reason">${esc(item.reason) || "AI 未返回对应结果"}</p>
        </li>
      `;
    }

    const pairs = [
      comparePairHtml("前置条件", "", item.preconditions),
      comparePairHtml("操作步骤", item.currentSteps, item.steps),
      comparePairHtml("预期结果", item.currentExpected, item.expected)
    ].filter(Boolean).join("");

    return `
      <li class="tcm-ai-item${item.accepted ? " is-accepted" : ""}">
        <div class="tcm-ai-item-head">
          <label class="tcm-checkbox">
            <input type="checkbox" data-tcm-ai-accept="${index}" ${item.accepted ? "checked" : ""}>
            <span class="tcm-ai-item-title">${esc(item.title)}</span>
          </label>
        </div>
        <div class="tcm-ai-item-body">${pairs || '<p class="tcm-muted">AI 未给出可用的补全内容。</p>'}</div>
      </li>
    `;
  }

  /**
   * 弹层主体。
   * @returns {string} HTML
   */
  function bodyHtml() {
    if (phase === "loading") {
      return `
        <div class="tcm-ai-loading" role="status" aria-live="polite">
          <span class="tcm-spinner" aria-hidden="true"></span>
          <p>正在为 ${targets.length} 条用例生成补全建议，请稍候……</p>
        </div>
      `;
    }

    if (phase === "error") {
      return `
        <div class="tcm-form-error" role="alert">${esc(errorText)}</div>
        <p class="tcm-muted">可在右上角「设置」中检查 API Key 与模型配置后重试。</p>
      `;
    }

    const matched = suggestions.filter((item) => item.matched);
    const accepted = suggestions.filter((item) => item.accepted);

    return `
      <div class="tcm-ai-banner" role="note">
        AI 结果处于<strong>建议态</strong>，勾选并点击「应用选中建议」后才会写入用例库；未勾选的内容不会有任何改动。
      </div>
      <div class="tcm-ai-toolbar">
        <span class="tcm-ai-count">共 ${suggestions.length} 条 · 可用建议 ${matched.length} 条 · 已选 ${accepted.length} 条</span>
        <div class="tcm-ai-toolbar-ops">
          <label class="tcm-checkbox">
            <input type="checkbox" data-tcm-ai-fill-only ${fillOnly ? "checked" : ""}>
            <span>仅补空字段</span>
          </label>
          <button type="button" class="tcm-btn tcm-btn-ghost tcm-btn-sm" data-tcm-ai-select-all>全选可用</button>
          <button type="button" class="tcm-btn tcm-btn-ghost tcm-btn-sm" data-tcm-ai-select-none>全不选</button>
        </div>
      </div>
      <ul class="tcm-ai-list">
        ${suggestions.map(suggestionHtml).join("")}
      </ul>
    `;
  }

  /**
   * 弹层底部按钮。
   * @returns {string} HTML
   */
  function footHtml() {
    const accepted = suggestions.filter((item) => item.accepted).length;
    const disabled = phase !== "ready" || accepted === 0 ? "disabled" : "";
    return `
      <div class="tcm-drawer-actions">
        <button type="button" class="tcm-btn tcm-btn-ghost" data-tcm-ai-close>取消</button>
        ${phase === "error"
          ? '<button type="button" class="tcm-btn tcm-btn-primary" data-tcm-ai-retry>重试</button>'
          : `<button type="button" class="tcm-btn tcm-btn-primary" data-tcm-ai-apply ${disabled}>
              应用选中建议${accepted ? `（${accepted}）` : ""}
            </button>`}
      </div>
    `;
  }

  /**
   * 创建弹层骨架。
   * @returns {void}
   */
  function ensureSkeleton() {
    if (!doc) {
      return;
    }
    if (!rootEl) {
      rootEl = doc.getElementById(ROOT_ID);
    }
    if (!rootEl) {
      rootEl = doc.createElement("div");
      rootEl.id = ROOT_ID;
      if (doc.body) {
        doc.body.appendChild(rootEl);
      }
    }
  }

  /**
   * 渲染弹层（幂等）。
   * @returns {void}
   */
  function render() {
    if (!doc) {
      return;
    }
    ensureSkeleton();
    if (!rootEl) {
      return;
    }
    if (!opened) {
      rootEl.innerHTML = "";
      rootEl.hidden = true;
      return;
    }
    rootEl.hidden = false;
    rootEl.innerHTML = `
      <div class="tcm-modal-mask" data-tcm-ai-close></div>
      <div class="tcm-modal tcm-modal-lg" role="dialog" aria-modal="true" aria-label="AI 批量补全建议">
        <header class="tcm-modal-head">
          <h3 class="tcm-modal-title">AI 批量补全步骤与预期</h3>
          <button type="button" class="tcm-icon-btn" data-tcm-ai-close aria-label="关闭">×</button>
        </header>
        <div class="tcm-modal-body">${bodyHtml()}</div>
        <footer class="tcm-modal-foot">${footHtml()}</footer>
      </div>
    `;
  }

  /* ------------------------------------------------------------------ *
   * 行为
   * ------------------------------------------------------------------ */

  /**
   * 打开 AI 补全弹层并立即发起请求。
   * @param {Array<string>} caseIds 选中的用例 id 数组
   * @returns {Promise<void>} 请求完成的 Promise
   */
  async function open(caseIds) {
    if (!doc) {
      return;
    }
    if (!mounted) {
      mount(doc.getElementById(ROOT_ID));
    }

    const ids = U.toArray(caseIds).map((id) => U.str(id)).filter(Boolean);
    const list = assets();
    const picked = ids
      .map((id) => list.find((row) => U.str(row.id) === id))
      .filter(Boolean);

    if (!picked.length) {
      toast("请先在用例库中勾选需要补全的用例", "warning");
      return;
    }
    if (picked.length > MAX_BATCH) {
      toast(`单次最多补全 ${MAX_BATCH} 条用例，请分批处理（当前选中 ${picked.length} 条）`, "warning");
      return;
    }

    targets = picked.map((item) => U.clone(item));
    suggestions = [];
    errorText = "";
    phase = "loading";
    opened = true;
    if (doc.body && doc.body.classList) {
      doc.body.classList.add("tcm-drawer-open");
    }
    render();

    await runRequest();
  }

  /**
   * 执行（或重试）一次请求，并把结果转成建议态。
   * @returns {Promise<void>} 完成 Promise
   */
  async function runRequest() {
    phase = "loading";
    errorText = "";
    render();

    try {
      const aiCases = await requestSuggestions(targets);
      // 关键：只生成建议，不触碰 store
      suggestions = M.buildAiSuggestions(targets, aiCases).map((item) => Object.assign({}, item, {
        // 默认全部勾选「有内容的可用建议」，用户仍可逐条取消
        accepted: Boolean(item.matched && (item.steps || item.expected || item.preconditions))
      }));
      phase = "ready";
    } catch (error) {
      errorText = U.str(error && error.message) || "AI 补全失败";
      phase = "error";
    }
    render();
  }

  /**
   * 应用已勾选的建议：合并 → 写版本快照 → commit。
   * @returns {void}
   */
  function applyAccepted() {
    const accepted = suggestions.filter((item) => item.accepted && item.matched);
    if (!accepted.length) {
      toast("请至少勾选一条建议", "warning");
      return;
    }

    const now = U.nowIso();
    const who = operator();
    const byId = new Map();
    accepted.forEach((item) => {
      byId.set(U.str(item.caseAssetId), item);
    });

    let changed = 0;
    let versionList = versions();
    const nextAssets = assets().map((row) => {
      const suggestion = byId.get(U.str(row.id));
      if (!suggestion) {
        return row;
      }
      const merged = M.mergeAiSuggestion(row, suggestion, { operator: who, now, fillOnly });
      if (merged.steps === U.str(row.steps)
        && merged.expected === U.str(row.expected)
        && merged.preconditions === U.str(row.preconditions)) {
        return row;
      }
      const bumped = M.normalizeCaseAsset(Object.assign({}, merged, {
        version: U.num(row.version, 1, 1) + 1,
        updatedBy: who,
        updatedAt: now
      }), { operator: who, now });
      versionList = M.appendCaseVersion(versionList, bumped, {
        operator: who,
        now,
        changeNote: "AI 批量补全步骤与预期"
      });
      changed += 1;
      return bumped;
    });

    if (!changed) {
      toast("勾选的建议与现有内容一致，未做修改", "info");
      return;
    }

    const okAssets = S.commit("basicCaseLibrary", nextAssets, { source: "library", reason: "aiBatchComplete" });
    if (!okAssets) {
      toast("写入被数据层拦截，请检查控制台错误信息", "error");
      return;
    }
    S.commit("caseVersions", versionList, { source: "library", reason: "aiBatchComplete" });

    TCM.bus.emit(C.EVENTS.CASE_BATCH_CHANGED, { source: "ai", count: changed });
    toast(`已应用 ${changed} 条 AI 建议，相关用例版本已 +1 并生成快照`, "success");
    close();
  }

  /**
   * 关闭弹层并清空建议态（建议不会残留）。
   * @returns {void}
   */
  function close() {
    if (!opened) {
      return;
    }
    opened = false;
    targets = [];
    suggestions = [];
    phase = "idle";
    errorText = "";
    if (doc && doc.body && doc.body.classList) {
      doc.body.classList.remove("tcm-drawer-open");
    }
    render();
  }

  /* ------------------------------------------------------------------ *
   * 事件
   * ------------------------------------------------------------------ */

  /**
   * 弹层内点击。
   * @param {Event} event 事件对象
   * @returns {void}
   */
  function onClick(event) {
    const target = event.target;
    if (!target || typeof target.closest !== "function") {
      return;
    }

    if (target.closest("[data-tcm-ai-close]")) {
      event.preventDefault();
      close();
      return;
    }

    if (target.closest("[data-tcm-ai-retry]")) {
      event.preventDefault();
      void runRequest();
      return;
    }

    if (target.closest("[data-tcm-ai-apply]")) {
      event.preventDefault();
      applyAccepted();
      return;
    }

    if (target.closest("[data-tcm-ai-select-all]")) {
      event.preventDefault();
      suggestions = suggestions.map((item) => Object.assign({}, item, {
        accepted: Boolean(item.matched && (item.steps || item.expected || item.preconditions))
      }));
      render();
      return;
    }

    if (target.closest("[data-tcm-ai-select-none]")) {
      event.preventDefault();
      suggestions = suggestions.map((item) => Object.assign({}, item, { accepted: false }));
      render();
    }
  }

  /**
   * 弹层内 change：勾选建议 / 切换「仅补空字段」。
   * @param {Event} event 事件对象
   * @returns {void}
   */
  function onChange(event) {
    const target = event.target;
    if (!target || typeof target.matches !== "function") {
      return;
    }

    if (target.matches("[data-tcm-ai-fill-only]")) {
      fillOnly = Boolean(target.checked);
      return;
    }

    if (target.matches("[data-tcm-ai-accept]")) {
      const index = U.num(target.getAttribute("data-tcm-ai-accept"), -1, -1);
      if (index < 0 || index >= suggestions.length) {
        return;
      }
      suggestions[index] = Object.assign({}, suggestions[index], { accepted: Boolean(target.checked) });
      render();
    }
  }

  /**
   * ESC 关闭。
   * @param {KeyboardEvent} event 事件对象
   * @returns {void}
   */
  function onKeydown(event) {
    if (!opened) {
      return;
    }
    if (event.key === "Escape" || event.key === "Esc") {
      event.preventDefault();
      close();
    }
  }

  /* ------------------------------------------------------------------ *
   * 生命周期
   * ------------------------------------------------------------------ */

  /**
   * 挂载：创建骨架并绑定事件（只绑一次）。
   * @param {HTMLElement} [root] 弹层根容器
   * @returns {void}
   */
  function mount(root) {
    if (!doc) {
      return;
    }
    if (root) {
      rootEl = root;
    }
    ensureSkeleton();
    if (!rootEl || mounted) {
      return;
    }
    rootEl.addEventListener("click", onClick);
    rootEl.addEventListener("change", onChange);
    doc.addEventListener("keydown", onKeydown);
    mounted = true;
    render();
  }

  /**
   * 卸载：解绑事件并清空状态。
   * @returns {void}
   */
  function destroy() {
    if (rootEl) {
      rootEl.removeEventListener("click", onClick);
      rootEl.removeEventListener("change", onChange);
    }
    if (doc) {
      doc.removeEventListener("keydown", onKeydown);
    }
    opened = false;
    targets = [];
    suggestions = [];
    phase = "idle";
    mounted = false;
  }

  TCM.ai = {
    mount,
    render,
    destroy,
    open,
    close,
    isOpen() {
      return opened;
    },
    /**
     * 只读快照，方便调试与单测断言「建议未落库」。
     * @returns {{phase:string, suggestions:Array<object>, fillOnly:boolean}} 当前建议态
     */
    getSuggestions() {
      return { phase, suggestions: U.clone(suggestions), fillOnly };
    },
    MAX_BATCH,
    _internals: {
      requestSuggestions,
      applyAccepted,
      runRequest
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
