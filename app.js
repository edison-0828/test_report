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
const SHARED_STATE_KEYS = ["documents", "cases", "bugs", "batches", "tasks", "reportConclusion", "lastGeneration"];
const LOCAL_STATE_KEYS = ["activeBatchId", "generationBatchId", "activeTaskId", "activeModuleId", "settings", "uiMode"];

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
  onboardingSummary: document.getElementById("onboardingSummary"),
  onboardingSteps: document.getElementById("onboardingSteps"),
  nextActionBtn: document.getElementById("nextActionBtn"),
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
  apiKey: document.getElementById("apiKey"),
  saveApiKey: document.getElementById("saveApiKey"),
  clearApiKey: document.getElementById("clearApiKey"),
  modelSelect: document.getElementById("modelSelect"),
  apiStatus: document.getElementById("apiStatus"),
  caseList: document.getElementById("caseList"),
  caseImportInput: document.getElementById("caseImportInput"),
  caseBatchFilter: document.getElementById("caseBatchFilter"),
  caseTaskFilter: document.getElementById("caseTaskFilter"),
  caseSearch: document.getElementById("caseSearch"),
  caseModuleFilter: document.getElementById("caseModuleFilter"),
  executionBatchFilter: document.getElementById("executionBatchFilter"),
  executionTaskFilter: document.getElementById("executionTaskFilter"),
  executionModuleFilter: document.getElementById("executionModuleFilter"),
  executionList: document.getElementById("executionList"),
  bugBatchFilter: document.getElementById("bugBatchFilter"),
  bugTaskFilter: document.getElementById("bugTaskFilter"),
  bugModuleFilter: document.getElementById("bugModuleFilter"),
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
  exportReport: document.getElementById("exportReport"),
  seedDemo: document.getElementById("seedDemo"),
  caseTemplate: document.getElementById("caseTemplate"),
  executionTemplate: document.getElementById("executionTemplate"),
  bugTemplate: document.getElementById("bugTemplate")
};

const settings = {
  apiKey: state.settings?.apiKey || "",
  model: state.settings?.model || "gpt-5.4-mini",
  apiReady: false
};

let uploadedFileContent = "";
let editingBatchId = "";
let editingTaskId = "";
let persistSharedTimer = 0;

els.apiKey.value = settings.apiKey;
els.modelSelect.value = settings.model;
els.reportConclusion.value = state.reportConclusion || "";
autoResizeTextarea();

ensureSeedMetadata();
hydrateReportChrome();
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
  els.caseSearch.addEventListener("input", renderCases);
  els.caseImportInput.addEventListener("change", handleCaseImport);
  els.caseBatchFilter.addEventListener("change", renderCases);
  els.caseTaskFilter.addEventListener("change", renderCases);
  els.caseModuleFilter.addEventListener("change", renderCases);
  els.executionBatchFilter.addEventListener("change", renderExecution);
  els.executionTaskFilter.addEventListener("change", renderExecution);
  els.executionModuleFilter.addEventListener("change", renderExecution);
  els.bugBatchFilter.addEventListener("change", renderBugs);
  els.bugTaskFilter.addEventListener("change", renderBugs);
  els.bugModuleFilter.addEventListener("change", renderBugs);
  els.addBug.addEventListener("click", createBugRecord);
  els.reportConclusion.addEventListener("input", () => {
    state.reportConclusion = els.reportConclusion.value;
    persist();
    renderReport();
  });
  els.exportReport.addEventListener("click", exportReport);
  els.seedDemo.addEventListener("click", seedDemoData);
  els.saveApiKey.addEventListener("click", saveApiSettings);
  els.clearApiKey.addEventListener("click", clearApiSettings);
  els.modelSelect.addEventListener("change", saveApiSettings);
  els.nextActionBtn?.addEventListener("click", handleRecommendedAction);
  document.addEventListener("click", handleGlobalActionClick);
}

function hydrateReportChrome() {
  const reportPanel = document.getElementById("report");
  if (!reportPanel) {
    return;
  }

  const headerTitle = reportPanel.querySelector(".panel-header h2");
  const headerDesc = reportPanel.querySelector(".panel-header p");
  const exportBtn = reportPanel.querySelector("#exportReport");
  const headings = reportPanel.querySelectorAll("h3");

  if (headerTitle) headerTitle.textContent = "测试报告";
  if (headerDesc) headerDesc.textContent = "基于当前批次 / 任务 / 模块范围，自动汇总用例执行与 BUG 状态。";
  if (exportBtn) exportBtn.textContent = "导出PDF";

  const headingTexts = ["报告摘要", "风险与结论", "执行状态分布", "BUG 状态分布", "BUG 严重级别", "重点关注"];
  headings.forEach((node, index) => {
    if (headingTexts[index]) {
      node.textContent = headingTexts[index];
    }
  });

  if (els.reportConclusion) {
    els.reportConclusion.placeholder = "补充测试范围、风险项、上线建议";
  }
}

function simplifyUploadFlow() {
  els.nextActionBtn?.remove();
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
      <span class="step-label">3. 选择版本负责人</span>
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
  settings.apiKey = els.apiKey.value.trim();
  settings.model = els.modelSelect.value;
  state.settings = { apiKey: settings.apiKey, model: settings.model };
  persist();
  setGenerationStatus(settings.apiKey ? "本地设置已保存，可以直接发起 AI 生成。" : "模型设置已保存。", "ok");
  checkApiStatus();
}

function clearApiSettings() {
  settings.apiKey = "";
  els.apiKey.value = "";
  state.settings = { apiKey: "", model: els.modelSelect.value };
  persist();
  checkApiStatus();
  setGenerationStatus("已清空本地保存的 API Key。", "warn");
}

async function checkApiStatus() {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) {
      throw new Error("health check failed");
    }

    const data = await response.json();
    settings.apiReady = true;

    if (data.defaultModel && !state.settings?.model) {
      els.modelSelect.value = data.defaultModel;
      settings.model = data.defaultModel;
    }

    const hasAnyKey = data.envKeyAvailable || Boolean(settings.apiKey);
    setApiStatus(hasAnyKey ? "AI 服务可用" : "需要填写 API Key", hasAnyKey ? "ok" : "warn");
  } catch (_error) {
    settings.apiReady = false;
    setApiStatus("本地服务未启动", "error");
  }
}

function setApiStatus(text, tone) {
  els.apiStatus.textContent = text;
  els.apiStatus.className = `status-pill ${tone}`;
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
  state.modules = BUSINESS_OPTIONS.map((name) => ({
    id: slugifyBusiness(name),
    name
  }));
  if (state.activeBatchId === undefined) {
    state.activeBatchId = "";
  }
  if (state.activeModuleId === undefined) {
    state.activeModuleId = "";
  }
  if (state.generationBatchId === undefined) {
    state.generationBatchId = "";
  }
  if (state.activeTaskId === undefined) {
    state.activeTaskId = "";
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

  if (!moduleItem) {
    setGenerationStatus("请先选择当前业务。", "warn");
    return;
  }

  if (!version) {
    setGenerationStatus("请先填写版本号。", "warn");
    return;
  }

  const batch = {
    id: editingBatchId || `batch-${Date.now()}`,
    name: moduleItem.name,
    version,
    scope: getBatchById(editingBatchId)?.scope || "",
    moduleId: moduleItem.id,
    moduleName: moduleItem.name,
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
  state.activeModuleId = moduleItem.id;
  els.batchVersionInput.value = "";
  fillOwnerSelect(els.batchOwnerSelect, "");
  editingBatchId = "";
  els.createBatchBtn.textContent = "4. 保存当前版本";
  autoResizeTextarea();
  persist();
  renderAll();
  setGenerationStatus(`${isEditing ? "已更新" : "已保存"}版本：${formatBatchLabel(batch)}。下一步请新增测试任务。`, "ok");
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
        taskName: item.taskName || getTaskNameById(state.activeTaskId),
        batchId: item.batchId || state.activeBatchId || "",
        batchVersion: item.batchVersion || getBatchVersionById(item.batchId) || getBatchVersionById(state.activeBatchId),
        batchName: item.batchName || getBatchLabelById(state.activeBatchId),
        moduleId: item.moduleId || state.activeModuleId || "",
        module: item.module || getModuleNameById(state.activeModuleId) || "未分类",
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
  renderExecution();
  renderBugs();
  renderReport();
}

function renderOnboarding() {
  const flow = getWorkflowState();
  const steps = [
    {
      key: "meta",
      title: "先保存版本",
      desc: "先填版本号、选择业务、指定版本负责人。",
      done: flow.hasMeta,
      current: flow.nextAction === "create-meta"
    },
    {
      key: "task",
      title: "再建测试任务",
      desc: "每个需求或回归点单独建任务，后面报告更清楚。",
      done: flow.hasTask,
      current: flow.nextAction === "create-task"
    },
    {
      key: "source",
      title: "上传文档或填网址",
      desc: "本地文件直接上传，网址就贴链接，再写测试范围。",
      done: flow.hasSource || flow.hasCases,
      current: flow.nextAction === "prepare-source"
    },
    {
      key: "cases",
      title: "生成或导入用例",
      desc: "可以直接 AI 生成，也可以先下模板手填再导入。",
      done: flow.hasCases,
      current: flow.nextAction === "generate-cases"
    },
    {
      key: "execution",
      title: "执行并记录 BUG",
      desc: "改执行状态，补执行备注，需要时新增 BUG。",
      done: flow.hasExecutionOrBug,
      current: flow.nextAction === "execute-cases"
    },
    {
      key: "report",
      title: "导出测试报告",
      desc: "确认范围后，直接导出当前批次 / 模块报告。",
      done: flow.hasExecutionOrBug,
      current: flow.nextAction === "export-report"
    }
  ];

  els.onboardingSummary.innerHTML = `
    <div class="onboarding-focus">
      <div class="onboarding-tip onboarding-tip-primary">
        <span class="summary-label">当前建议</span>
        <strong>${escapeHtml(flow.tipTitle)}</strong>
        <p>${escapeHtml(flow.tipBody)}</p>
        <div class="inline-actions">
          <button type="button" class="ghost-button" data-action="${escapeHtml(flow.nextAction)}">${escapeHtml(flow.actionLabel)}</button>
          <button type="button" class="ghost-button" data-action="download-case-template">下载CSV模板</button>
        </div>
      </div>
      <div class="onboarding-tip">
        <span class="summary-label">填写示例</span>
        <div class="example-grid">
          <div class="example-card">
            <strong>版本号</strong>
            <p>V2026.06.10</p>
          </div>
          <div class="example-card">
            <strong>任务名称</strong>
            <p>登录回归 / 退款修复验证</p>
          </div>
          <div class="example-card example-card-wide">
            <strong>测试范围</strong>
            <p>- 登录主流程\n- 验证码错误提示\n- 锁定逻辑</p>
          </div>
          <div class="example-card example-card-wide">
            <strong>CSV状态列</strong>
            <p>执行状态可填：通过 / 失败 / 阻塞。留空时系统会按未执行处理。</p>
          </div>
        </div>
      </div>
    </div>
  `;

  els.onboardingSteps.innerHTML = steps.map((step, index) => `
    <article class="step-card ${step.current ? "current" : ""}">
      <div class="step-index">${index + 1}</div>
      <div class="step-body">
        <div class="step-head">
          <strong>${escapeHtml(step.title)}</strong>
        </div>
        <p>${escapeHtml(step.desc)}</p>
        <button type="button" class="ghost-button tiny-button" data-action="${escapeHtml(getStepAction(step.key))}">${escapeHtml(getStepButtonLabel(step.key))}</button>
      </div>
    </article>
  `).join("");

  if (els.nextActionBtn) {
    els.nextActionBtn.textContent = flow.actionLabel;
    els.nextActionBtn.dataset.action = flow.nextAction;
  }
}

function getWorkflowState() {
  const hasMeta = Boolean(state.activeBatchId && state.activeModuleId);
  const hasTask = Boolean(state.activeTaskId && state.tasks.some((item) => item.id === state.activeTaskId));
  const hasSource = Boolean(uploadedFileContent.trim() || els.sourceUrl.value.trim() || els.sourceText?.value.trim() || state.documents.length);
  const hasCases = Boolean(state.cases.length);
  const hasExecution = state.cases.some((item) => item.executionStatus && item.executionStatus !== "未执行");
  const hasBug = Boolean(state.bugs.length);
  const hasExecutionOrBug = hasExecution || hasBug;
  const hasReportData = Boolean(hasCases);

  if (!hasMeta) {
    return {
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
  if (stepKey === "meta") return "create-meta";
  if (stepKey === "task") return "create-task";
  if (stepKey === "source") return "prepare-source";
  if (stepKey === "cases") return "generate-cases";
  if (stepKey === "execution") return "execute-cases";
  return "export-report";
}

function getStepButtonLabel(stepKey) {
  if (stepKey === "meta") return "去创建版本";
  if (stepKey === "task") return "去创建任务";
  if (stepKey === "source") return "去准备内容";
  if (stepKey === "cases") return "去生成用例";
  if (stepKey === "execution") return "去执行";
  return "去导出";
}

function handleRecommendedAction() {
  if (els.nextActionBtn) {
    handleShortcutAction(els.nextActionBtn.dataset.action);
  }
}

function handleShortcutAction(action) {
  if (!action) {
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
    switchTab("execution");
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
  const activeBatch = getBatchById(state.activeBatchId);
  const activeModule = getModuleById(state.activeModuleId);
  const activeTask = getTaskById(state.activeTaskId);
  const generationBatch = getBatchById(activeTask?.batchId || state.generationBatchId);
  const generationModule = getModuleById(activeTask?.moduleId || generationBatch?.moduleId);

  els.currentVersionSummary.innerHTML = activeBatch
    ? `
      <div class="version-summary-card">
        <span class="summary-label">当前已保存</span>
        <strong>${escapeHtml((activeModule?.name || activeBatch.moduleName || activeBatch.name || "").trim())} ${escapeHtml(activeBatch.version || "")}</strong>
        <p>${escapeHtml(getOwnerDisplay(activeBatch.owners || activeBatch.owner) ? `负责人：${getOwnerDisplay(activeBatch.owners || activeBatch.owner)}` : "已保存当前版本，可继续上传文档并生成用例。")}</p>
      </div>
    `
    : `
      <div class="version-summary-card version-summary-empty">
        <span class="summary-label">当前已保存</span>
        <strong>还没有保存版本</strong>
        <p>先按上面的 4 步填写，保存后这里会显示当前版本。</p>
      </div>
    `;

  els.currentTaskSummary.innerHTML = activeTask
    ? `
      <div class="version-summary-card">
        <span class="summary-label">当前任务</span>
        <strong>${escapeHtml(activeTask.name)}</strong>
        <p>${escapeHtml(activeTask.scope || `${activeTask.batchVersion || "未关联版本"} / ${activeTask.moduleName || "未分类业务"}`)}</p>
        <p>${escapeHtml(getOwnerDisplay(activeTask.owners || activeTask.owner) ? `负责人：${getOwnerDisplay(activeTask.owners || activeTask.owner)}` : "还没指定负责人")}</p>
      </div>
    `
    : `
      <div class="version-summary-card version-summary-empty">
        <span class="summary-label">当前任务</span>
        <strong>还没有保存任务</strong>
        <p>先给版本下面建一个测试任务，再去生成对应的用例。</p>
      </div>
    `;

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
  if (!state.tasks.length) {
    els.taskManagerList.innerHTML = `
      <div class="empty-state empty-state-rich">
        <strong>还没有测试任务</strong>
        <p>先给某个版本建任务，比如“登录回归”“退款修复验证”。</p>
      </div>
    `;
    return;
  }

  els.taskManagerList.innerHTML = "";
  state.tasks.forEach((task) => {
    const isActive = task.id === state.activeTaskId;
    const batch = getBatchById(task.batchId);
    const node = document.createElement("article");
    node.className = "list-card version-card";
    node.innerHTML = `
      <div class="card-top">
        <div>
          <h3 class="case-title-text">${escapeHtml(task.name || "未命名任务")}</h3>
          <div class="card-meta">
            <span class="badge">${escapeHtml(task.batchVersion || batch?.version || "未关联版本")}</span>
            <span class="badge subtle">${escapeHtml(task.moduleName || batch?.moduleName || "未分类业务")}</span>
            ${isActive ? `<span class="badge tone-orange">当前任务</span>` : ""}
          </div>
        </div>
        <div class="card-actions">
          ${!isActive ? `<button class="ghost-button tiny-button" data-task-action="activate" data-task-id="${task.id}">设为当前</button>` : ""}
          <button class="ghost-button tiny-button" data-task-action="edit" data-task-id="${task.id}">编辑</button>
          <button class="danger-link" data-task-action="delete" data-task-id="${task.id}">删除</button>
        </div>
      </div>
      <div class="version-card-body">
        <div class="summary-block">
          <span class="summary-label">所属版本</span>
          <p>${escapeHtml(formatTaskBatchLabel(batch || { version: task.batchVersion, moduleName: task.moduleName, name: task.moduleName }))}</p>
        </div>
        <div class="summary-block">
          <span class="summary-label">测试内容</span>
          <p>${escapeHtml(task.scope || "未填写")}</p>
        </div>
        <div class="summary-block">
          <span class="summary-label">负责人</span>
          <p>${escapeHtml(getOwnerDisplay(task.owners || task.owner) || "未分配")}</p>
        </div>
      </div>
    `;
    bindTaskCard(node, task.id);
    els.taskManagerList.appendChild(node);
  });
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
    const moduleName = batch.moduleName || getModuleNameById(batch.moduleId) || batch.name || "未分类";
    const isActive = batch.id === state.activeBatchId;
    const isSuspended = batch.status === "已挂起";
    const node = document.createElement("article");
    node.className = "list-card version-card";
    node.innerHTML = `
      <div class="card-top">
        <div>
          <h3 class="case-title-text">${escapeHtml(batch.version || "未命名版本")}</h3>
          <div class="card-meta">
            <span class="badge">${escapeHtml(moduleName)}</span>
            <span class="badge subtle ${isSuspended ? "tone-gray" : "tone-green"}">${escapeHtml(batch.status || "进行中")}</span>
            ${isActive ? `<span class="badge tone-orange">当前版本</span>` : ""}
          </div>
        </div>
        <div class="card-actions">
          ${!isActive && !isSuspended ? `<button class="ghost-button tiny-button" data-version-action="activate" data-version-id="${batch.id}">设为当前</button>` : ""}
          <button class="ghost-button tiny-button" data-version-action="edit" data-version-id="${batch.id}">编辑</button>
          <button class="ghost-button tiny-button" data-version-action="${isSuspended ? "resume" : "suspend"}" data-version-id="${batch.id}">${isSuspended ? "恢复" : "挂起"}</button>
          <button class="danger-link" data-version-action="delete" data-version-id="${batch.id}">删除</button>
        </div>
      </div>
      <div class="version-card-body">
        <div class="summary-block">
          <span class="summary-label">业务</span>
          <p>${escapeHtml(moduleName)}</p>
        </div>
        <div class="summary-block">
          <span class="summary-label">负责人</span>
          <p>${escapeHtml(getOwnerDisplay(batch.owners || batch.owner) || "未分配")}</p>
        </div>
      </div>
    `;
    bindVersionCard(node, batch.id);
    els.versionManagerList.appendChild(node);
  });
}

function bindVersionCard(node, batchId) {
  node.querySelectorAll("[data-version-action]").forEach((button) => {
    button.addEventListener("click", () => {
      handleVersionAction(button.dataset.versionAction, batchId);
    });
  });
}

function bindTaskCard(node, taskId) {
  node.querySelectorAll("[data-task-action]").forEach((button) => {
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

  if (action === "delete") {
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
  const moduleName = batch.moduleName || batch.name || "";
  return [batch.version || "未命名版本", moduleName].filter(Boolean).join(" / ");
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

function getFilteredCasesForView() {
  const keyword = els.caseSearch.value.trim().toLowerCase();
  const batchFilter = els.caseBatchFilter.value;
  const taskFilter = els.caseTaskFilter.value;
  const moduleFilter = els.caseModuleFilter.value;

  return state.cases.filter((item) => {
    const haystack = [item.title, item.module, item.type, item.batchName, item.taskName].join(" ").toLowerCase();
    return (!keyword || haystack.includes(keyword))
      && (!batchFilter || item.batchId === batchFilter)
      && (!taskFilter || item.taskName === taskFilter)
      && (!moduleFilter || item.module === moduleFilter);
  });
}

function getFilteredExecutionCases() {
  const batchFilter = els.executionBatchFilter.value;
  const taskFilter = els.executionTaskFilter.value;
  const moduleFilter = els.executionModuleFilter.value;

  return state.cases.filter((item) => {
    return (!batchFilter || item.batchId === batchFilter)
      && (!taskFilter || item.taskName === taskFilter)
      && (!moduleFilter || item.module === moduleFilter);
  });
}

function getFilteredBugs() {
  const batchFilter = els.bugBatchFilter.value;
  const taskFilter = els.bugTaskFilter.value;
  const moduleFilter = els.bugModuleFilter.value;

  return state.bugs.filter((bug) => {
    const byBatch = !batchFilter || bug.batchId === batchFilter;
    const byTask = !taskFilter || bug.taskName === taskFilter;
    const byModule = !moduleFilter || bug.moduleId === moduleFilter;
    return byBatch && byTask && byModule;
  });
}

function getReportScope() {
  const activeBatch = getBatchById(state.activeBatchId);
  const activeTask = getTaskById(state.activeTaskId);
  const activeModule = getModuleById(state.activeModuleId);

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

function renderCaseFilters() {
  fillSelectFromItems(els.caseBatchFilter, state.batches, "全部批次", els.caseBatchFilter.value, formatBatchLabel);
  fillSelectFromItems(els.executionBatchFilter, state.batches, "全部批次", els.executionBatchFilter.value, formatBatchLabel);
  fillSelectFromItems(els.bugBatchFilter, state.batches, "全部批次", els.bugBatchFilter.value, formatBatchLabel);
  fillSelectFromItems(els.bugModuleFilter, state.modules, "全部模块", els.bugModuleFilter.value, (item) => item.name);

  const modules = getCaseModules();
  const tasks = getCaseTasks();
  const caseModuleValue = modules.includes(els.caseModuleFilter.value) ? els.caseModuleFilter.value : "";
  const executionModuleValue = modules.includes(els.executionModuleFilter.value) ? els.executionModuleFilter.value : "";
  const caseTaskValue = tasks.includes(els.caseTaskFilter.value) ? els.caseTaskFilter.value : "";
  const executionTaskValue = tasks.includes(els.executionTaskFilter.value) ? els.executionTaskFilter.value : "";
  const bugTaskValue = tasks.includes(els.bugTaskFilter.value) ? els.bugTaskFilter.value : "";

  els.caseModuleFilter.innerHTML = `<option value="">全部模块</option>${modules.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}`;
  els.executionModuleFilter.innerHTML = `<option value="">全部模块</option>${modules.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}`;
  els.caseTaskFilter.innerHTML = `<option value="">全部任务</option>${tasks.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}`;
  els.executionTaskFilter.innerHTML = `<option value="">全部任务</option>${tasks.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}`;
  els.bugTaskFilter.innerHTML = `<option value="">全部任务</option>${tasks.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}`;

  els.caseModuleFilter.value = caseModuleValue;
  els.executionModuleFilter.value = executionModuleValue;
  els.caseTaskFilter.value = caseTaskValue;
  els.executionTaskFilter.value = executionTaskValue;
  els.bugTaskFilter.value = bugTaskValue;
}

function renderQuickStats() {
  const executedCount = state.cases.filter((item) => item.executionStatus !== "未执行").length;
  const bugOpenCount = state.bugs.filter((bug) => !["已验证", "已关闭"].includes(bug.status)).length;
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
}

function renderCases() {
  const filtered = getFilteredCasesForView();

  if (!filtered.length) {
    els.caseList.innerHTML = `
      <div class="empty-state empty-state-rich">
        <strong>这里还没有测试用例</strong>
        <p>先去生成用例，或者直接上传现成 CSV。</p>
        <div class="empty-actions">
          <button class="ghost-button" data-action="generate-cases">去生成用例</button>
        </div>
      </div>
    `;
    return;
  }

  els.caseList.innerHTML = "";
  filtered.forEach((item) => {
    const node = els.caseTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".case-title-text").textContent = item.title;
    node.querySelector(".case-module").textContent = item.module;
    node.querySelector(".case-version").textContent = item.batchVersion || "未带版本";
    node.querySelector(".case-batch").textContent = item.batchName || "未分批次";
    node.querySelector(".case-task").textContent = item.taskName || "未分任务";

    const typeBadge = node.querySelector(".case-type");
    const priorityBadge = node.querySelector(".case-priority");
    typeBadge.textContent = item.type;
    priorityBadge.textContent = item.priority;
    applyBadgeTone(typeBadge, getCaseTypeTone(item.type));
    applyBadgeTone(priorityBadge, getPriorityTone(item.priority));

    node.querySelector(".case-preconditions-preview").textContent = truncateText(item.preconditions, 90);
    node.querySelector(".case-steps-preview").textContent = truncateText(item.steps, 110);
    node.querySelector(".case-preconditions-full").textContent = item.preconditions || "无";
    node.querySelector(".case-steps-full").textContent = item.steps || "无";
    node.querySelector(".case-expected-full").textContent = item.expected || "无";

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

function renderExecution() {
  const filteredCases = getFilteredExecutionCases();
  if (!filteredCases.length) {
    els.executionList.innerHTML = `
      <div class="empty-state empty-state-rich">
        <strong>当前范围里还没有可执行用例</strong>
        <p>先去生成或导入用例，再回来改执行状态。</p>
        <div class="empty-actions">
          <button class="ghost-button" data-action="generate-cases">去准备用例</button>
        </div>
      </div>
    `;
    return;
  }

  els.executionList.innerHTML = "";
  filteredCases.forEach((item) => {
    const node = els.executionTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".execution-title").textContent = item.title;
    node.querySelector(".execution-module").textContent = item.module;
    node.querySelector(".execution-version").textContent = item.batchVersion || "未带版本";
    node.querySelector(".execution-batch").textContent = item.batchName || "未分批次";
    node.querySelector(".execution-task").textContent = item.taskName || "未分任务";

    const priorityBadge = node.querySelector(".execution-priority");
    const statusBadge = node.querySelector(".execution-status-badge");
    priorityBadge.textContent = item.priority;
    applyBadgeTone(priorityBadge, getPriorityTone(item.priority));

    node.querySelector(".execution-status").value = item.executionStatus || "未执行";
    syncExecutionStatusBadge(statusBadge, item.executionStatus || "未执行");
    node.querySelector(".execution-note").value = item.executionNote || "";

    node.querySelector(".execution-status").addEventListener("change", (event) => {
      item.executionStatus = event.target.value;
      syncExecutionStatusBadge(statusBadge, item.executionStatus);
      persist();
      renderQuickStats();
      renderReport();
    });

    node.querySelector(".execution-note").addEventListener("input", (event) => {
      item.executionNote = event.target.value.trim();
      persist();
    });

    els.executionList.appendChild(node);
  });
}

function createBugRecord() {
  const firstCase = getFilteredExecutionCases()[0] || state.cases[0];
  const activeBatch = getBatchById(state.activeBatchId);
  const activeTask = getTaskById(state.activeTaskId);
  const activeModule = getModuleById(state.activeModuleId);

  state.bugs.unshift({
    id: `bug-${Date.now()}`,
    title: "新BUG",
    caseId: firstCase ? firstCase.id : "",
    taskId: firstCase?.taskId || activeTask?.id || "",
    taskName: firstCase?.taskName || activeTask?.name || "",
    batchId: firstCase?.batchId || activeBatch?.id || "",
    batchName: firstCase?.batchName || (activeBatch ? formatBatchLabel(activeBatch) : ""),
    moduleId: firstCase?.moduleId || activeModule?.id || "",
    moduleName: firstCase?.module || activeModule?.name || "",
    severity: "中",
    status: "新建",
    owner: splitOwnerValues(activeTask?.owners || activeTask?.owner)[0] || splitOwnerValues(activeBatch?.owners || activeBatch?.owner)[0] || "",
    link: "",
    note: ""
  });

  persist();
  renderAll();
  switchTab("execution");
}

function renderBugs() {
  const filteredBugs = getFilteredBugs();
  if (!filteredBugs.length) {
    els.bugList.innerHTML = `
      <div class="empty-state empty-state-rich">
        <strong>当前范围里还没有 BUG 记录</strong>
        <p>执行时发现问题，再点“新增BUG”补进来就行。</p>
        ${state.cases.length ? `<div class="empty-actions"><button class="ghost-button" id="emptyAddBugBtn">新增BUG</button></div>` : ""}
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
    node.querySelector(".bug-title").value = bug.title;
    fillCaseOptions(node.querySelector(".bug-case"), bug.caseId);
    fillSelectFromItems(node.querySelector(".bug-batch"), state.batches, "未选择", bug.batchId, formatBatchLabel);
    fillSelectFromItems(node.querySelector(".bug-module"), state.modules, "未选择", bug.moduleId, (item) => item.name);
    node.querySelector(".bug-severity").value = bug.severity;
    node.querySelector(".bug-status").value = bug.status;
    syncBugBadges(node, bug.severity, bug.status);
    fillOwnerSelect(node.querySelector(".bug-owner"), bug.owner, "未选择");
    node.querySelector(".bug-link").value = bug.link;
    node.querySelector(".bug-note").value = bug.note;

    node.querySelectorAll("input, textarea, select").forEach((control) => {
      control.addEventListener("input", () => updateBugFromNode(node, bug.id));
      control.addEventListener("change", () => updateBugFromNode(node, bug.id));
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

  syncBugBadges(node, item.severity, item.status);
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
  if (["已修复", "已验证"].includes(status)) return "tone-green";
  return "tone-gray";
}

function renderReport() {
  const report = buildReportViewModel();
  const ownerTags = report.testOwners.length
    ? report.testOwners.map((owner) => `<span class="badge tone-green">${escapeHtml(owner)}</span>`).join("")
    : `<span class="badge tone-gray">未分配</span>`;

  els.reportHero.innerHTML = `
    <div class="report-title-wrap">
      <span class="summary-label">测试范围</span>
      <h3>${escapeHtml(report.heroTitle)}</h3>
      <p>${escapeHtml(report.scopeLabel)}</p>
      <div class="card-meta report-owner-tags">
        <span class="summary-label">测试负责人</span>
        ${ownerTags}
      </div>
    </div>
    <div class="report-hero-meta">
      <div class="hero-meta-item">
        <span>版本</span>
        <strong>${escapeHtml(report.batchVersion)}</strong>
      </div>
      <div class="hero-meta-item">
        <span>任务</span>
        <strong>${escapeHtml(report.taskName)}</strong>
      </div>
      <div class="hero-meta-item">
        <span>生成时间</span>
        <strong>${escapeHtml(report.generatedAt)}</strong>
      </div>
    </div>
  `;

  els.reportHealthCard.innerHTML = `
    <span class="summary-label">发布建议</span>
    <div class="health-pill ${report.releaseDecision.tone}">${escapeHtml(report.releaseDecision.label)}</div>
    <p>${escapeHtml(report.releaseDecision.desc)}</p>
  `;

  els.reportMetrics.innerHTML = report.metricCards.map(([label, value, tone]) => `
    <article class="metric-card">
      <span>${label}</span>
      <strong>${value}</strong>
      <i class="metric-accent ${tone}"></i>
    </article>
  `).join("");

  els.reportSummary.innerHTML = report.summaryItems.map(([label, value]) => `
    <div class="stat-item">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `).join("");

  renderReportBars(els.reportExecutionBars, report.executionBars);
  renderReportBars(els.reportBugStatusBars, report.bugStatusBars);
  renderReportBars(els.reportBugSeverityBars, report.bugSeverityBars);

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

function buildReportViewModel() {
  const scope = getReportScope();
  const total = scope.cases.length;
  const statusCounts = countBy(scope.cases, "executionStatus", ["未执行", "通过", "失败", "阻塞"]);
  const bugStatusCounts = countBy(scope.bugs, "status", ["新建", "已提交", "已修复", "已验证", "已关闭"]);
  const bugSeverityCounts = countBy(scope.bugs, "severity", ["严重", "中", "低"]);
  const failedCases = scope.cases.filter((item) => item.executionStatus === "失败");
  const unresolvedBugs = scope.bugs.filter((item) => !["已修复", "已验证", "已关闭"].includes(item.status));
  const passed = statusCounts["通过"] || 0;
  const executed = total - (statusCounts["未执行"] || 0);
  const executionRate = total ? `${Math.round((executed / total) * 100)}%` : "0%";
  const passRate = executed ? `${Math.round((passed / executed) * 100)}%` : "0%";
  const openBugs = scope.bugs.filter((bug) => !["已验证", "已关闭"].includes(bug.status)).length;
  const testOwners = getReportOwners(scope);
  const scopeLabel = [
    scope.module ? `业务：${scope.module.name}` : "",
    scope.batch ? `版本：${scope.batch.version || ""}` : "",
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
    batchVersion: scope.batch?.version || "未选择",
    taskName: scope.task?.name || "未选择",
    generatedAt: new Date().toLocaleString("zh-CN"),
    summaryItems: [
      ["当前范围", scopeLabel],
      ["测试负责人", testOwners.join("、") || "未分配"],
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
      ["待跟进 BUG", openBugs]
    ],
    releaseDecision: getReleaseDecision({
      failed: statusCounts["失败"] || 0,
      blocked: statusCounts["阻塞"] || 0,
      openBugs,
      severeBugCount: bugSeverityCounts["严重"] || 0
    }),
    metricCards: [
      ["用例总数", total, "tone-gray"],
      ["执行用例", executed, "tone-green"],
      ["成功用例", passed, "tone-green"],
      ["失败用例", statusCounts["失败"] || 0, "tone-red"],
      ["阻塞用例", statusCounts["阻塞"] || 0, "tone-orange"],
      ["BUG总数", scope.bugs.length, "tone-red"],
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
      ["已验证", bugStatusCounts["已验证"] || 0, getBugStatusTone("已验证")],
      ["已关闭", bugStatusCounts["已关闭"] || 0, getBugStatusTone("已关闭")]
    ],
    bugSeverityBars: [
      ["严重", bugSeverityCounts["严重"] || 0, getBugSeverityTone("严重")],
      ["中", bugSeverityCounts["中"] || 0, getBugSeverityTone("中")],
      ["低", bugSeverityCounts["低"] || 0, getBugSeverityTone("低")]
    ],
    failedCases,
    unresolvedBugs,
    topFailedCases: failedCases.slice(0, 5),
    topOpenBugs: unresolvedBugs.slice(0, 5)
  };
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

function exportReport() {
  const report = buildReportViewModel();
  const html = buildReportHtml(report);
  const fileBaseName = [
    "report",
    report.scope.batch?.version || "no-version",
    report.scope.task?.name || "summary"
  ].map(sanitizeFileName).join("-");
  printReportPdf(`${fileBaseName}.pdf`, html);
}

function buildReportHtml(report) {
  const conclusion = state.reportConclusion || "暂无补充结论。";
  const ownerTags = report.testOwners.length
    ? report.testOwners.map((owner) => `<span class="badge tone-green">${escapeHtml(owner)}</span>`).join("")
    : `<span class="badge tone-gray">未分配</span>`;
  const renderSummaryTable = report.summaryItems.map(([label, value]) => `
    <tr>
      <th>${escapeHtml(label)}</th>
      <td>${escapeHtml(value)}</td>
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
        <h3>报告摘要</h3>
        <table class="summary-table">
          <tbody>${renderSummaryTable}</tbody>
        </table>
      </section>
      <section class="panel">
        <h3>风险与结论</h3>
        <table class="summary-table">
          <tbody>${renderRiskTable}</tbody>
        </table>
      </section>
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

  persist();
  saveTeamMembersConfig();
  renderAll();
  setGenerationStatus("已导入演示数据。", "ok");
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultState(), ...JSON.parse(raw) } : defaultState();
  } catch (_error) {
    return defaultState();
  }
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
    reportConclusion: "",
    lastGeneration: null,
    settings: {
      apiKey: "",
      model: "gpt-5.4-mini"
    },
    uiMode: "guide"
  };
}

function persist() {
  const localState = Object.fromEntries(LOCAL_STATE_KEYS.map((key) => [key, structuredCloneSafe(state[key])]));
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
