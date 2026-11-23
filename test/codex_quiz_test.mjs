// Every Codex entry has a valid quick test.
import { CODEX } from '../src/data/codex.js';
import { CODEX_QUIZ } from '../src/data/codexquiz.js';
let fail = 0;
for (const e of CODEX) if (!CODEX_QUIZ[e.id]?.length) { console.log('missing quick test:', e.id); fail++; }
for (const [id, qs] of Object.entries(CODEX_QUIZ)) {
  if (!CODEX.some(e => e.id === id)) { console.log('quick test for unknown entry:', id); fail++; }
  for (const q of qs) if (!q.q || !q.ex || !(q.c >= 0 && q.c < q.a.length) || new Set(q.a).size !== q.a.length) { console.log('bad question:', id, q.q); fail++; }
}
console.log(fail ? `${fail} PROBLEM(S)` : `ALL ${Object.values(CODEX_QUIZ).flat().length} CODEX QUESTIONS OK`);
process.exit(fail ? 1 : 0);
