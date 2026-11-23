import './legacy.css';
import { App } from './app.js';
import { h, modal, money, confirmBox, toast, esc } from './dom.js';
import { icon } from '../render/atlas.js';
import { S, canSpend } from '../core/state.js';
import { FRIENDS, isFriendAvailable } from '../data/questions.js';
import {
  DAYS_PER_YEAR, DIVISIONS, HOUSING_ROOMS, MAX_CHILDREN, MENTOR_SESSIONS, NETWORK, PARTNERS, WEDDING_COST,
  bondFor, canSucceed, childAge, companyForecast, formationCost, friendshipFor, partnerFor,
} from '../data/legacy.js';
import {
  appointHeir, askForHelp, buyDivision, childTime, friendTime, makeRelationship, partnerTime,
  planChild, shareLead, startCompany, transferCompany,
} from '../core/legacy.js';

const TABS = [['dating', 'Dating'], ['family', 'Family'], ['friends', 'Friends'], ['company', 'Company'], ['journal', 'Journal']];
const sprite = key => h('span', { html: icon(key, 36) });
const pct = amount => `${Math.floor(amount)}/100`;

function person(name, portrait, caption) {
  return h('div', { class: 'legacy-person' }, sprite(portrait),
    h('div', {}, h('strong', {}, name), h('small', { class: 'muted' }, caption)));
}

function button(label, act, disabled = false, style = '') {
  return h('button', { type: 'button', class: `btn ${style}`, disabled, onclick: act }, label);
}

function note(text) {
  return h('p', { class: 'muted legacy-note' }, text);
}

function meter(label, value) {
  return h('div', { class: 'legacy-meter' },
    h('div', { class: 'row between' }, label, h('b', {}, pct(value))),
    h('meter', { min: 0, max: 100, value, 'aria-label': label }));
}

function fieldForm({ label, placeholder, limit, submit, onSend }) {
  const input = h('input', { class: 'txt', type: 'text', 'aria-label': label, placeholder, maxlength: limit, required: true });
  return h('form', { class: 'legacy-form', onsubmit(event) {
    event.preventDefault();
    onSend(input.value);
  } }, input, h('button', { class: 'btn', type: 'submit' }, submit));
}

export function openLegacy(initialTab) {
  const content = h('div', { class: 'legacy-content' });
  const tabs = h('nav', { class: 'legacy-tabs', 'aria-label': 'Life and legacy' });
  const life = S.life.legacy;
  let tab = TABS.some(([id]) => id === initialTab) ? initialTab : 'dating';

  function render() {
    tabs.replaceChildren(...TABS.map(([id, label]) => h('button', {
      type: 'button', class: id === tab ? 'selected' : '', 'aria-pressed': String(id === tab),
      onclick: () => { tab = id; render(); },
    }, label)));
    const views = { dating, family, friends, company, journal };
    content.replaceChildren(views[tab]());
  }

  function complete(operation, refreshHome = false) {
    if (operation()) {
      if (refreshHome && App.screen === 'office') App.world.buildOffice(S);
      render();
    } else toast('That action is unavailable right now.', 'bad');
  }

  function dating() {
    const relation = life.relationship;
    const cards = PARTNERS.map(partner => {
      const available = S.level >= partner.level;
      const current = relation?.id === partner.id;
      const datingDays = current ? S.day - relation.since : 0;
      const stage = current ? (relation.stage === 'married' ? 'Spouse' : 'Girlfriend') : available ? 'Single' : `Meet at level ${partner.level}`;
      const bond = bondFor(S.life, partner.id);
      const canSpendTime = available && (!relation || current) && bond.lastTime !== S.day;
      const canMarry = datingDays >= 4 && bond.closeness >= 82 && bond.commitment >= 62;
      const box = h('article', { class: 'legacy-card' }, person(partner.name, partner.sprite, stage), note(partner.bio));
      if (!available) return box;
      box.append(h('div', { class: 'legacy-meters' }, meter('Closeness', bond.closeness), meter('Commitment', bond.commitment)));
      if (!relation || current) box.append(h('div', { class: 'row gap wrap' },
        button('Spend time', () => complete(() => partnerTime(partner.id), true), !canSpendTime),
        button('Date night · $35', () => complete(() => partnerTime(partner.id, true), true), !canSpendTime || !canSpend(35), 'ghost')));
      if (!relation) {
        box.append(button('Ask to be your girlfriend', () => complete(() => makeRelationship(partner.id, 'date'), true),
          bond.closeness < 42, 'help-button'));
        if (bond.closeness < 42) box.append(note('Requires 42 closeness.'));
      }
      if (current && relation.stage === 'dating') {
        box.append(button(`Get married · ${money(WEDDING_COST)}`, () => complete(() => makeRelationship(partner.id, 'marry'), true),
          !canMarry || !canSpend(WEDDING_COST), 'help-button'));
        if (!canMarry) box.append(note('Marriage requires 4 days together, 82 closeness, and 62 commitment.'));
      }
      if (current) {
        const apart = S.day - bond.lastTime;
        box.append(note(`Last spent time together ${apart ? `${apart} day${apart === 1 ? '' : 's'} ago` : 'today'}.`));
        if (relation.brokeDays > 1) box.append(h('p', { class: 'warn legacy-note' }, 'Finances are straining this relationship.'));
        box.append(button('End relationship', async () => {
          if (await confirmBox(`End your relationship with ${esc(partner.name)}?`, { ok: 'End relationship' })) {
            complete(() => makeRelationship(partner.id, 'leave'), true);
          }
        }, false, 'ghost'));
      }
      return box;
    });
    return h('div', { class: 'legacy-layout' },
      note('Spend time together regularly. A stronger commitment gives you more time to work through distance and money trouble.'),
      h('div', { class: 'legacy-grid' }, cards));
  }

  function family() {
    const spouse = life.relationship?.stage === 'married' && partnerFor(life.relationship.id);
    const space = HOUSING_ROOMS[S.home]?.includes('nursery');
    const addChild = spouse && space && !life.pregnancy && life.children.length < MAX_CHILDREN;
    const readiness = life.children.map(child => {
      const age = childAge(child, S.day);
      const leader = life.company?.leader === child.id;
      const trained = canSucceed(child, S.day);
      const parent = partnerFor(child.parent);
      return h('article', { class: 'legacy-card' },
        person(child.name, 'player', `Age ${age}${leader ? ' · Company leader' : ''}`),
        parent && note(`Also parented by ${parent.name}.`), meter('Closeness', child.closeness),
        note(`Company mentoring ${Math.min(child.mentored, MENTOR_SESSIONS)}/${MENTOR_SESSIONS} sessions.`),
        h('div', { class: 'row gap wrap' },
          button('Spend time', () => complete(() => childTime(child.id)), child.lastTime === S.day),
          button('Teach about your work', () => complete(() => childTime(child.id, true)), age < 13 || child.lastTime === S.day, 'ghost')),
        life.company && !leader && button('Hand over the company', async () => {
          if (await confirmBox(`Put ${esc(child.name)} in charge of ${esc(life.company.name)}?`, { ok: 'Hand over' })) {
            complete(() => appointHeir(child.id));
          }
        }, !trained, 'help-button'));
    });
    let status = 'Get married and move into an apartment or larger to start a family.';
    if (spouse && !space) status = 'Your family needs a second bedroom. Shop & Housing lists homes with room for a child.';
    if (spouse && space && life.children.length >= MAX_CHILDREN) status = 'Your household has reached its three-child limit.';
    return h('div', { class: 'legacy-layout' },
      h('article', { class: 'legacy-card' },
        h('h3', {}, 'Your household'), spouse && person(spouse.name, spouse.sprite, 'Spouse'),
        life.pregnancy ? note(`${life.pregnancy.name} is due on day ${life.pregnancy.due}.`)
          : addChild ? fieldForm({ label: 'Child’s name', placeholder: 'Child’s name', limit: 18, submit: 'Start a family',
            onSend: name => complete(() => planChild(name), true) }) : note(status)),
      note(`Children age one year every ${DAYS_PER_YEAR} game days. Mentoring starts at 13. An adult with ${MENTOR_SESSIONS} sessions can take over your company.`),
      h('div', { class: 'legacy-grid' }, readiness));
  }

  function friends() {
    const cards = FRIENDS.map(friend => {
      const available = isFriendAvailable(friend, S);
      const contact = friendshipFor(S.life, friend.id);
      const rival = contact.status === 'rival';
      const working = life.collaborator?.id === friend.id;
      const help = S.life.meals <= 2 && contact.rapport >= 50 && (!contact.lastHelp || S.day - contact.lastHelp >= 7) && NETWORK[friend.id].loyal;
      return h('article', { class: 'legacy-card' },
        person(friend.name, friend.sprite, rival ? 'Rival' : available ? friend.role : friend.unlock),
        available && meter('Rapport', contact.rapport),
        available && note(rival ? 'This contact lost your trust and can no longer access your projects.'
          : contact.rapport >= 30 ? NETWORK[friend.id].clue : 'Spend time together to get to know them.'),
        available && h('div', { class: 'row gap wrap' },
          button('Catch up', () => complete(() => friendTime(friend.id)), rival || contact.lastTime === S.day),
          button('Ask a technical question', () => App.panels.phone({ friendId: friend.id }), rival, 'ghost')),
        available && h('div', { class: 'row gap wrap' },
          working ? button('Remove shared access', () => complete(() => shareLead(null)), false, 'ghost')
            : button('Share next project', () => complete(() => shareLead(friend.id)), rival || contact.rapport < 30 || Boolean(life.collaborator), 'ghost'),
          help && button('Ask for groceries', () => complete(() => askForHelp(friend.id)), false, 'ghost')));
    });
    return h('div', { class: 'legacy-layout' },
      note('You can share one upcoming project at a time. A reliable friend can send referrals. A rival can take credit and poach side work.'),
      life.collaborator && h('p', { class: 'hint legacy-note' }, `Project access is shared with ${life.collaborator.name}. You can cancel it before the next successful job.`),
      h('div', { class: 'legacy-grid' }, cards));
  }

  function company() {
    const firm = life.company;
    const cost = formationCost(S);
    if (!firm) return h('article', { class: 'legacy-card' },
      h('h3', {}, 'Start a cloud company'),
      note(cost ? `Registration costs ${money(cost)} and includes an LLC.` : 'Your existing LLC covers registration.'),
      note('Successful paying contracts build your client base and add support retainers to company cash. Reinvest to hire staff and expand.'),
      canSpend(cost) ? fieldForm({ label: 'Company name', placeholder: 'Company name', limit: 26, submit: 'Found company',
        onSend: name => complete(() => startCompany(name)) }) : note('Save enough for registration to get started.'));

    const heir = life.children.find(child => child.id === firm.leader);
    const { revenue, payroll, net } = companyForecast(firm);
    const amount = h('input', { class: 'txt', type: 'number', min: 1, step: 1, 'aria-label': 'Transfer amount', placeholder: 'Amount in dollars' });
    return h('div', { class: 'legacy-layout' },
      h('article', { class: 'legacy-card' },
        person(firm.name, 'building', `${heir?.name || S.name} · ${heir ? 'Successor' : 'Founder'}${firm.divisions.includes('global') ? ' · Global company' : ''}`),
        h('div', { class: 'legacy-ledger' },
          h('div', {}, h('small', {}, 'Company cash'), h('strong', {}, money(firm.cash))),
          h('div', {}, h('small', {}, 'Successful projects'), h('strong', {}, firm.projects)),
          h('div', {}, h('small', {}, 'Weekly net'), h('strong', {}, money(net))),
          h('div', {}, h('small', {}, 'Lifetime earnings'), h('strong', {}, money(firm.earnings))),
          h('div', {}, h('small', {}, 'Personal wallet'), h('strong', {}, money(S.money)))),
        note(`Weekly forecast includes ${money(revenue)} in billings and ${money(payroll)} in payroll.${heir ? ' Your successor adds 10% to weekly billings.' : ''}`),
        firm.lastWeek && note(`Last payout on day ${firm.lastWeek.day} · ${money(firm.lastWeek.net)} to company cash.`),
        h('div', { class: 'legacy-form' }, amount,
          button('Invest', () => complete(() => transferCompany(Number(amount.value), true))),
          button('Withdraw', () => complete(() => transferCompany(Number(amount.value), false)), false, 'ghost'))),
      h('div', { class: 'legacy-grid' }, DIVISIONS.map(division => {
        const owned = firm.divisions.includes(division.id);
        const ready = !owned && firm.projects >= division.projects && firm.cash >= division.cost;
        return h('article', { class: 'legacy-card' },
          h('h3', {}, division.name), note(`${money(division.revenue - division.payroll)} net per week`),
          note(owned ? 'Operating' : `${division.projects} successful projects required`),
          !owned && button(`Open · ${money(division.cost)}`, () => complete(() => buyDivision(division.id)), !ready));
      })));
  }

  function journal() {
    if (!life.journal.length) return note('Relationship, family, and company milestones will appear here.');
    return h('div', { class: 'legacy-layout' }, life.journal.map(entry => h('article', { class: 'legacy-card' },
      h('small', { class: 'muted' }, `Day ${entry.day}`), h('p', { class: `legacy-note ${entry.kind}` }, entry.text))));
  }

  render();
  return modal(h('div', { class: 'legacy-panel' }, tabs, content), { title: 'Life & legacy', wide: true, cls: 'legacy-modal' });
}

App.panels.legacy = openLegacy;
