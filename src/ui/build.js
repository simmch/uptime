// Build mode (design the architecture) and Run mode (watch it survive).
import { h, $, money, num, modal, toast, confirmBox, sparkline } from './dom.js';
import { pixelIcon } from '../render/atlas.js';
import { cameraControls, hasTouch, isCompact, setDrawer } from './mobile.js';
import { App, registerScreen, show, renderHUD, runStory, dialogue } from './app.js';
import { S, save, spend, canSpend, creditLimit } from '../core/state.js';
import { COMPONENTS, COMPONENT, LAYERS, defaultConfig, PURCHASE } from '../data/components.js';
import { SKILL, maxRegions } from '../data/skills.js';
import { REGIONS, REGION, PROVIDERS } from '../data/regions.js';
import { mkNode } from '../data/jobs.js';
import { review, estimate, COMPLIANCE, NEEDS } from '../sim/review.js';
import { toTerraform } from '../sim/terraform.js';
import { createSim, step, results, availableActions, doAction, TICKS, TICK_MIN } from '../sim/sim.js';
import { INCIDENTS } from '../sim/incidents.js';
import { codexEntry } from '../data/codex.js';
import * as G from '../game.js';

const PRIMARY = { NA: 'us-east-1', EU: 'eu-west-1', APAC: 'ap-southeast-1', SA: 'sa-east-1' };
const has = id => S.skills.includes(id);

function compUnlocked(c) { return !c.skill || has(c.skill); }

// ═════════════ BUILD ═════════════
registerScreen('build', {
  enter(root, job) {
    const busy = S.active?.deployed && S.active.id !== job.id && S.active.job;
    if (busy) {
      toast(`Finish or abandon "${S.active.job.title}" first. It's still deployed.`, 'warn');
      return void queueMicrotask(() => show('build', S.active.job));
    }
    this.root = root; this.job = job;
    if (S.active?.design && S.active.id === job.id) this.design = S.active.design;
    else if (job.presetDesign) this.design = JSON.parse(JSON.stringify(job.presetDesign));
    else {
      const geo = Object.entries(job.req.geo || { NA: 1 }).sort((a, b) => b[1] - a[1])[0][0];
      this.design = { regions: [job.req.compliance?.includes('residencyEU') ? 'eu-west-1' : PRIMARY[geo]], nodes: [] };
    }
    const prior = S.active?.id === job.id ? S.active : {};
    S.active = { ...prior, id: job.id, job, design: this.design }; save();
    this.selected = null; this.placing = null; this.tab = 'contract';
    App.world.buildArch(this.design, { job });
    this.unpick = (this.onPick ||= hit => this.pick(hit));
    if (!this.bound) { App.world.on('pick', hit => App.screen === 'build' && this.pick(hit)); this.bound = true; }
    this.keyH = e => { if (e.key === 'Escape') this.cancelPlacement(); if ((e.key === 'Delete' || e.key === 'Backspace') && this.selected && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) this.remove(this.selected); };
    document.addEventListener('keydown', this.keyH);
    this.render();
    if (!S.flags.buildTutorial) {
      S.flags.buildTutorial = true; save();
      dialogue(hasTouch() ? [
        ['mara', 'Open Components, pick one, then tap a region or AZ on the map. You can also choose its location from the menu. Global components go to the edge automatically.'],
        ['mara', 'Drag to pan. Pinch to zoom or twist two fingers to rotate. The Camera controls do the same. Check Inspector and Review before you tap Deploy.'],
      ] : [
        ['mara', 'Build mode. Left: components you know. Click one, then click where it goes — a region platform or an AZ tile. Global things (DNS, CDN, security) go in the edge column automatically.'],
        ['mara', 'Right side: the contract, the inspector for whatever you select, and a pre-flight review. Drag to pan, wheel to zoom, right-drag to rotate. When ready: Deploy.'],
      ]);
    }
  },
  leave() { document.removeEventListener('keydown', this.keyH); App.world.highlight(null); },

  rebuild(keepCamera = true) { App.world.buildArch(this.design, { job: this.job, keepCamera, selected: this.selected }); save(); this.render(); },

  pick(hit) {
    if (this.placing) {
      const c = COMPONENT[this.placing];
      if (c.scope === 'az' && hit?.kind === 'az') return this.place(c, hit.region, hit.az);
      if (c.scope === 'region' && (hit?.kind === 'region' || hit?.kind === 'az')) return this.place(c, hit.region, null);
      if (hit?.kind === 'node') { this.placing = null; App.world.highlight(null); }
      else {
        const target = c.scope === 'az' ? 'an AZ tile (the three squares in a region)' : 'a region platform';
        return toast(`${hasTouch() ? 'Tap' : 'Click'} ${target}.`, 'info', 1800);
      }
    }
    if (hit?.kind === 'node') {
      this.selected = hit.uid;
      this.tab = 'inspect';
      this.rebuild();
      if (isCompact()) setDrawer('inspector');
    }
  },

  cancelPlacement() {
    if (!this.placing) return;
    this.placing = null;
    App.world.highlight(null);
    this.render();
  },

  startPlace(c) {
    if (!compUnlocked(c)) return App.panels.skills(c.skill);
    if (c.scope === 'global') {
      if (this.design.nodes.some(n => n.id === c.id)) return toast(`${c.name} is already in your design.`, 'info');
      return this.add(mkNode(c.id));
    }
    const regs = this.design.regions;
    if (regs.length === 1 && c.scope === 'region') return this.place(c, regs[0], null);
    this.placing = c.id; App.world.highlight(c.scope === 'az' ? 'az' : 'region');
    this.render();
    if (isCompact()) setDrawer(null);
  },
  place(c, region, az) {
    const R = this.design.nodes.filter(n => n.region === region);
    if (c.id !== 'vpc' && !R.some(n => n.id === 'vpc')) { toast(`Add a <b>VPC</b> to ${region} first — every regional resource lives in a VPC.`, 'warn'); return; }
    if (c.scope === 'region' && R.some(n => n.id === c.id)) { toast(`${c.name} already exists in ${region}. Select it to configure.`, 'info'); return; }
    if (REGION[region].provider !== 'aws' && !['vpc', 'asg', 'ec2', 'eks', 'alb', 'nlb', 's3', 'rds', 'elasticache', 'sqs', 'fargate', 'lambda', 'apprunner', 'dynamodb', 'aurora', 'nat'].includes(c.id)) { toast(`${PROVIDERS[REGION[region].provider].name} equivalent: ${c.names[REGION[region].provider]}`, 'info'); }
    const n = mkNode(c.id, region, c.scope === 'az' ? az : null);
    this.placing = null; App.world.highlight(null);
    this.add(n);
  },
  add(n) {
    sfx('place_component');
    this.design.nodes.push(n);
    this.selected = n.uid;
    this.tab = 'inspect';
    this.rebuild();
    if (isCompact()) setDrawer('inspector');
  },
  async remove(uid) {
    const n = this.design.nodes.find(x => x.uid === uid); if (!n) return;
    if (n.id === 'vpc') {
      const others = this.design.nodes.filter(x => x.region === n.region && x.uid !== uid);
      if (others.length && !(await confirmBox(`Removing the VPC removes ${others.length} resources in ${n.region}.`, { ok: 'Remove all' }))) return;
      this.design.nodes = this.design.nodes.filter(x => x.region !== n.region || x.uid === uid);
    }
    this.design.nodes = this.design.nodes.filter(x => x.uid !== uid);
    sfx('remove_component');
    this.selected = null; this.rebuild();
  },
  addRegion(r) {
    if (!r || this.design.regions.includes(r)) return;
    this.design.regions.push(r); this.rebuild(false);
  },
  async removeRegion(r) {
    if (this.design.regions.length === 1) return toast('You need at least one region.', 'info');
    const k = this.design.nodes.filter(n => n.region === r).length;
    if (k && !(await confirmBox(`Remove ${r} and its ${k} resources?`, { ok: 'Remove' }))) return;
    this.design.nodes = this.design.nodes.filter(n => n.region !== r);
    this.design.regions = this.design.regions.filter(x => x !== r); this.rebuild(false);
  },

  render() {
    const root = this.root; root.innerHTML = '';
    const job = this.job;
    // top bar
    const maxR = maxRegions(S.skills);
    const provOK = p => p === 'aws' || has('ha_multicloud');
    const regSel = h('select', { class: 'sel', disabled: this.design.regions.length >= maxR, onchange: e => this.addRegion(e.target.value) },
      h('option', { value: '' }, this.design.regions.length >= maxR ? `Max ${maxR} region${maxR > 1 ? 's' : ''} (skill)` : '+ Add region'),
      ...REGIONS.filter(r => !this.design.regions.includes(r.id) && provOK(r.provider)).map(r => h('option', { value: r.id }, `${r.id} · ${r.name} (${r.geo})`)));
    const top = h('div', { class: 'build-top panel' },
      h('button', { class: 'btn ghost small', onclick: async () => { if (await confirmBox('Leave this contract? Your design is kept and you can come back from the job board.', { ok: 'Leave' })) { show('office'); } } }, '◂ Back'),
      h('div', { class: 'bt-title' }, job.title),
      S.active?.deployed ? h('span', { class: 'attempts muted small' }, `Attempt ${(S.active.attempts || 0) + 1} of ${MAX_ATTEMPTS}`) : null,
      S.active?.deployed ? h('button', { class: 'btn ghost small danger', onclick: () => this.abandon() }, 'Abandon') : null,
      h('div', { class: 'regions' }, ...this.design.regions.map((r, i) => h('span', { class: 'rchip', style: { borderColor: PROVIDERS[REGION[r].provider].color } }, i === 0 ? '★ ' : '', r, h('button', { class: 'x', onclick: () => this.removeRegion(r) }, '×'))), regSel),
      h('div', { class: 'grow' }),
      h('button', { class: 'btn help-button small', onclick: () => {
        const node = this.design.nodes.find(item => item.uid === this.selected);
        App.panels.phone({ job, component: COMPONENT[node?.id] });
      } }, 'Ask a friend'),
      has('ops_tf_adv') ? h('button', { class: 'btn ghost small', onclick: () => this.blueprints() }, 'Modules') : null,
      h('button', { class: 'btn deploy', onclick: () => this.deploy() }, 'DEPLOY ▸'));
    // palette
    const pal = h('div', { class: 'palette panel' }, h('div', { class: 'panel-title' }, 'COMPONENTS'));
    if (this.placing) pal.append(h('div', { class: 'placing desktop-input-hint' }, `Placing ${COMPONENT[this.placing].name}… click ${COMPONENT[this.placing].scope === 'az' ? 'an AZ tile' : 'a region'} · Esc to cancel`));
    for (const L of LAYERS) {
      const items = COMPONENTS.filter(c => c.layer === L.id && (c.id !== 'bastion' || true));
      if (!items.length) continue;
      const grp = h('div', { class: 'pgroup' }, h('div', { class: 'pg-title' }, L.name));
      for (const c of items) {
        const ok = compUnlocked(c);
        grp.append(h('button', { class: `pitem ${ok ? '' : 'locked'} ${this.placing === c.id ? 'on' : ''}`, title: ok ? c.desc : `Requires skill: ${SKILL[c.skill]?.name}`, onclick: () => this.startPlace(c) },
          h('span', { html: pixelIcon(c.sprite, 26) }), h('span', { class: 'pi-name' }, c.name), ok ? h('span', { class: 'pi-scope' }, c.scope === 'az' ? 'AZ' : c.scope === 'region' ? 'RGN' : 'GLB') : h('span', { class: 'pi-lock' }, '🔒')));
      }
      pal.append(grp);
    }
    // right panel
    const tabs = [['contract', 'Contract'], ['inspect', 'Inspect'], ['review', 'Review'], ['cost', 'Cost'], ['tf', 'Terraform']];
    const right = h('div', { class: 'inspector panel' },
      h('div', { class: 'tabs' }, ...tabs.map(([id, l]) => h('button', { class: 'tab ' + (this.tab === id ? 'on' : ''), onclick: () => { this.tab = id; this.render(); } }, l))),
      h('div', { class: 'tabbody' }, this.renderTab()));
    root.append(top, pal, right);
    if (this.placing) root.append(this.placementControls());
    root.append(cameraControls(App.world));
  },

  placementControls() {
    const component = COMPONENT[this.placing];
    const targets = this.design.regions.flatMap(region => component.scope === 'az'
      ? [0, 1, 2].map(az => ({ region, az, label: region + 'abc'[az] })) : [{ region, az: null, label: region }]);
    const select = h('select', { class: 'sel', onchange: event => {
      if (!event.target.value) return;
      const { region, az } = targets[Number(event.target.value)];
      event.target.value = '';
      this.place(component, region, az);
    } }, h('option', { value: '' }, 'Choose location'),
    targets.map((target, index) => h('option', { value: index }, target.label)));
    return h('div', { class: 'm-placement panel' }, h('label', {}, component.name, select),
      h('button', { class: 'btn ghost small', type: 'button', onclick: () => this.cancelPlacement() }, 'Cancel'));
  },

  renderTab() {
    const job = this.job, req = job.req;
    if (this.tab === 'contract') {
      const ar = review(this.design, job, S.skills);
      const el = h('div', { class: 'contract' }, h('p', {}, job.brief));
      if (job.hint) el.append(h('p', { class: 'hint' }, '💡 ' + job.hint));
      const t = h('table', { class: 'reqtable' }); const row = (k, v) => t.append(h('tr', {}, h('td', {}, k), h('td', {}, v)));
      row('Traffic', `${num(req.rps)} rps${req.peak > 1 ? ` · peak ${req.peak}×` : ''}`); row('Users', Object.entries(req.geo || { NA: 1 }).map(([g, v]) => `${g} ${Math.round(v * 100)}%`).join(' · '));
      row('Static / reads / async', `${Math.round((req.static || 0) * 100)}% / ${Math.round((req.read ?? 0.8) * 100)}% / ${Math.round((req.async || 0) * 100)}%`);
      row('SLA', `${req.availability}% · p95 < ${req.latency} ms`); if (req.rto) row('DR', `RTO ${req.rto}m · RPO ${req.rpo}m`);
      row('Data', `${num(req.dataGB || 20)} GB${req.archiveGB ? ` + ${num(req.archiveGB)} GB archive` : ''}`);
      if (job.budget && job.mode !== 'signal') row('Budget', money(job.budget));
      el.append(t);
      for (const c of req.compliance || []) { const def = COMPLIANCE[c]; const ok = def.check({ ...analyzeLite(this.design) }); el.append(h('div', { class: 'check ' + (ok ? 'ok' : 'no') }, ok ? '✔ ' : '✖ ', def.label)); }
      for (const n of req.needs || []) el.append(h('div', { class: 'check' }, '• ', NEEDS[n]));
      return el;
    }
    if (this.tab === 'inspect') return this.renderInspector();
    if (this.tab === 'review') {
      const r = review(this.design, job, S.skills);
      const el = h('div', { class: 'review' });
      if (!has('ha_multiaz')) el.append(h('p', { class: 'muted small' }, 'Learn Reliability → Multi-AZ Design for deeper single-point-of-failure checks.'));
      for (const it of r.items) el.append(h('div', { class: 'ritem ' + it.level }, h('span', {}, { error: '✖', warn: '⚠', tip: '💡', ok: '✔' }[it.level] + ' ' + it.text), it.codex ? h('button', { class: 'link', onclick: () => App.panels.codex(it.codex) }, 'learn') : null));
      return el;
    }
    if (this.tab === 'cost') {
      if (!has('cost_basics')) return h('p', { class: 'muted' }, 'Learn Cost → Cloud Billing Basics to see live cost estimates. (Without it you find out when the bill arrives.)');
      const est = estimate(this.design, job, S.skills);
      const el = h('div', {}, h('div', { class: 'bigstat' }, money(est.costPerDay), h('small', {}, ' / day')), h('div', {}, `≈ ${money(est.total)} over ${req.days} days`));
      if (job.budget && job.mode !== 'signal') el.append(h('div', { class: est.total > job.budget ? 'bad' : 'good' }, `Budget ${money(job.budget)} — ${est.total > job.budget ? 'OVER' : 'within'}`));
      if (job.mode !== 'signal') el.append(h('div', { class: 'muted' }, `Contract pays ${money(job.pay)}. Projected margin ≈ ${money(job.pay - est.total)}.`));
      if (has('cost_rightsize')) el.append(h('div', {}, `Peak compute utilization ≈ ${Math.round(est.peakUtil * 100)}% · average ≈ ${Math.round(est.avgUtil * 100)}%`), h('div', { class: est.errRate > 0.01 ? 'bad' : 'muted' }, `Quiet-day error rate ≈ ${(est.errRate * 100).toFixed(2)}%`));
      el.append(h('p', { class: 'muted small' }, 'Estimate assumes no incidents. Attacks and failures cost extra.'));
      return el;
    }
    if (this.tab === 'tf') {
      if (!has('ops_terraform')) return h('p', { class: 'muted' }, 'Learn Ops → Terraform to view your design as infrastructure-as-code.');
      const code = toTerraform(this.design, job);
      return h('div', {}, h('div', { class: 'row gap' }, h('button', { class: 'btn small', onclick: () => { navigator.clipboard?.writeText(code); toast('Copied main.tf'); } }, 'Copy'), h('span', { class: 'muted small' }, 'main.tf — what you\'d commit to Git')), h('pre', { class: 'code' }, code));
    }
  },

  renderInspector() {
    const n = this.design.nodes.find(x => x.uid === this.selected);
    if (!n) return h('p', { class: 'muted' }, 'Select a component in the world to configure it.');
    const c = COMPONENT[n.id];
    const el = h('div', { class: 'insp' },
      h('div', { class: 'row gap' }, h('span', { html: pixelIcon(c.sprite, 48) }), h('div', {}, h('h3', {}, c.name), h('div', { class: 'muted small' }, c.scope === 'global' ? 'Global' : `${n.region}${n.az != null ? 'abc'[n.az] : ''}`))),
      h('p', {}, c.desc),
      h('div', { class: 'names' }, h('span', { style: { color: '#ff9900' } }, 'AWS: ' + c.names.aws), h('span', { style: { color: '#3a96dd' } }, 'Azure: ' + c.names.azure), h('span', { style: { color: '#34a853' } }, 'GCP: ' + c.names.gcp)));
    if (c.scope === 'az') el.append(field('AZ', h('select', { class: 'sel', onchange: e => { n.az = +e.target.value; this.rebuild(); } }, ...[0, 1, 2].map(a => h('option', { value: a, selected: n.az === a }, n.region + 'abc'[a])))));
    for (const f of c.config || []) {
      const locked = f.skill && !has(f.skill);
      let input;
      if (f.type === 'select') input = h('select', { class: 'sel', disabled: locked, onchange: e => { n.cfg[f.key] = e.target.value; this.rebuild(); } },
        ...f.options.map(o => h('option', { value: o.v, selected: n.cfg[f.key] === o.v, disabled: o.skill && !has(o.skill) }, o.l + (o.skill && !has(o.skill) ? ' 🔒' : ''))));
      else if (f.type === 'bool') input = h('label', { class: 'toggle ' + (locked ? 'locked' : '') }, h('input', { type: 'checkbox', checked: !!n.cfg[f.key], disabled: locked, onchange: e => { n.cfg[f.key] = e.target.checked; this.rebuild(); } }), h('span', {}));
      else input = h('input', { class: 'num', type: 'number', min: f.min, max: f.max, value: n.cfg[f.key], disabled: locked, onchange: e => { n.cfg[f.key] = Math.max(f.min, Math.min(f.max, Math.round(+e.target.value || f.min))); if (n.id === 'asg' && n.cfg.min > n.cfg.max) n.cfg.max = n.cfg.min; if (n.id === 'eks' && n.cfg.nodesMin > n.cfg.nodesMax) n.cfg.nodesMax = n.cfg.nodesMin; this.rebuild(); } });
      el.append(field(f.label + (locked ? ` 🔒 ${SKILL[f.skill].name}` : ''), input));
    }
    if (n.cfg.purchase && PURCHASE[n.cfg.purchase]) el.append(h('p', { class: 'muted small' }, PURCHASE[n.cfg.purchase].desc));
    el.append(h('div', { class: 'row gap' }, h('button', { class: 'btn ghost small', onclick: () => App.panels.codex(c.codex) }, '📖 Codex'), h('button', { class: 'btn danger small', onclick: () => this.remove(n.uid) }, 'Remove')));
    return el;
  },

  blueprints() {
    const list = h('div', {});
    const render = () => { list.innerHTML = ''; for (const [i, b] of S.blueprints.entries()) list.append(h('div', { class: 'row gap' }, h('span', { class: 'grow' }, `${b.name} (${b.design.nodes.length} resources)`), h('button', { class: 'btn small', onclick: () => { this.design.regions = b.design.regions.slice(); this.design.nodes = JSON.parse(JSON.stringify(b.design.nodes)).map(n => ({ ...n, uid: mkNode(n.id).uid })); m.close(); this.rebuild(false); } }, 'Load'), h('button', { class: 'btn ghost small', onclick: () => { S.blueprints.splice(i, 1); save(); render(); } }, '×'))); };
    render();
    const name = h('input', { class: 'txt', placeholder: 'module name' });
    const m = modal(h('div', {}, h('p', { class: 'muted' }, 'Terraform modules: save a design and reuse it on later contracts.'), list, h('div', { class: 'row gap' }, name, h('button', { class: 'btn', onclick: () => { S.blueprints.push({ name: name.value || 'module-' + (S.blueprints.length + 1), design: JSON.parse(JSON.stringify(this.design)) }); save(); render(); } }, 'Save current'))), { title: 'Modules' });
  },

  async abandon() {
    const upfront = S.active?.upfront || 0;
    const ok = await confirmBox(`Walk away from <b>${this.job.title}</b>?<br>You refund the ${money(upfront)} upfront and lose 3 reputation. ${this.job.story ? 'Story contracts come back on the board.' : 'The client finds someone else.'}`, { ok: 'Abandon', title: 'Abandon contract?' });
    if (!ok) return;
    G.abandonJob(this.job);
    renderHUD();
    show('office');
  },

  async deploy() {
    const r = review(this.design, this.job, S.skills);
    const tfMult = this.design.nodes.some(n => n.id === 'terraform') ? 0.6 : 1;
    const setup = Math.round(this.design.nodes.reduce((a, n) => a + (COMPONENT[n.id].setup || 0) * (n.id === 'ec2' ? n.cfg.count : 1), 0) * tfMult * (1 + (this.job.req.tier || 0) * 1.5));
    const errs = r.items.filter(i => i.level === 'error');
    const redeploy = S.active?.id === this.job.id && S.active.deployed;
    const labor = redeploy ? Math.round(setup * 0.5) : setup;
    const upfront = redeploy || this.job.mode === 'signal' ? 0 : Math.round(this.job.pay * 0.3);
    const msg = `${redeploy ? `<p>Redeploy · attempt ${(S.active.attempts || 0) + 1} of ${MAX_ATTEMPTS}. The client is waiting.</p>` : ''}${errs.length ? `<p class="bad">⚠ ${errs.length} blocking issue(s):<br>${errs.map(e => '• ' + e.text).join('<br>')}</p>` : ''}
      <p>${redeploy ? 'Redeploy labor' : 'Setup labor'}: <b>${money(labor)}</b>${tfMult < 1 ? ' (Terraform −40%)' : ''}${redeploy ? ' (half — the groundwork is done)' : ''}<br>
      ${upfront ? `Upfront from client: <b>+${money(upfront)}</b><br>` : ''}
      Infrastructure bills tick from your wallet while it runs. If your balance drops below ${money(-creditLimit())}, your account is suspended.</p>`;
    if (!(await confirmBox(msg, { ok: errs.length ? 'Deploy anyway' : 'Deploy', title: 'Deploy to production?' }))) return;
    if (!canSpend(labor - upfront)) return toast('Not enough money for setup. Simplify, or take smaller jobs first.', 'bad');
    if (redeploy) this.job.upfront = S.active.upfront || 0;
    else {
      G.startOfJob(this.job);
      S.active = { id: this.job.id, job: this.job, design: this.design, deployed: true, attempts: 0, spent: 0, upfront: this.job.upfront || 0 };
    }
    spend(labor, redeploy ? 'Redeploy labor' : 'Setup labor');
    save();
    renderHUD();
    sfx('deploy');
    show('run', { job: this.job, design: this.design });
  },
});

const MAX_ATTEMPTS = 3;
const attemptsLeft = () => MAX_ATTEMPTS - 1 - (S.active?.attempts || 0);

function runLessons(sim) {
  const lessons = [], seen = new Set();
  for (const e of sim.log) if (e.codex && ['incident', 'attack', 'breach', 'warn'].includes(e.level) && !seen.has(e.codex)) { seen.add(e.codex); lessons.push(e); }
  for (const inc of sim.incidents) if (inc.state !== 'pending') { const meta = INCIDENTS[inc.type]; if (!inc.mitigated && !inc.autoFix && !seen.has('m' + inc.type)) { seen.add('m' + inc.type); lessons.push({ text: `${meta.name}: ${meta.mitigation}`, codex: meta.codex }); } }
  return lessons;
}

const DIAG_HINT = {
  availability: 'Requests failed. Look for a single point of failure (one instance, one AZ, one database), servers that ran out of capacity at peak, or an incident you didn\'t respond to. Spread across AZs, add a load balancer with health checks, auto scaling, and monitoring so you can see it happen.',
  latency: 'Responses were too slow. Usually the compute tier was saturated at peak or the database was the bottleneck. Add capacity or auto scaling, put a cache (ElastiCache) or CDN in front of hot reads, or move closer to the users.',
  rto: 'Recovery after the regional event took too long. You need a second region that can take traffic (pilot light or warm standby) and DNS failover with health checks.',
  rpo: 'Too much data was lost. Replicate the database across regions (global database / cross-region replicas) and keep backups in another region.',
  breach: 'An attacker got in. Add a WAF, keep databases in private subnets behind security groups, encrypt data, and use least-privilege IAM.',
  compliance: 'A compliance control is missing. Check the Review tab — it lists the exact control the client requires.',
  regions: 'The contract requires more regions with resources in them. Add a region and deploy at least a VPC with compute there.',
  cost: 'You went over budget. Right-size instances, use auto scaling instead of a big fixed fleet, consider reserved or spot pricing, and drop components the contract doesn\'t need.',
  suspended: 'Your balance fell below your credit line, so the provider shut everything off. Use a cheaper design or build up savings before big contracts.',
  regulated: 'This client is regulated: any compliance gap or breach voids the contract. Fix those first.',
};

function field(label, input) { return h('div', { class: 'field' }, h('label', {}, label), input); }
import { analyze } from '../sim/analyze.js';
import { sfx, loop, stopLoop, gradeSound } from '../audio/sfx.js';
function analyzeLite(d) { return analyze(d); }

// ═════════════ RUN ═════════════
registerScreen('run', {
  enter(root, { job, design }) {
    this.root = root; this.job = job; this.design = JSON.parse(JSON.stringify(design));
    this.sim = createSim(this.design, job, { skills: S.skills, charge: amt => { spend(amt, 'Infrastructure'); return S.money >= -creditLimit(); } });
    this.speed = 1; this.paused = false; this.finished = false; this.acc = 0; this.shownLog = 0; this.hasMon = this.sim.ar.has('monitor'); this.complaints = 0;
    this.actionSignature = null;
    App.world.buildArch(this.design, { job });
    root.append(this.ui());
    this.last = performance.now();
    loop('server_hum', 0.1, 1.5);
    this.raf = requestAnimationFrame(this.frame.bind(this));
  },
  leave() { cancelAnimationFrame(this.raf); App.world.stopSim(); stopLoop('server_hum'); },
  ui() {
    const speeds = [1, 2, 4].concat(S.gear.includes('monitor') ? [8] : []);
    this.el = {
      clock: h('div', { class: 'clock' }), bar: h('div', { class: 'tbar-fill' }),
      metrics: h('div', { class: 'metrics' }), log: h('div', { class: 'log' }), actions: h('div', { class: 'actions' }),
      c1: h('canvas', { width: 260, height: 54 }), c2: h('canvas', { width: 260, height: 40 }), c3: h('canvas', { width: 260, height: 40 }),
    };
    const speedBtns = h('div', { class: 'speeds' }, h('button', { class: 'btn small ghost', 'aria-label': 'Pause simulation', onclick: e => {
      this.paused = !this.paused;
      e.currentTarget.textContent = this.paused ? '▶' : '❚❚';
      e.currentTarget.setAttribute('aria-label', this.paused ? 'Resume simulation' : 'Pause simulation');
    } }, '❚❚'), ...speeds.map(s => h('button', { class: 'btn small ' + (s === 1 ? '' : 'ghost'), onclick: e => { this.speed = s; [...e.currentTarget.parentNode.children].slice(1).forEach(b => b.classList.add('ghost')); e.currentTarget.classList.remove('ghost'); } }, s + '×')));
    return h('div', { class: 'runui' },
      h('div', { class: 'run-top panel' }, h('div', { class: 'bt-title' }, '● LIVE · ' + this.job.title), this.el.clock, h('div', { class: 'tbar' }, this.el.bar),
        h('button', { class: 'btn help-button small', onclick: () => App.panels.phone({ job: this.job }) }, 'Ask a friend'),
        attemptsLeft() > 0 ? h('button', { class: 'btn ghost small', onclick: () => this.abortRun() }, 'Stop & fix') : null, speedBtns),
      h('div', { class: 'run-left panel' }, h('div', { class: 'panel-title' }, 'EVENTS'), this.el.log),
      h('div', { class: 'run-right panel' }, h('div', { class: 'panel-title' }, 'METRICS'), this.el.metrics,
        h('div', { class: 'small muted' }, 'traffic: demand (blue) · served (green)'), this.el.c1, h('div', { class: 'small muted' }, 'error rate'), this.el.c2, h('div', { class: 'small muted' }, 'cost / day'), this.el.c3),
      h('div', { class: 'run-bottom' }, this.el.actions), cameraControls(App.world));
  },
  frame(now) {
    const dt = Math.min(0.25, (now - this.last) / 1000); this.last = now;
    App.world.speed = this.speed;
    if (!this.paused && !this.sim.done && !$('.phone-modal')) {
      this.acc += dt * 4 * this.speed;
      let n = 0;
      while (this.acc >= 1 && !this.sim.done && n < 16) { this.acc -= 1; n++; const m = step(this.sim); App.world.showSim(this.sim, m); this.tickUI(m); }
      if (n) renderHUD();
    }
    if (this.sim.done && !this.finished) { this.finished = true; setTimeout(() => this.finish(), 600); }
    this.raf = requestAnimationFrame(this.frame.bind(this));
  },
  tickUI(m) {
    const sim = this.sim, E = this.el;
    const minutes = sim.t * TICK_MIN; const hh = String(8 + Math.floor(minutes / 60)).padStart(2, '0'), mm = String(minutes % 60).padStart(2, '0');
    E.clock.textContent = `${hh}:${mm}`; E.bar.style.width = (100 * sim.t / TICKS) + '%';
    const mon = this.hasMon;
    const errTxt = mon ? (m.errRate * 100).toFixed(2) + '%' : '??';
    const p95Txt = mon ? Math.round(m.p95) + ' ms' : '??';
    E.metrics.innerHTML = '';
    const row = (k, v, cls = '') => E.metrics.append(h('div', { class: 'mrow ' + cls }, h('span', {}, k), h('b', {}, v)));
    row('Requests/s', num(m.demand)); row('Served/s', mon ? num(m.served) : '??'); row('Errors', errTxt, m.errRate > 0.05 && mon ? 'bad' : '');
    row('p95 latency', p95Txt, mon && m.p95 > this.job.req.latency ? 'bad' : ''); row('Cost/day', money(m.costDay)); row('Spent so far', money(sim.totals.cost));
    if (m.attack > 0) row('Attack traffic', num(m.attack) + '/s', 'bad');
    if (m.backlog > 1) row('Queue backlog', num(m.backlog));
    const ws = 100 * sim.totals.served / Math.max(1, sim.totals.legit); row('Window success', mon ? ws.toFixed(2) + '%' : '??');
    if (!mon) E.metrics.append(h('div', { class: 'small muted' }, 'No monitoring: you only see traffic and the bill. Learn why that\'s bad.'));
    const H = sim.hist;
    sparkline(E.c1, [H.demand, H.served], { colors: ['#5ab0ff', '#5dff8a'] });
    if (mon) sparkline(E.c2, [H.errRate], { colors: ['#ff5c5c'], max: Math.max(0.05, ...H.errRate) });
    sparkline(E.c3, [H.cost], { colors: ['#ffd84d'] });
    // complaints when blind
    if (!mon && m.errRate > 0.2) { this.complaints++; if (this.complaints % 6 === 1) sim.log.push({ t: sim.t, level: 'incident', text: '📞 Customer: "your site is broken??"' }); }
    // log
    while (this.shownLog < sim.log.length) {
      const e = sim.log[this.shownLog];
      if (!mon && e.level !== 'good' && e.level !== 'info' && !e.text.startsWith('📞') && sim.t - e.t < 8) break; // detection delay
      this.shownLog++;
      const time = `${String(8 + Math.floor(e.t * TICK_MIN / 60)).padStart(2, '0')}:${String((e.t * TICK_MIN) % 60).padStart(2, '0')}`;
      const line = h('div', { class: 'lrow ' + e.level }, h('span', { class: 'lt' }, time), h('span', {}, e.text), e.codex ? h('button', { class: 'link', onclick: () => App.panels.codex(e.codex) }, 'learn') : null);
      E.log.prepend(line);
      if (/SUSPENDED/.test(e.text)) sfx('suspended');
      else if (e.level === 'breach') sfx('breach_siren');
      else if (e.level === 'attack') sfx('attack_glitch');
      else if (e.level === 'incident') sfx(['az_outage', 'region_outage', 'provider_ban', 'legal_takedown'].includes(e.incident) ? 'outage' : 'incident_alert');
      else if (e.level === 'good') sfx('recovery');
      if (e.level === 'attack' && Math.random() < 0.6 && !S.villain) { const taunts = ['knock knock.', 'is this thing on?', 'your edge is showing.', 'tick tock.', 'cute firewall.']; E.log.prepend(h('div', { class: 'lrow null' }, h('span', { class: 'lt' }, 'NULL'), h('span', {}, taunts[Math.floor(Math.random() * taunts.length)]))); }
    }
    // actions
    if (sim.t % 2 === 0) this.renderActions();
  },
  renderActions() {
    const sim = this.sim;
    const key = action => JSON.stringify([action.id, action.cost, action.node?.uid, sim.incidents.indexOf(action.inc)]);
    const actions = sim.done ? [] : availableActions(sim);
    const signature = actions.map(action => key(action) + canSpend(action.cost)).join(';');
    // Keep an available button mounted while a finger is down between simulation ticks.
    if (signature === this.actionSignature) return;
    this.actionSignature = signature;
    this.el.actions.replaceChildren(...actions.map(action => h('button', {
      class: 'btn action', disabled: !canSpend(action.cost), onclick: () => {
        const stillAvailable = !sim.done && availableActions(sim).find(candidate => key(candidate) === key(action));
        if (!stillAvailable || !canSpend(stillAvailable.cost)) return this.renderActions();
        sfx('action_typing');
        spend(stillAvailable.cost, stillAvailable.label);
        doAction(sim, stillAvailable);
        renderHUD();
        this.renderActions();
      },
    }, action.label, h('small', {}, ' ' + money(action.cost)))));
  },
  // Leave the live run and go back to the drawing board (counts as an attempt).
  async abortRun() {
    const wasPaused = this.paused; this.paused = true;
    const left = attemptsLeft();
    const ok = await confirmBox(`Stop the run and go back to your design?<br>Infrastructure you've paid so far stays spent. You can redeploy ${left} more time${left === 1 ? '' : 's'} before the client wants a result.`, { ok: 'Stop & fix', title: 'Roll back?' });
    if (!ok || this.finished) { this.paused = wasPaused; return; }
    this.finished = true;
    this.backToDesign(results(this.sim).cost);
  },

  backToDesign(cost) {
    stopLoop('server_hum');
    S.active = { ...(S.active || {}), id: this.job.id, job: this.job, design: this.design, deployed: true,
      attempts: (S.active?.attempts || 0) + 1, spent: (S.active?.spent || 0) + cost };
    save(); renderHUD();
    show('build', this.job);
  },

  // The window is over: show what happened and let the player decide what to do next.
  async finish() {
    const res = results(this.sim);
    const preview = G.gradeBuild(this.job, this.design, res);
    stopLoop('server_hum');
    const left = attemptsLeft();
    const failing = preview.lines.filter(l => !l.ok);
    const lessons = runLessons(this.sim);
    const pre = review(this.design, this.job, S.skills).items.filter(i => i.level === 'error' || i.level === 'warn');
    const diag = h('div', { class: 'diagnose', hidden: true },
      failing.length ? h('div', {}, h('div', { class: 'panel-title' }, 'WHY IT MISSED'),
        ...failing.map(l => h('div', { class: 'diag-item' }, h('b', {}, l.text), h('p', {}, DIAG_HINT[l.key] || 'Check the event log and the Review tab.')))) : null,
      lessons.length ? h('div', {}, h('div', { class: 'panel-title' }, 'WHAT WENT WRONG DURING THE RUN'),
        ...lessons.slice(0, 6).map(l => h('div', { class: 'lesson' }, h('span', {}, l.text), l.codex ? h('button', { class: 'link', onclick: () => App.panels.codex(l.codex) }, 'learn') : null))) : null,
      pre.length ? h('div', {}, h('div', { class: 'panel-title' }, 'DESIGN REVIEW'),
        ...pre.slice(0, 8).map(i => h('div', { class: 'ritem ' + i.level }, h('span', {}, i.text), i.codex ? h('button', { class: 'link', onclick: () => App.panels.codex(i.codex) }, 'learn') : null))) : null,
      !failing.length && !lessons.length && !pre.length ? h('p', { class: 'muted' }, 'Nothing went wrong. Ship it.') : null);
    const diagBtn = h('button', { class: 'btn ghost', onclick: () => { diag.hidden = !diag.hidden; diagBtn.textContent = diag.hidden ? 'Diagnose' : 'Hide diagnosis'; } }, 'Diagnose');
    const choice = await new Promise(resolve => {
      const pick = value => () => { m.close(); resolve(value); };
      const m = modal(h('div', {},
        h('div', { class: 'results' },
          h('div', { class: 'grade g' + preview.grade }, preview.grade),
          h('div', { class: 'rcol' },
            h('p', { class: 'muted' }, failing.length ? 'The client hasn\'t seen this yet. Fix it, or hand it over as-is.' : 'Everything the client asked for is met.'),
            ...preview.lines.map(l => h('div', { class: 'rline ' + (l.ok ? 'ok' : 'no') }, (l.ok ? '✔ ' : '✖ ') + l.text)),
            h('p', { class: 'muted small' }, left > 0 ? `Redeploys left: ${left}. Infrastructure already paid stays spent; redeploying costs half the setup labor.` : 'No redeploys left. The client wants the result.'))),
        diag,
        h('div', { class: 'row end gap wrap' },
          diagBtn,
          left > 0 ? h('button', { class: 'btn ghost', onclick: pick('fix') }, 'Fix & redeploy') : null,
          h('button', { class: 'btn', onclick: pick('submit') }, failing.length ? 'Submit anyway' : 'Submit to client'))),
        { title: this.job.title + ' — run complete', wide: true, closable: false });
      if (failing.length) { diag.hidden = false; diagBtn.textContent = 'Hide diagnosis'; }
    });
    if (choice === 'fix') return this.backToDesign(res.cost);
    gradeSound(preview.grade);
    this.settle(res);
  },

  settle(res) {
    if (S.active?.id === this.job.id && S.active.upfront != null) this.job.upfront = S.active.upfront;
    const earlier = S.active?.id === this.job.id ? S.active.spent || 0 : 0;
    const out = G.settleBuild(this.job, this.design, res, this.sim);
    renderHUD();
    const lessons = runLessons(this.sim);
    const body = h('div', { class: 'results' },
      h('div', { class: 'grade g' + out.grade }, out.grade),
      h('div', { class: 'rcol' },
        ...out.lines.map(l => h('div', { class: 'rline ' + (l.ok ? 'ok' : 'no') }, (l.ok ? '✔ ' : '✖ ') + l.text)),
        h('table', { class: 'moneytable' }, ...out.rows.map(([k, v]) => h('tr', {}, h('td', {}, k), h('td', { class: v < 0 ? 'bad' : 'good' }, money(v, { sign: true })))),
          h('tr', {}, h('td', {}, 'Infrastructure you paid during the contract'), h('td', { class: 'bad' }, money(-out.infra))),
          earlier ? h('tr', {}, h('td', {}, 'Infrastructure from earlier attempts'), h('td', { class: 'bad' }, money(-earlier))) : null,
          h('tr', { class: 'total' }, h('td', {}, 'Net profit'), h('td', { class: out.net - (this.job.mode === 'signal' ? out.infra : 0) - earlier >= 0 ? 'good' : 'bad' }, money((this.job.mode === 'signal' ? out.net - out.infra : out.net) - earlier, { sign: true })))),
        h('div', {}, `+${num(out.xp)} XP`, S.villain ? '' : ` · reputation ${out.rep >= 0 ? '+' : ''}${out.rep}`)),
      lessons.length ? h('div', { class: 'lessons' }, h('div', { class: 'panel-title' }, 'LESSONS'), ...lessons.slice(0, 6).map(l => h('div', { class: 'lesson' }, h('span', {}, l.text), l.codex ? h('button', { class: 'link', onclick: () => App.panels.codex(l.codex) }, 'learn') : null))) : null);
    const m = modal(h('div', {}, body, h('div', { class: 'row end gap' },
      this.job.story && out.grade === 'F' ? h('span', { class: 'muted' }, 'Story contracts can be retried from the board.') : null,
      h('button', { class: 'btn', onclick: () => { m.close(); show('office'); runStory(); } }, 'Continue ▸'))), { title: this.job.title + ' — results', wide: true, closable: false });
  },
});
