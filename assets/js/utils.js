/* ============================================================================
   UTILS — formatting + small DOM helpers shared by every page renderer.
   ============================================================================ */

(function (global) {
  "use strict";

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatBytes(bytes) {
    if (bytes === 0 || bytes === null || bytes === undefined) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const idx = Math.min(i, units.length - 1);
    return `${(bytes / Math.pow(1024, idx)).toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
  }

  function formatSpeed(bps) {
    if (!bps) return "0 B/s";
    return `${formatBytes(bps)}/s`;
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function formatDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function formatTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  }

  function formatDuration(seconds) {
    if (seconds === null || seconds === undefined) return "—";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${pad2(m)}m ${pad2(s)}s`;
    if (m > 0) return `${m}m ${pad2(s)}s`;
    return `${s}s`;
  }

  function formatUptime(seconds) {
    if (!seconds) return "—";
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  }

  function timeAgo(iso) {
    if (!iso) return "—";
    const diff = Date.now() - new Date(iso).getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    return `${day}d ago`;
  }

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function debounce(fn, wait) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  // ---------------------------------------------------------------------
  // File delivery. A plain <a download> / data: URL / pdf.save() works on
  // desktop, but inside an installed iOS home-screen app it navigates the
  // standalone window to the file and leaves a blank white page with no way
  // back. On iOS the reliable route is the native share sheet ("Save to
  // Files"), which needs navigator.share called inside a fresh tap.
  // ---------------------------------------------------------------------
  function isIosLike() {
    const ua = navigator.userAgent || "";
    return /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function dataUrlToBlob(dataUrl) {
    const m = /^data:([^;,]*)((?:;[^;,]*)*),(.*)$/s.exec(dataUrl || "");
    if (!m) return new Blob([]);
    const isB64 = /;base64/.test(m[2]);
    const raw = isB64 ? atob(m[3]) : decodeURIComponent(m[3]);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return new Blob([bytes], { type: m[1] || "application/octet-stream" });
  }

  function toFile(blob, filename) {
    if (typeof File === "function") {
      try { return new File([blob], filename, { type: blob.type || "application/octet-stream" }); } catch (e) { /* fall through */ }
    }
    return blob;
  }

  function canShareFile(file) {
    try {
      return !!(navigator.share && navigator.canShare && navigator.canShare({ files: [file] }));
    } catch (e) { return false; }
  }

  function anchorDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  // Must be called synchronously from a click handler. Returns a promise.
  function saveFile(blob, filename) {
    const file = toFile(blob, filename);
    if (isIosLike() && canShareFile(file)) {
      return navigator.share({ files: [file], title: filename }).catch((e) => {
        if (e && e.name === "AbortError") return; // user closed the sheet
        anchorDownload(blob, filename);
      });
    }
    anchorDownload(blob, filename);
    return Promise.resolve();
  }

  function openBlob(blob) {
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (!w) location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // For files generated asynchronously (e.g. a PDF): the original tap is
  // already used up, so on iOS show a confirm panel whose buttons are fresh
  // taps. Elsewhere just download.
  function deliverFile(blob, filename) {
    if (!isIosLike() || !global.UI || !UI.openModal) {
      anchorDownload(blob, filename);
      return;
    }
    UI.openModal({
      title: "FILE READY",
      body: `<div class="mono" style="word-break:break-all;">${escapeHtml(filename)}</div>
             <div class="field-hint" style="margin-top:6px;">${formatBytes(blob.size)} — tap SAVE and choose "Save to Files".</div>`,
      foot: `<button class="btn btn-primary" id="df-save">SAVE / SHARE</button>
             <button class="btn" id="df-open">OPEN</button>
             <button class="btn btn-ghost" id="df-close">CLOSE</button>`,
      onMount: (box) => {
        qs("#df-save", box).addEventListener("click", () => saveFile(blob, filename));
        qs("#df-open", box).addEventListener("click", () => openBlob(blob));
        qs("#df-close", box).addEventListener("click", () => UI.closeModal());
      },
    });
  }

  function downloadBlob(filename, content, mime) {
    const blob = new Blob([content], { type: mime || "text/plain" });
    deliverFile(blob, filename);
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Minimal Markdown → HTML. Supports the handful of things a bulletin post
  // actually needs: # / ## / ### headings, blank-line paragraphs, **bold**,
  // *italic*, [text](url) links, "- " / "* " bullet lists, "1. " numbered
  // lists, "> " blockquotes, and simple "|"-piped tables (header row, a
  // "---" separator row, then data rows — no alignment syntax). Anything
  // else is left as a plain paragraph. Not a full CommonMark implementation
  // on purpose — this exists so bulletin-data.js stays easy to hand-edit.
  function markdownToHtml(md) {
    if (!md) return "";
    const lines = String(md).replace(/\r\n/g, "\n").split("\n");
    let html = "";
    let i = 0;

    function inline(s) {
      return escapeHtml(s)
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*])\*(?!\*)(.+?)\*(?!\*)/g, "$1<em>$2</em>")
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    }

    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }

      const h = line.match(/^(#{1,3})\s+(.*)$/);
      if (h) { const lvl = h[1].length + 1; html += `<h${lvl}>${inline(h[2])}</h${lvl}>`; i++; continue; }

      if (line.includes("|") && lines[i + 1] && /^[\s|:-]+$/.test(lines[i + 1]) && lines[i + 1].includes("-")) {
        const headerCells = line.split("|").map((c) => c.trim()).filter(Boolean);
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].includes("|")) {
          rows.push(lines[i].split("|").map((c) => c.trim()).filter(Boolean));
          i++;
        }
        html += "<table><tr>" + headerCells.map((c) => `<th>${inline(c)}</th>`).join("") + "</tr>";
        rows.forEach((r) => { html += "<tr>" + r.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>"; });
        html += "</table>";
        continue;
      }

      if (/^[-*]\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^[-*]\s+/, "")); i++; }
        html += "<ul>" + items.map((it) => `<li>${inline(it)}</li>`).join("") + "</ul>";
        continue;
      }

      if (/^\d+\.\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s+/, "")); i++; }
        html += "<ol>" + items.map((it) => `<li>${inline(it)}</li>`).join("") + "</ol>";
        continue;
      }

      if (/^>\s?/.test(line)) {
        const items = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) { items.push(lines[i].replace(/^>\s?/, "")); i++; }
        html += `<blockquote>${inline(items.join(" "))}</blockquote>`;
        continue;
      }

      const para = [line];
      i++;
      while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s+|[-*]\s+|\d+\.\s+|>\s?)/.test(lines[i])) {
        para.push(lines[i]); i++;
      }
      html += `<p>${inline(para.join(" "))}</p>`;
    }
    return html;
  }

  global.U = {
    escapeHtml, formatBytes, formatSpeed, formatDateTime, formatDate, formatTime,
    formatDuration, formatUptime, timeAgo, qs, qsa, el, debounce, downloadBlob, fileToDataUrl,
    markdownToHtml, isIosLike, dataUrlToBlob, canShareFile, anchorDownload, openBlob, saveFile, deliverFile,
  };
})(window);
