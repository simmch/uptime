import { S, canSpend, earn, save, spend } from './state.js';
import { spendTime } from './life.js';
import { emit } from './events.js';
import { changeNeed } from '../data/life.js';
import {
  DAYS_PER_YEAR, DIVISIONS, HOUSING_ROOMS, MAX_CHILDREN, NETWORK, WEDDING_COST, bondFor, bound,
  canSucceed, childAge, formationCost, friendshipFor, lifeNotice, partnerFor,
} from '../data/legacy.js';
import { FRIENDS, isFriendAvailable } from '../data/questions.js';

function commit(text, kind = 'good') {
  if (text) {
    const entry = lifeNotice(S.life, S.day, text, kind);
    emit('legacy', entry);
  }
  save();
  emit('life');
}

function hangout(last) {
  return last !== S.day;
}

function contactFor(id) {
  return FRIENDS.find(friend => friend.id === id && isFriendAvailable(friend, S));
}

export function partnerTime(id, date = false) {
  const partner = partnerFor(id);
  const legacy = S.life.legacy;
  if (!partner || S.level < partner.level || (legacy.relationship && legacy.relationship.id !== id)) return false;
  const bond = bondFor(S.life, id);
  if (!hangout(bond.lastTime) || (date && !canSpend(35))) return false;
  if (date) spend(35, 'Date night');
  legacy.bonds[id] = bond;
  bond.lastTime = S.day;
  bond.closeness = bound(bond.closeness + (date ? 31 : 21));
  bond.commitment = bound(bond.commitment + (legacy.relationship ? 12 : 7));
  spendTime(date ? 95 : 55);
  bond.lastTime = S.day;
  changeNeed(S.life, 'morale', date ? 18 : 10);
  commit(date ? `Date night with ${partner.name}.` : `Spent time with ${partner.name}.`);
  return true;
}

export function makeRelationship(id, action) {
  const partner = partnerFor(id);
  const legacy = S.life.legacy;
  const bond = legacy.bonds[id];
  if (!partner || !bond || S.level < partner.level) return false;
  if (action === 'date' && !legacy.relationship && bond.closeness >= 42) {
    legacy.relationship = { id, stage: 'dating', since: S.day, brokeDays: 0 };
    bond.commitment = bound(bond.commitment + 18);
    commit(`${partner.name} is now your girlfriend.`);
    return true;
  }
  const relationship = legacy.relationship;
  if (relationship?.id !== id) return false;
  if (action === 'marry' && relationship.stage === 'dating' && S.day - relationship.since >= 4 &&
      bond.closeness >= 82 && bond.commitment >= 62 && canSpend(WEDDING_COST)) {
    spend(WEDDING_COST, 'Wedding');
    relationship.stage = 'married';
    bond.commitment = bound(bond.commitment + 13);
    changeNeed(S.life, 'morale', 24);
    commit(`You and ${partner.name} got married.`);
    return true;
  }
  if (action === 'leave') {
    legacy.relationship = null;
    bond.commitment = Math.floor(bond.commitment * .45);
    bond.closeness = Math.min(bond.closeness, 30);
    commit(`You and ${partner.name} went your separate ways.`, 'warn');
    return true;
  }
  return false;
}

export function planChild(input) {
  const name = input.trim().slice(0, 18);
  const legacy = S.life.legacy;
  if (!name || legacy.relationship?.stage !== 'married' || legacy.pregnancy ||
      legacy.children.length >= MAX_CHILDREN || !HOUSING_ROOMS[S.home]?.includes('nursery')) return false;
  legacy.pregnancy = { id: `child-${legacy.children.length + 1}`, name,
    parent: legacy.relationship.id, due: S.day + DAYS_PER_YEAR * 2 };
  commit(`${name} is due on day ${legacy.pregnancy.due}.`);
  return true;
}

export function childTime(id, mentor = false) {
  const child = S.life.legacy.children.find(entry => entry.id === id);
  if (!child || !hangout(child.lastTime) || (mentor && childAge(child, S.day) < 13)) return false;
  child.lastTime = S.day;
  child.closeness = bound(child.closeness + (mentor ? 8 : 15));
  if (mentor) child.mentored++;
  spendTime(50);
  child.lastTime = S.day;
  changeNeed(S.life, 'morale', 10);
  commit(mentor ? `You showed ${child.name} how a cloud project gets done.` : `Spent time with ${child.name}.`);
  return true;
}

export function friendTime(id) {
  const friend = contactFor(id);
  if (!friend) return false;
  const contact = friendshipFor(S.life, id);
  if (contact.status === 'rival' || !hangout(contact.lastTime)) return false;
  S.life.legacy.friends[id] = contact;
  contact.lastTime = S.day;
  contact.rapport = bound(contact.rapport + 17);
  spendTime(45);
  contact.lastTime = S.day;
  changeNeed(S.life, 'morale', 13);
  commit(`Caught up with ${friend.name}.`);
  return true;
}

export function shareLead(id) {
  const friend = contactFor(id);
  const legacy = S.life.legacy;
  if (id === null && legacy.collaborator) {
    legacy.collaborator = null;
    commit('You removed the shared access.', 'info');
    return true;
  }
  if (!friend || legacy.collaborator) return false;
  const contact = friendshipFor(S.life, id);
  if (contact.status === 'rival' || contact.rapport < 30) return false;
  legacy.friends[id] = contact;
  legacy.collaborator = { id, name: friend.name };
  commit(`${friend.name} has access to the next successful project.`, 'info');
  return true;
}

export function askForHelp(id) {
  const friend = contactFor(id);
  if (!friend || !NETWORK[id].loyal || S.life.meals > 2) return false;
  const contact = friendshipFor(S.life, id);
  if (contact.rapport < 50 || (contact.lastHelp && S.day - contact.lastHelp < 7)) return false;
  contact.lastHelp = S.day;
  S.life.legacy.friends[id] = contact;
  S.life.meals += 3;
  commit(`${friend.name} dropped off three meals.`);
  return true;
}

export function startCompany(input) {
  const name = input.trim().slice(0, 26);
  const legacy = S.life.legacy;
  const cost = formationCost(S);
  if (!name || legacy.company || !canSpend(cost)) return false;
  if (cost) spend(cost, 'Company registration');
  if (!S.gear.includes('llc')) S.gear.push('llc');
  legacy.company = { name, cash: 0, projects: 0, divisions: [], earnings: 0, lastWeek: null, leader: null };
  commit(`You founded ${name}.`);
  return true;
}

export function transferCompany(amount, deposit) {
  const company = S.life.legacy.company;
  if (!company || !Number.isSafeInteger(amount) || amount < 1) return false;
  if (deposit) {
    if (S.money < amount) return false;
    spend(amount, 'Investment in company');
    company.cash += amount;
  } else {
    if (company.cash < amount) return false;
    company.cash -= amount;
    earn(amount, 'Company distribution');
  }
  commit();
  return true;
}

export function buyDivision(id) {
  const company = S.life.legacy.company;
  const division = DIVISIONS.find(option => option.id === id);
  if (!company || !division || company.divisions.includes(id) || company.cash < division.cost || company.projects < division.projects) return false;
  company.cash -= division.cost;
  company.divisions.push(id);
  commit(`${company.name} opened ${division.name.toLowerCase()}.`);
  return true;
}

export function appointHeir(id) {
  const legacy = S.life.legacy;
  const company = legacy.company;
  const child = legacy.children.find(entry => entry.id === id);
  if (!company || !child || !canSucceed(child, S.day) || company.leader === id) return false;
  company.leader = child.id;
  commit(`${child.name} has taken over ${company.name}.`);
  return true;
}
