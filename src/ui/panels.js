// Skills, Codex, Certifications, Shop, Story log, Settings, Practice.
import { h, $, money, num, modal, toast, confirmBox } from './dom.js';
import { icon } from '../render/atlas.js';
import { App, renderHUD, renderNav, show, runStory, dialogue } from './app.js';
import { S, save, wipe, exportSave, importSave, skillState, learnSkill, CERTS, HOMES, GEAR, spend, canSpend, gainXP, domainLevel, earn } from '../core/state.js';
import { SKILLS, SKILL } from '../data/skills.js';
import { DOMAINS, DOMAIN_IDS } from '../data/domains.js';
import { CODEX, codexEntry } from '../data/codex.js';
import { COMPONENT, COMPONENTS } from '../data/components.js';
import { drawQuestions } from '../data/quiz.js';
import { mulberry32 } from '../sim/rng.js';
import * as G from '../game.js';
import { sfx } from '../audio/sfx.js';
import { openAudioSettings } from './audio.js';
import { hasTouch } from './mobile.js';
import { HOUSING_ROOMS, ROOM_NAMES } from '../data/legacy.js';

// ═════════════ SKILLS ═════════════
App.panels.skills = function (focusId) {
  let dom = focusId ? SKILL[focusId]?.domain || 'net' : (App.lastSkillDomain || 'net');
  const body = h('div', { class: 'skills' });
  const render = () => {
    App.lastSkillDomain = dom; body.innerHTML = '';
    body.append(h('div', { class: 'row gap wrap' }, ...DOMAIN_IDS.map(d => h('button', { class: 'dtab ' + (d === dom ? 'on' : ''), style: { borderColor: DOMAINS[d].color }, onclick: () => { dom = d; render(); } }, h('span', { html: icon(DOMAINS[d].sprite, 22) }), DOMAINS[d].short, h('small', {}, ` L${domainLevel(d)}`)))));
    const D = DOMAINS[dom];
    body.append(h('div', { class: 'dom-head' }, h('h3', { style: { color: D.color } }, D.name), h('p', { class: 'muted' }, D.blurb), h('p', { class: 'small' }, '🎮 ' + D.gameplay)));
    const tiers = {};
    for (const s of SKILLS.filter(s => s.domain === dom)) (tiers[s.tier] ||= []).push(s);
    const tree = h('div', { class: 'tree' });
    for (const [t, list] of Object.entries(tiers)) {
      tree.append(h('div', { class: 'tier' }, h('div', { class: 'tier-n' }, `T${t}`), ...list.map(s => {
        const st = skillState(s.id);
        const unlocks = COMPONENTS.filter(c => c.skill === s.id).map(c => c.name);
        const why = { 'locked-level': `Requires level ${s.lvl}`, 'locked-req': 'Requires: ' + s.req.filter(r => !S.skills.includes(r)).map(r => SKILL[r].name).join(', '), 'no-sp': 'Not enough skill points', 'no-money': 'Not enough money', 'locked-story': '???' }[st];
        return h('div', { class: `skill ${st} ${focusId === s.id ? 'focus' : ''}` },
          h('div', { class: 'sk-name' }, s.name),
          h('div', { class: 'sk-desc' }, st === 'locked-story' ? 'Unknown.' : s.desc),
          unlocks.length ? h('div', { class: 'sk-unlocks' }, 'Unlocks: ' + unlocks.join(', ')) : null,
          st === 'owned' ? h('div', { class: 'sk-owned' }, '✔ Learned') :
            h('div', { class: 'row gap' }, h('span', { class: 'sk-cost' }, `${s.sp} SP · ${money(s.price)}`), st === 'available' ? h('button', { class: 'btn small', onclick: () => { if (learnSkill(s.id)) { toast(`Learned <b>${s.name}</b>`, 'good'); render(); renderHUD(); renderNav(); runStory(); } } }, 'Learn') : h('span', { class: 'muted small' }, why)));
      })));
    }
    body.append(tree);
    body.append(h('p', { class: 'muted small' }, `You have ${S.sp} SP and ${money(S.money)}. Earn SP by leveling up and passing certifications.`));
  };
  render();
  modal(body, { title: 'SKILL TREE', wide: true, cls: 'tall' });
};

// ═════════════ CODEX ═════════════
App.panels.codex = function (openId) {
  let current = openId ? codexEntry(openId)?.id : null; let dom = current ? codexEntry(current).domain : 'net'; let q = '';
  const body = h('div', { class: 'codex' });
  const render = () => {
    body.innerHTML = '';
    const list = h('div', { class: 'cx-list' }, h('input', { class: 'txt', placeholder: 'search…', value: q, oninput: e => { q = e.target.value.toLowerCase(); renderList(); } }));
    const listItems = h('div', {}); list.append(listItems);
    const renderList = () => {
      listItems.innerHTML = '';
      for (const d of DOMAIN_IDS) {
        const items = CODEX.filter(e => e.domain === d && (!q || (e.title + e.body + e.facts.join(' ')).toLowerCase().includes(q)));
        if (!items.length) continue;
        listItems.append(h('div', { class: 'cx-dom', style: { color: DOMAINS[d].color } }, DOMAINS[d].name));
        for (const e of items) listItems.append(h('button', { class: 'cx-item ' + (e.id === current ? 'on' : '') + (S.codexRead.includes(e.id) ? ' read' : ''), onclick: () => { current = e.id; render(); } }, e.title));
      }
    };
    renderList();
    const page = h('div', { class: 'cx-page' });
    const e = current && codexEntry(current);
    if (e) {
      const comp = e.comp && COMPONENT[e.comp];
      page.append(h('h2', { style: { color: DOMAINS[e.domain].color } }, comp ? h('span', { html: icon(comp.sprite, 40) }) : null, ' ', e.title), h('p', {}, e.body), h('ul', {}, ...e.facts.map(f => h('li', {}, f))));
      if (comp) page.append(h('div', { class: 'names' }, h('span', { style: { color: '#ff9900' } }, 'AWS: ' + comp.names.aws), h('span', { style: { color: '#3a96dd' } }, 'Azure: ' + comp.names.azure), h('span', { style: { color: '#34a853' } }, 'GCP: ' + comp.names.gcp)));
      page.append(h('div', { class: 'tip' }, '🎯 Exam / interview tip: ' + e.tip));
      if (!S.codexRead.includes(e.id)) { S.codexRead.push(e.id); gainXP(8, [e.domain]); save(); }
    } else page.append(h('p', { class: 'muted' }, `Pick an entry. ${S.codexRead.length}/${CODEX.length} read. Each new entry gives a little XP.`));
    body.append(list, page);
  };
  render();
  modal(body, { title: 'CODEX', wide: true, cls: 'tall' });
};

// ═════════════ CERTIFICATIONS ═════════════
App.panels.certs = function () {
  const body = h('div', { class: 'certs' }, h('p', { class: 'muted' }, 'Exams draw from the real topics these certifications cover. Passing raises your pay on every job and grants skill points. Failing costs the fee — read the Codex first.'));
  for (const [id, c] of Object.entries(CERTS)) {
    const owned = S.certs.includes(id);
    const lock = S.level < c.lvl ? `Level ${c.lvl}` : c.needSkill && !S.skills.includes(c.needSkill) ? `Skill: ${SKILL[c.needSkill].name}` : null;
    body.append(h('div', { class: 'cert ' + (owned ? 'owned' : '') },
      h('span', { html: icon('medal', 36) }),
      h('div', { class: 'grow' }, h('b', {}, c.name), h('div', { class: 'muted small' }, `${c.q} questions · pass ${Math.round(c.pass * 100)}% · +${c.sp} SP · +${Math.round(c.payBonus * 100)}% pay`), h('div', { class: 'small' }, 'Equivalent: ' + c.eq)),
      owned ? h('span', { class: 'good' }, '✔ Certified') : lock ? h('span', { class: 'muted' }, '🔒 ' + lock) : h('button', { class: 'btn', disabled: !canSpend(c.fee), onclick: () => { m.close(); takeExam(id); } }, `Take exam ${c.fee ? money(c.fee) : '(free)'}`)));
  }
  const m = modal(body, { title: 'CERTIFICATIONS', wide: true });
};

function takeExam(id) {
  const c = CERTS[id];
  spend(c.fee, 'Exam fee: ' + c.name); renderHUD();
  const rng = mulberry32((Date.now() & 0xffffff) ^ S.day);
  const qs = drawQuestions({ n: c.q, domains: c.domains, diff: c.diff, tags: c.tags, rng });
  quizRunner(qs, `${c.name} exam`, score => {
    const pass = score >= c.pass;
    sfx(pass ? 'cert_pass' : 'fail_jingle');
    if (pass) { S.certs.push(id); S.sp += c.sp; gainXP(300 * c.sp, c.domains || ['net', 'compute', 'data', 'sec']); toast(`${icon('medal', 20)} <b>CERTIFIED:</b> ${c.name}`, 'good', 6000); }
    else toast(`Failed ${c.name} (${Math.round(score * 100)}%). Study the Codex and retry.`, 'bad', 6000);
    save(); renderHUD(); App.world.buildOffice(S); runStory();
  });
}

export function quizRunner(qs, title, done) {
  let i = 0, correct = 0, answered = false;
  const body = h('div', { class: 'quiz' });
  const render = () => {
    body.innerHTML = '';
    if (i >= qs.length) {
      const score = correct / qs.length;
      body.append(h('div', { class: 'bigstat' }, `${correct} / ${qs.length}`), h('p', {}, `Score ${Math.round(score * 100)}%`), h('div', { class: 'row end' }, h('button', { class: 'btn', onclick: () => { m.close(); done(score); } }, 'Finish')));
      return;
    }
    const q = qs[i];
    body.append(h('div', { class: 'muted small' }, `Question ${i + 1} of ${qs.length} · ${DOMAINS[q.d]?.name || ''}`), h('h3', {}, q.q));
    const opts = h('div', { class: 'opts' });
    q.a.forEach((a, k) => opts.append(h('button', { class: 'opt', onclick: e => {
      if (answered) return; answered = true;
      const ok = k === q.c; if (ok) correct++; sfx(ok ? 'answer_right' : 'answer_wrong');
      e.currentTarget.classList.add(ok ? 'right' : 'wrong'); opts.children[q.c].classList.add('right');
      body.append(h('div', { class: 'explain ' + (ok ? 'good' : 'bad') }, (ok ? '✔ Correct. ' : '✖ ') + (q.ex || '')), h('div', { class: 'row end' }, h('button', { class: 'btn', onclick: () => { i++; answered = false; render(); } }, 'Next ▸')));
    } }, a)));
    body.append(opts);
  };
  render();
  const m = modal(body, { title, wide: true, closable: false });
}

// ═════════════ SHOP & HOUSING ═════════════
App.panels.shop = function () {
  const body = h('div', { class: 'shop' });
  const render = () => {
    body.innerHTML = '';
    body.append(h('div', { class: 'panel-title' }, 'HOUSING'));
    for (const hm of HOMES) {
      const cur = S.home === hm.id;
      const rooms = HOUSING_ROOMS[hm.id] || [];
      const price = G.homePrice(hm);
      const costLabel = hm.id === 'couch' ? 'rent' : 'upkeep';
      body.append(h('div', { class: 'shopitem ' + (cur ? 'owned' : '') }, h('span', { html: icon('house', 32) }),
        h('div', { class: 'grow' }, h('b', {}, hm.name),
          h('div', { class: 'small muted' }, `${money(hm.rent)}/week ${costLabel} · ${hm.perk}`),
          rooms.length && h('div', { class: 'small' }, rooms.map(room => ROOM_NAMES[room]).join(' · '))),
        cur ? h('span', { class: 'good' }, 'Current home') : h('button', { class: 'btn small', disabled: !G.canMoveHome(hm), onclick: () => {
          if (!G.moveHome(hm.id)) return;
          toast(`Moved: ${hm.name}`, 'good');
          shop.close();
          show('office');
        } }, price ? `Buy & move · ${money(price)}` : hm.cost ? 'Move to owned home' : 'Move')));
    }
    body.append(h('div', { class: 'panel-title' }, 'GEAR & BUSINESS'));
    for (const g of GEAR) {
      if (g.villain && !S.villain) continue;
      const owned = S.gear.includes(g.id); const lock = g.lvl && S.level < g.lvl;
      body.append(h('div', { class: 'shopitem ' + (owned ? 'owned' : '') }, h('span', { html: icon(g.sprite, 32) }), h('div', { class: 'grow' }, h('b', {}, g.name), h('div', { class: 'small muted' }, g.desc)),
        owned ? h('span', { class: 'good' }, 'Owned') : lock ? h('span', { class: 'muted' }, `Level ${g.lvl}`) : h('button', { class: 'btn small', disabled: !canSpend(g.cost), onclick: () => { spend(g.cost, g.name); S.gear.push(g.id); save(); toast(`Bought ${g.name}`, 'good'); renderHUD(); App.world.buildOffice(S); render(); } }, g.cost ? money(g.cost) : 'Free')));
    }
  };
  render();
  const shop = modal(body, { title: 'SHOP & HOUSING', wide: true });
};

// ═════════════ STORY LOG ═════════════
App.panels.log = function () {
  const ch = G.chapter();
  const body = h('div', {},
    h('h3', {}, `Chapter ${ch.n}: ${ch.title}`),
    h('p', { class: 'muted' }, `Step ${S.step + 1} of ${ch.steps.length}`),
    h('button', { class: 'btn small ghost', onclick: () => { const st = G.step(); if (st?.lines?.length) dialogue(st.lines); } }, 'Replay current scene'),
    h('div', { class: 'panel-title' }, 'STATS'),
    h('div', { class: 'grid2' }, ...Object.entries({ 'Total earned': money(S.stats.earned), 'Total spent': money(S.stats.spent), 'Infra bills paid': money(S.stats.infra), 'Contracts': S.stats.jobs, 'Failed': S.stats.failed, 'Breaches': S.stats.breaches, 'Codex read': `${S.codexRead.length}/${CODEX.length}`, 'Certifications': S.certs.map(c => CERTS[c].short).join(', ') || '—' }).map(([k, v]) => h('div', {}, h('span', { class: 'muted' }, k + ': '), h('b', {}, v)))),
    h('div', { class: 'panel-title' }, 'DOMAIN MASTERY'),
    h('div', { class: 'grid2' }, ...DOMAIN_IDS.map(d => h('div', {}, h('span', { style: { color: DOMAINS[d].color } }, DOMAINS[d].name), ` · L${domainLevel(d)} (${num(S.domainXP[d] || 0)} xp)`))),
    h('div', { class: 'panel-title' }, 'HISTORY'),
    h('div', {}, ...S.history.map(x => h('div', { class: 'small' }, `Day ${x.day} · ${x.story ? '★ ' : ''}${x.title} · `, h('b', { class: 'g' + x.grade }, x.grade)))));
  modal(body, { title: 'STORY & HISTORY', wide: true });
};

// ═════════════ SETTINGS ═════════════
App.panels.settings = function () {
  const ta = h('textarea', { class: 'txt', rows: 3, placeholder: 'Paste a save code to import' });
  const body = h('div', {},
    h('p', {}, 'The game autosaves to this browser after every action.'),
    h('div', { class: 'row gap wrap' },
      h('button', { class: 'btn', onclick: () => { save(); toast('Saved.'); } }, 'Save now'),
      h('button', { class: 'btn ghost', onclick: openAudioSettings }, 'Audio settings'),
      h('button', { class: 'btn ghost', onclick: () => { navigator.clipboard?.writeText(exportSave()); toast('Save code copied to clipboard.'); } }, 'Export save code'),
      h('button', { class: 'btn ghost', onclick: () => { try { importSave(ta.value); toast('Imported.'); location.reload(); } catch (e) { toast('Invalid save code.', 'bad'); } } }, 'Import'),
      h('button', { class: 'btn danger', onclick: async () => { if (await confirmBox('Delete your save and start over?', { ok: 'Delete' })) { wipe(); location.reload(); } } }, 'New game')),
    ta,
    h('div', { class: 'panel-title' }, 'CONTROLS'),
    h('ul', { class: 'small' }, (hasTouch() ? [
      'Drive: hold the on-screen pedal. Release it to stop.',
      'Home: hold the direction buttons to walk. Tap the nearby action or Ask a friend.',
      'Map: drag to pan, pinch to zoom, and twist two fingers to rotate. Camera buttons also work with one finger.',
      'Build: open Components, then tap the map or choose a location. Use Cancel to leave placement and Inspector to remove a component.',
      'Terminal: tap Run to submit a command. Use the arrow buttons for command history.',
      'Dialogue: tap to continue.',
    ] : [
      'Home: WASD or arrows to walk, E to interact, P to call a friend.',
      'Work diorama: drag to pan, right-drag or Shift-drag to rotate, and wheel to zoom.',
      'Build: click a component, then a region or AZ. Delete removes your selection. Esc cancels placing.',
      'Dialogue: click or press Space.',
    ]).map(text => h('li', {}, text))),
    h('div', { class: 'panel-title' }, 'CREDITS'),
    h('p', { class: 'small muted' }, 'Sprites: Pixel Art Atlas 1.4M by Angais (CC0), huggingface.co/datasets/Angais/pixel-art-atlas-1.4m. Rendering: three.js. Prices are simplified approximations of public cloud list prices for teaching.'));
  modal(body, { title: 'SAVE & SETTINGS' });
};

// ═════════════ PRACTICE ═════════════
App.panels.practice = function () {
  const has = id => S.skills.includes(id);
  const opts = [
    ['Network Lab', 'router', 'net_subnets', () => App.labs.start({ id: 'practice', type: 'netlab', title: 'Network Lab (practice)', practice: true, xp: 40, domains: ['net'] })],
    ['Subnetting drill', 'calendar', 'net_basics', () => App.labs.start({ id: 'practice', type: 'cidr', title: 'CIDR drill (practice)', practice: true, xp: 30, domains: ['net'], seed: Date.now() & 0xffff })],
    ['Security audit', 'eye', 'sec_waf', () => App.labs.start({ id: 'practice', type: 'audit', title: 'Security audit (practice)', practice: true, xp: 40, domains: ['sec'], count: 8, seed: Date.now() & 0xffff })],
    ['IAM evaluation', 'iam', 'sec_iam_adv', () => App.labs.start({ id: 'practice', type: 'iam', title: 'IAM puzzles (practice)', practice: true, xp: 40, domains: ['sec'], count: 4, seed: Date.now() & 0xffff })],
    ['Migration planner', 'trucks', 'mig_basics', () => App.labs.start({ id: 'practice', type: 'migration', title: 'Migration (practice)', practice: true, xp: 40, domains: ['mig'], portfolio: ['retail', 'hospital', 'halcyon'][S.day % 3] })],
    ['Git & CI terminal', 'terminal', 'ops_git', () => App.labs.start({ id: 'practice', type: 'terminal', title: 'Git & CI (practice)', practice: true, xp: 40, domains: ['ops'], challenges: ['git_basics', 'git_hotfix', 'ci_secret'] })],
    ['Terraform terminal', 'terraform', 'ops_terraform', () => App.labs.start({ id: 'practice', type: 'terminal', title: 'Terraform (practice)', practice: true, xp: 40, domains: ['ops'], challenges: ['tf_basics', 'tf_drift'] })],
    ['Kubernetes terminal', 'k8s', 'k8s_basics', () => App.labs.start({ id: 'practice', type: 'terminal', title: 'Kubernetes (practice)', practice: true, xp: 40, domains: ['compute'], challenges: ['k8s_scale', 'k8s_rollback', 'k8s_debug'] })],
    ['Domain quiz', 'book', 'net_basics', () => practiceQuiz()],
  ];
  const body = h('div', {}, h('p', { class: 'muted' }, 'Practice labs pay no money but give XP (once per day each) and build the muscle memory real contracts need.'),
    h('div', { class: 'practice-grid' }, ...opts.map(([name, spr, skill, fn]) => h('button', { class: 'pcard', disabled: !has(skill), onclick: () => { m.close(); fn(); } }, h('span', { html: icon(spr, 40) }), h('b', {}, name), !has(skill) ? h('small', {}, '🔒 ' + SKILL[skill].name) : null))));
  const m = modal(body, { title: 'PRACTICE LABS', wide: true });
};

function practiceQuiz() {
  const body = h('div', { class: 'row gap wrap' }, ...DOMAIN_IDS.map(d => h('button', { class: 'dtab', style: { borderColor: DOMAINS[d].color }, onclick: () => { m.close(); const qs = drawQuestions({ n: 6, domains: [d], diff: [1, Math.min(3, 1 + Math.floor(S.level / 8))] }); quizRunner(qs, DOMAINS[d].name + ' quiz', score => { const key = 'pq_' + d + '_' + S.day; if (!S.flags[key]) { S.flags[key] = true; gainXP(Math.round(60 * score), [d]); } save(); renderHUD(); }); } }, DOMAINS[d].name)));
  const m = modal(body, { title: 'Pick a domain' });
}
