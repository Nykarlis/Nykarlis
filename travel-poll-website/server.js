const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const DESTINATIONS_FILE = path.join(DATA_DIR, 'destinations.json');
const REASONS_FILE = path.join(DATA_DIR, 'reasons.json');
const ACTIVITIES_FILE = path.join(DATA_DIR, 'activities.json');
const VOTES_FILE = path.join(DATA_DIR, 'votes.json');

const MAX_ACTIVITIES = 3;

// How long the same visitor (by IP) has to wait before submitting again.
// Keeps the demo simple while discouraging trivial ballot-stuffing.
const RESUBMIT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

// Option lists never change while the server runs, so read them once at startup.
const destinations = readJson(DESTINATIONS_FILE);
const reasons = readJson(REASONS_FILE);
const activities = readJson(ACTIVITIES_FILE);

function readVotes() {
  return readJson(VOTES_FILE);
}

function writeVotes(votes) {
  fs.writeFileSync(VOTES_FILE, JSON.stringify(votes, null, 2));
}

function percentOf(count, total) {
  if (!total) return 0;
  return Math.round((count / total) * 1000) / 10;
}

// Counts how many submissions picked each option, ranked highest first.
// `getPicks` returns the ids a single vote record chose for this question.
function rank(options, votes, getPicks) {
  const counts = new Map(options.map((option) => [option.id, 0]));

  votes.forEach((vote) => {
    getPicks(vote).forEach((id) => {
      if (counts.has(id)) counts.set(id, counts.get(id) + 1);
    });
  });

  return options
    .map((option) => ({
      ...option,
      votes: counts.get(option.id),
      percent: percentOf(counts.get(option.id), votes.length),
    }))
    .sort((a, b) => b.votes - a.votes);
}

function buildResults() {
  const votes = readVotes();
  return {
    total: votes.length,
    destinations: rank(destinations, votes, (vote) => [vote.destination]),
    reasons: rank(reasons, votes, (vote) => [vote.reason]),
    // Each activity is counted once per submission that included it, so these
    // percentages are "share of respondents", not a share of all activity picks.
    activities: rank(activities, votes, (vote) => vote.activities),
  };
}

// In-memory only — resets on restart. Good enough to throttle a single
// process; swap for a shared store (Redis, DB) behind a load balancer.
const lastSubmitByIp = new Map();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function isKnownId(options, id) {
  return options.some((option) => option.id === id);
}

// Returns an error message string, or null when the submission is valid.
function validateSubmission(body) {
  const { destination, reason } = body;
  const picked = body.activities;

  if (!isKnownId(destinations, destination)) {
    return 'Pick one of the listed Caribbean destinations.';
  }
  if (!isKnownId(reasons, reason)) {
    return 'Pick one of the listed travel reasons.';
  }
  if (!Array.isArray(picked) || picked.length === 0) {
    return 'Pick at least one activity.';
  }
  if (picked.length > MAX_ACTIVITIES) {
    return `Pick at most ${MAX_ACTIVITIES} activities.`;
  }
  if (new Set(picked).size !== picked.length) {
    return 'Each activity can only be picked once.';
  }
  if (!picked.every((id) => isKnownId(activities, id))) {
    return 'Pick activities from the listed options.';
  }
  return null;
}

app.get('/api/options', (req, res) => {
  res.json({ destinations, reasons, activities, maxActivities: MAX_ACTIVITIES });
});

app.get('/api/results', (req, res) => {
  res.json(buildResults());
});

app.post('/api/vote', (req, res) => {
  const problem = validateSubmission(req.body || {});
  if (problem) {
    return res.status(400).json({ error: problem });
  }

  const ip = getClientIp(req);
  const lastSubmit = lastSubmitByIp.get(ip);
  if (lastSubmit && Date.now() - lastSubmit < RESUBMIT_COOLDOWN_MS) {
    return res.status(429).json({ error: 'You already submitted the survey recently. Try again in 24 hours.' });
  }

  const votes = readVotes();
  votes.push({
    id: `vote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    destination: req.body.destination,
    reason: req.body.reason,
    activities: req.body.activities,
    ts: new Date().toISOString(),
  });
  writeVotes(votes);
  lastSubmitByIp.set(ip, Date.now());

  res.json(buildResults());
});

app.listen(PORT, () => {
  console.log(`Caribbean travel survey running at http://localhost:${PORT}`);
});
