import fs from 'fs';
import { COMPONENTS } from '../src/data/components.js';
import { SKILLS, SKILL } from '../src/data/skills.js';
import { CODEX_BY_ID, codexEntry } from '../src/data/codex.js';
import { INCIDENTS } from '../src/sim/incidents.js';
import { CHARS, STORY_JOBS, CHAPTERS } from '../src/data/story.js';
import { DOMAINS } from '../src/data/domains.js';
import { QUIZ } from '../src/data/quiz.js';
import { CERTS, GEAR } from '../src/core/state.js';
import { NET_SCENARIOS, PORTFOLIOS, RECON_TARGETS } from '../src/data/labs.js';
import { CHALLENGES } from '../src/data/terminal.js';
const atlas = JSON.parse(fs.readFileSync(new URL('../public/sprites/atlas.json', import.meta.url))).frames;
const bad = [];
const spr = (k, w) => { if (!atlas[k]) bad.push(`sprite ${k} (${w})`); };
for (const c of COMPONENTS) { spr(c.sprite, c.id); if (c.skill && !SKILL[c.skill]) bad.push('skill ' + c.skill + ' in ' + c.id); if (!codexEntry(c.codex)) bad.push('codex ' + c.codex); for (const f of c.config || []) { if (f.skill && !SKILL[f.skill]) bad.push('cfg skill ' + f.skill); for (const o of f.options || []) if (o.skill && !SKILL[o.skill]) bad.push('opt skill ' + o.skill); } }
for (const s of SKILLS) { for (const r of s.req) if (!SKILL[r]) bad.push('req ' + r + ' of ' + s.id); if (!DOMAINS[s.domain]) bad.push('dom ' + s.id); }
for (const [k, i] of Object.entries(INCIDENTS)) { if (!codexEntry(i.codex)) bad.push('incident codex ' + i.codex); spr(i.sprite, k); }
for (const c of Object.values(CHARS)) spr(c.sprite, c.name);
for (const d of Object.values(DOMAINS)) spr(d.sprite, d.name);
for (const g of GEAR) spr(g.sprite, g.id);
for (const [id, j] of Object.entries(STORY_JOBS)) { if (!CHARS[j.client]) bad.push('client ' + id); for (const s of j.requireSkills || []) if (!SKILL[s]) bad.push('reqskill ' + s); for (const sc of j.scenarios || []) if (!NET_SCENARIOS[sc]) bad.push('scenario ' + sc); for (const t of j.targets || []) if (!RECON_TARGETS[t]) bad.push('target ' + t); for (const c of j.challenges || []) if (!CHALLENGES[c]) bad.push('challenge ' + c); if (j.portfolio && !PORTFOLIOS[j.portfolio]) bad.push('portfolio'); for (const i of j.req?.incidents || []) if (!INCIDENTS[i.type]) bad.push('inc ' + i.type); }
for (const ch of CHAPTERS) for (const st of ch.steps) { if (st.job && !STORY_JOBS[st.job]) bad.push('step job ' + st.job); for (const s of st.gate?.skills || []) if (!SKILL[s]) bad.push('gate skill ' + s); if (st.gate?.cert && !CERTS[st.gate.cert]) bad.push('gate cert'); for (const [w] of st.lines || []) if (!CHARS[w]) bad.push('char ' + w); }
for (const q of QUIZ) if (q.c >= q.a.length) bad.push('quiz ' + q.q);
for (const c of Object.values(CERTS)) if (c.needSkill && !SKILL[c.needSkill]) bad.push('cert skill');
const per = {}; for (const q of QUIZ) per[q.d] = (per[q.d] || 0) + 1;
console.log('components', COMPONENTS.length, 'skills', SKILLS.length, 'codex', Object.keys(CODEX_BY_ID).length, 'quiz', QUIZ.length, JSON.stringify(per), 'story jobs', Object.keys(STORY_JOBS).length, 'incidents', Object.keys(INCIDENTS).length, 'challenges', Object.keys(CHALLENGES).length);
console.log(bad.length ? 'PROBLEMS:\n' + bad.join('\n') : 'ALL REFERENCES OK');
