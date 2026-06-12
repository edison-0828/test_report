const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const APP_JS_PATH = path.join(__dirname, "..", "app.js");
const appSource = fs.readFileSync(APP_JS_PATH, "utf-8");

function loadFunction(functionName) {
  const startToken = `function ${functionName}(`;
  const start = appSource.indexOf(startToken);
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

  const snippet = `${appSource.slice(start, end)}\nmodule.exports = ${functionName};`;
  const context = { module: { exports: null } };
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
