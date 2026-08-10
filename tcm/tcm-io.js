/**
 * tcm/tcm-io.js —— 用例导入导出（T05 · P1）
 *
 * 职责：
 *   1. **导出**：CSV（UTF-8 BOM，纯前端，默认方式）/ xlsx（走服务端 openpyxl，
 *      缺失依赖自动降级为 CSV 并提示）/ OPML（可被 XMind 导入）/ Markdown 大纲；
 *      导出范围支持「选中 / 当前目录 / 当前筛选 / 全部」四档；
 *   2. **导入**：CSV 纯前端解析；xlsx 走 `POST /api/case-import-xlsx`；
 *      导入向导三步走 —— 字段映射预览 → 逐行校验 + 冲突处理 → 汇总确认；
 *   3. 逐行校验（必填 / 枚举 / 目录路径）不通过的行被拦截并逐条给出原因；
 *   4. 冲突按 `business+product+module+title` 判重，逐条可选「新增 / 覆盖 / 跳过」，
 *      并支持「全部应用」批量改动作；
 *   5. 确认后统一回写 `TCM.store.commit('basicCaseLibrary', ...)`，**禁止**直接 push。
 *
 * 约束：
 *   - IIFE + "use strict"，只挂载 window.TCM.io；
 *   - 对外暴露 { mount, render, destroy, openExport, openImport, close }，render() 幂等；
 *   - 事件委托到对话框根节点，mount() 只绑一次；
 *   - 所有用户输入 / 文件内容渲染前必须 TCM.util.escapeHtml()；
 *   - 纯逻辑（解析 / 校验 / 计划 / 生成文本）全部在 TCM.model，本模块只做编排与渲染。
 *
 * 依赖：tcm-core.js → tcm-store.js → tcm-model.js
 */
(function (global) {
  "use strict";

  const TCM = global.TCM;
  if (!TCM || !TCM.const || !TCM.util || !TCM.store || !TCM.model) {
    if (global.console && typeof global.console.error === "function") {
      global.console.error("[TCM.io] 依赖缺失：请确认 tcm-core.js / tcm-store.js / tcm-model.js 已先加载。");
    }
    return;
  }

  const C = TCM.const;
  const U = TCM.util;
  const S = TCM.store;
  const M = TCM.model;
  const esc = U.escapeHtml;
  const doc = global.document || null;

  /** 对话框根容器 id（缺失时自动兜底创建） */
  const ROOT_ID = "tcmIoRoot";
  /** 导入文件大小上限（服务端 readJsonBody 限 5MB，base64 会膨胀 ~4/3，这里留足余量） */
  const MAX_IMPORT_BYTES = 3 * 1024 * 1024;

  /**
   * 导出范围定义。
   * @type {ReadonlyArray<{key:string,label:string,hint:string}>}
   */
  const EXPORT_SCOPES = Object.freeze([
    Object.freeze({ key: "selected", label: "选中用例", hint: "仅导出用例库中已勾选的行" }),
    Object.freeze({ key: "directory", label: "当前目录", hint: "导出当前目录树节点下的全部用例" }),
    Object.freeze({ key: "filtered", label: "当前筛选", hint: "导出应用搜索与筛选条件后的结果" }),
    Object.freeze({ key: "all", label: "全部用例", hint: "导出整个基础用例库" })
  ]);

  /**
   * 导出格式定义。
   * @type {ReadonlyArray<{key:string,label:string,ext:string,hint:string}>}
   */
  const EXPORT_FORMATS = Object.freeze([
    Object.freeze({ key: "csv", label: "CSV", ext: "csv", hint: "UTF-8 BOM，Excel / WPS 直接打开不乱码（默认）" }),
    Object.freeze({ key: "xlsx", label: "Excel（xlsx）", ext: "xlsx", hint: "带表头样式与冻结首行；依赖缺失时自动降级 CSV" }),
    Object.freeze({ key: "opml", label: "OPML 脑图", ext: "opml", hint: "可被 XMind / MindNode 直接导入" }),
    Object.freeze({ key: "markdown", label: "Markdown 大纲", ext: "md", hint: "适合贴进飞书 / 语雀文档评审" })
  ]);

  /* ------------------------------------------------------------------ *
   * 模块状态
   * ------------------------------------------------------------------ */

  let rootEl = null;
  let mounted = false;
  /** 当前打开的对话框："" | "export" | "import" */
  let mode = "";

  /** 导出态 */
  const exportState = {
    scope: "filtered",
    format: "csv",
    withExtra: false,
    busy: false,
    error: "",
    /** 由宿主（用例库视图）传入的候选用例 provider */
    context: null
  };

  /** 导入态 */
  const importState = {
    /** step: "pick" | "mapping" | "review" */
    step: "pick",
    fileName: "",
    headers: [],
    rawRows: [],
    mapping: {},
    plan: null,
    defaultAction: "overwrite",
    busy: false,
    error: "",
    notice: "",
    /** 当前目录上下文：文件里缺失业务线/产品/模块时用它兜底 */
    defaults: { business: "", product: "", module: "", category: "" }
  };

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
      global.console.info(`[TCM.io] ${message}`);
    }
  }

  /**
   * 按范围取待导出用例。
   * 宿主（tcm-library）在 openExport 时传入 context：
   *   { selected: [...], directory: [...], filtered: [...], directoryLabel: "..." }
   * 缺省项自动回退到全部用例。
   *
   * @param {string} scope 范围 key
   * @returns {Array<object>} 用例数组
   */
  function casesForScope(scope) {
    const all = assets();
    const ctx = exportState.context && typeof exportState.context === "object" ? exportState.context : {};
    if (scope === "selected") {
      return U.toArray(ctx.selected);
    }
    if (scope === "directory") {
      return Array.isArray(ctx.directory) ? ctx.directory : all;
    }
    if (scope === "filtered") {
      return Array.isArray(ctx.filtered) ? ctx.filtered : all;
    }
    return all;
  }

  /**
   * 生成导出文件基础名。
   * @param {string} scope 范围 key
   * @returns {string} 文件名（不含扩展名）
   */
  function exportBaseName(scope) {
    const ctx = exportState.context && typeof exportState.context === "object" ? exportState.context : {};
    const stamp = U.today();
    if (scope === "directory" && U.str(ctx.directoryLabel)) {
      return `测试用例-${U.str(ctx.directoryLabel)}-${stamp}`;
    }
    const scopeDef = EXPORT_SCOPES.find((item) => item.key === scope);
    return `测试用例-${scopeDef ? scopeDef.label : "全部"}-${stamp}`;
  }

  /* ------------------------------------------------------------------ *
   * 下载工具
   * ------------------------------------------------------------------ */

  /**
   * 触发浏览器下载一个 Blob。
   * @param {Blob} blob 文件内容
   * @param {string} fileName 文件名（含扩展名）
   * @returns {void}
   */
  function downloadBlob(blob, fileName) {
    if (!doc || !global.URL || typeof global.URL.createObjectURL !== "function") {
      toast("当前浏览器不支持文件下载", "error");
      return;
    }
    const url = global.URL.createObjectURL(blob);
    const link = doc.createElement("a");
    link.href = url;
    link.download = fileName;
    link.style.display = "none";
    if (doc.body) {
      doc.body.appendChild(link);
    }
    link.click();
    if (doc.body && link.parentNode === doc.body) {
      doc.body.removeChild(link);
    }
    global.setTimeout(() => {
      try {
        global.URL.revokeObjectURL(url);
      } catch (_error) {
        // ignore
      }
    }, 1000);
  }

  /**
   * 下载文本文件（统一补 UTF-8 BOM，保证 Excel 打开中文不乱码）。
   * @param {string} text 文本内容
   * @param {string} fileName 文件名
   * @param {string} mimeType MIME
   * @param {boolean} [withBom] 是否加 BOM
   * @returns {void}
   */
  function downloadText(text, fileName, mimeType, withBom) {
    const parts = withBom ? ["\uFEFF", String(text)] : [String(text)];
    downloadBlob(new global.Blob(parts, { type: `${mimeType};charset=utf-8` }), fileName);
  }

  /* ------------------------------------------------------------------ *
   * 导出执行
   * ------------------------------------------------------------------ */

  /**
   * 纯前端导出 CSV。
   * @param {Array<object>} cases 用例数组
   * @param {string} baseName 文件基础名
   * @returns {void}
   */
  function exportCsv(cases, baseName) {
    const data = M.buildExportRows(cases, { withExtra: exportState.withExtra });
    downloadText(M.toCsvText(data.headers, data.rows), `${baseName}.csv`, "text/csv", true);
    toast(`已导出 ${cases.length} 条用例（CSV）`, "success");
  }

  /**
   * 导出 xlsx：走服务端 openpyxl；依赖缺失（HTTP 503 + degrade=csv）时自动降级 CSV。
   * @param {Array<object>} cases 用例数组
   * @param {string} baseName 文件基础名
   * @returns {Promise<void>} 完成 Promise
   */
  async function exportXlsx(cases, baseName) {
    const data = M.buildExportRows(cases, { withExtra: exportState.withExtra });
    let response = null;
    try {
      response = await global.fetch("/api/case-export-xlsx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          columns: data.columns,
          rows: data.rows,
          fileBaseName: baseName,
          sheetName: "测试用例"
        })
      });
    } catch (error) {
      exportCsv(cases, baseName);
      toast(`xlsx 服务不可用（${U.str(error && error.message)}），已自动降级为 CSV`, "warning");
      return;
    }

    if (response.ok) {
      const blob = await response.blob();
      downloadBlob(blob, `${baseName}.xlsx`);
      toast(`已导出 ${cases.length} 条用例（xlsx）`, "success");
      return;
    }

    const detail = await response.json().catch(() => ({}));
    if (response.status === 503 || U.str(detail && detail.degrade) === "csv") {
      exportCsv(cases, baseName);
      toast(U.str(detail && detail.error) || "xlsx 能力不可用，已自动降级为 CSV", "warning");
      return;
    }
    throw new Error(U.str(detail && detail.error) || `xlsx 导出失败（HTTP ${response.status}）`);
  }

  /**
   * 执行导出。
   * @returns {Promise<void>} 完成 Promise
   */
  async function runExport() {
    const cases = casesForScope(exportState.scope);
    if (!cases.length) {
      exportState.error = "当前范围下没有可导出的用例，请换一个范围。";
      render();
      return;
    }

    exportState.busy = true;
    exportState.error = "";
    render();

    const baseName = exportBaseName(exportState.scope);
    try {
      if (exportState.format === "csv") {
        exportCsv(cases, baseName);
      } else if (exportState.format === "xlsx") {
        await exportXlsx(cases, baseName);
      } else if (exportState.format === "opml") {
        const opml = M.buildOpml(cases, { title: baseName, now: U.nowIso() });
        downloadText(opml, `${baseName}.opml`, "text/x-opml", false);
        toast(`已导出 ${cases.length} 条用例（OPML，可用 XMind 打开）`, "success");
      } else {
        const markdown = M.buildMarkdownOutline(cases, { title: baseName });
        downloadText(markdown, `${baseName}.md`, "text/markdown", true);
        toast(`已导出 ${cases.length} 条用例（Markdown 大纲）`, "success");
      }
      exportState.busy = false;
      close();
      return;
    } catch (error) {
      exportState.error = U.str(error && error.message) || "导出失败";
    }
    exportState.busy = false;
    render();
  }

  /* ------------------------------------------------------------------ *
   * 导入执行
   * ------------------------------------------------------------------ */

  /**
   * 读取文件为文本。
   * @param {File} file 文件
   * @returns {Promise<string>} 文本内容
   */
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new global.FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("文件读取失败"));
      reader.readAsText(file, "UTF-8");
    });
  }

  /**
   * 读取文件为 base64（不含 data: 前缀）。
   * @param {File} file 文件
   * @returns {Promise<string>} base64
   */
  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new global.FileReader();
      reader.onload = () => {
        const text = String(reader.result || "");
        const comma = text.indexOf(",");
        resolve(comma >= 0 ? text.slice(comma + 1) : text);
      };
      reader.onerror = () => reject(new Error("文件读取失败"));
      reader.readAsDataURL(file);
    });
  }

  /**
   * 处理用户选择的文件：解析成 { headers, rows } 并进入字段映射步骤。
   * @param {File} file 文件
   * @returns {Promise<void>} 完成 Promise
   */
  async function loadImportFile(file) {
    if (!file) {
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      importState.error = `文件超过 ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)}MB 上限，请拆分后再导入。`;
      render();
      return;
    }

    importState.busy = true;
    importState.error = "";
    importState.notice = "";
    importState.fileName = U.str(file.name);
    render();

    const lower = importState.fileName.toLowerCase();
    try {
      if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
        const text = await readFileAsText(file);
        const parsed = M.parseCsvText(text);
        importState.headers = parsed.headers;
        importState.rawRows = parsed.rows;
      } else if (lower.endsWith(".xlsx") || lower.endsWith(".xlsm")) {
        const contentBase64 = await readFileAsBase64(file);
        const response = await global.fetch("/api/case-import-xlsx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: importState.fileName, contentBase64 })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status === 503 || U.str(data && data.degrade) === "csv") {
            throw new Error(`${U.str(data && data.error) || "xlsx 解析能力不可用"}，请另存为 CSV 后再导入。`);
          }
          throw new Error(U.str(data && data.error) || `xlsx 解析失败（HTTP ${response.status}）`);
        }
        importState.headers = U.toArray(data.headers).map((item) => U.str(item));
        importState.rawRows = U.toArray(data.rows);
        if (data.truncated) {
          importState.notice = `文件行数过多，仅解析前 ${importState.rawRows.length} 行。`;
        }
      } else {
        throw new Error("仅支持 .csv 与 .xlsx 文件");
      }

      if (!importState.rawRows.length) {
        throw new Error("文件里没有解析到数据行（首行需为表头）");
      }

      importState.mapping = M.guessImportMapping(importState.headers);
      importState.step = "mapping";
    } catch (error) {
      importState.error = U.str(error && error.message) || "文件解析失败";
      importState.headers = [];
      importState.rawRows = [];
    }
    importState.busy = false;
    render();
  }

  /**
   * 依据当前映射生成导入计划，进入复核步骤。
   * @returns {void}
   */
  function buildPlan() {
    const mappedFields = Object.keys(importState.mapping)
      .map((header) => U.str(importState.mapping[header]))
      .filter(Boolean);
    if (!mappedFields.includes("title")) {
      importState.error = "必须把某一列映射到「标题」字段。";
      render();
      return;
    }

    importState.error = "";
    // 文件里没映射业务线 / 产品 / 模块时，用打开导入时所在目录兜底，避免整批因缺业务线报错
    const fallback = importState.defaults || {};
    const rows = importState.rawRows.map((raw) => {
      const row = Object.assign({}, raw);
      ["business", "product", "module", "category"].forEach((field) => {
        if (mappedFields.includes(field)) {
          return;
        }
        const value = U.str(fallback[field]);
        if (value && !U.str(row[field])) {
          row[field] = value;
        }
      });
      return row;
    });

    importState.plan = M.buildImportPlan(rows, assets(), {
      mapping: importState.mapping,
      defaultAction: importState.defaultAction,
      operator: operator(),
      now: U.nowIso(),
      todayDate: U.today(),
      headers: importState.headers
    });
    importState.step = "review";
    render();
  }

  /**
   * 提交导入：应用计划并回写 store。
   * @returns {void}
   */
  function commitImport() {
    if (!importState.plan) {
      return;
    }
    const summary = M.summarizeImportPlan(importState.plan.items);
    if (!summary.create && !summary.overwrite) {
      toast("没有需要写入的行（全部为跳过或错误）", "warning");
      return;
    }

    const now = U.nowIso();
    const who = operator();
    const result = M.applyImportPlan(assets(), importState.plan.items, {
      operator: who,
      now,
      todayDate: U.today()
    });

    const ok = S.commit("basicCaseLibrary", result.next, { source: "library", reason: "importCases" });
    if (!ok) {
      importState.error = "写入被数据层拦截，请检查控制台错误信息。";
      render();
      return;
    }

    TCM.bus.emit(C.EVENTS.DIR_CHANGED, { source: "io", reason: "import" });
    TCM.bus.emit(C.EVENTS.CASE_BATCH_CHANGED, {
      source: "io",
      created: result.created,
      overwritten: result.overwritten
    });

    toast(
      `导入完成：新增 ${result.created} 条、覆盖 ${result.overwritten} 条、跳过 ${result.skipped} 条、失败 ${result.failed} 条`,
      result.failed ? "warning" : "success"
    );
    close();
  }

  /* ------------------------------------------------------------------ *
   * 渲染 —— 导出
   * ------------------------------------------------------------------ */

  /**
   * 导出对话框主体。
   * @returns {string} HTML
   */
  function exportBodyHtml() {
    const counts = {};
    EXPORT_SCOPES.forEach((scopeDef) => {
      counts[scopeDef.key] = casesForScope(scopeDef.key).length;
    });
    const current = counts[exportState.scope] || 0;

    return `
      ${exportState.error ? `<div class="tcm-form-error" role="alert">${esc(exportState.error)}</div>` : ""}

      <div class="tcm-io-export-summary">
        <div>
          <span class="tcm-io-kicker">批量导出</span>
          <strong>选择范围和文件格式</strong>
        </div>
        <div class="tcm-io-export-count"><strong>${current}</strong><span>条用例</span></div>
      </div>

      <section class="tcm-io-section">
        <h4 class="tcm-io-section-title">导出范围</h4>
        <div class="tcm-io-select-wrap">
          <select class="tcm-io-select" data-tcm-io-scope aria-label="选择导出范围">
            ${EXPORT_SCOPES.map((scopeDef) => `<option value="${esc(scopeDef.key)}"${exportState.scope === scopeDef.key ? " selected" : ""}>${esc(scopeDef.label)}（${counts[scopeDef.key]} 条）</option>`).join("")}
          </select>
          <p class="tcm-io-select-hint">${esc((EXPORT_SCOPES.find((item) => item.key === exportState.scope) || EXPORT_SCOPES[0]).hint)}</p>
        </div>
      </section>

      <section class="tcm-io-section">
        <h4 class="tcm-io-section-title">导出格式</h4>
        <div class="tcm-io-select-wrap">
          <select class="tcm-io-select" data-tcm-io-format aria-label="选择导出格式">
            ${EXPORT_FORMATS.map((formatDef) => `<option value="${esc(formatDef.key)}"${exportState.format === formatDef.key ? " selected" : ""}>${esc(formatDef.label)}</option>`).join("")}
          </select>
          <p class="tcm-io-select-hint">${esc((EXPORT_FORMATS.find((item) => item.key === exportState.format) || EXPORT_FORMATS[0]).hint)}</p>
        </div>
      </section>

      <section class="tcm-io-section">
        <label class="tcm-checkbox">
          <input type="checkbox" data-tcm-io-extra ${exportState.withExtra ? "checked" : ""}>
          <span>包含扩展列（用例ID / 测试目标 / 测试数据 / 基线）</span>
        </label>
        <p class="tcm-io-hint">勾选后导出的文件可以原样再导入，实现「导出 → 批量改 → 导入覆盖」的往返编辑。</p>
      </section>

      <div class="tcm-io-file-summary">
        <span>文件名</span>
        <code>${esc(exportBaseName(exportState.scope))}</code>
      </div>
    `;
  }

  /* ------------------------------------------------------------------ *
   * 渲染 —— 导入
   * ------------------------------------------------------------------ */

  /**
   * 第一步：选文件。
   * @returns {string} HTML
   */
  function importPickHtml() {
    return `
      <div class="tcm-io-dropzone">
        <p class="tcm-io-dropzone-title">选择 CSV 或 Excel 文件</p>
        <p class="tcm-io-hint">CSV 请使用 UTF-8 编码；xlsx 由服务端解析，依赖缺失时会提示改用 CSV。</p>
        <input type="file" accept=".csv,.xlsx,.xlsm,.txt" data-tcm-io-file class="tcm-io-file">
      </div>
      <div class="tcm-io-tpl">
        <span>不确定表头格式？</span>
        <button type="button" class="tcm-btn tcm-btn-ghost tcm-btn-sm" data-tcm-io-template>下载导入模板</button>
      </div>
    `;
  }

  /**
   * 第二步：字段映射预览。
   * @returns {string} HTML
   */
  function importMappingHtml() {
    const sample = importState.rawRows[0] || {};
    const options = U.toArray(M.IMPORT_TARGET_FIELDS);

    return `
      <p class="tcm-io-summary">已解析 <strong>${importState.rawRows.length}</strong> 行 ·
        文件 <code>${esc(importState.fileName)}</code></p>
      ${importState.notice ? `<div class="tcm-io-notice">${esc(importState.notice)}</div>` : ""}
      <table class="tcm-io-map-table">
        <thead>
          <tr>
            <th scope="col">文件列</th>
            <th scope="col">首行示例</th>
            <th scope="col">映射到字段</th>
          </tr>
        </thead>
        <tbody>
          ${importState.headers.map((header) => {
            const currentField = U.str(importState.mapping[header]);
            const sampleText = U.str(sample[header]);
            return `
              <tr>
                <th scope="row" class="tcm-io-map-header">${esc(header)}</th>
                <td class="tcm-io-map-sample" title="${esc(sampleText)}">${esc(sampleText.slice(0, 40))}${sampleText.length > 40 ? "…" : ""}</td>
                <td class="tcm-io-map-select">
                  <select data-tcm-io-map="${esc(header)}">
                    <option value=""${currentField ? "" : " selected"}>（忽略此列）</option>
                    ${options.map((field) => `
                      <option value="${esc(field.key)}"${currentField === field.key ? " selected" : ""}>
                        ${esc(field.label)}
                      </option>
                    `).join("")}
                  </select>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
      <div class="tcm-io-section">
        <label class="tcm-field-label" for="tcmIoDefaultAction">重名用例的默认处理</label>
        <select id="tcmIoDefaultAction" data-tcm-io-default-action>
          <option value="overwrite"${importState.defaultAction === "overwrite" ? " selected" : ""}>覆盖已有用例（版本 +1）</option>
          <option value="skip"${importState.defaultAction === "skip" ? " selected" : ""}>跳过，不动已有用例</option>
          <option value="create"${importState.defaultAction === "create" ? " selected" : ""}>都当作新增（会产生重复）</option>
        </select>
        <p class="tcm-io-hint">判重依据：业务线 + 产品 + 模块 + 标题。下一步可逐条调整。</p>
      </div>
    `;
  }

  /**
   * 单条计划行。
   * @param {object} item 计划条目
   * @returns {string} HTML
   */
  function planRowHtml(item) {
    const title = U.str(item.asset && item.asset.title) || U.str(item.raw && item.raw.title) || "（无标题）";

    if (!item.ok) {
      return `
        <tr class="tcm-io-plan-row is-error">
          <td class="tcm-io-plan-no">${item.rowNo}</td>
          <td class="tcm-io-plan-title">${esc(title)}</td>
          <td class="tcm-io-plan-state"><span class="tcm-tag tcm-tag-danger">校验失败</span></td>
          <td class="tcm-io-plan-detail">
            <ul class="tcm-io-reasons">
              ${item.errors.map((reason) => `<li>${esc(reason)}</li>`).join("")}
            </ul>
          </td>
        </tr>
      `;
    }

    const stateTag = item.conflict
      ? '<span class="tcm-tag tcm-tag-warning">重名</span>'
      : '<span class="tcm-tag tcm-tag-success">新用例</span>';

    const actionSelect = item.conflict
      ? `
        <select data-tcm-io-action="${item.index}">
          <option value="overwrite"${item.action === "overwrite" ? " selected" : ""}>覆盖</option>
          <option value="skip"${item.action === "skip" ? " selected" : ""}>跳过</option>
          <option value="create"${item.action === "create" ? " selected" : ""}>另存为新用例</option>
        </select>
      `
      : '<span class="tcm-muted">新增</span>';

    const warnings = item.warnings.length
      ? `<ul class="tcm-io-reasons tcm-io-reasons-warn">${item.warnings.map((text) => `<li>${esc(text)}</li>`).join("")}</ul>`
      : "";

    return `
      <tr class="tcm-io-plan-row${item.action === "skip" ? " is-skipped" : ""}">
        <td class="tcm-io-plan-no">${item.rowNo}</td>
        <td class="tcm-io-plan-title">${esc(title)}</td>
        <td class="tcm-io-plan-state">${stateTag}</td>
        <td class="tcm-io-plan-detail">${actionSelect}${warnings}</td>
      </tr>
    `;
  }

  /**
   * 第三步：逐行复核与汇总。
   * @returns {string} HTML
   */
  function importReviewHtml() {
    const plan = importState.plan;
    if (!plan) {
      return '<p class="tcm-muted">没有可复核的数据。</p>';
    }
    const summary = M.summarizeImportPlan(plan.items);
    const hasConflict = plan.items.some((item) => item.ok && item.conflict);

    return `
      <div class="tcm-io-summary-bar">
        <span class="tcm-io-stat"><strong>${summary.create}</strong> 新增</span>
        <span class="tcm-io-stat"><strong>${summary.overwrite}</strong> 覆盖</span>
        <span class="tcm-io-stat"><strong>${summary.skip}</strong> 跳过</span>
        <span class="tcm-io-stat${summary.error ? " is-error" : ""}"><strong>${summary.error}</strong> 错误</span>
      </div>
      ${summary.error
        ? `<div class="tcm-io-notice tcm-io-notice-warn">
            有 ${summary.error} 行未通过校验，将被自动跳过；下方列出了每一行的具体原因。
          </div>`
        : ""}
      ${hasConflict
        ? `<div class="tcm-io-bulk">
            <span>重名用例批量处理：</span>
            <button type="button" class="tcm-btn tcm-btn-ghost tcm-btn-sm" data-tcm-io-bulk="overwrite">全部覆盖</button>
            <button type="button" class="tcm-btn tcm-btn-ghost tcm-btn-sm" data-tcm-io-bulk="skip">全部跳过</button>
            <button type="button" class="tcm-btn tcm-btn-ghost tcm-btn-sm" data-tcm-io-bulk="create">全部另存为新用例</button>
          </div>`
        : ""}
      <div class="tcm-io-plan-wrap">
        <table class="tcm-io-plan-table">
          <thead>
            <tr>
              <th scope="col">行</th>
              <th scope="col">标题</th>
              <th scope="col">状态</th>
              <th scope="col">处理方式 / 原因</th>
            </tr>
          </thead>
          <tbody>${plan.items.map(planRowHtml).join("")}</tbody>
        </table>
      </div>
    `;
  }

  /**
   * 导入对话框主体。
   * @returns {string} HTML
   */
  function importBodyHtml() {
    const stepBar = `
      <ol class="tcm-io-steps">
        <li class="${importState.step === "pick" ? "is-active" : "is-done"}">1 选择文件</li>
        <li class="${importState.step === "mapping" ? "is-active" : (importState.step === "review" ? "is-done" : "")}">2 字段映射</li>
        <li class="${importState.step === "review" ? "is-active" : ""}">3 复核导入</li>
      </ol>
    `;

    if (importState.busy) {
      return `
        ${stepBar}
        <div class="tcm-ai-loading" role="status" aria-live="polite">
          <span class="tcm-spinner" aria-hidden="true"></span>
          <p>正在解析文件……</p>
        </div>
      `;
    }

    let body = "";
    if (importState.step === "mapping") {
      body = importMappingHtml();
    } else if (importState.step === "review") {
      body = importReviewHtml();
    } else {
      body = importPickHtml();
    }

    return `
      ${stepBar}
      ${importState.error ? `<div class="tcm-form-error" role="alert">${esc(importState.error)}</div>` : ""}
      ${body}
    `;
  }

  /* ------------------------------------------------------------------ *
   * 渲染 —— 外壳
   * ------------------------------------------------------------------ */

  /**
   * 对话框底部按钮。
   * @returns {string} HTML
   */
  function footHtml() {
    if (mode === "export") {
      return `
        <div class="tcm-drawer-actions">
          <button type="button" class="tcm-btn tcm-btn-ghost" data-tcm-io-close>取消</button>
          <button type="button" class="tcm-btn tcm-btn-primary" data-tcm-io-export
            ${exportState.busy ? "disabled" : ""}>${exportState.busy ? "导出中…" : "开始导出"}</button>
        </div>
      `;
    }

    if (importState.step === "mapping") {
      return `
        <div class="tcm-drawer-actions">
          <button type="button" class="tcm-btn tcm-btn-ghost" data-tcm-io-back>上一步</button>
          <button type="button" class="tcm-btn tcm-btn-primary" data-tcm-io-plan>下一步：校验与冲突处理</button>
        </div>
      `;
    }

    if (importState.step === "review") {
      const summary = importState.plan ? M.summarizeImportPlan(importState.plan.items) : { create: 0, overwrite: 0 };
      const writable = summary.create + summary.overwrite;
      return `
        <div class="tcm-drawer-actions">
          <button type="button" class="tcm-btn tcm-btn-ghost" data-tcm-io-back>上一步</button>
          <button type="button" class="tcm-btn tcm-btn-primary" data-tcm-io-commit ${writable ? "" : "disabled"}>
            确认导入（写入 ${writable} 条）
          </button>
        </div>
      `;
    }

    return `
      <div class="tcm-drawer-actions">
        <button type="button" class="tcm-btn tcm-btn-ghost" data-tcm-io-close>取消</button>
      </div>
    `;
  }

  /**
   * 创建对话框骨架。
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
   * 渲染对话框（幂等）。
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
    if (!mode) {
      rootEl.innerHTML = "";
      rootEl.hidden = true;
      return;
    }

    const title = mode === "export" ? "批量导出测试用例" : "批量导入测试用例";
    rootEl.hidden = false;
    rootEl.innerHTML = `
      <div class="tcm-modal-mask" data-tcm-io-close></div>
      <div class="tcm-modal ${mode === "export" ? "tcm-modal-export" : "tcm-modal-lg"}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <header class="tcm-modal-head">
          <h3 class="tcm-modal-title">${esc(title)}</h3>
          <button type="button" class="tcm-icon-btn" data-tcm-io-close aria-label="关闭">×</button>
        </header>
        <div class="tcm-modal-body">${mode === "export" ? exportBodyHtml() : importBodyHtml()}</div>
        <footer class="tcm-modal-foot">${footHtml()}</footer>
      </div>
    `;
  }

  /* ------------------------------------------------------------------ *
   * 事件
   * ------------------------------------------------------------------ */

  /**
   * 下载导入模板（表头 + 一行示例）。
   * @returns {void}
   */
  function downloadTemplate() {
    const data = M.buildExportRows([{
      business: C.BUSINESS[0],
      product: "收银台",
      module: "下单",
      category: "正常流",
      title: "示例：本地收款-支付宝-正常下单成功",
      type: C.CASE_TYPE[0],
      priority: "P0",
      status: C.CASE_STATUS[0],
      preconditions: "商户已开通支付宝渠道",
      steps: "1. 进入收银台\n2. 选择支付宝\n3. 提交订单",
      expected: "订单创建成功并跳转支付宝收银台",
      component: "支付网关",
      tags: ["冒烟", "核心链路"]
    }], { withExtra: false });
    downloadText(M.toCsvText(data.headers, data.rows), "测试用例导入模板.csv", "text/csv", true);
    toast("导入模板已下载", "success");
  }

  /**
   * 对话框点击。
   * @param {Event} event 事件对象
   * @returns {void}
   */
  function onClick(event) {
    const target = event.target;
    if (!target || typeof target.closest !== "function") {
      return;
    }

    if (target.closest("[data-tcm-io-close]")) {
      event.preventDefault();
      close();
      return;
    }

    if (target.closest("[data-tcm-io-export]")) {
      event.preventDefault();
      void runExport();
      return;
    }

    if (target.closest("[data-tcm-io-template]")) {
      event.preventDefault();
      downloadTemplate();
      return;
    }

    if (target.closest("[data-tcm-io-plan]")) {
      event.preventDefault();
      buildPlan();
      return;
    }

    if (target.closest("[data-tcm-io-commit]")) {
      event.preventDefault();
      commitImport();
      return;
    }

    if (target.closest("[data-tcm-io-back]")) {
      event.preventDefault();
      if (importState.step === "review") {
        importState.step = "mapping";
      } else {
        importState.step = "pick";
        importState.headers = [];
        importState.rawRows = [];
        importState.plan = null;
      }
      importState.error = "";
      render();
      return;
    }

    const bulkBtn = target.closest("[data-tcm-io-bulk]");
    if (bulkBtn) {
      event.preventDefault();
      const action = U.str(bulkBtn.dataset.tcmIoBulk);
      if (!importState.plan) {
        return;
      }
      importState.plan.items = importState.plan.items.map((item) => (
        item.ok && item.conflict ? Object.assign({}, item, { action }) : item
      ));
      importState.plan.summary = M.summarizeImportPlan(importState.plan.items);
      render();
    }
  }

  /**
   * 对话框 change：单选 / 复选 / 下拉 / 文件。
   * @param {Event} event 事件对象
   * @returns {void}
   */
  function onChange(event) {
    const target = event.target;
    if (!target || typeof target.matches !== "function") {
      return;
    }

    if (target.matches("[data-tcm-io-scope]")) {
      exportState.scope = U.str(target.value) || "all";
      exportState.error = "";
      render();
      return;
    }

    if (target.matches("[data-tcm-io-format]")) {
      exportState.format = U.str(target.value) || "csv";
      render();
      return;
    }

    if (target.matches("[data-tcm-io-extra]")) {
      exportState.withExtra = Boolean(target.checked);
      render();
      return;
    }

    if (target.matches("[data-tcm-io-file]")) {
      const file = target.files && target.files[0];
      void loadImportFile(file);
      return;
    }

    if (target.matches("[data-tcm-io-default-action]")) {
      importState.defaultAction = U.str(target.value) || "overwrite";
      return;
    }

    if (target.matches("[data-tcm-io-map]")) {
      const header = U.str(target.getAttribute("data-tcm-io-map"));
      importState.mapping = Object.assign({}, importState.mapping);
      importState.mapping[header] = U.str(target.value);
      return;
    }

    if (target.matches("[data-tcm-io-action]")) {
      const index = U.num(target.getAttribute("data-tcm-io-action"), -1, -1);
      if (!importState.plan || index < 0) {
        return;
      }
      importState.plan.items = importState.plan.items.map((item) => (
        item.index === index ? Object.assign({}, item, { action: U.str(target.value) }) : item
      ));
      importState.plan.summary = M.summarizeImportPlan(importState.plan.items);
      render();
    }
  }

  /**
   * ESC 关闭。
   * @param {KeyboardEvent} event 事件对象
   * @returns {void}
   */
  function onKeydown(event) {
    if (!mode) {
      return;
    }
    if (event.key === "Escape" || event.key === "Esc") {
      event.preventDefault();
      close();
    }
  }

  /* ------------------------------------------------------------------ *
   * 对外 API
   * ------------------------------------------------------------------ */

  /**
   * 打开导出对话框。
   * @param {{selected?:Array<object>, directory?:Array<object>, filtered?:Array<object>,
   *          directoryLabel?:string, scope?:string}} [context] 宿主传入的候选集合
   * @returns {void}
   */
  function openExport(context) {
    if (!doc) {
      return;
    }
    if (!mounted) {
      mount(doc.getElementById(ROOT_ID));
    }
    exportState.context = context && typeof context === "object" ? context : null;
    exportState.error = "";
    exportState.busy = false;
    // 有选中就默认导选中，否则默认导当前筛选
    const selectedCount = U.toArray(exportState.context && exportState.context.selected).length;
    exportState.scope = U.str(context && context.scope) || (selectedCount ? "selected" : "filtered");
    mode = "export";
    if (doc.body && doc.body.classList) {
      doc.body.classList.add("tcm-drawer-open");
    }
    render();
  }

  /**
   * 打开导入对话框。
   * @param {{path?:{business?:string,product?:string,module?:string,category?:string}}} [context] 目录上下文
   * @returns {void}
   */
  function openImport(context) {
    if (!doc) {
      return;
    }
    if (!mounted) {
      mount(doc.getElementById(ROOT_ID));
    }
    const path = context && typeof context === "object" && context.path && typeof context.path === "object"
      ? context.path
      : {};
    importState.step = "pick";
    importState.fileName = "";
    importState.headers = [];
    importState.rawRows = [];
    importState.mapping = {};
    importState.plan = null;
    importState.busy = false;
    importState.error = "";
    importState.notice = "";
    importState.defaults = {
      business: U.str(path.business),
      product: U.str(path.product),
      module: U.str(path.module),
      category: U.str(path.category)
    };
    mode = "import";
    if (doc.body && doc.body.classList) {
      doc.body.classList.add("tcm-drawer-open");
    }
    render();
  }

  /**
   * 关闭对话框。
   * @returns {void}
   */
  function close() {
    if (!mode) {
      return;
    }
    mode = "";
    exportState.busy = false;
    exportState.error = "";
    importState.busy = false;
    if (doc && doc.body && doc.body.classList) {
      doc.body.classList.remove("tcm-drawer-open");
    }
    render();
  }

  /**
   * 挂载：创建骨架并绑定事件（只绑一次）。
   * @param {HTMLElement} [root] 对话框根容器
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
   * 卸载：解绑事件。
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
    mode = "";
    mounted = false;
  }

  TCM.io = {
    mount,
    render,
    destroy,
    openExport,
    openImport,
    close,
    isOpen() {
      return Boolean(mode);
    },
    EXPORT_SCOPES,
    EXPORT_FORMATS,
    _internals: {
      casesForScope,
      exportBaseName,
      loadImportFile,
      buildPlan,
      commitImport,
      downloadTemplate,
      getExportState() {
        return Object.assign({}, exportState);
      },
      getImportState() {
        return Object.assign({}, importState);
      }
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
