import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { NX, NZ, CITY_W, CITY_D, PARK } from './city.js';
import { CELL_X, CELL_Z, AVE_W, ST_W, WALK } from './textures.js';

function colored(geo, hex) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) { a[k * 3] = c.r; a[k * 3 + 1] = c.g; a[k * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (geo.attributes.uv) geo.deleteAttribute('uv'); return geo;
}
const box = (w, h, d, x, y, z, col) => colored(new THREE.BoxGeometry(w, h, d).translate(x, y, z), col);
const wheel = (x, z, r = 0.36) => colored(new THREE.CylinderGeometry(r, r, 0.3, 6).rotateZ(Math.PI / 2).translate(x, r, z), 0x151515);
// vehicles modeled facing +z, white body (tinted by instanceColor where body is white)
function taxiGeo() {
  return mergeGeometries([
    box(1.85, 0.75, 4.5, 0, 0.72, 0, 0xffffff), box(1.6, 0.6, 2.3, 0, 1.38, -0.2, 0xffffff),
    box(1.62, 0.5, 2.1, 0, 1.4, -0.2, 0x26323d), box(1.87, 0.12, 4.52, 0, 0.55, 0, 0x222222),
    box(0.6, 0.22, 0.3, 0, 1.8, -0.2, 0xf4f1e4), box(1.4, 0.15, 0.05, 0, 0.85, 2.26, 0xfff6d0), box(1.4, 0.15, 0.05, 0, 0.85, -2.26, 0xb81d1d),
    wheel(0.85, 1.45), wheel(-0.85, 1.45), wheel(0.85, -1.45), wheel(-0.85, -1.45),
  ]);
}
function vanGeo() {
  return mergeGeometries([
    box(2.1, 2.1, 5.4, 0, 1.4, -0.2, 0xffffff), box(2.0, 0.9, 1.0, 0, 0.9, 2.9, 0xffffff), box(1.9, 0.6, 0.6, 0, 1.75, 2.35, 0x26323d),
    box(2.12, 0.14, 5.9, 0, 0.45, 0.1, 0x2a2a2a),
    wheel(0.95, 2.2, 0.42), wheel(-0.95, 2.2, 0.42), wheel(0.95, -1.8, 0.42), wheel(-0.95, -1.8, 0.42),
  ]);
}
function busGeo() {
  const parts = [box(2.5, 2.7, 11.5, 0, 1.75, 0, 0xffffff), box(2.52, 0.9, 11.2, 0, 2.3, 0.1, 0x28333e), box(2.54, 0.35, 11.52, 0, 0.55, 0, 0x2b4f86), box(2.3, 0.2, 10.5, 0, 3.15, 0, 0xd9d9d9)];
  for (const z of [4, -3.5]) { parts.push(wheel(1.15, z, 0.5), wheel(-1.15, z, 0.5)); }
  return mergeGeometries(parts);
}
function pedGeo() {
  return mergeGeometries([
    box(0.4, 0.62, 0.25, 0, 1.15, 0, 0xffffff), // shirt (tinted)
    box(0.36, 0.8, 0.22, 0, 0.42, 0, 0x2a2f3a), // legs
    colored(new THREE.SphereGeometry(0.13, 6, 4).translate(0, 1.6, 0), 0xc8997a),
    box(0.12, 0.55, 0.12, 0.27, 1.1, 0, 0xffffff), box(0.12, 0.55, 0.12, -0.27, 1.1, 0, 0xffffff),
  ]);
}

export class Traffic {
  constructor(scene, quality) {
    this.scene = scene; this.t = 0;
    const R = (() => { let s = 99; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
    this.lanes = [];
    // Avenues along z. one-way, alternating direction, 3 lanes + parking lane unused
    for (let i = 0; i <= NX; i++) {
      const dir = i % 2 ? 1 : -1, cx = i * CELL_X + AVE_W / 2;
      for (const off of [-6, -2, 2, 6]) this.lanes.push({ axis: 'z', fixed: cx + off, dir, len: CITY_D, inPark: i === PARK.i + 0.5 });
    }
    for (let j = 0; j <= NZ; j++) {
      if (j % 2) continue; if (j > PARK.j0 && j <= PARK.j1) continue;
      const dir = (j / 2) % 2 ? 1 : -1, cz = j * CELL_Z + ST_W / 2;
      for (const off of [-3, 3]) this.lanes.push({ axis: 'x', fixed: cz + off, dir: off < 0 ? dir : dir, len: CITY_W });
    }
    const types = [
      { geo: taxiGeo(), len: 4.8, speed: 15, colors: [0xf2c01e, 0xf5c518, 0xefb810] },
      { geo: taxiGeo(), len: 4.8, speed: 14, colors: [0x2d3b4f, 0xb9bcc0, 0x8b1e1e, 0x1d1d1f, 0xe6e6e6, 0x3c5e3a] },
      { geo: vanGeo(), len: 6.2, speed: 12, colors: [0xf2f2f0, 0xe8e8e4, 0xd9d6cf] },
      { geo: busGeo(), len: 12, speed: 10, colors: [0xe7e9ec] },
    ];
    this.types = types;
    const mob = quality.mobile;
    this.cars = [];
    for (const [li, L] of this.lanes.entries()) {
      const n = Math.floor(L.len / (L.axis === 'z' ? (mob ? 50 : 38) : (mob ? 100 : 80)));
      for (let k = 0; k < n; k++) {
        const r = R(); const ti = L.axis === 'x' ? (r < 0.5 ? 0 : 1) : (r < 0.42 ? 0 : r < 0.72 ? 1 : r < 0.9 ? 2 : 3);
        this.cars.push({ lane: li, s: (k + R() * 0.5) * L.len / n, v: types[ti].speed, type: ti, color: types[ti].colors[(R() * types[ti].colors.length) | 0], vmax: types[ti].speed * (0.85 + R() * 0.3) });
      }
    }
    this.meshes = types.map((T, ti) => {
      const list = this.cars.filter(c => c.type === ti);
      const m = new THREE.InstancedMesh(T.geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.3 }), list.length);
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
      list.forEach((c, k) => { c.idx = k; m.setColorAt(k, new THREE.Color(c.color)); });
      scene.add(m); return m;
    });
    // lane membership for following
    this.byLane = this.lanes.map(() => []);
    this.cars.forEach(c => this.byLane[c.lane].push(c));

    // pedestrians on sidewalks around blocks
    this.peds = [];
    const shirt = [0xc23b3b, 0x2e5fa8, 0xe0c05a, 0x3f8f5a, 0x7a4fa0, 0xeeeeee, 0x333333, 0xd97a2b, 0x5aa6c7];
    const nPed = mob ? 900 : 1400;
    for (let k = 0; k < nPed; k++) {
      const i = (R() * NX) | 0, j = (R() * NZ) | 0;
      const x0 = i * CELL_X + AVE_W + 1.6, x1 = (i + 1) * CELL_X - 1.6, z0 = j * CELL_Z + ST_W + 1.6, z1 = (j + 1) * CELL_Z - 1.6;
      const per = 2 * (x1 - x0 + z1 - z0);
      this.peds.push({ x0, x1, z0, z1, per, s: R() * per, v: (R() < 0.5 ? 1 : -1) * (1.1 + R() * 0.6), ph: R() * 6, off: (R() - 0.5) * 1.6, col: shirt[(R() * shirt.length) | 0] });
    }
    this.pedMesh = new THREE.InstancedMesh(pedGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), this.peds.length);
    this.pedMesh.castShadow = true; this.pedMesh.frustumCulled = false;
    this.peds.forEach((p, k) => this.pedMesh.setColorAt(k, new THREE.Color(p.col)));
    scene.add(this.pedMesh);
    this.radius = mob ? 260 : 380; this.pedR = mob ? 120 : 180; this.M = new THREE.Matrix4(); this.Q = new THREE.Quaternion(); this.V = new THREE.Vector3(); this.S = new THREE.Vector3(1, 1, 1); this.Y = new THREE.Vector3(0, 1, 0);
  }
  signalGreen(axis) { const ph = (this.t % 24) / 24; return axis === 'z' ? ph < 0.5 : (ph >= 0.55 && ph < 0.95); }
  update(dt, focus) {
    this.t += dt;
    for (const [li, list] of this.byLane.entries()) {
      const L = this.lanes[li]; if (!list.length) continue;
      list.sort((a, b) => a.s - b.s); // s increasing along travel dir
      const green = this.signalGreen(L.axis);
      const period = L.axis === 'z' ? CELL_Z : CELL_X, crossW = L.axis === 'z' ? ST_W : AVE_W;
      for (let k = 0; k < list.length; k++) {
        const c = list[k], lead = list[(k + 1) % list.length], T = this.types[c.type];
        let gap = lead.s - c.s; if (gap <= 0) gap += L.len;
        gap -= (T.len + this.types[lead.type].len) / 2;
        let target = c.vmax;
        if (list.length > 1) target = Math.min(target, Math.max(0, (gap - 2.5) * 1.2));
        if (!green) {
          // world coordinate along axis
          const w = L.dir > 0 ? c.s : L.len - c.s;
          const front = w + L.dir * T.len / 2;
          // next intersection start in travel dir
          let stop;
          if (L.dir > 0) { stop = Math.ceil((front + 0.01) / period) * period - 1.5; const d = stop - front; if (d > 0 && d < 18) target = Math.min(target, Math.max(0, (d - 0.5) * 1.1)); }
          else { stop = Math.floor((front - 0.01) / period) * period + crossW + 1.5; const d = front - stop; if (d > 0 && d < 18) target = Math.min(target, Math.max(0, (d - 0.5) * 1.1)); }
        }
        c.v += Math.max(-12 * dt, Math.min(4 * dt, target - c.v));
        c.s = (c.s + c.v * dt) % L.len;
      }
    }
    const M = this.M, Q = this.Q, V = this.V, RR = this.radius * this.radius, fx = focus.x, fz = focus.z;
    const cnt = this.meshes.map(() => 0), col = this.tmpC || (this.tmpC = new THREE.Color());
    for (const c of this.cars) {
      const L = this.lanes[c.lane], w = L.dir > 0 ? c.s : L.len - c.s;
      if (L.axis === 'z') { V.set(L.fixed, 0, w); } else { V.set(w, 0, L.fixed); }
      c.x = V.x; c.z = V.z;
      const dx = V.x - fx, dz = V.z - fz; if (dx * dx + dz * dz > RR) continue;
      if (L.axis === 'z') Q.setFromAxisAngle(this.Y, L.dir > 0 ? 0 : Math.PI); else Q.setFromAxisAngle(this.Y, L.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      const m = this.meshes[c.type], k = cnt[c.type]++;
      M.compose(V, Q, this.S); m.setMatrixAt(k, M); m.setColorAt(k, col.setHex(c.color));
    }
    this.meshes.forEach((m, i) => { m.count = cnt[i]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    let pk = 0;
    for (const p of this.peds) {
      p.s = (p.s + p.v * dt + p.per) % p.per; p.ph += dt * 7;
      const w = p.x1 - p.x0, d = p.z1 - p.z0; let s = p.s, x, z, a;
      if (s < w) { x = p.x0 + s; z = p.z0 - p.off; a = Math.PI / 2; }
      else if ((s -= w) < d) { x = p.x1 + p.off; z = p.z0 + s; a = 0; }
      else if ((s -= d) < w) { x = p.x1 - s; z = p.z1 + p.off; a = -Math.PI / 2; }
      else { s -= w; x = p.x0 - p.off; z = p.z1 - s; a = Math.PI; }
      if (p.v < 0) a += Math.PI;
      p.x = x; p.z = z;
      const dx = x - fx, dz = z - fz; if (dx * dx + dz * dz > this.pedR * this.pedR) continue;
      V.set(x, Math.abs(Math.sin(p.ph)) * 0.05, z); Q.setFromAxisAngle(this.Y, a);
      M.compose(V, Q, this.S); this.pedMesh.setMatrixAt(pk, M); this.pedMesh.setColorAt(pk, col.setHex(p.col)); pk++;
    }
    this.pedMesh.count = pk; if (this.pedMesh.instanceColor) this.pedMesh.instanceColor.needsUpdate = true;
    this.pedMesh.instanceMatrix.needsUpdate = true;
  }
}
