// Lab UIs: Network Lab, CIDR, Security Audit, IAM, Migration, Recon, Terminal.
import { h, $, money, num, modal, toast } from './dom.js';
import { icon } from '../render/atlas.js';
import { App, renderHUD, runStory, show } from './app.js';
import { S, save, gainXP } from '../core/state.js';
import { NET_SCENARIOS, cidrQuestions, auditSet, IAM_PUZZLES, PORTFOLIOS, SEVEN_RS, TRANSFER_OPTS, VECTORS, RECON_TARGETS } from '../data/labs.js';
import { newWorld, run, CHALLENGES } from '../data/terminal.js';
import { quizRunner } from './panels.js';
import { mulberry32 } from '../sim/rng.js';
import * as G from '../game.js';
import { sfx, gradeSound } from '../audio/sfx.js';

function finish(job, score, detail = '') {
  if (job.practice) {
    const key = 'pr_' + job.type + '_' + S.day;
    let xp = 0;
    if (!S.flags[key]) { S.flags[key] = true; xp = gainXP((job.xp || 40) * score, job.domains || []).amt; }
    save(); renderHUD();
    toast(`Practice complete: ${Math.round(score * 100)}%${xp ? ` · +${xp} XP` : ' (XP already earned today)'}`, score >= 0.7 ? 'good' : 'warn', 4500);
    return;
  }
  const r = G.settleLab(job, score);
  gradeSound(r.grade);
  renderHUD();
  const m = modal(h('div', { class: 'results' }, h('div', { class: 'grade g' + r.grade }, r.grade), h('div', { class: 'rcol' },
    h('p', {}, `Score: ${Math.round(score * 100)}%`), detail ? h('p', { class: 'muted' }, detail) : null,
    h('p', {}, `Paid ${money(r.pay)} · +${num(r.xp)} XP`), job.story && r.grade === 'F' ? h('p', { class: 'bad' }, 'Story lab failed — retry it from the board.') : null,
    h('div', { class: 'row end' }, h('button', { class: 'btn', onclick: () => { m.close(); show('office'); runStory(); } }, 'Continue ▸')))), { title: job.title, wide: true, closable: false });
}

App.labs = {
  start(job) {
    const fn = { netlab, cidr, audit, iam, migration, recon, terminal }[job.type];
    if (!fn) return toast('Unknown lab type ' + job.type, 'bad');
    fn(job);
  },
};

function labModal(body, job, options) {
  const lab = modal(body, { title: job.title, ...options });
  const heading = $('.modal-title', lab.el);
  const help = h('button', { class: 'btn help-button small', type: 'button',
    onclick: () => App.panels.phone({ job }) }, 'Ask a friend');
  heading.insertBefore(help, $('.x', heading));
  return lab;
}

// ═════════════ NETWORK LAB ═════════════
function netlab(job) {
  const ids = job.scenarios || (() => { const all = Object.keys(NET_SCENARIOS); const rng = mulberry32(job.seed || Date.now()); const pick = []; while (pick.length < 2) { const x = all[Math.floor(rng() * all.length)]; if (!pick.includes(x)) pick.push(x); } return pick; })();
  let idx = 0; const scores = [];
  const body = h('div', { class: 'netlab' });
  const m = labModal(body, job, { wide: true, cls: 'tall', closable: !!job.practice });
  const renderScenario = () => {
    const sc = NET_SCENARIOS[ids[idx]];
    const vals = Object.fromEntries(sc.fields.map(f => [f.id, f.value]));
    let tries = 0;
    body.innerHTML = '';
    const out = h('div', { class: 'nl-out' });
    const fieldsEl = h('div', { class: 'nl-fields' });
    const groups = {};
    for (const f of sc.fields) (groups[f.group] ||= []).push(f);
    for (const [g, fs] of Object.entries(groups)) {
      fieldsEl.append(h('div', { class: 'pg-title' }, g));
      for (const f of fs) fieldsEl.append(h('div', { class: 'field' }, h('label', {}, f.label), h('select', { class: 'sel', onchange: e => { vals[f.id] = e.target.value; } }, ...f.options.map(o => h('option', { value: o, selected: o === f.value }, o)))));
    }
    const test = () => {
      tries++;
      out.innerHTML = '';
      let allPass = true;
      for (const t of sc.tests) {
        const hops = t.run(vals); const reachable = hops.every(x => x.ok);
        const pass = reachable === t.expect; allPass &&= pass;
        out.append(h('div', { class: 'nl-test ' + (pass ? 'ok' : 'no') }, `${pass ? '✔' : '✖'} ${t.label}: ${reachable ? 'REACHABLE' : 'BLOCKED'} (want ${t.expect ? 'reachable' : 'blocked'})`));
        for (const x of hops) out.append(h('div', { class: 'hop ' + (x.ok ? 'ok' : 'no') }, `${x.ok ? '→' : '✖'} ${x.name}: ${x.why}`));
      }
      const insecure = sc.insecureCheck?.(vals);
      if (insecure) out.append(h('div', { class: 'warnbox' }, '⚠ ' + insecure));
      sfx(allPass ? 'terminal_success' : 'answer_wrong');
      if (allPass) {
        const s = Math.max(0.4, 1 - (tries - 1) * 0.1 - (insecure ? 0.35 : 0));
        out.append(h('div', { class: 'good' }, `Solved! ${sc.lesson}`), h('button', { class: 'btn', onclick: () => { scores.push(s); idx++; idx < ids.length ? renderScenario() : (m.close(), finish(job, scores.reduce((a, b) => a + b, 0) / scores.length)); } }, idx + 1 < ids.length ? 'Next scenario ▸' : 'Finish ▸'));
      }
    };
    body.append(h('div', { class: 'muted small' }, `Scenario ${idx + 1} of ${ids.length}`), h('h3', {}, sc.title), h('p', {}, sc.desc),
      h('div', { class: 'nl-grid' }, fieldsEl, h('div', {}, h('div', { class: 'row gap' }, h('button', { class: 'btn', onclick: test }, 'Run Reachability Analyzer ▸'), h('button', { class: 'btn ghost small', onclick: () => App.panels.codex(sc.codex) }, '📖 Codex'), h('button', { class: 'btn ghost small', onclick: () => { scores.push(0.2); idx++; idx < ids.length ? renderScenario() : (m.close(), finish(job, scores.reduce((a, b) => a + b, 0) / scores.length)); } }, 'Give up')), out)));
  };
  renderScenario();
}

// ═════════════ CIDR ═════════════
function cidr(job) {
  const qs = cidrQuestions(job.seed || Date.now() & 0xffff, 6).map(q => ({ ...q, d: 'net', ex: q.ex }));
  quizRunner(qs, job.title, score => finish(job, score));
}

// ═════════════ SECURITY AUDIT ═════════════
function audit(job) {
  const items = auditSet(job.seed || 7, job.count || 10);
  const answers = items.map(() => ({ flag: null, fix: null }));
  const body = h('div', { class: 'audit' });
  const m = labModal(body, job, { wide: true, cls: 'tall', closable: !!job.practice });
  const render = () => {
    body.innerHTML = '';
    body.append(h('p', { class: 'muted' }, 'Mark each finding OK or ISSUE. For issues, choose the correct remediation. False alarms cost points too.'));
    items.forEach((f, i) => {
      const a = answers[i];
      body.append(h('div', { class: 'finding' },
        h('div', {}, h('b', {}, f.res), h('div', { class: 'mono small' }, f.detail)),
        h('div', { class: 'row gap' }, h('button', { class: 'btn small ' + (a.flag === false ? '' : 'ghost'), onclick: () => { a.flag = false; a.fix = null; render(); } }, 'OK'), h('button', { class: 'btn small danger ' + (a.flag === true ? '' : 'ghost'), onclick: () => { a.flag = true; render(); } }, 'ISSUE')),
        a.flag && f.fixes ? h('select', { class: 'sel', onchange: e => { a.fix = +e.target.value; } }, h('option', { value: '' }, 'Remediation…'), ...f.fixes.map((x, k) => h('option', { value: k, selected: a.fix === k }, x))) : a.flag && !f.fixes ? h('select', { class: 'sel', onchange: e => { a.fix = +e.target.value; } }, h('option', {}, 'Remediation…'), h('option', { value: 0 }, 'Tighten it further'), h('option', { value: 1 }, 'Delete it')) : null));
    });
    body.append(h('div', { class: 'row end' }, h('button', { class: 'btn', onclick: submit }, 'Submit audit ▸')));
  };
  const submit = () => {
    if (answers.some(a => a.flag === null)) return toast('Review every finding first.', 'info');
    let pts = 0; const lines = [];
    items.forEach((f, i) => {
      const a = answers[i];
      if (f.bad && a.flag) { const fixOk = a.fix === f.fix; pts += fixOk ? 1 : 0.5; lines.push([fixOk, `${f.res}: ${fixOk ? 'correct fix' : 'right flag, wrong fix'} — ${f.why}`]); }
      else if (f.bad && !a.flag) lines.push([false, `MISSED ${f.res}: ${f.why}`]);
      else if (!f.bad && a.flag) lines.push([false, `False alarm on ${f.res}: ${f.why}`]);
      else { pts += 1; lines.push([true, `${f.res}: correctly OK`]); }
    });
    const score = pts / items.length;
    body.innerHTML = '';
    body.append(h('div', { class: 'bigstat' }, Math.round(score * 100) + '%'), ...lines.map(([ok, t]) => h('div', { class: 'rline ' + (ok ? 'ok' : 'no') }, (ok ? '✔ ' : '✖ ') + t)), h('div', { class: 'row end' }, h('button', { class: 'btn', onclick: () => { m.close(); finish(job, score); } }, 'Done ▸')));
  };
  render();
}

// ═════════════ IAM ═════════════
function iam(job) {
  const rng = mulberry32(job.seed || 11);
  const pool = IAM_PUZZLES.slice(); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const set = pool.slice(0, job.count || 6);
  let i = 0, pts = 0;
  const body = h('div', { class: 'iamlab' });
  const m = labModal(body, job, { wide: true, cls: 'tall', closable: !!job.practice });
  const render = () => {
    body.innerHTML = '';
    if (i >= set.length) { const score = pts / set.length; body.append(h('div', { class: 'bigstat' }, Math.round(score * 100) + '%'), h('div', { class: 'row end' }, h('button', { class: 'btn', onclick: () => { m.close(); finish(job, score); } }, 'Done ▸'))); return; }
    const p = set[i]; let verdict = null, reason = null;
    body.append(h('div', { class: 'muted small' }, `Puzzle ${i + 1}/${set.length} · ${p.title}`));
    for (const [k, v] of p.policies) body.append(h('div', { class: 'pg-title' }, k), h('pre', { class: 'code' }, v));
    body.append(h('div', { class: 'request' }, 'REQUEST: ', h('b', {}, p.request)));
    const vbtns = h('div', { class: 'row gap' }, ...['Allow', 'Deny'].map(v => h('button', { class: 'btn ghost', onclick: e => { verdict = v; [...vbtns.children].forEach(b => b.classList.add('ghost')); e.target.classList.remove('ghost'); } }, v)));
    const rsel = h('select', { class: 'sel', onchange: e => { reason = +e.target.value; } }, h('option', { value: '' }, 'Because…'), ...p.reasons.map((r, k) => h('option', { value: k }, r)));
    const fb = h('div', {});
    body.append(vbtns, rsel, h('div', { class: 'row end' }, h('button', { class: 'btn', onclick: () => {
      if (!verdict || reason === null) return toast('Choose a verdict and a reason.', 'info');
      const vOk = verdict === p.answer, rOk = reason === p.reason; sfx(vOk && rOk ? 'answer_right' : 'answer_wrong');
      pts += (vOk ? 0.6 : 0) + (rOk ? 0.4 : 0);
      fb.innerHTML = ''; fb.append(h('div', { class: vOk && rOk ? 'good' : 'bad' }, `${vOk ? '✔' : '✖'} ${p.answer}. ${p.reasons[p.reason]}`), h('button', { class: 'btn', onclick: () => { i++; render(); } }, 'Next ▸'));
    } }, 'Evaluate')), fb, h('button', { class: 'link', onclick: () => App.panels.codex('iam_eval') }, '📖 Policy evaluation logic'));
  };
  render();
}

// ═════════════ MIGRATION ═════════════
function migration(job) {
  const P = PORTFOLIOS[job.portfolio || 'halcyon'];
  const choice = P.apps.map(() => null); let transfer = null;
  const body = h('div', { class: 'mig' });
  const m = labModal(body, job, { wide: true, cls: 'tall', closable: !!job.practice });
  const render = () => {
    body.innerHTML = '';
    body.append(h('h3', {}, P.name), h('p', { class: 'muted' }, 'Assign each application one of the 7 Rs.'), h('div', { class: 'rs' }, ...SEVEN_RS.map(r => h('span', { class: 'chip', title: r.desc }, r.name))));
    P.apps.forEach((a, i) => body.append(h('div', { class: 'finding' }, h('div', { class: 'grow' }, h('b', {}, a.name), h('div', { class: 'small' }, a.desc)),
      h('select', { class: 'sel', onchange: e => { choice[i] = e.target.value; } }, h('option', { value: '' }, 'Strategy…'), ...SEVEN_RS.map(r => h('option', { value: r.id, selected: choice[i] === r.id }, r.name))))));
    const T = P.transfer;
    body.append(h('div', { class: 'pg-title' }, 'DATA TRANSFER'), h('p', {}, `${T.tb} TB must reach S3 within ${T.weeks} weeks. Existing link: ${T.mbps >= 1000 ? T.mbps / 1000 + ' Gbps' : T.mbps + ' Mbps'}.`),
      h('select', { class: 'sel', onchange: e => { transfer = e.target.value; } }, h('option', { value: '' }, 'Method…'), ...TRANSFER_OPTS.map(o => h('option', { value: o.id }, o.name))),
      h('p', { class: 'muted small' }, 'Tip: days ≈ TB × 8,000 ÷ (Mbps × 0.8 × 86,400 ÷ 1,000,000) … or just: 1 Gbps ≈ 8.6 TB/day at 80%.'),
      h('div', { class: 'row end' }, h('button', { class: 'btn ghost small', onclick: () => App.panels.codex('seven_rs') }, '📖 7 Rs'), h('button', { class: 'btn', onclick: submit }, 'Submit plan ▸')));
  };
  const submit = () => {
    if (choice.some(c => !c) || !transfer) return toast('Pick a strategy for every app and a transfer method.', 'info');
    let pts = 0; const lines = [];
    P.apps.forEach((a, i) => { const best = a.best.includes(choice[i]), ok = a.ok.includes(choice[i]); pts += best ? 1 : ok ? 0.6 : 0; lines.push([best || ok, `${a.name}: you chose ${choice[i]}; best ${a.best.join('/')}${a.ok.length ? ` (acceptable: ${a.ok.join('/')})` : ''}. ${a.why}`]); });
    const tOk = transfer === P.transfer.answer; pts += tOk ? 1.5 : 0;
    lines.push([tOk, `Transfer: ${P.transfer.why}`]);
    const score = pts / (P.apps.length + 1.5);
    body.innerHTML = '';
    body.append(h('div', { class: 'bigstat' }, Math.round(score * 100) + '%'), ...lines.map(([ok, t]) => h('div', { class: 'rline ' + (ok ? 'ok' : 'no') }, (ok ? '✔ ' : '✖ ') + t)), h('div', { class: 'row end' }, h('button', { class: 'btn', onclick: () => { m.close(); finish(job, score); } }, 'Done ▸')));
  };
  render();
}

// ═════════════ RECON ═════════════
function recon(job) {
  const ids = job.targets || Object.keys(RECON_TARGETS).slice(0, 3);
  let i = 0, pts = 0;
  const body = h('div', { class: 'recon' });
  const m = labModal(body, job, { wide: true, cls: 'tall', closable: false });
  const render = () => {
    body.innerHTML = '';
    if (i >= ids.length) { const score = pts / ids.length; body.append(h('div', { class: 'bigstat' }, Math.round(score * 100) + '%'), h('div', { class: 'row end' }, h('button', { class: 'btn', onclick: () => { m.close(); finish(job, score); } }, 'Done ▸'))); return; }
    const t = RECON_TARGETS[ids[i]]; const sel = new Set();
    body.append(h('div', { class: 'muted small' }, `Target ${i + 1}/${ids.length}`), h('h3', {}, t.name), h('ul', { class: 'mono' }, ...t.arch.map(a => h('li', {}, a))),
      h('p', {}, 'Which failure modes would take this system down? Select every one that applies.'));
    const grid = h('div', { class: 'vectors' }, ...VECTORS.map(v => h('button', { class: 'vec', onclick: e => { sel.has(v.id) ? sel.delete(v.id) : sel.add(v.id); e.currentTarget.classList.toggle('on'); } }, h('b', {}, v.name), h('small', {}, 'Defense: ' + v.counter))));
    const fb = h('div', {});
    body.append(grid, h('div', { class: 'row end' }, h('button', { class: 'btn', onclick: () => {
      const tp = [...sel].filter(x => t.weak.includes(x)).length, fp = [...sel].filter(x => !t.weak.includes(x)).length;
      const s = Math.max(0, (tp - fp * 0.5) / t.weak.length); pts += Math.min(1, s); sfx(s >= 1 ? 'answer_right' : 'answer_wrong');
      fb.innerHTML = ''; fb.append(h('div', { class: s >= 1 ? 'good' : 'bad' }, `Weakness: ${t.weak.map(w => VECTORS.find(v => v.id === w).name).join(' + ')}. ${t.why}`), h('button', { class: 'btn', onclick: () => { i++; render(); } }, 'Next ▸'));
    } }, 'Analyze')), fb);
  };
  render();
}

// ═════════════ TERMINAL ═════════════
function terminal(job) {
  const ids = job.challenges || ['git_basics'];
  let idx = 0; const scores = [];
  const body = h('div', { class: 'term-wrap' });
  const m = labModal(body, job, { wide: true, cls: 'tall term-modal', closable: !!job.practice });
  const start = () => {
    const ch = CHALLENGES[ids[idx]]; const w = newWorld(); ch.setup(w); let hintsUsed = 0;
    body.innerHTML = '';
    const out = h('div', { class: 'term-out' });
    const input = h('input', { class: 'term-in', spellcheck: false, autocomplete: 'off', placeholder: 'type a command… (help, hint)' });
    const objs = h('div', { class: 'term-objs' });
    const hist = []; let hi = 0;
    const print = (txt, cls = '') => { if (txt === '\x1bclear') { out.innerHTML = ''; return; } if (txt) out.append(h('pre', { class: 'tl ' + cls }, txt)); out.scrollTop = out.scrollHeight; };
    const renderObjs = () => {
      objs.innerHTML = '';
      objs.append(h('div', { class: 'panel-title' }, `CHALLENGE ${idx + 1}/${ids.length}`), h('b', {}, ch.title), h('p', { class: 'small' }, ch.intro));
      let all = true;
      for (const o of ch.objectives) { const ok = o.check(w); if (!o.passive) all &&= ok; objs.append(h('div', { class: 'obj ' + (ok ? 'ok' : '') }, (ok ? '☑ ' : '☐ ') + o.text)); }
      if (ch.objectives.some(o => o.passive && !o.check(w))) all = false;
      if (all && !w.flags._doneSfx) { w.flags._doneSfx = true; sfx('terminal_success'); }
      if (all) {
        const s = Math.max(0.5, 1 - hintsUsed * 0.12);
        objs.append(h('div', { class: 'good' }, '✔ Challenge complete'), h('button', { class: 'btn', onclick: () => { scores.push(s); idx++; idx < ids.length ? start() : (m.close(), finish(job, scores.reduce((a, b) => a + b, 0) / scores.length)); } }, idx + 1 < ids.length ? 'Next challenge ▸' : 'Finish ▸'));
        input.disabled = true;
      }
      objs.append(h('button', { class: 'btn ghost small', onclick: () => { const hnt = ch.hints[Math.min(hintsUsed, ch.hints.length - 1)]; hintsUsed++; print('hint: ' + hnt, 'hint'); } }, `Hint (${hintsUsed}/${ch.hints.length})`));
    };
    input.addEventListener('keydown', e => {
      if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter') sfx('key_press', e.key === 'Enter' ? { vol: 0.3 } : {});
      if (e.key === 'Enter') {
        const line = input.value; input.value = ''; hist.push(line); hi = hist.length;
        print('$ ' + line, 'cmd');
        if (line.trim() === 'hint') { const hnt = ch.hints[Math.min(hintsUsed, ch.hints.length - 1)]; hintsUsed++; print('hint: ' + hnt, 'hint'); }
        else if (line.trim() === 'yes' && w.flags.pendingApply) { w.flags.applyConfirmed = true; print(run(w, 'terraform apply')); w.flags.applyConfirmed = false; w.flags.pendingApply = false; }
        else print(run(w, line));
        renderObjs();
      } else if (e.key === 'ArrowUp') { hi = Math.max(0, hi - 1); input.value = hist[hi] || ''; e.preventDefault(); }
      else if (e.key === 'ArrowDown') { hi = Math.min(hist.length, hi + 1); input.value = hist[hi] || ''; e.preventDefault(); }
    });
    body.append(h('div', { class: 'term' }, out, h('div', { class: 'term-line' }, h('span', { class: 'prompt' }, S.villain ? 'root@signal:~$' : 'you@cloud:~$'), input)), objs);
    print(`UPTIME shell — ${ch.title}\nType "help" for commands. Files: ${Object.keys(w.files).join(', ') || '(none)'}`);
    renderObjs();
    setTimeout(() => input.focus(), 50);
  };
  start();
}
