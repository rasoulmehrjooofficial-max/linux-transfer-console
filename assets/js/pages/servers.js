/* ============================================================================
   PAGE: /servers — server management (mock connections via CONN abstraction)
   ============================================================================ */

(function (global) {
  "use strict";

  let container = null;

  function render(root) {
    container = root;
    const servers = DB.state.servers;

    root.innerHTML = `
      <div class="page-head">
        <div><span class="page-title">SERVERS</span><span class="page-path">/servers</span></div>
        <div class="page-actions"><button class="btn btn-primary" id="srv-new">+ ADD SERVER</button></div>
      </div>

      <div class="grid grid-3" id="srv-grid">
        ${servers.map(serverCardHtml).join("")}
      </div>
    `;

    U.qs("#srv-new").addEventListener("click", openAddModal);
    U.qs("#srv-grid").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      const card = e.target.closest(".panel[data-id]");
      if (!card) return;
      const server = servers.find((s) => s.id === card.dataset.id);
      if (!btn) { openDetailModal(server); return; }
      const act = btn.dataset.act;
      if (act === "test") testConnection(server);
      else if (act === "edit") openEditModal(server);
      else if (act === "delete") UI.confirmModal(`Delete server "${server.name}"?`, { danger: true }, () => deleteServer(server));
    });
  }

  function serverCardHtml(s) {
    return `
      <div class="panel" data-id="${s.id}" style="cursor:pointer">
        <div class="panel-head"><span>${U.escapeHtml(s.name)}</span>${UI.statusBadge(s.status)}</div>
        <div class="panel-body">
          <table class="kv-table">
            <tr><td>HOST</td><td class="mono">${U.escapeHtml(s.host)}:${s.port}</td></tr>
            <tr><td>PROTOCOL</td><td>${s.protocol}</td></tr>
            <tr><td>OS</td><td>${U.escapeHtml(s.os || "—")}</td></tr>
            <tr><td>UPTIME</td><td>${U.formatUptime(s.uptimeSeconds)}</td></tr>
          </table>
          ${UI.barRow("CPU", s.cpuPercent ?? 0, 70, 90)}
          ${UI.barRow("RAM", s.ramPercent ?? 0, 70, 90)}
          ${UI.barRow("DISK", s.diskPercent ?? 0, 80, 93)}
          <div style="display:flex;gap:6px;margin-top:8px;">
            <button class="btn btn-xs" data-act="test">TEST CONNECTION</button>
            <button class="btn btn-xs" data-act="edit">EDIT</button>
            <button class="btn btn-danger btn-xs" data-act="delete">DELETE</button>
          </div>
        </div>
      </div>
    `;
  }

  function openDetailModal(s) {
    const logs = DB.state.auditLogs.filter((a) => a.target === s.name).slice(0, 10);
    UI.openModal({
      title: `SERVER DETAILS — ${s.name}`,
      wide: true,
      body: `
        <table class="kv-table">
          <tr><td>NAME</td><td>${U.escapeHtml(s.name)}</td></tr>
          <tr><td>HOST</td><td class="mono">${U.escapeHtml(s.host)}</td></tr>
          <tr><td>PORT</td><td>${s.port}</td></tr>
          <tr><td>PROTOCOL</td><td>${s.protocol}</td></tr>
          <tr><td>USERNAME</td><td>${U.escapeHtml(s.username)}</td></tr>
          <tr><td>STATUS</td><td>${UI.statusBadge(s.status)}</td></tr>
          <tr><td>LAST CONNECTION</td><td>${U.formatDateTime(s.lastConnection)}</td></tr>
          <tr><td>OS / KERNEL</td><td>${U.escapeHtml(s.os || "—")} / ${U.escapeHtml(s.kernel || "—")}</td></tr>
          <tr><td>UPTIME</td><td>${U.formatUptime(s.uptimeSeconds)}</td></tr>
        </table>
        <div class="panel-head" style="margin-top:14px;border:1px solid var(--border)">CONNECTION LOGS</div>
        <div class="table-wrap">
          ${logs.length === 0 ? UI.emptyState(`grep ${s.name} /var/log/audit.log`, "No connection logs.") :
            `<table class="data-table"><tbody>${logs.map((l) => `<tr class="no-hover"><td>${U.formatDateTime(l.timestamp)}</td><td>${l.action}</td><td>${UI.statusBadge(l.status === "SUCCESS" ? "COMPLETED" : "FAILED", l.status)}</td></tr>`).join("")}</tbody></table>`}
        </div>
      `,
      foot: `<button class="btn btn-primary" id="sd-close">CLOSE</button>`,
      onMount: (box) => U.qs("#sd-close", box).addEventListener("click", UI.closeModal),
    });
  }

  async function testConnection(s) {
    UI.pushNotification("INFO", `Testing connection to ${s.name}...`);
    const conn = CONN.connectionFor(s);
    const result = await conn.testConnection();
    s.lastConnection = DB.isoNow();
    s.status = result.ok ? "ONLINE" : "ERROR";
    s.networkStatus = result.ok ? "ONLINE" : "OFFLINE";
    DB.save();
    UI.recordAudit("TEST_CONNECTION", s.name, result.ok ? "SUCCESS" : "FAILED", result.message);
    UI.pushNotification(result.ok ? "INFO" : "ERROR", `${s.name}: ${result.message} (${result.latencyMs}ms)`);
    render(container);
  }

  function openAddModal() {
    UI.openModal({
      title: "ADD SERVER",
      body: `
        <div class="field-row">
          <div class="field"><label>NAME</label><input type="text" id="as-name" placeholder="SRV-NEW-01" /></div>
          <div class="field"><label>PROTOCOL</label><select id="as-protocol">${["SSH", "SFTP", "FTP", "SCP", "HTTP_API"].map((p) => `<option>${p}</option>`).join("")}</select></div>
        </div>
        <div class="field-row">
          <div class="field"><label>HOST</label><input type="text" id="as-host" placeholder="10.20.0.50" /></div>
          <div class="field"><label>PORT</label><input type="number" id="as-port" value="22" /></div>
        </div>
        <div class="field-row">
          <div class="field"><label>USERNAME</label><input type="text" id="as-username" placeholder="svc-transfer" /></div>
          <div class="field"><label>CREDENTIAL (SECRET)</label><input type="password" id="as-secret" placeholder="•••••••• (not shown after saving)" /></div>
        </div>
        <div class="field-hint">Credentials are never rendered back to the UI in plaintext once saved.</div>
      `,
      foot: `<button class="btn btn-ghost" id="as-cancel">CANCEL</button><button class="btn btn-primary" id="as-ok">ADD</button>`,
      onMount: (box) => {
        U.qs("#as-cancel", box).addEventListener("click", UI.closeModal);
        U.qs("#as-ok", box).addEventListener("click", () => {
          const name = U.qs("#as-name", box).value.trim();
          const host = U.qs("#as-host", box).value.trim();
          if (!name || !host) return;
          const s = {
            id: DB.uid("srv"), name, host, port: Number(U.qs("#as-port", box).value) || 22,
            protocol: U.qs("#as-protocol", box).value, username: U.qs("#as-username", box).value.trim() || "root",
            status: "UNKNOWN", lastConnection: null, createdAt: DB.isoNow(),
            os: null, kernel: null, uptimeSeconds: 0, cpuPercent: 0, ramPercent: 0, diskPercent: 0, networkStatus: null,
          };
          DB.state.servers.push(s);
          DB.save(); UI.recordAudit("ADD_SERVER", name, "SUCCESS");
          UI.closeModal(); UI.pushNotification("INFO", `Server ${name} added.`);
          render(container);
        });
      },
    });
  }

  function openEditModal(s) {
    UI.openModal({
      title: `EDIT SERVER — ${s.name}`,
      body: `
        <div class="field-row">
          <div class="field"><label>NAME</label><input type="text" id="es-name" value="${U.escapeHtml(s.name)}" /></div>
          <div class="field"><label>PROTOCOL</label><select id="es-protocol">${["SSH", "SFTP", "FTP", "SCP", "HTTP_API"].map((p) => `<option ${p === s.protocol ? "selected" : ""}>${p}</option>`).join("")}</select></div>
        </div>
        <div class="field-row">
          <div class="field"><label>HOST</label><input type="text" id="es-host" value="${U.escapeHtml(s.host)}" /></div>
          <div class="field"><label>PORT</label><input type="number" id="es-port" value="${s.port}" /></div>
        </div>
      `,
      foot: `<button class="btn btn-ghost" id="es-cancel">CANCEL</button><button class="btn btn-primary" id="es-ok">SAVE</button>`,
      onMount: (box) => {
        U.qs("#es-cancel", box).addEventListener("click", UI.closeModal);
        U.qs("#es-ok", box).addEventListener("click", () => {
          s.name = U.qs("#es-name", box).value.trim() || s.name;
          s.protocol = U.qs("#es-protocol", box).value;
          s.host = U.qs("#es-host", box).value.trim() || s.host;
          s.port = Number(U.qs("#es-port", box).value) || s.port;
          DB.save(); UI.recordAudit("EDIT_SERVER", s.name, "SUCCESS");
          UI.closeModal(); render(container);
        });
      },
    });
  }

  function deleteServer(s) {
    DB.state.servers = DB.state.servers.filter((x) => x.id !== s.id);
    DB.save(); UI.recordAudit("DELETE_SERVER", s.name, "SUCCESS");
    UI.closeModal(); UI.pushNotification("WARNING", `Server ${s.name} deleted.`);
    render(container);
  }

  global.PAGES = global.PAGES || {};
  global.PAGES.servers = { render };
})(window);
