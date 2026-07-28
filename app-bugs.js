// Bug creation, editing, workflow, and linked-case synchronization.

function createBugRecord(sourceCase) {
  const firstCase = sourceCase?.id ? sourceCase : null;
  const linkedBug = firstCase ? state.bugs.find((item) => item.caseId === firstCase.id && !["已修复", "已验证", "已关闭"].includes(item.status)) : null;
  const duplicateBug = firstCase ? findPotentialDuplicateBug(firstCase) : null;

  if (linkedBug) {
    switchTab("bugs");
    setBugStatus("这个失败用例已经有关联的未关闭 BUG 了。", "warn");
    openBugModal(linkedBug.id, "view");
    return;
  }

  if (duplicateBug) {
    switchTab("bugs");
    setBugStatus(`疑似重复 BUG：${duplicateBug.title}。可先确认是否复用已有记录。`, "warn");
    openBugModal(duplicateBug.id, "view");
    return;
  }
  switchTab("bugs");
  openBugModal("", "create", firstCase);
}

function openBugModal(bugId = "", mode = bugId ? "view" : "create", sourceCase = null) {
  const bug = state.bugs.find((item) => item.id === bugId) || null;
  const activeTask = getTaskById(state.activeTaskId);
  const activeBatch = getBatchById(state.activeBatchId || activeTask?.batchId);
  bugModalRecordId = bug?.id || "";
  bugModalSourceCaseId = sourceCase?.id || bug?.caseId || "";

  const batchId = sourceCase?.batchId || bug?.batchId || activeBatch?.id || "";
  const taskId = sourceCase?.taskId || bug?.taskId || activeTask?.id || "";
  const caseId = sourceCase?.id || bug?.caseId || "";
  els.bugModalName.value = bug?.title || (sourceCase ? `${sourceCase.title || "未命名用例"} - 缺陷记录` : "");
  els.bugModalSeverity.value = bug?.severity || "中";
  els.bugModalStatus.value = bug?.status || "新建";
  els.bugModalLink.value = bug?.link || "";
  els.bugModalNote.value = bug?.note || buildBugNoteFromCase(sourceCase);
  clearPendingBugImages();
  bugModalExistingImages = Array.isArray(bug?.images) ? bug.images.map((image) => ({ ...image })) : [];
  bugModalRemovedImageIds = [];
  fillBugModalAssociations(batchId, taskId, caseId);
  els.bugModalTrace.innerHTML = bug ? renderTraceMetaHtml(bug) : "";
  els.bugModalFeedback.textContent = mode === "view" ? "当前为只读详情，点击“编辑 BUG”后可修改。" : "填写完整信息后保存 BUG。";
  els.bugModalFeedback.className = "inline-feedback";
  setBugModalMode(mode);
  renderBugModalImages();
  renderBugModalBadges();
  els.bugModal.classList.remove("hidden-field");
  document.body.classList.add("dialog-open");
  window.setTimeout(() => {
    if (mode === "create") els.bugModalName.focus();
  }, 0);
}

function closeBugModal() {
  els.bugModal?.classList.add("hidden-field");
  document.body.classList.remove("dialog-open");
  bugModalRecordId = "";
  bugModalSourceCaseId = "";
  clearPendingBugImages();
  bugModalExistingImages = [];
  bugModalRemovedImageIds = [];
  els.bugForm?.reset();
}

function setBugModalMode(mode) {
  const isView = mode === "view";
  const isCreate = mode === "create";
  els.bugModal.dataset.mode = mode;
  els.bugModalTitle.textContent = isCreate ? "新增 BUG" : isView ? "BUG 详情" : "编辑 BUG";
  els.bugForm.querySelectorAll("input, textarea, select").forEach((control) => {
    control.disabled = isView;
  });
  els.editBugModal.classList.toggle("hidden-field", !isView);
  els.saveBugModal.classList.toggle("hidden-field", isView);
  els.deleteBugModal.classList.toggle("hidden-field", isCreate);
  els.cancelBugModal.textContent = isView ? "关闭" : "取消";
  if (!isView) {
    els.bugModalFeedback.textContent = isCreate ? "填写完整信息后保存 BUG。" : "修改完成后点击保存。";
  }
  renderBugModalImages();
}

function handleBugNotePaste(event) {
  if (els.bugModal?.dataset.mode === "view") return;
  const imageItems = [...(event.clipboardData?.items || [])]
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"));
  if (!imageItems.length) return;

  event.preventDefault();
  const pastedText = event.clipboardData?.getData("text/plain") || "";
  if (pastedText) insertTextAtCursor(els.bugModalNote, pastedText);

  const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
  const availableSlots = Math.max(0, 10 - bugModalExistingImages.length - bugModalPendingImages.length);
  let rejectedMessage = imageItems.length > availableSlots ? "每个 BUG 最多保留 10 张图片。" : "";

  imageItems.slice(0, availableSlots).forEach((item) => {
    const file = item.getAsFile();
    if (!file) return;
    if (!allowedTypes.has(file.type)) {
      rejectedMessage = "仅支持 PNG、JPG 和 WebP 图片。";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      rejectedMessage = "单张图片不能超过 5MB。";
      return;
    }
    bugModalPendingImages.push({
      id: `pending-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file)
    });
  });

  renderBugModalImages();
  els.bugModalPasteHint.textContent = rejectedMessage || `已粘贴 ${bugModalPendingImages.length} 张新图片，保存 BUG 后生效。`;
  els.bugModalPasteHint.classList.toggle("warn", Boolean(rejectedMessage));
}

function insertTextAtCursor(textarea, text) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? start;
  textarea.value = `${textarea.value.slice(0, start)}${text}${textarea.value.slice(end)}`;
  const nextPosition = start + text.length;
  textarea.setSelectionRange(nextPosition, nextPosition);
}

function renderBugModalImages() {
  if (!els.bugModalImagePreview) return;
  const isView = els.bugModal?.dataset.mode === "view";
  const existingHtml = bugModalExistingImages.map((image) => renderBugImageCard(image, image.url, isView, false)).join("");
  const pendingHtml = bugModalPendingImages.map((image) => renderBugImageCard(image, image.previewUrl, isView, true)).join("");
  els.bugModalImagePreview.innerHTML = `${existingHtml}${pendingHtml}`;
  els.bugModalImagePreview.classList.toggle("has-images", Boolean(existingHtml || pendingHtml));
  if (els.bugModalPasteHint) {
    els.bugModalPasteHint.classList.remove("warn");
    els.bugModalPasteHint.textContent = isView
      ? (existingHtml ? `共 ${bugModalExistingImages.length} 张问题截图，点击图片可查看原图。` : "当前 BUG 没有问题截图。")
      : "支持 PNG、JPG、WebP，单张不超过 5MB，最多 10 张。";
  }
}

function renderBugImageCard(image, source, isView, isPending) {
  const removeButton = isView ? "" : `<button type="button" data-remove-bug-image="${escapeHtml(image.id)}" data-pending="${isPending}">移除</button>`;
  return `
    <figure class="bug-note-image-card">
      <a href="${escapeHtml(source)}" target="_blank" rel="noopener" title="查看原图">
        <img src="${escapeHtml(source)}" alt="${escapeHtml(image.fileName || "BUG 截图")}">
      </a>
      <figcaption><span>${escapeHtml(image.fileName || "粘贴的截图")}</span>${removeButton}</figcaption>
    </figure>
  `;
}

function handleBugImagePreviewClick(event) {
  const button = event.target.closest("[data-remove-bug-image]");
  if (!button) return;
  const imageId = button.dataset.removeBugImage;
  if (button.dataset.pending === "true") {
    const pendingImage = bugModalPendingImages.find((image) => image.id === imageId);
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    bugModalPendingImages = bugModalPendingImages.filter((image) => image.id !== imageId);
  } else {
    bugModalExistingImages = bugModalExistingImages.filter((image) => image.id !== imageId);
    bugModalRemovedImageIds.push(imageId);
  }
  renderBugModalImages();
}

function clearPendingBugImages() {
  bugModalPendingImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  bugModalPendingImages = [];
}

async function uploadBugImage(bugId, pendingImage) {
  const response = await fetch(`/api/bug-images?bugId=${encodeURIComponent(bugId)}`, {
    method: "POST",
    headers: {
      "Content-Type": pendingImage.file.type,
      "X-File-Name": encodeURIComponent(pendingImage.file.name || "粘贴的截图")
    },
    body: pendingImage.file
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "图片保存失败");
  return result.image;
}

async function deleteBugImage(bugId, imageId) {
  await fetch(`/api/bug-images/${encodeURIComponent(bugId)}/${encodeURIComponent(imageId)}`, { method: "DELETE" });
}

function fillBugModalAssociations(batchId = "", taskId = "", caseId = "") {
  const batches = state.batches.filter((batch) => !batch.systemManaged);
  els.bugModalBatch.innerHTML = [`<option value="">未关联版本</option>`]
    .concat(batches.map((batch) => `<option value="${batch.id}">${escapeHtml(batch.version || "未命名版本")}</option>`))
    .join("");
  const resolvedBatchId = batches.some((batch) => batch.id === batchId) ? batchId : "";
  els.bugModalBatch.value = resolvedBatchId;

  const tasks = state.tasks.filter((task) => !resolvedBatchId || task.batchId === resolvedBatchId);
  els.bugModalTask.innerHTML = [`<option value="">未关联任务</option>`]
    .concat(tasks.map((task) => `<option value="${task.id}">${escapeHtml(task.name || "未命名任务")}</option>`))
    .join("");
  els.bugModalTask.value = tasks.some((task) => task.id === taskId) ? taskId : "";

  const cases = state.cases.filter((item) => (
    (!resolvedBatchId || item.batchId === resolvedBatchId) && (!taskId || item.taskId === taskId)
  ));
  els.bugModalCase.innerHTML = [`<option value="">未关联用例</option>`]
    .concat(cases.map((item) => `<option value="${item.id}">${escapeHtml(item.title || "未命名用例")}</option>`))
    .join("");
  els.bugModalCase.value = cases.some((item) => item.id === caseId) ? caseId : "";
}

function refreshBugModalAssociations(source) {
  const batchId = els.bugModalBatch.value;
  const taskId = source === "batch" ? "" : els.bugModalTask.value;
  fillBugModalAssociations(batchId, taskId, "");
}

function syncBugModalFromCase() {
  const linkedCase = state.cases.find((item) => item.id === els.bugModalCase.value);
  if (!linkedCase) return;
  fillBugModalAssociations(linkedCase.batchId || "", linkedCase.taskId || "", linkedCase.id);
}

function renderBugModalBadges() {
  if (!els.bugModalBadges) return;
  els.bugModalBadges.innerHTML = `
    <span class="bug-modal-severity severity-${getBugSeverityClass(els.bugModalSeverity.value)}">${escapeHtml(els.bugModalSeverity.value || "中")}</span>
    <span class="bug-modal-status status-${getBugStatusClass(els.bugModalStatus.value)}">${escapeHtml(els.bugModalStatus.value || "新建")}</span>
  `;
}

function getBugSeverityClass(severity) {
  if (severity === "严重") return "critical";
  if (severity === "低") return "low";
  return "medium";
}

function getBugStatusClass(status) {
  if (["已验证", "已关闭"].includes(status)) return "done";
  if (["已修复", "待回归"].includes(status)) return "progress";
  return "open";
}

function getNextBugTransition(status) {
  const transitions = {
    "新建": { status: "已提交", label: "提交 BUG" },
    "已提交": { status: "已修复", label: "标记已修复" },
    "已修复": { status: "待回归", label: "提交回归" },
    "待回归": { status: "已验证", label: "验证通过" },
    "已验证": { status: "已关闭", label: "关闭 BUG" }
  };
  return transitions[status] || null;
}

function isBugCompletedStatus(status) {
  return ["已验证", "已关闭"].includes(status);
}

async function saveBugFromModal(event) {
  event.preventDefault();
  const title = els.bugModalName.value.trim();
  if (!title) {
    els.bugModalFeedback.textContent = "请先填写 BUG 名称。";
    els.bugModalFeedback.className = "inline-feedback warn";
    els.bugModalName.focus();
    return;
  }

  const existingBug = state.bugs.find((item) => item.id === bugModalRecordId);
  const linkedCase = state.cases.find((item) => item.id === els.bugModalCase.value);
  const batch = getBatchById(linkedCase?.batchId || els.bugModalBatch.value);
  const task = getTaskById(linkedCase?.taskId || els.bugModalTask.value);
  const previousStatus = existingBug?.status || "";
  const bugId = existingBug?.id || `bug-${Date.now()}`;
  const uploadedImages = [];
  els.saveBugModal.disabled = true;
  els.bugModalFeedback.textContent = bugModalPendingImages.length ? "正在保存文字和粘贴的图片..." : "正在保存 BUG...";
  try {
    for (const pendingImage of bugModalPendingImages) {
      uploadedImages.push(await uploadBugImage(bugId, pendingImage));
    }
  } catch (error) {
    await Promise.all(uploadedImages.map((image) => deleteBugImage(bugId, image.id)));
    els.saveBugModal.disabled = false;
    els.bugModalFeedback.textContent = error.message || "图片保存失败，请重试。";
    els.bugModalFeedback.className = "inline-feedback warn";
    return;
  }

  const nextBug = {
    ...(existingBug || {}),
    id: bugId,
    title,
    severity: els.bugModalSeverity.value,
    status: els.bugModalStatus.value,
    batchId: batch?.id || "",
    batchVersion: batch?.version || "",
    batchName: batch ? formatBatchLabel(batch) : "",
    taskId: task?.id || "",
    taskName: task?.name || "",
    caseId: linkedCase?.id || "",
    owner: existingBug?.owner || "",
    link: els.bugModalLink.value.trim(),
    note: els.bugModalNote.value.trim(),
    images: [...bugModalExistingImages, ...uploadedImages]
  };
  nextBug.completedAt = isBugCompletedStatus(nextBug.status)
    ? (existingBug?.completedAt || nowIsoString())
    : "";
  const auditedBug = existingBug ? applyUpdateAuditFields(nextBug) : applyCreateAuditFields(nextBug);
  const duplicateBug = findPotentialDuplicateBug(auditedBug, existingBug?.id || "");

  if (existingBug) {
    state.bugs = state.bugs.map((item) => (item.id === existingBug.id ? auditedBug : item));
  } else {
    state.bugs.unshift(auditedBug);
  }
  if (auditedBug.status !== previousStatus || auditedBug.caseId) {
    syncLinkedCaseByBug(auditedBug, isBugCompletedStatus(auditedBug.status) ? "verified" : auditedBug.status === "待回归" ? "pending-regression" : "open");
  }
  persist();
  Promise.all(bugModalRemovedImageIds.map((imageId) => deleteBugImage(bugId, imageId))).catch(() => {});
  els.saveBugModal.disabled = false;
  closeBugModal();
  renderAll();
  setBugStatus(duplicateBug ? `BUG 已保存，但疑似与“${duplicateBug.title}”重复。` : "BUG 已保存。", duplicateBug ? "warn" : "ok");
}

function deleteBugFromModal() {
  const bug = state.bugs.find((item) => item.id === bugModalRecordId);
  if (!bug || !window.confirm(`确认删除 BUG“${bug.title || "未命名 BUG"}”？`)) return;
  state.bugs = state.bugs.filter((item) => item.id !== bug.id);
  fetch(`/api/bug-images?bugId=${encodeURIComponent(bug.id)}`, { method: "DELETE" }).catch(() => {});
  persist();
  closeBugModal();
  renderAll();
  setBugStatus("BUG 已删除。", "warn");
}

function buildBugNoteFromCase(caseItem) {
  if (!caseItem) {
    return "";
  }
  return [
    caseItem.batchVersion ? `关联版本：${caseItem.batchVersion}` : "",
    caseItem.taskName ? `关联任务：${caseItem.taskName}` : "",
    `关联用例：${caseItem.title || "未命名用例"}`,
    `执行状态：${caseItem.executionStatus || "未执行"}`,
    caseItem.executionNote ? `执行备注：${caseItem.executionNote}` : "",
    caseItem.preconditions ? `前置条件：${caseItem.preconditions}` : "",
    caseItem.steps ? `测试步骤：${caseItem.steps}` : "",
    caseItem.expected ? `预期结果：${caseItem.expected}` : ""
  ].filter(Boolean).join("\n");
}

function findPotentialDuplicateBug(sourceCase, excludeBugId = "") {
  if (!sourceCase) {
    return null;
  }

  const normalizedTitle = normalizeBugCompareText(sourceCase.title);
  const sourceCaseId = sourceCase.caseId || sourceCase.id || "";
  return state.bugs.find((item) => {
    if (excludeBugId && item.id === excludeBugId) {
      return false;
    }
    if (["已验证", "已关闭"].includes(item.status)) {
      return false;
    }
    if (sourceCaseId && item.caseId && item.caseId === sourceCaseId) {
      return true;
    }
    const sameTask = !sourceCase.taskId || !item.taskId || sourceCase.taskId === item.taskId;
    const sameBatch = !sourceCase.batchId || !item.batchId || sourceCase.batchId === item.batchId;
    if (!sameTask && !sameBatch) {
      return false;
    }
    if (!normalizedTitle) {
      return false;
    }
    const itemTitle = normalizeBugCompareText(item.title);
    if (!itemTitle) {
      return false;
    }
    return itemTitle.includes(normalizedTitle) || normalizedTitle.includes(itemTitle);
  }) || null;
}

function normalizeBugCompareText(value) {
  return String(value || "").replace(/\s+/g, "").trim().toLowerCase();
}

function renderBugs() {
  const filteredBugs = getFilteredBugs();
  if (els.bugManagerCount) {
    els.bugManagerCount.textContent = `${filteredBugs.length} 个 BUG`;
  }

  if (!filteredBugs.length) {
    els.bugList.innerHTML = `
      <div class="empty-state empty-state-rich">
        <strong>${state.bugs.length ? "没有匹配的 BUG" : "当前还没有 BUG 记录"}</strong>
        <p>${state.bugs.length ? "请调整顶部筛选条件。" : "点击右上角“新增 BUG”，通过弹窗录入问题。"}</p>
        ${state.bugs.length
    ? `<div class="empty-actions"><button class="ghost-button" type="button" data-clear-bug-filters>清空筛选</button></div>`
    : `<div class="empty-actions"><button class="primary-button" type="button" data-open-bug-modal>新增 BUG</button></div>`}
      </div>
    `;
    els.bugList.querySelector("[data-open-bug-modal]")?.addEventListener("click", () => openBugModal());
    els.bugList.querySelector("[data-clear-bug-filters]")?.addEventListener("click", () => {
      els.bugBatchFilter.value = "";
      if (els.bugSearchInput) els.bugSearchInput.value = "";
      if (els.bugSeverityFilter) els.bugSeverityFilter.value = "";
      if (els.bugWorkflowStatusFilter) els.bugWorkflowStatusFilter.value = "";
      renderCaseFilters();
      els.bugTaskFilter.value = "";
      renderBugs();
    });
    return;
  }

  els.bugList.innerHTML = `
    <div class="bug-management-table-wrap">
      <table class="bug-management-table">
        <thead>
          <tr>
            <th>BUG 标题</th>
            <th>严重程度</th>
            <th>创建时间</th>
            <th>完成时间</th>
            <th>当前状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${filteredBugs.map((bug) => {
            const transition = getNextBugTransition(bug.status || "新建");
            return `
              <tr>
                <td class="bug-table-title-cell">
                  <strong class="bug-table-title-text">${escapeHtml(bug.title || "未命名 BUG")}</strong>
                </td>
                <td><span class="badge ${getBugSeverityTone(bug.severity)}">${escapeHtml(bug.severity || "中")}</span></td>
                <td class="bug-table-time">${escapeHtml(formatAuditTime(bug.createdAt))}</td>
                <td class="bug-table-time">${escapeHtml(bug.completedAt ? formatAuditTime(bug.completedAt) : "未完成")}</td>
                <td><span class="badge ${getBugStatusTone(bug.status)}">${escapeHtml(bug.status || "新建")}</span></td>
                <td>
                  <div class="bug-table-actions">
                    ${transition ? `<button class="primary-button bug-transition-button" type="button" data-transition-bug-id="${bug.id}">${escapeHtml(transition.label)}</button>` : `<span class="bug-flow-complete">流程已完成</span>`}
                    <button class="ghost-button" type="button" data-view-bug-id="${bug.id}">查看详情</button>
                  </div>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;

  els.bugList.querySelectorAll("[data-view-bug-id]").forEach((button) => {
    button.addEventListener("click", () => openBugModal(button.dataset.viewBugId, "view"));
  });
  els.bugList.querySelectorAll("[data-transition-bug-id]").forEach((button) => {
    button.addEventListener("click", () => transitionBugStatus(button.dataset.transitionBugId));
  });
}

function transitionBugStatus(bugId) {
  const bug = state.bugs.find((item) => item.id === bugId);
  const transition = getNextBugTransition(bug?.status || "新建");
  if (!bug || !transition) return;

  const nextBug = applyUpdateAuditFields({
    ...bug,
    status: transition.status,
    completedAt: isBugCompletedStatus(transition.status) ? (bug.completedAt || nowIsoString()) : ""
  });
  state.bugs = state.bugs.map((item) => (item.id === bug.id ? nextBug : item));
  syncLinkedCaseByBug(nextBug, isBugCompletedStatus(nextBug.status) ? "verified" : nextBug.status === "待回归" ? "pending-regression" : "open");
  persist();
  renderAll();
  setBugStatus(`BUG 已流转为“${transition.status}”。`, "ok");
}

function renderLegacyBugs() {
  const filteredBugs = getFilteredBugs();
  renderBugHistory();
  if (els.bugManagerCount) {
    els.bugManagerCount.textContent = `${filteredBugs.length} 个 BUG`;
  }
  if (!filteredBugs.length) {
    els.bugList.innerHTML = `
      <div class="empty-state empty-state-rich">
        <strong>当前范围里还没有 BUG 记录</strong>
        <p>执行时发现问题，再点“新增BUG”补进来就行。</p>
        ${state.cases.length ? `<div class="empty-actions"><button class="primary-button" id="emptyAddBugBtn">新增BUG</button></div>` : ""}
      </div>
    `;
    const emptyAddBugBtn = document.getElementById("emptyAddBugBtn");
    if (emptyAddBugBtn) {
      emptyAddBugBtn.addEventListener("click", createBugRecord);
    }
    return;
  }

  els.bugList.innerHTML = "";
  filteredBugs.forEach((bug) => {
    const node = els.bugTemplate.content.firstElementChild.cloneNode(true);
    ensureBugBatchField(node);
    ensureBugTaskField(node);
    const detail = node.querySelector(".bug-detail");
    const detailToggle = node.querySelector(".toggle-bug-detail");
    const saveButton = node.querySelector(".save-bug");
    node.querySelector(".bug-title").value = bug.title;
    fillBugBatchOptions(node.querySelector(".bug-batch"), bug.batchId);
    fillBugTaskOptions(node.querySelector(".bug-task"), bug.taskId, bug.batchId);
    fillCaseOptions(node.querySelector(".bug-case"), bug.caseId, bug.batchId, bug.taskId);
    syncBugLinkedInfo(node, bug);
    node.querySelector(".bug-severity").value = bug.severity;
    node.querySelector(".bug-status").value = bug.status;
    syncBugBadges(node, bug.severity, bug.status);
    syncBugSourceBadge(node, bug);
    fillOwnerSelect(node.querySelector(".bug-owner"), bug.owner, "未选择");
    node.querySelector(".bug-link").value = bug.link;
    node.querySelector(".bug-note").value = bug.note;
    const bugTraceMeta = node.querySelector(".bug-trace-meta");
    if (bugTraceMeta) {
      bugTraceMeta.innerHTML = renderTraceMetaHtml(bug, bug.owner || "未记录");
    }
    const regressionButton = node.querySelector(".mark-bug-regression");
    const verifyButton = node.querySelector(".mark-bug-verified");
    regressionButton.classList.toggle("hidden-field", bug.status !== "已修复");
    verifyButton.classList.toggle("hidden-field", !["待回归", "已修复"].includes(bug.status));
    if (bug.id === activeBugEditorId) {
      detail.classList.remove("hidden-field");
      detailToggle.textContent = "收起详情";
    }

    detailToggle.addEventListener("click", () => {
      const isHidden = detail.classList.contains("hidden-field");
      detail.classList.toggle("hidden-field", !isHidden);
      detailToggle.textContent = isHidden ? "收起详情" : "展开详情";
      activeBugEditorId = isHidden ? bug.id : "";
    });

    node.querySelectorAll("input, textarea, select").forEach((control) => {
      control.addEventListener("input", () => markBugCardDirty(node));
      control.addEventListener("change", () => {
        if (control.classList.contains("bug-batch")) {
          const selectedBatchId = control.value || "";
          const taskSelect = node.querySelector(".bug-task");
          const caseSelect = node.querySelector(".bug-case");
          fillBugTaskOptions(taskSelect, "", selectedBatchId);
          fillCaseOptions(caseSelect, "", selectedBatchId, "");
          syncBugLinkedInfo(node, {
            ...getBugDraftFromNode(node, bug),
            batchId: selectedBatchId,
            taskId: "",
            caseId: ""
          });
        }
        if (control.classList.contains("bug-task")) {
          const selectedBatchId = node.querySelector(".bug-batch")?.value || "";
          const selectedTaskId = control.value || "";
          const caseSelect = node.querySelector(".bug-case");
          fillCaseOptions(caseSelect, "", selectedBatchId, selectedTaskId);
          syncBugLinkedInfo(node, {
            ...getBugDraftFromNode(node, bug),
            batchId: selectedBatchId,
            taskId: selectedTaskId,
            caseId: ""
          });
        }
        if (control.classList.contains("bug-case")) {
          syncBugLinkedInfo(node, getBugDraftFromNode(node, bug));
        }
        if (control.classList.contains("bug-severity") || control.classList.contains("bug-status")) {
          syncBugBadges(
            node,
            node.querySelector(".bug-severity")?.value || bug.severity,
            node.querySelector(".bug-status")?.value || bug.status
          );
        }
        markBugCardDirty(node);
      });
    });

    saveButton.addEventListener("click", () => {
      updateBugFromNode(node, bug.id);
      markBugCardSaved(node);
      detail.classList.add("hidden-field");
      detailToggle.textContent = "展开详情";
      activeBugEditorId = "";
      renderBugHistory();
      setBugStatus("BUG 已保存。", "ok");
      flashButtonSuccess(saveButton, "保存成功");
    });

    regressionButton.addEventListener("click", () => {
      bug.status = "待回归";
      Object.assign(bug, applyUpdateAuditFields(bug));
      syncLinkedCaseByBug(bug, "pending-regression");
      persist();
      renderAll();
      setBugStatus("BUG 已标记为待回归。", "ok");
    });

    verifyButton.addEventListener("click", () => {
      bug.status = "已验证";
      Object.assign(bug, applyUpdateAuditFields(bug));
      syncLinkedCaseByBug(bug, "verified");
      persist();
      renderAll();
      setBugStatus("BUG 已标记为回归通过，关联用例已更新为通过。", "ok");
    });

    node.querySelector(".delete-bug").addEventListener("click", () => {
      if (!confirm(`确认删除 BUG「${bug.title || "未命名BUG"}」吗？删除后无法撤销。`)) {
        return;
      }
      state.bugs = state.bugs.filter((item) => item.id !== bug.id);
      if (activeBugEditorId === bug.id) activeBugEditorId = "";
      persist();
      renderAll();
      setBugStatus("BUG 已删除。", "warn");
    });

    els.bugList.appendChild(node);
  });
}

function renderBugHistory() {
  if (!els.bugHistoryList) {
    return;
  }
  const recentBugs = [...state.bugs]
    .sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")))
    .slice(0, 6);

  if (!recentBugs.length) {
    els.bugHistoryList.innerHTML = `
      <div class="bug-history-empty">
        <strong>暂无活动记录</strong>
        <p>新增或更新 BUG 后，最近活动会展示在这里。</p>
      </div>
    `;
    return;
  }

  els.bugHistoryList.innerHTML = recentBugs.map((bug) => `
    <article class="bug-history-item">
      <span class="bug-history-dot tone-${getBugHistoryTone(bug.status)}"></span>
      <div>
        <strong>${escapeHtml(bug.title || "未命名 BUG")}</strong>
        <p>${escapeHtml(bug.batchVersion || "未关联版本")} · ${escapeHtml(bug.taskName || "未关联任务")}</p>
      </div>
      <span class="bug-history-status">${escapeHtml(bug.status || "新建")}</span>
      <time>${escapeHtml(formatAuditTime(bug.updatedAt || bug.createdAt))}</time>
    </article>
  `).join("");
}

function getBugHistoryTone(status) {
  if (["已验证", "已关闭"].includes(status)) return "green";
  if (["已修复", "待回归"].includes(status)) return "orange";
  return "red";
}

function markBugCardDirty(node) {
  node.classList.add("is-dirty");
  const saveState = node.querySelector(".bug-save-state");
  if (saveState) {
    saveState.textContent = "未保存";
  }
}

function markBugCardSaved(node) {
  node.classList.remove("is-dirty");
  const saveState = node.querySelector(".bug-save-state");
  if (saveState) {
    saveState.textContent = "已保存";
  }
}

function ensureBugBatchField(node) {
  const caseRow = node.querySelector(".bug-row-grid");
  const caseLabel = node.querySelector(".bug-case")?.closest("label");
  node.querySelector(".bug-linked-info")?.remove();
  if (!caseRow || !caseLabel || caseRow.querySelector(".bug-batch")) {
    return;
  }

  const batchLabel = document.createElement("label");
  batchLabel.innerHTML = `
    <span>关联版本</span>
    <select class="bug-batch"></select>
  `;
  caseRow.insertBefore(batchLabel, caseLabel);
}

function ensureBugTaskField(node) {
  const caseRow = node.querySelector(".bug-row-grid");
  const caseLabel = node.querySelector(".bug-case")?.closest("label");
  if (!caseRow || !caseLabel || caseRow.querySelector(".bug-task")) {
    return;
  }

  const taskLabel = document.createElement("label");
  taskLabel.innerHTML = `
    <span>关联任务</span>
    <select class="bug-task"></select>
  `;
  caseRow.insertBefore(taskLabel, caseLabel);
}

function fillBugBatchOptions(select, selectedBatchId) {
  if (!select) {
    return;
  }
  const options = [`<option value="">未关联</option>`]
    .concat(buildCaseBatchFilterOptions("bugs").map((item) => `<option value="${item.id}">${escapeHtml(formatTaskBatchLabel(item))}</option>`));
  select.innerHTML = options.join("");
  const availableIds = buildCaseBatchFilterOptions("bugs").map((item) => item.id);
  select.value = selectedBatchId && availableIds.includes(selectedBatchId) ? selectedBatchId : "";
}

function fillBugTaskOptions(select, selectedTaskId, batchId = "") {
  if (!select) {
    return;
  }
  const tasks = getTaskOptionsByBatchForEditor(batchId, "bugs");
  select.innerHTML = [`<option value="">未关联</option>`]
    .concat(tasks.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`))
    .join("");
  const hasSelected = tasks.some((item) => item.id === selectedTaskId);
  select.value = hasSelected ? selectedTaskId : "";
}

function fillCaseOptions(select, selectedId, batchId = "", taskId = "") {
  const cases = state.cases.filter((item) => matchesBatchFilter(item, batchId) && (!taskId || item.taskId === taskId || item.taskName === taskId));
  select.innerHTML = [`<option value="">未关联</option>`]
    .concat(cases.map((item) => `<option value="${item.id}">${escapeHtml(item.title)}</option>`))
    .join("");
  const hasSelected = cases.some((item) => item.id === selectedId);
  select.value = hasSelected ? selectedId : "";
}

function syncBugLinkedInfo(node, bug) {
  if (!node.querySelector(".bug-linked-version") && !node.querySelector(".bug-linked-meta")) {
    return;
  }
  const caseId = node.querySelector(".bug-case")?.value || bug.caseId;
  const batchId = node.querySelector(".bug-batch")?.value || bug.batchId;
  const taskId = node.querySelector(".bug-task")?.value || bug.taskId;
  const linkedCase = state.cases.find((caseItem) => caseItem.id === caseId);
  const batch = linkedCase ? getBatchById(linkedCase.batchId) : getBatchById(batchId);
  const task = linkedCase ? getTaskById(linkedCase.taskId) : getTaskById(taskId);
  const versionText = linkedCase?.batchVersion || batch?.version || bug.batchVersion || "未关联版本";
  const taskText = linkedCase?.taskName || task?.name || bug.taskName || "未关联任务";

  const versionNode = node.querySelector(".bug-linked-version");
  const metaNode = node.querySelector(".bug-linked-meta");
  if (versionNode) {
    versionNode.textContent = versionText;
  }
  if (metaNode) {
    metaNode.textContent = `任务：${taskText}`;
  }
}

function getBugDraftFromNode(node, fallbackBug) {
  return {
    ...fallbackBug,
    batchId: node.querySelector(".bug-batch")?.value || fallbackBug.batchId || "",
    taskId: node.querySelector(".bug-task")?.value || fallbackBug.taskId || "",
    caseId: node.querySelector(".bug-case")?.value || ""
  };
}

function updateBugFromNode(node, bugId) {
  const item = state.bugs.find((bug) => bug.id === bugId);
  if (!item) {
    return;
  }

  const previousStatus = item.status;

  item.title = node.querySelector(".bug-title").value.trim() || "未命名BUG";
  item.batchId = node.querySelector(".bug-batch")?.value || item.batchId;
  item.taskId = node.querySelector(".bug-task")?.value || item.taskId;
  item.caseId = node.querySelector(".bug-case").value;
  item.severity = node.querySelector(".bug-severity").value;
  item.status = node.querySelector(".bug-status").value;
  item.owner = node.querySelector(".bug-owner").value.trim();
  item.link = node.querySelector(".bug-link").value.trim();
  item.note = node.querySelector(".bug-note").value.trim();

  if (item.caseId) {
    const linkedCase = state.cases.find((caseItem) => caseItem.id === item.caseId);
    if (linkedCase) {
      item.taskId = linkedCase.taskId || item.taskId;
      item.taskName = linkedCase.taskName || item.taskName;
      item.batchId = linkedCase.batchId || item.batchId;
      item.batchName = linkedCase.batchName || item.batchName;
      item.batchVersion = linkedCase.batchVersion || item.batchVersion;
    }
  } else if (item.batchId) {
    const batch = getBatchById(item.batchId);
    if (batch) {
      item.batchVersion = batch.version || item.batchVersion;
      item.batchName = formatBatchLabel(batch);
    }
  }

  if (item.taskId) {
    item.taskName = getTaskNameById(item.taskId) || node.querySelector(".bug-task")?.selectedOptions?.[0]?.textContent?.trim() || item.taskName;
  } else if (!item.caseId) {
    item.taskName = "";
  }
  Object.assign(item, applyUpdateAuditFields(item));

  const duplicateBug = findPotentialDuplicateBug({
    caseId: item.caseId,
    taskId: item.taskId,
    batchId: item.batchId,
    title: item.title
  }, item.id);

  if (duplicateBug) {
    setBugStatus(`已保存，但疑似与 BUG「${duplicateBug.title}」重复，请确认是否需要合并。`, "warn");
  }

  if (item.status !== previousStatus || item.caseId) {
    syncLinkedCaseByBug(item, isBugCompletedStatus(item.status) ? "verified" : item.status === "待回归" ? "pending-regression" : "open");
  }

  syncBugBadges(node, item.severity, item.status);
  syncBugSourceBadge(node, item);
  syncBugLinkedInfo(node, item);
  const bugTraceMeta = node.querySelector(".bug-trace-meta");
  if (bugTraceMeta) {
    bugTraceMeta.innerHTML = renderTraceMetaHtml(item, item.owner || "未记录");
  }
  node.querySelector(".mark-bug-regression").classList.toggle("hidden-field", item.status !== "已修复");
  node.querySelector(".mark-bug-verified").classList.toggle("hidden-field", !["待回归", "已修复"].includes(item.status));
  persist();
  renderQuickStats();
  renderReport();
}

function syncLinkedCaseByBug(bug, mode) {
  if (!bug?.caseId) {
    return;
  }

  const linkedCase = state.cases.find((item) => item.id === bug.caseId);
  if (!linkedCase) {
    return;
  }

  if (mode === "verified") {
    linkedCase.executionStatus = "通过";
    linkedCase.executionNote = appendExecutionNote(linkedCase.executionNote, `关联BUG已回归通过：${bug.title || "未命名BUG"}`);
    return;
  }

  linkedCase.executionStatus = "失败";

  if (mode === "pending-regression") {
    linkedCase.executionNote = appendExecutionNote(linkedCase.executionNote, `关联BUG待回归：${bug.title || "未命名BUG"}`);
    return;
  }

  if (["新建", "已提交", "已修复"].includes(bug.status)) {
    linkedCase.executionNote = appendExecutionNote(linkedCase.executionNote, `关联BUG跟进中：${bug.title || "未命名BUG"}（${bug.status}）`);
  }
}

function appendExecutionNote(original, extra) {
  const base = String(original || "").trim();
  const next = String(extra || "").trim();
  if (!next) {
    return base;
  }
  if (!base) {
    return next;
  }
  if (base.includes(next)) {
    return base;
  }
  return `${base}\n${next}`;
}

function syncExecutionStatusBadge(node, status) {
  node.textContent = status;
  applyBadgeTone(node, getExecutionStatusTone(status));
}

function syncBugBadges(node, severity, status) {
  const severityBadge = node.querySelector(".bug-severity-badge");
  const statusBadge = node.querySelector(".bug-status-badge");
  severityBadge.textContent = severity;
  statusBadge.textContent = status;
  applyBadgeTone(severityBadge, getBugSeverityTone(severity));
  applyBadgeTone(statusBadge, getBugStatusTone(status));
}

function syncBugSourceBadge(node, bug) {
  const badge = node.querySelector(".bug-source-badge");
  if (!badge) {
    return;
  }
  const linkedCase = state.cases.find((item) => item.id === bug.caseId);
  const fromFailedCase = linkedCase?.executionStatus === "失败";
  badge.classList.toggle("hidden-field", !fromFailedCase);
  if (fromFailedCase) {
    badge.textContent = "来源于失败用例";
    applyBadgeTone(badge, "tone-red");
  }
}

function applyBadgeTone(node, tone) {
  node.classList.remove("tone-green", "tone-red", "tone-orange", "tone-gray", "subtle");
  node.classList.add(tone || "tone-gray");
}

function getCaseTypeTone(type) {
  if (type === "正常") return "tone-green";
  if (type === "异常") return "tone-red";
  return "tone-orange";
}

function getPriorityTone(priority) {
  if (priority === "P0") return "tone-red";
  if (priority === "P1") return "tone-orange";
  if (priority === "P2") return "tone-green";
  return "tone-gray";
}

function getExecutionStatusTone(status) {
  if (status === "通过") return "tone-green";
  if (status === "失败") return "tone-red";
  if (status === "阻塞") return "tone-orange";
  return "tone-gray";
}

function getBugSeverityTone(severity) {
  if (severity === "严重") return "tone-red";
  if (severity === "中") return "tone-orange";
  return "tone-green";
}

function getBugStatusTone(status) {
  if (status === "新建") return "tone-red";
  if (status === "已提交") return "tone-orange";
  if (status === "待回归") return "tone-orange";
  if (["已修复", "已验证"].includes(status)) return "tone-green";
  return "tone-gray";
}
