/**
 * Realm ranks, realm levels and realm abilities. Each of the ten realm ranks is split into ten
 * realm levels (shown as 3L4); every realm level is worth one realm ability point. Points buy
 * passive abilities in up to five levels, or active abilities used from the hotbar.
 */
import { CLASSES, REALM_RANKS, type ClassId, type Role } from './data';

export interface RealmLevel {
  /** 0-based rank, as RANK_TITLES and REALM_RANKS index it */
  rank: number;
  /** 0 to 9 within the rank */
  sub: number;
  /** realm levels gained in all: also the realm ability points earned */
  index: number;
}

export function realmLevel(rp: number): RealmLevel {
  let rank = 0;
  while (rank + 1 < REALM_RANKS.length && rp >= REALM_RANKS[rank + 1]) rank++;
  const next = REALM_RANKS[rank + 1];
  const sub = next === undefined ? 0 : Math.min(9, Math.floor((10 * (rp - REALM_RANKS[rank])) / (next - REALM_RANKS[rank])));
  return { rank, sub, index: rank * 10 + sub };
}

/** "3L4": realm rank 3, level 4. */
export const realmLevelText = (rp: number) => {
  const l = realmLevel(rp);
  return `${l.rank + 1}L${l.sub}`;
};

export type RaId =
  | 'toughness' | 'aug_str' | 'aug_con' | 'aug_dex' | 'aug_acuity'
  | 'mastery_arms' | 'mastery_magery' | 'mastery_healing'
  | 'determination' | 'avoid_magic' | 'dodger' | 'long_wind'
  | 'purge' | 'ignore_pain' | 'charge' | 'raging_power';

export interface RealmAbilityDef {
  id: RaId;
  name: string;
  icon: string;
  /** for the icon's colours */
  school: string;
  /** passive: up to five levels. active: one level, and an ability of the same id goes on the hotbar. */
  kind: 'passive' | 'active';
  /** what one point of `values` means, with {v} for the value */
  desc: string;
  /** points for each level */
  costs: number[];
  /** the bonus at each level */
  values: number[];
  /** shown as a percentage */
  pct?: boolean;
  /** only for these roles, or only for classes with power */
  roles?: Role[];
  power?: boolean;
}

const PASSIVE = [1, 2, 3, 5, 7];

export const REALM_ABILITIES: RealmAbilityDef[] = [
  { id: 'toughness', name: 'Toughness', icon: 'heart', school: 'melee', kind: 'passive', desc: '+{v} maximum health.', costs: PASSIVE, values: [0.03, 0.06, 0.09, 0.12, 0.15], pct: true },
  { id: 'aug_str', name: 'Augmented Strength', icon: 'rage', school: 'melee', kind: 'passive', desc: '+{v} Strength.', costs: PASSIVE, values: [4, 8, 12, 17, 22] },
  { id: 'aug_con', name: 'Augmented Constitution', icon: 'shield', school: 'melee', kind: 'passive', desc: '+{v} Constitution.', costs: PASSIVE, values: [4, 8, 12, 17, 22] },
  { id: 'aug_dex', name: 'Augmented Dexterity', icon: 'wind', school: 'ranged', kind: 'passive', desc: '+{v} Dexterity.', costs: PASSIVE, values: [4, 8, 12, 17, 22] },
  { id: 'aug_acuity', name: 'Augmented Acuity', icon: 'eye', school: 'energy', kind: 'passive', desc: '+{v} to your casting stat (Intelligence or Piety).', costs: PASSIVE, values: [4, 8, 12, 17, 22], power: true },
  { id: 'mastery_arms', name: 'Mastery of Arms', icon: 'attack', school: 'melee', kind: 'passive', desc: '+{v} damage with weapons and styles.', costs: PASSIVE, values: [0.03, 0.06, 0.09, 0.12, 0.15], pct: true },
  { id: 'mastery_magery', name: 'Mastery of Magery', icon: 'fire', school: 'fire', kind: 'passive', desc: '+{v} damage with spells.', costs: PASSIVE, values: [0.03, 0.06, 0.09, 0.12, 0.15], pct: true, power: true },
  { id: 'mastery_healing', name: 'Mastery of Healing', icon: 'bigheart', school: 'holy', kind: 'passive', desc: '+{v} to your heals.', costs: PASSIVE, values: [0.04, 0.08, 0.12, 0.16, 0.2], pct: true, roles: ['healer'] },
  { id: 'determination', name: 'Determination', icon: 'anchor', school: 'melee', kind: 'passive', desc: 'Stuns, roots and snares on you last {v} less.', costs: PASSIVE, values: [0.1, 0.2, 0.3, 0.4, 0.5], pct: true },
  { id: 'avoid_magic', name: 'Avoidance of Magic', icon: 'ward', school: 'energy', kind: 'passive', desc: '{v} less damage from spells.', costs: PASSIVE, values: [0.03, 0.06, 0.09, 0.12, 0.15], pct: true },
  { id: 'dodger', name: 'Dodger', icon: 'wind', school: 'melee', kind: 'passive', desc: '+{v} chance to evade.', costs: PASSIVE, values: [0.01, 0.02, 0.03, 0.04, 0.05], pct: true },
  { id: 'long_wind', name: 'Long Wind', icon: 'lungs', school: 'melee', kind: 'passive', desc: 'Sprinting uses {v} less endurance.', costs: PASSIVE, values: [0.15, 0.3, 0.45, 0.6, 0.75], pct: true },
  { id: 'purge', name: 'Purge', icon: 'purge', school: 'holy', kind: 'active', desc: 'Breaks every stun, root, snare, poison, bleed and curse on you. Works while stunned. Recast 10 minutes.', costs: [8], values: [1] },
  { id: 'ignore_pain', name: 'Ignore Pain', icon: 'heart', school: 'melee', kind: 'active', desc: 'Heals 40% of your health at once. Recast 15 minutes.', costs: [6], values: [1] },
  { id: 'charge', name: 'Charge', icon: 'boot', school: 'melee', kind: 'active', desc: 'Run 50% faster for 15 seconds, and nothing can slow or root you. Recast 5 minutes.', costs: [5], values: [1] },
  { id: 'raging_power', name: 'Raging Power', icon: 'surge', school: 'energy', kind: 'active', desc: 'Refills your power at once. Recast 15 minutes.', costs: [6], values: [1], power: true },
];
export const RA_BY_ID = Object.fromEntries(REALM_ABILITIES.map((r) => [r.id, r])) as Record<RaId, RealmAbilityDef>;

export type RealmAbilities = Partial<Record<RaId, number>>;

/** Points to buy an ability up to a level. */
export const raCost = (ra: RealmAbilityDef, level: number) => ra.costs.slice(0, level).reduce((a, b) => a + b, 0);

export function raSpent(ras: RealmAbilities) {
  let n = 0;
  for (const [id, lv] of Object.entries(ras)) if (RA_BY_ID[id as RaId] && lv) n += raCost(RA_BY_ID[id as RaId], lv);
  return n;
}

export const raFree = (rp: number, ras: RealmAbilities) => realmLevel(rp).index - raSpent(ras);

/** Why a class can't take this ability, or null if it can. */
export function raBlocked(cls: ClassId, ra: RealmAbilityDef): string | null {
  const def = CLASSES[cls];
  if (ra.power && !def.powerStat) return 'Only for classes with power';
  if (ra.roles && !ra.roles.includes(def.arch)) return `Only for ${ra.roles.map((r) => `${r}s`).join(' and ')}`;
  return null;
}

/** The bonus a passive gives at the level bought, or 0. */
export function raValue(ras: RealmAbilities | undefined, id: RaId) {
  const lv = ras?.[id] ?? 0;
  return lv ? RA_BY_ID[id].values[lv - 1] : 0;
}

export function raText(ra: RealmAbilityDef, level: number) {
  const v = ra.values[Math.max(0, level - 1)];
  return ra.desc.replace('{v}', ra.pct ? `${Math.round(v * 100)}%` : String(v));
}

/** Active realm abilities bought: these go on the hotbar like any other ability. */
export const raActives = (ras: RealmAbilities | undefined) => REALM_ABILITIES.filter((r) => r.kind === 'active' && (ras?.[r.id] ?? 0) > 0).map((r) => r.id as string);

/** Respecs grow dearer with rank: a silver per rank, times ten. */
export const raRespecCost = (rp: number) => (realmLevel(rp).rank + 1) * 1000;
