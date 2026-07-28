// Case quality analysis, CSV helpers, and local case generation.

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
