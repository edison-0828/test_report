/**
 * tcm/tcm-case-editor.js —— 基础用例编辑抽屉（T02 · 用例库视图重构）
 *
 * 职责：
 *   1. 提供全局单例编辑抽屉（role="dialog" + aria-modal="true"，ESC 关闭、焦点陷阱）；
 *   2. 覆盖 PRD §5 演进后的全部用例字段（目录归属 / 基本信息 / 用例内容 / 关联追溯 / 自动化）；
 *   3. 内置 3 套用例模板（功能 / 接口 / 异常），一键填充内容骨架；
 *   4. 保存时统一走 TCM.store.commit('basicCaseLibrary', ...)，**禁止**直接 push；
 *   5. 编辑既有用例时版本号 +1（版本历史快照留给后续任务）；
 *   6. 关联需求选择器数据源来自 state.batches（type=batch）与 state.tasks（type=task）。
 *
 * 约束：
 *   - IIFE + "use strict"，只挂载 window.TCM.caseEditor；
 *   - 对外暴露 { mount, open, close, render, destroy, isOpen }，render() 幂等；
 *   - 事件全部委托到抽屉根节点，mount() 只绑定一次；
 *   - 所有用户输入渲染前必须 TCM.util.escapeHtml()；
 *   - 跨模块通信只通过 TCM.bus.emit，不直接调用别的视图模块的 render。
 *
 * 依赖：tcm-core.js → tcm-store.js → tcm-model.js
 */
(function (global) {
  "use strict";

  const TCM = global.TCM;
  if (!TCM || !TCM.const || !TCM.util || !TCM.store || !TCM.model) {
    if (global.console && typeof global.console.error === "function") {
      global.console.error("[TCM.caseEditor] 依赖缺失：请确认 tcm-core.js / tcm-store.js / tcm-model.js 已先加载。");
    }
    return;
  }

  const C = TCM.const;
  const U = TCM.util;
  const esc = U.escapeHtml;
  const doc = global.document || null;

  /* ------------------------------------------------------------------ *
   * 常量
   * ------------------------------------------------------------------ */

  /** 抽屉根容器 id（index.html 中预留，缺失时自动兜底创建） */
  const ROOT_ID = "tcmCaseDrawerRoot";

  /** 可聚焦元素选择器（焦点陷阱用） */
  const FOCUSABLE = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled]):not([type=hidden])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])"
  ].join(",");

  /**
   * 内置用例模板：一键填充「测试目的 / 前置条件 / 测试数据 / 步骤 / 预期」骨架。
   * 模板只覆盖内容类字段，不会动目录归属与标题。
   * @type {Array<{key:string,label:string,hint:string,type:string,patch:object}>}
   */
  const TEMPLATES = Object.freeze([
    Object.freeze({
      key: "function",
      label: "功能用例",
      hint: "常规业务主流程，按「操作 → 校验」组织",
      type: "功能",
      patch: Object.freeze({
        objective: "验证【功能点】在正常业务参数下可按预期完成，并正确落库与回显。",
        preconditions: [
          "1. 已使用具备【角色】权限的账号登录系统；",
          "2. 存在可用的【商户/渠道/账户】基础数据；",
          "3. 相关开关或配置处于开启状态。"
        ].join("\n"),
        testData: "商户号：\n交易币种：\n金额：\n其他参数：",
        steps: [
          "1. 进入【菜单路径】页面；",
          "2. 填写必填项并提交；",
          "3. 查看列表 / 详情页的结果；",
          "4. 核对下游系统（账务 / 通知 / 对账文件）数据。"
        ].join("\n"),
        expected: [
          "1. 提交成功并给出成功提示；",
          "2. 列表 / 详情展示的数据与提交一致；",
          "3. 下游账务与通知记录正确生成，金额与状态一致。"
        ].join("\n")
      })
    }),
    Object.freeze({
      key: "api",
      label: "接口用例",
      hint: "面向接口契约，覆盖入参、响应码与幂等",
      type: "接口",
      patch: Object.freeze({
        objective: "验证【接口名 / URI】在合法报文下返回成功响应，字段与契约一致。",
        preconditions: [
          "1. 接口所属服务已部署到目标环境且健康检查通过；",
          "2. 已获取有效的商户密钥 / Token，签名方式为【签名算法】；",
          "3. 依赖的上游数据已准备完毕。"
        ].join("\n"),
        testData: "请求方法：POST\n请求地址：\n请求头：Content-Type / Authorization\n请求体（JSON）：\n{\n  \n}",
        steps: [
          "1. 按契约组装请求报文并计算签名；",
          "2. 发起请求，记录 HTTP 状态码与响应体；",
          "3. 使用相同请求号重复调用一次，验证幂等；",
          "4. 核对服务端流水与响应字段的一致性。"
        ].join("\n"),
        expected: [
          "1. HTTP 200，业务返回码为成功码；",
          "2. 响应字段类型、必填性与契约完全一致；",
          "3. 重复调用返回同一结果且不产生重复流水。"
        ].join("\n")
      })
    }),
    Object.freeze({
      key: "exception",
      label: "异常用例",
      hint: "面向边界与失败分支，校验报错与数据一致性",
      type: "功能",
      patch: Object.freeze({
        objective: "验证【功能点】在异常输入 / 依赖故障场景下能正确拦截并保持数据一致。",
        preconditions: [
          "1. 已具备可复现异常的环境（如超时挡板、错误码 Mock）；",
          "2. 记录异常发生前的账务与流水快照。"
        ].join("\n"),
        testData: "异常类型：参数非法 / 余额不足 / 依赖超时 / 重复提交\n构造参数：",
        steps: [
          "1. 构造异常输入或触发依赖故障；",
          "2. 执行业务操作并观察前端提示；",
          "3. 查询服务端日志与流水状态；",
          "4. 恢复依赖后重试，验证可正常完成。"
        ].join("\n"),
        expected: [
          "1. 系统给出明确、可理解的错误提示，不出现 500 / 白屏；",
          "2. 异常场景下不产生脏数据，账务保持平衡；",
          "3. 恢复后重试可成功，且不产生重复记录。"
        ].join("\n")
      })
    })
  ]);

  /** 需要 render 后恢复焦点的字段（避免结构性重渲染丢焦点） */
  const REFOCUS_ATTR = "data-tcm-field";

  /* ------------------------------------------------------------------ *
   * 模块内部状态
   * ------------------------------------------------------------------ */

  /** @type {HTMLElement|null} 抽屉根容器 */
  let rootEl = null;
  /** @type {boolean} 是否已挂载（事件只绑一次） */
  let mounted = false;
  /** @type {boolean} 抽屉是否打开 */
  let opened = false;
  /** @type {string} 当前编辑的用例 id，空串代表新增 */
  let editingId = "";
  /** @type {object|null} 编辑草稿（open 时深拷贝，保存时提交） */
  let draft = null;
  /** @type {object|null} 打开时的原始快照，用于判断是否有改动 */
  let original = null;
  /** @type {HTMLElement|null} 打开抽屉前的焦点元素，关闭后回焦 */
  let lastFocused = null;
  /** @type {string} 表单校验错误提示 */
  let formError = "";
  /** @type {string} 下次渲染后需要恢复焦点的字段名 */
  let refocusField = "";
  /** @type {Array<object>} 结构化步骤工作副本（T05，保存时同步回 draft） */
  let stepRows = [];
  /** @type {boolean} 版本历史面板是否展开（T05） */
  let versionPanelOpen = false;
  /** @type {number} 版本历史里被选中做 diff 的版本号，0 表示未选 */
  let diffVersion = 0;
  /** @type {boolean} 自动化用例是否正在执行（T05） */
  let automationRunning = false;
  /** @type {{ok:boolean,message:string,screenshot:string,at:string}|null} 本次自动化执行结果 */
  let automationResult = null;

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
   * 当前操作人。
   * @returns {string} 操作人名称
   */
  function operator() {
    return U.currentOperator(getState());
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
      global.console.info(`[TCM.caseEditor] ${message}`);
    }
  }

  /* ------------------------------------------------------------------ *
   * 草稿构造
   * ------------------------------------------------------------------ */

  /**
   * 构造一条空白用例草稿。
   * @param {object} [context] 目录上下文 {business, product, module, category}
   * @returns {object} 归一化后的空白用例
   */
  function buildBlankDraft(context) {
    const ctx = context && typeof context === "object" ? context : {};
    return TCM.model.normalizeCaseAsset({
      id: U.uid(C.ID_PREFIX.CASE_ASSET),
      business: U.str(ctx.business) || C.DEFAULTS.BUSINESS,
      product: U.str(ctx.product),
      module: U.str(ctx.module),
      category: U.str(ctx.category),
      title: "",
      type: C.DEFAULTS.CASE_TYPE,
      priority: C.DEFAULTS.PRIORITY,
      status: "草稿",
      version: 1,
      createdBy: operator(),
      updatedBy: operator()
    }, { operator: operator() });
  }

  /**
   * 依据 id 载入草稿；id 为空则构造新增草稿。
   * @param {string} id 用例 id
   * @param {object} [context] 目录上下文
   * @returns {{draft:object, isNew:boolean}} 草稿与是否新增
   */
  function loadDraft(id, context) {
    const targetId = U.str(id);
    if (targetId) {
      const found = assets().find((item) => item.id === targetId);
      if (found) {
        return {
          draft: TCM.model.normalizeCaseAsset(U.clone(found), { operator: operator() }),
          isNew: false
        };
      }
    }
    return { draft: buildBlankDraft(context), isNew: true };
  }

  /* ------------------------------------------------------------------ *
   * 数据源：目录候选 / 组件候选 / 标签候选 / 关联需求候选
   * ------------------------------------------------------------------ */

  /**
   * 汇总某业务线下已有的产品名（用例 + 显式目录）。
   * @param {string} business 业务线
   * @returns {Array<string>} 去重后的产品名
   */
  function productOptions(business) {
    const set = new Set();
    assets().forEach((item) => {
      if ((!business || item.business === business) && item.product) {
        set.add(item.product);
      }
    });
    directories().forEach((dir) => {
      if (dir.level === "product" && (!business || dir.business === business) && dir.name) {
        set.add(dir.name);
      }
      if (dir.level !== "business" && (!business || dir.business === business) && dir.product) {
        set.add(dir.product);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  }

  /**
   * 汇总某业务线 + 产品下已有的模块名。
   * @param {string} business 业务线
   * @param {string} product 产品
   * @returns {Array<string>} 去重后的模块名
   */
  function moduleOptions(business, product) {
    const set = new Set();
    assets().forEach((item) => {
      const hitBusiness = !business || item.business === business;
      const hitProduct = !product || item.product === product;
      if (hitBusiness && hitProduct && item.module) {
        set.add(item.module);
      }
    });
    directories().forEach((dir) => {
      const hitBusiness = !business || dir.business === business;
      const hitProduct = !product || dir.product === product;
      if (!hitBusiness || !hitProduct) {
        return;
      }
      if (dir.level === "module" && dir.name) {
        set.add(dir.name);
      }
      if (dir.module) {
        set.add(dir.module);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  }

  /**
   * 汇总某业务线 + 产品 + 模块下已有的场景（四级目录）名。
   * @param {string} business 业务线
   * @param {string} product 产品
   * @param {string} moduleName 模块
   * @returns {Array<string>} 去重后的场景名
   */
  function categoryOptions(business, product, moduleName) {
    const set = new Set();
    assets().forEach((item) => {
      const hit = (!business || item.business === business)
        && (!product || item.product === product)
        && (!moduleName || item.module === moduleName);
      if (hit && item.category) {
        set.add(item.category);
      }
    });
    directories().forEach((dir) => {
      const hit = (!business || dir.business === business)
        && (!product || dir.product === product)
        && (!moduleName || dir.module === moduleName);
      if (hit && dir.level === "category" && dir.name) {
        set.add(dir.name);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  }

  /**
   * 汇总全库已有的功能组件名。
   * @returns {Array<string>} 去重后的组件名
   */
  function componentOptions() {
    const set = new Set();
    const configured = TCM.catalog && typeof TCM.catalog.get === "function"
      ? TCM.catalog.get().components
      : [];
    U.toArray(configured).forEach((value) => set.add(U.str(value)));
    assets().forEach((item) => {
      if (item.component) {
        set.add(item.component);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  }

  /**
   * 汇总全库已有的标签。
   * @returns {Array<string>} 去重后的标签
   */
  function tagOptions() {
    const set = new Set();
    const configured = TCM.catalog && typeof TCM.catalog.get === "function"
      ? TCM.catalog.get().tags
      : [];
    U.toArray(configured).forEach((value) => set.add(U.str(value)));
    assets().forEach((item) => {
      U.toArray(item.tags).forEach((tag) => {
        const value = U.str(tag);
        if (value) {
          set.add(value);
        }
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  }

  /**
   * 汇总可关联的需求（版本批次 + 测试任务）。
   * @returns {Array<{type:string,id:string,name:string,group:string}>} 候选需求
   */
  function requirementOptions() {
    const state = getState();
    const out = [];

    U.toArray(state.batches).forEach((batch) => {
      const id = U.str(batch && batch.id);
      if (!id) {
        return;
      }
      const name = U.str(batch.name, "未命名版本");
      const version = U.str(batch.version);
      out.push({
        type: "batch",
        id,
        name: version ? `${name} ${version}` : name,
        group: "版本批次"
      });
    });

    U.toArray(state.tasks).forEach((task) => {
      const id = U.str(task && task.id);
      if (!id) {
        return;
      }
      out.push({
        type: "task",
        id,
        name: U.str(task.name, "未命名任务"),
        group: "测试任务"
      });
    });

    return out;
  }

  /* ------------------------------------------------------------------ *
   * HTML 片段
   * ------------------------------------------------------------------ */

  /**
   * 生成 <option> 列表。
   * @param {Array<string>} values 候选值
   * @param {string} current 当前值
   * @returns {string} HTML
   */
  function optionsHtml(values, current) {
    return U.toArray(values).map((value) => {
      const text = U.str(value);
      const selected = text === U.str(current) ? " selected" : "";
      return `<option value="${esc(text)}"${selected}>${esc(text)}</option>`;
    }).join("");
  }

  /**
   * 生成 <datalist> 元素。
   * @param {string} id datalist id
   * @param {Array<string>} values 候选值
   * @returns {string} HTML
   */
  function datalistHtml(id, values) {
    const items = U.toArray(values)
      .map((value) => `<option value="${esc(U.str(value))}"></option>`)
      .join("");
    return `<datalist id="${esc(id)}">${items}</datalist>`;
  }

  /**
   * 生成单个表单字段块。
   * @param {{label:string, field:string, control:string, hint?:string, required?:boolean, wide?:boolean}} config 配置
   * @returns {string} HTML
   */
  function fieldHtml(config) {
    const requiredMark = config.required ? '<span class="tcm-required" aria-hidden="true">*</span>' : "";
    const hint = config.hint ? `<p class="tcm-field-hint">${esc(config.hint)}</p>` : "";
    const wide = config.wide ? " tcm-field-wide" : "";
    return `
      <div class="tcm-field${wide}">
        <label class="tcm-field-label" for="tcmField_${esc(config.field)}">${esc(config.label)}${requiredMark}</label>
        ${config.control}
        ${hint}
      </div>
    `;
  }

  /**
   * 文本输入控件。
   * @param {string} field 字段名
   * @param {string} value 当前值
   * @param {object} [options] {placeholder, listId, maxlength}
   * @returns {string} HTML
   */
  function textInput(field, value, options) {
    const opts = options && typeof options === "object" ? options : {};
    const list = opts.listId ? ` list="${esc(opts.listId)}"` : "";
    const placeholder = opts.placeholder ? ` placeholder="${esc(opts.placeholder)}"` : "";
    const maxlength = opts.maxlength ? ` maxlength="${Number(opts.maxlength)}"` : "";
    return `<input class="tcm-input" type="text" id="tcmField_${esc(field)}" ${REFOCUS_ATTR}="${esc(field)}"`
      + `${list}${placeholder}${maxlength} value="${esc(U.str(value))}">`;
  }

  /**
   * 下拉选择控件。
   * @param {string} field 字段名
   * @param {Array<string>} values 候选值
   * @param {string} current 当前值
   * @returns {string} HTML
   */
  function selectInput(field, values, current) {
    return `<select class="tcm-select" id="tcmField_${esc(field)}" ${REFOCUS_ATTR}="${esc(field)}">`
      + optionsHtml(values, current)
      + "</select>";
  }

  /**
   * 多行文本控件。
   * @param {string} field 字段名
   * @param {string} value 当前值
   * @param {object} [options] {rows, placeholder}
   * @returns {string} HTML
   */
  function textArea(field, value, options) {
    const opts = options && typeof options === "object" ? options : {};
    const rows = Number(opts.rows) > 0 ? Number(opts.rows) : 4;
    const placeholder = opts.placeholder ? ` placeholder="${esc(opts.placeholder)}"` : "";
    return `<textarea class="tcm-textarea" id="tcmField_${esc(field)}" ${REFOCUS_ATTR}="${esc(field)}"`
      + ` rows="${rows}"${placeholder}>${esc(U.str(value))}</textarea>`;
  }

  /**
   * 模板按钮组。
   * @returns {string} HTML
   */
  function templateBarHtml() {
    const buttons = TEMPLATES.map((tpl) => (
      `<button type="button" class="tcm-chip-btn" data-tcm-template="${esc(tpl.key)}" title="${esc(tpl.hint)}">`
      + `套用${esc(tpl.label)}模板</button>`
    )).join("");
    return `
      <div class="tcm-template-bar">
        <span class="tcm-template-label">快速模板</span>
        ${buttons}
        <button type="button" class="tcm-chip-btn tcm-chip-btn-ghost" data-tcm-template-clear>清空内容</button>
      </div>
    `;
  }

  /**
   * 标签 chips + 输入框。
   * @param {Array<string>} tags 当前标签
   * @returns {string} HTML
   */
  function tagsHtml(tags) {
    const list = U.stringList(tags);
    const chips = list.length
      ? list.map((tag) => (
        `<span class="tcm-chip">${esc(tag)}`
        + `<button type="button" class="tcm-chip-x" data-tcm-tag-remove="${esc(tag)}" aria-label="移除标签 ${esc(tag)}">×</button>`
        + "</span>"
      )).join("")
      : '<span class="tcm-chip-empty">暂无标签</span>';
    return `
      <div class="tcm-chip-row" data-tcm-tag-list>${chips}</div>
      <div class="tcm-inline-add">
        <input class="tcm-input" type="text" id="tcmField_tagInput" data-tcm-tag-input
          list="tcmTagOptions" placeholder="输入标签后回车或点「添加」" maxlength="24">
        <button type="button" class="tcm-btn tcm-btn-ghost" data-tcm-tag-add>添加</button>
      </div>
    `;
  }

  /**
   * 关联需求 chips + 选择器。
   * @param {Array<{type:string,id:string,name:string}>} linked 已关联需求
   * @returns {string} HTML
   */
  function requirementsHtml(linked) {
    const list = U.toArray(linked);
    const chips = list.length
      ? list.map((req) => {
        const key = `${U.str(req.type)}::${U.str(req.id)}`;
        const badge = U.str(req.type) === "task" ? "任务" : "版本";
        return `<span class="tcm-chip tcm-chip-req">`
          + `<em class="tcm-chip-tag">${esc(badge)}</em>${esc(U.str(req.name) || U.str(req.id))}`
          + `<button type="button" class="tcm-chip-x" data-tcm-req-remove="${esc(key)}" aria-label="解除关联">×</button>`
          + "</span>";
      }).join("")
      : '<span class="tcm-chip-empty">暂未关联需求</span>';

    const linkedKeys = new Set(list.map((req) => `${U.str(req.type)}::${U.str(req.id)}`));
    const candidates = requirementOptions().filter((opt) => !linkedKeys.has(`${opt.type}::${opt.id}`));

    const grouped = new Map();
    candidates.forEach((opt) => {
      if (!grouped.has(opt.group)) {
        grouped.set(opt.group, []);
      }
      grouped.get(opt.group).push(opt);
    });

    let optionsMarkup = '<option value="">选择要关联的版本 / 任务…</option>';
    grouped.forEach((items, group) => {
      optionsMarkup += `<optgroup label="${esc(group)}">`;
      optionsMarkup += items
        .map((opt) => `<option value="${esc(`${opt.type}::${opt.id}`)}">${esc(opt.name)}</option>`)
        .join("");
      optionsMarkup += "</optgroup>";
    });

    const disabled = candidates.length ? "" : " disabled";
    return `
      <div class="tcm-chip-row">${chips}</div>
      <div class="tcm-inline-add">
        <select class="tcm-select" id="tcmField_reqPicker" data-tcm-req-picker${disabled}>${optionsMarkup}</select>
      </div>
      ${candidates.length ? "" : '<p class="tcm-field-hint">暂无可关联的版本批次或测试任务。</p>'}
    `;
  }

  /**
   * 只读关联信息（测试计划 / 缺陷 / 执行历史）。
   * @param {object} item 用例草稿
   * @returns {string} HTML
   */
  function readonlyLinksHtml(item) {
    const plans = U.stringList(item.linkedBatchIds);
    const state = getState();
    const planNames = plans.map((batchId) => {
      const batch = U.toArray(state.batches).find((row) => row && row.id === batchId);
      if (!batch) {
        return batchId;
      }
      const version = U.str(batch.version);
      const name = U.str(batch.name, "未命名版本");
      return version ? `${name} ${version}` : name;
    });
    const planChips = planNames.length
      ? planNames.map((name) => `<span class="tcm-chip tcm-chip-readonly">${esc(name)}</span>`).join("")
      : '<span class="tcm-chip-empty">未关联计划</span>';

    const defects = U.toArray(item.linkedDefects);
    const defectChips = defects.length
      ? defects.map((bug) => {
        const label = U.str(bug.title) || U.str(bug.id);
        return `<span class="tcm-chip tcm-chip-readonly tcm-chip-bug">${esc(label)}</span>`;
      }).join("")
      : '<span class="tcm-chip-empty">暂无缺陷</span>';

    const history = U.toArray(item.executionHistory);
    const historyText = history.length
      ? `最近执行 ${esc(U.str(history[history.length - 1].date))} · ${esc(U.str(history[history.length - 1].result))}`
      : "暂无执行记录";

    return `
      <div class="tcm-readonly-grid">
        <div class="tcm-readonly-cell">
          <span class="tcm-readonly-label">已关联计划</span>
          <div class="tcm-chip-row">${planChips}</div>
        </div>
        <div class="tcm-readonly-cell">
          <span class="tcm-readonly-label">关联缺陷</span>
          <div class="tcm-chip-row">${defectChips}</div>
        </div>
        <div class="tcm-readonly-cell">
          <span class="tcm-readonly-label">执行历史</span>
          <p class="tcm-readonly-text">${historyText}</p>
        </div>
      </div>
    `;
  }

  /* ------------------------------------------------------------------ *
   * T05：结构化步骤 / 版本历史与基线 / 自动化联动
   * ------------------------------------------------------------------ */

  /**
   * 读取版本快照集合。
   * @returns {Array<object>} caseVersions 数组
   */
  function versions() {
    return TCM.store.collection("caseVersions");
  }

  /**
   * 当前用例的版本历史（最新在前）。
   * @returns {Array<object>} 版本数组
   */
  function currentVersions() {
    if (!editingId) {
      return [];
    }
    return TCM.model.versionsOfCase(versions(), editingId);
  }

  /**
   * 结构化步骤 section。
   * @param {object} item 草稿
   * @returns {string} HTML
   */
  function stepsSectionHtml(item) {
    if (!TCM.steps || typeof TCM.steps.render !== "function") {
      return "";
    }
    const table = TCM.steps.render(stepRows, {
      hasAutomation: U.toArray(item.automationSteps).length > 0,
      hasPlainText: Boolean(U.str(item.steps).trim())
    });
    return `
      <section class="tcm-form-section">
        <h4 class="tcm-form-section-title">结构化步骤</h4>
        ${table}
      </section>
    `;
  }

  /**
   * 单条版本的 diff 明细（对比其上一版）。
   * @param {Array<object>} list 版本历史（最新在前）
   * @param {number} version 目标版本号
   * @returns {string} HTML
   */
  function versionDiffHtml(list, version) {
    const index = list.findIndex((row) => U.num(row.version, 0, 0) === version);
    if (index < 0) {
      return "";
    }
    const after = list[index] && list[index].snapshot;
    const prev = list[index + 1];
    const before = prev ? prev.snapshot : {};
    const rows = TCM.model.diffCaseSnapshots(before, after).filter((row) => row.changed);

    if (!rows.length) {
      return `<p class="tcm-version-diff-empty">v${version} 与上一版相比没有字段变化。</p>`;
    }

    const body = rows.map((row) => `
      <tr>
        <th class="tcm-version-diff-key" scope="row">${esc(row.label)}</th>
        <td class="tcm-version-diff-before">${row.before ? esc(row.before) : '<span class="tcm-version-diff-null">（空）</span>'}</td>
        <td class="tcm-version-diff-after">${row.after ? esc(row.after) : '<span class="tcm-version-diff-null">（空）</span>'}</td>
      </tr>
    `).join("");

    return `
      <div class="tcm-version-diff">
        <p class="tcm-version-diff-title">v${version} 变更明细（共 ${rows.length} 处）</p>
        <table class="tcm-version-diff-table">
          <thead>
            <tr>
              <th scope="col">字段</th>
              <th scope="col">${prev ? `v${U.num(prev.version, 0, 0)}（旧）` : "初始（空）"}</th>
              <th scope="col">v${version}（新）</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  }

  /**
   * 版本历史与基线 section。
   * @param {object} item 草稿
   * @returns {string} HTML
   */
  function versionSectionHtml(item) {
    if (!editingId) {
      return `
        <section class="tcm-form-section tcm-version-section">
          <h4 class="tcm-form-section-title">版本历史与基线</h4>
          <p class="tcm-version-empty">新增用例保存后才会产生第一条版本快照（v1）。</p>
        </section>
      `;
    }

    const list = currentVersions();
    const baselineTip = item.isBaseline
      ? `<span class="tcm-baseline-badge" title="基线版本">基线 v${U.num(item.baselineFrom, U.num(item.version, 1, 1), 1)}</span>`
      : "";

    const listHtml = list.length
      ? list.map((row) => {
        const version = U.num(row.version, 0, 0);
        const active = version === diffVersion;
        const snap = row.snapshot && typeof row.snapshot === "object" ? row.snapshot : {};
        const note = U.str(row.changeNote) || "保存";
        return `
          <li class="tcm-version-item${active ? " is-active" : ""}">
            <button type="button" class="tcm-version-head" data-tcm-version-diff="${version}"
              aria-expanded="${active ? "true" : "false"}">
              <span class="tcm-version-no">v${version}</span>
              <span class="tcm-version-note">${esc(note)}</span>
              <span class="tcm-version-meta">${esc(U.str(row.changedBy) || "-")} · ${esc(U.str(row.changedAt).slice(0, 19).replace("T", " "))}</span>
              ${snap.isBaseline ? '<span class="tcm-version-flag">基线</span>' : ""}
            </button>
            <div class="tcm-version-ops">
              <button type="button" class="tcm-btn tcm-btn-ghost tcm-btn-sm"
                data-tcm-version-rollback="${version}">回滚到此版本</button>
            </div>
            ${active ? versionDiffHtml(list, version) : ""}
          </li>
        `;
      }).join("")
      : '<li class="tcm-version-empty-item">暂无版本快照，保存一次即可生成。</li>';

    return `
      <section class="tcm-form-section tcm-version-section">
        <h4 class="tcm-form-section-title">
          版本历史与基线 ${baselineTip}
          <button type="button" class="tcm-btn tcm-btn-ghost tcm-btn-sm" data-tcm-version-toggle
            aria-expanded="${versionPanelOpen ? "true" : "false"}">
            ${versionPanelOpen ? "收起" : `展开（${list.length}）`}
          </button>
        </h4>
        <div class="tcm-form-grid">
          <div class="tcm-field tcm-field-wide">
            <label class="tcm-checkbox">
              <input type="checkbox" id="tcmField_isBaseline" ${REFOCUS_ATTR}="isBaseline"
                ${item.isBaseline ? "checked" : ""}>
              <span>另存为基线（本次保存后标记为基线版本，库列表会打标）</span>
            </label>
          </div>
        </div>
        ${versionPanelOpen ? `<ul class="tcm-version-list">${listHtml}</ul>` : ""}
      </section>
    `;
  }

  /**
   * 自动化联动 section（自动化开关 + 脚本路径 + 上次执行结果 + 一键触发）。
   * @param {object} item 草稿
   * @returns {string} HTML
   */
  function automationSectionHtml(item) {
    const autoSteps = U.toArray(item.automationSteps);
    const stepsHtml = autoSteps.length
      ? `
        <ol class="tcm-auto-steps">
          ${autoSteps.map((step) => {
            const s = step && typeof step === "object" ? step : {};
            const type = U.str(s.stepType) || "click";
            const label = (TCM.model.AUTOMATION_STEP_LABELS && TCM.model.AUTOMATION_STEP_LABELS[type]) || type;
            const detail = [U.str(s.target), U.str(s.inputValue)].filter(Boolean).join(" → ");
            return `<li><span class="tcm-auto-step-type">${esc(label)}</span>${detail ? `<code>${esc(detail)}</code>` : ""}</li>`;
          }).join("")}
        </ol>
      `
      : '<p class="tcm-auto-empty">尚未录制自动化步骤。可在「UI 自动化」模块录制后回到这里联动执行。</p>';

    const lastRun = item.automationLastRun && typeof item.automationLastRun === "object"
      ? item.automationLastRun
      : null;
    const runView = automationResult || (lastRun
      ? {
        ok: U.str(lastRun.result) === "通过" || lastRun.ok === true,
        message: U.str(lastRun.message) || U.str(lastRun.result) || "-",
        screenshot: U.str(lastRun.screenshot),
        at: U.str(lastRun.at) || U.str(lastRun.date)
      }
      : null);

    const runHtml = runView
      ? `
        <div class="tcm-auto-result ${runView.ok ? "is-pass" : "is-fail"}">
          <div class="tcm-auto-result-head">
            <span class="tcm-auto-result-badge">${runView.ok ? "通过" : "失败"}</span>
            <span class="tcm-auto-result-at">${esc(U.str(runView.at).slice(0, 19).replace("T", " "))}</span>
          </div>
          <p class="tcm-auto-result-msg">${esc(U.str(runView.message) || "-")}</p>
          ${runView.screenshot
            ? `<a class="tcm-auto-shot" href="${esc(runView.screenshot)}" target="_blank" rel="noopener">
                 <img src="${esc(runView.screenshot)}" alt="自动化执行截图" loading="lazy">
               </a>`
            : ""}
          ${runView.ok
            ? ""
            : `<button type="button" class="tcm-btn tcm-btn-danger tcm-btn-sm" data-tcm-auto-bug>
                 由本次失败建 Bug
               </button>`}
        </div>
      `
      : '<p class="tcm-auto-empty">暂无执行记录。</p>';

    return `
      <section class="tcm-form-section tcm-auto-section">
        <h4 class="tcm-form-section-title">自动化联动</h4>
        <div class="tcm-form-grid">
          <div class="tcm-field tcm-field-wide">
            <label class="tcm-checkbox">
              <input type="checkbox" id="tcmField_automationEnabled" ${REFOCUS_ATTR}="automationEnabled"
                ${item.automationEnabled ? "checked" : ""}>
              <span>纳入自动化执行</span>
            </label>
          </div>
          ${item.automationEnabled
            ? fieldHtml({
              label: "自动化脚本路径",
              field: "automationTargetPath",
              wide: true,
              control: textInput("automationTargetPath", item.automationTargetPath, {
                placeholder: "如：tests/e2e/local-collect/pay.spec.ts",
                maxlength: 200
              })
            })
            : ""}
        </div>
        ${item.automationEnabled
          ? `
            <div class="tcm-auto-card">
              <div class="tcm-auto-card-head">
                <span class="tcm-auto-card-title">自动化步骤（${autoSteps.length}）</span>
                <button type="button" class="tcm-btn tcm-btn-primary tcm-btn-sm"
                  data-tcm-auto-run ${automationRunning || !editingId ? "disabled" : ""}
                  title="${editingId ? "调用 /api/ui-automation/run-case 执行本条用例" : "请先保存用例再执行"}">
                  ${automationRunning ? "执行中…" : "一键执行"}
                </button>
              </div>
              ${stepsHtml}
              ${runHtml}
            </div>
          `
          : ""}
      </section>
    `;
  }

  /**
   * 抽屉正文。
   * @param {object} item 草稿
   * @returns {string} HTML
   */
  function bodyHtml(item) {
    const products = productOptions(item.business);
    const modules = moduleOptions(item.business, item.product);
    const categories = categoryOptions(item.business, item.product, item.module);

    const errorBanner = formError
      ? `<div class="tcm-form-error" role="alert">${esc(formError)}</div>`
      : "";

    return `
      ${errorBanner}
      ${datalistHtml("tcmProductOptions", products)}
      ${datalistHtml("tcmModuleOptions", modules)}
      ${datalistHtml("tcmCategoryOptions", categories)}
      ${datalistHtml("tcmComponentOptions", componentOptions())}
      ${datalistHtml("tcmTagOptions", tagOptions())}

      <section class="tcm-form-section">
        <h4 class="tcm-form-section-title">目录归属</h4>
        <div class="tcm-form-grid">
          ${fieldHtml({
            label: "业务线",
            field: "business",
            required: true,
            control: selectInput("business", TCM.catalog && typeof TCM.catalog.get === "function" ? TCM.catalog.get().businesses : C.BUSINESS, item.business)
          })}
          ${fieldHtml({
            label: "产品",
            field: "product",
            control: textInput("product", item.product, {
              placeholder: "如：收银台、商户后台",
              listId: "tcmProductOptions",
              maxlength: 40
            }),
            hint: "留空时目录树自动坍缩该层"
          })}
          ${fieldHtml({
            label: "模块",
            field: "module",
            control: textInput("module", item.module, {
              placeholder: "如：下单、退款、对账",
              listId: "tcmModuleOptions",
              maxlength: 40
            })
          })}
          ${fieldHtml({
            label: "场景",
            field: "category",
            control: textInput("category", item.category, {
              placeholder: "可选，用于四级细分",
              listId: "tcmCategoryOptions",
              maxlength: 40
            })
          })}
        </div>
      </section>

      <section class="tcm-form-section">
        <h4 class="tcm-form-section-title">基本信息</h4>
        <div class="tcm-form-grid">
          ${fieldHtml({
            label: "用例标题",
            field: "title",
            required: true,
            wide: true,
            control: textInput("title", item.title, {
              placeholder: "一句话描述验证点，如：本地收款-支付宝-正常下单成功",
              maxlength: 120
            })
          })}
          ${fieldHtml({
            label: "用例类型",
            field: "type",
            control: selectInput("type", C.CASE_TYPE, item.type)
          })}
          ${fieldHtml({
            label: "优先级",
            field: "priority",
            control: selectInput("priority", C.PRIORITY, item.priority)
          })}
          ${fieldHtml({
            label: "状态",
            field: "status",
            control: selectInput("status", C.CASE_STATUS, item.status)
          })}
          ${fieldHtml({
            label: "功能组件",
            field: "component",
            control: selectInput("component", componentOptions(), item.component)
          })}
          ${fieldHtml({
            label: "标签",
            field: "tags",
            wide: true,
            control: tagsHtml(item.tags)
          })}
        </div>
      </section>

      <section class="tcm-form-section">
        <h4 class="tcm-form-section-title">用例内容</h4>
        ${templateBarHtml()}
        <div class="tcm-form-grid">
          ${fieldHtml({
            label: "测试目的",
            field: "objective",
            wide: true,
            control: textArea("objective", item.objective, { rows: 2, placeholder: "本条用例要验证什么" })
          })}
          ${fieldHtml({
            label: "前置条件",
            field: "preconditions",
            control: textArea("preconditions", item.preconditions, { rows: 4, placeholder: "环境、权限、数据准备" })
          })}
          ${fieldHtml({
            label: "测试数据",
            field: "testData",
            control: textArea("testData", item.testData, { rows: 4, placeholder: "账号、金额、报文等" })
          })}
          ${fieldHtml({
            label: "操作步骤",
            field: "steps",
            required: true,
            control: textArea("steps", item.steps, { rows: 6, placeholder: "每行一步，建议以序号开头" })
          })}
          ${fieldHtml({
            label: "预期结果",
            field: "expected",
            required: true,
            control: textArea("expected", item.expected, { rows: 6, placeholder: "与步骤一一对应的可验证结论" })
          })}
        </div>
      </section>

      ${stepsSectionHtml(item)}

      <section class="tcm-form-section">
        <h4 class="tcm-form-section-title">关联与追溯</h4>
        <div class="tcm-form-grid">
          ${fieldHtml({
            label: "关联需求",
            field: "linkedRequirements",
            wide: true,
            control: requirementsHtml(item.linkedRequirements),
            hint: "数据源：版本批次与测试任务，用于追溯视图统计覆盖率"
          })}
        </div>
        ${readonlyLinksHtml(item)}
      </section>

      ${automationSectionHtml(item)}

      ${versionSectionHtml(item)}
    `;
  }

  /**
   * 抽屉底部信息与按钮。
   * @param {object} item 草稿
   * @param {boolean} isNew 是否新增
   * @returns {string} HTML
   */
  function footHtml(item, isNew) {
    const nextVersion = isNew ? 1 : U.num(item.version, 1, 1) + 1;
    const meta = isNew
      ? `新建用例 · 保存后版本 v1 · 创建人 ${esc(operator())}`
      : `当前 v${U.num(item.version, 1, 1)} → 保存后 v${nextVersion} · 最近更新 ${esc(U.str(item.updatedBy) || "-")}`;
    return `
      <p class="tcm-drawer-meta">${meta}</p>
      <div class="tcm-drawer-actions">
        <button type="button" class="tcm-btn tcm-btn-ghost" data-tcm-drawer-close>取消</button>
        <button type="button" class="tcm-btn tcm-btn-primary" data-tcm-save>保存用例</button>
      </div>
    `;
  }

  /* ------------------------------------------------------------------ *
   * 渲染
   * ------------------------------------------------------------------ */

  /**
   * 确保抽屉骨架存在（只创建一次）。
   * @returns {HTMLElement|null} 抽屉根节点
   */
  function ensureSkeleton() {
    if (!doc) {
      return null;
    }
    if (!rootEl) {
      rootEl = doc.getElementById(ROOT_ID);
    }
    if (!rootEl) {
      rootEl = doc.createElement("div");
      rootEl.id = ROOT_ID;
      doc.body.appendChild(rootEl);
    }
    if (!rootEl.querySelector("[data-tcm-drawer]")) {
      rootEl.innerHTML = `
        <div class="tcm-drawer" data-tcm-drawer hidden>
          <div class="tcm-drawer-mask" data-tcm-drawer-close></div>
          <aside class="tcm-drawer-panel" role="dialog" aria-modal="true"
            aria-labelledby="tcmCaseDrawerTitle" tabindex="-1">
            <header class="tcm-drawer-head">
              <div class="tcm-drawer-heading">
                <h3 class="tcm-drawer-title" id="tcmCaseDrawerTitle">编辑基础用例</h3>
                <p class="tcm-drawer-path" data-tcm-drawer-path></p>
              </div>
              <button type="button" class="tcm-icon-btn" data-tcm-drawer-close aria-label="关闭编辑抽屉">✕</button>
            </header>
            <div class="tcm-drawer-body" data-tcm-drawer-body></div>
            <footer class="tcm-drawer-foot" data-tcm-drawer-foot></footer>
          </aside>
        </div>
      `;
    }
    return rootEl;
  }

  /**
   * 渲染抽屉（幂等）：未打开时只保证骨架存在并隐藏。
   * @returns {void}
   */
  function render() {
    const host = ensureSkeleton();
    if (!host) {
      return;
    }
    const drawer = host.querySelector("[data-tcm-drawer]");
    if (!drawer) {
      return;
    }

    if (!opened || !draft) {
      drawer.hidden = true;
      drawer.classList.remove("is-open");
      return;
    }

    const isNew = !editingId;
    const titleEl = host.querySelector("#tcmCaseDrawerTitle");
    const pathEl = host.querySelector("[data-tcm-drawer-path]");
    const bodyEl = host.querySelector("[data-tcm-drawer-body]");
    const footEl = host.querySelector("[data-tcm-drawer-foot]");

    if (titleEl) {
      titleEl.textContent = isNew ? "新增基础用例" : "编辑基础用例";
    }
    if (pathEl) {
      const path = [draft.business, draft.product, draft.module, draft.category]
        .map((part) => U.str(part))
        .filter(Boolean)
        .join(" / ");
      pathEl.textContent = path || "未归类";
    }
    if (bodyEl) {
      bodyEl.innerHTML = bodyHtml(draft);
    }
    if (footEl) {
      footEl.innerHTML = footHtml(draft, isNew);
    }

    drawer.hidden = false;
    drawer.classList.add("is-open");
    restoreFocus(host);
  }

  /**
   * 渲染后恢复焦点：优先恢复到 refocusField，否则聚焦标题输入框。
   * @param {HTMLElement} host 抽屉根节点
   * @returns {void}
   */
  function restoreFocus(host) {
    const selector = refocusField
      ? `[${REFOCUS_ATTR}="${refocusField}"]`
      : '[data-tcm-field="title"]';
    const target = host.querySelector(selector);
    refocusField = "";
    if (!target || typeof target.focus !== "function") {
      return;
    }
    try {
      target.focus();
      if (typeof target.setSelectionRange === "function" && target.type === "text") {
        const length = target.value.length;
        target.setSelectionRange(length, length);
      }
    } catch (error) {
      // 某些控件不支持 setSelectionRange，忽略即可
    }
  }

  /* ------------------------------------------------------------------ *
   * 校验与保存
   * ------------------------------------------------------------------ */

  /**
   * 保存前校验。
   * @param {object} item 草稿
   * @returns {string} 错误信息，空串表示通过
   */
  function validate(item) {
    if (!U.str(item.title).trim()) {
      return "请填写用例标题。";
    }
    if (!U.str(item.business).trim()) {
      return "请选择所属业务线。";
    }
    if (!U.str(item.steps).trim()) {
      return "请填写操作步骤（可点「快速模板」生成骨架）。";
    }
    if (!U.str(item.expected).trim()) {
      return "请填写预期结果（可点「快速模板」生成骨架）。";
    }
    if (item.automationEnabled && !U.str(item.automationTargetPath).trim()) {
      return "已勾选「纳入自动化执行」，请填写自动化脚本路径。";
    }
    return "";
  }

  /**
   * 保存草稿到 basicCaseLibrary。
   * @returns {void}
   */
  function save() {
    if (!draft) {
      return;
    }

    // T05：保存前先把结构化步骤同步回纯文本字段（向下兼容 steps / expected）
    if (TCM.steps && typeof TCM.steps.syncToDraft === "function") {
      TCM.steps.syncToDraft(draft, stepRows);
    }

    const message = validate(draft);
    if (message) {
      formError = message;
      render();
      toast(message, "warning");
      return;
    }
    formError = "";

    const now = U.nowIso();
    const who = operator();
    const isNew = !editingId;
    const list = assets();
    const prev = isNew ? null : list.find((row) => row.id === editingId);

    // 版本号：新增固定 v1；编辑既有用例统一 +1
    const nextVersion = isNew ? 1 : U.num(prev && prev.version, 1, 1) + 1;
    const markBaseline = Boolean(draft.isBaseline);

    const payload = TCM.model.normalizeCaseAsset(Object.assign({}, draft, {
      id: isNew ? (U.str(draft.id) || U.uid(C.ID_PREFIX.CASE_ASSET)) : editingId,
      title: U.str(draft.title).trim(),
      product: U.str(draft.product).trim(),
      module: U.str(draft.module).trim(),
      category: U.str(draft.category).trim(),
      component: U.str(draft.component).trim(),
      version: nextVersion,
      isBaseline: markBaseline,
      baselineFrom: markBaseline ? nextVersion : U.num(prev && prev.baselineFrom, 0, 0),
      createdBy: isNew ? who : U.str(prev && prev.createdBy, who),
      createdAt: isNew ? U.today() : U.str(prev && prev.createdAt) || U.today(),
      updatedBy: who,
      updatedAt: now
    }), { operator: who, now });

    const next = isNew
      ? list.concat([payload])
      : list.map((row) => (row.id === editingId ? payload : row));

    const ok = TCM.store.commit("basicCaseLibrary", next, { source: "library" });
    if (!ok) {
      formError = "保存失败：写入被数据层拦截，请检查控制台错误信息。";
      render();
      toast(formError, "error");
      return;
    }

    // T05：每次保存写一条版本快照（同 caseAssetId + version 会覆盖，含 20 版护栏）
    writeVersionSnapshot(payload, {
      operator: who,
      now,
      changeNote: isNew
        ? "创建用例"
        : (markBaseline ? "编辑保存并另存为基线" : "编辑保存")
    });

    // 目录信息可能新增了产品 / 模块 / 场景，通知目录树刷新
    TCM.bus.emit(C.EVENTS.DIR_CHANGED, { source: "caseEditor", caseId: payload.id });
    TCM.bus.emit(C.EVENTS.CASE_UPDATED, { id: payload.id, mode: isNew ? "create" : "update" });

    toast(
      isNew ? `已新增用例「${payload.title}」` : `已保存「${payload.title}」，版本升级至 v${payload.version}`,
      "success"
    );
    close();
  }

  /**
   * 写入一条版本快照到 caseVersions 集合。
   * 快照写入失败不阻断主流程（用例本体已落库），只降级提示。
   * @param {object} payload 已落库的用例资产
   * @param {{operator?:string, now?:string, changeNote?:string}} options 选项
   * @returns {boolean} 是否写入成功
   */
  function writeVersionSnapshot(payload, options) {
    if (!TCM.model || typeof TCM.model.appendCaseVersion !== "function") {
      return false;
    }
    const nextVersions = TCM.model.appendCaseVersion(versions(), payload, options);
    const saved = TCM.store.commit("caseVersions", nextVersions, { source: "library" });
    if (!saved && global.console && typeof global.console.warn === "function") {
      global.console.warn("[TCM.caseEditor] 版本快照写入被拦截，用例本体已保存。");
    }
    return saved;
  }

  /**
   * 回滚到指定历史版本：业务字段还原，version 继续 +1，并写入一条新的快照。
   * @param {number} version 目标版本号
   * @returns {void}
   */
  function rollbackTo(version) {
    if (!editingId) {
      return;
    }
    const target = currentVersions().find((row) => U.num(row.version, 0, 0) === version);
    if (!target) {
      toast(`未找到版本 v${version} 的快照。`, "warning");
      return;
    }

    const list = assets();
    const current = list.find((row) => row.id === editingId);
    if (!current) {
      toast("当前用例已不存在，无法回滚。", "error");
      return;
    }

    const confirmed = global.confirm(
      `确定把「${U.str(current.title)}」回滚到 v${version} 吗？\n回滚不会覆盖执行记录与缺陷，版本号会继续递增到 v${U.num(current.version, 1, 1) + 1}。`
    );
    if (!confirmed) {
      return;
    }

    const now = U.nowIso();
    const who = operator();
    const restored = TCM.model.rollbackCaseAsset(current, target.snapshot, { operator: who, now });
    const next = list.map((row) => (row.id === editingId ? restored : row));

    const ok = TCM.store.commit("basicCaseLibrary", next, { source: "library" });
    if (!ok) {
      toast("回滚失败：写入被数据层拦截。", "error");
      return;
    }

    writeVersionSnapshot(restored, { operator: who, now, changeNote: `回滚自 v${version}` });

    // 回滚后同步刷新草稿，让抽屉里立刻看到还原后的内容
    draft = TCM.model.normalizeCaseAsset(U.clone(restored), { operator: who });
    original = U.clone(draft);
    stepRows = TCM.steps && typeof TCM.steps.normalize === "function"
      ? TCM.steps.normalize(draft.stepRows)
      : U.toArray(draft.stepRows);
    diffVersion = U.num(restored.version, 0, 0);
    formError = "";

    TCM.bus.emit(C.EVENTS.DIR_CHANGED, { source: "caseEditor", caseId: restored.id });
    TCM.bus.emit(C.EVENTS.CASE_UPDATED, { id: restored.id, mode: "rollback" });

    render();
    toast(`已回滚到 v${version}，当前版本 v${restored.version}。`, "success");
  }

  /**
   * 一键执行本条自动化用例。
   * @returns {void}
   */
  function runAutomation() {
    if (!draft || automationRunning || !editingId) {
      return;
    }
    if (typeof global.fetch !== "function") {
      toast("当前环境不支持 fetch，无法触发自动化执行。", "error");
      return;
    }

    automationRunning = true;
    automationResult = null;
    render();

    const caseId = editingId;
    global.fetch("/api/ui-automation/run-case", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caseId,
        title: U.str(draft.title),
        targetPath: U.str(draft.automationTargetPath),
        steps: U.toArray(draft.automationSteps)
      })
    })
      .then((response) => response.json().catch(() => ({})).then((data) => ({ status: response.status, data })))
      .then((result) => {
        const data = result.data && typeof result.data === "object" ? result.data : {};
        const passed = result.status >= 200 && result.status < 300 && data.error === undefined
          && (data.ok === undefined ? true : Boolean(data.ok));
        automationResult = {
          ok: passed,
          message: U.str(data.message) || U.str(data.error) || (passed ? "执行完成" : `执行失败（HTTP ${result.status}）`),
          screenshot: U.str(data.screenshot) || U.str(data.screenshotUrl),
          at: U.nowIso()
        };
        persistAutomationRun(caseId, automationResult);
        toast(passed ? "自动化执行完成。" : `自动化执行失败：${automationResult.message}`, passed ? "success" : "error");
      })
      .catch((error) => {
        automationResult = {
          ok: false,
          message: `请求异常：${U.str(error && error.message) || "未知错误"}`,
          screenshot: "",
          at: U.nowIso()
        };
        persistAutomationRun(caseId, automationResult);
        toast(automationResult.message, "error");
      })
      .then(() => {
        automationRunning = false;
        if (opened) {
          render();
        }
      });
  }

  /**
   * 把自动化执行结果回写到用例的 automationLastRun 字段。
   * @param {string} caseId 用例 id
   * @param {{ok:boolean,message:string,screenshot:string,at:string}} result 执行结果
   * @returns {void}
   */
  function persistAutomationRun(caseId, result) {
    const list = assets();
    if (!list.some((row) => row.id === caseId)) {
      return;
    }
    const lastRun = {
      at: U.str(result.at) || U.nowIso(),
      date: U.today(),
      result: result.ok ? "通过" : "失败",
      ok: Boolean(result.ok),
      message: U.str(result.message),
      screenshot: U.str(result.screenshot),
      operator: operator()
    };
    const next = list.map((row) => (
      row.id === caseId
        ? Object.assign({}, row, { automationLastRun: lastRun })
        : row
    ));
    TCM.store.commit("basicCaseLibrary", next, { source: "library" });
    if (draft && editingId === caseId) {
      draft.automationLastRun = lastRun;
      if (original) {
        original.automationLastRun = lastRun;
      }
    }
  }

  /**
   * 由自动化失败结果建 Bug。
   * 缺陷写入 state.bugs（skipNormalize，交给 app.js normalizeBugItem），
   * 并复用 T03 的 appendAssetDefect 走 §6.5 白名单把缺陷挂到用例 linkedDefects 上。
   * @returns {void}
   */
  function createBugFromAutomation() {
    if (!draft || !automationResult || automationResult.ok || !editingId) {
      return;
    }

    const stamp = U.nowIso();
    const who = operator();
    const title = `【自动化失败】${U.str(draft.title)}`;
    const bugList = TCM.store.collection("bugs");
    const used = new Set(bugList.map((row) => U.str(row && row.id)));
    let bugId = `bug-${Date.now()}`;
    while (used.has(bugId)) {
      bugId = `bug-${Date.now()}-${Math.floor(Math.random() * 900000 + 100000)}`;
    }

    const note = [
      `自动化脚本：${U.str(draft.automationTargetPath) || "-"}`,
      `失败信息：${U.str(automationResult.message)}`,
      `执行时间：${U.str(automationResult.at)}`,
      "",
      "【操作步骤】",
      U.str(draft.steps) || "-",
      "",
      "【预期结果】",
      U.str(draft.expected) || "-"
    ].join("\n");

    let bug = {
      id: bugId,
      title,
      severity: "一般",
      status: "待处理",
      caseId: "",
      moduleName: U.str(draft.module) || U.str(draft.product),
      moduleId: "",
      owner: who,
      link: "",
      note,
      images: U.str(automationResult.screenshot)
        ? [{ id: `${bugId}-shot`, fileName: "automation.png", url: U.str(automationResult.screenshot), size: 0, createdAt: stamp }]
        : [],
      completedAt: "",
      caseAssetId: editingId,
      planId: "",
      planRound: 1,
      executionId: "",
      createdFrom: "tcm-case-editor-automation"
    };

    if (typeof global.applyCreateAuditFields === "function") {
      try {
        bug = global.applyCreateAuditFields(bug);
      } catch (_error) {
        // 宿主审计字段函数异常时降级为本地字段
      }
    }
    bug.createdBy = U.str(bug.createdBy) || who;
    bug.createdAt = U.str(bug.createdAt) || stamp;
    bug.updatedBy = U.str(bug.updatedBy) || bug.createdBy;
    bug.updatedAt = U.str(bug.updatedAt) || bug.createdAt;

    const ok = TCM.store.commit("bugs", [bug].concat(bugList), {
      source: "library",
      skipNormalize: true,
      reason: "createBugFromAutomation"
    });
    if (!ok) {
      toast("缺陷写入被拦截，请查看控制台日志。", "error");
      return;
    }

    const appender = TCM.execution && TCM.execution._internals
      && typeof TCM.execution._internals.appendAssetDefect === "function"
      ? TCM.execution._internals.appendAssetDefect
      : null;
    if (appender) {
      appender(editingId, { id: bugId, title });
      const refreshed = assets().find((row) => row.id === editingId);
      if (refreshed && draft) {
        draft.linkedDefects = U.clone(refreshed.linkedDefects);
        if (original) {
          original.linkedDefects = U.clone(refreshed.linkedDefects);
        }
      }
    }

    TCM.bus.emit(C.EVENTS.EXEC_BUG_CREATED, {
      bugId,
      title,
      severity: bug.severity,
      executionId: "",
      planId: "",
      round: 1,
      caseAssetId: editingId,
      appendedToAsset: Boolean(appender),
      source: "caseEditor.automation"
    });

    if (typeof global.renderAll === "function") {
      try {
        global.renderAll();
      } catch (_error) {
        // 宿主渲染异常不影响本模块
      }
    }

    render();
    toast(`缺陷 ${bugId} 已创建并关联到本用例。`, "success");
  }

  /* ------------------------------------------------------------------ *
   * 打开 / 关闭
   * ------------------------------------------------------------------ */

  /**
   * 打开编辑抽屉。
   * @param {string} [id] 用例 id；空串 / 省略表示新增
   * @param {object} [context] 新增时的目录上下文 {business, product, module, category}
   * @returns {void}
   */
  function open(id, context) {
    if (!doc) {
      return;
    }
    if (!mounted) {
      mount(doc.getElementById(ROOT_ID));
    }

    const loaded = loadDraft(id, context);
    draft = loaded.draft;
    original = U.clone(loaded.draft);
    editingId = loaded.isNew ? "" : U.str(id);
    formError = "";
    refocusField = "";

    // T05：结构化步骤工作副本 + 版本面板 / 自动化面板复位
    stepRows = TCM.steps && typeof TCM.steps.normalize === "function"
      ? TCM.steps.normalize(draft.stepRows)
      : U.toArray(draft.stepRows);
    versionPanelOpen = false;
    diffVersion = 0;
    automationRunning = false;
    automationResult = null;
    lastFocused = doc.activeElement && typeof doc.activeElement.focus === "function"
      ? doc.activeElement
      : null;

    opened = true;
    if (doc.body && doc.body.classList) {
      doc.body.classList.add("tcm-drawer-open");
    }
    render();
  }

  /**
   * 关闭抽屉并回焦。
   * @returns {void}
   */
  function close() {
    if (!opened) {
      return;
    }
    opened = false;
    draft = null;
    original = null;
    editingId = "";
    formError = "";
    stepRows = [];
    versionPanelOpen = false;
    diffVersion = 0;
    automationRunning = false;
    automationResult = null;
    if (doc && doc.body && doc.body.classList) {
      doc.body.classList.remove("tcm-drawer-open");
    }
    render();
    if (lastFocused && typeof lastFocused.focus === "function") {
      try {
        lastFocused.focus();
      } catch (error) {
        // 元素可能已被重渲染移除，忽略
      }
    }
    lastFocused = null;
  }

  /**
   * 判断是否有未保存改动。
   * @returns {boolean} 是否脏
   */
  function isDirty() {
    if (!opened || !draft || !original) {
      return false;
    }
    if (JSON.stringify(draft) !== JSON.stringify(original)) {
      return true;
    }
    // T05：结构化步骤是独立工作副本，需要单独比对
    const baseRows = TCM.steps && typeof TCM.steps.normalize === "function"
      ? TCM.steps.normalize(original.stepRows)
      : U.toArray(original.stepRows);
    return JSON.stringify(stepRows) !== JSON.stringify(baseRows);
  }

  /**
   * 带「未保存确认」的关闭。
   * @returns {void}
   */
  function requestClose() {
    if (isDirty()) {
      const ok = global.confirm("当前用例有未保存的修改，确定放弃并关闭吗？");
      if (!ok) {
        return;
      }
    }
    close();
  }

  /* ------------------------------------------------------------------ *
   * 交互：模板 / 标签 / 关联需求
   * ------------------------------------------------------------------ */

  /**
   * 套用模板。
   * @param {string} key 模板 key
   * @returns {void}
   */
  function applyTemplate(key) {
    if (!draft) {
      return;
    }
    const tpl = TEMPLATES.find((row) => row.key === key);
    if (!tpl) {
      return;
    }
    const filled = ["objective", "preconditions", "testData", "steps", "expected"]
      .filter((field) => U.str(draft[field]).trim())
      .length;
    if (filled > 0) {
      const ok = global.confirm(`套用「${tpl.label}」模板会覆盖已填写的内容字段，确定继续吗？`);
      if (!ok) {
        return;
      }
    }
    Object.keys(tpl.patch).forEach((field) => {
      draft[field] = tpl.patch[field];
    });
    draft.type = U.oneOf(tpl.type, C.CASE_TYPE, C.DEFAULTS.CASE_TYPE);
    formError = "";
    refocusField = "steps";
    render();
    toast(`已套用「${tpl.label}」模板`, "info");
  }

  /**
   * 清空内容字段。
   * @returns {void}
   */
  function clearContent() {
    if (!draft) {
      return;
    }
    const ok = global.confirm("确定清空测试目的 / 前置条件 / 测试数据 / 步骤 / 预期结果吗？");
    if (!ok) {
      return;
    }
    ["objective", "preconditions", "testData", "steps", "expected"].forEach((field) => {
      draft[field] = "";
    });
    formError = "";
    refocusField = "objective";
    render();
  }

  /**
   * 添加标签（支持逗号 / 顿号批量）。
   * @param {string} raw 原始输入
   * @returns {void}
   */
  function addTags(raw) {
    if (!draft) {
      return;
    }
    const parts = U.str(raw)
      .split(/[,，、;；\s]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (!parts.length) {
      return;
    }
    draft.tags = U.stringList(U.toArray(draft.tags).concat(parts));
    render();
    const input = rootEl && rootEl.querySelector("[data-tcm-tag-input]");
    if (input && typeof input.focus === "function") {
      input.value = "";
      input.focus();
    }
  }

  /**
   * 移除标签。
   * @param {string} tag 标签名
   * @returns {void}
   */
  function removeTag(tag) {
    if (!draft) {
      return;
    }
    const value = U.str(tag);
    draft.tags = U.toArray(draft.tags).filter((item) => U.str(item) !== value);
    render();
  }

  /**
   * 添加关联需求。
   * @param {string} key `${type}::${id}`
   * @returns {void}
   */
  function addRequirement(key) {
    if (!draft) {
      return;
    }
    const raw = U.str(key);
    if (!raw) {
      return;
    }
    const sepIndex = raw.indexOf("::");
    if (sepIndex < 0) {
      return;
    }
    const type = raw.slice(0, sepIndex);
    const id = raw.slice(sepIndex + 2);
    const option = requirementOptions().find((row) => row.type === type && row.id === id);
    if (!option) {
      return;
    }
    draft.linkedRequirements = TCM.model.normalizeCaseAsset({
      linkedRequirements: U.toArray(draft.linkedRequirements).concat([
        { type: option.type, id: option.id, name: option.name }
      ])
    }, { operator: operator() }).linkedRequirements;
    render();
  }

  /**
   * 移除关联需求。
   * @param {string} key `${type}::${id}`
   * @returns {void}
   */
  function removeRequirement(key) {
    if (!draft) {
      return;
    }
    const raw = U.str(key);
    draft.linkedRequirements = U.toArray(draft.linkedRequirements)
      .filter((req) => `${U.str(req.type)}::${U.str(req.id)}` !== raw);
    render();
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

    // T05：结构化步骤区优先短路处理
    if (draft && TCM.steps && typeof TCM.steps.owns === "function" && TCM.steps.owns(event)) {
      const result = TCM.steps.handleClick(event, stepRows, {
        plainText: U.str(draft.steps),
        automationSteps: U.toArray(draft.automationSteps)
      });
      if (result.handled) {
        stepRows = result.rows;
        if (result.message) {
          toast(result.message, "info");
        }
        if (result.structural) {
          render();
        }
        return;
      }
    }

    // T05：版本历史面板
    if (target.closest("[data-tcm-version-toggle]")) {
      event.preventDefault();
      versionPanelOpen = !versionPanelOpen;
      render();
      return;
    }

    const diffBtn = target.closest("[data-tcm-version-diff]");
    if (diffBtn) {
      event.preventDefault();
      const version = U.num(diffBtn.dataset.tcmVersionDiff, 0, 0);
      diffVersion = diffVersion === version ? 0 : version;
      render();
      return;
    }

    const rollbackBtn = target.closest("[data-tcm-version-rollback]");
    if (rollbackBtn) {
      event.preventDefault();
      rollbackTo(U.num(rollbackBtn.dataset.tcmVersionRollback, 0, 0));
      return;
    }

    // T05：自动化联动
    if (target.closest("[data-tcm-auto-run]")) {
      event.preventDefault();
      runAutomation();
      return;
    }

    if (target.closest("[data-tcm-auto-bug]")) {
      event.preventDefault();
      createBugFromAutomation();
      return;
    }

    if (target.closest("[data-tcm-drawer-close]")) {
      event.preventDefault();
      requestClose();
      return;
    }

    if (target.closest("[data-tcm-save]")) {
      event.preventDefault();
      save();
      return;
    }

    const tplBtn = target.closest("[data-tcm-template]");
    if (tplBtn) {
      event.preventDefault();
      applyTemplate(tplBtn.dataset.tcmTemplate);
      return;
    }

    if (target.closest("[data-tcm-template-clear]")) {
      event.preventDefault();
      clearContent();
      return;
    }

    if (target.closest("[data-tcm-tag-add]")) {
      event.preventDefault();
      const input = rootEl && rootEl.querySelector("[data-tcm-tag-input]");
      addTags(input ? input.value : "");
      return;
    }

    const tagRemove = target.closest("[data-tcm-tag-remove]");
    if (tagRemove) {
      event.preventDefault();
      removeTag(tagRemove.dataset.tcmTagRemove);
      return;
    }

    const reqRemove = target.closest("[data-tcm-req-remove]");
    if (reqRemove) {
      event.preventDefault();
      removeRequirement(reqRemove.dataset.tcmReqRemove);
    }
  }

  /**
   * 输入事件：只写草稿，不重渲染，避免光标跳动。
   * @param {InputEvent} event 事件对象
   * @returns {void}
   */
  function onInput(event) {
    if (!draft) {
      return;
    }

    // T05：结构化步骤单元格编辑（不重渲染，避免光标跳动）
    if (TCM.steps && typeof TCM.steps.owns === "function" && TCM.steps.owns(event)) {
      const result = TCM.steps.handleInput(event, stepRows);
      if (result.handled) {
        stepRows = result.rows;
        return;
      }
    }

    const target = event.target;
    if (!target || !target.getAttribute) {
      return;
    }
    const field = target.getAttribute(REFOCUS_ATTR);
    if (!field || field === "automationEnabled" || field === "isBaseline") {
      return;
    }
    draft[field] = U.str(target.value);
  }

  /**
   * 拖拽事件总处理：只服务结构化步骤排序。
   * @param {DragEvent} event 事件对象
   * @returns {void}
   */
  function onDrag(event) {
    if (!draft || !TCM.steps || typeof TCM.steps.handleDrag !== "function") {
      return;
    }
    if (typeof TCM.steps.owns === "function" && !TCM.steps.owns(event)) {
      return;
    }
    const result = TCM.steps.handleDrag(event, stepRows);
    if (!result.handled) {
      return;
    }
    stepRows = result.rows;
    if (result.structural) {
      render();
    }
  }

  /**
   * change 事件：下拉与复选框，必要时结构性重渲染。
   * @param {Event} event 事件对象
   * @returns {void}
   */
  function onChange(event) {
    if (!draft) {
      return;
    }
    const target = event.target;
    if (!target) {
      return;
    }

    if (target.matches && target.matches("[data-tcm-req-picker]")) {
      const value = target.value;
      target.value = "";
      addRequirement(value);
      return;
    }

    if (!target.getAttribute) {
      return;
    }
    const field = target.getAttribute(REFOCUS_ATTR);
    if (!field) {
      return;
    }

    if (field === "automationEnabled") {
      draft.automationEnabled = Boolean(target.checked);
      refocusField = "automationEnabled";
      render();
      return;
    }

    if (field === "isBaseline") {
      draft.isBaseline = Boolean(target.checked);
      refocusField = "isBaseline";
      render();
      return;
    }

    if (field === "business") {
      // 业务线切换后，产品 / 模块 / 场景候选需要刷新
      const businessOptions = TCM.catalog && typeof TCM.catalog.get === "function" ? TCM.catalog.get().businesses : C.BUSINESS;
      draft.business = U.oneOf(target.value, businessOptions, C.DEFAULTS.BUSINESS);
      refocusField = "business";
      render();
      return;
    }

    if (field === "type" || field === "priority" || field === "status") {
      draft[field] = U.str(target.value);
      return;
    }

    draft[field] = U.str(target.value);
  }

  /**
   * 键盘事件：ESC 关闭、Enter 添加标签、Tab 焦点陷阱。
   * @param {KeyboardEvent} event 事件对象
   * @returns {void}
   */
  function onKeydown(event) {
    if (!opened) {
      return;
    }

    if (event.key === "Escape" || event.key === "Esc") {
      event.preventDefault();
      requestClose();
      return;
    }

    const target = event.target;
    if (event.key === "Enter" && target && target.hasAttribute && target.hasAttribute("data-tcm-tag-input")) {
      event.preventDefault();
      addTags(target.value);
      return;
    }

    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      save();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const panel = rootEl && rootEl.querySelector(".tcm-drawer-panel");
    if (!panel) {
      return;
    }
    const nodes = Array.prototype.slice.call(panel.querySelectorAll(FOCUSABLE))
      .filter((node) => node.offsetParent !== null || node === doc.activeElement);
    if (!nodes.length) {
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && doc.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && doc.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* ------------------------------------------------------------------ *
   * 生命周期
   * ------------------------------------------------------------------ */

  /**
   * 挂载抽屉：创建骨架并绑定事件（只绑一次）。
   * @param {HTMLElement} [root] #tcmCaseDrawerRoot 容器
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
    rootEl.addEventListener("input", onInput);
    rootEl.addEventListener("change", onChange);
    // T05：结构化步骤拖拽排序
    rootEl.addEventListener("dragstart", onDrag);
    rootEl.addEventListener("dragover", onDrag);
    rootEl.addEventListener("drop", onDrag);
    rootEl.addEventListener("dragend", onDrag);
    doc.addEventListener("keydown", onKeydown);
    mounted = true;
    render();
  }

  /**
   * 卸载：解绑事件。
   * @returns {void}
   */
  function destroy() {
    if (rootEl) {
      rootEl.removeEventListener("click", onClick);
      rootEl.removeEventListener("input", onInput);
      rootEl.removeEventListener("change", onChange);
      rootEl.removeEventListener("dragstart", onDrag);
      rootEl.removeEventListener("dragover", onDrag);
      rootEl.removeEventListener("drop", onDrag);
      rootEl.removeEventListener("dragend", onDrag);
    }
    if (doc) {
      doc.removeEventListener("keydown", onKeydown);
    }
    opened = false;
    draft = null;
    original = null;
    editingId = "";
    stepRows = [];
    versionPanelOpen = false;
    diffVersion = 0;
    automationRunning = false;
    automationResult = null;
    mounted = false;
  }

  TCM.caseEditor = {
    mount,
    render,
    destroy,
    open,
    close,
    requestClose,
    save,
    isOpen() {
      return opened;
    },
    getDraft() {
      return draft ? U.clone(draft) : null;
    },
    /**
     * 读取当前结构化步骤工作副本（T05，供验收 / 调试）。
     * @returns {Array<object>} 步骤数组副本
     */
    getStepRows() {
      return U.clone(stepRows);
    },
    /**
     * 读取当前用例的版本历史（T05，供验收 / 调试）。
     * @returns {Array<object>} 版本数组（最新在前）
     */
    getVersions() {
      return currentVersions();
    },
    rollbackTo,
    TEMPLATES,
    // 暴露给单测 / 调试的内部实现
    _internals: {
      validate,
      buildBlankDraft,
      requirementOptions,
      productOptions,
      moduleOptions,
      categoryOptions,
      writeVersionSnapshot,
      runAutomation,
      createBugFromAutomation,
      versionDiffHtml
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
