# coursework — student planner

A single-page student planner: subjects, tasks, exams/assignments (grouped by subject), grades with weighted averages, a stopwatch, and a "study room" focus mode. No build step, no backend — everything is plain HTML/CSS/JS and saves to your browser's `localStorage`.

## Run it

Just open `index.html` in a browser. For local development with live reload, any static server works, e.g.:

```
npx serve .
```

## Deploy to GitHub Pages

1. Copy `index.html`, `styles.css`, and `app.js` into your `student-planner` repo (repo root, or a `/docs` folder).
2. Commit and push.
3. In the repo's Settings → Pages, set the source to the branch/folder you used.

## Notes

- Data lives only in the browser that created it (`localStorage`, key `coursework_planner_v1`). Clearing site data or switching browsers/devices starts fresh — there's no sync or account system.
- Deleting a subject also deletes its tasks, exams, and grades (you'll get a confirmation first).
- The stopwatch is a single shared timer — the mini widget in the sidebar, the Stopwatch page, and the Study Room all show the same running clock, so time keeps counting as you move between pages.
- Grade weighting: each subject's average weights its entries by the "weight" you give them (defaults to 1 if left blank). The overall average is the mean of each subject's average.

## Possible next steps

- A light/dark toggle
- Export/import your data as JSON (for backup or moving devices)
- Recurring tasks
- Pomodoro-style intervals in the Study Room, alongside the stopwatch
