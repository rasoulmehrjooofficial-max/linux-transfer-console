/* ============================================================================
   ROUTER — minimal hash router. Routes map to PAGES.<key>.render(container, params)
   ============================================================================ */

(function (global) {
  "use strict";

  const routes = [
    { pattern: /^dashboard$/, page: "dashboard" },
    { pattern: /^transfers$/, page: "transfers" },
    { pattern: /^transfers\/([^/]+)$/, page: "transfers", detail: true },
    { pattern: /^files(?:\/(.*))?$/, page: "files" },
    { pattern: /^documents$/, page: "documents" },
    { pattern: /^documents\/([^/]+)$/, page: "documents", detail: true },
    { pattern: /^bulletin(?:\/(.*))?$/, page: "bulletin" },
    { pattern: /^accounts$/, page: "accounts" },
    { pattern: /^servers$/, page: "servers" },
    { pattern: /^logs$/, page: "logs" },
    { pattern: /^history$/, page: "history" },
    { pattern: /^settings$/, page: "settings" },
  ];

  function parseHash() {
    let hash = global.location.hash || "#/dashboard";
    hash = hash.replace(/^#\/?/, "");
    return hash;
  }

  function navigate(path) {
    global.location.hash = "#/" + path.replace(/^\/+/, "");
  }

  function setActiveNav(page) {
    U.qsa(".nav-item").forEach((a) => a.classList.toggle("active", a.dataset.route === page));
  }

  function resolve() {
    const path = parseHash();
    for (const r of routes) {
      const m = path.match(r.pattern);
      if (m) {
        setActiveNav(r.page);
        const content = U.qs("#content");
        const mod = global.PAGES[r.page];
        if (!mod) {
          content.innerHTML = UI.errorBox("4041", "PAGE NOT WIRED", `No renderer for /${r.page}`);
          return;
        }
        try {
          if (r.detail && mod.renderDetail) {
            mod.renderDetail(content, decodeURIComponent(m[1]));
          } else {
            mod.render(content, { sub: m[1] ? decodeURIComponent(m[1]) : null });
          }
        } catch (e) {
          console.error(e);
          content.innerHTML = UI.errorBox("5001", "RENDER FAILURE", e.message || String(e));
        }
        return;
      }
    }
    navigate("dashboard");
  }

  global.ROUTER = { navigate, resolve, parseHash };
})(window);
