import { S, load, save } from '../core/state.js';
import { emit } from '../core/events.js';

const KEY = 'uptime_audio_preferences';
const DEFAULTS = { master: 100, music: 100, effects: 100, muted: false, musicMuted: false, effectsMuted: false };
const LEVELS = ['master', 'music', 'effects'];
const MUTES = ['muted', 'musicMuted', 'effectsMuted'];

function restore() {
  const settings = { ...DEFAULTS, effectsMuted: load()?.settings?.sound === false };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    for (const key of LEVELS) {
      if (Number.isFinite(saved?.[key])) settings[key] = Math.round(Math.max(0, Math.min(100, saved[key])));
    }
    for (const key of MUTES) if (typeof saved?.[key] === 'boolean') settings[key] = saved[key];
  } catch { /* Storage may be unavailable. */ }
  return settings;
}

let settings = restore();

export function audioSettings() { return { ...settings }; }

export function audioLevel(channel) {
  if (settings.muted || settings[channel + 'Muted']) return 0;
  return settings.master * settings[channel] / 10000;
}

export function setAudioSettings(changes) {
  const next = { ...settings };
  for (const key of LEVELS) {
    if (Number.isFinite(changes[key])) next[key] = Math.round(Math.max(0, Math.min(100, changes[key])));
  }
  for (const key of MUTES) if (typeof changes[key] === 'boolean') next[key] = changes[key];
  settings = next;
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* Storage may be unavailable. */ }
  if (S && typeof changes.effectsMuted === 'boolean') {
    (S.settings ??= {}).sound = !settings.effectsMuted;
    save();
  }
  emit('audioSettings');
}

export function resetAudioSettings() { setAudioSettings(DEFAULTS); }
