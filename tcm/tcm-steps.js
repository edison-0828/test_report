/**
 * tcm/tcm-steps.js —— 结构化步骤编辑器（T05 · P1）
 *
 * 职责：
 *   1. 把用例的 `stepRows: [{no, action, data, expected}]` 渲染成一张可编辑的表格；
 *   2. 支持增行 / 删行 / 上移下移 / 原生 HTML5 拖拽排序，序号自动重排；
 *   3. `fromAutomationSteps()` —— 由 `automationSteps` 反推结构化步骤骨架
 *      （openPage→打开页面 / click→点击 X / input→输入 X / assert*→校验 X）；
 *   4. `toPlainText()` —— 结构化步骤同步生成 `steps` 纯文本，**保持向下兼容**
 *      （报告导出 / Lark 同步 / 旧执行视图仍然只读 steps 字段）；
 *   5. 以「受控组件」方式挂进编辑抽屉：本模块不持有用例数据，
 *      只负责渲染 HTML 与解析交互，读写都通过宿主传入的 rows + onChange 回调。
 *
 * 约束：
 *   - IIFE + "use strict"，只挂载 window.TCM.steps；
 *   - 无自身 DOM 容器，不监听全局事件；交互由宿主（tcm-case-editor）事件委托后调用本模块 API；
 *   - 所有用户输入渲染前必须 TCM.util.escapeHtml()；
 *   - 纯函数逻辑（反推 / 转文本 / 排序）全部复用 TCM.model，本模块只做 UI 编排。
 *
 * 依赖：tcm-core.js → tcm-model.js
 */
(function (global) {
  "use strict";

  const TCM = global.TCM;
  if (!TCM || !TCM.const || !TCM.util || !TCM.model) {
    if (global.console && typeof global.console.error === "function") {
      global.console.error("[TCM.steps] 依赖缺失：请确认 tcm-core.js / tcm-model.js 已先加载。");
    }
    return;
  }

  const U = TCM.util;
  const M = TCM.model;
  const esc = U.escapeHtml;

  /** 步骤表格根节点标记属性 */
  const ROOT_ATTR = "data-tcm-steps";
  /** 行下标属性 */
  const ROW_ATTR = "data-tcm-step-index";
  /** 单元格字段属性 */
  const CELL_ATTR = "data-tcm-step-field";

  /** 可编辑字段白名单 */
  const EDITABLE_FIELDS = Object.freeze(["action", "data", "expected"]);

  /** 拖拽过程中的源行下标（-1 表示未拖拽） */
  let draggingIndex = -1;

  /* ------------------------------------------------------------------ *
   * 纯逻辑代理（全部转发给 TCM.model，保证单测只需覆盖 model 层）
   * ------------------------------------------------------------------ */

  /**
   * 归一化步骤数组并重排序号。
   * @param {*} rows 原始步骤
   * @returns {Array<{no:number,action:string,data:string,expected:string}>} 步骤数组
   */
  function normalize(rows) {
    return M.normalizeStepRowList(rows);
  }

  /**
   * 由 automationSteps 反推结构化步骤骨架。
   * @param {*} automationSteps 自动化步骤数组
   * @returns {Array<object>} 步骤数组
   */
  function fromAutomationSteps(automationSteps) {
    return M.stepRowsFromAutomationSteps(automationSteps);
  }

  /**
   * 由 `steps` 纯文本反推结构化步骤骨架。
   * @param {string} text 纯文本
   * @returns {Array<object>} 步骤数组
   */
  function fromPlainText(text) {
    return M.stepRowsFromPlainText(text);
  }

  /**
   * 结构化步骤 → `steps` 纯文本（向下兼容）。
   * @param {*} rows 步骤数组
   * @returns {string} 纯文本
   */
  function toPlainText(rows) {
    return M.stepRowsToPlainText(rows);
  }

  /**
   * 结构化步骤 → `expected` 纯文本。
   * @param {*} rows 步骤数组
   * @returns {string} 纯文本
   */
  function toExpectedText(rows) {
    return M.stepRowsToExpectedText(rows);
  }

  /**
   * 移动一行。
   * @param {*} rows 步骤数组
   * @param {number} from 源下标
   * @param {number} to 目标下标
   * @returns {Array<object>} 新数组
   */
  function move(rows, from, to) {
    return M.moveStepRow(rows, from, to);
  }

  /**
   * 追加一个空行。
   * @param {*} rows 步骤数组
   * @param {number} [afterIndex] 在该下标之后插入；省略表示追加到末尾
   * @returns {Array<object>} 新数组
   */
  function addRow(rows, afterIndex) {
    const list = normalize(rows);
    const blank = { no: 0, action: "", data: "", expected: "" };
    const position = U.num(afterIndex, -1, -1);
    if (position >= 0 && position < list.length) {
      list.splice(position + 1, 0, blank);
    } else {
      list.push(blank);
    }
    return normalize(list);
  }

  /**
   * 删除一行。
   * @param {*} rows 步骤数组
   * @param {number} index 行下标
   * @returns {Array<object>} 新数组
   */
  function removeRow(rows, index) {
    const list = normalize(rows);
    const position = U.num(index, -1, -1);
    if (position < 0 || position >= list.length) {
      return list;
    }
    list.splice(position, 1);
    return normalize(list);
  }

  /**
   * 修改某一行某个字段。
   * @param {*} rows 步骤数组
   * @param {number} index 行下标
   * @param {string} field 字段名（action / data / expected）
   * @param {string} value 新值
   * @returns {Array<object>} 新数组
   */
  function updateCell(rows, index, field, value) {
    const list = normalize(rows);
    const position = U.num(index, -1, -1);
    const key = U.str(field);
    if (position < 0 || position >= list.length || !EDITABLE_FIELDS.includes(key)) {
      return list;
    }
    list[position][key] = U.str(value);
    return list;
  }

  /* ------------------------------------------------------------------ *
   * 渲染
   * ------------------------------------------------------------------ */

  /**
   * 渲染单行。
   * @param {object} row 步骤行
   * @param {number} index 下标
   * @param {number} total 总行数
   * @returns {string} HTML
   */
  function rowHtml(row, index, total) {
    const upDisabled = index === 0 ? "disabled" : "";
    const downDisabled = index === total - 1 ? "disabled" : "";
    return `
      <tr class="tcm-steps-row" ${ROW_ATTR}="${index}" draggable="true">
        <td class="tcm-steps-no">
          <span class="tcm-steps-handle" title="拖拽排序" aria-hidden="true">⋮⋮</span>
          <span class="tcm-steps-seq">${U.num(row.no, index + 1, 1)}</span>
        </td>
        <td class="tcm-steps-cell">
          <textarea class="tcm-steps-input" rows="2" ${CELL_ATTR}="action" ${ROW_ATTR}="${index}"
            placeholder="操作动作，如：点击「立即支付」">${esc(row.action)}</textarea>
        </td>
        <td class="tcm-steps-cell">
          <textarea class="tcm-steps-input" rows="2" ${CELL_ATTR}="data" ${ROW_ATTR}="${index}"
            placeholder="测试数据，如：金额 0.01">${esc(row.data)}</textarea>
        </td>
        <td class="tcm-steps-cell">
          <textarea class="tcm-steps-input" rows="2" ${CELL_ATTR}="expected" ${ROW_ATTR}="${index}"
            placeholder="本步预期，如：跳转收银台">${esc(row.expected)}</textarea>
        </td>
        <td class="tcm-steps-ops">
          <button type="button" class="tcm-icon-btn" data-tcm-step-up="${index}" ${upDisabled}
            title="上移" aria-label="上移第 ${index + 1} 步">↑</button>
          <button type="button" class="tcm-icon-btn" data-tcm-step-down="${index}" ${downDisabled}
            title="下移" aria-label="下移第 ${index + 1} 步">↓</button>
          <button type="button" class="tcm-icon-btn" data-tcm-step-insert="${index}"
            title="在下方插入" aria-label="在第 ${index + 1} 步下方插入">+</button>
          <button type="button" class="tcm-icon-btn tcm-icon-btn-danger" data-tcm-step-remove="${index}"
            title="删除" aria-label="删除第 ${index + 1} 步">×</button>
        </td>
      </tr>
    `;
  }

  /**
   * 渲染整张步骤表。
   * @param {*} rows 步骤数组
   * @param {{hasAutomation?:boolean, hasPlainText?:boolean}} [options] 选项
   * @returns {string} HTML
   */
  function render(rows, options) {
    const opts = options && typeof options === "object" ? options : {};
    const list = normalize(rows);

    const importBar = `
      <div class="tcm-steps-toolbar">
        <button type="button" class="tcm-btn tcm-btn-ghost tcm-btn-sm" data-tcm-step-add>+ 添加步骤</button>
        ${opts.hasPlainText
          ? `<button type="button" class="tcm-btn tcm-btn-ghost tcm-btn-sm" data-tcm-step-from-text
              title="按行拆分现有「操作步骤」文本">从纯文本导入</button>`
          : ""}
        ${opts.hasAutomation
          ? `<button type="button" class="tcm-btn tcm-btn-ghost tcm-btn-sm" data-tcm-step-from-automation
              title="由自动化步骤反推中文操作描述">从自动化步骤反推</button>`
          : ""}
        ${list.length
          ? `<button type="button" class="tcm-btn tcm-btn-ghost tcm-btn-sm" data-tcm-step-clear>清空</button>`
          : ""}
        <span class="tcm-steps-tip">编辑后「操作步骤 / 预期结果」纯文本会自动同步，保证旧报告与 Lark 同步不受影响。</span>
      </div>
    `;

    if (!list.length) {
      return `
        <div class="tcm-steps" ${ROOT_ATTR}>
          ${importBar}
          <p class="tcm-steps-empty">还没有结构化步骤。可以直接添加，也可以从纯文本 / 自动化步骤一键反推。</p>
        </div>
      `;
    }

    return `
      <div class="tcm-steps" ${ROOT_ATTR}>
        ${importBar}
        <table class="tcm-steps-table">
          <thead>
            <tr>
              <th class="tcm-steps-no-th" scope="col">#</th>
              <th scope="col">操作动作</th>
              <th scope="col">测试数据</th>
              <th scope="col">本步预期</th>
              <th class="tcm-steps-ops-th" scope="col">操作</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((row, index) => rowHtml(row, index, list.length)).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  /* ------------------------------------------------------------------ *
   * 交互解析（宿主事件委托后调用）
   * ------------------------------------------------------------------ */

  /**
   * 解析一次 click，返回应用后的新步骤数组。
   * 宿主只需把 event.target 传进来，本模块判断是否命中步骤区并给出结果。
   *
   * @param {Event} event 原始事件
   * @param {*} rows 当前步骤数组
   * @param {{plainText?:string, automationSteps?:Array<object>}} [context] 反推数据源
   * @returns {{handled:boolean, rows:Array<object>, structural:boolean, message:string}} 处理结果
   */
  function handleClick(event, rows, context) {
    const ctx = context && typeof context === "object" ? context : {};
    const target = event && event.target;
    const miss = { handled: false, rows: normalize(rows), structural: false, message: "" };
    if (!target || typeof target.closest !== "function") {
      return miss;
    }

    if (target.closest("[data-tcm-step-add]")) {
      event.preventDefault();
      return { handled: true, rows: addRow(rows), structural: true, message: "" };
    }

    if (target.closest("[data-tcm-step-clear]")) {
      event.preventDefault();
      return { handled: true, rows: [], structural: true, message: "已清空结构化步骤" };
    }

    if (target.closest("[data-tcm-step-from-text]")) {
      event.preventDefault();
      const parsed = fromPlainText(ctx.plainText);
      return {
        handled: true,
        rows: parsed,
        structural: true,
        message: parsed.length ? `已从纯文本反推 ${parsed.length} 步` : "现有「操作步骤」为空，没有可反推的内容"
      };
    }

    if (target.closest("[data-tcm-step-from-automation]")) {
      event.preventDefault();
      const parsed = fromAutomationSteps(ctx.automationSteps);
      return {
        handled: true,
        rows: parsed,
        structural: true,
        message: parsed.length ? `已从自动化步骤反推 ${parsed.length} 步` : "该用例还没有配置自动化步骤"
      };
    }

    const upBtn = target.closest("[data-tcm-step-up]");
    if (upBtn) {
      event.preventDefault();
      const index = U.num(upBtn.dataset.tcmStepUp, 0, 0);
      return { handled: true, rows: move(rows, index, index - 1), structural: true, message: "" };
    }

    const downBtn = target.closest("[data-tcm-step-down]");
    if (downBtn) {
      event.preventDefault();
      const index = U.num(downBtn.dataset.tcmStepDown, 0, 0);
      return { handled: true, rows: move(rows, index, index + 1), structural: true, message: "" };
    }

    const insertBtn = target.closest("[data-tcm-step-insert]");
    if (insertBtn) {
      event.preventDefault();
      const index = U.num(insertBtn.dataset.tcmStepInsert, -1, -1);
      return { handled: true, rows: addRow(rows, index), structural: true, message: "" };
    }

    const removeBtn = target.closest("[data-tcm-step-remove]");
    if (removeBtn) {
      event.preventDefault();
      const index = U.num(removeBtn.dataset.tcmStepRemove, -1, -1);
      return { handled: true, rows: removeRow(rows, index), structural: true, message: "" };
    }

    return miss;
  }

  /**
   * 解析一次 input（单元格编辑）。不触发结构性重渲染，避免光标跳动。
   * @param {Event} event 原始事件
   * @param {*} rows 当前步骤数组
   * @returns {{handled:boolean, rows:Array<object>, structural:boolean}} 处理结果
   */
  function handleInput(event, rows) {
    const target = event && event.target;
    if (!target || typeof target.getAttribute !== "function") {
      return { handled: false, rows: normalize(rows), structural: false };
    }
    const field = target.getAttribute(CELL_ATTR);
    if (!field) {
      return { handled: false, rows: normalize(rows), structural: false };
    }
    const index = U.num(target.getAttribute(ROW_ATTR), -1, -1);
    return {
      handled: true,
      rows: updateCell(rows, index, field, target.value),
      structural: false
    };
  }

  /**
   * 解析拖拽事件（dragstart / dragover / drop / dragend 共用入口）。
   * @param {DragEvent} event 原始事件
   * @param {*} rows 当前步骤数组
   * @returns {{handled:boolean, rows:Array<object>, structural:boolean}} 处理结果
   */
  function handleDrag(event, rows) {
    const idle = { handled: false, rows: normalize(rows), structural: false };
    const target = event && event.target;
    if (!target || typeof target.closest !== "function") {
      return idle;
    }
    const rowEl = target.closest(`[${ROW_ATTR}]`);

    if (event.type === "dragstart") {
      if (!rowEl) {
        return idle;
      }
      draggingIndex = U.num(rowEl.getAttribute(ROW_ATTR), -1, -1);
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        try {
          // Firefox 需要写入数据才会触发后续 drag 事件
          event.dataTransfer.setData("text/plain", String(draggingIndex));
        } catch (_error) {
          // 某些浏览器在受限上下文会抛错，忽略即可
        }
      }
      if (rowEl.classList) {
        rowEl.classList.add("is-dragging");
      }
      return { handled: true, rows: normalize(rows), structural: false };
    }

    if (event.type === "dragover") {
      if (draggingIndex < 0 || !rowEl) {
        return idle;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
      return { handled: true, rows: normalize(rows), structural: false };
    }

    if (event.type === "drop") {
      if (draggingIndex < 0 || !rowEl) {
        draggingIndex = -1;
        return idle;
      }
      event.preventDefault();
      const to = U.num(rowEl.getAttribute(ROW_ATTR), -1, -1);
      const from = draggingIndex;
      draggingIndex = -1;
      if (from === to || to < 0) {
        return { handled: true, rows: normalize(rows), structural: true };
      }
      return { handled: true, rows: move(rows, from, to), structural: true };
    }

    if (event.type === "dragend") {
      draggingIndex = -1;
      if (rowEl && rowEl.classList) {
        rowEl.classList.remove("is-dragging");
      }
      return { handled: true, rows: normalize(rows), structural: false };
    }

    return idle;
  }

  /**
   * 判断一个事件是否发生在步骤编辑区内（宿主用来快速短路）。
   * @param {Event} event 原始事件
   * @returns {boolean} 命中返回 true
   */
  function owns(event) {
    const target = event && event.target;
    if (!target || typeof target.closest !== "function") {
      return false;
    }
    return Boolean(target.closest(`[${ROOT_ATTR}]`));
  }

  /**
   * 把结构化步骤同步回用例草稿的纯文本字段（向下兼容的核心）。
   * 规则：
   *   - 有结构化步骤时，`steps` 永远由 stepRows 生成（单一数据源）；
   *   - `expected` 仅当结构化步骤里填了「本步预期」时才覆盖，否则保留人工填写的整体预期；
   *   - 结构化步骤被清空时，不动纯文本，避免误删存量内容。
   *
   * @param {object} draft 用例草稿（会被就地修改）
   * @param {*} rows 结构化步骤
   * @returns {object} 同一个 draft 引用，便于链式调用
   */
  function syncToDraft(draft, rows) {
    if (!draft || typeof draft !== "object") {
      return draft;
    }
    const list = normalize(rows);
    draft.stepRows = list;
    if (!list.length) {
      return draft;
    }
    draft.steps = toPlainText(list);
    const expectedText = toExpectedText(list);
    if (expectedText) {
      draft.expected = expectedText;
    }
    return draft;
  }

  TCM.steps = {
    render,
    normalize,
    // 双向映射
    fromAutomationSteps,
    fromPlainText,
    toPlainText,
    toExpectedText,
    // 编辑操作
    addRow,
    removeRow,
    updateCell,
    move,
    // 宿主交互入口
    handleClick,
    handleInput,
    handleDrag,
    owns,
    syncToDraft,
    // 常量
    ROOT_ATTR,
    ROW_ATTR,
    CELL_ATTR,
    EDITABLE_FIELDS
  };
})(typeof window !== "undefined" ? window : globalThis);
