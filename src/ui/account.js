// Sign in, create an account, and replace a forgotten password.
import './account.css';
import { h, modal, toast, confirmBox, esc } from './dom.js';
import { App, show, renderHUD } from './app.js';
import { on } from '../core/events.js';
import { S, setState, clearState, save } from '../core/state.js';
import {
  signedInEmail, signUp, signIn, signOut, requestTemporaryPassword, setPermanentPassword,
  accountError, reconcile, pushCloud, accountSave, keepCurrentGame,
} from '../auth/cloud.js';

on('cloud-error', message => toast(message, 'bad', 5200));

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const field = (label, input) => h('label', { class: 'stack' }, h('span', {}, label), input);

export function openAccount({ recovery = false, view = 'home' } = {}) {
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
    let result = await reconcile();
    if (result === 'conflict') {
      const remote = await accountSave();
      const keep = await confirmBox(
        `This account already has a game for <b>${esc(remote?.name || 'someone')}</b>, day ${remote?.day || 1}. Save the game you are playing onto the account, or load the one already there?`,
        { ok: 'Save this game', cancel: 'Load account save', title: 'Two games' },
      );
      if (keep) result = await keepCurrentGame();
      else {
        setState(remote);
        result = 'loaded';
      }
    }
    const extra = {
      loaded: ' Your account save is ready.',
      stored: ' This game is saved to your account.',
      empty: ' Start a game and it is saved to your account.',
    }[result] || '';
    toast(message + extra, 'good', 5200);
    if (result === 'loaded' && App.screen !== 'title') {
      dialog.close();
      location.reload();
      return;
    }
    backToGame();
  };

  const home = () => {
    const who = signedInEmail();
    if (who) {
      root.replaceChildren(
        h('p', {}, `Signed in as ${who}. The account holds the save. Sign in again on any browser to pick the game up.`),
        h('div', { class: 'row gap wrap' },
          h('button', { class: 'btn', type: 'button', onclick: () => run(async () => {
            if (!S) return toast('Start a game first.', 'info');
            save({ remote: false });
            await pushCloud();
            toast('Saved to your account.', 'good');
            renderHUD();
          }) }, 'Save now'),
          h('button', { class: 'btn ghost', type: 'button', onclick: () => run(async () => {
            if (S) { save({ remote: false }); await pushCloud(); }
            await signOut();
            if (App.screen === 'title') clearState();
            toast(App.screen === 'title' ? 'Signed out.' : 'Signed out. The account has the game up to now. Anything you do next lasts until you leave.', 'info', 5200);
            backToGame();
          }) }, 'Sign out')));
      return;
    }
    root.replaceChildren(
      h('p', {}, 'An account is the save. Play now and create one when you want to keep the game. Leave without one and the progress is gone.'),
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
          toast('Check your email and confirm the account, then sign in. Keep this tab open so this game is still here to save.', 'good', 7000);
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
  else if (view === 'sign-in') signInForm();
  else if (view === 'create') createForm();
  else home();
}

export function accountSummary() {
  const box = h('div', { class: 'account-summary' }, h('p', { class: 'muted' }, 'Checking your account…'));
  const paint = () => {
    const who = signedInEmail();
    box.replaceChildren(
      h('div', { class: 'panel-title' }, 'ACCOUNT'),
      who
        ? h('p', {}, `Signed in as ${who}. This game is saved to that account.`)
        : h('p', {}, 'This game lasts until you leave. Create an account to keep it, then sign in to pick it up.'),
      h('div', { class: 'row gap wrap' },
        h('button', { class: 'btn', type: 'button', onclick: () => openAccount() }, who ? 'Account' : 'Sign in or create account')));
  };
  paint();
  return box;
}

App.openAccount = openAccount;
