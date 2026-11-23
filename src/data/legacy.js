export const HOUSING_ROOMS = {
  couch: [],
  studio: ['reading'],
  apartment: ['reading', 'nursery'],
  condo: ['reading', 'nursery', 'dining', 'guest'],
  house: ['reading', 'nursery', 'dining', 'guest', 'server', 'play'],
  penthouse: ['reading', 'nursery', 'dining', 'guest', 'server', 'play', 'boardroom', 'terrace'],
};

export const ROOM_NAMES = {
  reading: 'Reading room', nursery: 'Family bedroom', dining: 'Dining room', guest: 'Guest suite',
  server: 'Server room', play: 'Playroom', boardroom: 'Boardroom', terrace: 'Terrace',
};

export const PARTNERS = [
  { id: 'nia', name: 'Nia Brooks', sprite: 'mentor', level: 1, patience: 6, stability: 1,
    bio: 'A community organizer who values time together. She is willing to work through a financial setback.' },
  { id: 'lena', name: 'Lena Ortiz', sprite: 'user', level: 2, patience: 4, stability: 3,
    bio: 'An independent designer. She cares about keeping promises and sharing a workable budget.' },
  { id: 'jules', name: 'Jules Mercer', sprite: 'suit', level: 4, patience: 3, stability: 6,
    bio: 'An ambitious account lead. She loves big plans and expects financial stability from a partner.' },
];

export const NETWORK = {
  mara: { loyal: true, clue: 'Mara makes a point of naming everyone who contributed.' },
  nico: { loyal: true, clue: 'Nico turned down a referral when the client tried to cut his teammate out.' },
  samira: { loyal: true, clue: 'Samira shares referrals and keeps private conversations private.' },
  imani: { loyal: true, clue: 'Imani insists that credit and client ownership be agreed before work begins.' },
  camden: { loyal: false, clue: 'Camden once listed himself as the sole author of a team project.' },
  sloane: { loyal: false, clue: 'Sloane asks for introductions before agreeing who owns the client relationship.' },
};

export const DIVISIONS = [
  { id: 'support', name: 'Support desk', cost: 1800, projects: 2, revenue: 620, payroll: 230 },
  { id: 'consulting', name: 'Consulting team', cost: 4400, projects: 4, revenue: 1500, payroll: 640 },
  { id: 'managed', name: 'Managed cloud services', cost: 12000, projects: 7, revenue: 4200, payroll: 1650 },
  { id: 'regional', name: 'Regional office', cost: 32000, projects: 10, revenue: 9800, payroll: 3800 },
  { id: 'global', name: 'International operations', cost: 95000, projects: 15, revenue: 28500, payroll: 11200 },
];

export const MAX_CHILDREN = 3;
export const DAYS_PER_YEAR = 4;
export const MENTOR_SESSIONS = 3;
export const WEDDING_COST = 125;
export const FORMATION_COST = 1500;
export const bound = value => Math.min(100, Math.max(0, value));

export function freshLegacy() {
  return { properties: [], bonds: {}, relationship: null, pregnancy: null, children: [],
    friends: {}, collaborator: null, company: null, journal: [] };
}

export function restoreLegacy(legacy) {
  return { ...freshLegacy(), ...legacy };
}

export const partnerFor = id => PARTNERS.find(partner => partner.id === id);
export const childAge = (child, day) => Math.floor(Math.max(0, day - child.born) / DAYS_PER_YEAR);
export const canSucceed = (child, day) => childAge(child, day) >= 18 && child.mentored >= MENTOR_SESSIONS;
export const formationCost = state => state.gear.includes('llc') ? 0 : FORMATION_COST;
export const bondFor = (life, id) => life.legacy.bonds[id] || { closeness: 0, commitment: 0, lastTime: 0 };
export const friendshipFor = (life, id) => life.legacy.friends[id] ||
  { rapport: id === 'mara' ? 42 : 15, lastTime: 0, lastHelp: 0, shares: 0, status: 'friend' };

export function lifeNotice(life, day, text, kind = 'info') {
  const journal = life.legacy.journal;
  journal.unshift({ day, text, kind });
  journal.length = Math.min(journal.length, 20);
  return { type: 'lifeNotice', text, kind };
}

export function companyForecast(company) {
  const divisions = DIVISIONS.filter(division => company.divisions.includes(division.id));
  const billings = divisions.reduce((total, division) => total + division.revenue, Math.min(25, company.projects) * 110);
  const revenue = Math.round(billings * (company.leader ? 1.1 : 1));
  const payroll = divisions.reduce((total, division) => total + division.payroll, 0);
  return { revenue, payroll, net: revenue - payroll };
}

// Calendar events use the same days as contracts, rent, and sleep.
export function legacyDay(state, events) {
  const { life, day } = state;
  const legacy = life.legacy;
  const { relationship, company, pregnancy } = legacy;
  const notice = (text, kind) => events.push(lifeNotice(life, day, text, kind));

  if (relationship) {
    const partner = partnerFor(relationship.id);
    const bond = legacy.bonds[partner.id];
    const grace = partner.patience + Math.floor(bond.commitment / 20);
    const absent = day - bond.lastTime;
    const financiallyStrained = state.money <= 0 && bond.commitment < 65 + partner.stability * 3;
    relationship.brokeDays = financiallyStrained ? relationship.brokeDays + 1 : 0;
    const stressed = relationship.brokeDays >= 3 + Math.floor(bond.commitment / 22);
    if (absent === grace + 1) notice(`${partner.name} misses spending time with you.`, 'warn');
    if (financiallyStrained && relationship.brokeDays === 2) notice(`${partner.name} is worried about money. Talk and spend time together.`, 'warn');
    if (absent > grace) bond.closeness = bound(bond.closeness - (relationship.stage === 'married' ? 4 : 7));
    if (stressed) bond.closeness = bound(bond.closeness - partner.stability * 1.65);
    if (bond.closeness <= (relationship.stage === 'married' ? 9 : 14)) {
      legacy.relationship = null;
      bond.commitment = Math.floor(bond.commitment * .45);
      notice(`${partner.name} ended the relationship after ${absent > grace ? 'too much time apart' : 'ongoing financial strain'}.`, 'bad');
    }
  }

  if (pregnancy && day >= pregnancy.due) {
    legacy.children.push({ id: pregnancy.id, name: pregnancy.name, born: pregnancy.due, parent: pregnancy.parent,
      closeness: 55, mentored: 0, lastTime: 0 });
    legacy.pregnancy = null;
    notice(`${pregnancy.name} has joined your family.`, 'good');
  }

  for (const child of legacy.children) {
    const age = childAge(child, day);
    if (age === 13 && (day - child.born) % DAYS_PER_YEAR === 0) {
      notice(`${child.name} is old enough to learn about your work and prepare for the family business.`, 'info');
    } else if (age === 18 && (day - child.born) % DAYS_PER_YEAR === 0) {
      notice(`${child.name} is now an adult.`, 'good');
    }
  }

  if (company && day % 7 === 1) {
    const { revenue, payroll, net } = companyForecast(company);
    company.cash += net;
    company.earnings += net;
    company.lastWeek = { day, revenue, payroll, net };
  }
}

// Only completed, paying contracts award corporate retainers or resolve a shared lead.
export function legacyProject(state, job, grade, events) {
  if (grade === 'F' || job.practice || !job.pay || job.mode === 'signal') return;
  const { life, day } = state;
  const legacy = life.legacy;
  const { company, collaborator } = legacy;
  const notice = (text, kind) => events.push(lifeNotice(life, day, text, kind));

  if (company) {
    const retainer = Math.max(100, Math.round(job.pay * .14));
    company.projects++;
    company.cash += retainer;
    company.earnings += retainer;
    if (company.projects === 1) notice(`${company.name} earned its first support retainer. Reinvest from the Company panel.`, 'good');
  }

  if (!collaborator) return;
  const contact = legacy.friends[collaborator.id];
  const { loyal } = NETWORK[collaborator.id];
  legacy.collaborator = null;
  contact.shares++;
  if (loyal) {
    contact.rapport = bound(contact.rapport + 12);
    state.rep += 2;
    life.followers += 10;
    if (company) { company.cash += 175; company.earnings += 175; }
    notice(`${collaborator.name} credited your work and sent a referral. +2 reputation, +10 followers${company ? ', +$175 company cash' : ''}.`, 'good');
    return;
  }

  if (contact.shares === 1) {
    notice(`${collaborator.name} shared your results without tagging you. Be careful what you share next.`, 'warn');
    return;
  }
  contact.status = 'rival';
  contact.rapport = 0;
  const loss = Math.min(14, life.followers);
  life.followers -= loss;
  state.rep = Math.max(0, state.rep - 3);
  const lead = state.board.filter(offer => offer.side && !offer.story && offer.id !== job.id).sort((a, b) => b.pay - a.pay)[0];
  if (lead) state.board = state.board.filter(offer => offer.id !== lead.id);
  notice(`${collaborator.name} claimed the work as their own${lead ? ` and poached the “${lead.title}” lead` : ''}. You lost ${loss} followers and up to 3 reputation.`, 'bad');
}
