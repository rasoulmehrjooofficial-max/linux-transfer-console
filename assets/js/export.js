/* ============================================================================
   EXPORT — PDF (jsPDF + html2canvas) and TXT export for documents.
   Architecture kept extensible: EXPORT.formats lists what's wired up now,
   with DOCX/HTML/CSV/JSON left as declared-but-not-implemented targets
   (section 21/48) so the UI can be honest about what's "future".
   ============================================================================ */

(function (global) {
  "use strict";

  const IMPLEMENTED = ["pdf", "txt"];
  const FUTURE = ["docx", "html", "csv", "json"];

  function buildPrintableNode(doc) {
    const wrap = document.createElement("div");
    wrap.style.width = "760px";
    wrap.style.padding = "36px 40px";
    wrap.style.background = "#ffffff";
    wrap.style.color = "#111111";
    wrap.style.fontFamily = "'JetBrains Mono', monospace";
    wrap.style.fontSize = "11px";

    const logoHtml = doc.header.logoUrl
      ? `<img src="${doc.header.logoUrl}" style="max-height:46px;max-width:160px;object-fit:contain" />`
      : `<div style="font-weight:700;font-size:13px;">${U.escapeHtml(doc.header.companyName || "")}</div>`;

    wrap.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:16px;">
        <div>${logoHtml}<div style="font-size:15px;font-weight:700;margin-top:6px;">${U.escapeHtml(doc.header.documentTitle || doc.title)}</div></div>
        <div style="text-align:right;font-size:9.5px;color:#333;">
          <div>DOCUMENT ID: ${U.escapeHtml(doc.docId)}</div>
          <div>DATE: ${U.escapeHtml(doc.header.date)}</div>
          <div>VERSION: ${U.escapeHtml(doc.currentVersion)}</div>
        </div>
      </div>
      <div style="min-height:400px;line-height:1.55;">${doc.contentHtml}</div>
      <div style="border-top:1px solid #111;margin-top:26px;padding-top:8px;font-size:9px;color:#555;display:flex;justify-content:space-between;">
        <span>${doc.footer.showDocumentId ? "DOC ID: " + U.escapeHtml(doc.docId) : ""}</span>
        <span>${doc.footer.confidentialityText ? U.escapeHtml(doc.footer.confidentialityText) : ""}</span>
        <span>${doc.footer.showGeneratedDate ? "Generated: " + U.escapeHtml(U.formatDateTime(DB.isoNow())) : ""}</span>
      </div>
    `;

    const styleTags = wrap.querySelectorAll("table");
    styleTags.forEach((t) => {
      t.style.borderCollapse = "collapse";
      t.style.width = "100%";
      t.style.margin = "8px 0";
      t.querySelectorAll("td,th").forEach((c) => {
        c.style.border = "1px solid #111";
        c.style.padding = "5px 8px";
        c.style.fontSize = "10.5px";
      });
      t.querySelectorAll("th").forEach((c) => { c.style.background = "#eee"; c.style.textAlign = "left"; });
    });

    return wrap;
  }

  async function exportDocumentPdf(doc) {
    if (!global.jspdf) {
      UI.pushNotification("ERROR", "PDF engine unavailable (offline?). TXT export still works.");
      return;
    }
    const { jsPDF } = global.jspdf;
    const node = buildPrintableNode(doc);
    node.style.position = "fixed";
    node.style.left = "-10000px";
    node.style.top = "0";
    document.body.appendChild(node);

    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    try {
      await new Promise((resolve, reject) => {
        pdf.html(node, {
          x: 24,
          y: 24,
          width: 545,
          windowWidth: 760,
          html2canvas: { scale: 0.75 },
          callback: () => resolve(),
        });
      });
      pdf.save(`${doc.docId}.pdf`);
      UI.recordAudit("EXPORT_PDF", doc.docId, "SUCCESS");
      UI.pushNotification("INFO", `Exported ${doc.docId} to PDF.`);
    } catch (e) {
      UI.recordAudit("EXPORT_PDF", doc.docId, "FAILED", String(e));
      UI.pushNotification("ERROR", `PDF export failed for ${doc.docId}.`);
    } finally {
      node.remove();
    }
  }

  function htmlToPlainText(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    tmp.querySelectorAll("tr").forEach((tr) => {
      const cells = Array.from(tr.children).map((c) => c.textContent.trim());
      tr.textContent = cells.join("  |  ");
    });
    tmp.querySelectorAll("li").forEach((li) => { li.textContent = "- " + li.textContent; });
    return tmp.textContent.split("\n").map((l) => l.trim()).filter((l, i, arr) => l !== "" || (i > 0 && arr[i - 1] !== "")).join("\n");
  }

  function exportDocumentTxt(doc) {
    const line = "=".repeat(70);
    const sub = "-".repeat(Math.min(40, doc.header.documentTitle.length + 2));
    const body = htmlToPlainText(doc.contentHtml);
    const txt = [
      line,
      doc.header.documentTitle || doc.title,
      sub,
      "",
      "DOCUMENT ID:", doc.docId, "",
      "DATE:", doc.header.date, "",
      "VERSION:", doc.currentVersion, "",
      "AUTHOR:", doc.createdBy, "",
      line,
      "CONTENT",
      "-------",
      "",
      body,
      "",
      line,
      "FOOTER",
      "------",
      doc.footer.confidentialityText || "",
      `Generated: ${U.formatDateTime(DB.isoNow())}`,
      line,
    ].join("\n");
    U.downloadBlob(`${doc.docId}.txt`, txt, "text/plain");
    UI.recordAudit("EXPORT_TXT", doc.docId, "SUCCESS");
    UI.pushNotification("INFO", `Exported ${doc.docId} to TXT.`);
  }

  global.EXPORT = { exportDocumentPdf, exportDocumentTxt, IMPLEMENTED, FUTURE };
})(window);
