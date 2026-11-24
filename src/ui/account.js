// Sign in, create an account, and replace a forgotten password.
import './account.css';
import { h, modal, toast } from './dom.js';
import { App, show, renderHUD } from './app.js';
import { on } from '../core/events.js';
import { S, load, setState } from '../core/state.js';
import {
  signedInEmail, signUp, signIn, signOut, requestTemporaryPassword, setPermanentPassword,
  accountError, reconcile, pushCloud,
} from '../auth/cloud.js';

on('cloud-error', message => toast(message, 'bad', 5200));

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const field = (label, input) => h('label', { class: 'stack' }, h('span', {}, label), input);

export function openAccount({ recovery = false } = {}) {
  const root = h('div', { class: 'account' });
  const dialog = modal(root, { title: 'ACCOUNT' });
  let busy = false;

  const run = async fn => {
    if (busy) return;
    busy = true;
    try { await fn(); }
    catch (error) { console.error(error); toast(accountError(error), 'bad', 5200); }
    finally { busy = false; }
  };

  const backToGame = () => {
    dialog.close();
    if (App.screen === 'title') show('title');
    else renderHUD();
  };

  const finish = async message => {
    if (!signedInEmail()) { toast(message, 'good', 5600); return; }
    const result = await reconcile();
    const extra = result === 'loaded' ? ' Your cloud save is the newer one, so it is loaded here.' : ' This game is stored on your account.';
    toast(message + extra, 'good', 5200);
    backToGame();
  };

  const home = () => {
    const who = signedInEmail();
    if (who) {
      root.replaceChildren(
        h('p', {}, `Signed in as ${who}. Progress on this device is copied to that account.`),
        h('div', { class: 'row gap wrap' },
          h('button', { class: 'btn', type: 'button', onclick: () => run(async () => {
            if (!S && load()) setState(load());
            if (!S) return toast('Start or continue a game first.', 'info');
            await pushCloud();
            toast('Saved to your account.', 'good');
          }) }, 'Save to account'),
          h('button', { class: 'btn ghost', type: 'button', onclick: () => run(async () => {
            await signOut();
            toast('Signed out.');
            backToGame();
          }) }, 'Sign out')));
      return;
    }
    root.replaceChildren(
      h('p', {}, 'An account keeps your game in the cloud. Sign in on any browser and the save is there.'),
      h('div', { class: 'row gap wrap' },
        h('button', { class: 'btn', type: 'button', onclick: () => signInForm() }, 'Sign in'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => createForm() }, 'Create account')),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => forgot() }, 'Forgot password'));
  };

  const signInForm = (prefill = '') => {
    const email = h('input', { class: 'txt', type: 'email', autocomplete: 'username', value: prefill, required: true });
    const password = h('input', { class: 'txt', type: 'password', autocomplete: 'current-password', required: true });
    root.replaceChildren(h('form', { onsubmit: event => {
      event.preventDefault();
      if (!EMAIL.test(email.value.trim())) return toast('Enter a real email address.', 'bad');
      run(async () => { await signIn(email.value.trim(), password.value); await finish('Signed in.'); });
    } },
      field('Email', email),
      field('Password', password),
      h('div', { class: 'row gap wrap' },
        h('button', { class: 'btn', type: 'submit' }, 'Sign in'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => home() }, 'Back')),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => forgot(email.value) }, 'Forgot password')));
  };

  const createForm = () => {
    const email = h('input', { class: 'txt', type: 'email', autocomplete: 'username', required: true });
    const password = h('input', { class: 'txt', type: 'password', autocomplete: 'new-password', required: true });
    const again = h('input', { class: 'txt', type: 'password', autocomplete: 'new-password', required: true });
    root.replaceChildren(h('form', { onsubmit: event => {
      event.preventDefault();
      if (!EMAIL.test(email.value.trim())) return toast('Enter a real email address.', 'bad');
      if (password.value.length < 8) return toast('Use at least 8 characters.', 'bad');
      if (password.value !== again.value) return toast('Those passwords do not match.', 'bad');
      run(async () => {
        const data = await signUp(email.value.trim(), password.value);
        if (!data.session) {
          toast('Check your email and confirm the account, then sign in.', 'good', 6000);
          signInForm(email.value.trim());
          return;
        }
        await finish('Account created.');
      });
    } },
      field('Email', email),
      field('Password', password),
      field('Confirm password', again),
      h('p', { class: 'muted small' }, 'The email is only used to send a new password if you forget this one.'),
      h('div', { class: 'row gap wrap' },
        h('button', { class: 'btn', type: 'submit' }, 'Create account'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => home() }, 'Back'))));
  };

  const forgot = (prefill = '') => {
    const email = h('input', { class: 'txt', type: 'email', autocomplete: 'username', value: prefill, required: true });
    root.replaceChildren(h('form', { onsubmit: event => {
      event.preventDefault();
      if (!EMAIL.test(email.value.trim())) return toast('Enter a real email address.', 'bad');
      run(async () => {
        await requestTemporaryPassword(email.value.trim());
        toast('If that email has an account, a temporary password is on its way.', 'good', 5600);
        chooseNew(email.value.trim());
      });
    } },
      h('p', {}, 'A temporary password will arrive by email. Enter it here, then choose a new one.'),
      field('Email', email),
      h('div', { class: 'row gap wrap' },
        h('button', { class: 'btn', type: 'submit' }, 'Email a temporary password'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => home() }, 'Back'))));
  };

  const chooseNew = (known = '', fromLink = false) => {
    const email = h('input', { class: 'txt', type: 'email', autocomplete: 'username', value: known, required: true });
    const temporary = h('input', { class: 'txt temp', inputmode: 'text', autocomplete: 'one-time-code', placeholder: 'From the email', required: !fromLink });
    const password = h('input', { class: 'txt', type: 'password', autocomplete: 'new-password', required: true });
    const again = h('input', { class: 'txt', type: 'password', autocomplete: 'new-password', required: true });
    root.replaceChildren(h('form', { onsubmit: event => {
      event.preventDefault();
      if (!fromLink && !EMAIL.test(email.value.trim())) return toast('Enter a real email address.', 'bad');
      if (!fromLink && temporary.value.trim().length < 6) return toast('Enter the temporary password from the email.', 'bad');
      if (password.value.length < 8) return toast('Use at least 8 characters.', 'bad');
      if (password.value !== again.value) return toast('Those new passwords do not match.', 'bad');
      run(async () => {
        await setPermanentPassword({
          email: email.value.trim(),
          temporary: fromLink ? '' : temporary.value,
          password: password.value,
        });
        await finish('New password saved. You are signed in.');
      });
    } },
      h('p', {}, fromLink
        ? 'The email link signed you in for this step. Choose the password you want to keep.'
        : 'Enter the temporary password from the email, then choose a permanent one.'),
      fromLink ? null : field('Email', email),
      fromLink ? null : field('Temporary password', temporary),
      field('New password', password),
      field('Confirm new password', again),
      h('div', { class: 'row gap wrap' },
        h('button', { class: 'btn', type: 'submit' }, 'Save new password'),
        fromLink ? null : h('button', { class: 'btn ghost', type: 'button', onclick: () => forgot(email.value) }, 'Send another'))));
  };

  if (recovery) chooseNew('', true);
  else home();
}

export function accountSummary() {
  const box = h('div', { class: 'account-summary' }, h('p', { class: 'muted' }, 'Checking your account…'));
  const paint = () => {
    const who = signedInEmail();
    box.replaceChildren(
      h('div', { class: 'panel-title' }, 'ACCOUNT'),
      who
        ? h('p', {}, `Signed in as ${who}. Progress on this device is copied to that account.`)
        : h('p', {}, 'Sign in to keep this game on your account and open it in any browser.'),
      h('div', { class: 'row gap wrap' },
        h('button', { class: 'btn', type: 'button', onclick: () => openAccount() }, who ? 'Account' : 'Sign in or create account')));
  };
  paint();
  return box;
}
