// Title screen, intro and endings.
import { h, $, money, toast, confirmBox } from './dom.js';
import './rooftop.css';
import { openAudioSettings } from './audio.js';
import { startRooftop } from '../render/rooftop.js';
import { App, registerScreen, show, renderHUD, runStory, dialogue } from './app.js';
import { S, setState, newState, save, wipe, title as titleOf, xpForLevel } from '../core/state.js';
import { openAccount } from './account.js';
import { signedInEmail, userId, pushCloud, accountError } from '../auth/cloud.js';
import { ENDINGS } from '../data/story.js';
import { sfx } from '../audio/sfx.js';

registerScreen('title', {
  enter(root) {
    $('#hud').style.display = 'none';
    const who = signedInEmail();
    const held = Boolean(who && S?.owner === userId());
    const unsaved = Boolean(S && !held);
    const name = h('input', { class: 'txt', placeholder: 'Your name', 'aria-label': 'Your character’s name',
      value: S?.name || '', maxlength: 18 });
    const canvas = h('canvas', { class: 'rooftop-canvas', 'aria-hidden': 'true' });
    const thought = h('p', { class: 'rooftop-thought' });
    const newGame = h('form', { onsubmit: async event => {
      event.preventDefault();
      if (S) {
        const ok = await confirmBox(who
          ? 'Start a new game? The save on your account is replaced.'
          : 'Start a new game? The one in this tab is dropped.', { ok: 'New game' });
        if (!ok) return;
      }
      wipe();
      const player = newState(name.value.trim() || 'Chris');
      player.flags.drivePending = true;
      if (who) player.owner = userId();
      setState(player);
      save({ remote: false });
      if (who) {
        try { await pushCloud(); }
        catch (error) { toast(accountError(error), 'bad'); return; }
      }
      startGame();
    } }, name, h('button', { class: 'btn big' + ((held || unsaved) ? ' ghost' : ''), type: 'submit' }, 'New game'));
    const note = held
      ? h('p', { class: 'save-note' }, `${S.name} · day ${S.day} · level ${S.level}`, h('br'), `Saved to ${who}`)
      : unsaved
        ? h('p', { class: 'save-note' }, `${S.name} · day ${S.day} · level ${S.level}`, h('br'), who ? 'Not on your account yet.' : 'Not saved yet. Create an account to keep it.')
        : h('p', { class: 'save-note' }, who
          ? `Signed in as ${who}. A new game is saved to that account.`
          : 'An account is how you save. Play now and create one later, or leave and the progress is gone.');
    root.append(h('main', { class: 'rooftop-title', 'aria-labelledby': 'game-logo' },
      canvas,
      h('div', { class: 'rooftop-heading' },
        h('h1', { class: 'rooftop-logo', id: 'game-logo' }, 'UPTIME'),
        h('p', { class: 'rooftop-tagline' }, 'a cloud architect’s story')),
      thought,
      h('div', { class: 'rooftop-menu' },
        (held || unsaved) && h('button', { class: 'btn big', type: 'button', onclick: () => startGame() }, 'Continue'),
        note,
        newGame,
        who
          ? h('button', { class: 'btn' + (unsaved ? '' : ' ghost'), type: 'button', onclick: () => openAccount() }, unsaved ? 'Save to account' : `Account · ${who}`)
          : h('button', { class: 'btn' + (unsaved ? '' : ' ghost'), type: 'button', onclick: () => openAccount({ view: unsaved ? 'create' : 'sign-in' }) }, unsaved ? 'Save this game' : 'Sign in'),
        who ? null : h('button', { class: 'btn ghost', type: 'button', onclick: () => openAccount({ view: unsaved ? 'sign-in' : 'create' }) }, unsaved ? 'Sign in' : 'Create account'),
        h('button', { class: 'btn ghost audio-entry', type: 'button', onclick: openAudioSettings }, 'Audio settings'))));
    this.stopRooftop = startRooftop(canvas, thought);
  },
  leave() {
    this.stopRooftop?.();
    this.stopRooftop = null;
    $('#hud').style.display = '';
  },
});

let started = false;
function startGame() {
  if (!started) { started = true; sfx('game_start'); }
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
        h('p', { class: 'small muted' }, '3D models by Polyfork (polyfork.dev), CC BY 4.0.'),
        h('p', { class: 'muted' }, 'Everything you used to win is real. VPCs, Multi-AZ, Aurora Global, Kubernetes, Terraform, WAF, SCPs, the 7 Rs. Go build things — the good kind.'),
        h('div', { class: 'row gap center' },
          h('button', { class: 'btn big', onclick: () => newGamePlus() }, 'New Game+ (keep skills & certs)'),
          h('button', { class: 'btn ghost', onclick: async () => {
            if (!signedInEmail() && S && !(await confirmBox('Leave? This game is not on an account, so it will be gone.', { ok: 'Leave' }))) return;
            location.reload();
          } }, 'Title'))));
    }
  },
});

async function newGamePlus() {
  const keep = { skills: S.skills, certs: S.certs, codexRead: S.codexRead, name: S.name, domainXP: S.domainXP };
  const s = newState(keep.name);
  const lvl = Math.max(1, Math.floor(S.level / 2));
  Object.assign(s, keep, { level: lvl, xp: xpForLevel(lvl), sp: 3, money: 5000, flags: { ngplus: true } });
  if (signedInEmail()) s.owner = userId();
  setState(s);
  save({ remote: false });
  if (signedInEmail()) {
    try { await pushCloud(); location.reload(); }
    catch (error) { toast(accountError(error), 'bad'); }
    return;
  }
  toast('Create an account to keep this new game. Leaving without one drops it.', 'warn', 5600);
  openAccount({ view: 'create' });
}
