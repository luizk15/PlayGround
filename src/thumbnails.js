import * as THREE from 'three';
import { WEAPONS, buildWeaponModel } from './weapons.js';

/* Renders each procedural weapon once to a transparent PNG data URL,
   used by the armory and the main-menu hero panel. */
export function generateWeaponThumbnails(onReady) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  } catch { return; }
  renderer.setPixelRatio(1.5);
  renderer.setSize(420, 240, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.32;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(27, 420 / 240, .01, 40);
  camera.position.set(4.9, 1.15, .45);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xc7d7db, 0x2a2018, 2.1));
  const key = new THREE.DirectionalLight(0xffe7c6, 5.2);
  key.position.set(-3, 4, 5); scene.add(key);
  const rim = new THREE.PointLight(0xff5d37, 16, 14, 2);
  rim.position.set(2.8, .6, -3); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xa6c8da, 3.8);
  fill.position.set(5, -1, 3); scene.add(fill);
  const top = new THREE.DirectionalLight(0xdfe9ec, 2.6);
  top.position.set(1, 6, -2); scene.add(top);

  const images = {};
  const group = new THREE.Group();
  scene.add(group);

  let i = 0;
  const renderNext = () => {
    if (i >= WEAPONS.length) {
      scene.remove(group);
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch {}
      onReady?.(images);
      return;
    }
    const w = WEAPONS[i++];
    while (group.children.length) group.remove(group.children[0]);
    group.scale.setScalar(1);
    group.position.set(0, 0, 0);
    group.rotation.set(0, 0, 0);
    group.updateMatrixWorld(true);
    const model = buildWeaponModel(w);
    // catalog lighting pass: lift near-black gunmetal so every silhouette reads
    model.traverse(o => {
      if (!o.isMesh || !o.material) return;
      const src = Array.isArray(o.material) ? o.material : [o.material];
      const mapped = src.map(m => {
        const c = m.clone();
        if (c.color) {
          const hsl = {}; c.color.getHSL(hsl);
          c.color.setHSL(hsl.h, hsl.s * .85, Math.max(.16, Math.min(.33, hsl.l * 1.5)));
        }
        if (c.metalness !== undefined) c.metalness = Math.min(c.metalness, .5);
        if (c.roughness !== undefined) c.roughness = Math.min(.95, c.roughness + .06);
        return c;
      });
      o.material = Array.isArray(o.material) ? mapped : mapped[0];
    });
    group.add(model);
    group.rotation.set(0, .16, 0);
    group.position.set(0, 0, 0);
    group.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(model);
    const size = bbox.getSize(new THREE.Vector3());
    const center = bbox.getCenter(new THREE.Vector3());
    model.position.sub(center);
    const max = Math.max(size.x, size.y, size.z);
    const s = 3.0 / (max || 1);
    group.scale.setScalar(s);
    group.rotation.y = .18;
    group.rotation.z = .02;
    group.updateMatrixWorld(true);
    renderer.render(scene, camera);
    try {
      images[w.id] = renderer.domElement.toDataURL('image/png');
    } catch { images[w.id] = null; }
    onReady?.(images, w.id);
    setTimeout(renderNext, 8);
  };
  setTimeout(renderNext, 120);
}
