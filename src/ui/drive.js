import './drive.css';
import { Cockpit } from '../render/cockpit.js';
import { DriveScene } from '../render/drive.js';
import { S, save } from '../core/state.js';
import { App, registerScreen } from './app.js';
import { $, h } from './dom.js';
import { sfx, loop, setLoopVolume, stopLoop } from '../audio/sfx.js';

const MONOLOGUE = [
  [0.2, 6.5, 'Three years at the call center. Same headset, same chair that sank every shift.'],
  [6.9, 13.5, '“Can you read me the code we sent?” I started hearing myself say it on the drive home.'],
  [14.1, 19.8, 'Today I quit. I left my badge on the desk. Fourteen calls still waiting.'],
  [20.4, 27.0, 'Twelve hundred dollars and a laptop. Mara’s couch comes with Wi-Fi, at least.'],
  [27.6, 34.9, 'I told Mara I wanted to build the stuff I spent all day apologizing for. She said she knew somebody.'],
  [35.6, 42.9, 'She left the garage open again. Okay. Let’s see who she had in mind.'],
];

const CREDITS = [
  ['Presented by', 'Party Chat Network'],
  ['', 'UPTIME'],
  ['Director', '92bricks'],
  ['Game Designer', '92bricks'],
  ['Programming', '92bricks'],
  ['Production', 'Party Chat Network'],
];

registerScreen('drive', {
  enter(root, { trip, onArrival }) {
    $('#hud').style.display = 'none';
    const drive = new DriveScene(trip);
    const parkTime = drive.parkTime;
    const cockpit = new Cockpit(h('canvas', { class: 'drive-cockpit', 'aria-hidden': 'true' }));
    const credits = !trip && h('div', { class: 'drive-credits' }, h('div', { class: 'drive-roll' },
      CREDITS.map(([role, name]) => h('div', { class: role ? 'drive-credit' : 'drive-credit drive-logo' },
        role ? h('span', {}, role) : null, h('strong', {}, name)))));
    const subtitle = h('p', { class: 'drive-subtitle', 'aria-live': 'polite', 'aria-atomic': 'true', hidden: true });
    const accelerator = h('button', { class: 'drive-accelerator', type: 'button' },
      h('kbd', {}, 'W'), h('span', {}, 'Hold to drive'));
    const fade = h('div', { class: 'drive-fade', 'aria-hidden': 'true' });
    const controls = h('div', { class: 'drive-controls' }, accelerator);
    const overlay = h('section', { class: 'drive-overlay', 'aria-label': 'Opening scene. Drive home.' },
      cockpit.canvas, credits, trip && h('div', { class: 'drive-trip' }, trip === 'market' ? 'Corner Market' : 'Home'),
      subtitle, controls, fade);
    root.append(overlay);

    const roll = credits && $('.drive-roll', credits);
    const input = new AbortController();
    const signal = input.signal;
    const keys = new Set();
    const pointers = new Set();
    let elapsed = 0;
    let parking = 0;
    let moving = false;
    let arrived = false;
    let currentLine;
    let wheel = 0;
    let engineTimer;
    const idleVolume = .09;
    const drivingVolume = .28;

    function updatePedal() {
      const pressed = elapsed < parkTime && (keys.size > 0 || pointers.size > 0);
      if (pressed === moving) return;
      moving = pressed;
      accelerator.classList.toggle('on', moving);
      setLoopVolume('engine_drive', moving ? drivingVolume : idleVolume, moving ? .35 : .55);
    }

    function release() {
      keys.clear();
      pointers.clear();
      updatePedal();
    }

    function driveKey(event) {
      if (event.code === 'KeyW' || event.code === 'ArrowUp') return event.code;
      if (event.target === accelerator && (event.code === 'Space' || event.code === 'Enter')) return event.code;
      return null;
    }

    window.addEventListener('keydown', event => {
      const key = driveKey(event);
      if (!key) return;
      event.preventDefault();
      if (event.repeat || elapsed >= parkTime) return;
      keys.add(key);
      updatePedal();
    }, { signal });
    window.addEventListener('keyup', event => {
      if (keys.delete(event.code)) updatePedal();
    }, { signal });
    window.addEventListener('blur', release, { signal });
    document.addEventListener('visibilitychange', () => { if (document.hidden) release(); }, { signal });

    accelerator.addEventListener('pointerdown', event => {
      if (event.button !== 0 || elapsed >= parkTime) return;
      event.preventDefault();
      accelerator.setPointerCapture(event.pointerId);
      pointers.add(event.pointerId);
      updatePedal();
    }, { signal });
    for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      accelerator.addEventListener(eventName, event => {
        if (pointers.delete(event.pointerId)) updatePedal();
      }, { signal });
    }
    accelerator.addEventListener('blur', () => {
      keys.delete('Space');
      keys.delete('Enter');
      updatePedal();
    }, { signal });

    drive.updateFrame = (dt, aspect) => {
      if (moving) elapsed = Math.min(elapsed + dt, parkTime);
      const parked = elapsed >= parkTime;
      if (parked && !arrived) {
        parking += dt;
        const stayParked = trip === 'market';
        if (parking >= (stayParked ? 0.65 : 1.45)) {
          arrived = true;
          if (!trip) { delete S.flags.drivePending; save(); }
          clearTimeout(ignitionTimer);
          clearTimeout(engineTimer);
          stopLoop('engine_drive', .65);
          sfx('car_park');
          onArrival();
          return;
        }
        release();
        if (trip) controls.hidden = true;
        if (!stayParked) fade.style.opacity = Math.min(1, Math.max(0, (parking - 0.4) / 0.8));
      }

      if (!trip) {
        const line = MONOLOGUE.find(([start, end]) => elapsed >= start && elapsed < end);
        if (line !== currentLine) {
          currentLine = line;
          subtitle.textContent = line?.[2] ?? '';
          subtitle.hidden = !line;
        }
        const creditProgress = Math.min(elapsed / 39, 1);
        const creditOffset = credits.clientHeight * (0.66 - 0.74 * creditProgress) - roll.offsetHeight * creditProgress;
        roll.style.transform = `translateY(${creditOffset}px)`;
      }
      const speed = drive.update(elapsed, moving, aspect);
      const steering = Math.sin(elapsed * 0.48) * 0.035 + 0.48 * Math.exp(-((elapsed - drive.roadTime - 1.5) ** 2) / 1.4);
      wheel += (steering - wheel) * Math.min(1, dt * 9);
      cockpit.draw(speed, wheel, parked);
    };

    App.world.setDrive(drive);
    if (trip) sfx('car_door');
    const ignitionTimer = setTimeout(() => {
      sfx('engine_start');
      engineTimer = setTimeout(() => loop('engine_drive', moving ? drivingVolume : idleVolume, .65), 950);
    }, trip ? 550 : 0);
    this.cleanup = () => {
      clearTimeout(ignitionTimer);
      clearTimeout(engineTimer);
      input.abort();
      drive.dispose();
    };
  },
  leave() {
    App.world.setDrive(null);
    stopLoop('engine_drive', 0.4);
    this.cleanup?.();
    this.cleanup = null;
    $('#hud').style.display = '';
  },
});
