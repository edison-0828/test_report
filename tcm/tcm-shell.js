/**
 * tcm-shell.js —— 测试用例管理模块 L2 容器层（子 Tab 壳）
 *
 * 职责：
 *   1. 在 #basicCases 面板顶部渲染 6 个子 Tab（用例库 / 测试计划 / 测试执行 / 用例评审 / 统计看板 / 追溯视图）
 *   2. 维护当前子 Tab（LOCAL_STATE_KEYS.tcmActiveSubTab），切换时显示/隐藏对应视图容器
 *   3. renderActive() 按当前子 Tab 调对应视图模块的 render()
 *      —— 6 个子视图**均已实装**；占位卡片仅作为「视图模块加载失败」的异常兜底（见 renderFallback）
 *   4. 子 Tab 计数徽标优先取视图模块的 getVisibleCount()，口径与列表可见行一致（F2）
 *   5. 无障碍：role="tablist" / role="tab" / aria-selected / 方向键切换
 *
 * 加载顺序：core → store → model → shell → 各视图 → app.js
 *
 * 约定（系统设计 §8.2）：
 *   - 只有 shell 允许调用各视图的 mount()/render()（它是容器所有者）
 *   - 视图之间禁止直接互调 render，一律走 TCM.bus
 */
(function (global) {
  "use strict";

  const TCM = global.TCM = global.TCM || {};
  const C = TCM.const;
  const U = TCM.util;

  if (!C || !U) {
    throw new Error("[tcm-shell] 依赖缺失：请确保 tcm-core.js 在 tcm-shell.js 之前加载。");
  }

  const doc = global.document;

  /**
   * 6 个子 Tab 的完整定义（顺序即渲染顺序）。
   *
   * `countFrom`：徽标的**兜底**数据源（视图模块没实现 getVisibleCount() 时才用），
   *              空串表示该 Tab 不显示徽标。
   * `fallbackDesc`：视图模块加载失败时兜底卡片的说明文案（不是「未实装」提示）。
   */
  const VIEW_DEFS = Object.freeze([
    {
      key: "library",
      label: "用例库",
      icon: "📚",
      containerId: "tcmLibraryView",
      moduleName: "library",
      countFrom: "basicCaseLibrary",
      fallbackDesc: "用例库视图脚本（tcm/tcm-library.js）未能加载，请强制刷新页面重试；若仍失败，请检查静态资源是否可访问。"
    },
    {
      key: "plans",
      label: "测试计划",
      icon: "🗂",
      containerId: "tcmPlansView",
      moduleName: "plans",
      countFrom: "testPlans",
      fallbackDesc: "测试计划视图脚本（tcm/tcm-plans.js）未能加载，请强制刷新页面重试；若仍失败，请检查静态资源是否可访问。"
    },
    {
      key: "execution",
      label: "测试执行",
      icon: "▶",
      containerId: "tcmExecutionView",
      moduleName: "execution",
      countFrom: "caseExecutions",
      fallbackDesc: "测试执行视图脚本（tcm/tcm-execution.js）未能加载，请强制刷新页面重试；若仍失败，请检查静态资源是否可访问。"
    },
    {
      key: "review",
      label: "用例评审",
      icon: "✅",
      containerId: "tcmReviewView",
      moduleName: "review",
      countFrom: "reviewTickets",
      fallbackDesc: "用例评审视图脚本（tcm/tcm-review.js）未能加载，请强制刷新页面重试；若仍失败，请检查静态资源是否可访问。"
    },
    {
      key: "dashboard",
      label: "统计看板",
      icon: "📊",
      containerId: "tcmDashboardView",
      moduleName: "dashboard",
      countFrom: "",
      fallbackDesc: "统计看板视图脚本（tcm/tcm-dashboard.js）未能加载，请强制刷新页面重试；若仍失败，请检查静态资源是否可访问。"
    },
    {
      key: "trace",
      label: "追溯视图",
      icon: "🔗",
      containerId: "tcmTraceView",
      moduleName: "trace",
      countFrom: "",
      fallbackDesc: "追溯视图脚本（tcm/tcm-trace.js）未能加载，请强制刷新页面重试；若仍失败，请检查静态资源是否可访问。"
    }
  ]);

  /** 合法的子 Tab key 集合 */
  const VALID_KEYS = VIEW_DEFS.map((view) => view.key);

  /** 是否已完成挂载（保证事件只绑一次） */
  let mounted = false;

  /** 子 Tab 条容器 */
  let tabsEl = null;

  /** 已挂载过的视图模块名集合（避免重复 mount） */
  const mountedViews = new Set();

  /* ------------------------------------------------------------------ *
   * 内部工具
   * ------------------------------------------------------------------ */

  /**
   * 读取全局状态对象。
   * @returns {object} state 引用
   */
  function getState() {
    return TCM.store && typeof TCM.store.getState === "function" ? TCM.store.getState() : (global.state || {});
  }

  /**
   * 触发 app.js 的本地持久化（子 Tab 偏好只进 localStorage）。
   * @returns {void}
   */
  function persistLocal() {
    if (typeof global.persist === "function") {
      try {
        global.persist();
      } catch (error) {
        if (global.console && typeof global.console.error === "function") {
          global.console.error("[TCM.shell] persist 失败：", error);
        }
      }
    }
  }

  /**
   * 当前激活的子 Tab key（非法值兜底为 library）。
   * @returns {string} 子 Tab key
   */
  function getActive() {
    const value = U.str(getState().tcmActiveSubTab);
    return VALID_KEYS.includes(value) ? value : "library";
  }

  /**
   * 按 key 取视图定义。
   * @param {string} key 子 Tab key
   * @returns {object|null} 视图定义
   */
  function defOf(key) {
    return VIEW_DEFS.find((view) => view.key === key) || null;
  }

  /**
   * 取某个视图对应的模块实例（未实装时返回 null）。
   * @param {object} def 视图定义
   * @returns {object|null} 视图模块
   */
  function moduleOf(def) {
    if (!def) {
      return null;
    }
    const instance = TCM[def.moduleName];
    if (instance && typeof instance.render === "function") {
      return instance;
    }
    return null;
  }

  /**
   * 取某个子 Tab 对应集合的**全量**长度。
   * @param {object} def 视图定义
   * @returns {number} 全量条数（无对应集合时返回 -1）
   */
  function totalOf(def) {
    if (!def || !def.countFrom) {
      return -1;
    }
    const list = getState()[def.countFrom];
    return Array.isArray(list) ? list.length : 0;
  }

  /**
   * 取某个子 Tab 的计数徽标数值（★ F2）。
   *
   * 口径优先级：
   *   ① 视图模块自报的 `getVisibleCount()`——与该视图当前作用域/筛选下的可见行严格一致；
   *   ② 回落到 `countFrom` 集合的全量长度。
   *
   * 解耦约定：shell **不感知**任何视图的内部筛选逻辑，只调用约定好的可选接口；
   * 视图不实现该接口时行为与改造前完全一致。视图实现里抛异常也不能打挂 Tab 条。
   *
   * @param {object} def 视图定义
   * @returns {number} 计数（不显示徽标时返回 -1）
   */
  function countOf(def) {
    const instance = moduleOf(def);
    if (instance && typeof instance.getVisibleCount === "function") {
      try {
        const raw = instance.getVisibleCount();
        const value = Number(raw);
        // 加固：视图返回 null/undefined 时 Number(raw) 为 0 会被误判合法，须显式排除
        if (raw !== null && raw !== undefined && Number.isFinite(value) && value >= 0) {
          return value;
        }
      } catch (error) {
        if (global.console && typeof global.console.error === "function") {
          global.console.error(`[TCM.shell] ${def.key} 视图 getVisibleCount() 异常，回落到集合长度：`, error);
        }
      }
    }
    return totalOf(def);
  }

  /**
   * 徽标的悬浮说明：可见数与全量数不一致时明确标注口径。
   * @param {number} count 可见条数
   * @param {number} total 全量条数
   * @returns {string} title 文案（无需说明时返回空串）
   */
  function badgeTitle(count, total) {
    if (count < 0) {
      return "";
    }
    if (total >= 0 && total !== count) {
      return `当前视图可见 ${count} 条 · 全部 ${total} 条`;
    }
    return `共 ${count} 条`;
  }

  /* ------------------------------------------------------------------ *
   * 渲染
   * ------------------------------------------------------------------ */

  /**
   * 渲染子 Tab 条（幂等）。
   * @param {string} activeKey 当前激活的子 Tab
   * @returns {void}
   */
  function renderTabs(activeKey) {
    if (!tabsEl) {
      return;
    }
    tabsEl.setAttribute("role", "tablist");
    tabsEl.setAttribute("aria-label", "测试用例管理子模块");
    tabsEl.innerHTML = VIEW_DEFS.map((def) => {
      const isActive = def.key === activeKey;
      const count = countOf(def);
      const total = totalOf(def);
      const badge = count >= 0
        ? `<span class="tcm-subtab-count" title="${U.escapeHtml(badgeTitle(count, total))}">${U.escapeHtml(String(count))}</span>`
        : "";
      // 视图模块缺失（脚本未加载/加载失败）时给出异常态标记，不是「未实装」
      const ready = moduleOf(def) ? "" : " is-unavailable";
      return `<button type="button"
        class="tcm-subtab${isActive ? " is-active" : ""}${ready}"
        id="tcmSubTab-${U.escapeHtml(def.key)}"
        role="tab"
        aria-selected="${isActive ? "true" : "false"}"
        aria-controls="${U.escapeHtml(def.containerId)}"
        tabindex="${isActive ? "0" : "-1"}"
        data-tcm-subtab="${U.escapeHtml(def.key)}">
        <span class="tcm-subtab-icon" aria-hidden="true">${U.escapeHtml(def.icon)}</span>
        <span class="tcm-subtab-label">${U.escapeHtml(def.label)}</span>
        ${badge}
      </button>`;
    }).join("");
  }

  /**
   * 渲染「视图暂不可用」兜底卡片。
   *
   * ⚠️ 这是**异常兜底**，不是「功能未实装」：6 个子视图均已实装，
   * 只有对应的 `tcm/tcm-*.js` 没加载成功（网络失败 / 资源 404 / 脚本报错）
   * 时才会走到这里。请勿据此认为该子模块尚未开发。
   *
   * @param {object} def 视图定义
   * @param {HTMLElement} container 视图容器
   * @returns {void}
   */
  function renderFallback(def, container) {
    if (!container) {
      return;
    }
    const signature = `fallback:${def.key}`;
    if (container.dataset.tcmRendered === signature) {
      return;
    }
    container.innerHTML = `
      <section class="tcm-placeholder-card" role="alert">
        <div class="tcm-placeholder-icon" aria-hidden="true">⚠️</div>
        <h3 class="tcm-placeholder-title">${U.escapeHtml(`${def.label}视图暂不可用，请刷新重试`)}</h3>
        <p class="tcm-placeholder-desc">${U.escapeHtml(def.fallbackDesc || "该视图的脚本未能加载，请强制刷新页面重试。")}</p>
        <span class="tcm-placeholder-tag">加载失败</span>
      </section>
    `;
    container.dataset.tcmRendered = signature;
  }

  /**
   * 惰性挂载视图模块（每个模块只 mount 一次）。
   * @param {object} def 视图定义
   * @param {HTMLElement} container 视图容器
   * @returns {object|null} 视图模块
   */
  function ensureViewMounted(def, container) {
    const instance = moduleOf(def);
    if (!instance) {
      return null;
    }
    if (typeof instance.mount === "function" && !mountedViews.has(def.moduleName)) {
      // ★ A3：先标记已挂载——避免 mount() 抛异常后下次渲染重复 mount 半成品（状态泄漏）
      mountedViews.add(def.moduleName);
      try {
        instance.mount(container);
      } catch (error) {
        if (global.console && typeof global.console.error === "function") {
          global.console.error(`[TCM.shell] ${def.key} 视图 mount() 异常：`, error);
        }
      }
    }
    return instance;
  }

  /**
   * 按当前子 Tab 渲染激活视图（幂等，可反复调用）。
   * @returns {void}
   */
  function renderActive() {
    if (!doc) {
      return;
    }
    if (!tabsEl) {
      tabsEl = doc.getElementById("tcmSubTabs");
    }
    if (!tabsEl) {
      return;
    }

    const activeKey = getActive();

    VIEW_DEFS.forEach((def) => {
      const container = doc.getElementById(def.containerId);
      if (!container) {
        return;
      }
      const isActive = def.key === activeKey;
      container.classList.toggle("is-active", isActive);
      container.setAttribute("aria-hidden", isActive ? "false" : "true");
      if (!isActive) {
        return;
      }
      const instance = ensureViewMounted(def, container);
      if (instance) {
        try {
          instance.render();
        } catch (error) {
          if (global.console && typeof global.console.error === "function") {
            global.console.error(`[TCM.shell] ${def.key} 视图 render() 异常：`, error);
          }
          renderFallback(def, container); // ★ A3：复用异常兜底卡片，异常不再穿透到 renderTabs
        }
      } else {
        renderFallback(def, container);
      }
    });

    // ★ F2：Tab 条放在视图渲染之后刷新，保证徽标读到的是视图渲染后的最新可见行数
    //（例如执行台会在 render() 中惰性补齐当轮执行实例）。
    renderTabs(activeKey);
  }

  /**
   * render()：与 renderActive() 等价，满足 {mount, render, destroy} 统一接口。
   * @returns {void}
   */
  function render() {
    renderActive();
  }

  /* ------------------------------------------------------------------ *
   * 交互
   * ------------------------------------------------------------------ */

  /**
   * 切换子 Tab。
   * @param {string} key 目标子 Tab key
   * @param {{silent?:boolean}} [options] silent=true 时不写偏好
   * @returns {void}
   */
  function setActive(key, options) {
    const opts = options && typeof options === "object" ? options : {};
    const target = VALID_KEYS.includes(U.str(key)) ? U.str(key) : "library";
    const state = getState();
    if (state.tcmActiveSubTab !== target) {
      state.tcmActiveSubTab = target;
      if (!opts.silent) {
        persistLocal();
      }
    }
    renderActive();
    const button = doc ? doc.getElementById(`tcmSubTab-${target}`) : null;
    if (button && typeof button.focus === "function" && opts.focus) {
      button.focus();
    }
  }

  /**
   * 子 Tab 点击。
   * @param {MouseEvent} event 事件对象
   * @returns {void}
   */
  function onTabClick(event) {
    const button = event.target.closest("[data-tcm-subtab]");
    if (!button) {
      return;
    }
    setActive(button.dataset.tcmSubtab);
  }

  /**
   * 子 Tab 键盘导航（← → Home End）。
   * @param {KeyboardEvent} event 事件对象
   * @returns {void}
   */
  function onTabKeydown(event) {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) {
      return;
    }
    const button = event.target.closest("[data-tcm-subtab]");
    if (!button) {
      return;
    }
    event.preventDefault();
    const current = VALID_KEYS.indexOf(button.dataset.tcmSubtab);
    let nextIndex = current;
    if (event.key === "ArrowLeft") {
      nextIndex = (current - 1 + VALID_KEYS.length) % VALID_KEYS.length;
    } else if (event.key === "ArrowRight") {
      nextIndex = (current + 1) % VALID_KEYS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else {
      nextIndex = VALID_KEYS.length - 1;
    }
    setActive(VALID_KEYS[nextIndex], { focus: true });
  }

  /* ------------------------------------------------------------------ *
   * 生命周期
   * ------------------------------------------------------------------ */

  /**
   * 挂载壳层：绑定子 Tab 事件（只绑一次），并首次渲染。
   * @param {HTMLElement} [root] #basicCases 面板；缺省时自动查找
   * @returns {void}
   */
  function mount(root) {
    if (!doc) {
      return;
    }
    const host = root || doc.getElementById("basicCases");
    if (!host) {
      return;
    }
    tabsEl = doc.getElementById("tcmSubTabs");
    if (!tabsEl) {
      return;
    }

    if (!mounted) {
      tabsEl.addEventListener("click", onTabClick);
      tabsEl.addEventListener("keydown", onTabKeydown);
      // 编辑抽屉是全局单例，随壳层一起挂载
      if (TCM.caseEditor && typeof TCM.caseEditor.mount === "function") {
        TCM.caseEditor.mount(doc.getElementById("tcmCaseDrawerRoot"));
      }
      // T05：导入导出对话框与 AI 建议态弹层同为全局单例
      if (TCM.io && typeof TCM.io.mount === "function") {
        TCM.io.mount(doc.getElementById("tcmIoRoot"));
      }
      if (TCM.ai && typeof TCM.ai.mount === "function") {
        TCM.ai.mount(doc.getElementById("tcmAiSuggestRoot"));
      }
      // 用例保存 / 删除后刷新子 Tab 计数徽标
      TCM.bus.on(C.EVENTS.CASE_UPDATED, refreshTabsOnly);
      TCM.bus.on(C.EVENTS.CASE_DELETED, refreshTabsOnly);
      TCM.bus.on(C.EVENTS.CASE_BATCH_CHANGED, refreshTabsOnly);
      mounted = true;
    }

    renderActive();
  }

  /**
   * 只刷新子 Tab 条（不重渲染视图，避免事件回环）。
   * @returns {void}
   */
  function refreshTabsOnly() {
    if (tabsEl) {
      renderTabs(getActive());
    }
  }

  /**
   * 卸载：解绑事件。
   * @returns {void}
   */
  function destroy() {
    if (tabsEl) {
      tabsEl.removeEventListener("click", onTabClick);
      tabsEl.removeEventListener("keydown", onTabKeydown);
    }
    TCM.bus.off(C.EVENTS.CASE_UPDATED, refreshTabsOnly);
    TCM.bus.off(C.EVENTS.CASE_DELETED, refreshTabsOnly);
    TCM.bus.off(C.EVENTS.CASE_BATCH_CHANGED, refreshTabsOnly);
    VIEW_DEFS.forEach((def) => {
      const instance = TCM[def.moduleName];
      if (mountedViews.has(def.moduleName) && instance && typeof instance.destroy === "function") {
        instance.destroy();
      }
    });
    // T05：全局单例弹层随壳层一起卸载
    ["caseEditor", "io", "ai"].forEach((name) => {
      const instance = TCM[name];
      if (instance && typeof instance.destroy === "function") {
        instance.destroy();
      }
    });
    mountedViews.clear();
    mounted = false;
    tabsEl = null;
  }

  TCM.shell = {
    mount,
    render,
    renderActive,
    setActive,
    getActive,
    destroy,
    VIEW_DEFS
  };
})(typeof window !== "undefined" ? window : globalThis);
