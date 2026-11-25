// Title backdrop: a synthwave street at the edge of town, 1980s. Polyfork models on a neon grid,
// a striped sun going down behind the skyline, then night. At night you sit out front, thinking about work.
import * as THREE from 'three';
import { instance, hasModel } from './models.js';
import { retroComposer } from './fx.js';

const THOUGHT_INTERVAL = 5;
const DAY_END = 8;
const NIGHT_START = 14;
const DAWN_START = 24;
const CYCLE_SECONDS = 30;

const THOUGHTS = [
  'How many nines does Rosa actually need?',
  'Could one server handle the lunch rush?',
  'A backup only counts if I can restore it.',
  'What happens if an entire region goes down?',
  'Why is my p95 so much higher than the average?',
  'Could I make the cloud bill a little smaller?',
];

function randomFrom(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function smoothstep(value, min, max) {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return t * t * (3 - 2 * t);
}

function lightingAt(seconds) {
  const time = seconds % CYCLE_SECONDS;
  const daylight = time < DAWN_START ? 1 - smoothstep(time, DAY_END, NIGHT_START) : smoothstep(time, DAWN_START, CYCLE_SECONDS);
  const twilight = 4 * daylight * (1 - daylight);
  return { time, daylight, twilight };
}



const SKY_TOP = { dusk: new THREE.Color('#2b0f5c'), night: new THREE.Color('#05020f') };
const SKY_MID = { dusk: new THREE.Color('#c2407e'), night: new THREE.Color('#1a0a3a') };
const SKY_LOW = { dusk: new THREE.Color('#ffb46b'), night: new THREE.Color('#4c1466') };

function place(scene, key, x, z, opts = {}) {
  if (!hasModel(key)) return null;
  const obj = instance(key, opts);
  obj.position.set(x, opts.y || 0, z);
  scene.add(obj);
  return obj;
}

function skyDome() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: SKY_TOP.dusk.clone() }, mid: { value: SKY_MID.dusk.clone() }, low: { value: SKY_LOW.dusk.clone() } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying vec3 vP;
      void main(){ float h = clamp(vP.y, -0.2, 1.0);
        vec3 c = h < 0.12 ? mix(low, mid, smoothstep(-0.05, 0.12, h)) : mix(mid, top, smoothstep(0.12, 0.6, h));
        gl_FragColor = vec4(c, 1.0); }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), material);
}

// The classic striped synthwave sun: a gradient disc with bands cut out of its lower half.
function stripedSun() {
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float time; varying vec2 vUv;
      void main(){ vec2 p = vUv - 0.5; float r = length(p);
        if (r > 0.5) discard;
        float y = vUv.y;
        float band = fract((y - time * 0.015) * 11.0);
        float gap = mix(0.0, 0.55, smoothstep(0.58, 0.08, y));
        if (y < 0.58 && band < gap) discard;
        vec3 c = mix(vec3(1.0, 0.12, 0.55), vec3(1.0, 0.78, 0.18), smoothstep(0.08, 0.9, y));
        gl_FragColor = vec4(c * 0.8, 1.0); }`,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
}

// Ground: violet tarmac with a glowing magenta grid running to the horizon.
function neonGrid() {
  const material = new THREE.ShaderMaterial({
    fog: false,
    uniforms: { glow: { value: 1 }, scroll: { value: 0 } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float glow; uniform float scroll; varying vec3 vW;
      void main(){ vec2 g = vec2(vW.x, vW.z + scroll) / 4.0;
        vec2 d = abs(fract(g - 0.5) - 0.5) / fwidth(g);
        float line = 1.0 - min(min(d.x, d.y), 1.0);
        float dist = length(vW.xz) / 220.0;
        vec3 base = mix(vec3(0.07, 0.02, 0.13), vec3(0.22, 0.05, 0.28), smoothstep(0.0, 1.0, dist));
        vec3 c = base + vec3(1.0, 0.18, 0.75) * line * glow * (1.4 - dist);
        gl_FragColor = vec4(c, 1.0); }`,
  });
  material.extensions = { derivatives: true };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), material);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

export function startRooftop(canvas, thought) {
  const stage = canvas.parentElement;
  const touch = matchMedia('(hover: none) and (pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1.25 : 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#3a1250', 60, 190);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 900);
  const fx = retroComposer(renderer, scene, camera, { bloom: 1.35 });

  const dome = skyDome(); scene.add(dome);
  const sunDisc = stripedSun(); sunDisc.scale.setScalar(110); scene.add(sunDisc);
  const grid = neonGrid(); scene.add(grid);

  const hemi = new THREE.HemisphereLight('#ffb0e8', '#2a0f4a', 1.3);
  const sun = new THREE.DirectionalLight('#ffb27a', 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(touch ? 1024 : 2048, touch ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 220 });
  sun.shadow.bias = -0.0005;
  const moon = new THREE.DirectionalLight('#7f9bff', 0);
  moon.position.set(-20, 30, 10);
  scene.add(hemi, sun, sun.target, moon);

  // Street, pavement, lawn and the front path.
  const slab = (x, z, w, d, color, y) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), new THREE.MeshLambertMaterial({ color }));
    m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m;
  };
  slab(0, 1, 46, 16, '#1e3b3a', 0.02);
  slab(0, 8.5, 260, 2.2, '#8d7f99', 0.06);
  slab(0, 12.5, 260, 6, '#221a33', 0.04);
  for (let x = -60; x <= 60; x += 6) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.02, 0.2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd36b').multiplyScalar(1.4) }));
    dash.position.set(x, 0.1, 12.5); scene.add(dash);
  }
  slab(1.2, 5.2, 1.8, 5, '#a3889d', 0.05);

  // The house, the motel strip and the skyline in silhouette.
  place(scene, 'building_house', 0, 0, { height: 8.5 });
  place(scene, 'motel_office', -22, -2, { height: 6, rotY: 0.35 });
  place(scene, 'street_diner', 22, -3, { height: 5.5, rotY: -0.4 });
  place(scene, 'building_apartment', -46, -18, { height: 13, rotY: 0.45 });
  place(scene, 'building_monolith', 70, -20, { height: 22, rotY: -0.3 });
  place(scene, 'skyscraper', -110, -40, { height: 26 });
  place(scene, 'building_slab', -70, -55, { height: 22 });
  for (const [x, z, h, key] of [[-8, 1.5, 7.5, 'tree_palm'], [8.5, -1, 8, 'tree_palm'], [-12.5, 6.4, 7, 'tree_palm'], [13, 6.4, 7.6, 'tree_palm'],
    [-30, 5, 8, 'tree_palm'], [30, 5, 8.4, 'tree_palm'], [-11, -5, 6, 'tree_oak'], [16, -8, 6.5, 'tree_oak']]) {
    place(scene, key, x, z, { height: h, rotY: x });
  }
  const motelSign = place(scene, 'motel_neon', -15.5, 7, { height: 5.5, rotY: 0.4 });
  place(scene, 'neon_pylon', 17, 7.4, { height: 4.2, rotY: -0.3 });
  place(scene, 'payphone', 6.6, 8, { height: 2.1, rotY: Math.PI });

  const lamps = [];
  for (const x of [-14, 0, 14, 28, -28]) {
    const lamp = place(scene, 'street_lamp', x + 4, 9.8, { height: 4.6 });
    if (!lamp) continue;
    const light = new THREE.PointLight('#ff9fe0', 0, 13, 1.5);
    light.position.set(x + 4, 4.2, 9.6);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd0f0').multiplyScalar(2) }));
    glow.position.copy(light.position);
    scene.add(light, glow);
    lamps.push({ light, glow });
  }
  const signLight = new THREE.PointLight('#ff3fd2', 0, 16, 1.4); signLight.position.set(-15.5, 4, 8.5); scene.add(signLight);
  place(scene, 'car_hatch', -4.8, 8.6, { fit: 4, rotY: Math.PI / 2 });
  place(scene, 'park_bench', -2.4, 6.2, { fit: 1.9, rotY: Math.PI });
  place(scene, 'envelope', 3.4, 7.8, { height: 1.3 });
  place(scene, 'home_boombox', -1.6, 6.15, { fit: 0.55, y: 0.48, rotY: Math.PI + 0.3 });
  const you = place(scene, 'player', -2.4, 6.7, { height: 1.75, rotY: 0.3 });
  const skater = place(scene, 'person_roller', -60, 8.6, { height: 1.7, rotY: Math.PI / 2 });
  skater?.userData.play?.('Walk', 0);

  // Traffic and weather.
  const cars = [['car_town', 13.8, 1, 0], ['car_wagon', 11.2, -1, 37], ['car_muscle', 13.8, 1, 81]].map(([key, z, dir, offset]) => {
    const car = place(scene, key, 0, z, { fit: 4.5, rotY: dir > 0 ? Math.PI / 2 : -Math.PI / 2 });
    if (!car) return null;
    const lights = new THREE.PointLight('#ff4f6d', 2, 6, 2); lights.position.set(-2.2 * dir, 0.8, 0); car.add(lights);
    return { car, dir, offset };
  }).filter(Boolean);
  const random = randomFrom(9208);
  const starPos = [];
  for (let i = 0; i < 800; i++) {
    const a = random() * Math.PI * 2, e = 0.1 + random() * 1.2, r = 380;
    starPos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffe9ff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
  scene.add(stars);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const start = performance.now();
  let frame, thoughtIndex = -1, last = 0, w = 0, h = 0;

  function resize() {
    const nw = canvas.clientWidth || innerWidth, nh = canvas.clientHeight || innerHeight;
    if (nw === w && nh === h) return;
    w = nw; h = nh;
    renderer.setSize(w, h, false);
    fx.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 54 : 34; // narrow screens step back so the house still fits
    camera.updateProjectionMatrix();
  }

  function tick(now) {
    frame = requestAnimationFrame(tick);
    if (now - last < 30) return;
    const dt = Math.min(0.1, (now - last) / 1000 || 0.03);
    last = now;
    resize();
    const still = reduced.matches;
    const seconds = still ? NIGHT_START : (now - start) / 1000;
    const { time, daylight, twilight } = lightingAt(seconds);
    const phase = daylight >= .88 ? 'day' : daylight <= .13 ? 'night' : 'twilight';
    if (stage.dataset.phase !== phase) stage.dataset.phase = phase;

    // "Day" here is golden hour; night is deep violet with the grid still burning.
    const u = dome.material.uniforms;
    u.top.value.copy(SKY_TOP.night).lerp(SKY_TOP.dusk, daylight);
    u.mid.value.copy(SKY_MID.night).lerp(SKY_MID.dusk, daylight);
    u.low.value.copy(SKY_LOW.night).lerp(SKY_LOW.dusk, daylight);
    scene.fog.color.copy(u.mid.value).lerp(u.low.value, 0.4);
    // Sit the sun on the horizon straight down the camera's line of sight.
    const view = new THREE.Vector3(-2.5 - camera.position.x, 0, -2 - camera.position.z).normalize();
    sunDisc.position.copy(camera.position).addScaledVector(view, 320).setY(-30 + 72 * daylight);
    sunDisc.lookAt(camera.position.x, sunDisc.position.y, camera.position.z);
    sunDisc.material.uniforms.time.value = seconds;
    sun.position.set(-20, 8 + 30 * daylight, -60);
    sun.intensity = 0.2 + 2.3 * daylight;
    hemi.intensity = 0.55 + 0.9 * daylight;
    moon.intensity = 0.8 * (1 - daylight);
    const night = 1 - smoothstep(daylight, .06, .68);
    stars.material.opacity = night;
    grid.material.uniforms.glow.value = 0.65 + 0.6 * night;
    const lampOn = Math.max(night, 0.35 + 0.65 * twilight);
    for (const { light, glow } of lamps) { light.intensity = 30 * lampOn; glow.visible = lampOn > 0.3; }
    signLight.intensity = 18 * lampOn;

    if (!still) {
      grid.material.uniforms.scroll.value = 0;
      for (const t of cars) t.car.position.x = ((seconds * 11 * t.dir + t.offset) % 150 + 150) % 150 - 75;
      if (skater) { skater.position.x += 2.4 * dt; if (skater.position.x > 60) skater.position.x = -60; }
      you?.userData.tick?.(dt); skater?.userData.tick?.(dt);
    }
    const sway = still ? 0 : Math.sin(seconds * 0.15) * 1.2;
    camera.position.set(17 + sway, 7.5, 26);
    camera.lookAt(-2.5, 6.2, -2);
    fx.render(dt);
    if (you) {
      const head = you.position.clone().add(new THREE.Vector3(0.2, 2.1, 0)).project(camera);
      thought.style.left = `${Math.round((head.x * 0.5 + 0.5) * w)}px`;
      thought.style.bottom = `${Math.round((head.y * 0.5 + 0.5) * h)}px`;
    }

    const rooftop = 1 - smoothstep(daylight, .045, .13);
    const thoughtTime = Math.max(0, time - NIGHT_START);
    const index = (Math.floor(seconds / CYCLE_SECONDS) * 2 + Math.floor(thoughtTime / THOUGHT_INTERVAL)) % THOUGHTS.length;
    if (index !== thoughtIndex) { thought.textContent = THOUGHTS[index]; thoughtIndex = index; }
    const showThought = rooftop > .9 && thoughtTime % THOUGHT_INTERVAL < THOUGHT_INTERVAL - .7;
    thought.classList.toggle('visible', showThought);
    if (thought.getAttribute('aria-hidden') !== String(!showThought)) thought.setAttribute('aria-hidden', String(!showThought));
  }

  frame = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(frame);
    fx.dispose();
    renderer.dispose();
    renderer.forceContextLoss?.();
  };
}
