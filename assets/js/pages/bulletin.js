/* ============================================================================
   PAGE: /bulletin — read-only information library, browsable folder by folder.
   Content comes ONLY from assets/js/bulletin-data.js (window.BULLETIN_DATA),
   a static file the operator edits by hand and redeploys. There is no
   create/edit/delete affordance anywhere on this page — by design: viewable
   in the web app, only updatable by pushing new code.
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

  function isFolder(node) {
    return node && Array.isArray(node.children);
  }

  function root() {
    return { id: "", title: "BULLETIN BOARD", children: global.BULLETIN_DATA || [] };
  }

  // Walk the tree by id at each level. Returns { node, trail } where trail
  // is the list of {id, title} ancestors (including the resolved node),
  // or null if any segment doesn't match.
  function resolve(segments) {
    let node = root();
    const trail = [{ id: "", title: "BULLETIN" }];
    for (const seg of segments) {
      if (!isFolder(node)) return null;
      const next = node.children.find((c) => c.id === seg);
      if (!next) return null;
      node = next;
      trail.push({ id: next.id, title: next.title });
    }
    return { node, trail };
  }

  function sortedChildren(node) {
    const items = [];
    const folders = [];
    for (const c of node.children) (isFolder(c) ? folders : items).push(c);
    items.sort((a, b) => {
      const ak = (a.date || "") + "T" + (a.time || ""), bk = (b.date || "") + "T" + (b.time || "");
      return ak < bk ? 1 : ak > bk ? -1 : 0;
    });
    folders.sort((a, b) => a.title.localeCompare(b.title));
    return [...folders, ...items];
  }

  function pathFor(segments) {
    return segments.length ? `bulletin/${segments.map(encodeURIComponent).join("/")}` : "bulletin";
  }

  // ------------------------------------------------------------------
  function render(container, params) {
    const segments = params && params.sub ? params.sub.split("/").filter(Boolean) : [];
    const resolved = resolve(segments);

    if (!resolved) {
      container.innerHTML = UI.errorBox("4043", "NOT FOUND", `No bulletin folder or item matches "${segments.join("/")}".`,
        `<a class="btn" href="#/bulletin">BACK TO BULLETIN BOARD</a>`);
      return;
    }

    const { node, trail } = resolved;

    if (isFolder(node)) {
      renderFolder(container, node, segments, trail);
    } else {
      renderItem(container, node, segments, trail);
    }
  }

  function breadcrumbHtml(trail, segments) {
    return `<div class="breadcrumb">${trail.map((t, i) => {
      const segPath = segments.slice(0, i);
      const href = pathFor(segPath);
      const isLast = i === trail.length - 1;
      return `${isLast ? `<span>${U.escapeHtml(t.title)}</span>` : `<a href="#/${href}">${U.escapeHtml(t.title)}</a><span class="sep"> / </span>`}`;
    }).join("")}</div>`;
  }

  function renderFolder(container, node, segments, trail) {
    const children = sortedChildren(node);

    container.innerHTML = `
      <div class="page-head">
        <div><span class="page-title">BULLETIN BOARD</span><span class="page-path">/bulletin</span></div>
        <div class="page-actions"><span class="badge badge-gray">READ-ONLY</span></div>
      </div>

      ${breadcrumbHtml(trail, segments)}

      ${node.description ? `<div class="field-hint" style="margin-bottom:10px;">${U.escapeHtml(node.description)}</div>` : ""}

      <div class="panel">
        <div class="panel-head">
          <span>${children.length} ITEM${children.length === 1 ? "" : "S"}</span>
          <span style="color:var(--text-dimmer);font-size:10px;">updated by the platform team — not editable here</span>
        </div>
        <div class="table-wrap">
          ${children.length === 0 ? UI.emptyState(`ls ${pathFor(segments)}`, "This folder is empty.") : `
          <table class="data-table" id="bulletin-table">
            <thead><tr><th>NAME</th><th>TYPE</th><th>DATE</th><th>DESCRIPTION</th></tr></thead>
            <tbody>
              ${children.map((c) => `
                <tr data-id="${U.escapeHtml(c.id)}">
                  <td>${isFolder(c) ? "▤" : "▥"} ${U.escapeHtml(c.title)}</td>
                  <td>${isFolder(c) ? '<span class="badge badge-gray">FOLDER</span>' : tagBadge(c.tag)}</td>
                  <td>${U.escapeHtml(c.date || "—")}</td>
                  <td class="col-wrap">${U.escapeHtml(c.description || "—")}</td>
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
        if (row) ROUTER.navigate(pathFor([...segments, row.dataset.id]));
      });
    }
  }

  function renderItem(container, item, segments, trail) {
    const parentSegments = segments.slice(0, -1);

    container.innerHTML = `
      <div class="page-head">
        <div><a href="#/${pathFor(parentSegments)}" class="btn btn-ghost btn-xs">← BACK</a> <span class="page-title">${U.escapeHtml(item.title)}</span></div>
        <div class="page-actions">
          <button class="btn" id="bl-export-txt">EXPORT TXT</button>
          <button class="btn" id="bl-export-pdf">EXPORT PDF</button>
        </div>
      </div>

      ${breadcrumbHtml(trail, segments)}

      <div class="panel" style="max-width:900px;">
        <div class="panel-body">
          <table class="kv-table" style="margin-bottom:14px;">
            <tr><td>DATE</td><td>${U.escapeHtml(item.date || "—")}</td></tr>
            <tr><td>TIME</td><td>${U.escapeHtml(item.time || "—")}</td></tr>
            <tr><td>TAG</td><td>${tagBadge(item.tag)}</td></tr>
            <tr><td>AUTHOR</td><td>${U.escapeHtml(item.author || "—")}</td></tr>
          </table>
          <div class="doc-sheet" style="min-height:auto;" tabindex="-1">
            <div class="doc-header">
              <div class="doc-h-title">${U.escapeHtml(item.title)}</div>
              <div class="doc-h-meta">
                DATE: ${U.escapeHtml(item.date || "—")}<br/>
                TIME: ${U.escapeHtml(item.time || "—")}<br/>
                TAG: ${U.escapeHtml(item.tag || "—")}
              </div>
            </div>
            <div>${item.body || ""}</div>
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
          date: item.date || "",
          version: "",
        },
        footer: {
          showDocumentId: true,
          showGeneratedDate: true,
          confidentialityText: item.tag || "",
        },
        contentHtml: item.body || "",
      };
    }

    U.qs("#bl-export-txt").addEventListener("click", () => EXPORT.exportDocumentTxt(asPseudoDoc()));
    U.qs("#bl-export-pdf").addEventListener("click", () => EXPORT.exportDocumentPdf(asPseudoDoc()));
  }

  // Recursively collect leaf items with their full path, for global search.
  function flatten() {
    const out = [];
    (function walk(node, segments) {
      for (const c of node.children || []) {
        if (isFolder(c)) walk(c, [...segments, c.id]);
        else out.push({ item: c, path: [...segments, c.id] });
      }
    })(root(), []);
    return out;
  }

  global.PAGES = global.PAGES || {};
  global.PAGES.bulletin = { render, flatten, pathFor };
})(window);
