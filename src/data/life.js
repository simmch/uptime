import { freshLegacy, restoreLegacy } from './legacy.js';

export const HOME_SPAWN = { x: 0.2, z: 3.72 };

export const CARE = {
  food: { label: 'Fullness', action: 'Eat a meal in the kitchen', start: 81, hourly: 3.4, color: '#f3ba75' },
  energy: { label: 'Energy', action: 'Sleep in the bedroom', start: 79, hourly: 3.1, color: '#ffdb7d' },
  restroom: { label: 'Restroom', action: 'Use the toilet in the bathroom', start: 81, hourly: 5.0, color: '#93c9ec' },
  hygiene: { label: 'Hygiene', action: 'Take a shower in the bathroom', start: 85, hourly: 1.9, color: '#a4d7bf' },
  morale: { label: 'Morale', action: 'Watch TV or invite friends over', start: 62, hourly: 1.7, color: '#d3aee5' },
};

export const HOME_STATIONS = [
  { id: 'desk', name: 'Computer', action: 'Open work computer', x: 5.65, z: 2.85 },
  { id: 'kitchen', name: 'Kitchen', action: 'Make a meal', x: 0.36, z: -3.58 },
  { id: 'bed', name: 'Bed', action: 'Get some sleep', x: -5.05, z: -3.9 },
  { id: 'toilet', name: 'Toilet', action: 'Use the restroom', x: 5.17, z: -3.38 },
  { id: 'shower', name: 'Shower', action: 'Take a shower', x: 6.95, z: -3.25 },
  { id: 'tv', name: 'TV', action: 'Watch TV', x: -5.36, z: 1.08 },
  { id: 'keys', name: 'Car keys', action: 'Drive to the grocery store', x: 0.2, z: 5.16 },
];

export const DECOR = {
  rug: { name: 'Living room rug', options: [
    { id: 'woven', name: 'Woven stripe', price: 0, color: '#9b764e', trim: '#eac490' },
    { id: 'indigo', name: 'Midnight blue', price: 48, color: '#3d5983', trim: '#a2c7eb' },
    { id: 'moss', name: 'Moss green', price: 48, color: '#466958', trim: '#bcd8a2' },
  ] },
  walls: { name: 'Living room paint', options: [
    { id: 'original', name: 'Warm plaster', price: 0, color: '#726981' },
    { id: 'sage', name: 'Soft sage', price: 60, color: '#648175' },
    { id: 'clay', name: 'Terracotta', price: 60, color: '#a37067' },
  ] },
  plants: { name: 'Window plants', options: [
    { id: 'single', name: 'One pothos', price: 0 },
    { id: 'shelf', name: 'Plant shelf', price: 38 },
  ] },
};

export const GROCERIES = [
  { id: 'basket', name: 'Basics basket', meals: 4, price: 16 },
  { id: 'weekly', name: 'Pantry restock', meals: 9, price: 32 },
];

export const LOCAL_NEWS = [
  { title: 'Corner Market puts pantry staples on sale', story: 'The weekly circular is out. The market and its delivery partners are honoring the same coupon through midnight.', category: 'groceries', percent: 25 },
  { title: 'Local makers hold a home goods sale', story: 'The neighborhood home shop is clearing its rug, paint, and plant stock to make room for new arrivals.', category: 'decor', percent: 20 },
  { title: 'Corner Market adds a weekend basket deal', story: 'The community board shared a coupon for grocery baskets and pantry restocks.', category: 'groceries', percent: 15 },
  { title: 'Community swap puts decorating in reach', story: 'A local home shop is matching the swap’s prices on a few household updates.', category: 'decor', percent: 30 },
];

const clamp = value => Math.min(100, Math.max(0, value));
export const localNews = day => LOCAL_NEWS[(day - 1) % LOCAL_NEWS.length];

export function freshLife() {
  return {
    minute: 17 * 60 + 30, position: { ...HOME_SPAWN }, meals: 5,
    needs: Object.fromEntries(Object.entries(CARE).map(([key, need]) => [key, need.start])),
    followers: 0, lastPost: 0, feed: [], lastPantry: 0, newsDay: 0, lastTv: 0, lastParty: 0, lastRelax: 0, guests: [],
    decor: { rug: 'woven', walls: 'original', plants: 'single' }, ownedDecor: [],
    legacy: freshLegacy(),
  };
}

export function restoreLife(data) {
  const defaults = freshLife();
  if (!data) return defaults;
  return { ...defaults, ...data, position: { ...defaults.position, ...data.position },
    needs: { ...defaults.needs, ...data.needs }, decor: { ...defaults.decor, ...data.decor }, legacy: restoreLegacy(data.legacy) };
}

export function changeNeed(life, key, amount) {
  life.needs[key] = clamp(life.needs[key] + amount);
}

export function useTime(life, minutes, sleeping = false) {
  for (const [key, need] of Object.entries(CARE)) {
    // Sleep restores energy and uses less energy and water than daytime activity.
    const rate = sleeping ? ({ food: 1.9, restroom: 2.15, hygiene: 0.9 }[key] || 0) : need.hourly;
    changeNeed(life, key, -rate * minutes / 60);
  }
}

export const popularityBonus = life => Math.min(0.15, (life?.followers || 0) / 800);
export const moraleBonus = life => life.needs.morale >= 85 ? 1.1 : life.needs.morale <= 24 ? 0.9 : 1;
export const workBreak = life => Object.entries(CARE).find(([key]) => key !== 'morale' && life.needs[key] < 14)?.[1];
