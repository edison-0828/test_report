const STORAGE_KEY = "test-flow-tool-v2";
const SHARED_CONFLICT_BACKUP_KEY = `${STORAGE_KEY}-shared-conflict`;
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
let activeAutomationEditorCaseId = null;
let apiSettingsDrawerReady = false;
let apiSettingsOpen = false;
let apiSettingsReturnFocus = null;

const els = {
  navLinks: [...document.querySelectorAll(".nav-link")],
  panels: [...document.querySelectorAll(".tab-panel")],
  topbarTitle: document.getElementById("topbarTitle"),
  topbarMenuBtn: document.getElementById("topbarMenuBtn"),
  topbarSelfTest: document.getElementById("topbarSelfTest"),
  topbarSettings: document.getElementById("topbarSettings"),
  sidebarAiSettings: document.getElementById("sidebarAiSettings"),
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
  generateCases: document.getElementById("generateCasesAi"),
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
  createTaskBtn: document.getElementById("createTaskButton"),
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
  versionCompleteModal: document.getElementById("versionCompleteModal"),
  versionCompleteTitle: document.getElementById("versionCompleteTitle"),
  versionCompleteSummary: document.getElementById("versionCompleteSummary"),
  closeVersionCompleteModal: document.getElementById("closeVersionCompleteModal"),
  cancelVersionCompleteModal: document.getElementById("cancelVersionCompleteModal"),
  confirmVersionComplete: document.getElementById("confirmVersionComplete"),
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
  apiConfigPanel: document.querySelector(".ai-config-panel"),
  sidebarAiStatus: document.getElementById("sidebarAiStatus"),
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
  caseTaskFilter: document.getElementById("caseTaskFilter"),
  caseTaskOptions: document.getElementById("caseTaskOptions"),
  caseStatusFilter: document.getElementById("caseStatusFilter"),
  caseBulkStatus: document.getElementById("caseBulkStatus"),
  applyCaseBulkStatus: document.getElementById("applyCaseBulkStatus"),
  exportCasesBtn: document.getElementById("exportCasesBtn"),
  caseActionStatus: document.getElementById("caseActionStatus"),
  automationCaseList: document.getElementById("automationCaseList"),
  automationAssetSummary: document.getElementById("automationAssetSummary"),
  automationCaseSearchInput: document.getElementById("automationCaseSearchInput"),
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
  publishReport: document.getElementById("publishReport"),
  reportExportModal: document.getElementById("reportExportModal"),
  reportExportPreview: document.getElementById("reportExportPreview"),
  closeReportExportModal: document.getElementById("closeReportExportModal"),
  cancelReportExport: document.getElementById("cancelReportExport"),
  confirmReportExport: document.getElementById("confirmReportExport"),
  publishWebReport: document.getElementById("publishWebReport"),
  publishedReportResult: document.getElementById("publishedReportResult"),
  publishedReportCount: document.getElementById("publishedReportCount"),
  publishedReportList: document.getElementById("publishedReportList"),
  publishedReportSearch: document.getElementById("publishedReportSearch"),
  toastRegion: document.getElementById("toastRegion"),
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
let completingBatchId = "";
let editingTaskId = "";
let activeExecutionCaseId = "";
let activeBugEditorId = "";
let bugModalRecordId = "";
let bugModalSourceCaseId = "";
let bugModalExistingImages = [];
let bugModalPendingImages = [];
let bugModalRemovedImageIds = [];
let reportVersionPage = 1;
let publishedReports = [];
let persistSharedTimer = 0;
let sharedStateRevision = 0;
let sharedPersistInFlight = false;
let sharedPersistQueued = false;
let sharedPersistPaused = false;
let sharedStateConflict = null;
let activeVersionActionMenu = null;
let versionActionMenuCleanup = null;
const expandedVersionIds = new Set();
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
enhanceGenerationBeginnerFlow();
initApiSettingsDrawer();
initOwnerUi();
bindEvents();
renderAll();
hydrateInteractionUi();
ensureCasesToolbarEnhancements();
loadTeamMembersConfig();
loadSharedState();
loadPublishedReports();
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
    toggleApiSettingsDrawer(true);
  });
  els.sidebarAiSettings?.addEventListener("click", () => {
    toggleMobileNavigation(false);
    toggleApiSettingsDrawer(true);
  });

  els.documentInput.addEventListener("change", handleFileUpload);
  els.sourceType.addEventListener("change", renderSourceMode);
  els.versionScopeInput?.addEventListener("input", autoResizeTextarea);
  els.taskScopeInput.addEventListener("input", autoResizeTextarea);
  els.sourceText?.addEventListener("input", autoResizeTextarea);
  els.generateCases?.addEventListener("click", () => handleGenerateCases("ai"));
  els.generateCasesLocal?.addEventListener("click", () => handleGenerateCases("local"));
  els.saveDocument?.addEventListener("click", saveCurrentDocument);
  els.activeBatchSelect.addEventListener("change", handleActiveBatchChange);
  els.activeModuleSelect.addEventListener("change", handleActiveModuleChange);
  els.createBatchBtn.addEventListener("click", createBatch);
  els.createTaskBtn.addEventListener("click", createTask);
  els.addVersionBtn?.addEventListener("click", () => openVersionModal());
  els.versionSearchInput?.addEventListener("input", renderVersionManager);
  els.versionStatusFilter?.addEventListener("change", renderVersionManager);
  els.versionForm?.addEventListener("submit", saveVersionFromManager);
  els.closeVersionModal?.addEventListener("click", closeVersionModal);
  els.cancelVersionModal?.addEventListener("click", closeVersionModal);
  els.versionModal?.addEventListener("click", (event) => {
    if (event.target === els.versionModal) closeVersionModal();
  });
  els.closeVersionCompleteModal?.addEventListener("click", closeVersionCompleteModal);
  els.cancelVersionCompleteModal?.addEventListener("click", closeVersionCompleteModal);
  els.confirmVersionComplete?.addEventListener("click", confirmVersionCompletion);
  els.versionCompleteModal?.addEventListener("click", (event) => {
    if (event.target === els.versionCompleteModal) closeVersionCompleteModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && apiSettingsOpen) {
      toggleApiSettingsDrawer(false);
    }
    if (event.key === "Escape" && !els.versionModal?.classList.contains("hidden-field")) {
      closeVersionModal();
    }
    if (event.key === "Escape" && !els.versionCompleteModal?.classList.contains("hidden-field")) {
      closeVersionCompleteModal();
    }
    if (event.key === "Escape" && !els.bugModal?.classList.contains("hidden-field")) {
      closeBugModal();
    }
    if (event.key === "Escape" && !els.reportExportModal?.classList.contains("hidden-field")) {
      closeReportExportPreview();
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
  els.caseTaskFilter.addEventListener("input", renderCases);
  els.caseStatusFilter?.addEventListener("change", renderCases);
  els.applyCaseBulkStatus?.addEventListener("click", applyBulkCaseExecutionStatus);
  els.exportCasesBtn?.addEventListener("click", exportFilteredCases);
  els.automationCaseBatchFilter?.addEventListener("change", () => {
    renderCaseFilters();
    renderAutomationCases();
  });
  els.automationCaseTaskFilter?.addEventListener("change", renderAutomationCases);
  els.automationCaseEnabledFilter?.addEventListener("change", renderAutomationCases);
  els.automationCaseSearchInput?.addEventListener("input", renderAutomationCases);
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
  els.exportReport.addEventListener("click", openReportExportPreview);
  els.publishReport?.addEventListener("click", openReportExportPreview);
  els.closeReportExportModal?.addEventListener("click", closeReportExportPreview);
  els.cancelReportExport?.addEventListener("click", closeReportExportPreview);
  els.reportExportModal?.addEventListener("click", (event) => {
    if (event.target === els.reportExportModal) closeReportExportPreview();
  });
  els.confirmReportExport?.addEventListener("click", async () => {
    els.confirmReportExport.disabled = true;
    els.confirmReportExport.setAttribute("aria-busy", "true");
    els.confirmReportExport.textContent = "正在生成…";
    const exported = await exportReport({ skipChecks: true });
    els.confirmReportExport.disabled = false;
    els.confirmReportExport.removeAttribute("aria-busy");
    els.confirmReportExport.textContent = "确认导出 DOCX";
    if (exported) closeReportExportPreview();
  });
  els.publishWebReport?.addEventListener("click", publishCurrentReport);
  els.publishedReportResult?.addEventListener("click", handlePublishedReportAction);
  els.publishedReportList?.addEventListener("click", handlePublishedReportListAction);
  els.publishedReportSearch?.addEventListener("input", renderPublishedReports);
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
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
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
  if (exportBtn) exportBtn.textContent = "预览并导出";

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
    if (headerDesc) headerDesc.textContent = "独立管理 BUG 台账，按版本、任务和模块跟踪严重程度、状态与回归进展。";
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

function enhanceGenerationBeginnerFlow() {
  const panel = document.querySelector("#upload .upload-stage-panel-combined");
  const taskFlow = panel?.querySelector(".task-flow");
  const sourceTypeRow = els.sourceType?.closest(".form-row");
  const actionWrap = els.generateCases?.parentElement;
  if (!panel || !taskFlow || !sourceTypeRow || !actionWrap || panel.dataset.beginnerFlowReady === "true") {
    return;
  }

  panel.dataset.beginnerFlowReady = "true";

  const progress = document.createElement("div");
  progress.className = "generation-flow-steps";
  progress.setAttribute("aria-label", "生成用例操作步骤");
  progress.innerHTML = `
    <span class="is-current"><b>1</b>填写任务</span>
    <span><b>2</b>提供材料</span>
    <span><b>3</b>生成用例</span>
  `;
  taskFlow.insertAdjacentElement("beforebegin", progress);

  const taskBlock = createGenerationStepBlock(
    "1",
    "填写测试任务",
    "任务名称用于后续搜索；测试范围写清楚本次要覆盖和不覆盖的内容。",
    "generation-step-task"
  );
  taskFlow.insertAdjacentElement("beforebegin", taskBlock);
  taskBlock.append(taskFlow);
  if (els.currentTaskSummary) taskBlock.append(els.currentTaskSummary);

  const divider = panel.querySelector(".combined-generation-divider");
  const sourceBlock = createGenerationStepBlock(
    "2",
    "提供测试材料",
    "上传文件、粘贴需求或填写接口文档网址，选择其中一种即可。",
    "generation-step-materials"
  );
  (divider || sourceTypeRow).insertAdjacentElement("beforebegin", sourceBlock);
  divider?.remove();
  if (els.generationVersionSummary) sourceBlock.append(els.generationVersionSummary);
  sourceBlock.append(sourceTypeRow);
  if (els.documentUploadBox) sourceBlock.append(els.documentUploadBox);
  if (els.sourceUrlWrap) sourceBlock.append(els.sourceUrlWrap);
  if (els.sourceTextWrap) sourceBlock.append(els.sourceTextWrap);

  const documentNameRow = els.documentName?.closest(".form-row");
  if (documentNameRow) {
    const advanced = document.createElement("details");
    advanced.className = "generation-advanced-options";
    advanced.innerHTML = `
      <summary>补充材料名称 <span>可选，上传文件后会自动填写</span></summary>
    `;
    advanced.append(documentNameRow);
    sourceBlock.append(advanced);
  }

  const actionBlock = createGenerationStepBlock(
    "3",
    "确认并生成",
    "先选择已保存的任务，再根据上面的范围与材料生成测试用例。",
    "generation-step-submit"
  );
  actionWrap.insertAdjacentElement("beforebegin", actionBlock);
  actionBlock.append(actionWrap);
  if (els.generationStatus) actionBlock.append(els.generationStatus);
}

function initApiSettingsDrawer() {
  if (!els.apiConfigPanel || apiSettingsDrawerReady) {
    return;
  }

  apiSettingsDrawerReady = true;
  const drawer = document.createElement("div");
  drawer.id = "apiSettingsDrawer";
  drawer.className = "settings-drawer hidden-field";
  drawer.setAttribute("role", "presentation");
  drawer.innerHTML = `
    <button class="settings-drawer-backdrop" type="button" aria-label="关闭 AI 配置"></button>
    <aside class="settings-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="apiSettingsDrawerTitle">
      <div class="settings-drawer-head">
        <div>
          <span class="settings-drawer-kicker">全局设置</span>
          <h3 id="apiSettingsDrawerTitle">AI 配置</h3>
          <p>保存个人 Key 并检测通过后，即可在用例生成中调用 AI。</p>
        </div>
        <button class="dialog-close" type="button" data-close-api-settings aria-label="关闭 AI 配置">×</button>
      </div>
      <div class="settings-drawer-body"></div>
    </aside>
  `;
  document.body.appendChild(drawer);

  const body = drawer.querySelector(".settings-drawer-body");
  els.apiConfigPanel.classList.add("settings-drawer-config");
  const configTitle = els.apiConfigPanel.querySelector(".section-head h3");
  if (configTitle) configTitle.textContent = "AI Key 与模型";
  body.appendChild(els.apiConfigPanel);
  initDataBackupPanel(body);

  drawer.querySelector(".settings-drawer-backdrop")?.addEventListener("click", () => toggleApiSettingsDrawer(false));
  drawer.querySelector("[data-close-api-settings]")?.addEventListener("click", () => toggleApiSettingsDrawer(false));
}

function toggleApiSettingsDrawer(open) {
  const drawer = document.getElementById("apiSettingsDrawer");
  if (!drawer) return;
  if (open) {
    apiSettingsReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  apiSettingsOpen = open;
  drawer.classList.toggle("hidden-field", !open);
  drawer.classList.toggle("is-open", open);
  document.body.classList.toggle("settings-drawer-open", open);
  els.topbarSettings?.setAttribute("aria-expanded", open ? "true" : "false");
  els.sidebarAiSettings?.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) {
    window.setTimeout(() => els.apiKey?.focus(), 0);
  } else {
    apiSettingsReturnFocus?.focus?.();
    apiSettingsReturnFocus = null;
  }
}

function createGenerationStepBlock(number, title, description, className) {
  const block = document.createElement("section");
  block.className = `generation-step-block ${className}`;
  block.innerHTML = `
    <div class="generation-step-heading">
      <span>${number}</span>
      <div>
        <strong>${title}</strong>
        <p>${description}</p>
      </div>
    </div>
  `;
  return block;
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
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
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
  if (els.sidebarAiStatus) {
    const sidebarText = tone === "ok"
      ? "已启用"
      : tone === "error"
        ? "检测失败"
        : tone === "neutral"
          ? "待检测"
          : "未配置";
    els.sidebarAiStatus.textContent = sidebarText;
    els.sidebarAiStatus.className = `sidebar-ai-status ${tone}`;
  }
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

  const firstFailure = Array.isArray(selfTestState.result.failures)
    ? String(selfTestState.result.failures[0] || "").trim()
    : "";
  setSelfTestStatus("发现问题", "error");
  setSelfTestFeedback(
    firstFailure
      ? `最近一次自检发现异常：${firstFailure}`
      : "最近一次自检发现异常，建议联系管理员或在终端执行 npm test 排查。",
    "error"
  );
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
    sharedStateRevision = normalizeSharedStateRevision(data.revision);
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

function normalizeSharedStateRevision(value) {
  const revision = Number(value);
  return Number.isInteger(revision) && revision >= 0 ? revision : 0;
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
    state.activeReportBatchId = reportBatchIds[0] || "";
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
  els.createTaskBtn.textContent = "创建任务";
  editingTaskId = "";
  autoResizeTextarea();
  persist();
  renderAll();
  setGenerationStatus(`${isEditing ? "已更新" : "已创建"}任务：${auditedTask.name}。需要用例时可继续提供材料并生成。`, "ok");
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
      downloadCasesCsv(generatedCases, activeTask, name);
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
  downloadCasesCsv(generatedCases, activeTask, name);
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
        <button type="button" class="ghost-button" data-action="download-case-template">下载 CSV 模板</button>
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
        <div class="quality-first-run-guide">
          <div class="quality-first-run-copy">
            <span class="workspace-kicker">第一次检查</span>
            <strong>${escapeHtml(businessName)} 还没有检测记录</strong>
            <p>下载模板填写用例，再上传 CSV。系统会立即检查完整性、重复项和基础覆盖情况。</p>
          </div>
          <ol class="quality-first-run-steps">
            <li><b>1</b><span><strong>准备数据</strong><small>至少填写标题、优先级、步骤和预期结果</small></span></li>
            <li><b>2</b><span><strong>上传检查</strong><small>仅更新当前业务，不影响其他业务数据</small></span></li>
            <li><b>3</b><span><strong>处理问题</strong><small>按问题清单补充缺失内容或去除重复项</small></span></li>
          </ol>
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
      current: flow.nextAction === "configure-bot",
      action: "configure-bot"
    },
    {
      key: "task-and-cases",
      title: "创建任务，再生成用例",
      desc: "先创建任务；需要用例时，再选择任务并提供需求或接口文档。",
      done: flow.hasCases,
      current: ["create-task", "prepare-source", "generate-cases"].includes(flow.nextAction),
      action: "create-task"
    },
    {
      key: "execution",
      title: "执行用例并记录问题",
      desc: "手工执行时改状态、写备注。失败的问题可以直接转成 BUG。",
      done: flow.hasExecutionOrBug,
      current: flow.nextAction === "execute-cases",
      action: "execute-cases"
    },
    {
      key: "report",
      title: "看报告，准备自动化",
      desc: "报告页看整体结果；稳定的接口场景再进入接口自动化，后续接 pytest 回归。",
      done: flow.hasExecutionOrBug,
      current: flow.nextAction === "export-report",
      action: "export-report"
    }
  ];

  els.onboardingSteps.innerHTML = steps.map((step, index) => `
    <button class="step-card ${step.current ? "current" : ""} ${step.done ? "done" : ""}" type="button" data-workflow-action="${step.action}" aria-label="${escapeHtml(step.title)}：${step.current ? "当前下一步" : "打开对应页面"}">
      <div class="step-index">${index + 1}</div>
      <div class="step-body">
        <div class="step-head">
          <strong>${escapeHtml(step.title)}</strong>
          <span class="step-state">${step.done ? "已完成" : step.current ? "下一步" : "查看"}</span>
        </div>
        <p>${escapeHtml(step.desc)}</p>
      </div>
    </button>
  `).join("");

  els.onboardingSteps.querySelectorAll("[data-workflow-action]").forEach((button) => {
    button.addEventListener("click", () => handleWorkflowStepAction(button.dataset.workflowAction));
  });
}

function handleWorkflowStepAction(action) {
  if (action === "configure-bot") {
    switchTab("upload");
    document.querySelector(".ai-config-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => els.apiKey?.focus(), 260);
    return;
  }

  if (action === "create-task") {
    switchTab("upload");
    document.querySelector(".upload-stage-panel-combined")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => els.taskNameInput?.focus(), 260);
    return;
  }

  if (action === "execute-cases") {
    const activeTask = getTaskById(state.activeTaskId);
    if (activeTask && els.caseTaskFilter) {
      els.caseTaskFilter.value = activeTask.name || "";
    }
    activeExecutionCaseId = "";
    switchTab("cases");
    renderCases();
    return;
  }

  if (action === "export-report") {
    switchTab("report");
  }
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
  closeVersionActionMenu();
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
        <button class="ghost-button" type="button" data-clear-task-filters>清空筛选</button>
      </div>
    `;
    els.taskManagerList.querySelector("[data-clear-task-filters]")?.addEventListener("click", () => {
      if (els.taskSearchInput) els.taskSearchInput.value = "";
      if (els.taskVersionFilter) els.taskVersionFilter.value = "";
      renderTaskManager();
    });
    return;
  }

  els.taskManagerList.innerHTML = `
    <table class="task-table">
      <thead>
        <tr>
          <th>任务名称</th>
          <th>测试范围</th>
          <th>关联版本</th>
          <th>用例进度</th>
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
  els.taskManagerList.querySelectorAll("[data-task-menu-trigger]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openTaskActionMenu(button, button.dataset.taskMenuTrigger);
    });
  });
}

function renderTaskTableRow(task) {
  const batch = getBatchById(task.batchId);
  const isLinked = Boolean(batch && !batch.systemManaged);
  const isActive = task.id === state.activeTaskId;
  const isReadonly = isTaskReadonly(task);
  const caseProgress = getTaskCaseProgress(task);
  const primaryAction = getTaskPrimaryAction(task, caseProgress);

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
      <td data-label="用例进度">
        ${caseProgress.total ? `
          <div class="task-case-progress" title="已执行 ${caseProgress.completed} / ${caseProgress.total} 条">
            <div><strong>${caseProgress.completed}/${caseProgress.total}</strong><span>${caseProgress.percent}%</span></div>
            <span class="task-case-progress-track"><i style="width:${caseProgress.percent}%"></i></span>
          </div>
        ` : `<span class="task-no-cases">待生成</span>`}
      </td>
      <td data-label="状态"><span class="version-status version-status-${task.status === "已完成" ? "success" : "active"}">${escapeHtml(task.status || "进行中")}</span></td>
      <td data-label="创建时间">${escapeHtml(formatAuditTime(task.createdAt))}</td>
      <td data-label="操作" class="task-action-column">
        <div class="task-row-actions">
          ${primaryAction ? `<button class="task-primary-action" type="button" data-task-action="${primaryAction.action}" data-task-id="${task.id}">${primaryAction.label}</button>` : `<span class="task-readonly-label">已完成，只读</span>`}
          ${!isReadonly ? `<button class="row-more-trigger" type="button" data-task-menu-trigger="${task.id}" aria-haspopup="menu" aria-expanded="false" aria-label="更多任务操作" title="更多任务操作">…</button>` : ""}
        </div>
      </td>
    </tr>
  `;
}

function getTaskCaseProgress(task) {
  const taskCases = state.cases.filter((item) => (
    item.taskId === task.id || (!item.taskId && item.taskName === task.name)
  ));
  const completed = taskCases.filter((item) => (
    item.executionStatus && item.executionStatus !== "未执行"
  )).length;
  return {
    total: taskCases.length,
    completed,
    percent: taskCases.length ? Math.round((completed / taskCases.length) * 100) : 0
  };
}

function getVersionHealth(batch) {
  const tasks = state.tasks.filter((task) => task.batchId === batch.id);
  const taskIds = new Set(tasks.map((task) => task.id));
  const cases = state.cases.filter((item) => item.batchId === batch.id || taskIds.has(item.taskId));
  const bugs = state.bugs.filter((item) => item.batchId === batch.id || taskIds.has(item.taskId));
  const executed = cases.filter((item) => item.executionStatus && item.executionStatus !== "未执行").length;
  const failed = cases.filter((item) => item.executionStatus === "失败").length;
  const blocked = cases.filter((item) => item.executionStatus === "阻塞").length;
  const openBugs = bugs.filter((item) => !["已验证", "已关闭"].includes(item.status)).length;
  const pending = Math.max(0, cases.length - executed);
  const percent = cases.length ? Math.round((executed / cases.length) * 100) : 0;
  let release = { label: "待准备", tone: "muted" };
  if (cases.length && !failed && !blocked && !openBugs && !pending) {
    release = { label: "可完成", tone: "success" };
  } else if (failed) {
    release = { label: "有风险", tone: "danger" };
  } else if (cases.length || openBugs) {
    release = { label: "需关注", tone: "warning" };
  }
  return { tasks, cases, bugs, executed, failed, blocked, openBugs, pending, percent, release };
}

function renderVersionManager() {
  closeVersionActionMenu();
  const search = els.versionSearchInput?.value.trim().toLowerCase() || "";
  const status = els.versionStatusFilter?.value || "";
  const managedBatches = state.batches.filter((batch) => !batch.systemManaged);
  const managedBatchIds = new Set(managedBatches.map((batch) => batch.id));
  expandedVersionIds.forEach((batchId) => {
    if (!managedBatchIds.has(batchId)) expandedVersionIds.delete(batchId);
  });
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
        <button class="ghost-button" type="button" data-clear-version-filters>清空筛选</button>
      </div>
    `;
    els.versionManagerList.querySelector("[data-clear-version-filters]")?.addEventListener("click", () => {
      if (els.versionSearchInput) els.versionSearchInput.value = "";
      if (els.versionStatusFilter) els.versionStatusFilter.value = "";
      renderVersionManager();
    });
    return;
  }

  els.versionManagerList.innerHTML = `
    <table class="version-table">
      <thead>
        <tr>
          <th>版本号</th>
          <th>状态</th>
          <th>任务</th>
          <th>用例进度</th>
          <th>失败</th>
          <th>待跟进 BUG</th>
          <th>发布检查</th>
          <th class="version-action-column">下一步</th>
        </tr>
      </thead>
      <tbody>
        ${visibleBatches.map((batch) => renderVersionTableRows(batch)).join("")}
      </tbody>
    </table>
  `;

  els.versionManagerList.querySelectorAll("[data-version-detail-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const batchId = button.dataset.versionDetailToggle;
      const detailRow = els.versionManagerList.querySelector(`[data-version-detail-row="${batchId}"]`);
      const opening = detailRow?.classList.contains("hidden-field");
      detailRow?.classList.toggle("hidden-field", !opening);
      if (opening) {
        expandedVersionIds.add(batchId);
      } else {
        expandedVersionIds.delete(batchId);
      }
      button.setAttribute("aria-expanded", opening ? "true" : "false");
      button.setAttribute("aria-label", opening ? "收起版本详情" : "展开版本详情");
      button.title = opening ? "收起版本详情" : "展开版本详情";
      button.textContent = opening ? "收起" : "展开";
    });
  });
  els.versionManagerList.querySelectorAll("[data-version-action]").forEach((button) => {
    button.addEventListener("click", () => {
      handleVersionAction(button.dataset.versionAction, button.dataset.versionId);
    });
  });
  els.versionManagerList.querySelectorAll("[data-version-menu-trigger]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openVersionActionMenu(button, button.dataset.versionMenuTrigger);
    });
  });
  els.versionManagerList.querySelectorAll("[data-task-action]").forEach((button) => {
    button.addEventListener("click", () => handleTaskAction(button.dataset.taskAction, button.dataset.taskId));
  });
  els.versionManagerList.querySelectorAll("[data-task-menu-trigger]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openTaskActionMenu(button, button.dataset.taskMenuTrigger);
    });
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
  const health = getVersionHealth(batch);
  const relatedTasks = health.tasks;
  const isActive = batch.id === state.activeBatchId;
  const isCompleted = batch.status === "已完成";
  const isExpanded = expandedVersionIds.has(batch.id);
  const primaryAction = getVersionPrimaryAction(batch, health);

  return `
    <tr class="version-table-row ${isActive ? "is-active" : ""}">
      <td data-label="版本号">
        <div class="version-name-cell">
          <strong>${escapeHtml(batch.version || "未命名版本")}</strong>
          ${isActive ? `<span class="badge subtle">当前</span>` : ""}
        </div>
      </td>
      <td data-label="状态"><span class="version-status version-status-${getVersionStatusTone(batch.status)}">${escapeHtml(batch.status || "进行中")}</span></td>
      <td data-label="任务">
        <div class="version-task-count">
          <strong>${relatedTasks.length}</strong>
          <span>${relatedTasks.length ? "个任务" : "待关联"}</span>
        </div>
      </td>
      <td data-label="用例进度">
        ${health.cases.length ? `
          <div class="version-case-progress" title="已执行 ${health.executed} / ${health.cases.length} 条">
            <div><strong>${health.executed}/${health.cases.length}</strong><span>${health.percent}%</span></div>
            <span><i style="width:${health.percent}%"></i></span>
          </div>
        ` : `<span class="version-metric-empty">暂无用例</span>`}
      </td>
      <td data-label="失败"><span class="version-risk-count ${health.failed ? "is-danger" : ""}">${health.failed}</span></td>
      <td data-label="待跟进 BUG"><span class="version-risk-count ${health.openBugs ? "is-warning" : ""}">${health.openBugs}</span></td>
      <td data-label="发布检查"><span class="version-release-check tone-${health.release.tone}">${health.release.label}</span></td>
      <td data-label="下一步" class="version-action-column">
        <div class="version-row-actions">
          <button class="version-primary-action" type="button" data-version-action="${primaryAction.action}" data-version-id="${batch.id}">${primaryAction.label}</button>
          <button class="version-detail-toggle" type="button" data-version-detail-toggle="${batch.id}" aria-expanded="${isExpanded ? "true" : "false"}" aria-label="${isExpanded ? "收起" : "展开"}版本详情" title="${isExpanded ? "收起" : "展开"}版本详情">${isExpanded ? "收起" : "展开"}</button>
          ${!isCompleted ? `<button class="row-more-trigger version-more-trigger" type="button" data-version-menu-trigger="${batch.id}" aria-haspopup="menu" aria-expanded="false" aria-label="更多版本操作" title="更多版本操作">…</button>` : ""}
        </div>
      </td>
    </tr>
    <tr class="version-detail-row ${isExpanded ? "" : "hidden-field"}" data-version-detail-row="${batch.id}">
      <td colspan="8">
        <div class="version-table-detail">
          <div class="version-table-detail-head">
            <strong>关联任务（${relatedTasks.length}）</strong>
            ${!isCompleted ? `<button class="ghost-button tiny-button" type="button" data-version-action="link-tasks" data-version-id="${batch.id}">管理关联</button>` : ""}
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
                  <div class="version-task-title-line">
                    <strong>${escapeHtml(task.name || "未命名任务")}</strong>
                    ${task.id === state.activeTaskId ? `<span class="task-current-status">当前</span>` : ""}
                  </div>
                  <p>${escapeHtml(task.scope || "未填写测试范围")}</p>
                </div>
                <div class="task-row-actions">
                  ${getTaskPrimaryAction(task) ? `<button class="task-primary-action" type="button" data-task-action="${getTaskPrimaryAction(task).action}" data-task-id="${task.id}">${getTaskPrimaryAction(task).label}</button>` : `<span class="task-readonly-label">已完成，只读</span>`}
                  ${task.status !== "已完成" ? `<button class="row-more-trigger" type="button" data-task-menu-trigger="${task.id}" aria-haspopup="menu" aria-expanded="false" aria-label="更多任务操作" title="更多任务操作">…</button>` : ""}
                </div>
              </article>
            `).join("") : `<p class="version-detail-empty">当前版本还没有关联任务，点击“管理关联”即可添加。</p>`}
          </div>
          <div class="version-detail-meta">
            <span>创建于 ${escapeHtml(formatAuditTime(batch.createdAt))}</span>
            ${batch.completedAt ? `<span>完成于 ${escapeHtml(formatAuditTime(batch.completedAt))}</span>` : ""}
          </div>
        </div>
      </td>
    </tr>
  `;
}

function openVersionActionMenu(trigger, batchId) {
  const batch = getBatchById(batchId);
  if (!trigger || !batch || batch.status === "已完成") return;
  const isActive = batch.id === state.activeBatchId;
  const isSuspended = batch.status === "已挂起";
  const menu = document.createElement("div");
  menu.className = "version-action-popover row-action-popover";
  menu.innerHTML = `
    <button type="button" role="menuitem" data-menu-action="edit">编辑版本</button>
    ${!isActive && !isSuspended ? `<button type="button" role="menuitem" data-menu-action="activate">设为当前</button>` : ""}
    <button type="button" role="menuitem" data-menu-action="complete">标记完成</button>
    <button type="button" role="menuitem" data-menu-action="${isSuspended ? "resume" : "suspend"}">${isSuspended ? "恢复版本" : "挂起版本"}</button>
    <button class="danger-menu-action" type="button" role="menuitem" data-menu-action="delete">删除版本</button>
  `;
  mountRowActionMenu(trigger, menu, `version:${batch.id}`, (action) => handleVersionAction(action, batch.id));
}

function openTaskActionMenu(trigger, taskId) {
  const task = getTaskById(taskId);
  if (!trigger || !task || isTaskReadonly(task)) return;
  const isActive = task.id === state.activeTaskId;
  const menu = document.createElement("div");
  menu.className = "version-action-popover row-action-popover";
  menu.innerHTML = `
    ${!isActive ? `<button type="button" role="menuitem" data-menu-action="activate">设为当前任务</button>` : ""}
    <button type="button" role="menuitem" data-menu-action="edit">编辑任务</button>
    <button class="danger-menu-action" type="button" role="menuitem" data-menu-action="delete">删除任务</button>
  `;
  mountRowActionMenu(trigger, menu, `task:${task.id}`, (action) => handleTaskAction(action, task.id));
}

function mountRowActionMenu(trigger, menu, ownerKey, onAction) {
  if (activeVersionActionMenu?.dataset.menuOwner === ownerKey) {
    closeVersionActionMenu();
    return;
  }
  closeVersionActionMenu();
  menu.dataset.menuOwner = ownerKey;
  menu.setAttribute("role", "menu");
  document.body.appendChild(menu);
  const triggerRect = trigger.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const position = getFloatingMenuPosition(
    triggerRect,
    { width: menuRect.width, height: menuRect.height },
    { width: window.innerWidth, height: window.innerHeight }
  );
  menu.style.left = `${position.left}px`;
  menu.style.top = `${position.top}px`;
  if (position.width) menu.style.width = `${position.width}px`;
  menu.classList.toggle("is-mobile-sheet", position.placement === "sheet");
  activeVersionActionMenu = menu;
  trigger.setAttribute("aria-expanded", "true");
  menu.querySelectorAll("[data-menu-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const action = button.dataset.menuAction;
      closeVersionActionMenu();
      onAction(action);
    });
  });
  const closeOnOutsideClick = (event) => {
    if (!menu.contains(event.target) && event.target !== trigger) closeVersionActionMenu();
  };
  const closeOnEscape = (event) => {
    if (event.key === "Escape") {
      closeVersionActionMenu();
      trigger.focus();
    }
  };
  const closeOnViewportChange = () => closeVersionActionMenu();
  document.addEventListener("click", closeOnOutsideClick);
  document.addEventListener("keydown", closeOnEscape);
  window.addEventListener("resize", closeOnViewportChange);
  window.addEventListener("scroll", closeOnViewportChange, true);
  versionActionMenuCleanup = () => {
    document.removeEventListener("click", closeOnOutsideClick);
    document.removeEventListener("keydown", closeOnEscape);
    window.removeEventListener("resize", closeOnViewportChange);
    window.removeEventListener("scroll", closeOnViewportChange, true);
    trigger.setAttribute("aria-expanded", "false");
  };
  menu.querySelector("[role='menuitem']")?.focus();
}

function getVersionPrimaryAction(batch, health = getVersionHealth(batch)) {
  if (batch.status === "已挂起") return { action: "resume", label: "恢复版本" };
  if (batch.status === "已完成") return { action: "view-report", label: "查看报告" };
  if (!health.tasks.length) return { action: "link-tasks", label: "添加任务" };
  if (!health.cases.length) return { action: "prepare-cases", label: "生成用例" };
  if (health.failed || health.blocked || health.openBugs) return { action: "manage-issues", label: "处理问题" };
  if (health.pending) return { action: "continue-testing", label: "继续测试" };
  return { action: "view-report", label: "查看报告" };
}

function getTaskPrimaryAction(task, progress = getTaskCaseProgress(task)) {
  if (isTaskReadonly(task) && !progress.total) return null;
  if (!progress.total) return { action: "generate", label: "生成用例" };
  if (progress.completed < progress.total) {
    return { action: "execute", label: progress.completed ? "继续执行" : "执行用例" };
  }
  return { action: "execute", label: "查看结果" };
}

function closeVersionActionMenu() {
  versionActionMenuCleanup?.();
  versionActionMenuCleanup = null;
  activeVersionActionMenu?.remove();
  activeVersionActionMenu = null;
}

function getFloatingMenuPosition(triggerRect, menuSize, viewport) {
  const padding = 12;
  const gap = 8;
  if (viewport.width <= 760) {
    return {
      left: padding,
      top: Math.max(padding, viewport.height - menuSize.height - padding),
      width: Math.max(0, viewport.width - padding * 2),
      placement: "sheet"
    };
  }

  const left = Math.min(
    Math.max(padding, triggerRect.right - menuSize.width),
    Math.max(padding, viewport.width - menuSize.width - padding)
  );
  const spaceBelow = viewport.height - triggerRect.bottom - padding;
  const spaceAbove = triggerRect.top - padding;
  const opensUp = spaceBelow < menuSize.height && spaceAbove > spaceBelow;
  const desiredTop = opensUp
    ? triggerRect.top - menuSize.height - gap
    : triggerRect.bottom + gap;
  const top = Math.min(
    Math.max(padding, desiredTop),
    Math.max(padding, viewport.height - menuSize.height - padding)
  );
  return { left, top, width: menuSize.width, placement: opensUp ? "top" : "bottom" };
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

function openVersionCompleteModal(batch) {
  if (!batch || !els.versionCompleteModal) return;
  const health = getVersionHealth(batch);
  const warnings = [];
  if (!health.tasks.length) warnings.push(["未关联任务", "当前版本还没有关联测试任务。"]);
  if (!health.cases.length) warnings.push(["暂无用例", "当前版本没有可追溯的测试用例。"]);
  if (health.pending) warnings.push(["存在未执行用例", `还有 ${health.pending} 条用例未执行。`]);
  if (health.failed) warnings.push(["存在失败用例", `还有 ${health.failed} 条失败用例需要确认。`]);
  if (health.blocked) warnings.push(["存在阻塞用例", `还有 ${health.blocked} 条阻塞用例需要解除。`]);
  if (health.openBugs) warnings.push(["存在待跟进 BUG", `还有 ${health.openBugs} 个 BUG 未验证或关闭。`]);

  completingBatchId = batch.id;
  els.versionCompleteTitle.textContent = `完成版本 · ${batch.version || "未命名版本"}`;
  els.versionCompleteSummary.innerHTML = `
    <div class="version-complete-intro ${warnings.length ? "has-risk" : "is-ready"}">
      <span>${warnings.length ? "请确认发布风险" : "发布检查已通过"}</span>
      <strong>${warnings.length ? `发现 ${warnings.length} 项需要关注` : "当前版本可以安全完成"}</strong>
      <p>完成后版本和关联任务进入只读状态，用例、BUG 与报告数据会完整保留。</p>
    </div>
    <div class="version-complete-metrics">
      <div><span>任务</span><strong>${health.tasks.length}</strong></div>
      <div><span>用例</span><strong>${health.cases.length}</strong></div>
      <div><span>执行进度</span><strong>${health.percent}%</strong></div>
      <div><span>失败 / 阻塞</span><strong>${health.failed + health.blocked}</strong></div>
      <div><span>待跟进 BUG</span><strong>${health.openBugs}</strong></div>
    </div>
    <div class="version-complete-checks">
      ${warnings.length ? warnings.map(([title, detail]) => `
        <div class="version-complete-check has-warning">
          <span>!</span>
          <div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(detail)}</p></div>
        </div>
      `).join("") : `
        <div class="version-complete-check is-passed">
          <span>✓</span>
          <div><strong>没有发现明显发布阻塞</strong><p>用例已执行完成，且没有失败、阻塞或待跟进 BUG。</p></div>
        </div>
      `}
    </div>
  `;
  els.confirmVersionComplete.textContent = warnings.length ? "了解风险，仍然完成" : "确认完成并锁定";
  els.versionCompleteModal.classList.remove("hidden-field");
  document.body.classList.add("dialog-open");
  window.setTimeout(() => els.confirmVersionComplete?.focus(), 0);
}

function closeVersionCompleteModal() {
  els.versionCompleteModal?.classList.add("hidden-field");
  document.body.classList.remove("dialog-open");
  completingBatchId = "";
}

function confirmVersionCompletion() {
  const batch = getBatchById(completingBatchId);
  if (!batch || batch.status === "已完成") {
    closeVersionCompleteModal();
    return;
  }
  state.batches = state.batches.map((item) => (
    item.id === batch.id
      ? applyUpdateAuditFields({ ...item, status: "已完成", completedAt: item.completedAt || nowIsoString() })
      : item
  ));
  if (state.activeBatchId === batch.id) {
    state.activeBatchId = state.batches.find((item) => !item.systemManaged && item.id !== batch.id && item.status === "进行中")?.id || "";
  }
  if (state.generationBatchId === batch.id) {
    state.generationBatchId = state.activeBatchId || getOrCreateDefaultWorkspaceBatch().id;
  }
  if (state.tasks.some((item) => item.batchId === batch.id && item.id === state.activeTaskId)) {
    state.activeTaskId = state.tasks.find((item) => item.batchId !== batch.id && !isTaskReadonly(item))?.id || "";
  }
  persist();
  closeVersionCompleteModal();
  renderAll();
  setGenerationStatus(`已完成版本：${formatBatchLabel(batch)}。历史用例、BUG 和报告数据已保留。`, "ok");
  showToast(`版本 ${batch.version || "未命名版本"} 已完成并锁定`, "ok");
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

  if (action === "prepare-cases" || action === "continue-testing") {
    const relatedTasks = state.tasks.filter((item) => item.batchId === batch.id);
    const targetCase = action === "continue-testing"
      ? state.cases.find((item) => item.batchId === batch.id && item.executionStatus === "未执行")
      : null;
    const targetTask = getTaskById(targetCase?.taskId) || relatedTasks[0];
    if (!targetTask) {
      openVersionModal(batch.id, "link-tasks");
      return;
    }
    handleTaskAction(action === "prepare-cases" ? "generate" : "execute", targetTask.id);
    return;
  }

  if (action === "manage-issues") {
    state.activeBatchId = batch.id;
    state.generationBatchId = batch.id;
    const relatedTaskIds = new Set(state.tasks.filter((item) => item.batchId === batch.id).map((item) => item.id));
    const openBug = state.bugs.find((item) => relatedTaskIds.has(item.taskId) && !["已验证", "已关闭"].includes(item.status));
    if (openBug) {
      state.activeTaskId = openBug.taskId || state.activeTaskId;
      persist();
      renderAll();
      if (els.bugBatchFilter) els.bugBatchFilter.value = batch.id;
      if (els.bugTaskFilter) els.bugTaskFilter.value = openBug.taskId || "";
      renderBugs();
      switchTab("bugs");
      showToast("已打开当前版本待处理的 BUG", "ok");
      return;
    }
    const failedCase = state.cases.find((item) => (
      relatedTaskIds.has(item.taskId) && ["失败", "阻塞"].includes(item.executionStatus)
    ));
    const targetTask = getTaskById(failedCase?.taskId) || state.tasks.find((item) => item.batchId === batch.id);
    if (targetTask) handleTaskAction("execute", targetTask.id);
    return;
  }

  if (action === "view-report") {
    state.activeReportBatchId = batch.id;
    state.activeBatchId = batch.id;
    persist();
    renderReport();
    switchTab("report");
    showToast(`已打开版本 ${batch.version || "未命名版本"} 的测试报告`, "ok");
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
    openVersionCompleteModal(batch);
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

  if (action === "generate") {
    state.activeTaskId = task.id;
    state.generationBatchId = task.batchId || "";
    state.activeBatchId = task.batchId || state.activeBatchId;
    state.activeModuleId = task.moduleId || state.activeModuleId;
    persist();
    renderAll();
    switchTab("upload");
    setGenerationStatus(`已选择任务：${task.name || "未命名任务"}。请提供测试材料后生成用例。`, "neutral");
    if (els.sourceType.value === "url") {
      els.sourceUrl.focus();
    } else if (els.sourceType.value === "text") {
      els.sourceText?.focus();
    } else {
      els.documentUploadBox?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return;
  }

  if (action === "execute") {
    state.activeTaskId = task.id;
    state.generationBatchId = task.batchId || "";
    state.activeBatchId = task.batchId || state.activeBatchId;
    if (els.caseTaskFilter) {
      els.caseTaskFilter.value = task.name || "";
    }
    activeExecutionCaseId = "";
    persist();
    renderAll();
    switchTab("cases");
    setCaseActionStatus(`已打开任务「${task.name || "未命名任务"}」的测试用例。`, "neutral");
    showToast(`已进入「${task.name || "未命名任务"}」执行页`, "ok");
    return;
  }

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
      els.createTaskBtn.textContent = "创建任务";
      autoResizeTextarea();
    }
    persist();
    renderAll();
    setGenerationStatus(`已删除任务：${task.name}。`, "warn");
  }
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
  const taskFilter = els.caseTaskFilter.value.trim().toLowerCase();
  const progressScope = state.cases.filter((item) => matchesCaseTaskSearch(item, taskFilter));
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
        ${state.cases.length ? `<button class="ghost-button" type="button" data-clear-case-filters>清空筛选</button>` : ""}
      </div>
    `;
    els.caseExecutionWorkspace.innerHTML = `
      <div class="case-runner-empty">
        <span class="case-runner-empty-icon">✓</span>
        <strong>等待选择用例</strong>
        <p>${state.cases.length ? "清空筛选后继续选择要执行的用例。" : "有可执行用例后，会在这里展示步骤和执行按钮。"}</p>
      </div>
    `;
    els.caseList.querySelector("[data-clear-case-filters]")?.addEventListener("click", () => {
      els.caseTaskFilter.value = "";
      if (els.caseStatusFilter) els.caseStatusFilter.value = "";
      activeExecutionCaseId = "";
      renderCases();
      setCaseActionStatus("已清空筛选，当前显示全部测试用例。", "neutral");
    });
    return;
  }

  els.caseList.innerHTML = filtered.map((item, index) => {
    const status = item.executionStatus || "未执行";
    const tone = getManualExecutionTone(status);
    const priority = item.priority || "P2";
    return `
      <button class="case-browser-item status-${tone} ${item.id === activeExecutionCaseId ? "is-active" : ""}" type="button" data-execution-case-id="${item.id}">
        <span class="case-browser-index">${String(index + 1).padStart(2, "0")}</span>
        <span class="case-browser-item-copy">
          <strong>${escapeHtml(item.title || "未命名用例")}</strong>
          <small>
            <span class="case-priority-chip ${getCasePriorityClass(priority)}">${escapeHtml(priority)}</span>
            <span class="case-browser-task">${escapeHtml(item.taskName || "未分任务")}</span>
          </small>
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
  const priority = item.priority || "P2";
  const currentIndex = filteredCases.findIndex((caseItem) => caseItem.id === item.id);
  const previousCase = filteredCases[currentIndex - 1];
  const nextCase = filteredCases[currentIndex + 1];
  const needsBugFollowup = ["失败", "阻塞"].includes(status);

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
            <span>任务：${escapeHtml(item.taskName || "未分任务")}</span>
            <span class="case-priority-chip ${getCasePriorityClass(priority)}">优先级 ${escapeHtml(priority)}</span>
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
        <button class="execution-result-button result-pass" type="button" data-case-result="通过">通过</button>
        <button class="execution-result-button result-fail" type="button" data-case-result="失败">失败</button>
      </div>
      <div class="execution-secondary-actions">
        <button class="ghost-button" type="button" data-case-result="未执行">重置为未执行</button>
        <button class="ghost-button blocked-action" type="button" data-case-result="阻塞">标记阻塞</button>
        ${needsBugFollowup ? `<button class="ghost-button case-bug-action" type="button" data-current-case-to-bug>转为 BUG</button>` : ""}
      </div>

      ${needsBugFollowup ? `
        <section class="execution-followup-panel status-${tone}">
          <div>
            <strong>${status === "失败" ? "这个结果需要缺陷跟进" : "这个阻塞需要记录原因"}</strong>
            <p>${status === "失败"
              ? "创建 BUG 后会自动带上版本、任务、用例标题、前置条件、步骤和预期结果。"
              : "如果阻塞来自环境、数据、权限或接口依赖，建议建 BUG/问题单，避免报告里只剩一个状态。"}
            </p>
          </div>
          <button class="primary-button" type="button" data-current-case-to-bug>${status === "失败" ? "创建关联 BUG" : "记录阻塞问题"}</button>
        </section>
      ` : ""}

      <footer class="execution-case-navigation">
        <button class="ghost-button" type="button" data-previous-case ${previousCase ? "" : "disabled"}>上一条</button>
        <span>切换用例不会离开当前执行区域</span>
        <button class="ghost-button" type="button" data-next-case ${nextCase ? "" : "disabled"}>下一条</button>
      </footer>
    </article>
  `;

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
  els.caseExecutionWorkspace.querySelectorAll("[data-current-case-to-bug]").forEach((button) => {
    button.addEventListener("click", () => {
      createBugRecord(item);
    });
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
  const visibleCases = getFilteredCasesForView();
  const nextCaseId = getNextExecutionCaseId(visibleCases, item.id, nextStatus);
  updateCaseExecutionState(item, nextStatus);
  activeExecutionCaseId = nextCaseId;
  if (nextStatus !== "通过" && els.caseStatusFilter?.value && els.caseStatusFilter.value !== nextStatus) {
    els.caseStatusFilter.value = "";
  }
  persist();
  renderCases();
  renderQuickStats();
  renderReport();
  const movedToNext = nextStatus === "通过" && nextCaseId !== item.id;
  const message = movedToNext
    ? `「${item.title || "未命名用例"}」已通过，已自动进入下一条。`
    : nextStatus === "通过"
      ? `「${item.title || "未命名用例"}」已通过，当前已是最后一条。`
      : nextStatus === "失败"
        ? `已标记失败：可以直接创建关联 BUG，系统会自动带出当前用例上下文。`
        : nextStatus === "阻塞"
          ? `已标记阻塞：建议补充备注，并按需记录阻塞问题。`
          : `已将「${item.title || "未命名用例"}」更新为“${nextStatus}”，当前用例保持不变。`;
  setCaseActionStatus(message, nextStatus === "失败" ? "warn" : "ok");
}

function getNextExecutionCaseId(cases, currentCaseId, nextStatus) {
  if (nextStatus !== "通过") {
    return currentCaseId;
  }
  const currentIndex = cases.findIndex((item) => item.id === currentCaseId);
  return cases[currentIndex + 1]?.id || currentCaseId;
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
