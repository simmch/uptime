// Low-poly 3D models from Polyfork (https://polyfork.dev), CC BY 4.0.
// Every atlas key has a model; public/models/manifest.json lists them with their sources.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

const BASE = './models/';
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

export const MODELS = new Map(); // key -> { scene, animations, size, skinned }
let manifest = {};
const pending = new Map();

export async function loadManifest() {
  try { manifest = await fetch(BASE + 'manifest.json').then(r => r.json()); } catch { manifest = {}; }
  return manifest;
}
export const modelKeys = () => Object.keys(manifest);
export const hasModel = key => MODELS.has(key);
export const modelCredits = () => Object.entries(manifest).map(([key, m]) => ({ key, ...m }));

export function loadModel(key) {
  if (MODELS.has(key)) return Promise.resolve(MODELS.get(key));
  if (!manifest[key]) return Promise.resolve(null);
  if (!pending.has(key)) {
    pending.set(key, loader.loadAsync(BASE + key + '.glb').then(gltf => {
      const scene = gltf.scene;
      let skinned = false;
      scene.traverse(o => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.isSkinnedMesh) { skinned = true; o.frustumCulled = false; } }
      });
      const box = new THREE.Box3().setFromObject(scene);
      const entry = { scene, animations: gltf.animations || [], size: box.getSize(new THREE.Vector3()), min: box.min.clone(), center: box.getCenter(new THREE.Vector3()), skinned };
      MODELS.set(key, entry);
      return entry;
    }).catch(err => { console.warn('model failed', key, err); return null; }));
  }
  return pending.get(key);
}

export function loadModels(keys, onProgress) {
  let done = 0;
  return Promise.all([...new Set(keys)].map(k => loadModel(k).then(r => { onProgress?.(++done, keys.length); return r; })));
}

// A fresh copy of a model, sized and grounded.
//   height: scale so the model is this tall          fit: scale so its largest side is this long
//   scale:  explicit scale (models are in real metres)
// Animated models (characters, pets) get userData.play(name) and userData.tick(dt).
export function instance(key, { height, fit, scale, rotY = 0 } = {}) {
  const entry = MODELS.get(key);
  if (!entry) return null;
  const inner = entry.skinned ? cloneSkinned(entry.scene) : entry.scene.clone(true);
  // The student and cafe customer ship with a backpack on the back slot.
  if (key === 'player' || key === 'person_customer') {
    inner.traverse(o => { if (o.name === 'attach-back') o.visible = false; });
  }
  const size = entry.size;
  let s = scale ?? 1;
  if (height) s = height / Math.max(0.01, size.y);
  else if (fit) s = fit / Math.max(0.01, size.x, size.y, size.z);
  inner.scale.setScalar(s);
  // Centre the footprint on the origin and stand it on the ground.
  inner.position.set(-entry.center.x * s, -entry.min.y * s, -entry.center.z * s);
  const outer = new THREE.Group();
  outer.add(inner);
  outer.rotation.y = rotY;
  outer.userData.model = key;
  outer.userData.footprint = { x: size.x * s, y: size.y * s, z: size.z * s };
  if (entry.animations.length) {
    const mixer = new THREE.AnimationMixer(inner);
    const actions = Object.fromEntries(entry.animations.map(clip => [clip.name, mixer.clipAction(clip)]));
    let current = null;
    outer.userData.play = (name, fade = 0.25) => {
      const next = actions[name] || actions.Idle || Object.values(actions)[0];
      if (!next || next === current) return;
      next.reset().fadeIn(fade).play();
      current?.fadeOut(fade);
      current = next;
    };
    outer.userData.tick = dt => mixer.update(dt);
    outer.userData.play('Idle', 0);
    mixer.update(Math.random() * 2); // desynchronise idles
  }
  return outer;
}

// Tint every material of an instance (used to show failed components).
export function tint(obj, color) {
  obj.traverse(o => {
    if (!o.isMesh) return;
    if (!o.userData.baseMaterial) { o.userData.baseMaterial = o.material; o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone(); }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const bases = Array.isArray(o.userData.baseMaterial) ? o.userData.baseMaterial : [o.userData.baseMaterial];
    mats.forEach((m, i) => { m.color?.copy(bases[i].color || new THREE.Color(1, 1, 1)); if (color) m.color?.multiply(new THREE.Color(color)); });
  });
}
