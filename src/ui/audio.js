import { h, modal } from './dom.js';
import { audioSettings, resetAudioSettings, setAudioSettings } from '../audio/preferences.js';

export function openAudioSettings() {
  const levels = [];
  const toggles = [];
  function volume(key, name) {
    const value = h('output');
    const slider = h('input', {
      type: 'range', min: 0, max: 100, step: 1, 'aria-label': name,
      oninput: event => { setAudioSettings({ [key]: Number(event.target.value) }); refresh(); },
    });
    levels.push({ key, slider, value });
    return h('label', { class: 'audio-control' },
      h('span', { class: 'row between' }, name, value), slider);
  }
  function mute(key, name) {
    const button = h('button', { type: 'button', class: 'btn ghost', onclick: () => {
      setAudioSettings({ [key]: !audioSettings()[key] });
      refresh();
    } });
    toggles.push({ key, name, button });
    return button;
  }
  function refresh() {
    const settings = audioSettings();
    for (const { key, slider, value } of levels) {
      slider.value = settings[key];
      value.textContent = settings[key] + '%';
    }
    for (const { key, name, button } of toggles) {
      button.textContent = settings[key] ? 'Unmute ' + name : 'Mute ' + name;
      button.setAttribute('aria-pressed', String(settings[key]));
    }
  }
  const panel = h('div', { class: 'audio-settings' },
    volume('master', 'Master volume'), volume('music', 'Music volume'), volume('effects', 'Sound effects volume'),
    h('div', { class: 'row wrap gap' }, mute('muted', 'all audio'), mute('musicMuted', 'music'), mute('effectsMuted', 'effects')),
    h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn ghost', onclick: () => { resetAudioSettings(); refresh(); } }, 'Reset audio')));
  refresh();
  return modal(panel, { title: 'Audio settings' });
}
