const BIG_FIVE_IDS = ["lion", "leopard", "elephant", "buffalo", "rhino"];
const CARD_SIZE = 16;
const STORAGE_KEY = "safari-bingo-state-v1";

const animalGrid = document.getElementById("animal-grid");
const bingoBoard = document.getElementById("bingo-board");
const bingoSummary = document.getElementById("bingo-summary");
const statsGrid = document.getElementById("stats-grid");
const connectionPill = document.getElementById("connection-pill");
const cachePill = document.getElementById("cache-pill");
const shuffleButton = document.getElementById("shuffle-card");
const resetButton = document.getElementById("reset-progress");

const animals = window.SAFARI_ANIMALS || [];
const animalMap = new Map(animals.map((animal) => [animal.id, animal]));
const restAnimals = animals.filter((animal) => !BIG_FIVE_IDS.includes(animal.id));

let state = loadState();

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (parsed && Array.isArray(parsed.cardIds) && parsed.cardIds.length === CARD_SIZE) {
      const validCardIds = parsed.cardIds.filter((id) => animalMap.has(id));
      return {
        sightings: sanitizeSightings(parsed.sightings),
        cardIds: validCardIds.length === CARD_SIZE ? validCardIds : createRandomCardIds(),
      };
    }
  } catch (error) {
    console.warn("Unable to restore saved progress.", error);
  }

  return {
    sightings: {},
    cardIds: createRandomCardIds(),
  };
}

function sanitizeSightings(raw) {
  const sightings = {};
  if (!raw || typeof raw !== "object") {
    return sightings;
  }

  for (const animal of animals) {
    const value = Number(raw[animal.id]);
    sightings[animal.id] = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }
  return sightings;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function createRandomCardIds() {
  const selectedRest = shuffle(restAnimals).slice(0, CARD_SIZE - BIG_FIVE_IDS.length);
  return shuffle([...BIG_FIVE_IDS, ...selectedRest.map((animal) => animal.id)]);
}

function getSightingCount(id) {
  return Number(state.sightings[id] || 0);
}

function hasSeen(id) {
  return getSightingCount(id) > 0;
}

function updateSighting(id, delta) {
  const nextValue = Math.max(0, getSightingCount(id) + delta);
  state.sightings[id] = nextValue;
  saveState();
  render();
}

function resetSightings() {
  const confirmed = window.confirm("Reset all sighting counters and keep the current card?");
  if (!confirmed) {
    return;
  }

  state.sightings = {};
  saveState();
  render();
}

function refreshCard() {
  state.cardIds = createRandomCardIds();
  saveState();
  render();
}

function computeBingoStats() {
  const rows = [];
  const cols = [];

  for (let row = 0; row < 4; row += 1) {
    rows.push(state.cardIds.slice(row * 4, row * 4 + 4));
  }

  for (let col = 0; col < 4; col += 1) {
    cols.push([state.cardIds[col], state.cardIds[col + 4], state.cardIds[col + 8], state.cardIds[col + 12]]);
  }

  const diagonals = [
    [state.cardIds[0], state.cardIds[5], state.cardIds[10], state.cardIds[15]],
    [state.cardIds[3], state.cardIds[6], state.cardIds[9], state.cardIds[12]],
  ];

  const lines = [...rows, ...cols, ...diagonals];
  const completedLines = lines.filter((line) => line.every((id) => hasSeen(id)));
  const seenAnimals = animals.filter((animal) => hasSeen(animal.id)).length;
  const totalSightings = animals.reduce((sum, animal) => sum + getSightingCount(animal.id), 0);
  const seenOnCard = state.cardIds.filter((id) => hasSeen(id)).length;
  const bigFiveSeen = BIG_FIVE_IDS.filter((id) => hasSeen(id)).length;

  return {
    seenAnimals,
    totalSightings,
    completedLines: completedLines.length,
    seenOnCard,
    bigFiveSeen,
  };
}

function renderStats(stats) {
  const cards = [
    {
      label: "Animals seen",
      value: `${stats.seenAnimals}/${animals.length}`,
      note: "Unique animals checked off",
    },
    {
      label: "Total sightings",
      value: stats.totalSightings,
      note: "Every witness tap counts",
    },
    {
      label: "Big Five",
      value: `${stats.bigFiveSeen}/5`,
      note: "Essential safari milestone",
    },
    {
      label: "Bingo lines",
      value: stats.completedLines,
      note: "Rows, columns, and diagonals",
    },
  ];

  statsGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="stat-card">
          <span>${card.label}</span>
          <strong>${card.value}</strong>
          <span>${card.note}</span>
        </article>
      `,
    )
    .join("");
}

function renderAnimals() {
  animalGrid.innerHTML = animals
    .map((animal) => {
      const count = getSightingCount(animal.id);
      return `
        <article class="animal-card">
          <img class="animal-photo" src="${animal.image}" alt="${animal.name}" loading="lazy" />
          <div class="animal-copy">
            <div class="animal-title-row">
              <div>
                <h3>${animal.name}</h3>
                <div class="photo-credit"><em>${animal.scientificName}</em></div>
              </div>
              <span class="animal-tag">${animal.type}</span>
            </div>
            <p class="animal-description">${animal.description}</p>
            <div class="animal-meta">
              <span class="meta-pill">${animal.region}</span>
              <span class="meta-pill">${count > 0 ? "Seen" : "Not seen yet"}</span>
            </div>
            <div class="counter-row">
              <div class="counter-display">
                <span>Witnessed</span>
                <strong>${count}</strong>
              </div>
              <div class="counter-controls">
                <button class="counter-button muted" type="button" data-action="decrement" data-id="${animal.id}">
                  -
                </button>
                <button class="counter-button" type="button" data-action="increment" data-id="${animal.id}">
                  + Witnessed
                </button>
              </div>
            </div>
            <div class="photo-credit">
              <a href="${animal.source}" target="_blank" rel="noreferrer">Photo source</a>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderBingo(stats) {
  bingoBoard.innerHTML = state.cardIds
    .map((id) => {
      const animal = animalMap.get(id);
      const count = getSightingCount(id);
      const seenClass = count > 0 ? "seen" : "";
      const bigFiveClass = BIG_FIVE_IDS.includes(id) ? "big-five" : "";
      return `
        <button class="bingo-tile ${seenClass} ${bigFiveClass}" type="button" data-action="increment" data-id="${id}">
          <span class="bingo-tile-name">${animal.name}</span>
          <span class="bingo-tile-count">${count}</span>
          <span class="bingo-tile-caption">
            ${count > 0 ? "Tap for another sighting" : "Tap when you spot it"}
          </span>
        </button>
      `;
    })
    .join("");

  const headline =
    stats.completedLines > 0
      ? `You have ${stats.completedLines} bingo line${stats.completedLines > 1 ? "s" : ""}.`
      : "No completed line yet. Keep scanning the savanna.";

  bingoSummary.innerHTML = `
    <h3>${headline}</h3>
    <p>
      ${stats.seenOnCard} of ${CARD_SIZE} animals on this card have been seen at least once.
    </p>
    <div class="summary-grid">
      <div>
        <span>Seen on card</span>
        <strong>${stats.seenOnCard}</strong>
      </div>
      <div>
        <span>Need for full card</span>
        <strong>${CARD_SIZE - stats.seenOnCard}</strong>
      </div>
    </div>
  `;
}

function render() {
  const stats = computeBingoStats();
  renderStats(stats);
  renderAnimals();
  renderBingo(stats);
}

function handleClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }

  const { action, id } = button.dataset;
  if (!animalMap.has(id)) {
    return;
  }

  if (action === "increment") {
    updateSighting(id, 1);
  }

  if (action === "decrement") {
    updateSighting(id, -1);
  }
}

function updateConnectionStatus() {
  connectionPill.textContent = navigator.onLine ? "Online now" : "Offline mode";
  connectionPill.style.background = navigator.onLine ? "var(--leaf)" : "var(--earth)";
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    cachePill.textContent = "Offline cache unsupported";
    return;
  }

  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("/sw.js");
      cachePill.textContent = "Offline cache ready";
    } catch (error) {
      console.error("Service worker registration failed.", error);
      cachePill.textContent = "Offline cache failed";
    }
  });
}

animalGrid.addEventListener("click", handleClick);
bingoBoard.addEventListener("click", handleClick);
shuffleButton.addEventListener("click", refreshCard);
resetButton.addEventListener("click", resetSightings);
window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);

updateConnectionStatus();
registerServiceWorker();
render();
