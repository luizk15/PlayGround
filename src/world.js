import * as THREE from 'three';
import {
  asphaltTexture, asphaltBump, concreteTexture, metalTexture, rustTexture, chainlinkTexture,
  glowTexture, warningTexture, containerTexture, barricadeTexture, skyTexture, skylineTexture,
  fogSheetTexture,
} from './textures.js';

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();

function boxMesh(w, h, d, material, x = 0, y = 0, z = 0, cast = true, receive = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}
function cylMesh(r, h, material, x = 0, y = 0, z = 0, seg = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), material);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function rand(a, b) { return a + Math.random() * (b - a); }

export class World {
  constructor(scene) {
    this.scene = scene;
    this.hittables = [];
    this.colliders = [];
    this.fires = [];
    this.floodlights = [];
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 200;
    this.root = new THREE.Group();
    scene.add(this.root);

    this.tex = {
      asphalt: asphaltTexture(), asphaltBump: asphaltBump(),
      concrete: concreteTexture('#6f6b5e'), concreteDark: concreteTexture('#4a4a43'),
      rust: rustTexture(), metal: metalTexture('#474e50'), chain: chainlinkTexture(),
      glow: glowTexture(), warning: warningTexture(), container: containerTexture(),
      barricade: barricadeTexture(), sky: skyTexture(), skyline: skylineTexture(), fog: fogSheetTexture(),
    };
    this.setupSky();
    this.setupGround();
    this.setupFence();
    this.setupProps();
    this.setupSkyline();
    this.setupLights();
    this.setupAtmosphere();
  }

  registerHit(mesh) { this.hittables.push(mesh); return mesh; }
  addCollider(x, z, hx, hz) { this.colliders.push({ x, z, hx, hz }); }

  setupSky() {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(210, 32, 20),
      new THREE.MeshBasicMaterial({ map: this.tex.sky, side: THREE.BackSide, depthWrite: false, fog: false })
    );
    sky.position.y = 10;
    this.root.add(sky);
    this.sky = sky;

    const stars = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) {
      const a = Math.random() * Math.PI * 2;
      const y = .08 + Math.random() * .92;
      const r = Math.sqrt(1 - y * y) * 180;
      stars[i * 3] = Math.cos(a) * r;
      stars[i * 3 + 1] = 20 + y * 130;
      stars[i * 3 + 2] = Math.sin(a) * r;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(stars, 3));
    const sm = new THREE.PointsMaterial({ color: 0xaebbb6, size: .7, transparent: true, opacity: .42, depthWrite: false, fog: false });
    this.root.add(new THREE.Points(sg, sm));

    const moonTex = new THREE.CanvasTexture((() => {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(128, 128, 12, 128, 128, 126);
      g.addColorStop(0, 'rgba(247,239,207,1)'); g.addColorStop(.28, 'rgba(225,220,192,.95)');
      g.addColorStop(.35, 'rgba(200,200,178,.2)'); g.addColorStop(1, 'rgba(180,190,175,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
      ctx.globalCompositeOperation = 'source-atop';
      for (let i = 0; i < 25; i++) {
        ctx.fillStyle = `rgba(125,122,109,${rand(.03, .16)})`;
        ctx.beginPath(); ctx.arc(rand(70, 186), rand(70, 186), rand(2, 14), 0, 7); ctx.fill();
      }
      return c;
    })());
    moonTex.colorSpace = THREE.SRGBColorSpace;
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    moon.position.set(74, 88, -118);
    moon.scale.setScalar(30);
    this.root.add(moon);
  }

  setupGround() {
    const groundMat = new THREE.MeshStandardMaterial({
      map: this.tex.asphalt, bumpMap: this.tex.asphaltBump, bumpScale: .08,
      roughness: .88, metalness: .12, color: 0x8b8f8d,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(110, 110, 1, 1), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.userData.worldHit = true;
    ground.userData.surface = 'asphalt';
    this.root.add(ground);
    this.ground = ground;
    this.registerHit(ground);

    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 17),
      new THREE.MeshBasicMaterial({ map: this.tex.warning, transparent: true, opacity: .55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
    );
    decal.rotation.x = -Math.PI / 2;
    decal.rotation.z = Math.PI / 2;
    decal.position.set(0, .025, 0);
    this.root.add(decal);

    const paintMat = new THREE.MeshStandardMaterial({ color: 0xbdb6a1, roughness: .8, metalness: .02, transparent: true, opacity: .23 });
    for (let z = -38; z < 36; z += 8) {
      const dash = boxMesh(.32, .012, 3.6, paintMat, -13, .035, z, false, false);
      this.root.add(dash);
      const dash2 = dash.clone(); dash2.position.x = 13; this.root.add(dash2);
    }
    const line = boxMesh(.16, .01, 82, paintMat, 0, .034, 0, false, false); this.root.add(line);

    const puddleMat = new THREE.MeshStandardMaterial({ color: 0x0b1315, roughness: .06, metalness: .92, transparent: true, opacity: .62, depthWrite: false });
    for (let i = 0; i < 9; i++) {
      const p = new THREE.Mesh(new THREE.CircleGeometry(rand(1.2, 4.0), 22), puddleMat);
      p.rotation.x = -Math.PI / 2;
      p.scale.set(rand(.7, 1.8), rand(.35, .9), 1);
      p.rotation.z = rand(0, Math.PI);
      p.position.set(rand(-38, 38), .026, rand(-38, 38));
      this.root.add(p);
    }

    const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x5f5e55, roughness: .92, metalness: .03 });
    const rubble = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), rubbleMat, 130);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 130; i++) {
      dummy.position.set(rand(-44, 44), .02 + Math.random() * .12, rand(-44, 44));
      dummy.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      dummy.scale.set(rand(.08, .38), rand(.05, .2), rand(.08, .4));
      dummy.updateMatrix();
      rubble.setMatrixAt(i, dummy.matrix);
    }
    rubble.receiveShadow = true;
    this.root.add(rubble);

    const paperMat = new THREE.MeshStandardMaterial({ color: 0x9e9b84, roughness: .95, side: THREE.DoubleSide });
    const papers = new THREE.InstancedMesh(new THREE.PlaneGeometry(.25, .35), paperMat, 80);
    for (let i = 0; i < 80; i++) {
      dummy.position.set(rand(-38, 38), .04, rand(-38, 38));
      dummy.rotation.set(-Math.PI / 2, 0, rand(0, 6.28));
      dummy.scale.setScalar(rand(.7, 1.8));
      dummy.updateMatrix(); papers.setMatrixAt(i, dummy.matrix);
    }
    this.root.add(papers);
  }

  setupFence() {
    const fenceGroup = new THREE.Group();
    const chainMat = new THREE.MeshStandardMaterial({
      map: this.tex.chain, transparent: true, alphaTest: .32, side: THREE.DoubleSide,
      color: 0x8d948c, metalness: .75, roughness: .45,
    });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x3f4845, metalness: .75, roughness: .5 });
    const size = 90;
    for (const side of [0, 1, 2, 3]) {
      const horizontal = side < 2;
      const sign = side % 2 === 0 ? -1 : 1;
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(size, 3.6), chainMat);
      plane.position.set(horizontal ? 0 : sign * size / 2, 1.8, horizontal ? sign * size / 2 : 0);
      plane.rotation.y = horizontal ? 0 : Math.PI / 2;
      plane.receiveShadow = true;
      fenceGroup.add(plane);
      for (let p = -size / 2; p <= size / 2; p += 6) {
        const post = cylMesh(.1, 4.3, postMat, horizontal ? p : sign * size / 2, 2.15, horizontal ? sign * size / 2 : p, 6);
        fenceGroup.add(post);
      }
      const razor = boxMesh(size, .03, .03, postMat, horizontal ? 0 : sign * size / 2, 4.3, horizontal ? sign * size / 2 : 0, false, false);
      razor.rotation.y = horizontal ? 0 : Math.PI / 2;
      fenceGroup.add(razor);
    }
    this.root.add(fenceGroup);
    this.fence = fenceGroup;

    const signMat = new THREE.MeshBasicMaterial({ map: this.tex.barricade, side: THREE.DoubleSide, transparent: true, opacity: .9 });
    for (const [x, z, ry] of [[-44.6, 8, Math.PI / 2], [44.6, -14, -Math.PI / 2], [-6, -44.6, 0], [20, 44.6, Math.PI]]) {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.1), signMat);
      sign.position.set(x, 2.4, z);
      sign.rotation.y = ry;
      this.root.add(sign);
    }
  }

  addContainer(x, z, ry, color, label = 'C-09') {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    const w = 12, h = 2.8, d = 3.05;
    const bodyMat = new THREE.MeshStandardMaterial({
      map: this.tex.container, color, metalness: .62, roughness: .56,
    });
    const body = boxMesh(w, h, d, bodyMat, 0, h / 2 + .02, 0);
    body.userData.surface = 'metal';
    g.add(body);
    this.registerHit(body);
    const ribMat = new THREE.MeshStandardMaterial({ color: 0x333b38, metalness: .8, roughness: .44 });
    for (let i = -w / 2 + .5; i < w / 2; i += .9) {
      const rib = boxMesh(.1, h - .1, .06, ribMat, i, h / 2, d / 2 + .02, false, false);
      g.add(rib);
    }
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x272e2b, metalness: .8, roughness: .4 });
    for (const sx of [-1, 1]) {
      const post = boxMesh(.16, h + .06, .16, frameMat, sx * (w / 2 - .02), h / 2, d / 2 + .03);
      g.add(post);
      const post2 = post.clone(); post2.position.z = -d / 2 - .03; g.add(post2);
    }
    const topRail = boxMesh(w, .12, .16, frameMat, 0, h + .04, d / 2 + .03); g.add(topRail);
    const botRail = topRail.clone(); botRail.position.y = .05; g.add(botRail);
    const doorLine = boxMesh(.06, h - .3, .04, frameMat, 1.4, h / 2, d / 2 + .07, false, false); g.add(doorLine);
    const lock = boxMesh(.18, .26, .12, new THREE.MeshStandardMaterial({ color: 0xb4923e, metalness: .8, roughness: .3 }), 1.35, h / 2, d / 2 + .1); g.add(lock);
    if (Math.random() < .6) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(.045, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff4d26 }));
      lamp.position.set(-5.2, h - .3, d / 2 + .08); g.add(lamp);
    }
    this.root.add(g);
    const alongX = Math.abs(Math.sin(ry)) < .5;
    this.addCollider(x, z, alongX ? w / 2 : d / 2, alongX ? d / 2 : w / 2);
    return g;
  }

  addBarrier(x, z, ry = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    const shape = new THREE.Shape();
    shape.moveTo(-.36, 0); shape.lineTo(.36, 0); shape.lineTo(.24, .82); shape.lineTo(-.24, .82); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 2.3, bevelEnabled: false });
    geo.translate(0, 0, -1.15);
    const mat = new THREE.MeshStandardMaterial({ map: this.tex.concrete, color: 0x8b897c, roughness: .9, metalness: .02 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = .02;
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.surface = 'concrete';
    g.add(mesh); this.registerHit(mesh);
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(2.1, .28), new THREE.MeshBasicMaterial({ map: this.tex.barricade, transparent: true, opacity: .72 }));
    stripe.position.set(0, .48, .37); g.add(stripe);
    const stripe2 = stripe.clone(); stripe2.position.z = -.37; stripe2.rotation.y = Math.PI; g.add(stripe2);
    this.root.add(g);
    const alongX = Math.abs(Math.sin(ry)) < .5;
    this.addCollider(x, z, alongX ? 1.2 : .4, alongX ? .4 : 1.2);
  }

  addCrate(x, z, s = 1, ry = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6d4c2f, roughness: .8, metalness: .02 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3d2b1b, roughness: .85 });
    const size = 1.25 * s;
    const body = boxMesh(size, size, size, woodMat, 0, size / 2, 0);
    body.userData.surface = 'wood'; g.add(body); this.registerHit(body);
    for (const yy of [.12, size - .12]) {
      g.add(boxMesh(size + .03, .1, size + .03, dark, 0, yy, 0));
    }
    const brace = boxMesh(.1, size * 1.3, .06, dark, 0, size / 2, size / 2 + .02, false, false);
    brace.rotation.z = .78; g.add(brace);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(size * .6, size * .28), new THREE.MeshBasicMaterial({ color: 0xd6c99d, transparent: true, opacity: .3 }));
    label.position.set(0, size * .58, size / 2 + .03); g.add(label);
    this.root.add(g);
    this.addCollider(x, z, .66 * s, .66 * s);
    return g;
  }

  addSandbags(x, z, ry = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
    const mat = new THREE.MeshStandardMaterial({ color: 0x706b4f, roughness: .95 });
    const rows = 4, cols = 5;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols - (r % 2 ? 1 : 0); c++) {
        const bag = new THREE.Mesh(new THREE.CapsuleGeometry(.22, .42, 3, 8), mat);
        bag.rotation.z = Math.PI / 2;
        bag.position.set(-1.1 + c * .48 + (r % 2 ? .23 : 0), .22 + r * .33, rand(-.05, .05));
        bag.scale.set(1, 1, .72);
        bag.castShadow = true; bag.receiveShadow = true;
        g.add(bag);
      }
    }
    this.root.add(g);
    this.addCollider(x, z, 1.45, .42);
  }

  addBarrel(x, z, fire = false, color = 0x6b3120) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const mat = new THREE.MeshStandardMaterial({ map: this.tex.rust, color, metalness: .55, roughness: .66 });
    const barrel = cylMesh(.48, 1.15, mat, 0, .575, 0, 16);
    barrel.userData.surface = 'metal'; g.add(barrel); this.registerHit(barrel);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x252a29, metalness: .8, roughness: .35 });
    for (const y of [.16, .58, 1.0]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.492, .025, 5, 18), ringMat);
      ring.rotation.x = Math.PI / 2; ring.position.y = y; g.add(ring);
    }
    const lid = cylMesh(.49, .05, ringMat, 0, 1.16, 0, 16); g.add(lid);
    this.root.add(g);
    this.addCollider(x, z, .52, .52);
    if (fire) this.addFire(x, .9, z, g);
    else {
      const hazard = new THREE.Mesh(new THREE.PlaneGeometry(.45, .3), new THREE.MeshBasicMaterial({ color: 0xc5b26e, transparent: true, opacity: .48 }));
      hazard.position.set(0, .7, .49); g.add(hazard);
    }
    return g;
  }

  addFire(x, y, z, parent = null) {
    const group = new THREE.Group(); group.position.set(x, y, z);
    const glowMat = new THREE.SpriteMaterial({ map: this.tex.glow, color: 0xff7a2e, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false });
    const core = new THREE.Sprite(glowMat); core.scale.set(1.9, 2.7, 1); group.add(core);
    const smokeMat = new THREE.SpriteMaterial({ map: fogSheetTexture(), color: 0x202526, transparent: true, opacity: .18, blending: THREE.NormalBlending, depthWrite: false });
    const smoke = new THREE.Sprite(smokeMat); smoke.position.y = 1.2; smoke.scale.set(2.6, 3.6, 1); group.add(smoke);
    const light = new THREE.PointLight(0xff6a24, 16, 15, 1.8);
    light.position.y = .6; group.add(light);
    this.root.add(group);
    const fire = { group, core, smoke, light, base: 12, phase: Math.random() * 20, x, z };
    this.fires.push(fire);
    return fire;
  }

  addBus(x, z, ry = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
    const bodyMat = new THREE.MeshStandardMaterial({ map: this.tex.metal, color: 0xa9843f, metalness: .55, roughness: .7 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1d2526, metalness: .5, roughness: .4 });
    const rustMat = new THREE.MeshStandardMaterial({ map: this.tex.rust, color: 0x6d3d26, roughness: .85 });
    const body = boxMesh(3.1, 2.5, 10.8, bodyMat, 0, 1.55, 0);
    body.userData.surface = 'metal'; g.add(body); this.registerHit(body);
    const roof = boxMesh(3.0, .22, 10.6, rustMat, 0, 2.88, 0); g.add(roof);
    const belt = boxMesh(3.14, .28, 10.82, rustMat, 0, .85, 0); g.add(belt);
    const windowMat = new THREE.MeshStandardMaterial({ color: 0x142324, metalness: .85, roughness: .12, emissive: 0x061011, emissiveIntensity: .3 });
    for (let i = 0; i < 7; i++) {
      const win = boxMesh(3.16, .72, 1.1, windowMat, 0, 2.03, -4.3 + i * 1.42, false, false);
      if (i !== 3 && i !== 4) g.add(win);
    }
    const windshield = boxMesh(2.8, .8, .08, windowMat, 0, 2.08, -5.45, false, false); g.add(windshield);
    const grille = boxMesh(2.4, .55, .08, darkMat, 0, 1.2, -5.48); g.add(grille);
    for (const sx of [-1, 1]) {
      for (const zz of [-3.6, 3.6]) {
        const wheel = cylMesh(.72, .45, darkMat, sx * 1.55, .72, zz, 18);
        wheel.rotation.z = Math.PI / 2; g.add(wheel);
        const hub = cylMesh(.34, .47, new THREE.MeshStandardMaterial({ color: 0x757b78, metalness: .8, roughness: .4 }), sx * 1.56, .72, zz, 12);
        hub.rotation.z = Math.PI / 2; g.add(hub);
      }
    }
    for (let i = 0; i < 16; i++) {
      const patch = boxMesh(rand(.15, .5), rand(.08, .3), rand(.15, .6), rustMat, rand(-1.5, 1.5), rand(.4, 2.6), rand(-5, 5), false, false);
      g.add(patch);
    }
    const blood = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .8), new THREE.MeshBasicMaterial({ map: warningTexture('NÃO ENTRE', 'ISOLADO'), transparent: true, opacity: .24 }));
    blood.position.set(1.59, 1.8, 1); blood.rotation.y = Math.PI / 2; g.add(blood);
    const interior = new THREE.PointLight(0xff8b47, 2.5, 7, 2);
    interior.position.set(0, 2.2, 1); g.add(interior);
    this.root.add(g);
    const alongZ = Math.abs(Math.cos(ry)) > .5;
    this.addCollider(x, z, alongZ ? 1.7 : 5.5, alongZ ? 5.5 : 1.7);
  }

  addWatchtower(x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const metal = new THREE.MeshStandardMaterial({ color: 0x3b423f, metalness: .78, roughness: .5 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x54422e, roughness: .86 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      g.add(boxMesh(.22, 8, .22, metal, sx * 1.7, 4, sz * 1.7));
      const brace = boxMesh(.12, 5.0, .12, metal, sx * .9, 3.2, sz * 1.7);
      brace.rotation.z = sx * .33; g.add(brace);
    }
    for (const y of [3.5, 7.7]) {
      for (const side of [-1, 1]) {
        g.add(boxMesh(3.6, .15, .15, metal, 0, y, side * 1.7));
        g.add(boxMesh(.15, .15, 3.6, metal, side * 1.7, y, 0));
      }
    }
    const cab = boxMesh(3.4, 2.3, 3.4, wood, 0, 8.9, 0);
    cab.userData.surface = 'wood'; g.add(cab); this.registerHit(cab);
    const windowMat = new THREE.MeshBasicMaterial({ color: 0x0e1b1c });
    for (const side of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(2.4, .72), windowMat);
      w.position.set(0, 9.2, side * 1.71); w.rotation.y = side < 0 ? Math.PI : 0; g.add(w);
      const w2 = w.clone(); w2.rotation.y = side * Math.PI / 2; w2.position.set(side * 1.71, 9.2, 0); g.add(w2);
    }
    const roof = boxMesh(4.0, .16, 4.0, metal, 0, 10.1, 0); g.add(roof);
    const ladder = new THREE.Group(); ladder.position.set(2.3, 0, 0);
    for (const sx of [-.2, .2]) ladder.add(boxMesh(.05, 8.2, .05, metal, sx, 4.1, 0));
    for (let i = 0; i < 18; i++) ladder.add(boxMesh(.5, .035, .04, metal, 0, .6 + i * .43, 0));
    g.add(ladder);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(.1, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff4326 }));
    lamp.position.set(0, 10.3, 1.7); g.add(lamp);
    this.root.add(g);
    this.addCollider(x, z, 1.9, 1.9);
  }

  addFloodlight(x, z, targetX = 0, targetZ = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const metal = new THREE.MeshStandardMaterial({ color: 0x353d3b, metalness: .8, roughness: .45 });
    const pole = cylMesh(.16, 12, metal, 0, 6, 0, 8); g.add(pole);
    const base = cylMesh(.6, .4, new THREE.MeshStandardMaterial({ color: 0x55584f, roughness: .9 }), 0, .2, 0, 10); g.add(base);
    const head = new THREE.Group(); head.position.y = 12;
    const housing = boxMesh(2.2, .65, .45, metal, 0, 0, 0); head.add(housing);
    const lensMat = new THREE.MeshBasicMaterial({ color: 0xffe0a1 });
    for (const sx of [-.7, 0, .7]) {
      const lens = boxMesh(.55, .42, .06, lensMat, sx, 0, -.24, false, false); head.add(lens);
    }
    head.rotation.x = .3;
    g.add(head);
    const spot = new THREE.SpotLight(0xffd8a0, 85, 55, .58, .55, 1.5);
    spot.position.set(0, 12, 0);
    const target = new THREE.Object3D(); target.position.set(targetX - x, 0, targetZ - z); g.add(target);
    spot.target = target;
    g.add(spot);
    this.root.add(g);
    this.addCollider(x, z, .62, .62);

    const from = new THREE.Vector3(x, 11.8, z);
    const to = new THREE.Vector3(targetX, 0, targetZ);
    const len = from.distanceTo(to);
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(.55, 8.5, len, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd2a0, transparent: true, opacity: .028, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    cone.position.copy(from).add(to).multiplyScalar(.5);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), from.clone().sub(to).normalize());
    this.root.add(cone);
    this.floodlights.push({ spot, cone, phase: Math.random() * 10 });
  }

  setupProps() {
    this.addContainer(-22, 19, 0, 0x70837a, 'C-09');
    this.addContainer(22, -20, Math.PI / 2, 0x8a4d37, 'C-13');
    this.addContainer(-16, -30, 0, 0x5f6d77, 'C-04');
    this.addContainer(31, 30, Math.PI / 2, 0x6f7047, 'C-21');
    this.addContainer(-36, -8, Math.PI / 2, 0x5b433b, 'C-02');

    this.addBus(21, 10, 0.12);
    this.addWatchtower(-35, -35);

    this.addBarrier(-4, 12, 0.1);
    this.addBarrier(7, 17, -0.15);
    this.addBarrier(6, -15, 0.4);
    this.addBarrier(-12, -16, -0.3);
    this.addBarrier(27, -2, Math.PI / 2 + .05);
    this.addBarrier(-28, 3, Math.PI / 2 - .1);
    this.addBarrier(32, 16, Math.PI / 2 - .2);

    this.addCrate(9, 8, 1.1, .2);
    this.addCrate(10.2, 7.6, .75, -.4);
    this.addCrate(8.9, 8.3, .55, .5).position.y = 1.35;
    this.addCrate(-10, 26, 1.0, .1);
    this.addCrate(-11.4, 25.2, .8, -.3);
    this.addCrate(36, -32, 1.1, .5);
    this.addCrate(-40, 32, .9, -.2);

    this.addSandbags(-24, 13, .2);
    this.addSandbags(26, 26, -.6);
    this.addSandbags(-4, -36, 0);
    this.addSandbags(14, -30, .1);

    this.addBarrel(-6, 8, true, 0x5d2d1f);
    this.addBarrel(-5.1, 8.2, false, 0x354d3f);
    this.addBarrel(18, -12, true, 0x3d3a32);
    this.addBarrel(-17, -4, false, 0x5b4432);
    this.addBarrel(33, 2, true, 0x542b20);
    this.addBarrel(-37, 22, false, 0x2e4d44);

    this.addFloodlight(-39, 36, -10, -2);
    this.addFloodlight(39, 34, 10, 0);
    this.addFloodlight(-38, -36, -4, 4);

    // scattered debris and cover
    const debrisMat = new THREE.MeshStandardMaterial({ color: 0x4e4a3d, metalness: .4, roughness: .8 });
    for (let i = 0; i < 28; i++) {
      const w = rand(.2, 1.1), h = rand(.1, .35), d = rand(.4, 2.0);
      const dMesh = boxMesh(w, h, d, debrisMat, rand(-42, 42), h / 2, rand(-42, 42), true, true);
      dMesh.rotation.y = rand(0, Math.PI);
      this.root.add(dMesh);
    }

    // Blood trails handprints on containers / ground
    const bloodMat = new THREE.MeshBasicMaterial({ color: 0x4a0c08, transparent: true, opacity: .45 });
    for (let i = 0; i < 14; i++) {
      const p = new THREE.Mesh(new THREE.CircleGeometry(rand(.15, .5), 8), bloodMat);
      p.rotation.x = -Math.PI / 2; p.position.set(rand(-42, 42), .04, rand(-42, 42));
      p.scale.y = rand(.4, 1.4); this.root.add(p);
    }
  }

  setupSkyline() {
    const mat = new THREE.MeshBasicMaterial({ map: this.tex.skyline, transparent: true, side: THREE.BackSide, depthWrite: false, fog: false, opacity: .9 });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(72, 72, 26, 72, 1, true), mat);
    ring.position.y = 11;
    this.root.add(ring);
    const ring2 = new THREE.Mesh(new THREE.CylinderGeometry(64, 64, 18, 64, 1, true), new THREE.MeshBasicMaterial({ color: 0x030708, side: THREE.BackSide, transparent: true, opacity: .5 }));
    ring2.position.y = 7; this.root.add(ring2);

    const fogMat = new THREE.MeshBasicMaterial({ map: this.tex.fog, transparent: true, opacity: .55, depthWrite: false, side: THREE.DoubleSide, color: 0x71837e });
    for (let i = 0; i < 4; i++) {
      const fog = new THREE.Mesh(new THREE.PlaneGeometry(80, 22), fogMat);
      const a = i * Math.PI / 2;
      fog.position.set(Math.cos(a) * 51, 8, Math.sin(a) * 51);
      fog.rotation.y = -a + Math.PI / 2;
      this.root.add(fog);
    }
  }

  setupLights() {
    const hemi = new THREE.HemisphereLight(0x5d7a88, 0x241b14, 1.0);
    this.scene.add(hemi);
    const ambient = new THREE.AmbientLight(0x2b3a42, .35);
    this.scene.add(ambient);
    const moon = new THREE.DirectionalLight(0xa9c3d6, 2.1);
    moon.position.set(40, 55, -35);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.left = -55; moon.shadow.camera.right = 55;
    moon.shadow.camera.top = 55; moon.shadow.camera.bottom = -55;
    moon.shadow.camera.near = 5; moon.shadow.camera.far = 140;
    moon.shadow.bias = -.0005;
    this.scene.add(moon);
    this.moonLight = moon;

    const fill = new THREE.PointLight(0x3c6977, 8, 45, 2);
    fill.position.set(0, 8, 0);
    this.scene.add(fill);
  }

  setupAtmosphere() {
    const dustGeo = new THREE.BufferGeometry();
    const count = 520;
    const pos = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = rand(-48, 48);
      pos[i * 3 + 1] = rand(.2, 12);
      pos[i * 3 + 2] = rand(-48, 48);
      phases[i] = Math.random() * 10;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dustMat = new THREE.PointsMaterial({ color: 0x9b9c88, size: .055, transparent: true, opacity: .34, depthWrite: false });
    this.dust = new THREE.Points(dustGeo, dustMat);
    this.root.add(this.dust);
    this.dustPhases = phases;
    this.dustBase = pos.slice();
    this.time = 0;
  }

  update(dt, t) {
    this.time = t;
    for (const fire of this.fires) {
      const f = Math.sin(t * 9 + fire.phase) * .18 + Math.sin(t * 21 + fire.phase) * .08;
      fire.core.scale.set(1.8 + f * .8, 2.7 + f * 1.1, 1);
      fire.core.material.opacity = .72 + f * .25;
      fire.light.intensity = fire.base + f * 8;
      fire.smoke.position.y = 1.25 + f * .15;
      fire.smoke.scale.set(2.5 + f * .4, 3.5 + f * .6, 1);
    }
    for (const fl of this.floodlights) {
      fl.spot.intensity = 82 + Math.sin(t * 13 + fl.phase) * 2;
    }
    if (this.dust) {
      const p = this.dust.geometry.attributes.position.array;
      for (let i = 0; i < p.length / 3; i++) {
        p[i * 3] += Math.sin(t * .17 + this.dustPhases[i]) * .0018;
        p[i * 3 + 1] += Math.sin(t * .11 + this.dustPhases[i]) * .001;
        p[i * 3 + 2] += Math.cos(t * .14 + this.dustPhases[i]) * .0012;
      }
      this.dust.geometry.attributes.position.needsUpdate = true;
    }
  }

  resolvePlayer(pos, radius = .38) {
    const lim = 43.2;
    pos.x = Math.max(-lim, Math.min(lim, pos.x));
    pos.z = Math.max(-lim, Math.min(lim, pos.z));
    for (let pass = 0; pass < 2; pass++) {
      for (const c of this.colliders) {
        const dx = pos.x - c.x, dz = pos.z - c.z;
        const ox = c.hx + radius - Math.abs(dx);
        const oz = c.hz + radius - Math.abs(dz);
        if (ox > 0 && oz > 0) {
          if (ox < oz) pos.x += Math.sign(dx || 1) * ox;
          else pos.z += Math.sign(dz || 1) * oz;
        }
      }
    }
    pos.x = Math.max(-lim, Math.min(lim, pos.x));
    pos.z = Math.max(-lim, Math.min(lim, pos.z));
  }

  steerAvoid(x, z, radius = .9) {
    let ax = 0, az = 0;
    for (const c of this.colliders) {
      const cx = Math.max(c.x - c.hx, Math.min(c.x + c.hx, x));
      const cz = Math.max(c.z - c.hz, Math.min(c.z + c.hz, z));
      const dx = x - cx, dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        const d = Math.sqrt(d2) || .001;
        const force = (radius - d) / radius;
        ax += (dx / d) * force;
        az += (dz / d) * force;
      }
    }
    if (Math.abs(x) > 41.5) ax -= Math.sign(x) * (Math.abs(x) - 41.5) * .4;
    if (Math.abs(z) > 41.5) az -= Math.sign(z) * (Math.abs(z) - 41.5) * .4;
    return { x: ax, z: az };
  }

  isBlocked(x, z, r = .7) {
    if (Math.abs(x) > 43.5 || Math.abs(z) > 43.5) return true;
    for (const c of this.colliders) {
      if (Math.abs(x - c.x) < c.hx + r && Math.abs(z - c.z) < c.hz + r) return true;
    }
    return false;
  }

  spawnPoint(playerPos, minDist = 20) {
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = rand(27, 40);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.hypot(x - playerPos.x, z - playerPos.z) < minDist) continue;
      if (this.isBlocked(x, z, 1.0)) continue;
      return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(rand(-28, 28), 0, rand(-28, 28));
  }

  raycast(origin, dir, far = 150) {
    this.raycaster.set(origin, dir);
    this.raycaster.far = far;
    const hits = this.raycaster.intersectObjects(this.hittables, false);
    if (!hits.length) return null;
    const hit = hits[0];
    if (hit.distance > far) return null;
    let normal = new THREE.Vector3(0, 1, 0);
    if (hit.face) {
      normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld).normalize();
    }
    return { distance: hit.distance, point: hit.point, normal, object: hit.object, surface: hit.object.userData.surface || 'concrete' };
  }

  // flat map for radar
  radarShapes() { return this.colliders; }
}
