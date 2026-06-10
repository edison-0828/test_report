const STORAGE_KEY = "test-flow-tool-v2";
const BUSINESS_OPTIONS = [
  "VA业务",
  "卡收单业务",
  "数字货币业务",
  "代付业务",
  "本地收单业务"
];
const BUSINESS_ALIAS_MAP = {
  "VA": "VA业务",
  "VA业务": "VA业务",
  "CARD收单": "卡收单业务",
  "卡收单": "卡收单业务",
  "卡收单业务": "卡收单业务",
  "数字货币": "数字货币业务",
  "数字货币业务": "数字货币业务",
  "代付": "代付业务",
  "代付业务": "代付业务",
  "本地收单": "本地收单业务",
  "本地收单业务": "本地收单业务"
};
const SHARED_STATE_KEYS = ["documents", "cases", "bugs", "batches", "tasks", "reportConclusion", "reportConclusions", "lastGeneration"];
const LOCAL_STATE_KEYS = ["activeBatchId", "generationBatchId", "activeTaskId", "activeModuleId", "activeReportBatchId", "settings", "uiMode"];

const state = loadState();

const els = {
  navLinks: [...document.querySelectorAll(".nav-link")],
  panels: [...document.querySelectorAll(".tab-panel")],
  documentInput: document.getElementById("documentInput"),
  sourceType: document.getElementById("sourceType"),
  sourceUrl: document.getElementById("sourceUrl"),
  sourceUrlWrap: document.getElementById("sourceUrlWrap"),
  sourceText: document.getElementById("sourceText"),
  sourceTextWrap: document.getElementById("sourceTextWrap"),
  focusHint: document.getElementById("focusHint"),
  focusHintWrap: document.getElementById("focusHintWrap"),
  documentName: document.getElementById("documentName"),
  documentType: document.getElementById("documentType"),
  generateCases: document.getElementById("generateCases"),
  generateCasesLocal: document.getElementById("generateCasesLocal"),
  saveDocument: document.getElementById("saveDocument"),
  generationStatus: document.getElementById("generationStatus"),
  onboardingSteps: document.getElementById("onboardingSteps"),
  activeBatchSelect: document.getElementById("activeBatchSelect"),
  activeModuleSelect: document.getElementById("activeModuleSelect"),
  batchVersionInput: document.getElementById("batchVersionInput"),
  versionScopeInput: document.getElementById("versionScopeInput"),
  createBatchBtn: document.getElementById("createBatchBtn"),
  currentVersionSummary: document.getElementById("currentVersionSummary"),
  taskBatchSelect: document.getElementById("taskBatchSelect"),
  taskNameInput: document.getElementById("taskNameInput"),
  taskScopeInput: document.getElementById("taskScopeInput"),
  createTaskBtn: document.getElementById("createTaskBtn"),
  currentTaskSummary: document.getElementById("currentTaskSummary"),
  generationVersionSummary: document.getElementById("generationVersionSummary"),
  versionManagerList: document.getElementById("versionManagerList"),
  taskManagerList: document.getElementById("taskManagerList"),
  versionsPanel: document.getElementById("versions"),
  quickStats: document.getElementById("quickStats"),
  sidebarContext: document.getElementById("sidebarContext"),
  sidebarBackToTop: document.getElementById("sidebarBackToTop"),
  apiKey: document.getElementById("apiKey"),
  saveApiKey: document.getElementById("saveApiKey"),
  checkApiKey: document.getElementById("checkApiKey"),
  clearApiKey: document.getElementById("clearApiKey"),
  modelSelect: document.getElementById("modelSelect"),
  apiStatus: document.getElementById("apiStatus"),
  caseList: document.getElementById("caseList"),
  caseImportInput: document.getElementById("caseImportInput"),
  caseBatchFilter: document.getElementById("caseBatchFilter"),
  caseTaskFilter: document.getElementById("caseTaskFilter"),
  executionBatchFilter: document.getElementById("executionBatchFilter"),
  executionTaskFilter: document.getElementById("executionTaskFilter"),
  executionModuleFilter: document.getElementById("executionModuleFilter"),
  executionBulkPass: document.getElementById("executionBulkPass"),
  executionList: document.getElementById("executionList"),
  bugBatchFilter: document.getElementById("bugBatchFilter"),
  bugTaskFilter: document.getElementById("bugTaskFilter"),
  bugList: document.getElementById("bugList"),
  addBug: document.getElementById("addBug"),
  reportHero: document.getElementById("reportHero"),
  reportHealthCard: document.getElementById("reportHealthCard"),
  reportMetrics: document.getElementById("reportMetrics"),
  reportSummary: document.getElementById("reportSummary"),
  reportExecutionBars: document.getElementById("reportExecutionBars"),
  reportBugStatusBars: document.getElementById("reportBugStatusBars"),
  reportBugSeverityBars: document.getElementById("reportBugSeverityBars"),
  reportHighlights: document.getElementById("reportHighlights"),
  reportConclusion: document.getElementById("reportConclusion"),
  reportVersionCards: document.getElementById("reportVersionCards"),
  reportDetailHeader: document.getElementById("reportDetailHeader"),
  exportReport: document.getElementById("exportReport"),
  checkLark: document.getElementById("checkLark"),
  syncLark: document.getElementById("syncLark"),
  larkStatus: document.getElementById("larkStatus"),
  larkFeedback: document.getElementById("larkFeedback"),
  seedDemo: document.getElementById("seedDemo"),
  caseTemplate: document.getElementById("caseTemplate"),
  executionTemplate: document.getElementById("executionTemplate"),
  bugTemplate: document.getElementById("bugTemplate")
};

const settings = {
  apiKey: "",
  model: state.settings?.model || "gpt-5.4-mini",
  apiReady: false,
  envKeyAvailable: false
};

let uploadedFileContent = "";
let editingBatchId = "";
let editingTaskId = "";
let persistSharedTimer = 0;

els.apiKey.value = "";
els.modelSelect.value = settings.model;
autoResizeTextarea();

ensureSeedMetadata();
hydrateReportChrome();
hydrateWorkflowChrome();
simplifyUploadFlow();
initTextSourceUi();
initOwnerUi();
bindEvents();
renderAll();
loadTeamMembersConfig();
loadSharedState();
checkApiStatus();
renderSourceMode();

function bindEvents() {
  els.navLinks.forEach((link) => {
    link.addEventListener("click", () => switchTab(link.dataset.tab));
  });

  els.documentInput.addEventListener("change", handleFileUpload);
  els.sourceType.addEventListener("change", renderSourceMode);
  els.versionScopeInput?.addEventListener("input", autoResizeTextarea);
  els.taskScopeInput.addEventListener("input", autoResizeTextarea);
  els.sourceText?.addEventListener("input", autoResizeTextarea);
  els.generateCases.addEventListener("click", () => handleGenerateCases("ai"));
  els.generateCasesLocal?.addEventListener("click", () => handleGenerateCases("local"));
  els.saveDocument?.addEventListener("click", saveCurrentDocument);
  els.activeBatchSelect.addEventListener("change", handleActiveBatchChange);
  els.activeModuleSelect.addEventListener("change", handleActiveModuleChange);
  els.createBatchBtn.addEventListener("click", createBatch);
  els.createTaskBtn.addEventListener("click", createTask);
  els.caseImportInput.addEventListener("change", handleCaseImport);
  els.caseBatchFilter.addEventListener("change", () => {
    renderCaseFilters();
    renderCases();
  });
  els.caseTaskFilter.addEventListener("change", renderCases);
  els.bugBatchFilter.addEventListener("change", () => {
    renderCaseFilters();
    renderBugs();
  });
  els.bugTaskFilter.addEventListener("change", renderBugs);
  els.addBug.addEventListener("click", createBugRecord);
  els.exportReport.addEventListener("click", exportReport);
  els.checkLark?.addEventListener("click", checkLarkStatus);
  els.syncLark?.addEventListener("click", syncLarkData);
  els.seedDemo?.addEventListener("click", seedDemoData);
  els.saveApiKey.addEventListener("click", saveApiSettings);
  els.checkApiKey?.addEventListener("click", checkAiKey);
  els.clearApiKey.addEventListener("click", clearApiSettings);
  els.modelSelect.addEventListener("change", saveApiSettings);
  els.sidebarBackToTop?.addEventListener("click", scrollSidebarToTop);
  document.addEventListener("click", handleGlobalActionClick);
}

function scrollSidebarToTop() {
  const sidebar = document.querySelector(".sidebar");
  sidebar?.scrollTo({ top: 0, behavior: "smooth" });
  window.scrollTo({ top: 0, behavior: "smooth" });
  document.documentElement.scrollTo?.({ top: 0, behavior: "smooth" });
  document.body.scrollTo?.({ top: 0, behavior: "smooth" });
}

function hydrateReportChrome() {
  const reportPanel = document.getElementById("report");
  if (!reportPanel) {
    return;
  }

  const headerTitle = reportPanel.querySelector(".panel-header h2");
  const headerDesc = reportPanel.querySelector(".panel-header p");
  const exportBtn = reportPanel.querySelector("#exportReport");

  if (headerTitle) headerTitle.textContent = "测试报告";
  if (headerDesc) headerDesc.textContent = "基于当前批次 / 任务 / 模块范围，自动汇总用例执行与 BUG 状态。";
  if (exportBtn) exportBtn.textContent = "导出DOCX";

  if (els.reportConclusion) {
    els.reportConclusion.placeholder = "补充测试范围、风险项、上线建议";
  }
}

function hydrateWorkflowChrome() {
  const bugNav = [...els.navLinks].find((item) => item.dataset.tab === "bugs");
  if (bugNav) {
    bugNav.textContent = "BUG管理";
  }

  const bugPanel = document.getElementById("bugs");
  if (bugPanel) {
    const headerTitle = bugPanel.querySelector(".panel-header h2");
    const headerDesc = bugPanel.querySelector(".panel-header p");
    if (headerTitle) headerTitle.textContent = "BUG管理";
    if (headerDesc) headerDesc.textContent = "独立管理 BUG 台账，按版本、任务、模块跟踪状态、负责人和回归进展。";
  }
}

function simplifyUploadFlow() {
  els.versionScopeInput?.closest("label")?.remove();
  els.documentType?.closest("label")?.remove();
  els.generateCasesLocal?.remove();
  els.saveDocument?.remove();

  const actionWrap = els.generateCases?.parentElement;
  if (actionWrap && !actionWrap.querySelector("[data-action='download-case-template']")) {
    const templateButton = document.createElement("button");
    templateButton.type = "button";
    templateButton.className = "ghost-button";
    templateButton.dataset.action = "download-case-template";
    templateButton.textContent = "下载CSV模板";
    actionWrap.appendChild(templateButton);
  }
}

function initTextSourceUi() {
  if (document.getElementById("sourceTextWrap")) {
    return;
  }

  const sourceUrlWrap = document.getElementById("sourceUrlWrap");
  if (!sourceUrlWrap?.parentElement) {
    return;
  }

  const textWrap = document.createElement("label");
  textWrap.id = "sourceTextWrap";
  textWrap.className = "hidden-field";
  textWrap.innerHTML = `
    需求正文
    <textarea id="sourceText" class="md-textarea" rows="8" placeholder="直接粘贴需求、流程说明、测试范围或接口说明，AI 会基于这里的正文生成测试用例。"></textarea>
  `;
  sourceUrlWrap.insertAdjacentElement("afterend", textWrap);

  els.sourceTextWrap = textWrap;
  els.sourceText = textWrap.querySelector("#sourceText");

  const sourceType = els.sourceType;
  if (sourceType && !sourceType.querySelector('option[value="text"]')) {
    const option = document.createElement("option");
    option.value = "text";
    option.textContent = "直接粘贴文本";
    sourceType.appendChild(option);
  }
}

function initOwnerUi() {
  const versionFlow = document.querySelector(".version-flow");
  const taskPanel = els.currentTaskSummary?.closest(".panel");
  const bugOwnerField = els.bugTemplate?.content.querySelector(".bug-owner");

  if (versionFlow && !document.getElementById("batchOwnerSelect")) {
    const ownerField = document.createElement("label");
    ownerField.className = "step-field";
    ownerField.innerHTML = `
      <span class="step-label">版本负责人</span>
      <select id="batchOwnerSelect">
        <option value="">未选择</option>
      </select>
    `;
    versionFlow.appendChild(ownerField);
  }

  if (taskPanel && !document.getElementById("taskOwnerSelect")) {
    const taskActions = taskPanel.querySelector(".inline-actions");
    const ownerField = document.createElement("label");
    ownerField.innerHTML = `
      任务负责人
      <select id="taskOwnerSelect">
        <option value="">未选择</option>
      </select>
    `;
    taskActions?.before(ownerField);
  }

  if (bugOwnerField && bugOwnerField.tagName === "INPUT") {
    const select = document.createElement("select");
    select.className = "bug-owner";
    select.innerHTML = `<option value="">未选择</option>`;
    bugOwnerField.replaceWith(select);
  }

  els.batchOwnerSelect = document.getElementById("batchOwnerSelect");
  els.taskOwnerSelect = document.getElementById("taskOwnerSelect");
}

function switchTab(tabId) {
  els.navLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.tab === tabId);
  });
  els.panels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === tabId);
  });
  els.sidebarBackToTop?.classList.toggle("hidden-field", tabId !== "upload");
}

function handleGlobalActionClick(event) {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) {
    return;
  }

  if (actionButton.dataset.action === "download-case-template") {
    downloadCaseTemplateCsv();
    return;
  }

  handleShortcutAction(actionButton.dataset.action);
}

function handleFileUpload(event) {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    els.documentName.value = file.name.replace(/\.[^.]+$/, "");
    uploadedFileContent = String(reader.result || "");
    setGenerationStatus(`已读取文件：${file.name}。`, "ok");
  };
  reader.readAsText(file, "utf-8");
}

function getDocumentTypeBySource(sourceType) {
  return sourceType === "url" ? "api" : "requirement";
}

function renderSourceMode() {
  const sourceType = els.sourceType.value;
  const isFile = sourceType === "file";
  const isUrl = sourceType === "url";
  const isText = sourceType === "text";

  els.documentInput.parentElement.classList.toggle("hidden-field", !isFile);
  els.sourceUrlWrap.classList.toggle("hidden-field", !isUrl);
  els.sourceTextWrap?.classList.toggle("hidden-field", !isText);
  els.focusHintWrap.classList.remove("hidden-field");
}

function saveApiSettings() {
  settings.model = els.modelSelect.value;
  state.settings = { model: settings.model };
  persist();
  setGenerationStatus("模型设置已保存。页面输入的 Key 只临时使用，刷新后会清空；长期使用请配置服务端 OPENAI_API_KEY。", "ok");
  checkApiStatus();
}

function clearApiSettings() {
  settings.apiKey = "";
  els.apiKey.value = "";
  state.settings = { model: els.modelSelect.value };
  persist();
  checkApiStatus();
  setGenerationStatus("已清空当前页面输入的 API Key。本地存储不会保留真实 Key。", "warn");
}

async function checkApiStatus() {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) {
      throw new Error("health check failed");
    }

    const data = await response.json();
    settings.apiReady = true;
    settings.envKeyAvailable = Boolean(data.envKeyAvailable);

    if (data.defaultModel && !state.settings?.model) {
      els.modelSelect.value = data.defaultModel;
      settings.model = data.defaultModel;
    }

    const hasAnyKey = data.envKeyAvailable || Boolean(els.apiKey.value.trim());
    setApiStatus(hasAnyKey ? "待检测 Key" : "需要填写 API Key", hasAnyKey ? "neutral" : "warn");
  } catch (_error) {
    settings.apiReady = false;
    setApiStatus("本地服务未启动", "error");
  }
}

async function checkAiKey() {
  const apiKey = els.apiKey.value.trim();
  const model = els.modelSelect.value;
  const hasServerKey = settings.envKeyAvailable;

  if (!apiKey && !hasServerKey) {
    setApiStatus("需要填写 API Key", "warn");
    setGenerationStatus("请先填写 OpenAI API Key，再检测是否可用。", "warn");
    return;
  }

  els.checkApiKey.disabled = true;
  setApiStatus("正在检测 Key", "neutral");
  setGenerationStatus("正在调用 AI 服务检测当前 Key...", "warn");

  try {
    const response = await fetch("/api/check-ai-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, model })
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "AI Key 检测失败。");
    }

    settings.apiKey = apiKey;
    settings.model = model;
    settings.apiReady = true;
    state.settings = { model };
    persist();
    setApiStatus(apiKey ? "Key 可正常调用 AI" : "环境 Key 可调用 AI", "ok");
    setGenerationStatus(`检测通过：${apiKey ? "当前页面 Key" : "服务端环境 Key"} 可以调用 ${data.model || model}。${apiKey ? "页面刷新后需重新输入 Key。" : "页面刷新后仍可使用。"}`, "ok");
  } catch (error) {
    settings.apiReady = false;
    setApiStatus("Key 检测失败", "error");
    setGenerationStatus(error.message || "AI Key 检测失败，请检查 Key、模型或网络。", "error");
  } finally {
    els.checkApiKey.disabled = false;
  }
}

function setApiStatus(text, tone) {
  els.apiStatus.textContent = text;
  els.apiStatus.className = `status-pill ${tone}`;
}

function setLarkStatus(text, tone) {
  if (!els.larkStatus) {
    return;
  }
  els.larkStatus.textContent = text;
  els.larkStatus.className = `status-pill ${tone}`;
}

function setLarkFeedback(text, tone = "neutral") {
  if (!els.larkFeedback) {
    return;
  }
  els.larkFeedback.textContent = text;
  els.larkFeedback.className = `inline-feedback ${tone}`;
}

async function checkLarkStatus() {
  if (!els.checkLark) {
    return;
  }

  els.checkLark.disabled = true;
  setLarkStatus("正在检测", "neutral");
  setLarkFeedback("正在读取 .env 配置并检测 Lark Base 权限...", "warn");

  try {
    const response = await fetch("/api/lark/status");
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Lark 连接检测失败。");
    }

    const tableText = Object.entries(data.tables || {})
      .filter(([, table]) => table.configured)
      .map(([name, table]) => `${name}:${table.ok ? "可访问" : "不可访问"}`)
      .join("，");

    setLarkStatus("Lark 已连接", "ok");
    setLarkFeedback(tableText ? `检测通过。${tableText}` : "检测通过，但还没有配置任何同步表。", "ok");
  } catch (error) {
    setLarkStatus("Lark 未连接", "error");
    setLarkFeedback(error.message || "Lark 连接检测失败，请检查 .env 和 Base 协作者权限。", "error");
  } finally {
    els.checkLark.disabled = false;
  }
}

async function syncLarkData() {
  if (!els.syncLark) {
    return;
  }

  els.syncLark.disabled = true;
  setLarkStatus("正在同步", "neutral");
  setLarkFeedback("正在同步版本、任务、用例和 BUG 到 Lark Base...", "warn");

  try {
    const response = await fetch("/api/lark/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: buildSharedStatePayload() })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "同步到 Lark 失败。");
    }

    const summary = Object.entries(data.synced || {})
      .map(([name, result]) => {
        if (typeof result === "number") {
          return `${name} ${result} 条`;
        }
        const created = Number(result?.created || 0);
        const updated = Number(result?.updated || 0);
        const total = Number(result?.total || created + updated);
        return `${name} ${total} 条（新增 ${created}，更新 ${updated}）`;
      })
      .join("，");

    setLarkStatus("同步完成", "ok");
    setLarkFeedback(summary ? `同步完成：${summary}。` : "同步完成，没有可写入的数据。", "ok");
  } catch (error) {
    setLarkStatus("同步失败", "error");
    setLarkFeedback(error.message || "同步到 Lark 失败，请检查 .env、字段名和表格权限。", "error");
  } finally {
    els.syncLark.disabled = false;
  }
}

async function loadTeamMembersConfig() {
  try {
    const response = await fetch("/api/team-members");
    if (!response.ok) {
      throw new Error("load team members failed");
    }
    const data = await response.json();
    const merged = normalizeTeamMembers([...(data.teamMembers || []), ...(state.teamMembers || [])]);
    state.teamMembers = merged;
    persist();
    renderAll();
    if (JSON.stringify(merged) !== JSON.stringify(data.teamMembers || [])) {
      await saveTeamMembersConfig();
    }
  } catch (_error) {
    renderAll();
  }
}

async function saveTeamMembersConfig() {
  try {
    await fetch("/api/team-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamMembers: state.teamMembers })
    });
  } catch (_error) {
    // Ignore config sync failures and keep local state available.
  }
}

async function loadSharedState() {
  try {
    const response = await fetch("/api/app-state");
    if (!response.ok) {
      throw new Error("load shared state failed");
    }
    const data = await response.json();
    const remoteState = data.state || {};
    if (shouldSeedRemoteState(remoteState)) {
      await persistSharedState();
    } else {
      applySharedState(remoteState);
    }
    ensureSeedMetadata();
    renderAll();
  } catch (_error) {
    renderAll();
  }
}

function applySharedState(nextState) {
  SHARED_STATE_KEYS.forEach((key) => {
    if (key in nextState) {
      state[key] = structuredCloneSafe(nextState[key]);
    }
  });
}

function buildSharedStatePayload() {
  return Object.fromEntries(SHARED_STATE_KEYS.map((key) => [key, structuredCloneSafe(state[key])]));
}

function structuredCloneSafe(value) {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}

function shouldSeedRemoteState(remoteState) {
  const remoteHasData = SHARED_STATE_KEYS.some((key) => hasMeaningfulValue(remoteState[key]));
  const localHasData = SHARED_STATE_KEYS.some((key) => hasMeaningfulValue(state[key]));
  return !remoteHasData && localHasData;
}

function hasMeaningfulValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (value && typeof value === "object") {
    return Object.keys(value).length > 0;
  }
  return Boolean(value);
}

function setGenerationStatus(text, tone = "neutral") {
  els.generationStatus.textContent = text;
  els.generationStatus.className = `inline-feedback ${tone}`;
}

function saveCurrentDocument() {
  const name = els.documentName.value.trim();
  const sourceType = els.sourceType.value;
  const documentType = getDocumentTypeBySource(sourceType);
  const content = sourceType === "url"
    ? els.sourceUrl.value.trim()
    : sourceType === "text"
      ? els.sourceText?.value.trim() || ""
      : uploadedFileContent.trim();

  if (!name || !content) {
    alert("先填写内容名称和来源。");
    return;
  }

  state.documents.unshift({
    id: `doc-${Date.now()}`,
    name,
    sourceType,
    type: documentType,
    content,
    createdAt: new Date().toISOString()
  });

  persist();
  renderQuickStats();
  setGenerationStatus("文档已保存。", "ok");
}

function ensureSeedMetadata() {
  if (!Array.isArray(state.batches)) {
    state.batches = [];
  }
  if (!Array.isArray(state.tasks)) {
    state.tasks = [];
  }
  if (!Array.isArray(state.teamMembers)) {
    state.teamMembers = [];
  }
  if (!state.reportConclusions || typeof state.reportConclusions !== "object") {
    state.reportConclusions = {};
  }
  state.modules = BUSINESS_OPTIONS.map((name) => ({
    id: slugifyBusiness(name),
    name
  }));
  if (state.activeBatchId === undefined) {
    state.activeBatchId = "";
  }
  if (state.activeBatchId === null) {
    state.activeBatchId = "";
  }
  if (state.activeModuleId === undefined) {
    state.activeModuleId = "";
  }
  if (state.activeModuleId === null) {
    state.activeModuleId = "";
  }
  if (state.generationBatchId === undefined) {
    state.generationBatchId = "";
  }
  if (state.generationBatchId === null) {
    state.generationBatchId = "";
  }
  if (state.activeTaskId === undefined) {
    state.activeTaskId = "";
  }
  if (state.activeTaskId === null) {
    state.activeTaskId = "";
  }
  if (state.activeReportBatchId === undefined) {
    state.activeReportBatchId = "";
  }
  if (state.activeReportBatchId === null) {
    state.activeReportBatchId = "";
  }
  if (!state.uiMode) {
    state.uiMode = "guide";
  }

  state.activeModuleId = normalizeModuleId(state.activeModuleId);
  state.teamMembers = normalizeTeamMembers(state.teamMembers);
  state.batches = state.batches.map((item) => normalizeBatchItem(item));
  state.tasks = state.tasks.map((item) => normalizeTaskItem(item));
  state.cases = state.cases.map((item) => normalizeCaseItem(item));
  state.bugs = state.bugs.map((item) => normalizeBugItem(item));
  collectOwnersIntoTeamMembers();

  if (!state.activeModuleId && state.activeBatchId) {
    const activeBatch = state.batches.find((item) => item.id === state.activeBatchId);
    state.activeModuleId = activeBatch?.moduleId || "";
  }

  if (!state.generationBatchId || !state.batches.some((item) => item.id === state.generationBatchId)) {
    state.generationBatchId = state.activeBatchId || state.batches[0]?.id || "";
  }

  if (!state.activeTaskId || !state.tasks.some((item) => item.id === state.activeTaskId)) {
    state.activeTaskId = state.tasks.find((item) => item.batchId === state.generationBatchId)?.id || state.tasks[0]?.id || "";
  }

  if (!state.activeReportBatchId || !state.batches.some((item) => item.id === state.activeReportBatchId)) {
    state.activeReportBatchId = state.activeBatchId || state.generationBatchId || state.batches[0]?.id || "";
  }
}

function handleActiveBatchChange() {
  state.activeBatchId = els.activeBatchSelect.value;
  const activeBatch = getBatchById(state.activeBatchId);
  if (activeBatch?.moduleId) {
    state.activeModuleId = activeBatch.moduleId;
    els.activeModuleSelect.value = activeBatch.moduleId;
  } else {
    state.activeModuleId = els.activeModuleSelect.value;
  }
  state.activeTaskId = state.tasks.find((item) => item.batchId === state.activeBatchId)?.id || "";
  if (!state.generationBatchId) {
    state.generationBatchId = state.activeBatchId;
  }
  persist();
  renderAll();
}

function handleActiveModuleChange() {
  state.activeModuleId = els.activeModuleSelect.value;
  persist();
  renderMetaControls();
}

function handleGenerationBatchChange(event) {
  state.generationBatchId = event.target.value;
  const firstTask = state.tasks.find((item) => item.batchId === state.generationBatchId);
  state.activeTaskId = firstTask?.id || "";
  persist();
  renderMetaControls();
}

function handleGenerationTaskChange(event) {
  const task = getTaskById(event.target.value);
  state.activeTaskId = task?.id || "";
  state.generationBatchId = task?.batchId || "";
  if (task?.batchId) {
    state.activeBatchId = task.batchId;
  }
  if (task?.moduleId) {
    state.activeModuleId = task.moduleId;
  }
  persist();
  renderAll();
}

function createBatch() {
  const version = els.batchVersionInput.value.trim();
  const moduleId = els.activeModuleSelect.value;
  const moduleItem = getModuleById(moduleId);
  const owner = els.batchOwnerSelect?.value.trim() || "";
  const duplicateBatch = state.batches.find((item) => item.version === version && item.id !== editingBatchId);

  if (!version) {
    setGenerationStatus("请先填写版本号。", "warn");
    return;
  }

  if (duplicateBatch) {
    setGenerationStatus(`版本号 ${version} 已存在，不能重复。`, "warn");
    return;
  }

  const batch = {
    id: editingBatchId || `batch-${Date.now()}`,
    name: moduleItem?.name || getBatchById(editingBatchId)?.name || "",
    version,
    scope: getBatchById(editingBatchId)?.scope || "",
    moduleId: moduleItem?.id || getBatchById(editingBatchId)?.moduleId || "",
    moduleName: moduleItem?.name || getBatchById(editingBatchId)?.moduleName || "",
    owner,
    owners: splitOwnerValues(owner),
    status: getBatchById(editingBatchId)?.status || "进行中"
  };

  const isEditing = Boolean(editingBatchId);

  if (isEditing) {
    state.batches = state.batches.map((item) => (item.id === editingBatchId ? batch : item));
  } else {
    state.batches.unshift(batch);
  }
  state.activeBatchId = batch.id;
  state.generationBatchId = batch.id;
  state.activeModuleId = batch.moduleId || state.activeModuleId;
  els.batchVersionInput.value = "";
  fillOwnerSelect(els.batchOwnerSelect, "");
  editingBatchId = "";
  els.createBatchBtn.textContent = "保存当前版本";
  autoResizeTextarea();
  persist();
  renderAll();
  setGenerationStatus(`${isEditing ? "已更新" : "已保存"}版本：${batch.version}。下一步请新增测试任务。`, "ok");
  switchTab("upload");
  els.taskBatchSelect.value = batch.id;
  els.taskNameInput.focus();
  els.taskNameInput.scrollIntoView({ behavior: "smooth", block: "center" });
}

function createTask() {
  const batchId = els.taskBatchSelect.value;
  const batch = getBatchById(batchId);
  const name = els.taskNameInput.value.trim();
  const scope = els.taskScopeInput.value.trim();
  const owner = els.taskOwnerSelect?.value.trim() || "";

  if (!batch) {
    setGenerationStatus("请先给任务选择关联版本。", "warn");
    return;
  }
  if (!name) {
    setGenerationStatus("请先填写任务名称。", "warn");
    return;
  }

  if (editingTaskId && batch?.status === "已完成") {
    setGenerationStatus(`版本 ${formatBatchLabel(batch)} 已完成，已有任务不能再编辑。`, "warn");
    return;
  }

  const task = {
    id: editingTaskId || `task-${Date.now()}`,
    batchId: batch.id,
    batchVersion: batch.version || "",
    batchName: formatBatchLabel(batch),
    moduleId: batch.moduleId || "",
    moduleName: batch.moduleName || batch.name || "",
    name,
    scope,
    owner,
    owners: splitOwnerValues(owner),
    status: getTaskById(editingTaskId)?.status || "进行中"
  };

  const isEditing = Boolean(editingTaskId);
  if (isEditing) {
    state.tasks = state.tasks.map((item) => (item.id === editingTaskId ? task : item));
  } else {
    state.tasks.unshift(task);
  }

  state.activeTaskId = task.id;
  state.generationBatchId = task.batchId;
  state.activeBatchId = task.batchId;
  state.activeModuleId = task.moduleId || state.activeModuleId;

  els.taskBatchSelect.value = task.batchId;
  els.taskNameInput.value = "";
  els.taskScopeInput.value = "";
  fillOwnerSelect(els.taskOwnerSelect, "");
  els.createTaskBtn.textContent = "保存当前任务";
  editingTaskId = "";
  autoResizeTextarea();
  persist();
  renderAll();
  setGenerationStatus(`${isEditing ? "已更新" : "已保存"}任务：${task.name}。下一步请生成测试用例。`, "ok");
}

function autoResizeTextarea() {
  [els.versionScopeInput, els.taskScopeInput, els.sourceText].filter(Boolean).forEach((textarea) => {
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(textarea.scrollHeight, 180)}px`;
  });
}

async function handleGenerateCases(mode) {
  const name = els.documentName.value.trim() || `未命名文档${state.documents.length + 1}`;
  const sourceType = els.sourceType.value;
  const sourceUrl = els.sourceUrl.value.trim();
  const sourceText = els.sourceText?.value.trim() || "";
  const focusHint = els.focusHint.value.trim();
  const content = sourceType === "url" ? sourceUrl : sourceType === "text" ? sourceText : uploadedFileContent.trim();
  const type = getDocumentTypeBySource(sourceType);
  const activeTask = getTaskById(state.activeTaskId);
  const activeBatch = getBatchById(activeTask?.batchId || state.activeBatchId);

  if (!activeTask) {
    setGenerationStatus("请先保存并选择当前测试任务，再生成用例。", "warn");
    return;
  }

  if (!activeBatch?.version) {
    setGenerationStatus("请先给当前任务关联版本，再生成用例。", "warn");
    return;
  }

  if (!content) {
    alert(sourceType === "url" ? "请先填写网址链接。" : sourceType === "text" ? "请先粘贴需求正文。" : "请先上传本地文件。");
    return;
  }

  if (mode === "ai") {
    if (!settings.apiReady) {
      setGenerationStatus("本地服务还没有启动成功，请先启动服务或先用规则生成。", "error");
      return;
    }

    const apiKey = els.apiKey.value.trim();
    setGenerationStatus("AI 正在生成中，文档越长会越慢一点。", "neutral");
    toggleGenerateButtons(true);

    try {
      const generated = await requestAiCases({
        documentName: name,
        documentType: type,
        content,
        sourceType,
        focusHint,
        apiKey,
        model: els.modelSelect.value
      });

      const generatedCases = appendGeneratedCases(generated, {
        mode: "AI",
        documentName: name,
        documentType: type
      });
      downloadCasesCsv(generatedCases, activeBatch, activeTask, name);
      setGenerationStatus(`AI 已生成 ${generated.length} 条用例，并已导出 CSV。`, "ok");
      return;
    } catch (error) {
      setGenerationStatus(`AI 生成失败：${error.message}`, "error");
      return;
    } finally {
      toggleGenerateButtons(false);
    }
  }

  if (sourceType === "url") {
    setGenerationStatus("规则生成暂时不支持网址抓取，网址模式请直接使用 AI 生成。", "warn");
    return;
  }

  const generated = type === "api"
    ? generateCasesFromApi(name, content)
    : generateCasesFromRequirement(name, content);

  if (!generated.length) {
    alert("没有识别到可生成的内容，请试试更完整的文档。");
    return;
  }

  const generatedCases = appendGeneratedCases(generated, {
    mode: "规则",
    documentName: name,
    documentType: type
  });
  downloadCasesCsv(generatedCases, activeBatch, activeTask, name);
  setGenerationStatus(`规则生成完成，共 ${generated.length} 条用例，并已导出 CSV。`, "ok");
}

function toggleGenerateButtons(loading) {
  els.generateCases.disabled = loading;
  if (els.generateCasesLocal) {
    els.generateCasesLocal.disabled = loading;
  }
  if (els.saveDocument) {
    els.saveDocument.disabled = loading;
  }
}

async function requestAiCases(payload) {
  const response = await fetch("/api/generate-cases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "生成服务暂时不可用");
  }

  if (!Array.isArray(data.testCases) || !data.testCases.length) {
    throw new Error("AI 没有返回有效用例");
  }

  return data.testCases.map((item, index) => ({
    id: `case-${Date.now()}-${index}`,
    module: item.module || "未分类",
    title: item.title || `AI 用例 ${index + 1}`,
    type: item.type || "正常",
    priority: item.priority || "P2",
    preconditions: normalizeMultiline(item.preconditions),
    steps: normalizeMultiline(item.steps),
    expected: item.expected || "待补充",
    executionStatus: "未执行",
    executionNote: ""
  }));
}

function normalizeMultiline(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join("\n");
  }
  return String(value || "").trim();
}

function appendGeneratedCases(cases, meta) {
  const activeTask = getTaskById(state.activeTaskId);
  const activeBatch = getBatchById(activeTask?.batchId || state.generationBatchId);
  const activeModule = getModuleById(activeTask?.moduleId || activeBatch?.moduleId || state.activeModuleId);

  const generatedCases = cases.map((item, index) => ({
    ...item,
    id: item.id || `case-${Date.now()}-${index}`,
    taskId: activeTask?.id || "",
    taskName: activeTask?.name || "",
    batchId: activeBatch?.id || "",
    batchVersion: activeBatch?.version || "",
    batchName: activeBatch ? formatBatchLabel(activeBatch) : "",
    moduleId: activeModule?.id || "",
    module: activeModule?.name || item.module || "未分类"
  }));

  state.cases = generatedCases;

  state.lastGeneration = {
    name: meta.documentName,
    type: meta.documentType,
    count: cases.length,
    mode: meta.mode,
    createdAt: new Date().toLocaleString("zh-CN")
  };

  persist();
  renderAll();
  return generatedCases;
}

function handleCaseImport(event) {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const importedCases = parseCasesCsv(String(reader.result || ""));
      if (!importedCases.length) {
        setGenerationStatus("上传的 CSV 没识别到有效用例。", "warn");
        return;
      }

      state.cases = importedCases.map((item, index) => ({
        ...item,
        id: `case-import-${Date.now()}-${index}`,
        taskId: item.taskId || state.activeTaskId || "",
        taskName: item.taskName || getTaskNameById(item.taskId) || getTaskNameById(state.activeTaskId),
        batchId: item.batchId || getTaskById(item.taskId)?.batchId || state.activeBatchId || "",
        batchVersion: item.batchVersion || getBatchVersionById(item.batchId || getTaskById(item.taskId)?.batchId) || getBatchVersionById(state.activeBatchId),
        batchName: item.batchName || getBatchLabelById(item.batchId || getTaskById(item.taskId)?.batchId) || getBatchLabelById(state.activeBatchId),
        moduleId: item.moduleId || getTaskById(item.taskId)?.moduleId || state.activeModuleId || "",
        module: item.module || getModuleNameById(item.moduleId || getTaskById(item.taskId)?.moduleId || state.activeModuleId) || "未分类",
        executionStatus: item.executionStatus || "未执行",
        executionNote: item.executionNote || ""
      }));

      persist();
      renderAll();
      switchTab("cases");
      setGenerationStatus(`已导入 ${importedCases.length} 条用例。`, "ok");
    } catch (error) {
      setGenerationStatus(`CSV 导入失败：${error.message}`, "error");
    } finally {
      els.caseImportInput.value = "";
    }
  };
  reader.readAsText(file, "utf-8");
}

function parseCasesCsv(csvText) {
  const rows = parseCsvRows(csvText.replace(/^\ufeff/, ""));
  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map((item) => item.trim());
  const headerIndex = Object.fromEntries(headers.map((item, index) => [item, index]));

  const getValue = (row, names) => {
    for (const name of names) {
      if (headerIndex[name] !== undefined) {
        return row[headerIndex[name]] || "";
      }
    }
    return "";
  };

  return rows.slice(1)
    .filter((row) => row.some((item) => String(item || "").trim()))
    .map((row) => ({
      taskName: getValue(row, ["测试任务", "任务名称", "关联任务"]),
      batchVersion: getValue(row, ["关联版本号", "版本号", "测试版本"]),
      batchName: getValue(row, ["批次", "测试批次", "版本批次"]),
      module: getValue(row, ["模块", "一级模块", "二级模块"]) || "未分类",
      title: getValue(row, ["标题", "用例标题", "测试标题"]) || "未命名用例",
      type: getValue(row, ["类型"]) || "正常",
      priority: getValue(row, ["优先级"]) || "P2",
      preconditions: getValue(row, ["前置条件"]),
      steps: getValue(row, ["步骤", "测试步骤"]),
      expected: getValue(row, ["预期结果"]),
      executionStatus: normalizeExecutionStatus(getValue(row, ["执行状态", "执行结果", "状态"])),
      executionNote: getValue(row, ["执行备注"])
    }));
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function downloadCasesCsv(cases, activeBatch, activeTask, documentName) {
  const headers = ["测试任务", "关联版本号", "批次", "模块", "标题", "类型", "优先级", "前置条件", "步骤", "预期结果", "执行状态", "执行备注"];
  const rows = cases.map((item) => [
    item.taskName || activeTask?.name || "",
    item.batchVersion || activeBatch?.version || "",
    item.batchName || (activeBatch ? formatBatchLabel(activeBatch) : ""),
    item.module || "",
    item.title || "",
    item.type || "",
    item.priority || "",
    item.preconditions || "",
    item.steps || "",
    item.expected || "",
    normalizeExecutionStatus(item.executionStatus || "未执行"),
    item.executionNote || ""
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\r\n");

  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const fileBaseName = [activeBatch?.version, activeTask?.name || documentName || "测试用例"].filter(Boolean).join("-");
  anchor.download = `${sanitizeFileName(fileBaseName)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadCaseTemplateCsv() {
  const activeTask = getTaskById(state.activeTaskId);
  const activeBatch = getBatchById(activeTask?.batchId || state.activeBatchId);
  const headers = [
    "测试任务",
    "关联版本号",
    "批次",
    "模块",
    "标题",
    "类型",
    "优先级",
    "前置条件",
    "步骤",
    "预期结果",
    "执行状态",
    "执行备注"
  ];
  const exampleRow = [
    activeTask?.name || "",
    activeBatch?.version || "",
    activeBatch ? formatBatchLabel(activeBatch) : "",
    activeTask?.moduleName || getModuleNameById(activeTask?.moduleId || state.activeModuleId) || "",
    "",
    "正常",
    "P2",
    "",
    "",
    "",
    "未执行",
    ""
  ];
  const csv = [headers, exampleRow]
    .map((row) => row.map(csvEscape).join(","))
    .join("\r\n");

  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "测试用例导入模板.csv";
  anchor.click();
  URL.revokeObjectURL(url);
  setGenerationStatus("CSV 模板已下载，按表头填写后可直接上传到测试用例页面。", "ok");
}

function csvEscape(value) {
  const text = String(value ?? "").replaceAll('"', '""');
  return `"${text}"`;
}

function normalizeExecutionStatus(value) {
  const text = String(value || "").trim();
  const lower = text.toLowerCase();
  if (text === "通过" || ["pass", "passed"].includes(lower)) return "通过";
  if (text === "失败" || ["fail", "failed"].includes(lower)) return "失败";
  if (text === "阻塞" || ["block", "blocked"].includes(lower)) return "阻塞";
  return "未执行";
}

function sanitizeFileName(value) {
  return String(value).replace(/[\\/:*?"<>|]/g, "-");
}

function generateCasesFromApi(_name, content) {
  const apiData = parseApiDoc(content);
  const results = [];

  if (!apiData.paths) {
    return results;
  }

  Object.entries(apiData.paths).forEach(([path, methods]) => {
    Object.entries(methods || {}).forEach(([method, detail]) => {
      const methodUpper = method.toUpperCase();
      const summary = detail.summary || detail.operationId || `${methodUpper} ${path}`;
      const moduleName = firstTag(detail.tags) || extractModuleFromPath(path);
      const requiredParams = collectRequiredParams(detail);
      const expectedCode = Object.keys(detail.responses || {})[0] || "200";
      const firstRequiredParam = requiredParams[0] || "核心参数";

      results.push(
        buildCase(
          moduleName,
          `${summary} - 正常请求`,
          "正常",
          "P1",
          "接口可访问，鉴权信息和基础数据已准备。",
          [
            `按文档构造 ${methodUpper} ${path} 请求。`,
            requiredParams.length ? `填写必填参数：${requiredParams.join("、")}。` : "使用文档中的标准参数组合。",
            "发送请求并记录返回结果。"
          ],
          `返回符合预期的成功响应，重点校验状态码 ${expectedCode} 与关键业务字段。`
        ),
        buildCase(
          moduleName,
          `${summary} - 缺少必填参数`,
          "异常",
          "P1",
          "接口可访问。",
          [
            `构造 ${methodUpper} ${path} 请求。`,
            requiredParams.length ? `故意缺少必填参数：${firstRequiredParam}。` : "构造不完整请求体或缺少必要鉴权信息。",
            "发送请求并观察返回。"
          ],
          "接口返回清晰的参数校验失败信息，不应出现服务异常。"
        ),
        buildCase(
          moduleName,
          `${summary} - 边界值校验`,
          "异常",
          "P2",
          "已拿到字段定义或示例请求。",
          [
            "选择一个长度、范围或枚举受限的字段。",
            "分别构造边界值、空值、超长值等场景。",
            "发送请求并比对接口返回。"
          ],
          "边界值处理符合文档约束，错误提示明确且稳定。"
        )
      );
    });
  });

  return results.map((item, index) => ({ ...item, id: `case-${Date.now()}-${index}` }));
}

function parseApiDoc(content) {
  try {
    return JSON.parse(content);
  } catch (_error) {
    const lines = content.split(/\r?\n/);
    const result = { paths: {} };
    let currentPath = "";
    let currentMethod = "";

    lines.forEach((line) => {
      const trimmed = line.replace(/\t/g, "    ").trim();
      if (!trimmed) {
        return;
      }

      if (/^\/[^:]+:$/.test(trimmed)) {
        currentPath = trimmed.slice(0, -1);
        result.paths[currentPath] = result.paths[currentPath] || {};
        currentMethod = "";
        return;
      }

      if (/^(get|post|put|delete|patch):$/i.test(trimmed) && currentPath) {
        currentMethod = trimmed.slice(0, -1).toLowerCase();
        result.paths[currentPath][currentMethod] = { responses: {} };
        return;
      }

      if (!currentPath || !currentMethod) {
        return;
      }

      const summaryMatch = trimmed.match(/^summary:\s*(.+)$/i);
      if (summaryMatch) {
        result.paths[currentPath][currentMethod].summary = summaryMatch[1].trim();
      }
    });

    return result;
  }
}

function collectRequiredParams(detail) {
  const params = [];

  (detail.parameters || []).forEach((item) => {
    if (item.required && item.name) {
      params.push(item.name);
    }
  });

  if (detail.requestBody && detail.requestBody.required) {
    params.push("requestBody");
  }

  return params;
}

function generateCasesFromRequirement(name, content) {
  const sections = extractRequirementSections(content);

  return sections.flatMap((section, index) => {
    const moduleName = section.module || name;
    const priority = /(核心|必须|重要|critical|high)/i.test(section.text) ? "P1" : "P2";

    return [
      buildCase(
        moduleName,
        `${section.title} - 正向验证`,
        "正常",
        priority,
        "已准备测试环境、账号和基础数据。",
        [
          `进入 ${moduleName} 相关功能。`,
          `按需求执行：${section.text}`,
          "观察页面、接口和数据结果。"
        ],
        "系统行为与需求描述一致，关键数据展示或落库正确。"
      ),
      buildCase(
        moduleName,
        `${section.title} - 异常校验`,
        "异常",
        priority,
        "已准备异常输入或异常前置场景。",
        [
          `进入 ${moduleName} 相关功能。`,
          "输入非法值、缺少必填项或制造异常前置条件。",
          "提交后观察系统反馈。"
        ],
        "系统给出明确提示，不应出现崩溃、空白页或脏数据。"
      )
    ].map((item, offset) => ({ ...item, id: `case-${Date.now()}-${index}-${offset}` }));
  });
}

function extractRequirementSections(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const bulletLike = lines.filter((line) => /^(\d+[\.\)]|[-*]|[一二三四五六七八九十]+[、.])/.test(line));
  if (bulletLike.length) {
    return bulletLike.map((line) => ({
      title: line.replace(/^(\d+[\.\)]|[-*]|[一二三四五六七八九十]+[、.])\s*/, "").slice(0, 24),
      text: line,
      module: extractModuleName(line)
    }));
  }

  return content
    .split(/(?<=[。！？\n])/)
    .map((item) => item.trim())
    .filter((item) => item.length > 8)
    .slice(0, 12)
    .map((item, index) => ({
      title: `需求点 ${index + 1}`,
      text: item,
      module: extractModuleName(item)
    }));
}

function buildCase(moduleName, title, type, priority, preconditions, steps, expected) {
  return {
    module: moduleName,
    title,
    type,
    priority,
    preconditions,
    steps: steps.join("\n"),
    expected,
    executionStatus: "未执行",
    executionNote: ""
  };
}

function firstTag(tags) {
  return Array.isArray(tags) && tags.length ? String(tags[0]) : "";
}

function extractModuleFromPath(path) {
  const parts = path.split("/").filter(Boolean);
  return parts[0] || "通用模块";
}

function extractModuleName(text) {
  const match = text.match(/(登录|支付|订单|用户|商品|权限|报表|审批|消息|库存|退款|结算)/);
  return match ? match[1] : "需求模块";
}

function renderAll() {
  renderOnboarding();
  renderMetaControls();
  renderVersionManager();
  renderTaskManager();
  renderQuickStats();
  renderCaseFilters();
  renderCases();
  renderBugs();
  renderReport();
}

function renderOnboarding() {
  const flow = getWorkflowState();
  const steps = [
    {
      key: "bot",
      title: "配置 AI",
      desc: "填写 Key、选择模型，并检测调用是否正常。",
      done: flow.hasBotConfig,
      current: flow.nextAction === "configure-bot"
    },
    {
      key: "meta",
      title: "创建版本",
      desc: "填写本次测试对应的版本号和负责人。",
      done: flow.hasMeta,
      current: flow.nextAction === "create-meta"
    },
    {
      key: "task",
      title: "创建任务",
      desc: "说明这次要测什么，便于后续汇总报告。",
      done: flow.hasTask,
      current: flow.nextAction === "create-task"
    },
    {
      key: "source",
      title: "上传需求/API文档",
      desc: "上传本地文件或填写文档网址，并补充测试范围。",
      done: flow.hasSource || flow.hasCases,
      current: flow.nextAction === "prepare-source"
    },
    {
      key: "cases",
      title: "生成用例",
      desc: "使用 AI 生成测试用例，再进入用例列表执行。",
      done: flow.hasCases,
      current: flow.nextAction === "generate-cases"
    },
    {
      key: "execution",
      title: "执行与 BUG",
      desc: "更新执行结果，发现问题后记录 BUG。",
      done: flow.hasExecutionOrBug,
      current: flow.nextAction === "execute-cases"
    },
    {
      key: "report",
      title: "导出报告",
      desc: "按版本查看汇总结果，并导出测试报告。",
      done: flow.hasExecutionOrBug,
      current: flow.nextAction === "export-report"
    }
  ];

  els.onboardingSteps.innerHTML = steps.map((step, index) => `
    <article class="step-card ${step.current ? "current" : ""}">
      <div class="step-index">${index + 1}</div>
      <div class="step-body">
        <div class="step-head">
          <strong>${escapeHtml(step.title)}</strong>
        </div>
        <p>${escapeHtml(step.desc)}</p>
      </div>
    </article>
  `).join("");
}

function getWorkflowState() {
  const hasBotConfig = Boolean(els.apiKey.value.trim() || settings.envKeyAvailable || settings.apiReady);
  const hasMeta = Boolean(state.activeBatchId && state.activeModuleId);
  const hasTask = Boolean(state.activeTaskId && state.tasks.some((item) => item.id === state.activeTaskId));
  const hasSource = Boolean(uploadedFileContent.trim() || els.sourceUrl.value.trim() || els.sourceText?.value.trim() || state.documents.length);
  const hasCases = Boolean(state.cases.length);
  const hasExecution = state.cases.some((item) => item.executionStatus && item.executionStatus !== "未执行");
  const hasBug = Boolean(state.bugs.length);
  const hasExecutionOrBug = hasExecution || hasBug;
  const hasReportData = Boolean(hasCases);

  if (!hasBotConfig) {
    return {
      hasBotConfig,
      hasMeta,
      hasTask,
      hasSource,
      hasCases,
      hasExecutionOrBug,
      hasReportData,
      nextAction: "configure-bot",
      actionLabel: "先配置机器人",
      tipTitle: "先配置机器人",
      tipBody: "先保存本地 API Key 和模型，后面的 AI 生成才可以直接使用。"
    };
  }

  if (!hasMeta) {
    return {
      hasBotConfig,
      hasMeta,
      hasTask,
      hasSource,
      hasCases,
      hasExecutionOrBug,
      hasReportData,
      nextAction: "create-meta",
      actionLabel: "先保存当前版本",
      tipTitle: "先建立测试范围",
      tipBody: "先选择当前业务、填写版本号，再指定版本负责人。后面生成的用例、BUG、报告都会自动归到这里。"
    };
  }

  if (!hasTask) {
    return {
      hasBotConfig,
      hasMeta,
      hasTask,
      hasSource,
      hasCases,
      hasExecutionOrBug,
      hasReportData,
      nextAction: "create-task",
      actionLabel: "去创建任务",
      tipTitle: "还差测试任务",
      tipBody: "建议一个需求点建一个任务。后面用例、BUG、报告都会自动挂到这个任务下面。"
    };
  }

  if (hasCases && !hasExecutionOrBug) {
    return {
      hasBotConfig,
      hasMeta,
      hasTask,
      hasSource,
      hasCases,
      hasExecutionOrBug,
      hasReportData,
      nextAction: "execute-cases",
      actionLabel: "去执行用例",
      tipTitle: "用例已经准备好",
      tipBody: "下一步去执行页改状态、补备注，需要时新增 BUG，报告会自动跟着更新。"
    };
  }

  if (hasCases) {
    return {
      hasBotConfig,
      hasMeta,
      hasTask,
      hasSource,
      hasCases,
      hasExecutionOrBug,
      hasReportData,
      nextAction: "export-report",
      actionLabel: "去导出报告",
      tipTitle: "主流程已经走通了",
      tipBody: "现在可以切到测试报告页，确认当前批次 / 模块的统计结果，再导出报告。"
    };
  }

  if (!hasSource) {
    return {
      hasBotConfig,
      hasMeta,
      hasTask,
      hasSource,
      hasCases,
      hasExecutionOrBug,
      hasReportData,
      nextAction: "prepare-source",
      actionLabel: "去上传文档",
      tipTitle: "接着准备输入内容",
      tipBody: "如果是本地文件就直接上传；如果是网址就贴链接，再写清楚本次只测哪些功能。"
    };
  }

  if (!hasCases) {
    return {
      hasBotConfig,
      hasMeta,
      hasTask,
      hasSource,
      hasCases,
      hasExecutionOrBug,
      hasReportData,
      nextAction: "generate-cases",
      actionLabel: "去生成用例",
      tipTitle: "现在可以生成或导入用例了",
      tipBody: "现在可以直接用 AI 生成用例，或者下载 CSV 模板手动整理后再导入。"
    };
  }

  return {
    hasBotConfig,
    hasMeta,
    hasTask,
    hasSource,
    hasCases,
    hasExecutionOrBug,
    hasReportData,
    nextAction: "generate-cases",
    actionLabel: "去生成用例",
    tipTitle: "现在可以生成或导入用例了",
    tipBody: "现在可以直接用 AI 生成用例，或者下载 CSV 模板手动整理后再导入。"
  };
}

function getStepAction(stepKey) {
  if (stepKey === "bot") return "configure-bot";
  if (stepKey === "meta") return "create-meta";
  if (stepKey === "task") return "create-task";
  if (stepKey === "source") return "prepare-source";
  if (stepKey === "cases") return "generate-cases";
  if (stepKey === "execution") return "manage-bugs";
  return "export-report";
}

function getStepButtonLabel(stepKey) {
  if (stepKey === "bot") return "去配置";
  if (stepKey === "meta") return "去创建版本";
  if (stepKey === "task") return "去创建任务";
  if (stepKey === "source") return "去准备内容";
  if (stepKey === "cases") return "去生成用例";
  if (stepKey === "execution") return "去看BUG";
  return "去导出";
}

function handleShortcutAction(action) {
  if (!action) {
    return;
  }

  if (action === "configure-bot") {
    switchTab("upload");
    els.apiKey.focus();
    return;
  }

  if (action === "create-meta" || action === "prepare-source" || action === "generate-cases") {
    switchTab("upload");
    if (action === "create-meta") {
      els.batchVersionInput.focus();
    }
    if (action === "create-task") {
      els.taskNameInput.focus();
    }
    if (action === "prepare-source") {
      if (els.sourceType.value === "url") {
        els.sourceUrl.focus();
      } else {
        els.documentInput.click();
      }
    }
    if (action === "generate-cases") {
      els.generateCases.focus();
    }
    return;
  }

  if (action === "create-task") {
    switchTab("upload");
    els.taskNameInput.focus();
    return;
  }

  if (action === "execute-cases") {
    switchTab("cases");
    return;
  }

  if (action === "manage-bugs") {
    switchTab("bugs");
    return;
  }

  if (action === "export-report") {
    switchTab("report");
  }
}

function renderMetaControls() {
  fillSelectFromItems(els.activeBatchSelect, state.batches, "未选择", state.activeBatchId, formatBatchLabel);
  fillSelectFromItems(els.activeModuleSelect, state.modules, "未选择", state.activeModuleId, (item) => item.name);
  fillSelectFromItems(els.taskBatchSelect, state.batches, "请选择版本", els.taskBatchSelect.value || state.activeBatchId, (item) => formatTaskBatchLabel(item));
  fillOwnerSelect(els.batchOwnerSelect, editingBatchId ? (getBatchById(editingBatchId)?.owner || "") : "");
  fillOwnerSelect(els.taskOwnerSelect, editingTaskId ? (getTaskById(editingTaskId)?.owner || "") : "");
  const activeTask = getTaskById(state.activeTaskId);
  const generationBatch = getBatchById(activeTask?.batchId || state.generationBatchId);
  const generationModule = getModuleById(activeTask?.moduleId || generationBatch?.moduleId);

  els.currentVersionSummary.innerHTML = "";
  els.currentTaskSummary.innerHTML = "";

  els.generationVersionSummary.innerHTML = `
    <label class="generation-version-field">
      <span class="summary-label">关联测试任务</span>
      <select id="generationTaskSelect">
        <option value="">请选择任务</option>
        ${state.tasks.map((item) => `<option value="${item.id}" ${item.id === state.activeTaskId ? "selected" : ""}>${escapeHtml(formatTaskLabel(item))}</option>`).join("")}
      </select>
    </label>
    ${activeTask
      ? `
        <div class="version-summary-card generation-version-card">
          <strong>${escapeHtml(activeTask.name || "")}</strong>
          <p>${escapeHtml([generationBatch?.version || "", generationModule?.name || activeTask.moduleName || ""].filter(Boolean).join(" / "))}</p>
        </div>
      `
      : `
        <div class="version-summary-card version-summary-empty generation-version-card">
          <strong>还没有可关联的任务</strong>
          <p>请先在上面保存测试任务，然后在这里选择要生成用例的任务。</p>
        </div>
      `}
  `;

  const generationTaskSelect = document.getElementById("generationTaskSelect");
  if (generationTaskSelect) {
    generationTaskSelect.addEventListener("change", handleGenerationTaskChange);
  }
}

function renderTaskManager() {
  if (!els.taskManagerList) {
    return;
  }
  els.taskManagerList.innerHTML = "";
}

function renderVersionManager() {
  if (!state.batches.length) {
    els.versionManagerList.innerHTML = `
      <div class="empty-state empty-state-rich">
        <strong>还没有版本记录</strong>
        <p>先在“文档与生成”页按 4 步保存一个版本，这里就会出现。</p>
      </div>
    `;
    return;
  }

  els.versionManagerList.innerHTML = "";
  state.batches.forEach((batch) => {
    const relatedTasks = state.tasks.filter((task) => task.batchId === batch.id);
    const isActive = batch.id === state.activeBatchId;
    const isSuspended = batch.status === "已挂起";
    const isCompleted = batch.status === "已完成";
    const ownerText = getOwnerDisplay(batch.owners || batch.owner) || "未分配";
    const node = document.createElement("article");
    node.className = "list-card version-card";
    node.innerHTML = `
      <div class="version-card-shell">
        <div class="version-card-header">
          <div class="version-card-title-block">
            <div class="version-card-kicker">版本</div>
            <h3 class="case-title-text">${escapeHtml(batch.version || "未命名版本")}</h3>
            <div class="card-meta version-card-badges">
              <span class="badge subtle ${isCompleted ? "tone-green" : isSuspended ? "tone-gray" : "tone-orange"}">${escapeHtml(batch.status || "进行中")}</span>
              <span class="badge subtle">${relatedTasks.length} 个任务</span>
              ${isActive ? `<span class="badge tone-orange">当前版本</span>` : ""}
            </div>
          </div>
          <div class="version-card-summary">
            <div class="version-summary-chip">
              <span>负责人</span>
              <strong>${escapeHtml(ownerText)}</strong>
            </div>
            <div class="version-summary-chip">
              <span>可操作状态</span>
              <strong>${escapeHtml(isCompleted ? "只读查看" : isSuspended ? "已挂起" : "可继续编辑")}</strong>
            </div>
          </div>
        </div>

        <div class="version-card-toolbar">
          <div class="card-actions version-card-actions">
            <button class="ghost-button tiny-button toggle-version-detail">展开详情</button>
            ${!isActive && !isSuspended ? `<button class="ghost-button tiny-button" data-version-action="activate" data-version-id="${batch.id}">设为当前</button>` : ""}
            ${!isCompleted ? `<button class="ghost-button tiny-button" data-version-action="edit" data-version-id="${batch.id}">编辑</button>` : `<span class="summary-label version-lock-text">已完成版本仅支持查看</span>`}
            ${!isCompleted ? `<button class="ghost-button tiny-button" data-version-action="complete" data-version-id="${batch.id}">标记完成</button>` : ""}
            ${!isCompleted ? `<button class="ghost-button tiny-button" data-version-action="${isSuspended ? "resume" : "suspend"}" data-version-id="${batch.id}">${isSuspended ? "恢复" : "挂起"}</button>` : ""}
            ${isCompleted ? `<span class="summary-label version-lock-text">已完成版本不可删除</span>` : `<button class="danger-link" data-version-action="delete" data-version-id="${batch.id}">删除</button>`}
          </div>
        </div>

        <div class="version-card-detail hidden-field">
          <div class="version-card-body">
            <div class="summary-block version-owner-panel">
              <span class="summary-label">版本负责人</span>
              <p>${escapeHtml(ownerText)}</p>
            </div>
          </div>
          <div class="version-task-section">
            <div class="version-task-head">
              <strong>测试任务列表</strong>
              <span class="summary-label">同版本任务统一收在这里管理</span>
            </div>
            <div class="version-task-list">
              ${relatedTasks.length ? relatedTasks.map((task) => {
      const isTaskActive = task.id === state.activeTaskId;
      const taskReadonly = isCompleted;
      return `
                  <article class="version-task-card">
                    <div class="version-task-top">
                      <div>
                        <span class="version-task-kicker">测试任务</span>
                        <strong>${escapeHtml(task.name || "未命名任务")}</strong>
                        <div class="card-meta">
                          ${isTaskActive ? `<span class="badge tone-orange">当前任务</span>` : ""}
                        </div>
                      </div>
                      <div class="card-actions version-task-actions">
                        ${!isTaskActive ? `<button class="ghost-button tiny-button" data-task-action="activate" data-task-id="${task.id}">设为当前</button>` : ""}
                        ${!taskReadonly ? `<button class="ghost-button tiny-button" data-task-action="edit" data-task-id="${task.id}">编辑</button>` : `<span class="summary-label version-lock-text">任务仅支持查看</span>`}
                        ${!taskReadonly ? `<button class="danger-link" data-task-action="delete" data-task-id="${task.id}">删除</button>` : ""}
                      </div>
                    </div>
                    <div class="version-task-grid">
                      <div class="summary-block">
                        <span class="summary-label">测试内容</span>
                        <p>${escapeHtml(task.scope || "未填写")}</p>
                      </div>
                      <div class="summary-block">
                        <span class="summary-label">负责人</span>
                        <p>${escapeHtml(getOwnerDisplay(task.owners || task.owner) || "未分配")}</p>
                      </div>
                    </div>
                  </article>
                `;
    }).join("") : `
                <div class="empty-state empty-state-rich compact-empty-state">
                  <strong>这个版本还没有任务</strong>
                  <p>先回到文档与生成页，为当前版本新增测试任务。</p>
                </div>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
    bindVersionCard(node, batch.id, relatedTasks.map((task) => task.id));
    els.versionManagerList.appendChild(node);
  });
}

function bindVersionCard(node, batchId, taskIds = []) {
  const detail = node.querySelector(".version-card-detail");
  const toggle = node.querySelector(".toggle-version-detail");
  if (detail && toggle) {
    toggle.addEventListener("click", () => {
      const isHidden = detail.classList.contains("hidden-field");
      detail.classList.toggle("hidden-field", !isHidden);
      toggle.textContent = isHidden ? "收起详情" : "展开详情";
    });
  }

  node.querySelectorAll("[data-version-action]").forEach((button) => {
    button.addEventListener("click", () => {
      handleVersionAction(button.dataset.versionAction, batchId);
    });
  });

  taskIds.forEach((taskId) => bindTaskCard(node, taskId));
}

function bindTaskCard(node, taskId) {
  node.querySelectorAll(`[data-task-id="${taskId}"][data-task-action]`).forEach((button) => {
    button.addEventListener("click", () => {
      handleTaskAction(button.dataset.taskAction, taskId);
    });
  });
}

function handleVersionAction(action, batchId) {
  const batch = getBatchById(batchId);
  if (!batch) {
    return;
  }

  if (batch.status === "已完成" && ["edit", "suspend", "resume", "delete"].includes(action)) {
    setGenerationStatus(`版本 ${formatBatchLabel(batch)} 已完成，只支持查看。`, "warn");
    return;
  }

  if (action === "activate") {
    state.activeBatchId = batch.id;
    state.generationBatchId = batch.id;
    state.activeModuleId = batch.moduleId || "";
    state.activeTaskId = state.tasks.find((item) => item.batchId === batch.id)?.id || "";
    persist();
    renderAll();
    setGenerationStatus(`已切换到版本：${formatBatchLabel(batch)}。`, "ok");
    return;
  }

  if (action === "edit") {
    editingBatchId = batch.id;
    els.batchVersionInput.value = batch.version || "";
    els.activeModuleSelect.value = batch.moduleId || "";
    fillOwnerSelect(els.batchOwnerSelect, batch.owner || "");
    els.createBatchBtn.textContent = "保存版本修改";
    autoResizeTextarea();
    switchTab("upload");
    els.batchVersionInput.focus();
    setGenerationStatus(`正在编辑版本：${formatBatchLabel(batch)}。`, "neutral");
    return;
  }

  if (action === "suspend" || action === "resume") {
    const nextStatus = action === "suspend" ? "已挂起" : "进行中";
    state.batches = state.batches.map((item) => (
      item.id === batch.id ? { ...item, status: nextStatus } : item
    ));
    if (action === "suspend" && state.activeBatchId === batch.id) {
      state.activeBatchId = "";
    }
    if (action === "suspend" && state.generationBatchId === batch.id) {
      state.generationBatchId = state.activeBatchId || state.batches.find((item) => item.id !== batch.id && item.status !== "已挂起")?.id || "";
    }
    if (action === "suspend" && state.tasks.some((item) => item.batchId === batch.id && item.id === state.activeTaskId)) {
      state.activeTaskId = state.tasks.find((item) => item.batchId !== batch.id)?.id || "";
    }
    persist();
    renderAll();
    setGenerationStatus(`${action === "suspend" ? "已挂起" : "已恢复"}版本：${formatBatchLabel(batch)}。`, "ok");
    return;
  }

  if (action === "complete") {
    const taskIdsToClear = state.tasks.filter((item) => item.batchId === batch.id).map((item) => item.id);
    state.batches = state.batches.map((item) => (
      item.id === batch.id ? { ...item, status: "已完成" } : item
    ));
    state.cases = state.cases.filter((item) => item.batchId !== batch.id && !taskIdsToClear.includes(item.taskId));
    persist();
    renderAll();
    setGenerationStatus(`已完成版本：${formatBatchLabel(batch)}。该版本下的测试用例已清空。`, "ok");
    return;
  }

  if (action === "delete") {
    if (batch.status === "已完成") {
      setGenerationStatus(`版本 ${formatBatchLabel(batch)} 已完成，不能删除。`, "warn");
      return;
    }
    const relatedTaskCount = state.tasks.filter((item) => item.batchId === batch.id).length;
    const confirmed = window.confirm([
      `确认删除版本：${batch.version || "未命名版本"}？`,
      `该版本下共有 ${relatedTaskCount} 个任务，相关用例和 BUG 记录也会一起删除。`,
      "",
      "删除后不可恢复。"
    ].join("\n"));
    if (!confirmed) {
      return;
    }
    const taskIdsToDelete = state.tasks.filter((item) => item.batchId === batch.id).map((item) => item.id);
    state.batches = state.batches.filter((item) => item.id !== batch.id);
    state.tasks = state.tasks.filter((item) => item.batchId !== batch.id);
    state.cases = state.cases.filter((item) => item.batchId !== batch.id && !taskIdsToDelete.includes(item.taskId));
    state.bugs = state.bugs.filter((item) => item.batchId !== batch.id && !taskIdsToDelete.includes(item.taskId));
    if (state.activeBatchId === batch.id) {
      state.activeBatchId = "";
    }
    if (state.generationBatchId === batch.id) {
      state.generationBatchId = state.activeBatchId || state.batches[0]?.id || "";
    }
    if (taskIdsToDelete.includes(state.activeTaskId)) {
      state.activeTaskId = state.tasks[0]?.id || "";
    }
    if (editingBatchId === batch.id) {
      editingBatchId = "";
      els.createBatchBtn.textContent = "4. 保存当前版本";
      els.batchVersionInput.value = "";
      fillOwnerSelect(els.batchOwnerSelect, "");
      autoResizeTextarea();
    }
    persist();
    renderAll();
    setGenerationStatus(`已删除版本：${formatBatchLabel(batch)}。`, "warn");
  }
}

function handleTaskAction(action, taskId) {
  const task = getTaskById(taskId);
  if (!task) {
    return;
  }
  const batch = getBatchById(task.batchId);

  if (batch?.status === "已完成" && ["edit", "delete"].includes(action)) {
    setGenerationStatus(`版本 ${formatBatchLabel(batch)} 已完成，已有任务只支持查看。`, "warn");
    return;
  }

  if (action === "activate") {
    state.activeTaskId = task.id;
    state.generationBatchId = task.batchId || "";
    state.activeBatchId = task.batchId || state.activeBatchId;
    state.activeModuleId = task.moduleId || state.activeModuleId;
    persist();
    renderAll();
    setGenerationStatus(`已切换到任务：${task.name}。`, "ok");
    return;
  }

  if (action === "edit") {
    editingTaskId = task.id;
    els.taskBatchSelect.value = task.batchId || "";
    els.taskNameInput.value = task.name || "";
    els.taskScopeInput.value = task.scope || "";
    fillOwnerSelect(els.taskOwnerSelect, task.owner || "");
    els.createTaskBtn.textContent = "保存任务修改";
    autoResizeTextarea();
    switchTab("upload");
    els.taskNameInput.focus();
    setGenerationStatus(`正在编辑任务：${task.name}。`, "neutral");
    return;
  }

  if (action === "delete") {
    state.tasks = state.tasks.filter((item) => item.id !== task.id);
    state.cases = state.cases.filter((item) => item.taskId !== task.id);
    state.bugs = state.bugs.filter((item) => item.taskId !== task.id);
    if (state.activeTaskId === task.id) {
      state.activeTaskId = state.tasks[0]?.id || "";
    }
    if (editingTaskId === task.id) {
      editingTaskId = "";
      els.taskBatchSelect.value = "";
      els.taskNameInput.value = "";
      els.taskScopeInput.value = "";
      fillOwnerSelect(els.taskOwnerSelect, "");
      els.createTaskBtn.textContent = "保存当前任务";
      autoResizeTextarea();
    }
    persist();
    renderAll();
    setGenerationStatus(`已删除任务：${task.name}。`, "warn");
  }
}

function fillSelectFromItems(select, items, emptyLabel, selectedValue, labelFn) {
  select.innerHTML = [`<option value="">${emptyLabel}</option>`]
    .concat(items.map((item) => `<option value="${item.id}">${escapeHtml(labelFn(item))}</option>`))
    .join("");
  select.value = items.some((item) => item.id === selectedValue) ? selectedValue : "";
}

function fillOwnerSelect(select, selectedValue = "", emptyLabel = "未选择") {
  if (!select) {
    return;
  }
  const members = normalizeTeamMembers([...state.teamMembers, ...splitOwnerValues(selectedValue)]);
  select.innerHTML = [`<option value="">${emptyLabel}</option>`]
    .concat(members.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`))
    .join("");
  select.value = selectedValue && members.includes(selectedValue) ? selectedValue : "";
}

function splitOwnerValues(value) {
  if (Array.isArray(value)) {
    return normalizeTeamMembers(value);
  }
  return normalizeTeamMembers(String(value || "").split(/[、,，/]/));
}

function getOwnerDisplay(value) {
  return splitOwnerValues(value).join("、");
}

function getReportOwners(scope) {
  const taskMap = new Map(state.tasks.map((item) => [item.id, item]));
  const owners = [];

  if (scope.task) {
    owners.push(...splitOwnerValues(scope.task.owners || scope.task.owner));
  } else {
    const taskIds = [...new Set(scope.cases.map((item) => item.taskId).filter(Boolean))];
    taskIds.forEach((taskId) => {
      const task = taskMap.get(taskId);
      if (task) {
        owners.push(...splitOwnerValues(task.owners || task.owner));
      }
    });
  }

  if (!owners.length && scope.batch) {
    owners.push(...splitOwnerValues(scope.batch.owners || scope.batch.owner));
  }

  return normalizeTeamMembers(owners);
}

function renderTeamMembers() {
  if (!els.teamMemberList) {
    return;
  }

  if (!state.teamMembers.length) {
    els.teamMemberList.innerHTML = `
      <div class="empty-state empty-state-rich">
        <strong>还没有成员</strong>
        <p>先加上测试、开发、产品等常用负责人，后面直接选择就行。</p>
      </div>
    `;
    return;
  }

  els.teamMemberList.innerHTML = state.teamMembers.map((member) => `
    <article class="list-card team-member-card">
      <div class="card-top">
        <div>
          <strong>${escapeHtml(member)}</strong>
        </div>
        <button class="danger-link" data-action="delete-team-member" data-member-name="${escapeHtml(member)}">删除</button>
      </div>
    </article>
  `).join("");
}

function addTeamMember() {
  const name = els.teamMemberInput?.value.trim();
  if (!name) {
    setGenerationStatus("先输入成员名称。", "warn");
    return;
  }
  if (state.teamMembers.includes(name)) {
    setGenerationStatus("这个成员已经存在了。", "warn");
    return;
  }
  state.teamMembers.push(name);
  state.teamMembers = normalizeTeamMembers(state.teamMembers);
  if (els.teamMemberInput) {
    els.teamMemberInput.value = "";
  }
  persist();
  renderAll();
  setGenerationStatus(`已新增成员：${name}。`, "ok");
}

function deleteTeamMember(name) {
  if (!name) {
    return;
  }
  state.teamMembers = state.teamMembers.filter((item) => item !== name);
  state.batches = state.batches.map((item) => {
    const owners = splitOwnerValues(item.owners || item.owner).filter((owner) => owner !== name);
    return { ...item, owners, owner: owners.join("、") };
  });
  state.tasks = state.tasks.map((item) => {
    const owners = splitOwnerValues(item.owners || item.owner).filter((owner) => owner !== name);
    return { ...item, owners, owner: owners.join("、") };
  });
  state.bugs = state.bugs.map((item) => (item.owner === name ? { ...item, owner: "" } : item));
  persist();
  renderAll();
  setGenerationStatus(`已删除成员：${name}。相关负责人已清空。`, "warn");
}

function formatBatchLabel(batch) {
  return batch.version ? `${batch.name} ${batch.version}` : batch.name;
}

function formatTaskBatchLabel(batch) {
  if (!batch) {
    return "未关联版本";
  }
  return batch.version || "未命名版本";
}

function formatTaskLabel(task) {
  return [task.name || "未命名任务", task.batchVersion || getBatchVersionById(task.batchId)].filter(Boolean).join(" / ");
}

function getBatchById(batchId) {
  return state.batches.find((item) => item.id === batchId);
}

function getTaskById(taskId) {
  return state.tasks.find((item) => item.id === taskId);
}

function getModuleById(moduleId) {
  return state.modules.find((item) => item.id === moduleId);
}

function getBatchLabelById(batchId) {
  const batch = getBatchById(batchId);
  return batch ? formatBatchLabel(batch) : "";
}

function getBatchVersionById(batchId) {
  const batch = getBatchById(batchId);
  return batch?.version || "";
}

function getTaskNameById(taskId) {
  return getTaskById(taskId)?.name || "";
}

function getModuleNameById(moduleId) {
  const moduleItem = getModuleById(moduleId);
  return moduleItem ? moduleItem.name : "";
}

function slugifyBusiness(name) {
  return `business-${String(name).replace(/\s+/g, "-")}`;
}

function normalizeBusinessName(value) {
  const text = String(value || "").trim();
  if (BUSINESS_ALIAS_MAP[text]) {
    return BUSINESS_ALIAS_MAP[text];
  }
  if (text.includes("VA")) return "VA业务";
  if (text.includes("CARD") || text.includes("卡收单")) return "卡收单业务";
  if (text.includes("数字货币")) return "数字货币业务";
  if (text.includes("代付")) return "代付业务";
  if (text.includes("本地收单")) return "本地收单业务";
  return "";
}

function normalizeModuleId(value) {
  const normalizedName = normalizeBusinessName(value.replace?.(/^business-/, "") || value);
  return normalizedName ? slugifyBusiness(normalizedName) : "";
}

function normalizeBatchItem(item) {
  const moduleName = normalizeBusinessName(item.moduleName || item.name);
  const owners = splitOwnerValues(item.owners || item.owner);
  return {
    ...item,
    name: moduleName || item.name,
    moduleName: moduleName || item.moduleName || item.name,
    moduleId: moduleName ? slugifyBusiness(moduleName) : item.moduleId || "",
    owner: owners.join("、"),
    owners
  };
}

function normalizeTaskItem(item) {
  const linkedBatch = getBatchById(item.batchId);
  const moduleName = normalizeBusinessName(item.moduleName || linkedBatch?.moduleName || linkedBatch?.name);
  const owners = splitOwnerValues(item.owners || item.owner);
  return {
    ...item,
    batchId: item.batchId || "",
    batchVersion: item.batchVersion || linkedBatch?.version || "",
    batchName: item.batchName || (linkedBatch ? formatBatchLabel(linkedBatch) : ""),
    moduleName: moduleName || item.moduleName || "",
    moduleId: moduleName ? slugifyBusiness(moduleName) : item.moduleId || linkedBatch?.moduleId || "",
    owner: owners.join("、"),
    owners,
    status: item.status || "进行中"
  };
}

function normalizeCaseItem(item) {
  const moduleName = normalizeBusinessName(item.module || item.moduleName);
  return {
    ...item,
    taskId: item.taskId || "",
    taskName: item.taskName || "",
    module: moduleName || item.module,
    moduleId: moduleName ? slugifyBusiness(moduleName) : item.moduleId || ""
  };
}

function normalizeBugItem(item) {
  const moduleName = normalizeBusinessName(item.moduleName);
  return {
    ...item,
    taskId: item.taskId || "",
    taskName: item.taskName || "",
    moduleName: moduleName || item.moduleName,
    moduleId: moduleName ? slugifyBusiness(moduleName) : item.moduleId || "",
    owner: String(item.owner || "").trim()
  };
}

function normalizeTeamMembers(list) {
  return [...new Set((list || []).map((item) => String(item || "").trim()).filter(Boolean))];
}

function collectOwnersIntoTeamMembers() {
  const owners = [
    ...state.batches.flatMap((item) => splitOwnerValues(item.owners || item.owner)),
    ...state.tasks.flatMap((item) => splitOwnerValues(item.owners || item.owner)),
    ...state.bugs.map((item) => item.owner)
  ];
  state.teamMembers = normalizeTeamMembers([...state.teamMembers, ...owners]);
}

function getCaseModules() {
  return [...new Set(state.cases.map((item) => item.module).filter(Boolean))];
}

function getCaseTasks() {
  return [...new Set(state.cases.map((item) => item.taskName).filter(Boolean))];
}

function getTasksByBatchForFilters(batchId, source = "all") {
  const taskPool = state.tasks.map((item) => ({
    id: item.id || item.name,
    name: item.name,
    batchId: item.batchId
  }));
  const fallbackPool = source === "bugs"
    ? state.bugs.map((item) => ({ id: item.taskId || item.taskName, name: item.taskName, batchId: item.batchId }))
    : state.cases.map((item) => ({ id: item.taskId || item.taskName, name: item.taskName, batchId: item.batchId }));
  const baseTasks = [...taskPool, ...fallbackPool];

  return [...new Map(
    baseTasks
      .filter((item) => item.name)
      .filter((item) => !batchId || item.batchId === batchId)
      .map((item) => [item.name, item])
  ).values()];
}

function getFilteredCasesForView() {
  const batchFilter = els.caseBatchFilter.value;
  const taskFilter = els.caseTaskFilter.value;

  return state.cases.filter((item) => {
    return (!batchFilter || item.batchId === batchFilter)
      && (!taskFilter || item.taskName === taskFilter);
  });
}

function getFilteredBugs() {
  const batchFilter = els.bugBatchFilter.value;
  const taskFilter = els.bugTaskFilter.value;

  return state.bugs.filter((bug) => {
    const byBatch = !batchFilter || bug.batchId === batchFilter;
    const byTask = !taskFilter || bug.taskName === taskFilter;
    return byBatch && byTask;
  });
}

function getReportScope() {
  const activeTask = getTaskById(state.activeTaskId);
  const activeBatch = getBatchById(state.activeBatchId || activeTask?.batchId);
  const activeModule = getModuleById(state.activeModuleId || activeTask?.moduleId || activeBatch?.moduleId);

  const cases = state.cases.filter((item) => {
    return (!activeBatch || item.batchId === activeBatch.id)
      && (!activeTask || item.taskId === activeTask.id)
      && (!activeModule || item.moduleId === activeModule.id || item.module === activeModule.name);
  });

  const caseIds = new Set(cases.map((item) => item.id));
  const bugs = state.bugs.filter((bug) => {
    const byBatch = !activeBatch || bug.batchId === activeBatch.id;
    const byTask = !activeTask || bug.taskId === activeTask.id;
    const byModule = !activeModule || bug.moduleId === activeModule.id || bug.moduleName === activeModule.name;
    const byCase = !bug.caseId || caseIds.has(bug.caseId) || !cases.length;
    return byBatch && byTask && byModule && byCase;
  });

  return {
    batch: activeBatch,
    task: activeTask,
    module: activeModule,
    cases,
    bugs
  };
}

function getReportScopeByBatch(batchId) {
  const batch = getBatchById(batchId);
  const tasks = state.tasks.filter((item) => item.batchId === batchId);
  const taskIds = new Set(tasks.map((item) => item.id));
  const cases = state.cases.filter((item) => item.batchId === batchId || taskIds.has(item.taskId));
  const caseIds = new Set(cases.map((item) => item.id));
  const bugs = state.bugs.filter((item) => {
    const byBatch = item.batchId === batchId || taskIds.has(item.taskId);
    const byCase = !item.caseId || caseIds.has(item.caseId) || !cases.length;
    return byBatch && byCase;
  });

  return {
    batch,
    task: null,
    module: batch?.moduleId ? getModuleById(batch.moduleId) : null,
    tasks,
    cases,
    bugs
  };
}

function renderCaseFilters() {
  fillSelectFromItems(els.caseBatchFilter, state.batches, "全部版本", els.caseBatchFilter.value, formatTaskBatchLabel);
  fillSelectFromItems(els.bugBatchFilter, state.batches, "全部版本", els.bugBatchFilter.value, formatTaskBatchLabel);

  const caseTasks = getTasksByBatchForFilters(els.caseBatchFilter.value, "cases");
  const bugTasks = getTasksByBatchForFilters(els.bugBatchFilter.value, "bugs");
  const caseTaskNames = caseTasks.map((item) => item.name);
  const bugTaskNames = bugTasks.map((item) => item.name);
  const caseTaskValue = caseTaskNames.includes(els.caseTaskFilter.value) ? els.caseTaskFilter.value : "";
  const bugTaskValue = bugTaskNames.includes(els.bugTaskFilter.value) ? els.bugTaskFilter.value : "";

  els.caseTaskFilter.innerHTML = `<option value="">全部任务</option>${caseTasks.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join("")}`;
  els.bugTaskFilter.innerHTML = `<option value="">全部任务</option>${bugTasks.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join("")}`;

  els.caseTaskFilter.value = caseTaskValue;
  els.bugTaskFilter.value = bugTaskValue;
}

function getReportConclusionForBatch(batchId) {
  if (!batchId) {
    return state.reportConclusion || "";
  }
  return state.reportConclusions?.[batchId] || "";
}

function setReportConclusionForBatch(batchId, value) {
  if (!batchId) {
    state.reportConclusion = value;
    return;
  }
  state.reportConclusions = {
    ...(state.reportConclusions || {}),
    [batchId]: value
  };
  state.reportConclusion = value;
}

function getReportBatchCards() {
  return state.batches.map((batch) => {
    const scope = getReportScopeByBatch(batch.id);
    const report = buildReportViewModel(scope);
    return {
      batch,
      report
    };
  });
}

function renderQuickStats() {
  const executedCount = state.cases.filter((item) => item.executionStatus !== "未执行").length;
  const bugOpenCount = state.bugs.filter((bug) => !["已验证", "已关闭"].includes(bug.status)).length;
  const activeTask = getTaskById(state.activeTaskId);
  const activeBatch = getBatchById(state.activeBatchId || activeTask?.batchId);
  const activeModule = getModuleById(state.activeModuleId || activeTask?.moduleId || activeBatch?.moduleId);
  if (!els.quickStats || !els.sidebarContext) {
    return;
  }
  const stats = [
    ["文档数", state.documents.length],
    ["用例数", state.cases.length],
    ["已执行", executedCount],
    ["待跟进BUG", bugOpenCount]
  ];

  els.quickStats.innerHTML = stats.map(([label, value]) => `
    <div class="stat-item">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `).join("");

  if (els.sidebarContext) {
    const contextItems = [
      ["当前版本", activeBatch?.version || "未设置"],
      ["当前任务", activeTask?.name || "未设置"],
      ["当前业务", activeModule?.name || activeTask?.moduleName || activeBatch?.moduleName || "未设置"]
    ];

    els.sidebarContext.innerHTML = contextItems.map(([label, value]) => `
      <div class="sidebar-context-item">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `).join("");
  }
}

function renderCases() {
  const filtered = getFilteredCasesForView();

  if (!filtered.length) {
    els.caseList.innerHTML = `
      <div class="empty-state empty-state-rich">
        <strong>这里还没有测试用例</strong>
        <p>先去生成用例，或者直接上传现成 CSV。</p>
        <div class="empty-actions">
          <button class="primary-button" data-action="generate-cases">去生成用例</button>
        </div>
      </div>
    `;
    return;
  }

  els.caseList.innerHTML = "";
  filtered.forEach((item) => {
    const node = els.caseTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".case-title-text").textContent = item.title;
    node.querySelector(".case-version").textContent = item.batchVersion || "未带版本";
    node.querySelector(".case-task").textContent = item.taskName || "未分任务";

    const statusBadge = node.querySelector(".case-status");
    const priorityBadge = node.querySelector(".case-priority");
    const executionBadge = node.querySelector(".case-execution-badge");
    const executionSelect = node.querySelector(".case-execution-select");
    const executionNote = node.querySelector(".case-execution-note");
    const caseToBug = node.querySelector(".case-to-bug");
    statusBadge.textContent = item.executionStatus || "未执行";
    priorityBadge.textContent = item.priority;
    applyBadgeTone(statusBadge, getExecutionStatusTone(item.executionStatus || "未执行"));
    applyBadgeTone(priorityBadge, getPriorityTone(item.priority));
    executionSelect.value = item.executionStatus || "未执行";
    syncExecutionStatusBadge(executionBadge, item.executionStatus || "未执行");
    executionNote.value = item.executionNote || "";
    caseToBug.classList.toggle("hidden-field", item.executionStatus !== "失败");

    node.querySelector(".case-preconditions-preview").textContent = truncateText(item.preconditions, 90);
    node.querySelector(".case-steps-preview").textContent = truncateText(item.steps, 110);
    node.querySelector(".case-preconditions-full").textContent = item.preconditions || "无";
    node.querySelector(".case-steps-full").textContent = item.steps || "无";
    node.querySelector(".case-expected-full").textContent = item.expected || "无";

    executionSelect.addEventListener("change", (event) => {
      item.executionStatus = event.target.value;
      statusBadge.textContent = item.executionStatus;
      applyBadgeTone(statusBadge, getExecutionStatusTone(item.executionStatus));
      syncExecutionStatusBadge(executionBadge, item.executionStatus);
      caseToBug.classList.toggle("hidden-field", item.executionStatus !== "失败");
      persist();
      renderQuickStats();
      renderReport();
    });

    executionNote.addEventListener("input", (event) => {
      item.executionNote = event.target.value.trim();
      persist();
    });

    caseToBug.addEventListener("click", () => {
      createBugRecord(item);
      switchTab("bugs");
    });

    bindCaseCard(node, item.id);
    els.caseList.appendChild(node);
  });
}

function bindCaseCard(node, caseId) {
  const detail = node.querySelector(".case-detail");
  const toggle = node.querySelector(".toggle-case-detail");
  toggle.addEventListener("click", () => {
    const isHidden = detail.classList.contains("hidden-field");
    detail.classList.toggle("hidden-field", !isHidden);
    toggle.textContent = isHidden ? "收起详情" : "展开详情";
  });

  node.querySelector(".delete-case").addEventListener("click", () => {
    state.cases = state.cases.filter((item) => item.id !== caseId);
    state.bugs = state.bugs.filter((item) => item.caseId !== caseId);
    persist();
    renderAll();
  });
}

function truncateText(text, limit) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!value) {
    return "无";
  }
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function createBugRecord(sourceCase) {
  const firstCase = sourceCase || getFilteredExecutionCases()[0] || state.cases[0];
  const activeBatch = getBatchById(state.activeBatchId);
  const activeTask = getTaskById(state.activeTaskId);
  const activeModule = getModuleById(state.activeModuleId);
  const linkedBug = firstCase ? state.bugs.find((item) => item.caseId === firstCase.id && !["已修复", "已验证", "已关闭"].includes(item.status)) : null;

  if (linkedBug) {
    switchTab("bugs");
    setGenerationStatus("这个失败用例已经有关联的未关闭 BUG 了。", "warn");
    return;
  }

  state.bugs.unshift({
    id: `bug-${Date.now()}`,
    title: firstCase ? `${firstCase.title} - 缺陷记录` : "新BUG",
    caseId: firstCase ? firstCase.id : "",
    taskId: firstCase?.taskId || activeTask?.id || "",
    taskName: firstCase?.taskName || activeTask?.name || "",
    batchId: firstCase?.batchId || activeBatch?.id || "",
    batchVersion: firstCase?.batchVersion || activeBatch?.version || "",
    batchName: firstCase?.batchName || (activeBatch ? formatBatchLabel(activeBatch) : ""),
    moduleId: firstCase?.moduleId || activeModule?.id || "",
    moduleName: firstCase?.module || activeModule?.name || "",
    severity: "中",
    status: "新建",
    owner: splitOwnerValues(activeTask?.owners || activeTask?.owner)[0] || splitOwnerValues(activeBatch?.owners || activeBatch?.owner)[0] || "",
    link: "",
    note: buildBugNoteFromCase(firstCase)
  });

  persist();
  renderAll();
  switchTab("bugs");
  setGenerationStatus(firstCase ? "已从失败用例生成 BUG 记录。" : "已新增 BUG 记录。", "ok");
}

function buildBugNoteFromCase(caseItem) {
  if (!caseItem) {
    return "";
  }
  return [
    `关联用例：${caseItem.title || "未命名用例"}`,
    `执行状态：${caseItem.executionStatus || "未执行"}`,
    caseItem.executionNote ? `执行备注：${caseItem.executionNote}` : "",
    caseItem.expected ? `预期结果：${caseItem.expected}` : ""
  ].filter(Boolean).join("\n");
}

function renderBugs() {
  const filteredBugs = getFilteredBugs();
  if (!filteredBugs.length) {
    els.bugList.innerHTML = `
      <div class="empty-state empty-state-rich">
        <strong>当前范围里还没有 BUG 记录</strong>
        <p>执行时发现问题，再点“新增BUG”补进来就行。</p>
        ${state.cases.length ? `<div class="empty-actions"><button class="primary-button" id="emptyAddBugBtn">新增BUG</button></div>` : ""}
      </div>
    `;
    const emptyAddBugBtn = document.getElementById("emptyAddBugBtn");
    if (emptyAddBugBtn) {
      emptyAddBugBtn.addEventListener("click", createBugRecord);
    }
    return;
  }

  els.bugList.innerHTML = "";
  filteredBugs.forEach((bug) => {
    const node = els.bugTemplate.content.firstElementChild.cloneNode(true);
    const detail = node.querySelector(".bug-detail");
    const detailToggle = node.querySelector(".toggle-bug-detail");
    node.querySelector(".bug-title").value = bug.title;
    fillCaseOptions(node.querySelector(".bug-case"), bug.caseId);
    fillSelectFromItems(node.querySelector(".bug-batch"), state.batches, "未选择", bug.batchId, formatBatchLabel);
    fillSelectFromItems(node.querySelector(".bug-module"), state.modules, "未选择", bug.moduleId, (item) => item.name);
    node.querySelector(".bug-severity").value = bug.severity;
    node.querySelector(".bug-status").value = bug.status;
    syncBugBadges(node, bug.severity, bug.status);
    syncBugSourceBadge(node, bug);
    fillOwnerSelect(node.querySelector(".bug-owner"), bug.owner, "未选择");
    node.querySelector(".bug-link").value = bug.link;
    node.querySelector(".bug-note").value = bug.note;
    const regressionButton = node.querySelector(".mark-bug-regression");
    regressionButton.classList.toggle("hidden-field", bug.status !== "已修复");

    detailToggle.addEventListener("click", () => {
      const isHidden = detail.classList.contains("hidden-field");
      detail.classList.toggle("hidden-field", !isHidden);
      detailToggle.textContent = isHidden ? "收起详情" : "展开详情";
    });

    node.querySelectorAll("input, textarea, select").forEach((control) => {
      control.addEventListener("input", () => updateBugFromNode(node, bug.id));
      control.addEventListener("change", () => updateBugFromNode(node, bug.id));
    });

    regressionButton.addEventListener("click", () => {
      bug.status = "待回归";
      persist();
      renderAll();
      setGenerationStatus("BUG 已标记为待回归。", "ok");
    });

    node.querySelector(".delete-bug").addEventListener("click", () => {
      state.bugs = state.bugs.filter((item) => item.id !== bug.id);
      persist();
      renderAll();
    });

    els.bugList.appendChild(node);
  });
}

function fillCaseOptions(select, selectedId) {
  select.innerHTML = [`<option value="">未关联</option>`]
    .concat(state.cases.map((item) => `<option value="${item.id}">${escapeHtml(item.title)}</option>`))
    .join("");
  select.value = selectedId || "";
}

function updateBugFromNode(node, bugId) {
  const item = state.bugs.find((bug) => bug.id === bugId);
  if (!item) {
    return;
  }

  item.title = node.querySelector(".bug-title").value.trim() || "未命名BUG";
  item.caseId = node.querySelector(".bug-case").value;
  item.batchId = node.querySelector(".bug-batch").value;
  item.batchName = getBatchLabelById(item.batchId);
  item.batchVersion = getBatchVersionById(item.batchId);
  item.moduleId = node.querySelector(".bug-module").value;
  item.moduleName = getModuleNameById(item.moduleId);
  item.severity = node.querySelector(".bug-severity").value;
  item.status = node.querySelector(".bug-status").value;
  item.owner = node.querySelector(".bug-owner").value.trim();
  item.link = node.querySelector(".bug-link").value.trim();
  item.note = node.querySelector(".bug-note").value.trim();

  if (item.caseId) {
    const linkedCase = state.cases.find((caseItem) => caseItem.id === item.caseId);
    if (linkedCase) {
      item.taskId = linkedCase.taskId || item.taskId;
      item.taskName = linkedCase.taskName || item.taskName;
      item.batchId = linkedCase.batchId || item.batchId;
      item.batchName = linkedCase.batchName || item.batchName;
      item.batchVersion = linkedCase.batchVersion || item.batchVersion;
      item.moduleId = linkedCase.moduleId || item.moduleId;
      item.moduleName = linkedCase.module || item.moduleName;
      node.querySelector(".bug-batch").value = item.batchId;
      node.querySelector(".bug-module").value = item.moduleId;
    }
  }

  if (!item.taskName && item.taskId) {
    item.taskName = getTaskNameById(item.taskId);
  }

  syncBugBadges(node, item.severity, item.status);
  syncBugSourceBadge(node, item);
  node.querySelector(".mark-bug-regression").classList.toggle("hidden-field", item.status !== "已修复");
  persist();
  renderQuickStats();
  renderReport();
}

function syncExecutionStatusBadge(node, status) {
  node.textContent = status;
  applyBadgeTone(node, getExecutionStatusTone(status));
}

function syncBugBadges(node, severity, status) {
  const severityBadge = node.querySelector(".bug-severity-badge");
  const statusBadge = node.querySelector(".bug-status-badge");
  severityBadge.textContent = severity;
  statusBadge.textContent = status;
  applyBadgeTone(severityBadge, getBugSeverityTone(severity));
  applyBadgeTone(statusBadge, getBugStatusTone(status));
}

function syncBugSourceBadge(node, bug) {
  const badge = node.querySelector(".bug-source-badge");
  if (!badge) {
    return;
  }
  const linkedCase = state.cases.find((item) => item.id === bug.caseId);
  const fromFailedCase = linkedCase?.executionStatus === "失败";
  badge.classList.toggle("hidden-field", !fromFailedCase);
  if (fromFailedCase) {
    badge.textContent = "来源于失败用例";
    applyBadgeTone(badge, "tone-red");
  }
}

function applyBadgeTone(node, tone) {
  node.classList.remove("tone-green", "tone-red", "tone-orange", "tone-gray", "subtle");
  node.classList.add(tone || "tone-gray");
}

function getCaseTypeTone(type) {
  if (type === "正常") return "tone-green";
  if (type === "异常") return "tone-red";
  return "tone-orange";
}

function getPriorityTone(priority) {
  if (priority === "P0") return "tone-red";
  if (priority === "P1") return "tone-orange";
  if (priority === "P2") return "tone-green";
  return "tone-gray";
}

function getExecutionStatusTone(status) {
  if (status === "通过") return "tone-green";
  if (status === "失败") return "tone-red";
  if (status === "阻塞") return "tone-orange";
  return "tone-gray";
}

function getBugSeverityTone(severity) {
  if (severity === "严重") return "tone-red";
  if (severity === "中") return "tone-orange";
  return "tone-green";
}

function getBugStatusTone(status) {
  if (status === "新建") return "tone-red";
  if (status === "已提交") return "tone-orange";
  if (status === "待回归") return "tone-orange";
  if (["已修复", "已验证"].includes(status)) return "tone-green";
  return "tone-gray";
}

function renderReport() {
  const versionCards = getReportBatchCards();
  const activeBatchId = state.activeReportBatchId || versionCards[0]?.batch.id || "";
  const activeCard = versionCards.find((item) => item.batch.id === activeBatchId) || versionCards[0];

  if (els.reportVersionCards) {
    els.reportVersionCards.innerHTML = versionCards.length
      ? versionCards.map(({ batch, report }) => {
        const isActive = batch.id === activeCard?.batch.id;
        return `
          <article class="report-version-card ${isActive ? "active" : ""}" data-report-batch-id="${batch.id}">
            <div class="report-version-top">
              <div>
                <h4>${escapeHtml(batch.version || "未命名版本")}</h4>
                <div class="card-meta">
                  <span class="badge subtle ${report.releaseDecision.tone}">${escapeHtml(report.releaseDecision.label)}</span>
                  <span class="badge subtle">${escapeHtml(batch.status || "进行中")}</span>
                </div>
              </div>
              ${isActive ? `<span class="badge tone-orange">当前查看</span>` : ""}
            </div>
            <div class="report-version-stats">
              <div><span>任务</span><strong>${report.versionTaskCount}</strong></div>
              <div><span>用例</span><strong>${report.total}</strong></div>
              <div><span>失败</span><strong>${report.statusCounts["失败"] || 0}</strong></div>
              <div><span>待跟进BUG</span><strong>${report.openBugs}</strong></div>
            </div>
            <div class="report-version-foot">
              <span>执行率 ${escapeHtml(report.executionRate)}</span>
              <span>通过率 ${escapeHtml(report.passRate)}</span>
            </div>
          </article>
        `;
      }).join("")
      : `
        <div class="empty-state empty-state-rich">
          <strong>还没有可查看的版本报告</strong>
          <p>先创建版本、任务并导入测试用例，这里就会自动生成版本报告卡片。</p>
        </div>
      `;

    els.reportVersionCards.querySelectorAll("[data-report-batch-id]").forEach((node) => {
      node.addEventListener("click", () => {
        state.activeReportBatchId = node.dataset.reportBatchId || "";
        persist();
        renderReport();
      });
    });
  }

  if (!activeCard) {
    els.reportDetailHeader.textContent = "当前版本详情";
    els.reportSummary.innerHTML = "";
    els.reportHighlights.innerHTML = "";
    return;
  }

  const report = activeCard.report;
  state.activeReportBatchId = activeCard.batch.id;
  els.reportDetailHeader.textContent = `${activeCard.batch.version || "未命名版本"} 详情`;
  const fixedSummary = [
    ["版本", report.batchVersion],
    ["负责人", report.testOwners.join("、") || "未分配"],
    ["任务数", String(report.versionTaskCount)],
    ["用例总数", String(report.total)],
    ["执行用例", String(report.executed)],
    ["成功用例", String(report.passed)],
    ["失败用例", String(report.statusCounts["失败"] || 0)],
    ["阻塞用例", String(report.statusCounts["阻塞"] || 0)],
    ["BUG总数", String(report.scope.bugs.length)],
    ["已修复BUG", String(report.bugStatusCounts["已修复"] || 0)],
    ["未修复BUG", String(report.openBugs)]
  ];

  els.reportSummary.innerHTML = `
    <div class="report-simple-grid">
      ${fixedSummary.map(([label, value]) => `
        <article class="report-simple-item">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </article>
      `).join("")}
    </div>
  `;

  els.reportHighlights.innerHTML = `
    <section class="attention-section">
      <div class="attention-head">
        <h4>失败的用例</h4>
        <span class="badge tone-red">${report.topFailedCases.length}</span>
      </div>
      <div class="list-stack compact-stack">
        ${report.topFailedCases.map((item) => `
          <article class="highlight-card">
            <span class="badge tone-red">失败用例</span>
            <strong>${escapeHtml(item.title)}</strong>
            <p>${escapeHtml([item.taskName || "未分任务", item.batchVersion || "", item.module || ""].filter(Boolean).join(" / "))}</p>
            <p>${escapeHtml(`关联BUG数：${report.unresolvedBugs.filter((bug) => bug.caseId === item.id).length}`)}</p>
          </article>
        `).join("") || `
          <div class="empty-state empty-state-rich">
            <strong>当前没有失败用例</strong>
            <p>失败的测试用例会显示在这里。</p>
          </div>
        `}
      </div>
    </section>
    <section class="attention-section">
      <div class="attention-head">
        <h4>未修复的BUG</h4>
        <span class="badge tone-orange">${report.topOpenBugs.length}</span>
      </div>
      <div class="list-stack compact-stack">
        ${report.topOpenBugs.map((item) => `
          <article class="highlight-card">
            <div class="card-meta">
              <span class="badge ${getBugStatusTone(item.status)}">${escapeHtml(item.status)}</span>
              <span class="badge ${getBugSeverityTone(item.severity)}">${escapeHtml(item.severity || "未标记")}</span>
              ${scopeHasFailedCaseBug(item) ? `<span class="badge tone-red">来源于失败用例</span>` : ""}
            </div>
            <strong>${escapeHtml(item.title)}</strong>
            <p>${escapeHtml(item.taskName || "未分任务")}</p>
            <div class="bug-detail-list">
              <div><span>负责人</span><strong>${escapeHtml(item.owner || "未填写")}</strong></div>
              <div><span>Lark</span><strong>${escapeHtml(item.link || "未填写")}</strong></div>
              <div class="bug-detail-full"><span>详情</span><strong>${escapeHtml(item.note || "暂无补充说明")}</strong></div>
            </div>
          </article>
        `).join("") || `
          <div class="empty-state empty-state-rich">
            <strong>当前没有未修复BUG</strong>
            <p>新建、已提交、待处理的 BUG 会显示在这里。</p>
          </div>
        `}
      </div>
    </section>
  `;
}

function buildReportViewModel(scope = getReportScope()) {
  const total = scope.cases.length;
  const resolvedBatchVersion = scope.batch?.version || scope.task?.batchVersion || scope.cases[0]?.batchVersion || "未选择";
  const resolvedBusinessName = scope.module?.name || scope.task?.moduleName || scope.batch?.moduleName || scope.cases[0]?.module || "未选择";
  const statusCounts = countBy(scope.cases, "executionStatus", ["未执行", "通过", "失败", "阻塞"]);
  const bugStatusCounts = countBy(scope.bugs, "status", ["新建", "已提交", "已修复", "已验证", "已关闭"]);
  bugStatusCounts["待回归"] = scope.bugs.filter((item) => item.status === "待回归").length;
  const bugSeverityCounts = countBy(scope.bugs, "severity", ["严重", "中", "低"]);
  const failedCases = scope.cases.filter((item) => item.executionStatus === "失败");
  const unresolvedBugs = scope.bugs.filter((item) => !["已修复", "已验证", "已关闭"].includes(item.status));
  const failedCaseBugCount = scope.bugs.filter((item) => {
    if (!item.caseId) {
      return false;
    }
    const linkedCase = scope.cases.find((caseItem) => caseItem.id === item.caseId);
    return linkedCase?.executionStatus === "失败";
  }).length;
  const passed = statusCounts["通过"] || 0;
  const executed = total - (statusCounts["未执行"] || 0);
  const executionRate = total ? `${Math.round((executed / total) * 100)}%` : "0%";
  const passRate = executed ? `${Math.round((passed / executed) * 100)}%` : "0%";
  const openBugs = scope.bugs.filter((bug) => !["已验证", "已关闭"].includes(bug.status)).length;
  const testOwners = getReportOwners(scope);
  const versionTaskCount = scope.tasks?.length || (scope.task ? 1 : 0);
  const releaseDecision = getReleaseDecision({
    failed: statusCounts["失败"] || 0,
    blocked: statusCounts["阻塞"] || 0,
    openBugs,
    severeBugCount: bugSeverityCounts["严重"] || 0
  });
  const scopeLabel = [
    resolvedBusinessName ? `业务：${resolvedBusinessName}` : "",
    resolvedBatchVersion && resolvedBatchVersion !== "未选择" ? `版本：${resolvedBatchVersion}` : "",
    scope.task ? `任务：${scope.task.name || ""}` : "",
    getOwnerDisplay(scope.task?.owners || scope.task?.owner)
      ? `任务负责人：${getOwnerDisplay(scope.task?.owners || scope.task?.owner)}`
      : (getOwnerDisplay(scope.batch?.owners || scope.batch?.owner) ? `版本负责人：${getOwnerDisplay(scope.batch?.owners || scope.batch?.owner)}` : "")
  ].filter(Boolean).join(" / ") || "当前全部范围";

  return {
    scope,
    total,
    statusCounts,
    bugStatusCounts,
    bugSeverityCounts,
    passed,
    executed,
    executionRate,
    passRate,
    openBugs,
    testOwners,
    scopeLabel,
    heroTitle: scope.task?.name || scope.batch?.version || "当前测试报告",
    batchVersion: resolvedBatchVersion,
    taskName: scope.task?.name || "未选择",
    generatedAt: new Date().toLocaleString("zh-CN"),
    documentInfoItems: [
      ["报告名称", "测试报告"],
      ["版本号", resolvedBatchVersion],
      ["测试任务", scope.task?.name || "未选择"],
      ["测试负责人", testOwners.join("、") || "未分配"],
      ["生成时间", new Date().toLocaleString("zh-CN")],
      ["报告范围", scopeLabel],
      ["当前结论", releaseDecision.label]
    ],
    scopeSummaryItems: [
      ["测试业务", resolvedBusinessName],
      ["来源类型", inferReportSourceType(scope)],
      ["测试内容", scope.task?.scope || scope.batch?.scope || "未填写"],
      ["测试对象", scope.task?.name || resolvedBatchVersion || "当前全部范围"]
    ],
    summaryItems: [
      ["当前范围", scopeLabel],
      ["测试负责人", testOwners.join("、") || "未分配"],
      ["测试任务数", versionTaskCount],
      ["测试用例总数", total],
      ["版本负责人", getOwnerDisplay(scope.batch?.owners || scope.batch?.owner) || "未分配"],
      ["任务负责人", getOwnerDisplay(scope.task?.owners || scope.task?.owner) || "未分配"],
      ["执行用例数", executed],
      ["成功用例数", passed],
      ["失败用例数", statusCounts["失败"] || 0],
      ["阻塞用例数", statusCounts["阻塞"] || 0],
      ["未执行用例数", statusCounts["未执行"] || 0],
      ["通过率", passRate],
      ["BUG 总数", scope.bugs.length],
      ["待跟进 BUG", openBugs],
      ["失败用例对应BUG数", failedCaseBugCount]
    ],
    releaseDecision,
    versionTaskCount,
    metricCards: [
      ["测试任务", versionTaskCount, "tone-gray"],
      ["用例总数", total, "tone-gray"],
      ["执行用例", executed, "tone-green"],
      ["成功用例", passed, "tone-green"],
      ["失败用例", statusCounts["失败"] || 0, "tone-red"],
      ["阻塞用例", statusCounts["阻塞"] || 0, "tone-orange"],
      ["BUG总数", scope.bugs.length, "tone-red"],
      ["失败用例BUG", failedCaseBugCount, "tone-orange"],
      ["执行率", executionRate, "tone-gray"],
      ["通过率", passRate, "tone-green"]
    ],
    executionBars: [
      ["通过", statusCounts["通过"] || 0, getExecutionStatusTone("通过")],
      ["失败", statusCounts["失败"] || 0, getExecutionStatusTone("失败")],
      ["阻塞", statusCounts["阻塞"] || 0, getExecutionStatusTone("阻塞")],
      ["未执行", statusCounts["未执行"] || 0, getExecutionStatusTone("未执行")]
    ],
    bugStatusBars: [
      ["新建", bugStatusCounts["新建"] || 0, getBugStatusTone("新建")],
      ["已提交", bugStatusCounts["已提交"] || 0, getBugStatusTone("已提交")],
      ["已修复", bugStatusCounts["已修复"] || 0, getBugStatusTone("已修复")],
      ["待回归", bugStatusCounts["待回归"] || 0, getBugStatusTone("待回归")],
      ["已验证", bugStatusCounts["已验证"] || 0, getBugStatusTone("已验证")],
      ["已关闭", bugStatusCounts["已关闭"] || 0, getBugStatusTone("已关闭")]
    ],
    bugSeverityBars: [
      ["严重", bugSeverityCounts["严重"] || 0, getBugSeverityTone("严重")],
      ["中", bugSeverityCounts["中"] || 0, getBugSeverityTone("中")],
      ["低", bugSeverityCounts["低"] || 0, getBugSeverityTone("低")]
    ],
    conclusionAdviceItems: buildConclusionAdviceItems({
      releaseDecision,
      failedCount: statusCounts["失败"] || 0,
      blockedCount: statusCounts["阻塞"] || 0,
      openBugs,
      severeBugCount: bugSeverityCounts["严重"] || 0,
      unexecutedCount: statusCounts["未执行"] || 0
    }),
    blockedSummary: buildBlockedSummary(scope.cases),
    failedCaseBugCount,
    failedCases,
    unresolvedBugs,
    topFailedCases: failedCases.slice(0, 5),
    topOpenBugs: unresolvedBugs.slice(0, 5)
  };
}

function buildBlockedSummary(cases) {
  const blockedCases = cases.filter((item) => item.executionStatus === "阻塞");
  if (!blockedCases.length) {
    return "当前没有阻塞用例。";
  }
  return blockedCases
    .slice(0, 5)
    .map((item, index) => `${index + 1}. ${item.title}${item.executionNote ? `：${item.executionNote}` : ""}`)
    .join("\n");
}

function scopeHasFailedCaseBug(bug) {
  if (!bug?.caseId) {
    return false;
  }
  const linkedCase = state.cases.find((item) => item.id === bug.caseId);
  return linkedCase?.executionStatus === "失败";
}

function buildConclusionAdviceItems(data) {
  const advice = [
    ["当前判断", data.releaseDecision.label],
    ["建议动作", data.releaseDecision.label === "可发布" ? "可以进入发布确认，保留最终抽查记录。" : "建议修复问题后补充回归，再更新本报告。"]
  ];

  if (data.failedCount > 0) {
    advice.push(["失败用例", `当前存在 ${data.failedCount} 条失败用例，建议优先确认主流程影响范围。`]);
  }
  if (data.blockedCount > 0) {
    advice.push(["阻塞项", `当前存在 ${data.blockedCount} 条阻塞用例，需要补齐环境、数据或依赖条件。`]);
  }
  if (data.openBugs > 0) {
    advice.push(["待跟进BUG", `当前仍有 ${data.openBugs} 个待跟进 BUG，建议明确修复人与回归时间。`]);
  }
  if (data.severeBugCount > 0) {
    advice.push(["严重问题", `存在 ${data.severeBugCount} 个严重 BUG，建议作为上线前必清项。`]);
  }
  if (data.unexecutedCount > 0) {
    advice.push(["未执行用例", `仍有 ${data.unexecutedCount} 条用例未执行，建议补齐后再做最终结论。`]);
  }

  if (advice.length === 2) {
    advice.push(["补充说明", "当前范围内执行结果比较稳定，可以保留这份报告作为版本验收记录。"]);
  }

  return advice;
}

function getReleaseDecision(data) {
  if (data.severeBugCount > 0 || data.failed > 0) {
    return { label: "有风险", desc: "存在失败用例或严重 BUG，建议修复后再回归。", tone: "tone-red" };
  }
  if (data.blocked > 0 || data.openBugs > 0) {
    return { label: "需关注", desc: "当前还有阻塞项或待跟进 BUG，上线前建议继续确认。", tone: "tone-orange" };
  }
  return { label: "可发布", desc: "当前执行结果稳定，未发现明显发布阻塞。", tone: "tone-green" };
}

function inferReportSourceType(scope) {
  const sourceTypes = [...new Set(
    state.documents
      .filter((item) => {
        const sameTask = !scope.task || item.taskId === scope.task.id;
        return sameTask;
      })
      .map((item) => item.type)
      .filter(Boolean)
  )];

  if (!sourceTypes.length) {
    if (state.lastGeneration?.type === "api") {
      return "API内容";
    }
    if (state.lastGeneration?.type === "requirement") {
      return "需求内容";
    }
    return "需求内容 / API内容";
  }
  return sourceTypes.map((item) => (item === "api" ? "API内容" : "需求内容")).join(" / ");
}

function renderReportBars(container, items) {
  if (!container) {
    return;
  }
  const maxValue = Math.max(...items.map((item) => item[1]), 1);
  container.innerHTML = items.map(([label, value, tone]) => `
    <div class="bar-item">
      <div class="bar-head">
        <span>${escapeHtml(label)}</span>
        <strong>${value}</strong>
      </div>
      <div class="bar-track">
        <div class="bar-fill ${tone}" style="width:${Math.max((value / maxValue) * 100, value ? 8 : 0)}%"></div>
      </div>
    </div>
  `).join("");
}

async function exportReport() {
  const report = buildReportViewModel(getReportScopeByBatch(state.activeReportBatchId));
  const reportConclusion = getReportConclusionForBatch(state.activeReportBatchId);
  const fileBaseName = [
    "report",
    report.scope.batch?.version || report.batchVersion || "no-version",
    report.scope.task?.name || report.taskName || "summary"
  ].map(sanitizeFileName).join("-");
  const exportChecks = buildReportExportChecks(report);

  if (exportChecks.length) {
    const confirmed = window.confirm([
      "导出前提醒：",
      ...exportChecks.map((item, index) => `${index + 1}. ${item}`),
      "",
      "确认继续导出吗？"
    ].join("\n"));
    if (!confirmed) {
      return;
    }
  }

  try {
    const response = await fetch("/api/export-report-docx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        report,
        reportConclusion,
        fileBaseName
      })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "导出失败");
    }

    const blob = await response.blob();
    downloadBlob(`${fileBaseName}.docx`, blob);
  } catch (error) {
    alert(`报告导出失败：${error.message}`);
  }
}

function buildReportExportChecks(report) {
  const warnings = [];
  if ((report.statusCounts["未执行"] || 0) > 0) {
    warnings.push(`当前还有 ${report.statusCounts["未执行"]} 条用例未执行。`);
  }
  if ((report.statusCounts["失败"] || 0) > 0) {
    warnings.push(`当前还有 ${report.statusCounts["失败"]} 条失败用例。`);
  }
  if (report.openBugs > 0) {
    warnings.push(`当前还有 ${report.openBugs} 个未关闭 BUG。`);
  }
  return warnings;
}

function buildReportHtml(report) {
  const conclusion = getReportConclusionForBatch(report.scope.batch?.id) || "暂无补充结论。";
  const ownerTags = report.testOwners.length
    ? report.testOwners.map((owner) => `<span class="badge tone-green">${escapeHtml(owner)}</span>`).join("")
    : `<span class="badge tone-gray">未分配</span>`;
  const renderDocumentInfoTable = report.documentInfoItems.map(([label, value]) => `
    <tr>
      <th>${escapeHtml(label)}</th>
      <td>${escapeHtml(value)}</td>
    </tr>
  `).join("");

  const renderScopeSummaryTable = report.scopeSummaryItems.map(([label, value]) => `
    <tr>
      <th>${escapeHtml(label)}</th>
      <td>${escapeHtml(value)}</td>
    </tr>
  `).join("");

  const renderExecutionTable = [
    ["测试用例总数", report.total],
    ["执行用例数", report.executed],
    ["成功用例数", report.passed],
    ["失败用例数", report.statusCounts["失败"] || 0],
    ["阻塞用例数", report.statusCounts["阻塞"] || 0],
    ["未执行用例数", report.statusCounts["未执行"] || 0],
    ["通过率", report.passRate]
  ].map(([label, value]) => `
    <tr>
      <th>${escapeHtml(label)}</th>
      <td>${escapeHtml(String(value))}</td>
    </tr>
  `).join("");

  const renderDefectTable = [
    ["BUG总数", report.scope.bugs.length],
    ["待跟进BUG", report.openBugs],
    ["新建", report.bugStatusCounts["新建"] || 0],
    ["已提交", report.bugStatusCounts["已提交"] || 0],
    ["已修复", report.bugStatusCounts["已修复"] || 0],
    ["已验证", report.bugStatusCounts["已验证"] || 0],
    ["已关闭", report.bugStatusCounts["已关闭"] || 0],
    ["严重", report.bugSeverityCounts["严重"] || 0],
    ["中", report.bugSeverityCounts["中"] || 0],
    ["低", report.bugSeverityCounts["低"] || 0]
  ].map(([label, value]) => `
    <tr>
      <th>${escapeHtml(label)}</th>
      <td>${escapeHtml(String(value))}</td>
    </tr>
  `).join("");

  const renderRiskTable = `
    <tr>
      <th>发布建议</th>
      <td><span class="badge ${report.releaseDecision.tone}">${escapeHtml(report.releaseDecision.label)}</span></td>
    </tr>
    <tr>
      <th>结论说明</th>
      <td>${escapeHtml(report.releaseDecision.desc)}</td>
    </tr>
    <tr>
      <th>补充结论</th>
      <td class="multiline-cell">${escapeHtml(conclusion)}</td>
    </tr>
  `;

  const renderConclusionAdviceTable = report.conclusionAdviceItems.map(([label, value]) => `
    <tr>
      <th>${escapeHtml(label)}</th>
      <td class="multiline-cell">${escapeHtml(value)}</td>
    </tr>
  `).join("");

  const renderFailedCases = report.failedCases.length
    ? report.failedCases.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(item.taskName || "未分任务")}</td>
        <td>${escapeHtml(item.batchVersion || report.batchVersion)}</td>
        <td>${escapeHtml(item.module || "未标记")}</td>
        <td><span class="badge tone-red">失败</span></td>
      </tr>
    `).join("")
    : `
      <tr>
        <td colspan="6" class="empty-cell">当前没有失败用例</td>
      </tr>
    `;

  const renderOpenBugs = report.unresolvedBugs.length
    ? report.unresolvedBugs.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(item.title)}</td>
        <td><span class="badge ${getBugStatusTone(item.status)}">${escapeHtml(item.status)}</span></td>
        <td><span class="badge ${getBugSeverityTone(item.severity)}">${escapeHtml(item.severity || "未标记")}</span></td>
        <td>${escapeHtml(item.taskName || "未分任务")}</td>
        <td>${escapeHtml(item.owner || "未填写")}</td>
        <td class="multiline-cell">${escapeHtml(item.link || "未填写")}</td>
        <td class="multiline-cell">${escapeHtml(item.note || "暂无补充说明")}</td>
      </tr>
    `).join("")
    : `
      <tr>
        <td colspan="8" class="empty-cell">当前没有未修复BUG</td>
      </tr>
    `;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(report.heroTitle)} - 测试报告</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f3f6fb; --panel: #ffffff; --border: #d8e0eb; --text: #1c2430; --muted: #5f6b7a;
      --success: #16794a; --danger: #cc3d3d; --warning: #c78210; --shadow: 0 10px 30px rgba(21,34,50,.08);
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Segoe UI","PingFang SC","Microsoft YaHei",sans-serif; background: var(--bg); color: var(--text); }
    .page { max-width: 1360px; margin: 0 auto; padding: 28px; display: grid; gap: 18px; }
    .hero, .health, .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; box-shadow: var(--shadow); }
    .hero-wrap { display: grid; grid-template-columns: 1.3fr .7fr; gap: 18px; }
    .hero, .health, .panel { padding: 20px; }
    h1, h2, h3, p { margin: 0; }
    .eyebrow, .meta-item span, .metric-card span, .summary-label { display: block; font-size: 12px; color: var(--muted); }
    .hero h1 { font-size: 30px; margin-top: 8px; }
    .hero p { margin-top: 10px; color: var(--muted); line-height: 1.7; }
    .meta-grid, .metrics, .grid-2 { display: grid; gap: 14px; }
    .meta-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 18px; }
    .meta-item { border: 1px solid #eef2f7; border-radius: 8px; background: #fafcff; padding: 12px; }
    .meta-item strong { display: block; margin-top: 6px; }
    .pill { display: inline-flex; min-height: 36px; align-items: center; padding: 0 14px; border-radius: 999px; font-weight: 600; margin: 10px 0 12px; }
    .pill.tone-green, .bar-fill.tone-green, .metric-accent.tone-green { background: #eaf8ef; color: var(--success); }
    .pill.tone-red, .bar-fill.tone-red, .metric-accent.tone-red { background: #fff0f0; color: var(--danger); }
    .pill.tone-orange, .bar-fill.tone-orange, .metric-accent.tone-orange { background: #fff5e8; color: var(--warning); }
    .grid-2 { grid-template-columns: 1fr 1fr; }
    .section-stack { display: grid; gap: 18px; }
    .panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
    .summary-table, .detail-table { width: 100%; border-collapse: collapse; margin-top: 14px; overflow: hidden; border-radius: 8px; border: 1px solid #eef2f7; }
    .summary-table th, .summary-table td, .detail-table th, .detail-table td { padding: 14px; border-bottom: 1px solid #eef2f7; text-align: left; vertical-align: top; }
    .summary-table th { width: 180px; background: #fafcff; color: var(--muted); font-weight: 600; }
    .summary-table tr:last-child th, .summary-table tr:last-child td, .detail-table tr:last-child th, .detail-table tr:last-child td { border-bottom: 0; }
    .summary-table td, .detail-table td { background: #fff; }
    .detail-table thead th { background: #fafcff; color: var(--muted); font-weight: 600; white-space: nowrap; }
    .badge { display: inline-flex; min-height: 28px; align-items: center; padding: 0 10px; border-radius: 999px; font-size: 13px; }
    .badge.tone-red { background: #fff0f0; color: var(--danger); }
    .badge.tone-orange { background: #fff5e8; color: var(--warning); }
    .badge.tone-green { background: #eaf8ef; color: var(--success); }
    .badge.tone-gray { background: #f2f5f9; color: var(--muted); }
    .health p { margin-top: 8px; color: var(--muted); line-height: 1.7; }
    .text-area-like, .multiline-cell { white-space: pre-wrap; line-height: 1.8; color: var(--text); word-break: break-word; }
    .empty-cell { text-align: center; color: var(--muted); padding: 22px 14px; }
    .owner-tags { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
    @page { size: A4; margin: 14mm; }
    @media print {
      body { background: #fff; }
      .page { max-width: none; padding: 0; gap: 12px; }
      .hero, .health, .panel { box-shadow: none; break-inside: avoid; }
    }
    @media (max-width: 1180px) { .hero-wrap, .grid-2 { grid-template-columns: 1fr; } }
    @media (max-width: 720px) { .page, .meta-grid { grid-template-columns: 1fr; padding: 18px; } }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero-wrap">
      <section class="hero">
        <span class="eyebrow">测试范围</span>
        <h1>${escapeHtml(report.heroTitle)}</h1>
        <p>${escapeHtml(report.scopeLabel)}</p>
        <div>
          <span class="summary-label">测试负责人</span>
          <div class="owner-tags">${ownerTags}</div>
        </div>
        <div class="meta-grid">
          <div class="meta-item"><span>版本</span><strong>${escapeHtml(report.batchVersion)}</strong></div>
          <div class="meta-item"><span>任务</span><strong>${escapeHtml(report.taskName)}</strong></div>
          <div class="meta-item"><span>生成时间</span><strong>${escapeHtml(report.generatedAt)}</strong></div>
        </div>
      </section>
      <section class="health">
        <span class="summary-label">发布建议</span>
        <div class="pill ${report.releaseDecision.tone}">${escapeHtml(report.releaseDecision.label)}</div>
        <p>${escapeHtml(report.releaseDecision.desc)}</p>
      </section>
    </section>

    <section class="grid-2">
      <section class="panel">
        <h3>文档信息</h3>
        <table class="summary-table">
          <tbody>${renderDocumentInfoTable}</tbody>
        </table>
      </section>
      <section class="panel">
        <h3>测试范围摘要</h3>
        <table class="summary-table">
          <tbody>${renderScopeSummaryTable}</tbody>
        </table>
      </section>
    </section>

    <section class="grid-2">
      <section class="panel">
        <h3>用例执行统计</h3>
        <table class="summary-table">
          <tbody>${renderExecutionTable}</tbody>
        </table>
      </section>
      <section class="panel">
        <h3>缺陷统计</h3>
        <table class="summary-table">
          <tbody>${renderDefectTable}</tbody>
        </table>
      </section>
    </section>

    <section class="panel">
      <h3>风险与结论</h3>
      <table class="summary-table">
        <tbody>${renderRiskTable}</tbody>
      </table>
    </section>

    <section class="panel">
      <div class="panel-head">
        <h3>测试结论与建议</h3>
        <span class="badge ${report.releaseDecision.tone}">${escapeHtml(report.releaseDecision.label)}</span>
      </div>
      <table class="summary-table">
        <tbody>${renderConclusionAdviceTable}</tbody>
      </table>
    </section>

    <section class="panel">
      <div class="panel-head">
        <h3>重点关注</h3>
        <span class="badge tone-orange">${report.failedCases.length + report.unresolvedBugs.length}</span>
      </div>
      <div class="section-stack">
        <section>
          <div class="panel-head">
            <h3>失败的用例</h3>
            <span class="badge tone-red">${report.failedCases.length}</span>
          </div>
          <table class="detail-table">
            <thead>
              <tr>
                <th>序号</th>
                <th>用例标题</th>
                <th>任务</th>
                <th>版本</th>
                <th>业务</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>${renderFailedCases}</tbody>
          </table>
        </section>

        <section>
          <div class="panel-head">
            <h3>未修复的BUG</h3>
            <span class="badge tone-orange">${report.unresolvedBugs.length}</span>
          </div>
          <table class="detail-table">
            <thead>
              <tr>
                <th>序号</th>
                <th>BUG标题</th>
                <th>状态</th>
                <th>严重级别</th>
                <th>任务</th>
                <th>负责人</th>
                <th>Lark链接</th>
                <th>详情</th>
              </tr>
            </thead>
            <tbody>${renderOpenBugs}</tbody>
          </table>
        </section>
      </div>
    </section>
  </main>
</body>
</html>`;
}

function printReportPdf(fileName, html) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  if (!frameWindow) {
    iframe.remove();
    alert("当前浏览器不支持直接导出 PDF。");
    return;
  }

  frameWindow.document.open();
  frameWindow.document.write(html);
  frameWindow.document.close();
  frameWindow.document.title = fileName.replace(/\.pdf$/i, "");

  const cleanup = () => {
    setTimeout(() => iframe.remove(), 1000);
  };

  iframe.onload = () => {
    setTimeout(() => {
      frameWindow.focus();
      frameWindow.print();
      cleanup();
    }, 300);
  };
}

function downloadFile(fileName, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(fileName, blob);
}

function downloadBlob(fileName, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function countBy(list, field, defaults) {
  const base = Object.fromEntries(defaults.map((item) => [item, 0]));
  list.forEach((entry) => {
    const key = entry[field] || "未定义";
    base[key] = (base[key] || 0) + 1;
  });
  return base;
}

function seedDemoData() {
  state.teamMembers = ["测试A", "测试B", "后端A", "产品A"];
  state.batches = [{
    id: "batch-demo-va",
    name: "VA业务",
    version: "V2026.06.10",
    scope: "登录、下单、退款回归",
    moduleId: "business-VA业务",
    moduleName: "VA业务",
    owner: "测试A"
  }];
  state.modules = [{
    id: "business-VA业务",
    name: "VA业务"
  }, {
    id: "business-卡收单业务",
    name: "卡收单业务"
  }, {
    id: "business-数字货币业务",
    name: "数字货币业务"
  }, {
    id: "business-代付业务",
    name: "代付业务"
  }, {
    id: "business-本地收单业务",
    name: "本地收单业务"
  }];
  state.activeBatchId = "batch-demo-va";
  state.activeModuleId = "business-VA业务";
  state.tasks = [{
    id: "task-demo-login",
    batchId: "batch-demo-va",
    batchVersion: "V2026.06.10",
    batchName: getBatchLabelById("batch-demo-va"),
    moduleId: "business-VA业务",
    moduleName: "VA业务",
    name: "登录与下单回归",
    scope: "覆盖登录、下单、退款主流程与异常提示",
    owner: "测试B",
    status: "进行中"
  }];
  state.activeTaskId = "task-demo-login";
  state.generationBatchId = "batch-demo-va";

  state.documents = [{
    id: "doc-demo",
    name: "订单接口 OpenAPI",
    type: "api",
    content: JSON.stringify({
      openapi: "3.0.0",
      paths: {
        "/orders/create": {
          post: {
            summary: "创建订单",
            tags: ["订单"],
            parameters: [{ name: "token", required: true }],
            requestBody: { required: true },
            responses: { 200: {}, 400: {} }
          }
        }
      }
    }, null, 2),
    createdAt: new Date().toISOString()
  }];

  state.cases = generateCasesFromApi("订单接口 OpenAPI", state.documents[0].content).map((item) => ({
    ...item,
    taskId: state.activeTaskId,
    taskName: getTaskNameById(state.activeTaskId),
    batchId: state.activeBatchId,
    batchVersion: getBatchVersionById(state.activeBatchId),
    batchName: getBatchLabelById(state.activeBatchId),
    moduleId: state.activeModuleId,
    module: getModuleNameById(state.activeModuleId) || item.module
  }));

  if (state.cases[0]) {
    state.cases[0].executionStatus = "通过";
  }
  if (state.cases[1]) {
    state.cases[1].executionStatus = "失败";
    state.cases[1].executionNote = "缺参场景返回 500，需要开发修复。";
  }

  state.bugs = [{
    id: "bug-demo",
    title: "创建订单接口缺参时返回 500",
    caseId: state.cases[1] ? state.cases[1].id : "",
    taskId: state.activeTaskId,
    taskName: getTaskNameById(state.activeTaskId),
    batchId: state.activeBatchId,
    batchVersion: getBatchVersionById(state.activeBatchId),
    batchName: getBatchLabelById(state.activeBatchId),
    moduleId: state.activeModuleId,
    moduleName: getModuleNameById(state.activeModuleId),
    severity: "严重",
    status: "已提交",
    owner: "后端A",
    link: "",
    note: "应返回 4xx 参数校验错误。"
  }];

  state.lastGeneration = {
    name: "订单接口 OpenAPI",
    type: "api",
    count: state.cases.length,
    mode: "规则",
    createdAt: new Date().toLocaleString("zh-CN")
  };
  state.reportConclusion = "当前接口主流程可用，但异常参数校验存在阻塞问题，建议修复后回归。";
  state.reportConclusions = {
    "batch-demo-va": state.reportConclusion
  };
  state.activeReportBatchId = "batch-demo-va";

  persist();
  saveTeamMembersConfig();
  renderAll();
  setGenerationStatus("已导入演示数据。", "ok");
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const loadedState = normalizeLoadedState({ ...defaultState(), ...parsed });
    if (parsed.settings?.apiKey) {
      const cleanedState = Object.fromEntries(LOCAL_STATE_KEYS.map((key) => [key, structuredCloneSafe(loadedState[key])]));
      cleanedState.settings = { model: loadedState.settings.model };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanedState));
    }
    return loadedState;
  } catch (_error) {
    return defaultState();
  }
}

function normalizeLoadedState(loadedState) {
  loadedState.settings = {
    model: loadedState.settings?.model || "gpt-5.4-mini"
  };
  return loadedState;
}

function defaultState() {
  return {
    documents: [],
    cases: [],
    bugs: [],
    batches: [],
    tasks: [],
    modules: BUSINESS_OPTIONS.map((name) => ({
      id: slugifyBusiness(name),
      name
    })),
    activeBatchId: "",
    generationBatchId: "",
    activeTaskId: "",
    activeModuleId: "",
    activeReportBatchId: "",
    reportConclusion: "",
    reportConclusions: {},
    lastGeneration: null,
    settings: {
      model: "gpt-5.4-mini"
    },
    uiMode: "guide"
  };
}

function persist() {
  const localState = Object.fromEntries(LOCAL_STATE_KEYS.map((key) => [key, structuredCloneSafe(state[key])]));
  if (localState.settings) {
    localState.settings = { model: localState.settings.model || "gpt-5.4-mini" };
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(localState));
  scheduleSharedPersist();
}

function scheduleSharedPersist() {
  clearTimeout(persistSharedTimer);
  persistSharedTimer = setTimeout(() => {
    void persistSharedState();
  }, 150);
}

async function persistSharedState() {
  try {
    await fetch("/api/app-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: buildSharedStatePayload() })
    });
  } catch (_error) {
    // Keep local UI usable even if shared sync temporarily fails.
  }
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
