/* ============================================================================
   DB — mock data layer + localStorage persistence.
   This stands in for a real backend. Every read/write goes through this
   object so a future real API client can be swapped in without touching
   page code (see CONN.* in this file for the server-connection abstraction).
   ============================================================================ */

(function (global) {
  "use strict";

  const STORAGE_KEY = "ltc_console_state_v1";
  const SEQ_KEY = "ltc_console_seq_v1";

  function uid(prefix) {
    const rand = Math.random().toString(36).slice(2, 8);
    const t = Date.now().toString(36).slice(-5);
    return `${prefix ? prefix + "_" : ""}${t}${rand}`;
  }

  function pad(n, len) {
    return String(n).padStart(len, "0");
  }

  function isoNow() {
    return new Date().toISOString();
  }

  function daysAgoIso(days, hourOffset) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    if (hourOffset !== undefined) {
      // Never place a "days ago" timestamp in the future relative to now —
      // matters most for days=0, where any hour > current hour would be later today.
      const safeHour = days === 0 ? Math.min(hourOffset, new Date().getHours()) : hourOffset;
      d.setHours(safeHour, (days * 7) % 60, (days * 13) % 60, 0);
    }
    return d.toISOString();
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // --------------------------------------------------------------------
  // Sequence counters (persisted so codes keep incrementing across visits)
  // --------------------------------------------------------------------
  let seq = { transfer: 0, document: 0 };

  function loadSeq() {
    try {
      const raw = localStorage.getItem(SEQ_KEY);
      if (raw) seq = JSON.parse(raw);
    } catch (e) { /* ignore corrupt state */ }
  }

  function saveSeq() {
    localStorage.setItem(SEQ_KEY, JSON.stringify(seq));
  }

  function nextTransferCode() {
    seq.transfer += 1;
    saveSeq();
    return `TR-${new Date().getFullYear()}-${pad(seq.transfer, 5)}`;
  }

  function nextDocumentCode() {
    seq.document += 1;
    saveSeq();
    return `DOC-${pad(seq.document, 6)}`;
  }

  // --------------------------------------------------------------------
  // Seed generation
  // --------------------------------------------------------------------
  function buildSeed() {
    const users = [
      { id: uid("usr"), username: "admin", email: "admin@transfer-node.local", role: "ADMIN", status: "ACTIVE", createdAt: daysAgoIso(120), lastLogin: daysAgoIso(0, 8), lastActivity: daysAgoIso(0, 9) },
      { id: uid("usr"), username: "operator1", email: "operator1@transfer-node.local", role: "OPERATOR", status: "ACTIVE", createdAt: daysAgoIso(96), lastLogin: daysAgoIso(1, 14), lastActivity: daysAgoIso(0, 11) },
      { id: uid("usr"), username: "operator2", email: "operator2@transfer-node.local", role: "OPERATOR", status: "ACTIVE", createdAt: daysAgoIso(80), lastLogin: daysAgoIso(3, 10), lastActivity: daysAgoIso(3, 10) },
      { id: uid("usr"), username: "viewer.audit", email: "audit@transfer-node.local", role: "VIEWER", status: "ACTIVE", createdAt: daysAgoIso(60), lastLogin: daysAgoIso(6, 9), lastActivity: daysAgoIso(6, 9) },
      { id: uid("usr"), username: "j.disabled", email: "j.disabled@transfer-node.local", role: "OPERATOR", status: "DISABLED", createdAt: daysAgoIso(200), lastLogin: daysAgoIso(45, 12), lastActivity: daysAgoIso(45, 12) },
    ];

    const servers = [
      { id: uid("srv"), name: "QYREVA-VPS", host: "217.60.192.204", port: 22, protocol: "SSH", username: "ubuntu", status: "ONLINE", lastConnection: daysAgoIso(0, 8), createdAt: daysAgoIso(60), os: "Ubuntu 22.04 LTS", kernel: "5.15.0-119-generic", uptimeSeconds: 5433120, cpuPercent: 18, ramPercent: 37, diskPercent: 54, networkStatus: "ONLINE" },
    ];

    // ---- files -------------------------------------------------------
    const dirDefs = [
      ["/", "home", "DIRECTORY"],
      ["/", "var", "DIRECTORY"],
      ["/", "data", "DIRECTORY"],
      ["/", "backups", "DIRECTORY"],
      ["/", "documents", "DIRECTORY"],
      ["/", "uploads", "DIRECTORY"],
      ["/home", "rama", "DIRECTORY"],
      ["/var", "log", "DIRECTORY"],
      ["/data", "incoming", "DIRECTORY"],
      ["/data", "processed", "DIRECTORY"],
      ["/documents", "reports", "DIRECTORY"],
      ["/uploads", "logos", "DIRECTORY"],
    ];
    const fileDefs = [
      ["/home/rama", "notes.txt", 4820],
      ["/home/rama", "todo.md", 1230],
      ["/home/rama", "id_rsa.pub", 580],
      ["/var/log", "system.log", 2202112],
      ["/var/log", "auth.log", 883212],
      ["/var/log", "transfer-engine.log", 4021009],
      ["/data", "readme.txt", 900],
      ["/data/incoming", "payload-0091.zip", 184203112],
      ["/data/incoming", "payload-0092.zip", 92112044],
      ["/data/incoming", "sensor-dump.csv", 5502211],
      ["/data/processed", "output-final.tar.gz", 771302011],
      ["/data/processed", "checksum.sha256", 128],
      ["/backups", "db-snapshot-2026-09-10.sql.gz", 512004112],
      ["/backups", "db-snapshot-2026-09-11.sql.gz", 519201933],
      ["/backups", "full-system-2026-08-30.img", 12042001233],
      ["/documents", "policy.pdf", 220112],
      ["/documents/reports", "q1-summary.pdf", 1042221],
      ["/documents/reports", "q2-summary.pdf", 998211],
      ["/documents/reports", "incident-0031.docx", 88211],
      ["/uploads", "avatar-admin.png", 20211],
      ["/uploads/logos", "org-logo.png", 40233],
      ["/", "server.conf", 2211],
      ["/", "install.sh", 3301],
      ["/var", "www-cache.bin", 20933211],
      ["/data", "archive-old.zip", 630021144],
      ["/backups", "weekly-2026-09-04.tar", 401203122],
      ["/documents", "contract-template.docx", 55211],
      ["/documents/reports", "audit-2026-08.pdf", 322110],
      ["/uploads", "banner.svg", 8021],
      ["/data/incoming", "metrics-export.json", 991022],
    ];
    const owners = ["root", "admin", "operator1", "svc-transfer", "svc-backup"];
    const files = [];
    for (const [parent, name] of dirDefs) {
      const p = parent === "/" ? `/${name}` : `${parent}/${name}`;
      files.push({
        id: uid("file"), name, path: p, parentPath: parent, type: "DIRECTORY", size: 0,
        owner: "root", permissions: "rwxr-xr-x",
        modifiedAt: daysAgoIso(randInt(1, 90)), createdAt: daysAgoIso(randInt(91, 300)),
      });
    }
    for (const [parent, name, size] of fileDefs) {
      const p = `${parent === "/" ? "" : parent}/${name}`;
      files.push({
        id: uid("file"), name, path: p, parentPath: parent, type: "FILE", size,
        owner: pick(owners), permissions: pick(["rw-r--r--", "rw-rw-r--", "rwxr-xr-x", "rw-------"]),
        modifiedAt: daysAgoIso(randInt(0, 60)), createdAt: daysAgoIso(randInt(61, 260)),
      });
    }

    // ---- transfers -----------------------------------------------------
    const protocols = ["SSH", "SFTP", "FTP", "SCP", "HTTP_API"];
    const kinds = ["UPLOAD", "DOWNLOAD", "SERVER_TO_SERVER", "LOCAL_TO_SERVER", "SERVER_TO_LOCAL", "FILE_TO_FILE", "DIRECTORY_TO_DIRECTORY"];
    const statuses = ["QUEUED", "RUNNING", "COMPLETED", "COMPLETED", "COMPLETED", "FAILED", "CANCELLED", "PAUSED"];
    const sampleFiles = ["backup.tar.gz", "payload-0091.zip", "db-snapshot.sql.gz", "sensor-dump.csv", "output-final.tar.gz", "weekly-report.pdf", "full-system.img", "metrics-export.json", "checksum.sha256", "archive-old.zip"];
    const transfers = [];
    const transferLogs = [];
    for (let i = 0; i < 20; i++) {
      const status = pick(statuses);
      const user = pick(users);
      const size = randInt(50, 18000) * 1024 * 1024;
      const isDone = status === "COMPLETED" || status === "FAILED" || status === "CANCELLED";
      const progress = status === "COMPLETED" ? 100 : status === "QUEUED" ? 0 : status === "RUNNING" ? randInt(5, 95) : status === "PAUSED" ? randInt(10, 80) : randInt(0, 70);
      const bytesTransferred = Math.floor((progress / 100) * size);
      const createdDaysAgo = randInt(0, 45);
      const start = status === "QUEUED" ? null : daysAgoIso(createdDaysAgo, randInt(0, 23));
      const durationSeconds = isDone ? randInt(10, 4000) : null;
      const srv = pick(servers);
      const id = uid("tr");
      transfers.push({
        id,
        code: nextTransferCode(),
        kind: pick(kinds),
        userId: user.id,
        username: user.username,
        source: pick([`local:/Users/${user.username}/Downloads`, `${srv.name}:/data/incoming`, `${srv.name}:/backups`]),
        destination: pick([`${srv.name}:/data/processed`, `${servers[(servers.indexOf(srv)+1)%servers.length].name}:/backups`, `local:/Volumes/Archive`]),
        fileName: pick(sampleFiles),
        fileSize: size,
        bytesTransferred,
        protocol: pick(protocols),
        speedBps: status === "RUNNING" ? randInt(2, 180) * 1024 * 1024 : 0,
        progress,
        status,
        startTime: start,
        endTime: isDone && start ? new Date(new Date(start).getTime() + (durationSeconds || 0) * 1000).toISOString() : null,
        durationSeconds,
        errorMessage: status === "FAILED" ? pick(["Connection timeout.", "Authentication failed.", "Disk quota exceeded on destination.", "Checksum mismatch after transfer."]) : null,
        createdAt: daysAgoIso(createdDaysAgo, randInt(0, 23)),
      });

      const logCount = randInt(3, 6);
      const baseMsgs = [
        ["INFO", "Connection established"], ["INFO", "Authentication succeeded"], ["INFO", "Transfer started"],
        ["INFO", "Chunk 001 transferred"], ["INFO", "Chunk 002 transferred"], ["WARNING", "Transfer speed dropped below threshold"],
        ["INFO", "Resuming after pause"], ["ERROR", "Connection reset by peer"], ["INFO", "Verifying checksum"],
        ["INFO", "Transfer completed successfully"],
      ];
      for (let j = 0; j < logCount; j++) {
        const [level, message] = pick(baseMsgs);
        transferLogs.push({
          id: uid("log"), transferId: id,
          timestamp: daysAgoIso(createdDaysAgo, (j) % 24),
          level, message,
        });
      }
    }

    // ---- documents -----------------------------------------------------
    const docTemplates = ["DATA_TRANSFER_REPORT", "SERVER_INFORMATION", "FILE_INFORMATION", "INCIDENT_REPORT", "SYSTEM_STATUS_REPORT", "TRANSFER_SUMMARY", "INFORMATION_SHEET"];
    const documents = [];
    const documentVersions = [];
    for (let i = 0; i < 10; i++) {
      const template = pick(docTemplates);
      const createdAt = daysAgoIso(randInt(1, 90));
      const docId = uid("doc");
      const author = pick(users).username;
      const title = `${template.replace(/_/g, " ")} #${i + 1}`;
      documents.push({
        id: docId,
        docId: nextDocumentCode(),
        title,
        template,
        contentHtml: DEFAULT_TEMPLATES[template] ? DEFAULT_TEMPLATES[template]() : "<p>Empty document.</p>",
        header: { logoUrl: null, companyName: "MSQD SYSTEMS", documentTitle: title, documentId: "", date: createdAt.slice(0, 10), version: "1.0" },
        footer: { showPageNumber: true, showGeneratedDate: true, showDocumentId: true, confidentialityText: "INTERNAL USE ONLY" },
        currentVersion: "1.0",
        createdBy: author,
        createdAt,
        updatedAt: createdAt,
      });
      documentVersions.push({ id: uid("ver"), documentId: docId, versionLabel: "1.0", contentHtml: documents[i].contentHtml, createdAt, createdBy: author, note: "Initial version" });
    }

    // ---- audit logs ------------------------------------------------------
    const actions = ["LOGIN", "CREATE_TRANSFER", "PAUSE_TRANSFER", "RESUME_TRANSFER", "CANCEL_TRANSFER", "RETRY_TRANSFER", "DELETE_FILE", "UPLOAD_FILE", "CREATE_DOCUMENT", "EXPORT_PDF", "CREATE_USER", "CHANGE_ROLE", "DISABLE_USER", "ADD_SERVER", "TEST_CONNECTION"];
    const auditLogs = [];
    for (let i = 0; i < 20; i++) {
      const user = pick(users);
      const action = pick(actions);
      const status = Math.random() > 0.15 ? "SUCCESS" : "FAILED";
      auditLogs.push({
        id: uid("aud"), timestamp: daysAgoIso(randInt(0, 40), randInt(0, 23)),
        userId: user.id, username: user.username, action,
        target: pick(sampleFiles.concat(["SERVER-01", "SERVER-02", "operator2", "DOC-000004"])),
        status, details: status === "FAILED" ? "Operation did not complete — see transfer log." : null,
      });
    }
    auditLogs.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

    // ---- notifications -----------------------------------------------------
    const notifications = [
      { id: uid("ntf"), level: "ERROR", message: "Connection to SERVER-EDGE-03 failed.", createdAt: daysAgoIso(0, 2), read: false },
      { id: uid("ntf"), level: "WARNING", message: "Transfer speed dropped below threshold on TR current batch.", createdAt: daysAgoIso(0, 4), read: false },
      { id: uid("ntf"), level: "INFO", message: "Nightly backup completed successfully.", createdAt: daysAgoIso(0, 7), read: false },
      { id: uid("ntf"), level: "WARNING", message: "Disk usage on SRV-BACKUP-02 exceeds 80%.", createdAt: daysAgoIso(1, 5), read: true },
      { id: uid("ntf"), level: "INFO", message: "3 documents exported to PDF this week.", createdAt: daysAgoIso(2, 9), read: true },
    ];

    const settings = {
      orgName: "MSQD SYSTEMS",
      hostname: "transfer-node",
      timezone: "Asia/Tehran",
      logoUrl: null,
      confidentialityDefault: "INTERNAL USE ONLY",
    };

    return { users, servers, connections: [], files, transfers, transferLogs, documents, documentVersions, auditLogs, notifications, settings, session: { username: "admin", role: "ADMIN", currentServerId: null, currentServerName: null } };
  }

  const DEFAULT_TEMPLATES = {
    DATA_TRANSFER_REPORT: () => `<h2>DATA TRANSFER REPORT</h2><p>This report documents a completed data transfer operation between source and destination systems.</p><table><tr><th>FIELD</th><th>VALUE</th></tr><tr><td>Source</td><td>SERVER-01</td></tr><tr><td>Destination</td><td>SERVER-02</td></tr><tr><td>File</td><td>backup.tar.gz</td></tr><tr><td>Size</td><td>18.2 GB</td></tr><tr><td>Status</td><td>COMPLETED</td></tr></table><p>NOTES</p><p>No anomalies detected during transfer.</p>`,
    SERVER_INFORMATION: () => `<h2>SERVER INFORMATION</h2><table><tr><th>FIELD</th><th>VALUE</th></tr><tr><td>Host</td><td>10.20.0.11</td></tr><tr><td>Protocol</td><td>SSH</td></tr><tr><td>OS</td><td>Ubuntu 22.04 LTS</td></tr><tr><td>Kernel</td><td>5.15.0-119-generic</td></tr></table>`,
    FILE_INFORMATION: () => `<h2>FILE INFORMATION</h2><table><tr><th>FIELD</th><th>VALUE</th></tr><tr><td>Name</td><td>payload-0091.zip</td></tr><tr><td>Size</td><td>184.2 MB</td></tr><tr><td>Owner</td><td>svc-transfer</td></tr><tr><td>Permissions</td><td>rw-r--r--</td></tr></table>`,
    INCIDENT_REPORT: () => `<h2>INCIDENT REPORT</h2><p><strong>Summary:</strong> Describe the incident.</p><table><tr><th>FIELD</th><th>VALUE</th></tr><tr><td>Severity</td><td>MEDIUM</td></tr><tr><td>Detected</td><td></td></tr><tr><td>Resolved</td><td></td></tr></table><p>ROOT CAUSE</p><p></p><p>REMEDIATION</p><p></p>`,
    SYSTEM_STATUS_REPORT: () => `<h2>SYSTEM STATUS REPORT</h2><table><tr><th>METRIC</th><th>VALUE</th></tr><tr><td>CPU</td><td>24%</td></tr><tr><td>Memory</td><td>41%</td></tr><tr><td>Disk</td><td>68%</td></tr><tr><td>Network</td><td>ONLINE</td></tr></table>`,
    TRANSFER_SUMMARY: () => `<h2>TRANSFER SUMMARY</h2><p>Period: <em>fill in</em></p><table><tr><th>STATUS</th><th>COUNT</th></tr><tr><td>Completed</td><td></td></tr><tr><td>Failed</td><td></td></tr><tr><td>Cancelled</td><td></td></tr></table>`,
    INFORMATION_SHEET: () => `<h2>INFORMATION SHEET</h2><table><tr><th>FIELD</th><th>VALUE</th></tr><tr><td></td><td></td></tr></table><p>DESCRIPTION</p><p></p><p>NOTES</p><p></p>`,
  };

  // --------------------------------------------------------------------
  // Public DB object
  // --------------------------------------------------------------------
  const DB = {
    state: null,

    load() {
      loadSeq();
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          this.state = JSON.parse(raw);
          return;
        }
      } catch (e) { /* fallthrough to reseed */ }
      this.state = buildSeed();
      this.save();
    },

    save() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    },

    reset() {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SEQ_KEY);
      seq = { transfer: 0, document: 0 };
      this.state = buildSeed();
      this.save();
    },

    uid,
    nextTransferCode,
    nextDocumentCode,
    isoNow,
    daysAgoIso,
    pick,
    randInt,
    templates: DEFAULT_TEMPLATES,
  };

  // --------------------------------------------------------------------
  // Server connection abstraction (section 11 / 29).
  // Today every kind resolves to the mock implementation. Real transports
  // are stubbed so the UI can declare "future" capability honestly instead
  // of faking a working connection.
  // --------------------------------------------------------------------
  class ServerConnection {
    constructor(server) { this.server = server; }
    async testConnection() { throw new Error("Not implemented"); }
    async listFiles(path) { throw new Error("Not implemented"); }
    async connect() { throw new Error("Not implemented"); }
    async disconnect() { throw new Error("Not implemented"); }
    get implemented() { return false; }
  }

  class MockConnection extends ServerConnection {
    get implemented() { return true; }
    async testConnection() {
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 500));
      const ok = Math.random() > 0.15;
      return { ok, latencyMs: randInt(20, 180), message: ok ? "Handshake OK" : "Connection refused" };
    }
    async connect() { await new Promise((r) => setTimeout(r, 400)); return { ok: true }; }
    async disconnect() { return { ok: true }; }
    async listFiles() { return []; }
  }

  class SSHConnection extends ServerConnection {}
  class SFTPConnection extends ServerConnection {}
  class FTPConnection extends ServerConnection {}
  class APIConnection extends ServerConnection {}

  function connectionFor(server) {
    // Future: branch on server.protocol to real SSHConnection/SFTPConnection/etc.
    // once those transports are implemented server-side.
    return new MockConnection(server);
  }

  global.DB = DB;
  global.CONN = { ServerConnection, MockConnection, SSHConnection, SFTPConnection, FTPConnection, APIConnection, connectionFor };
})(window);
