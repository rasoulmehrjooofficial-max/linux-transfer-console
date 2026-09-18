/* ============================================================================
   PAGE: /history — full transfer history with date/year/month/day drill-down
   ============================================================================ */

(function (global) {
  "use strict";

  const state = { year: "", month: "", day: "", user: "", status: "", search: "", sortKey: "createdAt", sortDir: -1, page: 1, pageSize: 15 };

  function partsOf(iso) {
    const d = new Date(iso);
    return { y: d.getFullYear(), m: d.getMonth() + 1, day: d.getDate() };
  }

  function filtered() {
    let items = DB.state.transfers.slice();
    if (state.year) items = items.filter((t) => partsOf(t.createdAt).y === Number(state.year));
    if (state.month) items = items.filter((t) => partsOf(t.createdAt).m === Number(state.month));
    if (state.day) items = items.filter((t) => partsOf(t.createdAt).day === Number(state.day));
    if (state.user) items = items.filter((t) => t.username === state.user);
    if (state.status) items = items.filter((t) => t.status === state.status);
    if (state.search) {
      const s = state.search.toLowerCase();
      items = items.filter((t) => t.fileName.toLowerCase().includes(s) || t.code.toLowerCase().includes(s));
    }
    items.sort((a, b) => {
      const av = a[state.sortKey], bv = b[state.sortKey];
      return av < bv ? -1 * state.sortDir : av > bv ? 1 * state.sortDir : 0;
    });
    return items;
  }

  function render(container) {
    const years = [...new Set(DB.state.transfers.map((t) => partsOf(t.createdAt).y))].sort((a, b) => b - a);
    const users = [...new Set(DB.state.transfers.map((t) => t.username))];
    const items = filtered();
    const total = items.length;
    const start = (state.page - 1) * state.pageSize;
    const pageItems = items.slice(start, start + state.pageSize);

    container.innerHTML = `
      <div class="page-head">
        <div><span class="page-title">TRANSFER HISTORY</span><span class="page-path">/history</span></div>
        <div class="page-actions"><button class="btn" id="hist-export">EXPORT CSV</button></div>
      </div>

      <div class="filter-bar">
        <span class="filter-label">YEAR</span>
        <select id="h-year"><option value="">ALL</option>${years.map((y) => `<option ${state.year == y ? "selected" : ""}>${y}</option>`).join("")}</select>
        <span class="filter-label">MONTH</span>
        <select id="h-month"><option value="">ALL</option>${Array.from({length:12},(_,i)=>i+1).map((m) => `<option value="${m}" ${state.month == m ? "selected" : ""}>${String(m).padStart(2,"0")}</option>`).join("")}</select>
        <span class="filter-label">DAY</span>
        <select id="h-day"><option value="">ALL</option>${Array.from({length:31},(_,i)=>i+1).map((d) => `<option value="${d}" ${state.day == d ? "selected" : ""}>${String(d).padStart(2,"0")}</option>`).join("")}</select>
        <span class="filter-label">USER</span>
        <select id="h-user"><option value="">ALL</option>${users.map((u) => `<option ${state.user === u ? "selected" : ""}>${u}</option>`).join("")}</select>
        <span class="filter-label">STATUS</span>
        <select id="h-status"><option value="">ALL</option>${["QUEUED","RUNNING","PAUSED","COMPLETED","FAILED","CANCELLED"].map((s) => `<option ${state.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
        <input type="text" id="h-search" placeholder="search code / file..." value="${U.escapeHtml(state.search)}" style="min-width:180px" />
        <span class="spacer"></span>
        <button class="btn btn-ghost btn-xs" id="h-clear">CLEAR</button>
      </div>

      <div class="panel">
        <div class="table-wrap">
          ${pageItems.length === 0 ? UI.emptyState("history --all", "No transfer records match this filter.") : `
          <table class="data-table" id="hist-table">
            <thead><tr>
              <th data-sort="code">ID</th><th data-sort="createdAt">DATE</th><th>TIME</th><th data-sort="username">USER</th>
              <th data-sort="fileName">FILE</th><th data-sort="fileSize">SIZE</th><th>PROTOCOL</th><th data-sort="durationSeconds">DURATION</th><th data-sort="status">STATUS</th>
            </tr></thead>
            <tbody>
              ${pageItems.map((t) => `
                <tr data-id="${t.id}">
                  <td class="mono">${t.code}</td>
                  <td>${U.formatDate(t.createdAt)}</td>
                  <td>${U.formatTime(t.createdAt)}</td>
                  <td>${U.escapeHtml(t.username)}</td>
                  <td>${U.escapeHtml(t.fileName)}</td>
                  <td>${U.formatBytes(t.fileSize)}</td>
                  <td>${t.protocol}</td>
                  <td>${U.formatDuration(t.durationSeconds)}</td>
                  <td>${UI.statusBadge(t.status)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>`}
        </div>
        ${total > 0 ? UI.pagination(total, state.page, state.pageSize) : ""}
      </div>
    `;

    ["h-year","h-month","h-day","h-user","h-status"].forEach((id) => {
      U.qs("#" + id).addEventListener("change", (e) => {
        const key = { "h-year": "year", "h-month": "month", "h-day": "day", "h-user": "user", "h-status": "status" }[id];
        state[key] = e.target.value; state.page = 1; render(container);
      });
    });
    U.qs("#h-search").addEventListener("input", U.debounce((e) => { state.search = e.target.value; state.page = 1; render(container); }, 200));
    U.qs("#h-clear").addEventListener("click", () => { Object.assign(state, { year: "", month: "", day: "", user: "", status: "", search: "", page: 1 }); render(container); });
    U.qs("#hist-export").addEventListener("click", () => {
      const header = ["Code", "Date", "Time", "User", "File", "Size", "Protocol", "Duration", "Status"];
      const rows = items.map((t) => [t.code, U.formatDate(t.createdAt), U.formatTime(t.createdAt), t.username, t.fileName, t.fileSize, t.protocol, t.durationSeconds || "", t.status]);
      const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
      U.downloadBlob("transfer-history.csv", csv, "text/csv");
      UI.pushNotification("INFO", "History exported to CSV.");
    });
    const table = U.qs("#hist-table");
    if (table) {
      table.addEventListener("click", (e) => {
        const sortTh = e.target.closest("th[data-sort]");
        if (sortTh) {
          if (state.sortKey === sortTh.dataset.sort) state.sortDir *= -1; else { state.sortKey = sortTh.dataset.sort; state.sortDir = 1; }
          render(container); return;
        }
        const row = e.target.closest("tr[data-id]");
        if (row) ROUTER.navigate(`transfers/${row.dataset.id}`);
      });
    }
    const pag = U.qs(".pagination");
    if (pag) pag.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-page]");
      if (btn && !btn.disabled) { state.page = Number(btn.dataset.page); render(container); }
    });
  }

  global.PAGES = global.PAGES || {};
  global.PAGES.history = { render };
})(window);
