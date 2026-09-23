import * as THREE from 'three';
import { buildHero, poseHero } from './hero.js';

const G = 30, R = 0.42;
const UP = new THREE.Vector3(0, 1, 0);
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tmp3 = new THREE.Vector3();

export class Player {
  constructor(scene, city) {
    this.city = city;
    this.p = new THREE.Vector3(); this.v = new THREE.Vector3();
    this.state = 'air'; this.anchor = new THREE.Vector3(); this.ropeLen = 0; this.ropeT = 0;
    this.wallN = new THREE.Vector3(); this.wallBox = null; this.wallCool = 0; this.swingCool = 0;
    this.phase = 0; this.landT = 0; this.facing = 0; this.airTime = 0;
    this.hero = buildHero(); scene.add(this.hero);
    const ropeGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 5, 1, true); ropeGeo.translate(0, 0.5, 0);
    this.rope = new THREE.Mesh(ropeGeo, new THREE.MeshBasicMaterial({ color: 0xd8fff8 }));
    this.rope.visible = false; scene.add(this.rope);
    this.ropeGlow = new THREE.Mesh(ropeGeo, new THREE.MeshBasicMaterial({ color: 0x19e0c8, transparent: true, opacity: 0.35, depthWrite: false }));
    this.ropeGlow.scale.set(3, 1, 3); this.rope.add(this.ropeGlow);
    this.anchorFx = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.5, 16), new THREE.MeshBasicMaterial({ color: 0x19e0c8, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false }));
    this.anchorFx.visible = false; scene.add(this.anchorFx);
    this.handPos = new THREE.Vector3();
    this.events = [];
  }
  spawn(x, y, z) { this.p.set(x, y, z); this.v.set(0, 0, 0); this.state = 'air'; }
  speed() { return this.v.length(); }

  findAnchor(camYaw) {
    const o = tmp.copy(this.p).addScaledVector(UP, 1.6);
    const hv = Math.hypot(this.v.x, this.v.z);
    let baseYaw = camYaw;
    if (hv > 6) { const vy = Math.atan2(this.v.x, this.v.z); let d = vy - camYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); baseYaw = camYaw + d * 0.4; }
    let best = null;
    for (const el of [50, 38, 64, 76]) for (const yo of [0, 0.45, -0.45, 0.9, -0.9]) {
      const e = el * Math.PI / 180, yaw = baseYaw + yo;
      const d = tmp2.set(Math.sin(yaw) * Math.cos(e), Math.sin(e), Math.cos(yaw) * Math.cos(e));
      const hit = this.city.raycast(o, d, 120);
      if (!hit || hit.t < 7) continue;
      if (hit.point.y < this.p.y + 6) continue;
      const score = -Math.abs(Math.abs(yo) - 0.45) * 7 - Math.abs(el - 52) * 0.25 - Math.abs(hit.t - 40) * 0.15 + (hit.normal.y > 0.5 ? -15 : 0) + (yo === 0 && hit.t < 30 ? -10 : 0);
      if (!best || score > best.score) best = { score, point: hit.point.clone(), normal: hit.normal.clone() };
    }
    return best;
  }
  attach(a) {
    this.anchor.copy(a.point).addScaledVector(a.normal, 0.05);
    this.ropeLen = this.p.distanceTo(this.anchor) * 0.94; this.state = 'swing'; this.ropeT = 0;
    this.anchorFx.visible = true; this.anchorFx.position.copy(this.anchor); this.anchorFx.lookAt(this.anchor.clone().add(a.normal));
    this.events.push('shoot');
  }
  release(boost = true) {
    if (this.state !== 'swing') return;
    this.state = 'air'; this.anchorFx.visible = false;
    if (boost) { this.v.y += 5; const h = tmp.set(this.v.x, 0, this.v.z); if (h.lengthSq() > 1) this.v.addScaledVector(h.normalize(), 3); }
    this.swingCool = 0.12; this.events.push('release');
  }

  update(dt, inp, cam) {
    const n = Math.ceil(dt / (1 / 120)), h = dt / n;
    for (let i = 0; i < n; i++) this.step(h, inp, cam);
    this.animate(dt, inp);
  }

  step(dt, inp, cam) {
    const city = this.city, p = this.p, v = this.v;
    this.wallCool -= dt; this.swingCool -= dt; this.landT -= dt;
    const fwd = tmp3.set(Math.sin(cam.yaw), 0, Math.cos(cam.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x); // camera right when looking along fwd from behind... (x,z)->(-z,x)
    const wish = new THREE.Vector3().addScaledVector(fwd, inp.my).addScaledVector(right, inp.mx);
    const wl = Math.min(1, wish.length()); if (wl > 0) wish.normalize();

    if (inp.swing && this.state !== 'swing' && this.swingCool <= 0 && !inp.swingUsed) {
      const a = this.findAnchor(cam.yaw);
      if (a) {
        if (this.state === 'ground') { v.y = 9; p.y += 0.1; }
        if (this.state === 'wall') { v.addScaledVector(this.wallN, 8); v.y = Math.max(v.y, 6); }
        this.attach(a); inp.swingUsed = true;
      } else inp.noAnchor = true;
    }
    if (!inp.swing) { inp.swingUsed = false; if (this.state === 'swing') this.release(); }

    if (this.state === 'ground') {
      const sp = inp.sprint ? 19 : 13;
      const tv = wish.clone().multiplyScalar(sp * wl);
      const acc = wl > 0 ? 55 : 40;
      tmp.set(tv.x - v.x, 0, tv.z - v.z); const dl = tmp.length(); if (dl > acc * dt) tmp.multiplyScalar(acc * dt / dl);
      v.x += tmp.x; v.z += tmp.z; v.y = 0;
      if (inp.jump) { v.y = inp.sprint ? 12.5 : 11; this.state = 'air'; inp.jump = false; this.events.push('jump'); }
    } else if (this.state === 'air') {
      v.y -= G * dt;
      v.addScaledVector(wish, 11 * wl * dt);
      if (inp.jump) inp.jump = false;
      v.multiplyScalar(1 - 0.02 * dt);
      if (v.y < -60) v.y = -60;
    } else if (this.state === 'swing') {
      v.y -= G * dt;
      this.ropeT += dt;
      // pump: input accel perpendicular to rope
      const rdir = tmp.copy(this.anchor).sub(p).normalize();
      const pump = wish.clone().multiplyScalar(18 * wl);
      pump.addScaledVector(rdir, -pump.dot(rdir));
      v.addScaledVector(pump, dt);
      // gentle reel-in for arc height in the first second
      if (this.ropeT < 0.9 && this.ropeLen > 12) this.ropeLen -= 5 * dt;
      if (inp.jump) { this.release(); v.y += 6; inp.jump = false; }
    } else if (this.state === 'wall') {
      const nrm = this.wallN, b = this.wallBox;
      const tan = new THREE.Vector3(-nrm.z, 0, nrm.x);
      // input: forward (into wall relative to camera) climbs; strafe runs along wall
      const into = -wish.dot(nrm) * wl, side = wish.dot(tan) * wl;
      const climb = Math.max(into, inp.my > 0.2 ? inp.my : 0);
      const ty = climb > 0.1 ? (inp.sprint ? 15 : 11) * climb : -1.5;
      v.y += (ty - v.y) * Math.min(1, dt * 8);
      const vt = v.dot(tan);
      const tt = side * (inp.sprint ? 13 : 9);
      const nvt = vt + (tt - vt) * Math.min(1, dt * (Math.abs(tt) > 0.1 ? 4 : 1.5));
      v.set(tan.x * nvt, v.y, tan.z * nvt);
      if (inp.jump) {
        inp.jump = false; this.state = 'air'; this.wallCool = 0.35;
        v.copy(nrm).multiplyScalar(11); v.y = 10; v.addScaledVector(fwd, 5); this.events.push('jump');
      }
    }

    // integrate
    p.addScaledVector(v, dt);

    // rope constraint
    if (this.state === 'swing') {
      tmp.copy(p).sub(this.anchor); const d = tmp.length();
      if (d > this.ropeLen) {
        tmp.divideScalar(d); p.copy(this.anchor).addScaledVector(tmp, this.ropeLen);
        const radial = v.dot(tmp); if (radial > 0) v.addScaledVector(tmp, -radial);
      }
      // passed over the anchor height -> auto release for a launch
      if (p.y > this.anchor.y - 1.5 && v.y > 0) this.release();
      const sp = v.length(); if (sp > 62) v.multiplyScalar(62 / sp);
    }

    // building collisions
    this.collide(dt, wish, wl, inp);

    // ground / roofs
    const gh = city.groundAt(p.x, p.z, p.y + 0.7);
    if (p.y <= gh) {
      if (this.state === 'air' || this.state === 'swing') {
        if (this.state === 'swing') this.release(false);
        if (v.y < -24) this.landT = 0.25;
        this.state = 'ground'; this.events.push('land');
      }
      p.y = gh; if (v.y < 0) v.y = 0;
    } else if (this.state === 'ground' && p.y > gh + 0.05) {
      if (p.y - gh < 0.8) p.y = gh; else this.state = 'air';
    }
    // world bounds
    if (p.x < -5) { p.x = -5; if (v.x < 0) v.x = 0; } else if (p.x > city.W + 5) { p.x = city.W + 5; if (v.x > 0) v.x = 0; }
    if (p.z < -5) { p.z = -5; if (v.z < 0) v.z = 0; } else if (p.z > city.D + 5) { p.z = city.D + 5; if (v.z > 0) v.z = 0; }
    if (!(p.y > -10)) { p.y = 0; v.set(0, 0, 0); this.state = 'ground'; }
  }

  collide(dt, wish, wl, inp) {
    const p = this.p, v = this.v, city = this.city;
    const seen = new Set();
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      for (const id of city.cellBoxes(p.x + dx * 3, p.z + dz * 3)) {
        if (seen.has(id)) continue; seen.add(id);
        const b = city.boxes[id];
        if (p.y >= b.y1 - 0.02 || p.y + 1.7 < 0) continue;
        if (p.x < b.x0 - R || p.x > b.x1 + R || p.z < b.z0 - R || p.z > b.z1 + R) continue;
        // step/mantle up onto low ledge
        if (b.y1 - p.y < 0.7) { p.y = b.y1 + 0.01; continue; }
        const pen = [p.x - (b.x0 - R), (b.x1 + R) - p.x, p.z - (b.z0 - R), (b.z1 + R) - p.z];
        let k = 0; for (let q = 1; q < 4; q++) if (pen[q] < pen[k]) k = q;
        const n = new THREE.Vector3(k === 0 ? -1 : k === 1 ? 1 : 0, 0, k === 2 ? -1 : k === 3 ? 1 : 0);
        if (k === 0) p.x = b.x0 - R; else if (k === 1) p.x = b.x1 + R; else if (k === 2) p.z = b.z0 - R; else p.z = b.z1 + R;
        const into = v.dot(n);
        if (this.state !== 'wall' && this.wallCool <= 0 && b.y1 - p.y > 2.2) {
          const pushing = -wish.dot(n) * wl > 0.3 || -into > 6;
          if (pushing) {
            // enter wall run/climb, converting momentum
            const tan = new THREE.Vector3(-n.z, 0, n.x);
            const hs = Math.max(0, -into);
            const vt = v.dot(tan);
            if (this.state === 'swing') this.release(false);
            this.state = 'wall'; this.wallN.copy(n); this.wallBox = b;
            v.set(tan.x * vt * 0.8, Math.max(v.y * 0.5, Math.min(18, 6 + hs * 0.5)), tan.z * vt * 0.8);
            this.events.push('wall');
            continue;
          }
        }
        if (into < 0) v.addScaledVector(n, -into);
      }
    }
    if (this.state === 'wall') {
      const b = this.wallBox, n = this.wallN;
      // stick to face
      if (n.x) p.x = n.x < 0 ? b.x0 - R : b.x1 + R; else p.z = n.z < 0 ? b.z0 - R : b.z1 + R;
      // off the side edge?
      const off = n.x ? (p.z < b.z0 - R || p.z > b.z1 + R) : (p.x < b.x0 - R || p.x > b.x1 + R);
      if (off) { this.state = 'air'; this.wallCool = 0.2; }
      else if (p.y >= b.y1 - 0.4) {
        // vault onto roof
        p.y = b.y1 + 0.05; p.addScaledVector(n, -1.1); v.set(-n.x * 6, 5, -n.z * 6);
        this.state = 'air'; this.wallCool = 0.3; this.events.push('vault');
      } else if (p.y <= 0.02 && v.y < 0) { p.y = 0; this.state = 'ground'; this.wallCool = 0.4; }
    }
  }

  animate(dt, inp) {
    const hv = Math.hypot(this.v.x, this.v.z), H = this.hero;
    let st = this.state, targetYaw = this.facing;
    if (st === 'wall') targetYaw = Math.atan2(-this.wallN.x, -this.wallN.z);
    else if (hv > 0.8) targetYaw = Math.atan2(this.v.x, this.v.z);
    let d = targetYaw - this.facing; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.facing += d * Math.min(1, dt * (st === 'swing' ? 6 : 12));
    let pose = st;
    if (st === 'ground') pose = this.landT > 0 ? 'land' : hv > 1 ? 'run' : 'idle';
    if (st === 'air' && this.v.y < -14) pose = 'dive';
    this.phase += dt * (pose === 'run' ? hv * 0.75 : pose === 'wall' ? 7 : 3);
    poseHero(H, pose, this.phase, dt, { speed: hv, vy: this.v.y });
    H.position.copy(this.p);
    // orientation: yaw + tilt toward rope in swing
    const q = new THREE.Quaternion().setFromAxisAngle(UP, this.facing);
    if (st === 'swing') {
      const up = tmp.copy(this.anchor).sub(this.p).normalize();
      const tilt = new THREE.Quaternion().setFromUnitVectors(UP, up);
      q.premultiply(tilt);
      H.position.addScaledVector(up, -1.0).add(new THREE.Vector3(0, 1.0, 0));
    } else if (pose === 'dive') {
      const pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.9);
      q.multiply(pitch);
    }
    H.quaternion.slerp(q, Math.min(1, dt * 10));
    // rope
    if (st === 'swing') {
      H.updateMatrixWorld(true);
      H.userData.limbs.armR.hand.getWorldPosition(this.handPos);
      const dir = tmp.copy(this.anchor).sub(this.handPos), len = dir.length();
      const grow = Math.min(1, this.ropeT / 0.09);
      this.rope.visible = true; this.rope.position.copy(this.handPos);
      this.rope.quaternion.setFromUnitVectors(UP, dir.normalize()); this.rope.scale.set(1, len * grow, 1);
      this.anchorFx.scale.setScalar(1 + Math.sin(this.ropeT * 20) * 0.15);
    } else this.rope.visible = false;
  }
}
