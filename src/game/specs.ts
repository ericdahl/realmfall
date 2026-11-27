/**
 * Specialization lines. Every class has three; each starts at 1 and is raised with points
 * earned on levelling (1.5 × the new level). Raising a line from n to n+1 costs n+1 points,
 * and no line can go above your level. A line's level unlocks its abilities and sets how
 * strong they are; a line at your level is as strong as the game was before lines existed.
 */
import { ABILITIES, type ClassId } from './data';

/** What raising the line does besides unlocking abilities. */
/** stealth: how close an enemy must be to see you, and how fast you move hidden. */
export type Passive = 'melee' | 'ranged' | 'parry' | 'block' | 'evade' | 'stealth';

export interface LineDef {
  id: string;
  name: string;
  desc: string;
  passive?: Passive;
  abilities: string[];
}

const BLADES: LineDef = { id: 'blades', name: 'Blades', passive: 'melee', desc: 'Sword styles. Raises the damage of every swing.', abilities: ['slash', 'backhand', 'flank_cut', 'executioner', 'sweeping_blow'] };
const SHIELDS: LineDef = { id: 'shields', name: 'Shields', passive: 'block', desc: 'Shield work. Raises your chance to block.', abilities: ['shield_bash', 'rally', 'shield_slam', 'bulwark'] };
const ARCHERY: LineDef = { id: 'archery', name: 'Archery', passive: 'ranged', desc: 'The bow. Raises the damage of every arrow.', abilities: ['aimed_shot', 'critical_shot', 'volley', 'piercing_shot'] };
const HUNTING: LineDef = { id: 'hunting', name: 'Hunting', desc: 'Snares, pins and wounds that bleed.', abilities: ['crippling_arrow', 'quick_shot', 'pinning_shot', 'barbed_arrow'] };
const SURVIVAL: LineDef = { id: 'survival', name: 'Survival', passive: 'evade', desc: 'Staying alive in the wild. Raises your chance to evade.', abilities: ['evasion', 'fleet_foot', 'second_wind', 'field_dressing'] };
const FROST: LineDef = { id: 'frost', name: 'Frost', desc: 'Cold that slows and holds. Raises the power of frost spells.', abilities: ['frost_lance', 'ice_shard', 'frost_nova', 'hailstorm'] };
const DAGGERS: LineDef = { id: 'daggers', name: 'Daggers', passive: 'melee', desc: 'Dagger styles. Raises the damage of every stab.', abilities: ['stab', 'twist', 'low_blow', 'eviscerate', 'fan_of_knives'] };
const SHADOWS: LineDef = { id: 'shadows', name: 'Shadows', passive: 'stealth', desc: 'Hiding and opening from it. Enemies must come closer to see you, and you move faster hidden.', abilities: ['stealth', 'ambush', 'garrote', 'shadowstep', 'vanish'] };
const RESTORATION: LineDef = { id: 'restoration', name: 'Restoration', desc: 'Healing. Raises the power of every heal.', abilities: ['mend', 'renew', 'greater_mend', 'sanctuary'] };
const ENHANCEMENT: LineDef = { id: 'enhancement', name: 'Enhancement', desc: 'Blessings for you and your realm-mates.', abilities: ['blessing', 'ward_of_faith', 'resolve', 'shield_of_faith'] };

export const LINES: Record<ClassId, LineDef[]> = {
  // Valmora
  warden: [BLADES, SHIELDS, { id: 'defence', name: 'Defence', passive: 'parry', desc: 'Holding the line. Raises your chance to parry.', abilities: ['riposte', 'taunt', 'second_wind', 'stand_fast'] }],
  yeoman: [ARCHERY, HUNTING, SURVIVAL],
  wizard: [
    { id: 'fire', name: 'Fire', desc: 'Raw damage, up close and from the sky. Raises the power of fire spells.', abilities: ['fire_bolt', 'flame_ring', 'immolate', 'meteor'] },
    FROST,
    { id: 'storm', name: 'Storm', desc: 'Roots, wards and lightning. Raises the power of storm spells.', abilities: ['root', 'focus', 'arcane_shield', 'lightning'] },
  ],
  cleric: [RESTORATION, { id: 'smiting', name: 'Smiting', desc: 'Holy wrath. Raises the power of holy damage.', abilities: ['smite', 'focus', 'holy_stun', 'holy_fire'] }, ENHANCEMENT],
  // Eldwyn
  thornguard: [BLADES, SHIELDS, { id: 'briar', name: 'Briar', passive: 'parry', desc: 'Thorns and roots. Raises your chance to parry.', abilities: ['thorn_skin', 'entangle', 'second_wind', 'briar_patch'] }],
  ranger: [ARCHERY, HUNTING, { id: 'glamour', name: 'Glamour', passive: 'evade', desc: 'Light and illusion. Raises your chance to evade.', abilities: ['evasion', 'dazzle', 'fleet_foot', 'shimmer'] }],
  mistweaver: [
    { id: 'light', name: 'Light', desc: 'Bolts, lances and the dawn. Raises the power of light spells.', abilities: ['light_bolt', 'sunflare', 'radiant_lance', 'dawnstrike'] },
    { id: 'void', name: 'Void', desc: 'Slows, rot and hunger that heals you. Raises the power of void spells.', abilities: ['void_bolt', 'entropy', 'unmaking', 'oblivion'] },
    { id: 'mana', name: 'Mana', desc: 'Roots, wards and surges of power.', abilities: ['mana_bind', 'focus', 'mana_ward', 'arcane_surge'] },
  ],
  druid: [RESTORATION, { id: 'nature', name: 'Nature', desc: 'The wild’s wrath. Raises the power of nature spells.', abilities: ['sting', 'entangle', 'swarm', 'wrath_of_the_wild'] }, ENHANCEMENT],
  // Hroth
  huskarl: [
    { id: 'axes', name: 'Axes', passive: 'melee', desc: 'Axe styles. Raises the damage of every swing.', abilities: ['cleave', 'gash', 'hamstring', 'skullsplitter', 'whirling_axe'] },
    SHIELDS,
    { id: 'fury', name: 'Fury', passive: 'parry', desc: 'Rage and endurance. Raises your chance to parry.', abilities: ['berserk', 'war_cry', 'second_wind', 'stand_fast'] },
  ],
  hunter: [ARCHERY, HUNTING, SURVIVAL],
  runecarver: [
    { id: 'runes', name: 'Runes', desc: 'Runes that burst and bind. Raises the power of rune spells.', abilities: ['rune_bolt', 'focus', 'binding_rune', 'rune_blast', 'great_rune'] },
    FROST,
    { id: 'darkness', name: 'Darkness', desc: 'Drains, rot and dread. Raises the power of dark spells.', abilities: ['drain_life', 'wither', 'dread', 'soul_siphon'] },
  ],
  // stealth
  cutthroat: [DAGGERS, SHADOWS, { id: 'poisons', name: 'Poisons', desc: 'Poisons for your daggers, and smoke to vanish in.', abilities: ['deadly_poison', 'crippling_poison', 'numbing_poison', 'smoke_bomb'] }],
  shade: [DAGGERS, SHADOWS, { id: 'night', name: 'Night', desc: 'The night’s own tricks: veils, blindness and moonlight.', abilities: ['night_veil', 'blind', 'moonblade', 'shadow_dance'] }],
  nightwolf: [DAGGERS, SHADOWS, { id: 'savagery', name: 'Savagery', desc: 'Frenzy, rending and the pounce.', abilities: ['frenzy', 'rend', 'howl', 'pounce'] }],
  seer: [
    RESTORATION,
    { id: 'storm', name: 'Storm', desc: 'Lightning and winter wind. Raises the power of storm spells.', abilities: ['spark', 'gale', 'thunderstrike', 'lightning'] },
    { id: 'augury', name: 'Augury', desc: 'Reading the fates for you and your realm-mates.', abilities: ['foresight', 'haste', 'resolve', 'fates_ward'] },
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
  thornguard: [[1, 0.7, 0], [1, 0, 0.7], [0.7, 0.7, 0.7]],
  huskarl: [[1, 0.7, 0], [1, 0, 0.7], [0.7, 0.7, 0.7]],
  yeoman: [[1, 0.7, 0], [1, 0, 0.7], [0.8, 0.8, 0.4]],
  ranger: [[1, 0.7, 0], [1, 0, 0.7], [0.8, 0.8, 0.4]],
  hunter: [[1, 0.7, 0], [1, 0, 0.7], [0.8, 0.8, 0.4]],
  wizard: [[1, 0, 0.7], [0, 1, 0.7], [0.7, 0, 1]],
  mistweaver: [[1, 0, 0.7], [0, 1, 0.7], [0.7, 1, 0]],
  runecarver: [[1, 0.7, 0], [0, 0.7, 1], [0.7, 0, 1]],
  cleric: [[1, 0, 0.7], [0.7, 1, 0], [1, 0.6, 0.4]],
  druid: [[1, 0, 0.7], [0.7, 1, 0], [1, 0.6, 0.4]],
  seer: [[1, 0, 0.7], [0.7, 1, 0], [1, 0.6, 0.4]],
  cutthroat: [[1, 0.7, 0.5], [0.7, 1, 0.5]],
  shade: [[1, 0.7, 0.5], [0.7, 1, 0.5]],
  nightwolf: [[1, 0.7, 0.5], [1, 0.5, 0.7]],
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
