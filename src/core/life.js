import { S, advanceDays, canSpend, save, spend } from './state.js';
import { emit } from './events.js';
import { DECOR, GROCERIES, changeNeed, localNews, useTime } from '../data/life.js';

export function spendTime(minutes, { sleeping = false } = {}) {
  const life = S.life;
  const total = life.minute + minutes;
  useTime(life, minutes, sleeping);
  life.minute = total % 1440;
  const days = Math.floor(total / 1440);
  if (days) emit('rentEvents', advanceDays(days, { wearNeeds: false }));
}

function commit(action) {
  save();
  emit('life', action);
}

export function care(action) {
  const life = S.life;
  if (action === 'eat') {
    if (!life.meals) return false;
    life.meals--;
    spendTime(24);
    changeNeed(life, 'food', 54);
    changeNeed(life, 'restroom', -6);
  } else if (action === 'pantry') {
    if (life.meals || life.lastPantry === S.day) return false;
    life.lastPantry = S.day;
    spendTime(18);
    changeNeed(life, 'food', 35);
  } else if (action === 'toilet') {
    spendTime(8);
    life.needs.restroom = 100;
  } else if (action === 'shower') {
    spendTime(23);
    life.needs.hygiene = 100;
  } else if (action === 'relax') {
    if (life.lastRelax === S.day) return false;
    spendTime(35);
    life.lastRelax = S.day;
    changeNeed(life, 'morale', 22);
  } else if (action === 'sleep') {
    const morning = 7 * 60;
    // Sleep advances to the following day and restores energy.
    spendTime(1440 - life.minute + morning, { sleeping: true });
    life.needs.energy = 100;
    changeNeed(life, 'morale', 6);
  } else {
    return false;
  }
  commit(action);
  return true;
}

export function dealPrice(base, category) {
  const news = localNews(S.day);
  return S.life.newsDay === S.day && news.category === category
    ? Math.round(base * (100 - news.percent) / 100) : base;
}

export function readNews(source) {
  const life = S.life;
  if (life.newsDay !== S.day || (source === 'tv' && life.lastTv !== S.day)) {
    spendTime(source === 'tv' ? 14 : 8);
    life.newsDay = S.day;
    if (source === 'tv') {
      life.lastTv = S.day;
      changeNeed(life, 'morale', 9);
    }
    commit(source === 'social' ? 'socialNews' : undefined);
  }
  return localNews(S.day);
}

export function groceryPrice(item, channel) {
  return dealPrice(item.price, 'groceries') + (channel === 'delivery' ? 8 : 0);
}

export function buyGroceries(id, channel) {
  const item = GROCERIES.find(option => option.id === id);
  if (!item || !['market', 'delivery'].includes(channel)) return false;
  const price = groceryPrice(item, channel);
  if (!canSpend(price)) return false;
  spend(price, channel === 'market' ? 'Corner Market groceries' : 'Grocery delivery');
  if (channel === 'delivery') spendTime(35);
  S.life.meals += item.meals;
  commit('groceries');
  return true;
}

export function takeGroceryTrip() {
  spendTime(15);
  commit();
}

export function publishPost(kind) {
  const life = S.life;
  if (life.lastPost === S.day || !['project', 'lesson'].includes(kind)) return false;
  const project = S.history.find(entry => entry.grade !== 'F');
  if (kind === 'project' && !project) return false;
  const day = S.day;
  const gain = kind === 'project' ? (project.grade === 'S' ? 24 : 17) : 8;
  life.lastPost = day;
  life.followers += gain;
  life.feed.unshift({ day, gain, text: kind === 'project' ? `Project recap · ${project.title}` : 'Shared a lesson from learning cloud' });
  life.feed = life.feed.slice(0, 8);
  spendTime(24);
  changeNeed(life, 'morale', 5);
  commit('post');
  return gain;
}

export function changeDecor(group, id) {
  const option = DECOR[group]?.options.find(entry => entry.id === id);
  if (!option) return false;
  const life = S.life;
  if (option.price && !life.ownedDecor.includes(id)) {
    const price = dealPrice(option.price, 'decor');
    if (!canSpend(price)) return false;
    spend(price, option.name);
    life.ownedDecor.push(id);
  }
  life.decor[group] = id;
  commit('decorate');
  return true;
}

export function throwParty(guests) {
  const life = S.life;
  if (!guests.length || life.lastParty === S.day || life.meals < 2) return false;
  life.meals -= 2;
  life.lastParty = S.day;
  spendTime(90);
  life.lastParty = S.day;
  life.guests = guests.slice(0, 4);
  changeNeed(life, 'morale', 42);
  commit('party');
  return true;
}
