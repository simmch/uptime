// Sound effects (generated with ElevenLabs Sound Effects v3).
// Files live in src/sound_effects/<name>.mp3. Web Audio for low latency;
// long clips are faded out at `max` seconds so they work as short cues.
import { S, load as loadSave } from '../core/state.js';
import { on } from '../core/events.js';

const files = import.meta.glob('../sound_effects/*.mp3', { eager: true, query: '?url', import: 'default' });
const URLS = Object.fromEntries(Object.entries(files).map(([path, url]) => [path.split('/').pop().replace(/\.mp3$/, ''), url]));

// vol: 0..1 · max: seconds before fade-out · gap: ms minimum between repeats · jitter: random pitch range
const MIX = {
  ui_click: { vol: 0.26, max: 0.18, gap: 40, trim: true }, ui_open: { vol: 0.24, max: 0.7 }, ui_close: { vol: 0.20, max: 0.6 },
  ui_error: { vol: 0.34, max: 0.85, gap: 220 }, text_blip: { vol: 0.08, max: 0.09, gap: 78, jitter: 0.12, trim: true },
  coin_gain: { vol: 0.42, gap: 250 }, cash_spend: { vol: 0.36, max: 1.6, gap: 400 }, rent_due: { vol: 0.5 },
  level_up: { vol: 0.6 }, skill_learn: { vol: 0.5 }, cert_pass: { vol: 0.6 }, fail_jingle: { vol: 0.5 },
  answer_right: { vol: 0.42, max: 1.4 }, answer_wrong: { vol: 0.42 }, job_accept: { vol: 0.55, max: 1.2 },
  new_day: { vol: 0.42, gap: 1500 },
  place_component: { vol: 0.5, max: 1.5 }, remove_component: { vol: 0.42, max: 1.3 }, deploy: { vol: 0.55, max: 4 },
  incident_alert: { vol: 0.45, max: 2.2, gap: 1500 }, attack_glitch: { vol: 0.42, gap: 1500 },
  breach_siren: { vol: 0.48, max: 3, gap: 3000 }, outage: { vol: 0.55, max: 4, gap: 4000 }, recovery: { vol: 0.42, gap: 1200 },
  action_typing: { vol: 0.45, max: 2 }, victory: { vol: 0.6 }, suspended: { vol: 0.6 },
  chapter_hit: { vol: 0.6, max: 4 }, null_glitch: { vol: 0.42, max: 2.5, gap: 2500 }, email_ping: { vol: 0.5 },
  key_press: { vol: 0.14, max: 0.14, gap: 35, jitter: 0.2, trim: true }, terminal_success: { vol: 0.5 }, game_start: { vol: 0.5, max: 4.5 },
  footstep: { vol: 0.25, max: 0.28, gap: 230, jitter: 0.18, trim: true },
  eat: { vol: 0.5, max: 3 }, sleep: { vol: 0.5, max: 4 }, toilet: { vol: 0.45, max: 5 }, shower: { vol: 0.4, max: 4.5 },
  tv_on: { vol: 0.45, max: 3 }, car_door: { vol: 0.5, max: 2.8 }, engine_start: { vol: 0.5, max: 4 }, car_park: { vol: 0.5, max: 4 },
  phone_buzz: { vol: 0.45, max: 1.6 }, phone_open: { vol: 0.4, max: 1.2 }, post_like: { vol: 0.45 },
  grocery_bag: { vol: 0.5, max: 2 }, party: { vol: 0.4, max: 7 }, decor_place: { vol: 0.5, max: 2 },
};

const MASTER_VOLUME = 0.82;
const CUE_START_LIMIT = 850;
const COMMON = ['ui_click', 'ui_open', 'ui_close', 'ui_error', 'text_blip', 'footstep', 'phone_open', 'engine_start', 'engine_drive'];
const LIFE_CUES = {
  eat: 'eat', pantry: 'eat', toilet: 'toilet', shower: 'shower', sleep: 'sleep',
  groceries: 'grocery_bag', post: 'post_like', decorate: 'decor_place', party: 'party', socialNews: 'email_ping',
};
const savedPreference = loadSave()?.settings?.sound;
const buffers = new Map();
const pending = new Map();
const last = new Map();
const loops = new Map();
const offsets = new WeakMap();

let ctx, master, masterTarget;
let muteVersion = 0;
let warmed = false;

export const soundOn = () => (S ? S.settings?.sound : savedPreference) !== false;

function syncMaster() {
  if (!master) return;
  const target = soundOn() && !document.hidden ? MASTER_VOLUME : 0;
  if (target === masterTarget) return;
  masterTarget = target;
  muteVersion++;
  const gain = master.gain;
  gain.cancelScheduledValues(ctx.currentTime);
  gain.setTargetAtTime(target, ctx.currentTime, .018);
}

function context() {
  if (ctx) return ctx;
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  if (!AudioEngine || navigator.userActivation?.hasBeenActive === false) return null;
  try { ctx = new AudioEngine(); } catch { return null; }
  master = ctx.createGain();
  masterTarget = soundOn() && !document.hidden ? MASTER_VOLUME : 0;
  master.gain.value = masterTarget;
  master.connect(ctx.destination);
  return ctx;
}

function wake(audio) {
  return audio.state === 'running' ? Promise.resolve(true)
    : audio.resume().then(() => audio.state === 'running', () => false);
}

function loadClip(name, audio) {
  if (buffers.has(name)) return Promise.resolve(buffers.get(name));
  if (!pending.has(name)) {
    const request = fetch(URLS[name]).then(response => {
      if (!response.ok) throw Error(`Sound effect unavailable: ${name}`);
      return response.arrayBuffer();
    }).then(data => audio.decodeAudioData(data)).then(buffer => {
      buffers.set(name, buffer);
      return buffer;
    }).catch(() => null).finally(() => pending.delete(name));
    pending.set(name, request);
  }
  return pending.get(name);
}

function cueOffset(buffer) {
  if (!offsets.has(buffer)) {
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
    const limit = Math.min(buffer.length, Math.floor(buffer.sampleRate * 2));
    let peak = 0;
    for (const channel of channels) for (let i = 0; i < limit; i++) peak = Math.max(peak, Math.abs(channel[i]));
    const threshold = Math.min(.03, peak * .2);
    let sample = 0;
    while (sample < limit && channels.every(channel => Math.abs(channel[sample]) < threshold)) sample++;
    offsets.set(buffer, sample === limit ? 0 : Math.max(0, sample / buffer.sampleRate - .01));
  }
  return offsets.get(buffer);
}

export function sfx(name, opts = {}) {
  if (!soundOn() || document.hidden || !URLS[name]) return;
  const settings = MIX[name] || {};
  const requestedAt = performance.now();
  const gap = opts.gap ?? settings.gap ?? 45;
  if (requestedAt - (last.get(name) ?? -Infinity) < gap) return;
  const audio = context();
  if (!audio) return;
  last.set(name, requestedAt);
  const version = muteVersion;
  Promise.all([loadClip(name, audio), wake(audio)]).then(([buffer, running]) => {
    if (!buffer || !running || version !== muteVersion || !soundOn() || document.hidden ||
        performance.now() - requestedAt > CUE_START_LIMIT) return;
    const source = audio.createBufferSource();
    const gain = audio.createGain();
    const variation = opts.jitter ?? settings.jitter ?? 0;
    source.buffer = buffer;
    source.playbackRate.value = (opts.rate ?? 1) * (1 + (Math.random() - .5) * variation);
    const volume = opts.vol ?? settings.vol ?? .45;
    gain.gain.value = volume;
    source.connect(gain).connect(master);
    source.onended = () => { source.disconnect(); gain.disconnect(); };

    const now = audio.currentTime;
    const duration = opts.max ?? settings.max;
    const offset = settings.trim ? cueOffset(buffer) : 0;
    source.start(now, offset);
    if (duration && duration < (buffer.duration - offset) / source.playbackRate.value) {
      const tail = Math.min(.22, duration * .32);
      gain.gain.setValueAtTime(volume, now + duration - tail);
      gain.gain.linearRampToValueAtTime(0, now + duration);
      source.stop(now + duration);
    }
  });
}

function fadeGain(param, target, seconds) {
  const now = ctx.currentTime;
  if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
  else {
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
  }
  param.linearRampToValueAtTime(target, now + seconds);
}

// Loop gains follow their scene. Muting uses the separate sound-effects master.
export function loop(name, volume = .3, fade = .8) {
  if (!URLS[name]) return;
  if (loops.has(name)) { setLoopVolume(name, volume, fade); return; }
  const audio = context();
  if (!audio) return;
  const entry = { gain: audio.createGain(), source: null, volume };
  entry.gain.gain.value = 0;
  entry.gain.connect(master);
  loops.set(name, entry);
  void wake(audio);
  loadClip(name, audio).then(buffer => {
    if (loops.get(name) !== entry) return;
    if (!buffer) { stopLoop(name, 0); return; }
    const source = entry.source = audio.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    if (buffer.duration > .6) {
      source.loopStart = .15;
      source.loopEnd = buffer.duration - .15;
    }
    source.connect(entry.gain);
    source.onended = () => { source.disconnect(); entry.gain.disconnect(); };
    source.start();
    setLoopVolume(name, entry.volume, fade);
  });
}

export function setLoopVolume(name, volume, fade = .4) {
  const entry = loops.get(name);
  if (!entry) return;
  entry.volume = volume;
  if (entry.source) fadeGain(entry.gain.gain, volume, fade);
}

export function stopLoop(name, fade = .6) {
  const entry = loops.get(name);
  if (!entry) return;
  loops.delete(name);
  if (!entry.source) { entry.gain.disconnect(); return; }
  fadeGain(entry.gain.gain, 0, fade);
  entry.source.stop(ctx.currentTime + fade);
}

export function toggleSound() {
  const settings = S.settings ??= {};
  settings.sound = !soundOn();
  syncMaster();
  return settings.sound;
}

function warm() {
  if (!soundOn()) return;
  const audio = context();
  if (!audio) return;
  void wake(audio);
  if (warmed) return;
  warmed = true;
  for (const name of COMMON) if (URLS[name]) void loadClip(name, audio);
}

document.addEventListener('pointerdown', warm, { capture: true });
document.addEventListener('pointerup', warm, { capture: true });
document.addEventListener('keydown', warm, { capture: true });
document.addEventListener('visibilitychange', syncMaster);
document.addEventListener('click', event => {
  const button = event.target.closest?.('button');
  if (button && !button.matches(':disabled') && button.dataset.sfx !== 'none') sfx('ui_click');
}, { capture: true });
document.addEventListener('change', event => {
  if (event.target.matches?.('select, input[type="checkbox"], input[type="radio"]')) sfx('ui_click');
});

on('life', action => { if (LIFE_CUES[action]) sfx(LIFE_CUES[action]); });
on('money', ({ delta, reason } = {}) => {
  if (!delta || /^(Infrastructure|Rent)/.test(reason || '')) return;
  if (delta > 0) sfx('coin_gain');
  else if (!/^Course:/.test(reason || '')) sfx('cash_spend');
});
on('levelup', () => setTimeout(() => sfx('level_up'), 150));
on('skill', () => sfx('skill_learn'));
on('rentEvents', (events = []) => {
  if (events.some(event => event.type === 'rent')) setTimeout(() => sfx('rent_due'), 300);
});
let lastDay = null;
on('state', () => {
  syncMaster();
  if (!S) return;
  const lastResult = Math.max(last.get('victory') ?? -Infinity, last.get('fail_jingle') ?? -Infinity);
  if (lastDay != null && S.day > lastDay && performance.now() - lastResult > 4000) sfx('new_day');
  lastDay = S.day;
});

export function gradeSound(grade) {
  if (grade === 'S' || grade === 'A') sfx('victory');
  else if (grade === 'F') sfx('fail_jingle');
  else sfx('answer_right');
}
