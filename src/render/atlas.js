// Most UI icons are renders of the Polyfork models (public/sprites/icons.webp).
// The menu and the computer (architecture components, codex parts, practice labs)
// keep the pixel atlas (Angais/pixel-art-atlas-1.4m, CC0): those drawings match the parts.
import * as THREE from 'three';

export const ATLAS = { meta: null, img: null, texture: null, url: './sprites/atlas.png' };
export const ICONS = { meta: null, url: './sprites/icons.webp' };
const matCache = new Map();

export async function loadAtlas() {
  const [meta, icons] = await Promise.all([
    fetch('./sprites/atlas.json').then(r => r.json()),
    fetch('./sprites/icons.json').then(r => r.json()).catch(() => null),
  ]);
  ICONS.meta = icons;
  if (icons) { const pre = new Image(); pre.src = ICONS.url; }
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = ATLAS.url; });
  const tex = new THREE.Texture(img);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true;
  Object.assign(ATLAS, { meta, img, texture: tex });
  return ATLAS;
}

export function hasSprite(key) { return !!ATLAS.meta?.frames[key]; }

function frameOf(key) { return ATLAS.meta.frames[key] || ATLAS.meta.frames.box || [0, 0]; }

export function spriteTexture(key) {
  const [cx, cy] = frameOf(key);
  const { cols, rows } = ATLAS.meta;
  const t = ATLAS.texture.clone();
  t.needsUpdate = true;
  t.repeat.set(1 / cols, 1 / rows);
  t.offset.set(cx / cols, 1 - (cy + 1) / rows);
  return t;
}

export function spriteMaterial(key, opts = {}) {
  const k = key + JSON.stringify(opts);
  if (!matCache.has(k)) matCache.set(k, new THREE.SpriteMaterial({ map: spriteTexture(key), transparent: true, alphaTest: 0.3, ...opts }));
  return matCache.get(k);
}

function pixelStyle(key, size) {
  if (!ATLAS.meta?.frames[key]) return '';
  const [cx, cy] = ATLAS.meta.frames[key];
  const { cols, rows, tile } = ATLAS.meta;
  const scale = size / tile;
  return `width:${size}px;height:${size}px;background-image:url(${ATLAS.url});background-size:${cols * tile * scale}px ${rows * tile * scale}px;background-position:-${cx * tile * scale}px -${cy * tile * scale}px;image-rendering:pixelated;display:inline-block;flex:none;`;
}

// For DOM icons: inline style string drawing a sprite at `size` px.
// pixel=true keeps the pixel drawing when the atlas has that key (menu and computer).
export function cssSprite(key, size = 32, pixel = false) {
  if (pixel) {
    const drawn = pixelStyle(key, size);
    if (drawn) return drawn;
  }
  const im = ICONS.meta;
  if (im?.frames[key]) {
    const [cx, cy] = im.frames[key];
    const scale = size / im.tile;
    return `width:${size}px;height:${size}px;background-image:url(${ICONS.url});background-size:${im.cols * size}px ${im.rows * size}px;background-position:-${cx * im.tile * scale}px -${cy * im.tile * scale}px;display:inline-block;flex:none;`;
  }
  if (!ATLAS.meta) return '';
  const [cx, cy] = frameOf(key);
  const { cols, rows, tile } = ATLAS.meta;
  const scale = size / tile;
  return `width:${size}px;height:${size}px;background-image:url(${ATLAS.url});background-size:${cols * tile * scale}px ${rows * tile * scale}px;background-position:-${cx * tile * scale}px -${cy * tile * scale}px;image-rendering:pixelated;display:inline-block;flex:none;`;
}
export const icon = (key, size = 32, cls = '') => `<span class="spr ${cls}" style="${cssSprite(key, size)}"></span>`;
export const pixelIcon = (key, size = 32, cls = '') => `<span class="spr ${cls}" style="${cssSprite(key, size, true)}"></span>`;
