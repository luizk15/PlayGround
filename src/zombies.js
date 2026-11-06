import * as THREE from 'three';

const rand = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

export const ZOMBIE_TYPES = {
  walker: {
    label: 'CAMINHANTE', health: 115, speed: 1.55, damage: 12, radius: .42, scale: 1,
    score: 100, attackRange: 1.55, attackCd: 1.25, swing: 1, eye: 0xff3a16,
  },
  runner: {
    label: 'CORREDOR', health: 80, speed: 3.55, damage: 8, radius: .38, scale: .93,
    score: 150, attackRange: 1.45, attackCd: .85, swing: 1.35, eye: 0xff5c22,
  },
  spitter: {
    label: 'EXPECTORADOR', health: 180, speed: 1.22, damage: 10, radius: .44, scale: 1.03,
    score: 220, attackRange: 2.0, attackCd: 2.6, swing: .8, eye: 0xb4ff3c, ranged: true,
  },
  exploder: {
    label: 'RUPTOR', health: 130, speed: 2.35, damage: 36, radius: .5, scale: 1.08,
    score: 260, attackRange: 2.4, attackCd: 1.4, swing: 1.1, eye: 0xff7426, exploder: true,
  },
  brute: {
    label: 'BRUTO', health: 520, speed: 1.12, damage: 29, radius: .68, scale: 1.5,
    score: 400, attackRange: 2.15, attackCd: 1.65, swing: .7, eye: 0xff2510,
  },
  boss: {
    label: 'ABOMINAÇÃO', health: 4200, speed: 1.05, damage: 42, radius: 1.1, scale: 2.35,
    score: 2500, attackRange: 3.2, attackCd: 1.5, swing: .55, eye: 0xff1600, boss: true,
  },
};

let zid = 0;

function makeMat(color, roughness = .9, metalness = .02, emissive = 0x000000, ei = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity: ei });
}
function add(parent, geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m); return m;
}
function group(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
function capsule(radius, len, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(radius, len, 4, 8), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}

export class Zombie {
  constructor(type, pos, manager, wave = 1) {
    this.id = ++zid;
    this.type = type;
    this.def = ZOMBIE_TYPES[type];
    this.manager = manager;
    this.wave = wave;
    this.maxHealth = Math.round(this.def.health * (1 + Math.max(0, wave - 1) * .075));
    if (type === 'boss') this.maxHealth = Math.round((4200 + wave * 620) * (1 + wave * .025));
    this.health = this.maxHealth;
    this.speed = this.def.speed * (1 + Math.min(.35, wave * .018));
    this.dead = false;
    this.removed = false;
    this.deadTime = 0;
    this.attackCd = rand(.2, .9);
    this.attackAnim = 0;
    this.spitCd = rand(1.2, 2.8);
    this.flash = 0;
    this.burn = 0;
    this.burnTick = 0;
    this.freeze = 0;
    this.push = new THREE.Vector3();
    this.animT = Math.random() * 10;
    this.groanT = rand(2, 8);
    this.lastDamageBy = null;
    this.hitHeadTime = 0;

    this.build();
    this.group.position.copy(pos);
    this.group.position.y = 0;
  }

  build() {
    const d = this.def;
    this.group = new THREE.Group();
    this.group.userData.zombie = this;
    this.group.rotation.y = Math.random() * TAU;
    const model = new THREE.Group();
    model.scale.setScalar(d.scale);
    this.group.add(model);
    this.model = model;

    const palettes = [
      { skin: 0x49563f, cloth: 0x2b302a, pants: 0x232623, hair: 0x1b1a15 },
      { skin: 0x56563f, cloth: 0x342b25, pants: 0x27251f, hair: 0x2a1f16 },
      { skin: 0x3c493a, cloth: 0x1e2423, pants: 0x1d201f, hair: 0x171b19 },
      { skin: 0x574a3a, cloth: 0x33362b, pants: 0x25281f, hair: 0x1c1610 },
    ];
    const pal = palettes[Math.floor(Math.random() * palettes.length)];
    this.matSkin = makeMat(pal.skin, .92, .01);
    this.matSkin.emissive = new THREE.Color(0x4a0b05);
    this.matSkin.emissiveIntensity = 0;
    this.matCloth = makeMat(pal.cloth, .97, .01);
    this.matPants = makeMat(pal.pants, .96, .01);
    this.matHair = makeMat(pal.hair, 1, .0);
    this.matBlood = makeMat(0x3f0f0a, .8, .02);
    this.matEye = new THREE.MeshStandardMaterial({ color: 0x2d0c05, emissive: d.eye, emissiveIntensity: 1.15, roughness: .22 });
    this.matSocket = makeMat(0x0c0907, .95, 0);
    this.matTeeth = makeMat(0x9b927c, .72, .02);
    this.matMouth = makeMat(0x190908, .9, 0);
    this.materials = [this.matSkin, this.matCloth, this.matPants, this.matHair, this.matBlood];

    const isBrute = this.type === 'brute' || this.type === 'boss';
    const torsoScale = isBrute ? 1.25 : 1;
    const hipY = .78;

    // hips / belt
    add(model, new THREE.BoxGeometry(.43 * torsoScale, .2, .28), this.matPants, 0, hipY, 0);
    add(model, new THREE.BoxGeometry(.46 * torsoScale, .055, .3), this.matBlood, 0, hipY + .09, 0);

    // torso: skin under torn shirt
    const torso = add(model, new THREE.CapsuleGeometry(.22 * torsoScale, .4, 4, 10), this.matSkin, 0, 1.08, 0);
    torso.scale.z = .72;
    const shirt = add(model, new THREE.BoxGeometry(.47 * torsoScale, .38, .28), this.matCloth, 0, 1.13, 0);
    shirt.scale.z = .8;
    // torn edges
    add(model, new THREE.BoxGeometry(.16, .12, .015), this.matSkin, -.11, 1.0, -.14);
    add(model, new THREE.BoxGeometry(.24, .08, .016), this.matBlood, .1, 1.23, -.145);
    add(model, new THREE.BoxGeometry(.11, .09, .015), this.matSkin, .15, .98, .13);

    // shoulders
    add(model, new THREE.SphereGeometry(.14 * torsoScale, 8, 6), this.matCloth, -.27 * torsoScale, 1.34, 0);
    add(model, new THREE.SphereGeometry(.14 * torsoScale, 8, 6), this.matCloth, .27 * torsoScale, 1.34, 0);

    // neck / head
    const headGroup = group(model, 0, 1.47, 0);
    this.headGroup = headGroup;
    add(headGroup, new THREE.CylinderGeometry(.065, .08, .12, 7), this.matSkin, 0, .04, 0);
    const head = add(headGroup, new THREE.SphereGeometry(.18, 10, 8), this.matSkin, 0, .17, -.015);
    head.scale.set(.92, 1.1, .96);
    // jaw
    const jaw = add(headGroup, new THREE.BoxGeometry(.13, .075, .12), this.matMouth, 0, .075, -.1);
    jaw.rotation.x = .18;
    // eyes
    for (const ex of [-.06, .06]) {
      const socket = add(headGroup, new THREE.SphereGeometry(.034, 7, 5), this.matSocket, ex, .19, -.158);
      socket.scale.set(1.15, 1, .55);
      add(headGroup, new THREE.SphereGeometry(.017, 6, 5), this.matEye, ex, .19, -.171);
    }
    // exposed teeth and blood smears
    for (let i = 0; i < 4; i++) add(headGroup, new THREE.BoxGeometry(.023, .028, .012), this.matTeeth, -.045 + i * .03, .088, -.164);
    add(headGroup, new THREE.BoxGeometry(.013, .055, .01), this.matBlood, -.052, .125, -.166);
    add(headGroup, new THREE.BoxGeometry(.01, .04, .01), this.matBlood, .045, .12, -.167);
    // mouth blood
    add(headGroup, new THREE.BoxGeometry(.115, .022, .02), this.matBlood, 0, .075, -.17);
    // hair / headwear
    if (isBrute) {
      add(headGroup, new THREE.SphereGeometry(.19, 8, 6, 0, TAU, 0, Math.PI / 2), makeMat(0x353b39, .6, .4), 0, .2, 0);
      add(headGroup, new THREE.ConeGeometry(.035, .14, 6), makeMat(0x6f6a5c, .6, .3), -.11, .32, 0);
      add(headGroup, new THREE.ConeGeometry(.035, .12, 6), makeMat(0x6f6a5c, .6, .3), .1, .3, .02);
    } else if (Math.random() < .5) {
      add(headGroup, new THREE.SphereGeometry(.185, 8, 6, 0, TAU, 0, Math.PI / 2), this.matHair, 0, .19, 0);
    } else {
      const cap = add(headGroup, new THREE.CylinderGeometry(.15, .17, .09, 10), this.matCloth, 0, .31, 0);
      add(headGroup, new THREE.BoxGeometry(.28, .025, .14), this.matCloth, 0, .27, -.15);
    }
    if (this.type === 'spitter') {
      // bloated throat sacs and acid glow
      this.matAcid = new THREE.MeshStandardMaterial({ color: 0x73992e, emissive: 0xaaff30, emissiveIntensity: 1.5, roughness: .25 });
      for (let i = 0; i < 3; i++) add(headGroup, new THREE.SphereGeometry(.055 + i * .008, 7, 6), this.matAcid, 0, .09 - i * .035, -.1);
      const sac = add(model, new THREE.SphereGeometry(.2, 8, 6), this.matAcid, 0, 1.14, .16);
      sac.scale.set(1.2, .8, .6);
      this.materials.push(this.matAcid);
    }
    if (this.type === 'exploder') {
      this.matBelly = new THREE.MeshStandardMaterial({ color: 0x963f22, emissive: 0xff4e1c, emissiveIntensity: .55, roughness: .4 });
      const belly = add(model, new THREE.SphereGeometry(.26, 10, 8), this.matBelly, 0, 1.0, -.11);
      belly.scale.set(1.15, 1.0, .8);
      for (let i = 0; i < 5; i++) add(model, new THREE.BoxGeometry(.035, .26, .03), this.matBlood, rand(-.18, .18), 1.01, -.32);
      this.materials.push(this.matBelly);
    }
    if (this.type === 'boss') {
      this.matCore = new THREE.MeshStandardMaterial({ color: 0x6d1a0d, emissive: 0xff2a08, emissiveIntensity: 2.2, roughness: .3 });
      const core = add(model, new THREE.SphereGeometry(.2, 10, 8), this.matCore, 0, 1.12, -.28);
      core.scale.set(1.2, 1.4, .45);
      this.materials.push(this.matCore);
      // back spikes
      for (let i = 0; i < 6; i++) {
        const spike = add(model, new THREE.ConeGeometry(.09, .38, 5), this.matHair, rand(-.3, .3), 1.2 + rand(-.35, .35), .25);
        spike.rotation.x = -1.2; spike.rotation.z = rand(-.4, .4);
      }
      // extra massive arms handled below by scale, add forearm spikes
    }

    // arms
    const armCloth = this.matCloth;
    this.arms = [];
    for (const side of [-1, 1]) {
      const shoulder = group(model, side * .29 * torsoScale, 1.34, 0);
      shoulder.rotation.z = side * -.08;
      capsule(.075, .22, armCloth, 0, -.14, 0, shoulder);
      const elbow = group(shoulder, 0, -.3, 0);
      const fore = capsule(.062, .22, this.matSkin, 0, -.13, 0, elbow);
      add(shoulder, new THREE.SphereGeometry(.085, 7, 6), armCloth, 0, 0, 0);
      const hand = add(elbow, new THREE.SphereGeometry(.075, 7, 6), this.matSkin, 0, -.29, -.01);
      hand.scale.set(1, 1.15, .8);
      // ragged sleeve
      add(shoulder, new THREE.BoxGeometry(.14, .07, .14), this.matCloth, 0, -.28, 0);
      this.arms.push({ shoulder, elbow, side });
    }

    // legs
    this.legs = [];
    for (const side of [-1, 1]) {
      const hip = group(model, side * .14, hipY, 0);
      capsule(.09, .25, this.matPants, 0, -.18, 0, hip);
      const knee = group(hip, 0, -.38, 0);
      capsule(.075, .25, this.matPants, 0, -.17, 0, knee);
      const foot = add(knee, new THREE.BoxGeometry(.15, .09, .28), makeMat(0x24231d, .95, .02), 0, -.37, -.06);
      add(knee, new THREE.BoxGeometry(.14, .06, .12), this.matSkin, 0, -.3, -.06);
      this.legs.push({ hip, knee, side });
    }

    // torn clothing patches / wounds
    for (let i = 0; i < 4; i++) {
      const w = rand(.03, .13), h = rand(.02, .12);
      add(model, new THREE.BoxGeometry(w, h, .012), this.matBlood, rand(-.24, .24), rand(.85, 1.32), -.15);
    }

    // shadow blob
    const blob = new THREE.Mesh(new THREE.CircleGeometry(.55 * d.scale, 14), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .33, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = .025; this.group.add(blob);
    this.blob = blob;
  }

  addTo(scene) { scene.add(this.group); }

  headCenter(out = new THREE.Vector3()) {
    const s = this.def.scale;
    out.set(0, 1.64 * s, 0);
    return this.group.localToWorld(out);
  }

  torsoCenter(out = new THREE.Vector3()) {
    const s = this.def.scale;
    out.set(0, 1.07 * s, 0);
    return this.group.localToWorld(out);
  }

  rayHit(origin, dir, maxDist) {
    if (this.dead) return null;
    const s = this.def.scale;
    const headR = (this.type === 'boss' ? .34 : this.type === 'brute' ? .27 : .235) * s;
    const bodyR = (this.type === 'boss' ? .62 : this.type === 'brute' ? .47 : .35) * s;
    const hp = this.group.localToWorld(new THREE.Vector3(0, 1.65 * s, 0));
    const bp = this.group.localToWorld(new THREE.Vector3(0, 1.05 * s, 0));
    const oc = new THREE.Vector3().subVectors(hp, origin);
    const t = oc.dot(dir);
    let best = null;
    if (t > 0 && t < maxDist) {
      const d2 = oc.lengthSq() - t * t;
      if (d2 < headR * headR) {
        const hitT = t - Math.sqrt(headR * headR - d2);
        if (hitT > 0) best = { zombie: this, distance: hitT, part: 'head' };
      }
    }
    const oc2 = new THREE.Vector3().subVectors(bp, origin);
    const t2 = oc2.dot(dir);
    if (t2 > 0 && t2 < maxDist) {
      const d2 = oc2.lengthSq() - t2 * t2;
      if (d2 < bodyR * bodyR) {
        const hitT = t2 - Math.sqrt(bodyR * bodyR - d2);
        if (hitT > 0 && (!best || hitT < best.distance)) best = { zombie: this, distance: hitT, part: 'body' };
      }
    }
    return best;
  }

  damage(amount, part = 'body', dir = null, meta = null) {
    if (this.dead) return false;
    this.health -= amount;
    this.flash = .08;
    this.lastDamageBy = meta;
    if (part === 'head') this.hitHeadTime = .2;
    if (dir) this.push.addScaledVector(dir, Math.min(2.4, amount * .014));
    if (this.def.exploder) {
      this.explodeTimer = (this.explodeTimer || .9) - amount / 500;
    }
    if (this.health <= 0) { this.die(part, dir, meta); return true; }
    return false;
  }

  die(part = 'body', dir = null, meta = null) {
    if (this.dead) return;
    this.dead = true;
    this.deadTime = 0;
    this.deathDir = dir ? dir.clone() : new THREE.Vector3(0, 0, 1);
    this.deathPart = part;
    this.model.rotation.z = 0;
    this.blob.material.opacity = .18;
    this.manager.onKill?.(this, part, meta);
  }

  burnApply(seconds, dps = 26) {
    this.burn = Math.max(this.burn, seconds);
    this.burnDps = Math.max(this.burnDps || 0, dps);
  }
  freezeApply(seconds) {
    this.freeze = Math.max(this.freeze, seconds);
    this.matSkin.color.lerp(new THREE.Color(0x7199a3), .22);
  }

  update(dt, t, playerPos, zombies, world, effects, audio, damagePlayer) {
    if (this.removed) return;
    if (this.dead) {
      this.deadTime += dt;
      const k = Math.min(1, this.deadTime / .55);
      const fall = k * k * (3 - 2 * k);
      const yaw = this.group.rotation.y;
      const dx = -Math.sin(yaw), dz = -Math.cos(yaw);
      this.model.rotation.x = -fall * Math.PI * .48 * Math.abs(Math.cos(yaw * .7 + 1.2)) - fall * .08;
      this.model.rotation.z = fall * Math.sign(Math.sin(yaw * 3)) * .35;
      this.model.position.y = -fall * .04;
      if (this.deadTime > 6.5) {
        this.group.position.y -= dt * .28;
        this.blob.material.opacity = Math.max(0, .18 - (this.deadTime - 6.5) * .04);
      }
      if (this.deadTime > 10) { this.removed = true; this.manager.scene.remove(this.group); this.manager.removeZombie(this); }
      return;
    }

    // status effects
    if (this.flash > 0) {
      this.flash -= dt;
      this.matSkin.emissiveIntensity = Math.max(0, this.flash * 9);
    }
    if (this.burn > 0) {
      this.burn -= dt;
      this.burnTick -= dt;
      if (this.burnTick <= 0) {
        this.burnTick = .25;
        const dead = this.damage(this.burnDps * .25, 'body', new THREE.Vector3(0, 1, 0), { id: 'fire', name: 'FOGO' });
        if (dead) return;
      }
      if (Math.random() < .6) {
        effects.fire.emit({ x: this.group.position.x + rand(-.3, .3), y: rand(.4, 1.6) * this.def.scale, z: this.group.position.z + rand(-.3, .3), vx: rand(-.4, .4), vy: rand(.5, 1.6), vz: rand(-.4, .4), r: 1, g: .42, b: .05, size: rand(.06, .18), life: rand(.2, .45), gravity: -1.2, drag: 2, alpha: .9, grow: .2 });
      }
    }
    if (this.freeze > 0) {
      this.freeze -= dt;
      if (Math.random() < .12) effects.ice.emit({ x: this.group.position.x + rand(-.4, .4), y: rand(.2, 1.5) * this.def.scale, z: this.group.position.z + rand(-.4, .4), vx: 0, vy: rand(.05, .3), vz: 0, r: .7, g: .95, b: 1, size: rand(.03, .08), life: .5, gravity: 0, drag: 2, alpha: .6 });
    }
    const slow = this.freeze > 0 ? .22 : 1;

    const dx = playerPos.x - this.group.position.x;
    const dz = playerPos.z - this.group.position.z;
    const dist = Math.hypot(dx, dz) || .001;
    const nx = dx / dist, nz = dz / dist;

    // separation
    let sepx = 0, sepz = 0;
    for (const other of zombies) {
      if (other === this || other.dead) continue;
      const ox = this.group.position.x - other.group.position.x;
      const oz = this.group.position.z - other.group.position.z;
      const d2 = ox * ox + oz * oz;
      const rr = (this.def.radius + other.def.radius + .35);
      if (d2 < rr * rr && d2 > .0001) {
        const d = Math.sqrt(d2);
        sepx += (ox / d) * (1 - d / rr) * 2.4;
        sepz += (oz / d) * (1 - d / rr) * 2.4;
      }
    }

    let moveX = nx, moveZ = nz;
    let speed = this.speed * slow;
    if (this.def.ranged) {
      if (dist < 9) { moveX *= -1; moveZ *= -1; speed *= .9; }
      else if (dist < 15) { speed = 0; }
    }
    if (!this.def.ranged && dist < 1.45) { moveX = 0; moveZ = 0; }
    if (this.type === 'runner') {
      // slight weave
      const weave = Math.sin(t * 3.2 + this.id) * .22;
      moveX += -nz * weave; moveZ += nx * weave;
    }

    const avoid = world.steerAvoid(this.group.position.x, this.group.position.z, .9);
    let vx = moveX * speed + sepx * slow + avoid.x * 2.2;
    let vz = moveZ * speed + sepz * slow + avoid.z * 2.2;
    vx += this.push.x; vz += this.push.z;
    this.push.multiplyScalar(Math.max(0, 1 - dt * 4.5));

    // incremental collision check
    const stepX = vx * dt, stepZ = vz * dt;
    const px = this.group.position.x, pz = this.group.position.z;
    if (!world.isBlocked(px + stepX, pz, this.def.radius * .8)) this.group.position.x += stepX;
    if (!world.isBlocked(this.group.position.x, pz + stepZ, this.def.radius * .8)) this.group.position.z += stepZ;
    const lim = 43;
    this.group.position.x = Math.max(-lim, Math.min(lim, this.group.position.x));
    this.group.position.z = Math.max(-lim, Math.min(lim, this.group.position.z));

    // face movement/player
    const targetYaw = Math.atan2(-nx, -nz);
    let diff = ((targetYaw - this.group.rotation.y + Math.PI * 3) % TAU) - Math.PI;
    this.group.rotation.y += diff * Math.min(1, dt * 7);
    if (this.hitHeadTime > 0) {
      this.hitHeadTime -= dt;
      this.headGroup.rotation.z = Math.sin(this.hitHeadTime * 60) * .25;
    } else this.headGroup.rotation.z *= .9;

    // attack
    this.attackCd -= dt;
    const atkRange = this.def.attackRange + this.def.radius;
    if (dist < atkRange && this.attackCd <= 0) {
      this.attackCd = this.def.attackCd;
      this.attackAnim = .42;
      if (!this.def.ranged) {
        damagePlayer(this.def.damage, this);
        if (this.def.exploder) this.explodeTimer = Math.min(this.explodeTimer || .4, .12);
      }
    }
    if (this.attackAnim > 0) this.attackAnim -= dt;

    // spitter projectile
    if (this.def.ranged) {
      this.spitCd -= dt;
      if (dist < 20 && dist > 4 && this.spitCd <= 0 && this.attackCd <= .2) {
        this.spitCd = rand(2.8, 4.4);
        this.attackAnim = .7;
        const target = playerPos.clone(); target.y = 1.15;
        const origin = this.group.localToWorld(new THREE.Vector3(0, 1.55 * this.def.scale, -.2));
        this.manager.spawnAcid(origin, target.sub(origin).normalize(), this);
      }
    }
    if (this.def.exploder) {
      const speedUp = dist < 8 ? 1.4 : 1;
      this.speed = this.def.speed * speedUp;
      if (this.explodeTimer !== undefined) {
        this.explodeTimer -= dt;
        if (this.explodeTimer <= 0) {
          this.manager.explodeZombie(this);
          return;
        }
      }
      const pulse = 1 + Math.sin(t * 12 + this.id) * .07;
      this.matBelly.emissiveIntensity = .5 + Math.sin(t * 10) * .35;
      this.model.scale.setScalar(this.def.scale * (1 + Math.sin(t * 8) * .015));
    }
    if (this.type === 'boss') {
      this.matCore.emissiveIntensity = 1.8 + Math.sin(t * 3.5) * .7;
    }

    // animation
    const walkSpeed = this.def.speed / 1.5;
    this.animT += dt * (3.8 + walkSpeed * 3.2) * slow;
    const swing = Math.sin(this.animT);
    const swing2 = Math.cos(this.animT);
    const amp = this.type === 'runner' ? .95 : this.type === 'brute' || this.type === 'boss' ? .42 : .6;
    for (const leg of this.legs) {
      const s = leg.side;
      leg.hip.rotation.x = swing * amp * .8 * s;
      leg.knee.rotation.x = Math.max(0, -swing * s) * .65 * amp;
    }
    for (const arm of this.arms) {
      const s = arm.side;
      if (this.attackAnim > 0) {
        const k = 1 - this.attackAnim / .42;
        arm.shoulder.rotation.x = Math.sin(k * Math.PI) * 2.0;
        arm.shoulder.rotation.z = s * .12;
        arm.elbow.rotation.x = -.5;
      } else {
        arm.shoulder.rotation.x = -swing * amp * .55 * s + .12;
        arm.shoulder.rotation.z = s * (this.type === 'walker' ? .12 : .22);
        arm.elbow.rotation.x = -.18 - Math.abs(swing) * .25;
      }
    }
    this.model.position.y = Math.abs(Math.sin(this.animT * 2)) * .025;
    this.model.rotation.z = Math.sin(this.animT) * .025 + (this.type === 'spitter' ? .05 : 0);
    this.model.rotation.x = this.type === 'runner' ? .13 : this.type === 'spitter' ? .16 : 0;
    this.headGroup.rotation.x = Math.sin(this.animT * .5) * .05 - (this.type === 'runner' ? .12 : 0);
    this.headGroup.rotation.y = Math.sin(t * .8 + this.id) * .12;

    this.groanT -= dt;
    if (this.groanT <= 0) {
      this.groanT = rand(4, 10);
      if (dist < 24) {
        const pan = Math.max(-.8, Math.min(.8, (this.group.position.x - playerPos.x) / 10));
        audio.zombieGroan(pan, this.type === 'brute' || this.type === 'boss' ? 1 : 0);
      }
    }
  }
}

/* ============================================================
   Manager
   ============================================================ */
export class ZombieManager {
  constructor(scene, world, effects, audio, callbacks = {}) {
    this.scene = scene;
    this.world = world;
    this.effects = effects;
    this.audio = audio;
    this.callbacks = callbacks;
    this.onKill = callbacks.onKill;
    this.zombies = [];
    this.acids = [];
    this.acidGeo = new THREE.SphereGeometry(.12, 7, 6);
    this.acidMat = new THREE.MeshStandardMaterial({ color: 0xa8ff50, emissive: 0x88ff32, emissiveIntensity: 2.2, roughness: .2 });
    this.boss = null;
  }

  spawn(type, pos, wave = 1) {
    const z = new Zombie(type, pos, this, wave);
    z.addTo(this.scene);
    this.zombies.push(z);
    if (type === 'boss') this.boss = z;
    return z;
  }

  removeZombie(z) {
    const i = this.zombies.indexOf(z);
    if (i >= 0) this.zombies.splice(i, 1);
    if (z === this.boss) this.boss = null;
  }

  clear() {
    for (const z of this.zombies) this.scene.remove(z.group);
    this.zombies.length = 0;
    for (const a of this.acids) this.scene.remove(a.mesh);
    this.acids.length = 0;
    this.boss = null;
  }

  get alive() { return this.zombies.filter(z => !z.dead); }
  get count() { return this.zombies.filter(z => !z.dead).length; }

  rayHits(origin, dir, far = 160) {
    const hits = [];
    for (const z of this.zombies) {
      if (z.dead) continue;
      const h = z.rayHit(origin, dir, far);
      if (h) hits.push(h);
    }
    hits.sort((a, b) => a.distance - b.distance);
    return hits;
  }

  nearest(point, maxDist = 100, exclude = null) {
    let best = null, bd = maxDist * maxDist;
    for (const z of this.zombies) {
      if (z.dead || z === exclude) continue;
      const dx = z.group.position.x - point.x, dy = 1.0 * z.def.scale - point.y, dz = z.group.position.z - point.z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bd) { bd = d; best = z; }
    }
    return best;
  }

  damage(z, amount, part, dir, meta) {
    return z.damage(amount, part, dir, meta);
  }

  radiusDamage(pos, radius, damage, meta = null, falloff = true) {
    let killed = 0;
    for (const z of [...this.zombies]) {
      if (z.dead) continue;
      const c = z.torsoCenter();
      const d = c.distanceTo(pos);
      if (d <= radius) {
        const k = falloff ? Math.max(.18, 1 - d / radius) : 1;
        const dir = c.clone().sub(pos).normalize();
        if (z.damage(damage * k, 'body', dir, meta)) killed++;
        z.push.addScaledVector(dir, 3.5 * k);
      }
    }
    return killed;
  }

  coneDamage(origin, dir, range, halfAngle, damage, meta, apply = null) {
    const found = [];
    const cosA = Math.cos(halfAngle);
    for (const z of this.zombies) {
      if (z.dead) continue;
      const c = z.torsoCenter();
      const to = c.clone().sub(origin);
      const d = to.length();
      if (d > range) continue;
      to.normalize();
      if (to.dot(dir) < cosA) continue;
      found.push(z);
      if (apply) apply(z);
      z.damage(damage * (1 - d / range * .55), 'body', dir, meta);
    }
    return found;
  }

  chain(from, dir, count = 3, range = 7, damage = 80, meta = null) {
    const points = [from.clone()];
    const hit = this.rayHits(from, dir, 60);
    let current = hit[0]?.zombie || null;
    if (current) points.push(current.torsoCenter());
    let total = 0;
    let prev = current;
    const used = new Set();
    if (current) {
      used.add(current);
      current.damage(damage, hit[0].part, dir, meta);
      total++;
    }
    for (let i = 1; i < count; i++) {
      if (!prev) break;
      const p = prev.torsoCenter();
      const next = this.nearest(p, range, prev);
      if (!next || used.has(next)) break;
      used.add(next);
      points.push(next.torsoCenter());
      next.damage(damage * .8, 'body', next.torsoCenter().sub(p).normalize(), meta);
      total++;
      prev = next;
    }
    return { points, count: total };
  }

  spawnAcid(origin, dir, owner) {
    const mesh = new THREE.Mesh(this.acidGeo, this.acidMat);
    mesh.position.copy(origin);
    this.scene.add(mesh);
    this.acids.push({ mesh, vel: dir.multiplyScalar(11).add(new THREE.Vector3(0, 2.5, 0)), life: 3.2, owner });
  }

  explodeZombie(z) {
    if (z.dead) return;
    const p = z.torsoCenter();
    z.health = 0;
    z.die('body', new THREE.Vector3(0, 0, 1), { id: 'exploder', name: 'RUPTOR' });
    this.effects.explosion(p, 4, 0xff6b2a);
    this.radiusDamage(p, 4.6, 38, { id: 'exploder', name: 'RUPTOR' });
    this.callbacks.onExplosion?.(p, 4.6, 38, z);
    this.audio.explosion();
  }

  update(dt, time, playerPos, playing, damagePlayer) {
    for (const z of [...this.zombies]) {
      z.update(dt, time, playerPos, this.zombies, this.world, this.effects, this.audio, damagePlayer);
    }
    for (const a of [...this.acids]) {
      a.life -= dt;
      a.vel.y -= 4.5 * dt;
      a.mesh.position.addScaledVector(a.vel, dt);
      if (Math.random() < .6) this.effects.acid(a.mesh.position, a.vel.clone().normalize());
      if (a.mesh.position.y < .08) {
        this.effects.ice.emit({ x: a.mesh.position.x, y: .1, z: a.mesh.position.z, vx: rand(-2, 2), vy: rand(.5, 2), vz: rand(-2, 2), r: .55, g: 1, b: .25, size: .1, life: .5, gravity: 5, drag: 1, alpha: .9 });
        a.life = 0;
      }
      const p = playerPos.clone(); p.y += 1.05;
      if (a.mesh.position.distanceTo(p) < .8) {
        damagePlayer(11, null);
        a.life = 0;
        this.effects.impact(a.mesh.position, new THREE.Vector3(0, 1, 0), 'acid');
      }
      if (a.life <= 0) { this.scene.remove(a.mesh); this.acids.splice(this.acids.indexOf(a), 1); }
    }
  }
}
