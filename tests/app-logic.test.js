const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const APP_JS_FILES = [
  "app-quality.js",
  "app-domain.js",
  "app-automation.js",
  "app-bugs.js",
  "app-report.js",
  "app-storage.js",
  "app.js"
];
const appSource = APP_JS_FILES
  .map((fileName) => fs.readFileSync(path.join(__dirname, "..", fileName), "utf-8"))
  .join("\n");

function extractFunctionSource(functionName) {
  const asyncStartToken = `async function ${functionName}(`;
  const syncStartToken = `function ${functionName}(`;
  const start = appSource.indexOf(asyncStartToken) !== -1
    ? appSource.indexOf(asyncStartToken)
    : appSource.indexOf(syncStartToken);
  if (start === -1) {
    throw new Error(`Unable to find ${functionName} in application scripts`);
  }

  const paramsStart = appSource.indexOf("(", start);
  if (paramsStart === -1) {
    throw new Error(`Unable to find ${functionName} params start`);
  }

  let paramDepth = 0;
  let bodyStart = -1;
  for (let index = paramsStart; index < appSource.length; index += 1) {
    const char = appSource[index];
    if (char === "(") {
      paramDepth += 1;
    } else if (char === ")") {
      paramDepth -= 1;
      if (paramDepth === 0) {
        bodyStart = appSource.indexOf("{", index);
        break;
      }
    }
  }

  if (bodyStart === -1) {
    throw new Error(`Unable to find ${functionName} body start`);
  }

  let depth = 0;
  let end = -1;
  for (let index = bodyStart; index < appSource.length; index += 1) {
    const char = appSource[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        end = index + 1;
        break;
      }
    }
  }

  if (end === -1) {
    throw new Error(`Unable to parse ${functionName} body`);
  }

  return appSource.slice(start, end);
}

function loadFunction(functionName, additions = {}) {
  const snippet = `${extractFunctionSource(functionName)}\nmodule.exports = ${functionName};`;
  const context = { module: { exports: null }, ...additions };
  vm.runInNewContext(snippet, context);
  return context.module.exports;
}

const mergeCasesIntoState = loadFunction("mergeCasesIntoState");
const normalizeAutomationStepType = loadFunction("normalizeAutomationStepType");
const normalizeAutomationLocatorType = loadFunction("normalizeAutomationLocatorType");
const inferAutomationTargetFromRawStep = loadFunction("inferAutomationTargetFromRawStep");
const buildCasesCsvExport = loadFunction("buildCasesCsvExport");
const getCasePriorityRank = loadFunction("getCasePriorityRank");
const sortCasesByPriority = loadFunction("sortCasesByPriority", { getCasePriorityRank });
const getCasePriorityClass = loadFunction("getCasePriorityClass", { getCasePriorityRank });
const getNextExecutionCaseId = loadFunction("getNextExecutionCaseId");
const sanitizeFileName = loadFunction("sanitizeFileName");
const buildReportDocxFileBaseName = loadFunction("buildReportDocxFileBaseName", { sanitizeFileName });
const normalizeCaseFingerprint = loadFunction("normalizeCaseFingerprint");
const normalizeQualityRuleSeverity = loadFunction("normalizeQualityRuleSeverity");
const splitCaseSteps = loadFunction("splitCaseSteps");
const inferTransactionType = loadFunction("inferTransactionType");
const inferOrderChannel = loadFunction("inferOrderChannel");
const inferCardBrand = loadFunction("inferCardBrand");
const inferExpectedCode = loadFunction("inferExpectedCode");
const extractNamedAmount = loadFunction("extractNamedAmount");
const extractCaseAmount = loadFunction("extractCaseAmount", { extractNamedAmount });
const inferAmountBoundary = loadFunction("inferAmountBoundary");
const inferThreeDsScenario = loadFunction("inferThreeDsScenario");
const inferCallbackScenario = loadFunction("inferCallbackScenario");
const inferCardDimension = loadFunction("inferCardDimension");
const inferExpectedDirection = loadFunction("inferExpectedDirection");
const normalizeCardAcquiringCase = loadFunction("normalizeCardAcquiringCase", {
  splitCaseSteps,
  extractCaseAmount,
  extractNamedAmount,
  inferCardDimension,
  inferTransactionType,
  inferOrderChannel,
  inferCardBrand,
  inferExpectedCode,
  inferAmountBoundary,
  inferThreeDsScenario,
  inferCallbackScenario,
  normalizeCaseFingerprint,
  inferExpectedDirection
});
const addCoverageIssue = loadFunction("addCoverageIssue");
const runCardAcquiringQualityRules = loadFunction("runCardAcquiringQualityRules", {
  normalizeCardAcquiringCase,
  normalizeQualityRuleSeverity,
  addCoverageIssue,
  formatAmountBoundary: (value) => ({
    zero: "零额",
    min: "最小金额",
    normal: "正常金额",
    over: "超最大限额",
    negative: "负额"
  }[value] || value)
});
const normalizeAutomationStep = loadFunction("normalizeAutomationStep", {
  normalizeAutomationStepType,
  normalizeAutomationLocatorType,
  inferAutomationTargetFromRawStep
});

test("getVersionHealth summarizes release risks without mutating version data", () => {
  const state = {
    tasks: [{ id: "task-1", batchId: "batch-1" }],
    cases: [
      { taskId: "task-1", executionStatus: "通过" },
      { taskId: "task-1", executionStatus: "失败" },
      { taskId: "task-1", executionStatus: "未执行" }
    ],
    bugs: [{ taskId: "task-1", status: "新建" }]
  };
  const getVersionHealth = loadFunction("getVersionHealth", { state });
  const result = getVersionHealth({ id: "batch-1" });

  assert.equal(result.tasks.length, 1);
  assert.equal(result.cases.length, 3);
  assert.equal(result.executed, 2);
  assert.equal(result.pending, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.openBugs, 1);
  assert.equal(result.release.label, "有风险");
  assert.equal(state.cases.length, 3);
});

test("completing a version preserves historical cases", () => {
  const completionSource = extractFunctionSource("confirmVersionCompletion");
  assert.doesNotMatch(completionSource, /state\.cases\s*=/);
  assert.doesNotMatch(completionSource, /state\.bugs\s*=/);
});

test("manual execution advances only after a passed result", () => {
  const cases = [{ id: "case-1" }, { id: "case-2" }, { id: "case-3" }];
  assert.equal(getNextExecutionCaseId(cases, "case-1", "通过"), "case-2");
  assert.equal(getNextExecutionCaseId(cases, "case-3", "通过"), "case-3");
  assert.equal(getNextExecutionCaseId(cases, "case-1", "失败"), "case-1");
});

test("DOCX report filename uses only version and report suffix", () => {
  assert.equal(buildReportDocxFileBaseName({ batchVersion: "V1.0.0" }), "V1.0.0-report");
  assert.equal(
    buildReportDocxFileBaseName({ scope: { batch: { version: "V2/Release" } }, batchVersion: "fallback" }),
    "V2-Release-report"
  );
});

test("buildCasesCsvExport omits version and execution state metadata", () => {
  const result = buildCasesCsvExport([
    {
      taskName: "登录回归",
      batchVersion: "V3.1.1",
      title: "正确账号登录",
      type: "正常",
      priority: "P1",
      preconditions: "账号已创建",
      steps: "输入账号并登录",
      expected: "进入首页",
      executionStatus: "通过",
      executionNote: "浏览器验证"
    }
  ], null, "需求文档");

  assert.deepEqual(Array.from(result.headers), [
    "测试任务",
    "标题",
    "类型",
    "优先级",
    "前置条件",
    "步骤",
    "预期结果",
    "执行备注"
  ]);
  assert.equal(result.fileBaseName, "登录回归-测试用例");
  assert.equal(Array.from(result.rows[0]).includes("V3.1.1"), false);
  assert.equal(Array.from(result.rows[0]).includes("通过"), false);
});

test("buildCasesCsvExport labels exports spanning multiple tasks clearly", () => {
  const result = buildCasesCsvExport([
    { taskName: "登录回归", title: "登录" },
    { taskName: "支付回归", title: "支付" }
  ], { name: "当前激活任务" }, "需求文档");

  assert.equal(result.fileBaseName, "多个测试任务-测试用例");
});

test("sortCasesByPriority orders manual cases from P0 upward stably", () => {
  const cases = [
    { id: "p2-first", priority: "P2" },
    { id: "p0", priority: "p0" },
    { id: "custom", priority: "紧急" },
    { id: "p1", priority: "P1" },
    { id: "p2-default", priority: "" },
    { id: "p2-second", priority: "P2" },
    { id: "p3", priority: "P3" }
  ];

  assert.deepEqual(Array.from(sortCasesByPriority(cases), (item) => item.id), [
    "p0",
    "p1",
    "p2-first",
    "p2-default",
    "p2-second",
    "p3",
    "custom"
  ]);
});

test("getCasePriorityClass maps case levels to restrained visual tones", () => {
  assert.equal(getCasePriorityClass("P0"), "priority-critical");
  assert.equal(getCasePriorityClass("P1"), "priority-high");
  assert.equal(getCasePriorityClass("P2"), "priority-normal");
  assert.equal(getCasePriorityClass("P3"), "priority-low");
});

test("version action menu opens where all actions remain visible", () => {
  const getFloatingMenuPosition = loadFunction("getFloatingMenuPosition");
  const nearBottom = getFloatingMenuPosition(
    { top: 640, bottom: 674, right: 980 },
    { width: 168, height: 210 },
    { width: 1024, height: 700 }
  );
  const nearTop = getFloatingMenuPosition(
    { top: 40, bottom: 74, right: 980 },
    { width: 168, height: 210 },
    { width: 1024, height: 700 }
  );
  const mobile = getFloatingMenuPosition(
    { top: 500, bottom: 534, right: 360 },
    { width: 168, height: 230 },
    { width: 375, height: 667 }
  );

  assert.equal(nearBottom.placement, "top");
  assert.equal(nearBottom.top >= 12, true);
  assert.equal(nearTop.placement, "bottom");
  assert.equal(nearTop.top + 210 <= 688, true);
  assert.equal(mobile.placement, "sheet");
  assert.equal(mobile.left, 12);
  assert.equal(mobile.width, 351);
});

test("version and task rows expose one contextual primary action", () => {
  const getVersionPrimaryAction = loadFunction("getVersionPrimaryAction");
  const activeBatch = { status: "进行中" };

  assert.equal(getVersionPrimaryAction(activeBatch, {
    tasks: [], cases: [], failed: 0, blocked: 0, openBugs: 0, pending: 0
  }).action, "link-tasks");
  assert.equal(getVersionPrimaryAction(activeBatch, {
    tasks: [{}], cases: [], failed: 0, blocked: 0, openBugs: 0, pending: 0
  }).action, "prepare-cases");
  assert.equal(getVersionPrimaryAction(activeBatch, {
    tasks: [{}], cases: [{}], failed: 0, blocked: 0, openBugs: 0, pending: 1
  }).action, "continue-testing");
  assert.equal(getVersionPrimaryAction(activeBatch, {
    tasks: [{}], cases: [{}], failed: 1, blocked: 0, openBugs: 0, pending: 0
  }).action, "manage-issues");
  assert.equal(getVersionPrimaryAction(activeBatch, {
    tasks: [{}], cases: [{}], failed: 0, blocked: 0, openBugs: 0, pending: 0
  }).action, "view-report");

  const getTaskPrimaryAction = loadFunction("getTaskPrimaryAction", {
    isTaskReadonly: () => false,
    getTaskCaseProgress: () => ({ total: 0, completed: 0 })
  });
  assert.equal(getTaskPrimaryAction({}, { total: 0, completed: 0 }).action, "generate");
  assert.equal(getTaskPrimaryAction({}, { total: 3, completed: 1 }).label, "继续执行");
  assert.equal(getTaskPrimaryAction({}, { total: 3, completed: 3 }).label, "查看结果");
});

test("ensureDefaultTaskBatch creates and reuses a hidden workspace batch", () => {
  const state = { batches: [], activeBatchId: "", generationBatchId: "" };
  const getBatchById = (batchId) => state.batches.find((item) => item.id === batchId);
  const getOrCreateDefaultWorkspaceBatch = loadFunction("getOrCreateDefaultWorkspaceBatch", {
    state,
    DEFAULT_WORKSPACE_VERSION: "默认工作区",
    applyCreateAuditFields: (item) => ({ ...item, createdAt: "now" })
  });
  const ensureDefaultTaskBatch = loadFunction("ensureDefaultTaskBatch", {
    state,
    editingTaskId: "",
    getTaskById: () => null,
    getBatchById,
    getOrCreateDefaultWorkspaceBatch
  });

  const created = ensureDefaultTaskBatch();
  const reused = ensureDefaultTaskBatch();

  assert.equal(created.id, "batch-default-workspace");
  assert.equal(created.systemManaged, true);
  assert.equal(state.batches.length, 1);
  assert.equal(reused, created);
  assert.equal(state.activeBatchId, created.id);
  assert.equal(state.generationBatchId, created.id);
});

test("createTask allows a task name without requiring scope or case generation", () => {
  const state = {
    tasks: [],
    activeTaskId: "",
    generationBatchId: "",
    activeBatchId: "",
    activeModuleId: ""
  };
  const els = {
    taskNameInput: { value: "独立任务" },
    taskScopeInput: { value: "" },
    taskBatchSelect: { value: "" },
    createTaskBtn: { textContent: "" }
  };
  const batch = {
    id: "batch-default",
    version: "默认工作区",
    name: "",
    moduleId: "",
    moduleName: ""
  };
  const createTaskOnly = loadFunction("createTask", {
    state,
    els,
    editingTaskId: "",
    ensureDefaultTaskBatch: () => batch,
    getTaskById: () => null,
    splitOwnerValues: () => [],
    formatBatchLabel: () => "默认工作区",
    applyCreateAuditFields: (item) => item,
    applyUpdateAuditFields: (item) => item,
    setGenerationStatus: () => {},
    autoResizeTextarea: () => {},
    persist: () => {},
    renderAll: () => {},
    flashButtonSuccess: () => {}
  });

  const task = createTaskOnly();

  assert.equal(task.name, "独立任务");
  assert.equal(task.scope, "");
  assert.equal(state.tasks.length, 1);
  assert.equal(state.activeTaskId, task.id);
});

test("workflow state advances through generation, execution, and report phases", () => {
  const state = {
    activeBatchId: "batch-1",
    activeTaskId: "task-1",
    tasks: [{ id: "task-1" }],
    documents: [],
    cases: [],
    bugs: []
  };
  const getWorkflowState = loadFunction("getWorkflowState", {
    state,
    settings: { apiKey: "test-key", apiReady: true },
    uploadedFileContent: "",
    els: {
      sourceUrl: { value: "" },
      sourceText: { value: "" }
    }
  });

  assert.equal(getWorkflowState().nextAction, "prepare-source");
  state.documents.push({ id: "doc-1" });
  assert.equal(getWorkflowState().nextAction, "generate-cases");
  state.cases.push({ id: "case-1", executionStatus: "未执行" });
  assert.equal(getWorkflowState().nextAction, "execute-cases");
  state.cases[0].executionStatus = "通过";
  assert.equal(getWorkflowState().nextAction, "export-report");
});

test("moveTaskToBatch synchronizes task, case, and bug version metadata", () => {
  const state = {
    tasks: [{ id: "task-1", name: "登录测试", batchId: "batch-default" }],
    cases: [{ id: "case-1", taskId: "task-1", batchId: "batch-default" }],
    bugs: [{ id: "bug-1", taskId: "task-1", batchId: "batch-default" }]
  };
  const moveTaskToBatch = loadFunction("moveTaskToBatch", {
    state,
    getTaskById: (taskId) => state.tasks.find((item) => item.id === taskId),
    formatBatchLabel: (batch) => batch.version,
    applyUpdateAuditFields: (item) => ({ ...item, updatedAt: "now" })
  });

  moveTaskToBatch("task-1", { id: "batch-v2", version: "V2.0", moduleId: "", moduleName: "", name: "" });

  assert.equal(state.tasks[0].batchId, "batch-v2");
  assert.equal(state.tasks[0].batchVersion, "V2.0");
  assert.equal(state.cases[0].batchId, "batch-v2");
  assert.equal(state.cases[0].batchVersion, "V2.0");
  assert.equal(state.bugs[0].batchId, "batch-v2");
  assert.equal(state.bugs[0].batchVersion, "V2.0");
});

test("isTaskReadonly locks completed tasks and tasks under completed versions", () => {
  const batches = [
    { id: "batch-active", status: "进行中" },
    { id: "batch-complete", status: "已完成" }
  ];
  const isTaskReadonly = loadFunction("isTaskReadonly", {
    getBatchById: (batchId) => batches.find((item) => item.id === batchId)
  });

  assert.equal(isTaskReadonly({ status: "已完成", batchId: "batch-active" }), true);
  assert.equal(isTaskReadonly({ status: "进行中", batchId: "batch-complete" }), true);
  assert.equal(isTaskReadonly({ status: "进行中", batchId: "batch-active" }), false);
});

test("buildAutomationRuntimeSteps converts visual steps into runner actions", () => {
  const runtimeSteps = buildAutomationRuntimeSteps([
    { stepType: "openPage", target: "/orders/list", locatorType: "css", inputValue: "", remark: "" },
    { stepType: "click", locatorType: "text", target: "搜索", inputValue: "", remark: "" },
    { stepType: "input", locatorType: "placeholder", target: "请输入关键词", inputValue: "退款", remark: "" },
    { stepType: "assertText", locatorType: "css", target: "body", inputValue: "成功", remark: "" },
    { stepType: "wait", locatorType: "css", target: "", inputValue: "1500", remark: "" }
  ]);

  assert.deepEqual(toPlainJson(runtimeSteps), [
    { stepType: "openPage", locatorType: "css", target: "/orders/list", inputValue: "", remark: "", action: "goto", path: "/orders/list" },
    { stepType: "click", locatorType: "text", target: "搜索", inputValue: "", remark: "", action: "click", selector: "text=搜索" },
    { stepType: "input", locatorType: "placeholder", target: "请输入关键词", inputValue: "退款", remark: "", action: "fill", selector: "placeholder=请输入关键词", value: "退款" },
    { stepType: "assertText", locatorType: "css", target: "body", inputValue: "成功", remark: "", action: "assertText", selector: "body", text: "成功" },
    { stepType: "wait", locatorType: "css", target: "", inputValue: "1500", remark: "", action: "waitForTimeout", ms: 1500 }
  ]);
});

test("parseAutomationStepsJson normalizes legacy runner JSON into visual steps", () => {
  const steps = parseAutomationStepsJson(JSON.stringify([
    { action: "goto", path: "/login" },
    { action: "fill", selector: "placeholder=请输入账号", value: "qa" },
    { action: "click", selector: "text=登录" },
    { action: "assertVisible", selector: ".dashboard" }
  ]));

  assert.deepEqual(toPlainJson(steps), [
    { stepType: "openPage", locatorType: "css", target: "/login", inputValue: "", remark: "" },
    { stepType: "input", locatorType: "css", target: "placeholder=请输入账号", inputValue: "qa", remark: "" },
    { stepType: "click", locatorType: "css", target: "text=登录", inputValue: "", remark: "" },
    { stepType: "assertElement", locatorType: "css", target: ".dashboard", inputValue: "", remark: "" }
  ]);
});
const buildAutomationSelector = loadFunction("buildAutomationSelector");
const buildAutomationRuntimeSteps = loadFunction("buildAutomationRuntimeSteps", {
  normalizeAutomationStep,
  buildAutomationSelector
});
const parseAutomationStepsJson = loadFunction("parseAutomationStepsJson", {
  normalizeAutomationStep
});

function toPlainJson(value) {
  return JSON.parse(JSON.stringify(value));
}

test("mergeCasesIntoState replaces only the current task cases", () => {
  const existingCases = [
    { id: "case-task-1-old", taskId: "task-1", batchId: "batch-1", title: "old task 1 case" },
    { id: "case-task-2-old", taskId: "task-2", batchId: "batch-1", title: "keep task 2 case" }
  ];
  const nextCases = [
    { id: "case-task-1-new", taskId: "task-1", batchId: "batch-1", title: "new task 1 case" }
  ];

  const merged = mergeCasesIntoState(existingCases, nextCases, {
    taskId: "task-1",
    batchId: "batch-1"
  });

  assert.deepEqual(toPlainJson(merged), [
    { id: "case-task-2-old", taskId: "task-2", batchId: "batch-1", title: "keep task 2 case" },
    { id: "case-task-1-new", taskId: "task-1", batchId: "batch-1", title: "new task 1 case" }
  ]);
});

test("mergeCasesIntoState appends when no task scope is available", () => {
  const existingCases = [
    { id: "case-1", taskId: "", batchId: "", title: "existing" }
  ];
  const nextCases = [
    { id: "case-2", taskId: "", batchId: "", title: "incoming" }
  ];

  const merged = mergeCasesIntoState(existingCases, nextCases);

  assert.deepEqual(toPlainJson(merged), [
    { id: "case-1", taskId: "", batchId: "", title: "existing" },
    { id: "case-2", taskId: "", batchId: "", title: "incoming" }
  ]);
});

test("saveApiSettings auto-enables a saved API key", async () => {
  const calls = [];
  const settings = {
    apiKey: "",
    model: "gpt-5.4",
    currentOperator: "QA",
    apiReady: false
  };
  const state = {
    settings: {
      apiKey: "",
      model: "gpt-5.4",
      currentOperator: "QA"
    }
  };
  const els = {
    apiKey: { value: "sk-test" },
    modelSelect: { value: "gpt-5.4" }
  };

  const saveApiSettings = loadFunction("saveApiSettings", {
    settings,
    state,
    els,
    normalizeAiModel: (value) => String(value || "").trim() || "gpt-5.4",
    persist: () => calls.push("persist"),
    setApiStatus: (text, tone) => calls.push(["setApiStatus", text, tone]),
    setApiFeedback: (text, tone) => calls.push(["setApiFeedback", text, tone]),
    checkAiKey: async (options) => {
      calls.push(["checkAiKey", options]);
      settings.apiReady = true;
    }
  });

  await saveApiSettings({ autoCheck: true });

  assert.equal(settings.apiKey, "sk-test");
  assert.equal(settings.model, "gpt-5.4");
  assert.equal(settings.apiReady, true);
  assert.deepEqual(toPlainJson(state.settings), {
    apiKey: "sk-test",
    model: "gpt-5.4",
    currentOperator: "QA"
  });
  assert.deepEqual(toPlainJson(calls), [
    "persist",
    ["setApiStatus", "已保存，正在检测", "neutral"],
    ["setApiFeedback", "个人 Key 已保存，正在自动检测并启用。", "neutral"],
    ["checkAiKey", {
      showFeedback: false,
      successMessage: "个人 Key 已保存并启用，接下来可以直接生成用例。",
      errorMessage: "个人 Key 已保存，但自动启用失败了，请检查 Key、模型或网络。"
    }]
  ]);
});

test("ensureAiReadyForGeneration auto-checks saved key before generating", async () => {
  const calls = [];
  const settings = {
    apiKey: "sk-test",
    model: "gpt-5.4",
    currentOperator: "",
    apiReady: false
  };

  const ensureAiReadyForGeneration = loadFunction("ensureAiReadyForGeneration", {
    settings,
    setApiStatus: (text, tone) => calls.push(["setApiStatus", text, tone]),
    setApiFeedback: (text, tone) => calls.push(["setApiFeedback", text, tone]),
    setGenerationStatus: (text, tone) => calls.push(["setGenerationStatus", text, tone]),
    checkAiKey: async (options) => {
      calls.push(["checkAiKey", options]);
      settings.apiReady = true;
    }
  });

  const ready = await ensureAiReadyForGeneration();

  assert.equal(ready, true);
  assert.equal(settings.apiReady, true);
  assert.deepEqual(toPlainJson(calls), [[
    "checkAiKey",
    {
      showFeedback: false,
      successMessage: "已自动启用个人 Key，本次会直接继续生成用例。",
      errorMessage: "自动启用个人 Key 失败，请检查 Key、模型或网络。"
    }
  ]]);
});

test("ensureAiReadyForGeneration blocks generation when no API key is saved", async () => {
  const calls = [];
  const settings = {
    apiKey: "",
    model: "gpt-5.4",
    currentOperator: "",
    apiReady: false
  };

  const ensureAiReadyForGeneration = loadFunction("ensureAiReadyForGeneration", {
    settings,
    setApiStatus: (text, tone) => calls.push(["setApiStatus", text, tone]),
    setApiFeedback: (text, tone) => calls.push(["setApiFeedback", text, tone]),
    setGenerationStatus: (text, tone) => calls.push(["setGenerationStatus", text, tone]),
    checkAiKey: async () => calls.push("unexpected-check")
  });

  const ready = await ensureAiReadyForGeneration();

  assert.equal(ready, false);
  assert.deepEqual(toPlainJson(calls), [
    ["setApiStatus", "需要填写 API Key", "warn"],
    ["setApiFeedback", "请先填写你的个人 API Key，再点“检测并启用”。", "warn"],
  ]);
});

test("case quality reports are isolated by selected business", () => {
  const state = { caseQualityReports: {} };
  const normalizeCaseQualityReport = loadFunction("normalizeCaseQualityReport");
  const normalizeCaseQualityBusiness = loadFunction("normalizeCaseQualityBusiness", {
    CASE_QUALITY_BUSINESSES: ["VA业务", "卡收单业务"],
    normalizeBusinessName: (value) => String(value || "").trim()
  });
  const setCaseQualityReportForBusiness = loadFunction("setCaseQualityReportForBusiness", {
    state,
    normalizeCaseQualityBusiness,
    normalizeCaseQualityReport
  });
  const getCaseQualityReportForBusiness = loadFunction("getCaseQualityReportForBusiness", {
    state,
    normalizeCaseQualityBusiness
  });

  setCaseQualityReportForBusiness({ label: "VA通过", tone: "ok" }, "VA业务");
  setCaseQualityReportForBusiness({ label: "卡收单需关注", tone: "warn" }, "卡收单业务");

  assert.equal(getCaseQualityReportForBusiness("VA业务").label, "VA通过");
  assert.equal(getCaseQualityReportForBusiness("卡收单业务").label, "卡收单需关注");
});

test("card acquiring quality rules flag business coverage and logic gaps", () => {
  const rules = [
    { id: "A2", name: "用例ID格式", severity: "error" },
    { id: "A3", name: "优先级枚举值", severity: "error" },
    { id: "B1", name: "交易类型覆盖", severity: "error" },
    { id: "B2", name: "下单方式覆盖", severity: "error" },
    { id: "B3", name: "卡品牌覆盖", severity: "error" },
    { id: "B4", name: "响应码覆盖", severity: "error" },
    { id: "B5", name: "金额边界覆盖", severity: "error" },
    { id: "B6", name: "3DS验证覆盖", severity: "error" },
    { id: "B7", name: "回调通知覆盖", severity: "error" },
    { id: "B8", name: "幂等性覆盖", severity: "error" },
    { id: "C1", name: "撤销/退款需原交易", severity: "error" },
    { id: "C4", name: "零额必失败", severity: "error" },
    { id: "E2", name: "P0占比合理", severity: "warning" }
  ];
  const issues = runCardAcquiringQualityRules([
    {
      id: "case-runtime-1",
      caseNo: "case-1",
      module: "卡收单支付",
      title: "Visa 收银台消费成功",
      priority: "P3",
      preconditions: "商户已开通卡收单。",
      steps: "输入 Visa 卡号并提交金额 10 元",
      expected: "响应码 00，支付状态 success，金额 10 元"
    },
    {
      id: "case-runtime-2",
      caseNo: "CARD-REF-002",
      module: "卡收单退款",
      title: "退款没有原交易",
      priority: "P1",
      preconditions: "商户已开通卡收单。",
      steps: "调用退款 API，退款金额 5 元",
      expected: "返回退款成功"
    },
    {
      id: "case-runtime-3",
      caseNo: "CARD-AMT-003",
      module: "卡收单金额边界",
      title: "零额交易",
      priority: "P1",
      preconditions: "商户已开通卡收单。",
      steps: "直连 API 提交金额 0 元",
      expected: "响应码 00，支付成功"
    }
  ], rules);

  const issueIds = new Set(issues.map((issue) => issue.ruleId));
  assert.equal(issueIds.has("A2"), true);
  assert.equal(issueIds.has("A3"), true);
  assert.equal(issueIds.has("B1"), true);
  assert.equal(issueIds.has("C1"), true);
  assert.equal(issueIds.has("C4"), true);
  assert.equal(issues.some((issue) => issue.ruleId === "E2" && issue.severity === "warning"), true);
});

test("BUG workflow advances in order and stops after closing", () => {
  const getNextBugTransition = loadFunction("getNextBugTransition");
  const isBugCompletedStatus = loadFunction("isBugCompletedStatus");

  assert.deepEqual(toPlainJson(getNextBugTransition("新建")), { status: "已提交", label: "提交 BUG" });
  assert.deepEqual(toPlainJson(getNextBugTransition("已提交")), { status: "已修复", label: "标记已修复" });
  assert.deepEqual(toPlainJson(getNextBugTransition("已修复")), { status: "待回归", label: "提交回归" });
  assert.deepEqual(toPlainJson(getNextBugTransition("待回归")), { status: "已验证", label: "验证通过" });
  assert.deepEqual(toPlainJson(getNextBugTransition("已验证")), { status: "已关闭", label: "关闭 BUG" });
  assert.equal(getNextBugTransition("已关闭"), null);
  assert.equal(isBugCompletedStatus("已验证"), true);
  assert.equal(isBugCompletedStatus("已关闭"), true);
  assert.equal(isBugCompletedStatus("待回归"), false);
});
