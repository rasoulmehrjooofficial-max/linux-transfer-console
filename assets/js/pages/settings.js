/* ============================================================================
   PAGE: /settings — org defaults, session info, data reset, shortcuts ref
   ============================================================================ */

(function (global) {
  "use strict";

  function render(container) {
    const s = DB.state.settings;
    container.innerHTML = `
      <div class="page-head">
        <div><span class="page-title">SETTINGS</span><span class="page-path">/settings</span></div>
      </div>

      <div class="grid grid-2">
        <div class="panel">
          <div class="panel-head">ORGANIZATION DEFAULTS</div>
          <div class="panel-body">
            <div class="field"><label>ORGANIZATION NAME</label><input type="text" id="st-org" value="${U.escapeHtml(s.orgName)}" /></div>
            <div class="field"><label>HOSTNAME</label><input type="text" id="st-host" value="${U.escapeHtml(s.hostname)}" /></div>
            <div class="field"><label>TIMEZONE</label><input type="text" id="st-tz" value="${U.escapeHtml(s.timezone)}" /></div>
            <div class="field"><label>DEFAULT CONFIDENTIALITY TEXT</label><input type="text" id="st-conf" value="${U.escapeHtml(s.confidentialityDefault)}" /></div>
            <button class="btn btn-primary" id="st-save">SAVE SETTINGS</button>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head">SESSION</div>
          <div class="panel-body">
            <table class="kv-table">
              <tr><td>USER</td><td>${U.escapeHtml(DB.state.session.username)}</td></tr>
              <tr><td>ROLE</td><td>${UI.roleBadge(DB.state.session.role)}</td></tr>
              <tr><td>MODE</td><td><span class="badge badge-yellow">MOCK / DEMO DATA</span></td></tr>
            </table>
            <div class="field-hint" style="margin-top:10px">
              This build runs entirely client-side against localStorage. No server, database, or
              network calls are made. See "FUTURE SERVER CONNECTION" below for how real backends plug in.
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">KEYBOARD SHORTCUTS</div>
        <div class="panel-body">
          <table class="kv-table">
            <tr><td><kbd>⌘/Ctrl K</kbd></td><td>Global search</td></tr>
            <tr><td><kbd>⌘/Ctrl S</kbd></td><td>Save document (in editor)</td></tr>
            <tr><td><kbd>⌘/Ctrl N</kbd></td><td>New document</td></tr>
            <tr><td><kbd>⌘/Ctrl U</kbd></td><td>Upload (in file manager)</td></tr>
            <tr><td><kbd>ESC</kbd></td><td>Close modal / palette</td></tr>
          </table>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">FUTURE SERVER CONNECTION ARCHITECTURE</div>
        <div class="panel-body">
          <p>Every server record carries a <code>protocol</code> field (SSH / SFTP / FTP / SCP / HTTP API). Connections
          are created through <code>CONN.connectionFor(server)</code> in <code>assets/js/data.js</code>, which currently
          always resolves to <code>MockConnection</code>. Wiring a real transport means implementing
          <code>SSHConnection</code> / <code>SFTPConnection</code> / <code>FTPConnection</code> / <code>APIConnection</code>
          (already declared as classes) against a real backend endpoint — no other UI code needs to change.</p>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">DEMO DATA</div>
        <div class="panel-body">
          <p class="field-hint">Reset wipes localStorage and regenerates the seeded demo dataset (servers, users, transfers, files, documents, logs).</p>
          <button class="btn btn-danger" id="st-reset">RESET DEMO DATA</button>
        </div>
      </div>
    `;

    U.qs("#st-save").addEventListener("click", () => {
      s.orgName = U.qs("#st-org").value;
      s.hostname = U.qs("#st-host").value;
      s.timezone = U.qs("#st-tz").value;
      s.confidentialityDefault = U.qs("#st-conf").value;
      DB.save();
      UI.recordAudit("UPDATE_SETTINGS", "system_settings", "SUCCESS");
      UI.pushNotification("INFO", "Settings saved.");
    });

    U.qs("#st-reset").addEventListener("click", () => {
      UI.confirmModal("Reset all demo data? This clears every change made in this browser.", { danger: true }, () => {
        DB.reset();
        UI.pushNotification("WARNING", "Demo data reset.");
        ROUTER.navigate("dashboard");
        global.location.reload();
      });
    });
  }

  global.PAGES = global.PAGES || {};
  global.PAGES.settings = { render };
})(window);
