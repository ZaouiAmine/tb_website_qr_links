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
  lastPngUrl: /** @type {string | null} */ (null),
};

function setStatus(text) {
  els.status.textContent = text;
}

function clearQr() {
  els.qrcode.innerHTML = "";
  if (state.lastPngUrl) URL.revokeObjectURL(state.lastPngUrl);
  state.lastPngUrl = null;
  els.copy.disabled = true;
  els.download.href = "#";
  els.download.setAttribute("aria-disabled", "true");
  setStatus("");
}

function normalizeLink(raw) {
  const v = raw.trim();
  if (!v) return "";

  // If user pastes "example.com", treat as https://example.com.
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) return `https://${v}`;
  return v;
}

function getPngDataUrl() {
  /** qrcode.js may render either <img> or <canvas>. */
  const img = els.qrcode.querySelector("img");
  if (img?.src?.startsWith("data:image")) return img.src;

  const canvas = els.qrcode.querySelector("canvas");
  if (canvas) return canvas.toDataURL("image/png");

  return null;
}

async function copyPngToClipboard(dataUrl) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const item = new ClipboardItem({ [blob.type]: blob });
  await navigator.clipboard.write([item]);
}

function renderQr(text) {
  clearQr();

  const size = Number.parseInt(els.size.value, 10);
  const margin = Number.parseInt(els.margin.value, 10);
  const level = els.eclevel.value;

  // qrcode.js uses "correctLevel" enum.
  const correctLevel =
    level === "L"
      ? window.QRCode.CorrectLevel.L
      : level === "M"
        ? window.QRCode.CorrectLevel.M
        : level === "Q"
          ? window.QRCode.CorrectLevel.Q
          : window.QRCode.CorrectLevel.H;

  // eslint-disable-next-line no-new
  new window.QRCode(els.qrcode, {
    text,
    width: size,
    height: size,
    colorDark: "#111111",
    colorLight: "#ffffff",
    correctLevel,
  });

  // qrcode.js doesn't expose margin; we can approximate by wrapping and padding.
  els.qrcode.style.padding = `${margin * 4}px`;

  const dataUrl = getPngDataUrl();
  if (dataUrl) {
    els.copy.disabled = false;
    els.download.href = dataUrl;
    els.download.setAttribute("aria-disabled", "false");
  }
}

function tryGenerate() {
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

els.download.addEventListener("click", (e) => {
  const dataUrl = getPngDataUrl();
  if (!dataUrl) {
    e.preventDefault();
    setStatus("Generate a QR code first.");
  }
});

els.copy.addEventListener("click", async () => {
  const dataUrl = getPngDataUrl();
  if (!dataUrl) {
    setStatus("Generate a QR code first.");
    return;
  }

  if (!navigator.clipboard || !window.ClipboardItem) {
    setStatus("Clipboard PNG copy isn’t supported in this browser.");
    return;
  }

  try {
    await copyPngToClipboard(dataUrl);
    setStatus("Copied PNG to clipboard.");
  } catch {
    setStatus("Couldn’t copy to clipboard (permission blocked). Use Download instead.");
  }
});

// Initial state
clearQr();
setStatus("Paste a link, then press Generate.");

