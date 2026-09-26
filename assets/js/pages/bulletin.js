/* ============================================================================
   PAGE: /bulletin — read-only information board.
   Content comes ONLY from assets/js/bulletin-data.js (window.BULLETIN_DATA),
   a static file the operator edits by hand and redeploys. There is no
   create/edit/delete affordance anywhere on this page — by design, per the
   spec: viewable in the web app, only updatable by pushing new code.
   ============================================================================ */

(function (global) {
  "use strict";

  const TAG_VARIANT = {
    ALERT: "red",
    MAINTENANCE: "yellow",
    NOTICE: "yellow",
    UPDATE: "white",
    REPORT: "gray",
  };

  function tagBadge(tag) {
    const variant = TAG_VARIANT[tag] || "gray";
    return `<span class="badge badge-${variant}">${U.escapeHtml(tag)}</span>`;
  }

  function items() {
    const list = (global.BULLETIN_DATA || []).slice();
    list.sort((a, b) => {
      const ak = a.date + "T" + a.time, bk = b.date + "T" + b.time;
      return ak < bk ? 1 : ak > bk ? -1 : 0;
    });
    return list;
  }

  function findItem(id) {
    return (global.BULLETIN_DATA || []).find((x) => x.id === id);
  }

  // ------------------------------------------------------------------
  // List view
  // ------------------------------------------------------------------
  function render(container) {
    const list = items();

    container.innerHTML = `
      <div class="page-head">
        <div><span class="page-title">BULLETIN BOARD</span><span class="page-path">/bulletin</span></div>
        <div class="page-actions"><span class="badge badge-gray">READ-ONLY</span></div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <span>PUBLISHED ITEMS</span>
          <span style="color:var(--text-dimmer);font-size:10px;">updated by the platform team — not editable here</span>
        </div>
        <div class="table-wrap">
          ${list.length === 0 ? UI.emptyState("ls /bulletin", "No published items yet.") : `
          <table class="data-table" id="bulletin-table">
            <thead><tr><th>DATE</th><th>TIME</th><th>TAG</th><th>TITLE</th><th>AUTHOR</th></tr></thead>
            <tbody>
              ${list.map((it) => `
                <tr data-id="${U.escapeHtml(it.id)}">
                  <td>${U.escapeHtml(it.date)}</td>
                  <td>${U.escapeHtml(it.time)}</td>
                  <td>${tagBadge(it.tag)}</td>
                  <td>${U.escapeHtml(it.title)}</td>
                  <td>${U.escapeHtml(it.author || "—")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>`}
        </div>
      </div>
    `;

    const table = U.qs("#bulletin-table");
    if (table) {
      table.addEventListener("click", (e) => {
        const row = e.target.closest("tr[data-id]");
        if (row) ROUTER.navigate(`bulletin/${row.dataset.id}`);
      });
    }
  }

  // ------------------------------------------------------------------
  // Detail view — pure display, no contenteditable, no toolbar
  // ------------------------------------------------------------------
  function render_detail(container, id) {
    const item = findItem(id);
    if (!item) {
      container.innerHTML = UI.errorBox("4043", "ITEM NOT FOUND", `No bulletin item matches "${id}".`,
        `<a class="btn" href="#/bulletin">BACK TO BULLETIN BOARD</a>`);
      return;
    }

    container.innerHTML = `
      <div class="page-head">
        <div><a href="#/bulletin" class="btn btn-ghost btn-xs">← BACK</a> <span class="page-title">${U.escapeHtml(item.title)}</span></div>
        <div class="page-actions">
          <button class="btn" id="bl-export-txt">EXPORT TXT</button>
          <button class="btn" id="bl-export-pdf">EXPORT PDF</button>
        </div>
      </div>

      <div class="panel" style="max-width:900px;">
        <div class="panel-body">
          <table class="kv-table" style="margin-bottom:14px;">
            <tr><td>DATE</td><td>${U.escapeHtml(item.date)}</td></tr>
            <tr><td>TIME</td><td>${U.escapeHtml(item.time)}</td></tr>
            <tr><td>TAG</td><td>${tagBadge(item.tag)}</td></tr>
            <tr><td>AUTHOR</td><td>${U.escapeHtml(item.author || "—")}</td></tr>
          </table>
          <div class="doc-sheet" style="min-height:auto;" tabindex="-1">
            <div class="doc-header">
              <div class="doc-h-title">${U.escapeHtml(item.title)}</div>
              <div class="doc-h-meta">
                DATE: ${U.escapeHtml(item.date)}<br/>
                TIME: ${U.escapeHtml(item.time)}<br/>
                TAG: ${U.escapeHtml(item.tag)}
              </div>
            </div>
            <div>${item.body}</div>
            <div class="doc-footer">
              <span>BULLETIN ID: ${U.escapeHtml(item.id)}</span>
              <span>READ-ONLY</span>
              <span>Author: ${U.escapeHtml(item.author || "—")}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    function asPseudoDoc() {
      return {
        docId: item.id,
        title: item.title,
        createdBy: item.author || "—",
        currentVersion: "",
        header: {
          logoUrl: (global.DB && DB.state.settings.logoUrl) || null,
          companyName: (global.DB && DB.state.settings.orgName) || "",
          documentTitle: item.title,
          date: item.date,
          version: "",
        },
        footer: {
          showDocumentId: true,
          showGeneratedDate: true,
          confidentialityText: item.tag,
        },
        contentHtml: item.body,
      };
    }

    U.qs("#bl-export-txt").addEventListener("click", () => EXPORT.exportDocumentTxt(asPseudoDoc()));
    U.qs("#bl-export-pdf").addEventListener("click", () => EXPORT.exportDocumentPdf(asPseudoDoc()));
  }

  global.PAGES = global.PAGES || {};
  global.PAGES.bulletin = { render, renderDetail: render_detail };
})(window);
