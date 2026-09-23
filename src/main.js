import * as THREE from 'three';
import { makeTextures } from './textures.js';
import { City, DISTRICTS, districtAt, CITY_W, CITY_D, PARK, NX, NZ } from './city.js';
import { CELL_X, CELL_Z, AVE_W, ST_W } from './textures.js';
import { Traffic } from './traffic.js';
import { Player } from './player.js';
import { Hud } from './hud.js';

const Q = new URLSearchParams(location.search);
const mobile = !Q.has('desktop') && ((matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches) || Q.has('mobile'));
const quality = { mobile, shadow: mobile ? 1024 : 2048, dpr: Math.min(devicePixelRatio, mobile ? 1.5 : 2) };

const renderer = new THREE.WebGLRenderer({ antialias: !mobile, powerPreference: 'high-performance' });
renderer.setPixelRatio(quality.dpr); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene(); scene.userData.renderer = renderer;
const HAZE = new THREE.Color(0xc4d3dc);
scene.fog = new THREE.Fog(HAZE, 60, mobile ? 700 : 950);
scene.background = HAZE;

// sky dome
const SUN_DIR = new THREE.Vector3(-0.45, 0.72, -0.53).normalize();
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { sun: { value: SUN_DIR }, top: { value: new THREE.Color(0x3f7fc4) }, hor: { value: HAZE.clone() } },
  vertexShader: `varying vec3 vd; void main(){ vd = normalize(position); vec4 p = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*p; gl_Position.z = gl_Position.w; }`,
  fragmentShader: `uniform vec3 sun; uniform vec3 top; uniform vec3 hor; varying vec3 vd;
    void main(){ float h = clamp(vd.y,0.,1.); vec3 c = mix(hor, top, pow(h,0.55));
      float s = max(dot(normalize(vd), sun),0.); c += vec3(1.,.93,.8)*(pow(s,600.)*3. + pow(s,12.)*.25);
      // soft cumulus bands
      float cl = sin(vd.x*9.+vd.z*4.)*sin(vd.z*11.-vd.x*3.)*.5+.5; cl *= smoothstep(.05,.25,h)*smoothstep(.6,.3,h);
      c = mix(c, vec3(1.), cl*cl*.35);
      gl_FragColor = vec4(c,1.); }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), skyMat); sky.frustumCulled = false; scene.add(sky);

// env map from sky for glass reflections
{
  const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
  const s2 = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMat); es.add(s2);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 24), new THREE.MeshBasicMaterial({ color: 0x55585c }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -8; es.add(ground);
  scene.environment = pm.fromScene(es, 0.02).texture; scene.environmentIntensity = 0.55;
}

const hemi = new THREE.HemisphereLight(0xcfe3f5, 0x6b6257, 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 3.1);
sun.castShadow = true; sun.shadow.mapSize.set(quality.shadow, quality.shadow);
const SH = mobile ? 70 : 95;
Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 700 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

const T = makeTextures(renderer);
const city = new City(scene, T, renderer, quality);
const traffic = new Traffic(scene, quality);
const player = new Player(scene, city);
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.3, 4000);
const hud = new Hud(city, traffic);

const cam = { yaw: 0, pitch: 0.22, dist: 5.6, pos: new THREE.Vector3(), look: new THREE.Vector3(), lastLook: 0, fov: 68 };
// spawn on a rooftop in Spire Heights facing north
{
  const lot = city.lots.filter(l => l.z0 > 13 * CELL_Z && l.z0 < 14 * CELL_Z && l.h > 40 && l.h < 90)[0] || city.lots[0];
  player.spawn((lot.x0 + lot.x1) / 2, lot.h + 0.1, (lot.z0 + lot.z1) / 2);
  const sp = Q.get('spawn');
  if (sp === 'ground') player.spawn(3 * CELL_X + AVE_W - 3, 0, 12 * CELL_Z + 20);
  if (sp === 'park') { player.spawn(PARK.x0 + 30, 0, PARK.z0 + 60); }
  if (sp === 'avenue') player.spawn(5 * CELL_X + 10, 0, 8 * CELL_Z + 30);
  if (sp === 'aveair') { player.spawn(5 * CELL_X + 10, 48, 13 * CELL_Z); player.v.set(0, 2, 26); }
  if (Q.has('yaw')) cam.yaw = +Q.get('yaw');
}
cam.pos.copy(player.p).add(new THREE.Vector3(-Math.sin(cam.yaw) * 7, 3, -Math.cos(cam.yaw) * 7));

// ---------- input ----------
const inp = { mx: 0, my: 0, jump: false, swing: false, sprint: false, swingUsed: false };
const keys = new Set();
addEventListener('keydown', e => { keys.add(e.code); if (e.code === 'Space') { inp.jump = true; e.preventDefault(); } if (e.code === 'KeyM') hud.toggleBigMap(); });
addEventListener('keyup', e => keys.delete(e.code));
const cv = renderer.domElement;
let mouseSwing = false;
cv.addEventListener('mousedown', e => { if (!started) return; if (document.pointerLockElement !== cv && !mobile) cv.requestPointerLock?.(); if (e.button === 0) mouseSwing = true; });
addEventListener('mouseup', e => { if (e.button === 0) mouseSwing = false; });
addEventListener('mousemove', e => {
  if (document.pointerLockElement === cv) { cam.yaw -= e.movementX * 0.0024; cam.pitch = THREE.MathUtils.clamp(cam.pitch + e.movementY * 0.002, -0.5, 1.2); cam.lastLook = performance.now(); }
});
// touch: left joystick, right-drag look, buttons
const touch = { stick: null, look: null, sx: 0, sy: 0 };
const stickEl = document.getElementById('stick'), knob = document.getElementById('knob');
const onTouch = (e) => {
  for (const t of e.changedTouches) {
    const tgt = t.target.closest && t.target.closest('.tbtn');
    if (e.type === 'touchstart') {
      if (tgt) continue;
      if (t.clientX < innerWidth * 0.42 && touch.stick === null) { touch.stick = t.identifier; touch.sx = t.clientX; touch.sy = t.clientY; stickEl.style.left = (t.clientX - 60) + 'px'; stickEl.style.top = (t.clientY - 60) + 'px'; stickEl.classList.add('on'); }
      else if (touch.look === null) { touch.look = t.identifier; touch.lx = t.clientX; touch.ly = t.clientY; }
    } else if (e.type === 'touchmove') {
      if (t.identifier === touch.stick) {
        let dx = (t.clientX - touch.sx) / 50, dy = (t.clientY - touch.sy) / 50; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
        touch.mx = dx; touch.my = -dy; knob.style.transform = `translate(${dx * 40}px,${dy * 40}px)`;
      } else if (t.identifier === touch.look) {
        cam.yaw -= (t.clientX - touch.lx) * 0.006; cam.pitch = THREE.MathUtils.clamp(cam.pitch + (t.clientY - touch.ly) * 0.004, -0.5, 1.2);
        touch.lx = t.clientX; touch.ly = t.clientY; cam.lastLook = performance.now();
      }
    } else {
      if (t.identifier === touch.stick) { touch.stick = null; touch.mx = touch.my = 0; knob.style.transform = ''; stickEl.classList.remove('on'); }
      if (t.identifier === touch.look) touch.look = null;
    }
  }
  if (e.cancelable && started) e.preventDefault();
};
for (const ev of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) document.addEventListener(ev, onTouch, { passive: false });
let touchSwing = false;
const bSwing = document.getElementById('bSwing'), bJump = document.getElementById('bJump');
bSwing.addEventListener('touchstart', e => { touchSwing = true; bSwing.classList.add('down'); e.preventDefault(); }, { passive: false });
bSwing.addEventListener('touchend', e => { touchSwing = false; bSwing.classList.remove('down'); e.preventDefault(); }, { passive: false });
bJump.addEventListener('touchstart', e => { inp.jump = true; bJump.classList.add('down'); e.preventDefault(); }, { passive: false });
bJump.addEventListener('touchend', e => { bJump.classList.remove('down'); e.preventDefault(); }, { passive: false });

// autopilot for verification / attract mode (?auto=1)
const auto = Q.has('auto');
let autoT = 0;

let started = Q.has('auto') || Q.has('play');
const title = document.getElementById('title');
if (started) title.style.display = 'none';
title.addEventListener('click', () => { started = true; title.style.display = 'none'; if (!mobile) cv.requestPointerLock?.(); else document.documentElement.requestFullscreen?.().catch(() => {}); });
document.body.classList.toggle('mobile', mobile);

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ---------- camera ----------
const tv = new THREE.Vector3(), tv2 = new THREE.Vector3();
function updateCamera(dt) {
  const sp = player.speed();
  // auto-follow velocity when player is not steering the view
  const idle = performance.now() - cam.lastLook > 1400;
  const hv = Math.hypot(player.v.x, player.v.z);
  if ((idle || auto) && hv > 5 && player.state !== 'wall') {
    const vy = Math.atan2(player.v.x, player.v.z); let d = vy - cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    cam.yaw += d * Math.min(1, dt * (auto ? 1.6 : 0.9));
  }
  const dist = cam.dist + Math.min(sp, 50) * 0.035 + (player.state === 'swing' ? 0.8 : 0);
  const target = tv.copy(player.p); target.y += 1.7;
  const cp = Math.cos(cam.pitch);
  const desired = tv2.set(-Math.sin(cam.yaw) * cp * dist, Math.sin(cam.pitch) * dist + 0.6, -Math.cos(cam.yaw) * cp * dist).add(target);
  // occlusion
  const dir = desired.clone().sub(target), L = dir.length(); dir.divideScalar(L);
  const hit = city.raycast(target, dir, L);
  if (hit) desired.copy(target).addScaledVector(dir, Math.max(1.2, hit.t - 0.4));
  if (desired.y < 0.6) desired.y = 0.6;
  const lag = 1 - Math.exp(-dt * (player.state === 'swing' ? 7 : 10));
  cam.pos.lerp(desired, lag);
  // hard constraint: never trail too far
  const off = cam.pos.clone().sub(target); if (off.length() > dist * 1.6) cam.pos.copy(target).addScaledVector(off.normalize(), dist * 1.6);
  cam.look.lerp(target, 1 - Math.exp(-dt * 18));
  camera.position.copy(cam.pos); camera.lookAt(cam.look);
  const fov = 66 + Math.min(Math.max(sp - 10, 0), 45) * 0.45;
  cam.fov += (fov - cam.fov) * Math.min(1, dt * 3);
  camera.fov = cam.fov; camera.updateProjectionMatrix();
}

// ---------- loop ----------
let last = performance.now(), fpsAcc = 0, fpsN = 0, fps = 60;
const clock = { t: 0 };
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (Q.has('fixed')) dt = 1 / 30;
  clock.t += dt;
  // gather input
  inp.mx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + (touch.mx || 0);
  inp.my = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) + (touch.my || 0);
  inp.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight') || mobile || auto;
  inp.swing = mouseSwing || touchSwing || keys.has('KeyE') || keys.has('KeyF');
  if (auto) {
    autoT += dt; inp.my = 1; inp.mx = Math.sin(autoT * 0.4) * 0.25;
    const cyc = autoT % 2.4; inp.swing = cyc < 1.9;
    if (player.state === 'ground') inp.jump = true;
  }
  if (!started) { inp.mx = inp.my = 0; inp.swing = false; }
  player.update(dt, inp, cam);
  traffic.update(dt, player.p);
  updateCamera(dt);
  // shadow camera follows player, snapped to texels
  const texel = (SH * 2) / quality.shadow;
  const c = player.p.clone(); c.x = Math.round(c.x / texel) * texel; c.z = Math.round(c.z / texel) * texel;
  sun.target.position.copy(c); sun.position.copy(c).addScaledVector(SUN_DIR, 300);
  sky.position.copy(camera.position);
  hud.update(dt, player, cam, camera, inp, fps);
  inp.noAnchor = false;
  renderer.render(scene, camera);
  fpsAcc += dt; fpsN++; if (fpsAcc > 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
}
requestAnimationFrame(frame);
window.__gt = () => clock.t;
window.__game = { player, cam, city, traffic, hud, inp, renderer, scene, camera, get fps() { return fps; } };
