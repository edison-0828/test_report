// Demo data, state normalization, persistence, and conflict handling.

function seedDemoData() {
  state.teamMembers = ["测试A", "测试B", "后端A", "产品A"];
  state.batches = [{
    id: "batch-demo-va",
    name: "VA业务",
    version: "V2026.06.10",
    scope: "登录、下单、退款回归",
    moduleId: "business-VA业务",
    moduleName: "VA业务"
  }];
  state.modules = [{
    id: "business-VA业务",
    name: "VA业务"
  }, {
    id: "business-卡收单业务",
    name: "卡收单业务"
  }, {
    id: "business-数字货币业务",
    name: "数字货币业务"
  }, {
    id: "business-代付业务",
    name: "代付业务"
  }, {
    id: "business-本地收单业务",
    name: "本地收单业务"
  }];
  state.activeBatchId = "batch-demo-va";
  state.activeModuleId = "business-VA业务";
  state.tasks = [{
    id: "task-demo-login",
    batchId: "batch-demo-va",
    batchVersion: "V2026.06.10",
    batchName: getBatchLabelById("batch-demo-va"),
    moduleId: "business-VA业务",
    moduleName: "VA业务",
    name: "登录与下单回归",
    scope: "覆盖登录、下单、退款主流程与异常提示",
    owner: "测试B",
    status: "进行中"
  }];
  state.activeTaskId = "task-demo-login";
  state.generationBatchId = "batch-demo-va";

  state.documents = [{
    id: "doc-demo",
    name: "订单接口 OpenAPI",
    type: "api",
    content: JSON.stringify({
      openapi: "3.0.0",
      paths: {
        "/orders/create": {
          post: {
            summary: "创建订单",
            tags: ["订单"],
            parameters: [{ name: "token", required: true }],
            requestBody: { required: true },
            responses: { 200: {}, 400: {} }
          }
        }
      }
    }, null, 2),
    createdAt: new Date().toISOString()
  }];

  state.cases = generateCasesFromApi("订单接口 OpenAPI", state.documents[0].content).map((item) => ({
    ...item,
    taskId: state.activeTaskId,
    taskName: getTaskNameById(state.activeTaskId),
    batchId: state.activeBatchId,
    batchVersion: getBatchVersionById(state.activeBatchId),
    batchName: getBatchLabelById(state.activeBatchId),
    moduleId: state.activeModuleId,
    module: getModuleNameById(state.activeModuleId) || item.module
  }));

  if (state.cases[0]) {
    state.cases[0].executionStatus = "通过";
  }
  if (state.cases[1]) {
    state.cases[1].executionStatus = "失败";
    state.cases[1].executionNote = "缺参场景返回 500，需要开发修复。";
  }

  state.bugs = [{
    id: "bug-demo",
    title: "创建订单接口缺参时返回 500",
    caseId: state.cases[1] ? state.cases[1].id : "",
    taskId: state.activeTaskId,
    taskName: getTaskNameById(state.activeTaskId),
    batchId: state.activeBatchId,
    batchVersion: getBatchVersionById(state.activeBatchId),
    batchName: getBatchLabelById(state.activeBatchId),
    moduleId: state.activeModuleId,
    moduleName: getModuleNameById(state.activeModuleId),
    severity: "严重",
    status: "已提交",
    owner: "后端A",
    link: "",
    note: "应返回 4xx 参数校验错误。"
  }];

  state.lastGeneration = {
    name: "订单接口 OpenAPI",
    type: "api",
    count: state.cases.length,
    mode: "规则",
    createdAt: new Date().toLocaleString("zh-CN")
  };
  state.reportConclusion = "当前接口主流程可用，但异常参数校验存在阻塞问题，建议修复后回归。";
  state.reportConclusions = {
    "batch-demo-va": state.reportConclusion
  };
  state.activeReportBatchId = "batch-demo-va";

  persist();
  saveTeamMembersConfig();
  renderAll();
  setGenerationStatus("已导入演示数据。", "ok");
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return normalizeLoadedState({ ...defaultState(), ...parsed });
  } catch (_error) {
    return defaultState();
  }
}

function normalizeLoadedState(loadedState) {
  loadedState.settings = {
    apiKey: loadedState.settings?.apiKey || "",
    model: normalizeAiModel(loadedState.settings?.model),
    currentOperator: loadedState.settings?.currentOperator || ""
  };
  loadedState.selfTestSnapshot = normalizeSelfTestSnapshot(loadedState.selfTestSnapshot);
  loadedState.caseQualityBusiness = normalizeCaseQualityBusiness(loadedState.caseQualityBusiness);
  loadedState.caseQualityReports = normalizeCaseQualityReports(loadedState.caseQualityReports);
  const legacyQualityReport = normalizeCaseQualityReport(loadedState.caseQualityReport);
  if (legacyQualityReport && !loadedState.caseQualityReports[loadedState.caseQualityBusiness]) {
    loadedState.caseQualityReports[loadedState.caseQualityBusiness] = legacyQualityReport;
  }
  loadedState.caseQualityCasesByBusiness = normalizeCaseQualityCasesByBusiness(loadedState.caseQualityCasesByBusiness);
  loadedState.uiAutomationSettings = normalizeUiAutomationSettings(loadedState.uiAutomationSettings);
  loadedState.uiAutomationSession = normalizeUiAutomationSession(loadedState.uiAutomationSession);
  return loadedState;
}

function defaultState() {
  return {
    documents: [],
    cases: [],
    bugs: [],
    batches: [],
    tasks: [],
    modules: BUSINESS_OPTIONS.map((name) => ({
      id: slugifyBusiness(name),
      name
    })),
    activeBatchId: "",
    generationBatchId: "",
    activeTaskId: "",
    activeModuleId: "",
    activeReportBatchId: "",
    reportConclusion: "",
    reportConclusions: {},
    lastGeneration: null,
    settings: {
      apiKey: "",
      model: DEFAULT_AI_MODEL,
      currentOperator: ""
    },
    uiMode: "guide",
    selfTestSnapshot: {
      result: null,
      error: ""
    },
    caseQualityReports: {},
    caseQualityCasesByBusiness: {},
    caseQualityBusiness: "VA业务",
    uiAutomationSettings: {
      baseUrl: "",
      loginPath: ""
    },
    uiAutomationSession: {
      available: false,
      browserPath: "",
      active: false,
      authSaved: false,
      sessionStartedAt: "",
      baseUrl: "",
      loginPath: "",
      headless: true,
      lastError: ""
    }
  };
}

function normalizeSelfTestSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return {
      result: null,
      error: ""
    };
  }

  return {
    result: snapshot.result && typeof snapshot.result === "object" ? snapshot.result : null,
    error: typeof snapshot.error === "string" ? snapshot.error : ""
  };
}

function normalizeCaseQualityReport(report) {
  if (!report || typeof report !== "object") {
    return null;
  }

  return {
    label: typeof report.label === "string" ? report.label : "未检查",
    tone: typeof report.tone === "string" ? report.tone : "neutral",
    sourceLabel: typeof report.sourceLabel === "string" ? report.sourceLabel : "",
    fileName: typeof report.fileName === "string" ? report.fileName : "",
    checkedAt: typeof report.checkedAt === "string" ? report.checkedAt : "",
    ruleContext: report.ruleContext && typeof report.ruleContext === "object" ? report.ruleContext : null,
    quickTip: typeof report.quickTip === "string" ? report.quickTip : "",
    metrics: Array.isArray(report.metrics) ? report.metrics : [],
    issues: Array.isArray(report.issues) ? report.issues : []
  };
}

function normalizeCaseQualityReports(reports) {
  const normalized = {};
  if (!reports || typeof reports !== "object") {
    return normalized;
  }

  CASE_QUALITY_BUSINESSES.forEach((businessName) => {
    const report = normalizeCaseQualityReport(reports[businessName]);
    if (report) {
      normalized[businessName] = report;
    }
  });
  return normalized;
}

function normalizeCaseQualityCasesByBusiness(value) {
  const normalized = {};
  if (!value || typeof value !== "object") {
    return normalized;
  }

  CASE_QUALITY_BUSINESSES.forEach((businessName) => {
    normalized[businessName] = Array.isArray(value[businessName])
      ? value[businessName].map((item) => normalizeCaseItem(item))
      : [];
  });
  return normalized;
}

function persist() {
  const localState = Object.fromEntries(LOCAL_STATE_KEYS.map((key) => [key, structuredCloneSafe(state[key])]));
  if (localState.settings) {
    localState.settings = {
      apiKey: localState.settings.apiKey || "",
      model: normalizeAiModel(localState.settings.model),
      currentOperator: localState.settings.currentOperator || ""
    };
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(localState));
  scheduleSharedPersist();
}

function scheduleSharedPersist() {
  clearTimeout(persistSharedTimer);
  persistSharedTimer = setTimeout(() => {
    void persistSharedState();
  }, 150);
}

async function persistSharedState() {
  if (sharedPersistPaused) {
    showSharedStateConflict();
    return;
  }
  if (sharedPersistInFlight) {
    sharedPersistQueued = true;
    return;
  }

  sharedPersistInFlight = true;
  const baseRevision = sharedStateRevision;
  try {
    const response = await fetch("/api/app-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseRevision,
        state: buildSharedStatePayload()
      })
    });
    const data = await response.json();
    if (response.status === 409) {
      handleSharedStateConflict(data);
      return;
    }
    if (!response.ok) {
      throw new Error(data.error || "shared state save failed");
    }
    sharedStateRevision = normalizeSharedStateRevision(data.revision);
  } catch (_error) {
    // Keep local UI usable even if shared sync temporarily fails.
  } finally {
    sharedPersistInFlight = false;
    if (sharedPersistQueued && !sharedPersistPaused) {
      sharedPersistQueued = false;
      void persistSharedState();
    }
  }
}

function handleSharedStateConflict(conflict) {
  sharedPersistPaused = true;
  sharedPersistQueued = false;
  sharedStateConflict = {
    revision: normalizeSharedStateRevision(conflict?.revision),
    state: structuredCloneSafe(conflict?.state || {})
  };
  try {
    localStorage.setItem(SHARED_CONFLICT_BACKUP_KEY, JSON.stringify({
      detectedAt: nowIsoString(),
      baseRevision: sharedStateRevision,
      serverRevision: sharedStateConflict.revision,
      state: buildSharedStatePayload()
    }));
  } catch (_error) {
    // Conflict protection still works when browser storage is unavailable.
  }
  showSharedStateConflict();
}

function showSharedStateConflict() {
  const message = "检测到其他页面已保存更新，当前页面已暂停自动保存，未覆盖服务器数据。";
  setGenerationStatus(message, "warn");
  openSharedStateConflictDialog();
  showToast(message, "warn", {
    actionLabel: "处理冲突",
    onAction: openSharedStateConflictDialog,
    duration: 10000
  });
}

function resolveSharedStateConflict() {
  if (!sharedStateConflict) return;
  applySharedState(sharedStateConflict.state);
  sharedStateRevision = sharedStateConflict.revision;
  sharedStateConflict = null;
  sharedPersistPaused = false;
  sharedPersistQueued = false;
  ensureSeedMetadata();
  const localState = Object.fromEntries(LOCAL_STATE_KEYS.map((key) => [key, structuredCloneSafe(state[key])]));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(localState));
  renderAll();
  closeSharedStateConflictDialog();
  setGenerationStatus("已加载服务器最新数据；冲突前的本地内容已保存在浏览器备份中。", "ok");
}

function openSharedStateConflictDialog() {
  let dialog = document.getElementById("sharedStateConflictDialog");
  if (!dialog) {
    dialog = document.createElement("div");
    dialog.id = "sharedStateConflictDialog";
    dialog.className = "dialog-backdrop shared-conflict-dialog hidden-field";
    dialog.innerHTML = `
      <section class="dialog-card shared-conflict-card" role="dialog" aria-modal="true" aria-labelledby="sharedConflictTitle">
        <div class="dialog-head">
          <div>
            <span class="dialog-kicker">保存冲突</span>
            <h3 id="sharedConflictTitle">服务器上已有更新</h3>
          </div>
          <button class="dialog-close" type="button" data-close-shared-conflict aria-label="稍后处理">×</button>
        </div>
        <p class="shared-conflict-copy">当前页面的自动保存已暂停，服务器数据没有被覆盖。建议先下载本地副本，再加载服务器最新版。</p>
        <div class="shared-conflict-revisions"></div>
        <div class="dialog-actions">
          <button class="ghost-button" type="button" data-download-conflict-backup>下载本地副本</button>
          <button class="primary-button" type="button" data-resolve-shared-conflict>加载服务器最新版</button>
        </div>
      </section>
    `;
    document.body.appendChild(dialog);
    dialog.querySelector("[data-close-shared-conflict]")?.addEventListener("click", closeSharedStateConflictDialog);
    dialog.querySelector("[data-download-conflict-backup]")?.addEventListener("click", downloadSharedConflictBackup);
    dialog.querySelector("[data-resolve-shared-conflict]")?.addEventListener("click", resolveSharedStateConflict);
  }
  const revisions = dialog.querySelector(".shared-conflict-revisions");
  if (revisions) {
    revisions.innerHTML = `
      <div><span>当前页面版本</span><strong>${sharedStateRevision}</strong></div>
      <div><span>服务器版本</span><strong>${sharedStateConflict?.revision ?? "-"}</strong></div>
    `;
  }
  dialog.classList.remove("hidden-field");
  document.body.classList.add("dialog-open");
}

function closeSharedStateConflictDialog() {
  document.getElementById("sharedStateConflictDialog")?.classList.add("hidden-field");
  document.body.classList.remove("dialog-open");
}

function downloadSharedConflictBackup() {
  const raw = localStorage.getItem(SHARED_CONFLICT_BACKUP_KEY);
  if (!raw) {
    showToast("没有可下载的本地冲突副本", "warn");
    return;
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  downloadFile(`test-report-conflict-${timestamp}.json`, raw, "application/json;charset=utf-8");
}

function initDataBackupPanel(container) {
  if (!container || document.getElementById("dataBackupPanel")) return;
  const panel = document.createElement("section");
  panel.id = "dataBackupPanel";
  panel.className = "settings-data-panel";
  panel.innerHTML = `
    <div class="settings-data-head">
      <div>
        <span class="settings-drawer-kicker">数据安全</span>
        <h3>历史备份</h3>
      </div>
      <button class="ghost-button tiny-button" type="button" data-refresh-backups>刷新</button>
    </div>
    <p>系统会在覆盖共享数据前自动保留最近 20 个版本。恢复操作也会先备份当前版本。</p>
    <div class="inline-feedback" data-backup-status>打开设置时会自动读取备份。</div>
    <div class="settings-backup-list" data-backup-list></div>
  `;
  container.appendChild(panel);
  panel.querySelector("[data-refresh-backups]")?.addEventListener("click", loadAppStateBackups);
  panel.querySelector("[data-backup-list]")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-restore-backup]");
    if (button) void restoreAppStateBackup(button.dataset.restoreBackup);
  });
  void loadAppStateBackups();
}

async function loadAppStateBackups() {
  const panel = document.getElementById("dataBackupPanel");
  const status = panel?.querySelector("[data-backup-status]");
  const list = panel?.querySelector("[data-backup-list]");
  if (!panel || !status || !list) return;
  status.textContent = "正在读取备份...";
  status.className = "inline-feedback";
  try {
    const response = await fetch("/api/app-state/backups");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "backup list failed");
    const backups = Array.isArray(data.backups) ? data.backups : [];
    status.textContent = backups.length ? `共 ${backups.length} 个可恢复版本` : "暂时还没有历史备份";
    status.className = `inline-feedback ${backups.length ? "ok" : ""}`;
    list.innerHTML = backups.length ? backups.map((backup) => `
      <article class="settings-backup-item">
        <div>
          <strong>版本 ${escapeHtml(backup.revision)}</strong>
          <span>${escapeHtml(formatAuditTime(backup.createdAt))}</span>
          <small>任务 ${escapeHtml(backup.tasks)} · 用例 ${escapeHtml(backup.cases)} · BUG ${escapeHtml(backup.bugs)}</small>
        </div>
        <button class="ghost-button tiny-button" type="button" data-restore-backup="${escapeHtml(backup.id)}">恢复</button>
      </article>
    `).join("") : "";
  } catch (_error) {
    status.textContent = "备份列表读取失败，请稍后重试。";
    status.className = "inline-feedback error";
  }
}

async function restoreAppStateBackup(backupId) {
  if (!backupId || !window.confirm("确认恢复这个历史版本？系统会先备份当前数据。")) return;
  try {
    const response = await fetch("/api/app-state/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ backupId, baseRevision: sharedStateRevision })
    });
    const data = await response.json();
    if (response.status === 409) {
      handleSharedStateConflict(data);
      return;
    }
    if (!response.ok) throw new Error(data.error || "restore failed");
    applySharedState(data.state || {});
    sharedStateRevision = normalizeSharedStateRevision(data.revision);
    sharedPersistPaused = false;
    sharedStateConflict = null;
    renderAll();
    showToast("历史数据已恢复", "ok");
    await loadAppStateBackups();
  } catch (_error) {
    showToast("恢复失败，请刷新备份列表后重试", "warn");
  }
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
