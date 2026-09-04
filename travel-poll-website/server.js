const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'destinations.json');

// Minimum time before the same visitor (by IP) can vote for the same
// destination again. Keeps the demo simple while discouraging trivial
// ballot-stuffing (a real deployment would add auth or a captcha instead).
const REVOTE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readDestinations() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function writeDestinations(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function withStats(destinations) {
  const total = destinations.reduce((sum, d) => sum + d.votes, 0);
  const ranked = [...destinations]
    .map((d) => ({
      ...d,
      percent: total ? Math.round((d.votes / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.votes - a.votes);
  return { destinations: ranked, total };
}

// In-memory only — resets on restart. Good enough to throttle a single
// process; swap for a shared store (Redis, DB) behind a load balancer.
const lastVoteByIpAndId = new Map();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

app.get('/api/destinations', (req, res) => {
  res.json(withStats(readDestinations()));
});

app.post('/api/vote/:id', (req, res) => {
  const { id } = req.params;
  const ip = getClientIp(req);
  const key = `${ip}:${id}`;

  const destinations = readDestinations();
  const destination = destinations.find((d) => d.id === id);
  if (!destination) {
    return res.status(404).json({ error: 'Destination not found' });
  }

  const lastVote = lastVoteByIpAndId.get(key);
  if (lastVote && Date.now() - lastVote < REVOTE_COOLDOWN_MS) {
    return res.status(429).json({ error: 'You already voted for this destination recently' });
  }

  destination.votes += 1;
  writeDestinations(destinations);
  lastVoteByIpAndId.set(key, Date.now());

  res.json(withStats(destinations));
});

app.listen(PORT, () => {
  console.log(`Travel poll running at http://localhost:${PORT}`);
});
