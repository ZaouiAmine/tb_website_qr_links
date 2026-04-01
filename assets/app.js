const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

const els = {
  link: /** @type {HTMLInputElement} */ ($("link")),
  generate: /** @type {HTMLButtonElement} */ ($("generate")),
  clear: /** @type {HTMLButtonElement} */ ($("clear")),
  copy: /** @type {HTMLButtonElement} */ ($("copy")),
  download: /** @type {HTMLAnchorElement} */ ($("download")),
  size: /** @type {HTMLSelectElement} */ ($("size")),
  margin: /** @type {HTMLSelectElement} */ ($("margin")),
  eclevel: /** @type {HTMLSelectElement} */ ($("eclevel")),
  status: $("status"),
  qrcode: $("qrcode"),
};

const state = {
  lastSvg: /** @type {string | null} */ (null),
};

function setStatus(text) {
  els.status.textContent = text;
}

function ensureQrLib() {
  // qrcode-svg exposes a global `QRCode` constructor in the browser build.
  if (typeof window.QRCode !== "function") {
    setStatus("QR library failed to load. Please refresh.");
    return false;
  }
  return true;
}

function clearQr() {
  els.qrcode.innerHTML = "";
  state.lastSvg = null;
  els.copy.disabled = true;
  els.download.href = "#";
  els.download.setAttribute("aria-disabled", "true");
}

function normalizeLink(raw) {
  const v = raw.trim();
  if (!v) return "";

  // If user pastes "example.com", treat as https://example.com.
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) return `https://${v}`;
  return v;
}

function svgDataUrl(svg) {
  // Avoid btoa Unicode issues; use encodeURIComponent.
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function renderQr(text) {
  if (!ensureQrLib()) return;
  clearQr();

  const size = Number.parseInt(els.size.value, 10);
  const margin = Number.parseInt(els.margin.value, 10);
  const level = els.eclevel.value;

  // qrcode-svg expects padding in modules. Use our margin dropdown as modules.
  const qr = new window.QRCode({
    content: text,
    padding: Math.max(0, margin),
    width: size,
    height: size,
    color: "#111111",
    background: "#ffffff",
    ecl: level,
    join: true,
    container: "svg",
  });

  const svg = qr.svg();
  state.lastSvg = svg;
  els.qrcode.innerHTML = svg;

  els.copy.disabled = false;
  els.download.href = svgDataUrl(svg);
  els.download.setAttribute("aria-disabled", "false");
}

function tryGenerate() {
  if (!ensureQrLib()) return;
  const normalized = normalizeLink(els.link.value);
  if (!normalized) {
    setStatus("Paste a link to generate a QR code.");
    clearQr();
    return;
  }

  try {
    // Validate URL (throws if invalid).
    // eslint-disable-next-line no-new
    new URL(normalized);
  } catch {
    setStatus("That doesn’t look like a valid URL.");
    clearQr();
    return;
  }

  els.link.value = normalized;
  renderQr(normalized);
  setStatus("QR generated.");
}

els.generate.addEventListener("click", tryGenerate);
els.clear.addEventListener("click", () => {
  els.link.value = "";
  clearQr();
  els.link.focus();
});

els.link.addEventListener("keydown", (e) => {
  if (e.key === "Enter") tryGenerate();
});

els.size.addEventListener("change", () => {
  const normalized = normalizeLink(els.link.value);
  if (normalized) renderQr(normalized);
});
els.margin.addEventListener("change", () => {
  const normalized = normalizeLink(els.link.value);
  if (normalized) renderQr(normalized);
});
els.eclevel.addEventListener("change", () => {
  const normalized = normalizeLink(els.link.value);
  if (normalized) renderQr(normalized);
});

els.download.addEventListener("click", async (e) => {
  if (!state.lastSvg) {
    e.preventDefault();
    setStatus("Generate a QR code first.");
    return;
  }
  els.download.href = svgDataUrl(state.lastSvg);
  els.download.setAttribute("aria-disabled", "false");
});

els.copy.addEventListener("click", async () => {
  if (!state.lastSvg) {
    setStatus("Generate a QR code first.");
    return;
  }

  try {
    await navigator.clipboard.writeText(state.lastSvg);
    setStatus("Copied SVG to clipboard.");
  } catch {
    setStatus("Couldn’t copy to clipboard (permission blocked). Use Download instead.");
  }
});

// Initial state
clearQr();
setStatus("Paste a link, then press Generate.");

