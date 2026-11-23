import * as THREE from 'three';
import { DECOR, HOME_SPAWN, HOME_STATIONS } from '../data/life.js';
import { HOUSING_ROOMS, childAge, partnerFor } from '../data/legacy.js';
import { paintWing, wingRooms } from './home-wing.js';

const HALF_WIDTH = 8.8;
const HALF_DEPTH = 5.9;
const RADIUS = 0.23;

export class HomeView {
  constructor(world, state) {
    this.world = world;
    this.position = state.life?.position || { ...HOME_SPAWN };
    this.obstacles = [];
    this.stationLabels = new Map();
    this.stations = HOME_STATIONS.map(station => ({ ...station }));
    this.annex = wingRooms(HOUSING_ROOMS[state.home] || []);
    this.rightEdge = this.annex.at(-1)?.right ?? HALF_WIDTH;
    this.footprint = [{ left: -HALF_WIDTH, right: HALF_WIDTH, top: -HALF_DEPTH, bottom: HALF_DEPTH }, ...this.annex];
    const target = world.office;
    const palette = state.life?.decor;
    const wallpaper = DECOR.walls.options.find(option => option.id === palette?.walls) || DECOR.walls.options[0];
    const rug = DECOR.rug.options.find(option => option.id === palette?.rug) || DECOR.rug.options[0];
    const lamp = '#ffc486';
    const wood = '#86543d';
    const walnut = '#574052';
    const linen = '#f3dfc3';
    const edge = '#33283b';
    const boxMaterials = new Map();

    const box = (x, z, w, d, height, color, y = 0, collision = false, basic = false) => {
      const key = `${color}/${basic}`;
      if (!boxMaterials.has(key)) {
        const material = basic ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshLambertMaterial({ color });
        boxMaterials.set(key, material);
      }
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), boxMaterials.get(key));
      mesh.position.set(x, y + height / 2, z);
      target.add(mesh);
      if (collision) this.obstacles.push({ x, z, w, d });
      return mesh;
    };

    const sprite = (key, x, z, y = 0, size = 0.85) => {
      const item = world.sprite(key, new THREE.Vector3(x, y, z), size);
      target.add(item);
      return item;
    };
    const wall = (x, z, w, d, color, height = 0.81) => {
      box(x, z, w, d, height, color, 0.02, true);
      box(x, z, w + 0.085, d + 0.085, 0.055, '#ead0ad', height + 0.02);
      box(x, z, w + 0.032, d + 0.032, 0.12, '#695166', 0.02);
    };
    const mat = (x, z, w, d, color, border) => {
      box(x, z, w, d, 0.026, border, 0.017);
      box(x, z, w - 0.13, d - 0.13, 0.027, color, 0.023);
    };
    const table = (x, z, w, d, height, color = wood) => {
      box(x, z, w, d, 0.14, color, height - 0.14);
      for (const dx of [-w / 2 + 0.13, w / 2 - 0.13]) for (const dz of [-d / 2 + 0.12, d / 2 - 0.12]) {
        box(x + dx, z + dz, 0.14, 0.14, height - 0.14, walnut);
      }
      this.obstacles.push({ x, z, w, d });
    };
    const roomLabel = (text, x, z) => world.label(text, new THREE.Vector3(x, 0.1, z), 'home-room-label');

    // The cutaway floor has distinct room finishes and low interior walls.
    box(0, 0.06, 18.43, 12.52, 0.34, '#30263d', -0.36);
    box(0, 0, 17.85, 11.95, 0.13, '#ae7a61', -0.13);
    for (let row = 0; row < 16; row++) {
      const z = -5.62 + row * 0.75;
      box(0, z, 17.6, 0.022, 0.005, '#86665d');
      for (let x = -8.4 + (row % 3) * 1.18; x <= 8.7; x += 3.52) box(x, z + 0.35, 0.016, 0.71, 0.005, '#8d6c63');
    }
    for (const room of [
      { x: 0.7, z: -3.79, rows: 6, cols: 7, size: 0.73, colors: ['#9b9ea1', '#90999f'] },
      { x: 6.05, z: -3.79, rows: 6, cols: 7, size: 0.73, colors: ['#8b9fad', '#7e94a7'] },
    ]) {
      for (let row = 0; row < room.rows; row++) for (let col = 0; col < room.cols; col++) {
        box(room.x + (col - 3) * room.size, room.z + (row - 2.5) * room.size,
          room.size - 0.025, room.size - 0.025, 0.013, room.colors[(row + col) % 2], 0.004);
      }
    }
    wall(0, -5.87, 17.88, 0.17, '#817491', 1.57);
    wall(-8.81, -3.78, 0.17, 4.15, '#8c808f', 1.55);
    wall(-8.81, 2.08, 0.17, 7.55, wallpaper.color, 1.55);
    if (this.annex.length) {
      wall(8.81, -1.64, .17, 8.52, '#887e93', .42);
      wall(8.81, 5.35, .17, 1.10, '#887e93', .42);
    } else wall(8.81, 0, 0.17, 11.8, '#887e93', 0.42);
    wall(-5.01, 5.86, 7.57, 0.17, '#8a7184', 0.3);
    wall(4.95, 5.86, 7.72, 0.17, '#8a7184', 0.3);
    wall(-7.2, -1.57, 3.2, 0.14, wallpaper.color);
    wall(-2.73, -1.57, 1.52, 0.14, wallpaper.color);
    wall(-1.97, -3.79, 0.14, 4.40, '#a58b91');
    wall(3.46, -3.78, 0.14, 4.42, '#81919a');
    wall(4.37, -1.57, 1.82, 0.14, '#81919a');
    wall(7.79, -1.57, 1.94, 0.14, '#81919a');
    for (const [x, z, span] of [[-6.57, -5.75, 2.25], [0.04, -5.75, 2.19], [-7.1, -1.45, 1.08]]) {
      box(x, z, span, 0.094, 0.7, '#4b435f', 0.79);
      box(x, z + 0.06, span - 0.12, 0.055, 0.57, '#6d88ad', 0.85, false, true);
      box(x, z + 0.092, span - 0.14, 0.06, 0.14, '#d99688', 0.87, false, true);
      box(x, z + 0.113, 0.07, 0.047, 0.59, linen, 0.85);
      box(x, z + 0.095, span + 0.18, 0.24, 0.07, linen, 0.77);
    }

    // Bedroom.
    mat(-4.3, -3.43, 2.26, 2.52, '#735983', '#ba97b2');
    box(-6.82, -4.12, 2.06, 2.89, 0.30, walnut, 0.03, true);
    box(-6.82, -4.15, 2.00, 2.78, 0.31, linen, 0.31);
    box(-6.82, -3.72, 2.05, 1.92, 0.14, '#647ea6', 0.58);
    box(-6.82, -3.08, 2.06, 0.32, 0.15, '#92a8c6', 0.58);
    box(-6.82, -5.55, 2.18, 0.15, 1.0, wood, 0.03);
    for (const x of [-7.31, -6.32]) box(x, -5.1, 0.72, 0.56, 0.2, '#fff3dc', 0.58);
    box(-8.24, -4.70, 0.76, 0.71, 0.69, wood, 0.01, true);
    box(-8.24, -4.68, 0.17, 0.15, 0.19, walnut, 0.69);
    box(-8.24, -4.68, 0.36, 0.33, 0.30, lamp, 0.88, false, true);
    box(-3.16, -5.19, 1.29, 0.85, 0.96, '#836668', 0.01, true);
    for (const y of [0.26, 0.57, 0.82]) box(-3.16, -4.75, 0.33, 0.061, 0.06, '#d4a777', y);
    roomLabel('BEDROOM', -5.55, -2.15);

    // Kitchen.
    box(0.02, -5.25, 3.34, 0.79, 0.87, '#596d77', 0.019, true);
    box(0.02, -5.25, 3.45, 0.91, 0.13, linen, 0.88);
    for (const x of [-1.05, -0.34, 0.38, 1.09]) box(x, -4.83, 0.34, 0.05, 0.063, '#d0a972', 0.69);
    box(-0.69, -5.2, 0.71, 0.56, 0.018, '#5c7887', 1.02);
    box(-0.69, -5.46, 0.10, 0.13, 0.29, '#b4d0d4', 1.02);
    box(1.08, -5.23, 0.76, 0.67, 0.03, '#554c66', 1.02);
    for (const dx of [-0.20, 0.20]) for (const dz of [-0.17, 0.17]) box(1.08 + dx, -5.23 + dz, 0.23, 0.22, 0.018, '#987172', 1.053);
    box(2.54, -4.86, 1.33, 1.35, 2.08, '#c6c2bd', 0.03, true);
    box(2.55, -4.16, 0.12, 0.065, 1.30, '#8c7d83', 0.47);
    box(2.54, -4.17, 1.22, 0.056, 0.046, '#8c7d83', 1.46);
    box(2.79, -4.126, 0.24, 0.034, 0.26, '#f2dd93', 1.18);
    table(1.03, -0.38, 1.72, 0.99, 0.72, '#936350');
    sprite('coffee', 0.69, -0.44, 0.71, 0.32);
    box(1.32, -0.43, 0.26, 0.34, 0.061, '#e8d5ab', 0.72);
    roomLabel('KITCHEN', 0.58, -2.36);

    // Bathroom.
    box(4.14, -5.21, 1.09, 0.92, 0.84, '#7a909f', 0.018, true);
    box(4.14, -5.22, 1.18, 1.00, 0.12, linen, 0.86);
    box(4.14, -5.18, 0.66, 0.45, 0.024, '#9cbac7', 0.99);
    box(5.17, -4.98, 0.71, 0.98, 0.46, '#e1dfd7', 0.019, true);
    box(5.17, -4.68, 0.74, 0.59, 0.14, '#f2e7d8', 0.45);
    box(5.17, -5.28, 0.74, 0.35, 0.47, '#d0d5d3', 0.45);
    box(5.17, -4.66, 0.41, 0.33, 0.023, '#a9b3be', 0.59);
    box(7.5, -4.83, 1.97, 1.71, 0.17, '#d9d6d0', 0.018, true);
    box(7.5, -4.82, 1.71, 1.42, 0.04, '#9cb4bf', 0.19);
    box(8.41, -4.82, 0.13, 1.73, 1.48, '#7396a8', 0.2);
    box(7.62, -5.55, 1.65, 0.12, 1.45, '#8cb3c0', 0.2);
    box(8.13, -5.36, 0.29, 0.24, 0.12, '#dedbd2', 1.49);
    mat(6.91, -3.0, 1.31, 0.67, '#638992', '#abc4be');
    roomLabel('BATHROOM', 6.25, -1.96);

    // Living room.
    mat(-5.78, 2.26, 5.11, 4.0, rug.color, rug.trim);
    for (const z of [0.5, 0.65, 3.87, 4.02]) box(-5.78, z, 4.83, 0.039, 0.01, rug.trim, 0.052);
    box(-5.65, 3.88, 3.39, 1.32, 0.42, '#3f6770', 0.061, true);
    box(-5.65, 4.37, 3.46, 0.35, 0.84, '#48757c', 0.13);
    for (const x of [-6.68, -5.65, -4.62]) box(x, 3.74, 0.96, 0.89, 0.19, '#619399', 0.48);
    for (const x of [-7.31, -3.99]) box(x, 3.86, 0.27, 1.28, 0.58, '#527f89', 0.14);
    box(-6.76, 4.08, 0.57, 0.22, 0.39, '#dba88e', 0.62);
    box(-4.65, 4.08, 0.53, 0.23, 0.34, '#e3cc96', 0.64);
    table(-6.42, 1.98, 1.53, 0.88, 0.46);
    box(-6.44, 1.89, 0.37, 0.25, 0.04, '#c99277', 0.46);
    box(-6.45, -0.96, 2.65, 0.61, 0.52, wood, 0.02, true);
    box(-6.49, -1.12, 1.97, 0.17, 1.09, edge, 0.57);
    box(-6.49, -1.02, 1.74, 0.05, 0.87, '#7696b5', 0.68, false, true);
    box(-6.49, -0.989, 1.74, 0.016, 0.23, '#3f658d', 0.69, false, true);
    box(-6.91, -0.976, 0.64, 0.014, 0.054, '#e5d0b8', 0.78, false, true);
    box(-7.63, 3.47, 0.65, 0.65, 0.076, walnut, 0.03);
    box(-7.63, 3.47, 0.085, 0.085, 1.73, walnut, 0.103);
    box(-7.63, 3.47, 0.50, 0.47, 0.35, '#f7be86', 1.58, false, true);
    sprite('plant', -7.97, -0.68, 0.04, 1.1);
    if (palette?.plants === 'shelf') {
      box(-8.38, 2.05, 0.64, 1.62, 0.11, wood, 0.75);
      sprite('plant', -8.38, 1.56, 0.85, 0.92);
      sprite('plant', -8.38, 2.54, 0.85, 0.66);
    }
    roomLabel('LIVING ROOM', -5.56, 4.92);

    // Workspace and entry.
    mat(5.82, 2.35, 4.34, 4.88, '#675a7c', '#af8fb0');
    table(5.73, 0.79, 3.58, 1.32, 0.98, '#b48063');
    box(5.23, 0.59, 1.16, 0.20, 0.73, '#3a324a', 1.12);
    box(5.23, 0.70, 1.02, 0.038, 0.57, '#6ea5ad', 1.20, false, true);
    box(5.06, 0.736, 0.48, 0.015, 0.041, '#c8e4c0', 1.50, false, true);
    for (const y of [1.34, 1.43]) box(5.12, 0.741, 0.61, 0.013, 0.033, '#9cce9e', y, false, true);
    box(5.24, 0.84, 0.55, 0.42, 0.051, '#4f485e', 0.98);
    box(5.35, 1.17, 0.90, 0.26, 0.047, '#ded1be', 0.981);
    sprite(state.gear?.includes('coffee') ? 'coffee' : 'book', 6.89, 0.87, 0.98, 0.53);
    if (state.gear?.includes('monitor')) sprite('tv', 6.18, 0.66, 1.03, 0.76);
    if (state.gear?.includes('homelab')) sprite('server', 7.92, 0.72, 0.03, 1.44);
    if (state.gear?.includes('laptop2')) sprite('laptop', 6.26, 0.82, 0.98, 0.54);
    sprite('officechair', 5.67, 2.03, 0.04, state.gear?.includes('chair') ? 1.24 : 1.02);
    state.certs?.slice(0, 4).forEach((_, i) => sprite('medal', 7.96, 1.56 + i * 0.67, 1, 0.52));
    if (state.villain) sprite('mask', 7.11, 0.36, 1, 0.71);
    mat(0.19, 5.25, 1.89, 0.89, '#785660', '#c08e79');
    box(1.8, 5.51, 1.07, 0.49, 0.67, wood, 0.02, true);
    box(1.71, 5.46, 0.37, 0.19, 0.047, '#e5b475', 0.7);
    box(1.52, 5.46, 0.14, 0.23, 0.051, '#6b566b', 0.704);
    box(0.19, 5.96, 2.37, 0.3, 0.09, '#e5b28b', -0.08);
    roomLabel('WORKSPACE', 6.70, 4.55);

    this.stations.push(...paintWing(this.annex, { box, wall, table, mat, sprite, roomLabel }));
    const legacy = state.life?.legacy;
    const resident = legacy?.relationship;
    if (resident?.stage === 'married' || (resident && legacy.bonds[resident.id].lastTime === state.day)) {
      const partner = partnerFor(resident.id);
      sprite(partner.sprite, -4.23, 2.47, .04, 1.13);
      world.label(partner.name, new THREE.Vector3(-4.23, 1.26, 2.47), 'home-guest');
    }
    const familyRoom = this.annex.find(room => room.id === 'nursery');
    for (const [i, child] of (legacy?.children || []).entries()) {
      const x = familyRoom ? familyRoom.left + 1.04 + 1.34 * i : -3.8 + .88 * i;
      const z = familyRoom ? -1.13 : 3.06;
      const size = childAge(child, state.day) >= 13 ? 1.07 : .69;
      sprite('player', x, z, .03, size);
      world.label(child.name, new THREE.Vector3(x, size + .15, z), 'home-guest');
    }

    // Fixtures are marked on the floor. The current interaction is also shown in the HUD.
    for (const station of this.stations) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.31, 0.36, 16),
        new THREE.MeshBasicMaterial({ color: '#e9bc85', transparent: true, opacity: 0.63, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(station.x, 0.077, station.z);
      target.add(ring);
      const label = world.label(station.name, new THREE.Vector3(station.x, 0.2, station.z), 'home-marker');
      label.el.dataset.station = station.id;
      this.stationLabels.set(station.id, { ring, el: label.el });
    }
    if (state.life && state.life.lastParty === state.day) {
      const spots = [[-7.49, 2.48], [-4.5, 1.53], [-5.05, 2.63], [-7.55, 0.92]];
      for (const [index, guest] of (state.life.guests || []).slice(0, spots.length).entries()) {
        const [x, z] = spots[index];
        sprite(guest.sprite, x, z, 0.03, 1.05);
        world.label(guest.name, new THREE.Vector3(x, 1.25, z), 'home-guest');
      }
      for (const x of [-7.65, -6.59, -5.53, -4.47]) box(x, 3.08, 0.15, 0.09, 0.055, lamp, 0.045, false, true);
    }
    if (!Number.isFinite(this.position.x) || !Number.isFinite(this.position.z) || !this.canStand(this.position.x, this.position.z)) Object.assign(this.position, HOME_SPAWN);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.39, 16),
      new THREE.MeshBasicMaterial({ color: '#30243e', transparent: true, opacity: 0.47 }));
    this.shadow.rotation.x = -Math.PI / 2;
    target.add(this.shadow);
    this.player = sprite(state.villain ? 'hacker' : 'player', this.position.x, this.position.z, 0.06, 1.31);
    this.walk = 0;
    this.update(0, 0, 0);
  }

  fit() {
    const compact = this.world.viewW < 755;
    const right = Math.min(this.rightEdge + .4, -9.2 + (compact ? 23 : 32));
    const corners = [];
    for (const x of [-9.2, right]) for (const z of [-6.1, 6.1]) for (const y of [0, 1.7]) {
      corners.push(new THREE.Vector3(x, y, z));
    }
    this.world.fit(corners, { left: compact ? 12 : 176, right: 18, top: compact ? 125 : 72,
      bottom: compact ? 162 : 104, yaw: 0.28, pitch: 0.9, pad: 1.02 });
    this.cameraOrigin = this.world.camTarget.x;
    this.cameraFollowStart = (right - 9.2) / 2;
    this.cameraTravel = Math.max(0, this.rightEdge + .4 - right);
    this.followPlayer(1);
  }

  followPlayer(amount) {
    if (!this.cameraTravel) return;
    const camera = this.world.camTarget;
    const offset = Math.max(0, Math.min(this.cameraTravel, this.position.x - this.cameraFollowStart));
    const next = camera.x + (this.cameraOrigin + offset - camera.x) * amount;
    if (Math.abs(next - camera.x) > .001) {
      camera.x = next;
      this.world.updateCamera();
    }
  }

  canStand(x, z) {
    const onFloor = (px, pz) => this.footprint.some(room => px >= room.left && px <= room.right && pz >= room.top && pz <= room.bottom);
    if (!onFloor(x - RADIUS, z) || !onFloor(x + RADIUS, z) || !onFloor(x, z - RADIUS) || !onFloor(x, z + RADIUS)) return false;
    return !this.obstacles.some(o => Math.abs(x - o.x) < o.w / 2 + RADIUS && Math.abs(z - o.z) < o.d / 2 + RADIUS);
  }

  // Floor point under a screen position (for touch walking).
  groundPoint(clientX, clientY) {
    const world = this.world;
    const r = world.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    world.camera.updateMatrixWorld();
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, world.camera);
    const hit = new THREE.Vector3();
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit) ? hit : null;
  }

  // Screen-relative input (as update() expects) that walks toward a floor point.
  inputToward(x, z) {
    const wx = x - this.position.x, wz = z - this.position.z;
    const distance = Math.hypot(wx, wz);
    if (distance < 0.12) return null;
    const yaw = this.world.yaw;
    return { horizontal: (Math.cos(yaw) * wx - Math.sin(yaw) * wz) / distance,
      vertical: (Math.sin(yaw) * wx + Math.cos(yaw) * wz) / distance, distance };
  }

  stationNear(x, z, within = 1.0) {
    let best = null, distance = within;
    for (const station of this.stations) {
      const d = Math.hypot(x - station.x, z - station.z);
      if (d < distance) { best = station; distance = d; }
    }
    return best;
  }

  nearest() {
    let best = null;
    let distance = 1.16;
    for (const station of this.stations) {
      const candidate = Math.hypot(this.position.x - station.x, this.position.z - station.z);
      if (candidate < distance) {
        best = station;
        distance = candidate;
      }
    }
    return best;
  }

  update(horizontal, vertical, dt) {
    const { position, player } = this;
    const speed = 4.15 * dt / Math.max(1, Math.hypot(horizontal, vertical));
    const yaw = this.world.yaw;
    const dx = (Math.cos(yaw) * horizontal + Math.sin(yaw) * vertical) * speed;
    const dz = (-Math.sin(yaw) * horizontal + Math.cos(yaw) * vertical) * speed;
    const oldX = position.x;
    const oldZ = position.z;
    if (this.canStand(position.x + dx, position.z)) position.x += dx;
    if (this.canStand(position.x, position.z + dz)) position.z += dz;
    const walking = position.x !== oldX || position.z !== oldZ;
    this.walk = walking ? this.walk + dt : 0;
    if (horizontal) player.scale.x = horizontal > 0 ? 1.31 : -1.31;
    player.userData.baseY = 0.715 + (walking ? Math.abs(Math.sin(this.walk * 19)) * 0.10 : 0);
    player.position.x = position.x;
    player.position.z = position.z;
    this.shadow.position.set(position.x, 0.078, position.z);
    this.followPlayer(Math.min(1, dt * 7));
    const selected = this.nearest();
    if (selected !== this.selected) {
      for (const [id, marker] of this.stationLabels) {
        marker.ring.material.opacity = id === selected?.id ? 1 : 0.63;
        marker.el.classList.toggle('selected', id === selected?.id);
      }
      this.selected = selected;
    }
    return selected;
  }
}
