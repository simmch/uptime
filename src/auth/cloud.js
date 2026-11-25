// Account session and the one cloud save that belongs to it.
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './public.js';
import { S, setState } from '../core/state.js';
import { on, emit } from '../core/events.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
});

let session = null;
let recoveryPending = false;

supabase.auth.onAuthStateChange((event, next) => {
  session = next;
  if (event === 'PASSWORD_RECOVERY') recoveryPending = true;
});

export function signedInEmail() { return session?.user?.email || null; }
export function userId() { return session?.user?.id || null; }
export function takeRecovery() {
  const pending = recoveryPending;
  recoveryPending = false;
  return pending;
}

export async function startAccount() {
  const { data } = await supabase.auth.getSession();
  session = data.session;
  const arrivingFromEmail = /[?&]code=/.test(location.search) || location.hash.includes('type=recovery');
  if (arrivingFromEmail) {
    await new Promise(resolve => {
      const stop = setTimeout(resolve, 1500);
      const { data: sub } = supabase.auth.onAuthStateChange(event => {
        if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
          clearTimeout(stop);
          sub.subscription.unsubscribe();
          resolve();
        }
      });
    });
  }
  const recovery = takeRecovery();
  if (session && !recovery) {
    try { await reconcile(); }
    catch (error) { emit('cloud-error', accountError(error)); }
  }
  return { recovery, email: signedInEmail() };
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  session = data.session;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  session = data.session;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  session = null;
  if (error) throw error;
}

// Sends the recovery mail. The message carries a temporary password and a link.
export async function requestTemporaryPassword(email) {
  const redirectTo = `${location.origin}${location.pathname}`;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) throw error;
}

// The temporary password proves they received the email. Then the new one replaces it.
export async function setPermanentPassword({ email, temporary, password }) {
  if (temporary) {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(), token: temporary.replace(/\s/g, ''), type: 'recovery',
    });
    if (error) throw error;
    session = data.session;
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export function accountError(error) {
  const msg = String(error?.message || 'Something went wrong.');
  if (/invalid login credentials/i.test(msg)) return 'That email or password is not right.';
  if (/already registered|already been registered/i.test(msg)) return 'That email already has an account. Sign in instead.';
  if (/password/i.test(msg) && /least|short|weak|characters/i.test(msg)) return 'Use at least 8 characters.';
  if (/rate limit|too many|once every/i.test(msg)) return 'The email service needs a minute. Try again shortly.';
  if (/otp|token|expired|invalid/i.test(msg)) return 'That temporary password is wrong or has expired. Send a new one.';
  if (/valid email|unable to validate email/i.test(msg)) return 'Enter a real email address.';
  if (/email not confirmed/i.test(msg)) return 'Confirm the email first, then sign in. The message is in your inbox.';
  return 'That did not work. Check the details and try again.';
}

async function pullCloud() {
  if (!session) return null;
  const { data, error } = await supabase.from('saves').select('state, saved_at').eq('user_id', session.user.id).maybeSingle();
  if (error) throw error;
  if (!data?.state || typeof data.state !== 'object') return null;
  if (!data.state.savedAt && data.saved_at) data.state.savedAt = Date.parse(data.saved_at);
  return data.state;
}

export async function pushCloud() {
  if (!session || !S) return false;
  const { error } = await supabase.from('saves').upsert({
    user_id: session.user.id,
    state: S,
    saved_at: new Date(S.savedAt || Date.now()).toISOString(),
  });
  if (error) throw error;
  return true;
}

let timer = null;
function schedulePush() {
  if (!session || !S) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    pushCloud().catch(error => emit('cloud-error', accountError(error)));
  }, 3000);
}

on('saved', schedulePush);

export function flushCloud() {
  clearTimeout(timer);
  timer = null;
  if (session && S) pushCloud().catch(error => emit('cloud-error', accountError(error)));
}

export async function accountSave() {
  const remote = await pullCloud();
  if (remote && session && !remote.owner) remote.owner = session.user.id;
  return remote;
}

// The account is the save. A game already on this account follows the newer
// copy. A different game in this tab waits for the player to choose.
export async function reconcile() {
  if (!session) return 'signed-out';
  const remote = await accountSave();
  if (!S) {
    if (!remote) return 'empty';
    setState(remote);
    return 'loaded';
  }
  if (!remote) return keepCurrentGame();
  if (S.owner === session.user.id) {
    if ((remote.savedAt || 0) > (S.savedAt || 0)) {
      setState(remote);
      return 'loaded';
    }
    return keepCurrentGame();
  }
  return 'conflict';
}

export async function keepCurrentGame() {
  if (!session || !S) return 'empty';
  S.owner = session.user.id;
  S.savedAt = Date.now();
  await pushCloud();
  return 'stored';
}
