// Save documents. A save is either the raw game state, a downloaded file
// ({ uptime, state }), or the base64 code from older exports.

export function fileSave(state) {
  return JSON.stringify({ uptime: 1, savedAt: state.savedAt || null, state });
}

export function unpackSave(raw) {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  let data;
  if (text.startsWith('{')) {
    try { data = JSON.parse(text); } catch { return null; }
  } else {
    try { data = JSON.parse(decodeURIComponent(escape(atob(text)))); } catch { return null; }
  }
  const state = data?.uptime === 1 && data.state ? data.state : data;
  if (!state || typeof state !== 'object') return null;
  if (typeof state.name !== 'string' || !Number.isFinite(state.day) || !Number.isFinite(state.level)) return null;
  return state;
}

// A recorded save time wins. Two saves with no time are compared by how far the game has gone.
export function newerSave(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  const ta = a.savedAt || 0;
  const tb = b.savedAt || 0;
  if (ta !== tb) return ta > tb ? a : b;
  if ((a.day || 0) !== (b.day || 0)) return a.day > b.day ? a : b;
  if ((a.xp || 0) !== (b.xp || 0)) return a.xp > b.xp ? a : b;
  return a;
}
