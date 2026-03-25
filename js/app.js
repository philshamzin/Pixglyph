/**
 * PIXGLYPH // app.js
 */

const State = {
  image: null,
  style: 'matrix',
  width: 100,
  contrast: 10,
  brightness: 0,
  detail: 2,
  sharpness: 0,
  saturation: 0,
  edgeBoost: 0,
  charDensity: 3,
  invert: false,
  colorMode: true,
  result: null,
  rendered: false,
  galleryItems: [],
  _fullscreenActive: false,
};

document.addEventListener('DOMContentLoaded', () => {
  initPlaceholder();
  initUpload();
  initCanvasDropZone();
  initStylePicker();
  initSliders();
  initToggles();
  initRenderBtn();
  initExportBtns();
  initFullscreen();
  initCanvasMouseMove();
  initMatrixAnimation();
  initTheme();
  initZoom();
  initMobileMenu();
  loadFromUrl();
});

function initPlaceholder() {
  const el = document.getElementById('placeholder-art');
  if (el) el.textContent = generatePlaceholder(44, 10);
}

// ── UPLOAD (left panel zone) ──────────────────────────────────────────────────
function initUpload() {
  const zone = document.getElementById('upload-zone');
  const input = document.getElementById('file-input');

  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', e => { if (e.target.files[0]) loadFile(e.target.files[0]); });

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) loadFile(file);
  });

  document.addEventListener('paste', e => {
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'));
    if (item) loadFile(item.getAsFile());
  });
}

// ── CANVAS DROP ZONE (main area) ──────────────────────────────────────────────
function initCanvasDropZone() {
  const canvas = document.getElementById('ascii-canvas');
  const overlay = document.getElementById('canvas-drop-overlay');

  canvas.addEventListener('dragenter', e => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) overlay.classList.add('active');
  });
  canvas.addEventListener('dragover', e => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) overlay.classList.add('active');
  });
  canvas.addEventListener('dragleave', e => {
    // Only hide if leaving the canvas entirely
    if (!canvas.contains(e.relatedTarget)) overlay.classList.remove('active');
  });
  canvas.addEventListener('drop', e => {
    e.preventDefault();
    overlay.classList.remove('active');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) loadFile(file);
  });
}

function loadFile(file) {
  if (file.size > 10 * 1024 * 1024) { showToast('FILE TOO LARGE // MAX 10MB'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      State.image = img;
      document.getElementById('upload-filename').textContent = file.name;
      document.getElementById('upload-ascii-art').textContent = '▓▓▓ IMAGE_LOADED ▓▓▓\n' + file.name.slice(0, 22);
      autoRender();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ── STYLE PICKER ──────────────────────────────────────────────────────────────
function initStylePicker() {
  document.querySelectorAll('.style-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.style-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      State.style = item.dataset.style;
      document.getElementById('p-style').textContent = State.style.toUpperCase();
      document.getElementById('canvas-style-label').textContent = `OUTPUT_CANVAS // STYLE: ${State.style.toUpperCase()}`;
      if (State.image) autoRender();
    });
  });
}

// ── SLIDERS ───────────────────────────────────────────────────────────────────
function initSliders() {
  const sliders = [
    { id: 'sl-width',    out: 'sv-width',    key: 'width',       fmt: v => v },
    { id: 'sl-contrast', out: 'sv-contrast', key: 'contrast',    fmt: v => (v > 0 ? '+' : '') + v },
    { id: 'sl-bright',   out: 'sv-bright',   key: 'brightness',  fmt: v => (v > 0 ? '+' : '') + v },
    { id: 'sl-detail',   out: 'sv-detail',   key: 'detail',      fmt: v => ['', 'low', 'med', 'high'][v] },
    { id: 'sl-sharp',    out: 'sv-sharp',    key: 'sharpness',   fmt: v => v },
    { id: 'sl-sat',      out: 'sv-sat',      key: 'saturation',  fmt: v => (v > 0 ? '+' : '') + v },
    { id: 'sl-edge',     out: 'sv-edge',     key: 'edgeBoost',   fmt: v => v },
    { id: 'sl-dens',     out: 'sv-dens',     key: 'charDensity', fmt: v => v },
  ];
  sliders.forEach(({ id, out, key, fmt }) => {
    const el = document.getElementById(id);
    if (!el) return;
    const sv = document.getElementById(out);
    el.addEventListener('input', () => {
      State[key] = parseInt(el.value);
      if (sv) sv.textContent = fmt(el.value);
      if (State.image) autoRender();
    });
  });
}

// ── TOGGLES ───────────────────────────────────────────────────────────────────
function initToggles() {
  const invToggle = document.getElementById('toggle-inv');
  invToggle.addEventListener('click', () => {
    State.invert = !State.invert;
    invToggle.dataset.on = State.invert;
    invToggle.classList.toggle('toggle--on', State.invert);
    if (State.image) autoRender();
  });

  const colorToggle = document.getElementById('toggle-color');
  colorToggle.addEventListener('click', () => {
    State.colorMode = !State.colorMode;
    colorToggle.dataset.on = State.colorMode;
    colorToggle.classList.toggle('toggle--on', State.colorMode);
    document.getElementById('p-color').textContent = State.colorMode ? 'ON' : 'OFF';
    if (State.image) autoRender();
  });
}

// ── RENDER ─────────────────────────────────────────────────────────────────────
let renderDebounce = null;
function autoRender() {
  clearTimeout(renderDebounce);
  renderDebounce = setTimeout(() => doRender(), 120);
}

function initRenderBtn() {
  document.getElementById('render-btn').addEventListener('click', doRender);
}

function doRender() {
  if (!State.image) { showToast('NO IMAGE LOADED'); return; }

  const btn = document.getElementById('render-btn');
  const prog = document.getElementById('render-progress');
  btn.querySelector('.render-btn-text').textContent = '// RENDERING...';
  prog.style.width = '60%';

  requestAnimationFrame(() => {
    setTimeout(() => {
      try {
        const result = quantizeImage(State.image, {
          style:       State.style,
          width:       State.width,
          contrast:    State.contrast,
          brightness:  State.brightness,
          detail:      State.detail,
          sharpness:   State.sharpness,
          saturation:  State.saturation,
          edgeBoost:   State.edgeBoost,
          charDensity: State.charDensity,
          invert:      State.invert,
          colorMode:   State.colorMode,
        });

        State.result = result;
        State.rendered = true;
        renderOutput(result);
        updateParams(result);
        updateHistogram(result.histogram);
        prog.style.width = '100%';
        setTimeout(() => {
          prog.style.width = '0%';
          btn.querySelector('.render-btn-text').textContent = '// RENDER →';
        }, 400);
      } catch (e) {
        showToast('RENDER ERROR: ' + e.message);
        btn.querySelector('.render-btn-text').textContent = '// RENDER →';
        prog.style.width = '0%';
      }
    }, 10);
  });
}

// ── OUTPUT ─────────────────────────────────────────────────────────────────────
let lastOutputHTML = '';

function renderOutput(result) {
  const { lines, colorLines } = result;
  const output = document.getElementById('ascii-output');

  if (!State.colorMode || !colorLines) {
    output.textContent = lines.join('\n');
    lastOutputHTML = '';
    addToGallery(lines, State.style);
    return;
  }

  lastOutputHTML = buildColoredHTML(lines, colorLines);
  output.innerHTML = lastOutputHTML;
  addToGallery(lines, State.style);
}

function buildColoredHTML(lines, colorLines) {
  let html = '';
  lines.forEach((line, y) => {
    const cl = colorLines[y];
    if (!cl) { html += escHtml(line) + '\n'; return; }
    for (let x = 0; x < line.length; x++) {
      const ch = line[x];
      const cell = cl[x];
      if (!cell || ch === ' ') { html += ch; continue; }
      const { r, g, b } = cell;
      html += `<span style="color:rgb(${r},${g},${b})">${escHtml(ch)}</span>`;
    }
    html += '\n';
  });
  return html;
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function updateParams(result) {
  const { width, height, renderMs } = result;
  document.getElementById('p-w').textContent = width;
  document.getElementById('p-h').textContent = height;
  document.getElementById('p-total').textContent = (width * height).toLocaleString();
  document.getElementById('p-ms').textContent = renderMs + 'ms';
  document.getElementById('p-ratio').textContent = '1:' + (State.image ? (State.image.naturalWidth / width).toFixed(1) : '—');
  document.getElementById('canvas-size-label').textContent = `${width}×${height}`;
}

function updateHistogram(hist) {
  hist.forEach((val, i) => {
    const fill = document.getElementById('hf-' + i);
    const num  = document.getElementById('hn-' + i);
    if (fill) fill.style.width = val + '%';
    if (num)  num.textContent = val + '%';
  });
}

// ── GALLERY ────────────────────────────────────────────────────────────────────
function addToGallery(lines, style) {
  const id = Math.random().toString(36).substr(2, 3).toUpperCase();
  State.galleryItems.unshift({ lines, style, id });
  if (State.galleryItems.length > 8) State.galleryItems = State.galleryItems.slice(0, 8);
  renderGallery();
}

function renderGallery() {
  const grid = document.getElementById('gallery');
  grid.innerHTML = '';
  State.galleryItems.slice(0, 4).forEach(item => {
    const div = document.createElement('div');
    div.className = 'gallery-item';
    const ascii = document.createElement('div');
    ascii.className = 'gallery-ascii';
    const step = Math.max(1, Math.floor(item.lines.length / 6));
    ascii.textContent = item.lines.filter((_, i) => i % step === 0).slice(0, 6).map(l => l.slice(0, 16)).join('\n');
    const tag = document.createElement('div');
    tag.className = 'gallery-tag';
    tag.textContent = item.style + ' · #' + item.id;
    div.appendChild(ascii); div.appendChild(tag);
    div.addEventListener('click', () => {
      document.getElementById('ascii-output').textContent = item.lines.join('\n');
    });
    grid.appendChild(div);
  });
}

// ── EXPORT ─────────────────────────────────────────────────────────────────────
function initExportBtns() {
  document.querySelectorAll('.exp-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!State.result) { showToast('RENDER FIRST'); return; }
      const fmt = btn.dataset.fmt;
      const { lines, colorLines } = State.result;
      const ts = Date.now();

      switch (fmt) {
        case 'txt':
          downloadText(Exporters.txt(lines), `pixglyph_${State.style}_${ts}.txt`);
          showToast('EXPORT // TXT READY');
          break;
        case 'html':
          downloadText(Exporters.html(lines, colorLines, State.style), `pixglyph_${State.style}_${ts}.html`);
          showToast('EXPORT // HTML READY');
          break;
        case 'ansi':
          downloadText(Exporters.ansi(lines, colorLines, State.style), `pixglyph_${State.style}_${ts}.ansi`);
          showToast('EXPORT // ANSI READY');
          break;
        case 'svg':
          downloadText(Exporters.svg(lines, colorLines, State.style), `pixglyph_${State.style}_${ts}.svg`);
          showToast('EXPORT // SVG READY');
          break;
        case 'png':
          showToast('EXPORT // RENDERING PNG...');
          Exporters.pngFromDOM(
            document.getElementById('ascii-output'),
            State.result,
            State.style,
            State.colorMode,
            blob => {
              downloadBlob(blob, `pixglyph_${State.style}_${ts}.png`);
              showToast('EXPORT // PNG READY');
            }
          );
          break;
      }
    });
  });
}

// ── FULLSCREEN ─────────────────────────────────────────────────────────────────
function initFullscreen() {
  const overlay = document.getElementById('fullscreen-overlay');
  const content = document.getElementById('fullscreen-content');

  document.getElementById('fullscreen-btn').addEventListener('click', () => {
    if (!State.result) { showToast('RENDER FIRST'); return; }
    if (State.colorMode && lastOutputHTML) {
      content.innerHTML = lastOutputHTML;
    } else {
      content.textContent = State.result.lines.join('\n');
    }
    overlay.classList.add('active');
    State._fullscreenActive = true;
  });

  document.getElementById('fullscreen-close').addEventListener('click', () => {
    overlay.classList.remove('active');
    State._fullscreenActive = false;
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { overlay.classList.remove('active'); State._fullscreenActive = false; }
  });
}

// ── CURSOR COORDS ──────────────────────────────────────────────────────────────
function initCanvasMouseMove() {
  const canvas = document.getElementById('ascii-canvas');
  const posEl = document.getElementById('cursor-pos');
  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    const x = Math.round((e.clientX - r.left + canvas.scrollLeft) / 7.5);
    const y = Math.round((e.clientY - r.top + canvas.scrollTop) / 9.5);
    posEl.textContent = `X:${x} Y:${y}`;
  });
  canvas.addEventListener('mouseleave', () => { posEl.textContent = 'X:— Y:—'; });
}

// ── MATRIX ANIMATION ──────────────────────────────────────────────────────────
let animTick = 0;
function initMatrixAnimation() {
  const CLASSES = ['c0','c1','c2','c3','c4','c5','c6','c7'];
  function frame() {
    animTick++;
    if (animTick % 6 === 0 && State.style === 'matrix' && State.rendered) {
      animateContainer('#ascii-output', CLASSES, 0.015);
      if (State._fullscreenActive) animateContainer('#fullscreen-content', CLASSES, 0.015);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function animateContainer(selector, classes, prob) {
  document.querySelectorAll(selector + ' span').forEach(s => {
    if (Math.random() < prob) {
      s.style.color = '';
      s.className = classes[Math.floor(Math.random() * classes.length)];
    }
  });
}

// ── TOAST ──────────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// ── URL PARAMS ─────────────────────────────────────────────────────────────────
function loadFromUrl() {
  const p = new URLSearchParams(window.location.search);
  if (p.get('style')) {
    State.style = p.get('style');
    document.querySelectorAll('.style-item').forEach(item => {
      item.classList.toggle('active', item.dataset.style === State.style);
    });
  }
  const setSlider = (param, id, outId, fmt) => {
    if (!p.get(param)) return;
    State[param] = parseInt(p.get(param));
    const el = document.getElementById(id);
    const sv = document.getElementById(outId);
    if (el) el.value = State[param];
    if (sv) sv.textContent = fmt(State[param]);
  };
  setSlider('width',      'sl-width',    'sv-width',    v => v);
  setSlider('contrast',   'sl-contrast', 'sv-contrast', v => (v > 0 ? '+' : '') + v);
  setSlider('brightness', 'sl-bright',   'sv-bright',   v => (v > 0 ? '+' : '') + v);
  if (p.get('invert'))  { State.invert = p.get('invert') === '1'; document.getElementById('toggle-inv').classList.toggle('toggle--on', State.invert); }
  if (p.get('color'))   { State.colorMode = p.get('color') !== '0'; document.getElementById('toggle-color').classList.toggle('toggle--on', State.colorMode); }
}

// ── THEME TOGGLE ───────────────────────────────────────────────────────────────
function initTheme() {
  const btn = document.getElementById('theme-btn');
  if (!btn) return;
  // Restore saved preference
  if (localStorage.getItem('pg-theme') === 'light') {
    document.body.classList.add('light');
    btn.textContent = '◑';
  }
  btn.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light');
    btn.textContent = isLight ? '◑' : '◐';
    localStorage.setItem('pg-theme', isLight ? 'light' : 'dark');
  });
}

// ── ZOOM ───────────────────────────────────────────────────────────────────────
const ZOOM_STEPS = [5, 6, 7, 8, 9, 10, 12, 14, 16];
let zoomIdx = 2; // default = 7px

function initZoom() {
  const inBtn  = document.getElementById('zoom-in-btn');
  const outBtn = document.getElementById('zoom-out-btn');
  const label  = document.getElementById('zoom-label');
  if (!inBtn || !outBtn) return;

  function applyZoom() {
    const px = ZOOM_STEPS[zoomIdx];
    document.documentElement.style.setProperty('--ascii-zoom', px + 'px');
    const pct = Math.round((px / 7) * 100);
    if (label) label.textContent = pct + '%';
  }

  inBtn.addEventListener('click', () => {
    if (zoomIdx < ZOOM_STEPS.length - 1) { zoomIdx++; applyZoom(); }
  });
  outBtn.addEventListener('click', () => {
    if (zoomIdx > 0) { zoomIdx--; applyZoom(); }
  });

  // Ctrl+scroll on canvas
  document.getElementById('ascii-canvas').addEventListener('wheel', e => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    if (e.deltaY < 0 && zoomIdx < ZOOM_STEPS.length - 1) zoomIdx++;
    else if (e.deltaY > 0 && zoomIdx > 0) zoomIdx--;
    applyZoom();
  }, { passive: false });
}

// ── MOBILE MENU ────────────────────────────────────────────────────────────────
function initMobileMenu() {
  const menuBtn  = document.getElementById('mobile-menu-btn');
  const backdrop = document.getElementById('mobile-backdrop');
  const panel    = document.querySelector('.panel--left');
  if (!menuBtn || !backdrop || !panel) return;

  function openMenu() {
    panel.classList.add('mobile-open');
    backdrop.classList.add('active');
  }
  function closeMenu() {
    panel.classList.remove('mobile-open');
    backdrop.classList.remove('active');
  }

  menuBtn.addEventListener('click', () => {
    panel.classList.contains('mobile-open') ? closeMenu() : openMenu();
  });
  backdrop.addEventListener('click', closeMenu);

  // Close menu after render button tap on mobile
  document.getElementById('render-btn').addEventListener('click', () => {
    if (window.innerWidth <= 768) closeMenu();
  });
}
