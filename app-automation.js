// UI automation case editing and execution.

function renderAutomationCases() {
  if (!els.automationCaseList) {
    return;
  }

  const filtered = getFilteredAutomationCasesForView();
  renderAutomationAssetSummary(filtered);
  if (!filtered.length) {
    setAutomationCaseStatus(state.cases.length ? "没有找到匹配的用例，请调整搜索或筛选条件。" : "还没有可配置的测试用例。", state.cases.length ? "warn" : "neutral");
    els.automationCaseList.innerHTML = `
      <div class="empty-state empty-state-rich">
        <strong>${state.cases.length ? "当前筛选范围里没有匹配的自动化用例" : "这里还没有测试用例"}</strong>
        <p>${state.cases.length ? "清空搜索词或调整筛选条件后再试。" : "先去生成用例，再回来配置需要重复执行的场景。"}</p>
      </div>
    `;
    return;
  }

  if (activeAutomationEditorCaseId === null || (activeAutomationEditorCaseId && !filtered.some((item) => item.id === activeAutomationEditorCaseId))) {
    activeAutomationEditorCaseId = filtered.find((item) => item.automationEnabled)?.id || filtered[0].id;
  }

  setAutomationCaseStatus(`当前显示 ${filtered.length} 条用例。点击“配置用例”后，仅展开当前这一条。`, "neutral");
  els.automationCaseList.innerHTML = "";
  filtered.forEach((item, index) => {
    const node = els.caseTemplate.content.firstElementChild.cloneNode(true);
    ensureCaseAutomationEditor(node);
    const isEditorOpen = activeAutomationEditorCaseId === item.id;
    node.classList.add("automation-case-card");
    node.classList.toggle("is-configuring", isEditorOpen);
    node.querySelector(".case-detail")?.classList.toggle("hidden-field", !isEditorOpen);
    const cardKicker = node.querySelector(".case-card-kicker");
    if (cardKicker) {
      cardKicker.textContent = "自动化用例";
    }
    const caseSequenceBadge = ensureCaseSequenceBadge(node);
    node.querySelector(".case-title-text").textContent = item.title;
    if (caseSequenceBadge) {
      caseSequenceBadge.textContent = `第 ${index + 1} 条`;
    }
    node.querySelector(".case-version").textContent = item.batchVersion || "未带版本";
    node.querySelector(".case-task").textContent = item.taskName || "未分任务";

    const statusBadge = node.querySelector(".case-status");
    const priorityBadge = node.querySelector(".case-priority");
    const cardMeta = node.querySelector(".case-card-meta");
    const configBadge = document.createElement("span");
    configBadge.className = `badge ${item.automationEnabled ? "tone-green" : "subtle"} automation-config-badge`;
    configBadge.textContent = item.automationEnabled ? "已配置" : "待配置";
    const runBadge = document.createElement("span");
    const lastRunStatus = item.automationLastRun?.status || "未运行";
    runBadge.className = `badge ${lastRunStatus === "通过" ? "tone-green" : lastRunStatus === "失败" ? "tone-red" : "subtle"} automation-result-badge`;
    runBadge.textContent = lastRunStatus;
    cardMeta?.append(configBadge, runBadge);
    const executionRow = node.querySelector(".case-execution-row");
    const executionBadge = node.querySelector(".case-execution-badge");
    const automationEnabled = node.querySelector(".case-automation-enabled");
    const automationTargetPath = node.querySelector(".case-automation-target-path");
    const automationSteps = node.querySelector(".case-automation-steps");
    const automationStepList = node.querySelector(".case-automation-step-list");
    const automationAddStep = node.querySelector(".case-automation-add-step");
    const automationQuickAdd = node.querySelector(".case-automation-quick-add");
    const automationTemplateSelect = node.querySelector(".case-automation-template-select");
    const automationApplyTemplate = node.querySelector(".case-automation-apply-template");
    const automationJsonToggle = node.querySelector(".case-automation-json-toggle");
    const automationJsonPanel = node.querySelector(".case-automation-json-panel");
    const automationStatus = node.querySelector(".case-automation-status");
    const automationFeedback = node.querySelector(".case-automation-feedback");
    const automationSave = node.querySelector(".case-automation-save");
    const automationRun = node.querySelector(".case-automation-run");

    statusBadge.textContent = item.executionStatus || "未执行";
    priorityBadge.textContent = item.priority;
    applyBadgeTone(statusBadge, getExecutionStatusTone(item.executionStatus || "未执行"));
    applyBadgeTone(priorityBadge, getPriorityTone(item.priority));
    syncExecutionStatusBadge(executionBadge, item.executionStatus || "未执行");
    if (executionRow) {
      executionRow.classList.add("hidden-field");
    }

    node.querySelector(".case-preconditions-preview").textContent = truncateText(item.preconditions, 90);
    node.querySelector(".case-steps-preview").textContent = truncateText(item.steps, 110);
    node.querySelector(".case-preconditions-full").textContent = item.preconditions || "无";
    node.querySelector(".case-steps-full").textContent = item.steps || "无";
    node.querySelector(".case-expected-full").textContent = item.expected || "无";

    automationEnabled.checked = Boolean(item.automationEnabled);
    automationTargetPath.value = item.automationTargetPath || "";
    syncAutomationStatusChip(automationStatus, item.automationLastRun?.status || "");
    automationFeedback.textContent = getCaseAutomationFeedbackText(item);
    automationFeedback.className = `inline-feedback ${getCaseAutomationFeedbackTone(item)}`;
    automationTemplateSelect.innerHTML = `<option value="">请选择一个常用模板</option>${AUTOMATION_STEP_TEMPLATES.map((template) => `<option value="${escapeHtml(template.value)}">${escapeHtml(template.label)}</option>`).join("")}`;
    if (automationQuickAdd) {
      automationQuickAdd.innerHTML = AUTOMATION_QUICK_ADD_TYPES.map((stepType) => `
        <button type="button" class="ghost-button tiny-button" data-quick-step="${escapeHtml(stepType)}">补一步：${escapeHtml(getAutomationStepTypeLabel(stepType))}</button>
      `).join("");
    }

    const editorState = {
      steps: (item.automationSteps || []).map((step) => normalizeAutomationStep(step)).filter(Boolean)
    };
    if (!editorState.steps.length) {
      editorState.steps = [];
    }

    const syncEditorJson = () => {
      automationSteps.value = editorState.steps.length ? formatAutomationStepsJson(editorState.steps) : "";
    };

    const renderStepList = () => {
      if (!automationStepList) {
        return;
      }
      if (!editorState.steps.length) {
        automationStepList.innerHTML = `
          <div class="automation-empty-state">
            <strong>先从模板开始会更快</strong>
            <p>先在上面选一个模板，系统会自动带出常用步骤，你只需要改几个字。</p>
          </div>
        `;
        syncEditorJson();
        return;
      }

      automationStepList.innerHTML = editorState.steps.map((step, index) => {
        const showLocator = shouldShowAutomationLocator(step.stepType);
        const showInput = shouldShowAutomationInput(step.stepType);
        return `
          <div class="automation-step-card" data-step-index="${index}">
            <div class="automation-step-card-head">
              <div class="automation-step-head-main">
                <strong>第 ${index + 1} 步 · ${escapeHtml(getAutomationStepTypeLabel(step.stepType))}</strong>
                <span class="automation-step-summary">${escapeHtml(getAutomationStepSummary(step))}</span>
              </div>
              <div class="automation-step-actions">
                <button type="button" class="ghost-button tiny-button" data-step-action="move-up">上移</button>
                <button type="button" class="ghost-button tiny-button" data-step-action="move-down">下移</button>
                <button type="button" class="ghost-button tiny-button" data-step-action="delete">删除</button>
              </div>
            </div>
            <p class="automation-step-hint">${escapeHtml(getAutomationQuickHint(step.stepType))}</p>
            <div class="automation-step-grid">
              <label class="automation-advanced-field hidden-field">
                步骤类型
                <select data-step-field="stepType">
                  ${AUTOMATION_STEP_TYPES.map((option) => `<option value="${escapeHtml(option.value)}"${option.value === step.stepType ? " selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
                </select>
              </label>
              <label class="automation-advanced-field hidden-field" data-advanced-visible="${showLocator ? "true" : "false"}">
                定位方式
                <select data-step-field="locatorType">
                  ${AUTOMATION_LOCATOR_TYPES.map((option) => `<option value="${escapeHtml(option.value)}"${option.value === step.locatorType ? " selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
                </select>
              </label>
              <label>
                ${escapeHtml(step.stepType === "input" ? "你要操作哪个输入框" : step.stepType === "assertText" ? "去哪里检查文字" : step.stepType === "assertElement" ? "页面上应该出现什么" : getAutomationTargetLabel(step.stepType))}
                <input type="text" data-step-field="target" value="${escapeHtml(step.target || "")}" placeholder="${escapeHtml(getAutomationSimplePlaceholder(step.stepType))}">
              </label>
              <label class="${showInput ? "" : "hidden-field"}">
                ${escapeHtml(step.stepType === "input" ? "要输入什么" : step.stepType === "assertText" ? "期望看到的文字" : getAutomationInputLabel(step.stepType))}
                <input type="text" data-step-field="inputValue" value="${escapeHtml(step.inputValue || "")}" placeholder="${step.stepType === "wait" ? "例如：1000" : step.stepType === "input" ? "例如：admin" : ""}">
              </label>
              <label class="automation-step-remark automation-advanced-field hidden-field">
                备注
                <input type="text" data-step-field="remark" value="${escapeHtml(step.remark || "")}" placeholder="可选，帮助团队理解这一步">
              </label>
            </div>
          </div>
        `;
      }).join("");
      syncEditorJson();
    };

    const rerenderEditor = () => {
      renderStepList();
      automationFeedback.textContent = getCaseAutomationFeedbackText(item);
      automationFeedback.className = `inline-feedback ${getCaseAutomationFeedbackTone(item)}`;
    };

    renderStepList();

    automationStepList?.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const field = target.dataset.stepField;
      const card = target.closest(".automation-step-card");
      const index = Number(card?.dataset.stepIndex);
      if (!field || Number.isNaN(index) || !editorState.steps[index]) {
        return;
      }
      editorState.steps[index][field] = target.value;
      syncEditorJson();
    });

    automationStepList?.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const field = target.dataset.stepField;
      const card = target.closest(".automation-step-card");
      const index = Number(card?.dataset.stepIndex);
      if (!field || Number.isNaN(index) || !editorState.steps[index]) {
        return;
      }
      editorState.steps[index][field] = target.value;
      if (field === "stepType") {
        editorState.steps[index] = normalizeAutomationStep({
          ...editorState.steps[index],
          stepType: target.value
        }) || createDefaultAutomationStep();
        renderStepList();
        return;
      }
      syncEditorJson();
    });

    automationStepList?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const action = target.dataset.stepAction;
      const card = target.closest(".automation-step-card");
      const index = Number(card?.dataset.stepIndex);
      if (!action || Number.isNaN(index) || !editorState.steps[index]) {
        return;
      }
      if (action === "delete") {
        editorState.steps.splice(index, 1);
        renderStepList();
        return;
      }
      if (action === "move-up" && index > 0) {
        const [step] = editorState.steps.splice(index, 1);
        editorState.steps.splice(index - 1, 0, step);
        renderStepList();
        return;
      }
      if (action === "move-down" && index < editorState.steps.length - 1) {
        const [step] = editorState.steps.splice(index, 1);
        editorState.steps.splice(index + 1, 0, step);
        renderStepList();
      }
    });

    automationAddStep?.addEventListener("click", () => {
      editorState.steps.push(createDefaultAutomationStep());
      renderStepList();
    });

    automationQuickAdd?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const stepType = target.dataset.quickStep;
      if (!stepType) {
        return;
      }
      editorState.steps.push(normalizeAutomationStep({
        stepType,
        locatorType: stepType === "input" ? "placeholder" : "text",
        target: "",
        inputValue: "",
        remark: ""
      }) || createDefaultAutomationStep());
      renderStepList();
    });

    automationApplyTemplate?.addEventListener("click", () => {
      const template = AUTOMATION_STEP_TEMPLATES.find((itemTemplate) => itemTemplate.value === automationTemplateSelect.value);
      if (!template) {
        automationFeedback.textContent = "先选一个模板，再点“套用这个模板”。";
        automationFeedback.className = "inline-feedback warn";
        return;
      }
      editorState.steps = template.steps.map((step) => normalizeAutomationStep(step)).filter(Boolean);
      renderStepList();
      automationFeedback.textContent = `已套用「${template.label}」模板。下一步只要把步骤里的文字改成你的页面内容，再点运行。`;
      automationFeedback.className = "inline-feedback ok";
    });

    automationJsonToggle?.addEventListener("click", () => {
      const isHidden = automationJsonPanel?.classList.contains("hidden-field");
      automationJsonPanel?.classList.toggle("hidden-field", !isHidden);
      automationJsonToggle.textContent = isHidden ? "收起 JSON" : "查看/编辑 JSON";
      node.querySelectorAll(".automation-advanced-field").forEach((field) => {
        const canShow = field.dataset.advancedVisible !== "false";
        field.classList.toggle("hidden-field", !isHidden || !canShow);
      });
      if (isHidden) {
        syncEditorJson();
      }
    });

    automationSteps.addEventListener("input", () => {
      try {
        editorState.steps = parseAutomationStepsJson(automationSteps.value);
        renderStepList();
      } catch (_error) {
        automationFeedback.textContent = "JSON 还没写完整，先继续编辑，保存时会再校验。";
        automationFeedback.className = "inline-feedback neutral";
      }
    });

    const traceMeta = node.querySelector(".case-trace-meta");
    if (traceMeta) {
      traceMeta.innerHTML = renderTraceMetaHtml(item, item.taskName || "未记录");
    }

    automationSave.addEventListener("click", async () => {
      const saved = saveCaseAutomationConfig(item, {
        enabled: automationEnabled.checked,
        targetPath: automationTargetPath.value,
        stepsText: automationSteps.value
      });
      if (!saved) {
        automationFeedback.textContent = getCaseAutomationFeedbackText(item);
        automationFeedback.className = `inline-feedback ${getCaseAutomationFeedbackTone(item)}`;
        renderAutomationCases();
        return;
      }
      flashButtonSuccess(automationSave, "保存成功");
      automationFeedback.textContent = "自动化配置已保存。";
      automationFeedback.className = "inline-feedback ok";
      setAutomationCaseStatus(`已保存「${item.title || "未命名用例"}」自动化配置。`, "ok");
      renderAutomationCases();
    });

    automationRun.addEventListener("click", async () => {
      syncEditorJson();
      const saved = saveCaseAutomationConfig(item, {
        enabled: automationEnabled.checked,
        targetPath: automationTargetPath.value,
        stepsText: automationSteps.value
      });
      if (!saved) {
        automationFeedback.textContent = getCaseAutomationFeedbackText(item);
        automationFeedback.className = `inline-feedback ${getCaseAutomationFeedbackTone(item)}`;
        renderAutomationCases();
        return;
      }

      automationFeedback.textContent = "正在执行自动化...";
      automationFeedback.className = "inline-feedback neutral";
      automationRun.disabled = true;

      try {
        const result = await runCaseAutomation(item);
        syncAutomationStatusChip(automationStatus, result.status || "");
        automationFeedback.textContent = result.summary || getCaseAutomationFeedbackText(item);
        automationFeedback.className = `inline-feedback ${getCaseAutomationFeedbackTone(item)}`;
        setAutomationCaseStatus(`已完成「${item.title || "未命名用例"}」自动化执行。`, result.status === "通过" ? "ok" : "warn");
        renderQuickStats();
        renderReport();
        renderCases();
        renderAutomationCases();
      } finally {
        automationRun.disabled = false;
      }
    });

    const toggleButton = node.querySelector(".toggle-case-detail");
    if (toggleButton) {
      toggleButton.textContent = isEditorOpen ? "收起配置" : "配置用例";
    }
    bindCaseCard(node, item.id, { singleAutomationEditor: true });
    els.automationCaseList.appendChild(node);
  });
}

function renderAutomationAssetSummary(filteredCases) {
  if (!els.automationAssetSummary) {
    return;
  }

  const configuredCount = state.cases.filter((item) => item.automationEnabled).length;
  const passedCount = state.cases.filter((item) => item.automationLastRun?.status === "通过").length;
  const attentionCount = state.cases.filter((item) => item.automationLastRun?.status === "失败").length;
  const items = [
    ["当前结果", filteredCases.length, `共 ${state.cases.length} 条`],
    ["已配置", configuredCount, "已完成单条配置"],
    ["最近通过", passedCount, "最近一次运行"],
    ["需要处理", attentionCount, "运行失败"]
  ];

  els.automationAssetSummary.innerHTML = items.map(([label, value, note], index) => `
    <article class="automation-asset-stat${index === 3 && Number(value) > 0 ? " needs-attention" : ""}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      <small>${escapeHtml(note)}</small>
    </article>
  `).join("");
}

function bindCaseCard(node, caseId, options = {}) {
  const detail = node.querySelector(".case-detail");
  const toggle = node.querySelector(".toggle-case-detail");
  toggle.addEventListener("click", () => {
    if (options.singleAutomationEditor) {
      activeAutomationEditorCaseId = activeAutomationEditorCaseId === caseId ? "" : caseId;
      renderAutomationCases();
      return;
    }
    const isHidden = detail.classList.contains("hidden-field");
    detail.classList.toggle("hidden-field", !isHidden);
    toggle.textContent = isHidden ? "收起详情" : "展开详情";
  });

  node.querySelector(".delete-case").addEventListener("click", () => {
    state.cases = state.cases.filter((item) => item.id !== caseId);
    state.bugs = state.bugs.filter((item) => item.caseId !== caseId);
    persist();
    renderAll();
  });
}

function saveCaseAutomationConfig(item, payload) {
  const enabled = Boolean(payload.enabled);
  const targetPath = String(payload.targetPath || "").trim();
  const stepsText = String(payload.stepsText || "").trim();
  let parsedSteps = [];

  if (stepsText) {
    try {
      parsedSteps = parseAutomationStepsJson(stepsText);
    } catch (error) {
      item.automationLastRun = {
        status: "失败",
        summary: error.message || "自动化步骤不是合法 JSON，请先修正后再保存。",
        startedAt: "",
        finishedAt: new Date().toISOString()
      };
      persist();
      return false;
    }
  }

  item.automationEnabled = enabled;
  item.automationTargetPath = targetPath;
  item.automationSteps = parsedSteps.map((step) => normalizeAutomationStep(step)).filter(Boolean);
  Object.assign(item, applyUpdateAuditFields(item));
  persist();
  return true;
}

function ensureCaseEditFields(node) {
  const detailGrid = node.querySelector(".case-detail-grid");
  if (!detailGrid || detailGrid.querySelector(".case-title-input")) {
    return;
  }

  const preconditionsBlock = node.querySelector(".case-preconditions-full")?.closest(".detail-block");
  if (!preconditionsBlock) {
    return;
  }

  const titleBlock = document.createElement("div");
  titleBlock.className = "detail-block";
  titleBlock.innerHTML = `
    <label class="case-edit-field">
      <span class="summary-label">用例标题</span>
      <input class="case-title-input" type="text">
    </label>
  `;

  const typeBlock = document.createElement("div");
  typeBlock.className = "detail-block";
  typeBlock.innerHTML = `
    <label class="case-edit-field">
      <span class="summary-label">用例类型</span>
      <input class="case-type-input" type="text">
    </label>
  `;

  const priorityBlock = document.createElement("div");
  priorityBlock.className = "detail-block";
  priorityBlock.innerHTML = `
    <label class="case-edit-field">
      <span class="summary-label">优先级</span>
      <select class="case-priority-select">
        <option value="P0">P0</option>
        <option value="P1">P1</option>
        <option value="P2">P2</option>
        <option value="P3">P3</option>
      </select>
    </label>
  `;

  detailGrid.insertBefore(priorityBlock, preconditionsBlock);
  detailGrid.insertBefore(typeBlock, priorityBlock);
  detailGrid.insertBefore(titleBlock, typeBlock);

  const preconditionsField = node.querySelector(".case-preconditions-full");
  const stepsField = node.querySelector(".case-steps-full");
  const expectedField = node.querySelector(".case-expected-full");
  [preconditionsField, stepsField, expectedField].forEach((field, index) => {
    if (!field) {
      return;
    }
    const textarea = document.createElement("textarea");
    textarea.className = `${field.className} case-edit-textarea`;
    textarea.rows = index === 1 ? 6 : 4;
    textarea.value = field.textContent === "无" ? "" : field.textContent || "";
    field.replaceWith(textarea);
  });
}

function ensureCaseSequenceBadge(node) {
  const caseHead = node.querySelector(".case-card-head");
  if (!caseHead) {
    return null;
  }
  let badge = caseHead.querySelector(".case-sequence-badge");
  if (badge) {
    return badge;
  }
  badge = document.createElement("span");
  badge.className = "case-sequence-badge";
  const titleNode = caseHead.querySelector(".case-title-text");
  if (titleNode) {
    caseHead.insertBefore(badge, titleNode);
  } else {
    caseHead.appendChild(badge);
  }
  return badge;
}

async function runCaseAutomation(item) {
  if (!item.automationEnabled) {
    item.automationLastRun = {
      status: "未运行",
      summary: "请先启用这条用例的自动化执行。",
      startedAt: "",
      finishedAt: ""
    };
    persist();
    return item.automationLastRun;
  }

  if (!state.uiAutomationSettings?.baseUrl) {
    item.automationLastRun = {
      status: "失败",
      summary: "请先在页面上方填写站点地址。",
      startedAt: "",
      finishedAt: new Date().toISOString()
    };
    persist();
    return item.automationLastRun;
  }

  const response = await fetch("/api/ui-automation/run-case", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caseTitle: item.title,
      baseUrl: state.uiAutomationSettings.baseUrl,
      targetPath: item.automationTargetPath,
      steps: buildAutomationRuntimeSteps(item.automationSteps)
    })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "执行自动化失败");
  }

  const result = normalizeCaseAutomationLastRun(data.result) || {
    status: data.ok ? "通过" : "失败",
    summary: data.error || "自动化执行失败",
    startedAt: "",
    finishedAt: new Date().toISOString()
  };
  item.automationLastRun = result;
  updateCaseExecutionState(item, result.status === "通过" ? "通过" : "失败");
  item.executionNote = result.summary || item.executionNote || "";
  persist();
  setCaseActionStatus(`已完成「${item.title || "未命名用例"}」自动化执行。`, data.ok ? "ok" : "warn");
  return result;
}

function getCaseAutomationFeedbackText(item) {
  if (item.automationLastRun?.summary) {
    return item.automationLastRun.summary;
  }
  if (item.automationEnabled) {
    return "自动化配置已保存，可以在当前环境执行试运行。";
  }
  return "启用后，可保存目标路径、执行步骤和校验规则。";
}

function getCaseAutomationFeedbackTone(item) {
  const status = item.automationLastRun?.status || "";
  if (status === "通过") return "ok";
  if (status === "失败") return "warn";
  return "neutral";
}

function syncAutomationStatusChip(node, status) {
  if (!node) {
    return;
  }

  const normalizedStatus = status || "未运行";
  node.textContent = normalizedStatus;
  if (normalizedStatus === "通过") {
    node.className = "case-automation-status state-chip ok";
    return;
  }
  if (normalizedStatus === "失败") {
    node.className = "case-automation-status state-chip warn";
    return;
  }
  node.className = "case-automation-status state-chip neutral";
}

function truncateText(text, limit) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!value) {
    return "无";
  }
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}
