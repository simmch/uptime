import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

let testNumber = 0;

async function setup(ignoreVolume) {
  const tracks = [];
  globalThis.document = new EventTarget();
  document.hidden = false;
  globalThis.window = new EventTarget();
  globalThis.Audio = class {
    constructor(url) {
      this.name = url ? decodeURIComponent(url.pathname.split('/').at(-1)) : null;
      this.paused = true;
      this.level = 1;
      this.blocked = false;
      if (this.name) tracks.push(this);
    }
    get volume() { return this.level; }
    set volume(value) { if (!ignoreVolume(this.name)) this.level = value; }
    play() {
      if (this.blocked) return Promise.reject(new Error('Autoplay is blocked'));
      if (this.delayPlayback) return new Promise(resolve => {
        // Simulate a browser fulfilling play after the target scene has already changed.
        this.completePlayback = () => { this.paused = false; resolve(); };
      });
      this.paused = false;
      return Promise.resolve();
    }
    pause() { this.paused = true; }
  };
  const music = await import(`../src/audio/music.js?case=${++testNumber}`);
  const [title, drive, home, lobby] = tracks;
  return { ...music, title, drive, home, lobby };
}

// A volume probe may succeed even if source-backed audio ignores volume changes.
const mobile = await setup(name => Boolean(name));
mobile.syncMusic('title');
assert.equal(mobile.title.paused, false);
mobile.drive.blocked = true;
mobile.syncMusic('drive');
assert.equal(mobile.title.paused, true);
assert.equal(mobile.drive.paused, true);
await delay(0);
mobile.drive.blocked = false;
document.dispatchEvent(new Event('touchend'));
assert.equal(mobile.drive.paused, false);
mobile.home.blocked = true;
mobile.syncMusic('office');
assert.equal(mobile.drive.paused, true);
assert.equal(mobile.home.paused, true);
await delay(0);
mobile.home.blocked = false;
document.dispatchEvent(new Event('touchend'));
assert.equal(mobile.home.paused, false);
mobile.setAtComputer(true);
assert.equal(mobile.lobby.paused, false);
await delay(800);
assert.equal(mobile.home.paused, true, 'a fade must end even with fixed media volume');
window.dispatchEvent(new Event('pagehide'));
assert.equal(mobile.lobby.paused, true);
document.dispatchEvent(new Event('touchend'));
assert.equal(mobile.lobby.paused, true);
window.dispatchEvent(new Event('pageshow'));
assert.equal(mobile.lobby.paused, false);
window.dispatchEvent(new Event('pagehide'));

const delayed = await setup(() => true);
delayed.title.delayPlayback = true;
delayed.syncMusic('title');
delayed.syncMusic('drive');
delayed.title.completePlayback();
await delay(0);
assert.equal(delayed.title.paused, true, 'a departed track cannot resume after a late play');
assert.equal(delayed.drive.paused, false);
delayed.syncMusic('office');
assert.equal(delayed.drive.paused, true);
assert.equal(delayed.home.paused, false);
document.hidden = true;
document.dispatchEvent(new Event('visibilitychange'));
assert.equal(delayed.home.paused, true);

const desktop = await setup(() => false);
desktop.syncMusic('office');
await delay(800);
assert.equal(desktop.home.volume, 0.62);
desktop.setAtComputer(true);
await delay(800);
assert.equal(desktop.home.paused, true);
assert.equal(desktop.lobby.volume, 0.62);
desktop.syncMusic('build');
await delay(800);
assert.equal(desktop.lobby.paused, true);

console.log('Music handoff passed on fixed-volume, delayed-play, and fading audio players.');
