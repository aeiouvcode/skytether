// Original hero "Tether": graphite suit, teal energy lines, amber chevron, visor helmet.
import * as THREE from 'three';

function suitTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#2f3b4f'; g.fillRect(0, 0, 256, 256);
  // hex weave
  g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 1;
  for (let y = 0; y < 256; y += 8) for (let x = (y / 8 % 2) * 6; x < 256; x += 12) { g.beginPath(); g.arc(x, y, 3.5, 0, 6.28); g.stroke(); }
  // teal piping lines
  g.strokeStyle = '#19e0c8'; g.lineWidth = 7;
  g.beginPath(); g.moveTo(0, 40); g.lineTo(256, 40); g.stroke();
  g.beginPath(); g.moveTo(0, 200); g.lineTo(256, 200); g.stroke();
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildHero() {
  const root = new THREE.Group();
  const suitT = suitTexture();
  const suit = new THREE.MeshStandardMaterial({ map: suitT, roughness: 0.55, metalness: 0.15 });
  const plate = new THREE.MeshStandardMaterial({ color: 0x6b7888, roughness: 0.35, metalness: 0.45 });
  const teal = new THREE.MeshStandardMaterial({ color: 0x19e0c8, emissive: 0x0fb8a4, emissiveIntensity: 1.2, roughness: 0.3 });
  const amber = new THREE.MeshStandardMaterial({ color: 0xff8a1f, emissive: 0xc2540a, emissiveIntensity: 0.6, roughness: 0.4 });
  const visor = new THREE.MeshStandardMaterial({ color: 0x0d1418, emissive: 0x19e0c8, emissiveIntensity: 0.35, roughness: 0.05, metalness: 0.9 });
  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };

  const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
  add(hips, new THREE.CapsuleGeometry(0.17, 0.12, 4, 10), suit, 0, 0, 0).scale.set(1.25, 1, 0.9);
  const torso = new THREE.Group(); torso.position.y = 0.12; hips.add(torso);
  add(torso, new THREE.CapsuleGeometry(0.2, 0.3, 4, 12), suit, 0, 0.28, 0).scale.set(1.2, 1, 0.8);
  // chest plate + amber chevron (original emblem)
  const chest = add(torso, new THREE.BoxGeometry(0.34, 0.2, 0.06), plate, 0, 0.4, 0.14);
  const chev = new THREE.Shape(); chev.moveTo(-0.12, 0.05); chev.lineTo(0, -0.05); chev.lineTo(0.12, 0.05); chev.lineTo(0.12, 0.0); chev.lineTo(0, -0.1); chev.lineTo(-0.12, 0.0);
  add(torso, new THREE.ShapeGeometry(chev), amber, 0, 0.42, 0.172);
  // spine tether rig (backpack reel)
  add(torso, new THREE.CylinderGeometry(0.08, 0.08, 0.26, 10), plate, 0, 0.35, -0.16).rotation.z = Math.PI / 2;
  add(torso, new THREE.TorusGeometry(0.08, 0.018, 6, 14), teal, 0.14, 0.35, -0.16).rotation.y = Math.PI / 2;
  add(torso, new THREE.TorusGeometry(0.08, 0.018, 6, 14), teal, -0.14, 0.35, -0.16).rotation.y = Math.PI / 2;
  // head
  const neck = new THREE.Group(); neck.position.y = 0.62; torso.add(neck);
  add(neck, new THREE.SphereGeometry(0.15, 16, 12), plate, 0, 0.13, 0).scale.set(0.95, 1.08, 1.02);
  const vis = add(neck, new THREE.SphereGeometry(0.152, 16, 8, -0.95, 1.9, 1.15, 0.55), visor, 0, 0.14, 0.005);
  add(neck, new THREE.BoxGeometry(0.02, 0.08, 0.2), teal, 0, 0.29, -0.02); // crest fin
  const limbs = {};
  const mkArm = (side) => {
    const sh = new THREE.Group(); sh.position.set(side * 0.3, 0.5, 0); torso.add(sh);
    add(sh, new THREE.SphereGeometry(0.11, 10, 8), amber, 0, 0, 0);
    add(sh, new THREE.CapsuleGeometry(0.075, 0.22, 4, 8), suit, 0, -0.17, 0);
    const el = new THREE.Group(); el.position.y = -0.34; sh.add(el);
    add(el, new THREE.CapsuleGeometry(0.065, 0.22, 4, 8), suit, 0, -0.15, 0);
    add(el, new THREE.CylinderGeometry(0.075, 0.07, 0.12, 10), plate, 0, -0.16, 0); // launcher gauntlet
    add(el, new THREE.TorusGeometry(0.074, 0.012, 6, 12), teal, 0, -0.2, 0).rotation.x = Math.PI / 2;
    const hand = add(el, new THREE.SphereGeometry(0.07, 8, 6), suit, 0, -0.33, 0);
    return { sh, el, hand };
  };
  const mkLeg = (side) => {
    const hp = new THREE.Group(); hp.position.set(side * 0.12, -0.05, 0); hips.add(hp);
    add(hp, new THREE.CapsuleGeometry(0.095, 0.3, 4, 8), suit, 0, -0.22, 0);
    add(hp, new THREE.BoxGeometry(0.03, 0.3, 0.03), teal, side * 0.1, -0.22, 0);
    const kn = new THREE.Group(); kn.position.y = -0.45; hp.add(kn);
    add(kn, new THREE.SphereGeometry(0.075, 8, 6), plate, 0, 0, 0.03);
    add(kn, new THREE.CapsuleGeometry(0.08, 0.3, 4, 8), suit, 0, -0.22, 0);
    add(kn, new THREE.BoxGeometry(0.13, 0.1, 0.26), plate, 0, -0.44, 0.05); // boot
    add(kn, new THREE.BoxGeometry(0.135, 0.02, 0.27), amber, 0, -0.39, 0.05);
    return { hp, kn };
  };
  limbs.armL = mkArm(1); limbs.armR = mkArm(-1); limbs.legL = mkLeg(1); limbs.legR = mkLeg(-1);
  root.userData = { hips, torso, neck, limbs };
  return root;
}

const lerp = (a, b, t) => a + (b - a) * t;
// pose: state strings; phase for run cycle; blend smoothing
export function poseHero(hero, state, phase, dt, extra = {}) {
  const { hips, torso, neck, limbs } = hero.userData;
  const k = 1 - Math.exp(-dt * 14);
  const P = {
    hipsX: 0, torsoX: 0, torsoZ: 0,
    aLx: 0, aLz: 0.15, eL: 0, aRx: 0, aRz: -0.15, eR: 0,
    lLx: 0, kL: 0, lRx: 0, kR: 0, hipsY: 0.95,
  };
  const s = Math.sin(phase), c = Math.cos(phase);
  if (state === 'run') {
    const amp = Math.min(1, extra.speed / 14);
    P.torsoX = 0.35 * amp; P.lLx = s * 0.9 * amp; P.lRx = -s * 0.9 * amp;
    P.kL = Math.max(0, -c) * 1.3 * amp + 0.1; P.kR = Math.max(0, c) * 1.3 * amp + 0.1;
    P.aLx = -s * 0.9 * amp; P.aRx = s * 0.9 * amp; P.eL = -0.9 * amp; P.eR = -0.9 * amp;
    P.hipsY = 0.95 + Math.abs(c) * 0.06 * amp - 0.04 * amp;
  } else if (state === 'idle') {
    P.aLz = 0.12; P.aRz = -0.12; P.eL = -0.15; P.eR = -0.15; P.torsoX = 0.03 + Math.sin(phase * 0.3) * 0.02;
  } else if (state === 'swing') {
    // right arm reaching up to tether, legs trailing with pump
    P.aRx = -2.9; P.aRz = -0.1; P.eR = 0;
    P.aLx = 0.4 + s * 0.2; P.aLz = 0.6; P.eL = -1.2;
    P.lLx = 0.5 + s * 0.35; P.kL = 0.9; P.lRx = -0.2 - s * 0.35; P.kR = 0.4;
    P.torsoX = 0.1;
  } else if (state === 'air') {
    const up = extra.vy > 0;
    P.aLx = up ? -1.8 : -0.6; P.aLz = 1.0; P.eL = -0.6; P.aRx = up ? -1.8 : -0.6; P.aRz = -1.0; P.eR = -0.6;
    P.lLx = up ? 1.3 : 0.4; P.kL = up ? 1.8 : 0.5; P.lRx = up ? 0.3 : -0.3; P.kR = up ? 1.5 : 0.7;
    P.torsoX = up ? 0.45 : 0.1;
  } else if (state === 'dive') {
    P.torsoX = 0.2; P.aLx = -0.3; P.aLz = 1.3; P.aRx = -0.3; P.aRz = -1.3; P.lLx = -0.2; P.lRx = 0.25; P.kL = 0.3; P.kR = 0.6; P.eL = -0.2; P.eR = -0.2;
  } else if (state === 'wall') {
    // climbing up a wall: body faces wall (model already rotated), alternating reach
    P.torsoX = 0.2;
    P.aLx = -2.4 + s * 0.6; P.aRx = -2.4 - s * 0.6; P.aLz = 0.3; P.aRz = -0.3; P.eL = -0.6; P.eR = -0.6;
    P.lLx = 0.9 + s * 0.6; P.lRx = 0.9 - s * 0.6; P.kL = 1.2; P.kR = 1.2;
  } else if (state === 'land') {
    P.hipsY = 0.7; P.lLx = 1.0; P.lRx = 1.0; P.kL = 1.8; P.kR = 1.8; P.torsoX = 0.6; P.aLx = 0.4; P.aRx = -0.9; P.aLz = 0.9; P.aRz = -0.6;
  }
  hips.position.y = lerp(hips.position.y, P.hipsY, k);
  torso.rotation.x = lerp(torso.rotation.x, P.torsoX, k);
  const L = limbs;
  L.armL.sh.rotation.x = lerp(L.armL.sh.rotation.x, P.aLx, k); L.armL.sh.rotation.z = lerp(L.armL.sh.rotation.z, P.aLz, k); L.armL.el.rotation.x = lerp(L.armL.el.rotation.x, P.eL, k);
  L.armR.sh.rotation.x = lerp(L.armR.sh.rotation.x, P.aRx, k); L.armR.sh.rotation.z = lerp(L.armR.sh.rotation.z, P.aRz, k); L.armR.el.rotation.x = lerp(L.armR.el.rotation.x, P.eR, k);
  L.legL.hp.rotation.x = lerp(L.legL.hp.rotation.x, -P.lLx, k); L.legL.kn.rotation.x = lerp(L.legL.kn.rotation.x, P.kL, k);
  L.legR.hp.rotation.x = lerp(L.legR.hp.rotation.x, -P.lRx, k); L.legR.kn.rotation.x = lerp(L.legR.kn.rotation.x, P.kR, k);
}
