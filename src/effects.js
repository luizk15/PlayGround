import * as THREE from 'three';
import { glowTexture, smokeTexture, bloodTexture, bulletHoleTexture } from './textures.js';

const rand = (a, b) => a + Math.random() * (b - a);
const UP = new THREE.Vector3(0, 1, 0);

/* ------------------------------------------------------------
   GPU point particles with per-particle size + alpha
   ------------------------------------------------------------ */
class ParticlePool {
  constructor(scene, texture, capacity, additive = false) {
    this.capacity = capacity;
    this.cursor = 0;
    this.free = [];
    this.particles = [];
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geo = geo;
    this.material = new THREE.ShaderMaterial({
      uniforms: { map: { value: texture }, tint: { value: new THREE.Color(1, 1, 1) } },
      vertexShader: `
        attribute float size;
        attribute float alpha;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = color;
          vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (540.0 / max(0.2, -mv.z));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform sampler2D map;
        uniform vec3 tint;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec4 tex = texture2D(map, gl_PointCoord);
          if (tex.a < 0.008 || vAlpha <= 0.0) discard;
          gl_FragColor = vec4(vColor * tint, tex.a * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexColors: true,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 6 : 5;
    scene.add(this.points);
    for (let i = 0; i < capacity; i++) {
      this.alpha[i] = 0;
      this.size[i] = 0;
      this.particles.push({ alive: false });
    }
  }

  emit(p) {
    let idx;
    if (this.free.length) idx = this.free.pop();
    else { idx = this.cursor; this.cursor = (this.cursor + 1) % this.capacity; }
    const part = this.particles[idx];
    part.alive = true;
    part.life = p.life;
    part.maxLife = p.life;
    part.vx = p.vx; part.vy = p.vy; part.vz = p.vz;
    part.gravity = p.gravity ?? 0;
    part.drag = p.drag ?? .5;
    part.size = p.size;
    part.sizeMax = p.size;
    part.grow = p.grow ?? 0;
    part.alphaBase = p.alpha ?? 1;
    part.index = idx;
    this.pos[idx * 3] = p.x; this.pos[idx * 3 + 1] = p.y; this.pos[idx * 3 + 2] = p.z;
    this.col[idx * 3] = p.r; this.col[idx * 3 + 1] = p.g; this.col[idx * 3 + 2] = p.b;
    this.size[idx] = p.size;
    this.alpha[idx] = 0.001;
    return part;
  }

  update(dt) {
    for (let i = 0; i < this.capacity; i++) {
      const p = this.particles[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false; this.alpha[i] = 0; this.size[i] = 0;
        this.free.push(i);
        continue;
      }
      const drag = Math.max(0, 1 - p.drag * dt);
      p.vx *= drag; p.vz *= drag;
      p.vy = p.vy * drag - p.gravity * dt;
      this.pos[i * 3] += p.vx * dt;
      this.pos[i * 3 + 1] += p.vy * dt;
      this.pos[i * 3 + 2] += p.vz * dt;
      if (this.pos[i * 3 + 1] < .02) { this.pos[i * 3 + 1] = .02; p.vy *= -.18; p.vx *= .55; p.vz *= .55; }
      const k = p.life / p.maxLife;
      this.alpha[i] = Math.min(1, p.alphaBase * Math.min(1, (1 - k) * 6 + .1) * Math.sqrt(k));
      if (p.grow) this.size[i] = p.size + p.grow * (1 - k);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
    this.geo.attributes.alpha.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

/* ------------------------------------------------------------
   Full effects manager
   ------------------------------------------------------------ */
export class Effects {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.sparks = new ParticlePool(scene, glowTexture(['rgba(255,255,255,1)', 'rgba(255,174,81,.7)', 'rgba(255,61,12,0)']), 900, true);
    this.fire = new ParticlePool(scene, glowTexture(['rgba(255,246,198,1)', 'rgba(255,119,34,.65)', 'rgba(255,35,0,0)']), 900, true);
    this.smoke = new ParticlePool(scene, smokeTexture(), 700, false);
    this.blood = new ParticlePool(scene, bloodTexture(), 800, false);
    this.ice = new ParticlePool(scene, glowTexture(['rgba(230,255,255,1)', 'rgba(87,208,240,.65)', 'rgba(35,126,180,0)']), 500, true);
    this.glowTex = glowTexture();
    this.tracers = [];
    this.decals = [];
    this.bloodPools = [];
    this.gibs = [];
    this.lights = [];
    this.rings = [];
    this.lines = [];
    this.setupPools();
  }

  setupPools() {
    const bulletMat = new THREE.MeshBasicMaterial({ map: bulletHoleTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, opacity: .9 });
    const bulletGeo = new THREE.PlaneGeometry(.19, .19);
    for (let i = 0; i < 70; i++) {
      const m = new THREE.Mesh(bulletGeo, bulletMat);
      m.visible = false; m.renderOrder = 4; this.scene.add(m);
      this.decals.push({ mesh: m, life: 0 });
    }
    const bpMat = new THREE.MeshBasicMaterial({ map: bloodTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, opacity: .64 });
    const bpGeo = new THREE.CircleGeometry(1, 16);
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(bpGeo, bpMat);
      m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 3; this.scene.add(m);
      this.bloodPools.push({ mesh: m, life: 0 });
    }
    const tracerGeo = new THREE.CylinderGeometry(.012, .012, 1, 5, 1, true);
    for (let i = 0; i < 36; i++) {
      const m = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({ color: 0xffd08a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false; m.renderOrder = 7; this.scene.add(m);
      this.tracers.push({ mesh: m, life: 0 });
    }
    const gibGeo = new THREE.IcosahedronGeometry(.12, 0);
    const gibMat = new THREE.MeshStandardMaterial({ color: 0x5e130d, roughness: .8 });
    for (let i = 0; i < 36; i++) {
      const m = new THREE.Mesh(gibGeo, gibMat);
      m.visible = false; m.castShadow = false; this.scene.add(m);
      this.gibs.push({ mesh: m, vel: new THREE.Vector3(), life: 0, spin: new THREE.Vector3() });
    }
    for (let i = 0; i < 4; i++) {
      const light = new THREE.PointLight(0xff7a32, 0, 16, 2);
      this.scene.add(light);
      this.lights.push({ light, life: 0, max: 0, peak: 0 });
    }
    const ringGeo = new THREE.RingGeometry(.92, 1, 40);
    for (let i = 0; i < 8; i++) {
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffb26e, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      ring.rotation.x = -Math.PI / 2; ring.visible = false; ring.renderOrder = 8; this.scene.add(ring);
      this.rings.push({ mesh: ring, life: 0, max: .4, s0: 1, s1: 8 });
    }
  }

  muzzle(pos, color = 0xffbd77, scale = 1, dir = null) {
    this.sparks.emit({ x: pos.x, y: pos.y, z: pos.z, vx: rand(-.4, .4), vy: rand(0, .8), vz: rand(-.4, .4), r: 1, g: .7, b: .3, size: .2 * scale, life: .055, gravity: 0, drag: 8, alpha: .9, grow: .15 });
    for (let i = 0; i < 5; i++) {
      const d = dir ? dir.clone().multiplyScalar(rand(1.5, 4)) : new THREE.Vector3();
      this.sparks.emit({
        x: pos.x, y: pos.y, z: pos.z,
        vx: d.x + rand(-1, 1), vy: d.y + rand(-.5, 1.2), vz: d.z + rand(-1, 1),
        r: 1, g: rand(.55, .95), b: rand(.08, .3), size: rand(.025, .075) * scale, life: rand(.04, .13), gravity: 1, drag: 3, alpha: .9,
      });
    }
  }

  impact(point, normal, surface = 'concrete') {
    const col = surface === 'metal' ? [1, .68, .25] : surface === 'wood' ? [.65, .42, .18] : [.8, .72, .52];
    for (let i = 0; i < 12; i++) {
      this.sparks.emit({
        x: point.x, y: point.y, z: point.z,
        vx: normal.x * rand(1, 4) + rand(-2.5, 2.5), vy: normal.y * rand(1, 4) + rand(-.4, 3.2), vz: normal.z * rand(1, 4) + rand(-2.5, 2.5),
        r: col[0], g: col[1], b: col[2], size: rand(.016, .055), life: rand(.14, .45), gravity: 7, drag: 1.4, alpha: 1
      });
    }
    for (let i = 0; i < 4; i++) {
      this.smoke.emit({
        x: point.x + normal.x * .05, y: point.y + normal.y * .05, z: point.z + normal.z * .05,
        vx: normal.x * rand(.2, .8) + rand(-.2, .2), vy: normal.y * rand(.2, .8) + rand(.05, .35), vz: normal.z * rand(.2, .8) + rand(-.2, .2),
        r: .33, g: .31, b: .27, size: rand(.1, .22), life: rand(.25, .6), gravity: -.3, drag: 1.8, alpha: .18, grow: .45
      });
    }
    const decal = this.decals.reduce((a, b) => (a.life < b.life ? a : b));
    decal.life = 30;
    decal.mesh.visible = true;
    decal.mesh.position.copy(point).addScaledVector(normal, .012);
    decal.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    decal.mesh.rotateZ(Math.random() * 6.28);
    decal.mesh.scale.setScalar(rand(.7, 1.25));
  }

  bloodBurst(point, dir, amount = 1, head = false) {
    const n = Math.floor(18 * amount + (head ? 12 : 0));
    for (let i = 0; i < n; i++) {
      const d = dir || new THREE.Vector3(0, 0, -1);
      const vx = d.x * rand(.5, 4.2) + rand(-2.2, 2.2);
      const vy = d.y * rand(.5, 4) + rand(-.2, 3.6);
      const vz = d.z * rand(.5, 4.2) + rand(-2.2, 2.2);
      this.blood.emit({
        x: point.x + rand(-.08, .08), y: point.y + rand(-.08, .08), z: point.z + rand(-.08, .08),
        vx, vy, vz, r: rand(.25, .56), g: rand(.015, .06), b: rand(.01, .045),
        size: rand(.035, .12) * (head ? 1.3 : 1), life: rand(.35, 1.1), gravity: 8, drag: .8, alpha: .95
      });
    }
    if (Math.random() < .35 + amount * .1) {
      const p = this.bloodPools.reduce((a, b) => (a.life < b.life ? a : b));
      p.life = 25;
      p.mesh.visible = true;
      p.mesh.position.set(point.x + rand(-.2, .2), .045, point.z + rand(-.2, .2));
      p.mesh.scale.setScalar(rand(.35, 1.3) * amount);
      p.mesh.rotation.z = Math.random() * 6.28;
    }
    if (head && Math.random() < .65) {
      for (let i = 0; i < 4; i++) this.gib(point, dir, .55);
    }
  }

  gib(point, dir, speed = 1) {
    const g = this.gibs.find(x => x.life <= 0);
    if (!g) return;
    g.life = rand(2.2, 4.5);
    g.mesh.visible = true;
    g.mesh.position.copy(point);
    g.mesh.scale.setScalar(rand(.5, 1.35));
    g.vel.set(rand(-2.5, 2.5) + (dir?.x || 0) * speed * 2, rand(1.2, 4.8), rand(-2.5, 2.5) + (dir?.z || 0) * speed * 2);
    g.spin.set(rand(-12, 12), rand(-12, 12), rand(-12, 12));
    this.blood.emit({ x: point.x, y: point.y, z: point.z, vx: 0, vy: .3, vz: 0, r: .4, g: .02, b: .01, size: .18, life: 1.2, gravity: 5, drag: 2, alpha: .5, grow: .3 });
  }

  tracer(from, to, color = 0xffd18a) {
    const t = this.tracers.find(x => x.life <= 0);
    if (!t) return;
    const dist = from.distanceTo(to);
    t.life = .065; t.max = .065;
    t.mesh.visible = true;
    t.mesh.material.color.setHex(color);
    t.mesh.material.opacity = .78;
    t.mesh.position.copy(from).add(to).multiplyScalar(.5);
    t.mesh.scale.set(1, dist, 1);
    t.mesh.quaternion.setFromUnitVectors(UP, to.clone().sub(from).normalize());
  }

  explosion(pos, radius = 5, color = 0xff7330) {
    const light = this.lights.find(l => l.life <= 0) || this.lights[0];
    light.life = light.max = .55; light.peak = 220;
    light.light.position.copy(pos); light.light.color.setHex(color);
    light.light.distance = radius * 5;
    light.light.intensity = light.peak;
    for (let i = 0; i < 75; i++) {
      const a = Math.random() * Math.PI * 2, e = rand(-.2, 1);
      const sp = rand(2, 13);
      this.fire.emit({
        x: pos.x, y: pos.y + .4, z: pos.z,
        vx: Math.cos(a) * sp * rand(.3, 1), vy: e * sp + 2, vz: Math.sin(a) * sp * rand(.3, 1),
        r: 1, g: rand(.35, .8), b: rand(.04, .2), size: rand(.3, 1.0), life: rand(.3, .95), gravity: 2, drag: 2.2, alpha: 1, grow: .5
      });
    }
    for (let i = 0; i < 32; i++) {
      this.smoke.emit({
        x: pos.x + rand(-1, 1), y: pos.y + rand(.2, 2), z: pos.z + rand(-1, 1),
        vx: rand(-3, 3), vy: rand(.5, 4.5), vz: rand(-3, 3),
        r: .17, g: .17, b: .16, size: rand(.5, 1.5), life: rand(.8, 2.4), gravity: -.8, drag: 1.2, alpha: .26, grow: 1.8
      });
    }
    for (let i = 0; i < 55; i++) {
      const a = Math.random() * Math.PI * 2, sp = rand(4, 20);
      this.sparks.emit({
        x: pos.x, y: pos.y + .3, z: pos.z, vx: Math.cos(a) * sp, vy: rand(2, 15), vz: Math.sin(a) * sp,
        r: 1, g: rand(.6, .95), b: rand(.15, .4), size: rand(.03, .11), life: rand(.4, 1.3), gravity: 12, drag: .6, alpha: 1
      });
    }
    const ring = this.rings.find(r => r.life <= 0) || this.rings[0];
    ring.life = ring.max = .55; ring.s1 = radius * 2.2;
    ring.mesh.visible = true; ring.mesh.position.set(pos.x, .06, pos.z); ring.mesh.scale.setScalar(1);
    ring.mesh.material.opacity = .6;
    this.glow(pos, color, radius * 2.2, .3);
  }

  glow(pos, color = 0xff7a32, size = 3, life = .2) {
    // use one large point as a cheap flash sprite
    this.sparks.emit({ x: pos.x, y: pos.y, z: pos.z, vx: 0, vy: 0, vz: 0, r: 1, g: .75, b: .4, size, life, gravity: 0, drag: 0, alpha: .75, grow: size * .8 });
  }

  flamethrower(pos, dir) {
    for (let i = 0; i < 4; i++) {
      const spread = .22;
      const v = dir.clone().multiplyScalar(rand(9, 16));
      v.x += rand(-spread, spread) * 4; v.y += rand(-.12, .22) * 4; v.z += rand(-spread, spread) * 4;
      this.fire.emit({
        x: pos.x, y: pos.y, z: pos.z, vx: v.x, vy: v.y, vz: v.z,
        r: 1, g: rand(.3, .62), b: rand(.02, .08), size: rand(.15, .38), life: rand(.25, .6), gravity: -1.2, drag: 1.7, alpha: .9, grow: .8
      });
    }
    if (Math.random() < .5) {
      this.smoke.emit({ x: pos.x, y: pos.y, z: pos.z, vx: dir.x * rand(2, 5) + rand(-.4, .4), vy: rand(.2, 1.2), vz: dir.z * rand(2, 5) + rand(-.4, .4), r: .18, g: .16, b: .13, size: rand(.3, .6), life: rand(.5, 1.2), gravity: -.6, drag: 1.2, alpha: .2, grow: 1.2 });
    }
  }

  frost(pos, dir, dist = 6) {
    for (let i = 0; i < 3; i++) {
      const v = dir.clone().multiplyScalar(rand(6, 12));
      this.ice.emit({
        x: pos.x, y: pos.y, z: pos.z, vx: v.x + rand(-.8, .8), vy: v.y + rand(-.2, .5), vz: v.z + rand(-.8, .8),
        r: .7, g: .95, b: 1, size: rand(.04, .12), life: rand(.25, .7), gravity: .4, drag: 1.8, alpha: .8
      });
    }
    const p = new THREE.Vector3().copy(pos).addScaledVector(dir, dist);
    for (let i = 0; i < 5; i++) {
      this.ice.emit({ x: p.x + rand(-.4, .4), y: p.y + rand(-.4, .4), z: p.z + rand(-.4, .4), vx: rand(-.4, .4), vy: rand(.1, .7), vz: rand(-.4, .4), r: .7, g: .95, b: 1, size: rand(.04, .12), life: rand(.3, .8), gravity: .2, drag: 2, alpha: .7 });
    }
  }

  acid(pos, dir) {
    for (let i = 0; i < 4; i++) {
      this.ice.emit({ x: pos.x, y: pos.y, z: pos.z, vx: dir.x * 2 + rand(-1, 1), vy: rand(-.5, 1.5), vz: dir.z * 2 + rand(-1, 1), r: .6, g: 1, b: .25, size: rand(.04, .16), life: rand(.2, .6), gravity: 6, drag: 1, alpha: .9 });
    }
  }

  lightning(points, color = 0x7ee9ff) {
    const group = new THREE.Group();
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let pass = 0; pass < 2; pass++) {
      const p = [];
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i], b = points[i + 1];
        const seg = 7;
        for (let j = 0; j <= seg; j++) {
          if (j === 0 && i > 0) continue;
          const t = j / seg;
          p.push(new THREE.Vector3().lerpVectors(a, b, t));
          if (j > 0 && j < seg) p[p.length - 1].add(new THREE.Vector3(rand(-.18, .18), rand(-.18, .18), rand(-.18, .18)));
        }
      }
      const geo = new THREE.BufferGeometry().setFromPoints(p);
      const line = new THREE.Line(geo, mat);
      line.renderOrder = 9;
      group.add(line);
    }
    this.scene.add(group);
    this.lines.push({ group, life: .16, max: .16 });
  }

  update(dt) {
    this.sparks.update(dt); this.fire.update(dt); this.smoke.update(dt); this.blood.update(dt); this.ice.update(dt);
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.mesh.material.opacity = Math.max(0, t.life / t.max) * .8;
      if (t.life <= 0) t.mesh.visible = false;
    }
    for (const d of this.decals) {
      if (d.life <= 0) continue;
      d.life -= dt;
      if (d.life <= 0) d.mesh.visible = false;
    }
    for (const b of this.bloodPools) {
      if (b.life <= 0) continue;
      b.life -= dt;
      if (b.life <= 0) b.mesh.visible = false;
    }
    for (const g of this.gibs) {
      if (g.life <= 0) continue;
      g.life -= dt;
      g.vel.y -= 15 * dt;
      g.mesh.position.addScaledVector(g.vel, dt);
      if (g.mesh.position.y < .08) { g.mesh.position.y = .08; g.vel.y *= -.35; g.vel.x *= .7; g.vel.z *= .7; }
      g.mesh.rotation.x += g.spin.x * dt; g.mesh.rotation.y += g.spin.y * dt; g.mesh.rotation.z += g.spin.z * dt;
      if (g.life <= 0) g.mesh.visible = false;
    }
    for (const l of this.lights) {
      if (l.life <= 0) { l.light.intensity = 0; continue; }
      l.life -= dt;
      l.light.intensity = Math.max(0, (l.life / l.max)) * l.peak;
    }
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      const k = 1 - r.life / r.max;
      r.mesh.scale.setScalar(1 + (r.s1 - 1) * k);
      r.mesh.material.opacity = (1 - k) * .55;
      if (r.life <= 0) r.mesh.visible = false;
    }
    for (const l of this.lines) {
      l.life -= dt;
      l.group.children.forEach(c => { c.material.opacity = Math.max(0, l.life / l.max) * .95; });
      if (l.life <= 0) { this.scene.remove(l.group); l.group.children.forEach(c => { c.geometry.dispose(); }); l.dead = true; }
    }
    if (this.lines.some(l => l.dead)) this.lines = this.lines.filter(l => !l.dead);
  }
}
