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
    model: "gpt-5.4-mini",
    currentOperator: "QA",
    apiReady: false
  };
  const state = {
    settings: {
      apiKey: "",
      model: "gpt-5.4-mini",
      currentOperator: "QA"
    }
  };
  const els = {
    apiKey: { value: "sk-test" },
    modelSelect: { value: "gpt-5.4" },
    saveApiKey: {}
  };

  const saveApiSettings = loadFunction("saveApiSettings", {
    settings,
    state,
    els,
    persist: () => calls.push("persist"),
    setApiStatus: (text, tone) => calls.push(["setApiStatus", text, tone]),
    setApiFeedback: (text, tone) => calls.push(["setApiFeedback", text, tone]),
    renderApiStateBoard: () => calls.push("renderApiStateBoard"),
    flashButtonSuccess: (button, text) => calls.push(["flashButtonSuccess", button === els.saveApiKey, text]),
    checkAiKey: async (options) => {
      calls.push(["checkAiKey", options]);
      settings.apiReady = true;
    }
  });

  await saveApiSettings();

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
    "renderApiStateBoard",
    ["flashButtonSuccess", true, "保存成功"],
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
    model: "gpt-5.4-mini",
    currentOperator: "",
    apiReady: false
  };

  const ensureAiReadyForGeneration = loadFunction("ensureAiReadyForGeneration", {
    settings,
    setApiStatus: (text, tone) => calls.push(["setApiStatus", text, tone]),
    setApiFeedback: (text, tone) => calls.push(["setApiFeedback", text, tone]),
    renderApiStateBoard: () => calls.push("renderApiStateBoard"),
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
    model: "gpt-5.4-mini",
    currentOperator: "",
    apiReady: false
  };

  const ensureAiReadyForGeneration = loadFunction("ensureAiReadyForGeneration", {
    settings,
    setApiStatus: (text, tone) => calls.push(["setApiStatus", text, tone]),
    setApiFeedback: (text, tone) => calls.push(["setApiFeedback", text, tone]),
    renderApiStateBoard: () => calls.push("renderApiStateBoard"),
    setGenerationStatus: (text, tone) => calls.push(["setGenerationStatus", text, tone]),
    checkAiKey: async () => calls.push("unexpected-check")
  });

  const ready = await ensureAiReadyForGeneration();

  assert.equal(ready, false);
  assert.deepEqual(toPlainJson(calls), [
    ["setApiStatus", "需要填写 API Key", "warn"],
    ["setApiFeedback", "请先填写并保存你的个人 API Key。", "warn"],
    "renderApiStateBoard"
  ]);
});
