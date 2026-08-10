/**
 * tcm-review.js —— 测试用例管理模块 L3 视图层：用例评审（T04）
 *
 * 职责：
 *   1. 评审单列表：状态 / 进度（已评 / 总数）/ 逾期高亮
 *   2. 发起评审：批量勾选用例（默认过滤「待评审」）+ 标题 + 评审人多选 + 截止时间
 *   3. 评审详情：逐条用例展示，提交 `通过` / `打回` / `需修改` / `评论` + 意见，全部留痕到 comments[]
 *   4. 结论回写：按系统设计 §3.4 映射表更新 asset.status / asset.reviewId 与
 *      ticket.status / conclusion / finishedAt（映射计算由 TCM.model.concludeReview 纯函数完成）
 *
 * 跨模块契约（只走 TCM.bus，禁止直接互调 render）：
 *   订阅：
 *     bus.on('review:requested', { action:'request-create', caseAssetIds:string[], source:'library' })
 *     bus.on('review:focus',     { reviewId:string })          // 追溯图谱 / 用例库反向跳转
 *     bus.on('case:deleted' | 'case:batchChanged')             // 用例变更后刷新可见视图
 *   广播：
 *     bus.emit('review:created',   { reviewId, caseCount })
 *     bus.emit('review:updated',   { reviewId, action })
 *     bus.emit('review:concluded', { reviewId, conclusion, changed })
 *     bus.emit('case:batchChanged',{ field:'status', count, source:'review' })
 *     bus.emit('case:focus',       { caseId, source:'review' })
 *
 * 写入约定（系统设计 §8.3）：一律通过 TCM.store.commit()，禁止直接 state.xxx.push()。
 */
(function (global) {
  "use strict";

  const TCM = global.TCM = global.TCM || {};
  const C = TCM.const;
  const U = TCM.util;

  if (!C || !U) {
    throw new Error("[tcm-review] 依赖缺失：请确保 tcm-core.js 在 tcm-review.js 之前加载。");
  }

  const doc = global.document;

  /** 视图根容器 */
  let rootEl = null;

  /** DOM 事件是否已绑定（mount 一次） */
  let mounted = false;

  /** bus 是否已订阅（进程内一次） */
  let busBound = false;

  /** 当前展开的评审单 id（空串 = 列表页） */
  let activeTicketId = "";

  /** 创建对话框草稿；null = 未打开 */
  let dialog = null;

  /** 列表页状态筛选（"" = 全部） */
  let listFilter = "";

  /** 每条用例的意见输入缓存：`${ticketId}::${caseId}` → 文本 */
  const draftComments = new Map();

  /** 远端团队成员（/api/team-members 兜底，只拉一次） */
  let remoteMembers = null;

  /** 是否正在拉取团队成员，避免并发重复请求 */
  let membersLoading = false;

  /** 评审单状态 → 徽标色调 */
  const STATUS_TONE = Object.freeze({
    "待评审": "tone-orange",
    "评审中": "tone-blue",
    "已完成": "tone-green",
    "已取消": "tone-gray"
  });

  /** 评审结论 → 徽标色调 */
  const CONCLUSION_TONE = Object.freeze({
    "通过": "tone-green",
    "打回": "tone-red",
    "需修改": "tone-orange"
  });

  /** 用例状态 → 徽标色调（与 app.js BASIC_CASE_STATUS_TONE 保持一致） */
  const CASE_STATUS_TONE = Object.freeze({
    "草稿": "tone-gray",
    "待评审": "tone-orange",
    "已确认": "tone-green",
    "已废弃": "tone-red"
  });

  /** 评审动作 → 按钮修饰类 */
  const ACTION_CLASS = Object.freeze({
    "通过": "is-pass",
    "打回": "is-reject",
    "需修改": "is-revise",
    "评论": "is-comment"
  });

  /* ------------------------------------------------------------------ *
   * 一、基础工具
   * ------------------------------------------------------------------ */

  /**
   * 读取全局状态对象。
   * @returns {object} state 引用
   */
  function getState() {
    return TCM.store && typeof TCM.store.getState === "function"
      ? TCM.store.getState()
      : (global.state || {});
  }

  /**
   * 读取集合。
   * @param {string} name 集合名
   * @returns {Array<object>} 集合数组
   */
  function collection(name) {
    return TCM.store && typeof TCM.store.collection === "function"
      ? TCM.store.collection(name)
      : U.toArray(getState()[name]);
  }

  /**
   * 当前操作人。
   * @returns {string} 操作人名称
   */
  function operator() {
    return U.currentOperator(getState());
  }

  /**
   * 轻提示（复用宿主 showToast，缺失时降级 console）。
   * @param {string} message 提示文案
   * @param {string} [tone] 语气：info / ok / warning / error
   * @returns {void}
   */
  function toast(message, tone) {
    if (typeof global.showToast === "function") {
      global.showToast(message, tone || "info");
      return;
    }
    if (global.console && typeof global.console.info === "function") {
      global.console.info(`[TCM.review] ${message}`);
    }
  }

  /**
   * 视图是否可见（只有可见时才值得重渲染）。
   * @returns {boolean} 是否可见
   */
  function isVisible() {
    return Boolean(rootEl && rootEl.classList && rootEl.classList.contains("is-active"));
  }

  /**
   * 仅在视图可见时重渲染（bus 回调用，避免无谓 DOM 操作）。
   * @returns {void}
   */
  function renderIfVisible() {
    if (isVisible()) {
      render();
    }
  }

  /**
   * 候选评审人列表：state.teamMembers ∪ 远端 /api/team-members ∪ 当前操作人。
   * @returns {Array<string>} 去重后的成员名
   */
  function reviewerCandidates() {
    const state = getState();
    const merged = U.toArray(state.teamMembers)
      .concat(U.toArray(remoteMembers))
      .concat([operator()]);
    return U.stringList(merged);
  }

  /**
   * 惰性拉取 /api/team-members（仅当本地成员为空时），成功后刷新对话框。
   * @returns {void}
   */
  function ensureReviewers() {
    if (membersLoading || remoteMembers !== null) {
      return;
    }
    if (U.toArray(getState().teamMembers).length > 0) {
      return;
    }
    if (typeof global.fetch !== "function") {
      remoteMembers = [];
      return;
    }
    membersLoading = true;
    global.fetch("/api/team-members")
      .then((response) => (response && response.ok ? response.json() : { teamMembers: [] }))
      .then((data) => {
        remoteMembers = U.stringList(data && data.teamMembers);
        membersLoading = false;
        if (dialog) {
          render();
        }
      })
      .catch(() => {
        remoteMembers = [];
        membersLoading = false;
      });
  }

  /**
   * 按 id 取评审单。
   * @param {string} id 评审单 id
   * @returns {object|null} 评审单
   */
  function findTicket(id) {
    const target = U.str(id);
    if (!target) {
      return null;
    }
    return collection("reviewTickets").find((item) => item && U.str(item.id) === target) || null;
  }

  /**
   * 按 id 取用例资产。
   * @param {string} id 资产 id
   * @returns {object|null} 资产
   */
  function findAsset(id) {
    const target = U.str(id);
    if (!target) {
      return null;
    }
    return collection("basicCaseLibrary").find((item) => item && U.str(item.id) === target) || null;
  }

  /**
   * 计算评审单进度（委托 model 纯函数）。
   * @param {object} ticket 评审单
   * @returns {object} 进度对象
   */
  function progressOf(ticket) {
    return TCM.model.reviewProgress(ticket, { now: U.nowIso() });
  }

  /* ------------------------------------------------------------------ *
   * 二、列表页渲染
   * ------------------------------------------------------------------ */

  /**
   * 渲染进度条。
   * @param {object} progress reviewProgress 结果
   * @returns {string} HTML 片段
   */
  function progressHtml(progress) {
    const width = Math.max(0, Math.min(100, U.num(progress.percent, 0, 0)));
    return `<div class="tcm-rv-progress">
      <div class="tcm-rv-progress-track">
        <div class="tcm-rv-progress-fill" style="width:${U.escapeHtml(String(width))}%"></div>
      </div>
      <span class="tcm-rv-progress-text">${U.escapeHtml(String(progress.reviewed))}/${U.escapeHtml(String(progress.total))}</span>
    </div>`;
  }

  /**
   * 渲染截止时间（逾期标红）。
   * @param {object} ticket 评审单
   * @param {object} progress 进度对象
   * @returns {string} HTML 片段
   */
  function dueHtml(ticket, progress) {
    const dueAt = U.str(ticket.dueAt);
    if (!dueAt) {
      return `<span class="tcm-rv-due">截止：未设置</span>`;
    }
    const cls = progress.overdue ? "tcm-rv-due is-overdue" : "tcm-rv-due";
    const suffix = progress.overdue ? " · 已逾期" : "";
    return `<span class="${cls}">截止：${U.escapeHtml(dueAt)}${U.escapeHtml(suffix)}</span>`;
  }

  /**
   * 渲染评审人 chips。
   * @param {Array<string>} reviewers 评审人
   * @returns {string} HTML 片段
   */
  function reviewersHtml(reviewers) {
    const list = U.stringList(reviewers);
    if (!list.length) {
      return `<span class="tcm-rv-muted">未指派评审人</span>`;
    }
    return `<span class="tcm-rv-chips">${list
      .map((name) => `<span class="tcm-chip tcm-chip-readonly">${U.escapeHtml(name)}</span>`)
      .join("")}</span>`;
  }

  /**
   * 渲染一张评审单卡片。
   * @param {object} ticket 评审单
   * @returns {string} HTML 片段
   */
  function ticketCardHtml(ticket) {
    const progress = progressOf(ticket);
    const statusTone = STATUS_TONE[ticket.status] || "tone-gray";
    const conclusion = U.str(ticket.conclusion);
    const conclusionBadge = conclusion
      ? `<span class="badge ${U.escapeHtml(CONCLUSION_TONE[conclusion] || "tone-gray")}">结论：${U.escapeHtml(conclusion)}</span>`
      : `<span class="badge tone-gray">未出结论</span>`;

    return `<article class="tcm-rv-card${progress.overdue ? " is-overdue" : ""}" data-tcm-rv-open="${U.escapeHtml(ticket.id)}">
      <header class="tcm-rv-card-head">
        <h4 class="tcm-rv-card-title">${U.escapeHtml(ticket.title)}</h4>
        <span class="badge ${U.escapeHtml(statusTone)}">${U.escapeHtml(ticket.status)}</span>
        ${conclusionBadge}
      </header>
      <div class="tcm-rv-card-meta">
        <span>用例 ${U.escapeHtml(String(U.stringList(ticket.caseIds).length))} 条</span>
        <span>· 发起人 ${U.escapeHtml(U.str(ticket.createdBy, "未指定"))}</span>
        <span>· ${U.escapeHtml(U.dateOr(ticket.createdAt, "—"))}</span>
        ${dueHtml(ticket, progress)}
      </div>
      <div class="tcm-rv-card-foot">
        ${progressHtml(progress)}
        ${reviewersHtml(ticket.reviewers)}
      </div>
    </article>`;
  }

  /**
   * 渲染评审单列表页。
   * @returns {string} HTML 片段
   */
  function listHtml() {
    const all = collection("reviewTickets").slice().sort((a, b) =>
      String(U.str(b && b.createdAt)).localeCompare(String(U.str(a && a.createdAt))));
    const filtered = listFilter ? all.filter((item) => U.str(item.status) === listFilter) : all;

    const pendingCount = collection("basicCaseLibrary")
      .filter((asset) => U.str(asset && asset.status) === "待评审").length;

    const filterButtons = [{ key: "", label: "全部" }]
      .concat(C.REVIEW_STATUS.map((status) => ({ key: status, label: status })))
      .map((item) => {
        const count = item.key ? all.filter((t) => U.str(t.status) === item.key).length : all.length;
        const active = listFilter === item.key ? " is-active" : "";
        return `<button type="button" class="tcm-rv-filter${active}" data-tcm-rv-filter="${U.escapeHtml(item.key)}">
          ${U.escapeHtml(item.label)}<span class="tcm-rv-filter-count">${U.escapeHtml(String(count))}</span>
        </button>`;
      }).join("");

    const body = filtered.length
      ? `<div class="tcm-rv-list">${filtered.map(ticketCardHtml).join("")}</div>`
      : `<section class="tcm-empty">
          <div class="tcm-empty-icon" aria-hidden="true">✅</div>
          <h4 class="tcm-empty-title">${U.escapeHtml(all.length ? "该状态下暂无评审单" : "还没有评审单")}</h4>
          <p class="tcm-empty-desc">${U.escapeHtml(all.length
            ? "换一个状态筛选，或新发起一张评审单。"
            : "点右上角「发起评审」，或在用例库勾选用例后点「发起评审」批量创建。")}</p>
        </section>`;

    return `<div class="tcm-rv-page">
      <header class="tcm-page-head">
        <div>
          <h3 class="tcm-page-title">用例评审</h3>
          <p class="tcm-page-desc">共 ${U.escapeHtml(String(all.length))} 张评审单 · 当前用例库有 ${U.escapeHtml(String(pendingCount))} 条「待评审」用例 · 结论按 §3.4 映射自动回写用例状态</p>
        </div>
        <div class="tcm-page-actions">
          <button type="button" class="tcm-btn tcm-btn-primary" data-tcm-rv-new="1">＋ 发起评审</button>
        </div>
      </header>
      <div class="tcm-rv-filters" role="group" aria-label="按状态筛选评审单">${filterButtons}</div>
      ${body}
    </div>`;
  }

  /* ------------------------------------------------------------------ *
   * 三、详情页渲染
   * ------------------------------------------------------------------ */

  /**
   * 渲染某条用例下的评审意见时间线。
   * @param {object} ticket 评审单
   * @param {string} caseId 用例 id
   * @returns {string} HTML 片段
   */
  function commentsHtml(ticket, caseId) {
    const list = U.toArray(ticket.comments).filter((item) => U.str(item && item.caseId) === caseId);
    if (!list.length) {
      return `<p class="tcm-rv-nocomment">暂无评审意见</p>`;
    }
    return `<ul class="tcm-rv-comments">${list.map((item) => {
      const action = U.str(item.action, "评论");
      const cls = ACTION_CLASS[action] || "is-comment";
      return `<li class="tcm-rv-comment">
        <span class="tcm-rv-comment-action ${U.escapeHtml(cls)}">${U.escapeHtml(action)}</span>
        <div class="tcm-rv-comment-body">
          <p class="tcm-rv-comment-text">${U.escapeHtml(U.str(item.content, "（未填写意见）"))}</p>
          <p class="tcm-rv-comment-meta">${U.escapeHtml(U.str(item.author, "未指定"))} · ${U.escapeHtml(U.str(item.createdAt).replace("T", " ").slice(0, 16))}</p>
        </div>
      </li>`;
    }).join("")}</ul>`;
  }

  /**
   * 渲染详情页中的一条用例。
   * @param {object} ticket 评审单
   * @param {string} caseId 用例 id
   * @param {number} index 序号（从 1 开始）
   * @param {Object<string,string>} verdicts caseId → 最新判定
   * @param {boolean} locked 评审单是否已结单（结单后禁止再提交）
   * @returns {string} HTML 片段
   */
  function caseRowHtml(ticket, caseId, index, verdicts, locked) {
    const asset = findAsset(caseId);
    const verdict = U.str(verdicts[caseId]);
    const draftKey = `${ticket.id}::${caseId}`;
    const draftText = U.str(draftComments.get(draftKey));

    const title = asset ? U.str(asset.title, caseId) : `${caseId}（用例已删除）`;
    const caseStatus = asset ? U.str(asset.status, "草稿") : "已废弃";
    const statusTone = CASE_STATUS_TONE[caseStatus] || "tone-gray";
    const breadcrumb = asset
      ? [asset.business, asset.product, asset.module, asset.category]
          .map((part) => U.str(part))
          .filter((part, idx, list) => part && list.indexOf(part) === idx)
          .join(" / ")
      : "";

    const detailFields = asset
      ? [
          { label: "测试目标", value: asset.objective },
          { label: "前置条件", value: asset.preconditions },
          { label: "操作步骤", value: asset.steps },
          { label: "预期结果", value: asset.expected }
        ].filter((field) => U.str(field.value))
      : [];
    const detailHtml = detailFields.length
      ? `<dl class="tcm-rv-case-fields">${detailFields.map((field) =>
          `<div class="tcm-rv-case-field">
            <dt>${U.escapeHtml(field.label)}</dt>
            <dd>${U.escapeHtml(field.value)}</dd>
          </div>`).join("")}</dl>`
      : "";

    const verdictBadge = verdict
      ? `<span class="tcm-rv-verdict ${U.escapeHtml(ACTION_CLASS[verdict] || "is-comment")}">已评：${U.escapeHtml(verdict)}</span>`
      : `<span class="tcm-rv-verdict is-pending">待评审</span>`;

    const actionButtons = C.REVIEW_ACTION.map((action) => {
      const cls = ACTION_CLASS[action] || "is-comment";
      const current = action === verdict ? " is-current" : "";
      return `<button type="button" class="tcm-rv-act ${U.escapeHtml(cls)}${current}"
        data-tcm-rv-act="${U.escapeHtml(action)}"
        data-tcm-rv-case="${U.escapeHtml(caseId)}"
        ${locked ? "disabled" : ""}
        title="${U.escapeHtml(action === "评论" ? "只留痕，不改变用例状态" : `提交「${action}」判定`)}">${U.escapeHtml(action)}</button>`;
    }).join("");

    return `<section class="tcm-rv-case" data-tcm-rv-caserow="${U.escapeHtml(caseId)}">
      <header class="tcm-rv-case-head">
        <span class="tcm-rv-case-index">${U.escapeHtml(String(index))}</span>
        <div class="tcm-rv-case-headline">
          <span class="tcm-rv-case-title" data-tcm-rv-jump="${U.escapeHtml(caseId)}" role="link" tabindex="0"
            title="在用例库中打开该用例">${U.escapeHtml(title)}</span>
          <div class="tcm-rv-case-meta">
            <span class="badge ${U.escapeHtml(statusTone)}">${U.escapeHtml(caseStatus)}</span>
            ${asset ? `<span class="tcm-badge tcm-badge-type">${U.escapeHtml(U.str(asset.type, "功能"))}</span>` : ""}
            ${asset ? `<span class="tcm-badge tcm-badge-muted">${U.escapeHtml(U.str(asset.priority, "P1"))}</span>` : ""}
            ${breadcrumb ? `<span class="tcm-rv-muted">${U.escapeHtml(breadcrumb)}</span>` : ""}
          </div>
        </div>
        ${verdictBadge}
      </header>
      ${detailHtml}
      <div class="tcm-rv-case-form">
        <label class="tcm-sr-only" for="tcmRvOpinion-${U.escapeHtml(caseId)}">评审意见</label>
        <textarea id="tcmRvOpinion-${U.escapeHtml(caseId)}" class="tcm-textarea tcm-rv-opinion" rows="2"
          data-tcm-rv-opinion="${U.escapeHtml(caseId)}"
          placeholder="填写评审意见（「打回」「需修改」建议必填，会完整留痕）"
          ${locked ? "disabled" : ""}>${U.escapeHtml(draftText)}</textarea>
        <div class="tcm-rv-acts">${actionButtons}</div>
      </div>
      ${commentsHtml(ticket, caseId)}
    </section>`;
  }

  /**
   * 渲染评审单详情页。
   * @param {object} ticket 评审单
   * @returns {string} HTML 片段
   */
  function detailHtml(ticket) {
    const progress = progressOf(ticket);
    const verdicts = TCM.model.deriveReviewVerdicts(ticket);
    const caseIds = U.stringList(ticket.caseIds);
    const locked = ticket.status === "已完成" || ticket.status === "已取消";
    const conclusion = U.str(ticket.conclusion);

    const summary = C.REVIEW_VERDICT_ACTIONS.map((action) => {
      const count = caseIds.filter((caseId) => verdicts[caseId] === action).length;
      return `<span class="tcm-stat-chip">
        <span class="tcm-stat-label">${U.escapeHtml(action)}</span>
        <span class="tcm-stat-value">${U.escapeHtml(String(count))}</span>
      </span>`;
    }).join("");

    const banner = locked
      ? `<p class="tcm-rv-banner is-done">评审单已${U.escapeHtml(ticket.status === "已取消" ? "取消" : "结单")}${conclusion ? `，结论「${U.escapeHtml(conclusion)}」` : ""}，不可再提交意见。</p>`
      : (progress.overdue
          ? `<p class="tcm-rv-banner is-overdue">该评审单已超过截止时间 ${U.escapeHtml(U.str(ticket.dueAt))}，请尽快完成评审。</p>`
          : `<p class="tcm-rv-banner">每条用例的判定**即时**按 §3.4 映射回写用例状态；全部评审完后自动聚合评审单结论（有打回→打回；否则有需修改→需修改；全通过→通过）。</p>`);

    return `<div class="tcm-rv-page">
      <header class="tcm-page-head">
        <div class="tcm-page-headline">
          <button type="button" class="tcm-icon-btn" data-tcm-rv-back="1" aria-label="返回评审单列表">←</button>
          <div>
            <h3 class="tcm-page-title">${U.escapeHtml(ticket.title)}</h3>
            <p class="tcm-page-desc">
              发起人 ${U.escapeHtml(U.str(ticket.createdBy, "未指定"))} ·
              ${U.escapeHtml(U.dateOr(ticket.createdAt, "—"))} ·
              用例 ${U.escapeHtml(String(caseIds.length))} 条
              ${ticket.finishedAt ? ` · 结单于 ${U.escapeHtml(U.dateOr(ticket.finishedAt, "—"))}` : ""}
            </p>
          </div>
        </div>
        <div class="tcm-page-actions">
          ${locked ? "" : `<button type="button" class="tcm-btn tcm-btn-ghost" data-tcm-rv-cancel="${U.escapeHtml(ticket.id)}">作废评审单</button>`}
        </div>
      </header>

      <section class="tcm-rv-summary">
        <div class="tcm-rv-summary-row">
          <span class="badge ${U.escapeHtml(STATUS_TONE[ticket.status] || "tone-gray")}">${U.escapeHtml(ticket.status)}</span>
          ${conclusion
            ? `<span class="badge ${U.escapeHtml(CONCLUSION_TONE[conclusion] || "tone-gray")}">结论：${U.escapeHtml(conclusion)}</span>`
            : `<span class="badge tone-gray">未出结论</span>`}
          ${dueHtml(ticket, progress)}
          ${progressHtml(progress)}
        </div>
        <div class="tcm-rv-summary-row">
          <span class="tcm-rv-label">评审人</span>${reviewersHtml(ticket.reviewers)}
          <span class="tcm-stat-chips">${summary}</span>
        </div>
        ${banner}
      </section>

      <div class="tcm-rv-cases">
        ${caseIds.length
          ? caseIds.map((caseId, index) => caseRowHtml(ticket, caseId, index + 1, verdicts, locked)).join("")
          : `<p class="tcm-empty-inline">该评审单没有关联任何用例。</p>`}
      </div>
    </div>`;
  }

  /* ------------------------------------------------------------------ *
   * 四、发起评审对话框
   * ------------------------------------------------------------------ */

  /**
   * 生成默认截止日期（今天 +3 天）。
   * @returns {string} YYYY-MM-DD
   */
  function defaultDueDate() {
    const base = new Date();
    base.setDate(base.getDate() + 3);
    return base.toISOString().slice(0, 10);
  }

  /**
   * 打开发起评审对话框。
   * @param {Array<string>} caseAssetIds 候选用例 id；为空时取全部「待评审」用例
   * @returns {void}
   */
  function openCreateDialog(caseAssetIds) {
    const assets = collection("basicCaseLibrary");
    let candidates = U.stringList(caseAssetIds);
    if (!candidates.length) {
      candidates = assets
        .filter((asset) => U.str(asset && asset.status) === "待评审")
        .map((asset) => U.str(asset.id));
    }
    if (!candidates.length) {
      toast("用例库暂无「待评审」用例，请先在用例库勾选用例后再发起评审。", "warning");
      return;
    }

    // 默认只勾选「待评审」的用例（系统设计 T04 交付项 1）
    const selected = candidates.filter((id) => {
      const asset = assets.find((item) => U.str(item && item.id) === id);
      return asset && U.str(asset.status) === "待评审";
    });

    dialog = {
      candidates,
      selected: new Set(selected.length ? selected : candidates.filter((id) => {
        const asset = assets.find((item) => U.str(item && item.id) === id);
        return asset && U.str(asset.status) === "草稿";
      })),
      title: "",
      reviewers: new Set(),
      dueAt: defaultDueDate(),
      error: ""
    };
    ensureReviewers();
    render();
  }

  /**
   * 渲染发起评审对话框。
   * @returns {string} HTML 片段
   */
  function dialogHtml() {
    if (!dialog) {
      return "";
    }
    const assets = collection("basicCaseLibrary");
    const rows = dialog.candidates.map((caseId) => {
      const asset = assets.find((item) => U.str(item && item.id) === caseId) || null;
      const status = asset ? U.str(asset.status, "草稿") : "已废弃";
      const selectable = status === "待评审" || status === "草稿";
      const checked = dialog.selected.has(caseId);
      const hint = status === "草稿"
        ? "勾选后将先置为「待评审」"
        : (selectable ? "" : "该状态不参与评审");
      return `<li class="tcm-rv-pick${selectable ? "" : " is-disabled"}">
        <label class="tcm-checkbox">
          <input type="checkbox" data-tcm-rv-pick="${U.escapeHtml(caseId)}" ${checked ? "checked" : ""} ${selectable ? "" : "disabled"}>
          <span class="tcm-rv-pick-title">${U.escapeHtml(asset ? U.str(asset.title, caseId) : `${caseId}（用例已删除）`)}</span>
        </label>
        <span class="badge ${U.escapeHtml(CASE_STATUS_TONE[status] || "tone-gray")}">${U.escapeHtml(status)}</span>
        ${hint ? `<span class="tcm-rv-pick-hint">${U.escapeHtml(hint)}</span>` : ""}
      </li>`;
    }).join("");

    const members = reviewerCandidates();
    const reviewerBoxes = members.length
      ? members.map((name) => `<label class="tcm-checkbox tcm-rv-reviewer">
          <input type="checkbox" data-tcm-rv-reviewer="${U.escapeHtml(name)}" ${dialog.reviewers.has(name) ? "checked" : ""}>
          <span>${U.escapeHtml(name)}</span>
        </label>`).join("")
      : `<p class="tcm-rv-muted">暂无团队成员，可在「设置 → 团队成员」中维护，或直接留空。</p>`;

    return `<div class="tcm-modal-backdrop" role="dialog" aria-modal="true" aria-label="发起用例评审">
      <div class="tcm-modal-mask" data-tcm-rv-dialog-close="1"></div>
      <div class="tcm-modal tcm-modal-panel tcm-rv-modal">
        <header class="tcm-modal-head">
          <h4 class="tcm-modal-title">发起用例评审</h4>
          <button type="button" class="tcm-icon-btn" data-tcm-rv-dialog-close="1" aria-label="关闭">×</button>
        </header>
        <div class="tcm-modal-body">
          <div class="tcm-form-grid">
            <div class="tcm-field tcm-field-wide">
              <label class="tcm-field-label" for="tcmRvTitle">评审单标题<span class="tcm-required">*</span></label>
              <input type="text" id="tcmRvTitle" class="tcm-inline-input" data-tcm-rv-field="title"
                value="${U.escapeHtml(dialog.title)}" placeholder="如：本地收款 P0 用例评审" maxlength="120">
            </div>
            <div class="tcm-field">
              <label class="tcm-field-label" for="tcmRvDue">截止时间</label>
              <input type="date" id="tcmRvDue" class="tcm-inline-input" data-tcm-rv-field="dueAt"
                value="${U.escapeHtml(dialog.dueAt)}">
            </div>
          </div>
          <div class="tcm-form-section">
            <p class="tcm-form-section-title">评审人（可多选）</p>
            <div class="tcm-rv-reviewers">${reviewerBoxes}</div>
          </div>
          <div class="tcm-form-section">
            <p class="tcm-form-section-title">
              参与评审的用例
              <span class="tcm-rv-muted">已选 ${U.escapeHtml(String(dialog.selected.size))} / ${U.escapeHtml(String(dialog.candidates.length))} 条</span>
            </p>
            <ul class="tcm-rv-picks">${rows}</ul>
          </div>
          ${dialog.error ? `<p class="tcm-form-error" data-tcm-rv-dialog-error>${U.escapeHtml(dialog.error)}</p>` : `<p class="tcm-form-error" data-tcm-rv-dialog-error hidden></p>`}
        </div>
        <footer class="tcm-modal-foot">
          <button type="button" class="tcm-btn tcm-btn-ghost" data-tcm-rv-dialog-close="1">取消</button>
          <button type="button" class="tcm-btn tcm-btn-primary" data-tcm-rv-submit="1">创建评审单</button>
        </footer>
      </div>
    </div>`;
  }

  /**
   * 提交发起评审对话框：创建评审单 + 把「草稿」用例置为「待评审」。
   * @returns {void}
   */
  function submitCreateDialog() {
    if (!dialog) {
      return;
    }
    const title = U.str(dialog.title);
    if (!title) {
      dialog.error = "请填写评审单标题。";
      render();
      return;
    }
    const caseIds = dialog.candidates.filter((id) => dialog.selected.has(id));
    if (!caseIds.length) {
      dialog.error = "请至少勾选 1 条用例。";
      render();
      return;
    }

    const now = U.nowIso();
    const who = operator();

    // 「草稿」用例随发起评审一起流转为「待评审」（系统设计 §3.0 状态机：草稿 ──发起评审──▶ 待评审）
    const assets = collection("basicCaseLibrary");
    let promoted = 0;
    const nextAssets = assets.map((asset) => {
      const id = U.str(asset && asset.id);
      if (!caseIds.includes(id) || U.str(asset.status) !== "草稿") {
        return asset;
      }
      promoted += 1;
      return Object.assign({}, asset, { status: "待评审", updatedBy: who, updatedAt: now });
    });
    if (promoted > 0) {
      TCM.store.commit("basicCaseLibrary", nextAssets, { source: "review" });
    }

    const ticket = TCM.model.normalizeReviewTicket({
      id: U.uid(C.ID_PREFIX.REVIEW),
      title,
      caseIds,
      reviewers: Array.from(dialog.reviewers),
      dueAt: U.dateOr(dialog.dueAt, ""),
      status: "待评审",
      conclusion: "",
      comments: [],
      createdBy: who,
      createdAt: now,
      finishedAt: ""
    }, { operator: who, now });

    const ok = TCM.store.commit("reviewTickets", collection("reviewTickets").concat([ticket]), { source: "review" });
    if (!ok) {
      dialog.error = "创建失败，请刷新页面后重试。";
      render();
      return;
    }

    dialog = null;
    activeTicketId = ticket.id;
    TCM.bus.emit(C.EVENTS.REVIEW_CREATED, { reviewId: ticket.id, caseCount: caseIds.length });
    if (promoted > 0) {
      TCM.bus.emit(C.EVENTS.CASE_BATCH_CHANGED, { field: "status", count: promoted, source: "review" });
    }
    toast(`已创建评审单「${title}」，包含 ${caseIds.length} 条用例。`, "ok");
    render();
  }

  /* ------------------------------------------------------------------ *
   * 五、评审判定与结论回写
   * ------------------------------------------------------------------ */

  /**
   * 提交一条评审意见 / 判定，并按 §3.4 映射回写用例状态与评审单结论。
   *
   * 落地步骤：
   *   1. 追加 comment（留痕，永不删除）
   *   2. 由 comments 反推每条用例的最新判定 → TCM.model.concludeReview 产出变更集（纯函数）
   *   3. 变更集应用到 basicCaseLibrary（status + reviewId），一次 commit
   *   4. 更新 ticket 的 status / conclusion / finishedAt，一次 commit
   *
   * @param {string} caseId 用例 id
   * @param {string} action 评审动作（通过 / 打回 / 需修改 / 评论）
   * @returns {void}
   */
  function submitVerdict(caseId, action) {
    const ticket = findTicket(activeTicketId);
    if (!ticket) {
      return;
    }
    if (ticket.status === "已完成" || ticket.status === "已取消") {
      toast("评审单已结单，不能再提交意见。", "warning");
      return;
    }
    const targetCase = U.str(caseId);
    if (!U.stringList(ticket.caseIds).includes(targetCase)) {
      return;
    }
    const verb = U.oneOf(action, C.REVIEW_ACTION, "");
    if (!verb) {
      return;
    }

    const draftKey = `${ticket.id}::${targetCase}`;
    const content = U.str(draftComments.get(draftKey));
    if (verb === "评论" && !content) {
      toast("请先填写评论内容。", "warning");
      return;
    }
    if ((verb === "打回" || verb === "需修改") && !content) {
      toast(`「${verb}」需要填写意见，便于用例作者定位问题。`, "warning");
      return;
    }

    const now = U.nowIso();
    const who = operator();
    const comment = {
      id: U.uid(C.ID_PREFIX.COMMENT),
      caseId: targetCase,
      author: who,
      action: verb,
      content,
      createdAt: now
    };

    const tickets = collection("reviewTickets");
    const nextTicket = U.clone(ticket);
    nextTicket.comments = U.toArray(ticket.comments).concat([comment]);

    // —— 结论回写（纯函数产出变更集）——
    const assets = collection("basicCaseLibrary");
    const outcome = TCM.model.concludeReview(
      nextTicket,
      TCM.model.deriveReviewVerdicts(nextTicket),
      { assets, now }
    );
    nextTicket.status = outcome.ticketStatus;
    nextTicket.conclusion = outcome.conclusion;
    nextTicket.finishedAt = outcome.finishedAt || U.str(ticket.finishedAt);

    // —— 应用到用例资产 ——
    const changeMap = new Map(outcome.assetChanges.map((change) => [change.caseId, change]));
    let touched = 0;
    const nextAssets = assets.map((asset) => {
      const change = changeMap.get(U.str(asset && asset.id));
      if (!change) {
        return asset;
      }
      const nextStatus = change.to;
      const nextReviewId = change.reviewId || U.str(asset.reviewId);
      if (nextStatus === U.str(asset.status) && nextReviewId === U.str(asset.reviewId)) {
        return asset;
      }
      touched += 1;
      return Object.assign({}, asset, {
        status: nextStatus,
        reviewId: nextReviewId,
        updatedBy: who,
        updatedAt: now
      });
    });

    if (touched > 0) {
      TCM.store.commit("basicCaseLibrary", nextAssets, { source: "review" });
    }
    TCM.store.commit(
      "reviewTickets",
      tickets.map((item) => (U.str(item && item.id) === U.str(ticket.id) ? nextTicket : item)),
      { source: "review" }
    );

    draftComments.delete(draftKey);

    TCM.bus.emit(C.EVENTS.REVIEW_UPDATED, { reviewId: ticket.id, caseId: targetCase, action: verb });
    if (touched > 0) {
      TCM.bus.emit(C.EVENTS.CASE_BATCH_CHANGED, { field: "status", count: touched, source: "review" });
    }
    if (outcome.allReviewed && outcome.conclusion) {
      TCM.bus.emit(C.EVENTS.REVIEW_CONCLUDED, {
        reviewId: ticket.id,
        conclusion: outcome.conclusion,
        changed: outcome.assetChanges.filter((change) => change.changed).length
      });
      toast(`评审单已聚合结论「${outcome.conclusion}」${outcome.conclusion === "需修改" ? "，保持评审中" : "，已结单"}。`, "ok");
    }

    render();
  }

  /**
   * 作废评审单（status → 已取消），不回滚已经产生的用例状态变更。
   * @param {string} ticketId 评审单 id
   * @returns {void}
   */
  function cancelTicket(ticketId) {
    const ticket = findTicket(ticketId);
    if (!ticket) {
      return;
    }
    if (typeof global.confirm === "function" && !global.confirm(`确认作废评审单「${ticket.title}」？已产生的用例状态变更不会回滚。`)) {
      return;
    }
    const tickets = collection("reviewTickets");
    const nextTicket = Object.assign({}, U.clone(ticket), { status: "已取消" });
    TCM.store.commit(
      "reviewTickets",
      tickets.map((item) => (U.str(item && item.id) === U.str(ticket.id) ? nextTicket : item)),
      { source: "review" }
    );
    TCM.bus.emit(C.EVENTS.REVIEW_UPDATED, { reviewId: ticket.id, action: "cancel" });
    toast("评审单已作废。", "ok");
    render();
  }

  /* ------------------------------------------------------------------ *
   * 六、渲染入口
   * ------------------------------------------------------------------ */

  /**
   * 记录当前焦点（重渲染后恢复，避免输入意见时失焦）。
   * @returns {{caseId:string, start:number, end:number}|null} 焦点快照
   */
  function captureFocus() {
    if (!doc || !doc.activeElement || !rootEl || !rootEl.contains(doc.activeElement)) {
      return null;
    }
    const el = doc.activeElement;
    const caseId = el.dataset ? U.str(el.dataset.tcmRvOpinion) : "";
    if (!caseId) {
      return null;
    }
    return {
      caseId,
      start: U.num(el.selectionStart, 0, 0),
      end: U.num(el.selectionEnd, 0, 0)
    };
  }

  /**
   * 恢复焦点。
   * @param {{caseId:string, start:number, end:number}|null} snapshot 焦点快照
   * @returns {void}
   */
  function restoreFocus(snapshot) {
    if (!snapshot || !rootEl) {
      return;
    }
    const el = rootEl.querySelector(`[data-tcm-rv-opinion="${snapshot.caseId}"]`);
    if (!el || typeof el.focus !== "function") {
      return;
    }
    el.focus();
    if (typeof el.setSelectionRange === "function") {
      try {
        el.setSelectionRange(snapshot.start, snapshot.end);
      } catch (_error) {
        // 部分浏览器对 disabled textarea 抛错，忽略
      }
    }
  }

  /**
   * 渲染评审视图（幂等，可反复调用）。
   * @returns {void}
   */
  function render() {
    if (!doc) {
      return;
    }
    if (!rootEl) {
      rootEl = doc.getElementById("tcmReviewView");
    }
    if (!rootEl) {
      return;
    }

    const ticket = activeTicketId ? findTicket(activeTicketId) : null;
    if (activeTicketId && !ticket) {
      activeTicketId = "";
    }

    const snapshot = captureFocus();
    rootEl.innerHTML = (ticket ? detailHtml(ticket) : listHtml()) + dialogHtml();
    rootEl.dataset.tcmRendered = ticket ? `review:${ticket.id}` : "review:list";
    restoreFocus(snapshot);
  }

  /* ------------------------------------------------------------------ *
   * 七、交互
   * ------------------------------------------------------------------ */

  /**
   * 视图内 click 事件总处理（事件委托，绑在容器上）。
   * @param {MouseEvent} event 事件对象
   * @returns {void}
   */
  function onClick(event) {
    const target = event.target;
    if (!target || typeof target.closest !== "function") {
      return;
    }

    if (target.closest("[data-tcm-rv-dialog-close]")) {
      dialog = null;
      render();
      return;
    }
    if (target.closest("[data-tcm-rv-submit]")) {
      submitCreateDialog();
      return;
    }
    if (target.closest("[data-tcm-rv-new]")) {
      openCreateDialog([]);
      return;
    }
    if (target.closest("[data-tcm-rv-back]")) {
      activeTicketId = "";
      render();
      return;
    }

    const cancelBtn = target.closest("[data-tcm-rv-cancel]");
    if (cancelBtn) {
      cancelTicket(cancelBtn.dataset.tcmRvCancel);
      return;
    }

    const filterBtn = target.closest("[data-tcm-rv-filter]");
    if (filterBtn) {
      listFilter = U.str(filterBtn.dataset.tcmRvFilter);
      render();
      return;
    }

    const actBtn = target.closest("[data-tcm-rv-act]");
    if (actBtn) {
      submitVerdict(actBtn.dataset.tcmRvCase, actBtn.dataset.tcmRvAct);
      return;
    }

    const jump = target.closest("[data-tcm-rv-jump]");
    if (jump) {
      focusCaseInLibrary(jump.dataset.tcmRvJump);
      return;
    }

    const card = target.closest("[data-tcm-rv-open]");
    if (card) {
      activeTicketId = U.str(card.dataset.tcmRvOpen);
      render();
    }
  }

  /**
   * 广播「聚焦某条用例」，由用例库模块接管跳转（跨模块只走 bus）。
   * @param {string} caseId 用例 id
   * @returns {void}
   */
  function focusCaseInLibrary(caseId) {
    const id = U.str(caseId);
    if (!id) {
      return;
    }
    TCM.bus.emit(C.EVENTS.CASE_FOCUS, { caseId: id, source: "review" });
  }

  /**
   * 视图内 change 事件（勾选用例 / 勾选评审人 / 日期）。
   * @param {Event} event 事件对象
   * @returns {void}
   */
  function onChange(event) {
    const target = event.target;
    if (!target || typeof target.closest !== "function") {
      return;
    }

    const pick = target.closest("[data-tcm-rv-pick]");
    if (pick && dialog) {
      const id = U.str(pick.dataset.tcmRvPick);
      if (pick.checked) {
        dialog.selected.add(id);
      } else {
        dialog.selected.delete(id);
      }
      render();
      return;
    }

    const reviewer = target.closest("[data-tcm-rv-reviewer]");
    if (reviewer && dialog) {
      const name = U.str(reviewer.dataset.tcmRvReviewer);
      if (reviewer.checked) {
        dialog.reviewers.add(name);
      } else {
        dialog.reviewers.delete(name);
      }
      return;
    }

    const field = target.closest("[data-tcm-rv-field]");
    if (field && dialog) {
      dialog[U.str(field.dataset.tcmRvField)] = target.value;
    }
  }

  /**
   * 视图内 input 事件（意见输入缓存 + 对话框文本字段）。
   * @param {Event} event 事件对象
   * @returns {void}
   */
  function onInput(event) {
    const target = event.target;
    if (!target || typeof target.closest !== "function") {
      return;
    }

    const opinion = target.closest("[data-tcm-rv-opinion]");
    if (opinion && activeTicketId) {
      draftComments.set(`${activeTicketId}::${U.str(opinion.dataset.tcmRvOpinion)}`, target.value);
      return;
    }

    const field = target.closest("[data-tcm-rv-field]");
    if (field && dialog) {
      dialog[U.str(field.dataset.tcmRvField)] = target.value;
    }
  }

  /**
   * 视图内 keydown 事件（Esc 关对话框 / Enter 打开卡片）。
   * @param {KeyboardEvent} event 事件对象
   * @returns {void}
   */
  function onKeydown(event) {
    if (event.key === "Escape" && dialog) {
      dialog = null;
      render();
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    const target = event.target;
    if (!target || typeof target.closest !== "function") {
      return;
    }
    const jump = target.closest("[data-tcm-rv-jump]");
    if (jump) {
      event.preventDefault();
      focusCaseInLibrary(jump.dataset.tcmRvJump);
    }
  }

  /* ------------------------------------------------------------------ *
   * 八、bus 订阅
   * ------------------------------------------------------------------ */

  /**
   * 处理用例库的「发起评审」请求（library 只广播 id，不直接调用本模块）。
   * @param {{action?:string, caseAssetIds?:Array<string>, source?:string}} payload 事件负载
   * @returns {void}
   */
  function onReviewRequested(payload) {
    const data = payload && typeof payload === "object" ? payload : {};
    if (U.str(data.action) !== "request-create") {
      return;
    }
    const ids = U.stringList(data.caseAssetIds);
    if (!ids.length) {
      toast("请先在用例库勾选要评审的用例。", "warning");
      return;
    }
    if (TCM.shell && typeof TCM.shell.setActive === "function") {
      TCM.shell.setActive("review");
    }
    activeTicketId = "";
    openCreateDialog(ids);
  }

  /**
   * 处理「聚焦某张评审单」（追溯图谱 / 用例库反查）。
   * @param {{reviewId?:string}} payload 事件负载
   * @returns {void}
   */
  function onReviewFocus(payload) {
    const data = payload && typeof payload === "object" ? payload : {};
    const reviewId = U.str(data.reviewId);
    if (!reviewId || !findTicket(reviewId)) {
      return;
    }
    if (TCM.shell && typeof TCM.shell.setActive === "function") {
      TCM.shell.setActive("review");
    }
    activeTicketId = reviewId;
    dialog = null;
    render();
  }

  /**
   * 订阅跨模块事件（进程内只订阅一次，与 DOM 挂载解耦）。
   * @returns {void}
   */
  function bindBusOnce() {
    if (busBound || !TCM.bus || typeof TCM.bus.on !== "function") {
      return;
    }
    TCM.bus.on(C.EVENTS.REVIEW_REQUESTED, onReviewRequested);
    TCM.bus.on(C.EVENTS.REVIEW_FOCUS, onReviewFocus);
    TCM.bus.on(C.EVENTS.CASE_DELETED, renderIfVisible);
    TCM.bus.on(C.EVENTS.CASE_UPDATED, renderIfVisible);
    busBound = true;
  }

  /* ------------------------------------------------------------------ *
   * 九、生命周期
   * ------------------------------------------------------------------ */

  /**
   * 挂载：绑定容器级事件（只绑一次）。
   * @param {HTMLElement} [root] 视图容器；缺省时自动查找 #tcmReviewView
   * @returns {void}
   */
  function mount(root) {
    if (!doc) {
      return;
    }
    rootEl = root || doc.getElementById("tcmReviewView");
    if (!rootEl || mounted) {
      return;
    }
    rootEl.addEventListener("click", onClick);
    rootEl.addEventListener("change", onChange);
    rootEl.addEventListener("input", onInput);
    rootEl.addEventListener("keydown", onKeydown);
    mounted = true;
  }

  /**
   * 卸载：解绑 DOM 事件（**不解绑 bus**，bindBusOnce 幂等）。
   * @returns {void}
   */
  function destroy() {
    if (rootEl) {
      rootEl.removeEventListener("click", onClick);
      rootEl.removeEventListener("change", onChange);
      rootEl.removeEventListener("input", onInput);
      rootEl.removeEventListener("keydown", onKeydown);
    }
    dialog = null;
    mounted = false;
  }

  // 模块加载即订阅跨模块事件，保证用例库的「发起评审」在本视图未挂载时也能响应
  bindBusOnce();

  TCM.review = {
    mount,
    render,
    destroy,
    /**
     * 当前状态筛选下的可见评审单数（★ F2）。
     *
     * 供 tcm-shell 的子 Tab 徽标使用：列表页按 `listFilter` 收窄，
     * 徽标要跟着收窄，避免「徽标 8 / 列表 2」的认知落差。
     * @returns {number} 可见评审单条数
     */
    getVisibleCount() {
      const all = collection("reviewTickets");
      return listFilter
        ? all.filter((item) => U.str(item && item.status) === listFilter).length
        : all.length;
    },
    // 供调试 / 验收使用
    openCreateDialog,
    submitVerdict,
    cancelTicket,
    /**
     * 打开指定评审单详情。
     * @param {string} reviewId 评审单 id
     * @returns {void}
     */
    open(reviewId) {
      onReviewFocus({ reviewId });
    },
    _internals: {
      findTicket,
      progressOf,
      reviewerCandidates
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
