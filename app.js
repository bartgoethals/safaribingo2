const BIG_FIVE_IDS = ["lion", "leopard", "elephant", "buffalo", "rhino"];
const GRID_SIZE = 5;
const CARD_SIZE = GRID_SIZE * GRID_SIZE;
const STORAGE_KEY = "safari-bingo-state-v2";
const MAX_HISTORY = 12;

const animals = window.SAFARI_ANIMALS || [];
const animalMap = new Map(animals.map((animal) => [animal.id, animal]));
const restAnimals = animals.filter((animal) => !BIG_FIVE_IDS.includes(animal.id));

const bingoBoard = document.getElementById("bingo-board");
const bingoSummary = document.getElementById("bingo-summary");
const animalGrid = document.getElementById("animal-grid");
const statsGrid = document.getElementById("stats-grid");
const connectionPill = document.getElementById("connection-pill");
const cachePill = document.getElementById("cache-pill");
const shuffleButton = document.getElementById("shuffle-card");
const resetButton = document.getElementById("reset-progress");

const modal = document.getElementById("sighting-modal");
const closeModalButton = document.getElementById("close-sighting");
const cancelModalButton = document.getElementById("cancel-sighting");
const confirmModalButton = document.getElementById("confirm-sighting");
const modalPhoto = document.getElementById("modal-photo");
const modalType = document.getElementById("modal-type");
const modalTitle = document.getElementById("modal-title");
const modalScientific = document.getElementById("modal-scientific");
const modalDescription = document.getElementById("modal-description");
const modalMeta = document.getElementById("modal-meta");
const modalCount = document.getElementById("modal-count");
const modalLastSeen = document.getElementById("modal-last-seen");
const modalLastLocation = document.getElementById("modal-last-location");
const modalStatus = document.getElementById("modal-status");
const modalSource = document.getElementById("modal-source");
const sightingUpload = document.getElementById("sighting-upload");
const uploadPreview = document.getElementById("upload-preview");
const uploadPreviewImage = document.getElementById("upload-preview-image");
const uploadPreviewLabel = document.getElementById("upload-preview-label");

let activeAnimalId = null;
let draftPreviewUrl = null;

let state = loadState();

function createEmptySighting() {
  return {
    count: 0,
    lastSeenAt: null,
    latestLocation: null,
    latestImage: null,
    history: [],
  };
}

function sanitizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sanitizeLocation(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const latitude = sanitizeNumber(raw.latitude);
  const longitude = sanitizeNumber(raw.longitude);
  const accuracy = sanitizeNumber(raw.accuracy);

  if (latitude === null || longitude === null) {
    return null;
  }

  return {
    latitude,
    longitude,
    accuracy: accuracy === null ? null : Math.max(0, accuracy),
  };
}

function sanitizeImage(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  if (typeof raw.dataUrl !== "string" || typeof raw.name !== "string") {
    return null;
  }

  return {
    name: raw.name,
    dataUrl: raw.dataUrl,
  };
}

function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((record) => {
      const location = sanitizeLocation(record);
      if (!location || typeof record.timestamp !== "string") {
        return null;
      }

      return {
        timestamp: record.timestamp,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        imageName: typeof record.imageName === "string" ? record.imageName : null,
      };
    })
    .filter(Boolean)
    .slice(0, MAX_HISTORY);
}

function sanitizeSightings(raw) {
  const sightings = {};
  const source = raw && typeof raw === "object" ? raw : {};

  for (const animal of animals) {
    const current = source[animal.id];

    if (typeof current === "number") {
      sightings[animal.id] = {
        ...createEmptySighting(),
        count: Math.max(0, Math.floor(current)),
      };
      continue;
    }

    if (!current || typeof current !== "object") {
      sightings[animal.id] = createEmptySighting();
      continue;
    }

    const history = sanitizeHistory(current.history);
    const latestLocation = sanitizeLocation(current.latestLocation) || sanitizeLocation(history[0]);
    const count = Math.max(
      history.length,
      Number.isFinite(Number(current.count)) ? Math.floor(Number(current.count)) : 0,
    );

    sightings[animal.id] = {
      count,
      lastSeenAt: typeof current.lastSeenAt === "string" ? current.lastSeenAt : history[0]?.timestamp || null,
      latestLocation,
      latestImage: sanitizeImage(current.latestImage),
      history,
    };
  }

  return sightings;
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

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    const sightingsSource = parsed?.sightings || parsed;
    const cardIds = Array.isArray(parsed?.cardIds) ? parsed.cardIds.filter((id) => animalMap.has(id)) : [];

    return {
      sightings: sanitizeSightings(sightingsSource),
      cardIds: cardIds.length === CARD_SIZE ? cardIds : createRandomCardIds(),
    };
  } catch (error) {
    console.warn("Unable to restore saved progress.", error);
    return {
      sightings: sanitizeSightings({}),
      cardIds: createRandomCardIds(),
    };
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error("Unable to save local safari state.", error);
    return false;
  }
}

function getSightingEntry(id) {
  return state.sightings[id] || createEmptySighting();
}

function getSightingCount(id) {
  return getSightingEntry(id).count;
}

function hasSeen(id) {
  return getSightingCount(id) > 0;
}

function formatDate(value) {
  if (!value) {
    return "No local record";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "No local record" : date.toLocaleString();
}

function formatLocation(location) {
  if (!location) {
    return "No local coordinates saved yet";
  }

  const accuracy = location.accuracy ? ` ± ${Math.round(location.accuracy)}m` : "";
  return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}${accuracy}`;
}

function computeBingoStats() {
  const rows = [];
  const columns = [];

  for (let row = 0; row < GRID_SIZE; row += 1) {
    rows.push(state.cardIds.slice(row * GRID_SIZE, row * GRID_SIZE + GRID_SIZE));
  }

  for (let column = 0; column < GRID_SIZE; column += 1) {
    columns.push(
      Array.from({ length: GRID_SIZE }, (_, row) => state.cardIds[row * GRID_SIZE + column]),
    );
  }

  const diagonals = [
    Array.from({ length: GRID_SIZE }, (_, index) => state.cardIds[index * GRID_SIZE + index]),
    Array.from(
      { length: GRID_SIZE },
      (_, index) => state.cardIds[index * GRID_SIZE + (GRID_SIZE - 1 - index)],
    ),
  ];

  const lines = [...rows, ...columns, ...diagonals];
  const completedLines = lines.filter((line) => line.every((id) => hasSeen(id))).length;
  const seenAnimals = animals.filter((animal) => hasSeen(animal.id)).length;
  const totalSightings = animals.reduce((sum, animal) => sum + getSightingCount(animal.id), 0);
  const geotaggedSightings = animals.reduce(
    (sum, animal) => sum + getSightingEntry(animal.id).history.length,
    0,
  );

  return {
    seenAnimals,
    totalSightings,
    completedLines,
    geotaggedSightings,
    bigFiveSeen: BIG_FIVE_IDS.filter((id) => hasSeen(id)).length,
    seenOnCard: state.cardIds.filter((id) => hasSeen(id)).length,
  };
}

function renderStats(stats) {
  const cards = [
    {
      label: "Species confirmed",
      value: `${stats.seenAnimals}/${animals.length}`,
      note: "Unique animals confirmed locally",
    },
    {
      label: "Total sightings",
      value: stats.totalSightings,
      note: "Every confirmed tap with saved metadata",
    },
    {
      label: "Big Five",
      value: `${stats.bigFiveSeen}/5`,
      note: "Confirmed members of the Big Five",
    },
    {
      label: "Bingo lines",
      value: stats.completedLines,
      note: `${stats.geotaggedSightings} geotagged records on this device`,
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

function renderBingo(stats) {
  bingoBoard.innerHTML = state.cardIds
    .map((id) => {
      const animal = animalMap.get(id);
      const count = getSightingCount(id);
      const seenClass = count > 0 ? "is-seen" : "";
      const bigFiveChip = BIG_FIVE_IDS.includes(id)
        ? `<span class="tile-chip">Big Five</span>`
        : `<span class="tile-chip">${animal.type}</span>`;

      return `
        <button class="bingo-tile ${seenClass}" type="button" data-action="open-modal" data-id="${id}">
          <img class="bingo-tile-image" src="${animal.image}" alt="${animal.name}" loading="lazy" />
          <span class="bingo-tile-content">
            <span class="bingo-tile-top">
              ${bigFiveChip}
              <span class="tile-count">${count}</span>
            </span>
            <span>
              <span class="bingo-tile-name">${animal.name}</span>
              <span class="bingo-tile-caption">
                ${count > 0 ? "Add another geotagged sighting" : "Open and confirm sighting"}
              </span>
            </span>
          </span>
        </button>
      `;
    })
    .join("");

  const headline =
    stats.completedLines > 0
      ? `You have ${stats.completedLines} completed bingo line${stats.completedLines > 1 ? "s" : ""}.`
      : "No completed bingo line yet.";

  bingoSummary.innerHTML = `
    <h3>${headline}</h3>
    <p>
      ${stats.seenOnCard} of ${CARD_SIZE} tiles on this card have at least one confirmed sighting.
    </p>
    <div class="summary-grid">
      <div>
        <span>Confirmed on board</span>
        <strong>${stats.seenOnCard}</strong>
      </div>
      <div>
        <span>Still open</span>
        <strong>${CARD_SIZE - stats.seenOnCard}</strong>
      </div>
    </div>
  `;
}

function renderAnimalList() {
  animalGrid.innerHTML = animals
    .map((animal) => {
      const entry = getSightingEntry(animal.id);
      const latestImage = entry.latestImage
        ? `
          <div class="animal-evidence">
            <img src="${entry.latestImage.dataUrl}" alt="Latest ${animal.name} sighting upload" />
            <div>
              <strong>Latest uploaded evidence</strong>
              <p>${entry.latestImage.name}</p>
            </div>
          </div>
        `
        : "";

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
              <span class="meta-pill">${entry.count > 0 ? "Confirmed locally" : "Awaiting confirmation"}</span>
            </div>

            <div class="animal-data-grid">
              <div class="detail-card">
                <span>Total confirmations</span>
                <strong>${entry.count}</strong>
              </div>
              <div class="detail-card">
                <span>Last recorded</span>
                <strong>${formatDate(entry.lastSeenAt)}</strong>
              </div>
              <div class="detail-card">
                <span>Latest coordinates</span>
                <strong>${formatLocation(entry.latestLocation)}</strong>
              </div>
              <div class="detail-card">
                <span>Saved local records</span>
                <strong>${entry.history.length}</strong>
              </div>
            </div>

            ${latestImage}

            <div class="animal-actions">
              <button class="primary-button" type="button" data-action="open-modal" data-id="${animal.id}">
                Log Sighting
              </button>
              <p class="photo-credit">
                <a href="${animal.source}" target="_blank" rel="noreferrer">Photo source</a>
              </p>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function render() {
  const stats = computeBingoStats();
  renderStats(stats);
  renderBingo(stats);
  renderAnimalList();
}

function setModalStatus(message, isError = false) {
  modalStatus.textContent = message;
  modalStatus.classList.toggle("is-error", isError);
}

function clearDraftPreview() {
  if (draftPreviewUrl) {
    URL.revokeObjectURL(draftPreviewUrl);
    draftPreviewUrl = null;
  }
}

function setPreviewImage(src, label) {
  if (!src) {
    uploadPreview.classList.add("is-hidden");
    uploadPreviewImage.removeAttribute("src");
    uploadPreviewLabel.textContent = "No file selected";
    return;
  }

  uploadPreview.classList.remove("is-hidden");
  uploadPreviewImage.src = src;
  uploadPreviewLabel.textContent = label;
}

function openSightingModal(id) {
  const animal = animalMap.get(id);
  if (!animal) {
    return;
  }

  const entry = getSightingEntry(id);
  activeAnimalId = id;
  clearDraftPreview();
  sightingUpload.value = "";

  modalType.textContent = animal.type;
  modalTitle.textContent = animal.name;
  modalScientific.textContent = animal.scientificName;
  modalDescription.textContent = animal.description;
  modalPhoto.src = animal.image;
  modalPhoto.alt = animal.name;
  modalCount.textContent = String(entry.count);
  modalLastSeen.textContent = formatDate(entry.lastSeenAt);
  modalLastLocation.textContent = formatLocation(entry.latestLocation);
  modalSource.href = animal.source;
  modalMeta.innerHTML = `
    <span class="meta-pill">${animal.region}</span>
    <span class="meta-pill">${BIG_FIVE_IDS.includes(id) ? "Big Five" : animal.type}</span>
  `;

  if (entry.latestImage) {
    setPreviewImage(entry.latestImage.dataUrl, `Last saved upload: ${entry.latestImage.name}`);
  } else {
    setPreviewImage("", "");
  }

  setModalStatus(
    "Confirming a sighting will request the device location and save it only on this device for now.",
  );

  modal.classList.remove("is-hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeSightingModal() {
  activeAnimalId = null;
  clearDraftPreview();
  sightingUpload.value = "";
  setPreviewImage("", "");
  modal.classList.add("is-hidden");
  modal.setAttribute("aria-hidden", "true");
}

function refreshCard() {
  state.cardIds = createRandomCardIds();
  saveState();
  render();
}

function resetSightings() {
  const confirmed = window.confirm(
    "Reset all local sightings, saved coordinates, and uploaded evidence while keeping the current card order?",
  );

  if (!confirmed) {
    return;
  }

  state.sightings = sanitizeSightings({});
  saveState();
  render();
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

function requestGeolocation() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("This device does not support geolocation."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        let message = "Location permission is required to confirm a sighting.";

        if (error.code === error.TIMEOUT) {
          message = "Timed out while waiting for device location. Try again with a stronger signal.";
        }

        if (error.code === error.POSITION_UNAVAILABLE) {
          message = "Device location is currently unavailable. Try again in a more open area.";
        }

        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      },
    );
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Unable to read the selected image file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to prepare the uploaded image."));
    image.src = source;
  });
}

async function compressImage(file) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Please choose a valid image file.");
  }

  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const maxSize = 720;
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));

  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return {
    name: file.name,
    dataUrl: canvas.toDataURL("image/jpeg", 0.74),
  };
}

async function confirmSighting() {
  const animal = animalMap.get(activeAnimalId);
  if (!animal) {
    return;
  }

  confirmModalButton.disabled = true;
  cancelModalButton.disabled = true;
  closeModalButton.disabled = true;

  try {
    setModalStatus("Requesting device geolocation...");
    const location = await requestGeolocation();

    let latestImage = null;
    const upload = sightingUpload.files && sightingUpload.files[0];

    if (upload) {
      setModalStatus("Preparing uploaded image...");
      latestImage = await compressImage(upload);
    }

    const previous = getSightingEntry(activeAnimalId);
    const timestamp = new Date().toISOString();
    const historyRecord = {
      timestamp,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      imageName: latestImage ? latestImage.name : null,
    };

    state.sightings[activeAnimalId] = {
      count: previous.count + 1,
      lastSeenAt: timestamp,
      latestLocation: location,
      latestImage,
      history: [historyRecord, ...previous.history].slice(0, MAX_HISTORY),
    };

    const persisted = saveState();
    render();
    closeSightingModal();

    if (!persisted) {
      window.alert(
        "The sighting was added in this session, but local storage is full so it may not survive a reload.",
      );
    }
  } catch (error) {
    setModalStatus(error.message, true);
  } finally {
    confirmModalButton.disabled = false;
    cancelModalButton.disabled = false;
    closeModalButton.disabled = false;
  }
}

function handleGlobalClick(event) {
  const trigger = event.target.closest("[data-action]");
  if (trigger) {
    const { action, id } = trigger.dataset;
    if (action === "open-modal") {
      openSightingModal(id);
    }
    return;
  }

  if (event.target === modal) {
    closeSightingModal();
  }
}

function handleUploadChange() {
  clearDraftPreview();

  const file = sightingUpload.files && sightingUpload.files[0];
  if (!file) {
    const entry = activeAnimalId ? getSightingEntry(activeAnimalId) : null;
    if (entry?.latestImage) {
      setPreviewImage(entry.latestImage.dataUrl, `Last saved upload: ${entry.latestImage.name}`);
    } else {
      setPreviewImage("", "");
    }
    return;
  }

  draftPreviewUrl = URL.createObjectURL(file);
  setPreviewImage(draftPreviewUrl, `Selected file: ${file.name}`);
}

document.addEventListener("click", handleGlobalClick);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.classList.contains("is-hidden")) {
    closeSightingModal();
  }
});

shuffleButton.addEventListener("click", refreshCard);
resetButton.addEventListener("click", resetSightings);
closeModalButton.addEventListener("click", closeSightingModal);
cancelModalButton.addEventListener("click", closeSightingModal);
confirmModalButton.addEventListener("click", confirmSighting);
sightingUpload.addEventListener("change", handleUploadChange);
window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);

updateConnectionStatus();
registerServiceWorker();
render();
