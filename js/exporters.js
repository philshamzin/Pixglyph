/**
 * PIXGLYPH // exporters.js
 * Export ASCII art to TXT, SVG, PNG, HTML, ANSI
 */

const Exporters = {

  txt(lines) {
    return lines.join('\n');
  },

  html(lines, colorLines, style) {
    const styleColors = getStyleColors(style);
    let body = '';
    lines.forEach((line, y) => {
      const cl = colorLines ? colorLines[y] : null;
      let rowHtml = '';
      for (let x = 0; x < line.length; x++) {
        const ch = line[x] === ' ' ? '&nbsp;' : escHtml(line[x]);
        if (cl && cl[x]) {
          const { r, g, b } = cl[x];
          rowHtml += `<span style="color:rgb(${r},${g},${b})">${ch}</span>`;
        } else {
          const idx = Math.floor(x / line.length * (styleColors.length - 1));
          rowHtml += `<span style="color:${styleColors[idx]}">${ch}</span>`;
        }
      }
      body += rowHtml + '\n';
    });
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>PIXGLYPH export</title>
<style>
  body { background: #0c0c0a; margin: 20px; }
  pre { font-family: 'Space Mono', 'Courier New', monospace; font-size: 8px; line-height: 1.22; white-space: pre; }
</style>
</head>
<body><pre>${body}</pre></body>
</html>`;
  },

  ansi(lines, colorLines, style) {
    const styleColors = getStyleColors(style);
    let out = '';
    lines.forEach((line, y) => {
      const cl = colorLines ? colorLines[y] : null;
      for (let x = 0; x < line.length; x++) {
        const ch = line[x];
        if (cl && cl[x]) {
          const { r, g, b } = cl[x];
          out += `\x1b[38;2;${r};${g};${b}m${ch}`;
        } else {
          out += ch;
        }
      }
      out += '\x1b[0m\n';
    });
    return out;
  },

  svg(lines, colorLines, style) {
    const charW = 5.4;
    const charH = 9;
    const padding = 12;
    const svgW = lines[0].length * charW + padding * 2;
    const svgH = lines.length * charH + padding * 2;
    const styleColors = getStyleColors(style);

    let textEls = '';
    lines.forEach((line, y) => {
      const cl = colorLines ? colorLines[y] : null;
      let x = padding;
      const baseY = padding + (y + 1) * charH - 2;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === ' ') { x += charW; continue; }
        let color;
        if (cl && cl[i]) {
          const { r, g, b } = cl[i];
          color = `rgb(${r},${g},${b})`;
        } else {
          const idx = Math.min(styleColors.length - 1, Math.floor(i / line.length * styleColors.length));
          color = styleColors[idx];
        }
        textEls += `<text x="${x.toFixed(1)}" y="${baseY}" fill="${color}">${escSvg(ch)}</text>`;
        x += charW;
      }
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">
<rect width="100%" height="100%" fill="#0c0c0a"/>
<style>text{font-family:'Space Mono','Courier New',monospace;font-size:8px;}</style>
${textEls}
</svg>`;
  },

  // PNG: matches exactly what's on screen (font-size:7px, line-height:1.22, Space Mono)
  pngFromDOM(domEl, result, style, colorMode, callback) {
    const { lines, colorLines } = result;
    if (!lines || lines.length === 0) return;

    // Must match CSS exactly:
    // .ascii-output { font-size: 7px; line-height: 1.22; font-family: Space Mono }
    // Space Mono is a fixed-width font: at 7px, charW ≈ 4.2px (monospace = 0.6 * em)
    const FONT_SIZE = 7;
    const LINE_H = FONT_SIZE * 1.22;   // 8.54px
    const CHAR_W = FONT_SIZE * 0.602;  // 4.214px — Space Mono exact ratio
    const PADDING = 12;
    const SCALE = 3; // 3x for crisp output

    const cols = lines[0].length;
    const rows = lines.length;
    const canvasW = Math.ceil(cols * CHAR_W + PADDING * 2) * SCALE;
    const canvasH = Math.ceil(rows * LINE_H + PADDING * 2) * SCALE;

    const c = document.createElement('canvas');
    c.width = canvasW;
    c.height = canvasH;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#0c0c0a';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Match browser rendering as closely as possible
    ctx.font = `${FONT_SIZE * SCALE}px 'Space Mono', 'Courier New', monospace`;
    ctx.textBaseline = 'top';

    lines.forEach((line, y) => {
      const cl = (colorMode && colorLines) ? colorLines[y] : null;
      for (let x = 0; x < line.length; x++) {
        const ch = line[x];
        if (ch === ' ') continue;

        if (cl && cl[x]) {
          const { r, g, b } = cl[x];
          ctx.fillStyle = `rgb(${r},${g},${b})`;
        } else {
          ctx.fillStyle = '#b8b8a4';
        }

        const px = (PADDING + x * CHAR_W) * SCALE;
        const py = (PADDING + y * LINE_H) * SCALE;
        ctx.fillText(ch, px, py);
      }
    });

    c.toBlob(blob => callback(blob), 'image/png');
  },
};

function getStyleColors(style) {
  const palettes = {
    matrix:    ['#1a2e1a', '#2d4d35', '#3a6a3a', '#5aaa5a', '#6dbd7a', '#9ae0a0'],
    braille:   ['#1a1a2e', '#2a2a5a', '#4a4aaa', '#7a7add', '#bf5af2', '#d890f8'],
    cyberpunk: ['#001a2a', '#003a5a', '#005a8a', '#00aadd', '#00d4ff', '#80e8ff'],
    retro:     ['#1a1200', '#3a2800', '#6a4800', '#aa7800', '#ffb000', '#ffcc44'],
    blockart:  ['#1a1a18', '#3a3a35', '#5a5a55', '#8a8a80', '#b8b8a4', '#e0e0cc'],
    geometric: ['#1a1a00', '#3a3a00', '#6a6a00', '#aaaa00', '#dddd00', '#ffff44'],
  };
  return palettes[style] || palettes.matrix;
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function escSvg(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function downloadText(text, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
