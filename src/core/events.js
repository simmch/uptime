const handlers = {};
export function on(ev, fn) { (handlers[ev] ||= []).push(fn); return () => off(ev, fn); }
export function off(ev, fn) { handlers[ev] = (handlers[ev] || []).filter(f => f !== fn); }
export function emit(ev, data) { for (const fn of handlers[ev] || []) { try { fn(data); } catch (e) { console.error(e); } } }
