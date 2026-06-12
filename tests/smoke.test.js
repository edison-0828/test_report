const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const SERVER_ENTRY = path.join(ROOT, "server.js");
const TEST_PORT = 4199;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-report-smoke-"));
const appStateFile = path.join(tempDir, "app-state.json");
const teamMembersFile = path.join(tempDir, "team-members.json");
const exportDir = path.join(ROOT, "tmp", "exports");
const exportPrefix = `smoke-${Date.now()}`;

let serverProcess;

test.before(async () => {
  serverProcess = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      APP_STATE_FILE: appStateFile,
      TEAM_MEMBERS_FILE: teamMembersFile,
      SELF_TEST_AUTORUN: "false"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const startupErrors = [];
  serverProcess.stderr.on("data", (chunk) => {
    startupErrors.push(String(chunk));
  });

  serverProcess.on("exit", (code) => {
    if (code !== 0) {
      startupErrors.push(`Server exited with code ${code}.`);
    }
  });

  await waitForServer(startupErrors);
});

test.after(async () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill("SIGTERM");
    await onceExit(serverProcess);
  }

  fs.rmSync(tempDir, { recursive: true, force: true });

  for (const fileName of fs.readdirSync(exportDir)) {
    if (fileName.startsWith(exportPrefix)) {
      fs.rmSync(path.join(exportDir, fileName), { force: true });
    }
  }
});

test("serves the app shell", async () => {
  const response = await fetch(`${BASE_URL}/`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /<!DOCTYPE html>/i);
  assert.match(html, /<script src="app\.js"><\/script>/);
  assert.match(html, /data-tab="report"/);
});

test("reports healthy server metadata", async () => {
  const response = await fetch(`${BASE_URL}/api/health`);
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(typeof data.defaultModel, "string");
});

test("reports self-test scheduler status", async () => {
  const response = await fetch(`${BASE_URL}/api/self-test-status`);
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.autorunEnabled, false);
  assert.equal(data.intervalHours, 3);
  assert.equal(data.running, false);
});

test("blocks direct access to private server files", async () => {
  const serverFileResponse = await fetch(`${BASE_URL}/server.js`);
  const stateFileResponse = await fetch(`${BASE_URL}/app-state.json`);

  assert.equal(serverFileResponse.status, 404);
  assert.equal(stateFileResponse.status, 404);
});

test("persists and reloads shared app state", async () => {
  const payload = {
    state: {
      documents: [{ id: "doc-1", name: "API" }],
      cases: [{ id: "case-1", title: "returns 200" }],
      bugs: [],
      batches: [{ id: "batch-1", version: "V1.0.0" }],
      tasks: [{ id: "task-1", name: "smoke" }],
      reportConclusion: "Looks good",
      lastGeneration: { at: "2026-06-12T00:00:00Z" }
    }
  };

  const saveResponse = await fetch(`${BASE_URL}/api/app-state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const saved = await saveResponse.json();
  const readResponse = await fetch(`${BASE_URL}/api/app-state`);
  const loaded = await readResponse.json();

  assert.equal(saveResponse.status, 200);
  assert.deepEqual(saved.state, payload.state);
  assert.equal(readResponse.status, 200);
  assert.deepEqual(loaded.state, payload.state);

  const storedRaw = fs.readFileSync(appStateFile, "utf-8");
  const stored = JSON.parse(storedRaw);
  assert.deepEqual(stored.state, payload.state);
});

test("persists normalized team members", async () => {
  const payload = {
    teamMembers: [" Alice ", "Bob", "", "Alice", "Carol", "Bob"]
  };

  const saveResponse = await fetch(`${BASE_URL}/api/team-members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const saved = await saveResponse.json();
  const readResponse = await fetch(`${BASE_URL}/api/team-members`);
  const loaded = await readResponse.json();

  assert.equal(saveResponse.status, 200);
  assert.deepEqual(saved.teamMembers, ["Alice", "Bob", "Carol"]);
  assert.equal(readResponse.status, 200);
  assert.deepEqual(loaded.teamMembers, ["Alice", "Bob", "Carol"]);

  const storedRaw = fs.readFileSync(teamMembersFile, "utf-8");
  const stored = JSON.parse(storedRaw);
  assert.deepEqual(stored.teamMembers, ["Alice", "Bob", "Carol"]);
});

test("exports a docx report", async () => {
  const fileBaseName = `${exportPrefix}-report`;
  const response = await fetch(`${BASE_URL}/api/export-report-docx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileBaseName,
      reportConclusion: "No blockers",
      report: buildReportPayload()
    })
  });

  const arrayBuffer = await response.arrayBuffer();
  const fileSignature = Buffer.from(arrayBuffer).subarray(0, 2).toString("utf-8");
  const outputPath = path.join(exportDir, `${fileBaseName}.docx`);

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("content-type"),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  assert.equal(fileSignature, "PK");
  assert.equal(fs.existsSync(outputPath), true);
});

test("rejects report export without report payload", async () => {
  const response = await fetch(`${BASE_URL}/api/export-report-docx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileBaseName: `${exportPrefix}-missing-report` })
  });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.error, "缺少报告数据。");
});

test("rejects unsupported methods for api routes", async () => {
  const response = await fetch(`${BASE_URL}/api/app-state`, {
    method: "DELETE"
  });
  const data = await response.json();

  assert.equal(response.status, 405);
  assert.equal(data.error, "Method not allowed");
});

async function waitForServer(startupErrors) {
  const start = Date.now();
  while (Date.now() - start < 10_000) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) {
        return;
      }
    } catch (_error) {
      // Retry until the server is ready.
    }

    if (startupErrors.length) {
      throw new Error(startupErrors.join("\n"));
    }

    await delay(150);
  }

  throw new Error(`Server did not become ready in time.\n${startupErrors.join("\n")}`);
}

function buildReportPayload() {
  return {
    releaseDecision: { label: "可发布", desc: "核心流程通过" },
    heroTitle: "Smoke",
    batchVersion: "V1.0.0",
    taskName: "Regression",
    testOwners: ["QA"],
    generatedAt: "2026-06-12 21:00",
    scopeLabel: "全部任务",
    scopeSummaryItems: [["范围", "核心回归"]],
    total: 2,
    executed: 2,
    passed: 2,
    passRate: "100%",
    statusCounts: { "失败": 0, "阻塞": 0, "未执行": 0 },
    scope: { bugs: [] },
    openBugs: 0,
    failedCaseBugCount: 0,
    bugStatusCounts: { "新建": 0, "已提交": 0, "已修复": 0, "待回归": 0, "已验证": 0, "已关闭": 0 },
    bugSeverityCounts: { "严重": 0, "中": 0, "低": 0 },
    blockedSummary: "当前没有阻塞用例。",
    conclusionAdviceItems: [["当前判断", "可以发布"]],
    failedCases: [],
    unresolvedBugs: []
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function onceExit(childProcess) {
  return new Promise((resolve) => {
    childProcess.once("exit", () => resolve());
  });
}
