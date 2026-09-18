/* ============================================================================
   PAGE: /logs — audit log viewer
   ============================================================================ */

(function (global) {
  "use strict";

  const state = { search: "", user: "", action: "", status: "", from: "", to: "", page: 1, pageSize: 15 };

  function filtered() {
    let items = DB.state.auditLogs.slice();
    if (state.user) items = items.filter((a) => a.username === state.user);
    if (state.action) items = items.filter((a) => a.action === state.action);
    if (state.status) items = items.filter((a) => a.status === state.status);
    if (state.from) items = items.filter((a) => a.timestamp >= state.from);
    if (state.to) items = items.filter((a) => a.timestamp <= state.to + "T23:59:59");
    if (state.search) {
      const s = state.search.toLowerCase();
      items = items.filter((a) => a.target.toLowerCase().includes(s) || a.action.toLowerCase().includes(s) || a.username.toLowerCase().includes(s));
    }
    return items;
  }

  function render(container) {
    const users = [...new Set(DB.state.auditLogs.map((a) => a.username))];
    const actions = [...new Set(DB.state.auditLogs.map((a) => a.action))];
    const items = filtered();
    const total = items.length;
    const start = (state.page - 1) * state.pageSize;
    const pageItems = items.slice(start, start + state.pageSize);

    container.innerHTML = `
      <div class="page-head">
        <div><span class="page-title">AUDIT LOGS</span><span class="page-path">/logs</span></div>
        <div class="page-actions"><button class="btn" id="log-export">EXPORT CSV</button></div>
      </div>

      <div class="filter-bar">
        <span class="filter-label">USER</span>
        <select id="lg-user"><option value="">ALL</option>${users.map((u) => `<option ${state.user === u ? "selected" : ""}>${u}</option>`).join("")}</select>
        <span class="filter-label">ACTION</span>
        <select id="lg-action"><option value="">ALL</option>${actions.map((a) => `<option ${state.action === a ? "selected" : ""}>${a}</option>`).join("")}</select>
        <span class="filter-label">STATUS</span>
        <select id="lg-status"><option value="">ALL</option><option ${state.status === "SUCCESS" ? "selected" : ""}>SUCCESS</option><option ${state.status === "FAILED" ? "selected" : ""}>FAILED</option></select>
        <span class="filter-label">FROM</span><input type="date" id="lg-from" value="${state.from}" />
        <span class="filter-label">TO</span><input type="date" id="lg-to" value="${state.to}" />
        <input type="text" id="lg-search" placeholder="search target/action/user..." value="${U.escapeHtml(state.search)}" style="min-width:200px" />
        <span class="spacer"></span>
        <button class="btn btn-ghost btn-xs" id="lg-clear">CLEAR</button>
      </div>

      <div class="panel">
        <div class="terminal-body" style="background:#000;max-height:none;">
          ${pageItems.length === 0 ? UI.emptyState("tail -f /var/log/audit.log", "No matching log entries.") : pageItems.map((a) => `
            <div class="terminal-line ${a.status === "FAILED" ? "ERROR" : "OK"}">[${U.formatDateTime(a.timestamp)}] USER: ${U.escapeHtml(a.username)}  ACTION: ${U.escapeHtml(a.action)}  TARGET: ${U.escapeHtml(a.target)}  STATUS: ${a.status}${a.details ? "  — " + U.escapeHtml(a.details) : ""}</div>
          `).join("")}
        </div>
        ${total > 0 ? UI.pagination(total, state.page, state.pageSize) : ""}
      </div>
    `;

    U.qs("#lg-user").addEventListener("change", (e) => { state.user = e.target.value; state.page = 1; render(container); });
    U.qs("#lg-action").addEventListener("change", (e) => { state.action = e.target.value; state.page = 1; render(container); });
    U.qs("#lg-status").addEventListener("change", (e) => { state.status = e.target.value; state.page = 1; render(container); });
    U.qs("#lg-from").addEventListener("change", (e) => { state.from = e.target.value; state.page = 1; render(container); });
    U.qs("#lg-to").addEventListener("change", (e) => { state.to = e.target.value; state.page = 1; render(container); });
    U.qs("#lg-search").addEventListener("input", U.debounce((e) => { state.search = e.target.value; state.page = 1; render(container); }, 200));
    U.qs("#lg-clear").addEventListener("click", () => { Object.assign(state, { search: "", user: "", action: "", status: "", from: "", to: "", page: 1 }); render(container); });
    U.qs("#log-export").addEventListener("click", () => {
      const header = ["Timestamp", "User", "Action", "Target", "Status", "Details"];
      const rows = items.map((a) => [a.timestamp, a.username, a.action, a.target, a.status, a.details || ""]);
      const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
      U.downloadBlob("audit-logs-export.csv", csv, "text/csv");
    });
    const pag = U.qs(".pagination");
    if (pag) pag.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-page]");
      if (btn && !btn.disabled) { state.page = Number(btn.dataset.page); render(container); }
    });
  }

  global.PAGES = global.PAGES || {};
  global.PAGES.logs = { render };
})(window);
