/* ============================================================================
   PAGE: /accounts — user account management (mock RBAC)
   ============================================================================ */

(function (global) {
  "use strict";

  let container = null;

  function render(root) {
    container = root;
    const users = DB.state.users.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    root.innerHTML = `
      <div class="page-head">
        <div><span class="page-title">ACCOUNTS</span><span class="page-path">/accounts</span></div>
        <div class="page-actions"><button class="btn btn-primary" id="acc-new">+ CREATE USER</button></div>
      </div>

      <div class="panel">
        <div class="table-wrap">
          <table class="data-table" id="acc-table">
            <thead><tr><th>USERNAME</th><th>EMAIL</th><th>ROLE</th><th>STATUS</th><th>CREATED</th><th>LAST LOGIN</th><th>LAST ACTIVITY</th><th></th></tr></thead>
            <tbody>
              ${users.map((u) => `
                <tr class="no-hover" data-id="${u.id}">
                  <td>${U.escapeHtml(u.username)}</td>
                  <td>${U.escapeHtml(u.email)}</td>
                  <td>${UI.roleBadge(u.role)}</td>
                  <td>${UI.statusBadge(u.status)}</td>
                  <td>${U.formatDate(u.createdAt)}</td>
                  <td>${U.formatDateTime(u.lastLogin)}</td>
                  <td>${U.timeAgo(u.lastActivity)}</td>
                  <td>
                    <button class="btn btn-ghost btn-xs" data-act="role">ROLE</button>
                    <button class="btn btn-ghost btn-xs" data-act="toggle">${u.status === "ACTIVE" ? "DISABLE" : "ENABLE"}</button>
                    <button class="btn btn-ghost btn-xs" data-act="reset">RESET PW</button>
                    <button class="btn btn-ghost btn-xs" data-act="history">HISTORY</button>
                    <button class="btn btn-danger btn-xs" data-act="delete">DELETE</button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    U.qs("#acc-new").addEventListener("click", openCreateModal);
    U.qs("#acc-table").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const row = e.target.closest("tr[data-id]");
      const user = DB.state.users.find((u) => u.id === row.dataset.id);
      const act = btn.dataset.act;
      if (act === "role") openRoleModal(user);
      else if (act === "toggle") toggleStatus(user);
      else if (act === "reset") resetPassword(user);
      else if (act === "history") openHistoryModal(user);
      else if (act === "delete") UI.confirmModal(`Delete user "${user.username}"?`, { danger: true }, () => deleteUser(user));
    });
  }

  function openCreateModal() {
    UI.openModal({
      title: "CREATE USER",
      body: `
        <div class="field"><label>USERNAME</label><input type="text" id="cu-username" /></div>
        <div class="field"><label>EMAIL</label><input type="text" id="cu-email" /></div>
        <div class="field"><label>ROLE</label><select id="cu-role"><option>ADMIN</option><option selected>OPERATOR</option><option>VIEWER</option></select></div>
      `,
      foot: `<button class="btn btn-ghost" id="cu-cancel">CANCEL</button><button class="btn btn-primary" id="cu-ok">CREATE</button>`,
      onMount: (box) => {
        U.qs("#cu-cancel", box).addEventListener("click", UI.closeModal);
        U.qs("#cu-ok", box).addEventListener("click", () => {
          const username = U.qs("#cu-username", box).value.trim();
          const email = U.qs("#cu-email", box).value.trim();
          const role = U.qs("#cu-role", box).value;
          if (!username || !email) return;
          const u = { id: DB.uid("usr"), username, email, role, status: "ACTIVE", createdAt: DB.isoNow(), lastLogin: null, lastActivity: null };
          DB.state.users.push(u);
          DB.save(); UI.recordAudit("CREATE_USER", username, "SUCCESS");
          UI.closeModal(); UI.pushNotification("INFO", `User ${username} created.`);
          render(container);
        });
      },
    });
  }

  function openRoleModal(user) {
    UI.openModal({
      title: `CHANGE ROLE — ${user.username}`,
      body: `<div class="field"><label>ROLE</label><select id="cr-role">${["ADMIN", "OPERATOR", "VIEWER"].map((r) => `<option ${r === user.role ? "selected" : ""}>${r}</option>`).join("")}</select></div>`,
      foot: `<button class="btn btn-ghost" id="cr-cancel">CANCEL</button><button class="btn btn-primary" id="cr-ok">SAVE</button>`,
      onMount: (box) => {
        U.qs("#cr-cancel", box).addEventListener("click", UI.closeModal);
        U.qs("#cr-ok", box).addEventListener("click", () => {
          user.role = U.qs("#cr-role", box).value;
          DB.save(); UI.recordAudit("CHANGE_ROLE", user.username, "SUCCESS", `New role: ${user.role}`);
          UI.closeModal(); UI.pushNotification("INFO", `${user.username} is now ${user.role}.`);
          render(container);
        });
      },
    });
  }

  function toggleStatus(user) {
    user.status = user.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    DB.save();
    UI.recordAudit(user.status === "DISABLED" ? "DISABLE_USER" : "ENABLE_USER", user.username, "SUCCESS");
    UI.pushNotification("WARNING", `User ${user.username} ${user.status === "DISABLED" ? "disabled" : "enabled"}.`);
    render(container);
  }

  function resetPassword(user) {
    UI.recordAudit("RESET_PASSWORD", user.username, "SUCCESS");
    UI.pushNotification("INFO", `Password reset link issued for ${user.username} (simulated).`);
  }

  function deleteUser(user) {
    DB.state.users = DB.state.users.filter((u) => u.id !== user.id);
    DB.save(); UI.recordAudit("DELETE_USER", user.username, "SUCCESS");
    UI.closeModal(); UI.pushNotification("WARNING", `User ${user.username} deleted.`);
    render(container);
  }

  function openHistoryModal(user) {
    const events = DB.state.auditLogs.filter((a) => a.username === user.username).slice(0, 30);
    UI.openModal({
      title: `ACTIVITY HISTORY — ${user.username}`,
      wide: true,
      body: events.length === 0 ? UI.emptyState(`grep ${user.username} /var/log/audit.log`, "No recorded activity.") : `
        <table class="data-table"><thead><tr><th>TIME</th><th>ACTION</th><th>TARGET</th><th>STATUS</th></tr></thead>
        <tbody>${events.map((a) => `<tr class="no-hover"><td>${U.formatDateTime(a.timestamp)}</td><td>${a.action}</td><td>${U.escapeHtml(a.target)}</td><td>${UI.statusBadge(a.status === "SUCCESS" ? "COMPLETED" : "FAILED", a.status)}</td></tr>`).join("")}</tbody></table>
      `,
      foot: `<button class="btn btn-primary" id="hist-close">CLOSE</button>`,
      onMount: (box) => U.qs("#hist-close", box).addEventListener("click", UI.closeModal),
    });
  }

  global.PAGES = global.PAGES || {};
  global.PAGES.accounts = { render };
})(window);
