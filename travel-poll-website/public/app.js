const POLL_KEY = "travel-poll:voted";
const POLL_INTERVAL_MS = 5000;

const grid = document.getElementById("poll");
const resultsList = document.getElementById("results-list");
const totalVotesEl = document.getElementById("total-votes");
const toast = document.getElementById("toast");

function getVotedIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(POLL_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function rememberVote(id) {
  const voted = getVotedIds();
  voted.add(id);
  localStorage.setItem(POLL_KEY, JSON.stringify([...voted]));
}

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toast.hidden = true;
  }, 2500);
}

function renderCards(destinations) {
  const votedIds = getVotedIds();

  // Cards keep the seed order so the grid doesn't jump around as votes come in.
  const byId = new Map(destinations.map((d) => [d.id, d]));
  const orderedIds = grid.dataset.order
    ? grid.dataset.order.split(",")
    : destinations.map((d) => d.id);
  if (!grid.dataset.order) grid.dataset.order = orderedIds.join(",");

  grid.innerHTML = "";
  orderedIds.forEach((id) => {
    const d = byId.get(id);
    if (!d) return;
    const hasVoted = votedIds.has(d.id);

    const card = document.createElement("article");
    card.className = "card" + (hasVoted ? " voted" : "");
    card.innerHTML = `
      <div class="emoji">${d.emoji}</div>
      <h3>${d.name}</h3>
      <p>${d.blurb}</p>
      <button ${hasVoted ? "disabled" : ""}>${hasVoted ? "Voted ✓" : "Vote"}</button>
    `;
    card.querySelector("button").addEventListener("click", () => vote(d.id));
    grid.appendChild(card);
  });
}

function renderResults(destinations, total) {
  totalVotesEl.textContent = total ? `(${total} vote${total === 1 ? "" : "s"})` : "";
  resultsList.innerHTML = "";
  destinations.forEach((d) => {
    const row = document.createElement("div");
    row.className = "result-row";
    row.innerHTML = `
      <div class="label">
        <span>${d.emoji} ${d.name}</span>
        <span>${d.votes} · ${d.percent}%</span>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${d.percent}%"></div></div>
    `;
    resultsList.appendChild(row);
  });
}

async function loadPoll() {
  const res = await fetch("/api/destinations");
  const data = await res.json();
  renderCards(data.destinations);
  renderResults(data.destinations, data.total);
}

async function vote(id) {
  if (getVotedIds().has(id)) return;
  try {
    const res = await fetch(`/api/vote/${id}`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Something went wrong", true);
      return;
    }
    rememberVote(id);
    renderCards(data.destinations);
    renderResults(data.destinations, data.total);
    showToast("Thanks for voting!");
  } catch (err) {
    showToast("Network error — try again", true);
  }
}

loadPoll();
setInterval(loadPoll, POLL_INTERVAL_MS);
