// Landing, driving, walking, the job board, and contract work each loop their own track.
import { audioLevel } from './preferences.js';
import { on } from '../core/events.js';
const VOLUME = 0.62;
const FADE_MS = 700;
const sceneLevels = new Map();
const gains = new Map();
let mixer;

// Some mobile browsers ignore media volume changes. Playback still has to stop
// on time even if this probe succeeds and a real track ignores the same writes.
const CAN_FADE = (() => {
  const probe = new Audio();
  setVolume(probe, 0.5);
  return Math.abs(probe.volume - 0.5) < 0.01;
})();

const PLAYERS = {
  triumph: track('Triumph in the Key of C.mp3'),
  rising: track('Rising Across the Clouds.mp3'),
  lounge: track('Smooth Lounge Loop.mp3'),
  lobby: track('Lobby Loop.mp3'),
  hook: track('Warm Analog Hook.mp3'),
  pads: track('Warm Analog Pads.mp3'),
  groove: track('Warm Analog Groove.mp3'),
};

const SCREEN_TRACK = { title: 'triumph', drive: 'rising', office: 'lounge' };
const WORK_TRACKS = ['hook', 'pads', 'groove'];
const WORK_SCREENS = new Set(['build', 'run']);
const INTRO_TRACKS = new Set(['triumph', 'rising']);
const pending = new Map();

let want = null;
let screen = null;
let atComputer = false;
let atWork = false;
let workTrack = null;
let pageActive = true;
let timer;

function track(file) {
  const audio = new Audio(new URL(`../music/${file}`, import.meta.url));
  audio.loop = true;
  audio.preload = 'auto';
  applyLevel(audio, 0);
  return audio;
}

function setVolume(audio, volume) {
  try { audio.volume = volume; } catch { /* This browser controls media volume. */ }
}

function applyLevel(audio, volume) {
  sceneLevels.set(audio, volume);
  const preference = audioLevel('music');
  const level = volume * preference;
  audio.muted = preference === 0;
  const gain = gains.get(audio);
  if (gain) gain.gain.value = level;
  else setVolume(audio, level);
}

function wakeMixer() {
  if (!mixer) {
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    if (AudioEngine) {
      try { mixer = new AudioEngine(); } catch { /* Keep media-element playback as a fallback. */ }
    }
  }
  if (mixer && mixer.state !== 'running') mixer.resume().catch(() => {});
}

function connectTrack(audio) {
  if (!mixer || gains.has(audio)) return;
  try {
    const gain = mixer.createGain();
    const source = mixer.createMediaElementSource(audio);
    source.connect(gain).connect(mixer.destination);
    gains.set(audio, gain);
    setVolume(audio, 1);
    applyLevel(audio, sceneLevels.get(audio));
  } catch { /* Keep media-element playback as a fallback. */ }
}

function stop(audio) {
  pending.delete(audio);
  // Cancel pending play() calls too, even when the element still reports paused.
  audio.pause();
  applyLevel(audio, 0);
}

const canPlay = () => pageActive && !document.hidden;

function ensurePlaying(fromGesture = false) {
  const audio = PLAYERS[want];
  if (!audio || !canPlay()) return;
  if (fromGesture) wakeMixer();
  connectTrack(audio);
  if (!audio.paused || (!fromGesture && pending.has(audio))) return;
  const request = audio.play();
  pending.set(audio, request);
  request.then(() => {
    if (PLAYERS[want] !== audio || !canPlay()) stop(audio);
  }, () => {
    // Mobile browsers may require a touch before starting the new track.
  }).finally(() => {
    if (pending.get(audio) === request) pending.delete(audio);
  });
}

function fade() {
  clearTimeout(timer);
  if (!canPlay()) return;
  if (!CAN_FADE && !mixer) {
    if (want) applyLevel(PLAYERS[want], VOLUME);
    return;
  }
  const start = performance.now();
  const volumes = Object.entries(PLAYERS).map(([id, audio]) => ({
    id, audio, from: sceneLevels.get(audio), target: id === want ? VOLUME : 0,
  }));

  function step() {
    const progress = Math.min(1, (performance.now() - start) / FADE_MS);
    for (const { id, audio, from, target } of volumes) {
      if (progress === 1 && id !== want) stop(audio);
      else applyLevel(audio, from + (target - from) * progress);
    }
    if (progress < 1) timer = setTimeout(step, 50);
  }

  timer = setTimeout(step, 50);
}

function stopAll() {
  clearTimeout(timer);
  for (const audio of Object.values(PLAYERS)) stop(audio);
}

function resumeMusic() {
  if (!canPlay()) return;
  ensurePlaying();
  fade();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopAll();
  else resumeMusic();
});
window.addEventListener('pagehide', () => { pageActive = false; stopAll(); });
window.addEventListener('pageshow', () => { pageActive = true; resumeMusic(); });

// A click, touch, or key unlocks audio once the destination scene is active.
function onGesture() { ensurePlaying(true); }
document.addEventListener('click', onGesture);
document.addEventListener('touchend', onGesture, { passive: true });
document.addEventListener('keydown', onGesture);

function choose(name) {
  const working = WORK_SCREENS.has(name) || atWork;
  if (working) {
    workTrack ||= WORK_TRACKS[Math.floor(Math.random() * WORK_TRACKS.length)];
    return workTrack;
  }
  workTrack = null;
  if (name === 'office' && atComputer) return 'lobby';
  return SCREEN_TRACK[name] ?? null;
}

function play(next) {
  if (next !== want) {
    want = next;
    for (const [id, audio] of Object.entries(PLAYERS)) {
      if (id !== want && (INTRO_TRACKS.has(id) || (!CAN_FADE && !mixer) || !canPlay() || pending.has(audio))) stop(audio);
    }
    fade();
  }
  ensurePlaying();
}

export function syncMusic(name) {
  screen = name;
  if (name !== 'office') atComputer = false;
  if (!WORK_SCREENS.has(name)) atWork = false;
  play(choose(name));
}

// Labs stay on the house screen. Closing one returns to the walking track.
export function setAtWork(on) {
  atWork = !!on;
  play(choose(screen));
}

// The work computer is a window over the house. Closing it returns to the walking track.
export function setAtComputer(on) {
  atComputer = !!on;
  if (screen === 'office') play(choose('office'));
}

on('audioSettings', () => {
  for (const [audio, volume] of sceneLevels) applyLevel(audio, volume);
});
