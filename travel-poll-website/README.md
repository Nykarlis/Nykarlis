# Travel Destination Poll

A tiny public poll site: visitors vote for the travel destination that excites
them most, and everyone sees live results.

## Stack

- **Backend:** Node.js + Express — serves the API and the static frontend
- **Storage:** `data/destinations.json` (flat file — swap for a real DB in production)
- **Frontend:** vanilla HTML/CSS/JS, no build step

## Run it

```bash
npm install
npm start
```

Then open http://localhost:3000.

## How it works

- `GET /api/destinations` returns all destinations with vote counts and percentages.
- `POST /api/vote/:id` records a vote for a destination.
- Each browser is prevented from re-voting for the same destination via
  `localStorage`; the server also throttles repeat votes from the same IP for
  24 hours as a basic anti-spam measure. Neither is bulletproof — for a
  production deployment, add real auth (e.g. magic-link email, OAuth) and a
  proper database before opening it to the public.
- The frontend polls the API every 5 seconds so results update live for
  everyone viewing the page.

## Customizing

Edit `data/destinations.json` to change the destination list (id, name, emoji,
blurb). Votes reset by setting `votes` back to `0`.

## Deploying

Any Node host works (Render, Railway, Fly.io, a VPS, etc.). Set `PORT` if your
host requires it — the app already reads `process.env.PORT`. For real
concurrent traffic, replace the JSON-file storage with a database (Postgres,
SQLite via `better-sqlite3`, etc.) to avoid write-race conditions.
