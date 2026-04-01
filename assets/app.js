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
}

function normalizeLink(raw) {
  const v = raw.trim();
  if (!v) return "";

  // If user pastes "example.com", treat as https://example.com.
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) return `https://${v}`;
  return v;
}

function getQrSourceNode() {
  const canvas = els.qrcode.querySelector("canvas");
  if (canvas) return canvas;
  const img = els.qrcode.querySelector("img");
  if (img) return img;
  return null;
}

async function toPngDataUrl(node, paddingPx) {
  const size = Number.parseInt(els.size.value, 10);
  const outSize = size + paddingPx * 2;

  const outCanvas = document.createElement("canvas");
  outCanvas.width = outSize;
  outCanvas.height = outSize;
  const ctx = outCanvas.getContext("2d");
  if (!ctx) throw new Error("canvas-ctx-unavailable");

  // White background.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outSize, outSize);

  if (node instanceof HTMLCanvasElement) {
    ctx.drawImage(node, paddingPx, paddingPx, size, size);
    return outCanvas.toDataURL("image/png");
  }

  if (node instanceof HTMLImageElement) {
    // qrcode.js often renders GIF; we convert to PNG by drawing to canvas.
    await new Promise((resolve, reject) => {
      if (node.complete && node.naturalWidth > 0) return resolve(true);
      node.addEventListener("load", () => resolve(true), { once: true });
      node.addEventListener("error", () => reject(new Error("image-load-failed")), { once: true });
    });
    ctx.drawImage(node, paddingPx, paddingPx, size, size);
    return outCanvas.toDataURL("image/png");
  }

  throw new Error("unsupported-node");
}

async function getPngDataUrl() {
  const node = getQrSourceNode();
  if (!node) return null;

  const margin = Number.parseInt(els.margin.value, 10);
  const paddingPx = Math.max(0, margin) * 8; // visually matches "margin" without relying on qrcode.js internals
  return await toPngDataUrl(node, paddingPx);
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

async function refreshExportLinks() {
  const node = getQrSourceNode();
  if (!node) {
    els.copy.disabled = true;
    els.download.href = "#";
    els.download.setAttribute("aria-disabled", "true");
    return;
  }

  try {
    const dataUrl = await getPngDataUrl();
    if (!dataUrl) throw new Error("no-data");
    els.copy.disabled = false;
    els.download.href = dataUrl;
    els.download.setAttribute("aria-disabled", "false");
  } catch {
    // Still allow scanning; only exporting is affected.
    els.copy.disabled = true;
    els.download.href = "#";
    els.download.setAttribute("aria-disabled", "true");
    setStatus("QR generated. Export may be blocked by browser permissions.");
  }
}

// When QR is generated, give qrcode.js a tick to render then refresh export links.
const _renderQr = renderQr;
renderQr = function renderQrPatched(text) {
  _renderQr(text);
  setTimeout(() => void refreshExportLinks(), 0);
};

els.download.addEventListener("click", async (e) => {
  const node = getQrSourceNode();
  if (!node) {
    e.preventDefault();
    setStatus("Generate a QR code first.");
    return;
  }

  const dataUrl = await getPngDataUrl();
  if (!dataUrl) {
    e.preventDefault();
    setStatus("Generate a QR code first.");
    return;
  }

  els.download.href = dataUrl;
  els.download.setAttribute("aria-disabled", "false");
});

els.copy.addEventListener("click", async () => {
  const dataUrl = await getPngDataUrl();
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

