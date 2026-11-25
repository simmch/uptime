import * as THREE from 'three';
import { DECOR, HOME_SPAWN, HOME_STATIONS } from '../data/life.js';
import { HOUSING_ROOMS, childAge, partnerFor } from '../data/legacy.js';
import { paintWing, wingRooms } from './home-wing.js';
import { MODELS } from './models.js';

const HALF_WIDTH = 8.8;
const HALF_DEPTH = 5.9;
const RADIUS = 0.23;
const WALL_H = 2.6;     // full-height walls: home life is seen from over your shoulder
const WALK_SPEED = 3.1; // metres per second
const NEON = { pink: '#ff3fd2', cyan: '#36f3ff', amber: '#ffb347', violet: '#9b5cff' };

export class HomeView {
  constructor(world, state) {
    this.world = world;
    this.position = state.life?.position || { ...HOME_SPAWN };
    this.obstacles = [];
    this.walls = [];
    this.camYaw = 0; this.camPitch = 0.22; this.camDist = world.aspect < 0.8 ? 2.35 : 2.05; this.camReady = false;
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
    // A Polyfork model fitted to a w×d footprint (or a height), standing at (x, z).
    const model = (key, x, z, { w, d, h, rot = 0, y = 0, collide = false } = {}) => {
      const entry = MODELS.get(key);
      if (!entry) return null;
      const quarter = Math.abs(Math.round(rot / (Math.PI / 2))) % 2 === 1;
      const sx = quarter ? entry.size.z : entry.size.x, sz = quarter ? entry.size.x : entry.size.z;
      const fits = [w && w / sx, d && d / sz, h && h / entry.size.y].filter(Boolean);
      const obj = world.model(key, new THREE.Vector3(x, y, z), { scale: fits.length ? Math.min(...fits) : 1, rotY: rot });
      target.add(obj);
      if (collide) this.obstacles.push({ x, z, w: w ?? sx, d: d ?? sz });
      return obj;
    };
    const top = obj => obj ? obj.userData.footprint.y : 0;
    const wall = (x, z, w, d, color) => {
      const body = box(x, z, w, d, WALL_H, color, 0.02, true);
      this.walls.push(body);
      box(x, z, w + 0.06, d + 0.06, 0.06, '#2b1d45', WALL_H - 0.04);
      box(x, z, w + 0.032, d + 0.032, 0.14, '#3b2552', 0.02);
    };
    // Neon tube along a wall: bright enough to bloom.
    const neon = (x, z, w, d, color, y = WALL_H - 0.16) => {
      const tube = box(x, z, w, d, 0.04, color, y, false, true);
      tube.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2) });
      tube.castShadow = false;
      return tube;
    };
    const light = (x, z, color, intensity = 6, y = WALL_H - 0.35, range = 7) => {
      const l = new THREE.PointLight(color, intensity, range, 1.7);
      l.position.set(x, y, z); target.add(l);
      return l;
    };
    // Procedural 80s electronics: a wood-veneer CRT and a beige PC.
    const crt = (x, z, y, width, rot = 0, screen = '#5fd8ff') => {
      const g = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.BoxGeometry(width, width * 0.78, width * 0.85), new THREE.MeshLambertMaterial({ color: '#4a3326' }));
      shell.position.y = width * 0.39;
      const bezel = new THREE.Mesh(new THREE.BoxGeometry(width * 0.92, width * 0.7, 0.02), new THREE.MeshLambertMaterial({ color: '#1d1a24' }));
      bezel.position.set(0, width * 0.4, width * 0.43);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.7, width * 0.52), new THREE.MeshBasicMaterial({ color: new THREE.Color(screen).multiplyScalar(1.6) }));
      glass.position.set(-width * 0.06, width * 0.42, width * 0.441);
      for (const m of [shell, bezel]) { m.castShadow = true; m.receiveShadow = true; }
      g.add(shell, bezel, glass);
      g.position.set(x, y, z); g.rotation.y = rot;
      target.add(g);
      return g;
    };
    const beigePC = (x, z, y, rot = 0) => {
      const g = new THREE.Group();
      const beige = new THREE.MeshLambertMaterial({ color: '#d9cdb0' });
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.5), beige); tower.position.y = 0.08;
      const mon = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.46), beige); mon.position.set(0, 0.38, -0.02);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.28), new THREE.MeshBasicMaterial({ color: new THREE.Color('#39ff8f').multiplyScalar(1.3) }));
      screen.position.set(0, 0.39, 0.211);
      const kb = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.035, 0.19), beige); kb.position.set(0, 0.02, 0.42);
      for (const m of [tower, mon, kb]) { m.castShadow = true; m.receiveShadow = true; }
      g.add(tower, mon, screen, kb);
      g.position.set(x, y, z); g.rotation.y = rot;
      target.add(g);
      return g;
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
    const roomLabel = (text, x, z) => { const l = world.label(text, new THREE.Vector3(x, 2.05, z), 'home-room-label'); l.maxDist = 6.5; return l; };

    // The cutaway floor has distinct room finishes and low interior walls.
    box(0, 0.06, 18.43, 12.52, 0.34, '#1c1430', -0.36);
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
      box(x, z, span, 0.094, 1.0, '#2a1b3f', 1.0);
      box(x, z + 0.06, span - 0.12, 0.055, 0.42, '#ff7aa8', 1.48, false, true);
      box(x, z + 0.062, span - 0.12, 0.055, 0.46, '#5a2c8c', 1.04, false, true);
      box(x, z + 0.092, span - 0.14, 0.06, 0.1, '#ffbe6b', 1.42, false, true);
      box(x, z + 0.113, 0.07, 0.047, 0.88, '#c9b8e6', 1.06);
      box(x, z + 0.095, span + 0.18, 0.24, 0.07, '#c9b8e6', 0.98);
    }

    // Bedroom.
    mat(-4.3, -3.43, 2.26, 2.52, '#735983', '#ba97b2');
    model('home_bed', -6.82, -4.12, { w: 2.06, d: 2.89, collide: true });
    const nightstand = model('home_sidetable', -8.24, -4.70, { w: 0.7, d: 0.66, collide: true });
    model('lightbulb', -8.24, -4.72, { h: 0.5, y: top(nightstand) });
    model('home_wardrobe', -3.16, -5.19, { w: 1.29, d: 0.85, collide: true });
    roomLabel('BEDROOM', -5.55, -2.15);

    // Kitchen.
    model('home_kitchen_sink', -0.75, -5.25, { w: 1.85, d: 0.8 });
    model('home_oven', 0.75, -5.3, { w: 0.68, d: 0.7 });
    model('home_island', 1.45, -5.25, { w: 0.9, d: 0.8 });
    model('home_microwave', 1.45, -5.3, { w: 0.55, y: 0.9 });
    this.obstacles.push({ x: 0.02, z: -5.25, w: 3.34, d: 0.79 });
    model('home_fridge', 2.54, -4.95, { w: 1.0, d: 0.95, collide: true });
    model('home_table', 1.03, -0.38, { w: 1.72, d: 0.99, collide: true });
    for (const dx of [-0.5, 0.5]) for (const [dz, rot] of [[-0.75, 0], [0.75, Math.PI]]) model('home_barstool', 1.03 + dx, -0.38 + dz, { h: 0.8, rot });
    sprite('coffee', 0.69, -0.44, 0.71, 0.32);
    model('home_boombox', 1.5, -0.4, { w: 0.5, y: 0.74, rot: -0.4 });
    box(1.32, -0.43, 0.26, 0.34, 0.061, '#e8d5ab', 0.72);
    roomLabel('KITCHEN', 0.58, -2.36);

    // Bathroom.
    model('home_basin', 4.14, -5.21, { w: 1.0, d: 0.75, collide: true });
    model('home_toilet', 5.17, -5.05, { w: 0.6, d: 0.85, collide: true });
    model('home_shower', 7.55, -4.83, { w: 1.7, d: 1.6, collide: true });
    mat(6.91, -3.0, 1.31, 0.67, '#638992', '#abc4be');
    roomLabel('BATHROOM', 6.25, -1.96);

    // Living room.
    mat(-5.78, 2.26, 5.11, 4.0, rug.color, rug.trim);
    for (const z of [0.5, 0.65, 3.87, 4.02]) box(-5.78, z, 4.83, 0.039, 0.01, rug.trim, 0.052);
    model(MODELS.has('home_lounge') ? 'home_lounge' : 'home_sofa', -5.65, 3.88, { w: 3.2, d: 1.3, rot: Math.PI, collide: true });
    model('home_coffeetable', -6.42, 1.98, { w: 1.4, d: 0.8, collide: true });
    const media = model('home_sidetable', -6.45, -0.96, { w: 2.2, d: 0.6, collide: true });
    crt(-6.3, -0.98, top(media), 0.95);
    model('home_turntable', -7.25, -0.98, { w: 0.5, y: top(media) });
    model('home_boombox', -5.4, -0.98, { w: 0.6, y: top(media) });
    model('home_arcade', -8.2, 5.0, { h: 1.75, rot: Math.PI / 2, collide: true });
    model('neon_window', -8.68, 1.9, { w: 1.1, y: 1.15, rot: Math.PI / 2 });
    model('home_floorlamp', -7.63, 3.47, { h: 1.9, collide: true });
    model(MODELS.has('home_shellchair') ? 'home_shellchair' : 'home_armchair', -3.4, 1.4, { w: 0.9, d: 0.9, rot: -Math.PI / 2, collide: true });
    sprite('plant', -7.97, -0.68, 0.04, 1.1);
    if (palette?.plants === 'shelf') {
      box(-8.38, 2.05, 0.64, 1.62, 0.11, wood, 0.75);
      sprite('plant', -8.38, 1.56, 0.85, 0.92);
      sprite('plant', -8.38, 2.54, 0.85, 0.66);
    }
    roomLabel('LIVING ROOM', -5.56, 4.92);

    // Workspace and entry.
    mat(5.82, 2.35, 4.34, 4.88, '#675a7c', '#af8fb0');
    const desk = model('home_desk', 5.73, 0.79, { w: 3.3, d: 1.25, collide: true });
    const deskTop = top(desk) || 0.98;
    beigePC(5.25, 0.62, deskTop);
    model('home_bookshelf', 7.95, -0.3, { w: 0.5, d: 1.4, rot: -Math.PI / 2, collide: true });
    sprite(state.gear?.includes('coffee') ? 'coffee' : 'book', 6.89, 0.87, deskTop, 0.3);
    if (state.gear?.includes('monitor')) crt(6.35, 0.55, deskTop, 0.55, -0.3, '#ff6ad5');
    if (state.gear?.includes('homelab')) model('server', 7.92, 1.2, { h: 1.3, collide: true });
    if (state.gear?.includes('laptop2')) model('laptop', 4.45, 0.82, { w: 0.42, y: deskTop, rot: 0.3 });
    model('officechair', 5.4, 1.85, { h: state.gear?.includes('chair') ? 1.15 : 0.98, rot: Math.PI });
    state.certs?.slice(0, 4).forEach((_, i) => model('medal', 7.96, 1.56 + i * 0.67, { h: 0.32, y: 1, rot: -Math.PI / 2 }));
    if (state.villain) model('mask', 7.0, 0.4, { h: 0.45, y: deskTop });
    mat(0.19, 5.25, 1.89, 0.89, '#785660', '#c08e79');
    const entry = model('home_sidetable', 1.8, 5.45, { w: 1.0, d: 0.5, collide: true });
    model('roller_skate', -1.05, 5.4, { w: 0.32, rot: 0.6 });
    model('roller_skate', -0.75, 5.5, { w: 0.32, rot: 0.2 });
    model('kms', 1.75, 5.45, { w: 0.3, y: top(entry) });
    box(0.19, 5.96, 2.37, 0.3, 0.09, '#e5b28b', -0.08);
    roomLabel('WORKSPACE', 6.70, 4.55);

    this.stations.push(...paintWing(this.annex, { box, wall, table, mat, sprite, roomLabel }));

    // Neon trim and room lighting: dusk outside, tubes and lamps inside.
    neon(-5.0, -5.73, 7.2, 0.04, NEON.violet); light(-5.4, -3.6, '#b38cff', 5);
    neon(0.3, -5.73, 4.6, 0.04, NEON.amber); light(0.6, -3.4, '#ffcf8f', 6);
    neon(6.1, -5.73, 4.8, 0.04, NEON.cyan); light(6.0, -3.6, '#9ff3ff', 4.5);
    neon(-8.66, 2.1, 0.04, 6.8, NEON.pink); light(-5.6, 2.2, '#ff7ad9', 7, WALL_H - 0.35, 8);
    neon(8.66, 2.6, 0.04, 5.6, NEON.cyan); light(5.8, 2.3, '#7af1ff', 6, WALL_H - 0.35, 8);
    light(0.2, 3.6, '#ffd8a8', 4, WALL_H - 0.35, 7);
    for (const room of this.footprint) {
      const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(room.right - room.left + 0.4, room.bottom - room.top + 0.4),
        new THREE.MeshLambertMaterial({ color: '#3a2660', emissive: '#140a28' }));
      ceiling.rotation.x = Math.PI / 2;
      ceiling.position.set((room.left + room.right) / 2, WALL_H + 0.02, (room.top + room.bottom) / 2);
      target.add(ceiling);
    }
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
      const label = world.label(station.name, new THREE.Vector3(station.x, 1.15, station.z), 'home-marker');
      label.maxDist = 6;
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
    this.player = sprite(state.villain ? 'hacker' : 'player', this.position.x, this.position.z, 0.02, 1.45);
    this.player.rotation.y = Math.PI;
    this.camYaw = Number.isFinite(state.life?.cameraYaw) ? state.life.cameraYaw : 0;
    this.walk = 0;
    this.update(0, 0, 0);
    this.fit();
  }

  // ── third-person camera ──
  // Close over the right shoulder. Yaw is a full circle; drag or the touch pad orbits it.
  // The camera slides in rather than clip through walls.
  orbit(yaw, pitch) {
    this.camYaw -= yaw;
    this.camPitch = Math.max(-0.72, Math.min(1.15, this.camPitch + pitch));
  }
  look(dx, dy) { this.orbit(dx * 0.012, dy * 0.009); }
  zoomCamera(factor) { this.camDist = Math.max(1.02, Math.min(3.4, this.camDist * factor)); }
  forward() { return new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw)); }
  right() { return new THREE.Vector3(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw)); }
  fit() { this.camReady = false; this.updateCamera(1); }
  updateCamera(dt) {
    const cam = this.world.persp;
    const f = this.forward(), r = this.right();
    const head = new THREE.Vector3(this.position.x, 1.5, this.position.z);
    const shoulder = head.clone().addScaledVector(r, 0.58);
    const want = shoulder.clone()
      .addScaledVector(f, -Math.cos(this.camPitch) * this.camDist)
      .add(new THREE.Vector3(0, Math.sin(this.camPitch) * this.camDist + 0.15, 0));
    // Keep the camera on this side of any wall.
    const dir = want.clone().sub(shoulder);
    const len = dir.length();
    this.ray ||= new THREE.Raycaster();
    this.ray.set(shoulder, dir.normalize());
    this.ray.far = len;
    const hit = this.ray.intersectObjects(this.walls, false)[0];
    if (hit) want.copy(shoulder).addScaledVector(dir, Math.max(0.35, hit.distance - 0.22));
    want.y = Math.min(want.y, 2.45);
    const k = this.camReady ? 1 - Math.exp(-dt * 12) : 1;
    cam.position.lerp(want, k);
    const look = shoulder.clone().addScaledVector(f, 2.6).add(new THREE.Vector3(0, -0.12 - this.camPitch * 0.35, 0));
    this.lookAt ||= look.clone();
    this.lookAt.lerp(look, k);
    cam.lookAt(this.lookAt);
    cam.updateMatrixWorld();
    this.camReady = true;
  }
  followPlayer() {}

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
    const f = this.forward(), r = this.right();
    return { horizontal: (r.x * wx + r.z * wz) / distance, vertical: -(f.x * wx + f.z * wz) / distance, distance };
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
    // Input is relative to where the camera looks: up = forward, right = strafe right.
    const speed = WALK_SPEED * dt / Math.max(1, Math.hypot(horizontal, vertical));
    const f = this.forward(), r = this.right();
    const dx = (r.x * horizontal - f.x * vertical) * speed;
    const dz = (r.z * horizontal - f.z * vertical) * speed;
    const oldX = position.x;
    const oldZ = position.z;
    if (this.canStand(position.x + dx, position.z)) position.x += dx;
    if (this.canStand(position.x, position.z + dz)) position.z += dz;
    const walking = position.x !== oldX || position.z !== oldZ;
    this.walk = walking ? this.walk + dt : 0;
    if (player.isSprite) {
      if (horizontal) player.scale.x = horizontal > 0 ? 1.31 : -1.31;
      player.userData.baseY = 0.715 + (walking ? Math.abs(Math.sin(this.walk * 19)) * 0.10 : 0);
    } else {
      // Turn smoothly toward the direction of travel and swap the walk/idle clip.
      if (walking) {
        const want = Math.atan2(position.x - oldX, position.z - oldZ);
        let delta = want - player.rotation.y;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        player.rotation.y += delta * Math.min(1, dt * 14);
      }
      player.userData.play?.(walking ? 'Walk' : 'Idle', 0.18);
    }
    player.position.x = position.x;
    player.position.z = position.z;
    this.shadow.position.set(position.x, 0.078, position.z);
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
