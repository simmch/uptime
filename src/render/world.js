// Three.js world: a chunky low-res pixel diorama.
// The office and architecture dioramas share a renderer with the opening drive.
import * as THREE from 'three';
import { spriteMaterial } from './atlas.js';
import { HomeView } from './home.js';
import { COMPONENT, LAYERS } from '../data/components.js';
import { REGION, PROVIDERS } from '../data/regions.js';

const PIXEL = 2.5; // render-resolution divisor → bigger pixels
const LAYER_ORDER = Object.fromEntries(LAYERS.map((l, i) => [l.id, i]));

export class World {
  constructor(container, labelRoot) {
    this.container = container;
    this.labelRoot = labelRoot;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.domElement.className = 'world-canvas';
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0d1018');
    this.scene.fog = new THREE.Fog('#0d1018', 60, 120);
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
    this.camTarget = new THREE.Vector3(0, 0, 0);
    this.camDist = 60; this.zoom = 1; this.yaw = Math.PI / 4; this.pitch = 0.62;
    this.scene.add(new THREE.HemisphereLight('#bcd4ff', '#2a1d14', 1.2));
    const sun = new THREE.DirectionalLight('#fff3dd', 1.4); sun.position.set(20, 40, 15); this.scene.add(sun);
    this.office = new THREE.Group(); this.arch = new THREE.Group(); this.fx = new THREE.Group();
    this.scene.add(this.office, this.arch, this.fx);
    this.pickables = []; this.nodeObjs = {}; this.labels = []; this.regionMeta = {}; this.bobbers = [];
    this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2();
    this.listeners = { pick: [], hover: [] };
    this.mode = 'office';
    this.drive = null;
    this.clock = new THREE.Clock();
    this.initPackets();
    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  on(ev, fn) { this.listeners[ev].push(fn); }
  emit(ev, d) { for (const f of this.listeners[ev]) f(d); }

  setDrive(drive) {
    this.drive = drive;
    this.labelRoot.hidden = Boolean(drive);
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth, h = this.container.clientHeight || window.innerHeight;
    const rotated = this.viewW && Math.abs(w - this.viewW) >= 70;
    this.renderer.setSize(Math.ceil(w / PIXEL), Math.ceil(h / PIXEL), false);
    this.aspect = w / h; this.viewW = w; this.viewH = h;
    if (this.mode === 'office' && this.homeView) this.homeView.fit();
    else if (this.mode === 'arch' && rotated && document.documentElement.classList.contains('touch')) this.fitArchitecture();
    else this.updateCamera();
  }
  updateCamera() {
    const size = 9 / this.zoom;
    this.camera.left = -size * this.aspect; this.camera.right = size * this.aspect; this.camera.top = size; this.camera.bottom = -size;
    const off = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch)).multiplyScalar(this.camDist);
    this.camera.position.copy(this.camTarget).add(off);
    this.camera.lookAt(this.camTarget);
    this.camera.updateProjectionMatrix();
  }
  // Fit a set of world points into the free screen area between UI panels.
  fit(points, { left = 80, right = 20, top = 70, bottom = 20, yaw = Math.PI / 4, pitch = 0.62, pad = 1.08 } = {}) {
    this.yaw = yaw; this.pitch = pitch;
    const c = new THREE.Vector3(); for (const p of points) c.add(p); c.multiplyScalar(1 / Math.max(1, points.length));
    this.camTarget.copy(c); this.zoom = 1; this.updateCamera(); this.camera.updateMatrixWorld();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const inv = this.camera.matrixWorldInverse;
    for (const p of points) { const v = p.clone().applyMatrix4(inv); minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y); }
    const Wa = Math.max(200, this.viewW - left - right), Ha = Math.max(200, this.viewH - top - bottom);
    const size = Math.max(((maxX - minX) * this.viewW) / (2 * this.aspect * Wa), ((maxY - minY) * this.viewH) / (2 * Ha), 3) * pad;
    this.zoom = Math.min(2.4, Math.max(0.12, 9 / size));
    this.updateCamera(); this.camera.updateMatrixWorld();
    const pxPerUnit = this.viewH / (2 * size);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const wantX = (left + Wa / 2 - this.viewW / 2) / pxPerUnit, wantY = -(top + Ha / 2 - this.viewH / 2) / pxPerUnit;
    const r = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const u = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    // move the target so the points' center lands at the free-area center (project the camera-up shift onto the ground plane)
    const groundUp = new THREE.Vector3(u.x, 0, u.z).normalize().multiplyScalar(1 / Math.max(0.2, Math.sin(this.pitch)));
    this.camTarget.addScaledVector(r, cx - wantX).addScaledVector(groundUp, cy - wantY);
    this.updateCamera();
  }
  // On compact touch layouts the side panels are drawers, so the whole screen is free.
  insets(desktop) {
    const html = document.documentElement;
    if (!html.classList.contains('compact')) return desktop;
    const phone = html.classList.contains('phone');
    const top = parseFloat(html.style.getPropertyValue('--m-top')) || (phone ? 100 : 118);
    return { ...desktop, left: 10, right: 10, top, bottom: 64 };
  }
  focus(box, pad = 1.15) {
    const pts = [];
    for (const x of [box.min.x, box.max.x]) for (const z of [box.min.z, box.max.z]) pts.push(new THREE.Vector3(x, 0, z));
    this.fit(pts, this.insets({ pad, left: 80, right: 500 }));
  }

  adjustView(zoomFactor = 1, rotation = 0) {
    this.zoom = Math.min(3, Math.max(.12, this.zoom * zoomFactor));
    this.yaw += rotation;
    this.updateCamera();
  }

  panView(dx, dy) {
    const step = 0.028 / this.zoom;
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.camTarget.addScaledVector(right, -dx * step).addScaledVector(fwd, -dy * step * 1.4);
  }

  bindInput() {
    const el = this.renderer.domElement;
    const touches = new Map();
    let mouseDrag, touchTap, pinch;
    const canMove = () => !this.homeTick && !this.drive;
    const point = e => ({ x: e.clientX, y: e.clientY });
    const pinchState = () => {
      if (touches.size < 2) return null;
      const [a, b] = [...touches.values()];
      return { distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        angle: Math.atan2(b.y - a.y, b.x - a.x), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };

    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('pointerdown', e => {
      if (!canMove()) return;
      if (e.pointerType === 'touch') {
        if (this.mode !== 'arch') return;
        touches.set(e.pointerId, point(e));
        if (touches.size === 1) touchTap = { id: e.pointerId, ...point(e) };
        else { touchTap = null; pinch = pinchState(); }
        el.setPointerCapture(e.pointerId);
      } else mouseDrag = { id: e.pointerId, ...point(e), button: e.button, moved: false };
    });

    const endTouch = (event, cancelled) => {
      if (!touches.has(event.pointerId)) return;
      if (!cancelled && canMove() && touchTap?.id === event.pointerId &&
          Math.hypot(event.clientX - touchTap.x, event.clientY - touchTap.y) <= 10) {
        this.emit('pick', this.pick(event));
      }
      touches.delete(event.pointerId);
      touchTap = null;
      pinch = pinchState();
    };
    window.addEventListener('pointerup', e => {
      if (e.pointerType === 'touch') endTouch(e, false);
      else if (e.pointerId === mouseDrag?.id) {
        if (canMove() && !mouseDrag.moved && mouseDrag.button === 0 && e.target === el) this.emit('pick', this.pick(e));
        mouseDrag = null;
      }
    });
    window.addEventListener('pointercancel', e => {
      endTouch(e, true);
      if (e.pointerId === mouseDrag?.id) mouseDrag = null;
    });
    el.addEventListener('lostpointercapture', e => endTouch(e, true));
    const resetGestures = () => { touches.clear(); mouseDrag = null; touchTap = null; pinch = null; };
    window.addEventListener('blur', resetGestures);
    document.addEventListener('visibilitychange', () => { if (document.hidden) resetGestures(); });

    el.addEventListener('pointermove', e => {
      if (!canMove()) return;
      if (e.pointerType === 'touch') {
        const previous = touches.get(e.pointerId);
        if (!previous) return;
        touches.set(e.pointerId, point(e));
        if (pinch) {
          const next = pinchState();
          const delta = next.angle - pinch.angle;
          this.panView(next.x - pinch.x, next.y - pinch.y);
          this.adjustView(next.distance / pinch.distance, -Math.atan2(Math.sin(delta), Math.cos(delta)));
          pinch = next;
        } else {
          if (touchTap && Math.hypot(e.clientX - touchTap.x, e.clientY - touchTap.y) <= 10) return;
          const origin = touchTap || previous;
          touchTap = null;
          this.panView(e.clientX - origin.x, e.clientY - origin.y);
          this.updateCamera();
        }
        return;
      }
      if (e.pointerId === mouseDrag?.id) {
        const dx = e.clientX - mouseDrag.x, dy = e.clientY - mouseDrag.y;
        if (!mouseDrag.moved && Math.abs(dx) + Math.abs(dy) <= 4) return;
        mouseDrag.moved = true;
        if (mouseDrag.button === 2 || e.shiftKey) {
          this.yaw -= dx * 0.006;
          this.pitch = Math.min(1.2, Math.max(0.3, this.pitch + dy * 0.004));
        } else this.panView(dx, dy);
        Object.assign(mouseDrag, point(e));
        this.updateCamera();
      } else {
        const hit = this.pick(e);
        this.emit('hover', hit);
        el.style.cursor = hit ? 'pointer' : 'default';
      }
    });
    el.addEventListener('wheel', e => {
      e.preventDefault();
      if (canMove()) this.adjustView(e.deltaY > 0 ? .9 : 1.1);
    }, { passive: false });
    const driveKeys = new Set();
    window.addEventListener('keyup', e => driveKeys.delete(e.code));
    window.addEventListener('blur', () => driveKeys.clear());
    window.addEventListener('keydown', e => {
      if (this.drive) { driveKeys.add(e.code); return; }
      if (this.homeTick || e.defaultPrevented || (e.repeat && driveKeys.has(e.code))) return;
      driveKeys.delete(e.code);
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      const k = 1.2 / this.zoom;
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      if (e.key === 'a' || e.key === 'ArrowLeft') this.camTarget.addScaledVector(right, -k);
      else if (e.key === 'd' || e.key === 'ArrowRight') this.camTarget.addScaledVector(right, k);
      else if (e.key === 'w' || e.key === 'ArrowUp') this.camTarget.addScaledVector(fwd, -k);
      else if (e.key === 's' || e.key === 'ArrowDown') this.camTarget.addScaledVector(fwd, k);
      else if (e.key === 'q') this.yaw += 0.1; else if (e.key === 'e') this.yaw -= 0.1;
      else return;
      this.updateCamera();
    });
  }

  pick(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    const sprite = hits.find(h => h.object.userData.kind === 'node');
    const h = sprite || hits[0];
    return h ? h.object.userData : null;
  }

  clearGroup(g, discardMaterials = false) {
    const materials = new Set();
    for (const child of [...g.children]) {
      g.remove(child);
      child.traverse(object => {
        if (object.geometry && !object.isSprite) object.geometry.dispose();
        if (discardMaterials && object.isMesh) materials.add(object.material);
      });
    }
    for (const material of materials) material.dispose();
  }
  clearLabels() { for (const l of this.labels) l.el.remove(); this.labels = []; }
  label(text, pos, cls = '') {
    const el = document.createElement('div'); el.className = 'wlabel ' + cls; el.textContent = text;
    this.labelRoot.appendChild(el);
    const l = { el, pos: pos.clone(), minZoom: /\b(node|az|muted)\b/.test(cls) && !cls.includes('sel') ? 0.6 : 0 }; this.labels.push(l); return l;
  }

  sprite(key, pos, scale = 1, userData = null) {
    const s = new THREE.Sprite(spriteMaterial(key));
    s.position.copy(pos); s.position.y += scale * 0.5; s.scale.set(scale, scale, scale);
    s.center.set(0.5, 0.5);
    if (userData) { s.userData = userData; this.pickables.push(s); }
    s.userData.baseY = s.position.y; s.userData.phase = Math.random() * 6;
    this.bobbers.push(s);
    return s;
  }
  box(w, h, d, color, pos, opts = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color, ...opts }));
    m.position.copy(pos); return m;
  }

  // ═════════════ OFFICE ═════════════
  buildOffice(state) {
    this.mode = 'office';
    this.clearGroup(this.office, true);
    this.clearGroup(this.arch);
    this.clearLabels();
    this.pickables = [];
    this.bobbers = [];
    this.office.visible = true;
    this.arch.visible = false;
    this.packets.mesh.count = 0;
    this.scene.background.set(state.villain ? '#180d1d' : '#1e192b');
    this.homeView = new HomeView(this, state);
    this.homeView.fit();
  }

  // ═════════════ ARCHITECTURE ═════════════
  layout(design) {
    const L = { regions: {}, azs: {}, nodes: {}, global: {}, users: {}, bounds: new THREE.Box3() };
    design.regions.forEach((r, i) => {
      const n = design.regions.length;
      const cols = n <= 2 ? n : n <= 4 ? 2 : n <= 6 ? 3 : 4;
      const col = i % cols, row = Math.floor(i / cols);
      // screen-right in the default view is (+x, -z); screen-down is (+x, +z)
      const o = new THREE.Vector3(col * 10.5 + row * 10.5, 0, -col * 10.5 + row * 10.5);
      L.regions[r] = o;
      for (let a = 0; a < 3; a++) L.azs[r + a] = new THREE.Vector3(o.x + (a - 1) * 3.3, 0.35, o.z - 1.7);
      L.bounds.expandByPoint(o.clone().add(new THREE.Vector3(-5.5, 0, -5))); L.bounds.expandByPoint(o.clone().add(new THREE.Vector3(5.5, 2, 5)));
    });
    // nodes
    const regionalIdx = {}, azIdx = {};
    const sorted = design.nodes.slice().sort((a, b) => LAYER_ORDER[COMPONENT[a.id].layer] - LAYER_ORDER[COMPONENT[b.id].layer]);
    let edgeI = 0, ctlI = 0;
    for (const n of sorted) {
      const c = COMPONENT[n.id];
      if (c.scope === 'global') {
        if (c.layer === 'edge') { L.nodes[n.uid] = new THREE.Vector3(-8, 0.1, 3 - edgeI * 1.6); edgeI++; }
        else { L.nodes[n.uid] = new THREE.Vector3(-6 + (ctlI % 14) * 1.3, 0.1, 7 + Math.floor(ctlI / 14) * 1.3); ctlI++; }
      } else if (c.scope === 'az' && L.azs[n.region + (n.az ?? 0)]) {
        const key = n.region + (n.az ?? 0); const k = (azIdx[key] = (azIdx[key] || 0) + 1) - 1;
        const t = L.azs[key];
        L.nodes[n.uid] = new THREE.Vector3(t.x + ((k % 2) - 0.5) * 1.35, 0.45, t.z - 1.1 + Math.floor(k / 2) * 1.15);
      } else if (L.regions[n.region]) {
        const k = (regionalIdx[n.region] = (regionalIdx[n.region] || 0) + 1) - 1;
        const o = L.regions[n.region];
        L.nodes[n.uid] = new THREE.Vector3(o.x - 4.6 + (k % 8) * 1.3, 0.35, o.z + 2.1 + Math.floor(k / 8) * 1.3);
      }
    }
    L.users = { NA: new THREE.Vector3(-13, 0, 3), EU: new THREE.Vector3(-13, 0, 0.5), APAC: new THREE.Vector3(-13, 0, -2), SA: new THREE.Vector3(-13, 0, -4.5) };
    L.hacker = new THREE.Vector3(-13, 0, 7);
    L.bounds.expandByPoint(new THREE.Vector3(-14, 0, 8 + Math.floor(ctlI / 14) * 1.3)); L.bounds.expandByPoint(new THREE.Vector3(-14, 0, -5));
    return L;
  }

  buildArch(design, { job = null, keepCamera = false, selected = null } = {}) {
    this.mode = 'arch';
    this.clearGroup(this.arch); this.clearLabels(); this.pickables = []; this.bobbers = []; this.nodeObjs = {}; this.regionMeta = {};
    this.office.visible = false; this.arch.visible = true;
    this.scene.background = new THREE.Color('#0b0f17');
    this.design = design; this.job = job;
    const L = this.L = this.layout(design);
    // ground grid
    const grid = new THREE.GridHelper(200, 100, '#1c2638', '#141b28'); grid.position.y = -0.01; this.arch.add(grid);
    // users
    const geos = job?.req?.geo || { NA: 1 };
    for (const [g, p] of Object.entries(L.users)) {
      if (!geos[g]) continue;
      this.arch.add(this.sprite('user', p, 1.1));
      this.arch.add(this.sprite('user', p.clone().add(new THREE.Vector3(0.7, 0, 0.4)), 0.8));
      this.label(`${g} users ${Math.round(geos[g] * 100)}%`, p.clone().add(new THREE.Vector3(0, 1.6, 0)), 'muted');
    }
    this.label('INTERNET', new THREE.Vector3(-13, 2.8, 6), 'title');
    this.hackerSprite = this.sprite('hacker', L.hacker, 1.3); this.hackerSprite.visible = false; this.arch.add(this.hackerSprite);
    // edge column marker
    this.label('EDGE / GLOBAL', new THREE.Vector3(-8, 2.4, 4.6), 'title');
    if (Object.values(design.nodes).some(n => COMPONENT[n.id].scope === 'global' && COMPONENT[n.id].layer !== 'edge')) this.label('CONTROL PLANE · SECURITY · OPS', new THREE.Vector3(-6, 1.6, 6.2), 'title');
    // regions
    for (const r of design.regions) {
      const o = L.regions[r]; const prov = REGION[r].provider;
      const plat = this.box(11, 0.3, 9.6, '#1a2232', o.clone().add(new THREE.Vector3(0, 0.15, 0)));
      plat.userData = { kind: 'region', region: r }; this.pickables.push(plat); this.arch.add(plat);
      const rim = this.box(11.2, 0.12, 9.8, PROVIDERS[prov].color, o.clone().add(new THREE.Vector3(0, 0.02, 0))); this.arch.add(rim);
      const band = this.box(10.4, 0.06, 2.9, '#202b3f', o.clone().add(new THREE.Vector3(0, 0.33, 2.7))); band.userData = { kind: 'region', region: r }; this.pickables.push(band); this.arch.add(band);
      this.label(r, o.clone().add(new THREE.Vector3(0, 0.4, -5.3)), 'region');
      this.label(REGION[r].name, o.clone().add(new THREE.Vector3(0, 0.4, -4.6)), 'muted');
      const azMeshes = [];
      for (let a = 0; a < 3; a++) {
        const t = L.azs[r + a];
        const tile = this.box(3.1, 0.12, 4.2, '#26324a', t.clone());
        tile.userData = { kind: 'az', region: r, az: a }; this.pickables.push(tile); this.arch.add(tile); azMeshes.push(tile);
        this.label(`AZ ${r}${'abc'[a]}`, t.clone().add(new THREE.Vector3(0, 0.2, 2.35)), 'az');
      }
      this.regionMeta[r] = { plat, azMeshes, fire: [] };
    }
    // nodes
    for (const n of design.nodes) {
      const p = L.nodes[n.uid]; if (!p) continue;
      const c = COMPONENT[n.id];
      const scale = c.layer === 'compute' || c.layer === 'db' ? 1.05 : 0.9;
      const s = this.sprite(c.sprite, p, scale, { kind: 'node', uid: n.uid });
      this.arch.add(s);
      // count badge for multi-instance compute
      const count = n.id === 'ec2' ? n.cfg.count : n.id === 'asg' ? `${n.cfg.min}-${n.cfg.max}` : n.id === 'eks' ? `${n.cfg.nodesMin}n` : n.id === 'rds' && n.cfg.multiAZ ? 'M-AZ' : null;
      const lbl = this.label(c.name.replace(/ \(.*\)/, '') + (count ? ` ×${count}` : ''), p.clone().add(new THREE.Vector3(0, scale + 0.35, 0)), 'node' + (n.uid === selected ? ' sel' : ''));
      this.nodeObjs[n.uid] = { sprite: s, label: lbl, node: n };
      if (n.uid === selected) { const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 20), new THREE.MeshBasicMaterial({ color: '#ffe066', side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.copy(p).add(new THREE.Vector3(0, 0.05, 0)); this.arch.add(ring); }
    }
    // static wires
    this.wires = new THREE.Group(); this.arch.add(this.wires);
    this.drawWires();
    if (!keepCamera) this.fitArchitecture();
  }

  fitArchitecture() {
    const L = this.L;
    if (this.mode !== 'arch' || !L) return;
    const pts = [L.hacker, ...Object.values(L.users), ...Object.values(L.nodes)];
    for (const o of Object.values(L.regions)) {
      for (const [dx, dz] of [[-5.6, -5], [5.6, -5], [-5.6, 5], [5.6, 5]]) pts.push(o.clone().add(new THREE.Vector3(dx, 0, dz)));
    }
    this.fit(pts, this.insets({ left: 270, right: 410, top: 130, bottom: 30 }));
  }

  // entry points used for wires/packets
  pathFor(region, geo) {
    const L = this.L, d = this.design; if (!L) return null;
    const pts = [L.users[geo] || L.users.NA];
    const edge = d.nodes.find(n => COMPONENT[n.id].scope === 'global' && COMPONENT[n.id].layer === 'edge' && n.id !== 'route53') || d.nodes.find(n => n.id === 'route53');
    if (edge) pts.push(L.nodes[edge.uid]);
    const rn = d.nodes.filter(n => n.region === region);
    const lb = rn.find(n => ['lb', 'apigw'].includes(COMPONENT[n.id].kind));
    const comp = rn.find(n => COMPONENT[n.id].layer === 'compute');
    const cache = rn.find(n => COMPONENT[n.id].layer === 'cache');
    const db = rn.find(n => COMPONENT[n.id].layer === 'db') || d.nodes.find(n => COMPONENT[n.id].layer === 'db');
    const s3 = rn.find(n => n.id === 's3');
    for (const n of [lb, comp, cache, db]) if (n && L.nodes[n.uid]) pts.push(L.nodes[n.uid]);
    if (pts.length === 1 && s3) pts.push(L.nodes[s3.uid]);
    if (pts.length === 1) pts.push(L.regions[region]);
    return pts.map(p => p.clone().add(new THREE.Vector3(0, 0.6, 0)));
  }
  drawWires() {
    this.clearGroup(this.wires);
    const geos = Object.keys(this.job?.req?.geo || { NA: 1 });
    const mat = new THREE.LineBasicMaterial({ color: '#2f4b6e' });
    for (const r of this.design.regions) {
      if (!this.design.nodes.some(n => n.region === r)) continue;
      for (const g of geos) { const p = this.pathFor(r, g); if (p) this.wires.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), mat)); }
    }
  }

  highlight(kind) {
    for (const [r, m] of Object.entries(this.regionMeta)) {
      m.plat.material.emissive?.set(kind === 'region' ? '#16324a' : '#000000');
      for (const t of m.azMeshes) t.material.emissive?.set(kind === 'az' ? '#2a4a20' : '#000000');
    }
  }

  // ═════════════ live sim visualization ═════════════
  initPackets() {
    const MAX = 900;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: '#ffffff' }), MAX);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.count = 0; mesh.frustumCulled = false;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    this.scene.add(mesh);
    this.packets = { mesh, list: [], MAX, spawnAcc: 0 };
  }
  spawnPacket(points, color, speed = 1) {
    if (!points || points.length < 2) return;
    const P = this.packets; if (P.list.length >= P.MAX) return;
    P.list.push({ points, seg: 0, t: 0, color: new THREE.Color(color), speed: speed * (0.8 + Math.random() * 0.4), failAt: color === '#ff4d4d' ? 1 + Math.floor(Math.random() * (points.length - 1)) : 99 });
  }
  updatePackets(dt) {
    const P = this.packets, m = new THREE.Matrix4();
    let i = 0;
    P.list = P.list.filter(p => {
      p.t += dt * 2.2 * p.speed;
      while (p.t >= 1) { p.t -= 1; p.seg++; }
      return p.seg < Math.min(p.points.length - 1, p.failAt);
    });
    for (const p of P.list) {
      const a = p.points[p.seg], b = p.points[p.seg + 1];
      m.makeTranslation(a.x + (b.x - a.x) * p.t, a.y + (b.y - a.y) * p.t + Math.sin(p.t * Math.PI) * 0.3, a.z + (b.z - a.z) * p.t);
      P.mesh.setMatrixAt(i, m); P.mesh.setColorAt(i, p.color); i++;
    }
    P.mesh.count = i; P.mesh.instanceMatrix.needsUpdate = true; if (P.mesh.instanceColor) P.mesh.instanceColor.needsUpdate = true;
  }

  // Called each sim tick with metrics + sim state.
  showSim(sim, m) {
    if (this.mode !== 'arch' || !this.L) return;
    this.simView = { sim, m };
    // regions & AZ health
    for (const [r, meta] of Object.entries(this.regionMeta)) {
      const down = !!sim.regionDown[r] || sim.suspended;
      meta.plat.material.color.set(down ? '#4a1515' : '#1a2232');
      meta.azMeshes.forEach((t, a) => { const dn = down || sim.azDown[r][a] > sim.t; t.material.color.set(dn ? '#5c1a1a' : '#26324a'); });
      const wantFire = down ? 3 : sim.azDown[r].filter(v => v > sim.t).length;
      while (meta.fire.length < wantFire) {
        const a = sim.azDown[r].findIndex(v => v > sim.t);
        const pos = down ? this.L.regions[r].clone().add(new THREE.Vector3((meta.fire.length - 1) * 3, 0.3, 0)) : this.L.azs[r + Math.max(0, a)].clone();
        const f = this.sprite('fire', pos, 1.4); this.arch.add(f); meta.fire.push(f);
      }
      while (meta.fire.length > wantFire) { const f = meta.fire.pop(); this.arch.remove(f); }
    }
    this.hackerSprite.visible = m.attack > 0;
    // node visuals: dim failed ones
    for (const { sprite, node } of Object.values(this.nodeObjs)) {
      const rt = sim.rt[node.uid]; let bad = false;
      if (node.region && (sim.regionDown[node.region] || (node.az != null && sim.azDown[node.region][node.az] > sim.t))) bad = true;
      if (rt?.stuck) bad = true;
      sprite.material = spriteMaterial(COMPONENT[node.id].sprite, bad ? { color: 0x664444 } : {});
    }
  }

  spawnFromMetrics(dt) {
    const v = this.simView; if (!v) return;
    const { m, sim } = v;
    const P = this.packets;
    const rate = Math.min(40, 4 + Math.log10(Math.max(1, m.demand)) * 5) * (this.speed || 1);
    P.spawnAcc += rate * dt;
    const regions = Object.entries(m.regLoad || {});
    while (P.spawnAcc >= 1) {
      P.spawnAcc -= 1;
      if (!regions.length) continue;
      const [r, L] = regions[Math.floor(Math.random() * regions.length)];
      const geos = Object.keys(L.byGeo); const g = geos[Math.floor(Math.random() * geos.length)];
      const ok = Math.random() > m.errRate;
      this.spawnPacket(this.pathFor(r, g), ok ? '#5dff8a' : '#ff4d4d', 1);
    }
    if (m.attack > 0) {
      const n = Math.min(25, Math.log10(m.attack) * 4) * dt * (this.speed || 1);
      for (let i = 0; i < n + (Math.random() < n % 1 ? 1 : 0); i++) {
        const r = regions[Math.floor(Math.random() * Math.max(regions.length, 1))]?.[0] || this.design.regions[0];
        const p = this.pathFor(r, 'NA'); if (!p) continue;
        p[0] = this.L.hacker.clone().add(new THREE.Vector3(0, 0.6, 0));
        this.spawnPacket(p, '#ff9f1a', 1.4);
      }
    }
  }

  stopSim() { this.simView = null; this.packets.list = []; this.packets.mesh.count = 0; if (this.hackerSprite) this.hackerSprite.visible = false; }

  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    this.drive?.updateFrame(dt, this.aspect);
    if (this.drive) {
      this.renderer.render(this.drive.scene, this.drive.camera);
      return;
    }
    this.homeTick?.(dt);
    for (const s of this.bobbers) if (s.parent) s.position.y = s.userData.baseY + Math.sin(t * 2 + s.userData.phase) * 0.04;
    if (this.mode === 'arch') { this.spawnFromMetrics(dt); this.updatePackets(dt); }
    this.renderer.render(this.scene, this.camera);
    // project labels
    const v = new THREE.Vector3();
    for (const l of this.labels) {
      v.copy(l.pos).project(this.camera);
      const x = (v.x * 0.5 + 0.5) * this.viewW, y = (-v.y * 0.5 + 0.5) * this.viewH;
      l.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      l.el.style.display = v.z > 1 || x < -100 || x > this.viewW + 100 || (l.minZoom && this.zoom < l.minZoom) ? 'none' : '';
    }
  }
}

