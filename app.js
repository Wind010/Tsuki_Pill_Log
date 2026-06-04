const WINDOW_MONTHS = 12;
const VERSION = 1;
const HASH_PREFIX = "#d=";
const URL_WARN_AT = 1800;

const logBody = document.getElementById("log-body");
const monthLabel = document.getElementById("month-label");
const rangeLabel = document.getElementById("range-label");
const summary = document.getElementById("summary");
const urlSize = document.getElementById("url-size");
const message = document.getElementById("message");
const confettiLayer = document.getElementById("confetti-layer");

const prevBtn = document.getElementById("prev-month");
const nextBtn = document.getElementById("next-month");
const todayBtn = document.getElementById("today");
const copyBtn = document.getElementById("copy-link");

let state = null;
let visibleYear = 0;
let visibleMonth = 0;

function formatDateLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function toEpochDayFromDate(date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  return Math.floor(Date.UTC(y, m, d) / 86400000);
}

function dateFromEpochDay(epochDay) {
  const utcMillis = epochDay * 86400000;
  const utcDate = new Date(utcMillis);
  return new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
}

function makeDefaultState() {
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const start = new Date(end.getFullYear(), end.getMonth() - (WINDOW_MONTHS - 1), 1);
  const days = toEpochDayFromDate(end) - toEpochDayFromDate(start) + 1;
  return {
    version: VERSION,
    startEpochDay: toEpochDayFromDate(start),
    days,
    statuses: new Uint8Array(days)
  };
}

function checksum16(bytes) {
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    sum = (sum + bytes[i]) & 0xffff;
  }
  return sum;
}

function packStatuses(statuses) {
  const packedLen = Math.ceil(statuses.length / 4);
  const packed = new Uint8Array(packedLen);
  for (let i = 0; i < statuses.length; i += 1) {
    const byteIndex = Math.floor(i / 4);
    const shift = (i % 4) * 2;
    packed[byteIndex] |= (statuses[i] & 0x03) << shift;
  }
  return packed;
}

function unpackStatuses(bytes, days) {
  const statuses = new Uint8Array(days);
  for (let i = 0; i < days; i += 1) {
    const byteIndex = Math.floor(i / 4);
    const shift = (i % 4) * 2;
    statuses[i] = (bytes[byteIndex] >> shift) & 0x03;
  }
  return statuses;
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(text) {
  const normalized = text.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padLength);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function encodeState(current) {
  const packed = packStatuses(current.statuses);
  const headerLen = 1 + 4 + 2;
  const bodyLen = packed.length;
  const totalNoChecksum = headerLen + bodyLen;
  const bytes = new Uint8Array(totalNoChecksum + 2);

  bytes[0] = current.version & 0xff;

  const start = current.startEpochDay >>> 0;
  bytes[1] = (start >>> 24) & 0xff;
  bytes[2] = (start >>> 16) & 0xff;
  bytes[3] = (start >>> 8) & 0xff;
  bytes[4] = start & 0xff;

  bytes[5] = (current.days >>> 8) & 0xff;
  bytes[6] = current.days & 0xff;

  bytes.set(packed, 7);

  const sum = checksum16(bytes.subarray(0, totalNoChecksum));
  bytes[totalNoChecksum] = (sum >>> 8) & 0xff;
  bytes[totalNoChecksum + 1] = sum & 0xff;

  return bytesToBase64Url(bytes);
}

function decodeState(encoded) {
  const bytes = base64UrlToBytes(encoded);
  if (bytes.length < 9) {
    throw new Error("Encoded data is too short.");
  }

  const payloadLen = bytes.length - 2;
  const expected = (bytes[payloadLen] << 8) | bytes[payloadLen + 1];
  const actual = checksum16(bytes.subarray(0, payloadLen));
  if (expected !== actual) {
    throw new Error("Checksum mismatch.");
  }

  const version = bytes[0];
  if (version !== VERSION) {
    throw new Error("Unsupported data version.");
  }

  const startEpochDay =
    (bytes[1] << 24) |
    (bytes[2] << 16) |
    (bytes[3] << 8) |
    bytes[4];

  const days = (bytes[5] << 8) | bytes[6];
  if (days < 1 || days > 3660) {
    throw new Error("Invalid day count.");
  }

  const packedLen = Math.ceil(days / 4);
  const actualPackedLen = payloadLen - 7;
  if (actualPackedLen !== packedLen) {
    throw new Error("Length mismatch.");
  }

  const packed = bytes.subarray(7, 7 + packedLen);
  const statuses = unpackStatuses(packed, days);

  return {
    version,
    startEpochDay,
    days,
    statuses
  };
}

function indexForDate(date) {
  const epochDay = toEpochDayFromDate(date);
  return epochDay - state.startEpochDay;
}

function statusForDate(date) {
  const i = indexForDate(date);
  if (i < 0 || i >= state.days) {
    return 0;
  }
  return state.statuses[i];
}

function setStatusBit(index, bitMask, checked) {
  const current = state.statuses[index];
  state.statuses[index] = checked ? (current | bitMask) : (current & ~bitMask);
}

function launchDogConfetti(originEl) {
  if (!confettiLayer || !originEl) {
    return;
  }

  const rect = originEl.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;
  const pieces = 18;

  for (let i = 0; i < pieces; i += 1) {
    const particle = document.createElement("img");
    const angle = (-Math.PI / 2) + ((Math.random() - 0.5) * 1.8);
    const speed = 90 + Math.random() * 180;
    const drift = (Math.random() - 0.5) * 120;
    const dx = Math.cos(angle) * speed + drift;
    const dy = Math.sin(angle) * speed + 180 + Math.random() * 180;
    const rotate = `${Math.round((Math.random() - 0.5) * 720)}deg`;
    const duration = 700 + Math.random() * 700;
    const size = 16 + Math.random() * 14;

    particle.src = "assets/Tsuki.jpg";
    particle.alt = "";
    particle.className = "dogetti";
    particle.style.left = `${originX}px`;
    particle.style.top = `${originY}px`;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.setProperty("--dx", `${dx}px`);
    particle.style.setProperty("--dy", `${dy}px`);
    particle.style.setProperty("--rot", rotate);
    particle.style.animationDuration = `${duration}ms`;

    confettiLayer.appendChild(particle);
    window.setTimeout(() => {
      particle.remove();
    }, duration + 60);
  }
}

function monthStart(year, month) {
  return new Date(year, month, 1);
}

function getRangeDates() {
  const start = dateFromEpochDay(state.startEpochDay);
  const end = addDays(start, state.days - 1);
  return { start, end };
}

function inRange(date) {
  const i = indexForDate(date);
  return i >= 0 && i < state.days;
}

function statusText(status) {
  if (status === 3) return { label: "Complete", className: "done" };
  if (status === 1 || status === 2) return { label: "Partial", className: "partial" };
  return { label: "Missing", className: "missing" };
}

function renderMonth() {
  const startOfMonth = monthStart(visibleYear, visibleMonth);
  const endOfMonth = new Date(visibleYear, visibleMonth + 1, 0);

  monthLabel.textContent = startOfMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });

  logBody.innerHTML = "";

  for (let day = 1; day <= endOfMonth.getDate(); day += 1) {
    const date = new Date(visibleYear, visibleMonth, day);
    if (!inRange(date)) {
      continue;
    }

    const idx = indexForDate(date);
    const status = state.statuses[idx];
    const s = statusText(status);

    const tr = document.createElement("tr");
    const dateCell = document.createElement("td");
    dateCell.textContent = date.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric"
    });

    const morningCell = document.createElement("td");
    const morningBox = document.createElement("input");
    morningBox.type = "checkbox";
    morningBox.checked = (status & 1) !== 0;
    morningBox.addEventListener("change", () => {
      setStatusBit(idx, 1, morningBox.checked);
      persistAndRender("Saved to URL.");
    });
    morningCell.appendChild(morningBox);

    const eveningCell = document.createElement("td");
    const eveningBox = document.createElement("input");
    eveningBox.type = "checkbox";
    eveningBox.checked = (status & 2) !== 0;
    eveningBox.addEventListener("change", () => {
      setStatusBit(idx, 2, eveningBox.checked);
      if (eveningBox.checked) {
        launchDogConfetti(eveningBox);
      }
      persistAndRender("Saved to URL.");
    });
    eveningCell.appendChild(eveningBox);

    const statusCell = document.createElement("td");
    const span = document.createElement("span");
    span.className = `status ${s.className}`;
    span.textContent = s.label;
    statusCell.appendChild(span);

    tr.appendChild(dateCell);
    tr.appendChild(morningCell);
    tr.appendChild(eveningCell);
    tr.appendChild(statusCell);
    logBody.appendChild(tr);
  }

  updateNavButtons();
}

function updateNavButtons() {
  const { start, end } = getRangeDates();
  const currentStart = new Date(visibleYear, visibleMonth, 1);
  const currentEnd = new Date(visibleYear, visibleMonth + 1, 0);

  const prevMonthEnd = new Date(visibleYear, visibleMonth, 0);
  const nextMonthStart = new Date(visibleYear, visibleMonth + 1, 1);

  prevBtn.disabled = prevMonthEnd < start;
  nextBtn.disabled = nextMonthStart > end;

  rangeLabel.textContent = `Tracking window: ${formatDateLocal(start)} to ${formatDateLocal(end)}`;

  if (currentEnd < start || currentStart > end) {
    message.textContent = "Selected month is outside the tracking window.";
  }
}

function updateSummaryAndUrlSize() {
  let complete = 0;
  let partial = 0;
  let missing = 0;

  for (let i = 0; i < state.days; i += 1) {
    const s = state.statuses[i];
    if (s === 3) complete += 1;
    else if (s === 0) missing += 1;
    else partial += 1;
  }

  summary.textContent = `Complete days: ${complete} | Partial days: ${partial} | Missing days: ${missing}`;

  const fullUrl = window.location.href;
  urlSize.textContent = `URL length: ${fullUrl.length} characters`;
  if (fullUrl.length >= URL_WARN_AT) {
    message.textContent = "Warning: URL is getting long for some browsers.";
  }
}

function persistStateToHash() {
  const encoded = encodeState(state);
  const newHash = `${HASH_PREFIX}${encoded}`;
  if (window.location.hash !== newHash) {
    history.replaceState(null, "", newHash);
  }
}

function persistAndRender(statusMessage) {
  persistStateToHash();
  renderMonth();
  updateSummaryAndUrlSize();
  if (statusMessage) {
    message.textContent = statusMessage;
  }
}

function loadStateFromHash() {
  if (!window.location.hash.startsWith(HASH_PREFIX)) {
    state = makeDefaultState();
    persistStateToHash();
    return;
  }

  const encoded = window.location.hash.slice(HASH_PREFIX.length);
  if (!encoded) {
    state = makeDefaultState();
    persistStateToHash();
    return;
  }

  try {
    state = decodeState(encoded);
  } catch (err) {
    state = makeDefaultState();
    persistStateToHash();
    message.textContent = `Invalid URL data. Started a fresh log. (${err.message})`;
  }
}

function moveMonth(step) {
  const next = new Date(visibleYear, visibleMonth + step, 1);
  const { start, end } = getRangeDates();
  const monthEnd = new Date(next.getFullYear(), next.getMonth() + 1, 0);
  if (monthEnd < start || next > end) {
    return;
  }
  visibleYear = next.getFullYear();
  visibleMonth = next.getMonth();
  renderMonth();
}

function goToToday() {
  const today = new Date();
  const { start, end } = getRangeDates();
  if (today < start) {
    visibleYear = start.getFullYear();
    visibleMonth = start.getMonth();
  } else if (today > end) {
    visibleYear = end.getFullYear();
    visibleMonth = end.getMonth();
  } else {
    visibleYear = today.getFullYear();
    visibleMonth = today.getMonth();
  }
  renderMonth();
}

async function copyLink() {
  const link = window.location.href;
  try {
    await navigator.clipboard.writeText(link);
    message.textContent = "Share link copied.";
  } catch (_err) {
    message.textContent = "Clipboard copy failed. Copy the address bar URL manually.";
  }
}

function init() {
  loadStateFromHash();
  const { end } = getRangeDates();
  visibleYear = end.getFullYear();
  visibleMonth = end.getMonth();

  prevBtn.addEventListener("click", () => moveMonth(-1));
  nextBtn.addEventListener("click", () => moveMonth(1));
  todayBtn.addEventListener("click", () => goToToday());
  copyBtn.addEventListener("click", () => copyLink());

  window.addEventListener("hashchange", () => {
    const oldState = state;
    try {
      loadStateFromHash();
      renderMonth();
      updateSummaryAndUrlSize();
      message.textContent = "Loaded state from URL.";
    } catch (_err) {
      state = oldState;
      message.textContent = "Could not load URL state.";
    }
  });

  renderMonth();
  updateSummaryAndUrlSize();
}

init();