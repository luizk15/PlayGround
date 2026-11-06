import * as THREE from 'three';

function canvas(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return { c, ctx: c.getContext('2d') };
}
function rand(a, b) { return a + Math.random() * (b - a); }
function tex(c, repeat = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function asphaltTexture() {
  const { c, ctx } = canvas(512);
  ctx.fillStyle = '#25282a'; ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 15000; i++) {
    const g = Math.floor(rand(22, 72));
    ctx.fillStyle = `rgba(${g},${g + 2},${g + 3},${rand(.06, .25)})`;
    ctx.fillRect(rand(0, 512), rand(0, 512), rand(1, 3.2), rand(1, 3.2));
  }
  for (let i = 0; i < 25; i++) {
    ctx.strokeStyle = `rgba(8,10,11,${rand(.06, .22)})`;
    ctx.lineWidth = rand(.4, 1.4);
    ctx.beginPath();
    let x = rand(0, 512), y = rand(0, 512);
    ctx.moveTo(x, y);
    for (let j = 0; j < 8; j++) { x += rand(-18, 18); y += rand(-22, 22); ctx.lineTo(x, y); }
    ctx.stroke();
  }
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(140,138,120,${rand(.02, .1)})`;
    ctx.beginPath(); ctx.arc(rand(0, 512), rand(0, 512), rand(4, 28), 0, 7); ctx.fill();
  }
  return tex(c, 14);
}
export function asphaltBump() {
  const { c, ctx } = canvas(256);
  ctx.fillStyle = '#737373'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6000; i++) {
    const v = Math.floor(rand(50, 190));
    ctx.fillStyle = `rgba(${v},${v},${v},${rand(.05, .3)})`;
    ctx.fillRect(rand(0, 256), rand(0, 256), rand(1, 2.5), rand(1, 2.5));
  }
  return tex(c, 14, false);
}
export function concreteTexture(base = '#777264') {
  const { c, ctx } = canvas(256);
  ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4500; i++) {
    const v = Math.floor(rand(65, 170));
    ctx.fillStyle = `rgba(${v},${v - 3},${v - 8},${rand(.04, .18)})`;
    ctx.fillRect(rand(0, 256), rand(0, 256), rand(1, 4), rand(1, 4));
  }
  for (let i = 0; i < 9; i++) {
    ctx.strokeStyle = `rgba(30,28,25,${rand(.08, .22)})`; ctx.lineWidth = rand(.4, 1.2);
    ctx.beginPath(); let x = rand(0, 256), y = rand(0, 256); ctx.moveTo(x, y);
    for (let j = 0; j < 5; j++) { x += rand(-14, 14); y += rand(-20, 20); ctx.lineTo(x, y); }
    ctx.stroke();
  }
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = `rgba(49,43,35,${rand(.035, .12)})`;
    ctx.beginPath(); ctx.ellipse(rand(0, 256), rand(0, 256), rand(8, 44), rand(3, 15), rand(0, 3), 0, 7); ctx.fill();
  }
  return tex(c, 2);
}
export function metalTexture(base = '#4c5152') {
  const { c, ctx } = canvas(256);
  ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    const v = Math.floor(rand(40, 120));
    ctx.fillStyle = `rgba(${v},${v},${v},${rand(.025, .12)})`;
    ctx.fillRect(rand(0, 256), rand(0, 256), rand(1, 12), rand(.5, 2.5));
  }
  for (let i = 0; i < 14; i++) {
    const x = rand(0, 256), y = rand(0, 256), w = rand(4, 28), h = rand(6, 42);
    const grd = ctx.createLinearGradient(x, y, x, y + h);
    grd.addColorStop(0, 'rgba(116,65,34,.35)');
    grd.addColorStop(1, 'rgba(70,39,22,0)');
    ctx.fillStyle = grd; ctx.fillRect(x, y, w, h);
  }
  return tex(c, 3);
}
export function rustTexture() {
  const { c, ctx } = canvas(256);
  ctx.fillStyle = '#5b3a25'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3000; i++) {
    const r = Math.floor(rand(70, 140)), g = Math.floor(rand(35, 80)), b = Math.floor(rand(18, 48));
    ctx.fillStyle = `rgba(${r},${g},${b},${rand(.08, .4)})`;
    ctx.fillRect(rand(0, 256), rand(0, 256), rand(1, 5), rand(1, 5));
  }
  return tex(c, 2);
}
export function chainlinkTexture() {
  const { c, ctx } = canvas(128);
  ctx.clearRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(185,190,181,.9)';
  ctx.lineWidth = 2.2;
  for (let i = -128; i < 256; i += 32) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 128, 128); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i + 128, 0); ctx.lineTo(i, 128); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(12, 3);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function glowTexture(colors = ['rgba(255,255,255,1)', 'rgba(255,180,80,.35)', 'rgba(255,80,20,0)']) {
  const { c, ctx } = canvas(128);
  const grd = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, colors[0]);
  grd.addColorStop(.3, colors[1]);
  grd.addColorStop(1, colors[2]);
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function smokeTexture() {
  const { c, ctx } = canvas(128);
  for (let i = 0; i < 24; i++) {
    const x = rand(32, 96), y = rand(32, 96), r = rand(10, 34);
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(255,255,255,${rand(.02, .08)})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function bloodTexture() {
  const { c, ctx } = canvas(128);
  ctx.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 36; i++) {
    const x = rand(38, 90), y = rand(38, 90), r = rand(1, 18);
    ctx.fillStyle = `rgba(${rand(50, 100)},${rand(3, 13)},${rand(2, 9)},${rand(.12, .55)})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    if (Math.random() < .32) {
      ctx.beginPath(); ctx.arc(x + rand(-45, 45), y + rand(-45, 45), rand(.5, 3), 0, 7); ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function bulletHoleTexture() {
  const { c, ctx } = canvas(64);
  const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  grd.addColorStop(0, 'rgba(4,4,4,.96)');
  grd.addColorStop(.24, 'rgba(13,13,13,.9)');
  grd.addColorStop(.38, 'rgba(48,44,38,.55)');
  grd.addColorStop(1, 'rgba(30,28,25,0)');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 12; i++) {
    ctx.strokeStyle = `rgba(6,6,6,${rand(.15, .5)})`; ctx.lineWidth = rand(.4, 1.5);
    const a = rand(0, 7), r = rand(6, 22);
    ctx.beginPath(); ctx.moveTo(32 + Math.cos(a) * 5, 32 + Math.sin(a) * 5); ctx.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); ctx.stroke();
  }
  return new THREE.CanvasTexture(c);
}
export function moonTexture() {
  const { c, ctx } = canvas(256);
  const grd = ctx.createRadialGradient(128, 128, 18, 128, 128, 126);
  grd.addColorStop(0, 'rgba(245,239,213,1)');
  grd.addColorStop(.32, 'rgba(225,219,193,.95)');
  grd.addColorStop(.4, 'rgba(194,191,169,.2)');
  grd.addColorStop(1, 'rgba(170,180,170,0)');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 256, 256);
  ctx.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 28; i++) {
    ctx.fillStyle = `rgba(130,128,112,${rand(.04, .18)})`;
    ctx.beginPath(); ctx.arc(rand(66, 190), rand(66, 190), rand(2, 15), 0, 7); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function warningTexture(text = 'QUARENTENA', sub = 'SETOR 09 // ACESSO NEGADO') {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 1024, 512);
  ctx.save();
  ctx.translate(512, 256);
  ctx.rotate(-0.045);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(225,216,190,.24)';
  ctx.font = 'bold 150px "Barlow Condensed", Arial Narrow, sans-serif';
  ctx.fillText(text, 0, -10);
  ctx.font = 'bold 34px "Rajdhani", Arial, sans-serif';
  ctx.fillStyle = 'rgba(239,69,47,.45)';
  ctx.fillText(sub, 0, 60);
  ctx.strokeStyle = 'rgba(239,69,47,.38)'; ctx.lineWidth = 8;
  ctx.strokeRect(-430, -130, 860, 240);
  ctx.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
export function containerTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3d4b45'; ctx.fillRect(0, 0, 512, 256);
  for (let x = 0; x < 512; x += 24) {
    ctx.fillStyle = x % 48 ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.045)';
    ctx.fillRect(x, 0, 12, 256);
  }
  for (let y = 0; y < 256; y += 64) { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(0, y, 512, 4); }
  for (let i = 0; i < 180; i++) {
    ctx.fillStyle = `rgba(${rand(60, 105)},${rand(40, 60)},${rand(25, 42)},${rand(.05, .22)})`;
    ctx.fillRect(rand(0, 512), rand(0, 256), rand(2, 22), rand(2, 8));
  }
  ctx.font = 'bold 24px "Rajdhani", Arial, sans-serif';
  ctx.fillStyle = 'rgba(210,205,185,.45)';
  ctx.fillText('MILITARY CARGO // 09', 32, 44);
  ctx.font = 'bold 13px "Rajdhani", Arial, sans-serif';
  ctx.fillStyle = 'rgba(210,205,185,.25)';
  ctx.fillText('PROPERTY OF CONTAINMENT DIVISION', 32, 228);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function barricadeTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#b8af97'; ctx.fillRect(0, 0, 512, 128);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, 512, 128); ctx.clip();
  for (let i = -140; i < 700; i += 90) {
    ctx.fillStyle = '#b33c2a'; ctx.beginPath();
    ctx.moveTo(i, 0); ctx.lineTo(i + 42, 0); ctx.lineTo(i + 42 + 128, 128); ctx.lineTo(i + 128, 128); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = `rgba(38,36,31,${rand(.02, .18)})`;
    ctx.fillRect(rand(0, 512), rand(0, 128), rand(1, 8), rand(1, 4));
  }
  return tex(c, 1);
}
export function skyTexture() {
  const c = document.createElement('canvas'); c.width = 16; c.height = 256;
  const ctx = c.getContext('2d');
  const grd = ctx.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#020508');
  grd.addColorStop(.42, '#071115');
  grd.addColorStop(.68, '#101b1c');
  grd.addColorStop(.84, '#1d2521');
  grd.addColorStop(1, '#352a20');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 16, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function skylineTexture() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 2048, 256);
  let x = 0;
  while (x < 2048) {
    const w = rand(30, 120), h = rand(40, 200);
    ctx.fillStyle = `rgba(${rand(5, 12)},${rand(9, 17)},${rand(11, 20)},.96)`;
    ctx.fillRect(x, 256 - h, w, h);
    if (Math.random() < .28) {
      ctx.fillStyle = 'rgba(255,145,58,.55)';
      for (let i = 0; i < 4; i++) ctx.fillRect(x + rand(4, w - 6), 256 - h + rand(8, h - 12), 2, 2);
    }
    x += w + rand(-4, 8);
  }
  ctx.fillStyle = 'rgba(3,7,8,.7)'; ctx.fillRect(0, 225, 2048, 31);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.repeat.x = 3;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function fogSheetTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 512, 256);
  for (let i = 0; i < 55; i++) {
    const x = rand(0, 512), y = rand(90, 240), r = rand(30, 110);
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(118,138,130,${rand(.02, .07)})`);
    grd.addColorStop(1, 'rgba(118,138,130,0)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, 512, 256);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.repeat.x = 2;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function acidTexture() {
  const { c, ctx } = canvas(64);
  const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(212,255,126,1)');
  grd.addColorStop(.4, 'rgba(126,214,66,.7)');
  grd.addColorStop(1, 'rgba(91,179,43,0)');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
