import { App } from './app.js';
import { h, modal, money, toast } from './dom.js';
import { icon } from '../render/atlas.js';
import { S, canSpend } from '../core/state.js';
import { DECOR, GROCERIES, localNews, popularityBonus } from '../data/life.js';
import { FRIENDS, QUESTIONS, findQuestions, friendCanAnswer, isFriendAvailable } from '../data/questions.js';
import { buyGroceries, changeDecor, dealPrice, groceryPrice, publishPost, readNews, throwParty } from '../core/life.js';
import { sfx } from '../audio/sfx.js';
import { friendshipFor } from '../data/legacy.js';

const isRival = friend => friendshipFor(S.life, friend.id).status === 'rival';
const canCall = friend => isFriendAvailable(friend, S) && !isRival(friend);
const availableFriends = () => FRIENDS.filter(canCall);

function phoneButton(text, onclick, style = 'ghost') {
  return h('button', { class: `btn ${style}`, type: 'button', onclick }, text);
}

function activeDeal(category) {
  const news = localNews(S.day);
  return S.life.newsDay === S.day && news.category === category ? news : null;
}

function dealLine(category) {
  const sale = activeDeal(category);
  return sale && h('p', { class: 'life-sale' }, `Coupon applied · ${sale.percent}% off through midnight`);
}

function headline(article) {
  return h('article', { class: 'life-article' },
    h('div', { class: 'life-kicker' }, 'NEIGHBORHOOD NEWS'),
    h('h3', {}, article.title),
    h('p', {}, article.story),
    h('div', { class: 'life-sale' }, `${article.percent}% off ${article.category === 'decor' ? 'home décor' : 'groceries'} today`));
}

function callContext({ job, component }) {
  if (!job && !component) return null;
  const details = h('div', { class: 'phone-context' });
  if (component) details.append(h('h3', {}, component.name), h('p', {}, component.desc));
  if (job) {
    const req = job.req;
    details.append(h('h3', {}, job.title), h('p', {}, job.brief));
    if (req?.rps) details.append(h('p', { class: 'muted' },
      `At baseline, about ${req.rps} requests arrive every second. Try to keep ${req.availability}% of requests working and the p95 under ${req.latency} ms.`));
    if (job.budget) details.append(h('p', {}, `${money(job.budget)} infrastructure budget. The client pays you for the job and you pay for the infrastructure.`));
    if (job.hint) details.append(h('p', { class: 'life-sale' }, job.hint));
  }
  return details;
}

export function openPhone({ job = S.active?.job, component, friendId } = {}) {
  sfx('phone_open');
  let currentFriend = availableFriends().find(friend => friend.id === friendId) || FRIENDS[0];
  let query = '';
  let currentAnswer = null;
  const suggestions = h('div', { class: 'phone-questions' });
  const answer = h('div', { class: 'phone-answer', 'aria-live': 'polite' });
  const contacts = h('div', { class: 'phone-contacts', 'aria-label': 'Friends' });
  const search = h('input', { class: 'txt', type: 'search', maxlength: 140, 'aria-label': 'Ask a technical question',
    placeholder: 'Try “What is a VPC?” or “Why is my app slow?”' });
  const form = h('form', { class: 'row gap phone-search' }, search,
    h('button', { class: 'btn help-button', type: 'submit' }, 'Ask'));
  const context = callContext({ job, component });
  const shortcuts = App.screen === 'office' && h('nav', { class: 'row gap wrap phone-shortcuts', 'aria-label': 'Phone apps' },
    phoneButton('Feed & news', openFeed), phoneButton('Invite friends', () => openParty(() => panel.close())), phoneButton('Grocery delivery', () => openGroceries('delivery')),
    phoneButton('Decorate', openDecor), phoneButton('Life & legacy', () => App.panels.legacy('dating')));
  const panel = modal(h('div', { class: 'phone' },
    shortcuts,
    h('div', { class: 'phone-grid' }, contacts,
      h('section', { class: 'phone-main' },
        h('h3', {}, 'What are you stuck on?'),
        h('p', { class: 'muted' }, 'Type a question or pick one below. Your friends explain terms in plain language and suggest something to try.'),
        form,
        context && phoneButton('Explain what I’m working on', () => {
          sfx('phone_buzz', { vol: .22, max: .8, gap: 400 });
          currentAnswer = null;
          answer.replaceChildren(h('div', { class: 'life-kicker' }, currentFriend.name), context);
        }),
        suggestions, answer))),
  { title: 'Phone a friend', wide: true, cls: 'phone-modal' });

  function canAnswer(entry) {
    return friendCanAnswer(currentFriend, entry);
  }

  function findFriend(entry) {
    return availableFriends().find(friend => friendCanAnswer(friend, entry));
  }

  function renderContacts() {
    contacts.replaceChildren(...FRIENDS.map(friend => {
      const available = canCall(friend);
      return h('button', {
        type: 'button',
        class: 'phone-contact' + (currentFriend === friend ? ' selected' : ''),
        disabled: !available,
        'aria-pressed': String(currentFriend === friend),
        onclick: () => {
          currentFriend = friend;
          renderContacts();
          renderSuggestions();
          if (currentAnswer) showAnswer(currentAnswer);
        },
      },
      h('span', { html: icon(friend.sprite, 35) }),
      h('span', {}, h('strong', {}, friend.name), h('small', {}, available ? friend.role : isRival(friend) ? 'Rival' : friend.unlock)));
    }));
  }

  function showAnswer(entry) {
    if (canAnswer(entry)) sfx('phone_buzz', { vol: .22, max: .8, gap: 400 });
    currentAnswer = entry;
    answer.replaceChildren();
    if (!canAnswer(entry)) {
      const other = findFriend(entry);
      const specialist = FRIENDS.find(friend => friendCanAnswer(friend, entry));
      answer.append(h('h3', {}, entry.title),
        h('p', {}, `${currentFriend.name} would defer to ${other?.name || specialist?.name} on this one.`),
        other ? phoneButton(`Call ${other.name}`, () => { currentFriend = other; renderContacts(); renderSuggestions(); showAnswer(entry); }, 'help-button')
          : h('p', { class: 'muted' }, specialist?.unlock),
        entry.codex && phoneButton('Read the Codex entry', () => App.panels.codex(entry.codex)));
      return;
    }
    answer.append(h('div', { class: 'life-kicker' }, currentFriend.name), h('h3', {}, entry.title),
      h('p', {}, entry.plain),
      h('div', { class: 'phone-try' }, h('strong', {}, 'Try it in the game'), h('p', {}, entry.tryThis)),
      entry.codex && phoneButton('Go deeper in the Codex', () => App.panels.codex(entry.codex)));
  }

  function renderSuggestions() {
    const terms = query.trim();
    let matches = terms ? findQuestions(terms) : [];
    suggestions.replaceChildren();
    if (terms && !matches.length) suggestions.append(h('p', { class: 'muted' },
      'There’s no matching answer yet. Try a term like “subnet”, “uptime”, or “budget”, or pick a question below.'));
    if (!matches.length) {
      const domains = currentFriend.domains || job?.domains || [];
      const primary = QUESTIONS.filter(entry => domains.includes(entry.domain) && canAnswer(entry));
      const basics = QUESTIONS.filter(entry => canAnswer(entry));
      matches = [...new Set([QUESTIONS[0], ...primary, ...basics])].slice(0, 7);
    }
    for (const entry of matches) suggestions.append(h('button', { type: 'button', class: 'phone-question',
      onclick: () => showAnswer(entry) }, entry.title, canAnswer(entry) ? null : h('span', {}, 'Specialist')));
    return terms ? findQuestions(terms)[0] : null;
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    query = search.value;
    const best = renderSuggestions();
    if (best) showAnswer(best);
    else { if (query.trim()) sfx('ui_error'); answer.replaceChildren(); }
  });
  renderContacts();
  renderSuggestions();
  return panel;
}

export function openFeed() {
  readNews('social');
  const body = h('div', { class: 'life-panel' });
  function render() {
    const followers = S.life.followers;
    const bonus = +(100 * popularityBonus(S.life)).toFixed(1);
    const recent = S.history.find(entry => entry.grade !== 'F');
    const posted = S.life.lastPost === S.day;
    const post = kind => {
      const gained = publishPost(kind);
      if (gained) { toast(`+${gained} followers`, 'good'); render(); }
    };
    body.replaceChildren(headline(localNews(S.day)),
      h('div', { class: 'life-section' },
        h('h3', {}, 'Your profile'),
        h('p', { class: 'life-profile' }, h('strong', {}, followers), ' followers · ', h('strong', {}, `+${bonus}%`), ' contract pay'),
        h('p', { class: 'muted' }, posted ? 'You posted today. Come back tomorrow to post again.' :
          'Share one update per day. A finished project can bring more people to your profile.'),
        h('div', { class: 'row gap wrap' },
          h('button', { class: 'btn', disabled: posted, onclick: () => post('lesson') }, 'Share a lesson'),
          h('button', { class: 'btn ghost', disabled: posted || !recent, onclick: () => post('project') }, 'Post a project recap')),
        !recent ? h('p', { class: 'small muted' }, 'Finish a contract to publish a project recap.') : null,
        ...S.life.feed.map(item => h('div', { class: 'feed-entry' }, h('span', {}, item.text), h('small', {}, `Day ${item.day} · +${item.gain}`)))));
  }
  render();
  return modal(body, { title: 'Social feed', wide: true });
}

export function watchTV() {
  sfx('tv_on');
  const article = readNews('tv');
  return modal(h('div', { class: 'life-panel' }, headline(article)), { title: 'Local news on TV' });
}

export function openGroceries(channel, onReturn) {
  const body = h('div', { class: 'life-panel' });
  const isMarket = channel === 'market';
  function render() {
    body.replaceChildren(...[
      h('div', { class: 'row between' }, h('strong', {}, `${S.life.meals} meals at home`), h('span', { class: 'muted' }, money(S.money))),
      h('p', { class: 'muted' }, isMarket ? 'Store prices. Take your groceries home with you.' : 'Delivered to your kitchen in 35 in-game minutes. Delivery adds $8 per order.'),
      dealLine('groceries'),
      ...GROCERIES.map(item => {
        const price = groceryPrice(item, channel);
        return h('div', { class: 'life-shop-row' },
          h('span', {}, h('strong', {}, item.name), h('small', {}, `${item.meals} meals`)),
          h('button', { class: 'btn', disabled: !canSpend(price), onclick: () => {
            if (buyGroceries(item.id, channel)) { toast(`+${item.meals} meals`, 'good'); render(); }
          } }, `Buy · ${money(price)}`));
      }),
      isMarket && h('div', { class: 'row end' }, phoneButton('Drive home', () => { shop.close(); onReturn(); }, '')),
    ].filter(Boolean));
  }
  render();
  const shop = modal(body, { title: isMarket ? 'Corner Market' : 'Grocery delivery', closable: !isMarket });
  return shop;
}

export function openDecor() {
  const body = h('div', { class: 'life-panel' });
  function render() {
    body.replaceChildren(...[dealLine('decor'),
      ...Object.entries(DECOR).map(([group, { name, options }]) => h('section', { class: 'decor-group' },
        h('h3', {}, name),
        h('div', { class: 'decor-options' }, ...options.map(option => {
          const active = S.life.decor[group] === option.id;
          const owned = !option.price || S.life.ownedDecor.includes(option.id);
          const price = dealPrice(option.price, 'decor');
          return h('button', {
            type: 'button', class: 'decor-choice' + (active ? ' selected' : ''),
            disabled: active || (!owned && !canSpend(price)),
            onclick: () => {
              if (changeDecor(group, option.id)) { App.world.buildOffice(S); render(); }
            },
          }, h('span', { class: 'decor-swatch', style: { background: option.color || '#668d68' } }),
          h('span', {}, option.name), h('small', {}, active ? 'In use' : owned ? 'Place' : money(price)));
        })))),
    ].filter(Boolean));
  }
  render();
  return modal(body, { title: 'Decorate home', wide: true });
}

export function openParty(onHosted) {
  const friends = availableFriends();
  const options = friends.map(friend => ({
    friend, input: h('input', { type: 'checkbox', checked: true, value: friend.id }),
  }));
  const already = S.life.lastParty === S.day;
  const canHost = S.life.meals >= 2 && !already;
  const start = h('button', { class: 'btn help-button', type: 'button', disabled: !canHost, onclick: () => {
    const guests = options.filter(option => option.input.checked).map(option => option.friend);
    if (throwParty(guests)) {
      party.close();
      onHosted();
      App.world.buildOffice(S);
      toast('Your friends are in the living room. Morale restored.', 'good');
    }
  } }, 'Host get-together');
  options.forEach(({ input }) => input.addEventListener('change', () => {
    start.disabled = !canHost || !options.some(option => option.input.checked);
  }));
  const party = modal(h('div', { class: 'life-panel' },
    h('p', {}, already ? 'You’ve already hosted today.' : 'Hosting takes 90 in-game minutes and two meals for snacks. Spending time with friends boosts morale.'),
    S.life.meals < 2 && h('p', { class: 'hint' }, 'Stock at least two meals before hosting.'),
    ...options.map(({ friend, input }) => h('label', { class: 'life-invite' }, input,
      h('span', { html: icon(friend.sprite, 34) }), friend.name)),
    h('p', { class: 'muted small' }, 'High morale adds up to 10% XP to contract work.'),
    h('div', { class: 'row end' }, start)),
  { title: 'Invite friends over' });
}

Object.assign(App.panels, { phone: openPhone, feed: openFeed });
