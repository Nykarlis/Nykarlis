# Caribbean Travel Survey

A tiny public survey site: visitors answer three questions about a Caribbean
trip, submit once, then see live results for everyone.

## Stack

- **Backend:** Node.js + Express — serves the API and the static frontend
- **Storage:** flat JSON files in `data/` (swap for a real DB in production)
- **Frontend:** vanilla HTML/CSS/JS, no build step

## Run it

```bash
npm install
npm start
```

Then open http://localhost:3000.

## The three questions

1. **Which Caribbean destination excites you most?** — pick exactly one of 8
   destinations.
2. **What's your main reason for traveling?** — pick exactly one of 6 reasons.
3. **What activities do you want to do there?** — pick 1 to 3 activities.

All three are required. The "Submit vote" button only enables once every
question is answered, and the server re-checks the same rules.

## API

- `GET /api/options` — the destination, reason and activity option lists (plus
  `maxActivities`), so the frontend doesn't hardcode them.
- `GET /api/results` — `{ total, destinations, reasons, activities }`, each list
  ranked by count with a percentage.
- `POST /api/vote` — body `{ destination, reason, activities: [...] }`. Appends
  one combined record and returns the updated results.
  - `400` if an id is unknown, or activities is empty / longer than 3 / has
    duplicates.
  - `429` if the same IP already submitted within the last 24 hours.

## Data

- `data/destinations.json`, `data/reasons.json`, `data/activities.json` — the
  option definitions (`id`, `name`, `emoji`, and a `blurb` for destinations).
  Edit these to change the survey; ids are what get stored in votes.
- `data/votes.json` — an append-only log of submissions, one record per visitor:
  `{ id, destination, reason, activities, ts }`. Vote counts are derived from
  this log, so nothing is stored per destination. Reset the survey by setting
  the file back to `[]`.

Activity percentages are the share of *respondents* who picked each activity
(each activity counts once per submission), not a share of all activity picks —
so they add up to more than 100%. The UI labels this.

## Limits

One submission per browser is enforced with `localStorage`; the server also
throttles repeat submissions from the same IP for 24 hours. Neither is
bulletproof — for a real deployment add auth (magic-link email, OAuth) and a
proper database first. The frontend polls `/api/results` every 5 seconds so
results stay live.

## Deploying

Any Node host works (Render, Railway, Fly.io, a VPS). Set `PORT` if your host
requires it — the app already reads `process.env.PORT`. For concurrent traffic,
replace the JSON-file storage with a database (Postgres, SQLite via
`better-sqlite3`) to avoid write races on `votes.json`.
