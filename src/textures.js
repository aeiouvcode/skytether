// Procedural canvas textures. No external assets.
import * as THREE from 'three';

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, renderer, repeat = true, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
function shade(hex, f) {
  const c = new THREE.Color(hex); c.multiplyScalar(f);
  return '#' + c.getHexString();
}

// Facade tile covers BAYS x FLOORS windows. Size 512 => 128px per bay/floor.
export const BAYS = 4, FLOORS = 4, BAY_W = 3.4, FLOOR_H = 3.6;

function masonry(renderer, seed, base, mortar, frame, glassA, glassB, brick) {
  const S = 512, cell = S / BAYS, R = rng(seed);
  const [c, g] = cv(S, S);
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  // wall grain
  for (let i = 0; i < 9000; i++) {
    const x = R() * S, y = R() * S, f = 0.85 + R() * 0.3;
    g.fillStyle = shade(base, f); g.globalAlpha = 0.35; g.fillRect(x, y, 2, 2);
  }
  g.globalAlpha = 1;
  if (brick) {
    g.strokeStyle = mortar; g.globalAlpha = 0.45; g.lineWidth = 1;
    const bh = 5;
    for (let y = 0, r = 0; y < S; y += bh, r++) {
      g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(S, y + 0.5); g.stroke();
      for (let x = (r % 2) * 6; x < S; x += 12) { g.beginPath(); g.moveTo(x + 0.5, y); g.lineTo(x + 0.5, y + bh); g.stroke(); }
    }
    g.globalAlpha = 1;
    for (let i = 0; i < 700; i++) { g.fillStyle = shade(base, 0.7 + R() * 0.5); g.globalAlpha = 0.5; g.fillRect((R() * S / 12 | 0) * 12, (R() * S / 5 | 0) * 5, 11, 4); }
    g.globalAlpha = 1;
  } else {
    // stone courses
    g.strokeStyle = mortar; g.globalAlpha = 0.35;
    for (let y = 0; y < S; y += cell / 4) { g.beginPath(); g.moveTo(0, y + .5); g.lineTo(S, y + .5); g.stroke(); }
    g.globalAlpha = 1;
  }
  for (let fy = 0; fy < FLOORS; fy++) for (let bx = 0; bx < BAYS; bx++) {
    const x0 = bx * cell, y0 = fy * cell;
    const ww = cell * 0.5, wh = cell * 0.56, wx = x0 + (cell - ww) / 2, wy = y0 + cell * 0.2;
    // lintel + sill
    g.fillStyle = shade(frame, 0.95); g.fillRect(wx - 5, wy - 7, ww + 10, 6);
    g.fillStyle = shade(frame, 0.8); g.fillRect(wx - 4, wy + wh, ww + 8, 5);
    // frame
    g.fillStyle = frame; g.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
    // glass with sky gradient + random blinds/lit
    const gr = g.createLinearGradient(wx, wy, wx + ww * 0.3, wy + wh);
    const k = R();
    gr.addColorStop(0, k < 0.5 ? glassA : glassB); gr.addColorStop(1, shade(glassB, 0.55 + R() * 0.3));
    g.fillStyle = gr; g.fillRect(wx, wy, ww, wh);
    if (R() < 0.35) { g.fillStyle = 'rgba(230,225,210,0.55)'; g.fillRect(wx, wy, ww, wh * (0.2 + R() * 0.6)); }
    if (R() < 0.18) { g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(wx, wy, ww * 0.35, wh); }
    // mullion
    g.fillStyle = frame; g.fillRect(wx + ww / 2 - 1.5, wy, 3, wh); g.fillRect(wx, wy + wh * 0.42, ww, 3);
    // AC unit occasionally
    if (R() < 0.06) { g.fillStyle = '#cfcfc8'; g.fillRect(wx + 4, wy + wh - 16, 22, 14); g.fillStyle = '#8a8a86'; g.fillRect(wx + 6, wy + wh - 13, 18, 2); }
  }
  // vertical piers subtle shading
  for (let bx = 0; bx <= BAYS; bx++) { g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(bx * cell - 3, 0, 6, S); }
  return tex(c, renderer);
}

function curtain(renderer, seed, glassTop, glassBot, mull, spandrel) {
  const S = 512, cell = S / BAYS, R = rng(seed);
  const [c, g] = cv(S, S);
  for (let fy = 0; fy < FLOORS; fy++) for (let bx = 0; bx < BAYS; bx++) {
    const x0 = bx * cell, y0 = fy * cell;
    const gr = g.createLinearGradient(x0, y0, x0 + cell * 0.6, y0 + cell);
    const f = 0.8 + R() * 0.35;
    gr.addColorStop(0, shade(glassTop, f)); gr.addColorStop(1, shade(glassBot, f));
    g.fillStyle = gr; g.fillRect(x0, y0, cell, cell);
    if (R() < 0.25) { g.fillStyle = 'rgba(210,220,225,0.25)'; g.fillRect(x0, y0 + cell * 0.1, cell, cell * 0.5 * R()); }
    g.fillStyle = spandrel; g.fillRect(x0, y0 + cell * 0.8, cell, cell * 0.2);
  }
  g.fillStyle = mull;
  for (let i = 0; i <= BAYS * 2; i++) g.fillRect(i * cell / 2 - 1.5, 0, 3, S);
  for (let i = 0; i <= FLOORS; i++) g.fillRect(0, i * cell - 2, S, 4);
  return tex(c, renderer);
}

export function makeTextures(renderer) {
  const T = {};
  T.brickRed = masonry(renderer, 11, '#8e4032', '#d8c8b8', '#e9e2d4', '#7d93a8', '#34414f', true);
  T.brickBrown = masonry(renderer, 12, '#6d4a36', '#cbbba5', '#d9cdb7', '#8aa0b4', '#2c3642', true);
  T.brickDark = masonry(renderer, 17, '#5b2e28', '#bba99a', '#2b2b2b', '#6f8499', '#232b33', true);
  T.limeCream = masonry(renderer, 13, '#d6cbb3', '#a89c86', '#4a4640', '#9fb3c4', '#3b4652', false);
  T.limeGrey = masonry(renderer, 14, '#b9b7b0', '#8c8a84', '#3b3b3b', '#a7bccb', '#34404c', false);
  T.limeWhite = masonry(renderer, 18, '#e6e2d8', '#b3ada0', '#6b6b66', '#aac0d0', '#3d4a58', false);
  T.glassBlue = curtain(renderer, 15, '#a9c6de', '#3d5f80', '#9aa6ae', '#2a3a4a');
  T.glassTeal = curtain(renderer, 16, '#9cc4c4', '#2f5557', '#b8c0bf', '#243536');
  T.glassDark = curtain(renderer, 19, '#6f8397', '#1d2833', '#4a525a', '#151c22');

  // Shopfront band: 4 stores across 24m, 5m tall.
  {
    const [c, g] = cv(1024, 256), R = rng(21);
    const cols = ['#1f6f5a', '#9b2d2d', '#253f7a', '#b8781c', '#4b2f5c', '#2a2a2a', '#6b8e23', '#c0392b'];
    g.fillStyle = '#3a3a3a'; g.fillRect(0, 0, 1024, 256);
    for (let i = 0; i < 4; i++) {
      const x = i * 256, col = cols[(R() * cols.length) | 0];
      g.fillStyle = '#d9d4c7'; g.fillRect(x, 0, 256, 256);
      g.fillStyle = col; g.fillRect(x + 6, 30, 244, 42); // sign board
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (let k = 0; k < 5; k++) g.fillRect(x + 40 + k * 30, 44, 20, 12);
      // awning stripes
      if (R() < 0.6) { for (let s = 0; s < 12; s++) { g.fillStyle = s % 2 ? col : '#f1efe8'; g.fillRect(x + 6 + s * 20.3, 76, 20.3, 22); } }
      // display glass
      const gr = g.createLinearGradient(x, 100, x, 250); gr.addColorStop(0, '#5f7a8d'); gr.addColorStop(1, '#1f2a33');
      g.fillStyle = gr; g.fillRect(x + 12, 104, 150, 140);
      g.fillStyle = 'rgba(255,240,200,0.25)'; g.fillRect(x + 20, 180, 130, 60);
      g.fillStyle = '#222'; g.fillRect(x + 172, 104, 70, 150); // door
      g.fillStyle = '#6d8596'; g.fillRect(x + 180, 112, 54, 100);
      g.fillStyle = '#555'; g.fillRect(x, 0, 6, 256); g.fillRect(x + 162, 104, 10, 152);
    }
    g.fillStyle = '#8a8478'; g.fillRect(0, 0, 1024, 26);
    T.shop = tex(c, renderer);
  }
  // Roof: gravel / tar
  {
    const [c, g] = cv(256, 256), R = rng(31);
    g.fillStyle = '#8d8b86'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 6000; i++) { g.fillStyle = shade('#8d8b86', 0.7 + R() * 0.5); g.fillRect(R() * 256, R() * 256, 2, 2); }
    g.strokeStyle = 'rgba(40,40,40,0.25)'; for (let i = 0; i < 256; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); }
    T.roof = tex(c, renderer);
  }
  return T;
}

// Ground cell texture: one 100m x 50m tile (avenue x[0,20), street z[0,14), block with sidewalks)
export const CELL_X = 100, CELL_Z = 50, AVE_W = 20, ST_W = 14, WALK = 4;
export function makeGroundTexture(renderer) {
  const PPM = 10, W = CELL_X * PPM, H = CELL_Z * PPM; // 1000 x 500
  const [c, g] = cv(1024, 512), R = rng(41);
  g.scale(1024 / W, 512 / H);
  // asphalt everywhere
  g.fillStyle = '#4a4b4e'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 25000; i++) { g.fillStyle = shade('#4a4b4e', 0.75 + R() * 0.5); g.fillRect(R() * W, R() * H, 2, 2); }
  // patches
  for (let i = 0; i < 20; i++) { g.fillStyle = 'rgba(30,30,32,0.25)'; g.fillRect(R() * W, R() * H, 30 + R() * 80, 20 + R() * 40); }
  // sidewalk block (block area)
  const bx0 = AVE_W * PPM, bz0 = ST_W * PPM;
  g.fillStyle = '#a9a69e'; g.fillRect(bx0, bz0, W - bx0, H - bz0);
  for (let i = 0; i < 8000; i++) { g.fillStyle = shade('#a9a69e', 0.85 + R() * 0.25); g.fillRect(bx0 + R() * (W - bx0), bz0 + R() * (H - bz0), 2, 2); }
  g.strokeStyle = 'rgba(60,60,60,0.35)'; g.lineWidth = 1.5;
  for (let x = bx0; x < W; x += 15) { g.beginPath(); g.moveTo(x, bz0); g.lineTo(x, H); g.stroke(); }
  for (let z = bz0; z < H; z += 15) { g.beginPath(); g.moveTo(bx0, z); g.lineTo(W, z); g.stroke(); }
  // curb
  g.strokeStyle = '#d7d3c8'; g.lineWidth = 5; g.strokeRect(bx0 + 2, bz0 + 2, W - bx0 - 4, H - bz0 - 4);
  // avenue lane markings (dashed white) at x=5,15 and double yellow at 10
  g.fillStyle = '#e9c233'; g.fillRect(10 * PPM - 4, 0, 3, H); g.fillRect(10 * PPM + 2, 0, 3, H);
  g.fillStyle = '#e8e8e2';
  for (const lx of [5, 15]) for (let z = 0; z < H; z += 60) g.fillRect(lx * PPM - 2, z, 4, 30);
  // street center dashed
  for (let x = bx0; x < W; x += 60) g.fillRect(x, 7 * PPM - 2, 30, 4);
  // crosswalks: across avenue near street edges, across street near avenue edges
  g.fillStyle = '#ecebe6';
  for (let x = 4; x < AVE_W * PPM - 4; x += 18) { g.fillRect(x, 2, 10, 32); g.fillRect(x, bz0 - 34, 10, 32); }
  for (let z = 4; z < bz0 - 4; z += 18) { g.fillRect(bx0 + 2, z, 32, 10); g.fillRect(W - 34, z, 32, 10); }
  // stop lines
  g.fillRect(0, 38, AVE_W * PPM, 5); g.fillRect(0, bz0 - 42, AVE_W * PPM, 5);
  // intersection clean-up: box
  const t = tex(c, renderer);
  return t;
}

export function makeGrassTexture(renderer) {
  const [c, g] = cv(512, 512), R = rng(51);
  g.fillStyle = '#5f8a3a'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 30000; i++) { g.fillStyle = shade('#5f8a3a', 0.7 + R() * 0.6); g.fillRect(R() * 512, R() * 512, 2, 3); }
  for (let i = 0; i < 400; i++) { g.fillStyle = ['#c8742a', '#d9a42b', '#a8401f'][(R() * 3) | 0]; g.globalAlpha = 0.6; g.fillRect(R() * 512, R() * 512, 3, 2); }
  g.globalAlpha = 1;
  return tex(c, renderer);
}
