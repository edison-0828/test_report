// Report rendering, publishing, export, and notifications.

function renderReport() {
  const versionCards = getReportBatchCards();
  const searchText = String(els.reportVersionSearch?.value || "").trim().toLowerCase();
  const statusFilter = els.reportVersionStatusFilter?.value || "";
  const releaseFilter = els.reportReleaseFilter?.value || "";
  const filteredCards = versionCards.filter(({ batch, report }) => {
    const matchesSearch = !searchText || String(batch.version || "").toLowerCase().includes(searchText);
    const matchesStatus = !statusFilter || (batch.status || "进行中") === statusFilter;
    const matchesRelease = !releaseFilter || report.releaseDecision.label === releaseFilter;
    return matchesSearch && matchesStatus && matchesRelease;
  });
  const totalPages = Math.max(1, Math.ceil(filteredCards.length / REPORT_VERSIONS_PER_PAGE));
  reportVersionPage = Math.min(Math.max(1, reportVersionPage), totalPages);
  const pageStart = (reportVersionPage - 1) * REPORT_VERSIONS_PER_PAGE;
  const pageCards = filteredCards.slice(pageStart, pageStart + REPORT_VERSIONS_PER_PAGE);
  const requestedActiveBatchId = state.activeReportBatchId || versionCards[0]?.batch.id || "";
  const activeCard = pageCards.find((item) => item.batch.id === requestedActiveBatchId)
    || pageCards[0]
    || versionCards.find((item) => item.batch.id === requestedActiveBatchId)
    || versionCards[0];

  if (els.reportVersionCount) {
    els.reportVersionCount.textContent = filteredCards.length === versionCards.length
      ? `${versionCards.length} 个版本`
      : `显示 ${filteredCards.length} / ${versionCards.length}`;
  }
  if (els.reportVersionPagination) {
    els.reportVersionPagination.classList.toggle("hidden-field", filteredCards.length <= REPORT_VERSIONS_PER_PAGE);
    els.reportVersionPrev.disabled = reportVersionPage <= 1;
    els.reportVersionNext.disabled = reportVersionPage >= totalPages;
    els.reportVersionPageInfo.textContent = `第 ${reportVersionPage} / ${totalPages} 页`;
  }

  if (els.reportVersionCards) {
    els.reportVersionCards.innerHTML = filteredCards.length
      ? `
        <div class="report-table-wrap">
          <table class="report-version-table">
            <thead>
              <tr>
                <th>版本号</th>
                <th>版本状态</th>
                <th>用例总数</th>
                <th>执行进度</th>
                <th>通过率</th>
                <th>失败</th>
                <th>待跟进 BUG</th>
                <th>发布结论</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${pageCards.map(({ batch, report }) => {
                const isActive = batch.id === activeCard?.batch.id;
                return `
                  <tr class="${isActive ? "active" : ""}">
                    <td><strong class="report-version-name">${escapeHtml(batch.version || "未命名版本")}</strong></td>
                    <td><span class="badge subtle">${escapeHtml(batch.status || "进行中")}</span></td>
                    <td>${report.total}</td>
                    <td><strong>${report.executed}</strong><span class="report-table-muted"> / ${report.total} (${escapeHtml(report.executionRate)})</span></td>
                    <td><strong class="report-pass-rate">${escapeHtml(report.passRate)}</strong></td>
                    <td><span class="report-count ${report.statusCounts["失败"] ? "danger" : ""}">${report.statusCounts["失败"] || 0}</span></td>
                    <td><span class="report-count ${report.openBugs ? "warning" : ""}">${report.openBugs}</span></td>
                    <td><span class="badge ${report.releaseDecision.tone}">${escapeHtml(report.releaseDecision.label)}</span></td>
                    <td>
                      <button class="${isActive ? "ghost-button" : "primary-button"} report-view-button" type="button" data-report-batch-id="${batch.id}" ${isActive ? "disabled" : ""}>${isActive ? "当前查看" : "查看报告"}</button>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `
      : `
        <div class="empty-state empty-state-rich">
          <strong>${versionCards.length ? "没有匹配的版本报告" : "还没有可查看的版本报告"}</strong>
          <p>${versionCards.length ? "请调整搜索内容或筛选条件。" : "先在版本管理中创建版本并关联任务，这里就会自动生成版本报告。"}</p>
        </div>
      `;

    els.reportVersionCards.querySelectorAll("button[data-report-batch-id]").forEach((button) => {
      button.addEventListener("click", () => {
        state.activeReportBatchId = button.dataset.reportBatchId || "";
        persist();
        renderReport();
      });
    });
  }

  if (!activeCard) {
    els.reportDetailHeader.textContent = "当前版本详情";
    els.reportSummary.innerHTML = "";
    els.reportHighlights.innerHTML = "";
    return;
  }

  const report = activeCard.report;
  state.activeReportBatchId = activeCard.batch.id;
  els.reportDetailHeader.textContent = `${activeCard.batch.version || "未命名版本"} 详情`;
  const fixedSummary = [
    ["版本", report.batchVersion],
    ["任务数", String(report.versionTaskCount)],
    ["用例总数", String(report.total)],
    ["执行用例", String(report.executed)],
    ["成功用例", String(report.passed)],
    ["失败用例", String(report.statusCounts["失败"] || 0)],
    ["阻塞用例", String(report.statusCounts["阻塞"] || 0)],
    ["BUG总数", String(report.scope.bugs.length)],
    ["已修复BUG", String(report.bugStatusCounts["已修复"] || 0)],
    ["未修复BUG", String(report.openBugs)]
  ];

  const summaryRows = [];
  for (let index = 0; index < fixedSummary.length; index += 2) {
    summaryRows.push([fixedSummary[index], fixedSummary[index + 1] || ["", ""]]);
  }
  els.reportSummary.innerHTML = `
    <div class="report-table-wrap">
      <table class="report-detail-table">
        <tbody>
          ${summaryRows.map(([[leftLabel, leftValue], [rightLabel, rightValue]]) => `
            <tr>
              <th>${escapeHtml(leftLabel)}</th>
              <td>${escapeHtml(leftValue)}</td>
              <th>${escapeHtml(rightLabel)}</th>
              <td>${escapeHtml(rightValue)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  els.reportHighlights.innerHTML = `
    <section class="attention-section">
      <div class="attention-head">
        <h4>失败的用例</h4>
        <span class="badge tone-red">${report.topFailedCases.length}</span>
      </div>
      ${report.topFailedCases.length ? `
        <div class="report-table-wrap">
          <table class="report-issue-table">
            <thead><tr><th>用例标题</th><th>任务</th><th>业务</th><th>关联 BUG</th></tr></thead>
            <tbody>
              ${report.topFailedCases.map((item) => `
                <tr>
                  <td><strong>${escapeHtml(item.title)}</strong></td>
                  <td>${escapeHtml(item.taskName || "未分任务")}</td>
                  <td>${escapeHtml(item.module || "未标记")}</td>
                  <td><span class="report-count danger">${report.unresolvedBugs.filter((bug) => bug.caseId === item.id).length}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `
          <div class="empty-state empty-state-rich">
            <strong>当前没有失败用例</strong>
            <p>失败的测试用例会显示在这里。</p>
          </div>
      `}
    </section>
    <section class="attention-section">
      <div class="attention-head">
        <h4>未修复的BUG</h4>
        <span class="badge tone-orange">${report.topOpenBugs.length}</span>
      </div>
      ${report.topOpenBugs.length ? `
        <div class="report-table-wrap">
          <table class="report-issue-table report-bug-table">
            <thead><tr><th>BUG 标题</th><th>严重程度</th><th>当前状态</th><th>任务</th><th>来源</th></tr></thead>
            <tbody>
              ${report.topOpenBugs.map((item) => `
                <tr>
                  <td><strong>${escapeHtml(item.title)}</strong></td>
                  <td><span class="badge ${getBugSeverityTone(item.severity)}">${escapeHtml(item.severity || "未标记")}</span></td>
                  <td><span class="badge ${getBugStatusTone(item.status)}">${escapeHtml(item.status)}</span></td>
                  <td>${escapeHtml(item.taskName || "未分任务")}</td>
                  <td>${scopeHasFailedCaseBug(item) ? `<span class="badge tone-red">失败用例</span>` : `<span class="report-table-muted">手动创建</span>`}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `
          <div class="empty-state empty-state-rich">
            <strong>当前没有未修复BUG</strong>
            <p>新建、已提交、待处理的 BUG 会显示在这里。</p>
          </div>
      `}
    </section>
  `;
}

function buildReportViewModel(scope = getReportScope()) {
  const total = scope.cases.length;
  const resolvedBatchVersion = scope.batch?.version || scope.task?.batchVersion || scope.cases[0]?.batchVersion || "未选择";
  const resolvedBusinessName = scope.module?.name || scope.task?.moduleName || scope.batch?.moduleName || scope.cases[0]?.module || "未选择";
  const statusCounts = countBy(scope.cases, "executionStatus", ["未执行", "通过", "失败", "阻塞"]);
  const bugStatusCounts = countBy(scope.bugs, "status", ["新建", "已提交", "已修复", "已验证", "已关闭"]);
  bugStatusCounts["待回归"] = scope.bugs.filter((item) => item.status === "待回归").length;
  const bugSeverityCounts = countBy(scope.bugs, "severity", ["严重", "中", "低"]);
  const failedCases = scope.cases.filter((item) => item.executionStatus === "失败");
  const unresolvedBugs = scope.bugs.filter((item) => !["已修复", "已验证", "已关闭"].includes(item.status));
  const failedCaseBugCount = scope.bugs.filter((item) => {
    if (!item.caseId) {
      return false;
    }
    const linkedCase = scope.cases.find((caseItem) => caseItem.id === item.caseId);
    return linkedCase?.executionStatus === "失败";
  }).length;
  const passed = statusCounts["通过"] || 0;
  const executed = total - (statusCounts["未执行"] || 0);
  const executionRate = total ? `${Math.round((executed / total) * 100)}%` : "0%";
  const passRate = executed ? `${Math.round((passed / executed) * 100)}%` : "0%";
  const openBugs = scope.bugs.filter((bug) => !["已验证", "已关闭"].includes(bug.status)).length;
  const versionTaskCount = scope.tasks?.length || (scope.task ? 1 : 0);
  const releaseDecision = getReleaseDecision({
    failed: statusCounts["失败"] || 0,
    blocked: statusCounts["阻塞"] || 0,
    openBugs,
    severeBugCount: bugSeverityCounts["严重"] || 0
  });
  const scopeLabel = [
    resolvedBusinessName ? `业务：${resolvedBusinessName}` : "",
    resolvedBatchVersion && resolvedBatchVersion !== "未选择" ? `版本：${resolvedBatchVersion}` : "",
    scope.task ? `任务：${scope.task.name || ""}` : ""
  ].filter(Boolean).join(" / ") || "当前全部范围";

  return {
    scope,
    total,
    statusCounts,
    bugStatusCounts,
    bugSeverityCounts,
    passed,
    executed,
    executionRate,
    passRate,
    openBugs,
    scopeLabel,
    heroTitle: scope.task?.name || scope.batch?.version || "当前测试报告",
    batchVersion: resolvedBatchVersion,
    taskName: scope.task?.name || "未选择",
    generatedAt: new Date().toLocaleString("zh-CN"),
    documentInfoItems: [
      ["报告名称", "测试报告"],
      ["版本号", resolvedBatchVersion],
      ["测试任务", scope.task?.name || "未选择"],
      ["生成时间", new Date().toLocaleString("zh-CN")],
      ["报告范围", scopeLabel],
      ["当前结论", releaseDecision.label]
    ],
    scopeSummaryItems: [
      ["测试业务", resolvedBusinessName],
      ["来源类型", inferReportSourceType(scope)],
      ["测试内容", scope.task?.scope || scope.batch?.scope || "未填写"],
      ["测试对象", scope.task?.name || resolvedBatchVersion || "当前全部范围"]
    ],
    summaryItems: [
      ["当前范围", scopeLabel],
      ["测试任务数", versionTaskCount],
      ["测试用例总数", total],
      ["执行用例数", executed],
      ["成功用例数", passed],
      ["失败用例数", statusCounts["失败"] || 0],
      ["阻塞用例数", statusCounts["阻塞"] || 0],
      ["未执行用例数", statusCounts["未执行"] || 0],
      ["通过率", passRate],
      ["BUG 总数", scope.bugs.length],
      ["待跟进 BUG", openBugs],
      ["失败用例对应BUG数", failedCaseBugCount]
    ],
    releaseDecision,
    versionTaskCount,
    metricCards: [
      ["测试任务", versionTaskCount, "tone-gray"],
      ["用例总数", total, "tone-gray"],
      ["执行用例", executed, "tone-green"],
      ["成功用例", passed, "tone-green"],
      ["失败用例", statusCounts["失败"] || 0, "tone-red"],
      ["阻塞用例", statusCounts["阻塞"] || 0, "tone-orange"],
      ["BUG总数", scope.bugs.length, "tone-red"],
      ["失败用例BUG", failedCaseBugCount, "tone-orange"],
      ["执行率", executionRate, "tone-gray"],
      ["通过率", passRate, "tone-green"]
    ],
    executionBars: [
      ["通过", statusCounts["通过"] || 0, getExecutionStatusTone("通过")],
      ["失败", statusCounts["失败"] || 0, getExecutionStatusTone("失败")],
      ["阻塞", statusCounts["阻塞"] || 0, getExecutionStatusTone("阻塞")],
      ["未执行", statusCounts["未执行"] || 0, getExecutionStatusTone("未执行")]
    ],
    bugStatusBars: [
      ["新建", bugStatusCounts["新建"] || 0, getBugStatusTone("新建")],
      ["已提交", bugStatusCounts["已提交"] || 0, getBugStatusTone("已提交")],
      ["已修复", bugStatusCounts["已修复"] || 0, getBugStatusTone("已修复")],
      ["待回归", bugStatusCounts["待回归"] || 0, getBugStatusTone("待回归")],
      ["已验证", bugStatusCounts["已验证"] || 0, getBugStatusTone("已验证")],
      ["已关闭", bugStatusCounts["已关闭"] || 0, getBugStatusTone("已关闭")]
    ],
    bugSeverityBars: [
      ["严重", bugSeverityCounts["严重"] || 0, getBugSeverityTone("严重")],
      ["中", bugSeverityCounts["中"] || 0, getBugSeverityTone("中")],
      ["低", bugSeverityCounts["低"] || 0, getBugSeverityTone("低")]
    ],
    conclusionAdviceItems: buildConclusionAdviceItems({
      releaseDecision,
      failedCount: statusCounts["失败"] || 0,
      blockedCount: statusCounts["阻塞"] || 0,
      openBugs,
      severeBugCount: bugSeverityCounts["严重"] || 0,
      unexecutedCount: statusCounts["未执行"] || 0
    }),
    blockedSummary: buildBlockedSummary(scope.cases),
    failedCaseBugCount,
    failedCases,
    unresolvedBugs,
    topFailedCases: failedCases.slice(0, 5),
    topOpenBugs: unresolvedBugs.slice(0, 5)
  };
}

function buildBlockedSummary(cases) {
  const blockedCases = cases.filter((item) => item.executionStatus === "阻塞");
  if (!blockedCases.length) {
    return "当前没有阻塞用例。";
  }
  return blockedCases
    .slice(0, 5)
    .map((item, index) => `${index + 1}. ${item.title}${item.executionNote ? `：${item.executionNote}` : ""}`)
    .join("\n");
}

function scopeHasFailedCaseBug(bug) {
  if (!bug?.caseId) {
    return false;
  }
  const linkedCase = state.cases.find((item) => item.id === bug.caseId);
  return linkedCase?.executionStatus === "失败";
}

function buildConclusionAdviceItems(data) {
  const advice = [
    ["当前判断", data.releaseDecision.label],
    ["建议动作", data.releaseDecision.label === "可发布" ? "可以进入发布确认，保留最终抽查记录。" : "建议修复问题后补充回归，再更新本报告。"]
  ];

  if (data.failedCount > 0) {
    advice.push(["失败用例", `当前存在 ${data.failedCount} 条失败用例，建议优先确认主流程影响范围。`]);
  }
  if (data.blockedCount > 0) {
    advice.push(["阻塞项", `当前存在 ${data.blockedCount} 条阻塞用例，需要补齐环境、数据或依赖条件。`]);
  }
  if (data.openBugs > 0) {
    advice.push(["待跟进BUG", `当前仍有 ${data.openBugs} 个待跟进 BUG，建议明确修复人与回归时间。`]);
  }
  if (data.severeBugCount > 0) {
    advice.push(["严重问题", `存在 ${data.severeBugCount} 个严重 BUG，建议作为上线前必清项。`]);
  }
  if (data.unexecutedCount > 0) {
    advice.push(["未执行用例", `仍有 ${data.unexecutedCount} 条用例未执行，建议补齐后再做最终结论。`]);
  }

  if (advice.length === 2) {
    advice.push(["补充说明", "当前范围内执行结果比较稳定，可以保留这份报告作为版本验收记录。"]);
  }

  return advice;
}

function getReleaseDecision(data) {
  if (data.severeBugCount > 0 || data.failed > 0) {
    return { label: "有风险", desc: "存在失败用例或严重 BUG，建议修复后再回归。", tone: "tone-red" };
  }
  if (data.blocked > 0 || data.openBugs > 0) {
    return { label: "需关注", desc: "当前还有阻塞项或待跟进 BUG，上线前建议继续确认。", tone: "tone-orange" };
  }
  return { label: "可发布", desc: "当前执行结果稳定，未发现明显发布阻塞。", tone: "tone-green" };
}

function inferReportSourceType(scope) {
  const sourceTypes = [...new Set(
    state.documents
      .filter((item) => {
        const sameTask = !scope.task || item.taskId === scope.task.id;
        return sameTask;
      })
      .map((item) => item.type)
      .filter(Boolean)
  )];

  if (!sourceTypes.length) {
    if (state.lastGeneration?.type === "api") {
      return "API内容";
    }
    if (state.lastGeneration?.type === "requirement") {
      return "需求内容";
    }
    return "需求内容 / API内容";
  }
  return sourceTypes.map((item) => (item === "api" ? "API内容" : "需求内容")).join(" / ");
}

function renderReportBars(container, items) {
  if (!container) {
    return;
  }
  const maxValue = Math.max(...items.map((item) => item[1]), 1);
  container.innerHTML = items.map(([label, value, tone]) => `
    <div class="bar-item">
      <div class="bar-head">
        <span>${escapeHtml(label)}</span>
        <strong>${value}</strong>
      </div>
      <div class="bar-track">
        <div class="bar-fill ${tone}" style="width:${Math.max((value / maxValue) * 100, value ? 8 : 0)}%"></div>
      </div>
    </div>
  `).join("");
}

function openReportExportPreview() {
  const report = buildReportViewModel(getReportScopeByBatch(state.activeReportBatchId));
  const warnings = buildReportExportChecks(report);
  const hasReportData = Boolean(report.scope.batch && !isSystemWorkspaceBatch(report.scope.batch));
  const conclusion = getReportConclusionForBatch(state.activeReportBatchId);

  els.reportExportPreview.innerHTML = `
    <div class="report-export-scope">
      <div>
        <span>当前导出范围</span>
        <strong>${escapeHtml(report.batchVersion || "未选择版本")}</strong>
        <p>${escapeHtml(report.scopeLabel)}</p>
      </div>
      <span class="badge ${report.releaseDecision.tone}">${escapeHtml(report.releaseDecision.label)}</span>
    </div>
    <div class="report-export-metrics">
      <div><span>用例总数</span><strong>${report.total}</strong></div>
      <div><span>执行进度</span><strong>${escapeHtml(report.executionRate)}</strong></div>
      <div><span>通过率</span><strong>${escapeHtml(report.passRate)}</strong></div>
      <div class="${report.statusCounts["失败"] ? "has-risk" : ""}"><span>失败用例</span><strong>${report.statusCounts["失败"] || 0}</strong></div>
      <div class="${report.openBugs ? "has-warning" : ""}"><span>待跟进 BUG</span><strong>${report.openBugs}</strong></div>
    </div>
    <section class="report-export-checks ${warnings.length ? "has-warnings" : "is-ready"}">
      <strong>${warnings.length ? "导出前请确认" : "报告可以导出"}</strong>
      ${warnings.length
        ? `<ul>${warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
        : "<p>当前没有未执行、失败或未关闭 BUG 的风险提醒。</p>"}
    </section>
    <section class="report-export-conclusion">
      <span>补充结论</span>
      <p>${escapeHtml(conclusion || "尚未填写补充结论，可返回报告详情继续完善。")}</p>
    </section>
    ${hasReportData ? "" : "<p class=\"inline-feedback warn\">当前没有可导出的版本、用例或 BUG 数据。</p>"}
  `;
  els.confirmReportExport.disabled = !hasReportData;
  els.publishWebReport.disabled = !hasReportData;
  els.publishedReportResult.classList.add("hidden-field");
  els.publishedReportResult.innerHTML = "";
  els.reportExportModal.classList.remove("hidden-field");
  document.body.classList.add("dialog-open");
  window.setTimeout(() => (hasReportData ? els.confirmReportExport : els.cancelReportExport)?.focus(), 0);
}

function closeReportExportPreview() {
  els.reportExportModal?.classList.add("hidden-field");
  document.body.classList.remove("dialog-open");
}

async function publishCurrentReport() {
  const report = buildReportViewModel(getReportScopeByBatch(state.activeReportBatchId));
  const reportConclusion = getReportConclusionForBatch(state.activeReportBatchId);
  const title = report.batchVersion && report.batchVersion !== "未选择"
    ? `${report.batchVersion} 测试报告`
    : "测试报告";

  const hasPublishedVersion = publishedReports.some((item) => item.version === report.batchVersion);
  if (hasPublishedVersion && !window.confirm(`版本“${report.batchVersion}”已经发布过报告，确认发布新的快照吗？`)) {
    return;
  }

  els.publishWebReport.disabled = true;
  els.publishWebReport.setAttribute("aria-busy", "true");
  els.publishWebReport.textContent = "正在发布…";
  try {
    const response = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, report, reportConclusion })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "发布失败");

    const reportUrl = new URL(result.url, window.location.origin).href;
    els.publishedReportResult.classList.remove("hidden-field", "warn");
    els.publishedReportResult.innerHTML = `
      <div>
        <strong>网页版报告已发布</strong>
        <span>这是只读快照，可将下面的内网地址发送给同事。</span>
      </div>
      <div class="published-report-link">
        <input type="text" value="${escapeHtml(reportUrl)}" readonly aria-label="网页版报告地址">
        <button class="ghost-button" type="button" data-copy-published-report>复制链接</button>
        <a class="primary-button" href="${escapeHtml(reportUrl)}" target="_blank" rel="noopener">打开报告</a>
      </div>
    `;
    await loadPublishedReports();
    showToast("网页版报告已发布，可以复制链接分享。", "success");
  } catch (error) {
    els.publishedReportResult.classList.remove("hidden-field");
    els.publishedReportResult.classList.add("warn");
    els.publishedReportResult.innerHTML = `<strong>发布失败</strong><span>${escapeHtml(error.message || "请稍后重试。")}</span>`;
  } finally {
    els.publishWebReport.disabled = false;
    els.publishWebReport.removeAttribute("aria-busy");
    els.publishWebReport.textContent = "发布网页版";
  }
}

async function handlePublishedReportAction(event) {
  const copyButton = event.target.closest("[data-copy-published-report]");
  if (!copyButton) return;
  const input = els.publishedReportResult.querySelector("input");
  if (!input) return;
  try {
    await navigator.clipboard.writeText(input.value);
    copyButton.textContent = "已复制";
    showToast("报告链接已复制。", "success");
    window.setTimeout(() => { copyButton.textContent = "复制链接"; }, 1600);
  } catch (_error) {
    input.select();
    document.execCommand("copy");
    copyButton.textContent = "已复制";
    showToast("报告链接已复制。", "success");
  }
}

async function loadPublishedReports() {
  if (!els.publishedReportList) return;
  try {
    const response = await fetch("/api/reports");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "读取发布记录失败");
    publishedReports = Array.isArray(result.reports) ? result.reports : [];
    renderPublishedReports();
  } catch (_error) {
    els.publishedReportList.innerHTML = '<p class="empty-state">暂时无法读取已发布报告。</p>';
  }
}

function renderPublishedReports() {
  if (!els.publishedReportList) return;
  const visibleReports = publishedReports.filter((item) => item.version !== DEFAULT_WORKSPACE_VERSION);
  const searchText = String(els.publishedReportSearch?.value || "").trim().toLowerCase();
  const filteredReports = visibleReports.filter((item) => !searchText || [item.title, item.version]
    .some((value) => String(value || "").toLowerCase().includes(searchText)));
  const latestReportIds = new Set();
  const latestVersions = new Set();
  visibleReports.forEach((item) => {
    if (!latestVersions.has(item.version)) {
      latestVersions.add(item.version);
      latestReportIds.add(item.id);
    }
  });
  els.publishedReportCount.textContent = searchText
    ? `显示 ${filteredReports.length} / ${visibleReports.length}`
    : `${visibleReports.length} 份报告`;
  if (!filteredReports.length) {
    els.publishedReportList.innerHTML = `
      <div class="empty-state published-report-empty">
        <strong>${visibleReports.length ? "没有匹配的发布记录" : "还没有发布网页版报告"}</strong>
        <span>${visibleReports.length ? "请调整搜索内容。" : "选择版本并点击“发布网页版”，这里会保存可访问的内网链接。"}</span>
      </div>
    `;
    return;
  }

  els.publishedReportList.innerHTML = `
    <div class="table-scroll-shell">
      <table class="published-report-table">
        <thead><tr><th>报告名称</th><th>版本</th><th>用例数</th><th>发布结论</th><th>发布时间</th><th>操作</th></tr></thead>
        <tbody>${filteredReports.map((item) => `
          <tr>
            <td><strong>${escapeHtml(item.title || "测试报告")}${latestReportIds.has(item.id) ? '<span class="latest-report-chip">最新</span>' : ""}</strong><small>${escapeHtml(item.id)}</small></td>
            <td>${escapeHtml(item.version || "未选择")}</td>
            <td>${resolvePublishedReportTotal(item)}</td>
            <td><span class="badge ${escapeHtml(item.decisionTone || "warn")}">${escapeHtml(item.decision || "待评估")}</span></td>
            <td>${escapeHtml(formatPublishedReportTime(item.publishedAt))}</td>
            <td><div class="published-report-actions">
              <a class="ghost-button" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">打开</a>
              <button class="ghost-button" type="button" data-copy-report-id="${escapeHtml(item.id)}">复制链接</button>
              <button class="ghost-button danger-button" type="button" data-revoke-report-id="${escapeHtml(item.id)}">撤销</button>
            </div></td>
          </tr>
        `).join("")}</tbody>
      </table>
    </div>
  `;
}

async function handlePublishedReportListAction(event) {
  const copyButton = event.target.closest("[data-copy-report-id]");
  if (copyButton) {
    const item = publishedReports.find((report) => report.id === copyButton.dataset.copyReportId);
    if (!item) return;
    await copyTextWithFallback(new URL(item.url, window.location.origin).href);
    copyButton.textContent = "已复制";
    showToast("报告链接已复制。", "success");
    window.setTimeout(() => { copyButton.textContent = "复制链接"; }, 1600);
    return;
  }

  const revokeButton = event.target.closest("[data-revoke-report-id]");
  if (!revokeButton) return;
  const item = publishedReports.find((report) => report.id === revokeButton.dataset.revokeReportId);
  if (!item || !window.confirm(`确认撤销“${item.title}”？撤销后原链接将无法访问。`)) return;
  revokeButton.disabled = true;
  const response = await fetch(`/api/reports/${encodeURIComponent(item.id)}`, { method: "DELETE" });
  if (!response.ok) {
    revokeButton.disabled = false;
    showToast("撤销失败，请稍后重试。", "error");
    return;
  }
  await loadPublishedReports();
  showToast("报告已撤销，原链接不再可用。", "success");
}

async function copyTextWithFallback(value) {
  try {
    await navigator.clipboard.writeText(value);
  } catch (_error) {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

function formatPublishedReportTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("zh-CN", { hour12: false });
}

function resolvePublishedReportTotal(item) {
  const directTotal = Number(item?.total);
  if (Number.isFinite(directTotal) && directTotal > 0) {
    return directTotal;
  }
  const matchingBatch = state.batches.find((batch) => batch.version === item?.version);
  if (!matchingBatch) {
    return 0;
  }
  return buildReportViewModel(getReportScopeByBatch(matchingBatch.id)).total || 0;
}

function showToast(message, tone = "info") {
  if (!els.toastRegion) return;
  const options = arguments[2] || {};
  const { actionLabel = "", onAction = null, duration = 2600 } = options;
  const toast = document.createElement("div");
  toast.className = `app-toast ${tone}`;
  toast.innerHTML = `
    <span class="toast-dot"></span>
    <strong>${escapeHtml(message)}</strong>
    ${actionLabel && typeof onAction === "function" ? `<button class="toast-action" type="button">${escapeHtml(actionLabel)}</button>` : ""}
  `;
  els.toastRegion.appendChild(toast);
  toast.querySelector(".toast-action")?.addEventListener("click", () => {
    onAction();
    toast.remove();
  });
  window.setTimeout(() => toast.classList.add("is-visible"), 10);
  window.setTimeout(() => {
    toast.classList.remove("is-visible");
    window.setTimeout(() => toast.remove(), 220);
  }, duration);
}

async function exportReport({ skipChecks = false } = {}) {
  const report = buildReportViewModel(getReportScopeByBatch(state.activeReportBatchId));
  const reportConclusion = getReportConclusionForBatch(state.activeReportBatchId);
  const fileBaseName = buildReportDocxFileBaseName(report);
  const exportChecks = buildReportExportChecks(report);

  if (!skipChecks && exportChecks.length) {
    const confirmed = window.confirm([
      "导出前提醒：",
      ...exportChecks.map((item, index) => `${index + 1}. ${item}`),
      "",
      "确认继续导出吗？"
    ].join("\n"));
    if (!confirmed) {
      return false;
    }
  }

  try {
    const response = await fetch("/api/export-report-docx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        report,
        reportConclusion,
        fileBaseName
      })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "导出失败");
    }

    const blob = await response.blob();
    downloadBlob(`${fileBaseName}.docx`, blob);
    return true;
  } catch (error) {
    alert(`报告导出失败：${error.message}`);
    return false;
  }
}

function buildReportDocxFileBaseName(report) {
  const version = report?.scope?.batch?.version || report?.batchVersion || "no-version";
  return `${sanitizeFileName(version)}-report`;
}

function buildReportExportChecks(report) {
  const warnings = [];
  if ((report.statusCounts["未执行"] || 0) > 0) {
    warnings.push(`当前还有 ${report.statusCounts["未执行"]} 条用例未执行。`);
  }
  if ((report.statusCounts["失败"] || 0) > 0) {
    warnings.push(`当前还有 ${report.statusCounts["失败"]} 条失败用例。`);
  }
  if (report.openBugs > 0) {
    warnings.push(`当前还有 ${report.openBugs} 个未关闭 BUG。`);
  }
  return warnings;
}

function buildReportHtml(report) {
  const conclusion = getReportConclusionForBatch(report.scope.batch?.id) || "暂无补充结论。";
  const renderDocumentInfoTable = report.documentInfoItems.map(([label, value]) => `
    <tr>
      <th>${escapeHtml(label)}</th>
      <td>${escapeHtml(value)}</td>
    </tr>
  `).join("");

  const renderScopeSummaryTable = report.scopeSummaryItems.map(([label, value]) => `
    <tr>
      <th>${escapeHtml(label)}</th>
      <td>${escapeHtml(value)}</td>
    </tr>
  `).join("");

  const renderExecutionTable = [
    ["测试用例总数", report.total],
    ["执行用例数", report.executed],
    ["成功用例数", report.passed],
    ["失败用例数", report.statusCounts["失败"] || 0],
    ["阻塞用例数", report.statusCounts["阻塞"] || 0],
    ["未执行用例数", report.statusCounts["未执行"] || 0],
    ["通过率", report.passRate]
  ].map(([label, value]) => `
    <tr>
      <th>${escapeHtml(label)}</th>
      <td>${escapeHtml(String(value))}</td>
    </tr>
  `).join("");

  const renderDefectTable = [
    ["BUG总数", report.scope.bugs.length],
    ["待跟进BUG", report.openBugs],
    ["新建", report.bugStatusCounts["新建"] || 0],
    ["已提交", report.bugStatusCounts["已提交"] || 0],
    ["已修复", report.bugStatusCounts["已修复"] || 0],
    ["已验证", report.bugStatusCounts["已验证"] || 0],
    ["已关闭", report.bugStatusCounts["已关闭"] || 0],
    ["严重", report.bugSeverityCounts["严重"] || 0],
    ["中", report.bugSeverityCounts["中"] || 0],
    ["低", report.bugSeverityCounts["低"] || 0]
  ].map(([label, value]) => `
    <tr>
      <th>${escapeHtml(label)}</th>
      <td>${escapeHtml(String(value))}</td>
    </tr>
  `).join("");

  const renderRiskTable = `
    <tr>
      <th>发布建议</th>
      <td><span class="badge ${report.releaseDecision.tone}">${escapeHtml(report.releaseDecision.label)}</span></td>
    </tr>
    <tr>
      <th>结论说明</th>
      <td>${escapeHtml(report.releaseDecision.desc)}</td>
    </tr>
    <tr>
      <th>补充结论</th>
      <td class="multiline-cell">${escapeHtml(conclusion)}</td>
    </tr>
  `;

  const renderConclusionAdviceTable = report.conclusionAdviceItems.map(([label, value]) => `
    <tr>
      <th>${escapeHtml(label)}</th>
      <td class="multiline-cell">${escapeHtml(value)}</td>
    </tr>
  `).join("");

  const renderFailedCases = report.failedCases.length
    ? report.failedCases.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(item.taskName || "未分任务")}</td>
        <td>${escapeHtml(item.batchVersion || report.batchVersion)}</td>
        <td>${escapeHtml(item.module || "未标记")}</td>
        <td><span class="badge tone-red">失败</span></td>
      </tr>
    `).join("")
    : `
      <tr>
        <td colspan="6" class="empty-cell">当前没有失败用例</td>
      </tr>
    `;

  const renderOpenBugs = report.unresolvedBugs.length
    ? report.unresolvedBugs.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(item.title)}</td>
        <td><span class="badge ${getBugStatusTone(item.status)}">${escapeHtml(item.status)}</span></td>
        <td><span class="badge ${getBugSeverityTone(item.severity)}">${escapeHtml(item.severity || "未标记")}</span></td>
        <td>${escapeHtml(item.taskName || "未分任务")}</td>
        <td class="multiline-cell">${escapeHtml(item.link || "未填写")}</td>
        <td class="multiline-cell">${escapeHtml(item.note || "暂无补充说明")}</td>
      </tr>
    `).join("")
    : `
      <tr>
        <td colspan="7" class="empty-cell">当前没有未修复BUG</td>
      </tr>
    `;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(report.heroTitle)} - 测试报告</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f3f6fb; --panel: #ffffff; --border: #d8e0eb; --text: #1c2430; --muted: #5f6b7a;
      --success: #16794a; --danger: #cc3d3d; --warning: #c78210; --shadow: 0 10px 30px rgba(21,34,50,.08);
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Segoe UI","PingFang SC","Microsoft YaHei",sans-serif; background: var(--bg); color: var(--text); }
    .page { max-width: 1360px; margin: 0 auto; padding: 28px; display: grid; gap: 18px; }
    .hero, .health, .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; box-shadow: var(--shadow); }
    .hero-wrap { display: grid; grid-template-columns: 1.3fr .7fr; gap: 18px; }
    .hero, .health, .panel { padding: 20px; }
    h1, h2, h3, p { margin: 0; }
    .eyebrow, .meta-item span, .metric-card span, .summary-label { display: block; font-size: 12px; color: var(--muted); }
    .hero h1 { font-size: 30px; margin-top: 8px; }
    .hero p { margin-top: 10px; color: var(--muted); line-height: 1.7; }
    .meta-grid, .metrics, .grid-2 { display: grid; gap: 14px; }
    .meta-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 18px; }
    .meta-item { border: 1px solid #eef2f7; border-radius: 8px; background: #fafcff; padding: 12px; }
    .meta-item strong { display: block; margin-top: 6px; }
    .pill { display: inline-flex; min-height: 36px; align-items: center; padding: 0 14px; border-radius: 999px; font-weight: 600; margin: 10px 0 12px; }
    .pill.tone-green, .bar-fill.tone-green, .metric-accent.tone-green { background: #eaf8ef; color: var(--success); }
    .pill.tone-red, .bar-fill.tone-red, .metric-accent.tone-red { background: #fff0f0; color: var(--danger); }
    .pill.tone-orange, .bar-fill.tone-orange, .metric-accent.tone-orange { background: #fff5e8; color: var(--warning); }
    .grid-2 { grid-template-columns: 1fr 1fr; }
    .section-stack { display: grid; gap: 18px; }
    .panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
    .summary-table, .detail-table { width: 100%; border-collapse: collapse; margin-top: 14px; overflow: hidden; border-radius: 8px; border: 1px solid #eef2f7; }
    .summary-table th, .summary-table td, .detail-table th, .detail-table td { padding: 14px; border-bottom: 1px solid #eef2f7; text-align: left; vertical-align: top; }
    .summary-table th { width: 180px; background: #fafcff; color: var(--muted); font-weight: 600; }
    .summary-table tr:last-child th, .summary-table tr:last-child td, .detail-table tr:last-child th, .detail-table tr:last-child td { border-bottom: 0; }
    .summary-table td, .detail-table td { background: #fff; }
    .detail-table thead th { background: #fafcff; color: var(--muted); font-weight: 600; white-space: nowrap; }
    .badge { display: inline-flex; min-height: 28px; align-items: center; padding: 0 10px; border-radius: 999px; font-size: 13px; }
    .badge.tone-red { background: #fff0f0; color: var(--danger); }
    .badge.tone-orange { background: #fff5e8; color: var(--warning); }
    .badge.tone-green { background: #eaf8ef; color: var(--success); }
    .badge.tone-gray { background: #f2f5f9; color: var(--muted); }
    .health p { margin-top: 8px; color: var(--muted); line-height: 1.7; }
    .text-area-like, .multiline-cell { white-space: pre-wrap; line-height: 1.8; color: var(--text); word-break: break-word; }
    .empty-cell { text-align: center; color: var(--muted); padding: 22px 14px; }
    @page { size: A4; margin: 14mm; }
    @media print {
      body { background: #fff; }
      .page { max-width: none; padding: 0; gap: 12px; }
      .hero, .health, .panel { box-shadow: none; break-inside: avoid; }
    }
    @media (max-width: 1180px) { .hero-wrap, .grid-2 { grid-template-columns: 1fr; } }
    @media (max-width: 720px) { .page, .meta-grid { grid-template-columns: 1fr; padding: 18px; } }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero-wrap">
      <section class="hero">
        <span class="eyebrow">测试范围</span>
        <h1>${escapeHtml(report.heroTitle)}</h1>
        <p>${escapeHtml(report.scopeLabel)}</p>
        <div class="meta-grid">
          <div class="meta-item"><span>版本</span><strong>${escapeHtml(report.batchVersion)}</strong></div>
          <div class="meta-item"><span>任务</span><strong>${escapeHtml(report.taskName)}</strong></div>
          <div class="meta-item"><span>生成时间</span><strong>${escapeHtml(report.generatedAt)}</strong></div>
        </div>
      </section>
      <section class="health">
        <span class="summary-label">发布建议</span>
        <div class="pill ${report.releaseDecision.tone}">${escapeHtml(report.releaseDecision.label)}</div>
        <p>${escapeHtml(report.releaseDecision.desc)}</p>
      </section>
    </section>

    <section class="grid-2">
      <section class="panel">
        <h3>文档信息</h3>
        <table class="summary-table">
          <tbody>${renderDocumentInfoTable}</tbody>
        </table>
      </section>
      <section class="panel">
        <h3>测试范围摘要</h3>
        <table class="summary-table">
          <tbody>${renderScopeSummaryTable}</tbody>
        </table>
      </section>
    </section>

    <section class="grid-2">
      <section class="panel">
        <h3>用例执行统计</h3>
        <table class="summary-table">
          <tbody>${renderExecutionTable}</tbody>
        </table>
      </section>
      <section class="panel">
        <h3>缺陷统计</h3>
        <table class="summary-table">
          <tbody>${renderDefectTable}</tbody>
        </table>
      </section>
    </section>

    <section class="panel">
      <h3>风险与结论</h3>
      <table class="summary-table">
        <tbody>${renderRiskTable}</tbody>
      </table>
    </section>

    <section class="panel">
      <div class="panel-head">
        <h3>测试结论与建议</h3>
        <span class="badge ${report.releaseDecision.tone}">${escapeHtml(report.releaseDecision.label)}</span>
      </div>
      <table class="summary-table">
        <tbody>${renderConclusionAdviceTable}</tbody>
      </table>
    </section>

    <section class="panel">
      <div class="panel-head">
        <h3>重点关注</h3>
        <span class="badge tone-orange">${report.failedCases.length + report.unresolvedBugs.length}</span>
      </div>
      <div class="section-stack">
        <section>
          <div class="panel-head">
            <h3>失败的用例</h3>
            <span class="badge tone-red">${report.failedCases.length}</span>
          </div>
          <table class="detail-table">
            <thead>
              <tr>
                <th>序号</th>
                <th>用例标题</th>
                <th>任务</th>
                <th>版本</th>
                <th>业务</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>${renderFailedCases}</tbody>
          </table>
        </section>

        <section>
          <div class="panel-head">
            <h3>未修复的BUG</h3>
            <span class="badge tone-orange">${report.unresolvedBugs.length}</span>
          </div>
          <table class="detail-table">
            <thead>
              <tr>
                <th>序号</th>
                <th>BUG标题</th>
                <th>状态</th>
                <th>严重级别</th>
                <th>任务</th>
                <th>Lark链接</th>
                <th>详情</th>
              </tr>
            </thead>
            <tbody>${renderOpenBugs}</tbody>
          </table>
        </section>
      </div>
    </section>
  </main>
</body>
</html>`;
}

function printReportPdf(fileName, html) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  if (!frameWindow) {
    iframe.remove();
    alert("当前浏览器不支持直接导出 PDF。");
    return;
  }

  frameWindow.document.open();
  frameWindow.document.write(html);
  frameWindow.document.close();
  frameWindow.document.title = fileName.replace(/\.pdf$/i, "");

  const cleanup = () => {
    setTimeout(() => iframe.remove(), 1000);
  };

  iframe.onload = () => {
    setTimeout(() => {
      frameWindow.focus();
      frameWindow.print();
      cleanup();
    }, 300);
  };
}

function downloadFile(fileName, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(fileName, blob);
}

function downloadBlob(fileName, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function countBy(list, field, defaults) {
  const base = Object.fromEntries(defaults.map((item) => [item, 0]));
  list.forEach((entry) => {
    const key = entry[field] || "未定义";
    base[key] = (base[key] || 0) + 1;
  });
  return base;
}
