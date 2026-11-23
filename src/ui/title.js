// Title screen, intro and endings.
import { h, $, money } from './dom.js';
import './rooftop.css';
import { startRooftop } from '../render/rooftop.js';
import { App, registerScreen, show, renderHUD, runStory, dialogue } from './app.js';
import { S, setState, newState, load, save, wipe, title as titleOf, xpForLevel } from '../core/state.js';
import { ENDINGS } from '../data/story.js';

registerScreen('title', {
  enter(root) {
    $('#hud').style.display = 'none';
    const saved = load();
    const name = h('input', { class: 'txt', placeholder: 'Your name', 'aria-label': 'Your character’s name',
      value: saved?.name || '', maxlength: 18 });
    const canvas = h('canvas', { class: 'rooftop-canvas', 'aria-hidden': 'true' });
    const thought = h('p', { class: 'rooftop-thought' });
    const newGame = h('form', { onsubmit: event => {
      event.preventDefault();
      if (saved && !confirm('Start a new game? Your current save will be replaced.')) return;
      wipe();
      const player = newState(name.value.trim() || 'Chris');
      player.flags.drivePending = true;
      setState(player);
      save();
      startGame();
    } }, name, h('button', { class: 'btn big', type: 'submit' }, 'New game'));
    root.append(h('main', { class: 'rooftop-title', 'aria-labelledby': 'game-logo' },
      canvas,
      h('div', { class: 'rooftop-heading' },
        h('h1', { class: 'rooftop-logo', id: 'game-logo' }, 'UPTIME'),
        h('p', { class: 'rooftop-tagline' }, 'a cloud architect’s story')),
      thought,
      h('div', { class: 'rooftop-menu' },
        saved && h('button', { class: 'btn ghost big', type: 'button', onclick: () => { setState(saved); startGame(); } },
          `Continue — ${saved.name}, day ${saved.day}`),
        newGame)));
    this.stopRooftop = startRooftop(canvas, thought);
  },
  leave() {
    this.stopRooftop?.();
    this.stopRooftop = null;
    $('#hud').style.display = '';
  },
});

function startGame() {
  if (S.flags?.drivePending) return show('drive', { onArrival: startGame });
  show('office');
  renderHUD();
  runStory();
}

registerScreen('ending', {
  enter(root) {
    App.world.buildOffice(S);
    root.append(h('div', { class: 'ending-choice panel' },
      h('h2', {}, 'The Signal is at peak.'),
      h('p', {}, 'Two million people are watching. Devon\'s finger is on the kill switch for Axiom\'s control plane. Everything they host — payments, shipping, hospitals — goes dark if you say so.'),
      h('div', { class: 'row gap center' },
        h('button', { class: 'btn big', onclick: () => end('expose') }, 'Broadcast the truth'),
        h('button', { class: 'btn big danger', onclick: () => end('burn') }, 'Pull the plug'))));
    async function end(which) {
      root.innerHTML = '';
      S.ending = which; save();
      const E = ENDINGS[which];
      await dialogue(E.lines);
      root.append(h('div', { class: 'credits panel' },
        h('h1', {}, E.title),
        h('p', {}, `${S.name} — ${titleOf()}`),
        h('div', { class: 'grid2' }, h('div', {}, `Level ${S.level}`), h('div', {}, `Day ${S.day}`), h('div', {}, `Earned ${money(S.stats.earned)}`), h('div', {}, `Contracts ${S.stats.jobs}`), h('div', {}, `Certifications ${S.certs.length}`), h('div', {}, `Skills ${S.skills.length}`)),
        h('p', { class: 'muted' }, 'Everything you used to win is real. VPCs, Multi-AZ, Aurora Global, Kubernetes, Terraform, WAF, SCPs, the 7 Rs. Go build things — the good kind.'),
        h('div', { class: 'row gap center' },
          h('button', { class: 'btn big', onclick: () => newGamePlus() }, 'New Game+ (keep skills & certs)'),
          h('button', { class: 'btn ghost', onclick: () => location.reload() }, 'Title'))));
    }
  },
});

function newGamePlus() {
  const keep = { skills: S.skills, certs: S.certs, codexRead: S.codexRead, name: S.name, domainXP: S.domainXP };
  const s = newState(keep.name);
  const lvl = Math.max(1, Math.floor(S.level / 2));
  Object.assign(s, keep, { level: lvl, xp: xpForLevel(lvl), sp: 3, money: 5000, flags: { ngplus: true } });
  setState(s); save(); location.reload();
}
