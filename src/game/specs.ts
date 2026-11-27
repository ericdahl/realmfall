/**
 * Specialization lines. Every class has three; each starts at 1 and is raised with points
 * earned on levelling (1.5 × the new level). Raising a line from n to n+1 costs n+1 points,
 * and no line can go above your level. A line's level unlocks its abilities and sets how
 * strong they are; a line at your level is as strong as the game was before lines existed.
 */
import { ABILITIES, type ClassId } from './data';

/** What raising the line does besides unlocking abilities. */
export type Passive = 'melee' | 'ranged' | 'parry' | 'block' | 'evade';

export interface LineDef {
  id: string;
  name: string;
  desc: string;
  passive?: Passive;
  abilities: string[];
}

export const LINES: Record<ClassId, LineDef[]> = {
  warden: [
    { id: 'blades', name: 'Blades', passive: 'melee', desc: 'Sword styles. Raises the damage of every swing.', abilities: ['slash', 'backhand', 'flank_cut', 'executioner', 'sweeping_blow'] },
    { id: 'shields', name: 'Shields', passive: 'block', desc: 'Shield work. Raises your chance to block.', abilities: ['shield_bash', 'rally', 'shield_slam', 'bulwark'] },
    { id: 'defence', name: 'Defence', passive: 'parry', desc: 'Holding the line. Raises your chance to parry.', abilities: ['riposte', 'taunt', 'second_wind', 'stand_fast'] },
  ],
  ranger: [
    { id: 'archery', name: 'Archery', passive: 'ranged', desc: 'The longbow. Raises the damage of every arrow.', abilities: ['aimed_shot', 'critical_shot', 'volley', 'piercing_shot'] },
    { id: 'hunting', name: 'Hunting', desc: 'Snares, pins and wounds that bleed.', abilities: ['crippling_arrow', 'quick_shot', 'pinning_shot', 'barbed_arrow'] },
    { id: 'survival', name: 'Survival', passive: 'evade', desc: 'Staying alive in the wild. Raises your chance to evade.', abilities: ['evasion', 'fleet_foot', 'second_wind', 'field_dressing'] },
  ],
  runecaller: [
    { id: 'fire', name: 'Fire', desc: 'Raw damage, up close and from the sky. Raises the power of fire spells.', abilities: ['fire_bolt', 'flame_ring', 'immolate', 'meteor'] },
    { id: 'frost', name: 'Frost', desc: 'Cold that slows and holds. Raises the power of frost spells.', abilities: ['frost_lance', 'ice_shard', 'frost_nova', 'hailstorm'] },
    { id: 'storm', name: 'Storm', desc: 'Roots, wards and lightning. Raises the power of storm spells.', abilities: ['root', 'focus', 'arcane_shield', 'lightning'] },
  ],
  cleric: [
    { id: 'restoration', name: 'Restoration', desc: 'Healing. Raises the power of every heal.', abilities: ['mend', 'renew', 'greater_mend', 'sanctuary'] },
    { id: 'smiting', name: 'Smiting', desc: 'Holy wrath. Raises the power of holy damage.', abilities: ['smite', 'focus', 'holy_stun', 'holy_fire'] },
    { id: 'enhancement', name: 'Enhancement', desc: 'Blessings for you and your realm-mates.', abilities: ['blessing', 'ward_of_faith', 'resolve', 'shield_of_faith'] },
  ],
};

export type Specs = Record<string, number>;

/** All points earned by a level: 1.5 × each level from 2, halves carried over. */
export const pointsAt = (level: number) => (level < 2 ? 0 : Math.floor((1.5 * (level * (level + 1))) / 2 - 1.5));

/** Points earned on reaching a level. */
export const pointsForLevel = (level: number) => pointsAt(level) - pointsAt(level - 1);

/** Points it takes to raise a line from 1 to n. */
export const lineCost = (n: number) => (n * (n + 1)) / 2 - 1;

export function spent(specs: Specs) {
  let n = 0;
  for (const v of Object.values(specs)) n += lineCost(v);
  return n;
}

export const freePoints = (level: number, specs: Specs) => pointsAt(level) - spent(specs);

export function baseSpecs(cls: ClassId): Specs {
  return Object.fromEntries(LINES[cls].map((l) => [l.id, 1]));
}

export function lineOf(cls: ClassId, ab: string): LineDef | undefined {
  return LINES[cls].find((l) => l.abilities.includes(ab));
}

/** Abilities a hero of this class knows with these lines, in line order. */
export function knownAbilities(cls: ClassId, specs: Specs): string[] {
  const out: string[] = [];
  for (const l of LINES[cls]) {
    for (const a of l.abilities) if (ABILITIES[a].level <= (specs[l.id] ?? 1) && !out.includes(a)) out.push(a);
  }
  return out;
}

/** How far a line with this passive is towards your level, 0 to 1. Lines start at 1. */
export function passiveFrac(cls: ClassId, specs: Specs, level: number, passive: Passive): number | null {
  const l = LINES[cls].find((x) => x.passive === passive);
  if (!l) return null;
  return Math.min(1, (specs[l.id] ?? 1) / Math.max(1, level));
}

/** Respecs are free while you are finding your feet. */
export const respecCost = (level: number) => (level <= 5 ? 0 : level * level * 20);

/**
 * Builds for computer heroes, soldiers and guards: how high each line goes as a share of
 * level, in line order. The first is what heroes from before lines existed were given.
 */
export const BUILDS: Record<ClassId, number[][]> = {
  warden: [[1, 0.7, 0], [1, 0, 0.7], [0.7, 0.7, 0.7]],
  ranger: [[1, 0.7, 0], [1, 0, 0.7], [0.8, 0.8, 0.4]],
  runecaller: [[1, 0, 0.7], [0, 1, 0.7], [0.7, 0, 1]],
  cleric: [[1, 0, 0.7], [0.7, 1, 0], [1, 0.6, 0.4]],
};

/** Spends a level's points by a build: each line toward its share, the most wanted first. */
export function autoSpec(cls: ClassId, level: number, build: number[]): Specs {
  const lines = LINES[cls];
  const specs = baseSpecs(cls);
  let budget = pointsAt(level);
  const order = lines.map((l, i) => ({ id: l.id, want: build[i] ?? 0 })).sort((a, b) => b.want - a.want);
  const raise = (id: string, to: number) => {
    while (specs[id] < to && budget >= specs[id] + 1) {
      budget -= specs[id] + 1;
      specs[id]++;
    }
  };
  for (const o of order) raise(o.id, Math.max(1, Math.round(level * o.want)));
  for (const o of order) if (o.want > 0) raise(o.id, level);
  return specs;
}
