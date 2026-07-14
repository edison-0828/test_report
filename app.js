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
const LOCAL_STATE_KEYS = ["activeBatchId", "generationBatchId", "activeTaskId", "activeModuleId", "activeReportBatchId", "settings", "uiMode", "selfTestSnapshot", "caseQualityReports", "caseQualityCasesByBusiness", "caseQualityBusiness", "uiAutomationSettings", "uiAutomationSession"];
const DEFAULT_WORKSPACE_VERSION = "默认工作区";
const DEFAULT_AI_MODEL = "gpt-5.4";
const CASE_QUALITY_BUSINESSES = ["VA业务", "卡收单业务"];
const AUTOMATION_STEP_TYPES = [
  { value: "openPage", label: "打开页面", action: "goto" },
  { value: "click", label: "点击", action: "click" },
  { value: "input", label: "输入", action: "fill" },
  { value: "waitElement", label: "等待元素", action: "waitFor" },
  { value: "assertText", label: "校验文本", action: "assertText" },
  { value: "assertElement", label: "校验元素存在", action: "assertVisible" },
  { value: "screenshot", label: "截图", action: "screenshot" },
  { value: "wait", label: "等待", action: "waitForTimeout" }
];
const AUTOMATION_LOCATOR_TYPES = [
  { value: "css", label: "CSS" },
  { value: "text", label: "文本" },
  { value: "placeholder", label: "placeholder" },
  { value: "label", label: "label" }
];
const AUTOMATION_STEP_TEMPLATES = [
  {
    value: "login",
    label: "登录流程",
    steps: [
      { stepType: "input", locatorType: "placeholder", target: "请输入账号", inputValue: "", remark: "账号输入框提示词" },
      { stepType: "input", locatorType: "placeholder", target: "请输入密码", inputValue: "", remark: "密码输入框提示词" },
      { stepType: "click", locatorType: "text", target: "登录", inputValue: "", remark: "登录按钮文案" },
      { stepType: "assertElement", locatorType: "text", target: "首页", inputValue: "", remark: "登录成功后的页面标识" }
    ]
  },
  {
    value: "search",
    label: "搜索流程",
    steps: [
      { stepType: "input", locatorType: "placeholder", target: "请输入搜索关键词", inputValue: "", remark: "搜索框提示词" },
      { stepType: "click", locatorType: "text", target: "搜索", inputValue: "", remark: "搜索按钮文案" },
      { stepType: "assertElement", locatorType: "css", target: ".table-row", inputValue: "", remark: "结果列表行" }
    ]
  },
  {
    value: "newForm",
    label: "新增表单",
    steps: [
      { stepType: "click", locatorType: "text", target: "新增", inputValue: "", remark: "打开新增表单" },
      { stepType: "input", locatorType: "label", target: "名称", inputValue: "", remark: "填写主字段" },
      { stepType: "click", locatorType: "text", target: "保存", inputValue: "", remark: "提交表单" },
      { stepType: "assertText", locatorType: "css", target: "body", inputValue: "成功", remark: "校验保存结果" }
    ]
  },
  {
    value: "submit",
    label: "提交流程",
    steps: [
      { stepType: "click", locatorType: "text", target: "提交", inputValue: "", remark: "提交按钮文案" },
      { stepType: "assertText", locatorType: "css", target: "body", inputValue: "成功", remark: "提交成功提示" }
    ]
  },
  {
    value: "listCheck",
    label: "列表校验",
    steps: [
      { stepType: "waitElement", locatorType: "css", target: ".table-row", inputValue: "", remark: "等待列表加载完成" },
      { stepType: "assertElement", locatorType: "css", target: ".table-row", inputValue: "", remark: "列表至少存在一行" }
    ]
  },
  {
    value: "detailCheck",
    label: "详情页校验",
    steps: [
      { stepType: "click", locatorType: "css", target: ".table-row:first-child", inputValue: "", remark: "进入详情页" },
      { stepType: "assertElement", locatorType: "text", target: "详情", inputValue: "", remark: "详情页标题" },
      { stepType: "screenshot", locatorType: "css", target: "body", inputValue: "detail-page", remark: "留存详情页截图" }
    ]
  }
];
const AUTOMATION_QUICK_ADD_TYPES = ["openPage", "click", "input", "assertElement"];
const REPORT_VERSIONS_PER_PAGE = 10;

const state = loadState();

const els = {
  navLinks: [...document.querySelectorAll(".nav-link")],
  panels: [...document.querySelectorAll(".tab-panel")],
  topbarTitle: document.getElementById("topbarTitle"),
  topbarMenuBtn: document.getElementById("topbarMenuBtn"),
  topbarSelfTest: document.getElementById("topbarSelfTest"),
  topbarSettings: document.getElementById("topbarSettings"),
  sidebarBackdrop: document.getElementById("sidebarBackdrop"),
  documentInput: document.getElementById("documentInput"),
  documentUploadBox: document.getElementById("documentUploadBox"),
  uploadBoxPrimary: document.getElementById("uploadBoxPrimary"),
  uploadBoxSecondary: document.getElementById("uploadBoxSecondary"),
  sourceType: document.getElementById("sourceType"),
  sourceUrl: document.getElementById("sourceUrl"),
  sourceUrlWrap: document.getElementById("sourceUrlWrap"),
  sourceText: document.getElementById("sourceText"),
  sourceTextWrap: document.getElementById("sourceTextWrap"),
  documentName: document.getElementById("documentName"),
  documentType: document.getElementById("documentType"),
  generateCases: document.getElementById("createTaskAndGenerate"),
  generateCasesLocal: document.getElementById("generateCasesLocal"),
  saveDocument: document.getElementById("saveDocument"),
  generationStatus: document.getElementById("generationStatus"),
  qualityBusinessTabs: [...document.querySelectorAll(".quality-business-tab")],
  qualityBusinessModules: document.getElementById("qualityBusinessModules"),
  caseQualityBadge: document.getElementById("caseQualityBadge"),
  caseQualitySource: document.getElementById("caseQualitySource"),
  caseQualityStatus: document.getElementById("caseQualityStatus"),
  caseQualitySummary: document.getElementById("caseQualitySummary"),
  caseQualityIssues: document.getElementById("caseQualityIssues"),
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
  createTaskBtn: document.getElementById("createTaskAndGenerate"),
  currentTaskSummary: document.getElementById("currentTaskSummary"),
  generationVersionSummary: document.getElementById("generationVersionSummary"),
  versionManagerList: document.getElementById("versionManagerList"),
  versionManagerCount: document.getElementById("versionManagerCount"),
  versionSearchInput: document.getElementById("versionSearchInput"),
  versionStatusFilter: document.getElementById("versionStatusFilter"),
  addVersionBtn: document.getElementById("addVersionBtn"),
  versionModal: document.getElementById("versionModal"),
  versionModalTitle: document.getElementById("versionModalTitle"),
  versionForm: document.getElementById("versionForm"),
  versionNumberInput: document.getElementById("versionNumberInput"),
  versionTaskOptions: document.getElementById("versionTaskOptions"),
  versionTaskSelectionCount: document.getElementById("versionTaskSelectionCount"),
  versionFormFeedback: document.getElementById("versionFormFeedback"),
  closeVersionModal: document.getElementById("closeVersionModal"),
  cancelVersionModal: document.getElementById("cancelVersionModal"),
  taskManagerList: document.getElementById("taskManagerList"),
  taskManagerCount: document.getElementById("taskManagerCount"),
  taskSearchInput: document.getElementById("taskSearchInput"),
  taskVersionFilter: document.getElementById("taskVersionFilter"),
  goCreateTaskBtn: document.getElementById("goCreateTaskBtn"),
  versionsPanel: document.getElementById("versions"),
  quickStats: document.getElementById("quickStats"),
  sidebarContext: document.getElementById("sidebarContext"),
  sidebarBackToTop: document.getElementById("sidebarBackToTop"),
  apiKey: document.getElementById("apiKey"),
  toggleApiKey: document.getElementById("toggleApiKey"),
  apiStatus: document.getElementById("apiStatus"),
  checkApiKey: document.getElementById("checkApiKey"),
  clearApiKey: document.getElementById("clearApiKey"),
  modelSelect: document.getElementById("modelSelect"),
  apiFeedback: document.getElementById("apiFeedback"),
  caseList: document.getElementById("caseList"),
  caseExecutionWorkspace: document.getElementById("caseExecutionWorkspace"),
  caseProgressPercent: document.getElementById("caseProgressPercent"),
  caseProgressSummary: document.getElementById("caseProgressSummary"),
  caseProgressBar: document.getElementById("caseProgressBar"),
  caseProgressStats: document.getElementById("caseProgressStats"),
  caseBrowserCount: document.getElementById("caseBrowserCount"),
  caseImportInput: document.getElementById("caseImportInput"),
  automationCaseImportInput: document.getElementById("automationCaseImportInput"),
  caseBatchFilter: document.getElementById("caseBatchFilter"),
  caseTaskFilter: document.getElementById("caseTaskFilter"),
  caseStatusFilter: document.getElementById("caseStatusFilter"),
  caseBulkStatus: document.getElementById("caseBulkStatus"),
  applyCaseBulkStatus: document.getElementById("applyCaseBulkStatus"),
  exportCasesBtn: document.getElementById("exportCasesBtn"),
  caseActionStatus: document.getElementById("caseActionStatus"),
  automationCaseList: document.getElementById("automationCaseList"),
  automationCaseBatchFilter: document.getElementById("automationCaseBatchFilter"),
  automationCaseTaskFilter: document.getElementById("automationCaseTaskFilter"),
  automationCaseEnabledFilter: document.getElementById("automationCaseEnabledFilter"),
  automationCaseStatus: document.getElementById("automationCaseStatus"),
  apiAutomationSite: document.getElementById("apiAutomationSite"),
  apiAutomationEnv: document.getElementById("apiAutomationEnv"),
  apiAutomationBaseUrl: document.getElementById("apiAutomationBaseUrl"),
  runApiAutomationBatch: document.getElementById("runApiAutomationBatch"),
  viewApiAutomationRuns: document.getElementById("viewApiAutomationRuns"),
  apiAutomationConfigStatus: document.getElementById("apiAutomationConfigStatus"),
  automationBaseUrl: document.getElementById("automationBaseUrl"),
  automationLoginPath: document.getElementById("automationLoginPath"),
  automationSessionChip: document.getElementById("automationSessionChip"),
  automationSessionFeedback: document.getElementById("automationSessionFeedback"),
  startAutomationLoginSession: document.getElementById("startAutomationLoginSession"),
  confirmAutomationLoginSession: document.getElementById("confirmAutomationLoginSession"),
  refreshAutomationSession: document.getElementById("refreshAutomationSession"),
  executionBatchFilter: document.getElementById("executionBatchFilter"),
  executionTaskFilter: document.getElementById("executionTaskFilter"),
  executionModuleFilter: document.getElementById("executionModuleFilter"),
  executionBulkPass: document.getElementById("executionBulkPass"),
  executionList: document.getElementById("executionList"),
  bugBatchFilter: document.getElementById("bugBatchFilter"),
  bugTaskFilter: document.getElementById("bugTaskFilter"),
  bugSearchInput: document.getElementById("bugSearchInput"),
  bugSeverityFilter: document.getElementById("bugSeverityFilter"),
  bugWorkflowStatusFilter: document.getElementById("bugWorkflowStatusFilter"),
  bugManagerCount: document.getElementById("bugManagerCount"),
  bugHistoryList: document.getElementById("bugHistoryList"),
  bugList: document.getElementById("bugList"),
  bugStatus: document.getElementById("bugStatus"),
  addBug: document.getElementById("addBug"),
  bugModal: document.getElementById("bugModal"),
  bugModalTitle: document.getElementById("bugModalTitle"),
  bugModalBadges: document.getElementById("bugModalBadges"),
  bugForm: document.getElementById("bugForm"),
  bugModalName: document.getElementById("bugModalName"),
  bugModalSeverity: document.getElementById("bugModalSeverity"),
  bugModalStatus: document.getElementById("bugModalStatus"),
  bugModalBatch: document.getElementById("bugModalBatch"),
  bugModalTask: document.getElementById("bugModalTask"),
  bugModalCase: document.getElementById("bugModalCase"),
  bugModalLink: document.getElementById("bugModalLink"),
  bugModalNote: document.getElementById("bugModalNote"),
  bugModalImagePreview: document.getElementById("bugModalImagePreview"),
  bugModalPasteHint: document.getElementById("bugModalPasteHint"),
  bugModalTrace: document.getElementById("bugModalTrace"),
  bugModalFeedback: document.getElementById("bugModalFeedback"),
  closeBugModal: document.getElementById("closeBugModal"),
  cancelBugModal: document.getElementById("cancelBugModal"),
  editBugModal: document.getElementById("editBugModal"),
  deleteBugModal: document.getElementById("deleteBugModal"),
  saveBugModal: document.getElementById("saveBugModal"),
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
  reportVersionSearch: document.getElementById("reportVersionSearch"),
  reportVersionStatusFilter: document.getElementById("reportVersionStatusFilter"),
  reportReleaseFilter: document.getElementById("reportReleaseFilter"),
  reportVersionCount: document.getElementById("reportVersionCount"),
  reportVersionPagination: document.getElementById("reportVersionPagination"),
  reportVersionPrev: document.getElementById("reportVersionPrev"),
  reportVersionNext: document.getElementById("reportVersionNext"),
  reportVersionPageInfo: document.getElementById("reportVersionPageInfo"),
  reportDetailHeader: document.getElementById("reportDetailHeader"),
  exportReport: document.getElementById("exportReport"),
  runSelfTest: document.getElementById("runSelfTest"),
  selfTestStatus: document.getElementById("selfTestStatus"),
  selfTestFeedback: document.getElementById("selfTestFeedback"),
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
  apiKey: state.settings?.apiKey || "",
  model: normalizeAiModel(state.settings?.model),
  currentOperator: state.settings?.currentOperator || "",
  apiReady: false
};

let uploadedFileContent = "";
let editingBatchId = "";
let editingTaskId = "";
let activeExecutionCaseId = "";
let activeBugEditorId = "";
let bugModalRecordId = "";
let bugModalSourceCaseId = "";
let bugModalExistingImages = [];
let bugModalPendingImages = [];
let bugModalRemovedImageIds = [];
let reportVersionPage = 1;
let persistSharedTimer = 0;
const buttonSuccessTimers = new WeakMap();
const selfTestState = {
  running: false,
  result: state.selfTestSnapshot?.result || null,
  error: state.selfTestSnapshot?.error || ""
};
const uiAutomationState = normalizeUiAutomationSession(state.uiAutomationSession);
const apiAutomationConfigState = {
  defaultSite: "klicklpay",
  sites: {},
  environments: {},
  signature: {},
  error: ""
};

els.apiKey.value = settings.apiKey;
els.modelSelect.value = settings.model;
if (els.automationBaseUrl) {
  els.automationBaseUrl.value = state.uiAutomationSettings?.baseUrl || "";
}
if (els.automationLoginPath) {
  els.automationLoginPath.value = state.uiAutomationSettings?.loginPath || "";
}
autoResizeTextarea();

ensureSeedMetadata();
hydrateReportChrome();
hydrateWorkflowChrome();
simplifyUploadFlow();
initTextSourceUi();
initOwnerUi();
bindEvents();
renderAll();
hydrateInteractionUi();
ensureCasesToolbarEnhancements();
loadTeamMembersConfig();
loadSharedState();
loadApiAutomationConfig();
loadSelfTestStatus();
loadUiAutomationStatus();
checkApiStatus();
renderSourceMode();
renderSelfTestPanel();
renderUiAutomationPanel();

function bindEvents() {
  els.navLinks.forEach((link, index) => {
    link.addEventListener("click", () => {
      switchTab(link.dataset.tab);
      toggleMobileNavigation(false);
    });
    link.addEventListener("keydown", (event) => handleNavigationKeydown(event, index));
  });

  els.topbarMenuBtn?.addEventListener("click", () => {
    toggleMobileNavigation(!document.querySelector(".sidebar")?.classList.contains("is-open"));
  });
  els.sidebarBackdrop?.addEventListener("click", () => toggleMobileNavigation(false));
  els.topbarSelfTest?.addEventListener("click", () => {
    switchTab("upload");
    els.runSelfTest?.click();
  });
  els.topbarSettings?.addEventListener("click", () => {
    switchTab("upload");
    window.setTimeout(() => {
      els.apiKey?.focus();
      els.apiKey?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  });

  els.documentInput.addEventListener("change", handleFileUpload);
  els.sourceType.addEventListener("change", renderSourceMode);
  els.versionScopeInput?.addEventListener("input", autoResizeTextarea);
  els.taskScopeInput.addEventListener("input", autoResizeTextarea);
  els.sourceText?.addEventListener("input", autoResizeTextarea);
  els.generateCasesLocal?.addEventListener("click", () => handleGenerateCases("local"));
  els.saveDocument?.addEventListener("click", saveCurrentDocument);
  els.activeBatchSelect.addEventListener("change", handleActiveBatchChange);
  els.activeModuleSelect.addEventListener("change", handleActiveModuleChange);
  els.createBatchBtn.addEventListener("click", createBatch);
  els.createTaskBtn.addEventListener("click", createTaskAndGenerateCases);
  els.addVersionBtn?.addEventListener("click", () => openVersionModal());
  els.versionSearchInput?.addEventListener("input", renderVersionManager);
  els.versionStatusFilter?.addEventListener("change", renderVersionManager);
  els.versionForm?.addEventListener("submit", saveVersionFromManager);
  els.closeVersionModal?.addEventListener("click", closeVersionModal);
  els.cancelVersionModal?.addEventListener("click", closeVersionModal);
  els.versionModal?.addEventListener("click", (event) => {
    if (event.target === els.versionModal) closeVersionModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.versionModal?.classList.contains("hidden-field")) {
      closeVersionModal();
    }
    if (event.key === "Escape" && !els.bugModal?.classList.contains("hidden-field")) {
      closeBugModal();
    }
  });
  els.taskSearchInput?.addEventListener("input", renderTaskManager);
  els.taskVersionFilter?.addEventListener("change", renderTaskManager);
  els.goCreateTaskBtn?.addEventListener("click", () => {
    switchTab("upload");
    window.setTimeout(() => {
      els.taskNameInput?.focus();
      els.taskNameInput?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  });
  els.caseImportInput.addEventListener("change", handleCaseImport);
  els.automationCaseImportInput?.addEventListener("change", handleCaseImport);
  els.qualityBusinessTabs.forEach((button) => {
    button.addEventListener("click", () => setCaseQualityBusiness(button.dataset.qualityBusiness));
  });
  els.caseBatchFilter.addEventListener("change", () => {
    renderCaseFilters();
    renderCases();
  });
  els.caseTaskFilter.addEventListener("change", renderCases);
  els.caseStatusFilter?.addEventListener("change", renderCases);
  els.applyCaseBulkStatus?.addEventListener("click", applyBulkCaseExecutionStatus);
  els.exportCasesBtn?.addEventListener("click", exportFilteredCases);
  els.automationCaseBatchFilter?.addEventListener("change", () => {
    renderCaseFilters();
    renderAutomationCases();
  });
  els.automationCaseTaskFilter?.addEventListener("change", renderAutomationCases);
  els.automationCaseEnabledFilter?.addEventListener("change", renderAutomationCases);
  els.apiAutomationSite?.addEventListener("change", renderApiAutomationConfigPanel);
  els.apiAutomationEnv?.addEventListener("change", renderApiAutomationConfigPanel);
  els.runApiAutomationBatch?.addEventListener("click", handleApiAutomationBatchRun);
  els.viewApiAutomationRuns?.addEventListener("click", handleApiAutomationRunHistory);
  els.automationBaseUrl?.addEventListener("input", handleUiAutomationDraftChange);
  els.automationLoginPath?.addEventListener("input", handleUiAutomationDraftChange);
  els.startAutomationLoginSession?.addEventListener("click", startUiAutomationLoginSession);
  els.confirmAutomationLoginSession?.addEventListener("click", confirmUiAutomationLoginSession);
  els.refreshAutomationSession?.addEventListener("click", loadUiAutomationStatus);
  els.bugBatchFilter.addEventListener("change", () => {
    renderCaseFilters();
    renderBugs();
  });
  els.bugTaskFilter.addEventListener("change", renderBugs);
  els.bugSearchInput?.addEventListener("input", renderBugs);
  els.bugSeverityFilter?.addEventListener("change", renderBugs);
  els.bugWorkflowStatusFilter?.addEventListener("change", renderBugs);
  els.addBug.addEventListener("click", () => openBugModal());
  els.bugForm?.addEventListener("submit", saveBugFromModal);
  els.bugModalNote?.addEventListener("paste", handleBugNotePaste);
  els.bugModalImagePreview?.addEventListener("click", handleBugImagePreviewClick);
  els.closeBugModal?.addEventListener("click", closeBugModal);
  els.cancelBugModal?.addEventListener("click", closeBugModal);
  els.editBugModal?.addEventListener("click", () => setBugModalMode("edit"));
  els.deleteBugModal?.addEventListener("click", deleteBugFromModal);
  els.bugModal?.addEventListener("click", (event) => {
    if (event.target === els.bugModal) closeBugModal();
  });
  els.bugModalBatch?.addEventListener("change", () => refreshBugModalAssociations("batch"));
  els.bugModalTask?.addEventListener("change", () => refreshBugModalAssociations("task"));
  els.bugModalCase?.addEventListener("change", syncBugModalFromCase);
  els.bugModalSeverity?.addEventListener("change", renderBugModalBadges);
  els.bugModalStatus?.addEventListener("change", renderBugModalBadges);
  els.exportReport.addEventListener("click", exportReport);
  els.reportVersionSearch?.addEventListener("input", () => {
    reportVersionPage = 1;
    renderReport();
  });
  els.reportVersionStatusFilter?.addEventListener("change", () => {
    reportVersionPage = 1;
    renderReport();
  });
  els.reportReleaseFilter?.addEventListener("change", () => {
    reportVersionPage = 1;
    renderReport();
  });
  els.reportVersionPrev?.addEventListener("click", () => {
    reportVersionPage = Math.max(1, reportVersionPage - 1);
    renderReport();
  });
  els.reportVersionNext?.addEventListener("click", () => {
    reportVersionPage += 1;
    renderReport();
  });
  els.runSelfTest?.addEventListener("click", runSelfTest);
  els.checkApiKey?.addEventListener("click", () => saveApiSettings({ autoCheck: true }));
  els.clearApiKey?.addEventListener("click", clearApiSettings);
  els.modelSelect?.addEventListener("change", saveApiSettings);
  els.apiKey?.addEventListener("input", handleApiDraftChange);
  els.toggleApiKey?.addEventListener("click", toggleApiKeyVisibility);
  els.checkLark?.addEventListener("click", checkLarkStatus);
  els.syncLark?.addEventListener("click", syncLarkData);
  els.seedDemo?.addEventListener("click", seedDemoData);
  els.sidebarBackToTop?.addEventListener("click", scrollSidebarToTop);
  document.addEventListener("click", handleGlobalActionClick);
}

function hydrateInteractionUi() {
  const nav = document.querySelector(".nav");
  hydrateNavigationChrome();
  nav?.setAttribute("role", "tablist");
  nav?.setAttribute("aria-label", "主要功能");
  nav?.setAttribute("aria-orientation", "vertical");

  els.navLinks.forEach((link, index) => {
    const panel = els.panels.find((item) => item.id === link.dataset.tab);
    const isActive = link.classList.contains("active");
    link.id = link.id || `nav-${link.dataset.tab}`;
    link.setAttribute("role", "tab");
    link.setAttribute("aria-selected", isActive ? "true" : "false");
    link.tabIndex = isActive ? 0 : -1;
    if (panel) {
      link.setAttribute("aria-controls", panel.id);
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", link.id);
      panel.setAttribute("aria-hidden", isActive ? "false" : "true");
    }
  });

  const activeLink = els.navLinks.find((link) => link.classList.contains("active"));
  updateTopbarTitle(activeLink);

  hydrateFeedbackRegions();
}

function hydrateNavigationChrome() {
  const iconPaths = {
    upload: '<path d="M7 3.5h7l3 3V20H7z"></path><path d="M14 3.5V7h3M12 10v6M9 13h6"></path>',
    quality: '<path d="M12 3.5 19 6v5.2c0 4.2-2.9 7.6-7 9.3-4.1-1.7-7-5.1-7-9.3V6z"></path><path d="m8.7 12 2.1 2.1 4.5-4.6"></path>',
    tasks: '<path d="M8 4h11v16H8zM5 7h3M5 12h3M5 17h3"></path><path d="M11 9h5M11 14h5"></path>',
    versions: '<path d="m12 3 8 4-8 4-8-4z"></path><path d="m4 12 8 4 8-4M4 17l8 4 8-4"></path>',
    cases: '<path d="M8 4h11v16H8zM5 7H3m2 5H3m2 5H3"></path><path d="m11 9 1.5 1.5L16 7m-5 8 1.5 1.5L16 13"></path>',
    automationCases: '<path d="m8 7-4 5 4 5m8-10 4 5-4 5M14 4l-4 16"></path>',
    bugs: '<path d="M8 8h8v9a4 4 0 0 1-8 0zM9 8V6a3 3 0 0 1 6 0v2M4 11h4m8 0h4M4 16h4m8 0h4"></path>',
    report: '<path d="M5 20V10h4v10zm5 0V4h4v16zm5 0v-7h4v7z"></path>'
  };

  els.navLinks.forEach((link) => {
    if (link.querySelector(".nav-icon")) {
      return;
    }
    const label = link.textContent.trim();
    const icon = document.createElement("span");
    icon.className = "nav-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = `<svg viewBox="0 0 24 24">${iconPaths[link.dataset.tab] || iconPaths.upload}</svg>`;
    const text = document.createElement("span");
    text.className = "nav-label";
    text.textContent = label;
    link.replaceChildren(icon, text);
  });
}

function updateTopbarTitle(link) {
  if (!els.topbarTitle || !link) {
    return;
  }
  els.topbarTitle.textContent = link.querySelector(".nav-label")?.textContent || link.textContent.trim();
}

function toggleMobileNavigation(open) {
  const sidebar = document.querySelector(".sidebar");
  sidebar?.classList.toggle("is-open", open);
  els.sidebarBackdrop?.classList.toggle("is-visible", open);
  els.topbarMenuBtn?.setAttribute("aria-expanded", open ? "true" : "false");
  document.body.classList.toggle("nav-open", open);
}

function hydrateFeedbackRegions(root = document) {
  root.querySelectorAll(".inline-feedback").forEach((feedback) => {
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    feedback.setAttribute("aria-atomic", "true");
  });
}

function handleNavigationKeydown(event, currentIndex) {
  const lastIndex = els.navLinks.length - 1;
  let nextIndex = currentIndex;

  if (event.key === "ArrowDown" || event.key === "ArrowRight") {
    nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
  } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
    nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = lastIndex;
  } else {
    return;
  }

  event.preventDefault();
  const nextLink = els.navLinks[nextIndex];
  nextLink.focus();
  switchTab(nextLink.dataset.tab);
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

  const generateTitle = document.querySelector(".upload-stage-panel-generate > h3:first-child");
  if (generateTitle) {
    generateTitle.textContent = "3. 导入文档并生成用例";
  }

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
    option.textContent = "粘贴需求";
    sourceType.appendChild(option);
  }
}

function initOwnerUi() {
  const bugOwnerField = els.bugTemplate?.content.querySelector(".bug-owner");

  if (bugOwnerField && bugOwnerField.tagName === "INPUT") {
    const select = document.createElement("select");
    select.className = "bug-owner";
    select.innerHTML = `<option value="">未选择</option>`;
    bugOwnerField.replaceWith(select);
  }

}

function switchTab(tabId) {
  const targetPanel = els.panels.find((panel) => panel.id === tabId);
  if (!targetPanel || targetPanel.classList.contains("active")) {
    return;
  }

  els.navLinks.forEach((link) => {
    const isActive = link.dataset.tab === tabId;
    link.classList.toggle("active", isActive);
    link.setAttribute("aria-selected", isActive ? "true" : "false");
    link.tabIndex = isActive ? 0 : -1;
    if (isActive) {
      updateTopbarTitle(link);
    }
  });
  els.panels.forEach((panel) => {
    const isActive = panel === targetPanel;
    panel.classList.remove("entering");
    panel.classList.toggle("active", isActive);
    panel.setAttribute("aria-hidden", isActive ? "false" : "true");
  });
  targetPanel.classList.add("entering");
  window.setTimeout(() => {
    targetPanel.classList.remove("entering");
  }, 260);
  els.sidebarBackToTop?.classList.toggle("hidden-field", tabId !== "upload");
  toggleMobileNavigation(false);
  window.scrollTo({ top: 0, behavior: "smooth" });
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
    renderUploadedFileState();
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    els.documentName.value = file.name.replace(/\.[^.]+$/, "");
    uploadedFileContent = String(reader.result || "");
    renderUploadedFileState(file.name);
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
  if (!isFile) {
    renderUploadedFileState();
  }
}

function renderUploadedFileState(fileName = "") {
  if (!els.documentUploadBox || !els.uploadBoxPrimary || !els.uploadBoxSecondary) {
    return;
  }

  const resolvedFileName = fileName || els.documentInput?.files?.[0]?.name || "";
  const hasFile = Boolean(resolvedFileName);

  els.documentUploadBox.classList.toggle("has-file", hasFile);
  els.uploadBoxPrimary.textContent = hasFile ? resolvedFileName : "拖入或选择需求 / API 文件";
  els.uploadBoxSecondary.textContent = hasFile ? "文件已导入，重新选择可覆盖当前文件" : "支持 txt / md / json / yaml";
}

async function checkApiStatus() {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) {
      throw new Error("health check failed");
    }

    const data = await response.json();
    settings.apiReady = false;

    if (data.defaultModel && !state.settings?.model) {
      settings.model = data.defaultModel;
      els.modelSelect.value = data.defaultModel;
      state.settings = { ...state.settings, apiKey: settings.apiKey, model: settings.model };
      persist();
    }

    if (settings.apiKey) {
      setApiStatus("待检测", "neutral");
      setApiFeedback("已读取本机保存的个人 Key，点“检测并启用”后即可使用。", "neutral");
    } else {
      setApiStatus("需要填写 API Key", "warn");
      setApiFeedback("请先填写你自己的 API Key。", "warn");
    }
  } catch (_error) {
    settings.apiReady = false;
    setApiStatus("本地服务未启动", "error");
    setApiFeedback("本地服务未启动，请先启动项目后再检测个人 Key。", "error");
  }
}

async function saveApiSettings(options = {}) {
  const { autoCheck = false } = options;
  const previousApiKey = state.settings?.apiKey || "";
  const previousModel = normalizeAiModel(state.settings?.model);
  settings.apiKey = els.apiKey.value.trim();
  settings.model = els.modelSelect.value;
  state.settings = {
    ...state.settings,
    apiKey: settings.apiKey,
    model: settings.model,
    currentOperator: settings.currentOperator
  };
  const configChanged = settings.apiKey !== previousApiKey || settings.model !== previousModel;
  if (configChanged) {
    settings.apiReady = false;
  }
  persist();
  if (!settings.apiKey) {
    setApiStatus("需要填写 API Key", "warn");
    setApiFeedback(autoCheck ? "请先填写你的个人 Key，再检测并启用。" : "已清空个人 Key。", "warn");
    return;
  }

  if (autoCheck) {
    setApiStatus("已保存，正在检测", "neutral");
    setApiFeedback("个人 Key 已保存，正在自动检测并启用。", "neutral");
  } else {
    setApiStatus("待检测", "neutral");
    setApiFeedback("当前 Key 和模型已保存，如需使用请点“检测并启用”。", "neutral");
  }
  if (!autoCheck) {
    return;
  }

  await checkAiKey({
    showFeedback: false,
    successMessage: "个人 Key 已保存并启用，接下来可以直接生成用例。",
    errorMessage: "个人 Key 已保存，但自动启用失败了，请检查 Key、模型或网络。"
  });
}

function clearApiSettings() {
  settings.apiKey = "";
  settings.apiReady = false;
  els.apiKey.value = "";
  state.settings = {
    ...state.settings,
    apiKey: "",
    model: els.modelSelect.value,
    currentOperator: settings.currentOperator
  };
  persist();
  setApiStatus("需要填写 API Key", "warn");
  setApiFeedback("已清空当前浏览器保存的个人 Key。", "warn");
}

function handleApiDraftChange() {
  settings.apiKey = els.apiKey.value.trim();
  settings.apiReady = false;
  setApiStatus(settings.apiKey ? "待检测" : "需要填写 API Key", settings.apiKey ? "neutral" : "warn");
}

function toggleApiKeyVisibility() {
  if (!els.apiKey || !els.toggleApiKey) {
    return;
  }
  const nextType = els.apiKey.type === "password" ? "text" : "password";
  els.apiKey.type = nextType;
  els.toggleApiKey.textContent = nextType === "password" ? "显示" : "隐藏";
}

async function checkAiKey(options = {}) {
  const { showFeedback = true, successMessage = "", pendingMessage = "", errorMessage = "" } = options;
  const apiKey = els.apiKey.value.trim();
  const model = normalizeAiModel(settings.model);
  const checkButton = els.checkApiKey;
  const originalButtonText = checkButton?.textContent || "检测并启用";

  if (!apiKey) {
    setApiStatus("需要填写 API Key", "warn");
    if (showFeedback) {
      setApiFeedback("请先填写你自己的 API Key，再检测是否可用。", "warn");
    }
    return;
  }

  if (checkButton) {
    checkButton.disabled = true;
    checkButton.textContent = "检测中...";
  }
  setApiStatus("正在检测 Key", "neutral");
  if (showFeedback) {
    setApiFeedback(pendingMessage || "正在调用 AI 服务检测当前个人 Key...", "warn");
  }

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
    state.settings = {
      ...state.settings,
      apiKey,
      model,
      currentOperator: settings.currentOperator
    };
    persist();
    setApiStatus("个人 Key 可调用 AI", "ok");
    setApiFeedback(successMessage || `检测通过：你的个人 Key 可以调用 ${data.model || model}，后续生成用例将直接使用它。`, "ok");
  } catch (error) {
    settings.apiReady = false;
    setApiStatus("Key 检测失败", "error");
    if (showFeedback || errorMessage) {
      setApiFeedback(errorMessage || error.message || "AI Key 检测失败，请检查 Key、模型或网络。", "error");
    }
  } finally {
    if (checkButton) {
      checkButton.disabled = false;
      checkButton.textContent = originalButtonText;
    }
  }
}

async function ensureAiReadyForGeneration() {
  if (!settings.apiKey) {
    setApiStatus("需要填写 API Key", "warn");
    setApiFeedback("请先填写你的个人 API Key，再点“检测并启用”。", "warn");
    return false;
  }

  if (settings.apiReady) {
    return true;
  }

  await checkAiKey({
    showFeedback: false,
    successMessage: "已自动启用个人 Key，本次会直接继续生成用例。",
    errorMessage: "自动启用个人 Key 失败，请检查 Key、模型或网络。"
  });

  if (settings.apiReady) {
    return true;
  }

  setGenerationStatus("你的 API Key 还没有启用成功，请检查 Key、模型或网络后重试。", "error");
  return false;
}

function setApiStatus(text, tone) {
  els.apiStatus.textContent = text;
  els.apiStatus.className = `status-pill ${tone}`;
}

function setApiFeedback(text, tone = "neutral") {
  if (!els.apiFeedback) {
    return;
  }
  els.apiFeedback.textContent = text;
  els.apiFeedback.className = `inline-feedback ${tone}`;
}

function getCurrentOperator() {
  return settings.currentOperator || "";
}

function nowIsoString() {
  return new Date().toISOString();
}

function applyCreateAuditFields(item) {
  const operator = getCurrentOperator();
  const now = nowIsoString();
  return {
    ...item,
    createdBy: item.createdBy || operator,
    createdAt: item.createdAt || now,
    updatedBy: operator,
    updatedAt: now
  };
}

function applyUpdateAuditFields(item) {
  const operator = getCurrentOperator();
  return {
    ...item,
    updatedBy: operator,
    updatedAt: nowIsoString()
  };
}

function formatAuditTime(value) {
  if (!value) {
    return "未记录";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString("zh-CN");
}

function formatDuration(value) {
  const duration = Number(value || 0);
  if (!Number.isFinite(duration) || duration <= 0) {
    return "0 ms";
  }
  if (duration < 1000) {
    return `${Math.round(duration)} ms`;
  }
  return `${(duration / 1000).toFixed(2)} s`;
}

function flashButtonSuccess(button, successText = "保存成功") {
  if (!button) {
    return;
  }

  const originalText = button.dataset.defaultLabel || button.textContent || "";
  button.dataset.defaultLabel = originalText;
  button.textContent = `✓ ${successText}`;
  button.classList.add("button-success-flash");

  const existingTimer = buttonSuccessTimers.get(button);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(() => {
    button.textContent = button.dataset.defaultLabel || originalText;
    button.classList.remove("button-success-flash");
    buttonSuccessTimers.delete(button);
  }, 1500);

  buttonSuccessTimers.set(button, timer);
}

function renderTraceMetaHtml(item, creatorFallback = "未记录") {
  return `
    <div class="trace-meta-item"><span>创建时间</span><strong>${escapeHtml(formatAuditTime(item.createdAt))}</strong></div>
    <div class="trace-meta-item"><span>更新时间</span><strong>${escapeHtml(formatAuditTime(item.updatedAt))}</strong></div>
  `;
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

function setSelfTestStatus(text, tone) {
  if (!els.selfTestStatus) {
    return;
  }
  els.selfTestStatus.textContent = text;
  els.selfTestStatus.className = `status-pill ${tone}`;
}

function setSelfTestFeedback(text, tone = "neutral") {
  if (!els.selfTestFeedback) {
    return;
  }
  els.selfTestFeedback.textContent = text;
  els.selfTestFeedback.className = `inline-feedback ${tone}`;
}

async function runSelfTest() {
  if (!els.runSelfTest || selfTestState.running) {
    return;
  }

  selfTestState.running = true;
  selfTestState.error = "";
  setSelfTestStatus("正在运行", "neutral");
  setSelfTestFeedback("正在启动系统自检，这会执行当前项目里的 smoke tests。", "warn");
  els.runSelfTest.disabled = true;
  els.runSelfTest.textContent = "自检中...";
  renderSelfTestPanel();

  try {
    const response = await fetch("/api/self-test", {
      method: "POST"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "系统自检执行失败。");
    }

    selfTestState.result = data;
    if (data.ok) {
      setSelfTestStatus("自检通过", "ok");
      setSelfTestFeedback(`本轮自检已通过，共执行 ${data.summary?.tests || 0} 项。`, "ok");
    } else {
      setSelfTestStatus("发现问题", "error");
      setSelfTestFeedback(`本轮自检有 ${data.summary?.fail || 0} 项失败，请查看下方结果。`, "error");
    }
    persistSelfTestSnapshot();
  } catch (error) {
    selfTestState.result = null;
    selfTestState.error = error.message || "系统自检执行失败。";
    setSelfTestStatus("运行失败", "error");
    setSelfTestFeedback(selfTestState.error, "error");
    persistSelfTestSnapshot();
  } finally {
    selfTestState.running = false;
    els.runSelfTest.disabled = false;
    els.runSelfTest.textContent = "运行自检";
    renderSelfTestPanel();
  }
}

async function loadSelfTestStatus() {
  try {
    const response = await fetch("/api/self-test-status");
    if (!response.ok) {
      throw new Error("load self test status failed");
    }
    const data = await response.json();
    selfTestState.running = Boolean(data.running);
    selfTestState.result = data.result && typeof data.result === "object" ? data.result : null;
    selfTestState.error = typeof data.error === "string" ? data.error : "";
    persistSelfTestSnapshot();
    renderSelfTestPanel();
  } catch (_error) {
    renderSelfTestPanel();
  }
}

function renderSelfTestPanel() {
  if (!els.selfTestFeedback) {
    return;
  }

  syncSelfTestHeader();
}

function syncSelfTestHeader() {
  if (selfTestState.running) {
    setSelfTestStatus("正在运行", "neutral");
    setSelfTestFeedback("系统正在后台执行自检，请稍后查看最新状态。", "warn");
    return;
  }

  if (selfTestState.error && !selfTestState.result) {
    setSelfTestStatus("运行失败", "error");
    setSelfTestFeedback(selfTestState.error, "error");
    return;
  }

  if (!selfTestState.result) {
    setSelfTestStatus("尚未运行", "neutral");
    setSelfTestFeedback("系统会在后台每 3 个小时自动执行一次自检。", "neutral");
    return;
  }

  if (selfTestState.result.ok) {
    setSelfTestStatus("自检通过", "ok");
    setSelfTestFeedback(`最近一次自检已通过，执行时间：${formatAuditTime(selfTestState.result.finishedAt)}。`, "ok");
    return;
  }

  setSelfTestStatus("发现问题", "error");
  setSelfTestFeedback("最近一次自检发现异常，建议联系管理员或在终端执行 npm test 排查。", "error");
}

function persistSelfTestSnapshot() {
  state.selfTestSnapshot = {
    result: selfTestState.result ? structuredCloneSafe(selfTestState.result) : null,
    error: selfTestState.error || ""
  };
  persist();
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

function setBugStatus(text, tone = "neutral") {
  if (!els.bugStatus) {
    return;
  }
  els.bugStatus.textContent = text;
  els.bugStatus.className = `inline-feedback ${tone}`;
}

function setCaseActionStatus(text, tone = "neutral") {
  if (!els.caseActionStatus) {
    return;
  }
  els.caseActionStatus.textContent = text;
  els.caseActionStatus.className = `inline-feedback ${tone}`;
}

function setAutomationCaseStatus(text, tone = "neutral") {
  if (!els.automationCaseStatus) {
    return;
  }
  els.automationCaseStatus.textContent = text;
  els.automationCaseStatus.className = `inline-feedback ${tone}`;
}

async function loadApiAutomationConfig() {
  if (!els.apiAutomationEnv) {
    return;
  }

  try {
    const response = await fetch("/api/api-automation/config");
    const data = await response.json();
    if (!response.ok || data.error) {
      throw new Error(data.error || "接口自动化配置读取失败");
    }

    apiAutomationConfigState.defaultSite = data.defaultSite || "klicklpay";
    apiAutomationConfigState.sites = data.sites || {};
    apiAutomationConfigState.environments = data.environments || {};
    apiAutomationConfigState.signature = data.signature || {};
    apiAutomationConfigState.error = "";
  } catch (error) {
    apiAutomationConfigState.defaultSite = "klicklpay";
    apiAutomationConfigState.sites = {};
    apiAutomationConfigState.environments = {};
    apiAutomationConfigState.signature = {};
    apiAutomationConfigState.error = error.message || "接口自动化配置读取失败";
  }

  renderApiAutomationConfigPanel();
}

function renderApiAutomationConfigPanel() {
  if (!els.apiAutomationEnv) {
    return;
  }

  const sites = apiAutomationConfigState.sites || {};
  const siteNames = Object.keys(sites);
  if (els.apiAutomationSite && siteNames.length) {
    const preferredSite = siteNames.includes(els.apiAutomationSite.value)
      ? els.apiAutomationSite.value
      : siteNames.includes(apiAutomationConfigState.defaultSite)
        ? apiAutomationConfigState.defaultSite
        : siteNames[0];
    els.apiAutomationSite.innerHTML = siteNames
      .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(sites[name]?.label || name)}</option>`)
      .join("");
    els.apiAutomationSite.value = preferredSite;
  }

  const selectedSiteName = els.apiAutomationSite?.value || apiAutomationConfigState.defaultSite || "klicklpay";
  const selectedSite = sites[selectedSiteName] || {
    label: selectedSiteName,
    requiredHeaders: ["KlicklPay-Key"],
    environments: apiAutomationConfigState.environments || {},
    signature: apiAutomationConfigState.signature || {}
  };

  const environmentNames = Object.keys(selectedSite.environments || {});
  if (environmentNames.length) {
    const currentValue = environmentNames.includes(els.apiAutomationEnv.value) ? els.apiAutomationEnv.value : environmentNames[0];
    els.apiAutomationEnv.innerHTML = environmentNames
      .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
      .join("");
    els.apiAutomationEnv.value = currentValue;
  }

  const selectedEnv = selectedSite.environments?.[els.apiAutomationEnv.value] || {};
  if (els.apiAutomationBaseUrl) {
    els.apiAutomationBaseUrl.value = selectedEnv.baseUrl || "";
  }

  if (!els.apiAutomationConfigStatus) {
    return;
  }

  if (apiAutomationConfigState.error) {
    els.apiAutomationConfigStatus.textContent = apiAutomationConfigState.error;
    els.apiAutomationConfigStatus.className = "inline-feedback error";
    return;
  }

  const requiredHeaders = Array.isArray(selectedSite.requiredHeaders) ? selectedSite.requiredHeaders : [];
  const signature = selectedSite.signature || {};
  const missingItems = [];
  if (!selectedEnv.baseUrl) {
    missingItems.push(`${selectedSiteName}.${els.apiAutomationEnv.value}.baseUrl`);
  }
  for (const headerName of requiredHeaders) {
    if (!selectedEnv.headers?.[headerName]) {
      missingItems.push(`${selectedSiteName}.${els.apiAutomationEnv.value}.headers.${headerName}`);
    }
  }
  if (signature.status === "ready" && !signature.apiKeyConfigured) {
    missingItems.push(`${selectedSiteName}.signature.apiKey`);
  }

  const signatureText = signature.status === "ready"
    ? `验签：${signature.algorithm || "已配置"}，${signature.timestampUnit || "时间戳规则已配置"}，${signature.nonceLength || "nonce"}。`
    : `验签规则状态：${signature.status || "pending-rules"}，等拿到文档后补充。`;
  const baseText = `已读取 ${selectedSite.label || selectedSiteName} / ${els.apiAutomationEnv.value}：${selectedEnv.baseUrl || "未配置 Base URL"}。${signatureText}`;
  els.apiAutomationConfigStatus.textContent = missingItems.length
    ? `${baseText} 请在 api-automation.config.json 中补充：${missingItems.join("、")}。`
    : `${baseText} 当前站点基础配置已就绪，可以进入 pytest 接口执行接入。`;
  els.apiAutomationConfigStatus.className = `inline-feedback ${missingItems.length || signature.status !== "ready" ? "warn" : "ok"}`;
}

function getSelectedApiAutomationSiteConfig() {
  const sites = apiAutomationConfigState.sites || {};
  const selectedSiteName = els.apiAutomationSite?.value || apiAutomationConfigState.defaultSite || "klicklpay";
  const selectedSite = sites[selectedSiteName] || {
    label: selectedSiteName,
    requiredHeaders: ["KlicklPay-Key"],
    environments: apiAutomationConfigState.environments || {},
    signature: apiAutomationConfigState.signature || {}
  };
  const selectedEnvName = els.apiAutomationEnv?.value || Object.keys(selectedSite.environments || {})[0] || "";
  return {
    siteName: selectedSiteName,
    site: selectedSite,
    envName: selectedEnvName,
    environment: selectedSite.environments?.[selectedEnvName] || {}
  };
}

function getMissingApiAutomationConfigItems(siteName, envName, site, environment) {
  const missingItems = [];
  if (!environment.baseUrl) {
    missingItems.push(`${siteName}.${envName}.baseUrl`);
  }
  for (const headerName of Array.isArray(site.requiredHeaders) ? site.requiredHeaders : []) {
    if (!environment.headers?.[headerName]) {
      missingItems.push(`${siteName}.${envName}.headers.${headerName}`);
    }
  }
  if (site.signature?.status === "ready" && !site.signature?.apiKeyConfigured) {
    missingItems.push(`${siteName}.signature.apiKey`);
  }
  return missingItems;
}

function handleApiAutomationBatchRun() {
  const { siteName, site, envName, environment } = getSelectedApiAutomationSiteConfig();
  const missingItems = getMissingApiAutomationConfigItems(siteName, envName, site, environment);
  if (missingItems.length) {
    setApiAutomationStatus(`暂时不能批量执行，请先在 api-automation.config.json 补充：${missingItems.join("、")}。`, "warn");
    return;
  }

  setApiAutomationStatus(`配置已就绪：${site.label || siteName} / ${envName}。下一步接入 pytest 执行器后，这里会直接触发批量执行。`, "ok");
}

function handleApiAutomationRunHistory() {
  setApiAutomationStatus("运行记录入口已预留。等 pytest 执行结果落库后，这里会展示每次批量执行的状态、耗时和失败原因。", "neutral");
}

function setApiAutomationStatus(message, tone = "neutral") {
  if (!els.apiAutomationConfigStatus) {
    return;
  }
  els.apiAutomationConfigStatus.textContent = message;
  els.apiAutomationConfigStatus.className = `inline-feedback ${tone}`;
}

function setCaseQualityStatus(text, tone = "neutral") {
  if (!els.caseQualityStatus) {
    return;
  }
  els.caseQualityStatus.textContent = text;
  els.caseQualityStatus.className = `inline-feedback ${tone}`;
}

function setCaseQualityBusiness(value) {
  const nextBusiness = normalizeCaseQualityBusiness(value);
  if (state.caseQualityBusiness === nextBusiness) {
    renderCaseQuality();
    return;
  }

  state.caseQualityBusiness = nextBusiness;
  persist();
  renderCaseQuality();
  setCaseQualityStatus(`已切换到 ${nextBusiness} 规则分类。`, "neutral");
}

function normalizeCaseQualityBusiness(value) {
  const normalized = normalizeBusinessName(value);
  return CASE_QUALITY_BUSINESSES.includes(normalized) ? normalized : CASE_QUALITY_BUSINESSES[0];
}

function inferCaseQualityBusiness(cases = []) {
  const activeTask = getTaskById(state.activeTaskId);
  const activeBatch = getBatchById(activeTask?.batchId || state.activeBatchId || state.generationBatchId);
  const activeModule = getModuleById(activeTask?.moduleId || activeBatch?.moduleId || state.activeModuleId);
  const explicitBusiness = normalizeBusinessName(activeModule?.name || "");
  if (CASE_QUALITY_BUSINESSES.includes(explicitBusiness)) {
    return explicitBusiness;
  }

  const text = (Array.isArray(cases) ? cases : [])
    .flatMap((item) => [item.module, item.moduleId, item.taskName, item.batchName, item.title])
    .join("\n");
  if (/VA|虚拟账户|Virtual Account/i.test(text)) {
    return "VA业务";
  }
  if (/卡收单|CARD收单|Card Acquiring|3DS|BANKCARD/i.test(text)) {
    return "卡收单业务";
  }
  return normalizeCaseQualityBusiness(state.caseQualityBusiness);
}

function getCurrentQualityCases() {
  return getCaseQualityCasesForBusiness(state.caseQualityBusiness);
}

function getCaseQualityReportForBusiness(businessName = state.caseQualityBusiness) {
  const key = normalizeCaseQualityBusiness(businessName);
  return state.caseQualityReports?.[key] || null;
}

function setCaseQualityReportForBusiness(report, businessName = state.caseQualityBusiness) {
  const key = normalizeCaseQualityBusiness(businessName);
  state.caseQualityReports = {
    ...(state.caseQualityReports || {}),
    [key]: normalizeCaseQualityReport(report)
  };
}

function getCaseQualityCasesForBusiness(businessName = state.caseQualityBusiness) {
  const key = normalizeCaseQualityBusiness(businessName);
  const cases = state.caseQualityCasesByBusiness?.[key];
  return Array.isArray(cases) ? cases : [];
}

function setCaseQualityCasesForBusiness(cases, businessName = state.caseQualityBusiness) {
  const key = normalizeCaseQualityBusiness(businessName);
  state.caseQualityCasesByBusiness = {
    ...(state.caseQualityCasesByBusiness || {}),
    [key]: structuredCloneSafe(Array.isArray(cases) ? cases : [])
  };
}

function setUiAutomationFeedback(text, tone = "neutral") {
  if (!els.automationSessionFeedback) {
    return;
  }
  els.automationSessionFeedback.textContent = text;
  els.automationSessionFeedback.className = `inline-feedback ${tone}`;
}

function normalizeUiAutomationSettings(settingsValue) {
  if (!settingsValue || typeof settingsValue !== "object") {
    return {
      baseUrl: "",
      loginPath: ""
    };
  }

  return {
    baseUrl: String(settingsValue.baseUrl || "").trim(),
    loginPath: String(settingsValue.loginPath || "").trim()
  };
}

function normalizeUiAutomationSession(sessionValue) {
  if (!sessionValue || typeof sessionValue !== "object") {
    return {
      available: false,
      browserPath: "",
      active: false,
      authSaved: false,
      sessionStartedAt: "",
      baseUrl: "",
      loginPath: "",
      headless: true,
      lastError: ""
    };
  }

  return {
    available: Boolean(sessionValue.available),
    browserPath: String(sessionValue.browserPath || "").trim(),
    active: Boolean(sessionValue.active),
    authSaved: Boolean(sessionValue.authSaved),
    sessionStartedAt: String(sessionValue.sessionStartedAt || "").trim(),
    baseUrl: String(sessionValue.baseUrl || "").trim(),
    loginPath: String(sessionValue.loginPath || "").trim(),
    headless: sessionValue.headless !== false,
    lastError: String(sessionValue.lastError || "").trim()
  };
}

function getUiAutomationSettingsPayload() {
  return {
    baseUrl: els.automationBaseUrl?.value.trim() || "",
    loginPath: els.automationLoginPath?.value.trim() || ""
  };
}

function handleUiAutomationDraftChange() {
  state.uiAutomationSettings = getUiAutomationSettingsPayload();
  persist();
  renderUiAutomationPanel();
}

function getUiAutomationChipTone() {
  if (!uiAutomationState.available) return "warn";
  if (uiAutomationState.active) return "subtle";
  if (uiAutomationState.authSaved) return "ok";
  return "neutral";
}

function getUiAutomationChipText() {
  if (!uiAutomationState.available) return "未就绪";
  if (uiAutomationState.active) return "待确认";
  if (uiAutomationState.authSaved) return "已保存";
  return "未准备";
}

function renderUiAutomationPanel() {
  if (els.automationSessionChip) {
    els.automationSessionChip.textContent = getUiAutomationChipText();
    els.automationSessionChip.className = `state-chip ${getUiAutomationChipTone()}`;
  }

  if (els.automationBaseUrl && document.activeElement !== els.automationBaseUrl) {
    els.automationBaseUrl.value = state.uiAutomationSettings?.baseUrl || "";
  }
  if (els.automationLoginPath && document.activeElement !== els.automationLoginPath) {
    els.automationLoginPath.value = state.uiAutomationSettings?.loginPath || "";
  }

  if (!uiAutomationState.available) {
    setUiAutomationFeedback("当前机器没有找到可用的谷歌浏览器，请先配置浏览器路径后再使用。", "warn");
    return;
  }

  if (uiAutomationState.active) {
    setUiAutomationFeedback("登录窗口已打开。请在浏览器中手动完成登录和滑块验证，然后回来点击“确认已登录”。", "neutral");
    return;
  }

  if (uiAutomationState.authSaved) {
    setUiAutomationFeedback("登录态已保存，后续运行自动化会直接复用这次登录结果。", "ok");
    return;
  }

  if (uiAutomationState.lastError) {
    setUiAutomationFeedback(uiAutomationState.lastError, "error");
    return;
  }

  setUiAutomationFeedback("先填写站点地址，打开浏览器完成人工登录，再回来确认保存登录态。", "neutral");
}

async function loadUiAutomationStatus() {
  try {
    const response = await fetch("/api/ui-automation/session-status");
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "加载自动化状态失败");
    }
    state.uiAutomationSession = normalizeUiAutomationSession(data);
    Object.assign(uiAutomationState, state.uiAutomationSession);
    persist();
    renderUiAutomationPanel();
  } catch (error) {
    uiAutomationState.lastError = error.message || "加载自动化状态失败";
    renderUiAutomationPanel();
  }
}

async function startUiAutomationLoginSession() {
  const payload = getUiAutomationSettingsPayload();
  if (!payload.baseUrl) {
    setUiAutomationFeedback("请先填写站点地址。", "warn");
    return;
  }

  state.uiAutomationSettings = payload;
  persist();
  setUiAutomationFeedback("正在打开登录窗口...", "neutral");

  try {
    const response = await fetch("/api/ui-automation/start-login-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "启动登录会话失败");
    }
    state.uiAutomationSession = normalizeUiAutomationSession(data.status);
    Object.assign(uiAutomationState, state.uiAutomationSession);
    persist();
    renderUiAutomationPanel();
  } catch (error) {
    setUiAutomationFeedback(error.message || "启动登录会话失败", "error");
  }
}

async function confirmUiAutomationLoginSession() {
  setUiAutomationFeedback("正在保存登录态...", "neutral");

  try {
    const response = await fetch("/api/ui-automation/confirm-login-session", {
      method: "POST"
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "保存登录态失败");
    }
    state.uiAutomationSession = normalizeUiAutomationSession(data.status);
    Object.assign(uiAutomationState, state.uiAutomationSession);
    persist();
    renderUiAutomationPanel();
  } catch (error) {
    setUiAutomationFeedback(error.message || "保存登录态失败", "error");
  }
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
  flashButtonSuccess(els.saveDocument, "保存成功");
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

  const reportBatchIds = buildReportBatchOptions().map((item) => item.id);
  if (!state.activeReportBatchId || !reportBatchIds.includes(state.activeReportBatchId)) {
    state.activeReportBatchId = state.activeBatchId || state.generationBatchId || reportBatchIds[0] || "";
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
    status: getBatchById(editingBatchId)?.status || "进行中"
  };
  const auditedBatch = editingBatchId
    ? applyUpdateAuditFields({ ...getBatchById(editingBatchId), ...batch })
    : applyCreateAuditFields(batch);

  const isEditing = Boolean(editingBatchId);

  if (isEditing) {
    state.batches = state.batches.map((item) => (item.id === editingBatchId ? auditedBatch : item));
  } else {
    state.batches.unshift(auditedBatch);
  }
  state.activeBatchId = auditedBatch.id;
  state.generationBatchId = auditedBatch.id;
  state.activeModuleId = auditedBatch.moduleId || state.activeModuleId;
  els.batchVersionInput.value = "";
  editingBatchId = "";
  els.createBatchBtn.textContent = "保存当前版本";
  autoResizeTextarea();
  persist();
  renderAll();
  setGenerationStatus(`${isEditing ? "已更新" : "已保存"}版本：${auditedBatch.version}。下一步请新增测试任务。`, "ok");
  flashButtonSuccess(els.createBatchBtn, "保存成功");
  switchTab("upload");
  els.taskBatchSelect.value = auditedBatch.id;
  els.taskNameInput.focus();
  els.taskNameInput.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function createTaskAndGenerateCases() {
  if (editingTaskId) {
    createTask();
    return;
  }

  if (!els.taskNameInput.value.trim()) {
    setGenerationStatus("请先填写任务名称。", "warn");
    els.taskNameInput.focus();
    return;
  }
  if (!els.taskScopeInput.value.trim()) {
    setGenerationStatus("请填写“你要测什么”，系统会把它作为生成用例的范围。", "warn");
    els.taskScopeInput.focus();
    return;
  }

  const sourceType = els.sourceType.value;
  const sourceContent = sourceType === "url"
    ? els.sourceUrl.value.trim()
    : sourceType === "text"
      ? els.sourceText?.value.trim() || ""
      : uploadedFileContent.trim();
  if (!sourceContent) {
    alert(sourceType === "url" ? "请先填写网址链接。" : sourceType === "text" ? "请先粘贴需求正文。" : "请先上传本地文件。");
    return;
  }

  const task = createTask();
  if (!task) return;
  await handleGenerateCases("ai");
}

function createTask() {
  const batch = ensureDefaultTaskBatch();
  const name = els.taskNameInput.value.trim();
  const scope = els.taskScopeInput.value.trim();
  const existingTask = getTaskById(editingTaskId);
  const owner = existingTask?.owner || "";

  if (!name) {
    setGenerationStatus("请先填写任务名称。", "warn");
    return null;
  }

  if (!scope) {
    setGenerationStatus("请填写“你要测什么”，系统会把它作为生成用例的范围。", "warn");
    els.taskScopeInput.focus();
    return null;
  }

  if (editingTaskId && batch?.status === "已完成") {
    setGenerationStatus(`版本 ${formatBatchLabel(batch)} 已完成，已有任务不能再编辑。`, "warn");
    return null;
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
  const auditedTask = editingTaskId
    ? applyUpdateAuditFields({ ...getTaskById(editingTaskId), ...task })
    : applyCreateAuditFields(task);

  const isEditing = Boolean(editingTaskId);
  if (isEditing) {
    state.tasks = state.tasks.map((item) => (item.id === editingTaskId ? auditedTask : item));
  } else {
    state.tasks.unshift(auditedTask);
  }

  state.activeTaskId = auditedTask.id;
  state.generationBatchId = auditedTask.batchId;
  state.activeBatchId = auditedTask.batchId;
  state.activeModuleId = auditedTask.moduleId || state.activeModuleId;

  els.taskBatchSelect.value = auditedTask.batchId;
  els.taskNameInput.value = "";
  els.taskScopeInput.value = "";
  els.createTaskBtn.textContent = "创建任务并生成用例";
  editingTaskId = "";
  autoResizeTextarea();
  persist();
  renderAll();
  setGenerationStatus(`${isEditing ? "已更新" : "已创建"}任务：${auditedTask.name}。`, "ok");
  if (isEditing) flashButtonSuccess(els.createTaskBtn, "保存成功");
  return auditedTask;
}

function ensureDefaultTaskBatch() {
  const editingTask = getTaskById(editingTaskId);
  const existingBatch = getBatchById(editingTask?.batchId);
  if (existingBatch) return existingBatch;

  const defaultBatch = getOrCreateDefaultWorkspaceBatch();
  state.activeBatchId = defaultBatch.id;
  state.generationBatchId = defaultBatch.id;
  return defaultBatch;
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
  const content = sourceType === "url" ? sourceUrl : sourceType === "text" ? sourceText : uploadedFileContent.trim();
  const type = getDocumentTypeBySource(sourceType);
  const activeTask = getTaskById(state.activeTaskId);
  const activeBatch = getBatchById(activeTask?.batchId || state.activeBatchId);
  const focusHint = activeTask?.scope || "";

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
    const ready = await ensureAiReadyForGeneration();
    if (!ready) {
      return;
    }

    setGenerationStatus("AI 正在生成中，文档越长会越慢一点。", "neutral");
    toggleGenerateButtons(true);

    try {
      const generated = await requestAiCases({
        documentName: name,
        documentType: type,
        content,
        sourceType,
        focusHint,
        apiKey: settings.apiKey,
        model: settings.model
      });

      const generatedCases = appendGeneratedCases(generated, {
        mode: "AI",
        documentName: name,
        documentType: type
      });
      downloadCasesCsv(generatedCases, activeBatch, activeTask, name);
      const qualityReport = getCaseQualityReportForBusiness(inferCaseQualityBusiness(generatedCases));
      setGenerationStatus(buildCaseQualityStatusMessage(`AI 已生成 ${generated.length} 条用例，并已导出 CSV。`, inferCaseQualityBusiness(generatedCases)), mapCaseQualityToneToFeedbackTone(qualityReport?.tone));
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
  const qualityReport = getCaseQualityReportForBusiness(inferCaseQualityBusiness(generatedCases));
  setGenerationStatus(buildCaseQualityStatusMessage(`规则生成完成，共 ${generated.length} 条用例，并已导出 CSV。`, inferCaseQualityBusiness(generatedCases)), mapCaseQualityToneToFeedbackTone(qualityReport?.tone));
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
    executionNote: "",
    automationEnabled: Array.isArray(item.automationSteps) && item.automationSteps.length > 0,
    automationTargetPath: inferAutomationTargetPath(item.automationSteps),
    automationSteps: normalizeCaseAutomationSteps(item.automationSteps),
    automationLastRun: null
  }));
}

function inferAutomationTargetPath(automationSteps) {
  if (!Array.isArray(automationSteps) || !automationSteps.length) return "";
  const openPageStep = automationSteps.find(
    (step) => step && (step.stepType === "openPage" || step.action === "goto")
  );
  if (openPageStep) {
    return String(openPageStep.target || openPageStep.path || openPageStep.url || "").trim();
  }
  return "";
}

function normalizeMultiline(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join("\n");
  }
  return String(value || "").trim();
}

function mergeCasesIntoState(existingCases, nextCases, scope = {}) {
  const currentCases = Array.isArray(existingCases) ? existingCases : [];
  const incomingCases = Array.isArray(nextCases) ? nextCases : [];
  const taskIds = new Set(
    [...incomingCases.map((item) => item.taskId), scope.taskId]
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  );
  const batchIds = new Set(
    [...incomingCases.map((item) => item.batchId), scope.batchId]
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  );

  if (!taskIds.size && !batchIds.size) {
    return [...currentCases, ...incomingCases];
  }

  const preservedCases = currentCases.filter((item) => {
    const taskId = String(item.taskId || "").trim();
    const batchId = String(item.batchId || "").trim();
    if (taskId && taskIds.has(taskId)) {
      return false;
    }
    if (!taskId && batchId && !taskIds.size && batchIds.has(batchId)) {
      return false;
    }
    return true;
  });

  return [...preservedCases, ...incomingCases];
}

function appendGeneratedCases(cases, meta) {
  const activeTask = getTaskById(state.activeTaskId);
  const activeBatch = getBatchById(activeTask?.batchId || state.generationBatchId);
  const activeModule = getModuleById(activeTask?.moduleId || activeBatch?.moduleId || state.activeModuleId);

  const generatedCases = cases.map((item, index) => applyCreateAuditFields({
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

  state.cases = mergeCasesIntoState(state.cases, generatedCases, {
    taskId: activeTask?.id || "",
    batchId: activeBatch?.id || ""
  });

  state.lastGeneration = {
    name: meta.documentName,
    type: meta.documentType,
    count: cases.length,
    mode: meta.mode,
    createdAt: new Date().toLocaleString("zh-CN")
  };
  const qualityBusinessName = inferCaseQualityBusiness(generatedCases);
  setCaseQualityCasesForBusiness(generatedCases, qualityBusinessName);
  setCaseQualityReportForBusiness(analyzeCaseQuality(generatedCases, meta.mode, "", qualityBusinessName), qualityBusinessName);

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

      const normalizedImportedCases = importedCases.map((item, index) => applyCreateAuditFields({
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
      state.cases = mergeCasesIntoState(state.cases, normalizedImportedCases, {
        taskId: state.activeTaskId || "",
        batchId: state.activeBatchId || ""
      });
      const qualityBusinessName = inferCaseQualityBusiness(normalizedImportedCases);
      setCaseQualityCasesForBusiness(normalizedImportedCases, qualityBusinessName);
      setCaseQualityReportForBusiness(analyzeCaseQuality(normalizedImportedCases, "导入", file.name, qualityBusinessName), qualityBusinessName);
      const qualityReport = getCaseQualityReportForBusiness(qualityBusinessName);

      persist();
      renderAll();
      switchTab("cases");
      setGenerationStatus(buildCaseQualityStatusMessage(`已导入 ${importedCases.length} 条用例。`, qualityBusinessName), mapCaseQualityToneToFeedbackTone(qualityReport?.tone));
    } catch (error) {
      setGenerationStatus(`CSV 导入失败：${error.message}`, "error");
    } finally {
      if (event?.target) {
        event.target.value = "";
      }
    }
  };
  reader.readAsText(file, "utf-8");
}

function ensureCasesToolbarEnhancements() {
  const caseToolbar = document.querySelector("#cases .case-toolbar");
  if (caseToolbar && !els.exportCasesBtn) {
    const button = document.createElement("button");
    button.id = "exportCasesBtn";
    button.type = "button";
    button.className = "ghost-button";
    button.textContent = "导出当前用例";
    caseToolbar.appendChild(button);
    els.exportCasesBtn = button;
    els.exportCasesBtn.addEventListener("click", exportFilteredCases);
  }
}

function handleQualityImport(event, businessName = state.caseQualityBusiness) {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const importedCases = parseCasesCsv(String(reader.result || ""));
      if (!importedCases.length) {
        setCaseQualityStatus("上传的 CSV 没识别到有效用例，暂时无法检测。", "warn");
        return;
      }

      const normalizedBusinessName = normalizeCaseQualityBusiness(businessName);
      setCaseQualityCasesForBusiness(importedCases, normalizedBusinessName);
      setCaseQualityReportForBusiness(analyzeCaseQuality(importedCases, "手动导入检测", file.name, normalizedBusinessName), normalizedBusinessName);
      persist();
      renderCaseQuality();
      switchTab("quality");
    } catch (error) {
      alert(`CSV 检测失败：${error.message}`);
    } finally {
      event.target.value = "";
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

function analyzeCaseQuality(cases, sourceLabel, fileName = "", businessName = state.caseQualityBusiness) {
  const list = Array.isArray(cases) ? cases : [];
  if (!list.length) {
    return null;
  }
  const ruleContext = resolveCaseQualityRuleContext(list, businessName);

  const missingTitle = list.filter((item) => !String(item.title || "").trim() || /^未命名/.test(String(item.title || "").trim())).length;
  const missingSteps = list.filter((item) => !String(item.steps || "").trim()).length;
  const missingExpected = list.filter((item) => {
    const text = String(item.expected || "").trim();
    return !text || text === "待补充";
  }).length;
  const uncategorized = list.filter((item) => !String(item.module || "").trim() || String(item.module || "").trim() === "未分类").length;
  const abnormalCount = list.filter((item) => String(item.type || "").trim() === "异常").length;
  const boundaryCount = list.filter((item) => /边界|上限|下限|最大|最小|长度|为空|缺失/.test(`${item.title || ""}\n${item.steps || ""}\n${item.expected || ""}`)).length;
  const permissionCount = list.filter((item) => /权限|鉴权|未登录|token|登录失效|越权|角色/.test(`${item.title || ""}\n${item.steps || ""}\n${item.expected || ""}`)).length;
  const requiredParamCount = list.filter((item) => /必填|缺少参数|参数校验|required|空值/.test(`${item.title || ""}\n${item.steps || ""}\n${item.expected || ""}`)).length;

  const titleMap = new Map();
  const stepMap = new Map();
  list.forEach((item) => {
    const key = String(item.title || "").trim().toLowerCase();
    if (!key) {
      // continue
    } else {
      titleMap.set(key, (titleMap.get(key) || 0) + 1);
    }

    const stepKey = normalizeCaseFingerprint(item.steps, item.expected);
    if (stepKey) {
      stepMap.set(stepKey, (stepMap.get(stepKey) || 0) + 1);
    }
  });
  const duplicateTitles = [...titleMap.values()].filter((count) => count > 1).reduce((sum, count) => sum + count - 1, 0);
  const duplicateFlows = [...stepMap.values()].filter((count) => count > 1).reduce((sum, count) => sum + count - 1, 0);

  const issues = [];
  if (missingSteps > 0) {
    issues.push({
      level: "有风险",
      tone: "tone-red",
      title: "存在缺少测试步骤的用例",
      detail: `${missingSteps} 条用例没有完整步骤，执行时很容易落空或理解不一致。`
    });
  }
  if (missingExpected > 0) {
    issues.push({
      level: "有风险",
      tone: "tone-red",
      title: "存在缺少预期结果的用例",
      detail: `${missingExpected} 条用例没有明确预期结果，后续执行和判定会比较模糊。`
    });
  }
  if (duplicateTitles > 0) {
    issues.push({
      level: "需关注",
      tone: "tone-orange",
      title: "发现重复标题",
      detail: `当前有 ${duplicateTitles} 条用例标题重复，建议合并或改成更具体的场景名。`
    });
  }
  if (duplicateFlows > 0) {
    issues.push({
      level: "需关注",
      tone: "tone-orange",
      title: "存在步骤高度重复的用例",
      detail: `识别到 ${duplicateFlows} 条用例的步骤和预期几乎一致，可能只是换了标题，建议合并或改成更明确的差异场景。`
    });
  }
  if (abnormalCount === 0) {
    issues.push({
      level: "需关注",
      tone: "tone-orange",
      title: "异常场景覆盖偏少",
      detail: "这批用例里还没有标记为异常的场景，建议补一点参数校验、权限、边界和错误处理。"
    });
  }
  if (permissionCount === 0) {
    issues.push({
      level: "需关注",
      tone: "tone-orange",
      title: "权限 / 鉴权场景不明显",
      detail: "没有识别到登录失效、越权访问、角色限制或 token 异常等场景，建议补 1 到 2 条。"
    });
  }
  if (requiredParamCount === 0) {
    issues.push({
      level: "需关注",
      tone: "tone-orange",
      title: "必填参数异常覆盖不足",
      detail: "没有识别到缺少必填参数、空值或参数校验失败场景，建议补一些接口和表单异常校验。"
    });
  }
  if (boundaryCount === 0) {
    issues.push({
      level: "需关注",
      tone: "tone-orange",
      title: "边界值场景不明显",
      detail: "没有识别到明显的边界值描述，可以补一些上限、下限、空值和长度限制场景。"
    });
  }
  if (uncategorized > 0) {
    issues.push({
      level: "提示",
      tone: "tone-gray",
      title: "部分用例还没归类模块",
      detail: `${uncategorized} 条用例仍是“未分类”，后面查找和汇总时会不太顺手。`
    });
  }
  if (missingTitle > 0) {
    issues.push({
      level: "提示",
      tone: "tone-gray",
      title: "存在默认标题",
      detail: `${missingTitle} 条用例还在使用默认命名，建议改成更具体的业务动作或校验点。`
    });
  }

  const severeCount = [missingSteps, missingExpected].filter((count) => count > 0).length;
  const warningCount = [duplicateTitles > 0, duplicateFlows > 0, abnormalCount === 0].filter(Boolean).length;

  return {
    label: severeCount > 0 ? "有风险" : warningCount > 0 ? "需关注" : "通过",
    tone: severeCount > 0 ? "error" : warningCount > 0 ? "warn" : "ok",
    sourceLabel,
    fileName: String(fileName || "").trim(),
    checkedAt: new Date().toLocaleString("zh-CN"),
    ruleContext,
    quickTip: buildCaseQualityQuickTip({
      missingSteps,
      missingExpected,
      duplicateTitles,
      duplicateFlows,
      abnormalCount,
      permissionCount,
      requiredParamCount
    }),
    metrics: [
      ["规则分类", ruleContext.businessName],
      ["启用规则", ruleContext.activeRuleCount],
      ["用例总数", list.length],
      ["异常场景", abnormalCount],
      ["权限/鉴权", permissionCount],
      ["参数异常", requiredParamCount],
      ["重复项", duplicateTitles + duplicateFlows],
      ["缺步骤/预期", missingSteps + missingExpected]
    ],
    issues
  };
}

function resolveCaseQualityRuleContext(cases, businessName = state.caseQualityBusiness) {
  const rulesets = window.CASE_QUALITY_RULESETS || {};
  const commonRules = Array.isArray(rulesets.common?.rules) ? rulesets.common.rules : [];
  const businesses = rulesets.businesses && typeof rulesets.businesses === "object" ? rulesets.businesses : {};
  const activeModule = getModuleById(state.activeModuleId);
  const candidateText = [
    activeModule?.name || "",
    ...cases.flatMap((item) => [
      item.module,
      item.moduleId,
      item.taskName,
      item.batchName,
      item.title
    ])
  ].join("\n");

  const selectedBusinessName = normalizeCaseQualityBusiness(businessName);
  const selectedBusiness = businesses[selectedBusinessName] || null;
  const detectedBusiness = Object.values(businesses).find((item) => {
    const names = [item.name, ...(Array.isArray(item.aliases) ? item.aliases : [])]
      .filter(Boolean)
      .map((value) => String(value).trim());
    return names.some((name) => name && candidateText.includes(name));
  }) || null;
  const business = selectedBusiness || detectedBusiness;
  const businessRules = Array.isArray(business?.rules) ? business.rules : [];
  const activeRuleCount = [...commonRules, ...businessRules]
    .filter((rule) => rule?.status !== "draft")
    .length;

  return {
    commonName: rulesets.common?.name || "通用规则",
    businessName: business?.name || "未匹配业务分类",
    businessId: business?.id || "",
    selectedBusinessName,
    businessDescription: business?.description || "当前用例未命中 VA业务 或 卡收单业务，暂时只执行通用检查。",
    activeRuleCount,
    businessRuleCount: businessRules.length
  };
}

function buildCaseQualityQuickTip(stats) {
  if (stats.missingSteps > 0 || stats.missingExpected > 0) {
    return "先补齐缺少步骤和预期结果的用例，这会直接影响后续执行和判定。";
  }
  if (stats.duplicateTitles > 0 || stats.duplicateFlows > 0) {
    return "建议先清理重复或高度相似的用例，避免后面执行时重复劳动。";
  }
  if (stats.abnormalCount === 0) {
    return "建议至少补 1 到 2 条异常场景，比如缺参、错误输入或接口失败提示。";
  }
  if (stats.permissionCount === 0) {
    return "建议补一条权限或鉴权场景，比如未登录、token 失效或越权访问。";
  }
  if (stats.requiredParamCount === 0) {
    return "建议补一条必填参数异常场景，检查缺参、空值和参数校验提示。";
  }
  return "这批用例的基础质量已经不错，可以进入执行阶段，边测边补细节。";
}

function buildCaseQualityStatusMessage(prefix, businessName = state.caseQualityBusiness) {
  const label = getCaseQualityReportForBusiness(businessName)?.label;
  return label ? `${prefix} 用例质量检查：${label}。` : prefix;
}

function mapCaseQualityToneToFeedbackTone(tone) {
  if (tone === "error") return "warn";
  if (tone === "warn") return "warn";
  if (tone === "ok") return "ok";
  return "neutral";
}

function normalizeCaseFingerprint(steps, expected) {
  const raw = `${steps || ""}\n${expected || ""}`.toLowerCase().trim();
  if (!raw) {
    return "";
  }
  return raw
    .replace(/\s+/g, " ")
    .replace(/[0-9]+/g, "#")
    .replace(/[：:，,。.()（）[\]{}]/g, "")
    .trim();
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
  const headers = ["测试任务", "关联版本号", "标题", "类型", "优先级", "前置条件", "步骤", "预期结果", "执行状态", "执行备注"];
  const rows = cases.map((item) => [
    item.taskName || activeTask?.name || "",
    item.batchVersion || activeBatch?.version || "",
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

function exportFilteredCases() {
  const filteredCases = getFilteredCasesForView();
  if (!filteredCases.length) {
    setCaseActionStatus("当前筛选范围里没有可导出的测试用例。", "warn");
    return;
  }

  const batchFilter = els.caseBatchFilter?.value || "";
  const taskFilter = els.caseTaskFilter?.value || "";
  const activeBatch = getBatchById(batchFilter) || getBatchById(state.activeBatchId);
  const activeTask = state.tasks.find((item) => item.name === taskFilter) || getTaskById(state.activeTaskId);
  downloadCasesCsv(filteredCases, activeBatch, activeTask, state.lastGeneration?.documentName || "测试用例");
  setCaseActionStatus(`已导出 ${filteredCases.length} 条当前筛选结果里的测试用例。`, "ok");
}

function downloadCaseTemplateCsv() {
  const activeTask = getTaskById(state.activeTaskId);
  const activeBatch = getBatchById(activeTask?.batchId || state.activeBatchId);
  const headers = [
    "测试任务",
    "关联版本号",
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

function normalizeAiModel(value) {
  const text = String(value || "").trim();
  if (!text || text === "gpt-5.4-mini") {
    return DEFAULT_AI_MODEL;
  }
  return text;
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
  renderCaseQuality();
  renderCaseFilters();
  renderCases();
  renderAutomationCases();
  renderBugs();
  renderReport();
  hydrateFeedbackRegions();
}

function renderCaseQuality() {
  if (!els.qualityBusinessModules) {
    return;
  }

  const businessName = normalizeCaseQualityBusiness(state.caseQualityBusiness);
  const report = getCaseQualityReportForBusiness(businessName);
  const cases = getCaseQualityCasesForBusiness(businessName);
  const label = report?.label || "未开始";
  const tone = report?.tone || "neutral";
  const fileName = report?.fileName || "未上传";
  const checkedAt = report?.checkedAt || "暂无";
  const ruleCount = report?.ruleContext?.activeRuleCount ?? 0;
  const issueCount = report?.issues?.length || 0;
  const quickTip = report?.quickTip || "当前业务还没有检测记录，先上传对应业务的 CSV。";

  els.qualityBusinessTabs.forEach((button) => {
    const tabBusinessName = normalizeCaseQualityBusiness(button.dataset.qualityBusiness);
    const isActive = tabBusinessName === businessName;
    const tabCases = getCaseQualityCasesForBusiness(tabBusinessName);
    const tabReport = getCaseQualityReportForBusiness(tabBusinessName);
    const shortLabel = tabBusinessName === "卡收单业务" ? "卡收单" : "VA";
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
    button.innerHTML = `
      <span>${escapeHtml(shortLabel)}</span>
      <small>${escapeHtml(String(tabCases.length))} 条 · ${escapeHtml(tabReport?.label || "未检查")}</small>
    `;
  });

  els.qualityBusinessModules.innerHTML = `
    <section class="panel quality-module-panel quality-business-module" data-quality-module="${escapeHtml(businessName)}">
      <div class="section-head quality-panel-head">
        <div>
          <span class="summary-label">当前业务</span>
          <h3>${escapeHtml(businessName)}</h3>
          <p class="section-note">仅展示和检查 ${escapeHtml(businessName)} 的用例，不会混入其他业务。</p>
        </div>
        <span class="status-pill ${escapeHtml(tone)}">${escapeHtml(label)}</span>
      </div>

      <div class="quality-module-actions">
        <label class="import-button primary-import">
          <input type="file" accept=".csv" data-quality-upload="${escapeHtml(businessName)}">
          <span>上传${escapeHtml(businessName)} CSV</span>
        </label>
        <span class="quality-upload-hint">上传后只更新 ${escapeHtml(businessName)}，不会影响另一个业务。</span>
      </div>

      <div class="quality-business-overview single-business">
        <article class="quality-business-card active">
          <div>
            <span class="summary-label">上传文件</span>
            <strong>${escapeHtml(fileName)}</strong>
          </div>
          <div class="quality-business-card-meta">
            <span>用例数</span>
            <strong>${escapeHtml(String(cases.length))}</strong>
          </div>
          <div class="quality-business-card-meta">
            <span>规则数</span>
            <strong>${escapeHtml(String(ruleCount))}</strong>
          </div>
          <div class="quality-business-card-meta">
            <span>问题数</span>
            <strong>${escapeHtml(String(issueCount))}</strong>
          </div>
          <div class="quality-business-card-meta">
            <span>最后检查</span>
            <strong>${escapeHtml(checkedAt)}</strong>
          </div>
        </article>
      </div>

      ${report ? `
        <div class="quality-callout ${escapeHtml(tone)}">
          <strong>快速建议</strong>
          <p>${escapeHtml(quickTip)}</p>
        </div>
        <div class="report-simple-grid quality-summary-grid">
          ${report.metrics.map(([metricLabel, value]) => `
            <article class="report-simple-item">
              <span>${escapeHtml(metricLabel)}</span>
              <strong>${escapeHtml(String(value))}</strong>
            </article>
          `).join("")}
        </div>
        <div class="list-stack compact-stack">
          ${report.issues.length ? report.issues.map((item) => `
            <article class="highlight-card">
              <span class="badge ${escapeHtml(item.tone)}">${escapeHtml(item.level)}</span>
              <strong>${escapeHtml(item.title)}</strong>
              <p>${escapeHtml(item.detail)}</p>
            </article>
          `).join("") : `
            <div class="empty-state empty-state-rich compact-empty-state">
              <strong>这批用例的基础质量看起来不错</strong>
              <p>标题、步骤、预期结果和基础覆盖项都没有发现明显问题。</p>
            </div>
          `}
        </div>
      ` : `
        <div class="empty-state empty-state-rich compact-empty-state">
          <strong>${escapeHtml(businessName)} 还没有检测记录</strong>
          <p>请上传 ${escapeHtml(businessName)} 的 CSV，系统会把结果保存在这个业务模块里。</p>
        </div>
      `}
    </section>
  `;

  els.qualityBusinessModules.querySelectorAll("[data-quality-upload]").forEach((input) => {
    input.addEventListener("change", (event) => handleQualityImport(event, input.dataset.qualityUpload));
  });
}

function renderOnboarding() {
  const flow = getWorkflowState();
  const steps = [
    {
      key: "bot",
      title: "先启用 AI",
      desc: "填入 OpenAI Key，点检测并启用。通过后，后面的用例生成才会走官方模型。",
      done: flow.hasBotConfig,
      current: flow.nextAction === "configure-bot"
    },
    {
      key: "task-and-cases",
      title: "创建任务并生成用例",
      desc: "填写任务和测试范围，放入需求或接口文档，一次生成测试用例。",
      done: flow.hasCases,
      current: ["create-task", "prepare-source", "generate-cases"].includes(flow.nextAction)
    },
    {
      key: "execution",
      title: "执行用例并记录问题",
      desc: "手工执行时改状态、写备注。失败的问题可以直接转成 BUG。",
      done: flow.hasExecutionOrBug,
      current: flow.nextAction === "execute-cases"
    },
    {
      key: "report",
      title: "看报告，准备自动化",
      desc: "报告页看整体结果；稳定的接口场景再进入接口自动化，后续接 pytest 回归。",
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
  const hasBotConfig = Boolean(settings.apiKey && settings.apiReady);
  const hasMeta = Boolean(state.activeBatchId);
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
      actionLabel: "先配置个人 Key",
      tipTitle: "先配置个人 Key",
      tipBody: "先填写你自己的 API Key 并检测通过。检测通过后，当前浏览器会自动保留，下次刷新无需重新输入。"
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
  if (stepKey === "task") return "create-task";
  if (stepKey === "source") return "prepare-source";
  if (stepKey === "cases") return "generate-cases";
  if (stepKey === "execution") return "manage-bugs";
  return "export-report";
}

function getStepButtonLabel(stepKey) {
  if (stepKey === "bot") return "去配置";
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
    window.scrollTo({ top: 0, behavior: "smooth" });
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
  const search = els.taskSearchInput?.value.trim().toLowerCase() || "";
  const versionFilter = els.taskVersionFilter?.value || "";
  const visibleTasks = state.tasks.filter((task) => {
    const batch = getBatchById(task.batchId);
    const isLinked = Boolean(batch && !batch.systemManaged);
    const matchesSearch = !search || [task.name, task.scope, batch?.version]
      .some((value) => String(value || "").toLowerCase().includes(search));
    const matchesVersion = !versionFilter
      || (versionFilter === "linked" && isLinked)
      || (versionFilter === "unlinked" && !isLinked);
    return matchesSearch && matchesVersion;
  });

  if (els.taskManagerCount) {
    els.taskManagerCount.textContent = `${visibleTasks.length} 个任务`;
  }

  if (!state.tasks.length) {
    els.taskManagerList.innerHTML = `
      <div class="empty-state empty-state-rich task-table-empty">
        <strong>还没有测试任务</strong>
        <p>先在“用例生成”页面创建任务，保存后会自动出现在这里。</p>
        <button class="primary-button" type="button" data-create-task>新建第一个任务</button>
      </div>
    `;
    els.taskManagerList.querySelector("[data-create-task]")?.addEventListener("click", () => els.goCreateTaskBtn?.click());
    return;
  }

  if (!visibleTasks.length) {
    els.taskManagerList.innerHTML = `
      <div class="empty-state empty-state-rich task-table-empty">
        <strong>没有匹配的任务</strong>
        <p>尝试清空搜索词或切换版本归属筛选。</p>
      </div>
    `;
    return;
  }

  els.taskManagerList.innerHTML = `
    <table class="task-table">
      <thead>
        <tr>
          <th>任务名称</th>
          <th>测试范围</th>
          <th>关联版本</th>
          <th>状态</th>
          <th>创建时间</th>
          <th class="task-action-column">操作</th>
        </tr>
      </thead>
      <tbody>
        ${visibleTasks.map((task) => renderTaskTableRow(task)).join("")}
      </tbody>
    </table>
  `;

  els.taskManagerList.querySelectorAll("[data-task-action]").forEach((button) => {
    button.addEventListener("click", () => handleTaskAction(button.dataset.taskAction, button.dataset.taskId));
  });
}

function renderTaskTableRow(task) {
  const batch = getBatchById(task.batchId);
  const isLinked = Boolean(batch && !batch.systemManaged);
  const isActive = task.id === state.activeTaskId;
  const isReadonly = isTaskReadonly(task);

  return `
    <tr class="task-table-row ${isActive ? "is-active" : ""}">
      <td data-label="任务名称">
        <div class="task-name-cell">
          <strong>${escapeHtml(task.name || "未命名任务")}</strong>
          ${isActive ? `<span class="badge subtle">当前</span>` : ""}
        </div>
      </td>
      <td data-label="测试范围"><p class="task-scope-cell">${escapeHtml(task.scope || "未填写测试范围")}</p></td>
      <td data-label="关联版本">
        ${isLinked
    ? `<span class="task-version-linked">${escapeHtml(batch.version || "未命名版本")}</span>`
    : `<span class="task-version-unlinked">待关联</span>`}
      </td>
      <td data-label="状态"><span class="version-status version-status-${task.status === "已完成" ? "success" : "active"}">${escapeHtml(task.status || "进行中")}</span></td>
      <td data-label="创建时间">${escapeHtml(formatAuditTime(task.createdAt))}</td>
      <td data-label="操作" class="task-action-column">
        <div class="task-row-actions">
          ${!isActive && !isReadonly ? `<button class="table-link" type="button" data-task-action="activate" data-task-id="${task.id}">设为当前</button>` : ""}
          ${isReadonly
    ? `<span class="task-readonly-label">已完成，只读</span>`
    : `<button class="table-link" type="button" data-task-action="edit" data-task-id="${task.id}">编辑</button>
               <button class="table-link task-delete-link" type="button" data-task-action="delete" data-task-id="${task.id}">删除</button>`}
        </div>
      </td>
    </tr>
  `;
}

function renderVersionManager() {
  const search = els.versionSearchInput?.value.trim().toLowerCase() || "";
  const status = els.versionStatusFilter?.value || "";
  const managedBatches = state.batches.filter((batch) => !batch.systemManaged);
  const visibleBatches = managedBatches.filter((batch) => {
    const relatedTasks = state.tasks.filter((task) => task.batchId === batch.id);
    const matchesSearch = !search || [batch.version, ...relatedTasks.map((task) => task.name)]
      .some((value) => String(value || "").toLowerCase().includes(search));
    return matchesSearch && (!status || batch.status === status);
  });

  if (els.versionManagerCount) {
    els.versionManagerCount.textContent = `${visibleBatches.length} 个版本`;
  }

  if (!managedBatches.length) {
    els.versionManagerList.innerHTML = `
      <div class="empty-state empty-state-rich version-table-empty">
        <strong>还没有正式版本</strong>
        <p>点击“新增版本”，可以同时把用例生成页创建的新任务关联进来。</p>
        <button class="primary-button" type="button" data-open-version-modal>新增第一个版本</button>
      </div>
    `;
    els.versionManagerList.querySelector("[data-open-version-modal]")?.addEventListener("click", () => openVersionModal());
    return;
  }

  if (!visibleBatches.length) {
    els.versionManagerList.innerHTML = `
      <div class="empty-state empty-state-rich version-table-empty">
        <strong>没有匹配的版本</strong>
        <p>尝试清空搜索词或切换状态筛选。</p>
      </div>
    `;
    return;
  }

  els.versionManagerList.innerHTML = `
    <table class="version-table">
      <thead>
        <tr>
          <th>版本号</th>
          <th>状态</th>
          <th>关联任务</th>
          <th>创建时间</th>
          <th>完成时间</th>
          <th class="version-action-column">操作</th>
        </tr>
      </thead>
      <tbody>
        ${visibleBatches.map((batch) => renderVersionTableRows(batch)).join("")}
      </tbody>
    </table>
  `;

  els.versionManagerList.querySelectorAll("[data-version-detail-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const detailRow = els.versionManagerList.querySelector(`[data-version-detail-row="${button.dataset.versionDetailToggle}"]`);
      const opening = detailRow?.classList.contains("hidden-field");
      detailRow?.classList.toggle("hidden-field", !opening);
      button.textContent = opening ? "收起" : "详情";
    });
  });
  els.versionManagerList.querySelectorAll("[data-version-action]").forEach((button) => {
    button.addEventListener("click", () => handleVersionAction(button.dataset.versionAction, button.dataset.versionId));
  });
  els.versionManagerList.querySelectorAll("[data-task-action]").forEach((button) => {
    button.addEventListener("click", () => handleTaskAction(button.dataset.taskAction, button.dataset.taskId));
  });
  els.versionManagerList.querySelectorAll("[data-task-detail-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const detail = els.versionManagerList.querySelector(`[data-task-readonly-detail="${button.dataset.taskDetailToggle}"]`);
      const opening = detail?.classList.contains("hidden-field");
      detail?.classList.toggle("hidden-field", !opening);
      button.textContent = opening ? "收起详情" : "查看详情";
    });
  });
}

function renderVersionTableRows(batch) {
  const relatedTasks = state.tasks.filter((task) => task.batchId === batch.id);
  const isActive = batch.id === state.activeBatchId;
  const isSuspended = batch.status === "已挂起";
  const isCompleted = batch.status === "已完成";
  const taskPreview = relatedTasks.slice(0, 2).map((task) => `<span>${escapeHtml(task.name || "未命名任务")}</span>`).join("");
  const remainingTaskCount = Math.max(0, relatedTasks.length - 2);

  return `
    <tr class="version-table-row ${isActive ? "is-active" : ""}">
      <td data-label="版本号">
        <div class="version-name-cell">
          <strong>${escapeHtml(batch.version || "未命名版本")}</strong>
          ${isActive ? `<span class="badge subtle">当前</span>` : ""}
        </div>
      </td>
      <td data-label="状态"><span class="version-status version-status-${getVersionStatusTone(batch.status)}">${escapeHtml(batch.status || "进行中")}</span></td>
      <td data-label="关联任务">
        <div class="version-task-preview">
          ${taskPreview || `<span class="version-task-empty">暂未关联</span>`}
          ${remainingTaskCount ? `<span class="version-task-more">+${remainingTaskCount}</span>` : ""}
        </div>
      </td>
      <td data-label="创建时间">${escapeHtml(formatAuditTime(batch.createdAt))}</td>
      <td data-label="完成时间">${escapeHtml(batch.completedAt ? formatAuditTime(batch.completedAt) : "-")}</td>
      <td data-label="操作" class="version-action-column">
        <div class="version-row-actions">
          ${!isCompleted ? `<button class="table-link version-link-task-button" type="button" data-version-action="link-tasks" data-version-id="${batch.id}">关联任务</button>` : ""}
          <button class="table-link" type="button" data-version-detail-toggle="${batch.id}">详情</button>
          ${!isCompleted ? `<button class="table-link" type="button" data-version-action="edit" data-version-id="${batch.id}">编辑</button>` : ""}
          ${!isCompleted && !isActive && !isSuspended ? `<button class="table-link" type="button" data-version-action="activate" data-version-id="${batch.id}">设为当前</button>` : ""}
          ${!isCompleted ? `
            <details class="version-more-menu">
              <summary aria-label="更多版本操作">更多</summary>
              <div class="version-more-menu-list">
                <button type="button" data-version-action="complete" data-version-id="${batch.id}">标记完成</button>
                <button type="button" data-version-action="${isSuspended ? "resume" : "suspend"}" data-version-id="${batch.id}">${isSuspended ? "恢复版本" : "挂起版本"}</button>
                <button class="danger-menu-action" type="button" data-version-action="delete" data-version-id="${batch.id}">删除版本</button>
              </div>
            </details>
          ` : ""}
        </div>
      </td>
    </tr>
    <tr class="version-detail-row hidden-field" data-version-detail-row="${batch.id}">
      <td colspan="6">
        <div class="version-table-detail">
          <div class="version-table-detail-head">
            <strong>关联任务（${relatedTasks.length}）</strong>
            ${!isCompleted ? `<button class="ghost-button tiny-button" type="button" data-version-action="edit" data-version-id="${batch.id}">调整关联</button>` : ""}
          </div>
          <div class="version-table-task-list">
            ${relatedTasks.length ? relatedTasks.map((task) => isCompleted ? `
              <article class="version-table-task-item completed-task-item">
                <div class="completed-task-summary">
                  <strong>${escapeHtml(task.name || "未命名任务")}</strong>
                  <span class="version-status version-status-success">${escapeHtml(task.status || "已完成")}</span>
                </div>
                <button class="table-link" type="button" data-task-detail-toggle="${task.id}">查看详情</button>
                <div class="completed-task-detail hidden-field" data-task-readonly-detail="${task.id}">
                  <div><span>测试范围</span><p>${escapeHtml(task.scope || "未填写测试范围")}</p></div>
                  <div><span>创建时间</span><p>${escapeHtml(formatAuditTime(task.createdAt))}</p></div>
                  <div><span>更新时间</span><p>${escapeHtml(formatAuditTime(task.updatedAt))}</p></div>
                </div>
              </article>
            ` : `
              <article class="version-table-task-item">
                <div>
                  <strong>${escapeHtml(task.name || "未命名任务")}</strong>
                  <p>${escapeHtml(task.scope || "未填写测试范围")}</p>
                </div>
                <div class="version-row-actions">
                  ${task.id !== state.activeTaskId && task.status !== "已完成" ? `<button class="table-link" type="button" data-task-action="activate" data-task-id="${task.id}">设为当前</button>` : task.id === state.activeTaskId ? `<span class="badge subtle">当前任务</span>` : ""}
                  ${task.status !== "已完成" ? `<button class="table-link" type="button" data-task-action="edit" data-task-id="${task.id}">编辑任务</button>` : `<span class="task-readonly-label">任务已完成</span>`}
                </div>
              </article>
            `).join("") : `<p class="version-detail-empty">当前版本还没有关联任务，可点击“调整关联”添加。</p>`}
          </div>
        </div>
      </td>
    </tr>
  `;
}

function getVersionStatusTone(status) {
  if (status === "已完成") return "success";
  if (status === "已挂起") return "muted";
  return "active";
}

function isTaskReadonly(task) {
  const batch = getBatchById(task?.batchId);
  return task?.status === "已完成" || batch?.status === "已完成";
}

function openVersionModal(batchId = "", mode = "edit") {
  const batch = getBatchById(batchId);
  const isLinkMode = Boolean(batch && mode === "link-tasks");
  editingBatchId = batch?.id || "";
  els.versionModal.dataset.mode = isLinkMode ? "link-tasks" : batch ? "edit" : "create";
  els.versionModalTitle.textContent = isLinkMode ? `关联任务 · ${batch.version}` : batch ? "编辑版本" : "新增版本";
  els.versionNumberInput.value = batch?.version || "";
  els.versionNumberInput.readOnly = isLinkMode;
  els.versionFormFeedback.textContent = isLinkMode
    ? "勾选需要归入此版本的任务，取消勾选会将任务放回待关联列表。"
    : batch
    ? "修改版本号，或调整当前版本关联的测试任务。"
    : "填写版本号，可选择需要关联的新建任务。";
  els.versionFormFeedback.className = "inline-feedback";

  const candidateTasks = state.tasks.filter((task) => {
    const linkedBatch = getBatchById(task.batchId);
    return task.batchId === batch?.id || !task.batchId || linkedBatch?.systemManaged;
  });
  const selectedTaskIds = new Set(state.tasks.filter((task) => task.batchId === batch?.id).map((task) => task.id));

  els.versionTaskOptions.innerHTML = candidateTasks.length ? candidateTasks.map((task) => {
    const linkedBatch = getBatchById(task.batchId);
    const sourceLabel = task.batchId === batch?.id
      ? "当前版本"
      : linkedBatch?.systemManaged ? "待归档" : "未关联";
    return `
      <label class="version-task-option">
        <input type="checkbox" value="${escapeHtml(task.id)}" ${selectedTaskIds.has(task.id) ? "checked" : ""}>
        <span class="version-task-option-copy">
          <strong>${escapeHtml(task.name || "未命名任务")}</strong>
          <small>${escapeHtml(task.scope || "未填写测试范围")}</small>
        </span>
        <span class="badge subtle">${sourceLabel}</span>
      </label>
    `;
  }).join("") : `
    <div class="version-task-options-empty">
      <strong>暂无待关联任务</strong>
      <p>可以先到“用例生成”中新建任务，也可以先创建空版本。</p>
    </div>
  `;

  els.versionTaskOptions.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener("change", updateVersionTaskSelectionCount);
  });
  updateVersionTaskSelectionCount();
  const saveButton = document.getElementById("saveVersionBtn");
  if (saveButton) saveButton.textContent = isLinkMode ? "保存关联" : "保存版本";
  els.versionModal.classList.remove("hidden-field");
  document.body.classList.add("dialog-open");
  window.setTimeout(() => {
    if (isLinkMode) {
      els.versionTaskOptions.querySelector('input[type="checkbox"]')?.focus();
    } else {
      els.versionNumberInput.focus();
    }
  }, 0);
}

function closeVersionModal() {
  els.versionModal?.classList.add("hidden-field");
  document.body.classList.remove("dialog-open");
  editingBatchId = "";
  if (els.versionNumberInput) els.versionNumberInput.readOnly = false;
  els.versionForm?.reset();
}

function updateVersionTaskSelectionCount() {
  const selectedCount = els.versionTaskOptions?.querySelectorAll('input[type="checkbox"]:checked').length || 0;
  if (els.versionTaskSelectionCount) {
    els.versionTaskSelectionCount.textContent = `已选 ${selectedCount} 项`;
  }
}

function saveVersionFromManager(event) {
  event.preventDefault();
  const version = els.versionNumberInput.value.trim();
  const existingBatch = getBatchById(editingBatchId);
  const duplicateBatch = state.batches.find((item) => (
    !item.systemManaged && item.version === version && item.id !== editingBatchId
  ));

  if (!version) {
    els.versionFormFeedback.textContent = "请填写版本号后再保存。";
    els.versionFormFeedback.className = "inline-feedback warn";
    els.versionNumberInput.focus();
    return;
  }
  if (duplicateBatch) {
    els.versionFormFeedback.textContent = `版本号 ${version} 已存在，请换一个版本号。`;
    els.versionFormFeedback.className = "inline-feedback warn";
    els.versionNumberInput.focus();
    return;
  }

  const isEditing = Boolean(existingBatch);
  const batch = isEditing
    ? applyUpdateAuditFields({ ...existingBatch, version })
    : applyCreateAuditFields({
      id: `batch-${Date.now()}`,
      name: "",
      version,
      scope: "",
      moduleId: "",
      moduleName: "",
      status: "进行中"
    });
  const selectedTaskIds = new Set(
    [...els.versionTaskOptions.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value)
  );
  const previouslyLinkedTaskIds = new Set(
    state.tasks.filter((task) => task.batchId === batch.id).map((task) => task.id)
  );

  if (isEditing) {
    state.batches = state.batches.map((item) => (item.id === batch.id ? batch : item));
  } else {
    state.batches.unshift(batch);
  }

  selectedTaskIds.forEach((taskId) => moveTaskToBatch(taskId, batch));
  const detachedTaskIds = [...previouslyLinkedTaskIds].filter((taskId) => !selectedTaskIds.has(taskId));
  if (detachedTaskIds.length) {
    const defaultBatch = getOrCreateDefaultWorkspaceBatch();
    detachedTaskIds.forEach((taskId) => moveTaskToBatch(taskId, defaultBatch));
  }

  state.activeBatchId = batch.id;
  state.generationBatchId = batch.id;
  state.activeTaskId = [...selectedTaskIds][0] || state.tasks.find((task) => task.batchId === batch.id)?.id || "";
  persist();
  closeVersionModal();
  renderAll();
  setGenerationStatus(`${isEditing ? "已更新" : "已新增"}版本：${version}，关联 ${selectedTaskIds.size} 个任务。`, "ok");
}

function getOrCreateDefaultWorkspaceBatch() {
  const existingBatch = state.batches.find((item) => item.systemManaged || item.version === DEFAULT_WORKSPACE_VERSION);
  if (existingBatch) {
    return existingBatch;
  }
  const defaultBatch = applyCreateAuditFields({
    id: "batch-default-workspace",
    name: "",
    version: DEFAULT_WORKSPACE_VERSION,
    scope: "",
    moduleId: "",
    moduleName: "",
    status: "进行中",
    systemManaged: true
  });
  state.batches.push(defaultBatch);
  return defaultBatch;
}

function moveTaskToBatch(taskId, batch) {
  const task = getTaskById(taskId);
  if (!task || !batch) {
    return;
  }
  const batchName = formatBatchLabel(batch);
  const nextTask = applyUpdateAuditFields({
    ...task,
    batchId: batch.id,
    batchVersion: batch.version || "",
    batchName,
    moduleId: batch.moduleId || "",
    moduleName: batch.moduleName || batch.name || ""
  });
  state.tasks = state.tasks.map((item) => (item.id === taskId ? nextTask : item));
  state.cases = state.cases.map((item) => (
    item.taskId === taskId ? { ...item, batchId: batch.id, batchVersion: batch.version || "", batchName } : item
  ));
  state.bugs = state.bugs.map((item) => (
    item.taskId === taskId ? { ...item, batchId: batch.id, batchVersion: batch.version || "", batchName } : item
  ));
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

  if (batch.status === "已完成" && ["edit", "link-tasks", "suspend", "resume", "delete"].includes(action)) {
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
    openVersionModal(batch.id);
    return;
  }

  if (action === "link-tasks") {
    openVersionModal(batch.id, "link-tasks");
    return;
  }

  if (action === "suspend" || action === "resume") {
    const nextStatus = action === "suspend" ? "已挂起" : "进行中";
    state.batches = state.batches.map((item) => (
      item.id === batch.id ? applyUpdateAuditFields({ ...item, status: nextStatus }) : item
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
      item.id === batch.id
        ? applyUpdateAuditFields({ ...item, status: "已完成", completedAt: item.completedAt || nowIsoString() })
        : item
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

  if (isTaskReadonly(task) && ["activate", "edit", "delete"].includes(action)) {
    setGenerationStatus(task.status === "已完成"
      ? `任务 ${task.name || "未命名任务"} 已完成，只支持查看。`
      : `版本 ${formatBatchLabel(batch)} 已完成，已有任务只支持查看。`, "warn");
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
    els.createTaskBtn.textContent = "保存任务修改";
    autoResizeTextarea();
    switchTab("upload");
    els.taskNameInput.focus();
    setGenerationStatus(`正在编辑任务：${task.name}。`, "neutral");
    return;
  }

  if (action === "delete") {
    const confirmed = window.confirm(`确认删除任务“${task.name || "未命名任务"}”？相关用例和 BUG 记录也会一起删除。`);
    if (!confirmed) {
      return;
    }
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
      els.createTaskBtn.textContent = "创建任务并生成用例";
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
  const batch = getBatchById(task.batchId);
  const version = batch?.systemManaged ? "" : task.batchVersion || batch?.version || "";
  return [task.name || "未命名任务", version].filter(Boolean).join(" / ");
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
  return {
    ...item,
    name: moduleName || item.name,
    moduleName: moduleName || item.moduleName || item.name,
    moduleId: moduleName ? slugifyBusiness(moduleName) : item.moduleId || "",
    createdBy: String(item.createdBy || "").trim(),
    createdAt: item.createdAt || "",
    updatedBy: String(item.updatedBy || "").trim(),
    updatedAt: item.updatedAt || item.createdAt || ""
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
    status: item.status || "进行中",
    createdBy: String(item.createdBy || "").trim(),
    createdAt: item.createdAt || "",
    updatedBy: String(item.updatedBy || "").trim(),
    updatedAt: item.updatedAt || item.createdAt || ""
  };
}

function normalizeCaseItem(item) {
  const moduleName = normalizeBusinessName(item.module || item.moduleName);
  return {
    ...item,
    taskId: item.taskId || "",
    taskName: item.taskName || "",
    module: moduleName || item.module,
    moduleId: moduleName ? slugifyBusiness(moduleName) : item.moduleId || "",
    automationEnabled: Boolean(item.automationEnabled),
    automationTargetPath: String(item.automationTargetPath || "").trim(),
    automationSteps: normalizeCaseAutomationSteps(item.automationSteps),
    automationLastRun: normalizeCaseAutomationLastRun(item.automationLastRun),
    createdBy: String(item.createdBy || "").trim(),
    createdAt: item.createdAt || "",
    updatedBy: String(item.updatedBy || "").trim(),
    updatedAt: item.updatedAt || item.createdAt || ""
  };
}

function normalizeCaseAutomationSteps(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeAutomationStep(item)).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((item) => normalizeAutomationStep(item)).filter(Boolean) : [];
    } catch (_error) {
      return [];
    }
  }

  return [];
}

function createDefaultAutomationStep() {
  return {
    stepType: "click",
    locatorType: "text",
    target: "",
    inputValue: "",
    remark: ""
  };
}

function normalizeAutomationStep(rawStep) {
  if (!rawStep || typeof rawStep !== "object") {
    return null;
  }

  const stepType = normalizeAutomationStepType(rawStep.stepType || rawStep.type, rawStep.action);
  const locatorType = normalizeAutomationLocatorType(rawStep.locatorType || rawStep.by);
  const normalized = {
    stepType,
    locatorType,
    target: "",
    inputValue: "",
    remark: String(rawStep.remark || rawStep.note || "").trim()
  };

  if (stepType === "openPage") {
    normalized.target = String(rawStep.target || rawStep.path || rawStep.url || "").trim();
    return normalized;
  }

  if (stepType === "wait") {
    normalized.inputValue = String(rawStep.inputValue || rawStep.ms || "").trim();
    normalized.target = String(rawStep.target || "").trim();
    return normalized;
  }

  if (stepType === "assertText") {
    normalized.target = inferAutomationTargetFromRawStep(rawStep, locatorType);
    normalized.inputValue = String(rawStep.inputValue || rawStep.text || "").trim();
    return normalized;
  }

  if (stepType === "input") {
    normalized.target = inferAutomationTargetFromRawStep(rawStep, locatorType);
    normalized.inputValue = String(rawStep.inputValue || rawStep.value || "").trim();
    return normalized;
  }

  if (stepType === "screenshot") {
    normalized.target = inferAutomationTargetFromRawStep(rawStep, locatorType) || "body";
    normalized.inputValue = String(rawStep.inputValue || rawStep.name || rawStep.fileName || "").trim();
    return normalized;
  }

  normalized.target = inferAutomationTargetFromRawStep(rawStep, locatorType);
  return normalized;
}

function normalizeAutomationStepType(stepType, action) {
  const raw = String(stepType || action || "").trim().toLowerCase();
  if (["openpage", "goto", "open", "打开页面"].includes(raw)) return "openPage";
  if (["click", "点击"].includes(raw)) return "click";
  if (["input", "fill", "输入"].includes(raw)) return "input";
  if (["waitelement", "waitfor", "等待元素"].includes(raw)) return "waitElement";
  if (["asserttext", "校验文本", "断言文本"].includes(raw)) return "assertText";
  if (["assertelement", "assertvisible", "校验元素", "校验元素存在", "断言元素"].includes(raw)) return "assertElement";
  if (["screenshot", "截图"].includes(raw)) return "screenshot";
  if (["wait", "waitfortimeout", "等待"].includes(raw)) return "wait";
  return "click";
}

function normalizeAutomationLocatorType(locatorType) {
  const raw = String(locatorType || "").trim().toLowerCase();
  if (["text", "文本"].includes(raw)) return "text";
  if (["placeholder"].includes(raw)) return "placeholder";
  if (["label"].includes(raw)) return "label";
  return "css";
}

function inferAutomationTargetFromRawStep(step, locatorType) {
  if (step.target) return String(step.target).trim();
  if (step.selector) {
    if (locatorType === "text") {
      const textMatch = String(step.selector).match(/text=(.+)$/);
      if (textMatch) return textMatch[1].trim();
    }
    if (locatorType === "placeholder") {
      const placeholderMatch = String(step.selector).match(/placeholder=(.+)$/);
      if (placeholderMatch) return placeholderMatch[1].trim();
    }
    if (locatorType === "label") {
      const labelMatch = String(step.selector).match(/label=(.+)$/);
      if (labelMatch) return labelMatch[1].trim();
    }
    return String(step.selector).trim();
  }
  return "";
}

function buildAutomationSelector(locatorType, target) {
  const normalizedTarget = String(target || "").trim();
  if (!normalizedTarget) {
    return "";
  }
  if (locatorType === "text") {
    return `text=${normalizedTarget}`;
  }
  if (locatorType === "placeholder") {
    return `placeholder=${normalizedTarget}`;
  }
  if (locatorType === "label") {
    return `label=${normalizedTarget}`;
  }
  return normalizedTarget;
}

function buildAutomationRuntimeSteps(stepDrafts) {
  return (stepDrafts || []).map((rawStep) => normalizeAutomationStep(rawStep)).filter(Boolean).map((step) => {
    if (step.stepType === "openPage") {
      return {
        stepType: step.stepType,
        locatorType: step.locatorType,
        target: step.target,
        inputValue: step.inputValue,
        remark: step.remark,
        action: "goto",
        path: step.target
      };
    }

    if (step.stepType === "wait") {
      return {
        stepType: step.stepType,
        locatorType: step.locatorType,
        target: step.target,
        inputValue: step.inputValue,
        remark: step.remark,
        action: "waitForTimeout",
        ms: Number(step.inputValue) > 0 ? Number(step.inputValue) : 1000
      };
    }

    if (step.stepType === "click") {
      return {
        ...step,
        action: "click",
        selector: buildAutomationSelector(step.locatorType, step.target)
      };
    }

    if (step.stepType === "input") {
      return {
        ...step,
        action: "fill",
        selector: buildAutomationSelector(step.locatorType, step.target),
        value: step.inputValue
      };
    }

    if (step.stepType === "waitElement") {
      return {
        ...step,
        action: "waitFor",
        selector: buildAutomationSelector(step.locatorType, step.target),
        state: "visible"
      };
    }

    if (step.stepType === "assertText") {
      return {
        ...step,
        action: "assertText",
        selector: buildAutomationSelector(step.locatorType, step.target || "body"),
        text: step.inputValue
      };
    }

    if (step.stepType === "assertElement") {
      return {
        ...step,
        action: "assertVisible",
        selector: buildAutomationSelector(step.locatorType, step.target)
      };
    }

    if (step.stepType === "screenshot") {
      return {
        ...step,
        action: "screenshot",
        selector: buildAutomationSelector(step.locatorType, step.target || "body"),
        name: step.inputValue
      };
    }

    return step;
  });
}

function formatAutomationStepsJson(steps) {
  return JSON.stringify(buildAutomationRuntimeSteps(steps), null, 2);
}

function parseAutomationStepsJson(stepsText) {
  const text = String(stepsText || "").trim();
  if (!text) {
    return [];
  }
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error("自动化步骤必须是 JSON 数组。");
  }
  return parsed.map((item) => normalizeAutomationStep(item)).filter(Boolean);
}

function getAutomationStepTypeLabel(stepType) {
  return AUTOMATION_STEP_TYPES.find((item) => item.value === stepType)?.label || "步骤";
}

function getAutomationQuickHint(stepType) {
  if (stepType === "openPage") return "填页面路径，例如：/orders/list";
  if (stepType === "click") return "填按钮文字，通常直接写“查询”或“保存”";
  if (stepType === "input") return "目标填输入框提示词，输入值填你要输入的内容";
  if (stepType === "waitElement") return "通常等表格、按钮或结果区出现";
  if (stepType === "assertText") return "目标通常填 body，输入值填你期望看到的文字";
  if (stepType === "assertElement") return "直接填页面上应该出现的文字或元素";
  if (stepType === "screenshot") return "一般不用改，留作执行留痕";
  if (stepType === "wait") return "只在页面确实有明显延迟时再填毫秒数";
  return "";
}

function getAutomationSimplePlaceholder(stepType) {
  if (stepType === "openPage") return "例如：/orders/list";
  if (stepType === "click") return "例如：登录 / 保存 / 查询";
  if (stepType === "input") return "例如：请输入账号";
  if (stepType === "waitElement") return "例如：结果列表 / 提交按钮";
  if (stepType === "assertText") return "例如：body";
  if (stepType === "assertElement") return "例如：首页 / 提交成功";
  if (stepType === "screenshot") return "例如：body";
  if (stepType === "wait") return "可不填";
  return "请输入";
}

function getAutomationStepSummary(step) {
  const stepLabel = getAutomationStepTypeLabel(step.stepType);
  const target = String(step.target || "").trim() || "未填写";
  const inputValue = String(step.inputValue || "").trim();
  if (step.stepType === "input") {
    return `${stepLabel}：在「${target}」里输入「${inputValue || "未填写"}」`;
  }
  if (step.stepType === "assertText") {
    return `${stepLabel}：检查页面里出现「${inputValue || "未填写"}」`;
  }
  if (step.stepType === "wait") {
    return `${stepLabel}：等待 ${inputValue || "1000"} ms`;
  }
  if (step.stepType === "openPage") {
    return `${stepLabel}：进入「${target}」`;
  }
  return `${stepLabel}：${target}`;
}

function shouldShowAutomationLocator(stepType) {
  return !["openPage", "wait"].includes(stepType);
}

function shouldShowAutomationTarget(stepType) {
  return true;
}

function getAutomationTargetLabel(stepType) {
  if (stepType === "openPage") return "目标值（页面路径）";
  if (stepType === "wait") return "目标值（可选备注）";
  return "目标值";
}

function getAutomationInputLabel(stepType) {
  if (stepType === "input") return "输入值";
  if (stepType === "assertText") return "断言文本";
  if (stepType === "wait") return "输入值（毫秒）";
  if (stepType === "screenshot") return "输入值（截图名）";
  return "输入值";
}

function shouldShowAutomationInput(stepType) {
  return ["input", "assertText", "wait", "screenshot"].includes(stepType);
}

function ensureCaseAutomationEditor(node) {
  const automationBlock = node.querySelector(".case-automation-block");
  if (!automationBlock) {
    return;
  }

  const legacyLabel = automationBlock.querySelector("label:not(.case-execution-note-wrap):has(.case-automation-steps)");
  if (automationBlock.querySelector(".case-automation-editor")) {
    return;
  }

  const editor = document.createElement("div");
  editor.className = "case-automation-editor";
  editor.innerHTML = `
    <div class="case-automation-beginner-guide">
      <strong>只要 3 步：1 选模板，2 改文字，3 点运行。</strong>
      <p>新人建议先从模板开始，绝大多数场景都不用自己从零搭步骤。</p>
    </div>
    <div class="case-automation-toolbar">
      <div class="case-automation-template-row">
        <span class="case-automation-step-no">第 1 步</span>
        <select class="case-automation-template-select">
          <option value="">请选择一个常用模板</option>
        </select>
        <button type="button" class="primary-button tiny-button case-automation-apply-template">套用这个模板</button>
      </div>
    </div>
    <div class="case-automation-secondary-tools">
      <div class="case-automation-quick-add"></div>
      <button type="button" class="ghost-button tiny-button case-automation-add-step">从空白步骤开始</button>
      <button type="button" class="ghost-button tiny-button case-automation-json-toggle">查看/编辑 JSON</button>
    </div>
    <div class="case-automation-step-list"></div>
    <div class="case-automation-json-panel hidden-field"></div>
  `;

  const jsonPanel = editor.querySelector(".case-automation-json-panel");
  const textarea = automationBlock.querySelector(".case-automation-steps");
  if (textarea) {
    const jsonLabel = document.createElement("label");
    jsonLabel.innerHTML = `
      <span>高级模式（JSON）</span>
    `;
    jsonLabel.appendChild(textarea);
    textarea.rows = 7;
    textarea.placeholder = '例如：[{"action":"click","selector":"text=搜索"},{"action":"assertVisible","selector":".table-row"}]';
    jsonPanel.appendChild(jsonLabel);
  }

  if (legacyLabel) {
    legacyLabel.remove();
  }

  const actionBar = automationBlock.querySelector(".inline-actions");
  if (actionBar) {
    automationBlock.insertBefore(editor, actionBar);
  } else {
    automationBlock.appendChild(editor);
  }
}

function normalizeCaseAutomationLastRun(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  return {
    status: String(value.status || "").trim(),
    summary: String(value.summary || "").trim(),
    startedAt: String(value.startedAt || "").trim(),
    finishedAt: String(value.finishedAt || "").trim()
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
    owner: String(item.owner || "").trim(),
    createdBy: String(item.createdBy || "").trim(),
    createdAt: item.createdAt || "",
    updatedBy: String(item.updatedBy || "").trim(),
    updatedAt: item.updatedAt || item.createdAt || ""
  };
}

function normalizeTeamMembers(list) {
  return [...new Set((list || []).map((item) => String(item || "").trim()).filter(Boolean))];
}

function collectOwnersIntoTeamMembers() {
  const owners = [
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

function buildCaseBatchFilterOptions(source = "cases") {
  const sourceItems = source === "bugs" ? state.bugs : state.cases;
  const items = [];
  const seen = new Set();

  state.batches.forEach((batch) => {
    if (!batch?.id || seen.has(batch.id)) {
      return;
    }
    seen.add(batch.id);
    items.push({
      id: batch.id,
      version: batch.version || "",
      name: batch.name || "",
      moduleName: batch.moduleName || ""
    });
  });

  sourceItems.forEach((item) => {
    const batchId = String(item.batchId || "").trim();
    const batchVersion = String(item.batchVersion || "").trim();
    if (batchId && seen.has(batchId)) {
      return;
    }
    const fallbackId = batchId || (batchVersion ? `legacy-version:${batchVersion}` : "");
    if (!fallbackId || seen.has(fallbackId)) {
      return;
    }
    seen.add(fallbackId);
    items.push({
      id: fallbackId,
      version: batchVersion || "未命名版本",
      name: "",
      moduleName: ""
    });
  });

  return items;
}

function buildReportBatchOptions() {
  const items = [];
  const seen = new Set();
  const sourceItems = [...state.cases, ...state.bugs];

  state.batches.forEach((batch) => {
    if (!batch?.id || seen.has(batch.id)) {
      return;
    }
    seen.add(batch.id);
    items.push(batch);
  });

  sourceItems.forEach((item) => {
    const batchId = String(item.batchId || "").trim();
    const batchVersion = String(item.batchVersion || "").trim();
    if (batchId && seen.has(batchId)) {
      return;
    }
    const fallbackId = batchId || (batchVersion ? `legacy-version:${batchVersion}` : "");
    if (!fallbackId || seen.has(fallbackId)) {
      return;
    }
    seen.add(fallbackId);
    items.push({
      id: fallbackId,
      version: batchVersion || "未命名版本",
      name: item.batchName || "",
      moduleId: item.moduleId || "",
      moduleName: item.moduleName || item.module || "",
      status: ""
    });
  });

  return items;
}

function matchesBatchFilter(item, batchFilter) {
  if (!batchFilter) {
    return true;
  }

  const itemBatchId = String(item?.batchId || "").trim();
  if (itemBatchId && itemBatchId === batchFilter) {
    return true;
  }

  if (batchFilter.startsWith("legacy-version:")) {
    const legacyVersion = batchFilter.slice("legacy-version:".length);
    return String(item?.batchVersion || "").trim() === legacyVersion;
  }

  return false;
}

function getTasksByBatchForFilters(batchId, source = "all") {
  const taskPool = state.tasks.map((item) => ({
    id: item.id || item.name,
    name: item.name,
    batchId: item.batchId,
    batchVersion: item.batchVersion || getBatchVersionById(item.batchId)
  }));
  const fallbackPool = source === "bugs"
    ? state.bugs.map((item) => ({ id: item.taskId || item.taskName, name: item.taskName, batchId: item.batchId, batchVersion: item.batchVersion }))
    : state.cases.map((item) => ({ id: item.taskId || item.taskName, name: item.taskName, batchId: item.batchId, batchVersion: item.batchVersion }));
  const baseTasks = [...taskPool, ...fallbackPool];

  return [...new Map(
    baseTasks
      .filter((item) => item.name)
      .filter((item) => matchesBatchFilter(item, batchId))
      .map((item) => [item.name, item])
  ).values()];
}

function getTaskOptionsByBatchForEditor(batchId, source = "bugs") {
  return getTasksByBatchForFilters(batchId, source).map((item) => ({
    id: item.id || item.name,
    name: item.name || ""
  }));
}

function getFilteredCasesForView() {
  const batchFilter = els.caseBatchFilter.value;
  const taskFilter = els.caseTaskFilter.value;
  const statusFilter = els.caseStatusFilter?.value || "";

  return state.cases.filter((item) => {
    return matchesBatchFilter(item, batchFilter)
      && (!taskFilter || item.taskName === taskFilter)
      && (!statusFilter || (item.executionStatus || "未执行") === statusFilter);
  });
}

function getFilteredAutomationCasesForView() {
  const batchFilter = els.automationCaseBatchFilter?.value || "";
  const taskFilter = els.automationCaseTaskFilter?.value || "";
  const enabledFilter = els.automationCaseEnabledFilter?.value || "";

  return state.cases.filter((item) => {
    const byBatch = matchesBatchFilter(item, batchFilter);
    const byTask = !taskFilter || item.taskName === taskFilter;
    const byAutomation = enabledFilter === "enabled"
      ? Boolean(item.automationEnabled)
      : enabledFilter === "disabled"
        ? !item.automationEnabled
        : true;

    return byBatch && byTask && byAutomation;
  });
}

function getFilteredBugs() {
  const batchFilter = els.bugBatchFilter.value;
  const taskFilter = els.bugTaskFilter.value;
  const search = els.bugSearchInput?.value.trim().toLowerCase() || "";
  const severityFilter = els.bugSeverityFilter?.value || "";
  const statusFilter = els.bugWorkflowStatusFilter?.value || "";

  return state.bugs.filter((bug) => {
    const byBatch = matchesBatchFilter(bug, batchFilter);
    const byTask = !taskFilter || bug.taskName === taskFilter;
    const bySearch = !search || [bug.title, bug.note, bug.batchVersion, bug.taskName]
      .some((value) => String(value || "").toLowerCase().includes(search));
    const bySeverity = !severityFilter || bug.severity === severityFilter;
    const byStatus = !statusFilter || bug.status === statusFilter;
    return byBatch && byTask && bySearch && bySeverity && byStatus;
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
  const batch = buildReportBatchOptions().find((item) => item.id === batchId) || getBatchById(batchId);
  const tasks = state.tasks.filter((item) => matchesBatchFilter(item, batchId));
  const taskIds = new Set(tasks.map((item) => item.id));
  const cases = state.cases.filter((item) => matchesBatchFilter(item, batchId) || taskIds.has(item.taskId));
  const caseIds = new Set(cases.map((item) => item.id));
  const bugs = state.bugs.filter((item) => {
    const byBatch = matchesBatchFilter(item, batchId) || taskIds.has(item.taskId);
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
  const caseBatchOptions = buildCaseBatchFilterOptions("cases");
  const bugBatchOptions = buildCaseBatchFilterOptions("bugs");
  fillSelectFromItems(els.caseBatchFilter, caseBatchOptions, "全部版本", els.caseBatchFilter.value, formatTaskBatchLabel);
  fillSelectFromItems(els.automationCaseBatchFilter, caseBatchOptions, "全部版本", els.automationCaseBatchFilter?.value, formatTaskBatchLabel);
  fillSelectFromItems(els.bugBatchFilter, bugBatchOptions, "全部版本", els.bugBatchFilter.value, formatTaskBatchLabel);

  const caseTasks = getTasksByBatchForFilters(els.caseBatchFilter.value, "cases");
  const automationCaseTasks = getTasksByBatchForFilters(els.automationCaseBatchFilter?.value || "", "cases");
  const bugTasks = getTasksByBatchForFilters(els.bugBatchFilter.value, "bugs");
  const caseTaskNames = caseTasks.map((item) => item.name);
  const automationCaseTaskNames = automationCaseTasks.map((item) => item.name);
  const bugTaskNames = bugTasks.map((item) => item.name);
  const caseTaskValue = caseTaskNames.includes(els.caseTaskFilter.value) ? els.caseTaskFilter.value : "";
  const automationCaseTaskValue = automationCaseTaskNames.includes(els.automationCaseTaskFilter?.value) ? els.automationCaseTaskFilter.value : "";
  const bugTaskValue = bugTaskNames.includes(els.bugTaskFilter.value) ? els.bugTaskFilter.value : "";

  els.caseTaskFilter.innerHTML = `<option value="">全部任务</option>${caseTasks.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join("")}`;
  if (els.automationCaseTaskFilter) {
    els.automationCaseTaskFilter.innerHTML = `<option value="">全部任务</option>${automationCaseTasks.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join("")}`;
  }
  els.bugTaskFilter.innerHTML = `<option value="">全部任务</option>${bugTasks.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join("")}`;

  els.caseTaskFilter.value = caseTaskValue;
  if (els.automationCaseTaskFilter) {
    els.automationCaseTaskFilter.value = automationCaseTaskValue;
  }
  els.bugTaskFilter.value = bugTaskValue;
}

function updateCaseExecutionState(item, nextStatus) {
  item.executionStatus = nextStatus;
  Object.assign(item, applyUpdateAuditFields(item));
}

function applyBulkCaseExecutionStatus() {
  const nextStatus = els.caseBulkStatus?.value || "";
  if (!nextStatus) {
    setCaseActionStatus("请先选择要批量设置成什么执行状态。", "warn");
    return;
  }

  const filteredCases = getFilteredCasesForView();
  if (!filteredCases.length) {
    setCaseActionStatus("当前筛选范围里没有可批量更新的测试用例。", "warn");
    return;
  }

  filteredCases.forEach((item) => updateCaseExecutionState(item, nextStatus));
  persist();
  renderCases();
  renderQuickStats();
  renderReport();
  setCaseActionStatus(`已将 ${filteredCases.length} 条测试用例批量更新为“${nextStatus}”。`, "ok");
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
  return buildReportBatchOptions().map((batch) => {
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
  if (!els.caseList || !els.caseExecutionWorkspace) {
    return;
  }

  const filtered = getFilteredCasesForView();
  const batchFilter = els.caseBatchFilter.value;
  const taskFilter = els.caseTaskFilter.value;
  const progressScope = state.cases.filter((item) => (
    matchesBatchFilter(item, batchFilter) && (!taskFilter || item.taskName === taskFilter)
  ));
  renderManualExecutionProgress(progressScope);

  if (els.caseBrowserCount) {
    els.caseBrowserCount.textContent = `${filtered.length} 条`;
  }

  if (!filtered.some((item) => item.id === activeExecutionCaseId)) {
    activeExecutionCaseId = filtered[0]?.id || "";
  }

  if (!filtered.length) {
    els.caseList.innerHTML = `
      <div class="empty-state compact-execution-empty">
        <strong>${state.cases.length ? "没有匹配的用例" : "还没有测试用例"}</strong>
        <p>${state.cases.length ? "请调整上方筛选条件。" : "请先生成用例或上传 CSV。"}</p>
      </div>
    `;
    els.caseExecutionWorkspace.innerHTML = `
      <div class="case-runner-empty">
        <span class="case-runner-empty-icon">✓</span>
        <strong>等待选择用例</strong>
        <p>有可执行用例后，会在这里展示步骤和执行按钮。</p>
      </div>
    `;
    return;
  }

  els.caseList.innerHTML = filtered.map((item, index) => {
    const status = item.executionStatus || "未执行";
    const tone = getManualExecutionTone(status);
    return `
      <button class="case-browser-item status-${tone} ${item.id === activeExecutionCaseId ? "is-active" : ""}" type="button" data-execution-case-id="${item.id}">
        <span class="case-browser-index">${String(index + 1).padStart(2, "0")}</span>
        <span class="case-browser-item-copy">
          <strong>${escapeHtml(item.title || "未命名用例")}</strong>
          <small>${escapeHtml(item.priority || "P2")} · ${escapeHtml(item.taskName || "未分任务")}</small>
        </span>
        <span class="case-browser-status status-${tone}">${escapeHtml(status)}</span>
      </button>
    `;
  }).join("");

  els.caseList.querySelectorAll("[data-execution-case-id]").forEach((button) => {
    button.addEventListener("click", () => {
      activeExecutionCaseId = button.dataset.executionCaseId;
      renderCases();
    });
  });

  const activeCase = filtered.find((item) => item.id === activeExecutionCaseId) || filtered[0];
  renderActiveCaseExecution(activeCase, filtered);
}

function renderManualExecutionProgress(cases) {
  const total = cases.length;
  const counts = {
    passed: cases.filter((item) => item.executionStatus === "通过").length,
    failed: cases.filter((item) => item.executionStatus === "失败").length,
    blocked: cases.filter((item) => item.executionStatus === "阻塞").length
  };
  const completed = counts.passed + counts.failed + counts.blocked;
  const pending = Math.max(0, total - completed);
  const percent = total ? Math.round((completed / total) * 100) : 0;

  els.caseProgressPercent.textContent = `${percent}%`;
  els.caseProgressSummary.textContent = `已完成 ${completed} / ${total} 条`;
  els.caseProgressBar.style.width = `${percent}%`;
  els.caseProgressStats.innerHTML = `
    <span class="progress-stat stat-passed"><i></i>通过 <strong>${counts.passed}</strong></span>
    <span class="progress-stat stat-failed"><i></i>失败 <strong>${counts.failed}</strong></span>
    <span class="progress-stat stat-blocked"><i></i>阻塞 <strong>${counts.blocked}</strong></span>
    <span class="progress-stat stat-pending"><i></i>未执行 <strong>${pending}</strong></span>
  `;
}

function renderActiveCaseExecution(item, filteredCases) {
  const status = item.executionStatus || "未执行";
  const tone = getManualExecutionTone(status);
  const currentIndex = filteredCases.findIndex((caseItem) => caseItem.id === item.id);
  const previousCase = filteredCases[currentIndex - 1];
  const nextCase = filteredCases[currentIndex + 1];

  els.caseExecutionWorkspace.innerHTML = `
    <article class="focused-case-runner status-${tone}">
      <header class="focused-case-head">
        <div>
          <div class="focused-case-eyebrow">
            <span>当前执行 · ${currentIndex + 1}/${filteredCases.length}</span>
            <span class="focused-case-status status-${tone}">${escapeHtml(status)}</span>
          </div>
          <h3>${escapeHtml(item.title || "未命名用例")}</h3>
          <div class="focused-case-meta">
            <span>${escapeHtml(item.batchVersion || "未带版本")}</span>
            <span>${escapeHtml(item.taskName || "未分任务")}</span>
            <span>${escapeHtml(item.priority || "P2")}</span>
          </div>
        </div>
        <button class="ghost-button tiny-button" type="button" data-delete-current-case>删除用例</button>
      </header>

      <div class="focused-case-content">
        <section class="execution-detail-block">
          <span>前置条件</span>
          <pre>${escapeHtml(item.preconditions || "无特殊前置条件")}</pre>
        </section>
        <section class="execution-detail-block execution-steps-block">
          <span>测试步骤</span>
          <pre>${escapeHtml(item.steps || "未填写测试步骤")}</pre>
        </section>
        <section class="execution-detail-block expected-result-block">
          <span>预期结果</span>
          <pre>${escapeHtml(item.expected || "未填写预期结果")}</pre>
        </section>
      </div>

      <label class="focused-execution-note">
        <span>执行备注</span>
        <textarea rows="3" placeholder="记录实际结果、异常现象或补充信息">${escapeHtml(item.executionNote || "")}</textarea>
      </label>

      <div class="execution-primary-actions">
        <button class="execution-start-button" type="button" data-start-execution>开始执行</button>
        <button class="execution-result-button result-pass" type="button" data-case-result="通过">通过</button>
        <button class="execution-result-button result-fail" type="button" data-case-result="失败">失败</button>
      </div>
      <div class="execution-secondary-actions">
        <button class="ghost-button" type="button" data-case-result="未执行">重置为未执行</button>
        <button class="ghost-button blocked-action" type="button" data-case-result="阻塞">标记阻塞</button>
        ${status === "失败" ? `<button class="ghost-button case-bug-action" type="button" data-current-case-to-bug>转为 BUG</button>` : ""}
      </div>

      <footer class="execution-case-navigation">
        <button class="ghost-button" type="button" data-previous-case ${previousCase ? "" : "disabled"}>上一条</button>
        <span>切换用例不会离开当前执行区域</span>
        <button class="ghost-button" type="button" data-next-case ${nextCase ? "" : "disabled"}>下一条</button>
      </footer>
    </article>
  `;

  const runner = els.caseExecutionWorkspace.querySelector(".focused-case-runner");
  els.caseExecutionWorkspace.querySelector("[data-start-execution]")?.addEventListener("click", (event) => {
    runner?.classList.add("is-running");
    event.currentTarget.textContent = "执行中";
    event.currentTarget.disabled = true;
    els.caseExecutionWorkspace.querySelector(".focused-execution-note textarea")?.focus();
    setCaseActionStatus(`正在执行「${item.title || "未命名用例"}」。完成后请选择通过或失败。`, "neutral");
  });
  els.caseExecutionWorkspace.querySelectorAll("[data-case-result]").forEach((button) => {
    button.addEventListener("click", () => setFocusedCaseResult(item, button.dataset.caseResult));
  });
  els.caseExecutionWorkspace.querySelector(".focused-execution-note textarea")?.addEventListener("input", (event) => {
    item.executionNote = event.target.value;
    Object.assign(item, applyUpdateAuditFields(item));
    persist();
  });
  els.caseExecutionWorkspace.querySelector("[data-previous-case]")?.addEventListener("click", () => {
    if (previousCase) {
      activeExecutionCaseId = previousCase.id;
      renderCases();
    }
  });
  els.caseExecutionWorkspace.querySelector("[data-next-case]")?.addEventListener("click", () => {
    if (nextCase) {
      activeExecutionCaseId = nextCase.id;
      renderCases();
    }
  });
  els.caseExecutionWorkspace.querySelector("[data-current-case-to-bug]")?.addEventListener("click", () => {
    createBugRecord(item);
    switchTab("bugs");
  });
  els.caseExecutionWorkspace.querySelector("[data-delete-current-case]")?.addEventListener("click", () => {
    if (!window.confirm(`确认删除用例“${item.title || "未命名用例"}”？`)) return;
    state.cases = state.cases.filter((caseItem) => caseItem.id !== item.id);
    activeExecutionCaseId = nextCase?.id || previousCase?.id || "";
    persist();
    renderAll();
    setCaseActionStatus("已删除当前用例。", "warn");
  });
}

function setFocusedCaseResult(item, nextStatus) {
  updateCaseExecutionState(item, nextStatus);
  persist();
  renderCases();
  renderQuickStats();
  renderReport();
  setCaseActionStatus(`已将「${item.title || "未命名用例"}」更新为“${nextStatus}”。`, nextStatus === "失败" ? "warn" : "ok");
}

function getManualExecutionTone(status) {
  if (status === "通过") return "passed";
  if (status === "失败") return "failed";
  if (status === "阻塞") return "blocked";
  return "pending";
}

function renderLegacyCases() {
  const filtered = getFilteredCasesForView();

  if (!filtered.length) {
    els.caseList.innerHTML = `
      <div class="empty-state empty-state-rich">
        <strong>${state.cases.length ? "当前筛选范围里没有匹配的测试用例" : "这里还没有测试用例"}</strong>
        <p>${state.cases.length ? "换个筛选条件试试，或者继续补充执行结果。" : "先去生成用例，或者直接上传现成 CSV。"}</p>
        ${state.cases.length ? "" : `
        <div class="empty-actions">
          <button class="primary-button" data-action="generate-cases">去生成用例</button>
        </div>
        `}
      </div>
    `;
    return;
  }

  els.caseList.innerHTML = "";
  filtered.forEach((item, index) => {
    const node = els.caseTemplate.content.firstElementChild.cloneNode(true);
    ensureCaseEditFields(node);
    const caseSequenceBadge = ensureCaseSequenceBadge(node);
    node.querySelector(".case-title-text").textContent = item.title;
    if (caseSequenceBadge) {
      caseSequenceBadge.textContent = `第 ${index + 1} 条`;
    }
    node.querySelector(".case-version").textContent = item.batchVersion || "未带版本";
    node.querySelector(".case-task").textContent = item.taskName || "未分任务";

    const statusBadge = node.querySelector(".case-status");
    const priorityBadge = node.querySelector(".case-priority");
    const executionBadge = node.querySelector(".case-execution-badge");
    const executionSelect = node.querySelector(".case-execution-select");
    const executionNote = node.querySelector(".case-execution-note");
    const titleInput = node.querySelector(".case-title-input");
    const typeInput = node.querySelector(".case-type-input");
    const prioritySelect = node.querySelector(".case-priority-select");
    const preconditionsInput = node.querySelector(".case-preconditions-full");
    const stepsInput = node.querySelector(".case-steps-full");
    const expectedInput = node.querySelector(".case-expected-full");
    const caseToBug = node.querySelector(".case-to-bug");
    const automationEnabled = node.querySelector(".case-automation-enabled");
    const automationTargetPath = node.querySelector(".case-automation-target-path");
    const automationSteps = node.querySelector(".case-automation-steps");
    const automationStatus = node.querySelector(".case-automation-status");
    const automationFeedback = node.querySelector(".case-automation-feedback");
    const automationSave = node.querySelector(".case-automation-save");
    const automationRun = node.querySelector(".case-automation-run");
    statusBadge.textContent = item.executionStatus || "未执行";
    priorityBadge.textContent = item.priority;
    applyBadgeTone(statusBadge, getExecutionStatusTone(item.executionStatus || "未执行"));
    applyBadgeTone(priorityBadge, getPriorityTone(item.priority));
    executionSelect.value = item.executionStatus || "未执行";
    syncExecutionStatusBadge(executionBadge, item.executionStatus || "未执行");
    executionNote.value = item.executionNote || "";
    if (titleInput) titleInput.value = item.title || "";
    if (typeInput) typeInput.value = item.type || "";
    if (prioritySelect) prioritySelect.value = item.priority || "P2";
    if (preconditionsInput) preconditionsInput.value = item.preconditions || "";
    if (stepsInput) stepsInput.value = item.steps || "";
    if (expectedInput) expectedInput.value = item.expected || "";
    caseToBug.classList.toggle("hidden-field", item.executionStatus !== "失败");

    node.querySelector(".case-preconditions-preview").textContent = truncateText(item.preconditions, 90);
    node.querySelector(".case-steps-preview").textContent = truncateText(item.steps, 110);
    node.querySelector(".case-automation-block")?.classList.add("hidden-field");
    automationEnabled.checked = Boolean(item.automationEnabled);
    automationTargetPath.value = item.automationTargetPath || "";
    automationSteps.value = item.automationSteps?.length ? JSON.stringify(item.automationSteps, null, 2) : "";
    syncAutomationStatusChip(automationStatus, item.automationLastRun?.status || "");
    automationFeedback.textContent = getCaseAutomationFeedbackText(item);
    automationFeedback.className = `inline-feedback ${getCaseAutomationFeedbackTone(item)}`;
    executionSelect.addEventListener("change", (event) => {
      updateCaseExecutionState(item, event.target.value);
      statusBadge.textContent = item.executionStatus;
      applyBadgeTone(statusBadge, getExecutionStatusTone(item.executionStatus));
      syncExecutionStatusBadge(executionBadge, item.executionStatus);
      caseToBug.classList.toggle("hidden-field", item.executionStatus !== "失败");
      persist();
      renderQuickStats();
      renderReport();
      setCaseActionStatus(`已将「${item.title || "未命名用例"}」更新为“${item.executionStatus}”。`, "ok");
    });

    executionNote.addEventListener("input", (event) => {
      item.executionNote = event.target.value.trim();
      Object.assign(item, applyUpdateAuditFields(item));
      persist();
    });

    const syncCaseCardPreview = () => {
      node.querySelector(".case-title-text").textContent = item.title || "未命名用例";
      node.querySelector(".case-preconditions-preview").textContent = truncateText(item.preconditions, 90);
      node.querySelector(".case-steps-preview").textContent = truncateText(item.steps, 110);
      priorityBadge.textContent = item.priority || "P2";
      applyBadgeTone(priorityBadge, getPriorityTone(item.priority || "P2"));
    };

    titleInput?.addEventListener("input", (event) => {
      item.title = event.target.value.trim() || "未命名用例";
      Object.assign(item, applyUpdateAuditFields(item));
      syncCaseCardPreview();
      persist();
    });

    typeInput?.addEventListener("input", (event) => {
      item.type = event.target.value.trim();
      Object.assign(item, applyUpdateAuditFields(item));
      persist();
    });

    prioritySelect?.addEventListener("change", (event) => {
      item.priority = event.target.value || "P2";
      Object.assign(item, applyUpdateAuditFields(item));
      syncCaseCardPreview();
      persist();
    });

    preconditionsInput?.addEventListener("input", (event) => {
      item.preconditions = event.target.value.trim();
      Object.assign(item, applyUpdateAuditFields(item));
      syncCaseCardPreview();
      persist();
    });

    stepsInput?.addEventListener("input", (event) => {
      item.steps = event.target.value.trim();
      Object.assign(item, applyUpdateAuditFields(item));
      syncCaseCardPreview();
      persist();
    });

    expectedInput?.addEventListener("input", (event) => {
      item.expected = event.target.value.trim();
      Object.assign(item, applyUpdateAuditFields(item));
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

function renderAutomationCases() {
  if (!els.automationCaseList) {
    return;
  }

  const filtered = getFilteredAutomationCasesForView();
  if (!filtered.length) {
    els.automationCaseList.innerHTML = `
      <div class="empty-state empty-state-rich">
        <strong>${state.cases.length ? "当前筛选范围里没有匹配的自动化用例" : "这里还没有测试用例"}</strong>
        <p>${state.cases.length ? "换个筛选条件试试，或者先在这里启用自动化。" : "先去生成用例，后面再为需要的用例启用自动化执行。"}</p>
      </div>
    `;
    return;
  }

  els.automationCaseList.innerHTML = "";
  filtered.forEach((item, index) => {
    const node = els.caseTemplate.content.firstElementChild.cloneNode(true);
    ensureCaseAutomationEditor(node);
    const caseSequenceBadge = ensureCaseSequenceBadge(node);
    node.querySelector(".case-title-text").textContent = item.title;
    if (caseSequenceBadge) {
      caseSequenceBadge.textContent = `第 ${index + 1} 条`;
    }
    node.querySelector(".case-version").textContent = item.batchVersion || "未带版本";
    node.querySelector(".case-task").textContent = item.taskName || "未分任务";

    const statusBadge = node.querySelector(".case-status");
    const priorityBadge = node.querySelector(".case-priority");
    const executionRow = node.querySelector(".case-execution-row");
    const executionBadge = node.querySelector(".case-execution-badge");
    const automationEnabled = node.querySelector(".case-automation-enabled");
    const automationTargetPath = node.querySelector(".case-automation-target-path");
    const automationSteps = node.querySelector(".case-automation-steps");
    const automationStepList = node.querySelector(".case-automation-step-list");
    const automationAddStep = node.querySelector(".case-automation-add-step");
    const automationQuickAdd = node.querySelector(".case-automation-quick-add");
    const automationTemplateSelect = node.querySelector(".case-automation-template-select");
    const automationApplyTemplate = node.querySelector(".case-automation-apply-template");
    const automationJsonToggle = node.querySelector(".case-automation-json-toggle");
    const automationJsonPanel = node.querySelector(".case-automation-json-panel");
    const automationStatus = node.querySelector(".case-automation-status");
    const automationFeedback = node.querySelector(".case-automation-feedback");
    const automationSave = node.querySelector(".case-automation-save");
    const automationRun = node.querySelector(".case-automation-run");

    statusBadge.textContent = item.executionStatus || "未执行";
    priorityBadge.textContent = item.priority;
    applyBadgeTone(statusBadge, getExecutionStatusTone(item.executionStatus || "未执行"));
    applyBadgeTone(priorityBadge, getPriorityTone(item.priority));
    syncExecutionStatusBadge(executionBadge, item.executionStatus || "未执行");
    if (executionRow) {
      executionRow.classList.add("hidden-field");
    }

    node.querySelector(".case-preconditions-preview").textContent = truncateText(item.preconditions, 90);
    node.querySelector(".case-steps-preview").textContent = truncateText(item.steps, 110);
    node.querySelector(".case-preconditions-full").textContent = item.preconditions || "无";
    node.querySelector(".case-steps-full").textContent = item.steps || "无";
    node.querySelector(".case-expected-full").textContent = item.expected || "无";

    automationEnabled.checked = Boolean(item.automationEnabled);
    automationTargetPath.value = item.automationTargetPath || "";
    syncAutomationStatusChip(automationStatus, item.automationLastRun?.status || "");
    automationFeedback.textContent = getCaseAutomationFeedbackText(item);
    automationFeedback.className = `inline-feedback ${getCaseAutomationFeedbackTone(item)}`;
    automationTemplateSelect.innerHTML = `<option value="">请选择一个常用模板</option>${AUTOMATION_STEP_TEMPLATES.map((template) => `<option value="${escapeHtml(template.value)}">${escapeHtml(template.label)}</option>`).join("")}`;
    if (automationQuickAdd) {
      automationQuickAdd.innerHTML = AUTOMATION_QUICK_ADD_TYPES.map((stepType) => `
        <button type="button" class="ghost-button tiny-button" data-quick-step="${escapeHtml(stepType)}">补一步：${escapeHtml(getAutomationStepTypeLabel(stepType))}</button>
      `).join("");
    }

    const editorState = {
      steps: (item.automationSteps || []).map((step) => normalizeAutomationStep(step)).filter(Boolean)
    };
    if (!editorState.steps.length) {
      editorState.steps = [];
    }

    const syncEditorJson = () => {
      automationSteps.value = editorState.steps.length ? formatAutomationStepsJson(editorState.steps) : "";
    };

    const renderStepList = () => {
      if (!automationStepList) {
        return;
      }
      if (!editorState.steps.length) {
        automationStepList.innerHTML = `
          <div class="automation-empty-state">
            <strong>先从模板开始会更快</strong>
            <p>先在上面选一个模板，系统会自动带出常用步骤，你只需要改几个字。</p>
          </div>
        `;
        syncEditorJson();
        return;
      }

      automationStepList.innerHTML = editorState.steps.map((step, index) => {
        const showLocator = shouldShowAutomationLocator(step.stepType);
        const showInput = shouldShowAutomationInput(step.stepType);
        return `
          <div class="automation-step-card" data-step-index="${index}">
            <div class="automation-step-card-head">
              <div class="automation-step-head-main">
                <strong>第 ${index + 1} 步 · ${escapeHtml(getAutomationStepTypeLabel(step.stepType))}</strong>
                <span class="automation-step-summary">${escapeHtml(getAutomationStepSummary(step))}</span>
              </div>
              <div class="automation-step-actions">
                <button type="button" class="ghost-button tiny-button" data-step-action="move-up">上移</button>
                <button type="button" class="ghost-button tiny-button" data-step-action="move-down">下移</button>
                <button type="button" class="ghost-button tiny-button" data-step-action="delete">删除</button>
              </div>
            </div>
            <p class="automation-step-hint">${escapeHtml(getAutomationQuickHint(step.stepType))}</p>
            <div class="automation-step-grid">
              <label class="automation-advanced-field hidden-field">
                步骤类型
                <select data-step-field="stepType">
                  ${AUTOMATION_STEP_TYPES.map((option) => `<option value="${escapeHtml(option.value)}"${option.value === step.stepType ? " selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
                </select>
              </label>
              <label class="automation-advanced-field hidden-field" data-advanced-visible="${showLocator ? "true" : "false"}">
                定位方式
                <select data-step-field="locatorType">
                  ${AUTOMATION_LOCATOR_TYPES.map((option) => `<option value="${escapeHtml(option.value)}"${option.value === step.locatorType ? " selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
                </select>
              </label>
              <label>
                ${escapeHtml(step.stepType === "input" ? "你要操作哪个输入框" : step.stepType === "assertText" ? "去哪里检查文字" : step.stepType === "assertElement" ? "页面上应该出现什么" : getAutomationTargetLabel(step.stepType))}
                <input type="text" data-step-field="target" value="${escapeHtml(step.target || "")}" placeholder="${escapeHtml(getAutomationSimplePlaceholder(step.stepType))}">
              </label>
              <label class="${showInput ? "" : "hidden-field"}">
                ${escapeHtml(step.stepType === "input" ? "要输入什么" : step.stepType === "assertText" ? "期望看到的文字" : getAutomationInputLabel(step.stepType))}
                <input type="text" data-step-field="inputValue" value="${escapeHtml(step.inputValue || "")}" placeholder="${step.stepType === "wait" ? "例如：1000" : step.stepType === "input" ? "例如：admin" : ""}">
              </label>
              <label class="automation-step-remark automation-advanced-field hidden-field">
                备注
                <input type="text" data-step-field="remark" value="${escapeHtml(step.remark || "")}" placeholder="可选，帮助团队理解这一步">
              </label>
            </div>
          </div>
        `;
      }).join("");
      syncEditorJson();
    };

    const rerenderEditor = () => {
      renderStepList();
      automationFeedback.textContent = getCaseAutomationFeedbackText(item);
      automationFeedback.className = `inline-feedback ${getCaseAutomationFeedbackTone(item)}`;
    };

    renderStepList();

    automationStepList?.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const field = target.dataset.stepField;
      const card = target.closest(".automation-step-card");
      const index = Number(card?.dataset.stepIndex);
      if (!field || Number.isNaN(index) || !editorState.steps[index]) {
        return;
      }
      editorState.steps[index][field] = target.value;
      syncEditorJson();
    });

    automationStepList?.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const field = target.dataset.stepField;
      const card = target.closest(".automation-step-card");
      const index = Number(card?.dataset.stepIndex);
      if (!field || Number.isNaN(index) || !editorState.steps[index]) {
        return;
      }
      editorState.steps[index][field] = target.value;
      if (field === "stepType") {
        editorState.steps[index] = normalizeAutomationStep({
          ...editorState.steps[index],
          stepType: target.value
        }) || createDefaultAutomationStep();
        renderStepList();
        return;
      }
      syncEditorJson();
    });

    automationStepList?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const action = target.dataset.stepAction;
      const card = target.closest(".automation-step-card");
      const index = Number(card?.dataset.stepIndex);
      if (!action || Number.isNaN(index) || !editorState.steps[index]) {
        return;
      }
      if (action === "delete") {
        editorState.steps.splice(index, 1);
        renderStepList();
        return;
      }
      if (action === "move-up" && index > 0) {
        const [step] = editorState.steps.splice(index, 1);
        editorState.steps.splice(index - 1, 0, step);
        renderStepList();
        return;
      }
      if (action === "move-down" && index < editorState.steps.length - 1) {
        const [step] = editorState.steps.splice(index, 1);
        editorState.steps.splice(index + 1, 0, step);
        renderStepList();
      }
    });

    automationAddStep?.addEventListener("click", () => {
      editorState.steps.push(createDefaultAutomationStep());
      renderStepList();
    });

    automationQuickAdd?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const stepType = target.dataset.quickStep;
      if (!stepType) {
        return;
      }
      editorState.steps.push(normalizeAutomationStep({
        stepType,
        locatorType: stepType === "input" ? "placeholder" : "text",
        target: "",
        inputValue: "",
        remark: ""
      }) || createDefaultAutomationStep());
      renderStepList();
    });

    automationApplyTemplate?.addEventListener("click", () => {
      const template = AUTOMATION_STEP_TEMPLATES.find((itemTemplate) => itemTemplate.value === automationTemplateSelect.value);
      if (!template) {
        automationFeedback.textContent = "先选一个模板，再点“套用这个模板”。";
        automationFeedback.className = "inline-feedback warn";
        return;
      }
      editorState.steps = template.steps.map((step) => normalizeAutomationStep(step)).filter(Boolean);
      renderStepList();
      automationFeedback.textContent = `已套用「${template.label}」模板。下一步只要把步骤里的文字改成你的页面内容，再点运行。`;
      automationFeedback.className = "inline-feedback ok";
    });

    automationJsonToggle?.addEventListener("click", () => {
      const isHidden = automationJsonPanel?.classList.contains("hidden-field");
      automationJsonPanel?.classList.toggle("hidden-field", !isHidden);
      automationJsonToggle.textContent = isHidden ? "收起 JSON" : "查看/编辑 JSON";
      node.querySelectorAll(".automation-advanced-field").forEach((field) => {
        const canShow = field.dataset.advancedVisible !== "false";
        field.classList.toggle("hidden-field", !isHidden || !canShow);
      });
      if (isHidden) {
        syncEditorJson();
      }
    });

    automationSteps.addEventListener("input", () => {
      try {
        editorState.steps = parseAutomationStepsJson(automationSteps.value);
        renderStepList();
      } catch (_error) {
        automationFeedback.textContent = "JSON 还没写完整，先继续编辑，保存时会再校验。";
        automationFeedback.className = "inline-feedback neutral";
      }
    });

    const traceMeta = node.querySelector(".case-trace-meta");
    if (traceMeta) {
      traceMeta.innerHTML = renderTraceMetaHtml(item, item.taskName || "未记录");
    }

    automationSave.addEventListener("click", async () => {
      const saved = saveCaseAutomationConfig(item, {
        enabled: automationEnabled.checked,
        targetPath: automationTargetPath.value,
        stepsText: automationSteps.value
      });
      if (!saved) {
        automationFeedback.textContent = getCaseAutomationFeedbackText(item);
        automationFeedback.className = `inline-feedback ${getCaseAutomationFeedbackTone(item)}`;
        renderAutomationCases();
        return;
      }
      flashButtonSuccess(automationSave, "保存成功");
      automationFeedback.textContent = "自动化配置已保存。";
      automationFeedback.className = "inline-feedback ok";
      setAutomationCaseStatus(`已保存「${item.title || "未命名用例"}」自动化配置。`, "ok");
      renderAutomationCases();
    });

    automationRun.addEventListener("click", async () => {
      syncEditorJson();
      const saved = saveCaseAutomationConfig(item, {
        enabled: automationEnabled.checked,
        targetPath: automationTargetPath.value,
        stepsText: automationSteps.value
      });
      if (!saved) {
        automationFeedback.textContent = getCaseAutomationFeedbackText(item);
        automationFeedback.className = `inline-feedback ${getCaseAutomationFeedbackTone(item)}`;
        renderAutomationCases();
        return;
      }

      automationFeedback.textContent = "正在执行自动化...";
      automationFeedback.className = "inline-feedback neutral";
      automationRun.disabled = true;

      try {
        const result = await runCaseAutomation(item);
        syncAutomationStatusChip(automationStatus, result.status || "");
        automationFeedback.textContent = result.summary || getCaseAutomationFeedbackText(item);
        automationFeedback.className = `inline-feedback ${getCaseAutomationFeedbackTone(item)}`;
        setAutomationCaseStatus(`已完成「${item.title || "未命名用例"}」自动化执行。`, result.status === "通过" ? "ok" : "warn");
        renderQuickStats();
        renderReport();
        renderCases();
        renderAutomationCases();
      } finally {
        automationRun.disabled = false;
      }
    });

    bindCaseCard(node, item.id);
    els.automationCaseList.appendChild(node);
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

function saveCaseAutomationConfig(item, payload) {
  const enabled = Boolean(payload.enabled);
  const targetPath = String(payload.targetPath || "").trim();
  const stepsText = String(payload.stepsText || "").trim();
  let parsedSteps = [];

  if (stepsText) {
    try {
      parsedSteps = parseAutomationStepsJson(stepsText);
    } catch (error) {
      item.automationLastRun = {
        status: "失败",
        summary: error.message || "自动化步骤不是合法 JSON，请先修正后再保存。",
        startedAt: "",
        finishedAt: new Date().toISOString()
      };
      persist();
      return false;
    }
  }

  item.automationEnabled = enabled;
  item.automationTargetPath = targetPath;
  item.automationSteps = parsedSteps.map((step) => normalizeAutomationStep(step)).filter(Boolean);
  Object.assign(item, applyUpdateAuditFields(item));
  persist();
  return true;
}

function ensureCaseEditFields(node) {
  const detailGrid = node.querySelector(".case-detail-grid");
  if (!detailGrid || detailGrid.querySelector(".case-title-input")) {
    return;
  }

  const preconditionsBlock = node.querySelector(".case-preconditions-full")?.closest(".detail-block");
  if (!preconditionsBlock) {
    return;
  }

  const titleBlock = document.createElement("div");
  titleBlock.className = "detail-block";
  titleBlock.innerHTML = `
    <label class="case-edit-field">
      <span class="summary-label">用例标题</span>
      <input class="case-title-input" type="text">
    </label>
  `;

  const typeBlock = document.createElement("div");
  typeBlock.className = "detail-block";
  typeBlock.innerHTML = `
    <label class="case-edit-field">
      <span class="summary-label">用例类型</span>
      <input class="case-type-input" type="text">
    </label>
  `;

  const priorityBlock = document.createElement("div");
  priorityBlock.className = "detail-block";
  priorityBlock.innerHTML = `
    <label class="case-edit-field">
      <span class="summary-label">优先级</span>
      <select class="case-priority-select">
        <option value="P0">P0</option>
        <option value="P1">P1</option>
        <option value="P2">P2</option>
        <option value="P3">P3</option>
      </select>
    </label>
  `;

  detailGrid.insertBefore(priorityBlock, preconditionsBlock);
  detailGrid.insertBefore(typeBlock, priorityBlock);
  detailGrid.insertBefore(titleBlock, typeBlock);

  const preconditionsField = node.querySelector(".case-preconditions-full");
  const stepsField = node.querySelector(".case-steps-full");
  const expectedField = node.querySelector(".case-expected-full");
  [preconditionsField, stepsField, expectedField].forEach((field, index) => {
    if (!field) {
      return;
    }
    const textarea = document.createElement("textarea");
    textarea.className = `${field.className} case-edit-textarea`;
    textarea.rows = index === 1 ? 6 : 4;
    textarea.value = field.textContent === "无" ? "" : field.textContent || "";
    field.replaceWith(textarea);
  });
}

function ensureCaseSequenceBadge(node) {
  const caseHead = node.querySelector(".case-card-head");
  if (!caseHead) {
    return null;
  }
  let badge = caseHead.querySelector(".case-sequence-badge");
  if (badge) {
    return badge;
  }
  badge = document.createElement("span");
  badge.className = "case-sequence-badge";
  const titleNode = caseHead.querySelector(".case-title-text");
  if (titleNode) {
    caseHead.insertBefore(badge, titleNode);
  } else {
    caseHead.appendChild(badge);
  }
  return badge;
}

async function runCaseAutomation(item) {
  if (!item.automationEnabled) {
    item.automationLastRun = {
      status: "未运行",
      summary: "请先启用这条用例的自动化执行。",
      startedAt: "",
      finishedAt: ""
    };
    persist();
    return item.automationLastRun;
  }

  if (!state.uiAutomationSettings?.baseUrl) {
    item.automationLastRun = {
      status: "失败",
      summary: "请先在页面上方填写站点地址。",
      startedAt: "",
      finishedAt: new Date().toISOString()
    };
    persist();
    return item.automationLastRun;
  }

  const response = await fetch("/api/ui-automation/run-case", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caseTitle: item.title,
      baseUrl: state.uiAutomationSettings.baseUrl,
      targetPath: item.automationTargetPath,
      steps: buildAutomationRuntimeSteps(item.automationSteps)
    })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "执行自动化失败");
  }

  const result = normalizeCaseAutomationLastRun(data.result) || {
    status: data.ok ? "通过" : "失败",
    summary: data.error || "自动化执行失败",
    startedAt: "",
    finishedAt: new Date().toISOString()
  };
  item.automationLastRun = result;
  updateCaseExecutionState(item, result.status === "通过" ? "通过" : "失败");
  item.executionNote = result.summary || item.executionNote || "";
  persist();
  setCaseActionStatus(`已完成「${item.title || "未命名用例"}」自动化执行。`, data.ok ? "ok" : "warn");
  return result;
}

function getCaseAutomationFeedbackText(item) {
  if (item.automationLastRun?.summary) {
    return item.automationLastRun.summary;
  }
  if (item.automationEnabled) {
    return "接口自动化已纳入规划，后续接入 pytest 后可保存配置并运行。";
  }
  return "启用后，可为这条用例沉淀接口路径、请求参数和断言草稿。";
}

function getCaseAutomationFeedbackTone(item) {
  const status = item.automationLastRun?.status || "";
  if (status === "通过") return "ok";
  if (status === "失败") return "warn";
  return "neutral";
}

function syncAutomationStatusChip(node, status) {
  if (!node) {
    return;
  }

  const normalizedStatus = status || "未运行";
  node.textContent = normalizedStatus;
  if (normalizedStatus === "通过") {
    node.className = "case-automation-status state-chip ok";
    return;
  }
  if (normalizedStatus === "失败") {
    node.className = "case-automation-status state-chip warn";
    return;
  }
  node.className = "case-automation-status state-chip neutral";
}

function truncateText(text, limit) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!value) {
    return "无";
  }
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function createBugRecord(sourceCase) {
  const firstCase = sourceCase?.id ? sourceCase : null;
  const linkedBug = firstCase ? state.bugs.find((item) => item.caseId === firstCase.id && !["已修复", "已验证", "已关闭"].includes(item.status)) : null;
  const duplicateBug = firstCase ? findPotentialDuplicateBug(firstCase) : null;

  if (linkedBug) {
    switchTab("bugs");
    setBugStatus("这个失败用例已经有关联的未关闭 BUG 了。", "warn");
    openBugModal(linkedBug.id, "view");
    return;
  }

  if (duplicateBug) {
    switchTab("bugs");
    setBugStatus(`疑似重复 BUG：${duplicateBug.title}。可先确认是否复用已有记录。`, "warn");
    openBugModal(duplicateBug.id, "view");
    return;
  }
  switchTab("bugs");
  openBugModal("", "create", firstCase);
}

function openBugModal(bugId = "", mode = bugId ? "view" : "create", sourceCase = null) {
  const bug = state.bugs.find((item) => item.id === bugId) || null;
  const activeTask = getTaskById(state.activeTaskId);
  const activeBatch = getBatchById(state.activeBatchId || activeTask?.batchId);
  bugModalRecordId = bug?.id || "";
  bugModalSourceCaseId = sourceCase?.id || bug?.caseId || "";

  const batchId = sourceCase?.batchId || bug?.batchId || activeBatch?.id || "";
  const taskId = sourceCase?.taskId || bug?.taskId || activeTask?.id || "";
  const caseId = sourceCase?.id || bug?.caseId || "";
  els.bugModalName.value = bug?.title || (sourceCase ? `${sourceCase.title || "未命名用例"} - 缺陷记录` : "");
  els.bugModalSeverity.value = bug?.severity || "中";
  els.bugModalStatus.value = bug?.status || "新建";
  els.bugModalLink.value = bug?.link || "";
  els.bugModalNote.value = bug?.note || buildBugNoteFromCase(sourceCase);
  clearPendingBugImages();
  bugModalExistingImages = Array.isArray(bug?.images) ? bug.images.map((image) => ({ ...image })) : [];
  bugModalRemovedImageIds = [];
  fillBugModalAssociations(batchId, taskId, caseId);
  els.bugModalTrace.innerHTML = bug ? renderTraceMetaHtml(bug) : "";
  els.bugModalFeedback.textContent = mode === "view" ? "当前为只读详情，点击“编辑 BUG”后可修改。" : "填写完整信息后保存 BUG。";
  els.bugModalFeedback.className = "inline-feedback";
  setBugModalMode(mode);
  renderBugModalImages();
  renderBugModalBadges();
  els.bugModal.classList.remove("hidden-field");
  document.body.classList.add("dialog-open");
  window.setTimeout(() => {
    if (mode === "create") els.bugModalName.focus();
  }, 0);
}

function closeBugModal() {
  els.bugModal?.classList.add("hidden-field");
  document.body.classList.remove("dialog-open");
  bugModalRecordId = "";
  bugModalSourceCaseId = "";
  clearPendingBugImages();
  bugModalExistingImages = [];
  bugModalRemovedImageIds = [];
  els.bugForm?.reset();
}

function setBugModalMode(mode) {
  const isView = mode === "view";
  const isCreate = mode === "create";
  els.bugModal.dataset.mode = mode;
  els.bugModalTitle.textContent = isCreate ? "新增 BUG" : isView ? "BUG 详情" : "编辑 BUG";
  els.bugForm.querySelectorAll("input, textarea, select").forEach((control) => {
    control.disabled = isView;
  });
  els.editBugModal.classList.toggle("hidden-field", !isView);
  els.saveBugModal.classList.toggle("hidden-field", isView);
  els.deleteBugModal.classList.toggle("hidden-field", isCreate);
  els.cancelBugModal.textContent = isView ? "关闭" : "取消";
  if (!isView) {
    els.bugModalFeedback.textContent = isCreate ? "填写完整信息后保存 BUG。" : "修改完成后点击保存。";
  }
  renderBugModalImages();
}

function handleBugNotePaste(event) {
  if (els.bugModal?.dataset.mode === "view") return;
  const imageItems = [...(event.clipboardData?.items || [])]
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"));
  if (!imageItems.length) return;

  event.preventDefault();
  const pastedText = event.clipboardData?.getData("text/plain") || "";
  if (pastedText) insertTextAtCursor(els.bugModalNote, pastedText);

  const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
  const availableSlots = Math.max(0, 10 - bugModalExistingImages.length - bugModalPendingImages.length);
  let rejectedMessage = imageItems.length > availableSlots ? "每个 BUG 最多保留 10 张图片。" : "";

  imageItems.slice(0, availableSlots).forEach((item) => {
    const file = item.getAsFile();
    if (!file) return;
    if (!allowedTypes.has(file.type)) {
      rejectedMessage = "仅支持 PNG、JPG 和 WebP 图片。";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      rejectedMessage = "单张图片不能超过 5MB。";
      return;
    }
    bugModalPendingImages.push({
      id: `pending-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file)
    });
  });

  renderBugModalImages();
  els.bugModalPasteHint.textContent = rejectedMessage || `已粘贴 ${bugModalPendingImages.length} 张新图片，保存 BUG 后生效。`;
  els.bugModalPasteHint.classList.toggle("warn", Boolean(rejectedMessage));
}

function insertTextAtCursor(textarea, text) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? start;
  textarea.value = `${textarea.value.slice(0, start)}${text}${textarea.value.slice(end)}`;
  const nextPosition = start + text.length;
  textarea.setSelectionRange(nextPosition, nextPosition);
}

function renderBugModalImages() {
  if (!els.bugModalImagePreview) return;
  const isView = els.bugModal?.dataset.mode === "view";
  const existingHtml = bugModalExistingImages.map((image) => renderBugImageCard(image, image.url, isView, false)).join("");
  const pendingHtml = bugModalPendingImages.map((image) => renderBugImageCard(image, image.previewUrl, isView, true)).join("");
  els.bugModalImagePreview.innerHTML = `${existingHtml}${pendingHtml}`;
  els.bugModalImagePreview.classList.toggle("has-images", Boolean(existingHtml || pendingHtml));
  if (els.bugModalPasteHint) {
    els.bugModalPasteHint.classList.remove("warn");
    els.bugModalPasteHint.textContent = isView
      ? (existingHtml ? `共 ${bugModalExistingImages.length} 张问题截图，点击图片可查看原图。` : "当前 BUG 没有问题截图。")
      : "支持 PNG、JPG、WebP，单张不超过 5MB，最多 10 张。";
  }
}

function renderBugImageCard(image, source, isView, isPending) {
  const removeButton = isView ? "" : `<button type="button" data-remove-bug-image="${escapeHtml(image.id)}" data-pending="${isPending}">移除</button>`;
  return `
    <figure class="bug-note-image-card">
      <a href="${escapeHtml(source)}" target="_blank" rel="noopener" title="查看原图">
        <img src="${escapeHtml(source)}" alt="${escapeHtml(image.fileName || "BUG 截图")}">
      </a>
      <figcaption><span>${escapeHtml(image.fileName || "粘贴的截图")}</span>${removeButton}</figcaption>
    </figure>
  `;
}

function handleBugImagePreviewClick(event) {
  const button = event.target.closest("[data-remove-bug-image]");
  if (!button) return;
  const imageId = button.dataset.removeBugImage;
  if (button.dataset.pending === "true") {
    const pendingImage = bugModalPendingImages.find((image) => image.id === imageId);
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    bugModalPendingImages = bugModalPendingImages.filter((image) => image.id !== imageId);
  } else {
    bugModalExistingImages = bugModalExistingImages.filter((image) => image.id !== imageId);
    bugModalRemovedImageIds.push(imageId);
  }
  renderBugModalImages();
}

function clearPendingBugImages() {
  bugModalPendingImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  bugModalPendingImages = [];
}

async function uploadBugImage(bugId, pendingImage) {
  const response = await fetch(`/api/bug-images?bugId=${encodeURIComponent(bugId)}`, {
    method: "POST",
    headers: {
      "Content-Type": pendingImage.file.type,
      "X-File-Name": encodeURIComponent(pendingImage.file.name || "粘贴的截图")
    },
    body: pendingImage.file
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "图片保存失败");
  return result.image;
}

async function deleteBugImage(bugId, imageId) {
  await fetch(`/api/bug-images/${encodeURIComponent(bugId)}/${encodeURIComponent(imageId)}`, { method: "DELETE" });
}

function fillBugModalAssociations(batchId = "", taskId = "", caseId = "") {
  const batches = state.batches.filter((batch) => !batch.systemManaged);
  els.bugModalBatch.innerHTML = [`<option value="">未关联版本</option>`]
    .concat(batches.map((batch) => `<option value="${batch.id}">${escapeHtml(batch.version || "未命名版本")}</option>`))
    .join("");
  const resolvedBatchId = batches.some((batch) => batch.id === batchId) ? batchId : "";
  els.bugModalBatch.value = resolvedBatchId;

  const tasks = state.tasks.filter((task) => !resolvedBatchId || task.batchId === resolvedBatchId);
  els.bugModalTask.innerHTML = [`<option value="">未关联任务</option>`]
    .concat(tasks.map((task) => `<option value="${task.id}">${escapeHtml(task.name || "未命名任务")}</option>`))
    .join("");
  els.bugModalTask.value = tasks.some((task) => task.id === taskId) ? taskId : "";

  const cases = state.cases.filter((item) => (
    (!resolvedBatchId || item.batchId === resolvedBatchId) && (!taskId || item.taskId === taskId)
  ));
  els.bugModalCase.innerHTML = [`<option value="">未关联用例</option>`]
    .concat(cases.map((item) => `<option value="${item.id}">${escapeHtml(item.title || "未命名用例")}</option>`))
    .join("");
  els.bugModalCase.value = cases.some((item) => item.id === caseId) ? caseId : "";
}

function refreshBugModalAssociations(source) {
  const batchId = els.bugModalBatch.value;
  const taskId = source === "batch" ? "" : els.bugModalTask.value;
  fillBugModalAssociations(batchId, taskId, "");
}

function syncBugModalFromCase() {
  const linkedCase = state.cases.find((item) => item.id === els.bugModalCase.value);
  if (!linkedCase) return;
  fillBugModalAssociations(linkedCase.batchId || "", linkedCase.taskId || "", linkedCase.id);
}

function renderBugModalBadges() {
  if (!els.bugModalBadges) return;
  els.bugModalBadges.innerHTML = `
    <span class="bug-modal-severity severity-${getBugSeverityClass(els.bugModalSeverity.value)}">${escapeHtml(els.bugModalSeverity.value || "中")}</span>
    <span class="bug-modal-status status-${getBugStatusClass(els.bugModalStatus.value)}">${escapeHtml(els.bugModalStatus.value || "新建")}</span>
  `;
}

function getBugSeverityClass(severity) {
  if (severity === "严重") return "critical";
  if (severity === "低") return "low";
  return "medium";
}

function getBugStatusClass(status) {
  if (["已验证", "已关闭"].includes(status)) return "done";
  if (["已修复", "待回归"].includes(status)) return "progress";
  return "open";
}

function getNextBugTransition(status) {
  const transitions = {
    "新建": { status: "已提交", label: "提交 BUG" },
    "已提交": { status: "已修复", label: "标记已修复" },
    "已修复": { status: "待回归", label: "提交回归" },
    "待回归": { status: "已验证", label: "验证通过" },
    "已验证": { status: "已关闭", label: "关闭 BUG" }
  };
  return transitions[status] || null;
}

function isBugCompletedStatus(status) {
  return ["已验证", "已关闭"].includes(status);
}

async function saveBugFromModal(event) {
  event.preventDefault();
  const title = els.bugModalName.value.trim();
  if (!title) {
    els.bugModalFeedback.textContent = "请先填写 BUG 名称。";
    els.bugModalFeedback.className = "inline-feedback warn";
    els.bugModalName.focus();
    return;
  }

  const existingBug = state.bugs.find((item) => item.id === bugModalRecordId);
  const linkedCase = state.cases.find((item) => item.id === els.bugModalCase.value);
  const batch = getBatchById(linkedCase?.batchId || els.bugModalBatch.value);
  const task = getTaskById(linkedCase?.taskId || els.bugModalTask.value);
  const previousStatus = existingBug?.status || "";
  const bugId = existingBug?.id || `bug-${Date.now()}`;
  const uploadedImages = [];
  els.saveBugModal.disabled = true;
  els.bugModalFeedback.textContent = bugModalPendingImages.length ? "正在保存文字和粘贴的图片..." : "正在保存 BUG...";
  try {
    for (const pendingImage of bugModalPendingImages) {
      uploadedImages.push(await uploadBugImage(bugId, pendingImage));
    }
  } catch (error) {
    await Promise.all(uploadedImages.map((image) => deleteBugImage(bugId, image.id)));
    els.saveBugModal.disabled = false;
    els.bugModalFeedback.textContent = error.message || "图片保存失败，请重试。";
    els.bugModalFeedback.className = "inline-feedback warn";
    return;
  }

  const nextBug = {
    ...(existingBug || {}),
    id: bugId,
    title,
    severity: els.bugModalSeverity.value,
    status: els.bugModalStatus.value,
    batchId: batch?.id || "",
    batchVersion: batch?.version || "",
    batchName: batch ? formatBatchLabel(batch) : "",
    taskId: task?.id || "",
    taskName: task?.name || "",
    caseId: linkedCase?.id || "",
    owner: existingBug?.owner || "",
    link: els.bugModalLink.value.trim(),
    note: els.bugModalNote.value.trim(),
    images: [...bugModalExistingImages, ...uploadedImages]
  };
  nextBug.completedAt = isBugCompletedStatus(nextBug.status)
    ? (existingBug?.completedAt || nowIsoString())
    : "";
  const auditedBug = existingBug ? applyUpdateAuditFields(nextBug) : applyCreateAuditFields(nextBug);
  const duplicateBug = findPotentialDuplicateBug(auditedBug, existingBug?.id || "");

  if (existingBug) {
    state.bugs = state.bugs.map((item) => (item.id === existingBug.id ? auditedBug : item));
  } else {
    state.bugs.unshift(auditedBug);
  }
  if (auditedBug.status !== previousStatus || auditedBug.caseId) {
    syncLinkedCaseByBug(auditedBug, isBugCompletedStatus(auditedBug.status) ? "verified" : auditedBug.status === "待回归" ? "pending-regression" : "open");
  }
  persist();
  Promise.all(bugModalRemovedImageIds.map((imageId) => deleteBugImage(bugId, imageId))).catch(() => {});
  els.saveBugModal.disabled = false;
  closeBugModal();
  renderAll();
  setBugStatus(duplicateBug ? `BUG 已保存，但疑似与“${duplicateBug.title}”重复。` : "BUG 已保存。", duplicateBug ? "warn" : "ok");
}

function deleteBugFromModal() {
  const bug = state.bugs.find((item) => item.id === bugModalRecordId);
  if (!bug || !window.confirm(`确认删除 BUG“${bug.title || "未命名 BUG"}”？`)) return;
  state.bugs = state.bugs.filter((item) => item.id !== bug.id);
  fetch(`/api/bug-images?bugId=${encodeURIComponent(bug.id)}`, { method: "DELETE" }).catch(() => {});
  persist();
  closeBugModal();
  renderAll();
  setBugStatus("BUG 已删除。", "warn");
}

function buildBugNoteFromCase(caseItem) {
  if (!caseItem) {
    return "";
  }
  return [
    caseItem.batchVersion ? `关联版本：${caseItem.batchVersion}` : "",
    caseItem.taskName ? `关联任务：${caseItem.taskName}` : "",
    `关联用例：${caseItem.title || "未命名用例"}`,
    `执行状态：${caseItem.executionStatus || "未执行"}`,
    caseItem.executionNote ? `执行备注：${caseItem.executionNote}` : "",
    caseItem.preconditions ? `前置条件：${caseItem.preconditions}` : "",
    caseItem.steps ? `测试步骤：${caseItem.steps}` : "",
    caseItem.expected ? `预期结果：${caseItem.expected}` : ""
  ].filter(Boolean).join("\n");
}

function findPotentialDuplicateBug(sourceCase, excludeBugId = "") {
  if (!sourceCase) {
    return null;
  }

  const normalizedTitle = normalizeBugCompareText(sourceCase.title);
  const sourceCaseId = sourceCase.caseId || sourceCase.id || "";
  return state.bugs.find((item) => {
    if (excludeBugId && item.id === excludeBugId) {
      return false;
    }
    if (["已验证", "已关闭"].includes(item.status)) {
      return false;
    }
    if (sourceCaseId && item.caseId && item.caseId === sourceCaseId) {
      return true;
    }
    const sameTask = !sourceCase.taskId || !item.taskId || sourceCase.taskId === item.taskId;
    const sameBatch = !sourceCase.batchId || !item.batchId || sourceCase.batchId === item.batchId;
    if (!sameTask && !sameBatch) {
      return false;
    }
    if (!normalizedTitle) {
      return false;
    }
    const itemTitle = normalizeBugCompareText(item.title);
    if (!itemTitle) {
      return false;
    }
    return itemTitle.includes(normalizedTitle) || normalizedTitle.includes(itemTitle);
  }) || null;
}

function normalizeBugCompareText(value) {
  return String(value || "").replace(/\s+/g, "").trim().toLowerCase();
}

function renderBugs() {
  const filteredBugs = getFilteredBugs();
  if (els.bugManagerCount) {
    els.bugManagerCount.textContent = `${filteredBugs.length} 个 BUG`;
  }

  if (!filteredBugs.length) {
    els.bugList.innerHTML = `
      <div class="empty-state empty-state-rich">
        <strong>${state.bugs.length ? "没有匹配的 BUG" : "当前还没有 BUG 记录"}</strong>
        <p>${state.bugs.length ? "请调整顶部筛选条件。" : "点击右上角“新增 BUG”，通过弹窗录入问题。"}</p>
        ${state.bugs.length ? "" : `<div class="empty-actions"><button class="primary-button" type="button" data-open-bug-modal>新增 BUG</button></div>`}
      </div>
    `;
    els.bugList.querySelector("[data-open-bug-modal]")?.addEventListener("click", () => openBugModal());
    return;
  }

  els.bugList.innerHTML = `
    <div class="bug-management-table-wrap">
      <table class="bug-management-table">
        <thead>
          <tr>
            <th>BUG 标题</th>
            <th>严重程度</th>
            <th>创建时间</th>
            <th>完成时间</th>
            <th>当前状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${filteredBugs.map((bug) => {
            const transition = getNextBugTransition(bug.status || "新建");
            return `
              <tr>
                <td class="bug-table-title-cell">
                  <strong class="bug-table-title-text">${escapeHtml(bug.title || "未命名 BUG")}</strong>
                </td>
                <td><span class="badge ${getBugSeverityTone(bug.severity)}">${escapeHtml(bug.severity || "中")}</span></td>
                <td class="bug-table-time">${escapeHtml(formatAuditTime(bug.createdAt))}</td>
                <td class="bug-table-time">${escapeHtml(bug.completedAt ? formatAuditTime(bug.completedAt) : "未完成")}</td>
                <td><span class="badge ${getBugStatusTone(bug.status)}">${escapeHtml(bug.status || "新建")}</span></td>
                <td>
                  <div class="bug-table-actions">
                    ${transition ? `<button class="primary-button bug-transition-button" type="button" data-transition-bug-id="${bug.id}">${escapeHtml(transition.label)}</button>` : `<span class="bug-flow-complete">流程已完成</span>`}
                    <button class="ghost-button" type="button" data-view-bug-id="${bug.id}">查看详情</button>
                  </div>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;

  els.bugList.querySelectorAll("[data-view-bug-id]").forEach((button) => {
    button.addEventListener("click", () => openBugModal(button.dataset.viewBugId, "view"));
  });
  els.bugList.querySelectorAll("[data-transition-bug-id]").forEach((button) => {
    button.addEventListener("click", () => transitionBugStatus(button.dataset.transitionBugId));
  });
}

function transitionBugStatus(bugId) {
  const bug = state.bugs.find((item) => item.id === bugId);
  const transition = getNextBugTransition(bug?.status || "新建");
  if (!bug || !transition) return;

  const nextBug = applyUpdateAuditFields({
    ...bug,
    status: transition.status,
    completedAt: isBugCompletedStatus(transition.status) ? (bug.completedAt || nowIsoString()) : ""
  });
  state.bugs = state.bugs.map((item) => (item.id === bug.id ? nextBug : item));
  syncLinkedCaseByBug(nextBug, isBugCompletedStatus(nextBug.status) ? "verified" : nextBug.status === "待回归" ? "pending-regression" : "open");
  persist();
  renderAll();
  setBugStatus(`BUG 已流转为“${transition.status}”。`, "ok");
}

function renderLegacyBugs() {
  const filteredBugs = getFilteredBugs();
  renderBugHistory();
  if (els.bugManagerCount) {
    els.bugManagerCount.textContent = `${filteredBugs.length} 个 BUG`;
  }
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
    ensureBugBatchField(node);
    ensureBugTaskField(node);
    const detail = node.querySelector(".bug-detail");
    const detailToggle = node.querySelector(".toggle-bug-detail");
    const saveButton = node.querySelector(".save-bug");
    node.querySelector(".bug-title").value = bug.title;
    fillBugBatchOptions(node.querySelector(".bug-batch"), bug.batchId);
    fillBugTaskOptions(node.querySelector(".bug-task"), bug.taskId, bug.batchId);
    fillCaseOptions(node.querySelector(".bug-case"), bug.caseId, bug.batchId, bug.taskId);
    syncBugLinkedInfo(node, bug);
    node.querySelector(".bug-severity").value = bug.severity;
    node.querySelector(".bug-status").value = bug.status;
    syncBugBadges(node, bug.severity, bug.status);
    syncBugSourceBadge(node, bug);
    fillOwnerSelect(node.querySelector(".bug-owner"), bug.owner, "未选择");
    node.querySelector(".bug-link").value = bug.link;
    node.querySelector(".bug-note").value = bug.note;
    const bugTraceMeta = node.querySelector(".bug-trace-meta");
    if (bugTraceMeta) {
      bugTraceMeta.innerHTML = renderTraceMetaHtml(bug, bug.owner || "未记录");
    }
    const regressionButton = node.querySelector(".mark-bug-regression");
    const verifyButton = node.querySelector(".mark-bug-verified");
    regressionButton.classList.toggle("hidden-field", bug.status !== "已修复");
    verifyButton.classList.toggle("hidden-field", !["待回归", "已修复"].includes(bug.status));
    if (bug.id === activeBugEditorId) {
      detail.classList.remove("hidden-field");
      detailToggle.textContent = "收起详情";
    }

    detailToggle.addEventListener("click", () => {
      const isHidden = detail.classList.contains("hidden-field");
      detail.classList.toggle("hidden-field", !isHidden);
      detailToggle.textContent = isHidden ? "收起详情" : "展开详情";
      activeBugEditorId = isHidden ? bug.id : "";
    });

    node.querySelectorAll("input, textarea, select").forEach((control) => {
      control.addEventListener("input", () => markBugCardDirty(node));
      control.addEventListener("change", () => {
        if (control.classList.contains("bug-batch")) {
          const selectedBatchId = control.value || "";
          const taskSelect = node.querySelector(".bug-task");
          const caseSelect = node.querySelector(".bug-case");
          fillBugTaskOptions(taskSelect, "", selectedBatchId);
          fillCaseOptions(caseSelect, "", selectedBatchId, "");
          syncBugLinkedInfo(node, {
            ...getBugDraftFromNode(node, bug),
            batchId: selectedBatchId,
            taskId: "",
            caseId: ""
          });
        }
        if (control.classList.contains("bug-task")) {
          const selectedBatchId = node.querySelector(".bug-batch")?.value || "";
          const selectedTaskId = control.value || "";
          const caseSelect = node.querySelector(".bug-case");
          fillCaseOptions(caseSelect, "", selectedBatchId, selectedTaskId);
          syncBugLinkedInfo(node, {
            ...getBugDraftFromNode(node, bug),
            batchId: selectedBatchId,
            taskId: selectedTaskId,
            caseId: ""
          });
        }
        if (control.classList.contains("bug-case")) {
          syncBugLinkedInfo(node, getBugDraftFromNode(node, bug));
        }
        if (control.classList.contains("bug-severity") || control.classList.contains("bug-status")) {
          syncBugBadges(
            node,
            node.querySelector(".bug-severity")?.value || bug.severity,
            node.querySelector(".bug-status")?.value || bug.status
          );
        }
        markBugCardDirty(node);
      });
    });

    saveButton.addEventListener("click", () => {
      updateBugFromNode(node, bug.id);
      markBugCardSaved(node);
      detail.classList.add("hidden-field");
      detailToggle.textContent = "展开详情";
      activeBugEditorId = "";
      renderBugHistory();
      setBugStatus("BUG 已保存。", "ok");
      flashButtonSuccess(saveButton, "保存成功");
    });

    regressionButton.addEventListener("click", () => {
      bug.status = "待回归";
      Object.assign(bug, applyUpdateAuditFields(bug));
      syncLinkedCaseByBug(bug, "pending-regression");
      persist();
      renderAll();
      setBugStatus("BUG 已标记为待回归。", "ok");
    });

    verifyButton.addEventListener("click", () => {
      bug.status = "已验证";
      Object.assign(bug, applyUpdateAuditFields(bug));
      syncLinkedCaseByBug(bug, "verified");
      persist();
      renderAll();
      setBugStatus("BUG 已标记为回归通过，关联用例已更新为通过。", "ok");
    });

    node.querySelector(".delete-bug").addEventListener("click", () => {
      if (!confirm(`确认删除 BUG「${bug.title || "未命名BUG"}」吗？删除后无法撤销。`)) {
        return;
      }
      state.bugs = state.bugs.filter((item) => item.id !== bug.id);
      if (activeBugEditorId === bug.id) activeBugEditorId = "";
      persist();
      renderAll();
      setBugStatus("BUG 已删除。", "warn");
    });

    els.bugList.appendChild(node);
  });
}

function renderBugHistory() {
  if (!els.bugHistoryList) {
    return;
  }
  const recentBugs = [...state.bugs]
    .sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")))
    .slice(0, 6);

  if (!recentBugs.length) {
    els.bugHistoryList.innerHTML = `
      <div class="bug-history-empty">
        <strong>暂无活动记录</strong>
        <p>新增或更新 BUG 后，最近活动会展示在这里。</p>
      </div>
    `;
    return;
  }

  els.bugHistoryList.innerHTML = recentBugs.map((bug) => `
    <article class="bug-history-item">
      <span class="bug-history-dot tone-${getBugHistoryTone(bug.status)}"></span>
      <div>
        <strong>${escapeHtml(bug.title || "未命名 BUG")}</strong>
        <p>${escapeHtml(bug.batchVersion || "未关联版本")} · ${escapeHtml(bug.taskName || "未关联任务")}</p>
      </div>
      <span class="bug-history-status">${escapeHtml(bug.status || "新建")}</span>
      <time>${escapeHtml(formatAuditTime(bug.updatedAt || bug.createdAt))}</time>
    </article>
  `).join("");
}

function getBugHistoryTone(status) {
  if (["已验证", "已关闭"].includes(status)) return "green";
  if (["已修复", "待回归"].includes(status)) return "orange";
  return "red";
}

function markBugCardDirty(node) {
  node.classList.add("is-dirty");
  const saveState = node.querySelector(".bug-save-state");
  if (saveState) {
    saveState.textContent = "未保存";
  }
}

function markBugCardSaved(node) {
  node.classList.remove("is-dirty");
  const saveState = node.querySelector(".bug-save-state");
  if (saveState) {
    saveState.textContent = "已保存";
  }
}

function ensureBugBatchField(node) {
  const caseRow = node.querySelector(".bug-row-grid");
  const caseLabel = node.querySelector(".bug-case")?.closest("label");
  node.querySelector(".bug-linked-info")?.remove();
  if (!caseRow || !caseLabel || caseRow.querySelector(".bug-batch")) {
    return;
  }

  const batchLabel = document.createElement("label");
  batchLabel.innerHTML = `
    <span>关联版本</span>
    <select class="bug-batch"></select>
  `;
  caseRow.insertBefore(batchLabel, caseLabel);
}

function ensureBugTaskField(node) {
  const caseRow = node.querySelector(".bug-row-grid");
  const caseLabel = node.querySelector(".bug-case")?.closest("label");
  if (!caseRow || !caseLabel || caseRow.querySelector(".bug-task")) {
    return;
  }

  const taskLabel = document.createElement("label");
  taskLabel.innerHTML = `
    <span>关联任务</span>
    <select class="bug-task"></select>
  `;
  caseRow.insertBefore(taskLabel, caseLabel);
}

function fillBugBatchOptions(select, selectedBatchId) {
  if (!select) {
    return;
  }
  const options = [`<option value="">未关联</option>`]
    .concat(buildCaseBatchFilterOptions("bugs").map((item) => `<option value="${item.id}">${escapeHtml(formatTaskBatchLabel(item))}</option>`));
  select.innerHTML = options.join("");
  const availableIds = buildCaseBatchFilterOptions("bugs").map((item) => item.id);
  select.value = selectedBatchId && availableIds.includes(selectedBatchId) ? selectedBatchId : "";
}

function fillBugTaskOptions(select, selectedTaskId, batchId = "") {
  if (!select) {
    return;
  }
  const tasks = getTaskOptionsByBatchForEditor(batchId, "bugs");
  select.innerHTML = [`<option value="">未关联</option>`]
    .concat(tasks.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`))
    .join("");
  const hasSelected = tasks.some((item) => item.id === selectedTaskId);
  select.value = hasSelected ? selectedTaskId : "";
}

function fillCaseOptions(select, selectedId, batchId = "", taskId = "") {
  const cases = state.cases.filter((item) => matchesBatchFilter(item, batchId) && (!taskId || item.taskId === taskId || item.taskName === taskId));
  select.innerHTML = [`<option value="">未关联</option>`]
    .concat(cases.map((item) => `<option value="${item.id}">${escapeHtml(item.title)}</option>`))
    .join("");
  const hasSelected = cases.some((item) => item.id === selectedId);
  select.value = hasSelected ? selectedId : "";
}

function syncBugLinkedInfo(node, bug) {
  if (!node.querySelector(".bug-linked-version") && !node.querySelector(".bug-linked-meta")) {
    return;
  }
  const caseId = node.querySelector(".bug-case")?.value || bug.caseId;
  const batchId = node.querySelector(".bug-batch")?.value || bug.batchId;
  const taskId = node.querySelector(".bug-task")?.value || bug.taskId;
  const linkedCase = state.cases.find((caseItem) => caseItem.id === caseId);
  const batch = linkedCase ? getBatchById(linkedCase.batchId) : getBatchById(batchId);
  const task = linkedCase ? getTaskById(linkedCase.taskId) : getTaskById(taskId);
  const versionText = linkedCase?.batchVersion || batch?.version || bug.batchVersion || "未关联版本";
  const taskText = linkedCase?.taskName || task?.name || bug.taskName || "未关联任务";

  const versionNode = node.querySelector(".bug-linked-version");
  const metaNode = node.querySelector(".bug-linked-meta");
  if (versionNode) {
    versionNode.textContent = versionText;
  }
  if (metaNode) {
    metaNode.textContent = `任务：${taskText}`;
  }
}

function getBugDraftFromNode(node, fallbackBug) {
  return {
    ...fallbackBug,
    batchId: node.querySelector(".bug-batch")?.value || fallbackBug.batchId || "",
    taskId: node.querySelector(".bug-task")?.value || fallbackBug.taskId || "",
    caseId: node.querySelector(".bug-case")?.value || ""
  };
}

function updateBugFromNode(node, bugId) {
  const item = state.bugs.find((bug) => bug.id === bugId);
  if (!item) {
    return;
  }

  const previousStatus = item.status;

  item.title = node.querySelector(".bug-title").value.trim() || "未命名BUG";
  item.batchId = node.querySelector(".bug-batch")?.value || item.batchId;
  item.taskId = node.querySelector(".bug-task")?.value || item.taskId;
  item.caseId = node.querySelector(".bug-case").value;
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
    }
  } else if (item.batchId) {
    const batch = getBatchById(item.batchId);
    if (batch) {
      item.batchVersion = batch.version || item.batchVersion;
      item.batchName = formatBatchLabel(batch);
    }
  }

  if (item.taskId) {
    item.taskName = getTaskNameById(item.taskId) || node.querySelector(".bug-task")?.selectedOptions?.[0]?.textContent?.trim() || item.taskName;
  } else if (!item.caseId) {
    item.taskName = "";
  }
  Object.assign(item, applyUpdateAuditFields(item));

  const duplicateBug = findPotentialDuplicateBug({
    caseId: item.caseId,
    taskId: item.taskId,
    batchId: item.batchId,
    title: item.title
  }, item.id);

  if (duplicateBug) {
    setBugStatus(`已保存，但疑似与 BUG「${duplicateBug.title}」重复，请确认是否需要合并。`, "warn");
  }

  if (item.status !== previousStatus || item.caseId) {
    syncLinkedCaseByBug(item, isBugCompletedStatus(item.status) ? "verified" : item.status === "待回归" ? "pending-regression" : "open");
  }

  syncBugBadges(node, item.severity, item.status);
  syncBugSourceBadge(node, item);
  syncBugLinkedInfo(node, item);
  const bugTraceMeta = node.querySelector(".bug-trace-meta");
  if (bugTraceMeta) {
    bugTraceMeta.innerHTML = renderTraceMetaHtml(item, item.owner || "未记录");
  }
  node.querySelector(".mark-bug-regression").classList.toggle("hidden-field", item.status !== "已修复");
  node.querySelector(".mark-bug-verified").classList.toggle("hidden-field", !["待回归", "已修复"].includes(item.status));
  persist();
  renderQuickStats();
  renderReport();
}

function syncLinkedCaseByBug(bug, mode) {
  if (!bug?.caseId) {
    return;
  }

  const linkedCase = state.cases.find((item) => item.id === bug.caseId);
  if (!linkedCase) {
    return;
  }

  if (mode === "verified") {
    linkedCase.executionStatus = "通过";
    linkedCase.executionNote = appendExecutionNote(linkedCase.executionNote, `关联BUG已回归通过：${bug.title || "未命名BUG"}`);
    return;
  }

  linkedCase.executionStatus = "失败";

  if (mode === "pending-regression") {
    linkedCase.executionNote = appendExecutionNote(linkedCase.executionNote, `关联BUG待回归：${bug.title || "未命名BUG"}`);
    return;
  }

  if (["新建", "已提交", "已修复"].includes(bug.status)) {
    linkedCase.executionNote = appendExecutionNote(linkedCase.executionNote, `关联BUG跟进中：${bug.title || "未命名BUG"}（${bug.status}）`);
  }
}

function appendExecutionNote(original, extra) {
  const base = String(original || "").trim();
  const next = String(extra || "").trim();
  if (!next) {
    return base;
  }
  if (!base) {
    return next;
  }
  if (base.includes(next)) {
    return base;
  }
  return `${base}\n${next}`;
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
  const searchText = String(els.reportVersionSearch?.value || "").trim().toLowerCase();
  const statusFilter = els.reportVersionStatusFilter?.value || "";
  const releaseFilter = els.reportReleaseFilter?.value || "";
  const filteredCards = versionCards.filter(({ batch, report }) => {
    const matchesSearch = !searchText || String(batch.version || "").toLowerCase().includes(searchText);
    const matchesStatus = !statusFilter || (batch.status || "进行中") === statusFilter;
    const matchesRelease = !releaseFilter || report.releaseDecision.label === releaseFilter;
    return matchesSearch && matchesStatus && matchesRelease;
  });
  const totalPages = Math.max(1, Math.ceil(filteredCards.length / REPORT_VERSIONS_PER_PAGE));
  reportVersionPage = Math.min(Math.max(1, reportVersionPage), totalPages);
  const pageStart = (reportVersionPage - 1) * REPORT_VERSIONS_PER_PAGE;
  const pageCards = filteredCards.slice(pageStart, pageStart + REPORT_VERSIONS_PER_PAGE);
  const requestedActiveBatchId = state.activeReportBatchId || versionCards[0]?.batch.id || "";
  const activeCard = pageCards.find((item) => item.batch.id === requestedActiveBatchId)
    || pageCards[0]
    || versionCards.find((item) => item.batch.id === requestedActiveBatchId)
    || versionCards[0];

  if (els.reportVersionCount) {
    els.reportVersionCount.textContent = filteredCards.length === versionCards.length
      ? `${versionCards.length} 个版本`
      : `显示 ${filteredCards.length} / ${versionCards.length}`;
  }
  if (els.reportVersionPagination) {
    els.reportVersionPagination.classList.toggle("hidden-field", filteredCards.length <= REPORT_VERSIONS_PER_PAGE);
    els.reportVersionPrev.disabled = reportVersionPage <= 1;
    els.reportVersionNext.disabled = reportVersionPage >= totalPages;
    els.reportVersionPageInfo.textContent = `第 ${reportVersionPage} / ${totalPages} 页`;
  }

  if (els.reportVersionCards) {
    els.reportVersionCards.innerHTML = filteredCards.length
      ? `
        <div class="report-table-wrap">
          <table class="report-version-table">
            <thead>
              <tr>
                <th>版本号</th>
                <th>版本状态</th>
                <th>任务数</th>
                <th>用例总数</th>
                <th>执行进度</th>
                <th>通过率</th>
                <th>失败</th>
                <th>待跟进 BUG</th>
                <th>发布结论</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${pageCards.map(({ batch, report }) => {
                const isActive = batch.id === activeCard?.batch.id;
                return `
                  <tr class="${isActive ? "active" : ""}">
                    <td><strong class="report-version-name">${escapeHtml(batch.version || "未命名版本")}</strong></td>
                    <td><span class="badge subtle">${escapeHtml(batch.status || "进行中")}</span></td>
                    <td>${report.versionTaskCount}</td>
                    <td>${report.total}</td>
                    <td><strong>${report.executed}</strong><span class="report-table-muted"> / ${report.total} (${escapeHtml(report.executionRate)})</span></td>
                    <td><strong class="report-pass-rate">${escapeHtml(report.passRate)}</strong></td>
                    <td><span class="report-count ${report.statusCounts["失败"] ? "danger" : ""}">${report.statusCounts["失败"] || 0}</span></td>
                    <td><span class="report-count ${report.openBugs ? "warning" : ""}">${report.openBugs}</span></td>
                    <td><span class="badge ${report.releaseDecision.tone}">${escapeHtml(report.releaseDecision.label)}</span></td>
                    <td>
                      <button class="${isActive ? "ghost-button" : "primary-button"} report-view-button" type="button" data-report-batch-id="${batch.id}" ${isActive ? "disabled" : ""}>${isActive ? "当前查看" : "查看报告"}</button>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `
      : `
        <div class="empty-state empty-state-rich">
          <strong>${versionCards.length ? "没有匹配的版本报告" : "还没有可查看的版本报告"}</strong>
          <p>${versionCards.length ? "请调整搜索内容或筛选条件。" : "先创建版本、任务并导入测试用例，这里就会自动生成版本报告。"}</p>
        </div>
      `;

    els.reportVersionCards.querySelectorAll("button[data-report-batch-id]").forEach((button) => {
      button.addEventListener("click", () => {
        state.activeReportBatchId = button.dataset.reportBatchId || "";
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

  const summaryRows = [];
  for (let index = 0; index < fixedSummary.length; index += 2) {
    summaryRows.push([fixedSummary[index], fixedSummary[index + 1] || ["", ""]]);
  }
  els.reportSummary.innerHTML = `
    <div class="report-table-wrap">
      <table class="report-detail-table">
        <tbody>
          ${summaryRows.map(([[leftLabel, leftValue], [rightLabel, rightValue]]) => `
            <tr>
              <th>${escapeHtml(leftLabel)}</th>
              <td>${escapeHtml(leftValue)}</td>
              <th>${escapeHtml(rightLabel)}</th>
              <td>${escapeHtml(rightValue)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  els.reportHighlights.innerHTML = `
    <section class="attention-section">
      <div class="attention-head">
        <h4>失败的用例</h4>
        <span class="badge tone-red">${report.topFailedCases.length}</span>
      </div>
      ${report.topFailedCases.length ? `
        <div class="report-table-wrap">
          <table class="report-issue-table">
            <thead><tr><th>用例标题</th><th>任务</th><th>业务</th><th>关联 BUG</th></tr></thead>
            <tbody>
              ${report.topFailedCases.map((item) => `
                <tr>
                  <td><strong>${escapeHtml(item.title)}</strong></td>
                  <td>${escapeHtml(item.taskName || "未分任务")}</td>
                  <td>${escapeHtml(item.module || "未标记")}</td>
                  <td><span class="report-count danger">${report.unresolvedBugs.filter((bug) => bug.caseId === item.id).length}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `
          <div class="empty-state empty-state-rich">
            <strong>当前没有失败用例</strong>
            <p>失败的测试用例会显示在这里。</p>
          </div>
      `}
    </section>
    <section class="attention-section">
      <div class="attention-head">
        <h4>未修复的BUG</h4>
        <span class="badge tone-orange">${report.topOpenBugs.length}</span>
      </div>
      ${report.topOpenBugs.length ? `
        <div class="report-table-wrap">
          <table class="report-issue-table report-bug-table">
            <thead><tr><th>BUG 标题</th><th>严重程度</th><th>当前状态</th><th>任务</th><th>来源</th></tr></thead>
            <tbody>
              ${report.topOpenBugs.map((item) => `
                <tr>
                  <td><strong>${escapeHtml(item.title)}</strong></td>
                  <td><span class="badge ${getBugSeverityTone(item.severity)}">${escapeHtml(item.severity || "未标记")}</span></td>
                  <td><span class="badge ${getBugStatusTone(item.status)}">${escapeHtml(item.status)}</span></td>
                  <td>${escapeHtml(item.taskName || "未分任务")}</td>
                  <td>${scopeHasFailedCaseBug(item) ? `<span class="badge tone-red">失败用例</span>` : `<span class="report-table-muted">手动创建</span>`}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `
          <div class="empty-state empty-state-rich">
            <strong>当前没有未修复BUG</strong>
            <p>新建、已提交、待处理的 BUG 会显示在这里。</p>
          </div>
      `}
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
    scope.task ? `任务：${scope.task.name || ""}` : ""
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
    scopeLabel,
    heroTitle: scope.task?.name || scope.batch?.version || "当前测试报告",
    batchVersion: resolvedBatchVersion,
    taskName: scope.task?.name || "未选择",
    generatedAt: new Date().toLocaleString("zh-CN"),
    documentInfoItems: [
      ["报告名称", "测试报告"],
      ["版本号", resolvedBatchVersion],
      ["测试任务", scope.task?.name || "未选择"],
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
      ["测试任务数", versionTaskCount],
      ["测试用例总数", total],
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
        <td class="multiline-cell">${escapeHtml(item.link || "未填写")}</td>
        <td class="multiline-cell">${escapeHtml(item.note || "暂无补充说明")}</td>
      </tr>
    `).join("")
    : `
      <tr>
        <td colspan="7" class="empty-cell">当前没有未修复BUG</td>
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
    moduleName: "VA业务"
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
    return normalizeLoadedState({ ...defaultState(), ...parsed });
  } catch (_error) {
    return defaultState();
  }
}

function normalizeLoadedState(loadedState) {
  loadedState.settings = {
    apiKey: loadedState.settings?.apiKey || "",
    model: normalizeAiModel(loadedState.settings?.model),
    currentOperator: loadedState.settings?.currentOperator || ""
  };
  loadedState.selfTestSnapshot = normalizeSelfTestSnapshot(loadedState.selfTestSnapshot);
  loadedState.caseQualityBusiness = normalizeCaseQualityBusiness(loadedState.caseQualityBusiness);
  loadedState.caseQualityReports = normalizeCaseQualityReports(loadedState.caseQualityReports);
  const legacyQualityReport = normalizeCaseQualityReport(loadedState.caseQualityReport);
  if (legacyQualityReport && !loadedState.caseQualityReports[loadedState.caseQualityBusiness]) {
    loadedState.caseQualityReports[loadedState.caseQualityBusiness] = legacyQualityReport;
  }
  loadedState.caseQualityCasesByBusiness = normalizeCaseQualityCasesByBusiness(loadedState.caseQualityCasesByBusiness);
  loadedState.uiAutomationSettings = normalizeUiAutomationSettings(loadedState.uiAutomationSettings);
  loadedState.uiAutomationSession = normalizeUiAutomationSession(loadedState.uiAutomationSession);
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
      apiKey: "",
      model: DEFAULT_AI_MODEL,
      currentOperator: ""
    },
    uiMode: "guide",
    selfTestSnapshot: {
      result: null,
      error: ""
    },
    caseQualityReports: {},
    caseQualityCasesByBusiness: {},
    caseQualityBusiness: "VA业务",
    uiAutomationSettings: {
      baseUrl: "",
      loginPath: ""
    },
    uiAutomationSession: {
      available: false,
      browserPath: "",
      active: false,
      authSaved: false,
      sessionStartedAt: "",
      baseUrl: "",
      loginPath: "",
      headless: true,
      lastError: ""
    }
  };
}

function normalizeSelfTestSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return {
      result: null,
      error: ""
    };
  }

  return {
    result: snapshot.result && typeof snapshot.result === "object" ? snapshot.result : null,
    error: typeof snapshot.error === "string" ? snapshot.error : ""
  };
}

function normalizeCaseQualityReport(report) {
  if (!report || typeof report !== "object") {
    return null;
  }

  return {
    label: typeof report.label === "string" ? report.label : "未检查",
    tone: typeof report.tone === "string" ? report.tone : "neutral",
    sourceLabel: typeof report.sourceLabel === "string" ? report.sourceLabel : "",
    fileName: typeof report.fileName === "string" ? report.fileName : "",
    checkedAt: typeof report.checkedAt === "string" ? report.checkedAt : "",
    ruleContext: report.ruleContext && typeof report.ruleContext === "object" ? report.ruleContext : null,
    quickTip: typeof report.quickTip === "string" ? report.quickTip : "",
    metrics: Array.isArray(report.metrics) ? report.metrics : [],
    issues: Array.isArray(report.issues) ? report.issues : []
  };
}

function normalizeCaseQualityReports(reports) {
  const normalized = {};
  if (!reports || typeof reports !== "object") {
    return normalized;
  }

  CASE_QUALITY_BUSINESSES.forEach((businessName) => {
    const report = normalizeCaseQualityReport(reports[businessName]);
    if (report) {
      normalized[businessName] = report;
    }
  });
  return normalized;
}

function normalizeCaseQualityCasesByBusiness(value) {
  const normalized = {};
  if (!value || typeof value !== "object") {
    return normalized;
  }

  CASE_QUALITY_BUSINESSES.forEach((businessName) => {
    normalized[businessName] = Array.isArray(value[businessName])
      ? value[businessName].map((item) => normalizeCaseItem(item))
      : [];
  });
  return normalized;
}

function persist() {
  const localState = Object.fromEntries(LOCAL_STATE_KEYS.map((key) => [key, structuredCloneSafe(state[key])]));
  if (localState.settings) {
    localState.settings = {
      apiKey: localState.settings.apiKey || "",
      model: normalizeAiModel(localState.settings.model),
      currentOperator: localState.settings.currentOperator || ""
    };
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
