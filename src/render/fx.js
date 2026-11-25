// 80s look: neon bloom, a little lens fringing, film grain and a vignette,
// using vanruesc/postprocessing (listed in Fasani/three-js-resources).
import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, VignetteEffect, ChromaticAberrationEffect,
  NoiseEffect, ToneMappingEffect, ToneMappingMode, BlendFunction, KernelSize,
} from 'postprocessing';

const TOUCH = typeof matchMedia === 'function' && matchMedia('(hover: none) and (pointer: coarse)').matches;

export function retroComposer(renderer, scene, camera, { bloom = 1.15, grain = true } = {}) {
  renderer.toneMapping = THREE.NoToneMapping; // done by the ToneMappingEffect instead
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: TOUCH ? 0 : 4 });
  const pass = new RenderPass(scene, camera);
  composer.addPass(pass);
  const bloomFx = new BloomEffect({
    intensity: bloom, luminanceThreshold: 0.55, luminanceSmoothing: 0.25, mipmapBlur: true, radius: 0.72,
    kernelSize: KernelSize.LARGE,
  });
  const effects = [bloomFx];
  if (!TOUCH) effects.push(new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0007, 0.0005), radialModulation: true, modulationOffset: 0.35 }));
  effects.push(new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }));
  effects.push(new VignetteEffect({ offset: 0.32, darkness: 0.62 }));
  if (grain) { const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false }); noise.blendMode.opacity.value = 0.18; effects.push(noise); }
  composer.addPass(new EffectPass(camera, ...effects));
  return {
    composer, bloom: bloomFx,
    setView(nextScene, nextCamera) {
      pass.mainScene = nextScene; pass.mainCamera = nextCamera;
      for (const p of composer.passes) p.mainCamera = nextCamera;
    },
    setSize(w, h) { composer.setSize(w, h, false); },
    render(dt) { composer.render(dt); },
    dispose() { composer.dispose(); },
  };
}
