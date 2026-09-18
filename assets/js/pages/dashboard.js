/* ============================================================================
   PAGE: /dashboard — system overview
   ============================================================================ */

(function (global) {
  "use strict";

  function statusCounts() {
    const counts = { QUEUED: 0, RUNNING: 0, COMPLETED: 0, FAILED: 0, CANCELLED: 0, PAUSED: 0 };
    for (const t of DB.state.transfers) counts[t.status] = (counts[t.status] || 0) + 1;
    return counts;
  }

  function render(container) {
    const primaryServer = DB.state.servers.find((s) => s.id === DB.state.session.currentServerId) || DB.state.servers[0];
    const counts = statusCounts();
    const stats = global.SYS_STATS || { cpuPercent: 24, memoryPercent: 41, diskPercent: 68, networkStatus: "ONLINE" };

    const recent = DB.state.auditLogs.slice(0, 10);

    container.innerHTML = `
      <div class="page-head">
        <div><span class="page-title">SYSTEM OVERVIEW</span><span class="page-path">/dashboard</span></div>
        <div class="page-actions">
          <button class="btn" id="dash-refresh">↻ REFRESH</button>
        </div>
      </div>

      <div class="grid grid-2">
        <div class="panel">
          <div class="panel-head">SYSTEM OVERVIEW</div>
          <div class="panel-body">
            <table class="kv-table">
              <tr><td>HOSTNAME</td><td>transfer-node.local</td></tr>
              <tr><td>SERVER</td><td>${U.escapeHtml(primaryServer ? primaryServer.name : "—")}</td></tr>
              <tr><td>OS</td><td>${U.escapeHtml(primaryServer ? primaryServer.os : "—")}</td></tr>
              <tr><td>KERNEL</td><td>${U.escapeHtml(primaryServer ? primaryServer.kernel : "—")}</td></tr>
              <tr><td>UPTIME</td><td>${U.formatUptime(primaryServer ? primaryServer.uptimeSeconds : 0)}</td></tr>
              <tr><td>IP</td><td>${U.escapeHtml(primaryServer ? primaryServer.host : "—")}</td></tr>
              <tr><td>CONNECTION STATUS</td><td>${UI.statusBadge("ONLINE")}</td></tr>
            </table>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head">SYSTEM RESOURCES</div>
          <div class="panel-body">
            ${UI.barRow("CPU", stats.cpuPercent, 70, 90)}
            ${UI.barRow("RAM", stats.memoryPercent, 70, 90)}
            ${UI.barRow("DISK", stats.diskPercent, 80, 93)}
            <div class="bar-row"><div class="bar-label">NETWORK</div><div>${UI.statusBadge(stats.networkStatus)}</div></div>
          </div>
        </div>
      </div>

      <div class="grid grid-4">
        <div class="stat-box"><div class="stat-label">ACTIVE TRANSFERS</div><div class="stat-value">${counts.RUNNING}</div><div class="stat-sub">running now</div></div>
        <div class="stat-box"><div class="stat-label">QUEUED</div><div class="stat-value">${counts.QUEUED}</div><div class="stat-sub">awaiting slot</div></div>
        <div class="stat-box"><div class="stat-label">COMPLETED</div><div class="stat-value">${counts.COMPLETED}</div><div class="stat-sub">all time (seed window)</div></div>
        <div class="stat-box"><div class="stat-label">FAILED</div><div class="stat-value ${counts.FAILED > 0 ? "err" : ""}">${counts.FAILED}</div><div class="stat-sub">${counts.CANCELLED} cancelled</div></div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <span>RECENT ACTIVITY</span>
          <a href="#/logs" class="btn btn-ghost btn-xs">VIEW ALL LOGS →</a>
        </div>
        <div class="table-wrap">
          ${recent.length === 0 ? UI.emptyState("tail -n 10 /var/log/audit.log", "No activity recorded yet.") : `
          <table class="data-table">
            <thead><tr><th>DATE</th><th>TIME</th><th>USER</th><th>ACTION</th><th>TARGET</th><th>STATUS</th></tr></thead>
            <tbody>
              ${recent.map((a) => `
                <tr class="no-hover">
                  <td>${U.formatDate(a.timestamp)}</td>
                  <td>${U.formatTime(a.timestamp)}</td>
                  <td>${U.escapeHtml(a.username)}</td>
                  <td>${U.escapeHtml(a.action)}</td>
                  <td>${U.escapeHtml(a.target)}</td>
                  <td>${UI.statusBadge(a.status === "SUCCESS" ? "COMPLETED" : "FAILED", a.status)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>`}
        </div>
      </div>
    `;

    U.qs("#dash-refresh").addEventListener("click", () => render(container));
  }

  global.PAGES = global.PAGES || {};
  global.PAGES.dashboard = { render };
})(window);
