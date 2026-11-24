// Save documents round-trip, and the newer copy wins.
import { fileSave, newerSave, unpackSave } from '../src/core/save.js';

let fail = 0;
const bad = msg => { console.log(msg); fail++; };

const state = { name: 'Avery', day: 4, level: 2, xp: 80, savedAt: 50, money: 900 };
const file = fileSave(state);
const back = unpackSave(file);
if (back?.name !== 'Avery' || back.day !== 4 || back.savedAt !== 50) bad('file round trip failed');

const code = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
const fromCode = unpackSave(code);
if (fromCode?.name !== 'Avery' || fromCode.level !== 2) bad('save code round trip failed');

if (unpackSave('not a save') !== null) bad('garbage was accepted');
if (unpackSave('{"name":"x"}') !== null) bad('incomplete state was accepted');
if (unpackSave('{"uptime":1,"state":{"hello":1}}') !== null) bad('wrapped garbage was accepted');

const older = { name: 'Avery', day: 3, level: 2, xp: 10, savedAt: 10 };
const plain = { name: 'Avery', day: 9, level: 3, xp: 40 };
const earlier = { name: 'Avery', day: 2, level: 1, xp: 5 };
if (newerSave(state, older) !== state) bad('older timestamp won');
if (newerSave(null, older) !== older) bad('missing copy was kept');
if (newerSave(plain, earlier) !== plain) bad('untimestamped further day lost');
if (newerSave(plain, older) !== older) bad('a save with no time beat a recorded one');

console.log(fail ? `${fail} PROBLEM(S)` : 'SAVE FORMAT OK');
process.exit(fail ? 1 : 0);
