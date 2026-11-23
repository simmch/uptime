import './life.css';
import { App, openDesk, registerScreen, show } from './app.js';
import { $, h, modal, toast } from './dom.js';
import { S, home, save } from '../core/state.js';
import { on } from '../core/events.js';
import { care, takeGroceryTrip } from '../core/life.js';
import { CARE, HOME_SPAWN } from '../data/life.js';
import { icon } from '../render/atlas.js';
import { sfx } from '../audio/sfx.js';
import { openDecor, openGroceries, openPhone, watchTV } from './phone.js';

const MOVEMENT = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

const clockLabel = minute => {
  const hour = Math.floor(minute / 60);
  return `${hour % 12 || 12}:${String(minute % 60).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
};

function actionButton(label, onclick, options = {}) {
  return h('button', { type: 'button', class: 'btn', onclick, ...options }, label);
}

function kitchen() {
  const body = h('div', { class: 'life-panel' });
  const render = () => {
    const canEat = S.life.meals > 0;
    const pantry = S.life.lastPantry !== S.day;
    body.replaceChildren(
      h('p', {}, `${S.life.meals} meals in the kitchen.`),
      h('p', { class: 'muted' }, canEat ? 'Make a meal to restore fullness. It takes 24 in-game minutes.' :
        pantry ? 'You’re out of groceries. There’s enough in the cupboard for a small meal today.' :
          'The cupboard is empty for today. Order groceries or drive to the store.'),
      h('div', { class: 'row gap wrap' },
        actionButton(canEat ? 'Eat a meal' : 'Make a pantry meal', () => {
          if (care(canEat ? 'eat' : 'pantry')) { room.close(); toast('Fullness restored.', 'good'); }
        }, { disabled: !canEat && !pantry }),
        actionButton('Order groceries', () => openGroceries('delivery'), { class: 'btn ghost' })));
  };
  const room = modal(body, { title: 'Kitchen', onClose: () => off() });
  const off = on('life', render);
  render();
}

function sleep() {
  const sleepModal = modal(h('div', { class: 'life-panel' },
    h('p', {}, 'Sleep until 7 AM tomorrow. Rest restores energy and tomorrow brings new contracts and news.'),
    h('div', { class: 'row end' }, actionButton('Sleep until morning', () => {
      if (care('sleep')) {
        sleepModal.close();
        App.world.buildOffice(S);
        toast('It’s a new day. Energy restored.', 'good');
      }
    }))), { title: 'Bedroom' });
}

function driveToMarket() {
  const leave = modal(h('div', { class: 'life-panel' },
    h('p', {}, 'Pick up groceries at Corner Market and save the $8 delivery fee. Each leg takes 15 in-game minutes.'),
    h('div', { class: 'row gap wrap' },
      actionButton('Drive to Corner Market', () => {
        leave.close();
        show('drive', {
          trip: 'market',
          onArrival() {
            takeGroceryTrip();
            openGroceries('market', () => show('drive', {
              trip: 'home',
              onArrival() {
                takeGroceryTrip();
                Object.assign(S.life.position, HOME_SPAWN);
                save();
                show('office');
              },
            }));
          },
        });
      }),
      actionButton('Order online', () => openGroceries('delivery'), { class: 'btn ghost' }))), { title: 'Car keys' });
}

function interact(station) {
  const actions = {
    desk: openDesk,
    kitchen,
    bed: sleep,
    tv: watchTV,
    keys: driveToMarket,
    toilet: () => { care('toilet'); toast('Restroom need satisfied.', 'good'); },
    shower: () => { care('shower'); toast('Hygiene restored.', 'good'); },
    'wing-reading': () => relax(),
    'wing-terrace': () => relax(),
    'wing-nursery': () => App.panels.legacy('family'),
    'wing-dining': () => App.panels.legacy('family'),
    'wing-play': () => App.panels.legacy('family'),
    'wing-guest': () => App.panels.legacy('friends'),
    'wing-server': () => App.panels.legacy('company'),
    'wing-boardroom': () => App.panels.legacy('company'),
  };
  actions[station.id]();
}

function relax() {
  if (care('relax')) toast('Took a break. Morale restored.', 'good');
  else toast('You’ve already taken this break today.');
}

function homeMeters() {
  const needs = Object.entries(CARE).map(([key, item]) => {
    const fill = h('span', { style: { background: item.color } });
    const value = h('span', { class: 'need-value' });
    const bar = h('div', { class: 'need-bar', role: 'meter', 'aria-label': item.label,
      'aria-valuemin': '0', 'aria-valuemax': '100' }, fill);
    const row = h('div', { class: 'need' }, h('div', { class: 'row between' }, item.label, value), bar);
    return { key, row, fill, value, bar };
  });
  const time = h('span', { class: 'life-time' });
  const kitchenCount = h('span', { class: 'life-meals' });
  const panel = h('aside', { class: 'home-status', 'aria-label': 'Daily needs' },
    h('div', { class: 'home-status-header' },
      h('div', { class: 'life-kicker' }, 'HOME'),
      h('h2', {}, S.home === 'couch' ? 'Mara’s place' : home().name),
      time),
    h('div', { class: 'home-needs' }, needs.map(need => need.row)),
    kitchenCount);
  function render() {
    time.textContent = clockLabel(S.life.minute);
    kitchenCount.textContent = `${S.life.meals} meals stocked`;
    for (const { key, row, fill, value, bar } of needs) {
      const amount = Math.round(S.life.needs[key]);
      value.textContent = amount;
      bar.setAttribute('aria-valuenow', amount);
      fill.style.width = amount + '%';
      row.classList.toggle('urgent', amount < 14);
    }
  }
  render();
  return { panel, render };
}

registerScreen('office', {
  enter(root) {
    App.world.buildOffice(S);
    const input = new AbortController();
    const signal = input.signal;
    const keys = new Set();
    const touches = new Map();
    const controls = homeMeters();
    const promptLabel = h('span');
    const prompt = actionButton('', () => useNearby(), { class: 'home-interact', hidden: true });
    prompt.append(h('kbd', {}, 'E'), promptLabel);
    const phone = actionButton('Ask a friend', () => openPhone(), { class: 'home-phone help-button' });
    phone.prepend(h('span', { html: icon('phone', 28) }));
    const decorate = actionButton('Decorate', openDecor, { class: 'btn ghost small home-decorate' });
    const hint = h('span', { class: 'home-walk-hint' }, h('span', { class: 'desktop-input-hint' }, 'WASD / arrows to walk'),
      h('span', { class: 'touch-input-hint' }, 'Tap the floor to walk · tap an item to use it'));
    const objective = h('span', { class: 'home-objective', hidden: Boolean(S.jobsDone) }, 'Walk to your computer to start work');
    let selectedId;
    let walking = false;
    let distanceToStep = 0;

    function isPaused() {
      return App.busy || !!$('#modals .modal-back, #dialogue.on, .chapter-card.on');
    }

    function useNearby() {
      if (isPaused()) return;
      const nearby = App.world.homeView.nearest();
      if (nearby) {
        release();
        interact(nearby);
      }
    }

    function release() {
      if (walking || keys.size || touches.size) save();
      keys.clear();
      touches.clear();
      walkTo = null;
      distanceToStep = 0;
    }

    // Touch: hold a finger on the floor to walk toward it; tap to walk there.
    // Tapping a station (bed, computer, …) walks over and uses it.
    let walkTo = null, stuck = 0;
    const canvas = App.world.renderer.domElement;
    const aim = (event, final) => {
      const view = App.world.homeView;
      const point = view?.groundPoint(event.clientX, event.clientY);
      if (!point) return;
      const station = final ? view.stationNear(point.x, point.z) : null;
      walkTo = station ? { x: station.x, z: station.z, station } : { x: point.x, z: point.z };
      stuck = 0;
    };
    canvas.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'touch' || isPaused()) return;
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY, t: performance.now() });
      aim(event, false);
    }, { signal });
    canvas.addEventListener('pointermove', event => {
      if (touches.has(event.pointerId) && !isPaused()) aim(event, false);
    }, { signal });
    for (const name of ['pointerup', 'pointercancel']) {
      canvas.addEventListener(name, event => {
        const start = touches.get(event.pointerId);
        if (!touches.delete(event.pointerId)) return;
        if (name === 'pointercancel') { walkTo = null; return; }
        // A quick tap keeps walking to the spot (or station); a hold stops when lifted.
        const tap = performance.now() - start.t < 350 && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 14;
        if (tap) aim(event, true); else walkTo = null;
      }, { signal });
    }

    root.append(controls.panel, h('div', { class: 'home-action-bar' }, prompt, objective, hint),
      h('div', { class: 'home-utilities' }, decorate, phone));

    window.addEventListener('keydown', event => {
      if (isPaused() || event.metaKey || event.ctrlKey || event.altKey || event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      if (MOVEMENT[event.code]) {
        event.preventDefault();
        if (!event.repeat) keys.add(event.code);
      } else if (event.code === 'KeyE' && !event.repeat) {
        event.preventDefault();
        useNearby();
      } else if (event.code === 'KeyP' && !event.repeat) {
        event.preventDefault();
        release();
        openPhone();
      }
    }, { signal });
    window.addEventListener('keyup', event => keys.delete(event.code), { signal });
    window.addEventListener('blur', release, { signal });
    window.addEventListener('pagehide', release, { signal });
    document.addEventListener('visibilitychange', () => { if (document.hidden) release(); }, { signal });

    App.world.homeTick = dt => {
      if (isPaused()) {
        if (keys.size || touches.size || walkTo) release();
        return;
      }
      const pressed = new Set(keys);
      const directions = [...pressed].map(key => MOVEMENT[key]);
      const axis = index => Number(directions.some(value => value[index] > 0)) - Number(directions.some(value => value[index] < 0));
      const view = App.world.homeView;
      if (pressed.size) walkTo = null;
      let horizontal = axis(0), vertical = axis(1);
      if (walkTo) {
        const arrived = walkTo.station ? view.nearest()?.id === walkTo.station.id && Math.hypot(view.position.x - walkTo.x, view.position.z - walkTo.z) < 0.7 : false;
        const toward = arrived ? null : view.inputToward(walkTo.x, walkTo.z);
        if (toward) { horizontal = toward.horizontal; vertical = toward.vertical; }
        else {
          const station = walkTo.station; walkTo = null;
          if (station && !touches.size) { release(); interact(station); return; }
        }
      }
      const moving = pressed.size > 0 || !!walkTo;
      if (!moving && walking) save();
      walking = moving;
      const { x, z } = view.position;
      const nearby = view.update(horizontal, vertical, dt);
      const distance = Math.hypot(view.position.x - x, view.position.z - z);
      if (walkTo && distance < 0.002) {
        // Walked into furniture: stop, or settle for "close enough" to a station.
        if ((stuck += dt) > 0.3) {
          const station = walkTo.station; walkTo = null;
          if (station && view.nearest()?.id === station.id && !touches.size) { release(); interact(station); return; }
        }
      } else stuck = 0;
      if (distance > 0) {
        distanceToStep -= distance;
        if (distanceToStep <= 0) {
          sfx('footstep');
          distanceToStep += 1.4;
        }
      } else {
        distanceToStep = 0;
      }
      if (nearby?.id !== selectedId || (nearby && prompt.hidden)) {
        selectedId = nearby?.id;
        prompt.hidden = !nearby;
        objective.hidden = Boolean(nearby || S.jobsDone);
        promptLabel.textContent = nearby?.action || '';
      }
    };
    const offLife = on('life', controls.render);
    const offState = on('state', controls.render);
    this.cleanup = () => { offLife(); offState(); release(); input.abort(); };
  },
  leave() {
    this.cleanup?.();
    this.cleanup = null;
    if (App.world) App.world.homeTick = null;
  },
});
