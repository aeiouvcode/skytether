import * as THREE from 'three';
import { DISTRICTS, districtAt, CITY_W, CITY_D, PARK } from './city.js';
import { CELL_X, CELL_Z, AVE_W, ST_W } from './textures.js';

const EVENT_TYPES = [
  { name: 'STORE HOLDUP', sub: 'Silent alarm tripped', kind: 'ground' },
  { name: 'STREET SNATCH', sub: 'Bag thief on foot', kind: 'ground' },
  { name: 'GETAWAY CAR', sub: 'Pursue the vehicle', kind: 'car' },
  { name: 'ROOFTOP STANDOFF', sub: 'Armed crew on a roof', kind: 'roof' },
  { name: 'CARGO HEIST', sub: 'Van being emptied', kind: 'ground' },
];

export class Hud {
  constructor(city, traffic) {
    this.city = city; this.traffic = traffic;
    const $ = id => document.getElementById(id);
    this.el = { ev: $('evPanel'), evName: $('evName'), evSub: $('evSub'), evDist: $('evDist'), compass: $('compassStrip'), dname: $('dname'),
      banner: $('banner'), bannerName: $('bannerName'), toast: $('toast'), speed: $('speed'), xp: $('xpFill'), lvl: $('lvl'), marker: $('marker'), mdist: $('mdist'), fps: $('fps'), noanchor: $('noanchor'), bigmap: $('bigmap') };
    this.mm = $('minimap'); this.mctx = this.mm.getContext('2d');
    this.seen = new Set(); this.xp = 0; this.level = 1; this.bannerT = 0; this.toastT = 0;
    this.event = null; this.evCool = 3; this.evMesh = this.makeBeacon(city.scene);
    this.lastDistrict = null;
    // compass strip content
    const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    let html = '';
    for (let rep = 0; rep < 3; rep++) for (let k = 0; k < 72; k++) {
      const deg = k * 5; const lab = deg % 45 === 0 ? labels[deg / 45] : '';
      html += `<span class="tk ${lab ? 'maj' : deg % 15 === 0 ? 'mid' : ''}">${lab}</span>`;
    }
    this.el.compass.innerHTML = html;
    this.frameN = 0;
    this.big = false;
  }
  toggleBigMap() { this.big = !this.big; this.el.bigmap.style.display = this.big ? 'block' : 'none'; if (this.big) this.drawBigMap(); }
  makeBeacon(scene) {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 160, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xff5a36, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beam.position.y = 80; g.add(beam);
    const dia = new THREE.Mesh(new THREE.OctahedronGeometry(1.6), new THREE.MeshBasicMaterial({ color: 0xff7a3d }));
    dia.position.y = 5; g.add(dia); g.userData.dia = dia;
    const ring = new THREE.Mesh(new THREE.RingGeometry(5, 6, 32), new THREE.MeshBasicMaterial({ color: 0xff5a36, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15; g.add(ring); g.userData.ring = ring;
    g.visible = false; scene.add(g); return g;
  }
  spawnEvent(player) {
    const type = EVENT_TYPES[(Math.random() * EVENT_TYPES.length) | 0];
    let pos = new THREE.Vector3(), car = null;
    for (let tries = 0; tries < 40; tries++) {
      const a = Math.random() * 6.28, r = 180 + Math.random() * 260;
      const x = player.p.x + Math.sin(a) * r, z = player.p.z + Math.cos(a) * r;
      if (x < 30 || z < 30 || x > CITY_W - 30 || z > CITY_D - 30) continue;
      if (type.kind === 'car') {
        let best = null, bd = 1e9;
        for (const c of this.traffic.cars) { if (c.x === undefined) continue; const d = Math.abs(Math.hypot(c.x - player.p.x, c.z - player.p.z) - 260); if (d < bd) { bd = d; best = c; } }
        car = best; if (car) break; continue;
      }
      if (type.kind === 'roof') {
        const lot = this.city.lots.find(l => x > l.x0 && x < l.x1 && z > l.z0 && z < l.z1);
        if (!lot) continue; pos.set((lot.x0 + lot.x1) / 2, lot.h, (lot.z0 + lot.z1) / 2); break;
      }
      // snap to nearest sidewalk corner of block
      const i = Math.floor(x / CELL_X), j = Math.floor(z / CELL_Z);
      pos.set(i * CELL_X + AVE_W + 2, 0, j * CELL_Z + ST_W + 2 + (Math.random() * 30)); break;
    }
    this.event = { type, pos, car, t: 0, limit: 120 };
    this.evMesh.visible = true;
    this.el.ev.classList.add('on'); this.el.evName.textContent = type.name; this.el.evSub.textContent = type.sub;
    this.el.ev.classList.remove('fail', 'done');
  }
  toast(msg, cls = '') { this.el.toast.textContent = msg; this.el.toast.className = 'on ' + cls; this.toastT = 2.6; }
  addXp(n) {
    this.xp += n; const need = 400 + this.level * 200;
    if (this.xp >= need) { this.xp -= need; this.level++; setTimeout(() => this.toast('LEVEL ' + this.level + ' // TETHER RANGE UP', 'lvl'), 1400); }
    this.el.xp.style.width = (this.xp / (400 + this.level * 200) * 100) + '%'; this.el.lvl.textContent = this.level;
  }
  update(dt, player, cam, camera, inp, fps) {
    this.frameN++;
    // district
    const d = districtAt(player.p.z);
    const inPark = player.p.x > PARK.x0 && player.p.x < PARK.x1 && player.p.z > PARK.z0 && player.p.z < PARK.z1;
    const dn = inPark ? 'WARDEN PARK' : d.name;
    if (dn !== this.lastDistrict) {
      this.lastDistrict = dn; this.el.dname.textContent = dn;
      if (!this.seen.has(dn)) {
        this.seen.add(dn);
        this.el.bannerName.textContent = dn; this.el.banner.classList.remove('on'); void this.el.banner.offsetWidth; this.el.banner.classList.add('on'); this.bannerT = 4;
        if (this.seen.size > 1) { this.addXp(150); setTimeout(() => this.toast('GRID NODE SYNCED  +150 XP'), 600); }
      }
    }
    if (this.bannerT > 0 && (this.bannerT -= dt) <= 0) this.el.banner.classList.remove('on');
    if (this.toastT > 0 && (this.toastT -= dt) <= 0) this.el.toast.className = '';
    // compass: 5deg per 14px tick, strip repeats 3x360
    const hdg = ((-cam.yaw * 180 / Math.PI) % 360 + 360) % 360; // yaw 0 = +z = north
    const px = hdg / 5 * 14;
    this.el.compass.style.transform = `translateX(${-px - 72 * 14 + 150}px)`;
    // speed
    this.el.speed.textContent = Math.round(player.speed() * 3.6);
    if (this.frameN % 15 === 0) this.el.fps.textContent = Math.round(fps) + ' fps';
    this.el.noanchor.classList.toggle('on', !!inp.noAnchor);
    // events
    if (!this.event) { this.evCool -= dt; if (this.evCool <= 0) this.spawnEvent(player); }
    else {
      const e = this.event; e.t += dt;
      if (e.car) e.pos.set(e.car.x, 0, e.car.z);
      this.evMesh.position.copy(e.pos);
      this.evMesh.userData.dia.rotation.y += dt * 2; this.evMesh.userData.dia.position.y = 5 + Math.sin(e.t * 3) * 0.6;
      this.evMesh.userData.ring.scale.setScalar(1 + (e.t * 0.8 % 1) * 0.6);
      const dist = player.p.distanceTo(e.pos);
      this.el.evDist.textContent = Math.round(dist) + ' m';
      const left = e.limit - e.t;
      if (dist < (e.car ? 12 : 9)) {
        const gain = e.car ? 300 : 200; this.addXp(gain);
        this.toast(e.type.name + ' STOPPED  +' + gain + ' XP', 'good'); this.el.ev.classList.add('done');
        this.clearEvent(6);
      } else if (left <= 0) {
        this.toast('SUSPECTS ESCAPED', 'bad'); this.el.ev.classList.add('fail'); this.clearEvent(8);
      }
      // screen marker
      const sp = e.pos.clone(); sp.y += 5; sp.project(camera);
      const behind = sp.z > 1;
      let x = (sp.x * 0.5 + 0.5) * innerWidth, y = (-sp.y * 0.5 + 0.5) * innerHeight;
      if (behind) { x = innerWidth - x; y = innerHeight - 120; }
      const m = 40; const clamped = behind || x < m || x > innerWidth - m || y < m || y > innerHeight - m;
      x = Math.max(m, Math.min(innerWidth - m, x)); y = Math.max(m + 60, Math.min(innerHeight - 110, y)); x = Math.max(m + 150, Math.min(innerWidth - 210, x));
      this.el.marker.style.transform = `translate(${x}px,${y}px)`; this.el.marker.classList.toggle('edge', clamped); this.el.marker.style.display = 'block';
      this.el.mdist.textContent = Math.round(dist) + 'm';
    }
    if (this.frameN % 2 === 0) this.drawMinimap(player, cam);
  }
  clearEvent(cool) {
    setTimeout(() => this.el.ev.classList.remove('on'), 2200);
    this.event = null; this.evMesh.visible = false; this.evCool = cool; this.el.marker.style.display = 'none';
  }
  drawMinimap(player, cam) {
    const c = this.mctx, W = this.mm.width, H = this.mm.height, S = W / 240;
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), px = player.p.x, pz = player.p.z;
    const a = -cy * S, b = -sy * S, cc = sy * S, d = -cy * S;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#2b4a5c'; c.fillRect(0, 0, W, H);
    c.setTransform(a, b, cc, d, W / 2 - (a * px + cc * pz), H / 2 - (b * px + d * pz));
    const r = 200;
    for (const bl of this.city.blocks) {
      if (bl.x1 < px - r || bl.x0 > px + r || bl.z1 < pz - r || bl.z0 > pz + r) continue;
      c.fillStyle = bl.park ? '#2f6b3e' : '#162532'; c.fillRect(bl.x0 + 1, bl.z0 + 1, bl.x1 - bl.x0 - 2, bl.z1 - bl.z0 - 2);
    }
    c.fillStyle = '#2f6b3e'; c.fillRect(PARK.x0, PARK.z0, PARK.x1 - PARK.x0, PARK.z1 - PARK.z0);
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (this.event) {
      const dx = this.event.pos.x - px, dz = this.event.pos.z - pz;
      let X = (-dx * cy + dz * sy) * S, Y = -(dx * sy + dz * cy) * S;
      const m = Math.max(Math.abs(X), Math.abs(Y)), lim = W / 2 - 10;
      if (m > lim) { X *= lim / m; Y *= lim / m; }
      c.save(); c.translate(W / 2 + X, H / 2 + Y);
      c.fillStyle = '#ff5a36'; c.strokeStyle = '#000'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -8); c.lineTo(6, 0); c.lineTo(0, 8); c.lineTo(-6, 0); c.closePath(); c.fill(); c.stroke();
      c.restore();
    }
    // player arrow (heading relative to camera)
    const vy = Math.hypot(player.v.x, player.v.z) > 1 ? Math.atan2(player.v.x, player.v.z) : player.facing;
    c.save(); c.translate(W / 2, H / 2); c.rotate(-(vy - cam.yaw));
    c.fillStyle = '#19e0c8'; c.strokeStyle = '#06201d'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -10); c.lineTo(7, 8); c.lineTo(0, 4); c.lineTo(-7, 8); c.closePath(); c.fill(); c.stroke();
    c.restore();
    // view cone
    c.fillStyle = 'rgba(25,224,200,0.12)'; c.beginPath(); c.moveTo(W / 2, H / 2); c.lineTo(W / 2 - 40, 0); c.lineTo(W / 2 + 40, 0); c.fill();
    const R2 = W / 2 - 9;
    c.fillStyle = '#ffb347'; c.font = 'bold 12px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('N', W / 2 + sy * R2 * 0 + (sy) * R2, H / 2 - cy * R2);
  }
  drawBigMap() {
    const cv = this.el.bigmap.querySelector('canvas'), c = cv.getContext('2d');
    const s = Math.min(cv.width / CITY_W, cv.height / CITY_D);
    c.fillStyle = '#0f1a24'; c.fillRect(0, 0, cv.width, cv.height);
    c.save(); c.scale(s, s);
    c.fillStyle = '#2b4a5c'; c.fillRect(0, 0, CITY_W, CITY_D);
    for (const b of this.city.blocks) { c.fillStyle = b.park ? '#2f6b3e' : '#15222e'; c.fillRect(b.x0, CITY_D - b.z1, b.x1 - b.x0, b.z1 - b.z0); }
    c.restore();
  }
}
