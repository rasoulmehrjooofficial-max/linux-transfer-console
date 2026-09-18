/* ============================================================================
   PAGE: /documents — list, template picker, and the rich-text editor
   (Information Sheet / Word-like editor, header/footer, logo, tables,
   versioning, PDF/TXT export).
   ============================================================================ */

(function (global) {
  "use strict";

  const state = { search: "", container: null, docId: null, dirty: false };

  const TEMPLATE_LABELS = {
    BLANK: "Blank Document",
    DATA_TRANSFER_REPORT: "Data Transfer Report",
    SERVER_INFORMATION: "Server Information",
    FILE_INFORMATION: "File Information",
    INCIDENT_REPORT: "Incident Report",
    SYSTEM_STATUS_REPORT: "System Status Report",
    TRANSFER_SUMMARY: "Transfer Summary",
    INFORMATION_SHEET: "Information Sheet",
  };

  function findDoc(id) {
    return DB.state.documents.find((d) => d.id === id || d.docId === id);
  }

  // ------------------------------------------------------------------
  // List view
  // ------------------------------------------------------------------
  function render(container) {
    state.container = container;
    state.docId = null;
    const items = DB.state.documents
      .filter((d) => !state.search || d.title.toLowerCase().includes(state.search.toLowerCase()) || d.docId.toLowerCase().includes(state.search.toLowerCase()))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

    container.innerHTML = `
      <div class="page-head">
        <div><span class="page-title">DOCUMENT MANAGEMENT</span><span class="page-path">/documents</span></div>
        <div class="page-actions">
          <button class="btn btn-primary" id="doc-new"><kbd style="margin-right:6px">^N</kbd>NEW DOCUMENT</button>
        </div>
      </div>

      <div class="filter-bar">
        <input type="text" id="doc-search" placeholder="search title or document id..." value="${U.escapeHtml(state.search)}" style="min-width:260px" />
      </div>

      <div class="panel">
        <div class="table-wrap">
          ${items.length === 0 ? UI.emptyState("ls /documents", "Directory is empty.") : `
          <table class="data-table" id="doc-table">
            <thead><tr><th>DOC ID</th><th>TITLE</th><th>TEMPLATE</th><th>VERSION</th><th>AUTHOR</th><th>UPDATED</th></tr></thead>
            <tbody>
              ${items.map((d) => `
                <tr data-id="${d.id}">
                  <td class="mono">${d.docId}</td>
                  <td>${U.escapeHtml(d.title)}</td>
                  <td>${TEMPLATE_LABELS[d.template] || d.template}</td>
                  <td>v${d.currentVersion}</td>
                  <td>${U.escapeHtml(d.createdBy)}</td>
                  <td>${U.formatDateTime(d.updatedAt)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>`}
        </div>
      </div>
    `;

    U.qs("#doc-new").addEventListener("click", openTemplatePicker);
    U.qs("#doc-search").addEventListener("input", U.debounce((e) => { state.search = e.target.value; render(container); }, 200));
    const table = U.qs("#doc-table");
    if (table) table.addEventListener("click", (e) => {
      const row = e.target.closest("tr[data-id]");
      if (row) ROUTER.navigate(`documents/${row.dataset.id}`);
    });
  }

  function openTemplatePicker() {
    UI.openModal({
      title: "NEW DOCUMENT — CHOOSE TEMPLATE",
      wide: true,
      body: `<div class="grid grid-3">
        ${Object.entries(TEMPLATE_LABELS).map(([key, label]) => `
          <div class="template-card" data-key="${key}">
            <div class="t-name">${label}</div>
            <div class="t-desc">${key === "BLANK" ? "Start from an empty page." : "Prefilled information-sheet layout."}</div>
          </div>
        `).join("")}
      </div>`,
      onMount: (box) => {
        U.qsa(".template-card", box).forEach((card) => {
          card.addEventListener("click", () => {
            const key = card.dataset.key;
            UI.closeModal();
            createDocument(key);
          });
        });
      },
    });
  }

  function createDocument(templateKey) {
    const session = DB.state.session;
    const id = DB.uid("doc");
    const createdAt = DB.isoNow();
    const title = `${TEMPLATE_LABELS[templateKey]} ${U.formatDate(createdAt)}`;
    const doc = {
      id, docId: DB.nextDocumentCode(), title, template: templateKey,
      contentHtml: templateKey === "BLANK" ? "<p>Start typing…</p>" : (DB.templates[templateKey] ? DB.templates[templateKey]() : "<p>Start typing…</p>"),
      header: { logoUrl: DB.state.settings.logoUrl, companyName: DB.state.settings.orgName, documentTitle: title, documentId: "", date: createdAt.slice(0, 10), version: "1.0" },
      footer: { showPageNumber: true, showGeneratedDate: true, showDocumentId: true, confidentialityText: DB.state.settings.confidentialityDefault },
      currentVersion: "1.0", createdBy: session.username, createdAt, updatedAt: createdAt,
    };
    DB.state.documents.unshift(doc);
    DB.state.documentVersions.push({ id: DB.uid("ver"), documentId: id, versionLabel: "1.0", contentHtml: doc.contentHtml, createdAt, createdBy: session.username, note: "Initial version" });
    DB.save();
    UI.recordAudit("CREATE_DOCUMENT", doc.docId, "SUCCESS");
    UI.pushNotification("INFO", `Document ${doc.docId} created.`);
    ROUTER.navigate(`documents/${id}`);
  }

  // ------------------------------------------------------------------
  // Editor view
  // ------------------------------------------------------------------
  function renderDetail(container, id) {
    const doc = findDoc(id);
    if (!doc) {
      container.innerHTML = UI.errorBox("4042", "DOCUMENT NOT FOUND", `No document matches "${id}".`, `<a class="btn" href="#/documents">BACK TO DOCUMENTS</a>`);
      return;
    }
    state.container = container;
    state.docId = doc.id;
    state.dirty = false;

    container.innerHTML = `
      <div class="page-head">
        <div><a href="#/documents" class="btn btn-ghost btn-xs">← BACK</a> <span class="page-title">${U.escapeHtml(doc.docId)}</span> <span class="page-path" id="doc-dirty-flag"></span></div>
        <div class="page-actions">
          <button class="btn" id="doc-rename">RENAME</button>
          <button class="btn" id="doc-duplicate">DUPLICATE</button>
          <button class="btn" id="doc-export-txt">EXPORT TXT</button>
          <button class="btn" id="doc-export-pdf">EXPORT PDF</button>
          <button class="btn btn-primary" id="doc-save"><kbd style="margin-right:6px">^S</kbd>SAVE</button>
          <button class="btn btn-danger" id="doc-delete">DELETE</button>
        </div>
      </div>

      <div class="editor-shell">
        <div class="editor-main">
          <div class="editor-toolbar" id="editor-toolbar">
            ${toolbarButtonsHtml()}
          </div>
          <div class="doc-sheet" id="doc-sheet" contenteditable="true" spellcheck="false">
            ${renderSheetHtml(doc)}
          </div>
        </div>
        <div class="editor-side">
          <div class="panel">
            <div class="panel-head">HEADER / LOGO</div>
            <div class="panel-body">
              <div class="field"><label>COMPANY NAME</label><input type="text" id="hd-company" value="${U.escapeHtml(doc.header.companyName)}" /></div>
              <div class="field"><label>DOCUMENT TITLE</label><input type="text" id="hd-title" value="${U.escapeHtml(doc.header.documentTitle)}" /></div>
              <div class="field"><label>VERSION LABEL</label><input type="text" id="hd-version" value="${U.escapeHtml(doc.header.version)}" /></div>
              <div class="field">
                <label>LOGO</label>
                <input type="file" id="hd-logo" accept="image/png,image/jpeg,image/svg+xml,image/webp" />
                ${doc.header.logoUrl ? `<div class="field-hint">Logo set. <a href="#" id="hd-logo-remove">Remove</a></div>` : `<div class="field-hint">PNG / JPG / SVG / WEBP</div>`}
              </div>
            </div>
          </div>
          <div class="panel">
            <div class="panel-head">FOOTER</div>
            <div class="panel-body">
              <div class="checkbox-row"><input type="checkbox" id="ft-page" ${doc.footer.showPageNumber ? "checked" : ""}/><label for="ft-page">Show page number</label></div>
              <div class="checkbox-row"><input type="checkbox" id="ft-date" ${doc.footer.showGeneratedDate ? "checked" : ""}/><label for="ft-date">Show generated date</label></div>
              <div class="checkbox-row"><input type="checkbox" id="ft-docid" ${doc.footer.showDocumentId ? "checked" : ""}/><label for="ft-docid">Show document ID</label></div>
              <div class="field"><label>CONFIDENTIALITY TEXT</label><input type="text" id="ft-conf" value="${U.escapeHtml(doc.footer.confidentialityText)}" /></div>
            </div>
          </div>
          <div class="panel">
            <div class="panel-head">VERSION HISTORY</div>
            <div id="doc-versions">${versionsHtml(doc)}</div>
          </div>
        </div>
      </div>
    `;

    wireToolbar();
    wireSidePanel(doc);
    wireHeaderFooterLiveSync(doc);

    U.qs("#doc-rename").addEventListener("click", () => renameDocument(doc));
    U.qs("#doc-duplicate").addEventListener("click", () => duplicateDocument(doc));
    U.qs("#doc-delete").addEventListener("click", () => {
      UI.confirmModal(`Delete document ${doc.docId}? This cannot be undone.`, { danger: true }, () => deleteDocument(doc));
    });
    U.qs("#doc-save").addEventListener("click", () => saveDocument(doc));
    U.qs("#doc-export-txt").addEventListener("click", () => { syncBeforeExport(doc); EXPORT.exportDocumentTxt(doc); });
    U.qs("#doc-export-pdf").addEventListener("click", () => { syncBeforeExport(doc); EXPORT.exportDocumentPdf(doc); });

    U.qs("#doc-sheet").addEventListener("input", () => markDirty());

    U.qs("#doc-versions").addEventListener("click", (e) => {
      const item = e.target.closest(".version-item");
      if (!item) return;
      const version = DB.state.documentVersions.find((v) => v.id === item.dataset.vid);
      if (!version) return;
      UI.openModal({
        title: `VERSION v${version.versionLabel} — ${doc.docId}`,
        wide: true,
        body: `<div class="doc-sheet" style="min-height:auto;padding:24px;">${version.contentHtml}</div>`,
        foot: `<button class="btn btn-ghost" id="ver-close">CLOSE</button><button class="btn btn-primary" id="ver-restore">RESTORE THIS VERSION</button>`,
        onMount: (box) => {
          U.qs("#ver-close", box).addEventListener("click", UI.closeModal);
          U.qs("#ver-restore", box).addEventListener("click", () => {
            doc.contentHtml = version.contentHtml;
            doc.updatedAt = DB.isoNow();
            doc.currentVersion = bumpVersion(doc.currentVersion);
            DB.state.documentVersions.unshift({ id: DB.uid("ver"), documentId: doc.id, versionLabel: doc.currentVersion, contentHtml: doc.contentHtml, createdAt: doc.updatedAt, createdBy: DB.state.session.username, note: `Restored from v${version.versionLabel}` });
            DB.save();
            UI.recordAudit("RESTORE_DOCUMENT_VERSION", doc.docId, "SUCCESS");
            UI.closeModal();
            UI.pushNotification("INFO", `Restored v${version.versionLabel}.`);
            renderDetail(state.container, doc.id);
          });
        },
      });
    });
  }

  function renderSheetHtml(doc) {
    return `
      <div class="doc-header" contenteditable="false">
        ${doc.header.logoUrl ? `<img src="${doc.header.logoUrl}" />` : `<div class="doc-h-title">${U.escapeHtml(doc.header.companyName)}</div>`}
        <div class="doc-h-meta">
          DOCUMENT ID: ${U.escapeHtml(doc.docId)}<br/>
          DATE: ${U.escapeHtml(doc.header.date)}<br/>
          VERSION: ${U.escapeHtml(doc.header.version)}
        </div>
      </div>
      <div id="doc-editable-body">${doc.contentHtml}</div>
      <div class="doc-footer" contenteditable="false">
        <span>${doc.footer.showDocumentId ? "DOC ID: " + U.escapeHtml(doc.docId) : ""}</span>
        <span>${U.escapeHtml(doc.footer.confidentialityText)}</span>
        <span>${doc.footer.showGeneratedDate ? "Generated: " + U.escapeHtml(U.formatDate(DB.isoNow())) : ""}</span>
      </div>
    `;
  }

  const FONT_OPTIONS = [
    ["'JetBrains Mono', monospace", "JetBrains Mono"],
    ["'IBM Plex Mono', monospace", "IBM Plex Mono"],
    ["'Fira Code', monospace", "Fira Code"],
    ["'Courier New', monospace", "Courier New"],
  ];
  const SIZE_OPTIONS = [["2", "SMALL"], ["3", "NORMAL"], ["4", "LARGE"], ["6", "X-LARGE"]];

  function toolbarButtonsHtml() {
    const btn = (cmd, label, title) => `<button data-cmd="${cmd}" title="${title}">${label}</button>`;
    return [
      `<select id="tb-font" title="Font family">${FONT_OPTIONS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>`,
      `<select id="tb-fontsize" title="Font size">${SIZE_OPTIONS.map(([v, l]) => `<option value="${v}" ${v === "3" ? "selected" : ""}>${l}</option>`).join("")}</select>`,
      `<span class="tsep"></span>`,
      btn("bold", "<b>B</b>", "Bold"), btn("italic", "<i>I</i>", "Italic"),
      btn("underline", "<u>U</u>", "Underline"), btn("strikeThrough", "<s>S</s>", "Strikethrough"),
      `<span class="tsep"></span>`,
      btn("formatBlock:h1", "H1", "Heading 1"), btn("formatBlock:h2", "H2", "Heading 2"), btn("formatBlock:p", "¶", "Paragraph"),
      `<span class="tsep"></span>`,
      btn("justifyLeft", "⯇", "Align left"), btn("justifyCenter", "≡", "Align center"), btn("justifyRight", "⯈", "Align right"),
      `<span class="tsep"></span>`,
      btn("insertUnorderedList", "•", "Bullet list"), btn("insertOrderedList", "1.", "Numbered list"),
      `<span class="tsep"></span>`,
      btn("insertTable", "▦", "Insert table"),
      btn("tableAddRow", "+R", "Add table row (cursor must be in a cell)"),
      btn("tableDelRow", "-R", "Delete table row"),
      btn("tableAddCol", "+C", "Add table column"),
      btn("tableDelCol", "-C", "Delete table column"),
      `<span class="tsep"></span>`,
      btn("createLink", "🔗", "Insert link"), btn("insertImage", "🖼", "Insert image"),
      btn("insertHorizontalRule", "―", "Horizontal line"), btn("formatBlock:pre", "&lt;/&gt;", "Code block"), btn("formatBlock:blockquote", "❝", "Quote"),
      `<span class="tsep"></span>`,
      btn("foreColor:#111111", "A", "Text: black"), btn("foreColor:#6b6b6b", "A", "Text: gray"),
      btn("foreColor:#8a6d00", "A", "Text: yellow"), btn("foreColor:#a3241c", "A", "Text: red"),
      `<span class="tsep"></span>`,
      btn("pageBreak", "⤓ PG", "Page break"),
    ].join("");
  }

  function currentCell() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    let node = sel.getRangeAt(0).startContainer;
    if (node.nodeType === 3) node = node.parentElement;
    return node ? node.closest("td, th") : null;
  }

  function wireToolbar() {
    const sheet = U.qs("#doc-sheet");
    U.qs("#editor-toolbar").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-cmd]");
      if (!btn) return;
      sheet.focus();
      const cmd = btn.dataset.cmd;
      if (cmd === "insertTable") {
        document.execCommand("insertHTML", false, `<table><tr><th>FIELD</th><th>VALUE</th></tr><tr><td>Row 1</td><td></td></tr><tr><td>Row 2</td><td></td></tr></table><p><br/></p>`);
      } else if (cmd === "createLink") {
        const url = prompt("Link URL:", "https://");
        if (url) document.execCommand("createLink", false, url);
      } else if (cmd === "insertImage") {
        const input = document.createElement("input");
        input.type = "file"; input.accept = "image/*";
        input.onchange = async () => {
          const file = input.files[0];
          if (!file) return;
          const dataUrl = await U.fileToDataUrl(file);
          document.execCommand("insertHTML", false, `<img src="${dataUrl}" style="max-width:100%" />`);
          markDirty();
        };
        input.click();
      } else if (cmd === "pageBreak") {
        document.execCommand("insertHTML", false, `<hr style="page-break-after:always;border-style:dashed;" />`);
      } else if (cmd === "tableAddRow") {
        const cell = currentCell();
        if (!cell) { UI.toast("WARNING", "TABLE", "Click inside a table cell first."); return; }
        const row = cell.closest("tr");
        const newRow = row.cloneNode(true);
        Array.from(newRow.children).forEach((c) => { c.innerHTML = ""; c.removeAttribute("style"); if (c.tagName === "TH") { const td = document.createElement("td"); td.innerHTML = c.innerHTML; newRow.replaceChild(td, c); } });
        row.after(newRow);
      } else if (cmd === "tableDelRow") {
        const cell = currentCell();
        if (!cell) { UI.toast("WARNING", "TABLE", "Click inside a table cell first."); return; }
        const row = cell.closest("tr");
        const table = cell.closest("table");
        if (table.rows.length > 1) row.remove();
      } else if (cmd === "tableAddCol") {
        const cell = currentCell();
        if (!cell) { UI.toast("WARNING", "TABLE", "Click inside a table cell first."); return; }
        const idx = Array.from(cell.parentElement.children).indexOf(cell);
        const table = cell.closest("table");
        Array.from(table.rows).forEach((r) => {
          const ref = r.children[idx];
          const clone = ref.cloneNode(false);
          clone.innerHTML = ref.tagName === "TH" ? "FIELD" : "";
          ref.after(clone);
        });
      } else if (cmd === "tableDelCol") {
        const cell = currentCell();
        if (!cell) { UI.toast("WARNING", "TABLE", "Click inside a table cell first."); return; }
        const idx = Array.from(cell.parentElement.children).indexOf(cell);
        const table = cell.closest("table");
        if (table.rows[0].children.length > 1) {
          Array.from(table.rows).forEach((r) => { if (r.children[idx]) r.children[idx].remove(); });
        }
      } else if (cmd.startsWith("formatBlock:")) {
        document.execCommand("formatBlock", false, cmd.split(":")[1]);
      } else if (cmd.startsWith("foreColor:")) {
        document.execCommand("foreColor", false, cmd.split(":")[1]);
      } else {
        document.execCommand(cmd, false, null);
      }
      markDirty();
    });

    U.qs("#tb-font").addEventListener("change", (e) => {
      sheet.focus();
      document.execCommand("fontName", false, e.target.value);
      markDirty();
    });
    U.qs("#tb-fontsize").addEventListener("change", (e) => {
      sheet.focus();
      document.execCommand("fontSize", false, e.target.value);
      markDirty();
    });
  }

  function wireSidePanel(doc) {
    U.qs("#hd-logo").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      doc.header.logoUrl = await U.fileToDataUrl(file);
      DB.state.settings.logoUrl = doc.header.logoUrl;
      markDirty();
      renderDetail(state.container, doc.id);
    });
    const rm = U.qs("#hd-logo-remove");
    if (rm) rm.addEventListener("click", (e) => { e.preventDefault(); doc.header.logoUrl = null; markDirty(); renderDetail(state.container, doc.id); });
  }

  function wireHeaderFooterLiveSync(doc) {
    ["hd-company", "hd-title", "hd-version", "ft-conf"].forEach((id) => {
      U.qs("#" + id).addEventListener("input", () => markDirty());
    });
    ["ft-page", "ft-date", "ft-docid"].forEach((id) => {
      U.qs("#" + id).addEventListener("change", () => markDirty());
    });
  }

  function markDirty() {
    state.dirty = true;
    const flag = U.qs("#doc-dirty-flag");
    if (flag) flag.textContent = "● UNSAVED CHANGES";
  }

  function readDocFromForm(doc) {
    doc.header.companyName = U.qs("#hd-company").value;
    doc.header.documentTitle = U.qs("#hd-title").value;
    doc.header.version = U.qs("#hd-version").value;
    doc.footer.showPageNumber = U.qs("#ft-page").checked;
    doc.footer.showGeneratedDate = U.qs("#ft-date").checked;
    doc.footer.showDocumentId = U.qs("#ft-docid").checked;
    doc.footer.confidentialityText = U.qs("#ft-conf").value;
    const body = U.qs("#doc-editable-body");
    doc.contentHtml = body ? body.innerHTML : doc.contentHtml;
    doc.title = doc.header.documentTitle || doc.title;
    return doc;
  }

  function bumpVersion(v) {
    const parts = String(v).split(".").map(Number);
    parts[1] = (parts[1] || 0) + 1;
    return parts.join(".");
  }

  function syncBeforeExport(doc) {
    if (state.dirty) {
      saveDocument(doc, true);
      const hdVersion = U.qs("#hd-version");
      if (hdVersion) hdVersion.value = doc.header.version;
      const metaEl = document.querySelector(".doc-header .doc-h-meta");
      if (metaEl) metaEl.innerHTML = `DOCUMENT ID: ${U.escapeHtml(doc.docId)}<br/>DATE: ${U.escapeHtml(doc.header.date)}<br/>VERSION: ${U.escapeHtml(doc.header.version)}`;
      const flag = U.qs("#doc-dirty-flag");
      if (flag) flag.textContent = "";
      const versionsBox = U.qs("#doc-versions");
      if (versionsBox) versionsBox.innerHTML = versionsHtml(doc);
    } else {
      readDocFromForm(doc);
    }
  }

  function saveDocument(doc, silent) {
    readDocFromForm(doc);
    doc.updatedAt = DB.isoNow();
    doc.currentVersion = bumpVersion(doc.currentVersion);
    doc.header.version = doc.currentVersion;
    DB.state.documentVersions.unshift({ id: DB.uid("ver"), documentId: doc.id, versionLabel: doc.currentVersion, contentHtml: doc.contentHtml, createdAt: doc.updatedAt, createdBy: DB.state.session.username, note: "Saved edit" });
    DB.save();
    UI.recordAudit("SAVE_DOCUMENT", doc.docId, "SUCCESS");
    state.dirty = false;
    if (!silent) {
      UI.pushNotification("INFO", `Document ${doc.docId} saved as v${doc.currentVersion}.`);
      renderDetail(state.container, doc.id);
    }
  }

  function renameDocument(doc) {
    UI.openModal({
      title: "RENAME DOCUMENT",
      body: `<div class="field"><label>TITLE</label><input type="text" id="rn-title" value="${U.escapeHtml(doc.title)}" /></div>`,
      foot: `<button class="btn btn-ghost" id="rn-cancel">CANCEL</button><button class="btn btn-primary" id="rn-ok">RENAME</button>`,
      onMount: (box) => {
        U.qs("#rn-cancel", box).addEventListener("click", UI.closeModal);
        U.qs("#rn-ok", box).addEventListener("click", () => {
          doc.title = U.qs("#rn-title", box).value.trim() || doc.title;
          doc.header.documentTitle = doc.title;
          doc.updatedAt = DB.isoNow();
          DB.save(); UI.recordAudit("RENAME_DOCUMENT", doc.docId, "SUCCESS");
          UI.closeModal(); renderDetail(state.container, doc.id);
        });
      },
    });
  }

  function duplicateDocument(doc) {
    const copy = JSON.parse(JSON.stringify(doc));
    copy.id = DB.uid("doc");
    copy.docId = DB.nextDocumentCode();
    copy.title = doc.title + " (copy)";
    copy.currentVersion = "1.0";
    copy.createdAt = DB.isoNow();
    copy.updatedAt = copy.createdAt;
    DB.state.documents.unshift(copy);
    DB.state.documentVersions.push({ id: DB.uid("ver"), documentId: copy.id, versionLabel: "1.0", contentHtml: copy.contentHtml, createdAt: copy.createdAt, createdBy: DB.state.session.username, note: "Duplicated from " + doc.docId });
    DB.save();
    UI.recordAudit("DUPLICATE_DOCUMENT", copy.docId, "SUCCESS");
    UI.pushNotification("INFO", `Duplicated as ${copy.docId}.`);
    ROUTER.navigate(`documents/${copy.id}`);
  }

  function deleteDocument(doc) {
    DB.state.documents = DB.state.documents.filter((d) => d.id !== doc.id);
    DB.save();
    UI.recordAudit("DELETE_DOCUMENT", doc.docId, "SUCCESS");
    UI.closeModal();
    UI.pushNotification("WARNING", `Document ${doc.docId} deleted.`);
    ROUTER.navigate("documents");
  }

  function versionsHtml(doc) {
    const versions = DB.state.documentVersions.filter((v) => v.documentId === doc.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    if (versions.length === 0) return UI.emptyState("git log --oneline", "No versions yet.");
    return versions.map((v) => `
      <div class="version-item" data-vid="${v.id}">
        <span>v${v.versionLabel} — ${U.escapeHtml(v.note)}</span>
        <span>${U.formatDateTime(v.createdAt)}</span>
      </div>
    `).join("");
  }

  global.PAGES = global.PAGES || {};
  global.PAGES.documents = { render, renderDetail, saveHotkey: () => { const d = findDoc(state.docId); if (d) saveDocument(d); } };
})(window);
