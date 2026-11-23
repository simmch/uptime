import * as THREE from 'three';

const ROAD_TIME = 36;
const PARK_TIME = 44;
const TURN_START = 329;
const MARKET_TURN = 240;
const MARKET_Z = -230;
const DRIVEWAY_Z = -338;
const GARAGE_X = 17;
const CRUISE_MPH = 35;

function roadCenter(distance) {
  const fade = 1 - THREE.MathUtils.smoothstep(distance, 255, 315);
  return fade * (4.8 * Math.sin(distance / 37) - 2.7 * Math.sin(distance / 18));
}

function randomSequence(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function sky(scene) {
  const colors = {
    high: { value: new THREE.Color('#1d294c') },
    middle: { value: new THREE.Color('#68536d') },
    horizon: { value: new THREE.Color('#f0a477') },
    sun: { value: new THREE.Vector3(-0.24, 0.105, -1).normalize() },
  };
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
    uniforms: colors,
    vertexShader: `
      varying vec3 direction;
      void main() {
        direction = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 high;
      uniform vec3 middle;
      uniform vec3 horizon;
      uniform vec3 sun;
      varying vec3 direction;
      void main() {
        vec3 ray = normalize(direction);
        float height = max(ray.y, 0.0);
        float band = floor(height * 120.0) / 120.0;
        vec3 color = mix(horizon, middle, smoothstep(0.01, 0.28, band));
        color = mix(color, high, smoothstep(0.18, 0.57, band));
        float distance = length(ray - sun);
        color += vec3(0.27, 0.10, 0.035) * (1.0 - smoothstep(0.02, 0.30, distance));
        color = mix(color, vec3(1.0, 0.72, 0.42), 1.0 - smoothstep(0.039, 0.042, distance));
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  }));
  mesh.scale.setScalar(280);
  mesh.renderOrder = -1;
  scene.add(mesh);
  return mesh;
}

function sceneryBatches(scene) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const batches = new Map();
  const transform = new THREE.Object3D();
  return {
    box(x, y, z, w, h, d, color, yaw = 0, tilt = 0, lit = true) {
      const key = `${color}/${lit}`;
      if (!batches.has(key)) batches.set(key, { color, lit, matrices: [] });
      transform.position.set(x, y, z);
      transform.rotation.set(0, yaw, tilt, 'YXZ');
      transform.scale.set(w, h, d);
      transform.updateMatrix();
      batches.get(key).matrices.push(transform.matrix.clone());
    },
    addToScene() {
      for (const { color, lit, matrices } of batches.values()) {
        const material = lit ? new THREE.MeshLambertMaterial({ color }) : new THREE.MeshBasicMaterial({ color });
        const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
        matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
        scene.add(mesh);
      }
    },
  };
}

function roadStrip(scene, stretches, left, right, height, color) {
  const positions = [], indices = [];
  for (const [start, end] of stretches) {
    const first = positions.length / 3;
    const sections = Math.ceil((end - start) / 2);
    for (let i = 0; i <= sections; i++) {
      const distance = THREE.MathUtils.lerp(start, end, i / sections);
      const center = roadCenter(distance);
      positions.push(center + left, height, -distance, center + right, height, -distance);
      if (i === sections) continue;
      const a = first + i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  scene.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color })));
}

function road(scene, box, random, trip) {
  const full = [[-42, 450]];
  const west = trip ? [[-42, 226], [234.4, 450]] : full;
  roadStrip(scene, full, -4.1, 4.1, 0.01, '#393844');
  roadStrip(scene, west, -4.85, -4.1, 0.045, '#77717c');
  roadStrip(scene, [[-42, 334.7], [341.2, 450]], 4.1, 4.85, 0.045, '#77717c');
  roadStrip(scene, west, -3.91, -3.84, 0.018, '#a79a94');
  roadStrip(scene, [[-42, 334.7], [341.2, 450]], 3.84, 3.91, 0.018, '#a79a94');
  const marks = [];
  for (let s = -34; s < 445; s += 8.5) marks.push([s, s + 3.2]);
  roadStrip(scene, marks, -0.055, 0.055, 0.02, '#dba565');

  for (let s = 3; s < 365; s += 0.85) {
    const offset = (random() - 0.5) * 7.3;
    box(roadCenter(s) + offset, 0.012, -s, 0.06 + random() * 0.37, 0.004, 0.13 + random() * 0.5,
      random() > 0.62 ? '#4b4652' : '#322f3b', 0, 0, false);
  }
  box(10.75, 0.015, DRIVEWAY_Z, 14.5, 0.04, 5.8, '#777079', 0, 0, false);
  for (const x of [7.6, 11.6, 15.5]) box(x, 0.037, DRIVEWAY_Z, 0.035, 0.006, 5.8, '#5e5964', 0, 0, false);
}

function lamp(box, x, z, side) {
  box(x, 2.5, z, 0.095, 5, 0.095, '#383744');
  box(x - side * 0.54, 4.95, z, 1.15, 0.085, 0.085, '#383744');
  box(x - side * 1.08, 4.89, z, 0.46, 0.14, 0.26, '#554f53');
  box(x - side * 1.08, 4.80, z, 0.38, 0.06, 0.21, '#ffd08b', 0, 0, false);
}

function tree(box, x, z, scale, shade) {
  box(x, scale * 0.92, z, scale * 0.18, scale * 1.84, scale * 0.19, '#4e363b');
  box(x, scale * 2.30, z, scale * 1.45, scale * 1.32, scale * 1.53, shade, 0.38);
  box(x + scale * 0.48, scale * 1.96, z + scale * 0.1, scale * 0.92, scale, scale * 1.08, shade, 0.65);
  box(x - scale * 0.52, scale * 2.02, z - 0.12, scale * 0.9, scale * 0.87, scale * 1.04, shade, -0.40);
  box(x + scale * 0.06, scale * 2.99, z - scale * 0.09, scale * 0.81, scale * 0.42, scale * 0.87, shade, 0.16);
}

function offices(scene, box, random) {
  const buildings = [
    [15, 20, 13, 6.6, 16, '#635a70'], [-15, 40, 13, 9, 17, '#514e69'],
    [15, 59, 9, 8.2, 13, '#66566b'], [18, 83, 18, 11, 14, '#594d62'],
    [-16, 73, 12, 5.8, 16, '#625266'], [-14, 109, 11, 8.1, 13, '#615b70'],
    [16, 120, 12, 4.5, 11, '#776476'],
  ];
  for (const [x, s, width, height, depth, color] of buildings) {
    const z = -s;
    box(x, height / 2, z, width, height, depth, color);
    box(x, height + 0.12, z, width + 0.48, 0.24, depth + 0.48, '#46414f');
    box(x + 1, height + 0.66, z - 1.5, 3.6, 1.08, 3.1, '#4d4658');
    for (let y = 1.45; y < height - 0.7; y += 1.65) {
      for (let offset = -width / 2 + 1.1; offset < width / 2 - 0.6; offset += 1.55) {
        box(x + offset, y, z + depth / 2, 0.9, 0.76, 0.04,
          random() > 0.64 ? '#ffc987' : '#33394e', 0, 0, false);
      }
      for (let offset = -depth / 2 + 1.1; offset < depth / 2 - 0.6; offset += 1.55) {
        box(x - Math.sign(x) * width / 2, y, z + offset, 0.04, 0.76, 0.9,
          random() > 0.66 ? '#eeae73' : '#363a52', 0, 0, false);
      }
    }
  }

  for (let i = 0; i < 31; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (29 + random() * 56);
    const z = -35 - random() * 230;
    const height = 6 + random() * 24;
    box(x, height / 2, z, 4 + random() * 9, height, 5 + random() * 12,
      i % 3 === 0 ? '#51475e' : '#5a4d65', 0, 0, false);
  }

  const sign = document.createElement('canvas');
  sign.width = 128;
  sign.height = 48;
  const ctx = sign.getContext('2d');
  ctx.fillStyle = '#364051';
  ctx.fillRect(0, 0, 128, 48);
  ctx.fillStyle = '#d6b99c';
  ctx.fillRect(0, 0, 128, 2);
  ctx.fillStyle = '#ffe4be';
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('CUSTOMER CARE', 64, 22);
  ctx.font = '11px monospace';
  ctx.fillText('CALL CENTER', 64, 38);
  const texture = new THREE.CanvasTexture(sign);
  texture.magFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 1.4625), new THREE.MeshBasicMaterial({ map: texture }));
  board.position.set(6.45, 1.95, -19);
  scene.add(board);
  box(6.45, 1.92, -19.12, 3.94, 1.5, 0.18, '#393746');
  for (const x of [5.1, 7.8]) box(x, 0.61, -19.11, 0.13, 1.25, 0.17, '#5b4a4b');
}

function house(box, x, z, yaw, wall) {
  const local = (dx, y, dz, w, h, d, color, tilt = 0, lit = true) =>
    box(x + dx * Math.cos(yaw) + dz * Math.sin(yaw), y, z - dx * Math.sin(yaw) + dz * Math.cos(yaw),
      w, h, d, color, yaw, tilt, lit);
  local(0, 1.25, 0, 7.2, 2.5, 5.6, wall);
  local(0, 2.56, 0, 5.6, 0.22, 5.55, wall);
  local(0, 2.76, 0, 3.8, 0.2, 5.55, wall);
  local(0, 2.9, 0, 2, 0.2, 5.55, wall);
  local(-1.86, 2.74, 0, 4.1, 0.16, 6.05, '#454055', 0.22);
  local(1.86, 2.74, 0, 4.1, 0.16, 6.05, '#454055', -0.22);
  local(-2.15, 1.5, 2.82, 1.48, 1, 0.08, '#ffc891', 0, false);
  local(-2.15, 1.5, 2.88, 0.07, 1, 0.07, '#6d5c63');
  local(1.92, 1.46, 2.82, 1.25, 0.88, 0.08, '#ffb677', 0, false);
  local(1.92, 1.46, 2.88, 0.07, 0.88, 0.07, '#6d5c63');
  local(-0.16, 0.92, 2.85, 0.88, 1.84, 0.13, '#443d51');
  local(-0.16, 0.15, 3.17, 1.6, 0.3, 0.85, '#6e6269');
  local(2.08, 3.02, -0.21, 0.58, 1.08, 0.62, '#735d66');
}

function neighborhood(box, random, trip) {
  const walls = ['#96766e', '#87798b', '#9b8275', '#72827c'];
  box(-15, 0.002, -252, 20, 0.012, 218, '#50544e', 0, 0, false);
  box(15, 0.002, -252, 20, 0.012, 218, '#50544e', 0, 0, false);
  for (let s = 158; s < 365; s += 17) {
    for (const side of [-1, 1]) {
      if (side === 1 && s >= 312) continue;
      if (trip && side === -1 && s > 210 && s < 254) continue;
      const distance = s + (side === 1 ? 4.7 : 0);
      const x = roadCenter(distance) + side * (12.3 + random() * 4.2);
      house(box, x, -distance, -side * (Math.PI / 2 - 0.24), walls[Math.floor(random() * walls.length)]);
      box(x - side * 4.9, 0.02, -distance, 4.5, 0.045, 0.91, '#736968', 0, 0, false);
    }
  }
  for (let s = 135; s < 381; s += 7.5) {
    const side = random() > 0.51 ? -1 : 1;
    if (side === 1 && s > 321 && s < 353) continue;
    if (trip && side === -1 && s > 215 && s < 245) continue;
    const distance = s + random() * 4;
    tree(box, roadCenter(distance) + side * (6.6 + random() * 2.1), -distance,
      0.85 + random() * 0.64, random() > 0.48 ? '#3f504b' : '#505547');
  }
}

function market(scene, box) {
  box(-12.25, 0.016, MARKET_Z, 17.5, 0.039, 16.3, '#6e6571', 0, 0, false);
  for (const offset of [-6.9, -4.9, 4.9, 6.9]) box(-16.3, 0.038, MARKET_Z + offset, 4.9, 0.008, 0.06, '#d6bdac', 0, 0, false);
  box(-23.2, 1.75, MARKET_Z, 7.0, 3.5, 15.3, '#9b786c');
  box(-23.1, 3.56, MARKET_Z, 7.3, 0.22, 15.8, '#474655');
  box(-19.56, 2.87, MARKET_Z, 0.24, 0.58, 15.6, '#445d5f');
  box(-19.07, 2.69, MARKET_Z, 1.24, 0.12, 15.6, '#797781');
  for (const z of [-5.5, -3.5, 3.5, 5.5]) {
    box(-19.66, 1.44, MARKET_Z + z, 0.14, 1.7, 1.55, '#454b5d');
    box(-19.57, 1.45, MARKET_Z + z, 0.08, 1.36, 1.32, '#edbb81', 0, 0, false);
  }
  box(-19.58, 1.13, MARKET_Z, 0.12, 2.24, 2.82, '#424351');
  for (const z of [-0.67, 0.67]) box(-19.48, 1.17, MARKET_Z + z, 0.046, 1.91, 1.22, '#839ca0', 0, 0, false);

  const sign = document.createElement('canvas');
  sign.width = 192;
  sign.height = 32;
  const ctx = sign.getContext('2d');
  ctx.fillStyle = '#415b5e';
  ctx.fillRect(0, 0, 192, 32);
  ctx.fillStyle = '#ffe8bd';
  ctx.font = 'bold 17px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CORNER MARKET', 96, 22);
  const texture = new THREE.CanvasTexture(sign);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(6.7, 1.11), new THREE.MeshBasicMaterial({ map: texture }));
  board.rotation.y = Math.PI / 2;
  board.position.set(-19.37, 3.28, MARKET_Z);
  scene.add(board);
}

function garage(box) {
  house(box, 19.8, DRIVEWAY_Z - 5.7, -Math.PI / 2, '#98817b');
  tree(box, 22.2, DRIVEWAY_Z - 12.8, 1.33, '#43524c');
  tree(box, 29.8, DRIVEWAY_Z - 5.2, 1.62, '#4d534b');
  tree(box, 31.4, DRIVEWAY_Z + 7.4, 1.40, '#434d49');
  box(15.2, 0.33, DRIVEWAY_Z - 7.6, 1.15, 0.66, 2.4, '#596054', 0.13);
  const front = GARAGE_X;
  const center = front + 4.1;
  const wall = '#796772';
  box(center, 1.49, DRIVEWAY_Z - 2.82, 8.4, 2.98, 0.28, wall);
  box(center, 1.49, DRIVEWAY_Z + 2.82, 8.4, 2.98, 0.28, wall);
  box(front + 8.2, 1.49, DRIVEWAY_Z, 0.29, 2.98, 5.72, '#494451');
  box(center, 0.015, DRIVEWAY_Z, 8.5, 0.05, 5.6, '#5b545c', 0, 0, false);
  box(center, 2.99, DRIVEWAY_Z, 8.65, 0.29, 6.04, '#49424e');
  for (const side of [-1, 1]) box(front, 1.48, DRIVEWAY_Z + side * 2.57, 0.35, 2.96, 0.58, '#a58a83');
  box(front, 2.72, DRIVEWAY_Z, 0.4, 0.56, 5.65, '#a58a83');
  box(front - 0.16, 2.48, DRIVEWAY_Z, 0.12, 0.12, 5, '#494350');
  box(front - 0.21, 2.16, DRIVEWAY_Z + 2.61, 0.15, 0.31, 0.24, '#ffd290', 0, 0, false);
  box(center, 2.77, DRIVEWAY_Z, 1.26, 0.11, 0.22, '#ffcf99', 0, 0, false);
  box(front + 7.7, 0.91, DRIVEWAY_Z - 0.5, 0.8, 0.16, 2.72, '#86644e');
  box(front + 7.7, 1.52, DRIVEWAY_Z - 0.68, 0.13, 0.8, 2.28, '#70615d');
  box(front + 7.60, 1.59, DRIVEWAY_Z - 1.43, 0.11, 0.39, 0.12, '#ad9b8f');
  box(front + 7.59, 1.55, DRIVEWAY_Z - 1.11, 0.1, 0.32, 0.09, '#a27962');
  box(front + 7.59, 1.35, DRIVEWAY_Z - 1.11, 0.12, 0.12, 0.12, '#5e4749');
  box(front + 7.58, 1.67, DRIVEWAY_Z - 0.65, 0.11, 0.09, 0.42, '#a0867e');
  box(front + 7.57, 1.65, DRIVEWAY_Z - 0.38, 0.11, 0.14, 0.20, '#785457');
  box(front + 7.6, 1.12, DRIVEWAY_Z + 0.35, 0.48, 0.26, 0.69, '#68535d');
  box(front + 7.34, 1.12, DRIVEWAY_Z + 0.35, 0.05, 0.05, 0.21, '#b69785');
  for (const z of [-1.64, 0.64]) box(front + 7.6, 0.47, DRIVEWAY_Z + z, 0.57, 0.94, 0.14, '#5a4950');
  box(front + 7.5, 0.45, DRIVEWAY_Z + 1.63, 0.74, 0.9, 0.87, '#917357');
  box(front + 7.5, 1.07, DRIVEWAY_Z + 1.59, 0.58, 0.34, 0.64, '#b19169');
  box(front + 7.2, 1.12, DRIVEWAY_Z + 1.59, 0.015, 0.105, 0.29, '#cab39a');
}

function trafficCar(scene, color, oncoming) {
  const group = new THREE.Group();
  scene.add(group);
  const parts = [
    [0, 0.52, 0, 1.65, 0.57, 3.35, color],
    [0, 0.91, 0.12, 1.43, 0.47, 1.66, '#394055'],
    [0, 1.15, 0.12, 1.49, 0.09, 1.65, color],
  ];
  for (const x of [-0.72, 0.72]) {
    for (const z of [-1.1, 1.1]) parts.push([x, 0.32, z, 0.32, 0.53, 0.58, '#242430']);
    parts.push([x * 0.85, 0.55, oncoming ? -1.69 : 1.69, 0.39, 0.15, 0.06, oncoming ? '#ffe5b8' : '#fd605d', true]);
  }
  for (const [x, y, z, w, h, d, color, lit] of parts) {
    const material = lit ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    group.add(mesh);
  }
  return group;
}

export class DriveScene {
  constructor(trip) {
    const goingToMarket = trip === 'market';
    this.roadTime = trip ? 8.7 : ROAD_TIME;
    this.parkTime = trip ? 14.5 : PARK_TIME;
    this.roadStart = goingToMarket ? 326 : trip ? 245 : 0;
    this.roadEnd = goingToMarket ? MARKET_TURN : TURN_START;
    this.roadDirection = goingToMarket ? -1 : 1;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2('#9b798a', 0.0105);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.06, 320);
    this.sky = sky(this.scene);
    const light = new THREE.DirectionalLight('#ffd0ad', 1.15);
    light.position.set(-45, 25, 35);
    this.scene.add(light, new THREE.HemisphereLight('#d1c0ea', '#79617e', 1.22));

    const scenery = sceneryBatches(this.scene);
    const box = scenery.box;
    const random = randomSequence(92);
    box(0, -0.21, -204, 460, 0.42, 580, '#514c50', 0, 0, false);
    road(this.scene, box, random, trip);
    offices(this.scene, box, random);
    neighborhood(box, random, trip);
    garage(box);
    if (trip) market(this.scene, box);
    for (let s = 11; s < 380; s += 16) {
      const side = s % 32 < 16 ? -1 : 1;
      if (side === 1 && s > 326 && s < 349) continue;
      lamp(box, roadCenter(s) + side * 5.25, -s, side);
    }
    scenery.addToScene();

    this.traffic = [trafficCar(this.scene, '#5d667d', false), trafficCar(this.scene, '#8f6268', true),
      trafficCar(this.scene, '#77736a', true)];
    const homeTurn = [
      [1.7, -TURN_START], [1.7, -332], [2.65, -335.5], [5.5, -337.55], [9, DRIVEWAY_Z],
      [14, DRIVEWAY_Z], [21.8, DRIVEWAY_Z],
    ];
    const marketTurn = [
      [roadCenter(MARKET_TURN) - 1.7, -MARKET_TURN], [roadCenter(237) - 1.7, -237], [-3.55, -233.0],
      [-5.2, -230.8], [-9, MARKET_Z], [-14.6, MARKET_Z],
    ];
    this.turn = new THREE.CatmullRomCurve3((goingToMarket ? marketTurn : homeTurn).map(([x, z]) => new THREE.Vector3(x, 0, z)));
    this.driver = new THREE.Vector3();
    this.direction = new THREE.Vector3();
  }

  update(time, moving, aspect) {
    const roadTime = Math.min(time, this.roadTime);
    const progress = (roadTime - 1 + Math.exp(-roadTime)) / (this.roadTime - 1 + Math.exp(-this.roadTime));
    const distance = THREE.MathUtils.lerp(this.roadStart, this.roadEnd, progress);
    const arrival = THREE.MathUtils.clamp((time - this.roadTime) / (this.parkTime - this.roadTime), 0, 1);
    if (arrival > 0) {
      const progress = arrival * (2 - arrival);
      this.turn.getPointAt(progress, this.driver);
      this.turn.getTangentAt(progress, this.direction);
    } else {
      this.driver.set(roadCenter(distance) + 1.7 * this.roadDirection, 0, -distance);
      this.direction.set(roadCenter(distance + 0.1) - roadCenter(distance - 0.1), 0, -0.2).normalize().multiplyScalar(this.roadDirection);
    }

    const speed = !moving ? 0 : arrival === 0 ? CRUISE_MPH * (1 - Math.exp(-roadTime))
      : 24 * (1 - arrival);
    if (this.camera.aspect !== aspect) {
      this.camera.aspect = aspect;
      this.camera.fov = aspect < 1 ? 66 : 55;
      this.camera.updateProjectionMatrix();
    }
    const bob = Math.sin(time * 15) * 0.014 * speed / CRUISE_MPH;
    this.camera.position.set(this.driver.x + this.direction.z * 0.27, 1.42 + bob,
      this.driver.z - this.direction.x * 0.27);
    this.camera.lookAt(this.camera.position.x + this.direction.x * 10, 0.75 + bob,
      this.camera.position.z + this.direction.z * 10);
    this.sky.position.copy(this.camera.position);

    const trafficDistances = this.roadStart ? [this.roadStart - 38 + time * 7.2,
      this.roadStart + 37 - time * 12.0, this.roadStart + 120 - time * 7.1]
      : [24 + time * 9.7, 117 - time * 7.5, 353 - time * 7.1];
    this.traffic.forEach((car, i) => {
      const s = trafficDistances[i];
      const direction = i === 0 ? 1 : -1;
      car.position.set(roadCenter(s) + 1.85 * direction, 0, -s);
      car.rotation.y = (i === 0 ? 0 : Math.PI) - Math.atan2(roadCenter(s + 0.1) - roadCenter(s - 0.1), 0.2);
    });
    return speed;
  }

  dispose() {
    const geometries = new Set();
    const materials = new Set();
    this.scene.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) materials.add(object.material);
      if (object.isInstancedMesh) object.dispose();
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) {
      material.map?.dispose();
      material.dispose();
    }
  }
}
