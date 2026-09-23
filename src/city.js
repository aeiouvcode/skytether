import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BAYS, FLOORS, BAY_W, FLOOR_H, CELL_X, CELL_Z, AVE_W, ST_W, WALK, makeGroundTexture, makeGrassTexture } from './textures.js';

export const NX = 8, NZ = 26;
export const CITY_W = NX * CELL_X + AVE_W, CITY_D = NZ * CELL_Z + ST_W;
export const PARK = { i: 3, j0: 18, j1: 22, x0: 3 * CELL_X + AVE_W, x1: 4 * CELL_X, z0: 18 * CELL_Z + ST_W, z1: 23 * CELL_Z };

export const DISTRICTS = [
  { name: 'HARBOR POINT', j0: 0, j1: 5, pal: ['limeGrey', 'limeCream', 'brickBrown', 'glassDark', 'limeWhite'], fl: [6, 22], tall: 0.12 },
  { name: 'FOUNDRY ROW', j0: 6, j1: 11, pal: ['brickRed', 'brickBrown', 'brickDark', 'brickRed', 'limeCream'], fl: [5, 14], tall: 0.03 },
  { name: 'SPIRE HEIGHTS', j0: 12, j1: 17, pal: ['glassBlue', 'limeGrey', 'limeWhite', 'brickBrown', 'glassTeal', 'limeCream', 'brickRed'], fl: [14, 40], tall: 0.35 },
  { name: 'GREENLINE', j0: 18, j1: 22, pal: ['limeCream', 'brickRed', 'limeWhite', 'glassBlue', 'brickBrown'], fl: [8, 26], tall: 0.1 },
  { name: 'NORTHGATE', j0: 23, j1: 25, pal: ['brickBrown', 'brickDark', 'brickRed', 'limeCream'], fl: [4, 10], tall: 0.0 },
];
export function districtAt(z) {
  const j = Math.max(0, Math.min(NZ - 1, Math.floor(z / CELL_Z)));
  return DISTRICTS.find(d => j >= d.j0 && j <= d.j1);
}

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

class GeoBuilder {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; this.vc = 0; }
  quad(a, b, c, d, n, uvs, col) { // a,b,c,d CCW seen from outside
    for (const v of [a, b, c, d]) this.p.push(v[0], v[1], v[2]);
    for (let k = 0; k < 4; k++) this.n.push(n[0], n[1], n[2]);
    for (const t of uvs) this.uv.push(t[0], t[1]);
    const cc = col || [1, 1, 1];
    for (let k = 0; k < 4; k++) this.c.push(cc[0], cc[1], cc[2]);
    const o = this.vc; this.i.push(o, o + 1, o + 2, o, o + 2, o + 3); this.vc += 4;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i); g.computeBoundingSphere(); return g;
  }
}

// side walls of a box with world-scaled UVs; uw/vh = world meters per texture repeat; u offset randomizes
function walls(B, x0, x1, y0, y1, z0, z1, uw, vh, uo = 0, vo = 0, col) {
  const U = (d) => d / uw + uo, V = (h) => h / vh + vo;
  const wx = x1 - x0, wz = z1 - z0;
  // south (z0, normal -z): from x1 to x0 when looking from outside
  B.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [[U(0), V(y0)], [U(wx), V(y0)], [U(wx), V(y1)], [U(0), V(y1)]], col);
  B.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [[U(0), V(y0)], [U(wx), V(y0)], [U(wx), V(y1)], [U(0), V(y1)]], col);
  B.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [[U(0), V(y0)], [U(wz), V(y0)], [U(wz), V(y1)], [U(0), V(y1)]], col);
  B.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [[U(0), V(y0)], [U(wz), V(y0)], [U(wz), V(y1)], [U(0), V(y1)]], col);
}
function top(B, x0, x1, y, z0, z1, s = 8, col) {
  B.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], [[x0 / s, z1 / s], [x1 / s, z1 / s], [x1 / s, z0 / s], [x0 / s, z0 / s]], col);
}
function boxAll(B, x0, x1, y0, y1, z0, z1, col) {
  walls(B, x0, x1, y0, y1, z0, z1, 4, 4, 0, 0, col); top(B, x0, x1, y1, z0, z1, 4, col);
}

function colored(geo, hex) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) { a[k * 3] = c.r; a[k * 3 + 1] = c.g; a[k * 3 + 2] = c.b; }
  geo = geo.index ? geo.toNonIndexed() : geo;
  const m = new Float32Array(geo.attributes.position.count * 3);
  for (let k = 0; k < geo.attributes.position.count; k++) { m[k * 3] = c.r; m[k * 3 + 1] = c.g; m[k * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(m, 3));
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  return geo;
}
function tr(geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  geo.applyMatrix4(m); return geo;
}


// Static instances split into spatial tiles so frustum culling (main + shadow pass) drops far tiles.
export function tiledInstances(scene, geo, mat, items, opts = {}) {
  const TILE = 250, groups = new Map();
  for (const it of items) { const e = it.m.elements; const k = Math.floor(e[12] / TILE) * 1000 + Math.floor(e[14] / TILE); let g = groups.get(k); if (!g) groups.set(k, g = []); g.push(it); }
  const meshes = [];
  for (const list of groups.values()) {
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, k) => { m.setMatrixAt(k, it.m); if (it.c) m.setColorAt(k, it.c); });
    m.castShadow = opts.cast !== false; m.receiveShadow = !!opts.receive;
    m.computeBoundingSphere(); m.frustumCulled = true; m.matrixAutoUpdate = false;
    scene.add(m); meshes.push(m);
  }
  return meshes;
}

export class City {
  constructor(scene, T, renderer, quality) {
    this.W = CITY_W; this.D = CITY_D; this.scene = scene; this.boxes = []; this.grid = new Map(); this.GS = 25;
    this.blocks = []; this.lots = [];
    const R = rng(1234);
    const builders = {}; const B = (k) => builders[k] || (builders[k] = new GeoBuilder());
    const trim = B('trim');
    const roofProps = { water: [], ac: [], ant: [], vent: [] };

    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
      const bx0 = i * CELL_X + AVE_W, bx1 = (i + 1) * CELL_X, bz0 = j * CELL_Z + ST_W, bz1 = (j + 1) * CELL_Z;
      const park = i === PARK.i && j >= PARK.j0 && j <= PARK.j1;
      this.blocks.push({ i, j, x0: bx0, x1: bx1, z0: bz0, z1: bz1, park });
      if (park) continue;
      const D = DISTRICTS.find(d => j >= d.j0 && j <= d.j1);
      const x0 = bx0 + WALK, x1 = bx1 - WALK, z0 = bz0 + WALK, z1 = bz1 - WALK;
      // split along x
      let x = x0;
      while (x < x1 - 0.1) {
        const tall = R() < D.tall;
        let w = tall ? 22 + R() * 16 : 9 + R() * 14;
        if (x1 - x - w < 8) w = x1 - x;
        const xa = x, xb = Math.min(x1, x + w); x = xb;
        const split = !tall && R() < 0.45;
        const zs = split ? [[z0, (z0 + z1) / 2], [(z0 + z1) / 2, z1]] : [[z0, z1]];
        for (const [za, zb] of zs) {
          let floors = Math.round(D.fl[0] + Math.pow(R(), 1.6) * (D.fl[1] - D.fl[0]));
          if (tall) floors = Math.round(D.fl[1] * (1.1 + R() * 0.9));
          // taller near center of spire district
          let style = D.pal[(R() * D.pal.length) | 0];
          if (tall && R() < 0.6) style = ['glassBlue', 'glassTeal', 'glassDark'][(R() * 3) | 0];
          const glass = style.startsWith('glass');
          const h = floors * FLOOR_H + 1.2;
          this.addBuilding(B, trim, roofProps, R, xa + 0.15, xb - 0.15, za + 0.15, zb - 0.15, h, style, glass, tall);
        }
      }
    }
    // materials
    const mats = {};
    for (const k of Object.keys(builders)) {
      if (k === 'trim') mats[k] = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
      else if (k === 'roof') mats[k] = new THREE.MeshStandardMaterial({ map: T.roof, roughness: 0.95 });
      else if (k === 'shop') mats[k] = new THREE.MeshStandardMaterial({ map: T.shop, roughness: 0.6 });
      else if (k.startsWith('glass')) mats[k] = new THREE.MeshStandardMaterial({ map: T[k], roughness: 0.12, metalness: 0.55, envMapIntensity: 1.2 });
      else mats[k] = new THREE.MeshStandardMaterial({ map: T[k], roughness: 0.88 });
    }
    this.materials = mats;
    for (const [k, b] of Object.entries(builders)) {
      const mesh = new THREE.Mesh(b.build(), mats[k]);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
      scene.add(mesh);
    }
    this.buildRoofProps(roofProps);
    this.buildGround(renderer);
    this.buildPark(R);
    this.buildTrees(R, quality);
    this.buildStreetFurniture(R);
  }

  addBox(x0, x1, z0, z1, y1, glass) {
    const id = this.boxes.length; this.boxes.push({ x0, x1, z0, z1, y1, glass });
    const G = this.GS;
    for (let gx = Math.floor(x0 / G); gx <= Math.floor(x1 / G); gx++) for (let gz = Math.floor(z0 / G); gz <= Math.floor(z1 / G); gz++) {
      const k = gx * 10000 + gz; let a = this.grid.get(k); if (!a) this.grid.set(k, a = []); a.push(id);
    }
  }

  addBuilding(B, trim, props, R, x0, x1, z0, z1, h, style, glass, tall) {
    const tb = B(style);
    const uw = BAY_W * BAYS, vh = FLOOR_H * FLOORS, uo = (R() * 4 | 0) / 4, vo = (R() * 4 | 0) / 4;
    const baseH = 4.6;
    const setback = h > 70 && R() < 0.8;
    const h1 = setback ? h * (0.55 + R() * 0.15) : h;
    walls(tb, x0, x1, baseH, h1, z0, z1, uw, vh, uo, vo);
    // shopfront band
    const sb = B('shop'), so = R() * 4 | 0;
    walls(sb, x0 - 0.05, x1 + 0.05, 0, baseH, z0 - 0.05, z1 + 0.05, 24, 5.0, so / 4, 0);
    // band ledge above shops
    const trimCol = glass ? [0.55, 0.58, 0.6] : (style.startsWith('brick') ? [0.78, 0.72, 0.62] : [0.72, 0.7, 0.66]);
    walls(trim, x0 - 0.25, x1 + 0.25, baseH - 0.1, baseH + 0.35, z0 - 0.25, z1 + 0.25, 4, 4, 0, 0, trimCol);
    top(trim, x0 - 0.25, x1 + 0.25, baseH + 0.35, z0 - 0.25, z1 + 0.25, 4, trimCol);
    // cornice / parapet at h1
    if (!glass) {
      walls(trim, x0 - 0.45, x1 + 0.45, h1 - 0.9, h1 - 0.3, z0 - 0.45, z1 + 0.45, 4, 4, 0, 0, trimCol);
      top(trim, x0 - 0.45, x1 + 0.45, h1 - 0.3, z0 - 0.45, z1 + 0.45, 4, trimCol);
    }
    walls(trim, x0, x1, h1, h1 + 0.8, z0, z1, 4, 4, 0, 0, [0.5, 0.49, 0.47]);
    top(B('roof'), x0, x1, h1 + 0.02, z0, z1, 8);
    this.addBox(x0 - 0.05, x1 + 0.05, z0 - 0.05, z1 + 0.05, h1, glass);
    let rx0 = x0, rx1 = x1, rz0 = z0, rz1 = z1, rtop = h1;
    if (setback) {
      const ins = Math.min((x1 - x0), (z1 - z0)) * 0.18 + 1;
      rx0 = x0 + ins; rx1 = x1 - ins; rz0 = z0 + ins; rz1 = z1 - ins;
      walls(tb, rx0, rx1, h1, h, rz0, rz1, uw, vh, uo, vo);
      walls(trim, rx0, rx1, h, h + 1.2, rz0, rz1, 4, 4, 0, 0, [0.45, 0.47, 0.5]);
      top(B('roof'), rx0, rx1, h + 0.02, rz0, rz1, 8);
      this.addBox(rx0, rx1, rz0, rz1, h, glass);
      rtop = h;
      if (R() < 0.6) props.ant.push([(rx0 + rx1) / 2, h, (rz0 + rz1) / 2, 8 + R() * 18]);
    }
    // roof props on the main (or top) roof
    const cx = (rx0 + rx1) / 2, cz = (rz0 + rz1) / 2, w = rx1 - rx0, d = rz1 - rz0;
    if (!glass && R() < 0.55 && w > 7 && d > 7) props.water.push([rx0 + 2.5 + R() * (w - 5), rtop, rz0 + 2.5 + R() * (d - 5), 0.8 + R() * 0.4]);
    const nac = (w * d / 90) | 0;
    for (let k = 0; k < Math.min(nac, 2); k++) props.ac.push([rx0 + 1.5 + R() * (w - 3), rtop, rz0 + 1.5 + R() * (d - 3), R() * Math.PI]);
    if (R() < 0.7) props.vent.push([rx0 + 1 + R() * (w - 2), rtop, rz0 + 1 + R() * (d - 2)]);
    this.lots.push({ x0, x1, z0, z1, h: rtop });
  }

  buildRoofProps(P) {
    const scene = this.scene;
    const mk = (geo, list, fn) => {
      if (!list.length) return;
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
      const q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
      tiledInstances(scene, geo, mat, list.map(a => { fn(a, p, q, s); return { m: new THREE.Matrix4().compose(p, q, s) }; }), { receive: true });
    };
    // water tower: 4 legs + platform + wooden tank + conical roof
    const parts = [];
    for (const [lx, lz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) parts.push(colored(tr(new THREE.CylinderGeometry(0.12, 0.12, 4, 5), lx * 1.3, 2, lz * 1.3), 0x3a3633));
    parts.push(colored(tr(new THREE.CylinderGeometry(2.1, 2.1, 0.3, 8), 0, 4.1, 0), 0x4a4440));
    parts.push(colored(tr(new THREE.CylinderGeometry(1.9, 2.0, 4.2, 8), 0, 6.3, 0), 0x7a5a3e));
    parts.push(colored(tr(new THREE.CylinderGeometry(1.95, 1.95, 0.15, 8), 0, 5.3, 0), 0x2a2522));
    parts.push(colored(tr(new THREE.CylinderGeometry(1.95, 1.95, 0.15, 8), 0, 7.2, 0), 0x2a2522));
    parts.push(colored(tr(new THREE.ConeGeometry(2.15, 1.6, 8), 0, 9.2, 0), 0x3c3a38));
    mk(mergeGeometries(parts), P.water, (a, p, q, s) => { p.set(a[0], a[1], a[2]); q.identity(); s.setScalar(a[3]); });
    const ac = mergeGeometries([colored(tr(new THREE.BoxGeometry(2.4, 1.3, 1.6), 0, 0.65, 0), 0xc9c7c0), colored(tr(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 6), 0.5, 1.33, 0), 0x55585a), colored(tr(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 6), -0.6, 1.33, 0), 0x55585a)]);
    mk(ac, P.ac, (a, p, q, s) => { p.set(a[0], a[1], a[2]); q.setFromEuler(new THREE.Euler(0, a[3], 0)); s.setScalar(1); });
    const ant = mergeGeometries([colored(tr(new THREE.CylinderGeometry(0.08, 0.25, 1, 6), 0, 0.5, 0), 0xb0b3b5), colored(tr(new THREE.SphereGeometry(0.25, 6, 4), 0, 1.02, 0), 0xd23b2b)]);
    mk(ant, P.ant, (a, p, q, s) => { p.set(a[0], a[1], a[2]); q.identity(); s.set(1, a[3], 1); });
    const vent = mergeGeometries([colored(tr(new THREE.BoxGeometry(1.4, 1.8, 1.4), 0, 0.9, 0), 0x77736d), colored(tr(new THREE.BoxGeometry(1.8, 0.2, 1.8), 0, 1.9, 0), 0x5a5652)]);
    mk(vent, P.vent, (a, p, q, s) => { p.set(a[0], a[1], a[2]); q.identity(); s.setScalar(1); });
  }

  buildGround(renderer) {
    const t = makeGroundTexture(renderer);
    t.repeat.set(CITY_W / CELL_X, CITY_D / CELL_Z);
    // Align so tile origin at world 0: plane from 0..CITY_W, 0..CITY_D; set UV manually
    const g = new THREE.PlaneGeometry(CITY_W, CITY_D); g.rotateX(-Math.PI / 2); g.translate(CITY_W / 2, 0, CITY_D / 2);
    const uv = g.attributes.uv, pos = g.attributes.position;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, pos.getX(k) / CELL_X, -pos.getZ(k) / CELL_Z);
    t.repeat.set(1, 1); t.flipY = true;
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: t, roughness: 0.92 }));
    m.receiveShadow = true; this.scene.add(m);
    this.groundMat = m.material;
    // promenade edge + water
    const edge = new THREE.Mesh(new THREE.BoxGeometry(CITY_W + 30, 1, CITY_D + 30), new THREE.MeshStandardMaterial({ color: 0x8f8a80, roughness: 0.9 }));
    edge.position.set(CITY_W / 2, -0.52, CITY_D / 2); edge.receiveShadow = true; this.scene.add(edge);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshStandardMaterial({ color: 0x3d6275, roughness: 0.18, metalness: 0.4 }));
    water.rotation.x = -Math.PI / 2; water.position.set(CITY_W / 2, -2.5, CITY_D / 2); this.scene.add(water);
    this.water = water;
    // distant skyline silhouettes across the river (for depth)
    const R = rng(77), parts = [];
    for (let k = 0; k < 160; k++) {
      const side = k % 4; let x, z;
      const w = 20 + R() * 40, h = 20 + R() * 120, d = 20 + R() * 40;
      if (side === 0) { x = -500 - R() * 300; z = R() * CITY_D; }
      else if (side === 1) { x = CITY_W + 500 + R() * 300; z = R() * CITY_D; }
      else if (side === 2) { x = R() * CITY_W * 1.6 - CITY_W * 0.3; z = -600 - R() * 300; }
      else { x = R() * CITY_W * 1.6 - CITY_W * 0.3; z = CITY_D + 600 + R() * 300; }
      parts.push(colored(tr(new THREE.BoxGeometry(w, h, d), x, h / 2 - 2, z), new THREE.Color().setHSL(0.58, 0.12, 0.45 + R() * 0.15)));
    }
    const sky = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    this.scene.add(sky);
  }

  buildPark(R) {
    const { x0, x1, z0, z1 } = PARK;
    const grassT = makeGrassTexture(this.scene.userData.renderer);
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (x1 - x0) / 12, uv.getY(k) * (z1 - z0) / 12);
    const grass = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: grassT, roughness: 1 }));
    grass.position.set((x0 + x1) / 2, 0.05, (z0 + z1) / 2); grass.receiveShadow = true; this.scene.add(grass);
    // stone wall around park
    const wallB = new GeoBuilder(), c = [0.62, 0.6, 0.55];
    for (const [a, b, cc, d] of [[x0, x1, z0, z0 + 0.5], [x0, x1, z1 - 0.5, z1], [x0, x0 + 0.5, z0, z1], [x1 - 0.5, x1, z0, z1]]) boxAll(wallB, a, b, 0, 0.8, cc, d, c);
    // paths: winding ribbons
    const pathB = new GeoBuilder();
    const ribbon = (pts, w) => {
      for (let k = 0; k < pts.length - 1; k++) {
        const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
        const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), nx = -dz / L * w / 2, nz = dx / L * w / 2;
        pathB.quad([ax - nx, 0.08, az - nz], [bx - nx, 0.08, bz - nz], [bx + nx, 0.08, bz + nz], [ax + nx, 0.08, az + nz], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], [0.72, 0.68, 0.6]);
        pathB.quad([ax - nx, 0.08, az - nz], [ax + nx, 0.08, az + nz], [bx + nx, 0.08, bz + nz], [bx - nx, 0.08, bz - nz], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], [0.72, 0.68, 0.6]);
      }
    };
    const cx = (x0 + x1) / 2;
    const main = []; for (let z = z0; z <= z1; z += 6) main.push([cx + Math.sin(z * 0.03) * 22, z]);
    ribbon(main, 4);
    for (let k = 0; k < 4; k++) { const zc = z0 + 25 + k * 55, pts = []; for (let x = x0; x <= x1; x += 5) pts.push([x, zc + Math.sin(x * 0.08 + k) * 6]); ribbon(pts, 3); }
    const path = new THREE.Mesh(pathB.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    path.receiveShadow = true; this.scene.add(path);
    const wall = new THREE.Mesh(wallB.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
    wall.castShadow = wall.receiveShadow = true; this.scene.add(wall);
    // pond
    const pond = new THREE.Mesh(new THREE.CircleGeometry(16, 32), new THREE.MeshStandardMaterial({ color: 0x3f6f80, roughness: 0.1, metalness: 0.5 }));
    pond.rotation.x = -Math.PI / 2; pond.scale.set(1.4, 1, 1); pond.position.set(cx + 12, 0.1, z0 + 150); this.scene.add(pond);
    const rim = new THREE.Mesh(new THREE.RingGeometry(16, 17.2, 32), new THREE.MeshStandardMaterial({ color: 0x8c877c }));
    rim.rotation.x = -Math.PI / 2; rim.scale.set(1.4, 1, 1); rim.position.set(cx + 12, 0.11, z0 + 150); this.scene.add(rim);
    this.pond = { x: cx + 12, z: z0 + 150 };
    // benches along main path
    const bench = mergeGeometries([colored(tr(new THREE.BoxGeometry(1.8, 0.08, 0.5), 0, 0.45, 0), 0x6b4a2e), colored(tr(new THREE.BoxGeometry(1.8, 0.4, 0.06), 0, 0.7, -0.23), 0x6b4a2e), colored(tr(new THREE.BoxGeometry(0.08, 0.45, 0.5), -0.8, 0.22, 0), 0x2b2b2b), colored(tr(new THREE.BoxGeometry(0.08, 0.45, 0.5), 0.8, 0.22, 0), 0x2b2b2b)]);
    const benches = [];
    for (let k = 2; k < main.length - 1; k += 3) { const [x, z] = main[k]; benches.push([x + 3, z, -Math.PI / 2]); if (k % 2) benches.push([x - 3, z + 3, Math.PI / 2]); }
    const bm = new THREE.InstancedMesh(bench, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), benches.length);
    const M = new THREE.Matrix4();
    benches.forEach((b, k) => { M.makeRotationY(b[2]); M.setPosition(b[0], 0, b[1]); bm.setMatrixAt(k, M); });
    bm.castShadow = true; this.scene.add(bm);
    this.parkPath = main;
  }

  buildTrees(R, quality) {
    const trees = [];
    const autumn = [0xd9772b, 0xe0a32e, 0xb8421f, 0xc9612a, 0x8faa3a, 0xe8b93a, 0x6f9a3c, 0xcf5a1e];
    for (const b of this.blocks) {
      if (b.park) {
        for (let k = 0; k < 60; k++) {
          const x = b.x0 + R() * (b.x1 - b.x0), z = b.z0 - ST_W + R() * (b.z1 - b.z0 + ST_W);
          const onPath = this.parkPath.some(([px, pz]) => Math.hypot(px - x, pz - z) < 4);
          if (onPath || Math.hypot((x - this.pond.x) / 1.4, z - this.pond.z) < 19) continue;
          trees.push([x, z, 0.9 + R() * 0.8, autumn[(R() * autumn.length) | 0]]);
        }
        continue;
      }
      const D = DISTRICTS.find(d => b.j >= d.j0 && b.j <= d.j1);
      const dens = D.name === 'SPIRE HEIGHTS' ? 0.35 : 0.6;
      for (let z = b.z0 + 4; z < b.z1 - 3; z += 9) {
        if (R() < dens) trees.push([b.x0 + 1.4, z + R() * 2, 0.6 + R() * 0.35, autumn[(R() * autumn.length) | 0]]);
        if (R() < dens) trees.push([b.x1 - 1.4, z + R() * 2, 0.6 + R() * 0.35, autumn[(R() * autumn.length) | 0]]);
      }
    }
    const trunk = tr(new THREE.CylinderGeometry(0.1, 0.16, 3.2, 6), 0, 1.6, 0);
    const fol = mergeGeometries([
      tr(new THREE.IcosahedronGeometry(2.0, 0), 0, 4.4, 0), tr(new THREE.IcosahedronGeometry(1.5, 0), 1.1, 3.9, 0.4),
      tr(new THREE.IcosahedronGeometry(1.5, 0), -1.0, 4.0, -0.5), tr(new THREE.IcosahedronGeometry(1.3, 0), 0.2, 5.6, -0.2),
    ].map(g => { g.deleteAttribute('uv'); return g; }));
    // jitter foliage vertices for organic look
    const p = fol.attributes.position; const J = rng(9);
    for (let k = 0; k < p.count; k++) p.setXYZ(k, p.getX(k) + (J() - .5) * .35, p.getY(k) + (J() - .5) * .35, p.getZ(k) + (J() - .5) * .35);
    fol.computeVertexNormals();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3526, roughness: 1 });
    const folMat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
    const q = new THREE.Quaternion(), ti = [], fi = [];
    trees.forEach((t) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6.28);
      const M = new THREE.Matrix4().compose(new THREE.Vector3(t[0], 0, t[1]), q, new THREE.Vector3(t[2], t[2], t[2]));
      ti.push({ m: M }); fi.push({ m: M, c: new THREE.Color(t[3]).offsetHSL(0, 0, (R() - 0.5) * 0.08) });
    });
    tiledInstances(this.scene, trunk, trunkMat, ti);
    tiledInstances(this.scene, fol, folMat, fi, { receive: true });
    this.trees = trees;
  }

  buildStreetFurniture(R) {
    // traffic signal masts at intersections (NE corner), streetlights along avenues
    const pole = mergeGeometries([
      colored(tr(new THREE.CylinderGeometry(0.12, 0.15, 6, 6), 0, 3, 0), 0x2c2f33),
      colored(tr(new THREE.BoxGeometry(7, 0.14, 0.14), -3.5, 5.8, 0), 0x2c2f33),
      colored(tr(new THREE.BoxGeometry(0.4, 1.1, 0.35), -5, 5.2, 0), 0x1f2224),
      colored(tr(new THREE.BoxGeometry(0.42, 0.25, 0.1), -5, 5.55, 0.2), 0xd1a21e),
      colored(tr(new THREE.BoxGeometry(0.4, 1.1, 0.35), -2.2, 5.2, 0), 0x1f2224),
    ]);
    const lamp = mergeGeometries([
      colored(tr(new THREE.CylinderGeometry(0.08, 0.11, 7, 6), 0, 3.5, 0), 0x3b4046),
      colored(tr(new THREE.BoxGeometry(1.6, 0.1, 0.1), -0.8, 7, 0), 0x3b4046),
      colored(tr(new THREE.BoxGeometry(0.6, 0.18, 0.3), -1.5, 6.9, 0), 0xe8e4d0),
    ]);
    const poles = [], lamps = [];
    for (let i = 0; i <= NX; i++) for (let j = 0; j <= NZ; j++) {
      const x = i * CELL_X, z = j * CELL_Z;
      if (i < NX && j < NZ) poles.push([x + AVE_W + 0.8, z + ST_W + 0.8, Math.PI / 2]);
      if (i > 0 && j > 0) poles.push([x - 0.8, z - 0.8, -Math.PI / 2]);
    }
    for (let i = 0; i <= NX; i++) for (let j = 0; j < NZ; j++) {
      const x = i * CELL_X; lamps.push([x + AVE_W + 0.6, j * CELL_Z + 32, Math.PI]); lamps.push([x - 0.6, j * CELL_Z + 24, 0]);
    }
    const add = (geo, list) => {
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 });
      tiledInstances(this.scene, geo, mat, list.map(a => { const M = new THREE.Matrix4().makeRotationY(a[2]); M.setPosition(a[0], 0, a[1]); return { m: M }; }));
    };
    add(pole, poles); add(lamp, lamps);
  }

  // ---- queries ----
  cellBoxes(x, z) { return this.grid.get(Math.floor(x / this.GS) * 10000 + Math.floor(z / this.GS)) || []; }
  groundAt(x, z, maxY = Infinity) {
    let h = 0;
    for (const id of this.cellBoxes(x, z)) { const b = this.boxes[id]; if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && b.y1 > h && b.y1 <= maxY) h = b.y1; }
    return h;
  }
  // ray vs boxes (slab). returns {t, point, normal, box}
  raycast(o, d, maxT) {
    const G = this.GS, ex = o.x + d.x * maxT, ez = o.z + d.z * maxT;
    const gx0 = Math.floor(Math.min(o.x, ex) / G), gx1 = Math.floor(Math.max(o.x, ex) / G);
    const gz0 = Math.floor(Math.min(o.z, ez) / G), gz1 = Math.floor(Math.max(o.z, ez) / G);
    const seen = new Set(); let best = null;
    for (let gx = gx0; gx <= gx1; gx++) for (let gz = gz0; gz <= gz1; gz++) {
      const a = this.grid.get(gx * 10000 + gz); if (!a) continue;
      for (const id of a) {
        if (seen.has(id)) continue; seen.add(id);
        const b = this.boxes[id];
        let t0 = 0, t1 = maxT, nAxis = -1, nSign = 0;
        const sl = [[o.x, d.x, b.x0, b.x1], [o.y, d.y, 0, b.y1], [o.z, d.z, b.z0, b.z1]];
        let ok = true;
        for (let ax = 0; ax < 3; ax++) {
          const [oo, dd, mn, mx] = sl[ax];
          if (Math.abs(dd) < 1e-8) { if (oo < mn || oo > mx) { ok = false; break; } continue; }
          let ta = (mn - oo) / dd, tb = (mx - oo) / dd, s = -1;
          if (ta > tb) { const t = ta; ta = tb; tb = t; s = 1; }
          if (ta > t0) { t0 = ta; nAxis = ax; nSign = s; }
          if (tb < t1) t1 = tb;
          if (t0 > t1) { ok = false; break; }
        }
        if (!ok || nAxis < 0) continue;
        if (!best || t0 < best.t) best = { t: t0, box: b, nAxis, nSign };
      }
    }
    if (!best) return null;
    const n = new THREE.Vector3(); n.setComponent(best.nAxis, best.nSign);
    return { t: best.t, point: o.clone().addScaledVector(d, best.t), normal: n, box: best.box };
  }
}
