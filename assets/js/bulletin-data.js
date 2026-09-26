/* ============================================================================
   BULLETIN DATA — the ONLY file you edit to publish/update info here.
   This is NOT wired to any in-app editor on purpose: there is no create/
   edit/delete UI anywhere in the /bulletin section. To publish something,
   edit this array by hand, commit, and push — GitHub Pages redeploys
   automatically in under a minute.

   HOW TO ADD A NEW ITEM
   ----------------------------------------------------------------------
   Copy one of the objects below, change every field, and add it to the
   TOP of the BULLETIN_DATA array (newest first is just a convention —
   the page sorts by `date`+`time` automatically, so order here doesn't
   actually matter, but keeping newest-on-top makes this file easier to
   read yourself).

   FIELDS
   - id:    a short unique slug, used in the URL (#/bulletin/<id>). Must
            be unique across all entries. Safe characters: a-z 0-9 and -.
   - date:  "YYYY-MM-DD"
   - time:  "HH:MM:SS" (24h)
   - tag:   one of "NOTICE" | "UPDATE" | "REPORT" | "MAINTENANCE" | "ALERT"
            (controls the badge color — ALERT is red, MAINTENANCE/NOTICE
            are yellow, UPDATE/REPORT are white/gray. Stick to these five
            so the color system stays consistent with the rest of the app.)
   - title: short line shown in the list.
   - author: who/what this is from (shown in the detail view footer).
   - body:  the full content. Plain HTML — you can use <p>, <h2>/<h3>,
            <table>/<tr>/<td>/<th>, <ul>/<li>, <strong>, <em>, <a href>.
            This renders exactly as written and is never editable in the UI.
   ========================================================================= */

window.BULLETIN_DATA = [
  {
    id: "2026-09-transfer-engine-v1-2",
    date: "2026-09-25",
    time: "10:00:00",
    tag: "UPDATE",
    title: "Transfer Engine v1.2 — Queue Concurrency Increased",
    author: "Platform Team",
    body: `
      <p>The transfer engine now runs up to <strong>5 concurrent transfers</strong> instead of 3.
      Queued transfers are promoted automatically as slots free up — no action needed.</p>
      <table>
        <tr><th>FIELD</th><th>VALUE</th></tr>
        <tr><td>Previous concurrency limit</td><td>3</td></tr>
        <tr><td>New concurrency limit</td><td>5</td></tr>
        <tr><td>Effective</td><td>Immediately</td></tr>
      </table>
    `,
  },
  {
    id: "2026-09-maintenance-window",
    date: "2026-09-22",
    time: "23:00:00",
    tag: "MAINTENANCE",
    title: "Scheduled Maintenance — SRV-BACKUP-02",
    author: "Infrastructure",
    body: `
      <p>SRV-BACKUP-02 will be briefly unreachable for a routine security patch.</p>
      <ul>
        <li>Window: 23:00–23:30 local time</li>
        <li>Impact: SFTP transfers to/from this host only</li>
        <li>No data loss expected — in-flight transfers will auto-retry</li>
      </ul>
    `,
  },
  {
    id: "2026-09-compliance-notice",
    date: "2026-09-18",
    time: "09:15:00",
    tag: "NOTICE",
    title: "Quarterly Access Review Reminder",
    author: "Compliance",
    body: `
      <p>Account owners: please review active user roles under <em>/accounts</em> before the end of the month.
      Disable any account that no longer needs access rather than leaving it active-but-unused.</p>
    `,
  },
];
