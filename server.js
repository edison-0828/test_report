const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

loadEnvFile(path.join(__dirname, ".env"));

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const TEAM_MEMBERS_FILE = process.env.TEAM_MEMBERS_FILE || path.join(ROOT, "team-members.json");
const APP_STATE_FILE = process.env.APP_STATE_FILE || path.join(ROOT, "app-state.json");
const APP_STATE_BACKUP_DIR = process.env.APP_STATE_BACKUP_DIR || `${APP_STATE_FILE}.backups`;
const APP_STATE_BACKUP_LIMIT = 20;
const BUG_ATTACHMENTS_ROOT = process.env.BUG_ATTACHMENTS_ROOT || path.join(ROOT, "data", "bug-attachments");
const PUBLISHED_REPORTS_ROOT = process.env.PUBLISHED_REPORTS_ROOT || path.join(ROOT, "data", "published-reports");
const MAX_BUG_IMAGE_BYTES = 5 * 1024 * 1024;
const API_AUTOMATION_CONFIG_FILE = process.env.API_AUTOMATION_CONFIG_FILE || path.join(ROOT, "api-automation.config.json");
const API_AUTOMATION_CONFIG_EXAMPLE_FILE = path.join(ROOT, "api-automation.config.example.json");
const PYTHON_BIN = resolvePythonBin();
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5.4";
const LARK_API_BASE_URL = process.env.LARK_API_BASE_URL || "https://open.larksuite.com";
const SELF_TEST_INTERVAL_MS = 3 * 60 * 60 * 1000;
const SELF_TEST_AUTORUN = process.env.SELF_TEST_AUTORUN !== "false";
// The live server already proves HTTP startup; another web server can cause deployment-only false alarms.
const RUNTIME_SELF_TEST_EXCLUDED_FILES = new Set(["smoke.test.js"]);
const STATIC_FILE_ALLOWLIST = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/styles.css", "styles.css"],
  ["/report.html", "report.html"],
  ["/report.css", "report.css"],
  ["/report.js", "report.js"],
  ["/quality-rules.js", "quality-rules.js"],
  ["/app-quality.js", "app-quality.js"],
  ["/app-domain.js", "app-domain.js"],
  ["/app-automation.js", "app-automation.js"],
  ["/app-bugs.js", "app-bugs.js"],
  ["/app-report.js", "app-report.js"],
  ["/app-storage.js", "app-storage.js"],
  ["/app.js", "app.js"]
]);
const selfTestRuntime = {
  running: false,
  lastResult: null,
  lastError: "",
  nextRunAt: null,
  currentPromise: null
};
const UI_AUTOMATION_ROOT = path.join(ROOT, "tmp", "ui-automation");
const UI_AUTOMATION_AUTH_FILE = path.join(UI_AUTOMATION_ROOT, "auth-state.json");
const UI_AUTOMATION_RUNS_DIR = path.join(UI_AUTOMATION_ROOT, "runs");
const UI_AUTOMATION_SESSION_DIR = path.join(UI_AUTOMATION_ROOT, "session");
const UI_AUTOMATION_HEADLESS = process.env.UI_AUTOMATION_HEADLESS !== "false";
const uiAutomationRuntime = {
  context: null,
  page: null,
  active: false,
  sessionStartedAt: "",
  baseUrl: "",
  loginPath: "",
  browserPath: "",
  userDataDir: "",
  lastError: ""
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp"
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = stripEnvQuotes(rawValue);
  }
}

function stripEnvQuotes(value) {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function resolvePythonBin() {
  if (process.env.CODEX_PYTHON) {
    return process.env.CODEX_PYTHON;
  }

  const candidates = [
    path.join(ROOT, ".venv", "bin", "python"),
    path.join(ROOT, ".venv", "Scripts", "python.exe"),
    path.join(os.homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "python", "bin", "python"),
    path.join(os.homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "python", "python.exe")
  ];

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (found) {
    return found;
  }

  return process.platform === "win32" ? "python" : "python3";
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureParentDir(filePath) {
  const parentDir = path.dirname(filePath);
  if (parentDir) {
    ensureDir(parentDir);
  }
}

function readApiAutomationConfig() {
  const filePath = fs.existsSync(API_AUTOMATION_CONFIG_FILE)
    ? API_AUTOMATION_CONFIG_FILE
    : API_AUTOMATION_CONFIG_EXAMPLE_FILE;

  if (!fs.existsSync(filePath)) {
    return normalizeApiAutomationConfig({});
  }

  try {
    return normalizeApiAutomationConfig(JSON.parse(fs.readFileSync(filePath, "utf-8")));
  } catch (error) {
    return {
      ...normalizeApiAutomationConfig({}),
      error: `接口自动化配置读取失败：${error.message}`
    };
  }
}

function normalizeApiAutomationConfig(rawConfig) {
  const sites = rawConfig && typeof rawConfig.sites === "object" ? rawConfig.sites : {};
  const normalizedSites = {};

  if (Object.keys(sites).length) {
    for (const [siteName, siteConfig] of Object.entries(sites)) {
      normalizedSites[siteName] = normalizeApiAutomationSite(siteName, siteConfig);
    }
  } else {
    normalizedSites.klicklpay = normalizeApiAutomationSite("klicklpay", {
      label: "KlicklPay",
      requiredHeaders: ["KlicklPay-Key"],
      environments: rawConfig?.environments,
      signature: rawConfig?.signature
    });
    normalizedSites.sunpay = normalizeApiAutomationSite("sunpay", {
      label: "SunPay",
      environments: {
        sandbox: {
          baseUrl: "",
          headers: {}
        }
      },
      signature: {
        enabled: false,
        status: "pending-rules",
        note: "SunPay signing rules are not configured yet."
      }
    });
  }

  return {
    defaultSite: String(rawConfig?.defaultSite || (normalizedSites.klicklpay ? "klicklpay" : Object.keys(normalizedSites)[0] || "")),
    sites: normalizedSites,
    environments: normalizedSites.klicklpay?.environments || {},
    signature: normalizedSites.klicklpay?.signature || {}
  };
}

function normalizeApiAutomationSite(siteName, rawSite) {
  const siteConfig = rawSite && typeof rawSite === "object" ? rawSite : {};
  const environments = siteConfig.environments && typeof siteConfig.environments === "object" ? siteConfig.environments : {};
  const defaultEnvironmentNames = siteName === "sunpay" ? ["sandbox"] : ["test", "sandbox"];
  const environmentNames = Object.keys(environments).length ? Object.keys(environments) : defaultEnvironmentNames;
  const normalizedEnvironments = {};

  for (const envName of environmentNames) {
    const envConfig = environments[envName] && typeof environments[envName] === "object" ? environments[envName] : {};
    const headers = envConfig.headers && typeof envConfig.headers === "object" ? envConfig.headers : {};
    const normalizedHeaders = {};
    for (const [headerName, headerValue] of Object.entries(headers)) {
      normalizedHeaders[headerName] = String(headerValue || "");
    }

    normalizedEnvironments[envName] = {
      baseUrl: String(envConfig.baseUrl || "").replace(/\/+$/, ""),
      headers: normalizedHeaders
    };
  }

  const signature = siteConfig.signature && typeof siteConfig.signature === "object" ? siteConfig.signature : {};
  const signatureHeaders = signature.headers && typeof signature.headers === "object" ? signature.headers : {};
  const requiredHeaders = Array.isArray(siteConfig.requiredHeaders) ? siteConfig.requiredHeaders.map(String) : [];

  return {
    label: String(siteConfig.label || siteName),
    requiredHeaders,
    environments: normalizedEnvironments,
    signature: {
      enabled: Boolean(signature.enabled),
      status: String(signature.status || (signature.enabled ? "ready" : "pending-rules")),
      note: String(signature.note || ""),
      algorithm: String(signature.algorithm || ""),
      uppercase: signature.uppercase !== false,
      timestampUnit: String(signature.timestampUnit || ""),
      nonceLength: Number.isFinite(Number(signature.nonceLength)) ? Number(signature.nonceLength) : 0,
      bodyMode: String(signature.bodyMode || ""),
      stringTemplate: String(signature.stringTemplate || ""),
      keySource: String(signature.keySource || ""),
      apiKeyConfigured: Boolean(signature.apiKey || signature.secret),
      headers: {
        timestamp: String(signatureHeaders.timestamp || signature.timestampHeader || ""),
        nonce: String(signatureHeaders.nonce || signature.nonceHeader || ""),
        signature: String(signatureHeaders.signature || signature.signatureHeader || "")
      }
    }
  };
}

function buildApiAutomationConfigPayload() {
  const config = readApiAutomationConfig();
  const sites = Object.fromEntries(Object.entries(config.sites).map(([siteName, siteConfig]) => {
    const environments = Object.fromEntries(Object.entries(siteConfig.environments).map(([name, envConfig]) => [
      name,
      {
        baseUrl: envConfig.baseUrl,
        headers: Object.fromEntries(Object.entries(envConfig.headers || {}).map(([headerName, headerValue]) => [
          headerName,
          Boolean(headerValue)
        ]))
      }
    ]));

    return [
      siteName,
      {
        label: siteConfig.label,
        requiredHeaders: siteConfig.requiredHeaders,
        environments,
        signature: siteConfig.signature
      }
    ];
  }));

  return {
    ok: !config.error,
    error: config.error || "",
    defaultSite: config.defaultSite,
    sites,
    environments: sites.klicklpay?.environments || {},
    signature: sites.klicklpay?.signature || {}
  };
}

function buildUiAutomationSessionStatusPayload() {
  const browserPath = resolveUiAutomationBrowserPath();
  return {
    ok: true,
    available: Boolean(browserPath),
    browserPath: browserPath || "",
    active: uiAutomationRuntime.active,
    authSaved: fs.existsSync(UI_AUTOMATION_AUTH_FILE),
    sessionStartedAt: uiAutomationRuntime.sessionStartedAt || "",
    baseUrl: uiAutomationRuntime.baseUrl || "",
    loginPath: uiAutomationRuntime.loginPath || "",
    headless: UI_AUTOMATION_HEADLESS,
    lastError: uiAutomationRuntime.lastError || ""
  };
}

function resolveUiAutomationBrowserPath() {
  const candidates = [
    process.env.UI_AUTOMATION_BROWSER_PATH,
    process.env.CHROME_PATH,
    process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "",
    process.platform === "linux" ? "/usr/bin/google-chrome" : "",
    process.platform === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : "",
    process.platform === "win32" ? "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe" : ""
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || "";
}

function resolveUiAutomationUrl(baseUrl, targetPath) {
  const normalizedBaseUrl = String(baseUrl || "").trim();
  const normalizedTargetPath = String(targetPath || "").trim();

  if (!normalizedBaseUrl) {
    throw new Error("缺少自动化站点地址。");
  }

  if (!normalizedTargetPath) {
    return normalizedBaseUrl;
  }

  return new URL(normalizedTargetPath, normalizedBaseUrl).toString();
}

async function getPlaywrightChromium() {
  let playwright;
  try {
    playwright = require("playwright-core");
  } catch (_error) {
    throw new Error("当前环境缺少 playwright-core，无法执行 UI 自动化。");
  }

  if (!playwright?.chromium) {
    throw new Error("当前环境没有可用的 Chromium 驱动。");
  }

  return playwright.chromium;
}

async function closeUiAutomationSession() {
  const currentContext = uiAutomationRuntime.context;

  uiAutomationRuntime.context = null;
  uiAutomationRuntime.page = null;
  uiAutomationRuntime.active = false;

  if (currentContext) {
    await currentContext.close();
  }
}

async function handleStartUiAutomationLoginSession(body, res) {
  const baseUrl = String(body.baseUrl || "").trim();
  const loginPath = String(body.loginPath || "").trim();

  if (!baseUrl) {
    return sendJson(res, 400, { error: "请先填写站点地址。" });
  }

  const browserPath = resolveUiAutomationBrowserPath();
  if (!browserPath) {
    return sendJson(res, 400, {
      error: "没有找到可用的谷歌浏览器，请先配置 UI_AUTOMATION_BROWSER_PATH 或安装 Google Chrome。"
    });
  }

  try {
    ensureDir(UI_AUTOMATION_ROOT);
    ensureDir(UI_AUTOMATION_RUNS_DIR);
    fs.rmSync(UI_AUTOMATION_SESSION_DIR, { recursive: true, force: true });
    ensureDir(UI_AUTOMATION_SESSION_DIR);
    await closeUiAutomationSession();

    const chromium = await getPlaywrightChromium();
    const context = await chromium.launchPersistentContext(UI_AUTOMATION_SESSION_DIR, {
      executablePath: browserPath,
      headless: false,
      viewport: null,
      args: ["--start-maximized"]
    });
    const page = context.pages()[0] || await context.newPage();
    const targetUrl = resolveUiAutomationUrl(baseUrl, loginPath);
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });

    uiAutomationRuntime.context = context;
    uiAutomationRuntime.page = page;
    uiAutomationRuntime.active = true;
    uiAutomationRuntime.sessionStartedAt = new Date().toISOString();
    uiAutomationRuntime.baseUrl = baseUrl;
    uiAutomationRuntime.loginPath = loginPath;
    uiAutomationRuntime.browserPath = browserPath;
    uiAutomationRuntime.userDataDir = UI_AUTOMATION_SESSION_DIR;
    uiAutomationRuntime.lastError = "";

    return sendJson(res, 200, {
      ok: true,
      message: "登录窗口已打开，请在浏览器里手动完成账号登录和滑块验证，然后回来点击“确认已登录”。",
      status: buildUiAutomationSessionStatusPayload()
    });
  } catch (error) {
    uiAutomationRuntime.lastError = error.message || "启动登录会话失败。";
    await closeUiAutomationSession().catch(() => {});
    return sendJson(res, 500, { error: uiAutomationRuntime.lastError });
  }
}

async function handleConfirmUiAutomationLoginSession(res) {
  if (!uiAutomationRuntime.active || !uiAutomationRuntime.context) {
    return sendJson(res, 400, { error: "当前没有待确认的登录会话。" });
  }

  try {
    ensureDir(UI_AUTOMATION_ROOT);
    await uiAutomationRuntime.context.storageState({ path: UI_AUTOMATION_AUTH_FILE });
    await closeUiAutomationSession();
    uiAutomationRuntime.lastError = "";

    return sendJson(res, 200, {
      ok: true,
      message: "登录态已保存，后续执行用例时会复用这次登录结果。",
      status: buildUiAutomationSessionStatusPayload()
    });
  } catch (error) {
    uiAutomationRuntime.lastError = error.message || "保存登录态失败。";
    return sendJson(res, 500, { error: uiAutomationRuntime.lastError });
  }
}

async function handleRunUiAutomationCase(body, res) {
  const baseUrl = String(body.baseUrl || "").trim();
  const targetPath = String(body.targetPath || "").trim();
  const caseTitle = String(body.caseTitle || "未命名用例").trim();
  const steps = normalizeUiAutomationSteps(body.steps);

  if (!baseUrl) {
    return sendJson(res, 400, { error: "请先填写站点地址。" });
  }

  if (!targetPath) {
    return sendJson(res, 400, { error: "请先填写用例目标页面路径。" });
  }

  if (!fs.existsSync(UI_AUTOMATION_AUTH_FILE)) {
    return sendJson(res, 400, { error: "还没有可用登录态，请先完成一次人工登录保存。" });
  }

  const browserPath = resolveUiAutomationBrowserPath();
  if (!browserPath) {
    return sendJson(res, 400, {
      error: "没有找到可用的谷歌浏览器，请先配置 UI_AUTOMATION_BROWSER_PATH 或安装 Google Chrome。"
    });
  }

  const startedAt = new Date();
  const runId = `run-${Date.now()}`;
  const runDir = path.join(UI_AUTOMATION_RUNS_DIR, runId);
  const screenshotPath = path.join(runDir, "result.png");
  let browser = null;
  let context = null;

  try {
    ensureDir(runDir);
    const chromium = await getPlaywrightChromium();
    browser = await chromium.launch({
      executablePath: browserPath,
      headless: UI_AUTOMATION_HEADLESS
    });
    context = await browser.newContext({
      storageState: UI_AUTOMATION_AUTH_FILE,
      viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();
    const targetUrl = resolveUiAutomationUrl(baseUrl, targetPath);

    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
    const executedSteps = await executeUiAutomationSteps(page, steps, baseUrl);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await context.close();
    await browser.close();

    return sendJson(res, 200, {
      ok: true,
      result: {
        status: "通过",
        summary: `自动执行完成，共 ${executedSteps} 步。`,
        caseTitle,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        targetUrl,
        screenshotFileName: path.basename(screenshotPath)
      }
    });
  } catch (error) {
    if (context) {
      await context.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
    return sendJson(res, 200, {
      ok: false,
      result: {
        status: "失败",
        summary: error.message || "自动执行失败。",
        caseTitle,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString()
      }
    });
  }
}

function normalizeUiAutomationSteps(input) {
  if (Array.isArray(input)) {
    return input;
  }

  if (typeof input === "string" && input.trim()) {
    try {
      const parsed = JSON.parse(input);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      throw new Error("自动化步骤不是合法 JSON，请检查格式。");
    }
  }

  return [];
}

async function executeUiAutomationSteps(page, steps, baseUrl) {
  for (const rawStep of steps) {
    const step = rawStep && typeof rawStep === "object" ? rawStep : {};
    const action = String(step.action || "").trim();
    const selector = String(step.selector || "").trim();
    const timeout = Number(step.timeout) > 0 ? Number(step.timeout) : 10000;

    if (!action) {
      continue;
    }

    if (action === "goto") {
      await page.goto(resolveUiAutomationUrl(baseUrl, step.path || step.url || ""), {
        waitUntil: "domcontentloaded",
        timeout
      });
      continue;
    }

    if (action === "click") {
      if (!selector) throw new Error("click 步骤缺少 selector。");
      await page.locator(selector).click({ timeout });
      continue;
    }

    if (action === "fill") {
      if (!selector) throw new Error("fill 步骤缺少 selector。");
      await page.locator(selector).fill(String(step.value || ""), { timeout });
      continue;
    }

    if (action === "waitFor") {
      if (!selector) throw new Error("waitFor 步骤缺少 selector。");
      await page.locator(selector).waitFor({
        state: String(step.state || "visible"),
        timeout
      });
      continue;
    }

    if (action === "assertVisible") {
      if (!selector) throw new Error("assertVisible 步骤缺少 selector。");
      await page.locator(selector).waitFor({ state: "visible", timeout });
      continue;
    }

    if (action === "assertText") {
      if (!selector) throw new Error("assertText 步骤缺少 selector。");
      const actualText = await page.locator(selector).textContent({ timeout });
      const expectedText = String(step.text || "");
      if (!String(actualText || "").includes(expectedText)) {
        throw new Error(`断言文本失败：预期包含“${expectedText}”。`);
      }
      continue;
    }

    if (action === "screenshot") {
      await page.screenshot({ fullPage: true, timeout });
      continue;
    }

    if (action === "waitForTimeout") {
      await page.waitForTimeout(Number(step.ms) > 0 ? Number(step.ms) : 1000);
      continue;
    }

    throw new Error(`暂不支持的自动化动作：${action}`);
  }

  return steps.length;
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (req.method === "GET" && req.url === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        envKeyAvailable: Boolean(process.env.OPENAI_API_KEY),
        defaultModel: DEFAULT_MODEL
      });
    }

    if (req.method === "GET" && req.url === "/api/team-members") {
      return sendJson(res, 200, {
        teamMembers: readTeamMembersConfig()
      });
    }

    if (req.method === "GET" && req.url === "/api/app-state") {
      return sendJson(res, 200, readAppStateSnapshot());
    }

    if (req.method === "GET" && req.url === "/api/app-state/backups") {
      return sendJson(res, 200, { backups: listAppStateBackups() });
    }

    if (req.method === "GET" && req.url === "/api/api-automation/config") {
      return sendJson(res, 200, buildApiAutomationConfigPayload());
    }

    if (req.method === "POST" && req.url === "/api/generate-cases") {
      const body = await readJsonBody(req);
      return await handleGenerateCases(body, res);
    }

    if (req.method === "POST" && req.url === "/api/check-ai-key") {
      const body = await readJsonBody(req);
      return await handleCheckAiKey(body, res);
    }

    if (req.method === "GET" && req.url === "/api/lark/status") {
      return await handleLarkStatus(res);
    }

    if (req.method === "POST" && req.url === "/api/lark/sync") {
      const body = await readJsonBody(req);
      return await handleLarkSync(body, res);
    }

    if (req.method === "POST" && req.url === "/api/team-members") {
      const body = await readJsonBody(req);
      const teamMembers = normalizeTeamMembers(body.teamMembers);
      ensureParentDir(TEAM_MEMBERS_FILE);
      fs.writeFileSync(TEAM_MEMBERS_FILE, JSON.stringify({ teamMembers }, null, 2), "utf-8");
      return sendJson(res, 200, { ok: true, teamMembers });
    }

    if (req.method === "POST" && req.url === "/api/app-state") {
      const body = await readJsonBody(req);
      const currentSnapshot = readAppStateSnapshot();
      const baseRevision = Number(body.baseRevision);
      if (!Number.isInteger(baseRevision) || baseRevision < 0) {
        return sendJson(res, 400, {
          error: "baseRevision must be a non-negative integer",
          revision: currentSnapshot.revision,
          state: currentSnapshot.state
        });
      }
      if (baseRevision !== currentSnapshot.revision) {
        return sendJson(res, 409, {
          error: "app state revision conflict",
          revision: currentSnapshot.revision,
          state: currentSnapshot.state
        });
      }
      const nextState = sanitizeSharedState(body.state);
      const nextRevision = currentSnapshot.revision + 1;
      ensureParentDir(APP_STATE_FILE);
      createAppStateBackup(currentSnapshot);
      writeJsonFileAtomic(APP_STATE_FILE, { revision: nextRevision, state: nextState });
      return sendJson(res, 200, { ok: true, revision: nextRevision, state: nextState });
    }

    if (req.method === "POST" && req.url === "/api/app-state/restore") {
      const body = await readJsonBody(req);
      const currentSnapshot = readAppStateSnapshot();
      const baseRevision = Number(body.baseRevision);
      if (!Number.isInteger(baseRevision) || baseRevision !== currentSnapshot.revision) {
        return sendJson(res, 409, {
          error: "app state revision conflict",
          revision: currentSnapshot.revision,
          state: currentSnapshot.state
        });
      }
      const backup = readAppStateBackup(body.backupId);
      if (!backup) {
        return sendJson(res, 404, { error: "app state backup not found" });
      }
      const restoredState = sanitizeSharedState(backup.state);
      const nextRevision = currentSnapshot.revision + 1;
      ensureParentDir(APP_STATE_FILE);
      createAppStateBackup(currentSnapshot);
      writeJsonFileAtomic(APP_STATE_FILE, { revision: nextRevision, state: restoredState });
      return sendJson(res, 200, {
        ok: true,
        revision: nextRevision,
        restoredFrom: body.backupId,
        state: restoredState
      });
    }

    if (requestUrl.pathname === "/api/bug-images" && req.method === "POST") {
      return await handleSaveBugImage(req, res, requestUrl.searchParams.get("bugId"));
    }

    if (requestUrl.pathname === "/api/bug-images" && req.method === "DELETE") {
      return handleDeleteBugImages(res, requestUrl.searchParams.get("bugId"));
    }

    const bugImageMatch = requestUrl.pathname.match(/^\/api\/bug-images\/([^/]+)\/([^/]+)$/);
    if (bugImageMatch && req.method === "GET") {
      return handleReadBugImage(res, decodeURIComponent(bugImageMatch[1]), decodeURIComponent(bugImageMatch[2]));
    }
    if (bugImageMatch && req.method === "DELETE") {
      return handleDeleteBugImage(res, decodeURIComponent(bugImageMatch[1]), decodeURIComponent(bugImageMatch[2]));
    }

    if (req.method === "POST" && req.url === "/api/export-report-docx") {
      const body = await readJsonBody(req);
      return handleExportReportDocx(body, res);
    }

    if (requestUrl.pathname === "/api/reports" && req.method === "POST") {
      const body = await readJsonBody(req);
      return handlePublishReport(body, res);
    }

    if (requestUrl.pathname === "/api/reports" && req.method === "GET") {
      return handleListPublishedReports(res);
    }

    const publishedReportMatch = requestUrl.pathname.match(/^\/api\/reports\/(rpt-[a-z0-9-]+)$/);
    if (publishedReportMatch && req.method === "GET") {
      return handleReadPublishedReport(res, publishedReportMatch[1]);
    }
    if (publishedReportMatch && req.method === "DELETE") {
      return handleDeletePublishedReport(res, publishedReportMatch[1]);
    }

    if (req.method === "GET" && /^\/report\/rpt-[a-z0-9-]+$/.test(requestUrl.pathname)) {
      return serveStaticFile(res, "report.html");
    }

    if (req.method === "POST" && req.url === "/api/self-test") {
      return await handleSelfTest(res);
    }

    if (req.method === "GET" && req.url === "/api/self-test-status") {
      return sendJson(res, 200, buildSelfTestStatusPayload());
    }

    if (req.method === "GET" && req.url === "/api/ui-automation/session-status") {
      return sendJson(res, 200, buildUiAutomationSessionStatusPayload());
    }

    if (req.method === "POST" && req.url === "/api/ui-automation/start-login-session") {
      const body = await readJsonBody(req);
      return await handleStartUiAutomationLoginSession(body, res);
    }

    if (req.method === "POST" && req.url === "/api/ui-automation/confirm-login-session") {
      return await handleConfirmUiAutomationLoginSession(res);
    }

    if (req.method === "POST" && req.url === "/api/ui-automation/run-case") {
      const body = await readJsonBody(req);
      return await handleRunUiAutomationCase(body, res);
    }

    if (req.method === "GET") {
      return serveStatic(req, res);
    }

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Test flow tool listening on http://${HOST}:${PORT}`);
  startSelfTestScheduler();
});

async function handleGenerateCases(body, res) {
  const documentName = String(body.documentName || "").trim();
  const documentType = String(body.documentType || "").trim();
  const sourceType = String(body.sourceType || "text").trim();
  const focusHint = String(body.focusHint || "").trim();
  const content = String(body.content || "").trim();
  const apiKey = String(body.apiKey || process.env.OPENAI_API_KEY || "").trim();
  const model = String(body.model || DEFAULT_MODEL).trim();

  if (!documentName || !documentType || !content) {
    return sendJson(res, 400, { error: "缺少文档名称、类型或内容。" });
  }

  if (!apiKey) {
    return sendJson(res, 400, { error: "还没有可用的 OpenAI API Key。" });
  }

  const resolvedContent = sourceType === "url"
    ? await fetchSourceFromUrl(content)
    : content;

  const narrowedContent = focusHint
    ? narrowContentByFocusHint(resolvedContent, focusHint)
    : resolvedContent;

  if (!narrowedContent) {
    return sendJson(res, 400, { error: "没有拿到可用于生成的正文内容。" });
  }

  const prompt = buildUserPrompt(documentName, documentType, narrowedContent, sourceType, content, focusHint);
  const schema = buildResponseSchema();

  const payload = {
    model,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              "你是一名高级测试专家。",
              "你的任务是根据需求文档或 API 文档生成高质量、可执行的中文测试用例。",
              "重点覆盖正常、异常、边界、权限、状态流转、数据校验和兼容性场景。",
              "不要编造文档中完全不存在的接口名、字段名或业务流程；若需要合理推断，请在 assumptions 中说明。",
              "",
              "每条测试用例必须同时包含文字步骤（steps）和对应的 UI 自动化操作步骤（automationSteps）。",
              "automationSteps 是 Playwright 可执行的结构化指令，与文字步骤一一对应或更细化。",
              "stepType 只允许：openPage、click、input、waitElement、assertText、assertElement、screenshot、wait。",
              "locatorType 只允许：text、placeholder、label、css。",
              "规则：",
              "- 每条用例以 openPage 开始（导航到目标页面路径）。",
              "- 用 click 模拟按钮/链接点击，用 input 模拟表单填写。",
              "- 关键操作后用 assertText 或 assertElement 验证结果。",
              "- 不确定的定位值用 text 定位器（如 text=登录），优先使用 placeholder 和 label。",
              "- inputValue 对 input 是输入内容，对 assertText 是预期文本，对 wait 是毫秒数。",
              "- 如果无法推断 UI 操作，仍要给出 minimal 步骤（openPage + assertElement），不要留空。",
              "",
              "输出必须严格遵守 JSON Schema。"
            ].join("\n")
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: prompt
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "generated_test_cases",
        strict: true,
        schema
      }
    }
  };

  const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  const rawText = await response.text();
  let data;
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch (_error) {
    return sendJson(res, 502, { error: "AI 服务返回了无法解析的内容。" });
  }

  if (!response.ok) {
    const message = data?.error?.message || "AI 服务调用失败。";
    return sendJson(res, response.status, { error: message });
  }

  const parsed = extractStructuredOutput(data);
  if (!parsed || !Array.isArray(parsed.testCases) || !parsed.testCases.length) {
    return sendJson(res, 502, { error: "AI 没有返回有效用例。" });
  }

  return sendJson(res, 200, parsed);
}

async function handleCheckAiKey(body, res) {
  const apiKey = String(body.apiKey || process.env.OPENAI_API_KEY || "").trim();
  const model = String(body.model || DEFAULT_MODEL).trim();

  if (!apiKey) {
    return sendJson(res, 400, { error: "还没有可用的 OpenAI API Key。" });
  }

  try {
    const quickResult = await quickCheckAiKey(apiKey, model);
    return sendJson(res, 200, {
      ok: true,
      model: quickResult.model || model,
      mode: quickResult.mode
    });
  } catch (error) {
    return sendJson(res, Number(error.statusCode || 502), {
      error: error.message || "AI Key 检测失败。"
    });
  }
}

async function quickCheckAiKey(apiKey, model) {
  const headers = {
    Authorization: `Bearer ${apiKey}`
  };

  const quickEndpoints = [
    {
      mode: "model-detail",
      url: `${OPENAI_BASE_URL}/models/${encodeURIComponent(model)}`,
      init: { method: "GET", headers }
    },
    {
      mode: "model-list",
      url: `${OPENAI_BASE_URL}/models`,
      init: { method: "GET", headers }
    }
  ];

  for (const attempt of quickEndpoints) {
    const result = await fetchJsonWithTimeout(attempt.url, attempt.init, 6000);
    if (result.ok) {
      return {
        ok: true,
        model,
        mode: attempt.mode
      };
    }

    if (result.status === 401 || result.status === 403) {
      throw buildAiCheckError(result.data?.error?.message || "API Key 无效或没有权限。", result.status);
    }
  }

  const payload = {
    model,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "OK"
          }
        ]
      }
    ],
    max_output_tokens: 1
  };

  const responseResult = await fetchJsonWithTimeout(`${OPENAI_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  }, 10000);

  if (!responseResult.ok) {
    throw buildAiCheckError(responseResult.data?.error?.message || "AI Key 检测失败。", responseResult.status);
  }

  return {
    ok: true,
    model,
    mode: "responses-fallback"
  };
}

async function fetchJsonWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const rawText = await response.text();
    let data;
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch (_error) {
      data = {};
    }

    return {
      ok: response.ok,
      status: response.status,
      data
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throw buildAiCheckError("AI Key 检测超时，请检查网络、代理或接口地址。", 504);
    }
    throw buildAiCheckError(error.message || "AI Key 检测失败。", 502);
  } finally {
    clearTimeout(timer);
  }
}

function buildAiCheckError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function handleExportReportDocx(body, res) {
  const report = body && typeof body.report === "object" ? body.report : null;
  const conclusion = typeof body?.reportConclusion === "string" ? body.reportConclusion : "";
  const fileBaseName = String(body?.fileBaseName || "test-report").trim() || "test-report";

  if (!report) {
    return sendJson(res, 400, { error: "缺少报告数据。" });
  }

  const scriptPath = path.join(ROOT, "tmp", "export_report_docx.py");
  if (!fs.existsSync(scriptPath)) {
    return sendJson(res, 500, { error: "报告导出脚本不存在。" });
  }

  const exportDir = path.join(ROOT, "tmp", "exports");
  fs.mkdirSync(exportDir, { recursive: true });
  const payloadPath = path.join(exportDir, `${Date.now()}-${sanitizeFileName(fileBaseName)}.json`);
  const outputPath = path.join(exportDir, `${sanitizeFileName(fileBaseName)}.docx`);

  fs.writeFileSync(payloadPath, JSON.stringify({ report, reportConclusion: conclusion, outputPath }, null, 2), "utf-8");

  const result = spawnSync(PYTHON_BIN, [scriptPath, payloadPath], {
    cwd: ROOT,
    encoding: "utf-8",
    windowsHide: true
  });

  try {
    fs.unlinkSync(payloadPath);
  } catch (_error) {
    // ignore
  }

  if (result.error) {
    return sendJson(res, 500, { error: `导出失败：${result.error.message}` });
  }

  if (result.status !== 0) {
    return sendJson(res, 500, { error: `导出失败：${(result.stderr || result.stdout || "").trim() || "生成脚本执行异常"}` });
  }

  if (!fs.existsSync(outputPath)) {
    return sendJson(res, 500, { error: "导出失败：未生成文档文件。" });
  }

  const fileBuffer = fs.readFileSync(outputPath);
  const fileName = path.basename(outputPath);

  res.writeHead(200, {
    "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "Content-Disposition": `attachment; filename="${encodeAsciiFileName(fileName)}"`,
    "Cache-Control": "no-store"
  });
  res.end(fileBuffer);
}

async function handleSelfTest(res) {
  const result = await runSelfTestProcess("manual");
  if (!result.ok && result.executionError) {
    return sendJson(res, 500, { error: result.executionError });
  }
  return sendJson(res, 200, result);
}

function getSelfTestFiles() {
  const testsDir = path.join(ROOT, "tests");
  if (!fs.existsSync(testsDir)) {
    return [];
  }

  return fs.readdirSync(testsDir)
    .filter((fileName) => fileName.endsWith(".test.js") && !RUNTIME_SELF_TEST_EXCLUDED_FILES.has(fileName))
    .sort()
    .map((fileName) => path.join(testsDir, fileName));
}

function startSelfTestScheduler() {
  if (!SELF_TEST_AUTORUN) {
    return;
  }

  scheduleNextSelfTestRun();
  void runSelfTestProcess("scheduled");
  setInterval(() => {
    void runSelfTestProcess("scheduled");
  }, SELF_TEST_INTERVAL_MS);
}

function scheduleNextSelfTestRun() {
  selfTestRuntime.nextRunAt = new Date(Date.now() + SELF_TEST_INTERVAL_MS).toISOString();
}

function buildSelfTestStatusPayload() {
  return {
    ok: true,
    autorunEnabled: SELF_TEST_AUTORUN,
    intervalHours: SELF_TEST_INTERVAL_MS / (60 * 60 * 1000),
    running: selfTestRuntime.running,
    nextRunAt: selfTestRuntime.nextRunAt,
    result: selfTestRuntime.lastResult,
    error: selfTestRuntime.lastError || ""
  };
}

async function runSelfTestProcess(trigger) {
  if (selfTestRuntime.currentPromise) {
    return selfTestRuntime.currentPromise;
  }

  selfTestRuntime.currentPromise = Promise.resolve(executeSelfTest(trigger)).finally(() => {
    selfTestRuntime.currentPromise = null;
  });
  return selfTestRuntime.currentPromise;
}

function executeSelfTest(trigger) {
  const testFiles = getSelfTestFiles();
  if (!testFiles.length) {
    const message = "没有可执行的自检脚本。";
    selfTestRuntime.lastError = message;
    selfTestRuntime.lastResult = null;
    return {
      ok: false,
      executionError: message
    };
  }

  selfTestRuntime.running = true;
  selfTestRuntime.lastError = "";

  const startedAt = Date.now();
  const selfTestEnv = { ...process.env };
  delete selfTestEnv.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ["--test", ...testFiles], {
    cwd: ROOT,
    encoding: "utf-8",
    env: selfTestEnv,
    windowsHide: true,
    timeout: 120_000
  });

  let payload;
  if (result.error) {
    payload = {
      ok: false,
      executionError: `系统自检执行失败：${result.error.message}`
    };
    selfTestRuntime.lastResult = null;
    selfTestRuntime.lastError = payload.executionError;
  } else {
    const parsed = parseSelfTestOutput(result.stdout || "", result.stderr || "");
    if (parsed.summary.tests === 0) {
      parsed.failures.push("未检测到任何测试结果。");
    }
    payload = {
      ok: result.status === 0 && parsed.summary.tests > 0,
      exitCode: typeof result.status === "number" ? result.status : null,
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      summary: parsed.summary,
      failures: parsed.failures,
      outputPreview: parsed.outputPreview,
      trigger
    };
    selfTestRuntime.lastResult = payload;
    selfTestRuntime.lastError = payload.ok ? "" : (parsed.failures[0] || "系统自检未通过。");
  }

  selfTestRuntime.running = false;
  scheduleNextSelfTestRun();
  return payload;
}

function parseSelfTestOutput(stdout, stderr) {
  const combined = [stdout, stderr].filter(Boolean).join("\n").trim();
  const failures = [];
  const summary = {
    tests: 0,
    pass: 0,
    fail: 0,
    skipped: 0,
    todo: 0,
    cancelled: 0
  };

  combined.split(/\r?\n/).forEach((line) => {
    const failMatch = line.match(/^not ok\s+\d+\s+-\s+(.+)$/);
    if (failMatch) {
      failures.push(failMatch[1].trim());
      return;
    }

    const summaryMatch = line.match(/^#\s+(tests|pass|fail|skipped|todo|cancelled)\s+(\d+)$/);
    if (summaryMatch) {
      summary[summaryMatch[1]] = Number(summaryMatch[2]);
    }
  });

  const outputLines = combined ? combined.split(/\r?\n/).slice(-24) : [];

  return {
    summary,
    failures,
    outputPreview: outputLines.join("\n")
  };
}

async function handleLarkStatus(res) {
  const config = getLarkConfig();
  if (config.missing.length) {
    return sendJson(res, 400, {
      ok: false,
      error: `缺少 Lark 配置：${config.missing.join(", ")}。`
    });
  }

  const token = await getLarkTenantAccessToken(config);
  const tables = {};

  for (const [key, table] of Object.entries(config.tables)) {
    if (!table.id) {
      tables[key] = { configured: false, ok: false, fields: [] };
      continue;
    }

    try {
      const fields = await getLarkTableFields(config, token, table.id);
      tables[key] = {
        configured: true,
        ok: true,
        fields: fields.map((item) => item.field_name || item.name || item.field_id).filter(Boolean)
      };
    } catch (error) {
      tables[key] = {
        configured: true,
        ok: false,
        error: error.message
      };
    }
  }

  return sendJson(res, 200, { ok: true, tables });
}

async function handleLarkSync(body, res) {
  const config = getLarkConfig();
  if (config.missing.length) {
    return sendJson(res, 400, {
      ok: false,
      error: `缺少 Lark 配置：${config.missing.join(", ")}。`
    });
  }

  const state = sanitizeSharedState(body?.state || {});
  const token = await getLarkTenantAccessToken(config);
  const records = buildLarkRecords(state);
  const synced = {};

  for (const [key, table] of Object.entries(config.tables)) {
    const rows = records[key] || [];
    if (!table.id || !rows.length) {
      synced[key] = { created: 0, updated: 0, total: 0 };
      continue;
    }

    synced[key] = await upsertLarkRecords(config, token, table.id, rows);
  }

  return sendJson(res, 200, { ok: true, synced });
}

function getLarkConfig() {
  const tables = {
    versions: { id: process.env.LARK_VERSION_TABLE_ID || "" },
    tasks: { id: process.env.LARK_TASK_TABLE_ID || "" },
    cases: { id: process.env.LARK_CASE_TABLE_ID || "" },
    bugs: { id: process.env.LARK_BUG_TABLE_ID || "" }
  };
  const config = {
    apiBaseUrl: LARK_API_BASE_URL.replace(/\/$/, ""),
    appId: process.env.LARK_APP_ID || "",
    appSecret: process.env.LARK_APP_SECRET || "",
    baseAppToken: process.env.LARK_BASE_APP_TOKEN || "",
    tables,
    missing: []
  };

  [
    ["LARK_APP_ID", config.appId],
    ["LARK_APP_SECRET", config.appSecret],
    ["LARK_BASE_APP_TOKEN", config.baseAppToken]
  ].forEach(([key, value]) => {
    if (!value) config.missing.push(key);
  });

  if (!Object.values(tables).some((table) => table.id)) {
    config.missing.push("至少一个 Lark table id");
  }

  return config;
}

async function getLarkTenantAccessToken(config) {
  const data = await requestLarkJson(config, "/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    body: {
      app_id: config.appId,
      app_secret: config.appSecret
    }
  });

  if (!data?.tenant_access_token) {
    throw new Error("Lark 没有返回 tenant_access_token。");
  }
  return data.tenant_access_token;
}

async function getLarkTableFields(config, token, tableId) {
  const data = await requestLarkJson(config, `/open-apis/bitable/v1/apps/${encodeURIComponent(config.baseAppToken)}/tables/${encodeURIComponent(tableId)}/fields`, {
    method: "GET",
    token
  });
  return data?.data?.items || [];
}

async function upsertLarkRecords(config, token, tableId, rows) {
  const existingByExternalId = await listLarkRecordsByExternalId(config, token, tableId);
  const toCreate = [];
  const toUpdate = [];

  rows.forEach((fields) => {
    const externalId = String(fields["外部ID"] || "").trim();
    const existingRecordId = externalId ? existingByExternalId.get(externalId) : "";
    if (existingRecordId) {
      toUpdate.push({ record_id: existingRecordId, fields });
    } else {
      toCreate.push(fields);
    }
  });

  if (toUpdate.length) {
    await updateLarkRecords(config, token, tableId, toUpdate);
  }
  if (toCreate.length) {
    await createLarkRecords(config, token, tableId, toCreate);
  }

  return {
    created: toCreate.length,
    updated: toUpdate.length,
    total: rows.length
  };
}

async function listLarkRecordsByExternalId(config, token, tableId) {
  const recordsByExternalId = new Map();
  let pageToken = "";

  do {
    const query = new URLSearchParams({ page_size: "500" });
    if (pageToken) {
      query.set("page_token", pageToken);
    }

    const data = await requestLarkJson(config, `/open-apis/bitable/v1/apps/${encodeURIComponent(config.baseAppToken)}/tables/${encodeURIComponent(tableId)}/records?${query.toString()}`, {
      method: "GET",
      token
    });

    const items = data?.data?.items || [];
    items.forEach((item) => {
      const externalId = normalizeLarkFieldValue(item?.fields?.["外部ID"]);
      if (externalId && item.record_id) {
        recordsByExternalId.set(externalId, item.record_id);
      }
    });

    pageToken = data?.data?.page_token || "";
  } while (pageToken);

  return recordsByExternalId;
}

async function createLarkRecords(config, token, tableId, rows) {
  const chunks = chunkArray(rows, 500);
  for (const chunk of chunks) {
    await requestLarkJson(config, `/open-apis/bitable/v1/apps/${encodeURIComponent(config.baseAppToken)}/tables/${encodeURIComponent(tableId)}/records/batch_create`, {
      method: "POST",
      token,
      body: {
        records: chunk.map((fields) => ({ fields }))
      }
    });
  }
}

async function updateLarkRecords(config, token, tableId, records) {
  const chunks = chunkArray(records, 500);
  for (const chunk of chunks) {
    await requestLarkJson(config, `/open-apis/bitable/v1/apps/${encodeURIComponent(config.baseAppToken)}/tables/${encodeURIComponent(tableId)}/records/batch_update`, {
      method: "POST",
      token,
      body: {
        records: chunk
      }
    });
  }
}

async function requestLarkJson(config, endpoint, options) {
  const response = await fetch(`${config.apiBaseUrl}${endpoint}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const rawText = await response.text();
  let data;
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch (_error) {
    throw new Error("Lark 返回了无法解析的内容。");
  }

  if (!response.ok || data.code !== 0) {
    const message = data?.msg || data?.message || `Lark API 调用失败：${response.status}`;
    throw new Error(message);
  }

  return data;
}

function buildLarkRecords(state) {
  const batches = state.batches || [];
  const tasks = state.tasks || [];
  const cases = state.cases || [];
  const bugs = state.bugs || [];
  const taskById = new Map(tasks.map((item) => [item.id, item]));
  const batchById = new Map(batches.map((item) => [item.id, item]));
  const caseById = new Map(cases.map((item) => [item.id, item]));
  const now = new Date().toISOString();

  return {
    versions: batches.map((batch) => {
      const batchTasks = tasks.filter((task) => task.batchId === batch.id);
      const taskIds = new Set(batchTasks.map((task) => task.id));
      const batchCases = cases.filter((item) => item.batchId === batch.id || taskIds.has(item.taskId));
      const caseIds = new Set(batchCases.map((item) => item.id));
      const batchBugs = bugs.filter((item) => item.batchId === batch.id || taskIds.has(item.taskId) || caseIds.has(item.caseId));
      return stringifyFields({
        "外部ID": batch.id,
        "版本号": batch.version,
        "状态": batch.status,
        "任务数": batchTasks.length,
        "用例数": batchCases.length,
        "BUG数": batchBugs.length,
        "更新时间": now
      });
    }),
    tasks: tasks.map((task) => {
      const batch = batchById.get(task.batchId);
      return stringifyFields({
        "外部ID": task.id,
        "任务名称": task.name,
        "所属版本": task.batchVersion || batch?.version,
        "测试范围": task.scope,
        "状态": task.status,
        "更新时间": now
      });
    }),
    cases: cases.map((item) => {
      const task = taskById.get(item.taskId);
      const batch = batchById.get(item.batchId || task?.batchId);
      return stringifyFields({
        "外部ID": item.id,
        "用例标题": item.title,
        "模块": item.module,
        "类型": item.type,
        "优先级": item.priority,
        "前置条件": item.preconditions,
        "测试步骤": item.steps,
        "预期结果": item.expected,
        "执行状态": item.executionStatus,
        "执行备注": item.executionNote,
        "所属版本": item.batchVersion || batch?.version,
        "所属任务": item.taskName || task?.name,
        "更新时间": now
      });
    }),
    bugs: bugs.map((bug) => {
      const linkedCase = caseById.get(bug.caseId);
      const task = taskById.get(bug.taskId || linkedCase?.taskId);
      const batch = batchById.get(bug.batchId || linkedCase?.batchId || task?.batchId);
      return stringifyFields({
        "外部ID": bug.id,
        "BUG标题": bug.title,
        "严重程度": bug.severity,
        "状态": bug.status,
        "关联用例": linkedCase?.title || bug.caseId,
        "备注": bug.note,
        "所属版本": bug.batchVersion || linkedCase?.batchVersion || batch?.version,
        "所属任务": bug.taskName || linkedCase?.taskName || task?.name,
        "Lark": bug.link,
        "更新时间": now
      });
    })
  };
}

function stringifyFields(fields) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, stringifyLarkValue(value)]));
}

function stringifyLarkValue(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(", ");
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function normalizeLarkFieldValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeLarkFieldValue(item)).filter(Boolean).join(", ");
  }
  if (value && typeof value === "object") {
    if ("text" in value) {
      return String(value.text || "").trim();
    }
    if ("name" in value) {
      return String(value.name || "").trim();
    }
    if ("value" in value) {
      return String(value.value || "").trim();
    }
    return "";
  }
  return String(value || "").trim();
}

function formatOwners(value) {
  return Array.isArray(value) ? value.filter(Boolean).join(", ") : String(value || "");
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function buildUserPrompt(documentName, documentType, content, sourceType, sourceValue, focusHint) {
  const truncated = content.length > 90000 ? `${content.slice(0, 90000)}\n\n[文档已截断]` : content;
  return [
    `文档名称：${documentName}`,
    `内容类型：${documentType === "api" ? "API内容" : "需求内容"}`,
    `内容来源：${sourceType === "url" ? "网址链接" : sourceType === "file" ? "本地文件" : "直接粘贴"}`,
    sourceType === "url" ? `原始链接：${sourceValue}` : "",
    focusHint ? `本次测试范围提示：${focusHint}` : "",
    "",
    "请输出 8 到 20 条测试用例草稿，满足这些要求：",
    "1. 标题清晰，模块命名简洁。",
    "2. 优先级只允许 P0/P1/P2/P3。",
    "3. 类型只允许 正常/异常/边界。",
    "4. 前置条件和步骤要可执行，步骤尽量拆成 2 到 5 条。",
    "5. API 文档要覆盖参数校验、状态码、鉴权、幂等、边界值。",
    "6. 需求文档要覆盖主流程、异常流、边界、权限、数据一致性。",
    "7. 如果给了测试范围提示，请把它当成硬约束，只生成该范围内的测试用例，不要扩散到无关模块。",
    "8. 如果文档内容无法精确定位到该范围，只允许在 assumptions 中说明不确定点，仍然要尽量围绕该范围输出。",
    "9. 每条用例必须同时提供 automationSteps（UI自动化操作步骤），与文字 steps 对应。",
    "   - stepType: openPage/click/input/waitElement/assertText/assertElement/screenshot/wait",
    "   - locatorType: text/placeholder/label/css",
    "   - target: 定位目标（如 text=登录、placeholder=请输入账号、css=.btn-primary）",
    "   - inputValue: 输入值或断言文本（对 input 是填写内容，对 assertText 是预期文字，对 wait 是毫秒数）",
    "   - 每条用例以 openPage 开头，关键操作后加断言步骤",
    "",
    "文档内容如下：",
    truncated
  ].filter(Boolean).join("\n");
}

function buildResponseSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      assumptions: {
        type: "array",
        items: { type: "string" }
      },
      testCases: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            module: { type: "string" },
            title: { type: "string" },
            type: {
              type: "string",
              enum: ["正常", "异常", "边界"]
            },
            priority: {
              type: "string",
              enum: ["P0", "P1", "P2", "P3"]
            },
            preconditions: {
              type: "array",
              items: { type: "string" }
            },
            steps: {
              type: "array",
              items: { type: "string" }
            },
            expected: { type: "string" },
            automationSteps: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  stepType: {
                    type: "string",
                    enum: ["openPage", "click", "input", "waitElement", "assertText", "assertElement", "screenshot", "wait"]
                  },
                  locatorType: {
                    type: "string",
                    enum: ["text", "placeholder", "label", "css"]
                  },
                  target: { type: "string" },
                  inputValue: { type: "string" }
                },
                required: ["stepType", "locatorType", "target", "inputValue"]
              }
            }
          },
          required: ["module", "title", "type", "priority", "preconditions", "steps", "expected", "automationSteps"]
        }
      }
    },
    required: ["summary", "assumptions", "testCases"]
  };
}

function tryParseStructuredJson(raw) {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text) return null;

  const candidates = [text];

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    candidates.push(fencedMatch[1].trim());
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(text.slice(firstBrace, lastBrace + 1).trim());
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (_error) {
      continue;
    }
  }

  return null;
}

function normalizeStructuredOutput(parsed) {
  if (!parsed || typeof parsed !== "object") return null;

  const rawCases = Array.isArray(parsed.testCases)
    ? parsed.testCases
    : Array.isArray(parsed.test_cases)
      ? parsed.test_cases
      : Array.isArray(parsed.cases)
        ? parsed.cases
        : [];

  const normalizedCases = rawCases
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const moduleValue = String(item.module || item.category || item.group || "未分类").trim();
      const titleValue = String(item.title || item.name || item.caseTitle || "").trim();
      const rawType = String(item.type || item.caseType || item.scenarioType || "").trim();
      const rawPriority = String(item.priority || item.level || "").trim().toUpperCase();
      const preconditions = Array.isArray(item.preconditions)
        ? item.preconditions
        : Array.isArray(item.precondition)
          ? item.precondition
          : typeof item.preconditions === "string"
            ? [item.preconditions]
            : typeof item.precondition === "string"
              ? [item.precondition]
              : [];
      const steps = Array.isArray(item.steps)
        ? item.steps
        : typeof item.steps === "string"
          ? [item.steps]
          : [];
      const expectedValue = String(item.expected || item.expectedResult || item.expect || "").trim();

      const rawAutomationSteps = Array.isArray(item.automationSteps)
        ? item.automationSteps
        : Array.isArray(item.automation_steps)
          ? item.automation_steps
          : [];

      const automationSteps = rawAutomationSteps
        .map((step) => {
          if (!step || typeof step !== "object") return null;
          return {
            stepType: String(step.stepType || step.type || step.action || "click").trim(),
            locatorType: String(step.locatorType || step.by || step.locator || "text").trim(),
            target: String(step.target || step.selector || step.path || step.url || "").trim(),
            inputValue: String(step.inputValue || step.value || step.text || step.ms || "").trim(),
            remark: String(step.remark || step.note || "").trim()
          };
        })
        .filter(Boolean);

      const typeMap = {
        "正常": "正常",
        "异常": "异常",
        "边界": "边界",
        "normal": "正常",
        "exception": "异常",
        "error": "异常",
        "boundary": "边界"
      };

      const normalizedType = typeMap[rawType.toLowerCase?.() ? rawType.toLowerCase() : rawType] || typeMap[rawType] || "";
      const normalizedPriority = ["P0", "P1", "P2", "P3"].includes(rawPriority) ? rawPriority : "P2";

      if (!titleValue || !steps.length || !expectedValue) return null;

      return {
        module: moduleValue || "未分类",
        title: titleValue,
        type: normalizedType || "正常",
        priority: normalizedPriority,
        preconditions: preconditions.map((value) => String(value || "").trim()).filter(Boolean),
        steps: steps.map((value) => String(value || "").trim()).filter(Boolean),
        expected: expectedValue,
        automationSteps
      };
    })
    .filter(Boolean);

  if (!normalizedCases.length) return null;

  return {
    summary: String(parsed.summary || parsed.overview || "已生成测试用例。").trim(),
    assumptions: Array.isArray(parsed.assumptions)
      ? parsed.assumptions.map((value) => String(value || "").trim()).filter(Boolean)
      : [],
    testCases: normalizedCases
  };
}

function extractStructuredOutput(responseJson) {
  const directText = responseJson.output_text;
  if (directText) {
    const parsed = tryParseStructuredJson(directText);
    const normalized = normalizeStructuredOutput(parsed);
    if (normalized) return normalized;
  }

  const outputs = Array.isArray(responseJson.output) ? responseJson.output : [];
  for (const item of outputs) {
    const contents = Array.isArray(item.content) ? item.content : [];
    for (const content of contents) {
      if (typeof content.text === "string") {
        const parsed = tryParseStructuredJson(content.text);
        const normalized = normalizeStructuredOutput(parsed);
        if (normalized) return normalized;
      }
    }
  }

  return null;
}

async function fetchSourceFromUrl(url) {
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (_error) {
    throw new Error("网址格式不正确。");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("只支持 http 或 https 链接。");
  }

  const candidates = buildPageFetchCandidates(parsedUrl);
  let lastStatus = "";

  for (const candidate of candidates) {
    const response = await fetch(candidate, {
      headers: {
        "User-Agent": "TestFlowTool/0.1"
      }
    });

    if (!response.ok) {
      lastStatus = `HTTP ${response.status}`;
      continue;
    }

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();

    if (contentType.includes("application/json")) {
      return text;
    }

    if (contentType.includes("text/html")) {
      const specContent = await tryFetchOpenApiSpecFromHtml(candidate, text);
      if (specContent) {
        return specContent;
      }
      return htmlToText(text);
    }

    return text;
  }

  if (lastStatus) {
    throw new Error(`抓取链接失败：${lastStatus}`);
  }

  throw new Error("抓取链接失败：没有可用页面返回内容。");
}

function buildPageFetchCandidates(parsedUrl) {
  const result = new Set();
  result.add(parsedUrl.toString());

  const cleaned = new URL(parsedUrl.toString());
  cleaned.hash = "";
  result.add(cleaned.toString());

  result.add(new URL("/", parsedUrl).toString());

  const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
  if (pathParts.length) {
    for (let i = pathParts.length; i >= 1; i -= 1) {
      result.add(new URL(`/${pathParts.slice(0, i).join("/")}/`, parsedUrl).toString());
    }
  }

  return [...result];
}

async function tryFetchOpenApiSpecFromHtml(baseUrl, html) {
  const candidates = collectSpecCandidates(baseUrl, html);

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, {
        headers: {
          "User-Agent": "TestFlowTool/0.1"
        }
      });

      if (!response.ok) {
        continue;
      }

      const contentType = response.headers.get("content-type") || "";
      const text = await response.text();
      if (!looksLikeOpenApi(text, contentType)) {
        continue;
      }

      return text;
    } catch (_error) {
      continue;
    }
  }

  return "";
}

function collectSpecCandidates(baseUrl, html) {
  const candidates = new Set();
  const regexes = [
    /https?:\/\/[^"'\\\s]+(?:openapi|swagger)[^"'\\\s]*\.json/gi,
    /["']([^"']*(?:openapi|swagger)[^"']*\.json)["']/gi,
    /url:\s*["']([^"']+\.json)["']/gi,
    /urls:\s*\[\s*\{\s*url:\s*["']([^"']+\.json)["']/gi,
    /["'](\/v\d+\/api-docs[^"']*)["']/gi,
    /["'](\/swagger(?:\/[^"']*)?\.json)["']/gi,
    /["'](\/openapi(?:\/[^"']*)?\.json)["']/gi
  ];

  for (const regex of regexes) {
    let match;
    while ((match = regex.exec(html)) !== null) {
      const raw = match[1] || match[0];
      try {
        candidates.add(new URL(raw, baseUrl).toString());
      } catch (_error) {
        continue;
      }
    }
  }

  const fallbackPaths = [
    "/swagger.json",
    "/openapi.json",
    "/v2/swagger.json",
    "/v3/api-docs",
    "/api-docs",
    "/swagger/v1/swagger.json"
  ];
  fallbackPaths.forEach((item) => {
    try {
      candidates.add(new URL(item, baseUrl).toString());
    } catch (_error) {
      return;
    }
  });

  return [...candidates];
}

function looksLikeOpenApi(text, contentType) {
  if (contentType.includes("application/json")) {
    return true;
  }

  try {
    const json = JSON.parse(text);
    return Boolean(json.openapi || json.swagger || json.paths);
  } catch (_error) {
    return /"openapi"\s*:|"swagger"\s*:|"paths"\s*:/.test(text);
  }
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function narrowContentByFocusHint(content, focusHint) {
  const keywords = deriveFocusKeywords(focusHint);
  if (!keywords.length) {
    return content;
  }

  const narrowedOpenApi = narrowOpenApiContent(content, keywords);
  if (narrowedOpenApi) {
    return narrowedOpenApi;
  }

  const narrowedText = narrowPlainTextContent(content, keywords);
  return narrowedText || content;
}

function deriveFocusKeywords(focusHint) {
  const normalized = focusHint
    .replace(/[，。；：、/()（）]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const stopWords = new Set([
    "只", "测试", "相关", "接口", "功能", "模块", "中的", "和", "与", "不要", "生成", "相关用例",
    "只看", "定位", "本次", "范围", "提示"
  ]);

  const rawTokens = normalized.split(" ").filter(Boolean);
  const keywords = rawTokens
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && !stopWords.has(item));

  const quoted = [...focusHint.matchAll(/["“](.+?)["”]/g)].map((item) => item[1].trim()).filter(Boolean);
  return [...new Set([...quoted, ...keywords])];
}

function narrowOpenApiContent(content, keywords) {
  let spec;
  try {
    spec = JSON.parse(content);
  } catch (_error) {
    return "";
  }

  if (!spec || !spec.paths || typeof spec.paths !== "object") {
    return "";
  }

  const filteredPaths = {};
  for (const [pathName, methods] of Object.entries(spec.paths)) {
    const filteredMethods = {};

    for (const [methodName, detail] of Object.entries(methods || {})) {
      const haystack = [
        pathName,
        methodName,
        detail?.summary || "",
        detail?.description || "",
        Array.isArray(detail?.tags) ? detail.tags.join(" ") : "",
        detail?.operationId || ""
      ].join(" ").toLowerCase();

      if (keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) {
        filteredMethods[methodName] = detail;
      }
    }

    if (Object.keys(filteredMethods).length) {
      filteredPaths[pathName] = filteredMethods;
    }
  }

  if (!Object.keys(filteredPaths).length) {
    return "";
  }

  const narrowedSpec = {
    ...spec,
    paths: filteredPaths
  };

  return JSON.stringify(narrowedSpec, null, 2);
}

function narrowPlainTextContent(content, keywords) {
  const lines = content
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!lines.length) {
    return "";
  }

  const matchedIndexes = [];
  lines.forEach((line, index) => {
    const haystack = line.toLowerCase();
    if (keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) {
      matchedIndexes.push(index);
    }
  });

  if (!matchedIndexes.length) {
    return "";
  }

  const selected = new Set();
  matchedIndexes.forEach((index) => {
    for (let cursor = Math.max(0, index - 2); cursor <= Math.min(lines.length - 1, index + 4); cursor += 1) {
      selected.add(cursor);
    }
  });

  return [...selected]
    .sort((a, b) => a - b)
    .map((index) => lines[index])
    .join("\n");
}

async function handleSaveBugImage(req, res, bugId) {
  assertSafePathPart(bugId, "BUG ID");
  const buffer = await readBinaryBody(req, MAX_BUG_IMAGE_BYTES);
  const imageType = detectImageType(buffer);
  if (!imageType) throw new Error("仅支持有效的 PNG、JPG 或 WebP 图片");

  const imageId = crypto.randomUUID();
  const storedName = `${imageId}.${imageType.extension}`;
  const bugDirectory = path.join(BUG_ATTACHMENTS_ROOT, bugId);
  fs.mkdirSync(bugDirectory, { recursive: true });
  fs.writeFileSync(path.join(bugDirectory, storedName), buffer);

  let originalName = "粘贴的截图";
  try {
    originalName = decodeURIComponent(String(req.headers["x-file-name"] || originalName));
  } catch (_error) {}
  const fileName = sanitizeFileName(originalName).slice(0, 160) || `截图.${imageType.extension}`;
  return sendJson(res, 201, {
    ok: true,
    image: {
      id: imageId,
      fileName,
      storedName,
      mimeType: imageType.mimeType,
      size: buffer.length,
      url: `/api/bug-images/${encodeURIComponent(bugId)}/${encodeURIComponent(imageId)}`,
      createdAt: new Date().toISOString()
    }
  });
}

function handleReadBugImage(res, bugId, imageId) {
  assertSafePathPart(bugId, "BUG ID");
  assertSafePathPart(imageId, "图片 ID");
  const filePath = findBugImagePath(bugId, imageId);
  if (!filePath) return sendJson(res, 404, { error: "图片不存在" });
  const extension = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
    "Content-Disposition": "inline",
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff"
  });
  fs.createReadStream(filePath).pipe(res);
}

function handleDeleteBugImage(res, bugId, imageId) {
  assertSafePathPart(bugId, "BUG ID");
  assertSafePathPart(imageId, "图片 ID");
  const filePath = findBugImagePath(bugId, imageId);
  if (filePath) fs.rmSync(filePath, { force: true });
  return sendJson(res, 200, { ok: true });
}

function handleDeleteBugImages(res, bugId) {
  assertSafePathPart(bugId, "BUG ID");
  fs.rmSync(path.join(BUG_ATTACHMENTS_ROOT, bugId), { recursive: true, force: true });
  return sendJson(res, 200, { ok: true });
}

function findBugImagePath(bugId, imageId) {
  const directory = path.join(BUG_ATTACHMENTS_ROOT, bugId);
  if (!fs.existsSync(directory)) return "";
  const fileName = fs.readdirSync(directory).find((name) => name.startsWith(`${imageId}.`));
  return fileName ? path.join(directory, fileName) : "";
}

function assertSafePathPart(value, label) {
  if (!value || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) {
    throw new Error(`${label} 不合法`);
  }
}

function detectImageType(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mimeType: "image/png", extension: "png" };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return { mimeType: "image/webp", extension: "webp" };
  }
  return null;
}

function readBinaryBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("单张图片不能超过 5MB"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function serveStatic(req, res) {
  let pathname;
  try {
    pathname = new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname;
  } catch (_error) {
    return sendJson(res, 400, { error: "Bad request" });
  }

  const allowedFile = STATIC_FILE_ALLOWLIST.get(pathname);
  if (!allowedFile) {
    return sendJson(res, 404, { error: "Not found" });
  }

  return serveStaticFile(res, allowedFile);
}

function serveStaticFile(res, allowedFile) {
  const filePath = path.join(ROOT, allowedFile);

  fs.readFile(filePath, (error, data) => {
    if (error) {
      if (error.code === "ENOENT") {
        return sendJson(res, 404, { error: "Not found" });
      }
      return sendJson(res, 500, { error: "Read file failed" });
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
}

function handlePublishReport(body, res) {
  const report = body && typeof body.report === "object" ? body.report : null;
  if (!report || !report.scope || !Array.isArray(report.scope.cases) || !Array.isArray(report.scope.bugs)) {
    return sendJson(res, 400, { error: "缺少可发布的报告数据。" });
  }

  const id = `rpt-${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`;
  const publishedAt = new Date().toISOString();
  const snapshot = {
    id,
    publishedAt,
    title: String(body.title || "测试报告").trim() || "测试报告",
    report,
    reportConclusion: String(body.reportConclusion || "").trim()
  };

  ensureDir(PUBLISHED_REPORTS_ROOT);
  fs.writeFileSync(path.join(PUBLISHED_REPORTS_ROOT, `${id}.json`), JSON.stringify(snapshot, null, 2), "utf-8");
  return sendJson(res, 201, { ok: true, id, url: `/report/${id}`, publishedAt });
}

function handleReadPublishedReport(res, reportId) {
  const reportPath = path.join(PUBLISHED_REPORTS_ROOT, `${reportId}.json`);
  if (!fs.existsSync(reportPath)) {
    return sendJson(res, 404, { error: "报告不存在或已被移除。" });
  }

  try {
    return sendJson(res, 200, JSON.parse(fs.readFileSync(reportPath, "utf-8")));
  } catch (_error) {
    return sendJson(res, 500, { error: "报告读取失败。" });
  }
}

function handleListPublishedReports(res) {
  if (!fs.existsSync(PUBLISHED_REPORTS_ROOT)) {
    return sendJson(res, 200, { reports: [] });
  }

  const reports = fs.readdirSync(PUBLISHED_REPORTS_ROOT)
    .filter((fileName) => /^rpt-[a-z0-9-]+\.json$/.test(fileName))
    .map((fileName) => {
      try {
        const snapshot = JSON.parse(fs.readFileSync(path.join(PUBLISHED_REPORTS_ROOT, fileName), "utf-8"));
        return {
          id: snapshot.id,
          title: snapshot.title || "测试报告",
          publishedAt: snapshot.publishedAt || "",
          url: `/report/${snapshot.id}`,
          version: snapshot.report?.batchVersion || "未选择",
          decision: snapshot.report?.releaseDecision?.label || "待评估",
          decisionTone: snapshot.report?.releaseDecision?.tone || "warn",
          total: resolveReportTotal(snapshot.report)
        };
      } catch (_error) {
        return null;
      }
    })
    .filter(Boolean)
    .sort((left, right) => String(right.publishedAt).localeCompare(String(left.publishedAt)));

  return sendJson(res, 200, { reports });
}

function resolveReportTotal(report) {
  const directTotal = Number(report?.total);
  if (Number.isFinite(directTotal) && directTotal > 0) {
    return directTotal;
  }
  if (Array.isArray(report?.scope?.cases)) {
    return report.scope.cases.length;
  }
  if (Array.isArray(report?.cases)) {
    return report.cases.length;
  }
  return 0;
}

function handleDeletePublishedReport(res, reportId) {
  const reportPath = path.join(PUBLISHED_REPORTS_ROOT, `${reportId}.json`);
  if (!fs.existsSync(reportPath)) {
    return sendJson(res, 404, { error: "报告不存在或已经撤销。" });
  }
  fs.rmSync(reportPath, { force: true });
  return sendJson(res, 200, { ok: true, id: reportId });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 5_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (_error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function readTeamMembersConfig() {
  try {
    if (!fs.existsSync(TEAM_MEMBERS_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(TEAM_MEMBERS_FILE, "utf-8");
    const data = raw ? JSON.parse(raw) : {};
    return normalizeTeamMembers(data.teamMembers);
  } catch (_error) {
    return [];
  }
}

function normalizeTeamMembers(list) {
  return [...new Set((Array.isArray(list) ? list : []).map((item) => String(item || "").trim()).filter(Boolean))];
}

function readAppStateSnapshot() {
  try {
    if (!fs.existsSync(APP_STATE_FILE)) {
      return { revision: 0, state: sanitizeSharedState({}) };
    }
    const raw = fs.readFileSync(APP_STATE_FILE, "utf-8");
    const data = raw ? JSON.parse(raw) : {};
    return {
      revision: Number.isInteger(data.revision) && data.revision >= 0 ? data.revision : 0,
      state: sanitizeSharedState(data.state || {})
    };
  } catch (_error) {
    return { revision: 0, state: sanitizeSharedState({}) };
  }
}

function writeJsonFileAtomic(filePath, value) {
  const temporaryPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(value, null, 2), "utf-8");
  try {
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    try {
      fs.rmSync(temporaryPath, { force: true });
    } catch (_cleanupError) {
      // Preserve the original write error.
    }
    throw error;
  }
}

function createAppStateBackup(snapshot) {
  if (!fs.existsSync(APP_STATE_FILE)) {
    return null;
  }
  fs.mkdirSync(APP_STATE_BACKUP_DIR, { recursive: true });
  const createdAt = new Date().toISOString();
  const backupId = `revision-${snapshot.revision}-${createdAt.replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 8)}.json`;
  writeJsonFileAtomic(path.join(APP_STATE_BACKUP_DIR, backupId), {
    createdAt,
    revision: snapshot.revision,
    state: sanitizeSharedState(snapshot.state)
  });
  pruneAppStateBackups();
  return backupId;
}

function listAppStateBackups() {
  if (!fs.existsSync(APP_STATE_BACKUP_DIR)) {
    return [];
  }
  return fs.readdirSync(APP_STATE_BACKUP_DIR)
    .filter((fileName) => /^revision-\d+-[\w-]+\.json$/.test(fileName))
    .map((fileName) => {
      try {
        const filePath = path.join(APP_STATE_BACKUP_DIR, fileName);
        const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        const state = sanitizeSharedState(raw.state);
        return {
          id: fileName,
          revision: Number.isInteger(raw.revision) ? raw.revision : 0,
          createdAt: raw.createdAt || fs.statSync(filePath).mtime.toISOString(),
          tasks: state.tasks.length,
          cases: state.cases.length,
          bugs: state.bugs.length
        };
      } catch (_error) {
        return null;
      }
    })
    .filter(Boolean)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
    .slice(0, APP_STATE_BACKUP_LIMIT);
}

function readAppStateBackup(backupId) {
  const fileName = String(backupId || "");
  if (!/^revision-\d+-[\w-]+\.json$/.test(fileName)) {
    return null;
  }
  const filePath = path.join(APP_STATE_BACKUP_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (_error) {
    return null;
  }
}

function pruneAppStateBackups() {
  const backups = listAppStateBackups();
  const keepIds = new Set(backups.slice(0, APP_STATE_BACKUP_LIMIT).map((item) => item.id));
  fs.readdirSync(APP_STATE_BACKUP_DIR)
    .filter((fileName) => /^revision-\d+-[\w-]+\.json$/.test(fileName) && !keepIds.has(fileName))
    .forEach((fileName) => fs.rmSync(path.join(APP_STATE_BACKUP_DIR, fileName), { force: true }));
}

function sanitizeSharedState(input) {
  const state = input && typeof input === "object" ? input : {};
  return {
    documents: Array.isArray(state.documents) ? state.documents : [],
    cases: Array.isArray(state.cases) ? state.cases : [],
    bugs: Array.isArray(state.bugs) ? state.bugs : [],
    batches: Array.isArray(state.batches) ? state.batches : [],
    tasks: Array.isArray(state.tasks) ? state.tasks : [],
    reportConclusion: typeof state.reportConclusion === "string" ? state.reportConclusion : "",
    reportConclusions: state.reportConclusions && typeof state.reportConclusions === "object" ? state.reportConclusions : {},
    lastGeneration: state.lastGeneration && typeof state.lastGeneration === "object" ? state.lastGeneration : null
  };
}

function sanitizeFileName(value) {
  return String(value || "").replace(/[\\/:*?"<>|]/g, "-");
}

function encodeAsciiFileName(value) {
  return String(value || "report.docx").replace(/[^\x20-\x7E]/g, "_");
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}
