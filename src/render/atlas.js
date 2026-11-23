// Sprite atlas built from the Angais/pixel-art-atlas-1.4m dataset (CC0).
import * as THREE from 'three';

export const ATLAS = { meta: null, img: null, texture: null, url: './sprites/atlas.png' };
const matCache = new Map();

export async function loadAtlas() {
  const meta = await fetch('./sprites/atlas.json').then(r => r.json());
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

// For DOM icons: inline style string drawing a sprite at `size` px.
export function cssSprite(key, size = 32) {
  if (!ATLAS.meta) return '';
  const [cx, cy] = frameOf(key);
  const { cols, rows, tile } = ATLAS.meta;
  const scale = size / tile;
  return `width:${size}px;height:${size}px;background-image:url(${ATLAS.url});background-size:${cols * tile * scale}px ${rows * tile * scale}px;background-position:-${cx * tile * scale}px -${cy * tile * scale}px;image-rendering:pixelated;display:inline-block;flex:none;`;
}
export const icon = (key, size = 32, cls = '') => `<span class="spr ${cls}" style="${cssSprite(key, size)}"></span>`;
