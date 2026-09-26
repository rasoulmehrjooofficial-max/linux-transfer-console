/* ============================================================================
   MAIN — bootstrap, global chrome (topbar/sidebar/statusbar/terminal/palette),
   shortcuts, and the tickers that make the console feel alive.
   ============================================================================ */

(function (global) {
  "use strict";

  const BOOT_LINES = [
    ["INITIALIZING TRANSFER-CONSOLE...", "ok"],
    ["Loading kernel modules ......... [ OK ]", "ok"],
    ["Mounting local data store ...... [ OK ]", "ok"],
    ["Starting transfer engine ....... [ OK ]", "ok"],
    ["Starting document engine ....... [ OK ]", "ok"],
    ["Checking server registry ....... [ OK ]", "ok"],
    ["No real backend configured ..... [ MOCK MODE ]", "warn"],
    ["System ready.", "ok"],
  ];

  function runBoot(done) {
    const logEl = U.qs("#boot-log");
    let i = 0;
    const step = () => {
      if (i >= BOOT_LINES.length) { setTimeout(done, 220); return; }
      const [text, cls] = BOOT_LINES[i];
      logEl.innerHTML += `<div class="${cls}">${U.escapeHtml(text)}</div>`;
      i++;
      setTimeout(step, 120);
    };
    step();
  }

  function initClock() {
    const tick = () => {
      const now = new Date();
      U.qs("#chip-time").textContent = U.formatTime(now.toISOString());
      U.qs("#sb-clock").textContent = U.formatDateTime(now.toISOString());
    };
    tick();
    setInterval(tick, 1000);
  }

  function initSystemStats() {
    global.SYS_STATS = { cpuPercent: 24, memoryPercent: 41, diskPercent: 68, networkStatus: "ONLINE" };
    function apply() {
      const s = global.SYS_STATS;
      const active = DB.state.transfers.filter((t) => t.status === "RUNNING").length;
      const queued = DB.state.transfers.filter((t) => t.status === "QUEUED").length;
      s.cpuPercent = Math.max(4, Math.min(97, Math.round(12 + active * 14 + (Math.random() * 10 - 5))));
      s.memoryPercent = Math.max(10, Math.min(95, Math.round(30 + active * 6 + (Math.random() * 8 - 4))));
      s.diskPercent = Math.min(99, s.diskPercent + (Math.random() > 0.7 ? 0.05 : 0));

      U.qs("#sb-cpu").textContent = s.cpuPercent + "%";
      U.qs("#sb-mem").textContent = s.memoryPercent + "%";
      U.qs("#sb-disk").textContent = s.diskPercent.toFixed(1) + "%";
      U.qs("#sb-active").textContent = String(active);
      U.qs("#sb-queued").textContent = String(queued);
      U.qs("#mini-cpu").style.width = s.cpuPercent + "%";
      U.qs("#mini-mem").style.width = s.memoryPercent + "%";
      U.qs("#mini-disk").style.width = s.diskPercent + "%";
    }
    apply();
    setInterval(apply, 2000);
  }

  function initTransferEngine() {
    setInterval(() => {
      if (global.PAGES && global.PAGES.transfers) global.PAGES.transfers.tick();
    }, 1000);
  }

  function initSidebarToggle() {
    const sidebar = U.qs("#sidebar");
    if (global.innerWidth <= 860) sidebar.classList.add("collapsed");
    U.qs("#btn-toggle-sidebar").addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
    });
    // Auto-close the overlay sidebar after picking a route on narrow screens.
    sidebar.addEventListener("click", (e) => {
      if (global.innerWidth <= 860 && e.target.closest(".nav-item")) {
        sidebar.classList.add("collapsed");
      }
    });
  }

  function initNotifications() {
    UI.renderNotifications();
    const drawer = U.qs("#notif-drawer");
    U.qs("#btn-notifications").addEventListener("click", () => drawer.classList.toggle("open"));
    U.qs("#btn-close-notif").addEventListener("click", () => drawer.classList.remove("open"));
    U.qs("#btn-mark-all-read").addEventListener("click", () => { DB.state.notifications.forEach((n) => n.read = true); DB.save(); UI.renderNotifications(); });
    U.qs("#notif-list").addEventListener("click", (e) => {
      const item = e.target.closest(".notif-item");
      if (!item) return;
      const n = DB.state.notifications.find((x) => x.id === item.dataset.id);
      if (n) { n.read = true; DB.save(); UI.renderNotifications(); }
    });
  }

  // -----------------------------------------------------------------
  // Terminal panel — live log feed AND a typable interactive shell
  // (mock command interpreter; section 27 / future WebSocket-to-SSH slot)
  // -----------------------------------------------------------------
  function hostLabel() {
    const s = DB.state.session;
    return `${s.username}@${s.currentServerName || "transfer-node"}`;
  }

  function initTerminal() {
    const panel = U.qs("#terminal-panel");
    const body = U.qs("#terminal-body");
    const input = U.qs("#terminal-input");
    const promptEl = U.qs("#terminal-prompt");
    const headLabel = U.qs("#terminal-head-label");

    let cwd = "/";
    const cmdHistory = [];
    let historyIdx = -1;

    function refreshPrompt() {
      promptEl.textContent = `${hostLabel()}:${cwd}$`;
      headLabel.innerHTML = `${hostLabel()}:${cwd}# <span class="blink">_</span> LIVE CONSOLE`;
    }
    refreshPrompt();

    function appendLine(text, level) {
      const line = document.createElement("div");
      line.className = "terminal-line " + (level || "");
      line.textContent = text;
      body.appendChild(line);
      while (body.children.length > 400) body.removeChild(body.firstChild);
      body.scrollTop = body.scrollHeight;
    }

    U.qs("#btn-terminal").addEventListener("click", () => {
      panel.classList.toggle("hidden");
      if (!panel.classList.contains("hidden")) setTimeout(() => input.focus(), 10);
    });
    U.qs("#btn-close-terminal").addEventListener("click", () => panel.classList.add("hidden"));
    U.qs("#btn-clear-terminal").addEventListener("click", () => { body.innerHTML = ""; });

    appendLine(`${hostLabel()}:~# tail -f /var/log/transfer-engine.log`);

    // ---- background log tailing (unchanged behavior) ------------------
    let lastAuditCount = DB.state.auditLogs.length;
    let lastLogCount = DB.state.transferLogs.length;
    setInterval(() => {
      if (DB.state.auditLogs.length > lastAuditCount) {
        DB.state.auditLogs.slice(0, DB.state.auditLogs.length - lastAuditCount).reverse().forEach((a) => {
          appendLine(`[${U.formatTime(a.timestamp)}] AUDIT  ${a.username}  ${a.action}  ${a.target}  ${a.status}`, a.status === "FAILED" ? "ERROR" : "");
        });
        lastAuditCount = DB.state.auditLogs.length;
      }
      if (DB.state.transferLogs.length > lastLogCount) {
        DB.state.transferLogs.slice(lastLogCount).forEach((l) => {
          appendLine(`[${U.formatTime(l.timestamp)}] TRANSFER ${l.transferId.slice(0, 10)}  ${l.message}`, l.level);
        });
        lastLogCount = DB.state.transferLogs.length;
      }
    }, 1200);

    // ---- interactive command interpreter (mock shell) ------------------
    function resolvePath(arg) {
      if (!arg) return cwd;
      if (arg === "..") {
        if (cwd === "/") return "/";
        const parts = cwd.split("/").filter(Boolean); parts.pop();
        return parts.length ? "/" + parts.join("/") : "/";
      }
      if (arg.startsWith("/")) return arg.replace(/\/+$/, "") || "/";
      return (cwd === "/" ? "" : cwd) + "/" + arg;
    }

    function run(raw) {
      const trimmed = raw.trim();
      if (!trimmed) return;
      cmdHistory.push(trimmed);
      historyIdx = cmdHistory.length;
      appendLine(`${hostLabel()}:${cwd}$ ${trimmed}`, "CMD");

      const [cmd, ...rest] = trimmed.split(/\s+/);
      const arg = rest.join(" ");

      switch (cmd) {
        case "help":
          ["help", "ls [path]", "cd <path>", "pwd", "whoami", "hostname", "uptime", "df", "free",
            "ps", "top", "date", "cat <file>", "echo <text>", "transfers", "servers", "history",
            "clear", "exit / logout"].forEach((l) => appendLine("  " + l));
          break;
        case "pwd":
          appendLine(cwd);
          break;
        case "cd": {
          const target = resolvePath(arg || "/");
          const exists = target === "/" || DB.state.files.some((f) => f.path === target && f.type === "DIRECTORY");
          if (exists) { cwd = target; refreshPrompt(); }
          else appendLine(`cd: no such directory: ${target}`, "ERROR");
          break;
        }
        case "ls": {
          const target = resolvePath(arg);
          const items = DB.state.files.filter((f) => f.parentPath === target);
          if (items.length === 0) appendLine("(empty)");
          else items.forEach((f) => appendLine(`${f.type === "DIRECTORY" ? "d" : "-"}${f.permissions}  ${f.type === "DIRECTORY" ? f.name + "/" : f.name}`));
          break;
        }
        case "cat": {
          if (!arg) { appendLine("usage: cat <file>", "ERROR"); break; }
          const target = resolvePath(arg);
          const f = DB.state.files.find((x) => x.path === target && x.type === "FILE");
          if (!f) { appendLine(`cat: ${arg}: No such file`, "ERROR"); break; }
          appendLine(`# ${f.name} — ${U.formatBytes(f.size)}, owner ${f.owner}, modified ${U.formatDateTime(f.modifiedAt)}`);
          appendLine("(binary or content not stored in this demo dataset)");
          break;
        }
        case "whoami":
          appendLine(`${DB.state.session.username} (${DB.state.session.role})`);
          break;
        case "hostname":
          appendLine(DB.state.session.currentServerName || "transfer-node");
          break;
        case "uptime": {
          const s = DB.state.servers.find((x) => x.id === DB.state.session.currentServerId);
          appendLine(s ? U.formatUptime(s.uptimeSeconds) : "unknown");
          break;
        }
        case "df":
          appendLine(`Filesystem      Size  Used  Avail  Use%`);
          appendLine(`/dev/root       512G  ${Math.round((global.SYS_STATS.diskPercent / 100) * 512)}G   ${Math.round((1 - global.SYS_STATS.diskPercent / 100) * 512)}G   ${global.SYS_STATS.diskPercent.toFixed(0)}%`);
          break;
        case "free":
          appendLine(`Mem:  used ${global.SYS_STATS.memoryPercent}%   free ${100 - global.SYS_STATS.memoryPercent}%`);
          break;
        case "ps": {
          const running = DB.state.transfers.filter((t) => t.status === "RUNNING" || t.status === "QUEUED");
          if (running.length === 0) appendLine("(no active processes)");
          appendLine(`PID      STAT      CMD`);
          running.forEach((t) => appendLine(`${t.id.slice(-6).padEnd(8)} ${t.status.padEnd(9)} transfer ${t.code} ${t.fileName}`));
          break;
        }
        case "top":
          appendLine(`CPU ${global.SYS_STATS.cpuPercent}%   MEM ${global.SYS_STATS.memoryPercent}%   DISK ${global.SYS_STATS.diskPercent.toFixed(1)}%   ACTIVE ${DB.state.transfers.filter((t) => t.status === "RUNNING").length}`);
          break;
        case "date":
          appendLine(U.formatDateTime(DB.isoNow()));
          break;
        case "echo":
          appendLine(arg);
          break;
        case "transfers": {
          const c = { QUEUED: 0, RUNNING: 0, COMPLETED: 0, FAILED: 0, CANCELLED: 0, PAUSED: 0 };
          DB.state.transfers.forEach((t) => c[t.status]++);
          appendLine(`RUNNING ${c.RUNNING}  QUEUED ${c.QUEUED}  COMPLETED ${c.COMPLETED}  FAILED ${c.FAILED}  CANCELLED ${c.CANCELLED}`);
          break;
        }
        case "servers":
          DB.state.servers.forEach((s) => appendLine(`${s.name.padEnd(16)} ${s.host.padEnd(16)} ${s.protocol.padEnd(6)} ${s.status}`));
          break;
        case "history":
          cmdHistory.forEach((h, i) => appendLine(`  ${i + 1}  ${h}`));
          break;
        case "clear":
          body.innerHTML = "";
          break;
        case "exit":
        case "logout":
          appendLine("Closing session...", "WARNING");
          setTimeout(() => { panel.classList.add("hidden"); disconnectToHostPicker(); }, 400);
          break;
        default:
          appendLine(`command not found: ${cmd} — type 'help'`, "ERROR");
      }
    }

    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        const val = input.value;
        input.value = "";
        run(val);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (cmdHistory.length === 0) return;
        historyIdx = Math.max(0, historyIdx - 1);
        input.value = cmdHistory[historyIdx] || "";
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        historyIdx = Math.min(cmdHistory.length, historyIdx + 1);
        input.value = cmdHistory[historyIdx] || "";
      }
    });
  }

  // -----------------------------------------------------------------
  // Global search / command palette
  // -----------------------------------------------------------------
  function buildSearchIndex(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const results = [];

    DB.state.transfers.forEach((t) => {
      if (t.code.toLowerCase().includes(q) || t.fileName.toLowerCase().includes(q)) {
        results.push({ group: "TRANSFERS", label: `${t.code} — ${t.fileName}`, sub: t.status, href: `transfers/${t.id}` });
      }
    });
    DB.state.files.forEach((f) => {
      if (f.name.toLowerCase().includes(q)) {
        results.push({ group: "FILES", label: f.path, sub: f.type, href: `files${f.type === "DIRECTORY" ? f.path : f.parentPath}` });
      }
    });
    DB.state.documents.forEach((d) => {
      if (d.title.toLowerCase().includes(q) || d.docId.toLowerCase().includes(q)) {
        results.push({ group: "DOCUMENTS", label: `${d.docId} — ${d.title}`, sub: `v${d.currentVersion}`, href: `documents/${d.id}` });
      }
    });
    (global.BULLETIN_DATA || []).forEach((b) => {
      if (b.title.toLowerCase().includes(q) || (b.tag || "").toLowerCase().includes(q)) {
        results.push({ group: "BULLETIN", label: b.title, sub: b.tag, href: `bulletin/${b.id}` });
      }
    });
    DB.state.users.forEach((u) => {
      if (u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) {
        results.push({ group: "ACCOUNTS", label: u.username, sub: u.role, href: `accounts` });
      }
    });
    DB.state.servers.forEach((s) => {
      if (s.name.toLowerCase().includes(q) || s.host.includes(q)) {
        results.push({ group: "SERVERS", label: `${s.name} (${s.host})`, sub: s.status, href: `servers` });
      }
    });
    DB.state.auditLogs.forEach((a) => {
      if (a.target.toLowerCase().includes(q) || a.action.toLowerCase().includes(q)) {
        results.push({ group: "LOGS", label: `${a.action} — ${a.target}`, sub: a.status, href: `logs` });
      }
    });
    return results.slice(0, 40);
  }

  function initPalette() {
    const overlay = U.qs("#search-overlay");
    const input = U.qs("#palette-input");
    const results = U.qs("#palette-results");
    let selected = 0;
    let current = [];

    function open() {
      overlay.classList.remove("hidden");
      input.value = "";
      results.innerHTML = "";
      selected = 0;
      setTimeout(() => input.focus(), 10);
    }
    function close() { overlay.classList.add("hidden"); }

    function renderResults(list) {
      current = list;
      if (list.length === 0) {
        results.innerHTML = input.value.trim() ? UI.emptyState(`find / -iname "*${input.value.trim()}*"`, "No matches.") : "";
        return;
      }
      const groups = {};
      list.forEach((r) => { (groups[r.group] = groups[r.group] || []).push(r); });
      let html = "";
      let idx = 0;
      for (const [g, items] of Object.entries(groups)) {
        html += `<div class="palette-group-label">${g}</div>`;
        items.forEach((r) => {
          html += `<div class="palette-item ${idx === selected ? "sel" : ""}" data-idx="${idx}" data-href="${r.href}"><span>${U.escapeHtml(r.label)}</span><small>${U.escapeHtml(r.sub)}</small></div>`;
          idx++;
        });
      }
      results.innerHTML = html;
    }

    input.addEventListener("input", U.debounce(() => { selected = 0; renderResults(buildSearchIndex(input.value)); }, 120));
    results.addEventListener("click", (e) => {
      const item = e.target.closest(".palette-item");
      if (item) { ROUTER.navigate(item.dataset.href); close(); }
    });

    document.addEventListener("keydown", (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); open(); }
      else if (e.key === "Escape") {
        if (!overlay.classList.contains("hidden")) close();
        else if (!U.qs("#modal-overlay").classList.contains("hidden")) UI.closeModal();
        else U.qs("#notif-drawer").classList.remove("open");
      } else if (!overlay.classList.contains("hidden")) {
        if (e.key === "ArrowDown") { e.preventDefault(); selected = Math.min(current.length - 1, selected + 1); renderResults(current); scrollSel(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); selected = Math.max(0, selected - 1); renderResults(current); scrollSel(); }
        else if (e.key === "Enter") { const r = current[selected]; if (r) { ROUTER.navigate(r.href); close(); } }
      } else if (mod && e.key.toLowerCase() === "s") {
        if (ROUTER.parseHash().startsWith("documents/")) { e.preventDefault(); global.PAGES.documents.saveHotkey(); }
      } else if (mod && e.key.toLowerCase() === "n") {
        e.preventDefault(); ROUTER.navigate("documents");
      } else if (mod && e.key.toLowerCase() === "u") {
        if (ROUTER.parseHash().startsWith("files")) e.preventDefault();
      }
    });

    function scrollSel() {
      const el = results.querySelector(".palette-item.sel");
      if (el) el.scrollIntoView({ block: "nearest" });
    }

    U.qs("#btn-search").addEventListener("click", open);
  }

  // -----------------------------------------------------------------
  // Host connection screen (Termius-style picker) — the real entry point.
  // Boot log -> pick a host -> short "connecting" transition -> app shell.
  // -----------------------------------------------------------------
  let appBooted = false;

  function hostIconGlyph(server) {
    return (server.os || server.protocol || "?").trim().charAt(0).toUpperCase();
  }

  function renderHostGrid(filter) {
    const grid = U.qs("#host-grid");
    const q = (filter || "").trim().toLowerCase();
    const items = DB.state.servers.filter((s) =>
      !q || s.name.toLowerCase().includes(q) || s.host.includes(q) || s.username.toLowerCase().includes(q)
    );
    if (items.length === 0) {
      grid.innerHTML = UI.emptyState("find ~/.ssh/known_hosts", "No matching hosts.");
      return;
    }
    grid.innerHTML = items.map((s) => `
      <div class="host-card" data-id="${s.id}">
        <div class="host-icon">${hostIconGlyph(s)}</div>
        <div class="host-info">
          <div class="host-name">${U.escapeHtml(s.username)}@${U.escapeHtml(s.host)}</div>
          <div class="host-sub">${s.protocol.toLowerCase()}, ${U.escapeHtml(s.os || "unknown os")} — ${U.escapeHtml(s.name)}</div>
        </div>
        <div class="host-status">${UI.statusBadge(s.status)}</div>
      </div>
    `).join("");
    U.qsa(".host-card", grid).forEach((card) => {
      card.addEventListener("click", () => {
        const server = DB.state.servers.find((s) => s.id === card.dataset.id);
        if (server) connectToHost(server);
      });
    });
  }

  function openNewHostModal() {
    UI.openModal({
      title: "NEW HOST",
      body: `
        <div class="field-row">
          <div class="field"><label>NAME</label><input type="text" id="nh-name" placeholder="SRV-NEW-01" /></div>
          <div class="field"><label>PROTOCOL</label><select id="nh-protocol">${["SSH", "SFTP", "FTP", "SCP", "HTTP_API"].map((p) => `<option>${p}</option>`).join("")}</select></div>
        </div>
        <div class="field-row">
          <div class="field"><label>HOST / IP</label><input type="text" id="nh-host" placeholder="10.20.0.50" /></div>
          <div class="field"><label>PORT</label><input type="number" id="nh-port" value="22" /></div>
        </div>
        <div class="field"><label>USERNAME</label><input type="text" id="nh-username" placeholder="root" value="root" /></div>
      `,
      foot: `<button class="btn btn-ghost" id="nh-cancel">CANCEL</button><button class="btn btn-primary" id="nh-ok">ADD HOST</button>`,
      onMount: (box) => {
        U.qs("#nh-cancel", box).addEventListener("click", UI.closeModal);
        U.qs("#nh-ok", box).addEventListener("click", () => {
          const name = U.qs("#nh-name", box).value.trim();
          const host = U.qs("#nh-host", box).value.trim();
          if (!name || !host) return;
          const s = {
            id: DB.uid("srv"), name, host, port: Number(U.qs("#nh-port", box).value) || 22,
            protocol: U.qs("#nh-protocol", box).value, username: U.qs("#nh-username", box).value.trim() || "root",
            status: "UNKNOWN", lastConnection: null, createdAt: DB.isoNow(),
            os: null, kernel: null, uptimeSeconds: 0, cpuPercent: 0, ramPercent: 0, diskPercent: 0, networkStatus: null,
          };
          DB.state.servers.push(s);
          DB.save();
          UI.closeModal();
          renderHostGrid(U.qs("#connect-search").value);
        });
      },
    });
  }

  function initConnectScreen() {
    renderHostGrid("");
    U.qs("#connect-search").addEventListener("input", U.debounce((e) => renderHostGrid(e.target.value), 120));
    U.qs("#connect-new-host").addEventListener("click", openNewHostModal);
  }

  function connectToHost(server) {
    const overlay = U.qs("#connect-transition");
    const log = U.qs("#connect-log");
    log.innerHTML = "";
    overlay.classList.remove("hidden");

    const lines = [
      [`Resolving ${server.host}...`, "ok"],
      [`Connecting to ${server.host}:${server.port} (${server.protocol})...`, "ok"],
      [`Authenticating as ${server.username}...`, "ok"],
      server.status === "ERROR" ? ["Warning: last known status was ERROR — retrying...", "warn"] : ["Handshake OK.", "ok"],
      [`Session established. Welcome to ${server.name}.`, "ok"],
    ];
    let i = 0;
    const step = () => {
      if (i >= lines.length) {
        setTimeout(() => {
          overlay.classList.add("hidden");
          U.qs("#connect-screen").classList.add("hidden");
          DB.state.session.currentServerId = server.id;
          DB.state.session.currentServerName = server.name;
          server.status = "ONLINE";
          server.lastConnection = DB.isoNow();
          DB.save();
          if (!appBooted) { bootApp(); appBooted = true; }
          else {
            U.qs("#chip-server-name").textContent = server.name;
            U.qs("#app").classList.remove("hidden");
            UI.recordAudit("CONNECT_HOST", server.name, "SUCCESS");
            UI.pushNotification("INFO", `Connected to ${server.name}.`);
            ROUTER.resolve();
          }
        }, 250);
        return;
      }
      const [text, cls] = lines[i];
      log.innerHTML += `<div class="${cls}">${U.escapeHtml(text)}</div>`;
      i++;
      setTimeout(step, 260);
    };
    step();
  }

  function disconnectToHostPicker() {
    U.qs("#app").classList.add("hidden");
    U.qs("#connect-screen").classList.remove("hidden");
    renderHostGrid("");
  }
  global.disconnectToHostPicker = disconnectToHostPicker;

  function showConnectScreen() {
    DB.load();
    if (!DB.state.session.currentServerName) DB.state.session.currentServerName = null;
    initConnectScreen();
    U.qs("#boot-screen").classList.add("hidden");
    U.qs("#connect-screen").classList.remove("hidden");
  }

  // -----------------------------------------------------------------
  // App shell boot (runs once, after the first host connection)
  // -----------------------------------------------------------------
  function bootApp() {
    U.qs("#chip-username").textContent = DB.state.session.username;
    U.qs("#chip-server-name").textContent = DB.state.session.currentServerName || "—";

    initClock();
    initSystemStats();
    initSidebarToggle();
    initNotifications();
    initTerminal();
    initPalette();
    initTransferEngine();
    U.qs("#btn-disconnect").addEventListener("click", () => {
      UI.confirmModal("Disconnect and return to the host list?", {}, () => {
        UI.recordAudit("DISCONNECT_HOST", DB.state.session.currentServerName || "unknown", "SUCCESS");
        disconnectToHostPicker();
      });
    });

    global.addEventListener("hashchange", ROUTER.resolve);
    ROUTER.resolve();

    U.qs("#app").classList.remove("hidden");
    UI.recordAudit("CONNECT_HOST", DB.state.session.currentServerName || "unknown", "SUCCESS");
  }

  if ("serviceWorker" in navigator) {
    global.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  runBoot(showConnectScreen);
})(window);
