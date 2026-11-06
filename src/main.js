import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { World } from './world.js';
import { Effects } from './effects.js';
import { ZombieManager, ZOMBIE_TYPES } from './zombies.js';
import { AudioEngine } from './audio.js';
import { WEAPONS, WEAPON_BY_ID, CATEGORY_LABELS, buildWeaponModel, statBars } from './weapons.js';
import { generateWeaponThumbnails } from './thumbnails.js';
import { glowTexture } from './textures.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad2 = (n) => String(n).padStart(2, '0');
const now = () => performance.now();
const fmtTime = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
};

const CATEGORY_KEYS = ['PISTOLA', 'SMG', 'FUZIL', 'SHOTGUN', 'SNIPER', 'LMG', 'ESPECIAL', 'CORPO'];
const CATEGORY_SHORT = { PISTOLA: 'PST', SMG: 'SMG', FUZIL: 'RIF', SHOTGUN: 'SHT', SNIPER: 'SNP', LMG: 'LMG', ESPECIAL: 'ESP', CORPO: 'MEL' };
const WEAPON_COLORS = {
  PISTOLA: 0xffc26e, SMG: 0xa9d6c3, FUZIL: 0xff9a58, SHOTGUN: 0xe9a371,
  SNIPER: 0xb1c9d6, LMG: 0xc7b681, ESPECIAL: 0x85e4c0, CORPO: 0xd6d3c4,
};

class Game {
  constructor() {
    this.dom = {};
    this.touch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window);
    this.phase = 'loading';
    this.menuT = 0;
    this.lastFrame = now();
    this.clock = new THREE.Clock();
    this.thumbnails = {};
    this.weaponEntries = new Map();
    this.projectiles = [];
    this.pickups = [];
    this.killFeedItems = [];
    this.tmpV = new THREE.Vector3();
    this.tmpV2 = new THREE.Vector3();
    this.tmpDir = new THREE.Vector3();
    this.aiming = false;
    this.firing = false;
    this.dragging = false;
    this.keys = Object.create(null);
    this.touchMove = { x: 0, y: 0 };
    this.touchLook = { x: 0, y: 0 };
    this.lastHudUpdate = 0;
    this.menuOrbit = 0;
    this.firstFrame = true;
    this.frameCount = 0;
    this.fps = 60;

    this.cacheDom();
    this.setupRenderer();
    this.setupScene();
    this.setupWeaponRig();
    this.setupInventory();
    this.setupUI();
    this.setupInput();
    this.setupThumbnails();
    this.enterMenu(true);

    this.dom.loader.classList.add('done');
    requestAnimationFrame((t) => this.animate(t));
  }

  cacheDom() {
    const ids = [
      'game-canvas', 'menu', 'hud', 'playBtn', 'armoryMenuBtn', 'menuAudioBtn', 'fullscreenBtn',
      'pauseBtn', 'audioBtn', 'armory', 'armoryCloseBtn', 'armoryGrid', 'armoryFilter',
      'detailKicker', 'detailName', 'detailImage', 'detailDesc', 'detailStats', 'detailAmmo', 'equipBtn',
      'heroWeapon', 'heroWeaponName', 'heroWeaponMeta', 'waveLabel', 'waveTimer', 'waveProgress',
      'threatLabel', 'enemiesLeft', 'score', 'combo', 'healthText', 'healthBar', 'armorText', 'armorBar',
      'weaponCategory', 'ammoMode', 'weaponName', 'ammoMag', 'ammoReserve', 'grenadeCount',
      'reloadProgress', 'weaponSlot', 'weaponQuick', 'crosshair', 'reloadRing', 'killfeed',
      'headshotTag', 'pickupToast', 'bossBar', 'bossHealth', 'bossHealthText', 'radar', 'damage-vignette',
      'hit-flash', 'scopeOverlay', 'waveBanner', 'wbNumber', 'wbSub', 'intermission', 'interWave',
      'interKills', 'interAcc', 'interTime', 'interCountdown', 'pause', 'resumeBtn', 'pauseArmoryBtn',
      'restartBtn', 'quitBtn', 'pauseWave', 'pauseWaveNum', 'pauseKills', 'pauseScore', 'pauseWeapon',
      'gameover', 'goWave', 'goKills', 'goScore', 'goAcc', 'goHeads', 'goTime', 'retryBtn', 'goMenuBtn',
      'touchLayer', 'joystick', 'joystickKnob', 'lookArea', 'touchFire', 'touchAim', 'touchReload',
      'touchJump', 'touchSwap', 'touchNade', 'contextTip', 'flashlightState', 'vitalStatus', 'bleedStatus',
      'loader', 'rotateHint', 'intermission', 'ambientAudioBtn',
    ];
    for (const id of ids) this.dom[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = $(id);
    this.dom.hud = $('hud');
    this.dom.canvas = $('game-canvas');
    this.dom.vitals = document.querySelector('.vitals');
    this.dom.ammoBlock = document.querySelector('.ammo-block');
    this.dom.ammoReadout = document.querySelector('.ammo-readout');
    this.dom.crosshairEl = $('crosshair');
    this.dom.scopeOverlay = $('scopeOverlay');
    this.dom.damageVignette = $('damage-vignette');
    this.dom.hitFlash = $('hit-flash');
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.dom.canvas, antialias: true, powerPreference: 'high-performance', stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.touch ? 1.15 : 1.6));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.info.autoReset = false;
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x091012, this.touch ? .018 : .0155);
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, .045, 260);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.world = new World(this.scene);
    this.effects = new Effects(this.scene, this.camera);
    this.audio = new AudioEngine();
    this.zombies = new ZombieManager(this.scene, this.world, this.effects, this.audio, {
      onKill: (z, part, meta) => this.onZombieKill(z, part, meta),
      onExplosion: (p, r, d, z) => this.onExplosion(p, r, d, z),
    });

    this.flashlight = new THREE.SpotLight(0xffe1b0, this.touch ? 4 : 5, 34, .55, .68, 1.35);
    this.flashlight.position.set(.12, -.1, 0);
    this.flashlight.target.position.set(0, 0, -10);
    this.camera.add(this.flashlight);
    this.camera.add(this.flashlight.target);
    this.flashlightOn = true;

    this.cameraFill = new THREE.PointLight(0xffddbd, 1.5, 2.4, 2);
    this.cameraFill.position.set(.05, 0, .05);
    this.camera.add(this.cameraFill);

    this.sceneLight = new THREE.PointLight(0x8db1ba, 1.4, 60, 2);
    this.sceneLight.position.set(0, 12, 0);
    this.scene.add(this.sceneLight);

    this.muzzleLight = new THREE.PointLight(0xffa35a, 0, 9, 2);
    this.scene.add(this.muzzleLight);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      this.touch ? .28 : .38,
      .58,
      .86
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', () => setTimeout(this.resize, 120));
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.touch ? 1.15 : 1.6));
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
  }

  /* ------------------------------------------------------------
     Weapon viewmodel + arms
     ------------------------------------------------------------ */
  setupWeaponRig() {
    this.weaponRig = new THREE.Group();
    this.weaponRig.visible = false;
    this.weaponRig.scale.setScalar(.68);
    this.camera.add(this.weaponRig);
    this.camera.layers.enable(1);
    this.currentIndex = 6;
    this.previousIndex = 6;
    this.rigBase = new THREE.Vector3(.40, -.29, -.96);
    this.rigBaseRot = new THREE.Euler(.02, .2, .015);

    // dedicated viewmodel lighting so the world flashlight does not blow out the gun
    this.gunAmbient = new THREE.AmbientLight(0x8a948c, .5);
    this.gunAmbient.layers.set(1);
    this.camera.add(this.gunAmbient);
    this.gunKey = new THREE.PointLight(0xffd2a6, 1.3, 3.6, 1.6);
    this.gunKey.position.set(.75, .75, .35);
    this.gunKey.layers.set(1);
    this.camera.add(this.gunKey);
    this.gunFill = new THREE.PointLight(0x6590a4, .85, 3.2, 1.8);
    this.gunFill.position.set(-.8, -.35, .2);
    this.gunFill.layers.set(1);
    this.camera.add(this.gunFill);
    this.adsT = 0;
    this.equipT = 0;
    this.rigKick = 0;
    this.rigKickRot = 0;
    this.weaponSway = { x: 0, y: 0, tx: 0, ty: 0 };
    this.bobPhase = 0;
    this.flashTimer = 0;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    this.gloveMat = new THREE.MeshStandardMaterial({ color: 0x171a18, roughness: .76, metalness: .05 });
    this.sleeveMat = new THREE.MeshStandardMaterial({ color: 0x30382f, roughness: .96, metalness: .01 });
    this.sleeveMat2 = new THREE.MeshStandardMaterial({ color: 0x20261f, roughness: .95 });
  }

  ensureWeaponEntry(index) {
    if (this.weaponEntries.has(index)) return this.weaponEntries.get(index);
    const def = WEAPONS[index];
    const model = buildWeaponModel(def);
    const arms = this.buildArms(def, model);
    model.visible = false;
    arms.visible = false;
    model.traverse(o => o.layers.set(1));
    arms.traverse(o => o.layers.set(1));
    this.weaponRig.add(model);
    this.weaponRig.add(arms);
    const entry = { model, arms, def };
    this.weaponEntries.set(index, entry);
    return entry;
  }

  buildArms(def, model) {
    const arms = new THREE.Group();
    const grip = model.userData.gripPos || [0, -.08, .02];
    const support = model.userData.supportPos;
    const addArm = (x, y, z, side, mirrored = false) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(.075, 8, 6), this.gloveMat);
      hand.scale.set(1, 1.25, .72);
      hand.position.set(0, 0, 0);
      hand.rotation.x = .35;
      g.add(hand);
      for (let i = 0; i < 3; i++) {
        const finger = new THREE.Mesh(new THREE.CapsuleGeometry(.017, .05, 3, 5), this.gloveMat);
        finger.position.set((i - 1) * .034, .055, -.035);
        finger.rotation.x = -.7;
        g.add(finger);
      }
      const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(.068, .24, 4, 8), this.sleeveMat);
      sleeve.position.set(side * .055, -.18, .12);
      sleeve.rotation.set(-.52, 0, side * .35);
      g.add(sleeve);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(.073, .082, .075, 8), this.sleeveMat2);
      cuff.position.set(side * .022, -.105, .052);
      cuff.rotation.set(-.52, 0, side * .3);
      g.add(cuff);
      arms.add(g);
      return g;
    };
    addArm(grip[0] + .01, grip[1], grip[2] + .015, -.15);
    if (support && support[2] < -.12) addArm(support[0], support[1], support[2], .16);
    else if (support) addArm(support[0] - .02, support[1], support[2] + .01, .05, true);
    if (def.melee) {
      // second hand supports the handle when available
      if (def.id === 'katana') addArm(0, -.11, .13, .12);
      if (def.id === 'chainsaw') addArm(-.02, -.09, .23, .1);
    }
    arms.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; } });
    return arms;
  }

  equipWeapon(index, opts = {}) {
    index = ((index % WEAPONS.length) + WEAPONS.length) % WEAPONS.length;
    if (index === this.currentIndex && !opts.force && this.weaponEntries.has(index)) {
      this.updateWeaponHud();
      return;
    }
    const prevEntry = this.weaponEntries.get(this.currentIndex);
    if (prevEntry) { prevEntry.model.visible = false; prevEntry.arms.visible = false; }
    if (!opts.silent) this.previousIndex = this.currentIndex;
    this.currentIndex = index;
    const def = WEAPONS[index];
    const entry = this.ensureWeaponEntry(index);
    entry.model.visible = true;
    entry.arms.visible = true;
    this.currentWeapon = def;
    this.lastByCategory[def.category] = index;
    this.reloading = 0;
    this.reloadTotal = 0;
    this.adsT = 0;
    this.aiming = false;
    this.equipT = opts.instant ? 0 : .38;
    this.rigKick = 0;
    this.flashTimer = 0;
    const cat = def.category;
    if (def.melee) {
      this.rigBase.set(.38, -.35, -.74);
      this.rigBaseRot.set(.06, .18, .02);
    } else if (cat === 'PISTOLA') {
      this.rigBase.set(.31, -.26, -.78);
      this.rigBaseRot.set(.015, .13, .015);
    } else if (cat === 'LMG' || def.id === 'minigun' || def.id === 'rpg') {
      this.rigBase.set(.44, -.32, -1.08);
      this.rigBaseRot.set(.02, .15, .01);
    } else {
      this.rigBase.set(.40, -.29, -.97);
      this.rigBaseRot.set(.02, .2, .015);
    }
    this.aimPos = cat === 'PISTOLA' ? new THREE.Vector3(0, -.07, -.74) : new THREE.Vector3(0, -.11, -.86);
    this.weaponRig.position.copy(this.rigBase);
    this.weaponRig.rotation.copy(this.rigBaseRot);
    this.weaponRig.visible = true;
    if (!opts.silent) this.updateWeaponHud();
    if (!opts.silent && this.phase === 'playing') this.audio.ui();
    if (this.dom.crosshair) this.dom.crosshair.style.opacity = def.melee ? '.3' : '';
    if (this.dom.scopeOverlay) this.dom.scopeOverlay.classList.add('hidden');
  }

  setupInventory() {
    this.inventory = WEAPONS.map((w) => ({
      id: w.id,
      ammo: w.mag === Infinity ? Infinity : w.mag,
      reserve: w.reserve === Infinity ? Infinity : w.reserve,
      maxReserve: w.reserve === Infinity ? Infinity : Math.max(w.reserve * 2, w.reserve + 60),
    }));
    this.lastByCategory = {};
    this.currentWeapon = WEAPONS[this.currentIndex];
    this.lastByCategory['FUZIL'] = this.currentIndex;
    this.equipWeapon(this.currentIndex, { instant: true, silent: true });
  }

  /* ------------------------------------------------------------
     Static UI
     ------------------------------------------------------------ */
  setupUI() {
    this.dom.quickButtons = [];
    for (let i = 0; i < CATEGORY_KEYS.length; i++) {
      const cat = CATEGORY_KEYS[i];
      const b = document.createElement('button');
      b.className = 'quick-weapon';
      b.dataset.cat = cat;
      b.textContent = CATEGORY_SHORT[cat];
      b.title = `${CATEGORY_LABELS[cat]} [${i + 1}]`;
      b.addEventListener('click', () => { if (this.phase === 'playing' || this.phase === 'paused') this.selectCategory(cat); });
      this.dom.weaponQuick.appendChild(b);
      this.dom.quickButtons.push(b);
    }

    this.buildArmory();
    this.dom.armoryGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.weapon-card');
      if (!card) return;
      const idx = Number(card.dataset.index);
      this.selectArmoryWeapon(idx, true);
      if (this.touch) this.equipFromArmory();
    });
    this.dom.armoryGrid.addEventListener('dblclick', (e) => {
      const card = e.target.closest('.weapon-card');
      if (card) { this.selectArmoryWeapon(Number(card.dataset.index), true); this.equipFromArmory(); }
    });
    this.dom.armoryFilter.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      this.armoryFilter = b.dataset.cat;
      [...this.dom.armoryFilter.children].forEach(x => x.classList.toggle('active', x === b));
      [...this.dom.armoryGrid.children].forEach(card => {
        card.style.display = (this.armoryFilter === 'ALL' || WEAPONS[Number(card.dataset.index)].category === this.armoryFilter) ? '' : 'none';
      });
      this.audio.ui();
    });
    this.dom.equipBtn.addEventListener('click', () => this.equipFromArmory());
    this.selectArmoryWeapon(6, false);

    this.dom.playBtn.addEventListener('click', () => this.startGame());
    this.dom.armoryMenuBtn.addEventListener('click', () => this.openArmory('menu'));
    this.dom.armoryCloseBtn.addEventListener('click', () => this.closeArmory());
    this.dom.audioBtn.addEventListener('click', () => this.toggleMute());
    this.dom.menuAudioBtn.addEventListener('click', () => this.toggleMute());
    this.dom.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    this.dom.pauseBtn.addEventListener('click', () => this.openPause());
    this.dom.resumeBtn.addEventListener('click', () => this.resumeGame());
    this.dom.pauseArmoryBtn.addEventListener('click', () => this.openArmory('pause'));
    this.dom.restartBtn.addEventListener('click', () => this.restartGame());
    this.dom.quitBtn.addEventListener('click', () => this.enterMenu());
    this.dom.retryBtn.addEventListener('click', () => this.restartGame());
    this.dom.goMenuBtn.addEventListener('click', () => this.enterMenu());
    this.dom.touchLayer.classList.toggle('hidden', !this.touch);
    this.dom.touchFire.addEventListener('pointerdown', (e) => { e.preventDefault(); this.beginFire(); this.dom.touchFire.classList.add('pressed'); });
    this.dom.touchFire.addEventListener('pointerup', () => { this.endFire(); this.dom.touchFire.classList.remove('pressed'); });
    this.dom.touchFire.addEventListener('pointercancel', () => { this.endFire(); this.dom.touchFire.classList.remove('pressed'); });
    this.dom.touchReload.addEventListener('pointerdown', (e) => { e.preventDefault(); this.startReload(); });
    this.dom.touchJump.addEventListener('pointerdown', (e) => { e.preventDefault(); this.jump(); });
    this.dom.touchSwap.addEventListener('pointerdown', (e) => { e.preventDefault(); this.cycleWeapon(1); });
    this.dom.touchNade.addEventListener('pointerdown', (e) => { e.preventDefault(); this.throwGrenade(); });
    this.dom.touchAim.addEventListener('pointerdown', (e) => { e.preventDefault(); this.aiming = true; this.dom.touchAim.classList.add('pressed'); });
    this.dom.touchAim.addEventListener('pointerup', () => { this.aiming = false; this.dom.touchAim.classList.remove('pressed'); });
    this.dom.touchAim.addEventListener('pointercancel', () => { this.aiming = false; this.dom.touchAim.classList.remove('pressed'); });
    this.setupTouch();
    this.setupRadarBg?.();
  }

  buildArmory() {
    this.dom.armoryGrid.innerHTML = '';
    this.armoryCards = [];
    WEAPONS.forEach((w, i) => {
      const card = document.createElement('button');
      card.className = 'weapon-card';
      card.dataset.index = i;
      card.innerHTML = `
        <div class="wc-img"><img alt="${w.name}" style="opacity:0;transition:opacity .25s" /></div>
        <div class="wc-meta"><span class="wc-name">${w.name}</span><span class="wc-cat">${w.catShort}</span></div>
        <span class="wc-num">${pad2(i + 1)}</span>`;
      this.dom.armoryGrid.appendChild(card);
      this.armoryCards.push(card);
    });
  }

  setupThumbnails() {
    generateWeaponThumbnails((images, id) => {
      Object.assign(this.thumbnails, images);
      const apply = (weaponId) => {
        const src = images[weaponId];
        if (!src) return;
        const w = WEAPON_BY_ID[weaponId];
        if (!w) return;
        const card = this.armoryCards[w.index];
        const img = card?.querySelector('img');
        if (img) { img.src = src; img.style.opacity = '1'; }
        if (weaponId === 'ak47') {
          this.dom.heroWeapon.src = src;
          this.dom.heroWeapon.classList.add('ready');
          this.dom.heroWeaponName.textContent = 'AK-47';
          this.dom.heroWeaponMeta.textContent = 'FUZIL DE ASSALTO // 7.62×39';
        }
        if (this.detailWeapon?.id === weaponId) {
          this.dom.detailImage.src = src;
          this.dom.detailImage.style.opacity = '1';
        }
      };
      if (id) apply(id);
      else Object.keys(images).forEach(apply);
    });
  }

  setupThumbnailFallback() {
    // no-op placeholder
  }

  /* ------------------------------------------------------------
     Input
     ------------------------------------------------------------ */
  setupInput() {
    window.addEventListener('keydown', (e) => {
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (this.phase === 'playing') {
        if (e.code === 'KeyR') this.startReload();
        else if (e.code === 'KeyF') this.toggleFlashlight();
        else if (e.code === 'KeyG') this.throwGrenade();
        else if (e.code === 'KeyQ') this.quickSwap();
        else if (e.code === 'Space') this.jump();
        else if (e.code === 'Tab') this.openArmory('playing');
        else if (e.code === 'Escape') this.openPause();
        else if (e.code.startsWith('Digit')) {
          const n = Number(e.code.slice(5));
          if (n >= 1 && n <= 8) this.selectCategory(CATEGORY_KEYS[n - 1]);
        }
      } else if (this.phase === 'paused') {
        if (e.code === 'Escape') this.resumeGame();
        else if (e.code === 'Tab') this.openArmory('pause');
      } else if (this.phase === 'armory') {
        if (e.code === 'Escape') this.closeArmory();
      } else if (this.phase === 'dead') {
        if (e.code === 'Enter') this.restartGame();
      } else if (this.phase === 'menu') {
        if (e.code === 'Enter') this.startGame();
      }
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    this.dom.canvas.addEventListener('mousedown', (e) => {
      if (this.phase !== 'playing') return;
      if (e.button === 0) {
        this.beginFire();
        this.dragging = true;
      } else if (e.button === 2) {
        this.aiming = true;
      }
      if (document.pointerLockElement !== this.dom.canvas) this.requestLock();
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.endFire();
      if (e.button === 2) this.aiming = false;
      this.dragging = false;
    });
    this.dom.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (this.phase !== 'playing') return;
      const locked = document.pointerLockElement === this.dom.canvas;
      if (!locked && !this.dragging) return;
      const sens = (this.aiming ? .00145 : .0023) * (this.isScoped() ? .55 : 1);
      this.player.yaw -= e.movementX * sens;
      this.player.pitch -= e.movementY * sens;
      this.player.pitch = clamp(this.player.pitch, -1.35, 1.3);
      this.weaponSway.tx = clamp(this.weaponSway.tx + e.movementX * .00035, -.03, .03);
      this.weaponSway.ty = clamp(this.weaponSway.ty - e.movementY * .00028, -.02, .02);
    });
    window.addEventListener('wheel', (e) => {
      if (this.phase !== 'playing') return;
      e.preventDefault();
      this.cycleWeapon(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.phase === 'playing') this.firing = false;
    });
    window.addEventListener('blur', () => { this.keys = Object.create(null); this.firing = false; this.aiming = false; });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.phase === 'playing') this.openPause();
    });
  }

  setupTouch() {
    if (!this.touch) return;
    this.dom.lookArea.style.pointerEvents = 'auto';
    let lookId = null, lx = 0, ly = 0;
    this.dom.lookArea.addEventListener('pointerdown', (e) => {
      if (this.phase !== 'playing') return;
      lookId = e.pointerId; lx = e.clientX; ly = e.clientY;
      this.dom.lookArea.setPointerCapture(e.pointerId);
    });
    this.dom.lookArea.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lookId || this.phase !== 'playing') return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      const sens = this.aiming ? .0032 : .0044;
      this.player.yaw -= dx * sens;
      this.player.pitch = clamp(this.player.pitch - dy * sens, -1.3, 1.25);
    });
    const endLook = (e) => { if (e.pointerId === lookId) lookId = null; };
    this.dom.lookArea.addEventListener('pointerup', endLook);
    this.dom.lookArea.addEventListener('pointercancel', endLook);

    let joyId = null;
    const updateJoy = (e) => {
      const r = this.dom.joystick.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const max = r.width * .34;
      const d = Math.hypot(dx, dy);
      if (d > max) { dx = dx / d * max; dy = dy / d * max; }
      this.dom.joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      this.touchMove.x = dx / max; this.touchMove.y = dy / max;
    };
    this.dom.joystick.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.phase !== 'playing') return;
      joyId = e.pointerId; this.dom.joystick.setPointerCapture(e.pointerId); updateJoy(e);
    });
    this.dom.joystick.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) updateJoy(e); });
    const resetJoy = (e) => {
      if (e.pointerId !== joyId) return;
      joyId = null; this.touchMove.x = 0; this.touchMove.y = 0;
      this.dom.joystickKnob.style.transform = 'translate(-50%,-50%)';
    };
    this.dom.joystick.addEventListener('pointerup', resetJoy);
    this.dom.joystick.addEventListener('pointercancel', resetJoy);
  }

  requestLock() {
    if (this.touch) return;
    try {
      const p = this.dom.canvas.requestPointerLock?.();
      if (p?.catch) p.catch(() => {});
    } catch {}
  }

  /* ------------------------------------------------------------
     Menu / game lifecycle
     ------------------------------------------------------------ */
  enterMenu(first = false) {
    this.phase = 'menu';
    this.firing = false; this.aiming = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.zombies.clear();
    this.clearPickups();
    this.clearProjectiles();
    this.dom.menu.classList.remove('hidden');
    this.dom.hud.classList.add('hidden');
    this.dom.pause.classList.add('hidden');
    this.dom.armory.classList.add('hidden');
    this.dom.gameover.classList.add('hidden');
    this.dom.intermission.classList.add('hidden');
    this.dom.bossBar.classList.add('hidden');
    this.dom.scopeOverlay.classList.add('hidden');
    this.dom.waveBanner.classList.remove('show');
    this.dom.touchLayer.classList.add('hidden');
    this.weaponRig.visible = false;
    this.aiming = false;
    this.dom.damageVignette.style.opacity = '0';
    this.menuOrbit = 0;
    this.camera.position.set(27, 7.2, 33);
    this.camera.lookAt(0, 2, 0);
    if (!first) this.audio.ui();
  }

  startGame() {
    if (this.phase === 'playing') return;
    this.audio.init();
    this.phase = 'playing';
    this.dom.menu.classList.add('hidden');
    this.dom.armory.classList.add('hidden');
    this.dom.pause.classList.add('hidden');
    this.dom.gameover.classList.add('hidden');
    this.dom.hud.classList.remove('hidden');
    this.dom.hud.setAttribute('aria-hidden', 'false');
    this.weaponRig.visible = true;
    if (this.touch) this.dom.touchLayer.classList.remove('hidden');
    this.resetGame();
    this.requestLock();
    this.audio.ui();
  }

  resetGame() {
    this.player = {
      pos: new THREE.Vector3(0, 0, 23),
      vel: new THREE.Vector3(),
      yaw: 0, pitch: -.015,
      height: 1.7, onGround: true,
      health: 100, armor: 50,
    };
    this.grenades = 3;
    this.stats = {
      kills: 0, headshots: 0, shotsFired: 0, shotsHit: 0, score: 0,
      combo: 1, lastKill: -100, started: now(),
    };
    this.reloading = 0; this.reloadTotal = 0;
    this.rigKick = 0; this.equipT = .38;
    this.firing = false; this.aiming = false;
    this.zombies.clear();
    this.clearProjectiles();
    this.clearPickups();
    this.spawnQueue = [];
    this.intermissionActive = false;
    this.intermissionTimer = 0;
    this.wave = 0;
    this.boss = null;
    this.damageCooldown = 0;
    this.hurtTime = 0;
    this.shake = 0;
    this.regenTimer = 0;
    this.waveStats = { kills: 0, shots: 0, hits: 0, start: now() };
    this.inventory = WEAPONS.map((w) => ({
      id: w.id,
      ammo: w.mag === Infinity ? Infinity : w.mag,
      reserve: w.reserve === Infinity ? Infinity : w.reserve,
      maxReserve: w.reserve === Infinity ? Infinity : Math.max(w.reserve * 2, w.reserve + 60),
    }));
    this.lastByCategory = {};
    this.equipWeapon(6, { instant: true, silent: true });
    this.dom.intermission.classList.add('hidden');
    this.dom.gameover.classList.add('hidden');
    this.dom.bossBar.classList.add('hidden');
    this.dom.scopeOverlay.classList.add('hidden');
    this.dom.killfeed.innerHTML = '';
    this.killFeedItems = [];
    this.dom.healthText.textContent = '100';
    this.dom.armorText.textContent = '50';
    this.dom.score.textContent = '0';
    this.dom.combo.textContent = '×1';
    this.effects.update(0.016);
    this.startWave(1);
  }

  restartGame() {
    this.audio.init(); this.audio.ui();
    this.phase = 'playing';
    this.dom.gameover.classList.add('hidden');
    this.dom.pause.classList.add('hidden');
    this.dom.armory.classList.add('hidden');
    this.dom.hud.classList.remove('hidden');
    this.dom.touchLayer.classList.toggle('hidden', !this.touch);
    this.weaponRig.visible = true;
    this.resetGame();
    this.requestLock();
  }

  /* ------------------------------------------------------------
     Weapon selection / HUD
     ------------------------------------------------------------ */
  selectCategory(cat) {
    if (cat === 'ESPECIAL' && !this.lastByCategory[cat]) {
      const idx = WEAPONS.findIndex(w => w.id === 'rpg');
      this.lastByCategory[cat] = idx;
    }
    if (cat === 'CORPO' && !this.lastByCategory[cat]) {
      this.lastByCategory[cat] = WEAPONS.findIndex(w => w.id === 'machete');
    }
    if (cat === 'PISTOLA' && !this.lastByCategory[cat]) this.lastByCategory[cat] = 0;
    if (cat === 'SMG' && !this.lastByCategory[cat]) this.lastByCategory[cat] = 3;
    if (cat === 'SHOTGUN' && !this.lastByCategory[cat]) this.lastByCategory[cat] = 9;
    if (cat === 'SNIPER' && !this.lastByCategory[cat]) this.lastByCategory[cat] = 12;
    if (cat === 'LMG' && !this.lastByCategory[cat]) this.lastByCategory[cat] = 14;
    let idx = this.lastByCategory[cat];
    if (this.currentWeapon?.category === cat) {
      const list = WEAPONS.map((w, i) => ({ w, i })).filter(x => x.w.category === cat);
      const pos = list.findIndex(x => x.i === this.currentIndex);
      idx = list[(pos + 1) % list.length].i;
    }
    if (idx == null) idx = WEAPONS.findIndex(w => w.category === cat);
    this.equipWeapon(idx);
  }

  cycleWeapon(dir = 1) {
    if (!this.currentWeapon) return;
    let i = this.currentIndex;
    for (let n = 0; n < WEAPONS.length; n++) {
      i = ((i + dir) % WEAPONS.length + WEAPONS.length) % WEAPONS.length;
      if (i !== this.currentIndex) break;
    }
    this.equipWeapon(i);
  }

  quickSwap() {
    if (this.previousIndex === this.currentIndex) return;
    this.equipWeapon(this.previousIndex);
  }

  isScoped() {
    return !!(this.aiming && this.currentWeapon?.zoom);
  }

  updateWeaponHud() {
    if (!this.inventory || !this.currentWeapon) return;
    const w = this.currentWeapon;
    const st = this.inventory[this.currentIndex];
    this.dom.weaponName.textContent = w.name;
    this.dom.weaponCategory.textContent = CATEGORY_LABELS[w.category] || w.category;
    this.dom.weaponSlot.textContent = `${pad2(this.currentIndex + 1)} / ${WEAPONS.length}`;
    this.dom.ammoMode.textContent = w.melee ? 'CORPO A CORPO' : w.flame ? 'COMBUSTÍVEL' : w.zoom ? 'BOLT ACTION' : w.auto ? 'AUTO' : (w.projectile ? 'PROJÉTIL' : 'SEMI-AUTO');
    this.dom.ammoMag.textContent = st.ammo === Infinity ? '∞' : st.ammo;
    this.dom.ammoReserve.textContent = st.reserve === Infinity ? '∞' : st.reserve;
    this.dom.ammoReadout.classList.toggle('low', st.ammo !== Infinity && st.ammo <= Math.max(1, Math.ceil(w.mag * .2)));
    this.dom.ammoReadout.classList.toggle('highlight', w.melee);
    this.dom.grenadeCount.textContent = this.grenades ?? 0;
    this.dom.weaponQuick.querySelectorAll('.quick-weapon').forEach(b => b.classList.toggle('active', b.dataset.cat === w.category));
    this.dom.reloadProgress.classList.toggle('reloading', false);
    this.dom.crosshair.classList.toggle('reloading', false);
    this.dom.ammoBlock.classList.remove('reloading');
    document.documentElement.style.setProperty('--weapon-color', `#${WEAPON_COLORS[w.category].toString(16).padStart(6, '0')}`);
  }

  buildArmoryCardImages() {
    for (const w of WEAPONS) {
      const src = this.thumbnails[w.id];
      if (!src) continue;
      const card = this.armoryCards[w.index];
      const img = card.querySelector('img');
      if (img && !img.src) { img.src = src; img.style.opacity = '1'; }
    }
  }

  /* ------------------------------------------------------------
     Armory / pause / game over
     ------------------------------------------------------------ */
  openArmory(returnTo) {
    this.armoryReturn = returnTo;
    this.phase = 'armory';
    this.firing = false; this.aiming = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.dom.pause.classList.add('hidden');
    this.dom.armory.classList.remove('hidden');
    this.dom.touchLayer.classList.add('hidden');
    this.buildArmoryCardImages();
    this.selectArmoryWeapon(this.currentIndex, false);
    this.audio.init(); this.audio.ui();
  }

  closeArmory() {
    this.dom.armory.classList.add('hidden');
    this.audio.ui();
    if (this.armoryReturn === 'menu') {
      this.phase = 'menu';
      this.dom.menu.classList.remove('hidden');
    } else if (this.armoryReturn === 'pause') {
      this.phase = 'paused';
      this.dom.pause.classList.remove('hidden');
    } else {
      this.phase = 'playing';
      this.dom.hud.classList.remove('hidden');
      if (this.touch) this.dom.touchLayer.classList.remove('hidden');
      this.requestLock();
    }
  }

  selectArmoryWeapon(index, equip = false) {
    this.armorySelected = index;
    const w = WEAPONS[index];
    this.detailWeapon = w;
    const st = this.inventory?.[index];
    this.dom.detailKicker.textContent = `${CATEGORY_LABELS[w.category]} // ${w.ammoLabel}`;
    this.dom.detailName.textContent = w.name;
    this.dom.detailDesc.textContent = w.desc;
    this.dom.detailImage.src = this.thumbnails[w.id] || '';
    this.dom.detailImage.style.opacity = this.thumbnails[w.id] ? '1' : '0';
    this.dom.detailStats.innerHTML = statBars(w).map((s) => `
      <div class="stat-row"><span>${s.label}</span><div class="stat-track"><i style="width:${Math.round(s.v * 100)}%"></i></div><b>${Math.round(s.v * 100)}</b></div>`).join('');
    this.dom.detailAmmo.textContent = `${st?.ammo === Infinity ? '∞' : (st?.ammo ?? w.mag)} / ${st?.reserve === Infinity ? '∞' : (st?.reserve ?? w.reserve)}  ·  ${w.ammoLabel}`;
    this.armoryCards?.forEach(c => c.classList.toggle('active', Number(c.dataset.index) === index));
    if (equip) this.equipWeapon(index, { silent: false, force: false });
  }

  equipFromArmory() {
    if (this.armorySelected == null) return;
    this.equipWeapon(this.armorySelected, { force: true });
    this.selectArmoryWeapon(this.armorySelected, false);
    const btn = this.dom.equipBtn;
    const label = btn.querySelector('.btn-label');
    const old = label.innerHTML;
    label.innerHTML = 'EQUIPADA ✓';
    this.audio.ui();
    clearTimeout(this._equipLabelTimer);
    this._equipLabelTimer = setTimeout(() => { label.innerHTML = old; }, 1200);
  }

  openPause() {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    this.firing = false; this.aiming = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.dom.pause.classList.remove('hidden');
    this.dom.touchLayer.classList.add('hidden');
    this.dom.pauseWave.textContent = `ONDA ${pad2(this.wave)}`;
    this.dom.pauseWaveNum.textContent = pad2(this.wave);
    this.dom.pauseKills.textContent = this.stats.kills;
    this.dom.pauseScore.textContent = this.stats.score.toLocaleString('pt-BR');
    this.dom.pauseWeapon.textContent = this.currentWeapon.name;
    this.audio.ui();
  }

  resumeGame() {
    if (this.phase !== 'paused') return;
    this.phase = 'playing';
    this.dom.pause.classList.add('hidden');
    this.dom.hud.classList.remove('hidden');
    if (this.touch) this.dom.touchLayer.classList.remove('hidden');
    this.requestLock();
    this.audio.ui();
  }

  toggleMute() {
    this.audio.muted = !this.audio.muted;
    this.audio.init();
    this.audio.setMuted(this.audio.muted);
    this.dom.audioBtn.classList.toggle('muted', this.audio.muted);
    this.dom.menuAudioBtn.classList.toggle('muted', this.audio.muted);
    this.dom.audioBtn.textContent = this.audio.muted ? '◖×' : '◖))';
    this.dom.menuAudioBtn.textContent = this.audio.muted ? '◖×' : '◖))';
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  }

  /* ------------------------------------------------------------
     Waves
     ------------------------------------------------------------ */
  startWave(n) {
    this.wave = n;
    this.spawnedThisWave = 0;
    this.intermissionActive = false;
    this.dom.intermission.classList.add('hidden');
    this.boss = null;
    this.dom.bossBar.classList.add('hidden');
    this.spawnQueue = this.makeWaveQueue(n);
    this.waveTotal = this.spawnQueue.length;
    this.spawnTimer = 0;
    this.waveStats = { kills: 0, shots: 0, hits: 0, start: now() };
    this.dom.waveLabel.textContent = `ONDA ${pad2(n)}`;
    this.dom.waveProgress.style.width = '0%';
    this.dom.threatLabel.textContent = n % 5 === 0 ? 'AMEAÇA CLASSE V' : 'HORDA ATIVA';
    this.showWaveBanner(n, n % 5 === 0 ? 'A ABOMINAÇÃO DESPERTOU' : n === 1 ? 'A HORDA SE APROXIMA' : 'NÃO BAIXE A GUARDA');
    this.audio.waveStart();
    this.audio.alarm();
    const burst = n % 5 === 0 ? 2 : Math.min(5, this.spawnQueue.length);
    for (let i = 0; i < burst; i++) this.spawnNext(true);
    this.updateWaveHud();
  }

  makeWaveQueue(n) {
    const q = [];
    if (n % 5 === 0) {
      q.push('boss');
      const adds = Math.min(26, 7 + n * 1.4);
      for (let i = 0; i < adds; i++) q.push(Math.random() < .45 ? 'runner' : 'walker');
      if (n >= 10) q.push('brute');
      return q;
    }
    const total = Math.min(42, Math.round(6 + n * 2.5));
    for (let i = 0; i < total; i++) {
      const roll = Math.random();
      let type = 'walker';
      if (n >= 5 && roll < .08) type = 'brute';
      else if (n >= 4 && roll < .2) type = 'exploder';
      else if (n >= 3 && roll < .34) type = 'spitter';
      else if (n >= 2 && roll < .62) type = 'runner';
      q.push(type);
    }
    return q;
  }

  spawnNext(initial = false) {
    if (!this.spawnQueue.length) return;
    const type = this.spawnQueue.shift();
    let pos = null;
    if (initial) {
      const presets = [
        [-7, 1], [6, -4], [-16, 8], [14, 12], [0, -14], [20, -2], [-22, -2], [-9, -18],
      ];
      const p = presets[this.spawnedThisWave % presets.length];
      if (!this.world.isBlocked(p[0], p[1], 1.2)) pos = new THREE.Vector3(p[0], 0, p[1]);
    }
    if (!pos) pos = this.world.spawnPoint(this.player.pos, 18);
    const z = this.zombies.spawn(type, pos, this.wave);
    z.spawnedAt = now();
    this.spawnedThisWave++;
    if (type === 'boss') {
      this.boss = z;
      this.dom.bossBar.classList.remove('hidden');
      this.dom.bossHealth.style.width = '100%';
      this.effects.explosion(pos.clone().setY(.6), 3.4, 0xff3c10);
      this.shake = Math.max(this.shake, .35);
      this.audio.alarm();
    } else {
      for (let i = 0; i < 8; i++) {
        this.effects.smoke.emit({
          x: pos.x + Math.random() * .8 - .4, y: rand(0.1, 1.3), z: pos.z + Math.random() * .8 - .4,
          vx: rand(-.4, .4), vy: rand(.1, .8), vz: rand(-.4, .4),
          r: .21, g: .21, b: .19, size: rand(.25, .5), life: rand(.5, 1.2), gravity: -.2, drag: 2, alpha: .22, grow: .8,
        });
      }
      this.effects.sparks.emit({ x: pos.x, y: .2, z: pos.z, vx: 0, vy: .6, vz: 0, r: 1, g: .22, b: .08, size: .6, life: .25, gravity: 0, drag: 3, alpha: .5 });
    }
    this.updateWaveHud();
  }

  showWaveBanner(n, sub) {
    this.dom.wbNumber.textContent = pad2(n);
    this.dom.wbSub.textContent = sub;
    const el = this.dom.waveBanner;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  updateWaveHud() {
    const remaining = this.zombies ? this.zombies.count + this.spawnQueue.length : 0;
    const done = Math.max(0, this.waveTotal - remaining);
    const pct = this.waveTotal ? clamp(done / this.waveTotal * 100, 0, 100) : 0;
    this.dom.waveProgress.style.width = `${pct}%`;
    this.dom.enemiesLeft.textContent = `${remaining} HOSTIS`;
    this.dom.waveTimer.textContent = `T+${fmtTime(now() - (this.waveStats?.start || now()))}`;
  }

  updateWaves(dt) {
    if (this.phase !== 'playing') return;
    if (this.intermissionActive) {
      this.intermissionTimer -= dt;
      const count = Math.max(0, Math.ceil(this.intermissionTimer));
      this.dom.interCountdown.textContent = count;
      if (this.intermissionTimer <= 0) this.startWave(this.wave + 1);
      return;
    }
    if (this.spawnQueue.length) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnNext(false);
        this.spawnTimer = Math.max(.26, .85 - this.wave * .025);
      }
    }
    this.updateWaveHud();
    if (this.waveTotal > 0 && this.spawnQueue.length === 0 && this.zombies.count === 0) this.endWave();
    if (this.boss && !this.boss.dead) {
      const pct = clamp(this.boss.health / this.boss.maxHealth * 100, 0, 100);
      this.dom.bossHealth.style.width = `${pct}%`;
      this.dom.bossHealthText.textContent = `${Math.ceil(pct)}%`;
    } else if (this.boss && this.boss.dead) {
      this.dom.bossBar.classList.add('hidden');
    }
  }

  endWave() {
    if (this.intermissionActive) return;
    this.intermissionActive = true;
    this.intermissionTimer = 7;
    const elapsed = now() - this.waveStats.start;
    const acc = this.waveStats.shots ? Math.round(this.waveStats.hits / this.waveStats.shots * 100) : 0;
    this.dom.interWave.textContent = pad2(this.wave);
    this.dom.interKills.textContent = this.waveStats.kills;
    this.dom.interAcc.textContent = `${acc}%`;
    this.dom.interTime.textContent = fmtTime(elapsed);
    this.dom.interCountdown.textContent = Math.ceil(this.intermissionTimer);
    this.dom.intermission.classList.remove('hidden');
    this.dom.bossBar.classList.add('hidden');
    this.audio.waveClear();
    this.player.health = Math.min(100, this.player.health + 18);
    this.player.armor = Math.min(100, this.player.armor + 12);
    this.grenades = Math.min(5, this.grenades + 1);
    for (const st of this.inventory) {
      const w = WEAPON_BY_ID[st.id];
      if (st.reserve === Infinity) continue;
      const add = Math.max(2, Math.round((w.reserve || 20) * .16));
      st.reserve = Math.min(st.maxReserve, st.reserve + add);
    }
    this.spawnPickup('ammo', this.player.pos.x + 2.5, this.player.pos.z - 1);
    if (Math.random() < .8) this.spawnPickup(Math.random() < .5 ? 'health' : 'armor', this.player.pos.x - 2.8, this.player.pos.z - 2.5);
    this.updateWeaponHud();
    this.updateHud(true);
  }

  // rand is a tiny helper used by several effect calls
  // (global access is in module scope below, but this alias keeps methods tidy)

  /* ------------------------------------------------------------
     Player / camera / damage
     ------------------------------------------------------------ */
  jump() {
    if (this.phase !== 'playing' || !this.player.onGround) return;
    this.player.vel.y = 5.4;
    this.player.onGround = false;
    this.audio.noiseBurst({ duration: .08, freq: 130, q: .6, gain: .04, type: 'lowpass' });
  }

  toggleFlashlight() {
    this.flashlightOn = !this.flashlightOn;
    this.flashlight.intensity = this.flashlightOn ? (this.touch ? 4 : 5) : 0;
    this.dom.flashlightState.textContent = this.flashlightOn ? 'LANTERNA ON' : 'LANTERNA OFF';
    this.dom.flashlightState.classList.add('show');
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => this.dom.flashlightState.classList.remove('show'), 1100);
    this.audio.ui();
  }

  updatePlayer(dt, t) {
    const p = this.player;
    let ix = 0, iz = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) iz -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) iz += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) ix -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) ix += 1;
    ix += this.touchMove.x;
    iz += this.touchMove.y;
    const il = Math.hypot(ix, iz);
    if (il > 1) { ix /= il; iz /= il; }
    const sprinting = (this.keys['ShiftLeft'] || this.keys['ShiftRight']) && il > .1 && !this.aiming && p.onGround;
    this.sprinting = sprinting;
    const speed = (sprinting ? 8.4 : this.aiming ? 3.5 : 5.5) * (p.onGround ? 1 : .72);
    const forwardX = -Math.sin(p.yaw), forwardZ = -Math.cos(p.yaw);
    const rightX = Math.cos(p.yaw), rightZ = -Math.sin(p.yaw);
    const targetX = (forwardX * -iz + rightX * ix) * speed;
    const targetZ = (forwardZ * -iz + rightZ * ix) * speed;
    const accel = p.onGround ? 13 : 4.5;
    p.vel.x += (targetX - p.vel.x) * Math.min(1, accel * dt);
    p.vel.z += (targetZ - p.vel.z) * Math.min(1, accel * dt);
    if (Math.abs(p.vel.x) < .01) p.vel.x = 0;
    if (Math.abs(p.vel.z) < .01) p.vel.z = 0;
    p.vel.y -= 17.5 * dt;
    p.pos.x += p.vel.x * dt;
    p.pos.z += p.vel.z * dt;
    p.pos.y += p.vel.y * dt;
    if (p.pos.y <= 0) { p.pos.y = 0; p.vel.y = 0; p.onGround = true; }
    this.world.resolvePlayer(p.pos, .42);

    const speedNorm = Math.hypot(p.vel.x, p.vel.z) / 8.4;
    if (p.onGround && speedNorm > .08) {
      this.bobPhase += dt * (sprinting ? 13 : 9) * Math.min(1, speedNorm + .35);
      if (!this._stepT || now() > this._stepT) {
        this._stepT = now() + (sprinting ? 300 : 430);
        this.audio.step(sprinting);
      }
    } else {
      this.bobPhase += dt * 1.8;
    }
    const bobAmt = Math.min(1, speedNorm) * (p.onGround ? 1 : 0);
    const bobY = Math.sin(this.bobPhase * 2) * .018 * bobAmt;
    const bobX = Math.cos(this.bobPhase) * .014 * bobAmt;
    this.camera.position.set(p.pos.x + bobX, p.pos.y + p.height + bobY, p.pos.z);
    this.camera.rotation.y = p.yaw;
    this.camera.rotation.x = p.pitch;
    this.camera.rotation.z = Math.sin(this.bobPhase) * .0025 * bobAmt;

    // camera shake
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.2);
      const s = this.shake * this.shake;
      this.camera.rotation.x += (Math.random() - .5) * s * .12;
      this.camera.rotation.y += (Math.random() - .5) * s * .12;
      this.camera.position.x += (Math.random() - .5) * s * .18;
      this.camera.position.y += (Math.random() - .5) * s * .18;
    }

    // fov / aim state
    const targetAds = this.aiming ? 1 : 0;
    this.adsT += (targetAds - this.adsT) * Math.min(1, dt * 12);
    const scoped = this.isScoped();
    const targetFov = scoped ? (this.currentWeapon.zoom ? 32 : 44) : (sprinting ? 78 : this.aiming ? 55 : 72);
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 11);
    this.camera.updateProjectionMatrix();

    // low health vignette / bleed status
    const low = p.health < 35;
    this.dom.vitals.classList.toggle('bleeding', low);
    if (low) {
      this.dom.vitalStatus.textContent = 'CRÍTICO';
    } else {
      this.dom.vitalStatus.textContent = 'ESTÁVEL';
    }
    const dmg = this.hurtTime > 0 ? .54 : 0;
    this.hurtTime = Math.max(0, this.hurtTime - dt);
    const vig = Math.max(low ? .2 + (35 - p.health) / 100 : 0, dmg);
    this.dom.damageVignette.style.opacity = String(clamp(vig, 0, .75));

    // slow regen after 12s untouched, up to 40 hp
    this.regenTimer += dt;
    if (this.regenTimer > 12 && p.health > 0 && p.health < 40) p.health = Math.min(40, p.health + dt * 3.2);
  }

  damagePlayer(amount, source) {
    if (this.phase !== 'playing' || this.player.health <= 0) return;
    this.hurtTime = .34;
    this.shake = Math.max(this.shake, .28 + amount * .004);
    this.regenTimer = 0;
    let remaining = amount;
    if (this.player.armor > 0) {
      const absorbed = Math.min(this.player.armor, amount * .58);
      this.player.armor -= absorbed;
      remaining -= absorbed;
    }
    this.player.health -= remaining;
    this.audio.hurt();
    const flash = this.dom.hitFlash;
    flash.classList.remove('flash');
    void flash.offsetWidth;
    flash.classList.add('flash');
    if (this.player.health <= 0) { this.player.health = 0; this.die(); }
    this.updateHud(true);
  }

  die() {
    this.phase = 'dead';
    this.firing = false; this.aiming = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.dom.touchLayer.classList.add('hidden');
    this.dom.gameover.classList.remove('hidden');
    this.dom.scopeOverlay.classList.add('hidden');
    this.dom.bossBar.classList.add('hidden');
    this.dom.goWave.textContent = pad2(this.wave);
    this.dom.goKills.textContent = this.stats.kills;
    this.dom.goScore.textContent = this.stats.score.toLocaleString('pt-BR');
    const acc = this.stats.shotsFired ? Math.round(this.stats.shotsHit / this.stats.shotsFired * 100) : 0;
    this.dom.goAcc.textContent = `${acc}%`;
    this.dom.goHeads.textContent = this.stats.headshots;
    this.dom.goTime.textContent = fmtTime(now() - this.stats.started);
    this.audio.death();
    this.shake = .8;
  }

  /* ------------------------------------------------------------
     Firing
     ------------------------------------------------------------ */
  beginFire() {
    if (this.phase !== 'playing') return;
    this.firing = true;
    this.tryFire();
  }
  endFire() { this.firing = false; }

  tryFire() {
    if (this.phase !== 'playing' || !this.currentWeapon) return;
    const w = this.currentWeapon;
    const st = this.inventory[this.currentIndex];
    if (this.reloading > 0) return;
    if (!w.melee && now() < (this.nextFire || 0)) return;
    if (!w.melee && st.ammo <= 0) {
      this.audio.empty();
      this.setNotice('SEM MUNIÇÃO // RECARREGUE');
      this.startReload();
      return;
    }
    if (w.spinUp) {
      this.spinTime = (this.spinTime || 0) + .016;
      if (this.spinTime < w.spinUp) return;
    }
    this.nextFire = now() + 60000 / w.rpm;
    if (!w.melee && st.ammo !== Infinity) st.ammo--;
    this.stats.shotsFired += w.pellets || 1;
    this.waveStats.shots += w.pellets || 1;
    this.shake = Math.max(this.shake, Math.min(.22, (w.recoil?.[0] || .01) * 2.2));
    this.rigKick = Math.min(1.4, this.rigKick + (w.recoil?.[0] || .01) * 24 + .22);
    this.rigKickRot = Math.min(.5, (this.rigKickRot || 0) + (w.recoil?.[0] || .01) * 4 + .03);
    this.weaponSway.tx -= (w.recoil?.[1] || .002) * 6;
    this.player.pitch = clamp(this.player.pitch + (w.recoil?.[0] || .01) * .18, -1.35, 1.3);
    if (!w.noFlash) this.showMuzzle(w);
    this.audio.gun(w, this.aiming ? .04 : 0);

    if (w.melee) this.meleeAttack(w);
    else if (w.flame) this.fireFlame(w);
    else if (w.freeze) this.fireFreeze(w);
    else if (w.chain) this.fireTesla(w);
    else if (w.projectile) this.fireProjectile(w);
    else this.fireHitscan(w);

    this.updateWeaponHud();
    this.updateAmmoLive();
    if (!w.melee && st.ammo === 0 && st.reserve > 0) setTimeout(() => this.startReload(), 220);
    if (w.pump) this.pumpTime = .25;
  }

  updateAmmoLive() {
    const st = this.inventory[this.currentIndex];
    if (!st) return;
    this.dom.ammoMag.textContent = st.ammo === Infinity ? '∞' : st.ammo;
    this.dom.ammoReserve.textContent = st.reserve === Infinity ? '∞' : st.reserve;
    this.dom.ammoReadout.classList.toggle('low', st.ammo !== Infinity && st.ammo <= Math.max(1, Math.ceil(this.currentWeapon.mag * .2)));
  }

  showMuzzle(w) {
    const entry = this.weaponEntries.get(this.currentIndex);
    if (!entry) return;
    this.camera.updateMatrixWorld(true);
    this.weaponRig.updateMatrixWorld(true);
    const mz = entry.model.userData.muzzle;
    const pos = mz ? mz.getWorldPosition(new THREE.Vector3()) : this.camera.position.clone().add(this.getAimDir().multiplyScalar(1));
    const dir = this.getAimDir();
    this.effects.muzzle(pos, 0xffa84d, w.category === 'SHOTGUN' ? 1.5 : w.category === 'LMG' ? 1.3 : 1, dir);
    this.muzzleLight.position.copy(pos);
    this.muzzleLight.color.setHex(w.category === 'ESPECIAL' ? 0x99ffaa : 0xffa35a);
    this.muzzleLight.intensity = w.category === 'SHOTGUN' || w.id === 'barrett' ? 46 : 28;
    this.flashTimer = .05;
    if (w.pump) {
      const pump = entry.model.userData.pump;
      if (pump) pump.userData.anim = .18;
    }
  }

  getAimDir(out = new THREE.Vector3()) {
    const cp = Math.cos(this.player.pitch);
    return out.set(-Math.sin(this.player.yaw) * cp, Math.sin(this.player.pitch), -Math.cos(this.player.yaw) * cp).normalize();
  }

  spreadDir(dir, spread) {
    const out = dir.clone();
    if (!spread) return out;
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * spread;
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(dir, up).normalize();
    if (right.lengthSq() < .01) right.set(1, 0, 0);
    const up2 = new THREE.Vector3().crossVectors(right, dir).normalize();
    out.addScaledVector(right, Math.cos(a) * r).addScaledVector(up2, Math.sin(a) * r).normalize();
    return out;
  }

  fireHitscan(w) {
    const origin = this.camera.position.clone();
    const base = this.getAimDir();
    const aimFactor = this.aiming ? .48 : 1;
    const moveFactor = 1 + Math.min(.7, Math.hypot(this.player.vel.x, this.player.vel.z) / 14);
    const spread = w.spread * aimFactor * moveFactor * (this.player.onGround ? 1 : 1.6);
    let hitAny = false, headAny = false;
    const meta = { id: w.id, name: w.name };
    for (let p = 0; p < w.pellets; p++) {
      const dir = this.spreadDir(base, spread);
      const worldHit = this.world.raycast(origin, dir, 150);
      const zHits = this.zombies.rayHits(origin, dir, worldHit ? worldHit.distance + .2 : 150);
      const maxHits = (w.penetration || 0) + 1;
      let used = 0;
      let lastPoint = null;
      for (const h of zHits) {
        if (used >= maxHits) break;
        if (worldHit && h.distance > worldHit.distance) break;
        const dist = h.distance;
        const falloff = w.pellets > 1 ? clamp(1 - dist / 60, .3, 1) : clamp(1 - dist / 160, .68, 1);
        let dmg = w.damage * falloff;
        const head = h.part === 'head';
        if (head) dmg *= w.pellets > 1 ? 1.55 : 2.05;
        const hitPoint = origin.clone().addScaledVector(dir, dist);
        const killed = this.zombies.damage(h.zombie, dmg, h.part, dir, meta);
        this.effects.bloodBurst(hitPoint, dir, head ? 1.4 : .85, head);
        if (head) headAny = true;
        hitAny = true;
        used++;
        lastPoint = hitPoint;
        this.audio.hit(head, 0);
        if (killed) this.waveStats.kills++;
        if (!head && !killed) this.audio.bodyHit();
      }
      this.stats.shotsHit += hitAny ? 1 : 0;
      this.waveStats.hits += hitAny ? 1 : 0;
      const tracerStart = origin.clone().addScaledVector(dir, 1.15);
      let tracerEnd;
      if (lastPoint) tracerEnd = lastPoint;
      else if (worldHit) tracerEnd = worldHit.point;
      else tracerEnd = origin.clone().addScaledVector(dir, 70);
      this.effects.tracer(tracerStart, tracerEnd, w.category === 'SNIPER' ? 0xfff0c0 : 0xffc17c);
      if (worldHit && (!lastPoint || worldHit.distance < lastPoint.distanceTo(origin) + .3)) {
        this.effects.impact(worldHit.point, worldHit.normal, worldHit.surface);
        if (w.category === 'SNIPER') this.effects.sparks.emit({ x: worldHit.point.x, y: worldHit.point.y, z: worldHit.point.z, vx: 0, vy: 0, vz: 0, r: 1, g: .85, b: .6, size: .4, life: .12, gravity: 0, drag: 0, alpha: .5 });
      }
    }
    if (hitAny) {
      this.triggerHitmarker(headAny);
      if (headAny) this.showHeadshotTag();
    }
  }

  fireFlame(w) {
    const origin = this.camera.position.clone().addScaledVector(this.getAimDir(), .45);
    const dir = this.getAimDir();
    const hits = this.zombies.coneDamage(origin, dir, w.range, .27, w.damage, { id: w.id, name: w.name }, z => z.burnApply(2.4, w.burn || 24));
    const mz = this.getMuzzleWorld();
    this.effects.flamethrower(mz, dir);
    if (hits.length) { this.stats.shotsHit++; this.waveStats.hits++; this.triggerHitmarker(false); }
    if (now() - (this._flameAudio || 0) > 140) {
      this._flameAudio = now();
      this.audio.noiseBurst({ duration: .16, freq: 700, q: .7, gain: .045, type: 'lowpass' });
    }
  }

  fireFreeze(w) {
    const origin = this.camera.position.clone().addScaledVector(this.getAimDir(), .45);
    const dir = this.getAimDir();
    const hits = this.zombies.coneDamage(origin, dir, w.range, .2, w.damage, { id: w.id, name: w.name }, z => z.freezeApply(2.6));
    const mz = this.getMuzzleWorld();
    this.effects.frost(mz, dir, w.range);
    if (hits.length) { this.stats.shotsHit++; this.waveStats.hits++; this.triggerHitmarker(false); }
  }

  fireTesla(w) {
    const origin = this.camera.position.clone().addScaledVector(this.getAimDir(), .5);
    const dir = this.getAimDir();
    const result = this.zombies.chain(origin, dir, w.chain, w.chainRange, w.damage, { id: w.id, name: w.name });
    const mz = this.getMuzzleWorld();
    const pts = [mz, ...result.points.slice(1)];
    if (pts.length < 2) pts.push(mz.clone().addScaledVector(dir, 22));
    this.effects.lightning(pts, 0x9beeff);
    this.effects.lightning(pts, 0xffffff);
    if (result.count) { this.stats.shotsHit++; this.waveStats.hits++; this.triggerHitmarker(false); }
    this.shake = Math.max(this.shake, .08);
  }

  fireProjectile(w) {
    const dir = this.getAimDir();
    const origin = this.camera.position.clone().addScaledVector(dir, .85);
    origin.y -= .08;
    const entry = this.weaponEntries.get(this.currentIndex);
    const muzzle = entry?.model.userData.muzzle?.getWorldPosition(new THREE.Vector3());
    const p = this.createProjectile(w.projectile, origin, dir, w, muzzle);
    this.projectiles.push(p);
    this.shake = Math.max(this.shake, .16);
    if (w.projectile === 'rocket') {
      this.audio.noiseBurst({ duration: .6, freq: 420, q: .5, gain: .2, type: 'lowpass' });
    }
  }

  meleeAttack(w) {
    const origin = this.camera.position.clone();
    const dir = this.getAimDir();
    let best = null, bestD = 999;
    for (const z of this.zombies.zombies) {
      if (z.dead) continue;
      const c = z.torsoCenter();
      const to = c.clone().sub(origin);
      const d = to.length();
      if (d > w.range + z.def.radius) continue;
      to.normalize();
      if (to.dot(dir) < .55) continue;
      if (d < bestD) { bestD = d; best = z; }
    }
    const mz = this.getMuzzleWorld();
    const hitPoint = origin.clone().addScaledVector(dir, Math.min(bestD, w.range));
    if (best) {
      const dmg = w.damage;
      const killed = this.zombies.damage(best, dmg, 'body', dir, { id: w.id, name: w.name });
      best.push.addScaledVector(dir, 2.2);
      this.effects.bloodBurst(hitPoint, dir, 1.25, false);
      this.effects.tracer(mz, hitPoint, 0xffeecc);
      this.stats.shotsHit++; this.waveStats.hits++;
      this.triggerHitmarker(false);
      this.audio.bodyHit();
      if (killed) this.waveStats.kills++;
    } else {
      this.audio.noiseBurst({ duration: .18, freq: 1600, q: .6, gain: .05 });
      this.effects.tracer(mz, origin.clone().addScaledVector(dir, w.range * .8), 0xffe0b0);
    }
    this.rigKick = Math.min(1.2, this.rigKick + (w.id === 'chainsaw' ? .1 : .7));
  }

  getMuzzleWorld() {
    const entry = this.weaponEntries.get(this.currentIndex);
    this.camera.updateMatrixWorld(true);
    this.weaponRig.updateMatrixWorld(true);
    const mz = entry?.model.userData.muzzle;
    return mz ? mz.getWorldPosition(new THREE.Vector3()) : this.camera.position.clone().addScaledVector(this.getAimDir(), .8);
  }

  /* ------------------------------------------------------------
     Reload / grenades
     ------------------------------------------------------------ */
  startReload() {
    if (this.phase !== 'playing' || !this.currentWeapon) return;
    const w = this.currentWeapon;
    const st = this.inventory[this.currentIndex];
    if (w.melee || this.reloading > 0) return;
    if (st.ammo === Infinity || st.ammo >= w.mag) return;
    if (st.reserve <= 0) { this.setNotice('SEM MUNIÇÃO RESERVA'); this.audio.empty(); return; }
    this.reloading = w.reloadTime;
    this.reloadTotal = w.reloadTime;
    this.dom.ammoBlock.classList.add('reloading');
    this.dom.crosshair.classList.add('reloading');
    this.audio.reload(w);
    this.firing = false;
  }

  finishReload() {
    const w = this.currentWeapon;
    const st = this.inventory[this.currentIndex];
    if (!w || !st) return;
    const need = w.mag - st.ammo;
    const take = Math.min(need, st.reserve);
    st.ammo += take;
    st.reserve -= take;
    this.reloading = 0;
    this.reloadTotal = 0;
    this.dom.ammoBlock.classList.remove('reloading');
    this.dom.crosshair.classList.remove('reloading');
    this.dom.reloadProgress.style.width = '0%';
    this.updateAmmoLive();
    this.audio.reload(w);
  }

  throwGrenade() {
    if (this.phase !== 'playing') return;
    if (this.grenades <= 0) { this.audio.empty(); this.setNotice('SEM GRANADAS'); return; }
    if (this._nadeCd && now() < this._nadeCd) return;
    this._nadeCd = now() + 700;
    this.grenades--;
    const dir = this.getAimDir();
    const origin = this.camera.position.clone().addScaledVector(dir, .6);
    origin.y += .05;
    const w = {
      id: 'frag', name: 'GRANADA', projectile: 'frag', splash: 170, splashRadius: 4.6,
    };
    const p = this.createProjectile('frag', origin, dir, w, null);
    p.vel.add(new THREE.Vector3(0, 4.4, 0)).addScaledVector(dir, 4.5);
    p.fuse = 2.0;
    p.gravity = 9.8;
    this.projectiles.push(p);
    this.audio.ui();
    this.updateWeaponHud();
    this.setNotice('GRANADA LANÇADA');
  }

  createProjectile(type, origin, dir, w, muzzle) {
    let mesh;
    if (type === 'rocket') {
      mesh = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(.055, .075, .5, 10), new THREE.MeshStandardMaterial({ color: 0x5e6a4c, roughness: .55, metalness: .5 }));
      body.rotation.x = Math.PI / 2; mesh.add(body);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(.075, .18, 10), new THREE.MeshStandardMaterial({ color: 0x9d3522, roughness: .4, metalness: .4 }));
      tip.rotation.x = -Math.PI / 2; tip.position.z = -.33; mesh.add(tip);
      for (const s of [-1, 1]) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(.025, .14, .16), new THREE.MeshStandardMaterial({ color: 0x333a31, metalness: .5, roughness: .5 }));
        fin.position.set(s * .075, 0, .12); mesh.add(fin);
      }
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff7a2a, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.scale.set(.4, .4, 1); glow.position.z = .22; mesh.add(glow);
    } else if (type === 'grenade' || type === 'frag') {
      mesh = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(.13, 10, 8), new THREE.MeshStandardMaterial({ color: 0x43503c, roughness: .55, metalness: .5 }));
      mesh.add(body);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(.045, .055, .07, 8), new THREE.MeshStandardMaterial({ color: 0xa78940, metalness: .7, roughness: .35 }));
      cap.position.y = .14; mesh.add(cap);
      const led = new THREE.Mesh(new THREE.SphereGeometry(.025, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff2f14 }));
      led.position.y = .18; mesh.add(led);
    } else if (type === 'bolt') {
      mesh = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .65, 6), new THREE.MeshStandardMaterial({ color: 0x7f8785, metalness: .8, roughness: .3 }));
      shaft.rotation.x = Math.PI / 2; mesh.add(shaft);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(.025, .11, 6), new THREE.MeshStandardMaterial({ color: 0xb9c2bd, metalness: .85, roughness: .25 }));
      tip.rotation.x = -Math.PI / 2; tip.position.z = -.38; mesh.add(tip);
      for (const s of [-1, 1]) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(.015, .08, .11), new THREE.MeshStandardMaterial({ color: 0xd0cfbf, roughness: .8 }));
        f.position.set(s * .03, 0, .28); f.rotation.z = s * .3; mesh.add(f);
      }
    } else { // plasma
      mesh = new THREE.Group();
      const core = new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), new THREE.MeshBasicMaterial({ color: 0x9dff67 }));
      mesh.add(core);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(['rgba(230,255,190,1)', 'rgba(105,255,80,.7)', 'rgba(40,190,30,0)']), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.scale.set(.8, .8, 1); mesh.add(glow);
    }
    mesh.position.copy(origin);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir.clone().normalize());
    this.scene.add(mesh);
    const speed = type === 'rocket' ? 38 : type === 'bolt' ? 80 : type === 'plasma' ? 48 : type === 'grenade' ? 30 : 13;
    return {
      mesh, type, def: w, life: type === 'bolt' ? 2.5 : 5, fuse: type === 'grenade' ? 1.1 : type === 'frag' ? 2.0 : -1,
      vel: dir.clone().normalize().multiplyScalar(speed),
      gravity: type === 'grenade' || type === 'frag' ? 9.8 : type === 'plasma' ? .8 : type === 'bolt' ? .4 : 0,
      radius: type === 'rocket' || type === 'plasma' ? .25 : .14,
      trailT: 0,
    };
  }

  /* ------------------------------------------------------------
     Projectile updates / explosions
     ------------------------------------------------------------ */
  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.fuse -= dt;
      const prev = p.mesh.position.clone();
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      const step = p.mesh.position.clone().sub(prev);
      const dist = step.length();
      let dead = false;
      let exploded = false;
      if (dist > .0001) {
        const dir = step.clone().normalize();
        const zHits = this.zombies.rayHits(prev, dir, dist + p.radius);
        const worldHit = this.world.raycast(prev, dir, dist + p.radius);
        const zHit = zHits[0];
        if (zHit && (!worldHit || zHit.distance < worldHit.distance)) {
          const point = prev.clone().addScaledVector(dir, zHit.distance);
          if (p.type === 'bolt') {
            const dmg = p.def.damage * (zHit.part === 'head' ? 2 : 1);
            this.zombies.damage(zHit.zombie, dmg, zHit.part, dir, { id: p.def.id, name: p.def.name });
            this.effects.bloodBurst(point, dir, 1);
            this.audio.hit(zHit.part === 'head');
            this.stats.shotsHit++; this.waveStats.hits++;
            dead = true;
          } else if (p.type === 'frag' || p.type === 'grenade') {
            this.explodeAt(p.mesh.position.clone(), p.def.splashRadius, p.def.splash, p.def);
            exploded = true; dead = true;
          } else {
            this.explodeAt(p.mesh.position.clone(), p.def.splashRadius || 3, p.def.splash || p.def.damage, p.def);
            exploded = true; dead = true;
          }
        }
        if (!dead && worldHit) {
          if (p.type === 'frag' || p.type === 'grenade') {
            const n = worldHit.normal;
            p.mesh.position.copy(worldHit.point).addScaledVector(n, .12);
            p.vel.reflect(n).multiplyScalar(.42);
            if (Math.abs(p.vel.y) < .4) p.vel.y = .4;
            this.audio.noiseBurst({ duration: .05, freq: 800, q: 2, gain: .04 });
            this.effects.sparks.emit({ x: p.mesh.position.x, y: p.mesh.position.y, z: p.mesh.position.z, vx: 0, vy: 1, vz: 0, r: 1, g: .6, b: .2, size: .05, life: .2, gravity: 5, drag: 1, alpha: .8 });
          } else if (p.type === 'bolt') {
            this.effects.impact(worldHit.point, worldHit.normal, worldHit.surface);
            dead = true;
          } else {
            this.explodeAt(p.mesh.position.clone(), p.def.splashRadius || 3, p.def.splash || p.def.damage, p.def);
            exploded = true; dead = true;
          }
        }
        if (p.type === 'rocket') {
          p.trailT -= dt;
          if (p.trailT <= 0) {
            p.trailT = .018;
            this.effects.fire.emit({ x: p.mesh.position.x, y: p.mesh.position.y, z: p.mesh.position.z, vx: rand(-.4, .4), vy: rand(-.1, .4), vz: rand(-.4, .4), r: 1, g: .55, b: .12, size: rand(.08, .2), life: rand(.1, .25), gravity: -.3, drag: 2, alpha: .9 });
            this.effects.smoke.emit({ x: p.mesh.position.x, y: p.mesh.position.y, z: p.mesh.position.z, vx: rand(-.2, .2), vy: rand(-.1, .25), vz: rand(-.2, .2), r: .22, g: .22, b: .2, size: .15, life: rand(.35, .8), gravity: -.1, drag: 1, alpha: .18, grow: .6 });
          }
        }
      }
      if ((p.type === 'grenade' || p.type === 'frag') && p.fuse <= 0 && !dead) {
        this.explodeAt(p.mesh.position.clone(), p.def.splashRadius, p.def.splash, p.def);
        exploded = true; dead = true;
      }
      if (p.life <= 0) { if (p.type !== 'bolt') { if (!exploded) this.explodeAt(p.mesh.position.clone(), p.def.splashRadius || 3, p.def.splash || p.def.damage, p.def); } dead = true; }
      if (dead) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  explodeAt(pos, radius, damage, w = {}) {
    this.effects.explosion(pos, radius, w.id === 'plasma' || w.id === 'raygun' ? 0x8bff55 : 0xff6b28);
    this.zombies.radiusDamage(pos, radius, damage, { id: w.id || 'explosive', name: w.name || 'EXPLOSÃO' });
    const d = this.camera.position.distanceTo(pos);
    if (d < radius * 1.2) {
      const dmg = 55 * clamp(1 - d / (radius * 1.2), 0, 1);
      if (dmg > 2) this.damagePlayer(dmg, null);
    }
    this.shake = Math.max(this.shake, clamp(1.1 - d / 18, .16, .9));
    this.audio.explosion();
  }

  /* ------------------------------------------------------------
     Zombie death / drops / pickups
     ------------------------------------------------------------ */
  onZombieKill(z, part, meta) {
    if (!z || z._counted) return;
    z._counted = true;
    const head = part === 'head';
    this.stats.kills++;
    this.waveStats.kills++;
    if (head) this.stats.headshots++;
    const t = now();
    if (t - this.stats.lastKill < 3400) this.stats.combo = Math.min(8, this.stats.combo + 1);
    else this.stats.combo = 1;
    this.stats.lastKill = t;
    const base = z.def.score * (head ? 1.6 : 1);
    const pts = Math.round(base * this.stats.combo);
    this.stats.score += pts;
    this.audio.zombieDeath();
    const c = z.torsoCenter();
    this.effects.bloodBurst(c, new THREE.Vector3(0, 1, 0), head ? 1.6 : 1.1, head);
    if (head) {
      for (let i = 0; i < 3; i++) this.effects.gib(z.headCenter(), new THREE.Vector3(rand(-.5, .5), 1, rand(-.5, .5)), .8);
      if (z.headGroup) z.headGroup.visible = false;
    }
    this.addKillFeed(z, meta, pts, head);
    this.dom.score.textContent = this.stats.score.toLocaleString('pt-BR');
    this.dom.combo.textContent = `×${this.stats.combo}`;
    if (z.def.exploder && meta?.id !== 'exploder') {
      this.effects.explosion(c, 3.6, 0xff611f);
      this.zombies.radiusDamage(c, 4.0, 34, { id: 'exploder', name: 'RUPTOR' });
      const d = this.camera.position.distanceTo(c);
      if (d < 4.6) this.damagePlayer(20 * clamp(1 - d / 5, 0, 1), null);
      this.shake = Math.max(this.shake, .45);
      this.audio.explosion();
    }
    if (z.type === 'boss') {
      this.dom.bossBar.classList.add('hidden');
      this.effects.explosion(c, 7, 0xff3510);
      this.shake = Math.max(this.shake, .9);
      this.setNotice('ABOMINAÇÃO ELIMINADA');
      for (let i = 0; i < 3; i++) this.spawnPickup(['ammo', 'health', 'armor'][i], c.x + rand(-2, 2), c.z + rand(-2, 2));
      this.stats.score += 2500;
    } else {
      const roll = Math.random();
      if (roll < .11) this.spawnPickup('ammo', z.group.position.x, z.group.position.z);
      else if (roll < .17) this.spawnPickup('health', z.group.position.x, z.group.position.z);
      else if (roll < .22) this.spawnPickup('armor', z.group.position.x, z.group.position.z);
    }
    if (this.stats.combo > 1) this.dom.combo.animate?.([{ transform: 'scale(1.35)', color: '#ffb454' }, { transform: 'scale(1)', color: '#ffb454' }], { duration: 260 });
    this.updateHud(true);
  }

  onExplosion(pos, radius, damage, z) {
    this.effects.explosion(pos, 4.2, 0xff5d1e);
    this.shake = Math.max(this.shake, .45);
  }

  addKillFeed(z, meta, pts, head) {
    const item = document.createElement('div');
    item.className = 'kill-item';
    item.innerHTML = `<b>${(meta?.name || 'EXPLOSÃO').toUpperCase()}</b> <span>${head ? 'HEADSHOT' : 'ABATE'}</span> <span class="kill-head">${z.def.label}</span><i>+${pts}</i>`;
    this.dom.killfeed.appendChild(item);
    this.killFeedItems.push(item);
    while (this.killFeedItems.length > 5) {
      const old = this.killFeedItems.shift();
      old.remove();
    }
    setTimeout(() => { item.style.opacity = '0'; item.style.transition = 'opacity .35s'; setTimeout(() => item.remove(), 380); }, 3800);
  }

  triggerHitmarker(head) {
    const hm = this.dom.crosshair.querySelector('.hitmarker');
    hm.classList.remove('show', 'head');
    void hm.offsetWidth;
    hm.classList.add('show');
    if (head) hm.classList.add('head');
  }

  showHeadshotTag() {
    const el = this.dom.headshotTag;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  setNotice(text) {
    const el = this.dom.pickupToast;
    el.textContent = text;
    el.style.color = '';
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  spawnPickup(type, x, z) {
    if (this.world.isBlocked(x, z, .5)) {
      const p = this.world.spawnPoint(this.player.pos, 3);
      x = p.x; z = p.z;
    }
    const g = new THREE.Group();
    g.position.set(x, .3, z);
    let color = 0x9dd46b;
    if (type === 'ammo') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(.6, .32, .42), new THREE.MeshStandardMaterial({ color: 0x46553a, metalness: .3, roughness: .6 }));
      body.position.y = .16; g.add(body);
      const band = new THREE.Mesh(new THREE.BoxGeometry(.62, .06, .44), new THREE.MeshStandardMaterial({ color: 0xc1a24c, metalness: .5, roughness: .4, emissive: 0x6a4e10, emissiveIntensity: .5 }));
      band.position.y = .2; g.add(band);
      for (let i = 0; i < 4; i++) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(.028, .028, .18, 6), new THREE.MeshStandardMaterial({ color: 0xbca459, metalness: .9, roughness: .25 }));
        b.position.set(-.18 + i * .12, .36, 0); g.add(b);
      }
      const icon = new THREE.Mesh(new THREE.PlaneGeometry(.2, .2), new THREE.MeshBasicMaterial({ color: 0xd8c58b }));
      icon.position.set(0, .2, .215); g.add(icon);
      color = 0xa9cf63;
    } else if (type === 'health') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(.55, .34, .4), new THREE.MeshStandardMaterial({ color: 0xd6d4c6, roughness: .55 }));
      body.position.y = .17; g.add(body);
      const red = new THREE.MeshStandardMaterial({ color: 0xb62a1f, emissive: 0x641009, emissiveIntensity: .8 });
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(.28, .09, .03), red); c1.position.set(0, .2, .21); g.add(c1);
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(.09, .28, .03), red); c2.position.set(0, .2, .21); g.add(c2);
      color = 0xdb7b68;
    } else {
      const vest = new THREE.Mesh(new THREE.BoxGeometry(.62, .5, .26), new THREE.MeshStandardMaterial({ color: 0x314e57, metalness: .35, roughness: .55 }));
      vest.position.y = .26; g.add(vest);
      for (const s of [-1, 1]) {
        const pad = new THREE.Mesh(new THREE.BoxGeometry(.2, .12, .3), new THREE.MeshStandardMaterial({ color: 0x4b7983, metalness: .4, roughness: .45 }));
        pad.position.set(s * .31, .44, 0); g.add(pad);
        const strap = new THREE.Mesh(new THREE.BoxGeometry(.05, .45, .27), new THREE.MeshStandardMaterial({ color: 0x22383e }));
        strap.position.set(s * .18, .29, 0); g.add(strap);
      }
      color = 0x77c4d4;
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(['rgba(255,255,255,1)', 'rgba(160,255,130,.28)', 'rgba(80,200,70,0)']), color, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(1.45, 1.45, 1); glow.position.y = .3; g.add(glow);
    this.scene.add(g);
    this.pickups.push({ group: g, type, baseY: .3, phase: Math.random() * 6, life: 45, color: 0xffffff });
    this.setNotice(type === 'ammo' ? 'SUPRIMENTO DE MUNIÇÃO' : type === 'health' ? 'KIT MÉDICO' : 'PLACAS DE ARMADURA');
  }

  updatePickups(dt, t) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.life -= dt;
      p.group.rotation.y += dt * 1.4;
      p.group.position.y = p.baseY + Math.sin(t * 2.2 + p.phase) * .1;
      if (p.type === 'health') p.group.children[0].material.emissiveIntensity = .3 + Math.sin(t * 4) * .2;
      const dx = p.group.position.x - this.player.pos.x;
      const dz = p.group.position.z - this.player.pos.z;
      if (dx * dx + dz * dz < 1.55 * 1.55) {
        this.collectPickup(p);
        this.scene.remove(p.group);
        this.pickups.splice(i, 1);
      } else if (p.life <= 0) {
        this.scene.remove(p.group);
        this.pickups.splice(i, 1);
      }
    }
  }

  collectPickup(p) {
    if (p.type === 'ammo') {
      for (const st of this.inventory) {
        const w = WEAPON_BY_ID[st.id];
        if (st.reserve === Infinity) continue;
        const add = Math.max(3, Math.round((w.reserve || 30) * .28));
        st.reserve = Math.min(st.maxReserve, st.reserve + add);
      }
      this.audio.pickup('ammo');
      this.setNotice('MUNIÇÃO REPOSTA +28%');
    } else if (p.type === 'health') {
      this.player.health = Math.min(100, this.player.health + 35);
      this.audio.pickup('health');
      this.setNotice('INTEGRIDADE RESTAURADA +35');
    } else {
      this.player.armor = Math.min(100, this.player.armor + 40);
      this.audio.pickup('armor');
      this.setNotice('PLACAS REFORÇADAS +40');
    }
    this.updateWeaponHud();
    this.updateHud(true);
  }

  clearPickups() {
    for (const p of this.pickups) this.scene.remove(p.group);
    this.pickups.length = 0;
  }
  clearProjectiles() {
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.projectiles.length = 0;
  }

  /* ------------------------------------------------------------
     HUD / radar
     ------------------------------------------------------------ */
  updateHud(force = false) {
    const t = now();
    if (!force && t - this.lastHudUpdate < 33) return;
    this.lastHudUpdate = t;
    if (!this.player) return;
    const p = this.player;
    this.dom.healthText.textContent = Math.ceil(p.health);
    this.dom.armorText.textContent = Math.ceil(p.armor);
    this.dom.healthBar.style.width = `${clamp(p.health, 0, 100)}%`;
    this.dom.armorBar.style.width = `${clamp(p.armor, 0, 100)}%`;
    this.dom.healthBar.style.background = p.health < 30 ? 'linear-gradient(90deg,#7d0c06,#ff2d16 60%,#ff7b4a)' : '';
    this.dom.score.textContent = this.stats?.score.toLocaleString('pt-BR') || '0';
    this.dom.combo.textContent = `×${this.stats?.combo || 1}`;
    this.dom.grenadeCount.textContent = this.grenades ?? 0;
    const st = this.inventory?.[this.currentIndex];
    if (st) {
      this.dom.ammoMag.textContent = st.ammo === Infinity ? '∞' : st.ammo;
      this.dom.ammoReserve.textContent = st.reserve === Infinity ? '∞' : st.reserve;
      this.dom.ammoReadout.classList.toggle('low', st.ammo !== Infinity && st.ammo <= Math.max(1, Math.ceil(this.currentWeapon.mag * .2)));
    }
    if (this.reloading > 0) {
      const pct = (1 - this.reloading / this.reloadTotal) * 100;
      this.dom.reloadProgress.style.width = `${pct}%`;
    }
    this.dom.crosshair.classList.toggle('hidden-aim', this.isScoped());
  }

  updateCrosshair(dt) {
    if (!this.dom.crosshairEl) return;
    const speed = Math.hypot(this.player?.vel.x || 0, this.player?.vel.z || 0);
    const spread = (this.aiming ? 4 : 9) + speed / 9 + this.rigKick * 7 + (this.player?.onGround ? 0 : 5);
    this.dom.crosshairEl.style.setProperty('--spread', `${Math.round(spread)}px`);
    if (this.dom.scopeOverlay) {
      const scoped = this.isScoped();
      this.dom.scopeOverlay.classList.toggle('hidden', !scoped);
      this.dom.crosshairEl.classList.toggle('hidden-aim', scoped);
    }
  }

  drawRadar() {
    const c = this.dom.radar;
    if (!c) return;
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const range = 46;
    const scale = (w * .42) / range;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, w * .47, 0, 7); ctx.clip();
    // grid
    ctx.strokeStyle = 'rgba(200,220,208,.10)';
    ctx.lineWidth = 1;
    for (let r = 8; r < range; r += 12) { ctx.beginPath(); ctx.arc(cx, cy, r * scale, 0, 7); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();
    // obstacles
    ctx.fillStyle = 'rgba(160,185,172,.13)';
    for (const o of this.world.radarShapes()) {
      const rx = o.x - this.player.pos.x, rz = o.z - this.player.pos.z;
      const px = cx + (rx * Math.cos(this.player.yaw) - rz * Math.sin(this.player.yaw)) * scale;
      const py = cy + (rx * Math.sin(this.player.yaw) + rz * Math.cos(this.player.yaw)) * scale;
      const s = Math.max(2, Math.max(o.hx, o.hz) * scale);
      ctx.fillRect(px - s, py - s, s * 2, s * 2);
    }
    // pickups
    for (const p of this.pickups) {
      const rx = p.group.position.x - this.player.pos.x, rz = p.group.position.z - this.player.pos.z;
      if (Math.hypot(rx, rz) > range) continue;
      const px = cx + (rx * Math.cos(this.player.yaw) - rz * Math.sin(this.player.yaw)) * scale;
      const py = cy + (rx * Math.sin(this.player.yaw) + rz * Math.cos(this.player.yaw)) * scale;
      ctx.fillStyle = p.type === 'health' ? '#e46b58' : p.type === 'armor' ? '#78c8d8' : '#b6d86c';
      ctx.beginPath(); ctx.arc(px, py, 2.4, 0, 7); ctx.fill();
    }
    // zombies
    for (const z of this.zombies.zombies) {
      if (z.dead) continue;
      const rx = z.group.position.x - this.player.pos.x, rz = z.group.position.z - this.player.pos.z;
      if (Math.hypot(rx, rz) > range) continue;
      const px = cx + (rx * Math.cos(this.player.yaw) - rz * Math.sin(this.player.yaw)) * scale;
      const py = cy + (rx * Math.sin(this.player.yaw) + rz * Math.cos(this.player.yaw)) * scale;
      if (z.type === 'boss') {
        ctx.fillStyle = '#ff5a25'; ctx.beginPath(); ctx.arc(px, py, 5, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,90,37,.5)'; ctx.beginPath(); ctx.arc(px, py, 8, 0, 7); ctx.stroke();
      } else {
        ctx.fillStyle = z.type === 'spitter' ? '#9ce23d' : z.type === 'runner' ? '#ff8d53' : '#e1472e';
        ctx.beginPath(); ctx.arc(px, py, z.type === 'brute' ? 3.6 : 2.4, 0, 7); ctx.fill();
      }
    }
    // player cone
    ctx.fillStyle = 'rgba(255,215,160,.10)';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, 24, -Math.PI / 2 - .42, -Math.PI / 2 + .42); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f3e8ce'; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(239,69,47,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, w * .47, -Math.PI / 2 - .42, -Math.PI / 2 + .42); ctx.stroke();
    ctx.restore();
  }

  /* ------------------------------------------------------------
     Main loop
     ------------------------------------------------------------ */
  animate(ts) {
    requestAnimationFrame((t) => this.animate(t));
    const dt = Math.min(.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    this.frameCount++;
    if (this.frameCount % 20 === 0) this.fps = 1 / Math.max(dt, .001);
    this.update(dt, t);
    this.render();
    if (this.firstFrame) {
      this.firstFrame = false;
      this.dom.loader.classList.add('done');
    }
  }

  update(dt, t) {
    if (this.phase === 'menu' || (this.phase === 'armory' && this.armoryReturn === 'menu')) {
      this.menuT += dt;
      const a = this.menuT * .045 + .3;
      const radius = 34 + Math.sin(this.menuT * .08) * 3;
      this.camera.position.set(Math.cos(a) * radius, 7.6 + Math.sin(this.menuT * .17) * 1.2, Math.sin(a) * radius);
      this.camera.lookAt(0, 2.0, 0);
      this.world.update(dt, t);
      this.effects.update(dt);
      return;
    }
    if (this.phase === 'playing') {
      this.updatePlayer(dt, t);
      this.updateWeaponRig(dt, t);
      if (this.reloading > 0) {
        this.reloading -= dt;
        if (this.reloading <= 0) this.finishReload();
      }
      if (this.currentWeapon?.spinUp) {
        if (this.firing) this.spinTime = Math.min(this.currentWeapon.spinUp, (this.spinTime || 0) + dt);
        else this.spinTime = Math.max(0, (this.spinTime || 0) - dt * 2);
      }
      const w = this.currentWeapon;
      if (this.firing && this.phase === 'playing') {
        if (w?.auto || w?.melee) this.tryFire();
        else if (w?.pump && !(this._pumpShot)) this.tryFire();
      }
      this.zombies.update(dt, t, this.player.pos, true, (amount, z) => this.damagePlayer(amount, z));
      this.updateWaves(dt);
      this.updateProjectiles(dt);
      this.updatePickups(dt, t);
      this.world.update(dt, t);
      this.effects.update(dt);
      this.updateHud();
      this.updateCrosshair(dt);
      if (this.frameCount % 5 === 0) this.drawRadar();
      if (this.damageCooldown > 0) this.damageCooldown -= dt;
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.9);
    } else {
      this.world.update(dt, t);
      this.effects.update(dt);
      if (this.phase === 'dead') {
        this.updateWeaponRig(dt, t);
      }
    }
  }

  updateWeaponRig(dt, t) {
    if (!this.weaponRig.visible) return;
    this.adsT += ((this.aiming ? 1 : 0) - this.adsT) * Math.min(1, dt * 13);
    const scoped = this.isScoped();
    this.weaponRig.visible = !scoped;
    if (scoped) return;
    this.weaponRig.visible = true;
    const bob = this.sprinting ? .035 : .012;
    const speed = Math.hypot(this.player.vel.x, this.player.vel.z) / 8;
    const bx = Math.cos(this.bobPhase) * bob * (.35 + speed);
    const by = Math.abs(Math.sin(this.bobPhase)) * bob * (.5 + speed);
    const target = new THREE.Vector3().lerpVectors(this.rigBase, this.aimPos, this.adsT);
    target.x += bx * (1 - this.adsT * .7);
    target.y += by * (1 - this.adsT * .7) - (this.equipT > 0 ? (this.equipT / .38) * .42 : 0);
    target.z += this.rigKick * .07;
    this.weaponSway.x += (this.weaponSway.tx - this.weaponSway.x) * Math.min(1, dt * 9);
    this.weaponSway.y += (this.weaponSway.ty - this.weaponSway.y) * Math.min(1, dt * 9);
    this.weaponSway.tx *= Math.max(0, 1 - dt * 3.5);
    this.weaponSway.ty *= Math.max(0, 1 - dt * 3.5);
    target.x += this.weaponSway.x * (1 - this.adsT);
    target.y += this.weaponSway.y * (1 - this.adsT);
    this.weaponRig.position.lerp(target, Math.min(1, dt * 22));
    const rotTarget = new THREE.Euler(
      this.rigBaseRot.x + this.weaponSway.y * 2 + this.rigKick * .12,
      this.rigBaseRot.y + this.weaponSway.x * 2,
      this.rigBaseRot.z + this.weaponSway.x * 1.3 + (this.sprinting ? -.06 : 0)
    );
    if (this.adsT > .5) {
      rotTarget.x *= (1 - this.adsT * .8);
      rotTarget.y *= (1 - this.adsT * .8);
      rotTarget.z *= (1 - this.adsT * .8);
    }
    this.weaponRig.rotation.x += (rotTarget.x - this.weaponRig.rotation.x) * Math.min(1, dt * 16);
    this.weaponRig.rotation.y += (rotTarget.y - this.weaponRig.rotation.y) * Math.min(1, dt * 16);
    this.weaponRig.rotation.z += (rotTarget.z - this.weaponRig.rotation.z) * Math.min(1, dt * 16);
    this.rigKick = Math.max(0, this.rigKick - dt * 4.5);
    this.rigKickRot = Math.max(0, this.rigKickRot - dt * 3);
    if (this.equipT > 0) this.equipT = Math.max(0, this.equipT - dt);
    // minigun / chainsaw spin
    for (const part of this.weaponEntries.get(this.currentIndex)?.model.userData.spinParts || []) {
      if (this.currentWeapon?.spinUp) part.rotation.z += dt * (this.spinTime / this.currentWeapon.spinUp) * 30;
      else if (this.currentWeapon?.id === 'chainsaw' && this.firing) part.rotation.x += dt * 22;
    }
    // pump action
    const pump = this.weaponEntries.get(this.currentIndex)?.model.userData.pump;
    if (pump) {
      const k = this.pumpTime || 0;
      pump.position.z = -(pump.userData.baseZ ?? (pump.userData.baseZ = pump.position.z)) + Math.sin((1 - k) * Math.PI) * .11;
      this.pumpTime = Math.max(0, k - dt * 3);
    }
    this.muzzleLight.intensity *= Math.max(0, 1 - dt * 24);
    if (this.flashTimer > 0) this.flashTimer -= dt;
  }

  render() {
    this.renderer.info.reset();
    this.composer.render();
  }
}

function rand(a, b) { return a + Math.random() * (b - a); }

window.__ZONA_MORTA__ = new Game();
