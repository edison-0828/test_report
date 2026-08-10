/**
 * tcm-library.js —— 测试用例管理模块 L2 视图层：用例库
 *
 * 职责：
 *   1. 多级目录树（业务线 → 产品 → 模块 [→ 场景]），可折叠 / 计数徽标 / 空层自动坍缩
 *      —— 由 TCM.model.buildDirectoryTree(assets, dirs) 派生，空目录由 caseDirectories 集合保留
 *   2. 目录操作：新建空目录、重命名（级联更新用例归属字段）、删除（有用例则阻断，PRD §6.1 防误删）
 *   3. 用例列表：沿用既有 .bcl- 行结构与 CSS 投资，新增 type 徽标与 产品/模块 面包屑
 *   4. 检索筛选：关键词全文 + 6 维度（类型/优先级/状态/组件/标签/是否自动化），走 TCM.model.applyFilters()
 *   5. 批量操作：批量改状态 / 批量加标签 / 批量复制 / 批量删除（一律走 TCM.store.commit）
 *   6. 与左侧导航 5 个业务子菜单联动（renderNavSubmenu）
 *
 * 约定：
 *   - 事件委托绑在 #tcmLibraryView 上，mount() 只绑一次；render() 幂等
 *   - 所有用户输入渲染前必须 TCM.util.escapeHtml()
 *   - 写集合只走 TCM.store.commit()，禁止 state.xxx.push()
 */
(function (global) {
  "use strict";

  const TCM = global.TCM = global.TCM || {};
  const C = TCM.const;
  const U = TCM.util;

  if (!C || !U) {
    throw new Error("[tcm-library] 依赖缺失：请确保 tcm-core.js 在 tcm-library.js 之前加载。");
  }

  const doc = global.document;

  /** 优先级 → 徽标色板（与 styles.css 既有 tone-* 对齐） */
  const PRIORITY_TONE = Object.freeze({ P0: "tone-red", P1: "tone-orange", P2: "tone-blue", P3: "tone-gray" });

  /** 用例状态 → 徽标色板（与 app.js BASIC_CASE_STATUS_TONE 一致） */
  const STATUS_TONE = Object.freeze({
    "草稿": "tone-gray",
    "待评审": "tone-orange",
    "已确认": "tone-green",
    "已废弃": "tone-red"
  });

  /** 排序选项 */
  const SORT_OPTIONS = Object.freeze([
    { key: "title", label: "标题" },
    { key: "priority", label: "优先级" },
    { key: "status", label: "用例状态" },
    { key: "type", label: "用例类型" },
    { key: "module", label: "模块" },
    { key: "updatedAt", label: "更新时间" }
  ]);

  /** 排序权重表 */
  const PRIORITY_RANK = Object.freeze({ P0: 0, P1: 1, P2: 2, P3: 3 });
  const STATUS_RANK = Object.freeze({ "草稿": 0, "待评审": 1, "已确认": 2, "已废弃": 3 });

  /** 评审流转（沿用 app.js reviewBasicCase 的既有流转，保证体验不回归） */
  const REVIEW_FLOW = Object.freeze({ "草稿": "待评审", "待评审": "已确认", "已确认": "草稿", "已废弃": "草稿" });

  /* ------------------------------------------------------------------ *
   * 模块内状态
   * ------------------------------------------------------------------ */

  /** 视图根容器 #tcmLibraryView */
  let rootEl = null;

  /** 是否已挂载（事件只绑一次） */
  let mounted = false;

  /** `case:focus` 是否已订阅（进程内一次，不随 destroy 解绑） */
  let focusBound = false;

  /** 选中的用例 id 集合（不持久化） */
  const selection = new Set();

  /** 当前排序（不持久化） */
  let sort = { key: "title", dir: "asc" };

  /**
   * 当前选中的目录路径。
   *
   * business 持久化到 `state.basicCaseBusiness`，module 持久化到 `state.basicCaseModule`。
   * ★ F1：business 取值为 `C.ALL_BUSINESS`（"全部业务"，默认）或一条真实业务线。
   */
  let selectedPath = { business: C.ALL_BUSINESS, product: "", module: "", category: "" };

  /** 关键词输入防抖器 */
  let keywordDebounced = null;

  /** 用例字典配置弹窗状态 */
  let catalogConfigOpen = false;
  let catalogPortal = null;

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
   * 读取用例资产集合。
   * @returns {Array<object>} 资产数组
   */
  function assets() {
    return TCM.store.collection("basicCaseLibrary");
  }

  /**
   * 读取显式目录集合。
   * @returns {Array<object>} 目录数组
   */
  function directories() {
    return TCM.store.collection("caseDirectories");
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
          global.console.error("[TCM.library] persist 失败：", error);
        }
      }
    }
  }

  function catalogConfig() {
    return TCM.catalog && typeof TCM.catalog.get === "function"
      ? TCM.catalog.get()
      : { businesses: C.BUSINESS.slice(), components: [], tags: [] };
  }

  function catalogValues(key, fallback) {
    const configured = U.toArray(catalogConfig()[key]).map((item) => U.str(item)).filter(Boolean);
    return configured.length ? configured : U.toArray(fallback).map((item) => U.str(item)).filter(Boolean);
  }

  function parseCatalogText(value) {
    return Array.from(new Set(String(value || "")
      .split(/[\r\n,，;；]+/)
      .map((item) => item.trim())
      .filter(Boolean)));
  }

  function catalogConfigHtml() {
    const config = catalogConfig();
    const components = config.components.length
      ? config.components
      : Array.from(new Set(assets().map((item) => U.str(item.component)).filter(Boolean)));
    const tags = config.tags.length
      ? config.tags
      : Array.from(new Set(assets().flatMap((item) => U.toArray(item.tags).map((tag) => U.str(tag))).filter(Boolean)));
    return `<div class="tcm-catalog-mask" data-tcm-catalog-close></div>
      <section class="tcm-catalog-dialog" role="dialog" aria-modal="true" aria-label="用例字典配置">
        <header class="tcm-catalog-head"><div><span class="tcm-io-kicker">基础用例库</span><h3>业务类型、组件与标签配置</h3></div><button type="button" class="tcm-icon-btn" data-tcm-catalog-close aria-label="关闭">×</button></header>
        <div class="tcm-catalog-body">
          <p class="tcm-catalog-tip">每行一个选项，也支持用逗号分隔。保存后会同步到筛选器和用例详情。</p>
          <label class="tcm-catalog-field"><span>业务类型</span><textarea data-tcm-catalog-field="businesses" rows="4">${U.escapeHtml(config.businesses.join("\n"))}</textarea></label>
          <label class="tcm-catalog-field"><span>功能组件</span><textarea data-tcm-catalog-field="components" rows="4">${U.escapeHtml(components.join("\n"))}</textarea></label>
          <label class="tcm-catalog-field"><span>标签</span><textarea data-tcm-catalog-field="tags" rows="4">${U.escapeHtml(tags.join("\n"))}</textarea></label>
        </div>
        <footer class="tcm-catalog-foot"><button type="button" class="tcm-btn tcm-btn-ghost" data-tcm-catalog-close>取消</button><button type="button" class="tcm-btn tcm-btn-primary" data-tcm-catalog-save>保存配置</button></footer>
      </section>`;
  }

  function syncCatalogPortal() {
    if (!doc || !doc.body) {
      return;
    }
    if (!catalogConfigOpen) {
      if (catalogPortal) {
        catalogPortal.remove();
        catalogPortal = null;
      }
      return;
    }
    if (!catalogPortal) {
      catalogPortal = doc.createElement("div");
      catalogPortal.id = "tcmCatalogPortal";
      catalogPortal.addEventListener("click", onClick);
      doc.body.appendChild(catalogPortal);
    }
    catalogPortal.innerHTML = catalogConfigHtml();
  }

  /**
   * 轻提示（复用 app.js showToast，缺失时降级到 console）。
   * @param {string} message 提示内容
   * @param {string} [tone] 语气：info|success|warning|error
   * @returns {void}
   */
  function toast(message, tone) {
    if (typeof global.showToast === "function") {
      global.showToast(message, tone || "info");
      return;
    }
    if (global.console && typeof global.console.info === "function") {
      global.console.info(`[TCM.library] ${message}`);
    }
  }

  /**
   * 当前操作人。
   * @returns {string} 操作人名称
   */
  function operator() {
    return U.currentOperator(getState());
  }

  /* ------------------------------------------------------------------ *
   * 筛选条件（持久化到 LOCAL_STATE_KEYS.tcmLibraryFilters）
   * ------------------------------------------------------------------ */

  /**
   * 读取筛选条件（缺字段自动补空串）。
   * @returns {{keyword:string,type:string,priority:string,status:string,component:string,tag:string,automation:string}} 筛选条件
   */
  function getFilters() {
    const state = getState();
    const raw = state.tcmLibraryFilters && typeof state.tcmLibraryFilters === "object" ? state.tcmLibraryFilters : {};
    return {
      business: U.str(raw.business),
      keyword: U.str(raw.keyword),
      type: U.str(raw.type),
      priority: U.str(raw.priority),
      status: U.str(raw.status),
      component: U.str(raw.component),
      tag: U.str(raw.tag),
      automation: U.str(raw.automation)
    };
  }

  /**
   * 写入单个筛选条件。
   * @param {string} key 字段名
   * @param {string} value 取值
   * @returns {void}
   */
  function setFilter(key, value) {
    const state = getState();
    const next = getFilters();
    next[key] = U.str(value);
    state.tcmLibraryFilters = next;
    persistLocal();
  }

  /**
   * 清空全部筛选条件（不影响目录选择）。
   * @returns {void}
   */
  function clearFilters() {
    getState().tcmLibraryFilters = {
      business: "", keyword: "", type: "", priority: "", status: "", component: "", tag: "", automation: ""
    };
    persistLocal();
  }

  /* ------------------------------------------------------------------ *
   * 目录选择 / 折叠态
   * ------------------------------------------------------------------ */

  /**
   * 当前作用域是否为「全部业务」（★ F1）。
   * @returns {boolean} 是否不按 business 过滤
   */
  function isAllScope() {
    return U.isAllBusiness(selectedPath.business);
  }

  /**
   * 当前作用域的业务显示名（「全部业务」或业务线名）。
   * @returns {string} 显示文案
   */
  function businessLabel() {
    return U.businessScopeLabel(selectedPath.business);
  }

  /**
   * 输出给下游模块（编辑抽屉 / 导入导出）的目录上下文。
   *
   * ★ F1：「全部业务」是视图作用域而非真实业务线，向下游透传时必须降级为空串，
   * 否则新建 / 导入的用例会带上 `__ALL__` 这种非法 business 值。
   *
   * @returns {{business:string, product:string, module:string, category:string}} 目录上下文
   */
  function scopeContext() {
    return {
      business: isAllScope() ? "" : selectedPath.business,
      product: selectedPath.product,
      module: selectedPath.module,
      category: selectedPath.category
    };
  }

  /**
   * 从 state 同步目录选择（业务线 + 模块）。
   * @returns {void}
   */
  function syncSelectedPath() {
    const state = getState();
    // 业务类型不再由左侧子菜单决定，基础用例库默认展示全库，交给列表筛选区分。
    const business = C.ALL_BUSINESS;
    selectedPath = { business, product: "", module: "", category: "" };
    state.basicCaseBusiness = business;
    state.basicCaseModule = "";
  }

  /**
   * 选择目录节点，并同步回 state（保持与左侧导航/旧逻辑一致）。
   * @param {{business:string,product:string,module:string,category:string}} path 目录路径
   * @returns {void}
   */
  function selectPath(path) {
    const state = getState();
    // ★ F1：非法/空业务不再回落到 BUSINESS[0]，而是回落到「全部业务」
    const business = U.businessScope(path.business);
    selectedPath = {
      business,
      product: U.str(path.product),
      module: U.str(path.module),
      category: U.str(path.category)
    };
    state.basicCaseBusiness = business;
    state.basicCaseModule = selectedPath.module;
    selection.clear();
    persistLocal();
    render();
  }

  /**
   * 读取展开节点集合。
   * @returns {Set<string>} 展开的节点 id
   */
  function expandedSet() {
    const state = getState();
    if (!Array.isArray(state.tcmTreeExpanded)) {
      state.tcmTreeExpanded = [];
    }
    return new Set(state.tcmTreeExpanded.map((item) => String(item)));
  }

  /**
   * 写回展开节点集合。
   * @param {Set<string>} set 展开的节点 id
   * @returns {void}
   */
  function saveExpanded(set) {
    getState().tcmTreeExpanded = Array.from(set);
    persistLocal();
  }

  /* ------------------------------------------------------------------ *
   * 数据派生
   * ------------------------------------------------------------------ */

  /**
   * 组合「目录选择 + 筛选条件」为 applyFilters 的入参。
   * @returns {object} 筛选条件对象
   */
  function buildFilterInput() {
    const filters = getFilters();
    return {
      // ★ F1：「全部业务」作用域下传空串，applyFilters 会跳过 business 维度
      business: filters.business || (isAllScope() ? "" : selectedPath.business),
      product: selectedPath.product,
      module: selectedPath.module,
      category: selectedPath.category,
      keyword: filters.keyword,
      type: filters.type,
      priority: filters.priority,
      status: filters.status,
      component: filters.component,
      tag: filters.tag,
      automation: filters.automation
    };
  }

  /**
   * 排序用例列表（返回新数组，不修改入参）。
   * @param {Array<object>} list 资产数组
   * @returns {Array<object>} 排序后的数组
   */
  function sortRows(list) {
    const dir = sort.dir === "asc" ? 1 : -1;
    const key = sort.key;
    return list.slice().sort((a, b) => {
      if (key === "priority") {
        const av = PRIORITY_RANK[a.priority] === undefined ? 99 : PRIORITY_RANK[a.priority];
        const bv = PRIORITY_RANK[b.priority] === undefined ? 99 : PRIORITY_RANK[b.priority];
        return av === bv ? 0 : (av < bv ? -1 : 1) * dir;
      }
      if (key === "status") {
        const av = STATUS_RANK[a.status] === undefined ? 99 : STATUS_RANK[a.status];
        const bv = STATUS_RANK[b.status] === undefined ? 99 : STATUS_RANK[b.status];
        return av === bv ? 0 : (av < bv ? -1 : 1) * dir;
      }
      const av = U.str(a[key]);
      const bv = U.str(b[key]);
      return av.localeCompare(bv, "zh-Hans-CN") * dir;
    });
  }

  /**
   * 收集当前业务线下的组件 / 标签候选集（用于筛选下拉）。
   * @param {Array<object>} list 资产数组
   * @returns {{components:Array<string>, tags:Array<string>}} 候选集合
   */
  function collectFacets(list) {
    const businesses = new Set();
    const components = new Set();
    const tags = new Set();
    list.forEach((item) => {
      const business = U.str(item.business);
      if (business) {
        businesses.add(business);
      }
      const component = U.str(item.component);
      if (component) {
        components.add(component);
      }
      U.toArray(item.tags).forEach((tag) => {
        const text = U.str(tag);
        if (text) {
          tags.add(text);
        }
      });
    });
    return {
      businesses: Array.from(businesses).sort((a, b) => a.localeCompare(b, "zh-Hans-CN")),
      components: Array.from(components).sort((a, b) => a.localeCompare(b, "zh-Hans-CN")),
      tags: Array.from(tags).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"))
    };
  }

  /* ------------------------------------------------------------------ *
   * HTML 片段
   * ------------------------------------------------------------------ */

  /**
   * 渲染下拉选项。
   * @param {Array<string>} values 选项值
   * @param {string} current 当前值
   * @param {string} allLabel 「全部」选项文案
   * @returns {string} option HTML
   */
  function optionsHtml(values, current, allLabel) {
    const head = `<option value="">${U.escapeHtml(allLabel)}</option>`;
    return head + values.map((value) => {
      const selected = value === current ? " selected" : "";
      return `<option value="${U.escapeHtml(value)}"${selected}>${U.escapeHtml(value)}</option>`;
    }).join("");
  }

  /**
   * 递归渲染目录树节点。
   * @param {Array<object>} nodes 节点数组
   * @param {Set<string>} expanded 展开节点集合
   * @param {number} depth 当前层级深度（0 起）
   * @returns {string} HTML 片段
   */
  function treeNodesHtml(nodes, expanded, depth) {
    return nodes.map((node) => {
      const hasChildren = node.children.length > 0;
      const isExpanded = expanded.has(node.id);
      const isActive = node.business === selectedPath.business
        && U.str(node.product) === selectedPath.product
        && U.str(node.module) === selectedPath.module
        && (node.level !== "category" ? !selectedPath.category : node.name === selectedPath.category)
        && levelMatches(node);
      const payload = U.escapeHtml(JSON.stringify({
        level: node.level,
        name: node.name,
        business: node.business,
        product: node.product,
        module: node.module,
        count: node.count,
        explicit: node.explicit
      }));
      const toggle = hasChildren
        ? `<button type="button" class="tcm-tree-toggle${isExpanded ? " is-open" : ""}" data-tcm-tree-toggle="${U.escapeHtml(node.id)}" aria-label="${isExpanded ? "折叠" : "展开"} ${U.escapeHtml(node.name)}" aria-expanded="${isExpanded ? "true" : "false"}"></button>`
        : `<span class="tcm-tree-toggle is-leaf" aria-hidden="true"></span>`;
      const dirActions = node.level === "business"
        ? ""
        : `<span class="tcm-tree-actions">
             <button type="button" class="tcm-tree-btn" data-tcm-dir-rename="${payload}" title="重命名目录">✎</button>
             <button type="button" class="tcm-tree-btn danger" data-tcm-dir-delete="${payload}" title="删除目录">🗑</button>
           </span>`;
      const childrenHtml = hasChildren && isExpanded
        ? `<div class="tcm-tree-children">${treeNodesHtml(node.children, expanded, depth + 1)}</div>`
        : "";
      return `<div class="tcm-tree-node" data-level="${U.escapeHtml(node.level)}">
        <div class="tcm-tree-row${isActive ? " is-active" : ""}" style="padding-left:${depth * 14}px">
          ${toggle}
          <button type="button" class="tcm-tree-label" data-tcm-tree-select="${payload}" title="${U.escapeHtml(node.name)}">${U.escapeHtml(node.name || "未命名")}</button>
          <span class="tcm-tree-count">${U.escapeHtml(String(node.count))}</span>
          ${dirActions}
        </div>
        ${childrenHtml}
      </div>`;
    }).join("");
  }

  /**
   * 判断节点层级是否与当前选择层级一致（避免父子节点同时高亮）。
   * @param {object} node 树节点
   * @returns {boolean} 是否一致
   */
  function levelMatches(node) {
    if (selectedPath.category) {
      return node.level === "category";
    }
    if (selectedPath.module) {
      return node.level === "module";
    }
    if (selectedPath.product) {
      return node.level === "product";
    }
    return node.level === "business";
  }

  /**
   * 渲染目录树顶部的「全部业务」节点（★ F1）。
   *
   * 该节点不属于 buildDirectoryTree 派生结果，是一个显式的作用域入口：
   * 选中时不按 business 过滤，展示全库资产。
   *
   * @param {number} totalCount 全库用例总数
   * @returns {string} HTML 片段
   */
  function allBusinessNodeHtml(totalCount) {
    const isActive = isAllScope()
      && !selectedPath.product
      && !selectedPath.module
      && !selectedPath.category;
    const payload = U.escapeHtml(JSON.stringify({
      level: "business",
      name: C.ALL_BUSINESS,
      business: C.ALL_BUSINESS,
      product: "",
      module: "",
      count: totalCount,
      explicit: false
    }));
    return `<div class="tcm-tree-node tcm-tree-all" data-level="business">
      <div class="tcm-tree-row${isActive ? " is-active" : ""}">
        <span class="tcm-tree-toggle is-leaf" aria-hidden="true"></span>
        <button type="button" class="tcm-tree-label" data-tcm-tree-select="${payload}" title="展示全部业务线的用例资产">${U.escapeHtml(C.ALL_BUSINESS_LABEL)}</button>
        <span class="tcm-tree-count">${U.escapeHtml(String(totalCount))}</span>
      </div>
    </div>`;
  }

  /**
   * 渲染目录树侧栏。
   * @param {Array<object>} tree 目录树
   * @param {number} totalCount 全库用例总数（用于「全部业务」节点计数）
   * @returns {string} HTML 片段
   */
  function treeHtml(tree, totalCount) {
    const expanded = expandedSet();
    return `<aside class="tcm-tree" aria-label="用例目录">
      <div class="tcm-tree-head">
        <span class="tcm-tree-head-title">用例目录</span>
        <button type="button" class="tcm-tree-newdir" data-tcm-dir-new="1" title="在当前选中位置新建空目录">＋ 新建目录</button>
      </div>
      <div class="tcm-tree-body">${allBusinessNodeHtml(totalCount)}${treeNodesHtml(tree, expanded, 0)}</div>
      <p class="tcm-tree-tip">重命名会级联更新该目录下所有用例的归属；含用例的目录不可删除。</p>
    </aside>`;
  }

  /**
   * 渲染筛选条（吸顶）。
   * @param {{components:Array<string>,tags:Array<string>}} facets 候选集合
   * @returns {string} HTML 片段
   */
  function filterControlHtml(controlHtml, key, active) {
    const hasSelect = controlHtml.includes("tcm-filter-select");
    return `<span class="tcm-filter-control${active ? " is-active" : ""}${hasSelect ? " has-select" : ""}">
      ${controlHtml}
      ${active ? `<button type="button" class="tcm-filter-control-clear" data-tcm-filter-clear="${U.escapeHtml(key)}" aria-label="清除当前筛选" title="清除当前筛选"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" /></svg></button>` : ""}
    </span>`;
  }

  function filterBarHtml(facets) {
    const filters = getFilters();
    const catalog = catalogConfig();
    return `<div class="tcm-filters">
      ${filterControlHtml(`<select class="tcm-filter-select" data-tcm-filter="business" aria-label="按业务类型筛选">
        ${optionsHtml(catalog.businesses, filters.business, "全部业务类型")}
      </select>`, "business", Boolean(filters.business))}
      ${filterControlHtml(`<input type="search" id="tcmLibKeyword" class="tcm-filter-input" data-tcm-filter="keyword"
        placeholder="搜索标题 / 步骤 / 标签 / 组件" aria-label="搜索用例" value="${U.escapeHtml(filters.keyword)}">`, "keyword", Boolean(filters.keyword))}
      ${filterControlHtml(`<select class="tcm-filter-select" data-tcm-filter="type" aria-label="按用例类型筛选">
        ${optionsHtml(C.CASE_TYPE.slice(), filters.type, "全部类型")}
      </select>`, "type", Boolean(filters.type))}
      ${filterControlHtml(`<select class="tcm-filter-select" data-tcm-filter="priority" aria-label="按优先级筛选">
        ${optionsHtml(C.PRIORITY.slice(), filters.priority, "全部优先级")}
      </select>`, "priority", Boolean(filters.priority))}
      ${filterControlHtml(`<select class="tcm-filter-select" data-tcm-filter="status" aria-label="按用例状态筛选">
        ${optionsHtml(C.CASE_STATUS.slice(), filters.status, "全部状态")}
      </select>`, "status", Boolean(filters.status))}
      ${filterControlHtml(`<select class="tcm-filter-select" data-tcm-filter="component" aria-label="按组件筛选">
        ${optionsHtml(catalogValues("components", facets.components), filters.component, "全部组件")}
      </select>`, "component", Boolean(filters.component))}
      ${filterControlHtml(`<select class="tcm-filter-select" data-tcm-filter="tag" aria-label="按标签筛选">
        ${optionsHtml(catalogValues("tags", facets.tags), filters.tag, "全部标签")}
      </select>`, "tag", Boolean(filters.tag))}
      ${filterControlHtml(`<select class="tcm-filter-select" data-tcm-filter="automation" aria-label="按是否自动化筛选">
        <option value=""${filters.automation === "" ? " selected" : ""}>自动化：不限</option>
        <option value="yes"${filters.automation === "yes" ? " selected" : ""}>已接入自动化</option>
        <option value="no"${filters.automation === "no" ? " selected" : ""}>未接入自动化</option>
      </select>`, "automation", Boolean(filters.automation))}
      <select class="tcm-filter-select" data-tcm-sort aria-label="排序方式">
        ${SORT_OPTIONS.map((option) => {
          const selected = option.key === sort.key ? " selected" : "";
          return `<option value="${U.escapeHtml(option.key)}"${selected}>排序：${U.escapeHtml(option.label)}</option>`;
        }).join("")}
      </select>
      <button type="button" class="tcm-filter-dir" data-tcm-sort-dir="1" title="切换升序/降序">${sort.dir === "asc" ? "↑ 升序" : "↓ 降序"}</button>
      <button type="button" class="tcm-filter-clear-all tcm-filter-clear-all-inline" data-tcm-filter-clear-all="1">清除全部</button>
    </div>`;
  }

  /**
   * 渲染「已激活筛选」标签行。
   * @returns {string} HTML 片段
   */
  function activeFiltersHtml() {
    // 筛选条件的单项清除入口已放在对应筛选框内，不再额外渲染标签行。
    return "";
    const filters = getFilters();
    const chips = [];
    if (selectedPath.product) {
      chips.push({ key: "__product", label: `产品：${selectedPath.product}` });
    }
    if (selectedPath.module) {
      chips.push({ key: "__module", label: `模块：${selectedPath.module}` });
    }
    if (selectedPath.category) {
      chips.push({ key: "__category", label: `场景：${selectedPath.category}` });
    }
    if (filters.business) {
      chips.push({ key: "business", label: `业务类型：${filters.business}` });
    }
    if (filters.keyword) {
      chips.push({ key: "keyword", label: `搜索：${filters.keyword}` });
    }
    if (filters.type) {
      chips.push({ key: "type", label: `类型：${filters.type}` });
    }
    if (filters.priority) {
      chips.push({ key: "priority", label: `优先级：${filters.priority}` });
    }
    if (filters.status) {
      chips.push({ key: "status", label: `状态：${filters.status}` });
    }
    if (filters.component) {
      chips.push({ key: "component", label: `组件：${filters.component}` });
    }
    if (filters.tag) {
      chips.push({ key: "tag", label: `标签：${filters.tag}` });
    }
    if (filters.automation) {
      chips.push({ key: "automation", label: filters.automation === "yes" ? "已接入自动化" : "未接入自动化" });
    }
    if (!chips.length) {
      return "";
    }
    return `<div class="tcm-filter-footer" aria-live="polite">
      <span class="tcm-filter-summary-label">已执行筛选：</span>
      <div class="tcm-filter-summary">
        ${chips.map((chip) => `<span class="tcm-filter-chip">
          <span>${U.escapeHtml(chip.label)}</span>
          <button type="button" class="tcm-filter-chip-clear" data-tcm-filter-clear="${U.escapeHtml(chip.key)}" aria-label="清除${U.escapeHtml(chip.label)}">×</button>
        </span>`).join("")}
      </div>
    </div>`;
  }

  /**
   * 渲染批量操作工具条。
   * @param {number} visibleCount 当前可见用例数
   * @returns {string} HTML 片段
   */
  function batchBarHtml(visibleCount) {
    if (selection.size === 0) {
      return "";
    }
    return `<div class="tcm-batchbar" role="toolbar" aria-label="批量操作">
      <span class="tcm-batch-count">已选 <strong>${U.escapeHtml(String(selection.size))}</strong> / ${U.escapeHtml(String(visibleCount))} 项</span>
      <select class="tcm-batch-select" data-tcm-batch-status aria-label="批量改状态">
        <option value="">批量改状态…</option>
        ${C.CASE_STATUS.map((status) => `<option value="${U.escapeHtml(status)}">${U.escapeHtml(status)}</option>`).join("")}
      </select>
      <select class="tcm-batch-select" data-tcm-batch-priority aria-label="批量改优先级">
        <option value="">批量改优先级…</option>
        ${C.PRIORITY.map((value) => `<option value="${U.escapeHtml(value)}">${U.escapeHtml(value)}</option>`).join("")}
      </select>
      <select class="tcm-batch-select" data-tcm-batch-type aria-label="批量改用例类型">
        <option value="">批量改类型…</option>
        ${C.CASE_TYPE.map((value) => `<option value="${U.escapeHtml(value)}">${U.escapeHtml(value)}</option>`).join("")}
      </select>
      <button type="button" class="tcm-batch-btn" data-tcm-batch="tag">批量加标签</button>
      <button type="button" class="tcm-batch-btn" data-tcm-batch="copy">批量复制</button>
      <button type="button" class="tcm-batch-btn danger" data-tcm-batch="delete">批量删除</button>
      <button type="button" class="tcm-batch-btn" data-tcm-batch="plan" title="把选中的用例加入测试计划（只引用 id，不复制正文）">加入计划</button>
      <button type="button" class="tcm-batch-btn" data-tcm-batch="review" title="对选中的用例发起评审单（只引用 id，草稿用例将随发起流转为待评审）">发起评审</button>
      <button type="button" class="tcm-batch-btn" data-tcm-batch="ai" title="调用 AI 为选中用例补全步骤与预期结果，结果先进「建议」态，确认后才写库">AI 批量补全</button>
      <button type="button" class="tcm-batch-btn" data-tcm-batch="export" title="导出选中用例（CSV / xlsx / OPML / Markdown）">导出</button>
      <button type="button" class="tcm-batch-btn ghost" data-tcm-batch="clear">取消选择</button>
    </div>`;
  }

  /**
   * 渲染单条用例行（沿用既有 .bcl- 结构，保留 107 处 CSS 投资）。
   * @param {object} item 用例资产
   * @param {Function} planLabel 计划 id → 显示名
   * @param {boolean} [showBusiness] 是否在元信息行补出业务线徽标（「全部业务」作用域下为 true）
   * @returns {string} HTML 片段
   */
  function rowHtml(item, planLabel, showBusiness) {
    const isSelected = selection.has(item.id);
    const priorityTone = PRIORITY_TONE[item.priority] || "tone-gray";
    const statusTone = STATUS_TONE[item.status] || "tone-gray";
    const tagList = U.toArray(item.tags);
    const tagChips = tagList.slice(0, 3).map((tag) => `<span class="bcl-tag">${U.escapeHtml(tag)}</span>`).join("");
    const tagMore = tagList.length > 3 ? `<span class="bcl-chip ghost">+${U.escapeHtml(String(tagList.length - 3))}</span>` : "";
    const batchIds = U.toArray(item.linkedBatchIds);
    const planChips = batchIds.slice(0, 2).map((id) => `<span class="bcl-chip">${U.escapeHtml(planLabel(id))}</span>`).join("");
    const planMore = batchIds.length > 2 ? `<span class="bcl-chip ghost">+${U.escapeHtml(String(batchIds.length - 2))}</span>` : "";
    const planBlock = batchIds.length
      ? `<span class="bcl-chips">${planChips}${planMore}</span>`
      : `<span class="bcl-muted">未关联计划</span>`;
    const breadcrumb = [item.product, item.module, item.category]
      .map((part) => U.str(part))
      .filter((part, index, list) => part && list.indexOf(part) === index)
      .join(" / ") || "未分类";
    const fields = [
      { label: "测试目标", value: item.objective },
      { label: "前置条件", value: item.preconditions },
      { label: "测试数据", value: item.testData },
      { label: "操作步骤", value: item.steps },
      { label: "预期结果", value: item.expected }
    ];
    const fieldRows = fields
      .filter((field) => U.str(field.value))
      .map((field) => `<div class="bcl-field"><span class="bcl-field-label">${U.escapeHtml(field.label)}</span><span class="bcl-field-value">${U.escapeHtml(field.value)}</span></div>`)
      .join("");
    const reviewLabel = item.status === "草稿"
      ? "提交评审"
      : (item.status === "待评审" ? "评审通过" : (item.status === "已确认" ? "退回草稿" : "恢复草稿"));
    const automationBadge = item.automationEnabled
      ? `<span class="tcm-badge tcm-badge-auto">自动化</span>`
      : "";
    // T05：基线用例在列表打标，baselineFrom 记录成为基线时的版本号
    const baselineFrom = U.num(item.baselineFrom, 0, 0);
    const baselineBadge = item.isBaseline
      ? `<span class="tcm-badge tcm-badge-baseline" title="基线版本${baselineFrom ? ` v${baselineFrom}` : ""}">基线${baselineFrom ? ` v${U.escapeHtml(String(baselineFrom))}` : ""}</span>`
      : "";
    // ★ F1：「全部业务」作用域下多业务线用例混排，必须能一眼看出归属
    const businessBadge = showBusiness
      ? `<span class="tcm-badge tcm-badge-business" title="所属业务线">${U.escapeHtml(U.str(item.business, "未归属"))}</span>`
      : "";

    return `
      <div class="bcl-row prio-${U.escapeHtml(item.priority)}${isSelected ? " selected" : ""}" data-id="${U.escapeHtml(item.id)}">
        <div class="bcl-main">
          <div class="bcl-titleline">
            ${tagChips || tagMore ? `<span class="bcl-chips">${tagChips}${tagMore}</span>` : ""}
            <span class="badge ${priorityTone}">${U.escapeHtml(item.priority)}</span>
            <span class="badge ${statusTone}">${U.escapeHtml(item.status)}</span>
            ${planBlock}
            <span class="bcl-title" data-tcm-open="${U.escapeHtml(item.id)}">${U.escapeHtml(item.title)}</span>
          </div>
          <div class="bcl-meta">
            ${showBusiness ? `<span class="tcm-badge tcm-badge-business-label">业务类型</span>` : ""}
            ${businessBadge}
            <span class="tcm-badge tcm-badge-type">${U.escapeHtml(item.type)}</span>
            <span>${U.escapeHtml(breadcrumb)}</span>
            <span>· ${U.escapeHtml(U.str(item.component, "—"))}</span>
            <span>· v${U.escapeHtml(String(item.version))}</span>
            ${automationBadge}
            ${baselineBadge}
          </div>
          ${fieldRows ? `<div class="bcl-fields">${fieldRows}</div>` : ""}
        </div>
        <div class="bcl-actions">
          <button type="button" class="review-btn" data-tcm-review="${U.escapeHtml(item.id)}">${U.escapeHtml(reviewLabel)}</button>
          <div class="bcl-mini">
            <span data-tcm-copy="${U.escapeHtml(item.id)}">复制</span>
            <span data-tcm-open="${U.escapeHtml(item.id)}">详情</span>
            <span class="bcl-del" data-tcm-delete="${U.escapeHtml(item.id)}">删除</span>
          </div>
        </div>
      </div>
    `;
  }

  /* ------------------------------------------------------------------ *
   * 主渲染
   * ------------------------------------------------------------------ */

  /**
   * 记录当前焦点（重渲染后恢复，避免搜索框失焦）。
   * @returns {{id:string, start:number, end:number}|null} 焦点快照
   */
  function captureFocus() {
    if (!doc || !doc.activeElement || !rootEl || !rootEl.contains(doc.activeElement)) {
      return null;
    }
    const el = doc.activeElement;
    if (!el.id) {
      return null;
    }
    const snapshot = { id: el.id, start: 0, end: 0 };
    if (typeof el.selectionStart === "number") {
      snapshot.start = el.selectionStart;
      snapshot.end = typeof el.selectionEnd === "number" ? el.selectionEnd : el.selectionStart;
    }
    return snapshot;
  }

  /**
   * 恢复焦点与光标位置。
   * @param {{id:string, start:number, end:number}|null} snapshot 焦点快照
   * @returns {void}
   */
  function restoreFocus(snapshot) {
    if (!snapshot || !doc) {
      return;
    }
    const el = doc.getElementById(snapshot.id);
    if (!el || typeof el.focus !== "function") {
      return;
    }
    el.focus();
    if (typeof el.setSelectionRange === "function") {
      try {
        el.setSelectionRange(snapshot.start, snapshot.end);
      } catch (_error) {
        // number/email 等输入类型不支持 setSelectionRange，忽略
      }
    }
  }

  /**
   * 渲染用例库视图（幂等）。
   * @returns {void}
   */
  function render() {
    if (!doc) {
      return;
    }
    if (!rootEl) {
      rootEl = doc.getElementById("tcmLibraryView");
    }
    if (!rootEl) {
      return;
    }

    syncSelectedPath();

    const all = assets();
    const tree = TCM.model.buildDirectoryTree(all, directories());
    const allScope = isAllScope();
    // ★ F1：「全部业务」作用域不做 business 过滤，全库资产都可见
    const businessScoped = allScope ? all.slice() : all.filter((item) => item.business === selectedPath.business);
    const facets = collectFacets(businessScoped);
    const rows = sortRows(TCM.model.applyFilters(all, buildFilterInput()));

    // 清理已不存在的选中项，避免批量操作命中幽灵 id
    const liveIds = new Set(all.map((item) => item.id));
    Array.from(selection).forEach((id) => {
      if (!liveIds.has(id)) {
        selection.delete(id);
      }
    });

    const batches = Array.isArray(getState().batches) ? getState().batches : [];
    const planLabel = (planId) => {
      const batch = batches.find((entry) => entry.id === planId);
      return batch ? U.str(batch.version || batch.name || planId) : U.str(planId);
    };

    const scopeLabel = businessLabel();
    const scopeText = [scopeLabel, selectedPath.product, selectedPath.module, selectedPath.category]
      .map((part) => U.str(part))
      .filter(Boolean)
      .join(" / ");

    const listHtml = rows.length
      ? rows.map((item) => rowHtml(item, planLabel, allScope)).join("")
      : `<div class="empty-state empty-state-rich">
          <strong>没有符合条件的基础用例</strong>
          <p>调整筛选条件，或把常用的标准场景写成基础用例，下次建任务时一键复用。</p>
          <div class="empty-actions">
            <button type="button" class="primary-button" data-tcm-add="1">新增基础用例</button>
          </div>
        </div>`;

    const focusSnapshot = captureFocus();

    // ★ 右侧「用例目录」树与左侧导航业务子菜单功能完全重复，按需求隐藏。
    // 保留 treeHtml() 函数不删（避免破坏潜在引用），仅在此跳过渲染；
    // 同时给布局容器加 --no-tree 修饰类，让列表区占满整行宽度。
    const showTreeAside = false;

    rootEl.innerHTML = `
      <div class="tcm-lib-layout${showTreeAside ? "" : " tcm-lib-layout--no-tree"}">
        ${showTreeAside ? treeHtml(tree, all.length) : ""}
        <section class="panel tcm-lib-main">
          <div class="section-head compact-section-head">
            <div class="section-head-actions">
              <button type="button" class="ghost-button" data-tcm-io="import" title="批量导入测试用例，支持 CSV / xlsx、字段映射与冲突处理">批量导入</button>
              <button type="button" class="ghost-button" data-tcm-io="filtered" title="批量导出测试用例，可选择当前筛选、当前目录或全部用例">批量导出</button>
              <button type="button" class="ghost-button" data-tcm-catalog-config="1" title="配置业务类型、功能组件和标签">用例字典</button>
              <button type="button" class="primary-button" data-tcm-add="1">新增基础用例</button>
            </div>
          </div>
          ${filterBarHtml(facets)}
          ${activeFiltersHtml()}
          <div class="tcm-lib-list list-stack">${listHtml}</div>
        </section>
      </div>
    `;

    restoreFocus(focusSnapshot);
    renderNavSubmenu();
    syncCatalogPortal();
  }

  /**
   * 渲染左侧导航「基础用例库」子菜单（★ F1：「全部业务」+ 5 个业务分组 + 计数）。
   *
   * DOM 结构与旧实现保持一致（`.nav-sub-item[data-business]`），
   * app.js `bindEvents` 里既有的子菜单点击处理器无需改动——它直接把
   * `data-business` 写进 `state.basicCaseBusiness`，`__ALL__` 走同一条路径。
   * @returns {void}
   */
  function renderNavSubmenu() {
    if (!doc) {
      return;
    }
    const host = doc.getElementById("basicCaseNavSubmenu");
    if (!host) {
      return;
    }
    const all = assets();
    const counts = {};
    C.BUSINESS.forEach((business) => {
      counts[business] = 0;
    });
    all.forEach((item) => {
      if (counts[item.business] === undefined) {
        counts[item.business] = 0;
      }
      counts[item.business] += 1;
    });
    const active = U.businessScope(getState().basicCaseBusiness);
    const entries = [{ value: C.ALL_BUSINESS, label: C.ALL_BUSINESS_LABEL, count: all.length }]
      .concat(C.BUSINESS.map((business) => ({ value: business, label: business, count: counts[business] || 0 })));
    host.innerHTML = entries.map((entry) => {
      const isActive = entry.value === active;
      return `<button class="nav-link nav-sub-item${isActive ? " active" : ""}" data-business="${U.escapeHtml(entry.value)}">
        <span>${U.escapeHtml(entry.label)}</span>
        <span class="nav-sub-count">${U.escapeHtml(String(entry.count))}</span>
      </button>`;
    }).join("")
      // ★ 目录 CRUD 入口：复用 library 已有的 createDirectory()（[data-tcm-dir-new] → onClick 委托）。
      // 注意：刻意不加 nav-sub-item 类，否则会被 app.js 子菜单处理器误判为业务切换。
      + `<button type="button" class="ghost-button tcm-nav-newdir" data-tcm-dir-new="1" title="在所选业务线下新建空目录">＋ 新建目录</button>`;
  }

  /* ------------------------------------------------------------------ *
   * 目录操作
   * ------------------------------------------------------------------ */

  /**
   * 解析 data-* 上携带的目录节点信息。
   * @param {string} raw JSON 字符串
   * @returns {object|null} 节点信息
   */
  function parseNodePayload(raw) {
    try {
      const parsed = JSON.parse(String(raw || ""));
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_error) {
      return null;
    }
  }

  /**
   * 判断一条资产是否属于指定目录节点。
   * @param {object} asset 资产
   * @param {object} node 目录节点
   * @returns {boolean} 是否归属
   */
  function assetInNode(asset, node) {
    if (U.str(asset.business) !== U.str(node.business)) {
      return false;
    }
    if (node.level === "product") {
      return U.str(asset.product) === U.str(node.name);
    }
    if (node.level === "module") {
      return U.str(asset.product) === U.str(node.product) && U.str(asset.module) === U.str(node.name);
    }
    if (node.level === "category") {
      return U.str(asset.product) === U.str(node.product)
        && U.str(asset.module) === U.str(node.module)
        && U.str(asset.category) === U.str(node.name);
    }
    return true;
  }

  /**
   * 重命名目录（级联更新用例归属字段 + 显式目录节点）。
   * @param {object} node 目录节点
   * @returns {void}
   */
  function renameDirectory(node) {
    const current = U.str(node.name);
    const input = global.prompt(`将目录「${current}」重命名为：`, current);
    if (input === null) {
      return;
    }
    const nextName = U.str(input);
    if (!nextName) {
      toast("目录名称不能为空。", "warning");
      return;
    }
    if (nextName === current) {
      return;
    }

    const stamp = U.nowIso();
    const who = operator();
    let changed = 0;
    const nextAssets = assets().map((asset) => {
      if (!assetInNode(asset, node)) {
        return asset;
      }
      const copy = Object.assign({}, asset);
      if (node.level === "product") {
        copy.product = nextName;
      } else if (node.level === "module") {
        copy.module = nextName;
        if (U.str(copy.category) === current) {
          copy.category = nextName;
        }
      } else if (node.level === "category") {
        copy.category = nextName;
      }
      copy.updatedBy = who;
      copy.updatedAt = stamp;
      changed += 1;
      return copy;
    });

    const nextDirs = directories().map((dir) => {
      if (U.str(dir.business) !== U.str(node.business) || U.str(dir.level) !== U.str(node.level)) {
        return dir;
      }
      if (node.level === "product" && U.str(dir.name) === current) {
        return { level: "product", business: dir.business, product: nextName, module: "", name: nextName, order: dir.order, createdAt: dir.createdAt };
      }
      if (node.level === "module" && U.str(dir.product) === U.str(node.product) && U.str(dir.name) === current) {
        return { level: "module", business: dir.business, product: dir.product, module: nextName, name: nextName, order: dir.order, createdAt: dir.createdAt };
      }
      if (node.level === "category"
        && U.str(dir.product) === U.str(node.product)
        && U.str(dir.module) === U.str(node.module)
        && U.str(dir.name) === current) {
        return { level: "category", business: dir.business, product: dir.product, module: dir.module, name: nextName, order: dir.order, createdAt: dir.createdAt };
      }
      return dir;
    });
    // 同时把「以旧名为父级」的子目录路径一起改掉，避免目录树断链
    const repathed = nextDirs.map((dir) => {
      const copy = Object.assign({}, dir);
      if (U.str(copy.business) !== U.str(node.business)) {
        return copy;
      }
      if (node.level === "product" && U.str(copy.product) === current) {
        copy.product = nextName;
        delete copy.id;
      } else if (node.level === "module"
        && U.str(copy.product) === U.str(node.product)
        && U.str(copy.module) === current) {
        copy.module = nextName;
        delete copy.id;
      }
      return copy;
    });

    TCM.store.commit("caseDirectories", repathed, { source: "library" });
    TCM.store.commit("basicCaseLibrary", nextAssets, { source: "library" });

    // 选中态跟着改名走
    if (node.level === "product" && selectedPath.product === current) {
      selectedPath.product = nextName;
    }
    if (node.level === "module" && selectedPath.module === current) {
      selectedPath.module = nextName;
      getState().basicCaseModule = nextName;
    }
    if (node.level === "category" && selectedPath.category === current) {
      selectedPath.category = nextName;
    }

    TCM.bus.emit(C.EVENTS.DIR_CHANGED, { action: "rename", from: current, to: nextName, level: node.level, affected: changed });
    toast(`已将目录「${current}」重命名为「${nextName}」，级联更新 ${changed} 条用例。`, "success");
    render();
  }

  /**
   * 删除目录（有用例时阻断，PRD §6.1 防误删）。
   * @param {object} node 目录节点
   * @returns {void}
   */
  function deleteDirectory(node) {
    const count = U.num(node.count, 0, 0);
    if (count > 0) {
      global.alert(`目录「${node.name}」下仍有 ${count} 条用例，无法删除。\n\n请先把这些用例移动到其他目录或删除后再试。`);
      toast(`目录「${node.name}」下有 ${count} 条用例，已阻断删除。`, "warning");
      return;
    }
    const ok = global.confirm(`确认删除空目录「${node.name}」？`);
    if (!ok) {
      return;
    }
    const before = directories().length;
    const nextDirs = directories().filter((dir) => {
      if (U.str(dir.business) !== U.str(node.business) || U.str(dir.level) !== U.str(node.level)) {
        return true;
      }
      if (node.level === "product") {
        return U.str(dir.name) !== U.str(node.name);
      }
      if (node.level === "module") {
        return !(U.str(dir.product) === U.str(node.product) && U.str(dir.name) === U.str(node.name));
      }
      return !(U.str(dir.product) === U.str(node.product)
        && U.str(dir.module) === U.str(node.module)
        && U.str(dir.name) === U.str(node.name));
    });

    if (nextDirs.length === before) {
      toast(`目录「${node.name}」是由用例字段派生的虚拟目录，无需删除。`, "info");
      return;
    }

    TCM.store.commit("caseDirectories", nextDirs, { source: "library" });
    if (selectedPath.product === node.name || selectedPath.module === node.name || selectedPath.category === node.name) {
      selectedPath.product = "";
      selectedPath.module = "";
      selectedPath.category = "";
      getState().basicCaseModule = "";
    }
    TCM.bus.emit(C.EVENTS.DIR_CHANGED, { action: "delete", name: node.name, level: node.level });
    toast(`已删除空目录「${node.name}」。`, "info");
    render();
  }

  /**
   * 在当前选中位置新建空目录。
   * @returns {void}
   */
  function createDirectory() {
    // ★ F1：「全部业务」是视图作用域，不能作为目录的归属业务线
    if (isAllScope()) {
      toast("请先在左侧选择一条业务线，再新建目录。", "warning");
      return;
    }
    const level = selectedPath.module ? "category" : (selectedPath.product ? "module" : "product");
    const levelLabel = level === "product" ? "产品" : (level === "module" ? "模块" : "场景");
    const input = global.prompt(`在「${[selectedPath.business, selectedPath.product, selectedPath.module].filter(Boolean).join(" / ")}」下新建${levelLabel}目录，请输入名称：`, "");
    if (input === null) {
      return;
    }
    const name = U.str(input);
    if (!name) {
      toast("目录名称不能为空。", "warning");
      return;
    }
    const next = directories().slice();
    next.push({
      level,
      business: selectedPath.business,
      product: level === "product" ? name : selectedPath.product,
      module: level === "module" ? name : (level === "category" ? selectedPath.module : ""),
      name,
      order: 0
    });
    TCM.store.commit("caseDirectories", next, { source: "library" });
    const expanded = expandedSet();
    expanded.add(`dir-business-${selectedPath.business}`);
    saveExpanded(expanded);
    TCM.bus.emit(C.EVENTS.DIR_CHANGED, { action: "create", name, level });
    toast(`已新建${levelLabel}目录「${name}」。`, "success");
    render();
  }

  /* ------------------------------------------------------------------ *
   * 用例操作
   * ------------------------------------------------------------------ */

  /**
   * 删除单条用例。
   * @param {string} id 用例 id
   * @returns {void}
   */
  function deleteCase(id) {
    const target = assets().find((item) => item.id === id);
    if (!target) {
      return;
    }
    const ok = global.confirm(`确认删除用例「${target.title}」？此操作不可撤销。`);
    if (!ok) {
      return;
    }
    TCM.store.commit("basicCaseLibrary", assets().filter((item) => item.id !== id), { source: "library" });
    selection.delete(id);
    TCM.bus.emit(C.EVENTS.CASE_DELETED, { id });
    toast(`已删除「${target.title}」`, "info");
    render();
  }

  /**
   * 复制单条用例为草稿。
   * @param {string} id 用例 id
   * @returns {void}
   */
  function duplicateCase(id) {
    const source = assets().find((item) => item.id === id);
    if (!source) {
      return;
    }
    const next = assets().slice();
    next.push(buildCopy(source));
    TCM.store.commit("basicCaseLibrary", next, { source: "library" });
    TCM.bus.emit(C.EVENTS.CASE_UPDATED, { id: "", action: "copy" });
    toast(`已复制「${source.title}」为草稿用例`, "info");
    render();
  }

  /**
   * 构造用例副本（重置 id / 状态 / 版本 / 执行历史）。
   * @param {object} source 源用例
   * @returns {object} 副本
   */
  function buildCopy(source) {
    const copy = U.clone(source);
    copy.id = U.uid(C.ID_PREFIX.CASE_ASSET);
    copy.title = `${source.title}（副本）`;
    copy.status = "草稿";
    copy.version = 1;
    copy.reviewId = "";
    copy.isBaseline = false;
    copy.baselineFrom = source.id;
    copy.executionHistory = [];
    copy.createdBy = operator();
    copy.createdAt = U.today();
    copy.updatedBy = operator();
    copy.updatedAt = U.nowIso();
    return copy;
  }

  /**
   * 评审状态流转（沿用旧交互，不回归）。
   * @param {string} id 用例 id
   * @returns {void}
   */
  function reviewCase(id) {
    const stamp = U.nowIso();
    const who = operator();
    let nextStatus = "";
    let title = "";
    const next = assets().map((item) => {
      if (item.id !== id) {
        return item;
      }
      const copy = Object.assign({}, item);
      nextStatus = REVIEW_FLOW[copy.status] || "草稿";
      title = copy.title;
      copy.status = nextStatus;
      copy.updatedBy = who;
      copy.updatedAt = stamp;
      return copy;
    });
    if (!nextStatus) {
      return;
    }
    TCM.store.commit("basicCaseLibrary", next, { source: "library" });
    TCM.bus.emit(C.EVENTS.CASE_UPDATED, { id, action: "review", status: nextStatus });
    toast(`已将「${title}」状态更新为「${nextStatus}」`, nextStatus === "已确认" ? "success" : "info");
    render();
  }

  /**
   * 批量更新选中用例的某个枚举字段。
   * @param {string} field 字段名（status|priority|type）
   * @param {string} value 目标值
   * @returns {void}
   */
  function batchSetField(field, value) {
    const ids = new Set(Array.from(selection));
    if (!ids.size || !value) {
      return;
    }
    const stamp = U.nowIso();
    const who = operator();
    let changed = 0;
    const next = assets().map((item) => {
      if (!ids.has(item.id) || item[field] === value) {
        return item;
      }
      const copy = Object.assign({}, item);
      copy[field] = value;
      copy.updatedBy = who;
      copy.updatedAt = stamp;
      changed += 1;
      return copy;
    });
    TCM.store.commit("basicCaseLibrary", next, { source: "library" });
    TCM.bus.emit(C.EVENTS.CASE_BATCH_CHANGED, { field, value, count: changed });
    toast(`已把 ${changed} 条用例的${field === "status" ? "状态" : (field === "priority" ? "优先级" : "类型")}改为「${value}」`, "success");
    render();
  }

  /**
   * 批量追加标签。
   * @returns {void}
   */
  function batchAddTags() {
    const ids = new Set(Array.from(selection));
    if (!ids.size) {
      return;
    }
    const input = global.prompt("为选中用例追加标签（多个用逗号分隔）：", "");
    if (input === null) {
      return;
    }
    const tags = U.stringList(input);
    if (!tags.length) {
      toast("没有解析到有效标签。", "warning");
      return;
    }
    const stamp = U.nowIso();
    const who = operator();
    let changed = 0;
    const next = assets().map((item) => {
      if (!ids.has(item.id)) {
        return item;
      }
      const copy = Object.assign({}, item);
      copy.tags = U.stringList(U.toArray(copy.tags).concat(tags));
      copy.updatedBy = who;
      copy.updatedAt = stamp;
      changed += 1;
      return copy;
    });
    TCM.store.commit("basicCaseLibrary", next, { source: "library" });
    TCM.bus.emit(C.EVENTS.CASE_BATCH_CHANGED, { field: "tags", count: changed });
    toast(`已为 ${changed} 条用例追加标签：${tags.join(" / ")}`, "success");
    render();
  }

  /**
   * 批量复制。
   * @returns {void}
   */
  function batchCopy() {
    const ids = Array.from(selection);
    if (!ids.length) {
      return;
    }
    const current = assets();
    const next = current.slice();
    let copied = 0;
    ids.forEach((id) => {
      const source = current.find((item) => item.id === id);
      if (!source) {
        return;
      }
      next.push(buildCopy(source));
      copied += 1;
    });
    TCM.store.commit("basicCaseLibrary", next, { source: "library" });
    selection.clear();
    TCM.bus.emit(C.EVENTS.CASE_BATCH_CHANGED, { field: "copy", count: copied });
    toast(`已复制 ${copied} 条用例为草稿`, "info");
    render();
  }

  /**
   * 批量删除。
   * @returns {void}
   */
  function batchDelete() {
    const ids = Array.from(selection);
    if (!ids.length) {
      return;
    }
    const ok = global.confirm(`确认删除选中的 ${ids.length} 条基础用例？此操作不可撤销。`);
    if (!ok) {
      return;
    }
    const idSet = new Set(ids);
    TCM.store.commit("basicCaseLibrary", assets().filter((item) => !idSet.has(item.id)), { source: "library" });
    selection.clear();
    TCM.bus.emit(C.EVENTS.CASE_BATCH_CHANGED, { field: "delete", count: ids.length });
    toast(`已删除 ${ids.length} 条用例`, "info");
    render();
  }

  /**
   * 「加入计划」批量入口（T03 打通）。
   *
   * 解耦约定：用例库**不直接调用** TCM.plans，只在总线上广播一条
   * `plan:itemsChanged`（action = "request-add"）请求，由计划模块自行接管
   * 「切到测试计划子 Tab → 弹出选择计划/轮次对话框 → 写入 testPlans」。
   * 计划模块未加载时给出降级提示，不抛异常。
   *
   * 事件契约：
   *   TCM.bus.emit("plan:itemsChanged", {
   *     action: "request-add",          // 计划模块只响应该 action，避免自身广播回环
   *     caseAssetIds: string[],         // 只传 id，绝不复制用例正文（PRD §6.5「引用不复制」）
   *     source: "library"
   *   })
   *
   * @returns {void}
   */
  function batchAddToPlan() {
    const ids = Array.from(selection);
    if (!ids.length) {
      return;
    }
    if (!TCM.plans) {
      toast("测试计划模块尚未加载，请刷新页面后重试。", "error");
      return;
    }
    TCM.bus.emit(C.EVENTS.PLAN_ITEMS_CHANGED, {
      action: "request-add",
      caseAssetIds: ids,
      source: "library"
    });
  }

  /**
   * 「发起评审」批量入口（T04 打通）。
   *
   * 解耦约定与「加入计划」完全一致：用例库**不直接调用** `TCM.review.render()`，
   * 只在总线上广播一条 `review:requested`（action = "request-create"）请求，
   * 由评审模块自行接管「切到用例评审子 Tab → 弹出发起对话框 → 写入 reviewTickets」。
   * 评审模块未加载时给出降级提示，不抛异常。
   *
   * 事件契约：
   *   TCM.bus.emit("review:requested", {
   *     action: "request-create",       // 评审模块只响应该 action，避免自身广播回环
   *     caseAssetIds: string[],         // 只传 id，绝不复制用例正文
   *     source: "library"
   *   })
   *
   * @returns {void}
   */
  function batchStartReview() {
    const ids = Array.from(selection);
    if (!ids.length) {
      return;
    }
    if (!TCM.review) {
      toast("用例评审模块尚未加载，请刷新页面后重试。", "error");
      return;
    }
    TCM.bus.emit(C.EVENTS.REVIEW_REQUESTED, {
      action: "request-create",
      caseAssetIds: ids,
      source: "library"
    });
  }

  /* ------------------------------------------------------------------ *
   * T05：导入导出 / AI 批量补全入口
   * ------------------------------------------------------------------ */

  /**
   * 当前目录（含子目录）下的用例。
   * @returns {Array<object>} 用例数组
   */
  function directoryCases() {
    const allScope = isAllScope();
    return assets().filter((item) => {
      // ★ F1：「全部业务」作用域下不按 business 收窄
      if (!allScope && U.str(item.business) !== selectedPath.business) {
        return false;
      }
      if (selectedPath.product && U.str(item.product) !== selectedPath.product) {
        return false;
      }
      if (selectedPath.module && U.str(item.module) !== selectedPath.module) {
        return false;
      }
      if (selectedPath.category && U.str(item.category) !== selectedPath.category) {
        return false;
      }
      return true;
    });
  }

  /**
   * 打开导出对话框，把「选中 / 当前目录 / 当前筛选 / 全部」四种范围的数据一次性交给 TCM.io。
   * @param {string} scope 默认范围：selected|directory|filtered|all
   * @returns {void}
   */
  function openExportDialog(scope) {
    if (!TCM.io || typeof TCM.io.openExport !== "function") {
      toast("导入导出模块尚未加载，请刷新页面后重试。", "error");
      return;
    }
    const all = assets();
    const filtered = sortRows(TCM.model.applyFilters(all, buildFilterInput()));
    const selected = all.filter((item) => selection.has(item.id));
    const directoryLabel = [businessLabel(), selectedPath.product, selectedPath.module, selectedPath.category]
      .map((part) => U.str(part))
      .filter(Boolean)
      .join("-");

    TCM.io.openExport({
      scope: U.str(scope) || (selected.length ? "selected" : "filtered"),
      selected,
      filtered,
      directory: directoryCases(),
      directoryLabel,
      path: scopeContext()
    });
  }

  /**
   * 打开导入对话框。
   * @returns {void}
   */
  function openImportDialog() {
    if (!TCM.io || typeof TCM.io.openImport !== "function") {
      toast("导入导出模块尚未加载，请刷新页面后重试。", "error");
      return;
    }
    TCM.io.openImport({ path: scopeContext() });
  }

  /**
   * AI 批量补全：把选中用例交给 TCM.ai，结果先进「建议」态，用户确认后才写库。
   * @returns {void}
   */
  function batchAiComplete() {
    const ids = Array.from(selection);
    if (!ids.length) {
      toast("请先勾选需要补全的用例。", "warning");
      return;
    }
    if (!TCM.ai || typeof TCM.ai.open !== "function") {
      toast("AI 补全模块尚未加载，请刷新页面后重试。", "error");
      return;
    }
    TCM.ai.open(ids);
  }

  /**
   * 打开编辑抽屉。
   * @param {string} id 用例 id；空串表示新增
   * @returns {void}
   */
  function openEditor(id) {
    if (!TCM.caseEditor || typeof TCM.caseEditor.open !== "function") {
      toast("编辑抽屉尚未加载，请刷新页面后重试。", "error");
      return;
    }
    TCM.caseEditor.open(id, scopeContext());
  }

  /* ------------------------------------------------------------------ *
   * 事件委托
   * ------------------------------------------------------------------ */

  /**
   * 视图内点击事件总处理。
   * @param {MouseEvent} event 事件对象
   * @returns {void}
   */
  function onClick(event) {
    const target = event.target;

    const toggle = target.closest("[data-tcm-tree-toggle]");
    if (toggle) {
      const id = toggle.dataset.tcmTreeToggle;
      const expanded = expandedSet();
      if (expanded.has(id)) {
        expanded.delete(id);
      } else {
        expanded.add(id);
      }
      saveExpanded(expanded);
      render();
      return;
    }

    const nodeSelect = target.closest("[data-tcm-tree-select]");
    if (nodeSelect) {
      const node = parseNodePayload(nodeSelect.dataset.tcmTreeSelect);
      if (!node) {
        return;
      }
      if (node.level === "business") {
        selectPath({ business: node.name, product: "", module: "", category: "" });
      } else if (node.level === "product") {
        selectPath({ business: node.business, product: node.name, module: "", category: "" });
      } else if (node.level === "module") {
        selectPath({ business: node.business, product: node.product, module: node.name, category: "" });
      } else {
        selectPath({ business: node.business, product: node.product, module: node.module, category: node.name });
      }
      return;
    }

    const renameBtn = target.closest("[data-tcm-dir-rename]");
    if (renameBtn) {
      const node = parseNodePayload(renameBtn.dataset.tcmDirRename);
      if (node) {
        renameDirectory(node);
      }
      return;
    }

    const deleteDirBtn = target.closest("[data-tcm-dir-delete]");
    if (deleteDirBtn) {
      const node = parseNodePayload(deleteDirBtn.dataset.tcmDirDelete);
      if (node) {
        deleteDirectory(node);
      }
      return;
    }

    if (target.closest("[data-tcm-dir-new]")) {
      createDirectory();
      return;
    }

    if (target.closest("[data-tcm-add]")) {
      openEditor("");
      return;
    }

    const selectAll = target.closest("[data-tcm-select-all]");
    if (selectAll) {
      const rows = TCM.model.applyFilters(assets(), buildFilterInput());
      const allSelected = rows.length > 0 && rows.every((item) => selection.has(item.id));
      if (allSelected) {
        rows.forEach((item) => selection.delete(item.id));
      } else {
        rows.forEach((item) => selection.add(item.id));
      }
      render();
      return;
    }

    const clearOne = target.closest("[data-tcm-filter-clear]");
    if (clearOne) {
      const key = clearOne.dataset.tcmFilterClear;
      if (key === "__product") {
        selectPath({ business: selectedPath.business, product: "", module: "", category: "" });
        return;
      }
      if (key === "__module") {
        selectPath({ business: selectedPath.business, product: selectedPath.product, module: "", category: "" });
        return;
      }
      if (key === "__category") {
        selectPath({ business: selectedPath.business, product: selectedPath.product, module: selectedPath.module, category: "" });
        return;
      }
      setFilter(key, "");
      render();
      return;
    }

    if (target.closest("[data-tcm-filter-clear-all]")) {
      clearFilters();
      render();
      return;
    }

    if (target.closest("[data-tcm-sort-dir]")) {
      sort.dir = sort.dir === "asc" ? "desc" : "asc";
      render();
      return;
    }

    const openBtn = target.closest("[data-tcm-open]");
    if (openBtn) {
      openEditor(openBtn.dataset.tcmOpen);
      return;
    }

    const copyBtn = target.closest("[data-tcm-copy]");
    if (copyBtn) {
      duplicateCase(copyBtn.dataset.tcmCopy);
      return;
    }

    const reviewBtn = target.closest("[data-tcm-review]");
    if (reviewBtn) {
      reviewCase(reviewBtn.dataset.tcmReview);
      return;
    }

    const deleteBtn = target.closest("[data-tcm-delete]");
    if (deleteBtn) {
      deleteCase(deleteBtn.dataset.tcmDelete);
      return;
    }

    const batchBtn = target.closest("[data-tcm-batch]");
    if (batchBtn) {
      const action = batchBtn.dataset.tcmBatch;
      if (action === "tag") {
        batchAddTags();
      } else if (action === "copy") {
        batchCopy();
      } else if (action === "delete") {
        batchDelete();
      } else if (action === "plan") {
        batchAddToPlan();
      } else if (action === "review") {
        batchStartReview();
      } else if (action === "ai") {
        batchAiComplete();
      } else if (action === "export") {
        openExportDialog("selected");
      } else if (action === "clear") {
        selection.clear();
        render();
      }
      return;
    }

    if (target.closest("[data-tcm-catalog-config]")) {
      catalogConfigOpen = true;
      render();
      return;
    }

    if (target.closest("[data-tcm-catalog-close]")) {
      catalogConfigOpen = false;
      render();
      return;
    }

    if (target.closest("[data-tcm-catalog-save]")) {
      const nextConfig = {};
      ["businesses", "components", "tags"].forEach((key) => {
        const field = (catalogPortal || rootEl).querySelector(`[data-tcm-catalog-field="${key}"]`);
        nextConfig[key] = parseCatalogText(field ? field.value : "");
      });
      if (!nextConfig.businesses.length) {
        toast("至少保留一个业务类型。", "warning");
        return;
      }
      getState().tcmCaseCatalogConfig = nextConfig;
      persistLocal();
      catalogConfigOpen = false;
      toast("用例字典配置已保存。", "success");
      render();
      return;
    }

    // T05：目录/筛选/全库导出与导入入口
    const ioBtn = target.closest("[data-tcm-io]");
    if (ioBtn) {
      const mode = ioBtn.dataset.tcmIo;
      if (mode === "import") {
        openImportDialog();
      } else {
        openExportDialog(mode);
      }
    }
  }

  /**
   * 视图内 change 事件总处理。
   * @param {Event} event 事件对象
   * @returns {void}
   */
  function onChange(event) {
    const target = event.target;

    const check = target.closest("[data-tcm-check]");
    if (check) {
      const id = check.dataset.tcmCheck;
      if (check.checked) {
        selection.add(id);
      } else {
        selection.delete(id);
      }
      render();
      return;
    }

    const filterEl = target.closest("[data-tcm-filter]");
    if (filterEl && filterEl.tagName === "SELECT") {
      setFilter(filterEl.dataset.tcmFilter, filterEl.value);
      render();
      return;
    }

    if (target.closest("[data-tcm-sort]")) {
      sort.key = target.value;
      render();
      return;
    }

    if (target.closest("[data-tcm-batch-status]")) {
      batchSetField("status", target.value);
      return;
    }
    if (target.closest("[data-tcm-batch-priority]")) {
      batchSetField("priority", target.value);
      return;
    }
    if (target.closest("[data-tcm-batch-type]")) {
      batchSetField("type", target.value);
    }
  }

  /**
   * 视图内 input 事件（仅关键词搜索，防抖 220ms）。
   * @param {Event} event 事件对象
   * @returns {void}
   */
  function onInput(event) {
    const target = event.target;
    if (!target.closest("[data-tcm-filter='keyword']")) {
      return;
    }
    const value = target.value;
    if (!keywordDebounced) {
      keywordDebounced = U.debounce(() => {
        render();
      }, 220);
    }
    setFilter("keyword", value);
    keywordDebounced();
  }

  /* ------------------------------------------------------------------ *
   * 生命周期
   * ------------------------------------------------------------------ */

  /**
   * 挂载视图：绑定事件委托（只绑一次）。
   * @param {HTMLElement} [root] #tcmLibraryView 容器
   * @returns {void}
   */
  function mount(root) {
    if (!doc) {
      return;
    }
    rootEl = root || doc.getElementById("tcmLibraryView");
    if (!rootEl || mounted) {
      return;
    }
    rootEl.addEventListener("click", onClick);
    rootEl.addEventListener("change", onChange);
    rootEl.addEventListener("input", onInput);
    // ★ 子菜单在侧边栏（#basicCaseNavSubmenu），不在 #tcmLibraryView 内，单独委托，
    // 使其「＋ 新建目录」按钮可复用既有 [data-tcm-dir-new] → createDirectory() 逻辑。
    const submenuHost = doc.getElementById("basicCaseNavSubmenu");
    if (submenuHost) {
      submenuHost.addEventListener("click", onClick);
    }
    TCM.bus.on(C.EVENTS.CASE_UPDATED, render);
    TCM.bus.on(C.EVENTS.CASE_DELETED, render);
    bindFocusOnce();
    mounted = true;
  }

  /**
   * 订阅 `case:focus`（T04）：评审 / 追溯视图点用例标题时切回本视图并打开该用例。
   *
   * 与 CASE_UPDATED / CASE_DELETED 不同，这条订阅**不随 destroy 解绑**，
   * 由 focusBound 保证进程内只订阅一次（重新 mount 不会重复注册）。
   * @returns {void}
   */
  function bindFocusOnce() {
    if (focusBound || !TCM.bus || typeof TCM.bus.on !== "function") {
      return;
    }
    TCM.bus.on(C.EVENTS.CASE_FOCUS, onCaseFocus);
    focusBound = true;
  }

  /**
   * 处理「定位到某条用例」请求。
   * @param {{caseId?:string, source?:string}} payload 事件负载
   * @returns {void}
   */
  function onCaseFocus(payload) {
    const data = payload && typeof payload === "object" ? payload : {};
    const caseId = U.str(data.caseId);
    if (!caseId || U.str(data.source) === "library") {
      return;
    }
    if (!assets().some((item) => U.str(item.id) === caseId)) {
      toast("该用例已被删除，无法定位。", "warning");
      return;
    }
    if (TCM.shell && typeof TCM.shell.setActive === "function") {
      TCM.shell.setActive("library");
    }
    selection.clear();
    selection.add(caseId);
    render();
    openEditor(caseId);
  }

  /**
   * 卸载：解绑事件。
   * @returns {void}
   */
  function destroy() {
    if (rootEl) {
      rootEl.removeEventListener("click", onClick);
      rootEl.removeEventListener("change", onChange);
      rootEl.removeEventListener("input", onInput);
    }
    TCM.bus.off(C.EVENTS.CASE_UPDATED, render);
    TCM.bus.off(C.EVENTS.CASE_DELETED, render);
    mounted = false;
  }

  TCM.library = {
    mount,
    render,
    destroy,
    renderNavSubmenu,
    /**
     * 当前作用域 + 筛选条件下的可见行数（★ F2）。
     *
     * 供 tcm-shell 的子 Tab 徽标使用：徽标口径与列表可见行严格一致。
     * 内部先 `syncSelectedPath()`，保证在视图尚未 render 时也能算出正确结果。
     * @returns {number} 可见用例条数
     */
    getVisibleCount() {
      syncSelectedPath();
      return TCM.model.applyFilters(assets(), buildFilterInput()).length;
    },
    getSelection() {
      return Array.from(selection);
    },
    clearSelection() {
      selection.clear();
    },
    // 暴露给单测 / 调试的内部实现
    _internals: {
      assetInNode,
      sortRows,
      buildFilterInput,
      collectFacets
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
