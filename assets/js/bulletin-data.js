/* ============================================================================
   BULLETIN DATA — the ONLY file that controls what shows up in /bulletin.
   There is no create/edit/delete button anywhere in the app for this on
   purpose. To add or change something here, edit this file and push —
   GitHub Pages redeploys automatically in under a minute. (Simplest of
   all: just describe what you want added in chat and it gets done for you
   — you never have to touch this file yourself if you don't want to.)

   THE SHAPE — everything is either a FOLDER or an ITEM.

   A FOLDER (things go inside "children"):
     {
       id: "reports",                 // short, unique among its siblings
       title: "Reports",              // shown in the list
       description: "...",            // optional one-line summary
       children: [ ...folders or items... ],
     }

   An ITEM (the actual post — no "children", has "body" instead):
     {
       id: "q3-summary",               // short, unique among its siblings
       title: "Q3 2026 Summary",
       date: "2026-09-25",             // "YYYY-MM-DD"
       time: "10:00:00",               // "HH:MM:SS", 24h
       tag: "REPORT",                  // NOTICE | UPDATE | REPORT | MAINTENANCE | ALERT
       author: "Platform Team",
       description: "...",             // optional one-line summary shown in the list
       body: `...`,                    // the full text — see below
     }

   WRITING "body" — plain text, not HTML. Just write normally:
     - A blank line starts a new paragraph.
     - "# Title", "## Subtitle" for headings.
     - "- like this" for a bullet list.
     - "1. like this" for a numbered list.
     - "**bold**" and "*italic*".
     - "[link text](https://...)" for a link.
     - "> quoted text" for a callout/quote.
     - A simple table:
         Field | Value
         --- | ---
         Status | Completed

   Folders can nest as deep as you want — just put more folders inside a
   folder's "children" array. Order doesn't matter for items (the list
   sorts by date/time automatically); folders keep the order written here.
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
        body: `Overview of platform activity for Q3 2026.

Metric | Value
--- | ---
Total transfers | —
Uptime | —`,
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
        body: `The transfer engine now runs up to **5 concurrent transfers** instead of 3. Queued transfers are promoted automatically as slots free up — no action needed.

Field | Value
--- | ---
Previous concurrency limit | 3
New concurrency limit | 5
Effective | Immediately`,
      },
      {
        id: "maintenance-window",
        date: "2026-09-22",
        time: "23:00:00",
        tag: "MAINTENANCE",
        title: "Scheduled Maintenance — SRV-BACKUP-02",
        author: "Infrastructure",
        description: "Brief SFTP interruption for a routine security patch.",
        body: `SRV-BACKUP-02 will be briefly unreachable for a routine security patch.

- Window: 23:00–23:30 local time
- Impact: SFTP transfers to/from this host only
- No data loss expected — in-flight transfers will auto-retry`,
      },
      {
        id: "compliance-notice",
        date: "2026-09-18",
        time: "09:15:00",
        tag: "NOTICE",
        title: "Quarterly Access Review Reminder",
        author: "Compliance",
        description: "Review active user roles before the end of the month.",
        body: `Account owners: please review active user roles under *"/accounts"* before the end of the month. Disable any account that no longer needs access rather than leaving it active-but-unused.`,
      },
    ],
  },
];
