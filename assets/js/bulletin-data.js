/* ============================================================================
   BULLETIN DATA — the ONLY file you edit to publish/update info here.
   This is NOT wired to any in-app editor on purpose: there is no create/
   edit/delete UI anywhere in the /bulletin section. To publish something,
   edit this array by hand, commit, and push — GitHub Pages redeploys
   automatically in under a minute.

   STRUCTURE — it's a tree. Every node is EITHER a folder OR an item:

   A FOLDER looks like this (has "children"):
     {
       id: "reports",              // unique among its siblings, used in the URL
       title: "Reports",           // shown in the listing
       description: "...",         // optional one-line summary shown under the title
       children: [ ...more folders or items... ]
     }

   An ITEM looks like this (has "body", no "children"):
     {
       id: "q3-summary",           // unique among its siblings, used in the URL
       title: "Q3 2026 Summary",
       date: "2026-09-25",         // "YYYY-MM-DD"
       time: "10:00:00",           // "HH:MM:SS", 24h
       tag: "REPORT",              // NOTICE | UPDATE | REPORT | MAINTENANCE | ALERT
                                    // (controls badge color: ALERT=red,
                                    // MAINTENANCE/NOTICE=yellow, UPDATE=white, REPORT=gray)
       author: "Platform Team",
       description: "...",         // optional one-line summary shown in the listing
       body: `<p>full content, plain HTML — p/h2/h3/table/ul/li/strong/em/a</p>`,
     }

   Folders can be nested as deep as you want — just put more folders inside
   a folder's "children" array. To add something, find the right folder
   below (or add a new top-level folder) and push a new object into its
   "children" array. Order here doesn't matter for items (the list view
   sorts items by date/time automatically); folders keep the order you
   write them in.
   ========================================================================= */

window.BULLETIN_DATA = [
  {
    id: "reports",
    title: "Reports",
    description: "Periodic summaries and platform reports.",
    children: [
      {
        id: "q3-2026-summary",
        title: "Q3 2026 Summary",
        date: "2026-09-25",
        time: "10:00:00",
        tag: "REPORT",
        author: "Platform Team",
        description: "Quarterly overview of transfer volume and uptime.",
        body: `
          <p>Overview of platform activity for Q3 2026.</p>
          <table>
            <tr><th>METRIC</th><th>VALUE</th></tr>
            <tr><td>Total transfers</td><td>—</td></tr>
            <tr><td>Uptime</td><td>—</td></tr>
          </table>
        `,
      },
      {
        id: "archive",
        title: "Archive",
        description: "Older reports, kept for reference.",
        children: [],
      },
    ],
  },
  {
    id: "notices",
    title: "Notices",
    description: "Announcements, maintenance windows, and compliance reminders.",
    children: [
      {
        id: "transfer-engine-v1-2",
        date: "2026-09-25",
        time: "10:00:00",
        tag: "UPDATE",
        title: "Transfer Engine v1.2 — Queue Concurrency Increased",
        author: "Platform Team",
        description: "Concurrent transfer limit raised from 3 to 5.",
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
        id: "maintenance-window",
        date: "2026-09-22",
        time: "23:00:00",
        tag: "MAINTENANCE",
        title: "Scheduled Maintenance — SRV-BACKUP-02",
        author: "Infrastructure",
        description: "Brief SFTP interruption for a routine security patch.",
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
        id: "compliance-notice",
        date: "2026-09-18",
        time: "09:15:00",
        tag: "NOTICE",
        title: "Quarterly Access Review Reminder",
        author: "Compliance",
        description: "Review active user roles before the end of the month.",
        body: `
          <p>Account owners: please review active user roles under <em>/accounts</em> before the end of the month.
          Disable any account that no longer needs access rather than leaving it active-but-unused.</p>
        `,
      },
    ],
  },
];
