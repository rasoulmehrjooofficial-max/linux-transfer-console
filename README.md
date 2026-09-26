# TRANSFER-CONSOLE

A Linux/server-administration-styled console for managing data transfers, files,
documents, servers, and accounts. Pure static HTML/CSS/JS — no build step, no
Node backend, no database server. Runs entirely in the browser against
`localStorage`.

## Running it

Just open `index.html` in a browser — no install needed. Because it uses
`fetch`-free vanilla JS with no ES modules, `file://` works directly:

```
open index.html
```

If you'd rather serve it (e.g. to test on another device on your network), any
static file server works:

```bash
python3 -m http.server 4173
# then open http://localhost:4173
```

## Installing on an iPhone (PWA)

The app is a real installable PWA — the tab title, home-screen icon (a glasses
mark on black), and standalone (no browser chrome) window are all wired up via
`manifest.json` + the `apple-*` meta tags in `index.html`, and `sw.js` caches
the app shell for offline use once installed.

**The one requirement:** Safari on iPhone will only install a PWA from a real
URL it can fetch — not from a file sitting on your Mac. So you need to host
these files somewhere reachable from the phone first. Three practical options:

1. **Your own VPS** (you already have one for Qyreva) — copy the folder to
   it and serve it with nginx/Caddy/Apache as static files, or just
   `python3 -m http.server 8080` in the folder over SSH with the port open.
   Then visit `http://<your-server-ip>:8080` in Safari on the iPhone.
2. **Free static hosting** — drag-and-drop the folder onto
   [Netlify Drop](https://app.netlify.com/drop), or push it to a GitHub repo
   and enable GitHub Pages. Both give you a real HTTPS URL in under a minute.
3. **Same Wi-Fi, quick test** — run `python3 -m http.server 4173` on your Mac
   and open `http://<your-mac's-LAN-IP>:4173` in Safari on the iPhone (both
   devices on the same network). Good for a quick look, not for daily use
   (your Mac has to stay on and running the server).

**Then, on the iPhone, in Safari** (must be Safari — Chrome/Firefox on iOS
can't install PWAs):
1. Open the hosted URL.
2. Tap the Share icon → **Add to Home Screen**.
3. Confirm the name ("rama") and tap **Add**.

It now behaves like an installed app: its own icon, launches full-screen with
no address bar, and (thanks to the service worker) keeps working even with
no network once it's been opened at least once.

## What's real vs. mock

- **Everything is interactive and stateful.** Creating a transfer, editing a
  document, adding a server, disabling a user — all of it persists to
  `localStorage` and survives a reload.
- **Entry point is a Termius-style host picker**, not the dashboard. On load
  you land on `/` (the connect screen): search hosts, add a new one, click a
  host card to "connect" (a short simulated handshake log), then the app
  shell opens with that host set as the active `SERVER:` in the topbar. The
  topbar's `⏻ DISCONNECT` button (or the terminal's `exit`/`logout` command)
  returns you to the host list.
- **The transfer engine actually runs.** A 1-second ticker in
  `assets/js/pages/transfers.js` advances progress, writes live log lines,
  completes/fails transfers, and promotes queued transfers — all client-side.
- **The terminal panel is a real typable shell** (mock backend). Toggle it
  from the topbar's `>_ TERM` button; it both tails live audit/transfer logs
  and accepts commands — `ls`, `cd`, `pwd`, `cat`, `whoami`, `hostname`,
  `uptime`, `df`, `free`, `ps`, `top`, `transfers`, `servers`, `history`,
  `clear`, `exit`/`logout` — all reading from the same mock dataset the rest
  of the UI uses, with up/down arrow history recall.
- **The document editor has a font/size picker and a real table editor** —
  `+R`/`-R`/`+C`/`-C` add or remove a row/column at the cursor's cell,
  alongside the existing bold/italic/headings/lists/links/images/logo/
  header-footer/version-history controls.
- **PDF export is real** (jsPDF + html2canvas, loaded from cdnjs). **TXT
  export is real** (plain `Blob` download). Both are wired to the document
  editor's Save/Export buttons.
- **Server connections are mocked on purpose.** `assets/js/data.js` defines a
  `CONN` abstraction (`ServerConnection` base class, `MockConnection`, and
  stub `SSHConnection`/`SFTPConnection`/`FTPConnection`/`APIConnection`
  classes). Every server today resolves to `MockConnection`. Wiring a real
  backend means implementing one of those stub classes against a real
  endpoint — no other UI code changes.
- **There is no server, auth, or database.** Reset the demo dataset anytime
  from `/settings` → "RESET DEMO DATA".

## Structure

```
index.html                  shell: topbar, sidebar, statusbar, modals, terminal
assets/css/style.css         design system (black/white/gray/yellow/red only)
assets/js/data.js            mock DB + localStorage persistence + seed data
assets/js/utils.js           formatting helpers
assets/js/components.js      badges, tables, modal/toast/notification/audit helpers
assets/js/export.js          PDF/TXT export
assets/js/router.js          hash router
assets/js/main.js            boot sequence, topbar/sidebar/terminal/search wiring
assets/js/pages/*.js         one file per route (/dashboard, /transfers, ...)
assets/js/bulletin-data.js    content for /bulletin — edit this file directly, see below
```

## Updating the /bulletin board

`/bulletin` is a read-only info board — there is no create/edit/delete button
anywhere in the UI for it, on purpose. To publish or change something there,
edit `assets/js/bulletin-data.js` directly (it has field-by-field instructions
at the top of the file), then commit and push:

```bash
git add assets/js/bulletin-data.js
git commit -m "Bulletin: <what changed>"
git push
```

GitHub Pages redeploys automatically in under a minute.

## Palette

Black / white / gray / yellow (warning) / red (error) only — see `:root` in
`style.css`. No blue, purple, or green anywhere, including status badges.
