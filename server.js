const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");

loadEnvFile(path.join(__dirname, ".env"));

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const TEAM_MEMBERS_FILE = path.join(ROOT, "team-members.json");
const APP_STATE_FILE = path.join(ROOT, "app-state.json");
const PYTHON_BIN = process.env.CODEX_PYTHON || path.join(os.homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "python", "python.exe");
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const LARK_API_BASE_URL = process.env.LARK_API_BASE_URL || "https://open.larksuite.com";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon"
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

const server = http.createServer(async (req, res) => {
  try {
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
      return sendJson(res, 200, {
        state: readAppState()
      });
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
      fs.writeFileSync(TEAM_MEMBERS_FILE, JSON.stringify({ teamMembers }, null, 2), "utf-8");
      return sendJson(res, 200, { ok: true, teamMembers });
    }

    if (req.method === "POST" && req.url === "/api/app-state") {
      const body = await readJsonBody(req);
      const nextState = sanitizeSharedState(body.state);
      fs.writeFileSync(APP_STATE_FILE, JSON.stringify({ state: nextState }, null, 2), "utf-8");
      return sendJson(res, 200, { ok: true, state: nextState });
    }

    if (req.method === "POST" && req.url === "/api/export-report-docx") {
      const body = await readJsonBody(req);
      return handleExportReportDocx(body, res);
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

  const payload = {
    model,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Reply with OK."
          }
        ]
      }
    ],
    max_output_tokens: 16
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
    const message = data?.error?.message || "AI Key 检测失败。";
    return sendJson(res, response.status, { error: message });
  }

  return sendJson(res, 200, {
    ok: true,
    model,
    responseId: data.id || ""
  });
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
        "负责人": formatOwners(batch.owners || batch.owner),
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
        "负责人": formatOwners(task.owners || task.owner),
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
        "负责人": bug.owner,
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
            expected: { type: "string" }
          },
          required: ["module", "title", "type", "priority", "preconditions", "steps", "expected"]
        }
      }
    },
    required: ["summary", "assumptions", "testCases"]
  };
}

function extractStructuredOutput(responseJson) {
  const directText = responseJson.output_text;
  if (directText) {
    try {
      return JSON.parse(directText);
    } catch (_error) {
      return null;
    }
  }

  const outputs = Array.isArray(responseJson.output) ? responseJson.output : [];
  for (const item of outputs) {
    const contents = Array.isArray(item.content) ? item.content : [];
    for (const content of contents) {
      if (typeof content.text === "string") {
        try {
          return JSON.parse(content.text);
        } catch (_error) {
          continue;
        }
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

function serveStatic(req, res) {
  const safeUrl = req.url === "/" ? "/index.html" : req.url;
  const filePath = path.join(ROOT, path.normalize(safeUrl).replace(/^(\.\.[/\\])+/, ""));

  if (!filePath.startsWith(ROOT)) {
    return sendJson(res, 403, { error: "Forbidden" });
  }

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

function readAppState() {
  try {
    if (!fs.existsSync(APP_STATE_FILE)) {
      return sanitizeSharedState({});
    }
    const raw = fs.readFileSync(APP_STATE_FILE, "utf-8");
    const data = raw ? JSON.parse(raw) : {};
    return sanitizeSharedState(data.state || {});
  } catch (_error) {
    return sanitizeSharedState({});
  }
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
