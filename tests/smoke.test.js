const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const SERVER_ENTRY = path.join(ROOT, "server.js");
let testPort = 4199;
const BASE_URL = {
  toString() {
    return `http://127.0.0.1:${testPort}`;
  }
};

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-report-smoke-"));
const appStateFile = path.join(tempDir, "app-state.json");
const teamMembersFile = path.join(tempDir, "team-members.json");
const bugAttachmentsRoot = path.join(tempDir, "bug-attachments");
const publishedReportsRoot = path.join(tempDir, "published-reports");
const exportDir = path.join(ROOT, "tmp", "exports");
const exportPrefix = `smoke-${Date.now()}`;

let serverProcess;

test.before(async () => {
  testPort = await getAvailablePort();
  serverProcess = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(testPort),
      APP_STATE_FILE: appStateFile,
      TEAM_MEMBERS_FILE: teamMembersFile,
      BUG_ATTACHMENTS_ROOT: bugAttachmentsRoot,
      PUBLISHED_REPORTS_ROOT: publishedReportsRoot,
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
  assert.match(html, /<script src="quality-rules\.js"><\/script>/);
  assert.match(html, /data-tab="report"/);
  assert.match(html, /data-quality-business="VA业务"/);
  assert.match(html, /data-quality-business="卡收单业务"/);
  assert.match(html, /id="qualityBusinessModules"/);
});

test("serves the responsive light workspace shell", async () => {
  const [htmlResponse, appResponse, stylesResponse] = await Promise.all([
    fetch(`${BASE_URL}/`),
    fetch(`${BASE_URL}/app.js`),
    fetch(`${BASE_URL}/styles.css`)
  ]);
  const html = await htmlResponse.text();
  const appSource = await appResponse.text();
  const styles = await stylesResponse.text();

  assert.equal(htmlResponse.status, 200);
  assert.equal(appResponse.status, 200);
  assert.equal(stylesResponse.status, 200);
  assert.match(html, /id="topbarTitle"/);
  assert.match(html, /id="topbarMenuBtn"/);
  assert.match(html, /id="sidebarBackdrop"/);
  assert.match(html, /class="skip-link" href="#mainContent"/);
  assert.match(html, /class="nav-group-label"[^>]*>创建</);
  assert.match(html, /id="mainContent" class="content" tabindex="-1"/);
  assert.match(appSource, /function hydrateNavigationChrome\(\)/);
  assert.match(appSource, /function toggleMobileNavigation\(open\)/);
  assert.match(styles, /--ui-primary:\s*#0798a6;/);
  assert.match(styles, /\.topbar\s*\{/);
  assert.match(styles, /@media \(max-width:\s*980px\)/);
  assert.match(html, /class="automation-beginner-path"/);
  assert.match(html, /class="automation-advanced-mode"/);
  assert.match(styles, /\.automation-advanced-mode\s*\{/);
});

test("combines task creation and case generation into one step", async () => {
  const [htmlResponse, appResponse, stylesResponse] = await Promise.all([
    fetch(`${BASE_URL}/`),
    fetch(`${BASE_URL}/app.js`),
    fetch(`${BASE_URL}/styles.css`)
  ]);
  const html = await htmlResponse.text();
  const appSource = await appResponse.text();
  const styles = await stylesResponse.text();

  assert.match(html, /upload-stage-panel-version hidden-field/);
  assert.match(html, /<h3>2\. 新建任务并生成用例<\/h3>/);
  assert.match(html, /id="createTaskAndGenerate"/);
  assert.doesNotMatch(html, /id="focusHint"/);
  assert.match(html, /<div class="form-row hidden-field" aria-hidden="true">\s*<label>\s*关联版本/s);
  assert.match(appSource, /const DEFAULT_WORKSPACE_VERSION = "默认工作区";/);
  assert.match(appSource, /function ensureDefaultTaskBatch\(\)/);
  assert.match(appSource, /async function createTaskAndGenerateCases\(\)/);
  assert.match(appSource, /function enhanceGenerationBeginnerFlow\(\)/);
  assert.match(appSource, /function createGenerationStepBlock\(number, title, description, className\)/);
  assert.match(appSource, /function handleWorkflowStepAction\(action\)/);
  assert.match(appSource, /data-workflow-action=/);
  assert.match(appSource, /const focusHint = activeTask\?\.scope \|\| "";/);
  assert.doesNotMatch(appSource, /nextAction: "create-meta"/);
  assert.match(styles, /grid-template-areas: "ai task";/);
  assert.match(styles, /\.combined-generation-divider\s*\{/);
  assert.match(styles, /\.generation-flow-steps\s*\{/);
  assert.match(styles, /\.generation-step-submit\s*\{/);
});

test("serves version table, creation dialog, and task assignment controls", async () => {
  const [htmlResponse, appResponse, stylesResponse] = await Promise.all([
    fetch(`${BASE_URL}/`),
    fetch(`${BASE_URL}/app.js`),
    fetch(`${BASE_URL}/styles.css`)
  ]);
  const html = await htmlResponse.text();
  const appSource = await appResponse.text();
  const styles = await stylesResponse.text();

  assert.match(html, /id="addVersionBtn"/);
  assert.match(html, /id="versionSearchInput"/);
  assert.match(html, /id="versionStatusFilter"/);
  assert.match(html, /id="versionModal"/);
  assert.match(html, /id="versionTaskOptions"/);
  assert.match(html, /id="versionCompleteModal"/);
  assert.match(html, /id="versionCompleteSummary"/);
  assert.match(appSource, /function saveVersionFromManager\(event\)/);
  assert.match(appSource, /function moveTaskToBatch\(taskId, batch\)/);
  assert.match(appSource, /function getVersionHealth\(batch\)/);
  assert.match(appSource, /function openVersionCompleteModal\(batch\)/);
  assert.match(appSource, /function confirmVersionCompletion\(\)/);
  assert.match(appSource, /data-version-action="link-tasks"/);
  assert.match(styles, /\.version-table\s*\{/);
  assert.match(styles, /\.version-health-summary\s*\{/);
  assert.match(styles, /\.version-complete-dialog\s*\{/);
  assert.match(styles, /\.version-task-option:has\(input:checked\)/);
});

test("serves task management navigation and table controls", async () => {
  const [htmlResponse, appResponse, stylesResponse] = await Promise.all([
    fetch(`${BASE_URL}/`),
    fetch(`${BASE_URL}/app.js`),
    fetch(`${BASE_URL}/styles.css`)
  ]);
  const html = await htmlResponse.text();
  const appSource = await appResponse.text();
  const styles = await stylesResponse.text();

  assert.match(html, /data-tab="tasks">任务管理/);
  assert.match(html, /<section class="tab-panel" id="tasks">/);
  assert.match(html, /id="taskSearchInput"/);
  assert.match(html, /id="taskVersionFilter"/);
  assert.match(html, /id="taskManagerList"/);
  assert.match(appSource, /function renderTaskTableRow\(task\)/);
  assert.match(appSource, /function getTaskCaseProgress\(task\)/);
  assert.match(appSource, /function matchesCaseTaskSearch\(item, taskFilter\)/);
  assert.match(appSource, /data-task-action="execute"/);
  assert.match(appSource, /data-clear-task-filters/);
  assert.match(appSource, /data-clear-version-filters/);
  assert.match(appSource, /tasks: '<path/);
  assert.match(styles, /\.task-table\s*\{/);
  assert.match(styles, /\.task-case-progress\s*\{/);
  assert.match(styles, /button\.task-execute-link/);
  assert.match(styles, /button\.version-link-task-button/);
});

test("keeps completed versions and tasks read only", async () => {
  const [appResponse, stylesResponse] = await Promise.all([
    fetch(`${BASE_URL}/app.js`),
    fetch(`${BASE_URL}/styles.css`)
  ]);
  const appSource = await appResponse.text();
  const styles = await stylesResponse.text();

  assert.match(appSource, /function isTaskReadonly\(task\)/);
  assert.match(appSource, /!isActive && !isReadonly/);
  assert.match(appSource, /\$\{!isActive && !isSuspended \?/);
  assert.match(appSource, /batch\.status === "已完成" && \["edit", "link-tasks", "suspend", "resume", "delete"\]/);
  assert.match(appSource, /data-task-detail-toggle/);
  assert.match(appSource, /data-task-readonly-detail/);
  assert.match(styles, /\.completed-task-detail\s*\{/);
});

test("serves the focused two-column manual execution workspace", async () => {
  const [htmlResponse, appResponse, stylesResponse] = await Promise.all([
    fetch(`${BASE_URL}/`),
    fetch(`${BASE_URL}/app.js`),
    fetch(`${BASE_URL}/styles.css`)
  ]);
  const html = await htmlResponse.text();
  const appSource = await appResponse.text();
  const styles = await stylesResponse.text();

  assert.match(html, /id="caseProgressPercent"/);
  assert.match(html, /class="manual-execution-layout"/);
  assert.match(html, /id="caseExecutionWorkspace"/);
  assert.match(html, /id="caseTaskFilter"[^>]+type="search"/);
  assert.match(html, /id="caseTaskOptions"/);
  assert.doesNotMatch(html, /id="caseBatchFilter"/);
  assert.match(html, /class="case-sort-hint">P0 优先/);
  assert.match(appSource, /function renderManualExecutionProgress\(cases\)/);
  assert.match(appSource, /data-clear-case-filters/);
  assert.match(appSource, /case-priority-chip/);
  assert.match(appSource, /function buildCasesCsvExport\(cases, activeTask, documentName\)/);
  assert.match(appSource, /function renderActiveCaseExecution\(item, filteredCases\)/);
  assert.match(appSource, /function getNextExecutionCaseId\(cases, currentCaseId, nextStatus\)/);
  assert.doesNotMatch(appSource, /data-start-execution/);
  assert.doesNotMatch(appSource, /execution-start-button/);
  assert.match(appSource, /data-case-result="通过"/);
  assert.match(appSource, /data-case-result="失败"/);
  assert.match(styles, /\.manual-execution-layout\s*\{/);
  assert.match(styles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(styles, /button\.execution-result-button\.result-pass/);
  assert.match(styles, /button\.execution-result-button\.result-fail/);
});

test("serves the ZenTao-style bug title list and modal details", async () => {
  const [htmlResponse, appResponse, stylesResponse] = await Promise.all([
    fetch(`${BASE_URL}/`),
    fetch(`${BASE_URL}/app.js`),
    fetch(`${BASE_URL}/styles.css`)
  ]);
  const html = await htmlResponse.text();
  const appSource = await appResponse.text();
  const styles = await stylesResponse.text();

  assert.match(html, /class="panel bug-filter-panel"/);
  assert.match(html, /<h3>筛选<\/h3>/);
  assert.match(html, /id="bugSearchInput"/);
  assert.match(html, /id="bugSeverityFilter"/);
  assert.match(html, /id="bugWorkflowStatusFilter"/);
  assert.match(html, /class="bug-editor-section"/);
  assert.match(html, /class="bug-title-list"/);
  assert.match(html, /id="bugModal"/);
  assert.match(html, /id="bugModalName"/);
  assert.match(html, /id="bugModalBatch"/);
  assert.match(html, /id="bugModalTask"/);
  assert.match(html, /id="bugModalCase"/);
  assert.match(html, /id="bugModalImagePreview"/);
  assert.match(appSource, /function openBugModal\(bugId = "", mode = bugId \? "view" : "create", sourceCase = null\)/);
  assert.match(appSource, /data-clear-bug-filters/);
  assert.match(appSource, /async function saveBugFromModal\(event\)/);
  assert.match(appSource, /function handleBugNotePaste\(event\)/);
  assert.match(appSource, /\/api\/bug-images/);
  assert.match(appSource, /data-view-bug-id/);
  assert.match(appSource, /data-transition-bug-id/);
  assert.match(appSource, /class="bug-table-title-text"/);
  assert.match(appSource, /function transitionBugStatus\(bugId\)/);
  assert.match(appSource, /function getNextBugTransition\(status\)/);
  assert.match(styles, /\.bug-title-row\s*\{/);
  assert.match(styles, /\.bug-management-table\s*\{/);
  assert.match(styles, /\.bug-dialog\s*\{/);
  assert.match(styles, /#bugModal\[data-mode="view"\]/);
});

test("keeps decorative header layers from blocking controls", async () => {
  const response = await fetch(`${BASE_URL}/styles.css`);
  const styles = await response.text();

  assert.equal(response.status, 200);
  assert.match(
    styles,
    /\.panel-header::before,\s*\.panel-header::after\s*\{[^}]*pointer-events:\s*none;/s
  );
});

test("serves the report menu as version and issue tables", async () => {
  const [htmlResponse, appResponse, stylesResponse] = await Promise.all([
    fetch(`${BASE_URL}/`),
    fetch(`${BASE_URL}/app.js`),
    fetch(`${BASE_URL}/styles.css`)
  ]);
  const html = await htmlResponse.text();
  const appSource = await appResponse.text();
  const styles = await stylesResponse.text();

  assert.match(html, /class="report-version-table-host"/);
  assert.match(html, /版本报告列表/);
  assert.match(html, /id="reportVersionSearch"/);
  assert.match(html, /id="reportVersionStatusFilter"/);
  assert.match(html, /id="reportReleaseFilter"/);
  assert.match(html, /id="reportVersionPagination"/);
  assert.match(html, /id="reportExportModal"/);
  assert.match(html, /id="reportExportPreview"/);
  assert.match(html, /id="publishReport"/);
  assert.match(html, /id="publishWebReport"/);
  assert.match(html, /id="publishedReportList"/);
  assert.match(html, /id="publishedReportCount"/);
  assert.match(html, /id="publishedReportSearch"/);
  assert.match(html, /id="toastRegion"/);
  assert.match(appSource, /class="report-version-table"/);
  assert.match(appSource, /class="report-detail-table"/);
  assert.match(appSource, /class="report-issue-table"/);
  assert.match(appSource, /button\[data-report-batch-id\]/);
  assert.match(appSource, /REPORT_VERSIONS_PER_PAGE = 10/);
  assert.match(appSource, /const filteredCards = versionCards\.filter/);
  assert.match(appSource, /function openReportExportPreview\(\)/);
  assert.match(appSource, /function closeReportExportPreview\(\)/);
  assert.match(appSource, /function buildReportDocxFileBaseName\(report\)/);
  assert.match(appSource, /async function publishCurrentReport\(\)/);
  assert.match(appSource, /async function loadPublishedReports\(\)/);
  assert.match(appSource, /async function handlePublishedReportListAction\(event\)/);
  assert.match(appSource, /batch\.systemManaged/);
  assert.match(appSource, /batch-default-workspace/);
  assert.match(appSource, /function showToast\(message, tone = "info"\)/);
  assert.match(styles, /\.report-version-table\s*[,\{]/);
  assert.match(styles, /\.report-detail-table\s*[,\{]/);
  assert.match(styles, /\.report-issue-table\s*\{/);
  assert.match(styles, /\.report-export-dialog\s*\{/);
  assert.match(styles, /\.toast-region\s*\{/);
});

test("serves the standalone published report template", async () => {
  const [htmlResponse, scriptResponse, styleResponse] = await Promise.all([
    fetch(`${BASE_URL}/report.html`),
    fetch(`${BASE_URL}/report.js`),
    fetch(`${BASE_URL}/report.css`)
  ]);
  const html = await htmlResponse.text();
  const script = await scriptResponse.text();
  const styles = await styleResponse.text();

  assert.equal(htmlResponse.status, 200);
  assert.equal(scriptResponse.status, 200);
  assert.equal(styleResponse.status, 200);
  assert.match(html, /id="reportRoot"/);
  assert.match(script, /async function loadPublishedReport\(\)/);
  assert.match(script, /data-report-view="overview"/);
  assert.doesNotMatch(script, /report\.scopeLabel\s*\|\|\s*"当前测试范围"/);
  assert.match(styles, /\.metric-grid\s*\{/);
  assert.match(styles, /@media print/);
});

test("omits operator and task owner fields from UI and exports", async () => {
  const [htmlResponse, appResponse] = await Promise.all([
    fetch(`${BASE_URL}/`),
    fetch(`${BASE_URL}/app.js`)
  ]);
  const html = await htmlResponse.text();
  const appSource = await appResponse.text();
  const serverSource = fs.readFileSync(SERVER_ENTRY, "utf-8");

  assert.equal(htmlResponse.status, 200);
  assert.equal(appResponse.status, 200);
  assert.doesNotMatch(html, /currentOperatorSelect/);
  assert.doesNotMatch(appSource, /taskOwnerSelect|任务负责人|测试负责人/);
  assert.doesNotMatch(serverSource, /"负责人"\s*:/);
});

test("serves quality rule configuration", async () => {
  const response = await fetch(`${BASE_URL}/quality-rules.js`);
  const source = await response.text();

  assert.equal(response.status, 200);
  assert.match(source, /CASE_QUALITY_RULESETS/);
  assert.match(source, /VA业务/);
  assert.match(source, /卡收单业务/);
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

test("runs deployment-safe self-tests without starting a nested smoke server", async () => {
  const response = await fetch(`${BASE_URL}/api/self-test`, { method: "POST" });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.ok(data.summary.tests > 0);
  assert.equal(data.summary.fail, 0);
  assert.equal(data.trigger, "manual");
});

test("reports api automation config without exposing keys", async () => {
  const response = await fetch(`${BASE_URL}/api/api-automation/config`);
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.defaultSite, "klicklpay");
  assert.equal(data.sites.klicklpay.label, "KlicklPay");
  assert.equal(data.sites.sunpay.label, "SunPay");
  assert.deepEqual(Object.keys(data.sites.sunpay.environments), ["sandbox"]);
  assert.equal(data.sites.sunpay.environments.sandbox.baseUrl, "https://sandbox-oapi.sunpay.pro");
  assert.equal(typeof data.sites.sunpay.environments.sandbox.headers["SunPay-Key"], "boolean");
  assert.equal(data.sites.sunpay.signature.status, "ready");
  assert.equal(data.sites.sunpay.signature.algorithm, "SHA256");
  assert.equal(data.sites.sunpay.signature.headers.timestamp, "SunPay-Timestamp");
  assert.equal(data.sites.sunpay.signature.headers.nonce, "SunPay-Nonce");
  assert.equal(data.sites.sunpay.signature.headers.signature, "SunPay-Sign");
  assert.equal(data.environments.test.baseUrl, "https://test-oapi.klicklpay.com");
  assert.equal(data.environments.sandbox.baseUrl, "https://sandbox-oapi.klicklpay.com");
  assert.equal(typeof data.environments.test.headers["KlicklPay-Key"], "boolean");
  assert.equal(typeof data.environments.sandbox.headers["KlicklPay-Key"], "boolean");
  assert.equal(data.signature.status, "ready");
  assert.equal(data.signature.algorithm, "SHA256");
  assert.equal(data.signature.timestampUnit, "milliseconds");
  assert.equal(data.signature.nonceLength, 32);
  assert.equal(typeof data.signature.apiKeyConfigured, "boolean");
  assert.equal(data.signature.headers.timestamp, "KlicklPay-Timestamp");
  assert.equal(data.signature.headers.nonce, "KlicklPay-Nonce");
  assert.equal(data.signature.headers.signature, "KlicklPay-Sign");
  assert.equal(data.signature.apiKey, undefined);
  assert.equal(data.sites.klicklpay.signature.apiKey, undefined);
  assert.equal(data.sites.sunpay.signature.apiKey, undefined);
});

test("reports ui automation session status", async () => {
  const response = await fetch(`${BASE_URL}/api/ui-automation/session-status`);
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(typeof data.available, "boolean");
  assert.equal(typeof data.authSaved, "boolean");
  assert.equal(typeof data.active, "boolean");
});

test("blocks direct access to private server files", async () => {
  const serverFileResponse = await fetch(`${BASE_URL}/server.js`);
  const stateFileResponse = await fetch(`${BASE_URL}/app-state.json`);

  assert.equal(serverFileResponse.status, 404);
  assert.equal(stateFileResponse.status, 404);
});

test("stores, serves, and deletes pasted BUG images", async () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const uploadResponse = await fetch(`${BASE_URL}/api/bug-images?bugId=bug-smoke`, {
    method: "POST",
    headers: {
      "Content-Type": "image/png",
      "X-File-Name": encodeURIComponent("粘贴截图.png")
    },
    body: png
  });
  const uploaded = await uploadResponse.json();

  assert.equal(uploadResponse.status, 201);
  assert.equal(uploaded.image.mimeType, "image/png");
  assert.equal(uploaded.image.fileName, "粘贴截图.png");

  const imageResponse = await fetch(`${BASE_URL}${uploaded.image.url}`);
  assert.equal(imageResponse.status, 200);
  assert.equal(imageResponse.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await imageResponse.arrayBuffer()), png);

  const deleteResponse = await fetch(`${BASE_URL}${uploaded.image.url}`, { method: "DELETE" });
  const missingResponse = await fetch(`${BASE_URL}${uploaded.image.url}`);
  assert.equal(deleteResponse.status, 200);
  assert.equal(missingResponse.status, 404);
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
      reportConclusions: { "batch-1": "Looks good" },
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

  const docxScript = fs.readFileSync(path.join(ROOT, "tmp", "export_report_docx.py"), "utf-8");
  ["文档信息", "用例执行统计", "缺陷统计", "风险与结论", "阻塞原因汇总", "测试结论与建议", "重点关注"]
    .forEach((heading) => assert.match(docxScript, new RegExp(heading)));
  assert.doesNotMatch(docxScript, /报告范围/);
  assert.doesNotMatch(docxScript, /测试范围摘要/);
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

test("publishes and serves a readonly report snapshot", async () => {
  const report = buildReportPayload();
  report.scope = {
    cases: [{ id: "case-1", title: "Login succeeds", executionStatus: "通过" }],
    bugs: []
  };
  const publishResponse = await fetch(`${BASE_URL}/api/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "V1.0 测试报告", report, reportConclusion: "可以发布" })
  });
  const published = await publishResponse.json();

  assert.equal(publishResponse.status, 201);
  assert.match(published.id, /^rpt-[a-z0-9-]+$/);
  assert.equal(published.url, `/report/${published.id}`);
  assert.equal(fs.existsSync(path.join(publishedReportsRoot, `${published.id}.json`)), true);

  const pageResponse = await fetch(`${BASE_URL}${published.url}`);
  const readResponse = await fetch(`${BASE_URL}/api/reports/${published.id}`);
  const snapshot = await readResponse.json();
  assert.equal(pageResponse.status, 200);
  assert.match(await pageResponse.text(), /id="reportRoot"/);
  assert.equal(readResponse.status, 200);
  assert.equal(snapshot.title, "V1.0 测试报告");
  assert.equal(snapshot.report.scope.cases[0].title, "Login succeeds");

  const listResponse = await fetch(`${BASE_URL}/api/reports`);
  const list = await listResponse.json();
  assert.equal(listResponse.status, 200);
  assert.equal(list.reports.some((item) => item.id === published.id), true);

  const revokeResponse = await fetch(`${BASE_URL}/api/reports/${published.id}`, { method: "DELETE" });
  const revokedReadResponse = await fetch(`${BASE_URL}/api/reports/${published.id}`);
  assert.equal(revokeResponse.status, 200);
  assert.equal(revokedReadResponse.status, 404);
});

test("rejects invalid published report payloads and missing ids", async () => {
  const invalidResponse = await fetch(`${BASE_URL}/api/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Missing report" })
  });
  const missingResponse = await fetch(`${BASE_URL}/api/reports/rpt-does-not-exist`);

  assert.equal(invalidResponse.status, 400);
  assert.equal(missingResponse.status, 404);
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

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address && typeof address === "object" ? address.port : 0;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}
