const VOTED_KEY = "caribbean-survey:voted";
const POLL_INTERVAL_MS = 5000;

const surveySection = document.getElementById("survey");
const resultsSection = document.getElementById("results");
const destinationOptions = document.getElementById("destination-options");
const reasonOptions = document.getElementById("reason-options");
const activityOptions = document.getElementById("activity-options");
const activityHint = document.getElementById("activity-hint");
const submitButton = document.getElementById("submit-button");
const submitHint = document.getElementById("submit-hint");
const progress = document.getElementById("progress");
const totalVotesEl = document.getElementById("total-votes");
const toast = document.getElementById("toast");

let options = { destinations: [], reasons: [], activities: [], maxActivities: 3 };
let chosenDestination = null;
let chosenReason = null;
let chosenActivities = [];
let resultsTimer = null;

function hasAlreadyVoted() {
  return localStorage.getItem(VOTED_KEY) === "true";
}

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.hidden = true;
  }, 3000);
}

function renderDestinations() {
  destinationOptions.innerHTML = "";
  options.destinations.forEach((destination) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "card" + (chosenDestination === destination.id ? " selected" : "");
    card.innerHTML = `
      <span class="emoji">${destination.emoji}</span>
      <span class="card-name">${destination.name}</span>
      <span class="card-blurb">${destination.blurb}</span>
    `;
    card.addEventListener("click", () => {
      chosenDestination = destination.id;
      renderDestinations();
      updateProgress();
    });
    destinationOptions.appendChild(card);
  });
}

function renderReasons() {
  reasonOptions.innerHTML = "";
  options.reasons.forEach((reason) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip" + (chosenReason === reason.id ? " selected" : "");
    chip.innerHTML = `<span class="emoji">${reason.emoji}</span> ${reason.name}`;
    chip.addEventListener("click", () => {
      chosenReason = reason.id;
      renderReasons();
      updateProgress();
    });
    reasonOptions.appendChild(chip);
  });
}

function renderActivities() {
  const maxReached = chosenActivities.length >= options.maxActivities;

  activityOptions.innerHTML = "";
  options.activities.forEach((activity) => {
    const isChosen = chosenActivities.includes(activity.id);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip" + (isChosen ? " selected" : "");
    chip.disabled = maxReached && !isChosen;
    chip.innerHTML = `<span class="emoji">${activity.emoji}</span> ${activity.name}`;
    chip.addEventListener("click", () => {
      if (isChosen) {
        chosenActivities = chosenActivities.filter((id) => id !== activity.id);
      } else {
        chosenActivities.push(activity.id);
      }
      renderActivities();
      updateProgress();
    });
    activityOptions.appendChild(chip);
  });

  activityHint.textContent = maxReached
    ? `That's ${options.maxActivities} — unpick one to swap your choices.`
    : `Pick 1–${options.maxActivities}. (${chosenActivities.length} selected)`;
}

function updateProgress() {
  const done = {
    1: chosenDestination !== null,
    2: chosenReason !== null,
    3: chosenActivities.length > 0,
  };
  progress.querySelectorAll("li").forEach((item) => {
    item.classList.toggle("done", done[item.dataset.step]);
  });

  const allAnswered = done[1] && done[2] && done[3];
  submitButton.disabled = !allAnswered;
  submitHint.textContent = allAnswered ? "Ready to send." : "Answer all three questions to submit.";
}

function renderResultRows(container, rows) {
  container.innerHTML = "";
  rows.forEach((row) => {
    const el = document.createElement("div");
    el.className = "result-row";
    el.innerHTML = `
      <div class="label">
        <span>${row.emoji} ${row.name}</span>
        <span>${row.votes} · ${row.percent}%</span>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${row.percent}%"></div></div>
    `;
    container.appendChild(el);
  });
}

function renderResults(data) {
  totalVotesEl.textContent =
    data.total === 0
      ? "No submissions yet — be the first."
      : `${data.total} submission${data.total === 1 ? "" : "s"}`;
  renderResultRows(document.getElementById("destination-results"), data.destinations);
  renderResultRows(document.getElementById("reason-results"), data.reasons);
  renderResultRows(document.getElementById("activity-results"), data.activities);
}

async function loadResults() {
  try {
    const res = await fetch("/api/results");
    renderResults(await res.json());
  } catch (err) {
    // A failed refresh just leaves the last numbers on screen.
  }
}

function showResultsView() {
  surveySection.hidden = true;
  resultsSection.hidden = false;
  if (resultsTimer === null) {
    resultsTimer = setInterval(loadResults, POLL_INTERVAL_MS);
  }
}

async function submitVote() {
  submitButton.disabled = true;
  try {
    const res = await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destination: chosenDestination,
        reason: chosenReason,
        activities: chosenActivities,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || "Something went wrong", true);
      submitButton.disabled = false;
      return;
    }

    localStorage.setItem(VOTED_KEY, "true");
    renderResults(data);
    showResultsView();
    showToast("Thanks — your answers are in!");
  } catch (err) {
    showToast("Network error — try again", true);
    submitButton.disabled = false;
  }
}

async function start() {
  if (hasAlreadyVoted()) {
    await loadResults();
    showResultsView();
    return;
  }

  const res = await fetch("/api/options");
  options = await res.json();
  renderDestinations();
  renderReasons();
  renderActivities();
  updateProgress();
  surveySection.hidden = false;
}

submitButton.addEventListener("click", submitVote);
start();
