const root = document.getElementById("reportRoot");
const loading = document.getElementById("reportLoading");
const printButton = document.getElementById("printReport");

printButton.addEventListener("click", () => window.print());
loadPublishedReport();

async function loadPublishedReport() {
  const reportId = location.pathname.split("/").filter(Boolean).pop() || "";
  if (!/^rpt-[a-z0-9-]+$/.test(reportId)) {
    return renderError("报告地址无效", "请检查链接是否完整，或联系报告发布人重新获取地址。");
  }

  try {
    const response = await fetch(`/api/reports/${encodeURIComponent(reportId)}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "报告加载失败");
    renderReport(payload);
  } catch (error) {
    renderError("暂时无法打开报告", error.message || "请稍后重试。");
  }
}

function renderReport(snapshot) {
  const report = snapshot.report || {};
  const cases = Array.isArray(report.scope?.cases) ? report.scope.cases : [];
  const bugs = Array.isArray(report.scope?.bugs) ? report.scope.bugs : [];
  const passValue = parsePercent(report.passRate);
  const executionValue = parsePercent(report.executionRate);
  document.title = `${report.batchVersion || snapshot.title || "测试报告"} - 测试报告`;

  root.innerHTML = `
    <section class="report-hero">
      <div class="hero-copy">
        <span class="eyebrow">QUALITY ASSURANCE REPORT</span>
        <h1>${escapeHtml(snapshot.title || "测试报告")}</h1>
      </div>
      <div class="hero-meta">
        <div><span>发布时间</span><strong>${escapeHtml(formatDate(snapshot.publishedAt))}</strong></div>
        <div><span>版本</span><strong>${escapeHtml(report.batchVersion || "未选择")}</strong></div>
        <div><span>发布建议</span><strong class="decision ${toneClass(report.releaseDecision?.tone)}">${escapeHtml(report.releaseDecision?.label || "待评估")}</strong></div>
      </div>
    </section>

    <nav class="report-tabs" aria-label="报告内容导航">
      <button class="is-active" type="button" data-report-tab="overview">报告概览</button>
      <button type="button" data-report-tab="execution">执行明细 <span>${cases.length}</span></button>
      <button type="button" data-report-tab="bugs">BUG 明细 <span>${bugs.length}</span></button>
    </nav>

    <section class="report-view is-active" data-report-view="overview">
      <section class="summary-card">
        <div class="summary-heading">
          <div><span class="section-kicker">核心指标</span><h2>本次测试结果</h2></div>
          <p>${escapeHtml(report.releaseDecision?.desc || "报告数据已按发布时状态固化。")}</p>
        </div>
        <div class="metric-grid">
          ${renderRingMetric("通过率", report.passRate || "0%", passValue, "teal")}
          ${renderRingMetric("执行进度", report.executionRate || "0%", executionValue, "blue")}
          ${renderNumberMetric("用例总数", report.total || 0, "本次纳入统计", "neutral")}
          ${renderNumberMetric("失败用例", report.statusCounts?.["失败"] || 0, "需要重点跟进", "danger")}
          ${renderNumberMetric("待跟进 BUG", report.openBugs || 0, "未验证或未关闭", "warning")}
        </div>
      </section>

      <section class="analysis-grid">
        <article class="chart-card">
          <div class="card-heading"><div><span class="section-kicker">用例执行</span><h2>状态分布</h2></div><strong>${escapeHtml(report.executionRate || "0%")}</strong></div>
          <div class="bar-chart">${renderBars(report.executionBars || [])}</div>
        </article>
        <article class="chart-card">
          <div class="card-heading"><div><span class="section-kicker">缺陷质量</span><h2>严重程度</h2></div><strong>${bugs.length}</strong></div>
          <div class="severity-layout">
            <div class="bug-donut" style="${buildBugDonutStyle(report.bugSeverityCounts || {}, bugs.length)}"><span><b>${bugs.length}</b>BUG</span></div>
            <div class="severity-legend">${renderSeverityLegend(report.bugSeverityCounts || {})}</div>
          </div>
        </article>
      </section>

      <section class="conclusion-card">
        <div><span class="section-kicker">测试结论</span><h2>${escapeHtml(report.releaseDecision?.label || "待评估")}</h2></div>
        <p>${escapeHtml(snapshot.reportConclusion || "尚未填写补充测试结论。")}</p>
        <div class="advice-list">${renderAdvice(report.conclusionAdviceItems || [])}</div>
      </section>

      <section class="preview-grid">
        ${renderPreviewTable("重点失败用例", report.topFailedCases || [], "case")}
        ${renderPreviewTable("待跟进 BUG", report.topOpenBugs || [], "bug")}
      </section>
    </section>

    <section class="report-view" data-report-view="execution">
      ${renderFullTable("执行明细", "展示发布报告时纳入统计的全部测试用例。", cases, "case")}
    </section>

    <section class="report-view" data-report-view="bugs">
      ${renderFullTable("BUG 明细", "展示发布报告时记录的全部缺陷与处理状态。", bugs, "bug")}
    </section>

    <footer class="report-footer">
      <span>QA Report · 内网只读报告</span>
      <span>报告 ID：${escapeHtml(snapshot.id || "-")}</span>
    </footer>
  `;

  bindTabs();
}

function bindTabs() {
  document.querySelectorAll("[data-report-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.reportTab;
      document.querySelectorAll("[data-report-tab]").forEach((item) => item.classList.toggle("is-active", item === button));
      document.querySelectorAll("[data-report-view]").forEach((view) => view.classList.toggle("is-active", view.dataset.reportView === target));
    });
  });
}

function renderRingMetric(label, value, percent, tone) {
  return `<div class="metric-card ring-card"><div class="metric-ring ${tone}" style="--value:${percent}"><span>${escapeHtml(value)}</span></div><strong>${escapeHtml(label)}</strong></div>`;
}

function renderNumberMetric(label, value, note, tone) {
  return `<div class="metric-card number-card ${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></div>`;
}

function renderBars(items) {
  const max = Math.max(1, ...items.map((item) => Number(item[1]) || 0));
  return items.map(([label, value]) => `<div class="bar-row"><div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div><div class="bar-track"><i class="status-${statusClass(label)}" style="width:${Math.max(4, (Number(value) / max) * 100)}%"></i></div></div>`).join("");
}

function renderSeverityLegend(counts) {
  return [["严重", "critical"], ["中", "medium"], ["低", "low"]].map(([label, tone]) => `<div><i class="${tone}"></i><span>${label}</span><strong>${Number(counts[label]) || 0}</strong></div>`).join("");
}

function buildBugDonutStyle(counts, total) {
  if (!total) return "background:conic-gradient(#e8edef 0 100%)";
  const critical = ((Number(counts["严重"]) || 0) / total) * 100;
  const medium = critical + ((Number(counts["中"]) || 0) / total) * 100;
  return `background:conic-gradient(#e45a4f 0 ${critical}%, #e0a52b ${critical}% ${medium}%, #2db8ad ${medium}% 100%)`;
}

function renderAdvice(items) {
  return items.slice(0, 4).map(([label, value]) => `<div><span>${escapeHtml(label)}</span><p>${escapeHtml(value)}</p></div>`).join("");
}

function renderPreviewTable(title, items, type) {
  const rows = items.length ? items.map((item) => renderRow(item, type)).join("") : `<tr><td colspan="4" class="empty-cell">当前没有${type === "bug" ? "待跟进 BUG" : "失败用例"}</td></tr>`;
  return `<article class="table-card"><div class="card-heading"><div><span class="section-kicker">重点关注</span><h2>${escapeHtml(title)}</h2></div><strong>${items.length}</strong></div><div class="table-scroll"><table>${renderTableHead(type)}<tbody>${rows}</tbody></table></div></article>`;
}

function renderFullTable(title, note, items, type) {
  const rows = items.length ? items.map((item) => renderRow(item, type)).join("") : `<tr><td colspan="4" class="empty-cell">暂无数据</td></tr>`;
  return `<section class="table-card full-table-card"><div class="full-table-heading"><div><span class="section-kicker">明细数据</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(note)}</p></div><span class="count-pill">共 ${items.length} 条</span></div><div class="table-scroll"><table>${renderTableHead(type)}<tbody>${rows}</tbody></table></div></section>`;
}

function renderTableHead(type) {
  return type === "bug"
    ? "<thead><tr><th>BUG 标题</th><th>严重程度</th><th>当前状态</th><th>关联任务</th></tr></thead>"
    : "<thead><tr><th>用例标题</th><th>等级</th><th>执行状态</th><th>所属任务</th></tr></thead>";
}

function renderRow(item, type) {
  if (type === "bug") {
    return `<tr><td><strong>${escapeHtml(item.title || "未命名 BUG")}</strong></td><td><span class="data-chip severity-${severityClass(item.severity)}">${escapeHtml(item.severity || "中")}</span></td><td><span class="data-chip status-${statusClass(item.status)}">${escapeHtml(item.status || "新建")}</span></td><td>${escapeHtml(item.taskName || "未关联")}</td></tr>`;
  }
  return `<tr><td><strong>${escapeHtml(item.title || "未命名用例")}</strong><small>${escapeHtml(item.module || "")}</small></td><td><span class="priority-chip">${escapeHtml(item.priority || "P2")}</span></td><td><span class="data-chip status-${statusClass(item.executionStatus)}">${escapeHtml(item.executionStatus || "未执行")}</span></td><td>${escapeHtml(item.taskName || "未关联")}</td></tr>`;
}

function renderError(title, message) {
  loading?.remove();
  root.innerHTML = `<section class="report-error"><span>!</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><a href="/">返回测试工作台</a></section>`;
}

function parsePercent(value) {
  return Math.max(0, Math.min(100, Number.parseFloat(value) || 0));
}

function toneClass(value) {
  if (value === "ok") return "ok";
  if (value === "danger") return "danger";
  return "warning";
}

function statusClass(value) {
  const map = { "通过": "passed", "失败": "failed", "阻塞": "blocked", "未执行": "pending", "新建": "new", "已提交": "submitted", "已修复": "fixed", "待回归": "regression", "已验证": "verified", "已关闭": "closed" };
  return map[value] || "pending";
}

function severityClass(value) {
  return value === "严重" ? "critical" : value === "低" ? "low" : "medium";
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("zh-CN", { hour12: false });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}
