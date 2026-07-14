const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const APP_JS_PATH = path.join(__dirname, "..", "app.js");
const appSource = fs.readFileSync(APP_JS_PATH, "utf-8");

function extractFunctionSource(functionName) {
  const asyncStartToken = `async function ${functionName}(`;
  const syncStartToken = `function ${functionName}(`;
  const start = appSource.indexOf(asyncStartToken) !== -1
    ? appSource.indexOf(asyncStartToken)
    : appSource.indexOf(syncStartToken);
  if (start === -1) {
    throw new Error(`Unable to find ${functionName} in app.js`);
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
const normalizeAutomationStep = loadFunction("normalizeAutomationStep", {
  normalizeAutomationStepType,
  normalizeAutomationLocatorType,
  inferAutomationTargetFromRawStep
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
