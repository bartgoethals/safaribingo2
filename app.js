const BIG_FIVE_IDS = ["lion", "leopard", "elephant", "buffalo", "rhino"];
const DEFAULT_GRID_SIZE = 4;
const ALLOWED_GRID_SIZES = [4, 5];
const STORAGE_KEY = "safari-bingo-state-v2";
const MAX_HISTORY = 12;

const animals = window.SAFARI_ANIMALS || [];
const animalMap = new Map(animals.map((animal) => [animal.id, animal]));
const animalNumberMap = new Map(animals.map((animal, index) => [animal.id, index + 1]));
const restAnimals = animals.filter((animal) => !BIG_FIVE_IDS.includes(animal.id));

const bingoBoard = document.getElementById("bingo-board");
const animalGrid = document.getElementById("animal-grid");
const settingsPage = document.getElementById("settings-page");
const openSettingsButton = document.getElementById("open-settings");
const closeSettingsButton = document.getElementById("close-settings");
const connectionPill = document.getElementById("connection-pill");
const gridSize4Button = document.getElementById("grid-size-4");
const gridSize5Button = document.getElementById("grid-size-5");
const shareLocationToggle = document.getElementById("share-location-toggle");
const openLocationSettingsButton = document.getElementById("open-location-settings");
const locationSettingsCopy = document.getElementById("location-settings-copy");
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
const modalLastLocation = document.getElementById("modal-last-location");
const modalLocationLink = document.getElementById("modal-location-link");
const modalStatus = document.getElementById("modal-status");
const sightingUpload = document.getElementById("sighting-upload");
const uploadPreview = document.getElementById("upload-preview");
const uploadPreviewImage = document.getElementById("upload-preview-image");
const uploadPreviewLabel = document.getElementById("upload-preview-label");

let activeAnimalId = null;
let draftPreviewUrl = null;
let pendingLocation = null;
let locationPermissionState = "unknown";

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

function createDefaultSettings() {
  return {
    shareLocationEnabled: true,
    gridSize: DEFAULT_GRID_SIZE,
  };
}

function getCardSize(gridSize) {
  return gridSize * gridSize;
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

function sanitizeSettings(raw) {
  if (!raw || typeof raw !== "object") {
    return createDefaultSettings();
  }

  return {
    shareLocationEnabled: raw.shareLocationEnabled !== false,
    gridSize: ALLOWED_GRID_SIZES.includes(Number(raw.gridSize))
      ? Number(raw.gridSize)
      : DEFAULT_GRID_SIZE,
  };
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function createRandomCardIds(gridSize = DEFAULT_GRID_SIZE) {
  const cardSize = getCardSize(gridSize);
  const selectedRest = shuffle(restAnimals).slice(0, Math.max(0, cardSize - BIG_FIVE_IDS.length));
  return shuffle([...BIG_FIVE_IDS, ...selectedRest.map((animal) => animal.id)]).slice(0, cardSize);
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    const sightingsSource = parsed?.sightings || parsed;
    const settings = sanitizeSettings(parsed?.settings);
    const cardIds = Array.isArray(parsed?.cardIds) ? parsed.cardIds.filter((id) => animalMap.has(id)) : [];

    return {
      sightings: sanitizeSightings(sightingsSource),
      cardIds: cardIds.length === getCardSize(settings.gridSize) ? cardIds : createRandomCardIds(settings.gridSize),
      settings,
    };
  } catch (error) {
    console.warn("Unable to restore saved progress.", error);
    return {
      sightings: sanitizeSightings({}),
      cardIds: createRandomCardIds(DEFAULT_GRID_SIZE),
      settings: createDefaultSettings(),
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

function toGoogleMapsUrl(location) {
  return `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
}

function getAnimalNumber(id) {
  return animalNumberMap.get(id) || 0;
}

function updateBoardLayout() {
  bingoBoard.style.setProperty("--grid-size", String(state.settings.gridSize));
}

function updateShuffleLabel() {
  shuffleButton.textContent = `Shuffle ${state.settings.gridSize}x${state.settings.gridSize} Card`;
}

function syncGridSizeUI() {
  const gridSize = state.settings.gridSize;
  gridSize4Button.classList.toggle("is-active", gridSize === 4);
  gridSize5Button.classList.toggle("is-active", gridSize === 5);
  updateBoardLayout();
  updateShuffleLabel();
}

function setModalLocationState(message, location = null) {
  modalLastLocation.textContent = message;

  if (location) {
    modalLocationLink.href = toGoogleMapsUrl(location);
    modalLocationLink.classList.remove("is-hidden");
    return;
  }

  modalLocationLink.classList.add("is-hidden");
  modalLocationLink.removeAttribute("href");
}

function renderBingo() {
  bingoBoard.innerHTML = state.cardIds
    .map((id) => {
      const animal = animalMap.get(id);
      const seenClass = hasSeen(id) ? "is-seen" : "";
      const animalNumber = getAnimalNumber(id);
      const tileMarkup = hasSeen(id)
        ? `<img class="bingo-tile-photo" src="${animal.image}" alt="${animal.name}" loading="lazy" />`
        : `<span class="bingo-tile-number" aria-hidden="true">${animalNumber}</span>`;

      return `
        <button
          class="bingo-tile ${seenClass}"
          type="button"
          data-action="scroll-to-animal"
          data-id="${id}"
          aria-label="Go to animal ${animalNumber}: ${animal.name}"
        >
          <span class="bingo-tile-content">${tileMarkup}</span>
        </button>
      `;
    })
    .join("");
}

function renderAnimalList() {
  animalGrid.innerHTML = animals
    .map((animal) => {
      const entry = getSightingEntry(animal.id);
      const lastSeenLine = entry.lastSeenAt
        ? `<p class="animal-note">Last local sighting: ${formatDate(entry.lastSeenAt)}</p>`
        : `<p class="animal-note">No local sighting saved yet.</p>`;
      const locationLine = entry.latestLocation
        ? `
          <p class="animal-note">
            <a class="map-link" href="${toGoogleMapsUrl(entry.latestLocation)}" target="_blank" rel="noreferrer">
              📍 Open last sighting on Google Maps
            </a>
          </p>
        `
        : "";
      const latestImage = entry.latestImage
        ? `
          <div class="animal-evidence">
            <img src="${entry.latestImage.dataUrl}" alt="Latest ${animal.name} sighting upload" />
            <div>
              <strong>Latest uploaded image</strong>
              <p>${entry.latestImage.name}</p>
            </div>
          </div>
        `
        : "";

      return `
        <article
          class="animal-card"
          id="animal-card-${animal.id}"
          role="button"
          tabindex="0"
          data-action="open-modal"
          data-id="${animal.id}"
        >
          <img class="animal-photo" src="${animal.image}" alt="${animal.name}" loading="lazy" />
          <div class="animal-copy">
            <div class="animal-title-row">
              <div class="animal-heading">
                <span class="animal-number">${getAnimalNumber(animal.id)}</span>
                <div>
                  <h3>${animal.name}</h3>
                  <div class="photo-credit"><em>${animal.scientificName}</em></div>
                </div>
              </div>
              <span class="animal-tag">${animal.type}</span>
            </div>

            <p class="animal-description">${animal.description}</p>

            <div class="animal-meta">
              <span class="meta-pill">${animal.region}</span>
              <span class="meta-pill">${entry.count > 0 ? "Seen" : "Awaiting confirmation"}</span>
            </div>

            ${lastSeenLine}
            ${locationLine}
            ${latestImage}
          </div>
        </article>
      `;
    })
    .join("");
}

function render() {
  syncGridSizeUI();
  renderBingo();
  renderAnimalList();
}

function openSettingsPage() {
  settingsPage.classList.remove("is-hidden");
  settingsPage.setAttribute("aria-hidden", "false");
  syncLocationSettingsUI();
}

function closeSettingsPage() {
  settingsPage.classList.add("is-hidden");
  settingsPage.setAttribute("aria-hidden", "true");
}

function setModalStatus(message, isError = false) {
  modalStatus.textContent = message;
  modalStatus.classList.toggle("is-error", isError);
}

async function hydrateModalLocation() {
  if (!state.settings.shareLocationEnabled) {
    pendingLocation = null;
    setModalLocationState("Location sharing is off in Settings.");
    setModalStatus("Turn on Share location in Settings to confirm a sighting.", true);
    return;
  }

  const requestId = activeAnimalId;
  try {
    setModalStatus("Requesting device location...");
    const location = await requestGeolocation();
    if (activeAnimalId !== requestId) {
      return;
    }
    pendingLocation = location;
    setModalLocationState(
      pendingLocation.accuracy
        ? `Accuracy ± ${Math.round(pendingLocation.accuracy)}m.`
        : "Tap the pin to open the exact sighting location.",
      pendingLocation,
    );
    setModalStatus("Location ready. You can confirm the sighting now.");
  } catch (error) {
    if (activeAnimalId !== requestId) {
      return;
    }
    pendingLocation = null;
    setModalLocationState(error.message);
    setModalStatus(error.message, true);
  }
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

  activeAnimalId = id;
  pendingLocation = null;
  clearDraftPreview();
  sightingUpload.value = "";

  modalType.textContent = animal.type;
  modalTitle.textContent = animal.name;
  modalScientific.textContent = animal.scientificName;
  modalDescription.textContent = animal.description;
  modalPhoto.src = animal.image;
  modalPhoto.alt = animal.name;
  modalMeta.innerHTML = `
    <span class="meta-pill">${animal.region}</span>
    <span class="meta-pill">${BIG_FIVE_IDS.includes(id) ? "Big Five" : animal.type}</span>
  `;

  const entry = getSightingEntry(id);
  if (entry.latestImage) {
    setPreviewImage(entry.latestImage.dataUrl, `Last saved upload: ${entry.latestImage.name}`);
  } else {
    setPreviewImage("", "");
  }

  setModalLocationState("Waiting for geolocation permission.");
  setModalStatus(
    state.settings.shareLocationEnabled
      ? "Requesting device location..."
      : "Turn on Share location in Settings to confirm a sighting.",
    !state.settings.shareLocationEnabled,
  );

  modal.classList.remove("is-hidden");
  modal.setAttribute("aria-hidden", "false");
  if (state.settings.shareLocationEnabled) {
    hydrateModalLocation();
  }
}

function closeSightingModal() {
  activeAnimalId = null;
  pendingLocation = null;
  clearDraftPreview();
  sightingUpload.value = "";
  setPreviewImage("", "");
  modal.classList.add("is-hidden");
  modal.setAttribute("aria-hidden", "true");
}

function refreshCard() {
  state.cardIds = createRandomCardIds(state.settings.gridSize);
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
  connectionPill.classList.toggle("is-offline", !navigator.onLine);
}

function setGridSize(gridSize) {
  if (!ALLOWED_GRID_SIZES.includes(gridSize) || gridSize === state.settings.gridSize) {
    syncGridSizeUI();
    return;
  }

  state.settings.gridSize = gridSize;
  state.cardIds = createRandomCardIds(gridSize);
  saveState();
  render();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("/sw.js");
    } catch (error) {
      console.error("Service worker registration failed.", error);
    }
  });
}

async function getLocationPermissionState() {
  if (!navigator.permissions || !navigator.permissions.query) {
    return "unknown";
  }

  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state;
  } catch (error) {
    return "unknown";
  }
}

async function syncLocationSettingsUI() {
  locationPermissionState = await getLocationPermissionState();

  const isEffectivelyOn =
    state.settings.shareLocationEnabled && locationPermissionState !== "denied";

  shareLocationToggle.checked = isEffectivelyOn;

  if (locationPermissionState === "granted" && state.settings.shareLocationEnabled) {
    locationSettingsCopy.textContent =
      "Safari Bingo will collect your location while you confirm a sighting.";
  } else if (locationPermissionState === "denied") {
    locationSettingsCopy.textContent =
      "Location access is blocked in your browser or device settings. Turn the switch on to reopen settings.";
  } else if (!state.settings.shareLocationEnabled) {
    locationSettingsCopy.textContent =
      "Location sharing is off for this app. Turn it on when you want to log coordinates.";
  } else {
    locationSettingsCopy.textContent =
      "Safari Bingo will ask for geolocation during a sighting confirmation.";
  }

  openLocationSettingsButton.classList.toggle(
    "is-hidden",
    locationPermissionState !== "denied" && state.settings.shareLocationEnabled,
  );
}

function openLocationSettings() {
  const userAgent = navigator.userAgent || "";

  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    window.location.href = "app-settings:";
    return;
  }

  window.alert("Open your browser or device location settings, then return to Safari Bingo.");
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
    if (!state.settings.shareLocationEnabled) {
      throw new Error("Turn on Share location in Settings to confirm a sighting.");
    }

    if (!pendingLocation) {
      setModalStatus("Trying device location again...");
      pendingLocation = await requestGeolocation();
      setModalLocationState(
        pendingLocation.accuracy
          ? `Accuracy ± ${Math.round(pendingLocation.accuracy)}m.`
          : "Tap the pin to open the exact sighting location.",
        pendingLocation,
      );
    }

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
      latitude: pendingLocation.latitude,
      longitude: pendingLocation.longitude,
      accuracy: pendingLocation.accuracy,
      imageName: latestImage ? latestImage.name : null,
    };

    state.sightings[activeAnimalId] = {
      count: previous.count + 1,
      lastSeenAt: timestamp,
      latestLocation: pendingLocation,
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
  if (event.target.closest("a")) {
    return;
  }

  const trigger = event.target.closest("[data-action]");
  if (trigger) {
    const { action, id } = trigger.dataset;
    if (action === "open-modal") {
      openSightingModal(id);
    }
    if (action === "scroll-to-animal") {
      scrollToAnimal(id);
    }
    return;
  }

  if (event.target === modal) {
    closeSightingModal();
  }

  if (event.target === settingsPage) {
    closeSettingsPage();
  }
}

function handleAnimalGridKeydown(event) {
  const card = event.target.closest("[data-action='open-modal']");
  if (!card) {
    return;
  }

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openSightingModal(card.dataset.id);
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

function scrollToAnimal(id) {
  const card = document.getElementById(`animal-card-${id}`);
  if (!card) {
    return;
  }

  const previous = document.querySelector(".animal-card.is-targeted");
  if (previous && previous !== card) {
    previous.classList.remove("is-targeted");
  }

  card.classList.add("is-targeted");
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.focus({ preventScroll: true });

  window.setTimeout(() => {
    card.classList.remove("is-targeted");
  }, 1400);
}

async function handleLocationToggleChange() {
  if (!shareLocationToggle.checked) {
    state.settings.shareLocationEnabled = false;
    pendingLocation = null;
    saveState();
    syncLocationSettingsUI();
    return;
  }

  state.settings.shareLocationEnabled = true;
  saveState();

  const permissionState = await getLocationPermissionState();
  if (permissionState === "denied") {
    shareLocationToggle.checked = false;
    openLocationSettings();
    syncLocationSettingsUI();
    return;
  }

  try {
    await requestGeolocation();
  } catch (error) {
    const updatedPermissionState = await getLocationPermissionState();
    if (updatedPermissionState === "denied") {
      shareLocationToggle.checked = false;
      openLocationSettings();
    }
  }

  syncLocationSettingsUI();
}

function handleGridSizeChange(event) {
  const button = event.currentTarget;
  setGridSize(Number(button.dataset.gridSize));
}

document.addEventListener("click", handleGlobalClick);
animalGrid.addEventListener("keydown", handleAnimalGridKeydown);
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }

  if (!modal.classList.contains("is-hidden")) {
    closeSightingModal();
  }

  if (!settingsPage.classList.contains("is-hidden")) {
    closeSettingsPage();
  }
});

openSettingsButton.addEventListener("click", openSettingsPage);
closeSettingsButton.addEventListener("click", closeSettingsPage);
gridSize4Button.addEventListener("click", handleGridSizeChange);
gridSize5Button.addEventListener("click", handleGridSizeChange);
shuffleButton.addEventListener("click", refreshCard);
resetButton.addEventListener("click", resetSightings);
closeModalButton.addEventListener("click", closeSightingModal);
cancelModalButton.addEventListener("click", closeSightingModal);
confirmModalButton.addEventListener("click", confirmSighting);
sightingUpload.addEventListener("change", handleUploadChange);
shareLocationToggle.addEventListener("change", handleLocationToggleChange);
openLocationSettingsButton.addEventListener("click", openLocationSettings);
window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);

updateConnectionStatus();
registerServiceWorker();
syncLocationSettingsUI();
render();
