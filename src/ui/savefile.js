// Download and load a save file. The title screen and Save & Settings share this.
import { h, toast, confirmBox, esc } from './dom.js';
import { S, save, load, setState, saveFile } from '../core/state.js';
import { unpackSave } from '../core/save.js';

export function downloadSave() {
  if (!S) return;
  save();
  const blob = new Blob([saveFile()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const name = (S.name || 'player').replace(/[^\w.-]+/g, '-').slice(0, 24);
  const link = h('a', { href: url, download: `uptime-${name}-day${S.day}.json` });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  toast('Save file downloaded. Load it from the title screen to get this progress back.');
}

function chooseSaveFile() {
  return new Promise(resolve => {
    let settled = false;
    const done = value => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };
    const input = h('input', {
      type: 'file',
      accept: '.json,.txt,application/json',
      style: { position: 'fixed', left: '-9999px' },
      onchange: async () => {
        const file = input.files?.[0];
        if (!file) return done(null);
        try {
          const next = unpackSave(await file.text());
          if (!next) { toast('That file is not an UPTIME save.', 'bad'); return done(null); }
          done(next);
        } catch {
          toast('That file is not an UPTIME save.', 'bad');
          done(null);
        }
      },
    });
    input.addEventListener('cancel', () => done(null));
    document.body.append(input);
    input.click();
  });
}

// Returns true when a save was loaded into the current session.
export async function loadSaveFile() {
  const next = await chooseSaveFile();
  if (!next) return false;
  const current = S || load();
  if (current && !(await confirmBox(
    `Load <b>${esc(next.name)}</b>, day ${next.day}, level ${next.level}?<br>The save on this device will be replaced.`,
    { ok: 'Load save', title: 'Load progress?' }))) return false;
  setState(next);
  if (save()) toast('Progress restored.', 'good');
  else toast('Loaded for now, but this browser could not keep it. Download the file again before you leave.', 'warn', 6000);
  return true;
}
