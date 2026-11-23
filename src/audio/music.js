// Landing page loops one track. Every scene in the car loops the other.
const VOLUME = 0.62;
const FADE_SECONDS = 0.7;

const PLAYERS = {
  triumph: track('Triumph in the Key of C.mp3'),
  rising: track('Rising Across the Clouds.mp3'),
};

const SCREEN_TRACK = { title: 'triumph', drive: 'rising' };

let want = null;
let timer = 0;
let last = 0;

function track(file) {
  const audio = new Audio(new URL(`../music/${file}`, import.meta.url));
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = 0;
  return audio;
}

function ensurePlaying(audio) {
  if (!audio || !audio.paused) return;
  audio.play().then(() => fade()).catch(() => {});
}

// A click or key unlocks audio after the screen handler has chosen the track.
function onGesture() {
  if (want) ensurePlaying(PLAYERS[want]);
}
document.addEventListener('click', onGesture);
document.addEventListener('keydown', onGesture);

function fade() {
  if (timer) return;
  last = 0;
  timer = setTimeout(step, 50);
}

function step() {
  const now = performance.now();
  const elapsed = last ? Math.min(1, (now - last) / 1000) : 0;
  last = now;
  const amount = elapsed * (VOLUME / FADE_SECONDS);
  let again = false;
  for (const [id, audio] of Object.entries(PLAYERS)) {
    const active = id === want && !audio.paused;
    const target = active ? VOLUME : 0;
    if (audio.volume !== target) {
      if (amount > 0) {
        const next = audio.volume + Math.sign(target - audio.volume) * amount;
        audio.volume = target > audio.volume ? Math.min(target, next) : Math.max(target, next);
      }
      if (audio.volume !== target) again = true;
    }
    if (!active && audio.volume === 0 && !audio.paused) audio.pause();
  }
  timer = again ? setTimeout(step, 50) : 0;
  if (!timer) last = 0;
}

export function syncMusic(screen) {
  const next = SCREEN_TRACK[screen] ?? null;
  if (next === want) {
    if (want) ensurePlaying(PLAYERS[want]);
    return;
  }
  want = next;
  if (want) ensurePlaying(PLAYERS[want]);
  fade();
}
