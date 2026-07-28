// Shared domain normalization, lookup, filtering, and report scope helpers.

function fillSelectFromItems(select, items, emptyLabel, selectedValue, labelFn) {
  select.innerHTML = [`<option value="">${emptyLabel}</option>`]
    .concat(items.map((item) => `<option value="${item.id}">${escapeHtml(labelFn(item))}</option>`))
    .join("");
  select.value = items.some((item) => item.id === selectedValue) ? selectedValue : "";
}

function fillOwnerSelect(select, selectedValue = "", emptyLabel = "未选择") {
  if (!select) {
    return;
  }
  const members = normalizeTeamMembers([...state.teamMembers, ...splitOwnerValues(selectedValue)]);
  select.innerHTML = [`<option value="">${emptyLabel}</option>`]
    .concat(members.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`))
    .join("");
  select.value = selectedValue && members.includes(selectedValue) ? selectedValue : "";
}

function splitOwnerValues(value) {
  if (Array.isArray(value)) {
    return normalizeTeamMembers(value);
  }
  return normalizeTeamMembers(String(value || "").split(/[、,，/]/));
}

function getOwnerDisplay(value) {
  return splitOwnerValues(value).join("、");
}

function getReportOwners(scope) {
  const taskMap = new Map(state.tasks.map((item) => [item.id, item]));
  const owners = [];

  if (scope.task) {
    owners.push(...splitOwnerValues(scope.task.owners || scope.task.owner));
  } else {
    const taskIds = [...new Set(scope.cases.map((item) => item.taskId).filter(Boolean))];
    taskIds.forEach((taskId) => {
      const task = taskMap.get(taskId);
      if (task) {
        owners.push(...splitOwnerValues(task.owners || task.owner));
      }
    });
  }

  return normalizeTeamMembers(owners);
}

function renderTeamMembers() {
  if (!els.teamMemberList) {
    return;
  }

  if (!state.teamMembers.length) {
    els.teamMemberList.innerHTML = `
      <div class="empty-state empty-state-rich">
        <strong>还没有成员</strong>
        <p>可以添加测试、开发、产品等常用成员，便于保留团队配置。</p>
      </div>
    `;
    return;
  }

  els.teamMemberList.innerHTML = state.teamMembers.map((member) => `
    <article class="list-card team-member-card">
      <div class="card-top">
        <div>
          <strong>${escapeHtml(member)}</strong>
        </div>
        <button class="danger-link" data-action="delete-team-member" data-member-name="${escapeHtml(member)}">删除</button>
      </div>
    </article>
  `).join("");
}

function addTeamMember() {
  const name = els.teamMemberInput?.value.trim();
  if (!name) {
    setGenerationStatus("先输入成员名称。", "warn");
    return;
  }
  if (state.teamMembers.includes(name)) {
    setGenerationStatus("这个成员已经存在了。", "warn");
    return;
  }
  state.teamMembers.push(name);
  state.teamMembers = normalizeTeamMembers(state.teamMembers);
  if (els.teamMemberInput) {
    els.teamMemberInput.value = "";
  }
  persist();
  renderAll();
  setGenerationStatus(`已新增成员：${name}。`, "ok");
}

function deleteTeamMember(name) {
  if (!name) {
    return;
  }
  state.teamMembers = state.teamMembers.filter((item) => item !== name);
  state.tasks = state.tasks.map((item) => {
    const owners = splitOwnerValues(item.owners || item.owner).filter((owner) => owner !== name);
    return { ...item, owners, owner: owners.join("、") };
  });
  state.bugs = state.bugs.map((item) => (item.owner === name ? { ...item, owner: "" } : item));
  persist();
  renderAll();
  setGenerationStatus(`已删除成员：${name}。相关成员信息已清空。`, "warn");
}

function formatBatchLabel(batch) {
  return batch.version ? `${batch.name} ${batch.version}` : batch.name;
}

function formatTaskBatchLabel(batch) {
  if (!batch) {
    return "未关联版本";
  }
  return batch.version || "未命名版本";
}

function formatTaskLabel(task) {
  const batch = getBatchById(task.batchId);
  const version = batch?.systemManaged ? "" : task.batchVersion || batch?.version || "";
  return [task.name || "未命名任务", version].filter(Boolean).join(" / ");
}

function getBatchById(batchId) {
  return state.batches.find((item) => item.id === batchId);
}

function getTaskById(taskId) {
  return state.tasks.find((item) => item.id === taskId);
}

function getModuleById(moduleId) {
  return state.modules.find((item) => item.id === moduleId);
}

function getBatchLabelById(batchId) {
  const batch = getBatchById(batchId);
  return batch ? formatBatchLabel(batch) : "";
}

function getBatchVersionById(batchId) {
  const batch = getBatchById(batchId);
  return batch?.version || "";
}

function getTaskNameById(taskId) {
  return getTaskById(taskId)?.name || "";
}

function getModuleNameById(moduleId) {
  const moduleItem = getModuleById(moduleId);
  return moduleItem ? moduleItem.name : "";
}

function slugifyBusiness(name) {
  return `business-${String(name).replace(/\s+/g, "-")}`;
}

function normalizeBusinessName(value) {
  const text = String(value || "").trim();
  if (BUSINESS_ALIAS_MAP[text]) {
    return BUSINESS_ALIAS_MAP[text];
  }
  if (text.includes("VA")) return "VA业务";
  if (text.includes("CARD") || text.includes("卡收单")) return "卡收单业务";
  if (text.includes("数字货币")) return "数字货币业务";
  if (text.includes("代付")) return "代付业务";
  if (text.includes("本地收单")) return "本地收单业务";
  return "";
}

function normalizeModuleId(value) {
  const normalizedName = normalizeBusinessName(value.replace?.(/^business-/, "") || value);
  return normalizedName ? slugifyBusiness(normalizedName) : "";
}

function normalizeBatchItem(item) {
  const moduleName = normalizeBusinessName(item.moduleName || item.name);
  return {
    ...item,
    name: moduleName || item.name,
    moduleName: moduleName || item.moduleName || item.name,
    moduleId: moduleName ? slugifyBusiness(moduleName) : item.moduleId || "",
    createdBy: String(item.createdBy || "").trim(),
    createdAt: item.createdAt || "",
    updatedBy: String(item.updatedBy || "").trim(),
    updatedAt: item.updatedAt || item.createdAt || ""
  };
}

function normalizeTaskItem(item) {
  const linkedBatch = getBatchById(item.batchId);
  const moduleName = normalizeBusinessName(item.moduleName || linkedBatch?.moduleName || linkedBatch?.name);
  const owners = splitOwnerValues(item.owners || item.owner);
  return {
    ...item,
    batchId: item.batchId || "",
    batchVersion: item.batchVersion || linkedBatch?.version || "",
    batchName: item.batchName || (linkedBatch ? formatBatchLabel(linkedBatch) : ""),
    moduleName: moduleName || item.moduleName || "",
    moduleId: moduleName ? slugifyBusiness(moduleName) : item.moduleId || linkedBatch?.moduleId || "",
    owner: owners.join("、"),
    owners,
    status: item.status || "进行中",
    createdBy: String(item.createdBy || "").trim(),
    createdAt: item.createdAt || "",
    updatedBy: String(item.updatedBy || "").trim(),
    updatedAt: item.updatedAt || item.createdAt || ""
  };
}

function normalizeCaseItem(item) {
  const moduleName = normalizeBusinessName(item.module || item.moduleName);
  return {
    ...item,
    taskId: item.taskId || "",
    taskName: item.taskName || "",
    module: moduleName || item.module,
    moduleId: moduleName ? slugifyBusiness(moduleName) : item.moduleId || "",
    automationEnabled: Boolean(item.automationEnabled),
    automationTargetPath: String(item.automationTargetPath || "").trim(),
    automationSteps: normalizeCaseAutomationSteps(item.automationSteps),
    automationLastRun: normalizeCaseAutomationLastRun(item.automationLastRun),
    createdBy: String(item.createdBy || "").trim(),
    createdAt: item.createdAt || "",
    updatedBy: String(item.updatedBy || "").trim(),
    updatedAt: item.updatedAt || item.createdAt || ""
  };
}

function normalizeCaseAutomationSteps(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeAutomationStep(item)).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((item) => normalizeAutomationStep(item)).filter(Boolean) : [];
    } catch (_error) {
      return [];
    }
  }

  return [];
}

function createDefaultAutomationStep() {
  return {
    stepType: "click",
    locatorType: "text",
    target: "",
    inputValue: "",
    remark: ""
  };
}

function normalizeAutomationStep(rawStep) {
  if (!rawStep || typeof rawStep !== "object") {
    return null;
  }

  const stepType = normalizeAutomationStepType(rawStep.stepType || rawStep.type, rawStep.action);
  const locatorType = normalizeAutomationLocatorType(rawStep.locatorType || rawStep.by);
  const normalized = {
    stepType,
    locatorType,
    target: "",
    inputValue: "",
    remark: String(rawStep.remark || rawStep.note || "").trim()
  };

  if (stepType === "openPage") {
    normalized.target = String(rawStep.target || rawStep.path || rawStep.url || "").trim();
    return normalized;
  }

  if (stepType === "wait") {
    normalized.inputValue = String(rawStep.inputValue || rawStep.ms || "").trim();
    normalized.target = String(rawStep.target || "").trim();
    return normalized;
  }

  if (stepType === "assertText") {
    normalized.target = inferAutomationTargetFromRawStep(rawStep, locatorType);
    normalized.inputValue = String(rawStep.inputValue || rawStep.text || "").trim();
    return normalized;
  }

  if (stepType === "input") {
    normalized.target = inferAutomationTargetFromRawStep(rawStep, locatorType);
    normalized.inputValue = String(rawStep.inputValue || rawStep.value || "").trim();
    return normalized;
  }

  if (stepType === "screenshot") {
    normalized.target = inferAutomationTargetFromRawStep(rawStep, locatorType) || "body";
    normalized.inputValue = String(rawStep.inputValue || rawStep.name || rawStep.fileName || "").trim();
    return normalized;
  }

  normalized.target = inferAutomationTargetFromRawStep(rawStep, locatorType);
  return normalized;
}

function normalizeAutomationStepType(stepType, action) {
  const raw = String(stepType || action || "").trim().toLowerCase();
  if (["openpage", "goto", "open", "打开页面"].includes(raw)) return "openPage";
  if (["click", "点击"].includes(raw)) return "click";
  if (["input", "fill", "输入"].includes(raw)) return "input";
  if (["waitelement", "waitfor", "等待元素"].includes(raw)) return "waitElement";
  if (["asserttext", "校验文本", "断言文本"].includes(raw)) return "assertText";
  if (["assertelement", "assertvisible", "校验元素", "校验元素存在", "断言元素"].includes(raw)) return "assertElement";
  if (["screenshot", "截图"].includes(raw)) return "screenshot";
  if (["wait", "waitfortimeout", "等待"].includes(raw)) return "wait";
  return "click";
}

function normalizeAutomationLocatorType(locatorType) {
  const raw = String(locatorType || "").trim().toLowerCase();
  if (["text", "文本"].includes(raw)) return "text";
  if (["placeholder"].includes(raw)) return "placeholder";
  if (["label"].includes(raw)) return "label";
  return "css";
}

function inferAutomationTargetFromRawStep(step, locatorType) {
  if (step.target) return String(step.target).trim();
  if (step.selector) {
    if (locatorType === "text") {
      const textMatch = String(step.selector).match(/text=(.+)$/);
      if (textMatch) return textMatch[1].trim();
    }
    if (locatorType === "placeholder") {
      const placeholderMatch = String(step.selector).match(/placeholder=(.+)$/);
      if (placeholderMatch) return placeholderMatch[1].trim();
    }
    if (locatorType === "label") {
      const labelMatch = String(step.selector).match(/label=(.+)$/);
      if (labelMatch) return labelMatch[1].trim();
    }
    return String(step.selector).trim();
  }
  return "";
}

function buildAutomationSelector(locatorType, target) {
  const normalizedTarget = String(target || "").trim();
  if (!normalizedTarget) {
    return "";
  }
  if (locatorType === "text") {
    return `text=${normalizedTarget}`;
  }
  if (locatorType === "placeholder") {
    return `placeholder=${normalizedTarget}`;
  }
  if (locatorType === "label") {
    return `label=${normalizedTarget}`;
  }
  return normalizedTarget;
}

function buildAutomationRuntimeSteps(stepDrafts) {
  return (stepDrafts || []).map((rawStep) => normalizeAutomationStep(rawStep)).filter(Boolean).map((step) => {
    if (step.stepType === "openPage") {
      return {
        stepType: step.stepType,
        locatorType: step.locatorType,
        target: step.target,
        inputValue: step.inputValue,
        remark: step.remark,
        action: "goto",
        path: step.target
      };
    }

    if (step.stepType === "wait") {
      return {
        stepType: step.stepType,
        locatorType: step.locatorType,
        target: step.target,
        inputValue: step.inputValue,
        remark: step.remark,
        action: "waitForTimeout",
        ms: Number(step.inputValue) > 0 ? Number(step.inputValue) : 1000
      };
    }

    if (step.stepType === "click") {
      return {
        ...step,
        action: "click",
        selector: buildAutomationSelector(step.locatorType, step.target)
      };
    }

    if (step.stepType === "input") {
      return {
        ...step,
        action: "fill",
        selector: buildAutomationSelector(step.locatorType, step.target),
        value: step.inputValue
      };
    }

    if (step.stepType === "waitElement") {
      return {
        ...step,
        action: "waitFor",
        selector: buildAutomationSelector(step.locatorType, step.target),
        state: "visible"
      };
    }

    if (step.stepType === "assertText") {
      return {
        ...step,
        action: "assertText",
        selector: buildAutomationSelector(step.locatorType, step.target || "body"),
        text: step.inputValue
      };
    }

    if (step.stepType === "assertElement") {
      return {
        ...step,
        action: "assertVisible",
        selector: buildAutomationSelector(step.locatorType, step.target)
      };
    }

    if (step.stepType === "screenshot") {
      return {
        ...step,
        action: "screenshot",
        selector: buildAutomationSelector(step.locatorType, step.target || "body"),
        name: step.inputValue
      };
    }

    return step;
  });
}

function formatAutomationStepsJson(steps) {
  return JSON.stringify(buildAutomationRuntimeSteps(steps), null, 2);
}

function parseAutomationStepsJson(stepsText) {
  const text = String(stepsText || "").trim();
  if (!text) {
    return [];
  }
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error("自动化步骤必须是 JSON 数组。");
  }
  return parsed.map((item) => normalizeAutomationStep(item)).filter(Boolean);
}

function getAutomationStepTypeLabel(stepType) {
  return AUTOMATION_STEP_TYPES.find((item) => item.value === stepType)?.label || "步骤";
}

function getAutomationQuickHint(stepType) {
  if (stepType === "openPage") return "填页面路径，例如：/orders/list";
  if (stepType === "click") return "填按钮文字，通常直接写“查询”或“保存”";
  if (stepType === "input") return "目标填输入框提示词，输入值填你要输入的内容";
  if (stepType === "waitElement") return "通常等表格、按钮或结果区出现";
  if (stepType === "assertText") return "目标通常填 body，输入值填你期望看到的文字";
  if (stepType === "assertElement") return "直接填页面上应该出现的文字或元素";
  if (stepType === "screenshot") return "一般不用改，留作执行留痕";
  if (stepType === "wait") return "只在页面确实有明显延迟时再填毫秒数";
  return "";
}

function getAutomationSimplePlaceholder(stepType) {
  if (stepType === "openPage") return "例如：/orders/list";
  if (stepType === "click") return "例如：登录 / 保存 / 查询";
  if (stepType === "input") return "例如：请输入账号";
  if (stepType === "waitElement") return "例如：结果列表 / 提交按钮";
  if (stepType === "assertText") return "例如：body";
  if (stepType === "assertElement") return "例如：首页 / 提交成功";
  if (stepType === "screenshot") return "例如：body";
  if (stepType === "wait") return "可不填";
  return "请输入";
}

function getAutomationStepSummary(step) {
  const stepLabel = getAutomationStepTypeLabel(step.stepType);
  const target = String(step.target || "").trim() || "未填写";
  const inputValue = String(step.inputValue || "").trim();
  if (step.stepType === "input") {
    return `${stepLabel}：在「${target}」里输入「${inputValue || "未填写"}」`;
  }
  if (step.stepType === "assertText") {
    return `${stepLabel}：检查页面里出现「${inputValue || "未填写"}」`;
  }
  if (step.stepType === "wait") {
    return `${stepLabel}：等待 ${inputValue || "1000"} ms`;
  }
  if (step.stepType === "openPage") {
    return `${stepLabel}：进入「${target}」`;
  }
  return `${stepLabel}：${target}`;
}

function shouldShowAutomationLocator(stepType) {
  return !["openPage", "wait"].includes(stepType);
}

function shouldShowAutomationTarget(stepType) {
  return true;
}

function getAutomationTargetLabel(stepType) {
  if (stepType === "openPage") return "目标值（页面路径）";
  if (stepType === "wait") return "目标值（可选备注）";
  return "目标值";
}

function getAutomationInputLabel(stepType) {
  if (stepType === "input") return "输入值";
  if (stepType === "assertText") return "断言文本";
  if (stepType === "wait") return "输入值（毫秒）";
  if (stepType === "screenshot") return "输入值（截图名）";
  return "输入值";
}

function shouldShowAutomationInput(stepType) {
  return ["input", "assertText", "wait", "screenshot"].includes(stepType);
}

function ensureCaseAutomationEditor(node) {
  const automationBlock = node.querySelector(".case-automation-block");
  if (!automationBlock) {
    return;
  }

  const legacyLabel = automationBlock.querySelector("label:not(.case-execution-note-wrap):has(.case-automation-steps)");
  if (automationBlock.querySelector(".case-automation-editor")) {
    return;
  }

  const editor = document.createElement("div");
  editor.className = "case-automation-editor";
  editor.innerHTML = `
    <div class="case-automation-beginner-guide">
      <strong>只要 3 步：1 选模板，2 改文字，3 点运行。</strong>
      <p>新人建议先从模板开始，绝大多数场景都不用自己从零搭步骤。</p>
    </div>
    <div class="case-automation-toolbar">
      <div class="case-automation-template-row">
        <span class="case-automation-step-no">第 1 步</span>
        <select class="case-automation-template-select">
          <option value="">请选择一个常用模板</option>
        </select>
        <button type="button" class="primary-button tiny-button case-automation-apply-template">套用这个模板</button>
      </div>
    </div>
    <div class="case-automation-secondary-tools">
      <div class="case-automation-quick-add"></div>
      <button type="button" class="ghost-button tiny-button case-automation-add-step">从空白步骤开始</button>
      <button type="button" class="ghost-button tiny-button case-automation-json-toggle">查看/编辑 JSON</button>
    </div>
    <div class="case-automation-step-list"></div>
    <div class="case-automation-json-panel hidden-field"></div>
  `;

  const jsonPanel = editor.querySelector(".case-automation-json-panel");
  const textarea = automationBlock.querySelector(".case-automation-steps");
  if (textarea) {
    const jsonLabel = document.createElement("label");
    jsonLabel.innerHTML = `
      <span>高级模式（JSON）</span>
    `;
    jsonLabel.appendChild(textarea);
    textarea.rows = 7;
    textarea.placeholder = '例如：[{"action":"click","selector":"text=搜索"},{"action":"assertVisible","selector":".table-row"}]';
    jsonPanel.appendChild(jsonLabel);
  }

  if (legacyLabel) {
    legacyLabel.remove();
  }

  const actionBar = automationBlock.querySelector(".inline-actions");
  if (actionBar) {
    automationBlock.insertBefore(editor, actionBar);
  } else {
    automationBlock.appendChild(editor);
  }
}

function normalizeCaseAutomationLastRun(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  return {
    status: String(value.status || "").trim(),
    summary: String(value.summary || "").trim(),
    startedAt: String(value.startedAt || "").trim(),
    finishedAt: String(value.finishedAt || "").trim()
  };
}

function normalizeBugItem(item) {
  const moduleName = normalizeBusinessName(item.moduleName);
  return {
    ...item,
    taskId: item.taskId || "",
    taskName: item.taskName || "",
    moduleName: moduleName || item.moduleName,
    moduleId: moduleName ? slugifyBusiness(moduleName) : item.moduleId || "",
    owner: String(item.owner || "").trim(),
    createdBy: String(item.createdBy || "").trim(),
    createdAt: item.createdAt || "",
    updatedBy: String(item.updatedBy || "").trim(),
    updatedAt: item.updatedAt || item.createdAt || ""
  };
}

function normalizeTeamMembers(list) {
  return [...new Set((list || []).map((item) => String(item || "").trim()).filter(Boolean))];
}

function collectOwnersIntoTeamMembers() {
  const owners = [
    ...state.tasks.flatMap((item) => splitOwnerValues(item.owners || item.owner)),
    ...state.bugs.map((item) => item.owner)
  ];
  state.teamMembers = normalizeTeamMembers([...state.teamMembers, ...owners]);
}

function getCaseModules() {
  return [...new Set(state.cases.map((item) => item.module).filter(Boolean))];
}

function getCaseTasks() {
  return [...new Set(state.cases.map((item) => item.taskName).filter(Boolean))];
}

function isSystemWorkspaceBatch(batch) {
  return Boolean(
    batch?.systemManaged
    || batch?.id === "batch-default-workspace"
    || batch?.version === DEFAULT_WORKSPACE_VERSION
  );
}

function buildCaseBatchFilterOptions(source = "cases") {
  const sourceItems = source === "bugs" ? state.bugs : state.cases;
  const items = [];
  const seen = new Set();

  state.batches.forEach((batch) => {
    if (
      !batch?.id
      || batch.systemManaged
      || batch.id === "batch-default-workspace"
      || batch.version === DEFAULT_WORKSPACE_VERSION
      || seen.has(batch.id)
    ) {
      return;
    }
    seen.add(batch.id);
    items.push({
      id: batch.id,
      version: batch.version || "",
      name: batch.name || "",
      moduleName: batch.moduleName || ""
    });
  });

  sourceItems.forEach((item) => {
    const batchId = String(item.batchId || "").trim();
    const batchVersion = String(item.batchVersion || "").trim();
    const linkedBatch = getBatchById(batchId);
    if (
      linkedBatch?.systemManaged
      || batchId === "batch-default-workspace"
      || linkedBatch?.version === DEFAULT_WORKSPACE_VERSION
      || batchVersion === DEFAULT_WORKSPACE_VERSION
    ) {
      return;
    }
    if (batchId && seen.has(batchId)) {
      return;
    }
    const fallbackId = batchId || (batchVersion ? `legacy-version:${batchVersion}` : "");
    if (!fallbackId || seen.has(fallbackId)) {
      return;
    }
    seen.add(fallbackId);
    items.push({
      id: fallbackId,
      version: batchVersion || "未命名版本",
      name: "",
      moduleName: ""
    });
  });

  return items;
}

function buildReportBatchOptions() {
  const items = [];
  const seen = new Set();
  const sourceItems = [...state.cases, ...state.bugs];

  state.batches.forEach((batch) => {
    if (!batch?.id || isSystemWorkspaceBatch(batch) || seen.has(batch.id)) {
      return;
    }
    seen.add(batch.id);
    items.push(batch);
  });

  sourceItems.forEach((item) => {
    const batchId = String(item.batchId || "").trim();
    const batchVersion = String(item.batchVersion || "").trim();
    const linkedBatch = getBatchById(batchId);
    if (
      isSystemWorkspaceBatch(linkedBatch)
      || batchId === "batch-default-workspace"
      || batchVersion === DEFAULT_WORKSPACE_VERSION
      || (!linkedBatch && !batchVersion)
    ) {
      return;
    }
    if (batchId && seen.has(batchId)) {
      return;
    }
    const fallbackId = batchId || (batchVersion ? `legacy-version:${batchVersion}` : "");
    if (!fallbackId || seen.has(fallbackId)) {
      return;
    }
    seen.add(fallbackId);
    items.push({
      id: fallbackId,
      version: batchVersion || "未命名版本",
      name: item.batchName || "",
      moduleId: item.moduleId || "",
      moduleName: item.moduleName || item.module || "",
      status: ""
    });
  });

  return items;
}

function matchesBatchFilter(item, batchFilter) {
  if (!batchFilter) {
    return true;
  }

  const itemBatchId = String(item?.batchId || "").trim();
  if (itemBatchId && itemBatchId === batchFilter) {
    return true;
  }

  if (batchFilter.startsWith("legacy-version:")) {
    const legacyVersion = batchFilter.slice("legacy-version:".length);
    return String(item?.batchVersion || "").trim() === legacyVersion;
  }

  return false;
}

function getTasksByBatchForFilters(batchId, source = "all") {
  const taskPool = state.tasks.map((item) => ({
    id: item.id || item.name,
    name: item.name,
    batchId: item.batchId,
    batchVersion: item.batchVersion || getBatchVersionById(item.batchId)
  }));
  const fallbackPool = source === "bugs"
    ? state.bugs.map((item) => ({ id: item.taskId || item.taskName, name: item.taskName, batchId: item.batchId, batchVersion: item.batchVersion }))
    : state.cases.map((item) => ({ id: item.taskId || item.taskName, name: item.taskName, batchId: item.batchId, batchVersion: item.batchVersion }));
  const baseTasks = [...taskPool, ...fallbackPool];

  return [...new Map(
    baseTasks
      .filter((item) => item.name)
      .filter((item) => matchesBatchFilter(item, batchId))
      .map((item) => [item.name, item])
  ).values()];
}

function getTaskOptionsByBatchForEditor(batchId, source = "bugs") {
  return getTasksByBatchForFilters(batchId, source).map((item) => ({
    id: item.id || item.name,
    name: item.name || ""
  }));
}

function getCasePriorityRank(priority) {
  const normalized = String(priority || "P2").trim().toUpperCase();
  const match = normalized.match(/^P(\d+)$/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function sortCasesByPriority(cases) {
  return cases
    .map((item, index) => ({ item, index }))
    .sort((left, right) => (
      getCasePriorityRank(left.item.priority) - getCasePriorityRank(right.item.priority)
      || left.index - right.index
    ))
    .map(({ item }) => item);
}

function getCasePriorityClass(priority) {
  const rank = getCasePriorityRank(priority);
  if (rank === 0) return "priority-critical";
  if (rank === 1) return "priority-high";
  if (rank === 2) return "priority-normal";
  return "priority-low";
}

function getFilteredCasesForView() {
  const taskFilter = els.caseTaskFilter.value.trim().toLowerCase();
  const statusFilter = els.caseStatusFilter?.value || "";

  const filteredCases = state.cases.filter((item) => {
    return matchesCaseTaskSearch(item, taskFilter)
      && (!statusFilter || (item.executionStatus || "未执行") === statusFilter);
  });

  return sortCasesByPriority(filteredCases);
}

function matchesCaseTaskSearch(item, taskFilter) {
  if (!taskFilter) {
    return true;
  }
  if (String(item.taskName || "").toLowerCase().includes(taskFilter)) {
    return true;
  }
  const activeTask = getTaskById(state.activeTaskId);
  return Boolean(
    activeTask
    && String(activeTask.name || "").toLowerCase() === taskFilter
    && item.taskId === activeTask.id
  );
}

function getFilteredAutomationCasesForView() {
  const batchFilter = els.automationCaseBatchFilter?.value || "";
  const taskFilter = els.automationCaseTaskFilter?.value || "";
  const enabledFilter = els.automationCaseEnabledFilter?.value || "";
  const search = els.automationCaseSearchInput?.value.trim().toLowerCase() || "";

  return state.cases.filter((item) => {
    const byBatch = matchesBatchFilter(item, batchFilter);
    const byTask = !taskFilter || item.taskName === taskFilter;
    const bySearch = !search || [item.title, item.taskName, item.automationTargetPath]
      .some((value) => String(value || "").toLowerCase().includes(search));
    const byAutomation = enabledFilter === "enabled"
      ? Boolean(item.automationEnabled)
      : enabledFilter === "disabled"
        ? !item.automationEnabled
        : true;

    return byBatch && byTask && byAutomation && bySearch;
  });
}

function getFilteredBugs() {
  const batchFilter = els.bugBatchFilter.value;
  const taskFilter = els.bugTaskFilter.value;
  const search = els.bugSearchInput?.value.trim().toLowerCase() || "";
  const severityFilter = els.bugSeverityFilter?.value || "";
  const statusFilter = els.bugWorkflowStatusFilter?.value || "";

  return state.bugs.filter((bug) => {
    const byBatch = matchesBatchFilter(bug, batchFilter);
    const byTask = !taskFilter || bug.taskName === taskFilter;
    const bySearch = !search || [bug.title, bug.note, bug.batchVersion, bug.taskName]
      .some((value) => String(value || "").toLowerCase().includes(search));
    const bySeverity = !severityFilter || bug.severity === severityFilter;
    const byStatus = !statusFilter || bug.status === statusFilter;
    return byBatch && byTask && bySearch && bySeverity && byStatus;
  });
}

function getReportScope() {
  const activeTask = getTaskById(state.activeTaskId);
  const activeBatch = getBatchById(state.activeBatchId || activeTask?.batchId);
  const activeModule = getModuleById(state.activeModuleId || activeTask?.moduleId || activeBatch?.moduleId);

  const cases = state.cases.filter((item) => {
    return (!activeBatch || item.batchId === activeBatch.id)
      && (!activeTask || item.taskId === activeTask.id)
      && (!activeModule || item.moduleId === activeModule.id || item.module === activeModule.name);
  });

  const caseIds = new Set(cases.map((item) => item.id));
  const bugs = state.bugs.filter((bug) => {
    const byBatch = !activeBatch || bug.batchId === activeBatch.id;
    const byTask = !activeTask || bug.taskId === activeTask.id;
    const byModule = !activeModule || bug.moduleId === activeModule.id || bug.moduleName === activeModule.name;
    const byCase = !bug.caseId || caseIds.has(bug.caseId) || !cases.length;
    return byBatch && byTask && byModule && byCase;
  });

  return {
    batch: activeBatch,
    task: activeTask,
    module: activeModule,
    cases,
    bugs
  };
}

function getReportScopeByBatch(batchId) {
  const batch = buildReportBatchOptions().find((item) => item.id === batchId) || getBatchById(batchId);
  const tasks = state.tasks.filter((item) => matchesBatchFilter(item, batchId));
  const taskIds = new Set(tasks.map((item) => item.id));
  const cases = state.cases.filter((item) => matchesBatchFilter(item, batchId) || taskIds.has(item.taskId));
  const caseIds = new Set(cases.map((item) => item.id));
  const bugs = state.bugs.filter((item) => {
    const byBatch = matchesBatchFilter(item, batchId) || taskIds.has(item.taskId);
    const byCase = !item.caseId || caseIds.has(item.caseId) || !cases.length;
    return byBatch && byCase;
  });

  return {
    batch,
    task: null,
    module: batch?.moduleId ? getModuleById(batch.moduleId) : null,
    tasks,
    cases,
    bugs
  };
}

function renderCaseFilters() {
  const caseBatchOptions = buildCaseBatchFilterOptions("cases");
  const bugBatchOptions = buildCaseBatchFilterOptions("bugs");
  fillSelectFromItems(els.automationCaseBatchFilter, caseBatchOptions, "全部版本", els.automationCaseBatchFilter?.value, formatTaskBatchLabel);
  fillSelectFromItems(els.bugBatchFilter, bugBatchOptions, "全部版本", els.bugBatchFilter.value, formatTaskBatchLabel);

  const caseTasks = getTasksByBatchForFilters("", "cases");
  const automationCaseTasks = getTasksByBatchForFilters(els.automationCaseBatchFilter?.value || "", "cases");
  const bugTasks = getTasksByBatchForFilters(els.bugBatchFilter.value, "bugs");
  const automationCaseTaskNames = automationCaseTasks.map((item) => item.name);
  const bugTaskNames = bugTasks.map((item) => item.name);
  const automationCaseTaskValue = automationCaseTaskNames.includes(els.automationCaseTaskFilter?.value) ? els.automationCaseTaskFilter.value : "";
  const bugTaskValue = bugTaskNames.includes(els.bugTaskFilter.value) ? els.bugTaskFilter.value : "";

  els.caseTaskOptions.innerHTML = caseTasks.map((item) => `<option value="${escapeHtml(item.name)}"></option>`).join("");
  if (els.automationCaseTaskFilter) {
    els.automationCaseTaskFilter.innerHTML = `<option value="">全部任务</option>${automationCaseTasks.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join("")}`;
  }
  els.bugTaskFilter.innerHTML = `<option value="">全部任务</option>${bugTasks.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join("")}`;

  if (els.automationCaseTaskFilter) {
    els.automationCaseTaskFilter.value = automationCaseTaskValue;
  }
  els.bugTaskFilter.value = bugTaskValue;
}

function updateCaseExecutionState(item, nextStatus) {
  item.executionStatus = nextStatus;
  Object.assign(item, applyUpdateAuditFields(item));
}

function applyBulkCaseExecutionStatus() {
  const nextStatus = els.caseBulkStatus?.value || "";
  if (!nextStatus) {
    setCaseActionStatus("请先选择要批量设置成什么执行状态。", "warn");
    return;
  }

  const filteredCases = getFilteredCasesForView();
  if (!filteredCases.length) {
    setCaseActionStatus("当前筛选范围里没有可批量更新的测试用例。", "warn");
    return;
  }

  const scopeLabel = getCaseBulkScopeLabel();
  const confirmMessage = `确认把${scopeLabel}中的 ${filteredCases.length} 条测试用例批量改为“${nextStatus}”吗？`;
  if (!window.confirm(confirmMessage)) {
    setCaseActionStatus("已取消批量修改。", "neutral");
    return;
  }

  const previousCases = filteredCases.map((item) => ({
    id: item.id,
    executionStatus: item.executionStatus || "未执行",
    updatedAt: item.updatedAt || "",
    updatedBy: item.updatedBy || ""
  }));
  filteredCases.forEach((item) => updateCaseExecutionState(item, nextStatus));
  persist();
  renderCases();
  renderQuickStats();
  renderReport();
  setCaseActionStatus(`已将${scopeLabel}中的 ${filteredCases.length} 条测试用例批量更新为“${nextStatus}”。`, "ok");
  showToast(`已批量更新 ${filteredCases.length} 条用例`, "success", {
    actionLabel: "撤销",
    duration: 6000,
    onAction: () => undoBulkCaseExecutionStatus(previousCases)
  });
}

function getCaseBulkScopeLabel() {
  const parts = [];
  const taskText = els.caseTaskFilter?.value.trim();
  const status = els.caseStatusFilter?.value || "";
  if (taskText) parts.push(`任务搜索“${taskText}”`);
  if (status) parts.push(`状态“${status}”`);
  return parts.length ? `当前筛选范围（${parts.join("，")}）` : "当前全部列表";
}

function undoBulkCaseExecutionStatus(previousCases) {
  const previousById = new Map(previousCases.map((item) => [item.id, item]));
  let restoredCount = 0;
  state.cases.forEach((item) => {
    const previous = previousById.get(item.id);
    if (!previous) return;
    item.executionStatus = previous.executionStatus;
    if (previous.updatedAt) item.updatedAt = previous.updatedAt;
    if (previous.updatedBy) item.updatedBy = previous.updatedBy;
    restoredCount += 1;
  });
  persist();
  renderCases();
  renderQuickStats();
  renderReport();
  setCaseActionStatus(`已撤销批量修改，恢复 ${restoredCount} 条测试用例。`, "ok");
}

function getReportConclusionForBatch(batchId) {
  if (!batchId) {
    return state.reportConclusion || "";
  }
  return state.reportConclusions?.[batchId] || "";
}

function setReportConclusionForBatch(batchId, value) {
  if (!batchId) {
    state.reportConclusion = value;
    return;
  }
  state.reportConclusions = {
    ...(state.reportConclusions || {}),
    [batchId]: value
  };
  state.reportConclusion = value;
}

function getReportBatchCards() {
  return buildReportBatchOptions().filter((batch) => !isSystemWorkspaceBatch(batch)).map((batch) => {
    const scope = getReportScopeByBatch(batch.id);
    const report = buildReportViewModel(scope);
    return {
      batch,
      report
    };
  });
}
