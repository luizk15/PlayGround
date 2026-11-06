import * as THREE from 'three';

/* ============================================================
   Procedural 3D weapon collection — 26 entries.
   Every gun is assembled from primitives and shares one palette
   language: gunmetal, polymer, wood, warning accents and emissive
   sci-fi parts. Models point down -Z (camera forward).
   ============================================================ */

const _matCache = new Map();
export function mat(color, metalness = 0.55, roughness = 0.48, emissive = null, emissiveIntensity = 0) {
  const key = `${color}|${metalness}|${roughness}|${emissive}|${emissiveIntensity}`;
  if (_matCache.has(key)) return _matCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color, metalness, roughness,
    emissive: emissive || 0x000000,
    emissiveIntensity,
  });
  _matCache.set(key, m);
  return m;
}
export const M = {
  gun: mat(0x1b1f21, 0.82, 0.35),
  gun2: mat(0x2e3437, 0.72, 0.42),
  black: mat(0x101314, 0.55, 0.52),
  poly: mat(0x232829, 0.12, 0.74),
  poly2: mat(0x353b3a, 0.08, 0.78),
  steel: mat(0x8a9294, 0.92, 0.28),
  chrome: mat(0xc8cecd, 0.98, 0.16),
  brass: mat(0xb88a44, 0.9, 0.3),
  gold: mat(0xc79b4a, 0.95, 0.24),
  wood: mat(0x6b3c22, 0.1, 0.62),
  wood2: mat(0x8b552f, 0.08, 0.56),
  tan: mat(0x9b8a67, 0.1, 0.72),
  olive: mat(0x4c5237, 0.15, 0.68),
  green: mat(0x344a2e, 0.3, 0.6),
  red: mat(0x9f291c, 0.4, 0.45),
  orange: mat(0xb85a1f, 0.3, 0.5),
  blue: mat(0x2e6176, 0.5, 0.4),
  ice: mat(0x75d7e8, 0.3, 0.2, 0x43cfe8, 1.4),
  plasma: mat(0x7dff6e, 0.3, 0.2, 0x53ff48, 2.2),
  energy: mat(0x66e6ff, 0.25, 0.18, 0x3ddcff, 2.0),
  fire: mat(0xff7a32, 0.1, 0.3, 0xff571a, 1.8),
  sight: mat(0x0a0c0c, 0.4, 0.3),
  lens: new THREE.MeshStandardMaterial({ color: 0x3e6a78, metalness: 0.9, roughness: 0.08, emissive: 0x173a46, emissiveIntensity: 0.5 }),
};

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cylY = (r, h, seg = 10) => new THREE.CylinderGeometry(r, r, h, seg);
const cylZ = (r, h, seg = 10) => { const g = new THREE.CylinderGeometry(r, r, h, seg); g.rotateX(Math.PI / 2); return g; };
const coneZ = (r, h, seg = 10) => { const g = new THREE.CylinderGeometry(0, r, h, seg); g.rotateX(-Math.PI / 2); return g; };
const coneY = (r, h, seg = 10) => new THREE.CylinderGeometry(r, 0, h, seg);
const sphere = (r, seg = 10) => new THREE.SphereGeometry(r, seg, Math.max(6, seg / 2));
const torus = (r, tube, seg = 8, rings = 16) => new THREE.TorusGeometry(r, tube, seg, rings);

function add(g, geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = false;
  m.receiveShadow = false;
  g.add(m);
  return m;
}
function group(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
function muzzle(g, x, y, z) { const o = new THREE.Object3D(); o.position.set(x, y, z); g.add(o); g.userData.muzzle = o; return o; }

function baseGun() {
  const g = new THREE.Group();
  g.userData.spinParts = [];
  g.userData.magazine = null;
  g.userData.pump = null;
  g.userData.bolt = null;
  g.userData.glow = null;
  g.userData.wheels = [];
  return g;
}

/* ---------- PISTOLS ---------- */
function m1911() {
  const g = baseGun();
  add(g, box(0.066, 0.073, 0.33), M.gun, 0, 0.015, -0.17);
  add(g, box(0.06, 0.043, 0.22), M.steel, 0, -0.028, -0.13);
  const grip = add(g, box(0.058, 0.16, 0.076), M.wood, 0, -0.115, 0.005, 0.2);
  add(g, box(0.062, 0.017, 0.07), M.black, 0, -0.04, -0.08);
  add(g, torus(0.035, 0.005, 6, 12), M.gun2, 0, -0.067, -0.105, 0, Math.PI / 2, 0);
  add(g, cylZ(0.014, 0.035), M.black, 0, 0.018, -0.36);
  add(g, box(0.008, 0.012, 0.018), M.steel, 0, 0.058, -0.295);
  add(g, box(0.01, 0.016, 0.012), M.steel, 0, 0.058, 0.01);
  add(g, box(0.006, 0.02, 0.012), M.steel, 0, 0.052, 0.062, -0.5);
  add(g, box(0.07, 0.008, 0.05), M.black, 0, -0.048, -0.03, 0.15);
  muzzle(g, 0, 0.018, -0.38);
  g.userData.twoHanded = false;
  g.userData.gripPos = [0, -0.1, 0.02];
  g.userData.supportPos = null;
  g.userData.hold = 1;
  return g;
}
function deagle() {
  const g = baseGun();
  add(g, box(0.078, 0.09, 0.38), M.chrome, 0, 0.02, -0.19);
  add(g, box(0.07, 0.045, 0.25), M.gun2, 0, -0.035, -0.14);
  add(g, box(0.066, 0.175, 0.085), M.poly, 0, -0.13, 0.015, 0.22);
  add(g, box(0.045, 0.16, 0.012), M.gold, 0, -0.13, 0.061, 0.22);
  add(g, box(0.05, 0.012, 0.11), M.gold, 0, 0.068, -0.26);
  add(g, cylZ(0.018, 0.05), M.black, 0, 0.02, -0.41);
  add(g, box(0.01, 0.017, 0.018), M.red, 0, 0.072, -0.32);
  add(g, torus(0.038, 0.006, 6, 12), M.gun2, 0, -0.078, -0.115, 0, Math.PI / 2, 0);
  muzzle(g, 0, 0.02, -0.44);
  g.userData.twoHanded = false;
  g.userData.gripPos = [0, -0.115, 0.03];
  g.userData.supportPos = null;
  g.userData.hold = 1;
  return g;
}
function raygun() {
  const g = baseGun();
  add(g, box(0.1, 0.11, 0.22), M.green, 0, 0, -0.08);
  const body = add(g, sphere(0.08), M.olive, 0, 0.01, -0.2); body.scale.set(1, 1.15, 1.5);
  add(g, cylZ(0.055, 0.22, 16), M.gun, 0, 0.015, -0.32);
  for (let i = 0; i < 3; i++) add(g, torus(0.058, 0.012, 8, 18), M.energy, 0, 0.015, -0.26 - i * 0.06);
  add(g, sphere(0.045, 16), M.plasma, 0, 0.015, -0.42);
  const tip = add(g, coneZ(0.075, 0.1, 16), M.energy, 0, 0.015, -0.47); tip.material = M.energy;
  add(g, box(0.07, 0.17, 0.09), M.green, 0, -0.12, 0.02, 0.22);
  add(g, box(0.08, 0.03, 0.1), M.plasma, 0, -0.05, 0.03);
  add(g, cylY(0.02, 0.09, 10), M.energy, 0, 0.11, -0.04);
  add(g, sphere(0.034, 12), M.plasma, 0, 0.16, -0.04);
  add(g, box(0.02, 0.03, 0.2), M.steel, 0.055, 0.04, -0.2);
  muzzle(g, 0, 0.015, -0.5);
  g.userData.twoHanded = false;
  g.userData.gripPos = [0, -0.11, 0.025];
  g.userData.supportPos = null;
  g.userData.glow = M.plasma;
  return g;
}

/* ---------- SMG ---------- */
function mp5() {
  const g = baseGun();
  add(g, box(0.075, 0.11, 0.34), M.gun, 0, 0, -0.11);
  add(g, cylZ(0.022, 0.22), M.black, 0, 0.018, -0.35);
  add(g, cylZ(0.038, 0.17), M.poly, 0, 0.018, -0.33);
  add(g, box(0.05, 0.2, 0.07), M.poly, 0, -0.15, -0.08, 0.06);
  add(g, box(0.044, 0.06, 0.05), M.gun2, 0, -0.07, 0.02, 0.22);
  add(g, box(0.05, 0.09, 0.18), M.poly, 0, 0.01, 0.18);
  add(g, box(0.065, 0.06, 0.1), M.poly, 0, 0.02, 0.31);
  add(g, box(0.02, 0.03, 0.12), M.steel, 0, 0.085, -0.12);
  add(g, box(0.014, 0.06, 0.05), M.steel, 0, 0.1, 0.02);
  add(g, cylZ(0.007, 0.08), M.steel, 0.048, 0.045, -0.08);
  add(g, torus(0.034, 0.004, 6, 12), M.gun2, 0, -0.078, -0.09, 0, Math.PI / 2, 0);
  muzzle(g, 0, 0.018, -0.47);
  g.userData.twoHanded = true;
  g.userData.gripPos = [0, -0.06, 0.03];
  g.userData.supportPos = [0, -0.01, -0.31];
  return g;
}
function ump45() {
  const g = baseGun();
  add(g, box(0.085, 0.12, 0.32), M.poly, 0, 0, -0.1);
  add(g, box(0.075, 0.07, 0.2), M.poly2, 0, 0.03, -0.24);
  add(g, cylZ(0.024, 0.16), M.black, 0, 0.02, -0.37);
  add(g, box(0.05, 0.2, 0.075), M.poly, 0, -0.15, -0.06, 0.1);
  add(g, box(0.05, 0.08, 0.06), M.poly, 0, -0.085, 0.02, 0.24);
  add(g, box(0.04, 0.07, 0.18), M.poly2, 0, 0.02, 0.13);
  add(g, box(0.06, 0.12, 0.06), M.poly, 0, 0.035, 0.24);
  add(g, box(0.02, 0.05, 0.19), M.steel, 0, 0.085, -0.14);
  add(g, box(0.022, 0.026, 0.06), M.red, 0, 0.09, -0.26);
  muzzle(g, 0, 0.02, -0.46);
  g.userData.twoHanded = true;
  g.userData.gripPos = [0, -0.07, 0.03];
  g.userData.supportPos = [0, 0.01, -0.32];
  return g;
}
function p90() {
  const g = baseGun();
  add(g, box(0.09, 0.13, 0.44), M.poly, 0, 0, -0.12);
  add(g, box(0.095, 0.07, 0.3), M.poly2, 0, 0.09, -0.13);
  add(g, box(0.06, 0.04, 0.32), M.gun, 0, 0.145, -0.13);
  add(g, cylZ(0.02, 0.14), M.black, 0, 0.02, -0.4);
  add(g, cylZ(0.032, 0.1), M.poly2, 0, 0.02, -0.35);
  add(g, box(0.055, 0.16, 0.08), M.poly, 0, -0.13, 0.02, 0.18);
  add(g, box(0.075, 0.035, 0.1), M.black, 0, 0.18, -0.06);
  add(g, box(0.055, 0.05, 0.1), M.glass || M.lens, 0, 0.055, 0.04);
  add(g, box(0.012, 0.02, 0.3), M.steel, 0.053, 0.04, -0.11);
  add(g, box(0.075, 0.06, 0.015), M.black, 0, 0.17, 0.04);
  muzzle(g, 0, 0.02, -0.47);
  g.userData.twoHanded = true;
  g.userData.gripPos = [0, -0.1, 0.03];
  g.userData.supportPos = [0, -0.06, -0.05];
  return g;
}

/* ---------- RIFLES ---------- */
function ak47() {
  const g = baseGun();
  add(g, box(0.082, 0.12, 0.4), M.gun, 0, 0, -0.12);
  add(g, box(0.07, 0.065, 0.21), M.wood, 0, 0.035, -0.34);
  add(g, box(0.036, 0.04, 0.16), M.steel, 0, 0.085, -0.38);
  add(g, cylZ(0.019, 0.28), M.black, 0, 0.02, -0.51);
  add(g, cylZ(0.031, 0.09), M.steel, 0, 0.02, -0.61);
  add(g, box(0.05, 0.13, 0.07), M.wood, 0, -0.09, 0.03, 0.25);
  const mag = add(g, box(0.06, 0.22, 0.105), M.orange, 0, -0.16, -0.13, -0.36);
  g.userData.magazine = mag;
  add(g, box(0.05, 0.04, 0.14), M.black, 0, -0.11, -0.21, 0.05);
  add(g, box(0.065, 0.1, 0.26), M.wood, 0, -0.02, 0.27);
  add(g, box(0.018, 0.045, 0.04), M.steel, 0, 0.095, -0.5);
  add(g, box(0.013, 0.045, 0.024), M.steel, 0, 0.09, -0.12);
  add(g, box(0.018, 0.035, 0.03), M.steel, 0, 0.1, -0.33);
  add(g, box(0.024, 0.012, 0.11), M.orange, 0.05, 0.05, -0.16);
  muzzle(g, 0, 0.02, -0.665);
  g.userData.twoHanded = true;
  g.userData.gripPos = [0, -0.075, 0.04];
  g.userData.supportPos = [0, 0.02, -0.38];
  return g;
}
function m4a1() {
  const g = baseGun();
  add(g, box(0.072, 0.105, 0.4), M.gun, 0, 0, -0.12);
  add(g, box(0.08, 0.085, 0.24), M.poly, 0, 0.015, -0.34);
  add(g, box(0.07, 0.025, 0.3), M.gun2, 0, 0.07, -0.17);
  add(g, cylZ(0.016, 0.24), M.black, 0, 0.02, -0.53);
  add(g, cylZ(0.024, 0.07), M.steel, 0, 0.02, -0.65);
  add(g, box(0.05, 0.19, 0.08), M.poly, 0, -0.15, -0.1, 0.05);
  const mag = add(g, box(0.05, 0.17, 0.09), M.gun2, 0, -0.145, -0.13, -0.13);
  g.userData.magazine = mag;
  add(g, box(0.045, 0.14, 0.065), M.poly, 0, -0.09, 0.03, 0.3);
  add(g, box(0.06, 0.09, 0.24), M.poly, 0, -0.01, 0.25);
  add(g, box(0.055, 0.07, 0.12), M.poly2, 0, 0.02, 0.38);
  add(g, box(0.03, 0.03, 0.26), M.gun2, 0, 0.095, -0.16);
  add(g, box(0.028, 0.045, 0.03), M.sight, 0, 0.13, -0.02);
  add(g, cylZ(0.035, 0.04), M.sight, 0, 0.13, -0.02);
  add(g, box(0.02, 0.045, 0.02), M.sight, 0, 0.1, -0.45);
  add(g, box(0.018, 0.03, 0.03), M.steel, 0.055, 0.03, -0.15);
  muzzle(g, 0, 0.02, -0.69);
  g.userData.twoHanded = true;
  g.userData.gripPos = [0, -0.07, 0.03];
  g.userData.supportPos = [0, 0.02, -0.4];
  return g;
}
function scar() {
  const g = baseGun();
  add(g, box(0.09, 0.13, 0.43), M.tan, 0, 0, -0.13);
  add(g, box(0.075, 0.06, 0.18), M.gun2, 0, 0.03, -0.39);
  add(g, cylZ(0.02, 0.24), M.black, 0, 0.02, -0.53);
  add(g, cylZ(0.032, 0.09), M.black, 0, 0.02, -0.62);
  add(g, box(0.055, 0.21, 0.1), M.tan, 0, -0.16, -0.12, -0.25);
  const mag = add(g, box(0.058, 0.19, 0.1), M.gun2, 0, -0.17, -0.12, -0.1);
  g.userData.magazine = mag;
  add(g, box(0.055, 0.15, 0.075), M.tan, 0, -0.095, 0.035, 0.28);
  add(g, box(0.075, 0.1, 0.3), M.tan, 0, -0.01, 0.27);
  add(g, box(0.065, 0.13, 0.055), M.poly, 0, 0.03, 0.42);
  add(g, box(0.075, 0.025, 0.34), M.gun2, 0, 0.075, -0.19);
  add(g, box(0.02, 0.05, 0.035), M.sight, 0, 0.105, -0.08);
  add(g, box(0.03, 0.05, 0.08), M.sight, 0, 0.1, 0.0);
  add(g, box(0.02, 0.05, 0.025), M.sight, 0, 0.1, -0.55);
  muzzle(g, 0, 0.02, -0.675);
  g.userData.twoHanded = true;
  g.userData.gripPos = [0, -0.07, 0.04];
  g.userData.supportPos = [0, 0.02, -0.41];
  return g;
}

/* ---------- SHOTGUNS ---------- */
function remington() {
  const g = baseGun();
  add(g, box(0.075, 0.1, 0.28), M.gun, 0, 0, -0.06);
  add(g, cylZ(0.027, 0.55), M.black, 0, 0.035, -0.45);
  add(g, cylZ(0.021, 0.48), M.gun, 0, -0.02, -0.42);
  const pump = group(g, 0, -0.018, -0.38);
  add(pump, box(0.085, 0.085, 0.2), M.wood, 0, 0, 0);
  for (let i = -2; i <= 2; i++) add(pump, box(0.088, 0.008, 0.012), M.wood2, 0, 0.048, i * 0.035);
  g.userData.pump = pump;
  add(g, box(0.07, 0.14, 0.09), M.wood, 0, -0.09, 0.02, 0.25);
  add(g, box(0.075, 0.12, 0.3), M.wood, 0, -0.03, 0.26);
  add(g, box(0.08, 0.16, 0.07), M.wood2, 0, -0.1, 0.4);
  add(g, cylZ(0.012, 0.04), M.brass, 0, -0.02, -0.67);
  muzzle(g, 0, 0.035, -0.72);
  g.userData.twoHanded = true;
  g.userData.gripPos = [0, -0.07, 0.03];
  g.userData.supportPos = [0, -0.018, -0.38];
  g.userData.pumpRange = 0.07;
  return g;
}
function spas() {
  const g = baseGun();
  add(g, box(0.09, 0.12, 0.3), M.gun, 0, 0, -0.07);
  add(g, cylZ(0.026, 0.48), M.black, 0, 0.03, -0.43);
  add(g, cylZ(0.028, 0.35), M.gun2, 0, 0.03, -0.4);
  for (let i = 0; i < 5; i++) add(g, torus(0.033, 0.006, 6, 12), M.steel, 0, 0.03, -0.3 - i * 0.07);
  add(g, cylZ(0.018, 0.36), M.black, 0, -0.025, -0.39);
  const pump = group(g, 0, -0.01, -0.36);
  add(pump, box(0.085, 0.085, 0.18), M.poly, 0, 0, 0);
  add(pump, box(0.09, 0.018, 0.16), M.poly2, 0, 0.045, 0);
  g.userData.pump = pump;
  add(g, box(0.06, 0.14, 0.085), M.poly, 0, -0.1, 0.01, 0.22);
  add(g, box(0.045, 0.035, 0.35), M.steel, 0.05, 0.01, 0.22);
  add(g, box(0.06, 0.14, 0.08), M.poly, 0, -0.08, 0.3);
  add(g, box(0.07, 0.075, 0.22), M.poly, 0, 0.045, 0.2);
  add(g, box(0.026, 0.05, 0.04), M.steel, 0, 0.11, -0.35);
  muzzle(g, 0, 0.03, -0.67);
  g.userData.twoHanded = true;
  g.userData.gripPos = [0, -0.075, 0.03];
  g.userData.supportPos = [0, -0.012, -0.36];
  return g;
}
function aa12() {
  const g = baseGun();
  add(g, box(0.095, 0.12, 0.38), M.gun, 0, 0, -0.1);
  add(g, box(0.07, 0.06, 0.24), M.gun2, 0, 0.035, -0.35);
  add(g, cylZ(0.028, 0.2), M.black, 0, 0.02, -0.5);
  add(g, cylZ(0.036, 0.06), M.steel, 0, 0.02, -0.61);
  add(g, cylZ(0.105, 0.12, 18), M.poly, 0, -0.16, -0.08);
  add(g, cylZ(0.08, 0.13, 18), M.gun2, 0, -0.16, -0.08);
  const mag = group(g, 0, -0.16, -0.08);
  add(mag, cylY(0.105, 0.12, 18), M.poly, 0, 0, 0);
  for (let i = 0; i < 6; i++) add(mag, cylY(0.018, 0.125, 8), M.orange, Math.cos(i * 1.04) * 0.06, 0, Math.sin(i * 1.04) * 0.06);
  g.userData.magazine = mag;
  add(g, box(0.05, 0.15, 0.08), M.poly, 0, -0.1, 0.04, 0.25);
  add(g, box(0.055, 0.08, 0.26), M.poly, 0, -0.01, 0.25);
  add(g, box(0.04, 0.1, 0.06), M.poly2, 0, 0.02, 0.38);
  add(g, box(0.03, 0.03, 0.2), M.gun2, 0, 0.08, -0.2);
  add(g, box(0.02, 0.04, 0.03), M.sight, 0, 0.105, -0.06);
  add(g, box(0.018, 0.03, 0.02), M.sight, 0, 0.1, -0.46);
  muzzle(g, 0, 0.02, -0.65);
  g.userData.twoHanded = true;
  g.userData.gripPos = [0, -0.075, 0.04];
  g.userData.supportPos = [0, 0.01, -0.36];
  return g;
}

/* ---------- SNIPERS ---------- */
function awp() {
  const g = baseGun();
  add(g, box(0.08, 0.1, 0.45), M.olive, 0, 0, -0.12);
  add(g, box(0.075, 0.12, 0.3), M.green, 0, -0.02, 0.22);
  add(g, box(0.08, 0.16, 0.06), M.green, 0, -0.09, 0.4);
  add(g, box(0.05, 0.14, 0.08), M.olive, 0, -0.1, 0.02, 0.23);
  add(g, cylZ(0.02, 0.58), M.gun, 0, 0.02, -0.58);
  add(g, cylZ(0.033, 0.1), M.black, 0, 0.02, -0.84);
  const scope = group(g, 0, 0.115, -0.14);
  add(scope, cylZ(0.043, 0.29, 16), M.black, 0, 0, 0);
  add(scope, coneZ(0.058, 0.08, 16), M.gun, 0, 0, -0.18);
  add(scope, cylZ(0.055, 0.03, 16), M.gun, 0, 0, -0.22);
  add(scope, cylZ(0.046, 0.02, 16), M.lens, 0, 0, -0.225);
  add(scope, cylZ(0.044, 0.03, 16), M.gun, 0, 0, 0.16);
  add(scope, box(0.03, 0.06, 0.03), M.black, 0, -0.065, -0.06);
  add(scope, box(0.03, 0.06, 0.03), M.black, 0, -0.065, 0.08);
  add(g, box(0.045, 0.04, 0.1), M.black, 0, -0.07, -0.13);
  add(g, box(0.05, 0.05, 0.06), M.black, 0, 0.04, -0.74);
  add(g, box(0.035, 0.055, 0.02), M.black, 0, 0.07, -0.02);
  add(g, box(0.02, 0.03, 0.07), M.steel, 0.05, 0.04, -0.1);
  muzzle(g, 0, 0.02, -0.9);
  g.userData.twoHanded = true;
  g.userData.gripPos = [0, -0.08, 0.04];
  g.userData.supportPos = [0, -0.02, -0.36];
  g.userData.boltAction = true;
  return g;
}
function barrett() {
  const g = baseGun();
  add(g, box(0.1, 0.14, 0.55), M.gun, 0, 0, -0.13);
  add(g, box(0.08, 0.06, 0.2), M.gun2, 0, 0.055, -0.35);
  add(g, box(0.09, 0.16, 0.25), M.tan, 0, -0.02, 0.24);
  add(g, box(0.075, 0.18, 0.06), M.poly, 0, -0.1, 0.42);
  add(g, box(0.06, 0.15, 0.09), M.poly, 0, -0.11, 0.02, 0.2);
  add(g, cylZ(0.027, 0.8, 14), M.gun, 0, 0.02, -0.72);
  const brake = group(g, 0, 0.02, -1.08);
  add(brake, cylZ(0.045, 0.15, 14), M.black, 0, 0, 0);
  for (let i = 0; i < 3; i++) add(brake, box(0.1, 0.014, 0.015), M.steel, 0, 0.04, -0.05 + i * 0.035);
  const scope = group(g, 0, 0.16, -0.16);
  add(scope, cylZ(0.056, 0.42, 18), M.black, 0, 0, 0);
  add(scope, coneZ(0.073, 0.11, 18), M.gun, 0, 0, -0.27);
  add(scope, cylZ(0.068, 0.04, 18), M.gun, 0, 0, -0.33);
  add(scope, cylZ(0.058, 0.02, 18), M.lens, 0, 0, -0.34);
  add(scope, cylZ(0.058, 0.035, 18), M.gun, 0, 0, 0.235);
  add(scope, box(0.035, 0.09, 0.04), M.black, 0, -0.09, -0.09);
  add(scope, box(0.035, 0.09, 0.04), M.black, 0, -0.09, 0.1);
  add(g, box(0.035, 0.06, 0.12), M.black, 0, -0.075, -0.2);
  add(g, box(0.05, 0.02, 0.15), M.gun2, 0, 0.13, -0.15);
  muzzle(g, 0, 0.02, -1.16);
  g.userData.twoHanded = true;
  g.userData.gripPos = [0, -0.085, 0.05];
  g.userData.supportPos = [0, 0.0, -0.4];
  g.userData.boltAction = true;
  return g;
}

/* ---------- LMG / HEAVY ---------- */
function m249() {
  const g = baseGun();
  add(g, box(0.11, 0.15, 0.52), M.olive, 0, 0, -0.1);
  add(g, box(0.08, 0.07, 0.22), M.gun2, 0, 0.055, -0.35);
  add(g, cylZ(0.025, 0.5), M.gun, 0, 0.02, -0.55);
  add(g, cylZ(0.043, 0.08), M.black, 0, 0.02, -0.81);
  add(g, box(0.14, 0.2, 0.22), M.olive, 0, -0.18, -0.08);
  add(g, box(0.13, 0.035, 0.18), M.gun2, 0, -0.07, -0.08);
  const mag = group(g, 0, -0.18, -0.08);
  add(mag, box(0.14, 0.2, 0.22), M.olive, 0, 0, 0);
  add(mag, box(0.12, 0.02, 0.16), M.brass, 0, 0.04, -0.02);
  g.userData.magazine = mag;
  add(g, box(0.055, 0.16, 0.08), M.poly, 0, -0.11, 0.03, 0.25);
  add(g, box(0.075, 0.1, 0.25), M.olive, 0, -0.02, 0.25);
  add(g, box(0.065, 0.14, 0.06), M.poly, 0, -0.02, 0.4);
  add(g, box(0.06, 0.07, 0.15), M.poly2, 0, 0.02, 0.36);
  add(g, box(0.03, 0.04, 0.2), M.gun2, 0, 0.09, -0.18);
  add(g, box(0.02, 0.045, 0.025), M.sight, 0, 0.11, -0.46);
  add(g, box(0.02, 0.045, 0.025), M.sight, 0, 0.11, 0.02);
  add(g, cylZ(0.014, 0.42), M.steel, 0.075, 0.025, -0.52);
  add(g, cylZ(0.014, 0.32), M.steel, 0.075, -0.02, -0.56, 0.2);
  muzzle(g, 0, 0.02, -0.88);
  g.userData.twoHanded = true;
  g.userData.gripPos = [0, -0.09, 0.04];
  g.userData.supportPos = [0, 0.01, -0.42];
  return g;
}
function minigun() {
  const g = baseGun();
  add(g, box(0.16, 0.16, 0.4), M.gun, 0, 0, -0.05);
  add(g, box(0.12, 0.1, 0.2), M.poly, 0, 0.08, 0.03);
  add(g, cylZ(0.105, 0.12, 18), M.gun2, 0, 0.0, -0.27);
  const barrels = group(g, 0, 0, -0.25);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    add(barrels, cylZ(0.018, 0.72, 8), M.steel, Math.cos(a) * 0.07, Math.sin(a) * 0.07, -0.36);
  }
  add(barrels, torus(0.085, 0.012, 8, 20), M.gun, 0, 0, -0.12);
  add(barrels, torus(0.085, 0.012, 8, 20), M.gun, 0, 0, -0.55);
  add(barrels, cylZ(0.1, 0.06, 18), M.gun2, 0, 0, -0.02);
  g.userData.spinParts.push(barrels);
  add(g, box(0.07, 0.18, 0.1), M.poly, 0.1, -0.12, 0.1, 0, 0, -0.2);
  add(g, box(0.06, 0.18, 0.08), M.poly, -0.11, -0.1, 0.08, 0, 0, 0.2);
  add(g, box(0.09, 0.12, 0.32), M.olive, -0.12, -0.1, 0.33);
  add(g, box(0.12, 0.05, 0.16), M.brass, -0.03, -0.16, 0.22);
  add(g, box(0.13, 0.12, 0.03), M.gun, 0, 0.0, 0.23);
  add(g, box(0.015, 0.05, 0.03), M.sight, 0, 0.105, -0.3);
  muzzle(g, 0, 0, -0.78);
  g.userData.twoHanded = true;
  g.userData.gripPos = [0.09, -0.12, 0.08];
  g.userData.supportPos = [-0.08, -0.11, 0.26];
  g.userData.spinUp = true;
  return g;
}

/* ---------- EXPLOSIVES / SPECIAL ---------- */
function rpg() {
  const g = baseGun();
  add(g, cylZ(0.075, 1.25, 18), M.olive, 0, 0.02, -0.35);
  add(g, cylZ(0.095, 0.16, 18), M.green, 0, 0.02, 0.25);
  add(g, coneZ(0.075, 0.13, 18), M.green, 0, 0.02, 0.33);
  add(g, cylZ(0.09, 0.14, 18), M.olive, 0, 0.02, -0.86);
  const warhead = group(g, 0, 0.02, -1.02);
  add(warhead, coneZ(0.075, 0.25, 18), M.red, 0, 0, -0.11);
  add(warhead, cylZ(0.045, 0.2, 14), M.gun2, 0, 0, 0.09);
  add(warhead, torus(0.05, 0.01, 6, 12), M.brass, 0, 0, 0.02);
  g.userData.warhead = warhead;
  add(g, box(0.06, 0.18, 0.09), M.wood, 0.04, -0.1, -0.1, 0.2);
  add(g, box(0.06, 0.18, 0.09), M.wood, 0.04, -0.1, 0.14, -0.15);
  add(g, box(0.03, 0.04, 0.2), M.steel, -0.08, 0.1, 0.05);
  add(g, cylY(0.045, 0.2, 14), M.gun, 0.02, 0.16, -0.15);
  add(g, cylZ(0.04, 0.04), M.lens, 0.02, 0.16, -0.27);
  add(g, box(0.02, 0.02, 0.15), M.steel, -0.085, 0.02, 0.08);
  muzzle(g, 0, 0.02, -1.25);
  g.userData.twoHanded = true;
  g.userData.gripPos = [0.04, -0.08, 0.14];
  g.userData.supportPos = [0.04, -0.08, -0.1];
  return g;
}
function m32() {
  const g = baseGun();
  add(g, box(0.11, 0.14, 0.35), M.gun, 0, 0, -0.12);
  add(g, box(0.08, 0.17, 0.1), M.poly, 0, -0.12, 0.01, 0.22);
  add(g, box(0.08, 0.11, 0.24), M.poly, 0, -0.01, 0.24);
  add(g, box(0.075, 0.16, 0.06), M.poly, 0, -0.06, 0.37);
  const wheel = group(g, 0, 0.01, -0.28);
  add(wheel, cylZ(0.13, 0.2, 18), M.gun2, 0, 0, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    add(wheel, cylZ(0.04, 0.24, 12), M.black, Math.cos(a) * 0.075, Math.sin(a) * 0.075, -0.02);
    add(wheel, cylZ(0.046, 0.02, 12), M.orange, Math.cos(a) * 0.075, Math.sin(a) * 0.075, -0.14);
  }
  g.userData.magazine = wheel;
  g.userData.wheels.push(wheel);
  add(g, box(0.08, 0.06, 0.14), M.gun, 0, 0.1, -0.15);
  add(g, box(0.02, 0.05, 0.04), M.sight, 0, 0.14, -0.12);
  add(g, box(0.02, 0.05, 0.04), M.sight, 0, 0.14, -0.4);
  add(g, box(0.05, 0.04, 0.4), M.gun2, 0, 0.1, -0.16);
  muzzle(g, 0, 0.01, -0.43);
  g.userData.twoHanded = true;
  g.userData.gripPos = [0, -0.09, 0.04];
  g.userData.supportPos = [0, -0.04, -0.2];
  return g;
}
function flamethrower() {
  const g = baseGun();
  add(g, box(0.24, 0.28, 0.38), M.olive, 0, -0.02, 0.02);
  add(g, cylY(0.09, 0.34, 14), M.red, -0.17, -0.07, 0.12);
  add(g, cylY(0.09, 0.34, 14), M.red, -0.17, -0.07, 0.25);
  add(g, cylY(0.04, 0.06, 10), M.brass, -0.17, 0.12, 0.12);
  add(g, cylZ(0.035, 0.55), M.steel, 0.03, 0.02, -0.38);
  add(g, cylZ(0.06, 0.28), M.gun2, 0.03, 0.02, -0.3);
  add(g, coneZ(0.075, 0.12, 14), M.gun, 0.03, 0.02, -0.66);
  add(g, torus(0.065, 0.012, 6, 14), M.fire, 0.03, 0.02, -0.71);
  add(g, sphere(0.035, 10), M.fire, 0.03, 0.02, -0.74);
  add(g, box(0.05, 0.15, 0.08), M.poly, 0, -0.13, 0.1, 0.22);
  add(g, box(0.05, 0.11, 0.07), M.poly, 0, -0.13, -0.15, 0.1);
  add(g, cylZ(0.018, 0.9), M.black, -0.08, -0.2, 0.05, 0, 0.6, 0);
  add(g, box(0.08, 0.1, 0.06), M.poly, 0.15, -0.13, 0.08, 0.15);
  add(g, box(0.012, 0.04, 0.05), M.fire, 0.03, 0.09, -0.6);
  muzzle(g, 0.03, 0.02, -0.76);
  g.userData.twoHanded = true;
  g.userData.gripPos = [0, -0.09, 0.12];
  g.userData.supportPos = [0, -0.08, -0.16];
  g.userData.noFlash = true;
  return g;
}
function crossbow() {
  const g = baseGun();
  add(g, box(0.07, 0.08, 0.55), M.wood, 0, 0, -0.18);
  add(g, box(0.045, 0.05, 0.35), M.gun2, 0, 0.03, -0.22);
  const limbs = group(g, 0, 0.02, -0.42);
  add(limbs, box(0.46, 0.035, 0.04), M.black, 0, 0, 0);
  add(limbs, box(0.18, 0.03, 0.035), M.gun2, -0.24, 0.04, 0.02, 0, 0, -0.3);
  add(limbs, box(0.18, 0.03, 0.035), M.gun2, 0.24, 0.04, 0.02, 0, 0, 0.3);
  add(limbs, cylZ(0.006, 0.9, 5), M.steel, 0, 0.02, 0.13);
  add(g, box(0.045, 0.13, 0.08), M.wood, 0, -0.09, 0.02, 0.2);
  add(g, box(0.055, 0.1, 0.2), M.wood, 0, -0.02, 0.17);
  add(g, box(0.06, 0.16, 0.06), M.wood2, 0, -0.09, 0.29);
  const scope = group(g, 0, 0.105, -0.17);
  add(scope, cylZ(0.026, 0.18, 12), M.black, 0, 0, 0);
  add(scope, cylZ(0.032, 0.03, 12), M.lens, 0, 0, -0.1);
  add(scope, box(0.02, 0.04, 0.03), M.black, 0, -0.04, 0.04);
  add(g, cylZ(0.012, 0.7), M.steel, 0, 0.02, -0.55);
  add(g, coneZ(0.025, 0.08), M.steel, 0, 0.02, -0.9);
  muzzle(g, 0, 0.02, -0.92);
  g.userData.twoHanded = true;
  g.userData.gripPos = [0, -0.075, 0.03];
  g.userData.supportPos = [0, 0.0, -0.16];
  g.userData.boltAction = true;
  return g;
}
function nailgun() {
  const g = baseGun();
  add(g, box(0.11, 0.15, 0.28), M.orange, 0, -0.02, -0.04);
  add(g, box(0.08, 0.08, 0.25), M.gun2, 0, 0.06, -0.1);
  add(g, cylZ(0.04, 0.26), M.gun, 0, 0.03, -0.35);
  for (let i = 0; i < 3; i++) add(g, torus(0.052, 0.011, 8, 14), M.brass, 0, 0.03, -0.27 - i * 0.07);
  add(g, cylZ(0.012, 0.15), M.steel, 0, 0.03, -0.43);
  add(g, cylY(0.065, 0.25, 12), M.gun2, -0.13, -0.1, 0.0);
  add(g, cylY(0.055, 0.07, 12), M.brass, -0.13, 0.03, 0.0);
  add(g, box(0.05, 0.16, 0.08), M.poly, 0, -0.14, 0.1, 0.2);
  add(g, box(0.04, 0.12, 0.08), M.poly, 0, -0.12, -0.08, 0.2);
  add(g, box(0.08, 0.02, 0.16), M.orange, 0, 0.11, -0.08);
  add(g, box(0.018, 0.04, 0.025), M.sight, 0, 0.15, -0.02);
  muzzle(g, 0, 0.03, -0.51);
  g.userData.twoHanded = true;
  g.userData.gripPos = [0, -0.1, 0.1];
  g.userData.supportPos = [0, -0.09, -0.08];
  return g;
}
function tesla() {
  const g = baseGun();
  add(g, box(0.11, 0.12, 0.3), M.gun, 0, 0, -0.06);
  add(g, box(0.13, 0.08, 0.22), M.poly2, 0, 0.05, -0.1);
  add(g, cylZ(0.07, 0.3, 16), M.gun2, 0, 0.02, -0.34);
  add(g, cylZ(0.055, 0.28, 16), M.energy, 0, 0.02, -0.34);
  for (let i = 0; i < 4; i++) add(g, torus(0.075, 0.009, 6, 18), M.brass, 0, 0.02, -0.24 - i * 0.065);
  add(g, cylZ(0.075, 0.05, 16), M.gun2, 0, 0.02, -0.5);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    add(g, cylZ(0.007, 0.18), M.steel, Math.cos(a) * 0.06, 0.02 + Math.sin(a) * 0.06, -0.57);
    add(g, sphere(0.014, 8), M.energy, Math.cos(a) * 0.06, 0.02 + Math.sin(a) * 0.06, -0.66);
  }
  add(g, cylZ(0.025, 0.1, 12), M.energy, 0, 0.02, -0.55);
  add(g, box(0.065, 0.19, 0.09), M.gun, 0, -0.13, 0.02, 0.2);
  add(g, box(0.05, 0.06, 0.16), M.poly, 0.11, 0.02, 0.05);
  add(g, cylY(0.02, 0.11, 10), M.energy, -0.1, 0.1, -0.01);
  add(g, box(0.02, 0.02, 0.16), M.steel, 0.08, 0.09, -0.12);
  add(g, box(0.07, 0.03, 0.05), M.energy, 0, 0.12, -0.08);
  muzzle(g, 0, 0.02, -0.69);
  g.userData.twoHanded = true;
  g.userData.gripPos = [0, -0.1, 0.04];
  g.userData.supportPos = [0.02, 0.0, -0.2];
  g.userData.glow = M.energy;
  return g;
}
function freezeRay() {
  const g = baseGun();
  add(g, box(0.13, 0.14, 0.3), M.gun, 0, 0, -0.03);
  add(g, cylZ(0.075, 0.34, 16), M.ice, 0, 0.01, -0.32);
  add(g, cylZ(0.09, 0.06, 16), M.gun2, 0, 0.01, -0.16);
  add(g, coneZ(0.11, 0.16, 16), M.gun2, 0, 0.01, -0.53);
  for (let i = 0; i < 3; i++) add(g, torus(0.088, 0.012, 6, 16), M.ice, 0, 0.01, -0.28 - i * 0.08);
  add(g, sphere(0.055, 12), M.ice, 0, 0.01, -0.57);
  add(g, cylY(0.07, 0.28, 14), M.ice, -0.16, -0.08, -0.03);
  add(g, cylY(0.07, 0.28, 14), M.blue, -0.16, -0.08, 0.12);
  add(g, box(0.06, 0.17, 0.09), M.poly, 0, -0.12, 0.1, 0.2);
  add(g, box(0.05, 0.12, 0.08), M.poly, 0, -0.12, -0.13, 0.15);
  add(g, cylZ(0.02, 0.15), M.ice, 0.11, 0.04, -0.32);
  add(g, box(0.08, 0.04, 0.05), M.ice, 0, 0.12, 0.02);
  muzzle(g, 0, 0.01, -0.66);
  g.userData.twoHanded = true;
  g.userData.gripPos = [0, -0.1, 0.1];
  g.userData.supportPos = [0, -0.08, -0.14];
  g.userData.noFlash = true;
  g.userData.glow = M.ice;
  return g;
}

/* ---------- MELEE ---------- */
function machete() {
  const g = baseGun();
  const blade = add(g, box(0.008, 0.09, 0.46), M.steel, 0, 0.06, -0.30);
  blade.rotation.z = 0.01;
  add(g, box(0.009, 0.1, 0.06), M.gun2, 0, 0.03, -0.51);
  add(g, box(0.012, 0.055, 0.1), M.steel, 0.006, 0.06, -0.34, 0, 0, 0.25);
  add(g, box(0.045, 0.05, 0.12), M.gun, 0, -0.01, -0.02);
  add(g, box(0.034, 0.13, 0.045), M.poly, 0, -0.09, 0.01);
  for (let i = 0; i < 4; i++) add(g, box(0.037, 0.008, 0.046), M.poly2, 0, -0.045 - i * 0.026, 0.01);
  muzzle(g, 0, 0.06, -0.55);
  g.userData.twoHanded = false;
  g.userData.gripPos = [0, -0.08, 0.01];
  g.userData.supportPos = null;
  g.userData.melee = true;
  return g;
}
function katana() {
  const g = baseGun();
  const blade = add(g, box(0.008, 0.035, 0.72), M.chrome, 0, 0.08, -0.38, 0, 0, 0.02);
  blade.scale.y = 1;
  add(g, box(0.009, 0.026, 0.2), M.steel, 0, 0.1, -0.8, 0, 0.06, 0.02);
  add(g, box(0.045, 0.045, 0.075), M.black, 0, 0.02, -0.02);
  add(g, cylY(0.03, 0.2, 10), M.black, 0, -0.07, 0.04, 0.1);
  for (let i = 0; i < 7; i++) add(g, torus(0.032, 0.005, 4, 10), M.red, 0, -0.16 + i * 0.028, 0.04, Math.PI / 2);
  add(g, sphere(0.032, 10), M.brass, 0, -0.18, 0.05);
  muzzle(g, 0, 0.08, -0.88);
  g.userData.twoHanded = true;
  g.userData.gripPos = [0, -0.08, 0.04];
  g.userData.supportPos = [0, -0.03, 0.1];
  g.userData.melee = true;
  return g;
}
function chainsaw() {
  const g = baseGun();
  add(g, box(0.12, 0.19, 0.28), M.orange, 0, 0, 0.04);
  add(g, box(0.08, 0.13, 0.16), M.poly2, 0, 0.06, 0.16);
  add(g, box(0.09, 0.09, 0.22), M.gun, 0, 0.0, -0.15);
  const bar = group(g, 0, 0.01, -0.27);
  add(bar, box(0.055, 0.07, 0.62), M.gun2, 0, 0, -0.25);
  for (let i = 0; i < 15; i++) {
    add(bar, box(0.07, 0.018, 0.024), M.steel, 0, -0.035, -0.54 + i * 0.045);
    add(bar, box(0.07, 0.018, 0.024), M.steel, 0, 0.035, -0.54 + i * 0.045);
  }
  add(bar, cylY(0.05, 0.06, 10), M.gun, 0, 0, -0.56, Math.PI / 2);
  add(bar, cylY(0.05, 0.06, 10), M.gun, 0, 0, 0.06, Math.PI / 2);
  g.userData.spinParts.push(bar);
  add(g, box(0.05, 0.12, 0.08), M.poly, 0.1, -0.07, 0.02, 0, 0, -0.2);
  add(g, box(0.05, 0.12, 0.08), M.poly, 0, -0.1, 0.25, 0.1);
  add(g, box(0.03, 0.1, 0.19), M.poly2, 0.15, 0.04, 0.22, 0, 0, -0.3);
  add(g, box(0.02, 0.04, 0.05), M.red, -0.06, 0.06, 0.06);
  add(g, box(0.015, 0.02, 0.12), M.steel, 0.074, 0.0, 0.04);
  muzzle(g, 0, 0.01, -0.6);
  g.userData.twoHanded = true;
  g.userData.gripPos = [0.09, -0.07, 0.02];
  g.userData.supportPos = [0, -0.09, 0.25];
  g.userData.melee = true;
  g.userData.noFlash = true;
  return g;
}

/* ============================================================
   DATA — 26 weapons, all unlocked
   ============================================================ */
const RAW = [
  {
    id: 'm1911', name: 'M1911', category: 'PISTOLA', catShort: 'PST', slot: 'PISTOLAS',
    desc: 'A velha confiável. Um clássico que nunca deixa de disparar quando o mundo acaba.',
    damage: 38, rpm: 320, mag: 8, reserve: 96, reloadTime: 1.35, spread: 0.009, auto: false,
    pellets: 1, recoil: [0.012, 0.004], penetration: 0, build: m1911,
    sound: { body: 95, crack: 0.32, decay: 0.09, gain: 0.42 }, ammoLabel: '.45 ACP',
  },
  {
    id: 'deagle', name: 'DESERT EAGLE', category: 'PISTOLA', catShort: 'PST', slot: 'PISTOLAS',
    desc: 'Poder de parada em formato de pistola. Dois tiros resolvem quase tudo. O recuo, você aprende.',
    damage: 92, rpm: 170, mag: 7, reserve: 56, reloadTime: 1.7, spread: 0.016, auto: false,
    pellets: 1, recoil: [0.032, 0.011], penetration: 1, build: deagle,
    sound: { body: 70, crack: 0.5, decay: 0.14, gain: 0.7 }, ammoLabel: '.50 AE',
  },
  {
    id: 'raygun', name: 'RAY GUN', category: 'ESPECIAL', catShort: 'ESP', slot: 'ESPECIAIS',
    desc: 'Tecnologia recuperada do acidente. Desintegra a horda com plasma instável.',
    damage: 130, rpm: 150, mag: 8, reserve: 48, reloadTime: 2.1, spread: 0.004, auto: false,
    pellets: 1, recoil: [0.02, 0.006], projectile: 'plasma', splash: 2.6, splashRadius: 2.5, build: raygun,
    sound: { body: 160, crack: 0.2, decay: 0.3, gain: 0.45, zap: true }, ammoLabel: 'CÉLULAS',
  },
  {
    id: 'mp5', name: 'MP5', category: 'SMG', catShort: 'SMG', slot: 'SUBMETRALHADORAS',
    desc: 'Precisão alemã em um pacote compacto. A escolha certa para corredores e hordas próximas.',
    damage: 17, rpm: 800, mag: 30, reserve: 270, reloadTime: 1.65, spread: 0.023, auto: true,
    pellets: 1, recoil: [0.006, 0.002], penetration: 0, build: mp5,
    sound: { body: 120, crack: 0.2, decay: 0.06, gain: 0.25 }, ammoLabel: '9×19mm',
  },
  {
    id: 'ump45', name: 'UMP-45', category: 'SMG', catShort: 'SMG', slot: 'SUBMETRALHADORAS',
    desc: 'Cadência controlada e impacto pesado. Feita para parar corpos em movimento.',
    damage: 24, rpm: 620, mag: 25, reserve: 225, reloadTime: 1.75, spread: 0.019, auto: true,
    pellets: 1, recoil: [0.009, 0.003], penetration: 0, build: ump45,
    sound: { body: 100, crack: 0.26, decay: 0.08, gain: 0.34 }, ammoLabel: '.45 ACP',
  },
  {
    id: 'p90', name: 'FN P90', category: 'SMG', catShort: 'SMG', slot: 'SUBMETRALHADORAS',
    desc: 'Cinquenta tiros, cadência absurda e um desenho que parece vindo do futuro.',
    damage: 15, rpm: 920, mag: 50, reserve: 300, reloadTime: 1.9, spread: 0.02, auto: true,
    pellets: 1, recoil: [0.006, 0.002], penetration: 1, build: p90,
    sound: { body: 135, crack: 0.18, decay: 0.055, gain: 0.22 }, ammoLabel: '5.7×28mm',
  },
  {
    id: 'ak47', name: 'AK-47', category: 'FUZIL', catShort: 'RIF', slot: 'FUZIS DE ASSALTO',
    desc: 'Confiável, brutal e letal. O som que anuncia o fim de qualquer horda.',
    damage: 34, rpm: 600, mag: 30, reserve: 240, reloadTime: 2.1, spread: 0.017, auto: true,
    pellets: 1, recoil: [0.011, 0.004], penetration: 1, build: ak47,
    sound: { body: 90, crack: 0.38, decay: 0.1, gain: 0.5 }, ammoLabel: '7.62×39mm',
  },
  {
    id: 'm4a1', name: 'M4A1', category: 'FUZIL', catShort: 'RIF', slot: 'FUZIS DE ASSALTO',
    desc: 'Plataforma modular, recuo domado e precisão cirúrgica. O padrão-ouro da contenção.',
    damage: 27, rpm: 760, mag: 30, reserve: 270, reloadTime: 1.9, spread: 0.013, auto: true,
    pellets: 1, recoil: [0.007, 0.002], penetration: 1, build: m4a1,
    sound: { body: 115, crack: 0.28, decay: 0.075, gain: 0.38 }, ammoLabel: '5.56×45mm',
  },
  {
    id: 'scar', name: 'SCAR-H', category: 'FUZIL', catShort: 'RIF', slot: 'FUZIS DE ASSALTO',
    desc: 'Calibre .308 em um fuzil de assalto. Cada disparo é uma sentença.',
    damage: 44, rpm: 510, mag: 20, reserve: 200, reloadTime: 2.2, spread: 0.018, auto: true,
    pellets: 1, recoil: [0.016, 0.005], penetration: 2, build: scar,
    sound: { body: 80, crack: 0.42, decay: 0.12, gain: 0.6 }, ammoLabel: '7.62×51mm',
  },
  {
    id: 'remington', name: 'REMINGTON 870', category: 'SHOTGUN', catShort: 'SHT', slot: 'ESCOPETAS',
    desc: 'A porta de entrada para o inferno. Um bombeamento, seis despedidas.',
    damage: 17, rpm: 78, mag: 6, reserve: 54, reloadTime: 2.5, spread: 0.062, auto: false,
    pellets: 9, recoil: [0.045, 0.01], penetration: 0, build: remington,
    sound: { body: 65, crack: 0.55, decay: 0.22, gain: 0.78 }, ammoLabel: '12 GA',
  },
  {
    id: 'spas', name: 'SPAS-12', category: 'SHOTGUN', catShort: 'SHT', slot: 'ESCOPETAS',
    desc: 'Semi-automática e intimidadora. Transforma qualquer corredor em uma parede de chumbo.',
    damage: 15, rpm: 190, mag: 8, reserve: 64, reloadTime: 2.8, spread: 0.055, auto: false,
    pellets: 9, recoil: [0.032, 0.008], penetration: 0, build: spas,
    sound: { body: 70, crack: 0.52, decay: 0.19, gain: 0.72 }, ammoLabel: '12 GA',
  },
  {
    id: 'aa12', name: 'AA-12', category: 'SHOTGUN', catShort: 'SHT', slot: 'ESCOPETAS',
    desc: 'Uma escopeta totalmente automática com tambor de 20 cartuchos. Não é sutil.',
    damage: 12, rpm: 300, mag: 20, reserve: 80, reloadTime: 3.2, spread: 0.07, auto: true,
    pellets: 8, recoil: [0.022, 0.006], penetration: 0, build: aa12,
    sound: { body: 65, crack: 0.46, decay: 0.15, gain: 0.66 }, ammoLabel: '12 GA',
  },
  {
    id: 'awp', name: 'AWP', category: 'SNIPER', catShort: 'SNP', slot: 'SNIPERS',
    desc: 'Um tiro. Um abate. O estalo ecoa antes de o corpo tocar o chão.',
    damage: 220, rpm: 44, mag: 5, reserve: 40, reloadTime: 2.8, spread: 0.0012, auto: false,
    pellets: 1, recoil: [0.055, 0.012], penetration: 4, build: awp, zoom: 7.5,
    sound: { body: 55, crack: 0.7, decay: 0.32, gain: 0.95 }, ammoLabel: '.338 LM',
  },
  {
    id: 'barrett', name: 'BARRETT M82', category: 'SNIPER', catShort: 'SNP', slot: 'SNIPERS',
    desc: 'Um canhão de ombro. Atravessa a horda inteira e ainda pergunta se acabou.',
    damage: 340, rpm: 32, mag: 10, reserve: 30, reloadTime: 3.5, spread: 0.0018, auto: false,
    pellets: 1, recoil: [0.09, 0.02], penetration: 7, build: barrett, zoom: 9,
    sound: { body: 42, crack: 0.92, decay: 0.45, gain: 1.1 }, ammoLabel: '.50 BMG',
  },
  {
    id: 'm249', name: 'M249 SAW', category: 'LMG', catShort: 'LMG', slot: 'ARMAS PESADAS',
    desc: 'Uma centena de motivos para não se aproximar. Fogo de supressão em estado puro.',
    damage: 29, rpm: 760, mag: 100, reserve: 300, reloadTime: 4.2, spread: 0.026, auto: true,
    pellets: 1, recoil: [0.01, 0.003], penetration: 2, build: m249,
    sound: { body: 85, crack: 0.36, decay: 0.09, gain: 0.48 }, ammoLabel: '5.56×45mm',
  },
  {
    id: 'minigun', name: 'M134 MINIGUN', category: 'LMG', catShort: 'LMG', slot: 'ARMAS PESADAS',
    desc: 'Seis canos. Duas mil rotações. O barulho de um deus furioso.',
    damage: 22, rpm: 1250, mag: 200, reserve: 600, reloadTime: 5.2, spread: 0.04, auto: true,
    pellets: 1, recoil: [0.007, 0.002], penetration: 2, build: minigun, spinUp: 0.55,
    sound: { body: 105, crack: 0.3, decay: 0.06, gain: 0.3, spin: true }, ammoLabel: '7.62×51mm',
  },
  {
    id: 'rpg', name: 'RPG-7', category: 'ESPECIAL', catShort: 'EXP', slot: 'EXPLOSIVOS',
    desc: 'A solução definitiva para grupos indesejados. Não use a curta distância.',
    damage: 280, rpm: 32, mag: 1, reserve: 12, reloadTime: 3.1, spread: 0.01, auto: false,
    pellets: 1, recoil: [0.075, 0.014], projectile: 'rocket', splash: 8, splashRadius: 7.2, build: rpg,
    sound: { body: 48, crack: 0.85, decay: 0.4, gain: 1.0, rocket: true }, ammoLabel: 'OG-7V',
  },
  {
    id: 'm32', name: 'M32 MGL', category: 'ESPECIAL', catShort: 'EXP', slot: 'EXPLOSIVOS',
    desc: 'Seis granadas de 40mm em um tambor. A horda vira confete.',
    damage: 190, rpm: 64, mag: 6, reserve: 30, reloadTime: 3.3, spread: 0.018, auto: false,
    pellets: 1, recoil: [0.05, 0.012], projectile: 'grenade', splash: 5.4, splashRadius: 5.0, build: m32,
    sound: { body: 55, crack: 0.5, decay: 0.22, gain: 0.8 }, ammoLabel: '40×46mm',
  },
  {
    id: 'flamethrower', name: 'FLAMETHROWER', category: 'ESPECIAL', catShort: 'FLM', slot: 'ESPECIAIS',
    desc: 'A única arma em que a munição é o próprio inferno. Cuidado com o vento.',
    damage: 13, rpm: 620, mag: 100, reserve: 300, reloadTime: 3.6, spread: 0.02, auto: true,
    pellets: 1, recoil: [0.004, 0.001], flame: true, range: 11.5, burn: 34, build: flamethrower,
    sound: { body: 65, crack: 0.12, decay: 0.1, gain: 0.2, fire: true }, ammoLabel: 'COMBUSTÍVEL',
  },
  {
    id: 'crossbow', name: 'CROSSBOW', category: 'ESPECIAL', catShort: 'ESP', slot: 'ESPECIAIS',
    desc: 'Silenciosa, precisa e letal. A virose não ouve o próprio fim.',
    damage: 195, rpm: 56, mag: 1, reserve: 34, reloadTime: 2.0, spread: 0.002, auto: false,
    pellets: 1, recoil: [0.02, 0.005], penetration: 2, projectile: 'bolt', build: crossbow,
    sound: { body: 220, crack: 0.1, decay: 0.08, gain: 0.35, silent: true }, ammoLabel: 'VIROTES',
  },
  {
    id: 'nailgun', name: 'NAILGUN', category: 'ESPECIAL', catShort: 'NAIL', slot: 'ESPECIAIS',
    desc: 'Uma ferramenta de obra transformada em arma de guerra. Pregos não perdoam.',
    damage: 27, rpm: 640, mag: 50, reserve: 300, reloadTime: 2.2, spread: 0.018, auto: true,
    pellets: 1, recoil: [0.005, 0.002], penetration: 1, build: nailgun,
    sound: { body: 180, crack: 0.14, decay: 0.06, gain: 0.3, nail: true }, ammoLabel: 'PREGOS',
  },
  {
    id: 'tesla', name: 'TESLA CANNON', category: 'ESPECIAL', catShort: 'TSL', slot: 'ESPECIAIS',
    desc: 'Relâmpagos em cadeia. Quanto mais zumbis, mais bonito fica.',
    damage: 95, rpm: 105, mag: 6, reserve: 42, reloadTime: 2.5, spread: 0.003, auto: false,
    pellets: 1, recoil: [0.018, 0.005], chain: 3, chainRange: 7, build: tesla,
    sound: { body: 190, crack: 0.35, decay: 0.24, gain: 0.55, zap: true }, ammoLabel: 'CÉLULAS',
  },
  {
    id: 'freeze', name: 'CRYO RAY', category: 'ESPECIAL', catShort: 'CRY', slot: 'ESPECIAIS',
    desc: 'Congela a horda até que ela pare de ser um problema. Depois, quebre o gelo.',
    damage: 9, rpm: 800, mag: 80, reserve: 240, reloadTime: 2.8, spread: 0.012, auto: true,
    pellets: 1, recoil: [0.003, 0.001], freeze: true, range: 13, build: freezeRay,
    sound: { body: 210, crack: 0.1, decay: 0.08, gain: 0.22, freeze: true }, ammoLabel: 'CRIOGÊNIO',
  },
  {
    id: 'machete', name: 'MACHETE', category: 'CORPO', catShort: 'MEL', slot: 'CORPO A CORPO',
    desc: 'Silencioso, infinito e brutal. A lâmina não precisa de munição.',
    damage: 120, rpm: 130, mag: Infinity, reserve: Infinity, reloadTime: 0.4, spread: 0, auto: false,
    pellets: 1, recoil: [0.02, 0.01], melee: true, range: 2.5, build: machete,
    sound: { body: 300, crack: 0.1, decay: 0.08, gain: 0.3, melee: true }, ammoLabel: 'AÇO',
  },
  {
    id: 'katana', name: 'KATANA', category: 'CORPO', catShort: 'MEL', slot: 'CORPO A CORPO',
    desc: 'Corte rápido e limpo. A horda não merece uma segunda lâmina.',
    damage: 92, rpm: 215, mag: Infinity, reserve: Infinity, reloadTime: 0.3, spread: 0, auto: false,
    pellets: 1, recoil: [0.014, 0.006], melee: true, range: 2.8, build: katana,
    sound: { body: 340, crack: 0.08, decay: 0.06, gain: 0.28, melee: true }, ammoLabel: 'AÇO',
  },
  {
    id: 'chainsaw', name: 'CHAINSAW', category: 'CORPO', catShort: 'MEL', slot: 'CORPO A CORPO',
    desc: 'Barulhento, sedento e absolutamente eficaz. Não é uma arma. É uma declaração.',
    damage: 24, rpm: 720, mag: Infinity, reserve: Infinity, reloadTime: 0.5, spread: 0, auto: true,
    pellets: 1, recoil: [0.006, 0.003], melee: true, range: 2.0, build: chainsaw,
    sound: { body: 420, crack: 0.05, decay: 0.1, gain: 0.24, melee: true, saw: true }, ammoLabel: 'GASOLINA',
  },
];

export const WEAPONS = RAW.map((w, i) => ({
  ...w,
  index: i,
  model: w.build,
  name: w.name,
  slotLabel: w.slot,
  ammoLabel: w.ammoLabel,
  reserve: w.reserve,
  auto: !!w.auto,
  pellets: w.pellets || 1,
  penetration: w.penetration || 0,
}));
export const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map(w => [w.id, w]));
export const CATEGORY_ORDER = ['PISTOLA', 'SMG', 'FUZIL', 'SHOTGUN', 'SNIPER', 'LMG', 'ESPECIAL', 'CORPO'];
export const CATEGORY_LABELS = {
  PISTOLA: 'PISTOLAS', SMG: 'SUBMETRALHADORAS', FUZIL: 'FUZIS DE ASSALTO', SHOTGUN: 'ESCOPETAS',
  SNIPER: 'SNIPERS', LMG: 'ARMAS PESADAS', ESPECIAL: 'ESPECIAIS', CORPO: 'CORPO A CORPO',
};

export function buildWeaponModel(def) {
  const model = def.build();
  model.userData.def = def;
  model.traverse(o => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
      o.frustumCulled = false;
    }
  });
  return model;
}

export function statBars(def) {
  return [
    { label: 'DANO', v: Math.min(1, def.damage * (def.pellets || 1) / 340) },
    { label: 'CADÊNCIA', v: Math.min(1, def.rpm / 1250) },
    { label: 'PRECISÃO', v: Math.max(.05, Math.min(1, 1 - def.spread / .08)) },
    { label: 'CONTROLE', v: Math.max(.12, Math.min(1, 1 - (def.recoil?.[0] || .01) * 13)) },
    { label: 'CARGA', v: Math.min(1, (def.mag === Infinity ? 999 : def.mag) / 120) },
  ];
}
