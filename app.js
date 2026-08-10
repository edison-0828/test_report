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
// ⚠️ SHARED_STATE_KEYS 必须与 server.js sanitizeSharedState() 逐项对齐，
//    任一边漏加 = 该集合被服务端静默丢弃（历史 F1 的成因）。改一处必须同步改另一处。
const SHARED_STATE_KEYS = ["documents", "cases", "bugs", "batches", "tasks", "reportConclusion", "reportConclusions", "lastGeneration", "basicCaseLibrary", "testPlans", "caseExecutions", "reviewTickets", "caseDirectories", "caseVersions", "_rev"];
const LOCAL_STATE_KEYS = ["activeBatchId", "generationBatchId", "activeTaskId", "activeModuleId", "activeReportBatchId", "settings", "uiMode", "selfTestSnapshot", "caseQualityReports", "caseQualityCasesByBusiness", "caseQualityBusiness", "basicCaseBusiness", "basicCaseModule", "uiAutomationSettings", "uiAutomationSession", "tcmActiveSubTab", "tcmLibraryFilters", "tcmTreeExpanded", "tcmActivePlanId", "tcmActiveRound", "tcmExecutionScope", "tcmDashboardWindow", "tcmCaseCatalogConfig"];
// TCM 托管的共享集合：加载共享态时空远端值不覆盖本地（详见 applySharedState）。
const TCM_SHARED_COLLECTIONS = ["basicCaseLibrary", "testPlans", "caseExecutions", "reviewTickets", "caseDirectories", "caseVersions"];
const DEFAULT_WORKSPACE_VERSION = "默认工作区";
const DEFAULT_AI_MODEL = "gpt-5.4";
const CASE_QUALITY_BUSINESSES = ["VA业务", "卡收单业务"];
const BASIC_CASE_BUSINESSES = ["本地收款", "本地付款", "卡收单", "代付（国际付款）", "VA账户"];
/**
 * 用例库「全部业务」作用域哨兵值，与 tcm-core.js 的 `TCM.const.ALL_BUSINESS` 保持一致。
 * 它是视图作用域而非业务线，只会出现在 `state.basicCaseBusiness` 上，绝不会写进用例的 business 字段。
 */
const BASIC_CASE_ALL_BUSINESS = "__ALL__";
/** 「全部业务」作用域在界面上的展示文案，与 `TCM.const.ALL_BUSINESS_LABEL` 保持一致。 */
const BASIC_CASE_ALL_BUSINESS_LABEL = "全部业务";

/**
 * 归一化用例库业务作用域：空值 / 非法值 / 哨兵值一律回落到「全部业务」。
 * @param {*} value 待归一化的作用域值
 * @returns {string} `BASIC_CASE_ALL_BUSINESS` 或一条合法业务线
 */
function normalizeBasicCaseBusinessScope(value) {
  return BASIC_CASE_BUSINESSES.includes(value) ? value : BASIC_CASE_ALL_BUSINESS;
}
const BASIC_CASE_TO_MODULE = {
  "本地收款": "本地收单业务",
  "本地付款": "本地收单业务",
  "卡收单": "卡收单业务",
  "代付（国际付款）": "代付业务",
  "VA账户": "VA业务"
};
const BASIC_CASE_STATUSES = ["草稿", "待评审", "已确认", "已废弃"];
const BASIC_CASE_STATUS_TONE = {
  "草稿": "tone-gray",
  "待评审": "tone-orange",
  "已确认": "tone-green",
  "已废弃": "tone-red"
};
const BASIC_CASE_SORT_KEYS = ["title", "priority", "status", "category"];
let basicCaseSort = { key: "title", dir: "asc" };
let basicCaseSelection = new Set();
let basicCaseExpanded = new Set(BASIC_CASE_BUSINESSES);
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

// —— 向测试用例管理模块（TCM）暴露宿主状态 ——
// app.js 用 const 声明 state，不会自动挂到 window；而 TCM.store 默认从
// global.state 读取共享集合（basicCaseLibrary / caseDirectories 等），
// tcm-core 的工具函数也可能直接回退到 global.state。这里显式挂载并注册
// 状态提供者，确保 TCM 读写共享集合时与宿主 state 同源，避免视图读不到数据。
window.state = state;
if (window.TCM && window.TCM.store && typeof window.TCM.store.setStateProvider === "function") {
  window.TCM.store.setStateProvider(function () { return state; });
}

let activeAutomationEditorCaseId = null;
let apiSettingsDrawerReady = false;
let apiSettingsOpen = false;
let apiSettingsReturnFocus = null;

const els = {
  navLinks: [...document.querySelectorAll(".nav-link:not(.nav-sub-item)")],
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
  basicCaseTree: document.getElementById("basicCaseTree"),
  basicCaseBusinessTitle: document.getElementById("basicCaseBusinessTitle"),
  basicCaseBusinessNote: document.getElementById("basicCaseBusinessNote"),
  basicCaseCount: document.getElementById("basicCaseCount"),
  basicCaseSortSelect: document.getElementById("basicCaseSortSelect"),
  basicCaseStatusFilter: document.getElementById("basicCaseStatusFilter"),
  basicCaseStatus: document.getElementById("basicCaseStatus"),
  basicCaseList: document.getElementById("basicCaseList"),
  basicCaseBatchBar: document.getElementById("basicCaseBatchBar"),
  basicCaseSelectedCount: document.getElementById("basicCaseSelectedCount"),
  basicCaseActiveFilters: document.getElementById("basicCaseActiveFilters"),
  basicCaseTreeCollapse: document.getElementById("basicCaseTreeCollapse"),
  basicCaseNavSubmenu: document.getElementById("basicCaseNavSubmenu"),
  navParentBasicCases: document.querySelector(".nav-parent[data-tab='basicCases']"),
  basicCaseLayout: document.getElementById("basicCaseLayout"),
  addBasicCaseBtnInline: document.getElementById("addBasicCaseBtnInline"),
  batchReviewBtn: document.getElementById("batchReviewBtn"),
  batchPlanBtn: document.getElementById("batchPlanBtn"),
  batchPlanSelectWrap: document.getElementById("batchPlanSelectWrap"),
  batchPlanSelect: document.getElementById("batchPlanSelect"),
  batchCopyBtn: document.getElementById("batchCopyBtn"),
  batchDeleteBtn: document.getElementById("batchDeleteBtn"),
  batchClearBtn: document.getElementById("batchClearBtn"),
  basicCaseModal: document.getElementById("basicCaseModal"),
  basicCaseModalTitle: document.getElementById("basicCaseModalTitle"),
  basicCaseModalBadges: document.getElementById("basicCaseModalBadges"),
  basicCaseModalFeedback: document.getElementById("basicCaseModalFeedback"),
  bcTitle: document.getElementById("bcTitle"),
  bcBusiness: document.getElementById("bcBusiness"),
  bcPriority: document.getElementById("bcPriority"),
  bcStatus: document.getElementById("bcStatus"),
  bcCategory: document.getElementById("bcCategory"),
  bcComponent: document.getElementById("bcComponent"),
  bcTags: document.getElementById("bcTags"),
  bcObjective: document.getElementById("bcObjective"),
  bcPreconditions: document.getElementById("bcPreconditions"),
  bcTestData: document.getElementById("bcTestData"),
  bcSteps: document.getElementById("bcSteps"),
  bcExpected: document.getElementById("bcExpected"),
  bcPlans: document.getElementById("bcPlans"),
  bcDefects: document.getElementById("bcDefects"),
  bcHistoryList: document.getElementById("bcHistoryList"),
  bcHistoryForm: document.getElementById("bcHistoryForm"),
  bcHistoryResult: document.getElementById("bcHistoryResult"),
  bcHistoryExecutor: document.getElementById("bcHistoryExecutor"),
  bcHistoryNote: document.getElementById("bcHistoryNote"),
  saveBasicCaseModal: document.getElementById("saveBasicCaseModal"),
  cancelBasicCaseModal: document.getElementById("cancelBasicCaseModal"),
  closeBasicCaseModal: document.getElementById("closeBasicCaseModal"),
  bcAddHistory: document.getElementById("bcAddHistory"),
  bcHistorySave: document.getElementById("bcHistorySave"),
  bcHistoryCancel: document.getElementById("bcHistoryCancel"),
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
mountTcmShell();
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
    if (event.key === "Escape" && !els.basicCaseModal?.classList.contains("hidden-field")) {
      closeCaseModal();
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
  els.basicCaseSortSelect?.addEventListener("change", () => setBasicCaseSort(els.basicCaseSortSelect.value));
  els.basicCaseSearchInput?.addEventListener("input", renderBasicCaseLibrary);
  els.basicCasePriorityFilter?.addEventListener("change", renderBasicCaseLibrary);
  els.basicCaseStatusFilter?.addEventListener("change", renderBasicCaseLibrary);

  /* UX: 目录面板可收起 + 状态持久化 */
  const restoreTreeCollapsed = () => {
    let collapsed = false;
    try {
      collapsed = localStorage.getItem("basicCaseTreeCollapsed") === "1";
    } catch (e) { /* localStorage 不可用时忽略 */ }
    if (collapsed && els.basicCaseLayout) {
      els.basicCaseLayout.classList.add("tree-collapsed");
      if (els.basicCaseTreeCollapse) {
        els.basicCaseTreeCollapse.textContent = "›";
        els.basicCaseTreeCollapse.setAttribute("title", "展开目录");
        els.basicCaseTreeCollapse.setAttribute("aria-label", "展开目录");
      }
    }
  };
  restoreTreeCollapsed();
  els.basicCaseTreeCollapse?.addEventListener("click", () => {
    if (!els.basicCaseLayout) {
      return;
    }
    const collapsed = els.basicCaseLayout.classList.toggle("tree-collapsed");
    els.basicCaseTreeCollapse.textContent = collapsed ? "›" : "‹";
    els.basicCaseTreeCollapse.setAttribute("title", collapsed ? "展开目录" : "收起目录");
    els.basicCaseTreeCollapse.setAttribute("aria-label", collapsed ? "展开目录" : "收起目录");
    try {
      localStorage.setItem("basicCaseTreeCollapsed", collapsed ? "1" : "0");
    } catch (e) { /* localStorage 不可用时忽略 */ }
  });

  /* UX: 列表标题区主操作入口 */
  els.addBasicCaseBtnInline?.addEventListener("click", () => openCaseModal(""));

  /* 基础用例库导航子菜单：父级展开/收起 + 子项切换业务分组 */
  els.navParentBasicCases?.querySelector(".nav-parent-btn")?.addEventListener("click", () => {
    const parent = els.navParentBasicCases;
    const panel = document.getElementById("basicCases");
    const isActive = panel?.classList.contains("active");
    if (!isActive) {
      /* 首次进入：展开子菜单并切换到该 tab */
      parent.setAttribute("aria-expanded", "true");
      const submenu = parent.querySelector(".nav-submenu");
      if (submenu) {
        submenu.hidden = false;
      }
      switchTab("basicCases");
      return;
    }
    /* 已在当前 tab：切换子菜单展开/收起 */
    const expanded = parent.getAttribute("aria-expanded") !== "false";
    parent.setAttribute("aria-expanded", String(!expanded));
    const submenu = parent.querySelector(".nav-submenu");
    if (submenu) {
      submenu.hidden = expanded;
    }
  });
  els.basicCaseNavSubmenu?.addEventListener("click", (event) => {
    const subItem = event.target.closest(".nav-sub-item");
    if (!subItem) return;
    event.stopPropagation();
    const business = subItem.dataset.business;
    if (!business) return;
    state.basicCaseBusiness = normalizeBasicCaseBusinessScope(business);
    state.basicCaseModule = "";
    basicCaseSelection.clear();
    persist();
    /* 子菜单在侧边栏常驻，点击必须确保目标 tab 可见，否则列表渲染进隐藏面板看起来"没数据" */
    switchTab("basicCases");
    renderBasicCaseNavSubmenu();
    renderBasicCaseLibrary();
    renderBasicCaseTree();
  });

  els.basicCaseTree?.addEventListener("click", (event) => {
    const businessEl = event.target.closest(".bct-business");
    if (!businessEl) {
      return;
    }
    const business = businessEl.dataset.business;
    if (event.target.closest(".bct-toggle")) {
      if (basicCaseExpanded.has(business)) {
        basicCaseExpanded.delete(business);
      } else {
        basicCaseExpanded.add(business);
      }
      renderBasicCaseTree();
      return;
    }
    const moduleEl = event.target.closest(".bct-module");
    if (moduleEl) {
      setBasicCaseModule(moduleEl.dataset.business, moduleEl.dataset.module);
      return;
    }
    setBasicCaseModule(business, "");
  });
  els.basicCaseList?.addEventListener("click", (event) => {
    const detailButton = event.target.closest("[data-detail]");
    if (detailButton) {
      openCaseModal(detailButton.dataset.detail);
      return;
    }
    const copyButton = event.target.closest(".copy-basic-case");
    if (copyButton) {
      duplicateBasicCase(copyButton.dataset.id);
      return;
    }
    const reviewButton = event.target.closest(".review-basic-case");
    if (reviewButton) {
      reviewBasicCase(reviewButton.dataset.id);
      return;
    }
    const deleteButton = event.target.closest(".delete-basic-case");
    if (deleteButton) {
      deleteBasicCase(deleteButton.dataset.id);
    }
  });
  els.basicCaseList?.addEventListener("change", (event) => {
    const check = event.target.closest(".bcl-check");
    if (!check) {
      return;
    }
    const id = check.dataset.id;
    if (check.checked) {
      basicCaseSelection.add(id);
    } else {
      basicCaseSelection.delete(id);
    }
    const row = check.closest(".bcl-row");
    if (row) {
      row.classList.toggle("selected", check.checked);
    }
    updateBasicCaseBatchBar();
  });
  els.batchReviewBtn?.addEventListener("click", batchReviewBasicCases);
  els.batchCopyBtn?.addEventListener("click", batchCopyBasicCases);
  els.batchDeleteBtn?.addEventListener("click", batchDeleteBasicCases);
  els.batchClearBtn?.addEventListener("click", () => {
    basicCaseSelection.clear();
    renderBasicCaseLibrary();
  });
  els.batchPlanBtn?.addEventListener("click", () => {
    if (!els.batchPlanSelectWrap) {
      return;
    }
    if (els.batchPlanSelectWrap.classList.contains("hidden-field")) {
      populateBatchPlanSelect();
      els.batchPlanSelectWrap.classList.remove("hidden-field");
    } else {
      els.batchPlanSelectWrap.classList.add("hidden-field");
    }
  });
  els.batchPlanSelect?.addEventListener("change", () => {
    const planId = els.batchPlanSelect.value;
    if (planId) {
      batchAddPlanToSelected(planId);
      els.batchPlanSelectWrap?.classList.add("hidden-field");
      els.batchPlanSelect.value = "";
    }
  });

  /* 用例弹层事件 */
  els.closeBasicCaseModal?.addEventListener("click", closeCaseModal);
  els.cancelBasicCaseModal?.addEventListener("click", closeCaseModal);
  els.saveBasicCaseModal?.addEventListener("click", saveCaseModal);
  els.basicCaseModal?.addEventListener("click", (event) => {
    if (event.target === els.basicCaseModal) {
      closeCaseModal();
    }
  });
  els.bcAddHistory?.addEventListener("click", () => els.bcHistoryForm?.classList.remove("hidden-field"));
  els.bcHistoryCancel?.addEventListener("click", () => {
    els.bcHistoryForm?.classList.add("hidden-field");
    if (els.bcHistoryNote) els.bcHistoryNote.value = "";
    if (els.bcHistoryExecutor) els.bcHistoryExecutor.value = "";
  });
  els.bcHistorySave?.addEventListener("click", addBasicCaseHistoryRecord);
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
    if (!(key in nextState)) {
      return;
    }
    // 用例管理模块（TCM）托管的集合：当远端返回的是空数组/空对象时，
    // 保留本地已有的种子数据或已录入数据，避免「加载共享态」把本地理应可见的
    // 用例库 / 计划 / 执行等清空（修复 T02 用例库读不到种子数据的问题）。
    if (TCM_SHARED_COLLECTIONS.includes(key) && !hasMeaningfulValue(nextState[key])) {
      return;
    }
    state[key] = structuredCloneSafe(nextState[key]);
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
  if (!Array.isArray(state.basicCaseLibrary)) {
    state.basicCaseLibrary = [];
  }
  state.basicCaseLibrary = state.basicCaseLibrary.map((item) => normalizeBasicCaseItem(item));
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

  // 加载 / 播种完成后统一走 TCM Schema 迁移，保证 6 个集合被归一化（幂等，可重复执行）。
  normalizeTcmLocalPreferences(state);
  runTcmMigration(state);
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
        businessName: state.caseQualityBusiness,
        qualityRules: serializeCaseQualityRulesForAi(state.caseQualityBusiness),
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
    caseNo: item.caseNo || item.caseId || item.externalId || "",
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

function buildCasesCsvExport(cases, activeTask, documentName) {
  const headers = ["测试任务", "标题", "类型", "优先级", "前置条件", "步骤", "预期结果", "执行备注"];
  const rows = cases.map((item) => [
    item.taskName || activeTask?.name || "",
    item.title || "",
    item.type || "",
    item.priority || "",
    item.preconditions || "",
    item.steps || "",
    item.expected || "",
    item.executionNote || ""
  ]);

  const taskNames = [...new Set(cases.map((item) => String(item.taskName || "").trim()).filter(Boolean))];
  const taskName = taskNames.length === 1
    ? taskNames[0]
    : taskNames.length > 1
      ? "多个测试任务"
      : activeTask?.name || documentName || "测试任务";

  return {
    headers,
    rows,
    fileBaseName: `${taskName}-测试用例`
  };
}

function downloadCasesCsv(cases, activeTask, documentName) {
  const { headers, rows, fileBaseName } = buildCasesCsvExport(cases, activeTask, documentName);

  const csv = [headers, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\r\n");

  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
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

  const taskFilter = els.caseTaskFilter?.value.trim() || "";
  const activeTask = state.tasks.find((item) => item.name === taskFilter) || getTaskById(state.activeTaskId);
  downloadCasesCsv(filteredCases, activeTask, state.lastGeneration?.documentName || "测试任务");
  setCaseActionStatus(`已导出 ${filteredCases.length} 条当前筛选结果里的测试用例。`, "ok");
}

function downloadCaseTemplateCsv() {
  const activeTask = getTaskById(state.activeTaskId);
  const headers = [
    "测试任务",
    "标题",
    "类型",
    "优先级",
    "前置条件",
    "步骤",
    "预期结果",
    "执行备注"
  ];
  const exampleRow = [
    activeTask?.name || "",
    "",
    "正常",
    "P2",
    "",
    "",
    "",
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

/**
 * 挂载 TCM 子 Tab 壳层（只在启动时执行一次）。
 * 壳层内部会顺带挂载编辑抽屉，并负责按需 mount 各视图模块。
 * @returns {void}
 */
function mountTcmShell() {
  if (!window.TCM || !window.TCM.shell || typeof window.TCM.shell.mount !== "function") {
    console.warn("[app] TCM 壳层未加载，基础用例库回退到重构前的旧视图。");
    return;
  }
  try {
    window.TCM.shell.mount(document.getElementById("basicCases"));
  } catch (error) {
    console.error("[app] TCM 壳层挂载失败：", error);
  }
}

function renderAll() {
  renderOnboarding();
  renderMetaControls();
  renderVersionManager();
  renderTaskManager();
  renderQuickStats();
  renderCaseQuality();
  renderBasicCaseLibrary();
  renderBasicCaseTree();
  renderBasicCaseNavSubmenu();
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

function seedBasicCaseLibrary() {
  const today = new Date().toISOString().slice(0, 10);
  const samples = [
    {
      business: "本地收款",
      title: "本地收款-入账成功主流程",
      product: "收款核心",
      module: "入账",
      type: "功能",
      priority: "P0",
      status: "已确认",
      category: "入账",
      component: "收款核心",
      tags: ["主流程", "P0回归"],
      objective: "验证本地收款从创建到入账的完整体验，资金正确进入可用余额。",
      preconditions: "账户已完成 KYC 认证，本地收款渠道已开通，商户余额充足。",
      testData: "商户号 M1001；金额 100.00 CNY；币种 CNY。",
      steps: "1. 调用本地收款创建接口，传入收款金额与币种\n2. 渠道侧完成扣款并返回成功回调\n3. 查询订单状态",
      expected: "订单状态变为「已入账」，资金进入可用余额，生成收款流水号。"
    },
    {
      business: "本地收款",
      title: "本地收款-重复回调幂等",
      product: "收款核心",
      module: "幂等",
      type: "功能",
      priority: "P1",
      status: "已确认",
      category: "幂等",
      component: "回调处理",
      tags: ["幂等", "边界"],
      objective: "验证重复回调不会导致重复入账。",
      preconditions: "已有一笔处理中的本地收款订单。",
      testData: "同一 notifyId 发送两次。",
      steps: "1. 渠道第一次回调通知成功\n2. 渠道因超时再次发送相同回调\n3. 查询订单与流水",
      expected: "系统仅入账一次，第二次回调被幂等丢弃，不产生重复流水。"
    },
    {
      business: "本地付款",
      title: "本地付款-单笔代付成功",
      product: "付款核心",
      module: "代付",
      type: "功能",
      priority: "P0",
      status: "已确认",
      category: "代付",
      component: "付款核心",
      tags: ["主流程"],
      objective: "验证单笔本地付款从申请到汇出的完整链路。",
      preconditions: "付款账户余额充足，收款方信息已校验通过。",
      testData: "付款金额 500.00 CNY；收款方 ACCT-2024。",
      steps: "1. 提交单笔本地付款申请\n2. 风控审核通过\n3. 渠道受理并完成打款\n4. 查询付款状态",
      expected: "付款状态变为「已汇出」，收款方到账，生成付款凭证。"
    },
    {
      business: "本地付款",
      title: "本地付款-余额不足失败",
      product: "付款核心",
      module: "失败处理",
      type: "功能",
      priority: "P1",
      status: "待评审",
      category: "失败处理",
      component: "付款核心",
      tags: ["边界", "失败"],
      objective: "验证余额不足时付款申请被正确拦截。",
      preconditions: "付款账户余额低于申请金额。",
      testData: "账户余额 1.00 CNY；申请金额 1000.00 CNY。",
      steps: "1. 提交本地付款申请\n2. 系统校验余额",
      expected: "申请被拦截并置为「失败」，提示余额不足，不发起渠道打款。"
    },
    {
      business: "卡收单",
      title: "卡收单-支付成功与 3DS",
      product: "收单网关",
      module: "支付",
      type: "功能",
      priority: "P0",
      status: "已确认",
      category: "支付",
      component: "收单网关",
      tags: ["主流程", "3DS"],
      objective: "验证卡收单支付在 3DS 验证后授权成功。",
      preconditions: "已绑定测试卡，商户开通卡收单产品。",
      testData: "测试卡 4111****1111；金额 200.00 CNY。",
      steps: "1. 发起卡收单支付\n2. 跳转 3DS 验证页完成验证\n3. 渠道返回授权成功\n4. 查询交易状态",
      expected: "交易状态变为「支付成功」，授权码有效，生成收单流水。"
    },
    {
      business: "卡收单",
      title: "卡收单-拒付与退款",
      product: "收单网关",
      module: "退款",
      type: "功能",
      priority: "P1",
      status: "待评审",
      category: "退款",
      component: "收单网关",
      tags: ["退款", "边界"],
      objective: "验证已支付交易可发起退款并冲正。",
      preconditions: "已有一笔支付成功的卡收单交易。",
      testData: "原交易号 T2024；退款金额 200.00 CNY。",
      steps: "1. 对该交易发起退款\n2. 渠道受理退款\n3. 查询退款状态",
      expected: "退款状态变为「已退款」，原交易部分冲正，资金退回持卡人。"
    },
    {
      business: "代付（国际付款）",
      title: "国际付款-跨境代付成功",
      product: "跨境清算",
      module: "跨境代付",
      type: "功能",
      priority: "P0",
      status: "已确认",
      category: "跨境代付",
      component: "跨境清算",
      tags: ["主流程", "外汇"],
      objective: "验证国际付款跨境代付按锁定汇率结算成功。",
      preconditions: "已配置外汇通道，收款方境外账户信息正确。",
      testData: "金额 1000.00 USD；锁定汇率 7.18。",
      steps: "1. 提交国际付款代付申请并锁定汇率\n2. 完成合规与风控审核\n3. 渠道跨境清算成功\n4. 查询付款状态",
      expected: "付款状态变为「已汇出」，按锁定汇率结算，生成跨境付款凭证。"
    },
    {
      business: "代付（国际付款）",
      title: "国际付款-合规拦截",
      product: "跨境清算",
      module: "合规",
      type: "功能",
      priority: "P1",
      status: "草稿",
      category: "合规",
      component: "合规风控",
      tags: ["合规", "拦截"],
      objective: "验证命中制裁名单的付款被合规拦截。",
      preconditions: "收款方命中制裁名单或高风险地区。",
      testData: "收款方 ID SDN-009。",
      steps: "1. 提交国际付款代付申请\n2. 触发合规校验",
      expected: "申请被合规规则拦截并置为「审核拒绝」，不进入清算。"
    },
    {
      business: "VA账户",
      title: "VA-虚拟账户生成与入账",
      product: "VA 核心",
      module: "虚拟账户",
      type: "功能",
      priority: "P0",
      status: "已确认",
      category: "虚拟账户",
      component: "VA 核心",
      tags: ["主流程"],
      objective: "验证 VA 生成与入账关联的正确性。",
      preconditions: "已开通 VA 虚拟账户产品，用户完成开户。",
      testData: "用户 U8821；VA 号 VA-7788。",
      steps: "1. 为用户生成专属虚拟账户（VA 号）\n2. 通过 VA 号发起入账\n3. 查询虚拟账户余额",
      expected: "虚拟账户生成唯一 VA 号，入账后余额增加，流水与用户正确关联。"
    },
    {
      business: "VA账户",
      title: "VA-入账自动认领",
      product: "VA 核心",
      module: "自动认领",
      type: "功能",
      priority: "P1",
      status: "待评审",
      category: "自动认领",
      component: "VA 核心",
      tags: ["认领", "自动化"],
      objective: "验证未认领流水可按 VA 号自动认领。",
      preconditions: "存在一笔未认领的 VA 入账流水。",
      testData: "待认领流水 FLOW-55；VA 号 VA-7788。",
      steps: "1. 收款流水进入 VA 待认领池\n2. 系统按 VA 号自动匹配用户\n3. 查询认领结果",
      expected: "流水自动认领到对应用户，状态变为「已认领」，无需人工干预。"
    }
  ];
  return samples.map((item, index) => normalizeBasicCaseItem({
    id: `basic-seed-${index + 1}`,
    createdAt: today,
    ...item
  }));
}

function normalizeBasicCaseItem(item) {
  const raw = item || {};
  const business = BASIC_CASE_BUSINESSES.includes(raw.business)
    ? raw.business
    : BASIC_CASE_BUSINESSES[0];
  const status = BASIC_CASE_STATUSES.includes(raw.status) ? raw.status : "草稿";
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((tag) => String(tag).trim()).filter(Boolean)
    : String(raw.tags || "")
        .split(/[,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean);
  const testPlans = Array.isArray(raw.testPlans)
    ? raw.testPlans.map((plan) => String(plan)).filter(Boolean)
    : [];
  const executionHistory = Array.isArray(raw.executionHistory)
    ? raw.executionHistory.map((record) => ({
        date: String(record?.date || new Date().toISOString().slice(0, 10)),
        executor: String(record?.executor || "—"),
        result: String(record?.result || "通过"),
        note: String(record?.note || "")
      }))
    : [];
  const linkedDefects = Array.isArray(raw.linkedDefects)
    ? raw.linkedDefects.map((defect) => ({
        id: String(defect?.id || ""),
        title: String(defect?.title || "")
      })).filter((defect) => defect.id || defect.title)
    : [];
  const base = {
    id: String(raw.id || `basic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    business,
    title: String(raw.title || "未命名基础用例").trim(),
    objective: String(raw.objective || "").trim(),
    preconditions: String(raw.preconditions || "").trim(),
    testData: String(raw.testData || "").trim(),
    steps: String(raw.steps || "").trim(),
    expected: String(raw.expected || "").trim(),
    priority: ["P0", "P1", "P2", "P3"].includes(raw.priority) ? raw.priority : "P1",
    status,
    category: String(raw.category || "").trim(),
    component: String(raw.component || "").trim(),
    tags,
    testPlans,
    executionHistory,
    linkedDefects,
    createdAt: raw.createdAt || new Date().toISOString().slice(0, 10)
  };

  // TCM 已加载时交给 Model 层补齐新字段（product/module/type/version/linkedBatchIds 等）。
  // 注意：raw 在前、base 在后，保证 raw 上的新字段不丢，同时既有字段以本函数的归一化结果为准。
  const tcm = typeof window !== "undefined" ? window.TCM : null;
  if (tcm && tcm.model && typeof tcm.model.normalizeCaseAsset === "function") {
    return tcm.model.normalizeCaseAsset({ ...raw, ...base });
  }
  return base;
}

function setBasicCaseBusiness(value) {
  const nextBusiness = normalizeBasicCaseBusinessScope(value);
  state.basicCaseBusiness = nextBusiness;
  state.basicCaseModule = "";
  basicCaseSelection.clear();
  persist();
  renderBasicCaseTree();
  renderBasicCaseLibrary();
}

function setBasicCaseModule(business, module) {
  const nextBusiness = normalizeBasicCaseBusinessScope(business);
  state.basicCaseBusiness = nextBusiness;
  state.basicCaseModule = (typeof module === "string" && module !== "") ? module : "";
  basicCaseSelection.clear();
  persist();
  renderBasicCaseTree();
  renderBasicCaseLibrary();
}

/* ------------------------------------------------------------------ *
 * T02 · 用例库视图重构：以下 4 个入口全部改为「薄委托」。
 *
 * 真正的渲染由 tcm/tcm-shell.js（子 Tab 壳）+ tcm/tcm-library.js（用例库视图）
 * + tcm/tcm-case-editor.js（编辑抽屉）负责；app.js 只保留函数签名与调用点，
 * 保证既有 700+ 处调用不需要改动。
 *
 * 每个委托都保留 `Legacy` 后缀的旧实现作为降级分支：
 * 只有当 TCM 脚本加载失败（window.TCM 缺失）时才会走到旧实现，避免白屏。
 * ------------------------------------------------------------------ */

/**
 * 判断 TCM 壳层是否可用。
 * @returns {boolean} 可用返回 true
 */
function isTcmShellReady() {
  return Boolean(window.TCM && window.TCM.shell && typeof window.TCM.shell.renderActive === "function");
}

/**
 * 判断 TCM 用例库视图是否可用。
 * @returns {boolean} 可用返回 true
 */
function isTcmLibraryReady() {
  return Boolean(window.TCM && window.TCM.library && typeof window.TCM.library.render === "function");
}

/**
 * 渲染「基础用例库」面板（薄委托 → TCM.shell.renderActive）。
 * @returns {void}
 */
function renderBasicCaseLibrary() {
  if (isTcmShellReady()) {
    window.TCM.shell.renderActive();
    return;
  }
  renderBasicCaseLibraryLegacy();
}

function renderBasicCaseLibraryLegacy() {
  if (!els.basicCaseList) {
    return;
  }

  const isAllScope = state.basicCaseBusiness === BASIC_CASE_ALL_BUSINESS;
  const businessName = isAllScope
    ? BASIC_CASE_ALL_BUSINESS_LABEL
    : (BASIC_CASE_BUSINESSES.includes(state.basicCaseBusiness) ? state.basicCaseBusiness : BASIC_CASE_BUSINESSES[0]);
  const allCases = Array.isArray(state.basicCaseLibrary) ? state.basicCaseLibrary : [];
  const searchTerm = (els.basicCaseSearchInput?.value || "").trim().toLowerCase();
  const priorityFilter = els.basicCasePriorityFilter?.value || "";
  const statusFilter = els.basicCaseStatusFilter?.value || "";
  const moduleFilter = state.basicCaseModule || "";

  if (els.basicCaseBusinessTitle) {
    els.basicCaseBusinessTitle.textContent = businessName;
  }
  if (els.basicCaseBusinessNote) {
    if (isAllScope) {
      els.basicCaseBusinessNote.textContent = moduleFilter
        ? `展示全部业务下「${moduleFilter}」模块的用例。`
        : "展示全部业务线的基础用例，不会按业务筛选。";
    } else {
      const scope = moduleFilter ? `「${businessName} / ${moduleFilter}」` : `「${businessName}」`;
      els.basicCaseBusinessNote.textContent = `仅展示${scope}下的基础用例${moduleFilter ? "（该模块）" : "，不会混入其他业务"}。`;
    }
  }
  if (els.basicCaseSortSelect && els.basicCaseSortSelect.value !== basicCaseSort.key) {
    els.basicCaseSortSelect.value = basicCaseSort.key;
  }

  let businessCases = allCases
    .filter((item) => isAllScope || item.business === businessName)
    .filter((item) => !moduleFilter || (item.category || "") === moduleFilter)
    .filter((item) => !priorityFilter || item.priority === priorityFilter)
    .filter((item) => !statusFilter || item.status === statusFilter)
    .filter((item) => {
      if (!searchTerm) {
        return true;
      }
      const haystack = [
        item.title, item.objective, item.preconditions, item.testData,
        item.steps, item.expected, item.category, item.component,
        (item.tags || []).join(" "), (item.testPlans || []).join(" ")
      ].join(" ").toLowerCase();
      return haystack.includes(searchTerm);
    });

  /* 排序 */
  const sortKey = basicCaseSort.key;
  const dir = basicCaseSort.dir === "asc" ? 1 : -1;
  const priorityRank = { P0: 0, P1: 1, P2: 2, P3: 3 };
  const statusRank = { "草稿": 0, "待评审": 1, "已确认": 2, "已废弃": 3 };
  businessCases.sort((a, b) => {
    let av;
    let bv;
    if (sortKey === "priority") {
      av = priorityRank[a.priority] ?? 99;
      bv = priorityRank[b.priority] ?? 99;
    } else if (sortKey === "status") {
      av = statusRank[a.status] ?? 99;
      bv = statusRank[b.status] ?? 99;
    } else {
      av = (a[sortKey] || "").toString();
      bv = (b[sortKey] || "").toString();
      return av.localeCompare(bv, "zh-Hans-CN") * dir;
    }
    if (av === bv) {
      return 0;
    }
    return (av < bv ? -1 : 1) * dir;
  });

  if (els.basicCaseCount) {
    els.basicCaseCount.textContent = `${businessCases.length} 条`;
  }
  if (els.basicCaseStatus) {
    els.basicCaseStatus.textContent = businessCases.length
      ? `当前共 ${businessCases.length} 条「${businessName}」基础用例。`
      : `「${businessName}」下还没有基础用例，点右上角「新增基础用例」开始沉淀。`;
  }

  if (!businessCases.length) {
    els.basicCaseList.innerHTML = `
      <div class="empty-state empty-state-rich">
        <strong>这个业务类型还是空的</strong>
        <p>把常用的标准场景写成基础用例，下次建任务时一键复用。</p>
        <div class="empty-actions">
          <button type="button" class="primary-button" id="basicCaseEmptyAdd">新增基础用例</button>
        </div>
      </div>
    `;
    document.getElementById("basicCaseEmptyAdd")?.addEventListener("click", () => openCaseModal(""));
    renderBasicCaseActiveFilters();
    updateBasicCaseBatchBar();
    renderBasicCaseTree();
    return;
  }

  /* 计划名称映射 */
  const planName = (planId) => {
    const batch = state.batches.find((batch) => batch.id === planId);
    return batch ? (batch.version || batch.name || planId) : planId;
  };

  const statusTone = (status) => BASIC_CASE_STATUS_TONE[status] || "tone-gray";

  els.basicCaseList.innerHTML = businessCases.map((item) => {
    const reviewLabel = getReviewActionLabel(item.status);
    const isSelected = basicCaseSelection.has(item.id);
    const priorityTone = getPriorityTone(item.priority);
    const statusCls = statusTone(item.status);
    const tagChips = (item.tags || []).slice(0, 3)
      .map((tag) => `<span class="bcl-tag">${escapeHtml(tag)}</span>`)
      .join("");
    const planChips = (item.testPlans || []).slice(0, 2)
      .map((planId) => `<span class="bcl-chip">${escapeHtml(planName(planId))}</span>`)
      .join("");
    const planMore = (item.testPlans || []).length > 2
      ? `<span class="bcl-chip ghost">+${item.testPlans.length - 2}</span>`
      : "";
    const planBlock = (item.testPlans && item.testPlans.length)
      ? `${planChips}${planMore}`
      : `<span class="bcl-muted">未关联计划</span>`;
    const fields = [
      { label: "测试目标", value: item.objective },
      { label: "前置条件", value: item.preconditions },
      { label: "测试数据", value: item.testData },
      { label: "操作步骤", value: item.steps },
      { label: "预期结果", value: item.expected },
    ];
    const fieldRows = fields
      .filter((f) => f.value)
      .map(
        (f) =>
          `<div class="bcl-field"><span class="bcl-field-label">${escapeHtml(f.label)}</span><span class="bcl-field-value">${escapeHtml(f.value)}</span></div>`
      )
      .join("");
    return `
      <div class="bcl-row prio-${escapeHtml(item.priority)} ${isSelected ? "selected" : ""}" data-id="${escapeHtml(item.id)}">
        <input type="checkbox" class="bcl-check" data-id="${escapeHtml(item.id)}" ${isSelected ? "checked" : ""} aria-label="选择用例">
        <div class="bcl-main">
          <div class="bcl-titleline">
            ${(tagChips || planBlock) ? `<div class="bcl-chips">${tagChips}${planBlock}</div>` : ""}
            <span class="badge ${priorityTone}">${escapeHtml(item.priority)}</span>
            <span class="badge ${statusCls}">${escapeHtml(item.status)}</span>
            <span class="bcl-title" data-detail="${escapeHtml(item.id)}">${escapeHtml(item.title)}</span>
          </div>
          <div class="bcl-meta">${escapeHtml(item.category || "未分类")} · ${escapeHtml(item.component || "—")}</div>
          ${fieldRows ? `<div class="bcl-fields">${fieldRows}</div>` : ""}
        </div>
        <div class="bcl-actions">
          <button type="button" class="review-btn review-basic-case" data-id="${escapeHtml(item.id)}">${escapeHtml(reviewLabel)}</button>
          <div class="bcl-mini">
            <span class="copy-basic-case" data-id="${escapeHtml(item.id)}">复制</span>
            <span data-detail="${escapeHtml(item.id)}">详情</span>
            <span class="bcl-del delete-basic-case" data-id="${escapeHtml(item.id)}">删除</span>
          </div>
        </div>
      </div>
    `;
  }).join("");
  renderBasicCaseActiveFilters();
  updateBasicCaseBatchBar();
  renderBasicCaseTree();
  renderBasicCaseNavSubmenu();
}

/* UX: 把已激活的筛选条件渲染成可单独清除的标签 */
function renderBasicCaseActiveFilters() {
  if (!els.basicCaseActiveFilters) {
    return;
  }
  const search = (els.basicCaseSearchInput?.value || "").trim();
  const priority = els.basicCasePriorityFilter?.value || "";
  const status = els.basicCaseStatusFilter?.value || "";
  const tags = [];
  if (search) {
    tags.push({ key: "search", label: `搜索：${search}` });
  }
  if (priority) {
    tags.push({ key: "priority", label: `优先级：${priority}` });
  }
  if (status) {
    tags.push({ key: "status", label: `状态：${status}` });
  }
  if (!tags.length) {
    els.basicCaseActiveFilters.innerHTML = "";
    return;
  }
  els.basicCaseActiveFilters.innerHTML = tags.map((tag) => `
    <span class="bcaf-tag">${escapeHtml(tag.label)}<button type="button" class="bcaf-remove" data-key="${tag.key}" aria-label="移除该筛选">×</button></span>
  `).join("") + `<button type="button" class="bcaf-clear-all" data-clear-all>清除全部</button>`;

  els.basicCaseActiveFilters.querySelectorAll("[data-key]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.key;
      if (key === "search" && els.basicCaseSearchInput) els.basicCaseSearchInput.value = "";
      if (key === "priority" && els.basicCasePriorityFilter) els.basicCasePriorityFilter.value = "";
      if (key === "status" && els.basicCaseStatusFilter) els.basicCaseStatusFilter.value = "";
      renderBasicCaseLibrary();
    });
  });
  els.basicCaseActiveFilters.querySelector("[data-clear-all]")?.addEventListener("click", () => {
    if (els.basicCaseSearchInput) els.basicCaseSearchInput.value = "";
    if (els.basicCasePriorityFilter) els.basicCasePriorityFilter.value = "";
    if (els.basicCaseStatusFilter) els.basicCaseStatusFilter.value = "";
    renderBasicCaseLibrary();
  });
}

function getReviewActionLabel(status) {
  if (status === "草稿") return "提交评审";
  if (status === "待评审") return "评审通过";
  if (status === "已确认") return "退回草稿";
  return "恢复草稿";
}

/**
 * 渲染基础用例目录树（薄委托）。
 * T02 起目录树已并入 tcm-library 的整体渲染，由 TCM.shell.renderActive() 统一驱动，
 * 因此这里在 TCM 可用时直接返回，避免重复渲染。
 * @returns {void}
 */
function renderBasicCaseTree() {
  if (isTcmLibraryReady()) {
    return;
  }
  renderBasicCaseTreeLegacy();
}

function renderBasicCaseTreeLegacy() {
  if (!els.basicCaseTree) {
    return;
  }
  const allCases = Array.isArray(state.basicCaseLibrary) ? state.basicCaseLibrary : [];
  const businessCounts = {};
  const moduleCounts = {};
  BASIC_CASE_BUSINESSES.forEach((business) => {
    businessCounts[business] = 0;
    moduleCounts[business] = {};
  });
  allCases.forEach((item) => {
    if (businessCounts[item.business] === undefined) {
      businessCounts[item.business] = 0;
      moduleCounts[item.business] = {};
    }
    businessCounts[item.business] += 1;
    const mod = item.category || "";
    moduleCounts[item.business][mod] = (moduleCounts[item.business][mod] || 0) + 1;
  });

  const activeBusiness = state.basicCaseBusiness;
  const activeModule = state.basicCaseModule || "";

  els.basicCaseTree.innerHTML = BASIC_CASE_BUSINESSES.map((business) => {
    const isActive = business === activeBusiness;
    const isCollapsed = !basicCaseExpanded.has(business);
    const modules = Object.keys(moduleCounts[business] || {});
    const moduleHtml = isCollapsed ? "" : modules.map((mod) => {
      const modLabel = mod || "未分类";
      const isModActive = isActive && mod === activeModule;
      return `<div class="bct-module ${isModActive ? "active" : ""}" data-business="${escapeHtml(business)}" data-module="${escapeHtml(mod)}">
        <span>${escapeHtml(modLabel)}</span>
        <span class="bct-count">${moduleCounts[business][mod]}</span>
      </div>`;
    }).join("");
    return `
      <div class="bct-business ${isActive ? "active" : ""} ${isCollapsed ? "collapsed" : ""}" data-business="${escapeHtml(business)}">
        <span class="bct-toggle"></span>
        <span class="bct-label">${escapeHtml(business)}</span>
        <span class="bct-count">${businessCounts[business] || 0}</span>
      </div>
      ${moduleHtml}
    `;
  }).join("");
}

/**
 * 渲染左侧导航「基础用例库」子菜单（5 个业务分组）（薄委托 → TCM.library.renderNavSubmenu）。
 * 输出的 DOM 结构与旧实现完全一致（.nav-sub-item[data-business]），
 * 因此 bindEvents 中既有的子菜单点击处理器无需改动。
 * @returns {void}
 */
function renderBasicCaseNavSubmenu() {
  if (window.TCM && window.TCM.library && typeof window.TCM.library.renderNavSubmenu === "function") {
    window.TCM.library.renderNavSubmenu();
    return;
  }
  renderBasicCaseNavSubmenuLegacy();
}

/* 渲染左侧导航「基础用例库」子菜单（5 个业务分组） */
function renderBasicCaseNavSubmenuLegacy() {
  const el = els.basicCaseNavSubmenu;
  if (!el) return;
  const allCases = Array.isArray(state.basicCaseLibrary) ? state.basicCaseLibrary : [];
  const businessCounts = {};
  BASIC_CASE_BUSINESSES.forEach((b) => { businessCounts[b] = 0; });
  allCases.forEach((item) => {
    if (businessCounts[item.business] === undefined) businessCounts[item.business] = 0;
    businessCounts[item.business] += 1;
  });
  const activeBusiness = state.basicCaseBusiness || BASIC_CASE_BUSINESSES[0];
  el.innerHTML = BASIC_CASE_BUSINESSES.map((business) => {
    const isActive = business === activeBusiness;
    return `<button class="nav-link nav-sub-item ${isActive ? "active" : ""}" data-business="${escapeHtml(business)}">
      <span>${escapeHtml(business)}</span>
      <span class="nav-sub-count">${businessCounts[business]}</span>
    </button>`;
  }).join("");
}

function updateBasicCaseBatchBar() {
  if (!els.basicCaseBatchBar) {
    return;
  }
  const count = basicCaseSelection.size;
  if (count === 0) {
    els.basicCaseBatchBar.classList.add("hidden-field");
    if (els.basicCaseSelectedCount) {
      els.basicCaseSelectedCount.textContent = "0";
    }
    return;
  }
  els.basicCaseBatchBar.classList.remove("hidden-field");
  if (els.basicCaseSelectedCount) {
    els.basicCaseSelectedCount.textContent = String(count);
  }
}

function batchReviewBasicCases() {
  const ids = [...basicCaseSelection];
  if (!ids.length) {
    return;
  }
  const flow = { "草稿": "待评审", "待评审": "已确认", "已确认": "草稿", "已废弃": "草稿" };
  let changed = 0;
  ids.forEach((id) => {
    const target = state.basicCaseLibrary.find((item) => item.id === id);
    if (!target) {
      return;
    }
    const next = flow[target.status] || "草稿";
    const old = target.status;
    target.status = next;
    target.executionHistory = target.executionHistory || [];
    target.executionHistory.push({
      date: new Date().toISOString().slice(0, 10),
      executor: "评审",
      result: "通过",
      note: `批量评审流转：${old} → ${next}`
    });
    changed += 1;
  });
  persist();
  basicCaseSelection.clear();
  renderBasicCaseLibrary();
  showToast(`已对 ${changed} 条用例执行评审流转`, "info");
}

function batchCopyBasicCases() {
  const ids = [...basicCaseSelection];
  if (!ids.length) {
    return;
  }
  let copied = 0;
  ids.forEach((id) => {
    const source = state.basicCaseLibrary.find((item) => item.id === id);
    if (!source) {
      return;
    }
    const clone = normalizeBasicCaseItem({
      ...source,
      id: `basic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: `${source.title}（副本）`,
      status: "草稿"
    });
    clone.executionHistory = [];
    clone.linkedDefects = (source.linkedDefects || []).map((defect) => ({ ...defect }));
    state.basicCaseLibrary.push(clone);
    copied += 1;
  });
  persist();
  basicCaseSelection.clear();
  renderBasicCaseLibrary();
  showToast(`已复制 ${copied} 条用例为草稿`, "info");
}

function batchDeleteBasicCases() {
  const ids = [...basicCaseSelection];
  if (!ids.length) {
    return;
  }
  const ok = window.confirm(`确认删除选中的 ${ids.length} 条基础用例？此操作不可撤销。`);
  if (!ok) {
    return;
  }
  const idSet = new Set(ids);
  state.basicCaseLibrary = state.basicCaseLibrary.filter((item) => !idSet.has(item.id));
  persist();
  basicCaseSelection.clear();
  renderBasicCaseLibrary();
  showToast(`已删除 ${ids.length} 条用例`, "info");
}

function populateBatchPlanSelect() {
  if (!els.batchPlanSelect) {
    return;
  }
  const batches = Array.isArray(state.batches) ? state.batches : [];
  els.batchPlanSelect.innerHTML = `<option value="">选择测试计划…</option>` +
    batches.map((batch) => `<option value="${escapeHtml(batch.id)}">${escapeHtml(batch.version || batch.name || batch.id)}</option>`).join("");
}

function batchAddPlanToSelected(planId) {
  const ids = [...basicCaseSelection];
  if (!ids.length || !planId) {
    return;
  }
  const idSet = new Set(ids);
  let updated = 0;
  state.basicCaseLibrary.forEach((item) => {
    if (!idSet.has(item.id)) {
      return;
    }
    item.testPlans = Array.isArray(item.testPlans) ? item.testPlans : [];
    if (!item.testPlans.includes(planId)) {
      item.testPlans.push(planId);
      updated += 1;
    }
  });
  persist();
  renderBasicCaseLibrary();
  const batch = state.batches.find((b) => b.id === planId);
  showToast(`已将 ${updated} 条用例关联到「${batch ? (batch.version || batch.name) : planId}」`, "info");
}

function setBasicCaseSort(key) {
  if (!BASIC_CASE_SORT_KEYS.includes(key)) {
    return;
  }
  if (basicCaseSort.key === key) {
    basicCaseSort.dir = basicCaseSort.dir === "asc" ? "desc" : "asc";
  } else {
    basicCaseSort.key = key;
    basicCaseSort.dir = "asc";
  }
  renderBasicCaseLibrary();
}

let editingBasicCase = null;

/**
 * 打开基础用例编辑界面（薄委托 → TCM.caseEditor.open 抽屉）。
 * @param {string} id 用例 id；空串表示新增
 * @returns {void}
 */
function openCaseModal(id) {
  if (window.TCM && window.TCM.caseEditor && typeof window.TCM.caseEditor.open === "function") {
    window.TCM.caseEditor.open(id || "", {
      business: state.basicCaseBusiness === BASIC_CASE_ALL_BUSINESS ? "" : (state.basicCaseBusiness || ""),
      module: state.basicCaseModule || ""
    });
    return;
  }
  openCaseModalLegacy(id);
}

function openCaseModalLegacy(id) {
  if (!els.basicCaseModal) {
    return;
  }
  const isCreate = !id;
  const source = isCreate
    ? null
    : state.basicCaseLibrary.find((item) => item.id === id);
  editingBasicCase = source
    ? normalizeBasicCaseItem(source)
    : normalizeBasicCaseItem({ business: state.basicCaseBusiness === BASIC_CASE_ALL_BUSINESS ? "" : state.basicCaseBusiness, status: "草稿" });
  if (isCreate) {
    editingBasicCase.id = "";
  }

  if (els.basicCaseModalTitle) {
    els.basicCaseModalTitle.textContent = isCreate ? "新增基础用例" : "编辑基础用例";
  }
  if (els.basicCaseModalFeedback) {
    els.basicCaseModalFeedback.textContent = "";
    els.basicCaseModalFeedback.className = "inline-feedback";
  }

  els.bcTitle.value = editingBasicCase.title || "";
  els.bcBusiness.value = editingBasicCase.business;
  els.bcPriority.value = editingBasicCase.priority;
  els.bcStatus.value = editingBasicCase.status;
  els.bcCategory.value = editingBasicCase.category || "";
  els.bcComponent.value = editingBasicCase.component || "";
  els.bcTags.value = (editingBasicCase.tags || []).join(", ");
  els.bcObjective.value = editingBasicCase.objective || "";
  els.bcPreconditions.value = editingBasicCase.preconditions || "";
  els.bcTestData.value = editingBasicCase.testData || "";
  els.bcSteps.value = editingBasicCase.steps || "";
  els.bcExpected.value = editingBasicCase.expected || "";

  /* 测试计划选项 */
  if (els.bcPlans) {
    const batches = Array.isArray(state.batches)
      ? state.batches.filter((batch) => !batch.systemManaged)
      : [];
    els.bcPlans.innerHTML = batches.map((batch) => {
      const label = typeof formatBatchLabel === "function"
        ? formatBatchLabel(batch)
        : (batch.version || batch.name || batch.id);
      const selected = editingBasicCase.testPlans.includes(batch.id) ? " selected" : "";
      return `<option value="${escapeHtml(batch.id)}"${selected}>${escapeHtml(label)}</option>`;
    }).join("");
  }

  /* 关联缺陷选项 */
  if (els.bcDefects) {
    const bugs = Array.isArray(state.bugs) ? state.bugs : [];
    els.bcDefects.innerHTML = bugs.map((bug) => {
      const bugId = String(bug.id || "");
      const bugTitle = bug.name || bug.title || bugId;
      const selected = editingBasicCase.linkedDefects.some((defect) => defect.id === bugId) ? " selected" : "";
      return `<option value="${escapeHtml(bugId)}"${selected}>${escapeHtml(bugTitle)}</option>`;
    }).join("");
  }

  renderBasicCaseHistory();
  if (els.bcHistoryForm) {
    els.bcHistoryForm.classList.add("hidden-field");
  }
  if (els.bcHistoryNote) els.bcHistoryNote.value = "";
  if (els.bcHistoryExecutor) els.bcHistoryExecutor.value = "";

  renderBasicCaseModalBadges();
  els.basicCaseModal.classList.remove("hidden-field");
}

function renderBasicCaseModalBadges() {
  if (!els.basicCaseModalBadges || !editingBasicCase) {
    return;
  }
  const priorityTone = getPriorityTone(editingBasicCase.priority);
  const statusTone = BASIC_CASE_STATUS_TONE[editingBasicCase.status] || "tone-gray";
  els.basicCaseModalBadges.innerHTML = `
    <span class="badge ${priorityTone}">${escapeHtml(editingBasicCase.priority)}</span>
    <span class="badge ${statusTone}">${escapeHtml(editingBasicCase.status)}</span>
  `;
}

function renderBasicCaseHistory() {
  if (!els.bcHistoryList || !editingBasicCase) {
    return;
  }
  const history = editingBasicCase.executionHistory || [];
  if (!history.length) {
    els.bcHistoryList.innerHTML = `<p class="basic-case-history-empty">暂无执行记录。</p>`;
    return;
  }
  els.bcHistoryList.innerHTML = history.map((record) => {
    const tone = getExecutionStatusTone(record.result);
    return `
      <div class="basic-case-history-item">
        <span class="badge ${tone}">${escapeHtml(record.result)}</span>
        <span class="basic-case-history-date">${escapeHtml(record.date)}</span>
        <span class="basic-case-history-executor">${escapeHtml(record.executor || "—")}</span>
        <span class="basic-case-history-note">${escapeHtml(record.note || "")}</span>
      </div>
    `;
  }).join("");
}

function addBasicCaseHistoryRecord() {
  if (!editingBasicCase) {
    return;
  }
  const result = els.bcHistoryResult?.value || "通过";
  const executor = (els.bcHistoryExecutor?.value || "").trim() || "—";
  const note = (els.bcHistoryNote?.value || "").trim();
  editingBasicCase.executionHistory.push({
    date: new Date().toISOString().slice(0, 10),
    executor,
    result,
    note
  });
  if (els.bcHistoryNote) els.bcHistoryNote.value = "";
  if (els.bcHistoryExecutor) els.bcHistoryExecutor.value = "";
  if (els.bcHistoryForm) els.bcHistoryForm.classList.add("hidden-field");
  renderBasicCaseHistory();
}

function closeCaseModal() {
  editingBasicCase = null;
  els.basicCaseModal?.classList.add("hidden-field");
}

function saveCaseModal() {
  if (!editingBasicCase) {
    return;
  }
  const title = (els.bcTitle?.value || "").trim();
  if (!title) {
    if (els.basicCaseModalFeedback) {
      els.basicCaseModalFeedback.textContent = "用例标题不能为空。";
      els.basicCaseModalFeedback.className = "inline-feedback error";
    }
    els.bcTitle?.focus();
    return;
  }

  const planIds = els.bcPlans
    ? Array.from(els.bcPlans.selectedOptions).map((option) => option.value)
    : [];
  const defectIds = els.bcDefects
    ? Array.from(els.bcDefects.selectedOptions).map((option) => option.value)
    : [];
  const linkedDefects = defectIds.map((bugId) => {
    const bug = (Array.isArray(state.bugs) ? state.bugs : []).find((item) => String(item.id) === bugId);
    return { id: bugId, title: bug?.name || bug?.title || bugId };
  });

  const updated = normalizeBasicCaseItem({
    ...editingBasicCase,
    id: editingBasicCase.id || `basic-${Date.now()}`,
    title,
    business: els.bcBusiness?.value || editingBasicCase.business,
    priority: els.bcPriority?.value || editingBasicCase.priority,
    status: els.bcStatus?.value || editingBasicCase.status,
    category: (els.bcCategory?.value || "").trim(),
    component: (els.bcComponent?.value || "").trim(),
    tags: (els.bcTags?.value || "").trim(),
    objective: (els.bcObjective?.value || "").trim(),
    preconditions: (els.bcPreconditions?.value || "").trim(),
    testData: (els.bcTestData?.value || "").trim(),
    steps: (els.bcSteps?.value || "").trim(),
    expected: (els.bcExpected?.value || "").trim(),
    testPlans: planIds,
    linkedDefects,
    executionHistory: editingBasicCase.executionHistory
  });

  if (editingBasicCase.id) {
    const index = state.basicCaseLibrary.findIndex((item) => item.id === editingBasicCase.id);
    if (index >= 0) {
      state.basicCaseLibrary[index] = updated;
    } else {
      state.basicCaseLibrary.push(updated);
    }
  } else {
    state.basicCaseLibrary.push(updated);
  }
  persist();
  renderBasicCaseLibrary();
  closeCaseModal();
  showToast(`已保存「${title}」`, "info");
}

function duplicateBasicCase(id) {
  const source = state.basicCaseLibrary.find((item) => item.id === id);
  if (!source) {
    return;
  }
  const clone = normalizeBasicCaseItem({
    ...source,
    id: `basic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: `${source.title}（副本）`,
    status: "草稿"
  });
  clone.executionHistory = [];
  clone.linkedDefects = (source.linkedDefects || []).map((defect) => ({ ...defect }));
  state.basicCaseLibrary.push(clone);
  persist();
  renderBasicCaseLibrary();
  showToast(`已复制「${source.title}」为草稿用例`, "info");
}

function reviewBasicCase(id) {
  const target = state.basicCaseLibrary.find((item) => item.id === id);
  if (!target) {
    return;
  }
  const flow = { "草稿": "待评审", "待评审": "已确认", "已确认": "草稿", "已废弃": "草稿" };
  const next = flow[target.status] || "草稿";
  const old = target.status;
  target.status = next;
  target.executionHistory = target.executionHistory || [];
  target.executionHistory.push({
    date: new Date().toISOString().slice(0, 10),
    executor: "评审",
    result: "通过",
    note: `评审流转：${old} → ${next}`
  });
  persist();
  renderBasicCaseLibrary();
  showToast(`已将「${target.title}」状态更新为「${next}」`, next === "已确认" ? "success" : "info");
}

function deleteBasicCase(id) {
  const target = state.basicCaseLibrary.find((item) => item.id === id);
  if (!target) {
    return;
  }
  state.basicCaseLibrary = state.basicCaseLibrary.filter((item) => item.id !== id);
  persist();
  renderBasicCaseLibrary();
  showToast(`已删除「${target.title}」`, "info");
}

function reuseBasicCaseAsCase(id) {
  const item = state.basicCaseLibrary.find((entry) => entry.id === id);
  if (!item) {
    return;
  }
  if (item.status !== "已确认") {
    showToast(`只有「已确认」状态的用例才能进入测试执行，请先对该用例完成评审。`, "warning", { duration: 3600 });
    return;
  }

  const moduleName = BASIC_CASE_TO_MODULE[item.business] || "通用模块";
  const steps = item.steps
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const rawCase = buildCase(
    moduleName,
    item.title,
    "基础用例",
    item.priority,
    item.preconditions,
    steps,
    item.expected
  );
  const newCase = normalizeCaseItem({
    id: `case-${Date.now()}`,
    createdAt: new Date().toISOString().slice(0, 10),
    ...rawCase,
    objective: item.objective || "",
    testData: item.testData || "",
    category: item.category || "",
    component: item.component || "",
    tags: Array.isArray(item.tags) ? [...item.tags] : [],
    status: item.status || "已确认",
    testPlans: Array.isArray(item.testPlans) ? [...item.testPlans] : [],
    linkedDefects: Array.isArray(item.linkedDefects) ? item.linkedDefects.map((defect) => ({ ...defect })) : [],
    executionHistory: Array.isArray(item.executionHistory) ? item.executionHistory.map((record) => ({ ...record })) : []
  });
  state.cases.push(newCase);
  persist();
  renderCases();
  renderQuickStats();
  showToast(`已复用「${item.title}」到用例列表`, "info", {
    actionLabel: "去查看",
    onAction: () => switchTab("cases"),
    duration: 3200
  });
  switchTab("cases");
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

function renderAutomationCases() {
  if (!els.automationCaseList) {
    return;
  }

  const filtered = getFilteredAutomationCasesForView();
  renderAutomationAssetSummary(filtered);
  if (!filtered.length) {
    setAutomationCaseStatus(state.cases.length ? "没有找到匹配的用例，请调整搜索或筛选条件。" : "还没有可配置的测试用例。", state.cases.length ? "warn" : "neutral");
    els.automationCaseList.innerHTML = `
      <div class="empty-state empty-state-rich">
        <strong>${state.cases.length ? "当前筛选范围里没有匹配的自动化用例" : "这里还没有测试用例"}</strong>
        <p>${state.cases.length ? "清空搜索词或调整筛选条件后再试。" : "先去生成用例，再回来配置需要重复执行的场景。"}</p>
      </div>
    `;
    return;
  }

  if (activeAutomationEditorCaseId === null || (activeAutomationEditorCaseId && !filtered.some((item) => item.id === activeAutomationEditorCaseId))) {
    activeAutomationEditorCaseId = filtered.find((item) => item.automationEnabled)?.id || filtered[0].id;
  }

  setAutomationCaseStatus(`当前显示 ${filtered.length} 条用例。点击“配置用例”后，仅展开当前这一条。`, "neutral");
  els.automationCaseList.innerHTML = "";
  filtered.forEach((item, index) => {
    const node = els.caseTemplate.content.firstElementChild.cloneNode(true);
    ensureCaseAutomationEditor(node);
    const isEditorOpen = activeAutomationEditorCaseId === item.id;
    node.classList.add("automation-case-card");
    node.classList.toggle("is-configuring", isEditorOpen);
    node.querySelector(".case-detail")?.classList.toggle("hidden-field", !isEditorOpen);
    const cardKicker = node.querySelector(".case-card-kicker");
    if (cardKicker) {
      cardKicker.textContent = "自动化用例";
    }
    const caseSequenceBadge = ensureCaseSequenceBadge(node);
    node.querySelector(".case-title-text").textContent = item.title;
    if (caseSequenceBadge) {
      caseSequenceBadge.textContent = `第 ${index + 1} 条`;
    }
    node.querySelector(".case-version").textContent = item.batchVersion || "未带版本";
    node.querySelector(".case-task").textContent = item.taskName || "未分任务";

    const statusBadge = node.querySelector(".case-status");
    const priorityBadge = node.querySelector(".case-priority");
    const cardMeta = node.querySelector(".case-card-meta");
    const configBadge = document.createElement("span");
    configBadge.className = `badge ${item.automationEnabled ? "tone-green" : "subtle"} automation-config-badge`;
    configBadge.textContent = item.automationEnabled ? "已配置" : "待配置";
    const runBadge = document.createElement("span");
    const lastRunStatus = item.automationLastRun?.status || "未运行";
    runBadge.className = `badge ${lastRunStatus === "通过" ? "tone-green" : lastRunStatus === "失败" ? "tone-red" : "subtle"} automation-result-badge`;
    runBadge.textContent = lastRunStatus;
    cardMeta?.append(configBadge, runBadge);
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

    const toggleButton = node.querySelector(".toggle-case-detail");
    if (toggleButton) {
      toggleButton.textContent = isEditorOpen ? "收起配置" : "配置用例";
    }
    bindCaseCard(node, item.id, { singleAutomationEditor: true });
    els.automationCaseList.appendChild(node);
  });
}

function renderAutomationAssetSummary(filteredCases) {
  if (!els.automationAssetSummary) {
    return;
  }

  const configuredCount = state.cases.filter((item) => item.automationEnabled).length;
  const passedCount = state.cases.filter((item) => item.automationLastRun?.status === "通过").length;
  const attentionCount = state.cases.filter((item) => item.automationLastRun?.status === "失败").length;
  const items = [
    ["当前结果", filteredCases.length, `共 ${state.cases.length} 条`],
    ["已配置", configuredCount, "已完成单条配置"],
    ["最近通过", passedCount, "最近一次运行"],
    ["需要处理", attentionCount, "运行失败"]
  ];

  els.automationAssetSummary.innerHTML = items.map(([label, value, note], index) => `
    <article class="automation-asset-stat${index === 3 && Number(value) > 0 ? " needs-attention" : ""}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      <small>${escapeHtml(note)}</small>
    </article>
  `).join("");
}

function bindCaseCard(node, caseId, options = {}) {
  const detail = node.querySelector(".case-detail");
  const toggle = node.querySelector(".toggle-case-detail");
  toggle.addEventListener("click", () => {
    if (options.singleAutomationEditor) {
      activeAutomationEditorCaseId = activeAutomationEditorCaseId === caseId ? "" : caseId;
      renderAutomationCases();
      return;
    }
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
    return "自动化配置已保存，可以在当前环境执行试运行。";
  }
  return "启用后，可保存目标路径、执行步骤和校验规则。";
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
        ${state.bugs.length
    ? `<div class="empty-actions"><button class="ghost-button" type="button" data-clear-bug-filters>清空筛选</button></div>`
    : `<div class="empty-actions"><button class="primary-button" type="button" data-open-bug-modal>新增 BUG</button></div>`}
      </div>
    `;
    els.bugList.querySelector("[data-open-bug-modal]")?.addEventListener("click", () => openBugModal());
    els.bugList.querySelector("[data-clear-bug-filters]")?.addEventListener("click", () => {
      els.bugBatchFilter.value = "";
      if (els.bugSearchInput) els.bugSearchInput.value = "";
      if (els.bugSeverityFilter) els.bugSeverityFilter.value = "";
      if (els.bugWorkflowStatusFilter) els.bugWorkflowStatusFilter.value = "";
      renderCaseFilters();
      els.bugTaskFilter.value = "";
      renderBugs();
    });
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
          <p>${versionCards.length ? "请调整搜索内容或筛选条件。" : "先在版本管理中创建版本并关联任务，这里就会自动生成版本报告。"}</p>
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

function openReportExportPreview() {
  const report = buildReportViewModel(getReportScopeByBatch(state.activeReportBatchId));
  const warnings = buildReportExportChecks(report);
  const hasReportData = Boolean(report.scope.batch && !isSystemWorkspaceBatch(report.scope.batch));
  const conclusion = getReportConclusionForBatch(state.activeReportBatchId);

  els.reportExportPreview.innerHTML = `
    <div class="report-export-scope">
      <div>
        <span>当前导出范围</span>
        <strong>${escapeHtml(report.batchVersion || "未选择版本")}</strong>
        <p>${escapeHtml(report.scopeLabel)}</p>
      </div>
      <span class="badge ${report.releaseDecision.tone}">${escapeHtml(report.releaseDecision.label)}</span>
    </div>
    <div class="report-export-metrics">
      <div><span>用例总数</span><strong>${report.total}</strong></div>
      <div><span>执行进度</span><strong>${escapeHtml(report.executionRate)}</strong></div>
      <div><span>通过率</span><strong>${escapeHtml(report.passRate)}</strong></div>
      <div class="${report.statusCounts["失败"] ? "has-risk" : ""}"><span>失败用例</span><strong>${report.statusCounts["失败"] || 0}</strong></div>
      <div class="${report.openBugs ? "has-warning" : ""}"><span>待跟进 BUG</span><strong>${report.openBugs}</strong></div>
    </div>
    <section class="report-export-checks ${warnings.length ? "has-warnings" : "is-ready"}">
      <strong>${warnings.length ? "导出前请确认" : "报告可以导出"}</strong>
      ${warnings.length
        ? `<ul>${warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
        : "<p>当前没有未执行、失败或未关闭 BUG 的风险提醒。</p>"}
    </section>
    <section class="report-export-conclusion">
      <span>补充结论</span>
      <p>${escapeHtml(conclusion || "尚未填写补充结论，可返回报告详情继续完善。")}</p>
    </section>
    ${hasReportData ? "" : "<p class=\"inline-feedback warn\">当前没有可导出的版本、用例或 BUG 数据。</p>"}
  `;
  els.confirmReportExport.disabled = !hasReportData;
  els.publishWebReport.disabled = !hasReportData;
  els.publishedReportResult.classList.add("hidden-field");
  els.publishedReportResult.innerHTML = "";
  els.reportExportModal.classList.remove("hidden-field");
  document.body.classList.add("dialog-open");
  window.setTimeout(() => (hasReportData ? els.confirmReportExport : els.cancelReportExport)?.focus(), 0);
}

function closeReportExportPreview() {
  els.reportExportModal?.classList.add("hidden-field");
  document.body.classList.remove("dialog-open");
}

async function publishCurrentReport() {
  const report = buildReportViewModel(getReportScopeByBatch(state.activeReportBatchId));
  const reportConclusion = getReportConclusionForBatch(state.activeReportBatchId);
  const title = report.batchVersion && report.batchVersion !== "未选择"
    ? `${report.batchVersion} 测试报告`
    : "测试报告";

  const hasPublishedVersion = publishedReports.some((item) => item.version === report.batchVersion);
  if (hasPublishedVersion && !window.confirm(`版本“${report.batchVersion}”已经发布过报告，确认发布新的快照吗？`)) {
    return;
  }

  els.publishWebReport.disabled = true;
  els.publishWebReport.setAttribute("aria-busy", "true");
  els.publishWebReport.textContent = "正在发布…";
  try {
    const response = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, report, reportConclusion })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "发布失败");

    const reportUrl = new URL(result.url, window.location.origin).href;
    els.publishedReportResult.classList.remove("hidden-field", "warn");
    els.publishedReportResult.innerHTML = `
      <div>
        <strong>网页版报告已发布</strong>
        <span>这是只读快照，可将下面的内网地址发送给同事。</span>
      </div>
      <div class="published-report-link">
        <input type="text" value="${escapeHtml(reportUrl)}" readonly aria-label="网页版报告地址">
        <button class="ghost-button" type="button" data-copy-published-report>复制链接</button>
        <a class="primary-button" href="${escapeHtml(reportUrl)}" target="_blank" rel="noopener">打开报告</a>
      </div>
    `;
    await loadPublishedReports();
    showToast("网页版报告已发布，可以复制链接分享。", "success");
  } catch (error) {
    els.publishedReportResult.classList.remove("hidden-field");
    els.publishedReportResult.classList.add("warn");
    els.publishedReportResult.innerHTML = `<strong>发布失败</strong><span>${escapeHtml(error.message || "请稍后重试。")}</span>`;
  } finally {
    els.publishWebReport.disabled = false;
    els.publishWebReport.removeAttribute("aria-busy");
    els.publishWebReport.textContent = "发布网页版";
  }
}

async function handlePublishedReportAction(event) {
  const copyButton = event.target.closest("[data-copy-published-report]");
  if (!copyButton) return;
  const input = els.publishedReportResult.querySelector("input");
  if (!input) return;
  try {
    await navigator.clipboard.writeText(input.value);
    copyButton.textContent = "已复制";
    showToast("报告链接已复制。", "success");
    window.setTimeout(() => { copyButton.textContent = "复制链接"; }, 1600);
  } catch (_error) {
    input.select();
    document.execCommand("copy");
    copyButton.textContent = "已复制";
    showToast("报告链接已复制。", "success");
  }
}

async function loadPublishedReports() {
  if (!els.publishedReportList) return;
  try {
    const response = await fetch("/api/reports");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "读取发布记录失败");
    publishedReports = Array.isArray(result.reports) ? result.reports : [];
    renderPublishedReports();
  } catch (_error) {
    els.publishedReportList.innerHTML = '<p class="empty-state">暂时无法读取已发布报告。</p>';
  }
}

function renderPublishedReports() {
  if (!els.publishedReportList) return;
  const visibleReports = publishedReports.filter((item) => item.version !== DEFAULT_WORKSPACE_VERSION);
  const searchText = String(els.publishedReportSearch?.value || "").trim().toLowerCase();
  const filteredReports = visibleReports.filter((item) => !searchText || [item.title, item.version]
    .some((value) => String(value || "").toLowerCase().includes(searchText)));
  const latestReportIds = new Set();
  const latestVersions = new Set();
  visibleReports.forEach((item) => {
    if (!latestVersions.has(item.version)) {
      latestVersions.add(item.version);
      latestReportIds.add(item.id);
    }
  });
  els.publishedReportCount.textContent = searchText
    ? `显示 ${filteredReports.length} / ${visibleReports.length}`
    : `${visibleReports.length} 份报告`;
  if (!filteredReports.length) {
    els.publishedReportList.innerHTML = `
      <div class="empty-state published-report-empty">
        <strong>${visibleReports.length ? "没有匹配的发布记录" : "还没有发布网页版报告"}</strong>
        <span>${visibleReports.length ? "请调整搜索内容。" : "选择版本并点击“发布网页版”，这里会保存可访问的内网链接。"}</span>
      </div>
    `;
    return;
  }

  els.publishedReportList.innerHTML = `
    <div class="table-scroll-shell">
      <table class="published-report-table">
        <thead><tr><th>报告名称</th><th>版本</th><th>用例数</th><th>发布结论</th><th>发布时间</th><th>操作</th></tr></thead>
        <tbody>${filteredReports.map((item) => `
          <tr>
            <td><strong>${escapeHtml(item.title || "测试报告")}${latestReportIds.has(item.id) ? '<span class="latest-report-chip">最新</span>' : ""}</strong><small>${escapeHtml(item.id)}</small></td>
            <td>${escapeHtml(item.version || "未选择")}</td>
            <td>${resolvePublishedReportTotal(item)}</td>
            <td><span class="badge ${escapeHtml(item.decisionTone || "warn")}">${escapeHtml(item.decision || "待评估")}</span></td>
            <td>${escapeHtml(formatPublishedReportTime(item.publishedAt))}</td>
            <td><div class="published-report-actions">
              <a class="ghost-button" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">打开</a>
              <button class="ghost-button" type="button" data-copy-report-id="${escapeHtml(item.id)}">复制链接</button>
              <button class="ghost-button danger-button" type="button" data-revoke-report-id="${escapeHtml(item.id)}">撤销</button>
            </div></td>
          </tr>
        `).join("")}</tbody>
      </table>
    </div>
  `;
}

async function handlePublishedReportListAction(event) {
  const copyButton = event.target.closest("[data-copy-report-id]");
  if (copyButton) {
    const item = publishedReports.find((report) => report.id === copyButton.dataset.copyReportId);
    if (!item) return;
    await copyTextWithFallback(new URL(item.url, window.location.origin).href);
    copyButton.textContent = "已复制";
    showToast("报告链接已复制。", "success");
    window.setTimeout(() => { copyButton.textContent = "复制链接"; }, 1600);
    return;
  }

  const revokeButton = event.target.closest("[data-revoke-report-id]");
  if (!revokeButton) return;
  const item = publishedReports.find((report) => report.id === revokeButton.dataset.revokeReportId);
  if (!item || !window.confirm(`确认撤销“${item.title}”？撤销后原链接将无法访问。`)) return;
  revokeButton.disabled = true;
  const response = await fetch(`/api/reports/${encodeURIComponent(item.id)}`, { method: "DELETE" });
  if (!response.ok) {
    revokeButton.disabled = false;
    showToast("撤销失败，请稍后重试。", "error");
    return;
  }
  await loadPublishedReports();
  showToast("报告已撤销，原链接不再可用。", "success");
}

async function copyTextWithFallback(value) {
  try {
    await navigator.clipboard.writeText(value);
  } catch (_error) {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

function formatPublishedReportTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("zh-CN", { hour12: false });
}

function resolvePublishedReportTotal(item) {
  const directTotal = Number(item?.total);
  if (Number.isFinite(directTotal) && directTotal > 0) {
    return directTotal;
  }
  const matchingBatch = state.batches.find((batch) => batch.version === item?.version);
  if (!matchingBatch) {
    return 0;
  }
  return buildReportViewModel(getReportScopeByBatch(matchingBatch.id)).total || 0;
}

function showToast(message, tone = "info") {
  if (!els.toastRegion) return;
  const options = arguments[2] || {};
  const { actionLabel = "", onAction = null, duration = 2600 } = options;
  const toast = document.createElement("div");
  toast.className = `app-toast ${tone}`;
  toast.innerHTML = `
    <span class="toast-dot"></span>
    <strong>${escapeHtml(message)}</strong>
    ${actionLabel && typeof onAction === "function" ? `<button class="toast-action" type="button">${escapeHtml(actionLabel)}</button>` : ""}
  `;
  els.toastRegion.appendChild(toast);
  toast.querySelector(".toast-action")?.addEventListener("click", () => {
    onAction();
    toast.remove();
  });
  window.setTimeout(() => toast.classList.add("is-visible"), 10);
  window.setTimeout(() => {
    toast.classList.remove("is-visible");
    window.setTimeout(() => toast.remove(), 220);
  }, duration);
}

async function exportReport({ skipChecks = false } = {}) {
  const report = buildReportViewModel(getReportScopeByBatch(state.activeReportBatchId));
  const reportConclusion = getReportConclusionForBatch(state.activeReportBatchId);
  const fileBaseName = buildReportDocxFileBaseName(report);
  const exportChecks = buildReportExportChecks(report);

  if (!skipChecks && exportChecks.length) {
    const confirmed = window.confirm([
      "导出前提醒：",
      ...exportChecks.map((item, index) => `${index + 1}. ${item}`),
      "",
      "确认继续导出吗？"
    ].join("\n"));
    if (!confirmed) {
      return false;
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
    return true;
  } catch (error) {
    alert(`报告导出失败：${error.message}`);
    return false;
  }
}

function buildReportDocxFileBaseName(report) {
  const version = report?.scope?.batch?.version || report?.batchVersion || "no-version";
  return `${sanitizeFileName(version)}-report`;
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
  loadedState.basicCaseLibrary = Array.isArray(loadedState.basicCaseLibrary)
    ? loadedState.basicCaseLibrary.map(normalizeBasicCaseItem)
    : [];
  loadedState.basicCaseBusiness = normalizeBasicCaseBusinessScope(loadedState.basicCaseBusiness);
  if (typeof loadedState.basicCaseModule !== "string") {
    loadedState.basicCaseModule = "";
  }
  loadedState.uiAutomationSettings = normalizeUiAutomationSettings(loadedState.uiAutomationSettings);
  loadedState.uiAutomationSession = normalizeUiAutomationSession(loadedState.uiAutomationSession);
  normalizeTcmLocalPreferences(loadedState);
  runTcmMigration(loadedState);
  return loadedState;
}

/**
 * 归一化测试用例管理模块的本地偏好字段（LOCAL_STATE_KEYS 新增项）。
 * @param {object} target 待归一化的状态对象
 * @returns {object} 同一个 target 引用
 */
function normalizeTcmLocalPreferences(target) {
  const subTabs = ["library", "plans", "execution", "review", "dashboard", "trace"];
  target.tcmActiveSubTab = subTabs.includes(target.tcmActiveSubTab) ? target.tcmActiveSubTab : "library";

  const filters = target.tcmLibraryFilters && typeof target.tcmLibraryFilters === "object"
    ? target.tcmLibraryFilters
    : {};
  target.tcmLibraryFilters = {
    keyword: typeof filters.keyword === "string" ? filters.keyword : "",
    type: typeof filters.type === "string" ? filters.type : "",
    priority: typeof filters.priority === "string" ? filters.priority : "",
    status: typeof filters.status === "string" ? filters.status : "",
    component: typeof filters.component === "string" ? filters.component : "",
    tag: typeof filters.tag === "string" ? filters.tag : "",
    automation: typeof filters.automation === "string" ? filters.automation : ""
  };

  target.tcmTreeExpanded = Array.isArray(target.tcmTreeExpanded)
    ? target.tcmTreeExpanded.map((item) => String(item)).filter(Boolean)
    : [];
  target.tcmActivePlanId = typeof target.tcmActivePlanId === "string" ? target.tcmActivePlanId : "";
  target.tcmActiveRound = Number.isFinite(Number(target.tcmActiveRound)) && Number(target.tcmActiveRound) >= 1
    ? Number(target.tcmActiveRound)
    : 1;
  target.tcmExecutionScope = ["mine", "all"].includes(target.tcmExecutionScope) ? target.tcmExecutionScope : "all";
  target.tcmDashboardWindow = ["batch", "rolling30", "all"].includes(target.tcmDashboardWindow)
    ? target.tcmDashboardWindow
    : "batch";
  return target;
}

/**
 * 调用 TCM.store.migrate() 归一化 6 个共享集合（幂等）。
 * TCM 模块未加载（如单测直接 require app.js 片段）时静默跳过，只保证集合是数组。
 * @param {object} target 待迁移的状态对象
 * @returns {object} 同一个 target 引用
 */
function runTcmMigration(target) {
  if (!target || typeof target !== "object") {
    return target;
  }

  const tcm = typeof window !== "undefined" ? window.TCM : null;
  if (tcm && tcm.store && typeof tcm.store.migrate === "function") {
    tcm.store.migrate(target);
    return target;
  }

  ["basicCaseLibrary", "testPlans", "caseExecutions", "reviewTickets", "caseDirectories", "caseVersions"].forEach((key) => {
    if (!Array.isArray(target[key])) {
      target[key] = [];
    }
  });
  if (typeof target._rev !== "number" || !Number.isFinite(target._rev)) {
    target._rev = 0;
  }
  return target;
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
    basicCaseLibrary: seedBasicCaseLibrary(),
    basicCaseBusiness: BASIC_CASE_ALL_BUSINESS,
    basicCaseModule: "",
    // —— 测试用例管理模块（TCM）共享集合，与 server.js sanitizeSharedState 对齐 ——
    testPlans: [],
    caseExecutions: [],
    reviewTickets: [],
    caseDirectories: [],
    caseVersions: [],
    _rev: 0,
    // —— 测试用例管理模块（TCM）本地偏好，仅进 localStorage，不上行共享态 ——
    tcmActiveSubTab: "library",
    tcmLibraryFilters: {
      keyword: "",
      type: "",
      priority: "",
      status: "",
      component: "",
      tag: "",
      automation: ""
    },
    tcmCaseCatalogConfig: {
      businesses: [],
      components: [],
      tags: []
    },
    tcmTreeExpanded: [],
    tcmActivePlanId: "",
    tcmActiveRound: 1,
    tcmExecutionScope: "all",
    tcmDashboardWindow: "batch",
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
