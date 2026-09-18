/* ============================================================================
   PAGE: /transfers — list + detail + the (simulated) transfer engine.
   The engine tick() is driven by main.js's global interval and mutates
   DB.state.transfers directly, so this is the one module that "runs" the
   mock backend for transfers.
   ============================================================================ */

(function (global) {
  "use strict";

  const state = {
    filters: { status: "", username: "", search: "", from: "", to: "" },
    page: 1,
    pageSize: 10,
    view: null, // "list" | "detail"
    detailId: null,
    container: null,
  };

  const KIND_LABEL = {
    UPLOAD: "Upload", DOWNLOAD: "Download", SERVER_TO_SERVER: "Server → Server",
    LOCAL_TO_SERVER: "Local → Server", SERVER_TO_LOCAL: "Server → Local",
    FILE_TO_FILE: "File → File", DIRECTORY_TO_DIRECTORY: "Directory → Directory",
  };

  function findTransfer(id) {
    return DB.state.transfers.find((t) => t.id === id || t.code === id);
  }

  function filtered() {
    let items = DB.state.transfers.slice();
    const f = state.filters;
    if (f.status) items = items.filter((t) => t.status === f.status);
    if (f.username) items = items.filter((t) => t.username === f.username);
    if (f.from) items = items.filter((t) => t.createdAt >= f.from);
    if (f.to) items = items.filter((t) => t.createdAt <= f.to + "T23:59:59");
    if (f.search) {
      const s = f.search.toLowerCase();
      items = items.filter((t) =>
        t.code.toLowerCase().includes(s) || t.fileName.toLowerCase().includes(s) ||
        t.source.toLowerCase().includes(s) || t.destination.toLowerCase().includes(s));
    }
    items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return items;
  }

  // ------------------------------------------------------------------
  // List view
  // ------------------------------------------------------------------
  function render(container) {
    state.view = "list";
    state.container = container;

    const users = [...new Set(DB.state.transfers.map((t) => t.username))];
    const items = filtered();
    const total = items.length;
    const start = (state.page - 1) * state.pageSize;
    const pageItems = items.slice(start, start + state.pageSize);

    container.innerHTML = `
      <div class="page-head">
        <div><span class="page-title">DATA TRANSFERS</span><span class="page-path">/transfers</span></div>
        <div class="page-actions">
          <button class="btn btn-primary" id="btn-new-transfer">+ CREATE TRANSFER</button>
        </div>
      </div>

      <div class="filter-bar">
        <span class="filter-label">STATUS</span>
        <select id="f-status">
          <option value="">ALL</option>
          ${["QUEUED", "RUNNING", "PAUSED", "COMPLETED", "FAILED", "CANCELLED"].map((s) => `<option value="${s}" ${state.filters.status === s ? "selected" : ""}>${s}</option>`).join("")}
        </select>
        <span class="filter-label">USER</span>
        <select id="f-user">
          <option value="">ALL</option>
          ${users.map((u) => `<option value="${u}" ${state.filters.username === u ? "selected" : ""}>${u}</option>`).join("")}
        </select>
        <span class="filter-label">FROM</span>
        <input type="date" id="f-from" value="${state.filters.from}" />
        <span class="filter-label">TO</span>
        <input type="date" id="f-to" value="${state.filters.to}" />
        <input type="text" id="f-search" placeholder="search code / file / path..." value="${U.escapeHtml(state.filters.search)}" style="min-width:200px" />
        <span class="spacer"></span>
        <button class="btn btn-ghost btn-xs" id="f-clear">CLEAR</button>
        <button class="btn btn-ghost btn-xs" id="f-export">EXPORT CSV</button>
      </div>

      <div class="panel">
        <div class="table-wrap">
          ${pageItems.length === 0 ? UI.emptyState("ls /transfers", "No transfer records found.") : `
          <table class="data-table" id="transfers-table">
            <thead><tr>
              <th>ID</th><th>DATE</th><th>TIME</th><th>USER</th><th>SOURCE</th><th>DESTINATION</th>
              <th>FILE</th><th>SIZE</th><th>PROTOCOL</th><th>PROGRESS</th><th>STATUS</th>
            </tr></thead>
            <tbody>
              ${pageItems.map(rowHtml).join("")}
            </tbody>
          </table>`}
        </div>
        ${total > 0 ? UI.pagination(total, state.page, state.pageSize) : ""}
      </div>
    `;

    U.qs("#btn-new-transfer").addEventListener("click", openCreateModal);
    U.qs("#f-status").addEventListener("change", (e) => { state.filters.status = e.target.value; state.page = 1; render(container); });
    U.qs("#f-user").addEventListener("change", (e) => { state.filters.username = e.target.value; state.page = 1; render(container); });
    U.qs("#f-from").addEventListener("change", (e) => { state.filters.from = e.target.value; state.page = 1; render(container); });
    U.qs("#f-to").addEventListener("change", (e) => { state.filters.to = e.target.value; state.page = 1; render(container); });
    U.qs("#f-search").addEventListener("input", U.debounce((e) => { state.filters.search = e.target.value; state.page = 1; render(container); }, 250));
    U.qs("#f-clear").addEventListener("click", () => { state.filters = { status: "", username: "", search: "", from: "", to: "" }; state.page = 1; render(container); });
    U.qs("#f-export").addEventListener("click", () => exportCsv(items));

    const table = U.qs("#transfers-table");
    if (table) {
      table.addEventListener("click", (e) => {
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

  function rowHtml(t) {
    return `<tr data-id="${t.id}">
      <td class="mono">${t.code}</td>
      <td>${U.formatDate(t.createdAt)}</td>
      <td>${U.formatTime(t.createdAt)}</td>
      <td>${U.escapeHtml(t.username)}</td>
      <td title="${U.escapeHtml(t.source)}">${U.escapeHtml(truncate(t.source, 22))}</td>
      <td title="${U.escapeHtml(t.destination)}">${U.escapeHtml(truncate(t.destination, 22))}</td>
      <td>${U.escapeHtml(t.fileName)}</td>
      <td>${U.formatBytes(t.fileSize)}</td>
      <td>${t.protocol}</td>
      <td style="min-width:110px" data-field="progress">${UI.progressBar(t.progress, t.status)}<span style="font-size:10px;color:var(--text-dimmer)">${Math.round(t.progress)}%</span></td>
      <td data-field="status">${UI.statusBadge(t.status)}</td>
    </tr>`;
  }

  function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }

  function exportCsv(items) {
    const header = ["Code", "Kind", "User", "Source", "Destination", "File", "Size", "Protocol", "Status", "Progress", "Created"];
    const rows = items.map((t) => [t.code, t.kind, t.username, t.source, t.destination, t.fileName, t.fileSize, t.protocol, t.status, t.progress, t.createdAt]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    U.downloadBlob("transfers-export.csv", csv, "text/csv");
    UI.pushNotification("INFO", "Transfer list exported to CSV.");
  }

  // ------------------------------------------------------------------
  // Create transfer modal
  // ------------------------------------------------------------------
  function openCreateModal() {
    const serverNames = DB.state.servers.map((s) => s.name);
    UI.openModal({
      title: "CREATE TRANSFER",
      body: `
        <div class="field">
          <label>TRANSFER TYPE</label>
          <select id="nt-kind">
            ${Object.entries(KIND_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}
          </select>
        </div>
        <div class="field-row">
          <div class="field"><label>SOURCE</label><input type="text" id="nt-source" placeholder="e.g. ${serverNames[0]}:/data/incoming" /></div>
          <div class="field"><label>DESTINATION</label><input type="text" id="nt-dest" placeholder="e.g. ${serverNames[1] || serverNames[0]}:/backups" /></div>
        </div>
        <div class="field-row">
          <div class="field"><label>FILE / DIRECTORY NAME</label><input type="text" id="nt-file" placeholder="backup.tar.gz" /></div>
          <div class="field"><label>PROTOCOL</label>
            <select id="nt-protocol">${["SSH", "SFTP", "FTP", "SCP", "HTTP_API"].map((p) => `<option value="${p}">${p}</option>`).join("")}</select>
          </div>
        </div>
        <div class="field"><label>APPROX SIZE (MB)</label><input type="number" id="nt-size" value="1024" min="1" /></div>
        <div class="checkbox-row"><input type="checkbox" id="nt-queue" /> <label for="nt-queue">Add to queue instead of starting immediately</label></div>
      `,
      foot: `<button class="btn btn-ghost" id="nt-cancel">CANCEL</button><button class="btn btn-primary" id="nt-submit">CREATE</button>`,
      onMount: (box) => {
        U.qs("#nt-cancel", box).addEventListener("click", UI.closeModal);
        U.qs("#nt-submit", box).addEventListener("click", () => {
          const source = U.qs("#nt-source", box).value.trim() || `${serverNames[0]}:/data/incoming`;
          const destination = U.qs("#nt-dest", box).value.trim() || `${serverNames[1] || serverNames[0]}:/backups`;
          const fileName = U.qs("#nt-file", box).value.trim() || "unnamed.bin";
          const protocol = U.qs("#nt-protocol", box).value;
          const kind = U.qs("#nt-kind", box).value;
          const sizeMb = Number(U.qs("#nt-size", box).value) || 1024;
          const queueOnly = U.qs("#nt-queue", box).checked;
          createTransfer({ source, destination, fileName, protocol, kind, sizeMb, queueOnly });
          UI.closeModal();
        });
      },
    });
  }

  function createTransfer({ source, destination, fileName, protocol, kind, sizeMb, queueOnly }) {
    const session = DB.state.session;
    const t = {
      id: DB.uid("tr"), code: DB.nextTransferCode(), kind, userId: "self", username: session.username,
      source, destination, fileName, fileSize: sizeMb * 1024 * 1024, bytesTransferred: 0,
      protocol, speedBps: 0, progress: 0, status: queueOnly ? "QUEUED" : "RUNNING",
      startTime: queueOnly ? null : DB.isoNow(), endTime: null, durationSeconds: null,
      errorMessage: null, createdAt: DB.isoNow(),
    };
    DB.state.transfers.unshift(t);
    DB.state.transferLogs.push({ id: DB.uid("log"), transferId: t.id, timestamp: DB.isoNow(), level: "INFO", message: queueOnly ? "Transfer queued" : "Connection established" });
    if (!queueOnly) DB.state.transferLogs.push({ id: DB.uid("log"), transferId: t.id, timestamp: DB.isoNow(), level: "INFO", message: "Transfer started" });
    DB.save();
    UI.recordAudit("CREATE_TRANSFER", t.fileName, "SUCCESS");
    UI.pushNotification("INFO", `Transfer ${t.code} ${queueOnly ? "queued" : "started"}.`);
    ROUTER.navigate(`transfers/${t.id}`);
  }

  // ------------------------------------------------------------------
  // Detail view
  // ------------------------------------------------------------------
  function renderDetail(container, id) {
    const t = findTransfer(id);
    if (!t) {
      container.innerHTML = UI.errorBox("4041", "TRANSFER NOT FOUND", `No transfer matches "${id}".`,
        `<a class="btn" href="#/transfers">BACK TO TRANSFERS</a>`);
      state.view = null;
      return;
    }
    state.view = "detail";
    state.detailId = t.id;
    state.container = container;

    const logs = DB.state.transferLogs.filter((l) => l.transferId === t.id).sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));

    container.innerHTML = `
      <div class="page-head">
        <div><a href="#/transfers" class="btn btn-ghost btn-xs">← BACK</a> <span class="page-title">TRANSFER #${t.code}</span></div>
        <div class="page-actions" id="detail-actions"></div>
      </div>

      <div class="grid grid-2">
        <div class="panel">
          <div class="panel-head">TRANSFER DETAIL</div>
          <div class="panel-body">
            <table class="kv-table">
              <tr><td>KIND</td><td>${KIND_LABEL[t.kind] || t.kind}</td></tr>
              <tr><td>SOURCE</td><td class="mono">${U.escapeHtml(t.source)}</td></tr>
              <tr><td>DESTINATION</td><td class="mono">${U.escapeHtml(t.destination)}</td></tr>
              <tr><td>FILE</td><td>${U.escapeHtml(t.fileName)}</td></tr>
              <tr><td>SIZE</td><td>${U.formatBytes(t.fileSize)}</td></tr>
              <tr><td>TRANSFERRED</td><td id="dt-transferred">${U.formatBytes(t.bytesTransferred)}</td></tr>
              <tr><td>SPEED</td><td id="dt-speed">${U.formatSpeed(t.speedBps)}</td></tr>
              <tr><td>PROTOCOL</td><td>${t.protocol}</td></tr>
              <tr><td>USER</td><td>${U.escapeHtml(t.username)}</td></tr>
              <tr><td>STARTED</td><td>${U.formatDateTime(t.startTime)}</td></tr>
              <tr><td>ENDED</td><td id="dt-ended">${U.formatDateTime(t.endTime)}</td></tr>
              <tr><td>DURATION</td><td id="dt-duration">${U.formatDuration(t.durationSeconds)}</td></tr>
              <tr><td>STATUS</td><td id="dt-status">${UI.statusBadge(t.status)}</td></tr>
              ${t.errorMessage ? `<tr><td>ERROR</td><td style="color:var(--red)">${U.escapeHtml(t.errorMessage)}</td></tr>` : ""}
            </table>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head">PROGRESS</div>
          <div class="panel-body">
            <div id="dt-progress-pct" style="font-size:28px;font-weight:700;color:var(--white);margin-bottom:10px;">${Math.round(t.progress)}%</div>
            <div id="dt-progress-bar">${UI.progressBar(t.progress, t.status)}</div>
            <div class="field-hint" style="margin-top:16px;">TRANSFER ID: ${t.id}</div>
            <div class="field-hint">CREATED: ${U.formatDateTime(t.createdAt)}</div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">LIVE TRANSFER LOG</div>
        <div class="terminal-body" id="dt-log" style="max-height:280px;background:#000;">
          ${logs.map(logLineHtml).join("")}
        </div>
      </div>
    `;

    renderActions(t);
    const logEl = U.qs("#dt-log");
    if (logEl) logEl.scrollTop = logEl.scrollHeight;
  }

  function logLineHtml(l) {
    return `<div class="terminal-line ${l.level}" data-log-id="${l.id}">[${U.formatTime(l.timestamp)}] ${U.escapeHtml(l.message)}</div>`;
  }

  function renderActions(t) {
    const box = U.qs("#detail-actions");
    if (!box) return;
    const buttons = [];
    if (t.status === "RUNNING") {
      buttons.push(`<button class="btn btn-warn" id="act-pause">⏸ PAUSE</button>`);
      buttons.push(`<button class="btn btn-danger" id="act-cancel">✕ CANCEL</button>`);
    } else if (t.status === "PAUSED") {
      buttons.push(`<button class="btn btn-primary" id="act-resume">▶ RESUME</button>`);
      buttons.push(`<button class="btn btn-danger" id="act-cancel">✕ CANCEL</button>`);
    } else if (t.status === "QUEUED") {
      buttons.push(`<button class="btn btn-primary" id="act-resume">▶ START NOW</button>`);
      buttons.push(`<button class="btn btn-danger" id="act-cancel">✕ CANCEL</button>`);
    } else if (t.status === "FAILED" || t.status === "CANCELLED") {
      buttons.push(`<button class="btn btn-primary" id="act-retry">↻ RETRY</button>`);
    }
    box.innerHTML = buttons.join(" ");
    const p = U.qs("#act-pause"); if (p) p.addEventListener("click", () => pauseTransfer(t.id));
    const r = U.qs("#act-resume"); if (r) r.addEventListener("click", () => resumeTransfer(t.id));
    const c = U.qs("#act-cancel"); if (c) c.addEventListener("click", () => UI.confirmModal(`Cancel transfer ${t.code}?`, { danger: true }, () => cancelTransfer(t.id)));
    const rt = U.qs("#act-retry"); if (rt) rt.addEventListener("click", () => retryTransfer(t.id));
  }

  function addLog(t, level, message) {
    const line = { id: DB.uid("log"), transferId: t.id, timestamp: DB.isoNow(), level, message };
    DB.state.transferLogs.push(line);
    if (state.view === "detail" && state.detailId === t.id) {
      const logEl = U.qs("#dt-log");
      if (logEl) {
        logEl.insertAdjacentHTML("beforeend", logLineHtml(line));
        logEl.scrollTop = logEl.scrollHeight;
      }
    }
  }

  function pauseTransfer(id) {
    const t = findTransfer(id); if (!t) return;
    t.status = "PAUSED"; t.speedBps = 0;
    addLog(t, "WARNING", "Transfer paused by operator");
    DB.save(); UI.recordAudit("PAUSE_TRANSFER", t.code, "SUCCESS");
    UI.pushNotification("WARNING", `Transfer ${t.code} paused.`);
    refreshCurrentView();
  }

  function resumeTransfer(id) {
    const t = findTransfer(id); if (!t) return;
    t.status = "RUNNING";
    if (!t.startTime) t.startTime = DB.isoNow();
    addLog(t, "INFO", "Transfer resumed");
    DB.save(); UI.recordAudit("RESUME_TRANSFER", t.code, "SUCCESS");
    UI.pushNotification("INFO", `Transfer ${t.code} resumed.`);
    refreshCurrentView();
  }

  function cancelTransfer(id) {
    const t = findTransfer(id); if (!t) return;
    t.status = "CANCELLED"; t.speedBps = 0; t.endTime = DB.isoNow();
    addLog(t, "WARNING", "Transfer cancelled by operator");
    DB.save(); UI.recordAudit("CANCEL_TRANSFER", t.code, "SUCCESS");
    UI.pushNotification("WARNING", `Transfer ${t.code} cancelled.`);
    refreshCurrentView();
  }

  function retryTransfer(id) {
    const t = findTransfer(id); if (!t) return;
    t.status = "RUNNING"; t.progress = 0; t.bytesTransferred = 0; t.errorMessage = null;
    t.startTime = DB.isoNow(); t.endTime = null; t.durationSeconds = null;
    addLog(t, "INFO", "Retrying transfer — connection re-established");
    DB.save(); UI.recordAudit("RETRY_TRANSFER", t.code, "SUCCESS");
    UI.pushNotification("INFO", `Transfer ${t.code} retrying.`);
    refreshCurrentView();
  }

  function refreshCurrentView() {
    if (!state.container) return;
    if (state.view === "detail") renderDetail(state.container, state.detailId);
    else if (state.view === "list") render(state.container);
  }

  // ------------------------------------------------------------------
  // Engine tick — called every second by main.js
  // ------------------------------------------------------------------
  function tick() {
    let changed = false;
    for (const t of DB.state.transfers) {
      if (t.status !== "RUNNING") continue;
      changed = true;
      const speed = DB.randInt(8, 160) * 1024 * 1024; // bytes/sec, simulated
      t.speedBps = speed;
      t.bytesTransferred = Math.min(t.fileSize, t.bytesTransferred + speed);
      t.progress = Math.min(100, (t.bytesTransferred / t.fileSize) * 100);

      if (Math.random() < 0.02) {
        addLog(t, "WARNING", "Transfer speed dropped below threshold");
      }
      if (Math.random() < 0.004) {
        t.status = "FAILED"; t.speedBps = 0; t.endTime = DB.isoNow();
        t.errorMessage = DB.pick(["Connection timeout.", "Connection reset by peer.", "Disk quota exceeded on destination."]);
        t.durationSeconds = Math.max(0, Math.round((new Date(t.endTime) - new Date(t.startTime)) / 1000));
        addLog(t, "ERROR", t.errorMessage);
        UI.pushNotification("ERROR", `Transfer ${t.code} failed: ${t.errorMessage}`);
        continue;
      }
      if (t.progress >= 100) {
        t.status = "COMPLETED"; t.speedBps = 0; t.endTime = DB.isoNow();
        t.durationSeconds = Math.max(0, Math.round((new Date(t.endTime) - new Date(t.startTime)) / 1000));
        addLog(t, "INFO", "Transfer completed successfully");
        UI.pushNotification("INFO", `Transfer ${t.code} completed.`);
      }
    }
    // promote queued transfers if there is capacity (max 3 concurrent, simple demo rule)
    const runningCount = DB.state.transfers.filter((t) => t.status === "RUNNING").length;
    if (runningCount < 3) {
      const nextQueued = DB.state.transfers.find((t) => t.status === "QUEUED");
      if (nextQueued) {
        nextQueued.status = "RUNNING"; nextQueued.startTime = DB.isoNow();
        addLog(nextQueued, "INFO", "Connection established");
        addLog(nextQueued, "INFO", "Transfer started");
        changed = true;
      }
    }
    if (changed) {
      DB.save();
      applyLiveDom();
    }
  }

  function applyLiveDom() {
    if (state.view === "list" && state.container) {
      const items = filtered();
      const start = (state.page - 1) * state.pageSize;
      const pageItems = items.slice(start, start + state.pageSize);
      for (const t of pageItems) {
        const row = state.container.querySelector(`tr[data-id="${t.id}"]`);
        if (!row) continue;
        const progressCell = row.querySelector('[data-field="progress"]');
        const statusCell = row.querySelector('[data-field="status"]');
        if (progressCell) progressCell.innerHTML = `${UI.progressBar(t.progress, t.status)}<span style="font-size:10px;color:var(--text-dimmer)">${Math.round(t.progress)}%</span>`;
        if (statusCell) statusCell.innerHTML = UI.statusBadge(t.status);
      }
    } else if (state.view === "detail" && state.detailId) {
      const t = findTransfer(state.detailId);
      if (!t || !state.container) return;
      const set = (id, html) => { const e = U.qs("#" + id); if (e) e.innerHTML = html; };
      set("dt-transferred", U.formatBytes(t.bytesTransferred));
      set("dt-speed", U.formatSpeed(t.speedBps));
      set("dt-ended", U.formatDateTime(t.endTime));
      set("dt-duration", U.formatDuration(t.durationSeconds));
      set("dt-status", UI.statusBadge(t.status));
      set("dt-progress-pct", Math.round(t.progress) + "%");
      set("dt-progress-bar", UI.progressBar(t.progress, t.status));
      renderActions(t);
    }
  }

  global.PAGES = global.PAGES || {};
  global.PAGES.transfers = { render, renderDetail, tick, findTransfer };
})(window);
