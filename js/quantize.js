/**
 * PIXGLYPH // quantize.js
 * Core ASCII art generation engine
 */

const FONT_RATIO = 0.5;

const CHAR_SETS = {
  matrix:    [' ', ' ', '.', ':', '+', '%', '@', '#', '&', '*'],
  cyberpunk: [' ', ' ', '·', ':', ';', '=', 'x', 'X', '$', '█'],
  retro:     [' ', ' ', '.', "'", '`', '+', ';', ':', ',', '|', '!', '?', '>'],
  blockart:  [' ', ' ', '░', '░', '▒', '▒', '▓', '▓', '█', '█'],
  halftone:  [' ', ' ', '.', '·', '°', 'o', 'O', '0', '@', '■'],
  lines:     [' ', ' ', '·', '-', '~', '=', '+', 'T', 'H', '#'],
};

function quantizeImage(imageSrc, opts = {}) {
  const {
    style       = 'matrix',
    width       = 100,
    contrast    = 0,
    brightness  = 0,
    detail      = 2,
    sharpness   = 0,
    saturation  = 0,
    edgeBoost   = 0,
    charDensity = 3,
    invert      = false,
    colorMode   = true,
  } = opts;

  const t0 = performance.now();
  const canvas = document.getElementById('hidden-canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const naturalW = imageSrc.naturalWidth || imageSrc.width;
  const naturalH = imageSrc.naturalHeight || imageSrc.height;
  const aspectRatio = naturalH / naturalW;

  let pixelW, pixelH;
  pixelW = width;
  pixelH = Math.round(width * aspectRatio * FONT_RATIO);

  canvas.width  = pixelW;
  canvas.height = pixelH;

  // CSS filter pipeline
  const filters = [];
  filters.push(`contrast(${(1 + contrast / 100).toFixed(2)})`);
  filters.push(`brightness(${(1 + brightness / 100).toFixed(2)})`);
  if (saturation !== 0) filters.push(`saturate(${Math.max(0, 1 + saturation / 100).toFixed(2)})`);
  if (sharpness > 0)    filters.push(`contrast(${(1 + sharpness / 200).toFixed(2)})`);
  ctx.filter = filters.join(' ');
  ctx.drawImage(imageSrc, 0, 0, pixelW, pixelH);
  ctx.filter = 'none';

  const imageData = ctx.getImageData(0, 0, pixelW, pixelH);
  let data = imageData.data;

  // Free GPU: clear canvas immediately after pixel read
  ctx.clearRect(0, 0, pixelW, pixelH);
  canvas.width = 1; canvas.height = 1;

  // Edge boost: blend Sobel edges into luminance
  if (edgeBoost > 0) {
    data = applyEdgeBoost(data, pixelW, pixelH, edgeBoost / 100);
  }

  const { lines, colorLines } = renderStandard(data, pixelW, pixelH, style, invert, colorMode, detail, charDensity);

  const histogram = computeHistogram(data, pixelW, pixelH);
  const renderMs  = Math.round(performance.now() - t0);
  const outW      = lines[0] ? lines[0].length : width;

  return { lines, colorLines, width: outW, height: lines.length, renderMs, histogram };
}

// ── EDGE BOOST ────────────────────────────────────────────────────────────────
function applyEdgeBoost(data, w, h, strength) {
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    lum[i] = getLuminance(data[i*4], data[i*4+1], data[i*4+2]);
  }
  const out = new Uint8ClampedArray(data);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx =
        -lum[(y-1)*w+(x-1)] + lum[(y-1)*w+(x+1)]
        -2*lum[y*w+(x-1)]   + 2*lum[y*w+(x+1)]
        -lum[(y+1)*w+(x-1)] + lum[(y+1)*w+(x+1)];
      const gy =
        -lum[(y-1)*w+(x-1)] - 2*lum[(y-1)*w+x] - lum[(y-1)*w+(x+1)]
        +lum[(y+1)*w+(x-1)] + 2*lum[(y+1)*w+x] + lum[(y+1)*w+(x+1)];
      const edge = Math.min(255, Math.sqrt(gx*gx + gy*gy));
      const idx = (y * w + x) * 4;
      // Blend edge signal into pixel brightness
      const blend = strength * 0.6;
      out[idx]   = Math.min(255, data[idx]   * (1 - blend) + (data[idx]   + edge) * blend);
      out[idx+1] = Math.min(255, data[idx+1] * (1 - blend) + (data[idx+1] + edge) * blend);
      out[idx+2] = Math.min(255, data[idx+2] * (1 - blend) + (data[idx+2] + edge) * blend);
    }
  }
  return out;
}

// ── STANDARD RENDER ────────────────────────────────────────────────────────────
function renderStandard(data, w, h, style, invert, colorMode, detail, charDensity) {
  const baseChars = CHAR_SETS[style] || CHAR_SETS.matrix;
  // charDensity 1-5: how much of the char set to use (1=sparse, 5=full range)
  const cutoff = Math.round((charDensity / 5) * (baseChars.length - 1));
  const chars   = baseChars.slice(0, Math.max(2, cutoff + 1));
  const maxIdx  = chars.length - 1;

  const lines      = [];
  const colorLines = colorMode ? [] : null;

  let minL = 255, maxL = 0;
  for (let i = 0; i < data.length; i += 4) {
    const l = getLuminance(data[i], data[i+1], data[i+2]);
    if (l < minL) minL = l;
    if (l > maxL) maxL = l;
  }
  const range = maxL - minL || 1;

  for (let y = 0; y < h; y++) {
    let line = '';
    const colorLine = colorMode ? [] : null;

    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      let lum = getLuminance(r, g, b);

      if (detail === 1)      lum = Math.round(lum / 32) * 32;
      else if (detail === 3) lum = ((lum - minL) / range) * 255;
      else                   lum = ((lum - minL * 0.5) / (range + minL * 0.5)) * 255;

      if (invert) lum = 255 - lum;
      lum = Math.max(0, Math.min(255, lum));

      const charIdx = Math.min(maxIdx, Math.floor((lum / 255) * (maxIdx + 0.99)));
      line += chars[charIdx];
      if (colorMode && colorLine) colorLine.push({ r, g, b });
    }
    lines.push(line);
    if (colorMode && colorLines) colorLines.push(colorLine);
  }
  return { lines, colorLines };
}

// ── HELPERS ────────────────────────────────────────────────────────────────────
function getLuminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function computeHistogram(data, w, h) {
  const buckets = [0, 0, 0, 0];
  const total   = w * h;
  for (let i = 0; i < data.length; i += 4) {
    const lum = getLuminance(data[i], data[i+1], data[i+2]);
    if      (lum < 64)  buckets[3]++;
    else if (lum < 128) buckets[2]++;
    else if (lum < 192) buckets[1]++;
    else                buckets[0]++;
  }
  return buckets.map(v => Math.round((v / total) * 100));
}

function generatePlaceholder(w = 42, h = 14) {
  const art = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    const cy = y / (h - 1);
    const density = Math.sin(cy * Math.PI) * 0.8;
    for (let x = 0; x < w; x++) {
      const cx = x / (w - 1);
      const d  = density * Math.sin(cx * Math.PI) + Math.random() * 0.2;
      if      (d > 0.7)  row += '█';
      else if (d > 0.55) row += '▓';
      else if (d > 0.4)  row += '▒';
      else if (d > 0.25) row += '░';
      else if (d > 0.1)  row += '·';
      else               row += ' ';
    }
    art.push(row);
  }
  return art.join('\n');
}
