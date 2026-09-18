/* ============================================================================
   UI — reusable render fragments + modal/toast/notification/palette controllers.
   Palette is intentionally restricted to WHITE / GRAY / YELLOW / RED (see spec).
   ============================================================================ */

(function (global) {
  "use strict";

  const STATUS_BADGE_MAP = {
    // transfers
    QUEUED: "gray", RUNNING: "white", PAUSED: "yellow", COMPLETED: "white",
    FAILED: "red", CANCELLED: "gray",
    // servers / connections
    ONLINE: "white", OFFLINE: "gray", UNKNOWN: "gray", ERROR: "red",
    CONNECTED: "white", DISCONNECTED: "gray",
    // users / audit
    ACTIVE: "white", DISABLED: "gray", SUCCESS: "white", FAILED_AUDIT: "red",
    // notifications / logs
    INFO: "gray", WARNING: "yellow",
  };

  function statusBadge(status, label) {
    const variant = STATUS_BADGE_MAP[status] || "gray";
    const dotClass = variant === "white" ? "dot-ok" : variant === "yellow" ? "dot-warn" : variant === "red" ? "dot-err" : "";
    return `<span class="badge badge-${variant}"><span class="dot ${dotClass}"></span>${U.escapeHtml(label || status)}</span>`;
  }

  function roleBadge(role) {
    const variant = role === "ADMIN" ? "yellow" : role === "OPERATOR" ? "white" : "gray";
    return `<span class="badge badge-${variant}">${role}</span>`;
  }

  function progressBar(progress, status) {
    const pct = Math.max(0, Math.min(100, progress || 0));
    return `<div class="progress-track"><div class="progress-fill ${status}" style="width:${pct}%"></div></div>`;
  }

  function barRow(label, pct, warnAt, errAt) {
    const cls = errAt !== undefined && pct >= errAt ? "err" : warnAt !== undefined && pct >= warnAt ? "warn" : "";
    return `<div class="bar-row">
      <div class="bar-label">${U.escapeHtml(label)}</div>
      <div class="bar-track"><div class="bar-fill ${cls}" style="width:${pct}%"></div></div>
      <div class="bar-value">${pct}%</div>
    </div>`;
  }

  function emptyState(command, message) {
    return `<div class="state-block">
      <div class="prompt">$ ${U.escapeHtml(command)}</div>
      <div>${U.escapeHtml(message)}</div>
    </div>`;
  }

  function loadingState(message) {
    return `<div class="state-block"><span class="loading-line">${U.escapeHtml(message || "LOADING")}<span class="loading-dots"></span></span></div>`;
  }

  function errorBox(code, title, message, actionsHtml) {
    return `<div class="error-box">
      <div class="e-code">[ERROR ${code}]</div>
      <div class="e-title">${U.escapeHtml(title)}</div>
      <div>${U.escapeHtml(message)}</div>
      ${actionsHtml ? `<div style="margin-top:10px">${actionsHtml}</div>` : ""}
    </div>`;
  }

  function pagination(total, page, pageSize) {
    const pages = Math.max(1, Math.ceil(total / pageSize));
    let html = `<div class="pagination" data-total-pages="${pages}">`;
    html += `<span>PAGE</span>`;
    html += `<button data-page="${Math.max(1, page - 1)}" ${page <= 1 ? "disabled" : ""}>&lt;</button>`;
    const start = Math.max(1, page - 2);
    const end = Math.min(pages, start + 4);
    for (let p = start; p <= end; p++) {
      html += `<button data-page="${p}" class="${p === page ? "active" : ""}">${p}</button>`;
    }
    html += `<button data-page="${Math.min(pages, page + 1)}" ${page >= pages ? "disabled" : ""}>&gt;</button>`;
    html += `<span>OF ${pages} (${total} RECORDS)</span>`;
    html += `</div>`;
    return html;
  }

  // ---------------------------------------------------------------------
  // Modal
  // ---------------------------------------------------------------------
  function openModal({ title, body, foot, wide, onMount }) {
    const overlay = U.qs("#modal-overlay");
    const box = U.qs("#modal-box");
    box.className = "modal-box" + (wide ? " wide" : "");
    box.innerHTML = `
      <div class="modal-head">
        <span class="modal-title">${U.escapeHtml(title)}</span>
        <button class="icon-btn" id="modal-close-btn">✕</button>
      </div>
      <div class="modal-body">${body}</div>
      ${foot ? `<div class="modal-foot">${foot}</div>` : ""}
    `;
    overlay.classList.remove("hidden");
    U.qs("#modal-close-btn", box).addEventListener("click", closeModal);
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
    if (onMount) onMount(box);
  }

  function closeModal() {
    U.qs("#modal-overlay").classList.add("hidden");
    U.qs("#modal-box").innerHTML = "";
  }

  function confirmModal(message, { title, danger } = {}, onConfirm) {
    openModal({
      title: title || "CONFIRM ACTION",
      body: `<p>${U.escapeHtml(message)}</p>`,
      foot: `<button class="btn btn-ghost" id="cm-cancel">CANCEL</button>
             <button class="btn ${danger ? "btn-danger" : "btn-primary"}" id="cm-ok">CONFIRM</button>`,
      onMount: (box) => {
        U.qs("#cm-cancel", box).addEventListener("click", closeModal);
        U.qs("#cm-ok", box).addEventListener("click", () => { closeModal(); onConfirm(); });
      },
    });
  }

  // ---------------------------------------------------------------------
  // Toasts
  // ---------------------------------------------------------------------
  function toast(level, title, message, timeout) {
    const stack = U.qs("#toast-stack");
    const node = U.el(`<div class="toast ${level}">
      <div class="t-title">[${level}] ${U.escapeHtml(title)}</div>
      <div>${U.escapeHtml(message || "")}</div>
    </div>`);
    stack.appendChild(node);
    setTimeout(() => {
      node.style.opacity = "0";
      node.style.transition = "opacity .2s";
      setTimeout(() => node.remove(), 200);
    }, timeout || 4200);
  }

  // ---------------------------------------------------------------------
  // Notifications drawer
  // ---------------------------------------------------------------------
  function renderNotifications() {
    const list = DB.state.notifications;
    const unread = list.filter((n) => !n.read).length;
    const countEl = U.qs("#notif-count");
    if (unread > 0) { countEl.textContent = String(unread); countEl.classList.remove("hidden"); }
    else countEl.classList.add("hidden");

    const body = U.qs("#notif-list");
    if (list.length === 0) {
      body.innerHTML = emptyState("tail -f /var/log/notifications", "No notifications.");
      return;
    }
    body.innerHTML = list.map((n) => `
      <div class="notif-item ${n.level} ${n.read ? "" : "unread"}" data-id="${n.id}">
        <div><span class="tag">${n.level}</span>${U.escapeHtml(n.message)}</div>
        <div class="time">${U.formatDateTime(n.createdAt)} · ${U.timeAgo(n.createdAt)}</div>
      </div>
    `).join("");
  }

  function pushNotification(level, message) {
    const n = { id: DB.uid("ntf"), level, message, createdAt: DB.isoNow(), read: false };
    DB.state.notifications.unshift(n);
    DB.state.notifications = DB.state.notifications.slice(0, 100);
    DB.save();
    renderNotifications();
    toast(level, level === "ERROR" ? "ERROR" : level === "WARNING" ? "WARNING" : "INFO", message);
  }

  // ---------------------------------------------------------------------
  // Audit logging (in-memory + persisted, mirrors section 14)
  // ---------------------------------------------------------------------
  function recordAudit(action, target, status, details) {
    const session = DB.state.session;
    DB.state.auditLogs.unshift({
      id: DB.uid("aud"), timestamp: DB.isoNow(), userId: null,
      username: session.username, action, target, status: status || "SUCCESS", details: details || null,
    });
    DB.save();
  }

  global.UI = {
    statusBadge, roleBadge, progressBar, barRow, emptyState, loadingState, errorBox,
    pagination, openModal, closeModal, confirmModal, toast, renderNotifications,
    pushNotification, recordAudit,
  };
})(window);
