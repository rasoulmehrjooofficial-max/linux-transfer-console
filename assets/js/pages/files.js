/* ============================================================================
   PAGE: /files — mock file manager over DB.state.files
   ============================================================================ */

(function (global) {
  "use strict";

  const state = { path: "/", search: "", sortKey: "name", sortDir: 1, container: null };

  function childrenOf(path) {
    return DB.state.files.filter((f) => f.parentPath === path);
  }

  function breadcrumbParts(path) {
    if (path === "/") return [{ label: "/", path: "/" }];
    const segs = path.split("/").filter(Boolean);
    const parts = [{ label: "/", path: "/" }];
    let acc = "";
    for (const s of segs) { acc += "/" + s; parts.push({ label: s, path: acc }); }
    return parts;
  }

  function sortItems(items) {
    const dirs = items.filter((f) => f.type === "DIRECTORY");
    const files = items.filter((f) => f.type === "FILE");
    const cmp = (a, b) => {
      let av = a[state.sortKey], bv = b[state.sortKey];
      if (typeof av === "string") { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      return av < bv ? -1 * state.sortDir : av > bv ? 1 * state.sortDir : 0;
    };
    return [...dirs.sort(cmp), ...files.sort(cmp)];
  }

  function render(container, params) {
    state.container = container;
    if (params && params.sub) state.path = "/" + params.sub;

    const isSearching = state.search.trim().length > 0;
    let items = isSearching ? DB.search_files_stub() : childrenOf(state.path);
    items = sortItems(items);

    container.innerHTML = `
      <div class="page-head">
        <div><span class="page-title">FILE MANAGER</span><span class="page-path">/files</span></div>
        <div class="page-actions">
          <button class="btn" id="fm-new-folder">+ FOLDER</button>
          <button class="btn btn-primary" id="fm-upload">↑ UPLOAD</button>
        </div>
      </div>

      <div class="filter-bar">
        <input type="text" id="fm-search" placeholder="search files by name..." value="${U.escapeHtml(state.search)}" style="min-width:260px" />
        <span class="spacer"></span>
        <span class="filter-label">SORT</span>
        <select id="fm-sort">
          <option value="name" ${state.sortKey === "name" ? "selected" : ""}>NAME</option>
          <option value="size" ${state.sortKey === "size" ? "selected" : ""}>SIZE</option>
          <option value="modifiedAt" ${state.sortKey === "modifiedAt" ? "selected" : ""}>MODIFIED</option>
          <option value="owner" ${state.sortKey === "owner" ? "selected" : ""}>OWNER</option>
        </select>
        <button class="icon-btn" id="fm-dir">${state.sortDir === 1 ? "↑ ASC" : "↓ DESC"}</button>
      </div>

      ${!isSearching ? `<div class="breadcrumb">${breadcrumbParts(state.path).map((p, i, arr) => `<a href="#/files${p.path === "/" ? "" : p.path}">${U.escapeHtml(p.label)}</a>${i < arr.length - 1 ? '<span class="sep"> / </span>' : ""}`).join("")}</div>` : `<div class="breadcrumb">SEARCH RESULTS FOR "${U.escapeHtml(state.search)}"</div>`}

      <div class="panel">
        <div class="table-wrap">
          ${items.length === 0 ? UI.emptyState(`ls ${state.path}`, "Directory is empty.") : `
          <table class="data-table" id="files-table">
            <thead><tr><th>NAME</th><th>TYPE</th><th>SIZE</th><th>OWNER</th><th>PERMISSIONS</th><th>MODIFIED</th><th>CREATED</th></tr></thead>
            <tbody>
              ${items.map((f) => `
                <tr data-id="${f.id}" data-type="${f.type}" data-path="${U.escapeHtml(f.path)}">
                  <td>${f.type === "DIRECTORY" ? "📁" : "📄"} ${U.escapeHtml(f.name)}</td>
                  <td>${f.type}</td>
                  <td>${f.type === "DIRECTORY" ? "—" : U.formatBytes(f.size)}</td>
                  <td>${U.escapeHtml(f.owner)}</td>
                  <td class="mono">${f.permissions}</td>
                  <td>${U.formatDateTime(f.modifiedAt)}</td>
                  <td>${U.formatDateTime(f.createdAt)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>`}
        </div>
      </div>
    `;

    U.qs("#fm-search").addEventListener("input", U.debounce((e) => { state.search = e.target.value; render(container); }, 200));
    U.qs("#fm-sort").addEventListener("change", (e) => { state.sortKey = e.target.value; render(container); });
    U.qs("#fm-dir").addEventListener("click", () => { state.sortDir *= -1; render(container); });
    U.qs("#fm-new-folder").addEventListener("click", openNewFolderModal);
    U.qs("#fm-upload").addEventListener("click", openUploadModal);

    const table = U.qs("#files-table");
    if (table) {
      table.addEventListener("click", (e) => {
        const row = e.target.closest("tr[data-id]");
        if (!row) return;
        if (row.dataset.type === "DIRECTORY" && !isSearching) {
          ROUTER.navigate(`files${row.dataset.path}`);
        } else {
          openFileDetail(row.dataset.id);
        }
      });
    }
  }

  DB.search_files_stub = function () {
    const q = state.search.toLowerCase();
    return DB.state.files.filter((f) => f.name.toLowerCase().includes(q));
  };

  function openFileDetail(id) {
    const f = DB.state.files.find((x) => x.id === id);
    if (!f) return;
    UI.openModal({
      title: f.type === "DIRECTORY" ? "DIRECTORY DETAILS" : "FILE DETAILS",
      body: `
        <table class="kv-table">
          <tr><td>NAME</td><td>${U.escapeHtml(f.name)}</td></tr>
          <tr><td>PATH</td><td class="mono">${U.escapeHtml(f.path)}</td></tr>
          <tr><td>TYPE</td><td>${f.type}</td></tr>
          <tr><td>SIZE</td><td>${f.type === "DIRECTORY" ? "—" : U.formatBytes(f.size)}</td></tr>
          <tr><td>OWNER</td><td>${U.escapeHtml(f.owner)}</td></tr>
          <tr><td>PERMISSIONS</td><td class="mono">${f.permissions}</td></tr>
          <tr><td>MODIFIED</td><td>${U.formatDateTime(f.modifiedAt)}</td></tr>
          <tr><td>CREATED</td><td>${U.formatDateTime(f.createdAt)}</td></tr>
        </table>
      `,
      foot: `
        <button class="btn btn-ghost btn-xs" id="ff-rename">RENAME</button>
        <button class="btn btn-ghost btn-xs" id="ff-move">MOVE</button>
        <button class="btn btn-ghost btn-xs" id="ff-copy">COPY</button>
        ${f.type === "FILE" ? `<button class="btn btn-ghost btn-xs" id="ff-download">DOWNLOAD</button><button class="btn btn-ghost btn-xs" id="ff-transfer">SEND VIA TRANSFER</button>` : ""}
        <button class="btn btn-danger btn-xs" id="ff-delete">DELETE</button>
      `,
      onMount: (box) => {
        U.qs("#ff-rename", box).addEventListener("click", () => renameFile(f));
        U.qs("#ff-move", box).addEventListener("click", () => moveFile(f));
        U.qs("#ff-copy", box).addEventListener("click", () => copyFile(f));
        U.qs("#ff-delete", box).addEventListener("click", () => {
          UI.confirmModal(`Delete "${f.name}"? This cannot be undone.`, { danger: true }, () => deleteFile(f));
        });
        const dl = U.qs("#ff-download", box);
        if (dl) dl.addEventListener("click", () => {
          U.downloadBlob(f.name, `Mock content for ${f.name}\nGenerated by TRANSFER-CONSOLE file manager (demo).`, "text/plain");
          UI.recordAudit("DOWNLOAD_FILE", f.path, "SUCCESS");
          UI.pushNotification("INFO", `Downloaded ${f.name}.`);
        });
        const sendTr = U.qs("#ff-transfer", box);
        if (sendTr) sendTr.addEventListener("click", () => {
          UI.closeModal();
          ROUTER.navigate("transfers");
          UI.pushNotification("INFO", `Use "CREATE TRANSFER" with source ${f.path} to send this file.`);
        });
      },
    });
  }

  function renameFile(f) {
    UI.openModal({
      title: "RENAME",
      body: `<div class="field"><label>NEW NAME</label><input type="text" id="rn-name" value="${U.escapeHtml(f.name)}" /></div>`,
      foot: `<button class="btn btn-ghost" id="rn-cancel">CANCEL</button><button class="btn btn-primary" id="rn-ok">RENAME</button>`,
      onMount: (box) => {
        U.qs("#rn-cancel", box).addEventListener("click", UI.closeModal);
        U.qs("#rn-ok", box).addEventListener("click", () => {
          const newName = U.qs("#rn-name", box).value.trim();
          if (!newName) return;
          const newPath = f.parentPath === "/" ? "/" + newName : f.parentPath + "/" + newName;
          f.name = newName; f.path = newPath; f.modifiedAt = DB.isoNow();
          DB.save(); UI.recordAudit("RENAME_FILE", newPath, "SUCCESS");
          UI.closeModal(); UI.pushNotification("INFO", `Renamed to ${newName}.`);
          render(state.container);
        });
      },
    });
  }

  function dirOptions(excludePath) {
    return DB.state.files.filter((f) => f.type === "DIRECTORY" && f.path !== excludePath)
      .map((d) => `<option value="${U.escapeHtml(d.path)}">${U.escapeHtml(d.path)}</option>`).join("") + `<option value="/">/</option>`;
  }

  function moveFile(f) {
    UI.openModal({
      title: "MOVE",
      body: `<div class="field"><label>DESTINATION DIRECTORY</label><select id="mv-dest">${dirOptions(f.path)}</select></div>`,
      foot: `<button class="btn btn-ghost" id="mv-cancel">CANCEL</button><button class="btn btn-primary" id="mv-ok">MOVE</button>`,
      onMount: (box) => {
        U.qs("#mv-cancel", box).addEventListener("click", UI.closeModal);
        U.qs("#mv-ok", box).addEventListener("click", () => {
          const dest = U.qs("#mv-dest", box).value;
          f.parentPath = dest; f.path = (dest === "/" ? "" : dest) + "/" + f.name; f.modifiedAt = DB.isoNow();
          DB.save(); UI.recordAudit("MOVE_FILE", f.path, "SUCCESS");
          UI.closeModal(); UI.pushNotification("INFO", `Moved ${f.name} to ${dest}.`);
          render(state.container);
        });
      },
    });
  }

  function copyFile(f) {
    const copy = { ...f, id: DB.uid("file"), name: f.name + " (copy)", createdAt: DB.isoNow(), modifiedAt: DB.isoNow() };
    copy.path = (f.parentPath === "/" ? "" : f.parentPath) + "/" + copy.name;
    DB.state.files.push(copy);
    DB.save(); UI.recordAudit("COPY_FILE", copy.path, "SUCCESS");
    UI.closeModal(); UI.pushNotification("INFO", `Copied ${f.name}.`);
    render(state.container);
  }

  function deleteFile(f) {
    DB.state.files = DB.state.files.filter((x) => x.id !== f.id);
    DB.save();
    const success = Math.random() > 0.05;
    UI.recordAudit("DELETE_FILE", f.path, success ? "SUCCESS" : "FAILED");
    UI.closeModal();
    UI.pushNotification(success ? "INFO" : "ERROR", `${success ? "Deleted" : "Failed to delete"} ${f.name}.`);
    render(state.container);
  }

  function openNewFolderModal() {
    UI.openModal({
      title: "CREATE FOLDER",
      body: `<div class="field"><label>FOLDER NAME</label><input type="text" id="nf-name" placeholder="new-folder" /></div>`,
      foot: `<button class="btn btn-ghost" id="nf-cancel">CANCEL</button><button class="btn btn-primary" id="nf-ok">CREATE</button>`,
      onMount: (box) => {
        U.qs("#nf-cancel", box).addEventListener("click", UI.closeModal);
        U.qs("#nf-ok", box).addEventListener("click", () => {
          const name = U.qs("#nf-name", box).value.trim();
          if (!name) return;
          const path = (state.path === "/" ? "" : state.path) + "/" + name;
          DB.state.files.push({ id: DB.uid("file"), name, path, parentPath: state.path, type: "DIRECTORY", size: 0, owner: DB.state.session.username, permissions: "rwxr-xr-x", modifiedAt: DB.isoNow(), createdAt: DB.isoNow() });
          DB.save(); UI.recordAudit("CREATE_FOLDER", path, "SUCCESS");
          UI.closeModal(); UI.pushNotification("INFO", `Folder ${name} created.`);
          render(state.container);
        });
      },
    });
  }

  function openUploadModal() {
    UI.openModal({
      title: "UPLOAD FILE",
      body: `<div class="field"><label>SELECT FILE</label><input type="file" id="up-file" /></div><div class="field-hint">Uploads are simulated: metadata is recorded, content is not stored.</div>`,
      foot: `<button class="btn btn-ghost" id="up-cancel">CANCEL</button><button class="btn btn-primary" id="up-ok">UPLOAD</button>`,
      onMount: (box) => {
        U.qs("#up-cancel", box).addEventListener("click", UI.closeModal);
        U.qs("#up-ok", box).addEventListener("click", () => {
          const input = U.qs("#up-file", box);
          const file = input.files[0];
          if (!file) { UI.closeModal(); return; }
          const path = (state.path === "/" ? "" : state.path) + "/" + file.name;
          DB.state.files.push({ id: DB.uid("file"), name: file.name, path, parentPath: state.path, type: "FILE", size: file.size, owner: DB.state.session.username, permissions: "rw-r--r--", modifiedAt: DB.isoNow(), createdAt: DB.isoNow() });
          DB.save(); UI.recordAudit("UPLOAD_FILE", path, "SUCCESS");
          UI.closeModal(); UI.pushNotification("INFO", `Uploaded ${file.name}.`);
          render(state.container);
        });
      },
    });
  }

  global.PAGES = global.PAGES || {};
  global.PAGES.files = { render };
})(window);
