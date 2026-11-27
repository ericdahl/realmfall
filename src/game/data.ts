/** Static game data: classes, abilities, monsters, item bases and progression curves. */
import type { RealmId } from './geo';

/** What a class does in a fight. Every realm has one class of each. */
export type Role = 'tank' | 'archer' | 'caster' | 'healer' | 'stealther';
/** Roles that fight in warbands and garrisons, in the order they're drawn. */
export const ROLES: Role[] = ['tank', 'archer', 'caster', 'healer'];
export const ALL_ROLES: Role[] = [...ROLES, 'stealther'];
export type ClassId =
  | 'warden' | 'yeoman' | 'wizard' | 'cleric' // Valmora
  | 'thornguard' | 'ranger' | 'mistweaver' | 'druid' // Eldwyn
  | 'huskarl' | 'hunter' | 'runecarver' | 'seer' // Hroth
  | 'cutthroat' | 'shade' | 'nightwolf'; // stealth, one per realm
export type StatId = 'str' | 'con' | 'dex' | 'int' | 'pie';
export const STATS: StatId[] = ['str', 'con', 'dex', 'int', 'pie'];
export const STAT_NAMES: Record<StatId, string> = { str: 'Strength', con: 'Constitution', dex: 'Dexterity', int: 'Intelligence', pie: 'Piety' };

export type WeaponKind = 'sword' | 'axe' | 'dagger' | 'bow' | 'staff' | 'mace' | 'claws' | 'fangs' | 'fists' | 'branch' | 'spores';
export const WEAPONS: Record<WeaponKind, { speed: number; range: number; verb: string; noun: string; ranged?: boolean }> = {
  sword: { speed: 3.4, range: 3.6, verb: 'attack', noun: 'sword' },
  axe: { speed: 3.6, range: 3.6, verb: 'attack', noun: 'axe' },
  dagger: { speed: 2.6, range: 3.2, verb: 'stab', noun: 'daggers' },
  bow: { speed: 4.2, range: 38, verb: 'shoot', noun: 'bow', ranged: true },
  staff: { speed: 4.0, range: 3.8, verb: 'attack', noun: 'staff' },
  mace: { speed: 3.6, range: 3.6, verb: 'attack', noun: 'mace' },
  claws: { speed: 3.0, range: 3.4, verb: 'claws', noun: 'claws' },
  fangs: { speed: 3.0, range: 3.4, verb: 'bites', noun: 'fangs' },
  fists: { speed: 3.8, range: 4.4, verb: 'pummels', noun: 'fists' },
  branch: { speed: 4.4, range: 4.6, verb: 'lashes', noun: 'branches' },
  spores: { speed: 3.2, range: 3.4, verb: 'stings', noun: 'touch' },
};

export type ArmorType = 'plate' | 'chain' | 'leather' | 'cloth';
export const ARMOR_MUL: Record<ArmorType, number> = { plate: 1, chain: 0.85, leather: 0.62, cloth: 0.35 };

export interface ClassDef {
  id: ClassId;
  name: string;
  realm: RealmId;
  arch: Role;
  /** a few words for the class picker */
  role: string;
  desc: string;
  hpPerLevel: number;
  powerStat: 'int' | 'pie' | null;
  base: Record<StatId, number>;
  growth: Record<StatId, number>;
  weapon: WeaponKind;
  armor: ArmorType;
  parry: number;
  block: number;
  evade: number;
  /** multiplier on melee swings */
  melee: number;
}

type Template = Omit<ClassDef, 'id' | 'name' | 'realm' | 'arch' | 'role' | 'desc'>;
const TEMPLATES: Record<Role, Template> = {
  tank: {
    hpPerLevel: 21, powerStat: null,
    base: { str: 60, con: 55, dex: 45, int: 30, pie: 35 }, growth: { str: 2.5, con: 2, dex: 1, int: 0, pie: 0.5 },
    weapon: 'sword', armor: 'plate', parry: 0.09, block: 0.14, evade: 0.03, melee: 1.25,
  },
  archer: {
    hpPerLevel: 15, powerStat: null,
    base: { str: 45, con: 45, dex: 60, int: 30, pie: 35 }, growth: { str: 1, con: 1.5, dex: 2.5, int: 0, pie: 0.5 },
    weapon: 'bow', armor: 'leather', parry: 0.04, block: 0, evade: 0.12, melee: 0.5,
  },
  caster: {
    hpPerLevel: 11, powerStat: 'int',
    base: { str: 30, con: 40, dex: 50, int: 65, pie: 35 }, growth: { str: 0, con: 1, dex: 1, int: 3, pie: 0 },
    weapon: 'staff', armor: 'cloth', parry: 0, block: 0, evade: 0.04, melee: 0.55,
  },
  stealther: {
    hpPerLevel: 14, powerStat: null,
    base: { str: 50, con: 45, dex: 60, int: 30, pie: 35 }, growth: { str: 1.5, con: 1.5, dex: 2, int: 0, pie: 0.5 },
    weapon: 'dagger', armor: 'leather', parry: 0.06, block: 0, evade: 0.12, melee: 1.15,
  },
  healer: {
    hpPerLevel: 16, powerStat: 'pie',
    base: { str: 45, con: 50, dex: 40, int: 30, pie: 65 }, growth: { str: 1, con: 1.5, dex: 0.5, int: 0, pie: 2.5 },
    weapon: 'mace', armor: 'chain', parry: 0.03, block: 0.1, evade: 0.03, melee: 1.15,
  },
};

function cls(id: ClassId, name: string, realm: RealmId, arch: Role, role: string, desc: string, over: Partial<Template> = {}): ClassDef {
  return { id, name, realm, arch, role, desc, ...TEMPLATES[arch], ...over };
}

export const CLASSES: Record<ClassId, ClassDef> = {
  // Valmora
  warden: cls('warden', 'Warden', 0, 'tank', 'Sword and shield', 'Heavy armour, a shield and a chain of sword styles. Parries open Riposte; Slash opens Backhand, and Backhand opens Executioner.'),
  yeoman: cls('yeoman', 'Yeoman', 0, 'archer', 'Longbow', 'Leather, a longbow and a soldier’s patience. Draw times are long and any hit spoils the shot, so open from range and snare whatever runs at you.'),
  wizard: cls('wizard', 'Wizard', 0, 'caster', 'Fire, frost and storm', 'Cloth robes and a book of fire. Hits for more than anyone, but a single blow interrupts a spell. Root and Frost Lance keep things at a distance.'),
  cleric: cls('cleric', 'Cleric', 0, 'healer', 'Healing and holy wrath', 'Chain mail, a mace and a prayer for every occasion. Heals itself and its realm-mates, stuns, and smites from range.'),
  // Eldwyn
  thornguard: cls('thornguard', 'Thornguard', 1, 'tank', 'Sword, shield and briars', 'A warden of the deep wood. Sword styles and a shield like any knight, but its skin grows thorns that hurt whoever strikes it, and the briars hold fast what tries to run.', { parry: 0.1, block: 0.13 }),
  ranger: cls('ranger', 'Ranger', 1, 'archer', 'Bow and glamour', 'A forest archer who fights with light and illusion as much as arrows: dazzles the enemy so it misses, then slips away.', { evade: 0.13 }),
  mistweaver: cls('mistweaver', 'Mistweaver', 1, 'caster', 'Light, void and mana', 'Weaves light into lances and the void into hunger. Void spells drain life back to the caster; mana spells root, ward and surge.'),
  druid: cls('druid', 'Druid', 1, 'healer', 'Healing and the wild', 'Heals with the patience of the forest and stings with its wrath: swarms, entangling roots and a staff instead of a shield.', { weapon: 'staff', block: 0, parry: 0.06 }),
  // Hroth
  huskarl: cls('huskarl', 'Huskarl', 2, 'tank', 'Axe, shield and fury', 'An axe and a round shield. Axe styles bleed and split skulls, and Fury trades armour for blood: Berserk, War Cry and a refusal to fall.', { weapon: 'axe', block: 0.12, melee: 1.3 }),
  hunter: cls('hunter', 'Hunter', 2, 'archer', 'Bow', 'A Hroth bow in the snow. Long draws, crippling arrows and the hardiness to outlast what it hunts.'),
  runecarver: cls('runecarver', 'Runecarver', 2, 'caster', 'Runes, frost and darkness', 'Carves runes that bind and burst, freezes what comes close, and drinks the life of its enemies through the dark.'),
  // stealth
  cutthroat: cls('cutthroat', 'Cutthroat', 0, 'stealther', 'Daggers, shadows and poison', 'Works the alleys of the river kingdom: hides, opens from behind with Ambush or Garrote, and coats its daggers in poisons that bleed, slow and numb.'),
  shade: cls('shade', 'Shade', 1, 'stealther', 'Daggers, shadows and night', 'Half in the mists: hides, opens from behind, then blinds and dances out of reach with the night’s own tricks.'),
  nightwolf: cls('nightwolf', 'Nightwolf', 2, 'stealther', 'Daggers, shadows and savagery', 'Hunts the fjords after dark: hides, pounces on its prey, and tears it open in a frenzy.', { melee: 1.2 }),
  seer: cls('seer', 'Seer', 2, 'healer', 'Healing, storm and augury', 'Heals, calls lightning down on the realm’s enemies, and reads the fates for haste and foresight.'),
};
export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];
export const classesOf = (realm: RealmId) => CLASS_IDS.filter((c) => CLASSES[c].realm === realm);
export const classFor = (realm: RealmId, role: Role) => CLASS_IDS.find((c) => CLASSES[c].realm === realm && CLASSES[c].arch === role)!;
/** The class a hero of the four classes before realm classes became in each realm. */
export const OLD_CLASS_ROLE: Record<string, Role> = { warden: 'tank', ranger: 'archer', runecaller: 'caster', cleric: 'healer' };

/** endu: extra endurance regained per second. hit: added to the chance to hit (dazzles are negative). haste: faster swings and casts. */
export type BuffStat = 'dmg' | 'armor' | 'evade' | 'speed' | 'endu' | 'hit' | 'haste';

export type EffectDef =
  | { type: 'stun'; dur: number }
  | { type: 'root'; dur: number }
  | { type: 'snare'; dur: number; value: number }
  | { type: 'dot'; dur: number; value: number } // fraction of the hit, per second
  | { type: 'hot'; dur: number; value: number; name?: string } // heal coefficient per tick
  | { type: 'buff'; dur: number; stat: BuffStat; value: number; name: string }
  | { type: 'absorb'; dur: number; value: number; name?: string }
  | { type: 'restore'; dur: 0; value: number } // endurance, at once
  | { type: 'freedom'; dur: number } // clears and wards off snares and roots
  | { type: 'thorns'; dur: number; value: number } // share of melee damage taken that hurts the attacker
  | { type: 'hide'; dur: 0 } // step into the shadows (or out of them)
  | { type: 'vanish'; dur: 0 } // hide even in a fight, and shake off whoever was after you
  | { type: 'imbue'; dur: number; name: string; proc: EffectDef } // every melee hit lands proc on the target
  | { type: 'step'; dur: 0 } // the caster appears behind the target
  | { type: 'focus'; dur: number }
  | { type: 'taunt'; dur: number };

export interface AbilityDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** the level its specialization line must reach */
  level: number;
  /** style: modifies the next swing. shot/spell: cast or drawn. instant: happens at once. */
  kind: 'style' | 'shot' | 'spell' | 'instant';
  costType: 'endu' | 'power';
  cost: number; // endurance: flat. power: percent of max power
  cast?: number;
  cd?: number;
  range?: number;
  target: 'enemy' | 'self' | 'ally' | 'pbaoe' | 'pbaoeAlly' | 'enemyAoe';
  radius?: number;
  school: 'melee' | 'ranged' | 'fire' | 'cold' | 'energy' | 'holy' | 'nature' | 'void' | 'light';
  /** style or shot: multiplier added to the swing */
  bonus?: number;
  /** spell damage or heal: a + b * level */
  power?: [number, number];
  heal?: boolean;
  /** pos side: beside or behind a target that faces you. pos behind: behind it, whatever it faces. stealth: only from hiding. */
  req?: { pos?: 'behind' | 'side'; after?: 'parry' | 'block' | 'evade'; follow?: string; shield?: boolean; stealth?: boolean };
  /** using it doesn't bring you out of hiding */
  keepsHidden?: boolean;
  effects?: EffectDef[];
  /** weapon damage that ignores armour */
  pierce?: boolean;
  /** share of the damage dealt that heals the caster */
  drain?: number;
  /** spell can be cast while moving (instants always can) */
  noInterrupt?: boolean;
}

export const ABILITIES: Record<string, AbilityDef> = {
  // Warden (Blades, Shields, Defence)
  slash: { id: 'slash', name: 'Slash', icon: 'sword', desc: 'A heavy cut. Opens Backhand.', level: 1, kind: 'style', costType: 'endu', cost: 5, target: 'enemy', school: 'melee', bonus: 0.45 },
  shield_bash: { id: 'shield_bash', name: 'Shield Bash', icon: 'shield', desc: 'Stuns the target for 3 seconds and interrupts any spell.', level: 1, kind: 'instant', costType: 'endu', cost: 8, cd: 20, range: 4, target: 'enemy', school: 'melee', bonus: -0.5, effects: [{ type: 'stun', dur: 3 }] },
  riposte: { id: 'riposte', name: 'Riposte', icon: 'riposte', desc: 'After you parry: a fast counter for heavy damage.', level: 1, kind: 'style', costType: 'endu', cost: 4, target: 'enemy', school: 'melee', bonus: 1.3, req: { after: 'parry' } },
  backhand: { id: 'backhand', name: 'Backhand', icon: 'chain', desc: 'Follows Slash. Hits hard and slows the target by 35% for 8 seconds. Opens Executioner.', level: 4, kind: 'style', costType: 'endu', cost: 6, target: 'enemy', school: 'melee', bonus: 0.95, req: { follow: 'slash' }, effects: [{ type: 'snare', dur: 8, value: 0.35 }] },
  rally: { id: 'rally', name: 'Rally', icon: 'banner', desc: '+25% armour for 30 seconds.', level: 5, kind: 'instant', costType: 'endu', cost: 10, cd: 60, target: 'self', school: 'melee', effects: [{ type: 'buff', dur: 30, stat: 'armor', value: 0.25, name: 'Rally' }] },
  flank_cut: { id: 'flank_cut', name: 'Flank Cut', icon: 'flank', desc: 'From the side or behind: a deep cut that bleeds for 10 seconds.', level: 8, kind: 'style', costType: 'endu', cost: 7, target: 'enemy', school: 'melee', bonus: 1.4, req: { pos: 'side' }, effects: [{ type: 'dot', dur: 10, value: 0.06 }] },
  executioner: { id: 'executioner', name: 'Executioner', icon: 'axe', desc: 'Follows Backhand. A brutal finishing blow.', level: 12, kind: 'style', costType: 'endu', cost: 8, target: 'enemy', school: 'melee', bonus: 2.2, req: { follow: 'backhand' } },
  sweeping_blow: { id: 'sweeping_blow', name: 'Sweeping Blow', icon: 'sweep', desc: 'A wide swing that hits every enemy within 5 metres.', level: 16, kind: 'instant', costType: 'endu', cost: 12, cd: 20, radius: 5, target: 'pbaoe', school: 'melee', bonus: 0.3 },
  shield_slam: { id: 'shield_slam', name: 'Shield Slam', icon: 'slam', desc: 'After you block: slams the target with your shield, stunning it for 2 seconds.', level: 9, kind: 'style', costType: 'endu', cost: 6, target: 'enemy', school: 'melee', bonus: 0.6, req: { after: 'block' }, effects: [{ type: 'stun', dur: 2 }] },
  bulwark: { id: 'bulwark', name: 'Bulwark', icon: 'bulwark', desc: '+50% armour for 20 seconds, but you move 30% slower.', level: 14, kind: 'instant', costType: 'endu', cost: 10, cd: 90, target: 'self', school: 'melee', effects: [{ type: 'buff', dur: 20, stat: 'armor', value: 0.5, name: 'Bulwark' }, { type: 'buff', dur: 20, stat: 'speed', value: -0.3, name: 'Bulwark (slowed)' }] },
  second_wind: { id: 'second_wind', name: 'Second Wind', icon: 'lungs', desc: 'Restores half your endurance at once.', level: 10, kind: 'instant', costType: 'endu', cost: 0, cd: 120, target: 'self', school: 'melee', effects: [{ type: 'restore', dur: 0, value: 50 }] },
  stand_fast: { id: 'stand_fast', name: 'Stand Fast', icon: 'anchor', desc: 'Breaks snares and roots, and none can hold you for 10 seconds.', level: 15, kind: 'instant', costType: 'endu', cost: 8, cd: 60, target: 'self', school: 'melee', effects: [{ type: 'freedom', dur: 10 }] },
  taunt: { id: 'taunt', name: 'Challenge', icon: 'horn', desc: 'Forces nearby monsters and soldiers to attack you for 6 seconds.', level: 5, kind: 'instant', costType: 'endu', cost: 6, cd: 20, target: 'pbaoe', radius: 12, school: 'melee', effects: [{ type: 'taunt', dur: 6 }] },

  // Yeoman and Hunter (Archery, Hunting, Survival)
  aimed_shot: { id: 'aimed_shot', name: 'Aimed Shot', icon: 'arrow', desc: 'A long draw for double damage.', level: 1, kind: 'shot', costType: 'endu', cost: 5, cast: 2.6, range: 40, target: 'enemy', school: 'ranged', bonus: 1.0 },
  crippling_arrow: { id: 'crippling_arrow', name: 'Crippling Arrow', icon: 'snarearrow', desc: 'A quick draw that slows the target by 45% for 10 seconds.', level: 1, kind: 'shot', costType: 'endu', cost: 6, cast: 1.5, range: 40, target: 'enemy', school: 'ranged', bonus: 0.1, effects: [{ type: 'snare', dur: 10, value: 0.45 }] },
  quick_shot: { id: 'quick_shot', name: 'Snap Shot', icon: 'quick', desc: 'An instant shot. Usable in melee.', level: 4, kind: 'instant', costType: 'endu', cost: 7, cd: 8, range: 40, target: 'enemy', school: 'ranged', bonus: 0.2 },
  evasion: { id: 'evasion', name: 'Evasion', icon: 'wind', desc: '+25% chance to evade for 15 seconds.', level: 1, kind: 'instant', costType: 'endu', cost: 8, cd: 60, target: 'self', school: 'ranged', effects: [{ type: 'buff', dur: 15, stat: 'evade', value: 0.25, name: 'Evasion' }] },
  critical_shot: { id: 'critical_shot', name: 'Heart-Seeker', icon: 'crit', desc: 'A four-second draw for four times the damage. Patience.', level: 7, kind: 'shot', costType: 'endu', cost: 10, cast: 4, cd: 12, range: 45, target: 'enemy', school: 'ranged', bonus: 3.0 },
  volley: { id: 'volley', name: 'Volley', icon: 'volley', desc: 'Rains arrows on everything within 8 metres of the target.', level: 12, kind: 'shot', costType: 'endu', cost: 12, cast: 2, cd: 25, range: 40, radius: 8, target: 'enemyAoe', school: 'ranged', bonus: 0.6 },
  piercing_shot: { id: 'piercing_shot', name: 'Piercing Shot', icon: 'pierce', desc: 'A heavy arrow that goes straight through armour.', level: 17, kind: 'shot', costType: 'endu', cost: 10, cast: 2.4, cd: 15, range: 40, target: 'enemy', school: 'ranged', bonus: 1.4, pierce: true },
  pinning_shot: { id: 'pinning_shot', name: 'Pinning Shot', icon: 'pin', desc: 'Pins the target to the ground for 8 seconds. Damage frees it after the first two.', level: 9, kind: 'shot', costType: 'endu', cost: 8, cast: 1.8, cd: 20, range: 40, target: 'enemy', school: 'ranged', bonus: -0.5, effects: [{ type: 'root', dur: 8 }] },
  barbed_arrow: { id: 'barbed_arrow', name: 'Barbed Arrow', icon: 'barb', desc: 'An arrow that makes the target bleed for 12 seconds.', level: 14, kind: 'shot', costType: 'endu', cost: 8, cast: 2, range: 40, target: 'enemy', school: 'ranged', bonus: 0.4, effects: [{ type: 'dot', dur: 12, value: 0.08 }] },
  fleet_foot: { id: 'fleet_foot', name: 'Fleet Foot', icon: 'boot', desc: 'Run 40% faster for 8 seconds.', level: 6, kind: 'instant', costType: 'endu', cost: 10, cd: 45, target: 'self', school: 'ranged', effects: [{ type: 'buff', dur: 8, stat: 'speed', value: 0.4, name: 'Fleet Foot' }] },
  field_dressing: { id: 'field_dressing', name: 'Field Dressing', icon: 'bandage', desc: 'Binds your wounds (or a friend’s), healing over 12 seconds.', level: 16, kind: 'instant', costType: 'endu', cost: 10, cd: 60, range: 6, target: 'ally', school: 'ranged', power: [4, 1.6], heal: true, effects: [{ type: 'hot', dur: 12, value: 1, name: 'Field Dressing' }] },

  // Wizard (Fire, Frost, Storm)
  fire_bolt: { id: 'fire_bolt', name: 'Fire Bolt', icon: 'fire', desc: 'Hurls fire at the target.', level: 1, kind: 'spell', costType: 'power', cost: 7, cast: 2.5, range: 34, target: 'enemy', school: 'fire', power: [9, 5.6] },
  frost_lance: { id: 'frost_lance', name: 'Frost Lance', icon: 'frost', desc: 'Cold damage that slows the target by 50% for 10 seconds.', level: 1, kind: 'spell', costType: 'power', cost: 7, cast: 2.1, range: 34, target: 'enemy', school: 'cold', power: [6, 3.6], effects: [{ type: 'snare', dur: 10, value: 0.5 }] },
  root: { id: 'root', name: 'Earthbind', icon: 'root', desc: 'Roots the target in place for 15 seconds. Damage frees it after the first two.', level: 1, kind: 'spell', costType: 'power', cost: 8, cast: 1.6, cd: 12, range: 32, target: 'enemy', school: 'energy', effects: [{ type: 'root', dur: 15 }] },
  focus: { id: 'focus', name: 'Focus', icon: 'eye', desc: 'Your next spell cannot be interrupted.', level: 4, kind: 'instant', costType: 'power', cost: 3, cd: 30, target: 'self', school: 'energy', effects: [{ type: 'focus', dur: 20 }] },
  arcane_shield: { id: 'arcane_shield', name: 'Rune Ward', icon: 'ward', desc: 'Absorbs damage equal to a third of your life for 20 seconds.', level: 8, kind: 'instant', costType: 'power', cost: 12, cd: 45, target: 'self', school: 'energy', effects: [{ type: 'absorb', dur: 20, value: 0.33 }] },
  flame_ring: { id: 'flame_ring', name: 'Flame Ring', icon: 'ring', desc: 'Instant fire around you (8 m).', level: 6, kind: 'instant', costType: 'power', cost: 10, cd: 15, radius: 8, target: 'pbaoe', school: 'fire', power: [8, 4] },
  lightning: { id: 'lightning', name: 'Thunderclap', icon: 'bolt', desc: 'A slow cast that strikes very hard.', level: 12, kind: 'spell', costType: 'power', cost: 11, cast: 3.2, range: 36, target: 'enemy', school: 'energy', power: [16, 10] },
  meteor: { id: 'meteor', name: 'Starfall', icon: 'meteor', desc: 'Fire from the sky on everything within 9 m of the target.', level: 15, kind: 'spell', costType: 'power', cost: 16, cast: 3.5, cd: 30, range: 36, radius: 9, target: 'enemyAoe', school: 'fire', power: [14, 7.5] },
  immolate: { id: 'immolate', name: 'Immolate', icon: 'burn', desc: 'Sets the target alight: a small hit, then it burns for 12 seconds.', level: 10, kind: 'spell', costType: 'power', cost: 8, cast: 2, range: 34, target: 'enemy', school: 'fire', power: [4, 2.2], effects: [{ type: 'dot', dur: 12, value: 0.12 }] },
  ice_shard: { id: 'ice_shard', name: 'Ice Shard', icon: 'shard', desc: 'A quick, cheap bolt of ice.', level: 5, kind: 'spell', costType: 'power', cost: 5, cast: 1.4, range: 34, target: 'enemy', school: 'cold', power: [5, 3.2] },
  frost_nova: { id: 'frost_nova', name: 'Frost Nova', icon: 'nova', desc: 'Instant cold around you (7 m) that roots everything it hits for 6 seconds.', level: 10, kind: 'instant', costType: 'power', cost: 10, cd: 25, radius: 7, target: 'pbaoe', school: 'cold', power: [3, 1.5], effects: [{ type: 'root', dur: 6 }] },
  hailstorm: { id: 'hailstorm', name: 'Hailstorm', icon: 'hail', desc: 'Hail on everything within 9 m of the target, slowing it by 40% for 8 seconds.', level: 15, kind: 'spell', costType: 'power', cost: 15, cast: 3, cd: 30, range: 36, radius: 9, target: 'enemyAoe', school: 'cold', power: [10, 5.5], effects: [{ type: 'snare', dur: 8, value: 0.4 }] },

  // Cleric (Restoration, Smiting, Enhancement)
  smite: { id: 'smite', name: 'Smite', icon: 'sun', desc: 'Holy damage at range.', level: 1, kind: 'spell', costType: 'power', cost: 6, cast: 2.2, range: 32, target: 'enemy', school: 'holy', power: [7, 4.6] },
  mend: { id: 'mend', name: 'Mend', icon: 'heart', desc: 'Heals you or your target.', level: 1, kind: 'spell', costType: 'power', cost: 8, cast: 2.5, range: 30, target: 'ally', school: 'holy', power: [14, 8], heal: true },
  renew: { id: 'renew', name: 'Renew', icon: 'renew', desc: 'Heals over 12 seconds. Instant.', level: 4, kind: 'instant', costType: 'power', cost: 7, cd: 10, range: 30, target: 'ally', school: 'holy', power: [3, 1.4], heal: true, effects: [{ type: 'hot', dur: 12, value: 1 }] },
  blessing: { id: 'blessing', name: 'Blessing of Arms', icon: 'bless', desc: '+15% damage for you and realm-mates within 20 m, for 10 minutes.', level: 1, kind: 'instant', costType: 'power', cost: 10, cd: 10, radius: 20, target: 'pbaoeAlly', school: 'holy', effects: [{ type: 'buff', dur: 600, stat: 'dmg', value: 0.15, name: 'Blessing of Arms' }] },
  holy_stun: { id: 'holy_stun', name: 'Rebuke', icon: 'stun', desc: 'Stuns the target for 4 seconds.', level: 8, kind: 'instant', costType: 'power', cost: 8, cd: 30, range: 20, target: 'enemy', school: 'holy', effects: [{ type: 'stun', dur: 4 }] },
  greater_mend: { id: 'greater_mend', name: 'Greater Mend', icon: 'bigheart', desc: 'A slower, much larger heal.', level: 9, kind: 'spell', costType: 'power', cost: 14, cast: 3.2, range: 30, target: 'ally', school: 'holy', power: [30, 17], heal: true },
  sanctuary: { id: 'sanctuary', name: 'Sanctuary', icon: 'sanct', desc: 'Heals you and every realm-mate within 15 m.', level: 15, kind: 'instant', costType: 'power', cost: 18, cd: 30, radius: 15, target: 'pbaoeAlly', school: 'holy', power: [18, 9], heal: true },
  holy_fire: { id: 'holy_fire', name: 'Holy Fire', icon: 'holyfire', desc: 'Holy flame that keeps burning the target for 12 seconds.', level: 13, kind: 'spell', costType: 'power', cost: 9, cast: 2.4, range: 32, target: 'enemy', school: 'holy', power: [6, 3], effects: [{ type: 'dot', dur: 12, value: 0.1 }] },
  ward_of_faith: { id: 'ward_of_faith', name: 'Ward of Faith', icon: 'wardfaith', desc: '+20% armour for you and realm-mates within 20 m, for 10 minutes.', level: 6, kind: 'instant', costType: 'power', cost: 10, cd: 10, radius: 20, target: 'pbaoeAlly', school: 'holy', effects: [{ type: 'buff', dur: 600, stat: 'armor', value: 0.2, name: 'Ward of Faith' }] },
  resolve: { id: 'resolve', name: 'Resolve', icon: 'resolve', desc: 'You and realm-mates within 20 m regain endurance twice as fast, for 10 minutes.', level: 11, kind: 'instant', costType: 'power', cost: 10, cd: 10, radius: 20, target: 'pbaoeAlly', school: 'holy', effects: [{ type: 'buff', dur: 600, stat: 'endu', value: 3.5, name: 'Resolve' }] },
  shield_of_faith: { id: 'shield_of_faith', name: 'Shield of Faith', icon: 'faithshield', desc: 'Wraps you or a friend in light that absorbs damage equal to a quarter of their life, for 20 seconds.', level: 16, kind: 'instant', costType: 'power', cost: 12, cd: 30, range: 30, target: 'ally', school: 'holy', effects: [{ type: 'absorb', dur: 20, value: 0.25, name: 'Shield of Faith' }] },

  // Huskarl: Axes and Fury
  cleave: { id: 'cleave', name: 'Cleave', icon: 'axe', desc: 'A heavy chop. Opens Gash.', level: 1, kind: 'style', costType: 'endu', cost: 5, target: 'enemy', school: 'melee', bonus: 0.45 },
  gash: { id: 'gash', name: 'Gash', icon: 'gash', desc: 'Follows Cleave. A deep cut that bleeds for 10 seconds. Opens Skullsplitter.', level: 4, kind: 'style', costType: 'endu', cost: 6, target: 'enemy', school: 'melee', bonus: 0.8, req: { follow: 'cleave' }, effects: [{ type: 'dot', dur: 10, value: 0.06 }] },
  hamstring: { id: 'hamstring', name: 'Hamstring', icon: 'flank', desc: 'From the side or behind: hits hard and slows the target by 40% for 10 seconds.', level: 8, kind: 'style', costType: 'endu', cost: 7, target: 'enemy', school: 'melee', bonus: 1.1, req: { pos: 'side' }, effects: [{ type: 'snare', dur: 10, value: 0.4 }] },
  skullsplitter: { id: 'skullsplitter', name: 'Skullsplitter', icon: 'skull', desc: 'Follows Gash. A brutal overhead blow.', level: 12, kind: 'style', costType: 'endu', cost: 8, target: 'enemy', school: 'melee', bonus: 2.2, req: { follow: 'gash' } },
  whirling_axe: { id: 'whirling_axe', name: 'Whirling Axe', icon: 'whirl', desc: 'Spins with the axe out, hitting every enemy within 5 metres.', level: 16, kind: 'instant', costType: 'endu', cost: 12, cd: 20, radius: 5, target: 'pbaoe', school: 'melee', bonus: 0.3 },
  berserk: { id: 'berserk', name: 'Berserk', icon: 'rage', desc: '+25% damage for 15 seconds, but 20% less armour.', level: 1, kind: 'instant', costType: 'endu', cost: 8, cd: 60, target: 'self', school: 'melee', effects: [{ type: 'buff', dur: 15, stat: 'dmg', value: 0.25, name: 'Berserk' }, { type: 'buff', dur: 15, stat: 'armor', value: -0.2, name: 'Berserk (reckless)' }] },
  war_cry: { id: 'war_cry', name: 'War Cry', icon: 'warcry', desc: '+10% damage for you and realm-mates within 15 m, for 30 seconds.', level: 5, kind: 'instant', costType: 'endu', cost: 10, cd: 60, radius: 15, target: 'pbaoeAlly', school: 'melee', effects: [{ type: 'buff', dur: 30, stat: 'dmg', value: 0.1, name: 'War Cry' }] },

  // Thornguard: Briar
  thorn_skin: { id: 'thorn_skin', name: 'Thorn Skin', icon: 'thorns', desc: 'For 30 seconds, whoever hits you in melee takes a quarter of the damage back.', level: 1, kind: 'instant', costType: 'endu', cost: 8, cd: 40, target: 'self', school: 'nature', effects: [{ type: 'thorns', dur: 30, value: 0.25 }] },
  entangle: { id: 'entangle', name: 'Entangle', icon: 'vines', desc: 'Roots the target in place for 8 seconds. Damage frees it after the first two.', level: 5, kind: 'instant', costType: 'endu', cost: 8, cd: 30, range: 20, target: 'enemy', school: 'nature', effects: [{ type: 'root', dur: 8 }] },
  briar_patch: { id: 'briar_patch', name: 'Briar Patch', icon: 'bramble', desc: 'Briars burst from the ground around you (8 m), slowing every enemy by 50% for 8 seconds.', level: 14, kind: 'instant', costType: 'endu', cost: 10, cd: 25, radius: 8, target: 'pbaoe', school: 'nature', effects: [{ type: 'snare', dur: 8, value: 0.5 }] },

  // Ranger: Glamour
  dazzle: { id: 'dazzle', name: 'Dazzle', icon: 'dazzle', desc: 'A flash of glamour: the target misses 30% more often for 10 seconds.', level: 5, kind: 'instant', costType: 'endu', cost: 8, cd: 20, range: 30, target: 'enemy', school: 'nature', effects: [{ type: 'buff', dur: 10, stat: 'hit', value: -0.3, name: 'Dazzled' }] },
  shimmer: { id: 'shimmer', name: 'Shimmer', icon: 'shimmer', desc: 'An illusion takes the blows: absorbs damage equal to a fifth of your life for 20 seconds.', level: 14, kind: 'instant', costType: 'endu', cost: 10, cd: 60, target: 'self', school: 'nature', effects: [{ type: 'absorb', dur: 20, value: 0.2, name: 'Shimmer' }] },

  // Mistweaver: Light, Void, Mana
  light_bolt: { id: 'light_bolt', name: 'Light Bolt', icon: 'sun', desc: 'Hurls a bolt of light at the target.', level: 1, kind: 'spell', costType: 'power', cost: 7, cast: 2.5, range: 34, target: 'enemy', school: 'light', power: [9, 5.6] },
  sunflare: { id: 'sunflare', name: 'Sunflare', icon: 'nova', desc: 'Instant light around you (8 m) that burns and dazzles: enemies miss 25% more often for 8 seconds.', level: 6, kind: 'instant', costType: 'power', cost: 10, cd: 20, radius: 8, target: 'pbaoe', school: 'light', power: [6, 3], effects: [{ type: 'buff', dur: 8, stat: 'hit', value: -0.25, name: 'Dazzled' }] },
  radiant_lance: { id: 'radiant_lance', name: 'Radiant Lance', icon: 'lance', desc: 'A slow cast that strikes very hard.', level: 10, kind: 'spell', costType: 'power', cost: 11, cast: 3.2, range: 36, target: 'enemy', school: 'light', power: [16, 10] },
  dawnstrike: { id: 'dawnstrike', name: 'Dawnstrike', icon: 'meteor', desc: 'Light from the sky on everything within 9 m of the target.', level: 15, kind: 'spell', costType: 'power', cost: 16, cast: 3.5, cd: 30, range: 36, radius: 9, target: 'enemyAoe', school: 'light', power: [14, 7.5] },
  void_bolt: { id: 'void_bolt', name: 'Void Bolt', icon: 'void', desc: 'Void damage that slows the target by 50% for 10 seconds.', level: 1, kind: 'spell', costType: 'power', cost: 7, cast: 2.1, range: 34, target: 'enemy', school: 'void', power: [6, 3.6], effects: [{ type: 'snare', dur: 10, value: 0.5 }] },
  entropy: { id: 'entropy', name: 'Entropy', icon: 'entropy', desc: 'Unravels the target: a small hit, then it withers for 12 seconds.', level: 5, kind: 'spell', costType: 'power', cost: 8, cast: 2, range: 34, target: 'enemy', school: 'void', power: [4, 2.2], effects: [{ type: 'dot', dur: 12, value: 0.12 }] },
  unmaking: { id: 'unmaking', name: 'Unmaking', icon: 'drain', desc: 'Pulls the life out of the target; half of the damage heals you.', level: 10, kind: 'spell', costType: 'power', cost: 10, cast: 2.8, range: 30, target: 'enemy', school: 'void', power: [10, 6], drain: 0.5 },
  oblivion: { id: 'oblivion', name: 'Oblivion', icon: 'oblivion', desc: 'A long cast that tears a hole in the target.', level: 15, kind: 'spell', costType: 'power', cost: 15, cast: 4, cd: 20, range: 36, target: 'enemy', school: 'void', power: [22, 13] },
  mana_bind: { id: 'mana_bind', name: 'Mana Bind', icon: 'root', desc: 'Roots the target in place for 15 seconds. Damage frees it after the first two.', level: 1, kind: 'spell', costType: 'power', cost: 8, cast: 1.6, cd: 12, range: 32, target: 'enemy', school: 'energy', effects: [{ type: 'root', dur: 15 }] },
  mana_ward: { id: 'mana_ward', name: 'Mana Ward', icon: 'ward', desc: 'Absorbs damage equal to a third of your life for 20 seconds.', level: 8, kind: 'instant', costType: 'power', cost: 12, cd: 45, target: 'self', school: 'energy', effects: [{ type: 'absorb', dur: 20, value: 0.33, name: 'Mana Ward' }] },
  arcane_surge: { id: 'arcane_surge', name: 'Arcane Surge', icon: 'surge', desc: '+25% damage for 20 seconds.', level: 12, kind: 'instant', costType: 'power', cost: 8, cd: 90, target: 'self', school: 'energy', effects: [{ type: 'buff', dur: 20, stat: 'dmg', value: 0.25, name: 'Arcane Surge' }] },

  // Runecarver: Runes and Darkness (Frost is shared with the Wizard)
  rune_bolt: { id: 'rune_bolt', name: 'Rune Bolt', icon: 'rune', desc: 'A carved rune that bursts on the target.', level: 1, kind: 'spell', costType: 'power', cost: 7, cast: 2.5, range: 34, target: 'enemy', school: 'energy', power: [9, 5.6] },
  binding_rune: { id: 'binding_rune', name: 'Binding Rune', icon: 'binding', desc: 'Roots the target in place for 15 seconds. Damage frees it after the first two.', level: 7, kind: 'spell', costType: 'power', cost: 8, cast: 1.6, cd: 12, range: 32, target: 'enemy', school: 'energy', effects: [{ type: 'root', dur: 15 }] },
  rune_blast: { id: 'rune_blast', name: 'Rune Blast', icon: 'ring', desc: 'The runes on your robes burst: instant damage around you (8 m).', level: 10, kind: 'instant', costType: 'power', cost: 10, cd: 15, radius: 8, target: 'pbaoe', school: 'energy', power: [8, 4] },
  great_rune: { id: 'great_rune', name: 'Great Rune', icon: 'greatrune', desc: 'A rune the size of a hall bursts on everything within 9 m of the target.', level: 15, kind: 'spell', costType: 'power', cost: 16, cast: 3.5, cd: 30, range: 36, radius: 9, target: 'enemyAoe', school: 'energy', power: [14, 7.5] },
  drain_life: { id: 'drain_life', name: 'Drain Life', icon: 'drain', desc: 'Darkness damage; half of it heals you.', level: 1, kind: 'spell', costType: 'power', cost: 7, cast: 2.6, range: 30, target: 'enemy', school: 'void', power: [6, 3.8], drain: 0.5 },
  wither: { id: 'wither', name: 'Wither', icon: 'entropy', desc: 'A small hit, then the target rots for 12 seconds.', level: 5, kind: 'spell', costType: 'power', cost: 8, cast: 2, range: 34, target: 'enemy', school: 'void', power: [4, 2.2], effects: [{ type: 'dot', dur: 12, value: 0.12 }] },
  dread: { id: 'dread', name: 'Dread', icon: 'skull', desc: 'Terror freezes the target for 3 seconds and stops any spell.', level: 9, kind: 'instant', costType: 'power', cost: 8, cd: 30, range: 20, target: 'enemy', school: 'void', effects: [{ type: 'stun', dur: 3 }] },
  soul_siphon: { id: 'soul_siphon', name: 'Soul Siphon', icon: 'siphon', desc: 'A slow cast that tears out the target’s life; 60% of the damage heals you.', level: 13, kind: 'spell', costType: 'power', cost: 12, cast: 3.2, cd: 15, range: 30, target: 'enemy', school: 'void', power: [14, 8.5], drain: 0.6 },

  // Druid: Nature (Restoration and Enhancement are shared with the Cleric)
  sting: { id: 'sting', name: 'Sting', icon: 'thorns', desc: 'Nature damage at range.', level: 1, kind: 'spell', costType: 'power', cost: 6, cast: 2.2, range: 32, target: 'enemy', school: 'nature', power: [7, 4.6] },
  swarm: { id: 'swarm', name: 'Swarm', icon: 'swarm', desc: 'Insects sting the target for 12 seconds.', level: 9, kind: 'spell', costType: 'power', cost: 9, cast: 2.4, range: 32, target: 'enemy', school: 'nature', power: [6, 3], effects: [{ type: 'dot', dur: 12, value: 0.1 }] },
  wrath_of_the_wild: { id: 'wrath_of_the_wild', name: 'Wrath of the Wild', icon: 'bramble', desc: 'Thorns and stones on everything within 9 m of the target.', level: 13, kind: 'spell', costType: 'power', cost: 15, cast: 3, cd: 30, range: 36, radius: 9, target: 'enemyAoe', school: 'nature', power: [10, 5.5] },

  // Seer: Storm and Augury (Restoration is shared with the Cleric)
  spark: { id: 'spark', name: 'Spark', icon: 'bolt', desc: 'Lightning at range.', level: 1, kind: 'spell', costType: 'power', cost: 6, cast: 2.2, range: 32, target: 'enemy', school: 'energy', power: [7, 4.6] },
  gale: { id: 'gale', name: 'Gale', icon: 'wind', desc: 'A freezing wind that hurts and slows the target by 40% for 10 seconds.', level: 5, kind: 'spell', costType: 'power', cost: 7, cast: 2, range: 32, target: 'enemy', school: 'cold', power: [5, 3], effects: [{ type: 'snare', dur: 10, value: 0.4 }] },
  thunderstrike: { id: 'thunderstrike', name: 'Thunderstrike', icon: 'stun', desc: 'Stuns the target for 4 seconds.', level: 9, kind: 'instant', costType: 'power', cost: 8, cd: 30, range: 20, target: 'enemy', school: 'energy', effects: [{ type: 'stun', dur: 4 }] },
  foresight: { id: 'foresight', name: 'Foresight', icon: 'eye', desc: '+6% chance to evade for you and realm-mates within 20 m, for 10 minutes.', level: 1, kind: 'instant', costType: 'power', cost: 8, cd: 10, radius: 20, target: 'pbaoeAlly', school: 'energy', effects: [{ type: 'buff', dur: 600, stat: 'evade', value: 0.06, name: 'Foresight' }] },
  haste: { id: 'haste', name: 'Haste', icon: 'haste', desc: 'You and realm-mates within 20 m swing and cast 15% faster, for 10 minutes.', level: 5, kind: 'instant', costType: 'power', cost: 10, cd: 10, radius: 20, target: 'pbaoeAlly', school: 'energy', effects: [{ type: 'buff', dur: 600, stat: 'haste', value: 0.15, name: 'Haste' }] },
  fates_ward: { id: 'fates_ward', name: 'Fate’s Ward', icon: 'faithshield', desc: 'The fates turn a blow: absorbs damage equal to a quarter of a friend’s life, for 20 seconds.', level: 16, kind: 'instant', costType: 'power', cost: 12, cd: 30, range: 30, target: 'ally', school: 'energy', effects: [{ type: 'absorb', dur: 20, value: 0.25, name: 'Fate’s Ward' }] },

  // Stealth: Daggers and Shadows (shared), Poisons (Cutthroat), Night (Shade), Savagery (Nightwolf)
  stab: { id: 'stab', name: 'Stab', icon: 'dagger', desc: 'A quick thrust. Opens Twist.', level: 1, kind: 'style', costType: 'endu', cost: 4, target: 'enemy', school: 'melee', bonus: 0.35 },
  twist: { id: 'twist', name: 'Twist the Knife', icon: 'chain', desc: 'Follows Stab. Opens Eviscerate.', level: 4, kind: 'style', costType: 'endu', cost: 5, target: 'enemy', school: 'melee', bonus: 0.9, req: { follow: 'stab' } },
  low_blow: { id: 'low_blow', name: 'Low Blow', icon: 'flank', desc: 'From the side or behind: hits hard and slows the target by 30% for 8 seconds.', level: 8, kind: 'style', costType: 'endu', cost: 6, target: 'enemy', school: 'melee', bonus: 1.2, req: { pos: 'side' }, effects: [{ type: 'snare', dur: 8, value: 0.3 }] },
  eviscerate: { id: 'eviscerate', name: 'Eviscerate', icon: 'gash', desc: 'Follows Twist the Knife. A vicious finishing cut.', level: 12, kind: 'style', costType: 'endu', cost: 8, target: 'enemy', school: 'melee', bonus: 2.3, req: { follow: 'twist' } },
  fan_of_knives: { id: 'fan_of_knives', name: 'Fan of Knives', icon: 'fan', desc: 'Throws knives at every enemy within 5 metres.', level: 16, kind: 'instant', costType: 'endu', cost: 12, cd: 20, radius: 5, target: 'pbaoe', school: 'melee', bonus: 0.25 },
  stealth: { id: 'stealth', name: 'Stealth', icon: 'cloak', desc: 'Step into the shadows. Enemies only see you up close, and you move more slowly. Attacking, casting or being hurt brings you out. Not in a fight.', level: 1, kind: 'instant', costType: 'endu', cost: 0, cd: 2, target: 'self', school: 'melee', keepsHidden: true, effects: [{ type: 'hide', dur: 0 }] },
  ambush: { id: 'ambush', name: 'Ambush', icon: 'ambush', desc: 'From hiding, behind the target: a devastating opening blow.', level: 2, kind: 'style', costType: 'endu', cost: 10, target: 'enemy', school: 'melee', bonus: 2.4, req: { stealth: true, pos: 'behind' } },
  garrote: { id: 'garrote', name: 'Garrote', icon: 'garrote', desc: 'From hiding: chokes the target, stunning it for 4 seconds.', level: 6, kind: 'style', costType: 'endu', cost: 10, target: 'enemy', school: 'melee', bonus: 0.3, req: { stealth: true }, effects: [{ type: 'stun', dur: 4 }] },
  shadowstep: { id: 'shadowstep', name: 'Shadowstep', icon: 'step', desc: 'Step through the shadows to just behind the target, without leaving them.', level: 10, kind: 'instant', costType: 'endu', cost: 8, cd: 30, range: 25, target: 'enemy', school: 'melee', keepsHidden: true, effects: [{ type: 'step', dur: 0 }] },
  vanish: { id: 'vanish', name: 'Vanish', icon: 'vanish', desc: 'Disappear even in the middle of a fight. Whoever was fighting you loses you.', level: 14, kind: 'instant', costType: 'endu', cost: 10, cd: 120, target: 'self', school: 'melee', keepsHidden: true, effects: [{ type: 'vanish', dur: 0 }] },
  deadly_poison: { id: 'deadly_poison', name: 'Deadly Poison', icon: 'vial', desc: 'Coats your daggers for 10 minutes: every hit poisons the target for 9 seconds.', level: 1, kind: 'instant', costType: 'endu', cost: 0, cd: 5, target: 'self', school: 'nature', keepsHidden: true, effects: [{ type: 'imbue', dur: 600, name: 'Deadly Poison', proc: { type: 'dot', dur: 9, value: 0.08 } }] },
  crippling_poison: { id: 'crippling_poison', name: 'Crippling Poison', icon: 'vial2', desc: 'Coats your daggers for 10 minutes: every hit slows the target by 35% for 6 seconds.', level: 5, kind: 'instant', costType: 'endu', cost: 0, cd: 5, target: 'self', school: 'nature', keepsHidden: true, effects: [{ type: 'imbue', dur: 600, name: 'Crippling Poison', proc: { type: 'snare', dur: 6, value: 0.35 } }] },
  numbing_poison: { id: 'numbing_poison', name: 'Numbing Poison', icon: 'vial3', desc: 'Coats your daggers for 10 minutes: every hit makes the target swing and cast 25% slower for 8 seconds.', level: 10, kind: 'instant', costType: 'endu', cost: 0, cd: 5, target: 'self', school: 'nature', keepsHidden: true, effects: [{ type: 'imbue', dur: 600, name: 'Numbing Poison', proc: { type: 'buff', dur: 8, stat: 'haste', value: -0.25, name: 'Numbed' } }] },
  smoke_bomb: { id: 'smoke_bomb', name: 'Smoke Bomb', icon: 'smoke', desc: 'Choking smoke around you (8 m): enemies miss 40% more often for 8 seconds.', level: 15, kind: 'instant', costType: 'endu', cost: 10, cd: 45, radius: 8, target: 'pbaoe', school: 'nature', effects: [{ type: 'buff', dur: 8, stat: 'hit', value: -0.4, name: 'Blinded' }] },
  night_veil: { id: 'night_veil', name: 'Night Veil', icon: 'moon', desc: '+15% chance to evade for 20 seconds.', level: 1, kind: 'instant', costType: 'endu', cost: 8, cd: 45, target: 'self', school: 'void', keepsHidden: true, effects: [{ type: 'buff', dur: 20, stat: 'evade', value: 0.15, name: 'Night Veil' }] },
  blind: { id: 'blind', name: 'Blind', icon: 'dazzle', desc: 'Throws darkness in the target’s eyes: it misses 40% more often for 8 seconds.', level: 5, kind: 'instant', costType: 'endu', cost: 8, cd: 25, range: 10, target: 'enemy', school: 'void', effects: [{ type: 'buff', dur: 8, stat: 'hit', value: -0.4, name: 'Blinded' }] },
  moonblade: { id: 'moonblade', name: 'Moonblade', icon: 'moonblade', desc: 'A cut of cold moonlight that keeps burning for 10 seconds.', level: 9, kind: 'style', costType: 'endu', cost: 7, target: 'enemy', school: 'melee', bonus: 1.0, effects: [{ type: 'dot', dur: 10, value: 0.06 }] },
  shadow_dance: { id: 'shadow_dance', name: 'Shadow Dance', icon: 'haste', desc: 'Swing 30% faster and evade 10% more for 15 seconds.', level: 14, kind: 'instant', costType: 'endu', cost: 10, cd: 90, target: 'self', school: 'void', effects: [{ type: 'buff', dur: 15, stat: 'haste', value: 0.3, name: 'Shadow Dance' }, { type: 'buff', dur: 15, stat: 'evade', value: 0.1, name: 'Shadow Dance (evade)' }] },
  frenzy: { id: 'frenzy', name: 'Frenzy', icon: 'rage', desc: 'Swing 20% faster for 20 seconds, but 10% less armour.', level: 1, kind: 'instant', costType: 'endu', cost: 8, cd: 60, target: 'self', school: 'melee', effects: [{ type: 'buff', dur: 20, stat: 'haste', value: 0.2, name: 'Frenzy' }, { type: 'buff', dur: 20, stat: 'armor', value: -0.1, name: 'Frenzy (reckless)' }] },
  rend: { id: 'rend', name: 'Rend', icon: 'claws', desc: 'Tears the target open; it bleeds for 12 seconds.', level: 5, kind: 'style', costType: 'endu', cost: 6, target: 'enemy', school: 'melee', bonus: 0.6, effects: [{ type: 'dot', dur: 12, value: 0.1 }] },
  howl: { id: 'howl', name: 'Howl', icon: 'warcry', desc: 'A howl that chills the blood: enemies within 10 m slow by 40% for 6 seconds.', level: 9, kind: 'instant', costType: 'endu', cost: 10, cd: 30, radius: 10, target: 'pbaoe', school: 'melee', effects: [{ type: 'snare', dur: 6, value: 0.4 }] },
  pounce: { id: 'pounce', name: 'Pounce', icon: 'pounce', desc: 'Leaps onto a target up to 20 m away and stuns it for 2 seconds.', level: 14, kind: 'instant', costType: 'endu', cost: 10, cd: 30, range: 20, target: 'enemy', school: 'melee', effects: [{ type: 'step', dur: 0 }, { type: 'stun', dur: 2 }] },

  // Monster abilities
  bog_bolt: { id: 'bog_bolt', name: 'bog bolt', icon: 'frost', desc: '', level: 1, kind: 'spell', costType: 'power', cost: 0, cast: 2.4, range: 28, target: 'enemy', school: 'cold', power: [5, 3.2], effects: [{ type: 'snare', dur: 5, value: 0.3 }] },
  venom: { id: 'venom', name: 'venomous bite', icon: 'fangs', desc: '', level: 1, kind: 'style', costType: 'endu', cost: 0, target: 'enemy', school: 'melee', bonus: 0.2, effects: [{ type: 'dot', dur: 9, value: 0.08 }] },
  slam: { id: 'slam', name: 'ground slam', icon: 'stun', desc: '', level: 1, kind: 'instant', costType: 'endu', cost: 0, cd: 18, range: 5, target: 'enemy', school: 'melee', bonus: 0.6, effects: [{ type: 'stun', dur: 2 }] },
};

export const SPRINT_SPEED = 1.35;
export const RUN_SPEED = 7.2;

// ---------- Monsters ----------

export type Shape = 'humanoid' | 'quadruped' | 'spider' | 'sprite' | 'treant';

export interface MobDef {
  id: string;
  name: string;
  shape: Shape;
  /** quadrupeds: 'wolf' | 'boar' | 'bear' | 'rat' */
  variant?: string;
  color: string;
  color2: string;
  scale: number;
  levels: [number, number];
  realms?: RealmId[];
  hp: number; // multiplier
  dmg: number;
  speed: number;
  aggro: number; // metres; 0 = only fights back
  social?: boolean;
  weapon: WeaponKind;
  abilities?: string[];
  armor?: number;
  ranged?: boolean;
  caster?: boolean;
  flees?: boolean;
  look?: { body: string; trim: string; weapon?: 'sword' | 'bow' | 'staff' | 'mace' | 'none'; helm?: boolean; bones?: boolean };
}

export const MOBS: MobDef[] = [
  { id: 'rat', name: 'river rat', shape: 'quadruped', variant: 'rat', color: '#6d5b4b', color2: '#a1887f', scale: 0.45, levels: [1, 3], hp: 0.8, dmg: 0.8, speed: 5.5, aggro: 0, weapon: 'fangs', flees: true },
  { id: 'young_wolf', name: 'young wolf', shape: 'quadruped', variant: 'wolf', color: '#8d8478', color2: '#cfc6b8', scale: 0.75, levels: [1, 4], hp: 0.9, dmg: 0.95, speed: 6.5, aggro: 0, social: true, weapon: 'fangs' },
  { id: 'boar', name: 'wild boar', shape: 'quadruped', variant: 'boar', color: '#5d4037', color2: '#3e2723', scale: 0.85, levels: [2, 7], hp: 1.15, dmg: 0.95, speed: 6, aggro: 0, weapon: 'fangs' },
  { id: 'grey_wolf', name: 'grey wolf', shape: 'quadruped', variant: 'wolf', color: '#6f6f6f', color2: '#bdbdbd', scale: 0.95, levels: [4, 10], hp: 1, dmg: 1, speed: 6.8, aggro: 11, social: true, weapon: 'fangs' },
  { id: 'brigand', name: 'brigand', shape: 'humanoid', color: '#6b4f3a', color2: '#3b2f28', scale: 1, levels: [4, 12], hp: 1, dmg: 1.05, speed: 6.2, aggro: 13, social: true, weapon: 'sword', look: { body: '#5b4636', trim: '#8a2f2f', weapon: 'sword' } },
  { id: 'brigand_archer', name: 'brigand bowman', shape: 'humanoid', color: '#5a5a3a', color2: '#3b2f28', scale: 1, levels: [5, 12], hp: 0.85, dmg: 0.9, speed: 6.2, aggro: 18, social: true, weapon: 'bow', ranged: true, look: { body: '#4f5a35', trim: '#8a2f2f', weapon: 'bow' } },
  { id: 'spider', name: 'cave spider', shape: 'spider', color: '#2b2b33', color2: '#7a1f2b', scale: 1, levels: [6, 13], hp: 0.95, dmg: 0.95, speed: 6.5, aggro: 10, weapon: 'fangs', abilities: ['venom'] },
  { id: 'bear', name: 'moss bear', shape: 'quadruped', variant: 'bear', color: '#4e3b2a', color2: '#5f7a3a', scale: 1.3, levels: [9, 16], realms: [1, 2], hp: 1.35, dmg: 1.1, speed: 6, aggro: 0, weapon: 'claws' },
  { id: 'sprite', name: 'bog sprite', shape: 'sprite', color: '#6fe3c1', color2: '#1d6b57', scale: 0.8, levels: [6, 14], realms: [1], hp: 0.75, dmg: 0.8, speed: 6, aggro: 16, weapon: 'spores', caster: true, abilities: ['bog_bolt'] },
  { id: 'wight', name: 'barrow wight', shape: 'humanoid', color: '#cfc8b0', color2: '#3d4a52', scale: 1.05, levels: [10, 17], realms: [0], hp: 1.1, dmg: 1.05, speed: 6, aggro: 13, weapon: 'sword', look: { body: '#3d4a52', trim: '#9aa7b0', weapon: 'sword', bones: true, helm: true } },
  { id: 'ice_wolf', name: 'rime wolf', shape: 'quadruped', variant: 'wolf', color: '#dfe8ef', color2: '#8fb5d0', scale: 1.05, levels: [8, 15], realms: [2], hp: 1, dmg: 1.05, speed: 7, aggro: 12, social: true, weapon: 'fangs' },
  { id: 'treant', name: 'thornback treant', shape: 'treant', color: '#5b4030', color2: '#4f7f36', scale: 1.7, levels: [12, 19], realms: [1], hp: 1.6, dmg: 1.1, speed: 4.4, aggro: 9, weapon: 'branch', abilities: ['slam'], armor: 1.3 },
  { id: 'troll', name: 'frost troll', shape: 'humanoid', color: '#7fa0a8', color2: '#3e5560', scale: 1.75, levels: [13, 19], realms: [2], hp: 1.55, dmg: 1.15, speed: 5.6, aggro: 12, weapon: 'fists', abilities: ['slam'], look: { body: '#5c7a83', trim: '#d8e4e8', weapon: 'none' } },
  { id: 'dire_wolf', name: 'dire wolf', shape: 'quadruped', variant: 'wolf', color: '#2f2a28', color2: '#6b5f58', scale: 1.25, levels: [12, 19], hp: 1.1, dmg: 1.1, speed: 7.2, aggro: 14, social: true, weapon: 'fangs' },
  { id: 'fallen', name: 'fallen knight', shape: 'humanoid', color: '#34363d', color2: '#6b1f24', scale: 1.1, levels: [14, 19], realms: [0], hp: 1.3, dmg: 1.15, speed: 6, aggro: 13, weapon: 'sword', armor: 1.3, look: { body: '#2c2e34', trim: '#6b1f24', weapon: 'sword', helm: true } },
  { id: 'cultist', name: 'mistcaller', shape: 'humanoid', color: '#4a3a66', color2: '#a58bd6', scale: 1, levels: [9, 18], hp: 0.85, dmg: 0.9, speed: 6, aggro: 15, social: true, weapon: 'staff', caster: true, abilities: ['bog_bolt'], look: { body: '#3e2f5c', trim: '#a58bd6', weapon: 'staff' } },
];
export const MOB_BY_ID = Object.fromEntries(MOBS.map((m) => [m.id, m]));

/** Unique, rarely seen monsters with better loot. */
export const NAMED: { mob: string; name: string; realm?: RealmId }[] = [
  { mob: 'grey_wolf', name: 'Old Greyjaw' },
  { mob: 'boar', name: 'Tuskarr the Bristled' },
  { mob: 'brigand', name: 'Black Hesk' },
  { mob: 'spider', name: 'Mother Webb' },
  { mob: 'wight', name: 'The Unquiet Earl', realm: 0 },
  { mob: 'fallen', name: 'Ser Calloway the Lost', realm: 0 },
  { mob: 'treant', name: 'Elderbark', realm: 1 },
  { mob: 'sprite', name: 'Willowisp', realm: 1 },
  { mob: 'troll', name: 'Grundvald', realm: 2 },
  { mob: 'ice_wolf', name: 'Fenra Whitefang', realm: 2 },
  { mob: 'dire_wolf', name: 'Gorehowl' },
  { mob: 'cultist', name: 'Mother Morrow' },
];

// ---------- Curves ----------

export const MAX_LEVEL = 20;
export const xpToNext = (lvl: number) => Math.round(80 * Math.pow(lvl, 1.9));
export const mobXp = (lvl: number) => Math.round(24 * Math.pow(lvl, 1.5));

export function mobHp(lvl: number) {
  return 30 + lvl * 22;
}
export function mobDps(lvl: number) {
  return 1.4 + lvl * 1.7;
}
export function weaponDps(ilvl: number, quality = 1) {
  return (2.2 + ilvl * 0.95) * quality;
}
export function armorAf(ilvl: number, quality = 1) {
  return (3 + ilvl * 1.7) * quality;
}

export type ConColor = 'grey' | 'green' | 'blue' | 'yellow' | 'orange' | 'red' | 'purple';
export function conColor(viewer: number, target: number): ConColor {
  const d = target - viewer;
  const greyAt = viewer < 10 ? -4 : -5;
  if (d <= greyAt) return 'grey';
  if (d <= -3) return 'green';
  if (d <= -1) return 'blue';
  if (d === 0) return 'yellow';
  if (d <= 2) return 'orange';
  if (d === 3) return 'red';
  return 'purple';
}
export const CON_HEX: Record<ConColor, string> = {
  grey: '#9e9e9e', green: '#4cd964', blue: '#4aa3ff', yellow: '#ffd84a', orange: '#ff9f2e', red: '#ff4b3e', purple: '#c77dff',
};
export const CON_XP: Record<ConColor, number> = { grey: 0, green: 0.45, blue: 0.75, yellow: 1, orange: 1.25, red: 1.5, purple: 1.8 };

export const REALM_RANKS = [0, 400, 1200, 2800, 5500, 9500, 15000, 23000, 34000, 50000];
export const RANK_TITLES = [
  ['Recruit', 'Squire', 'Sergeant', 'Knight', 'Banneret', 'Captain', 'Lord Protector', 'Paladin', 'Marshal', 'Hero of Valmora'],
  ['Sapling', 'Thorn', 'Bramble', 'Warden of the Glade', 'Mistwalker', 'Elder Thorn', 'Oakheart', 'Champion of the Wood', 'Ard-Laoch', 'Hero of Eldwyn'],
  ['Thrall', 'Karl', 'Huscarl', 'Shieldbreaker', 'Wolfcoat', 'Raven-Feeder', 'Jarl', 'Saga-Sworn', 'Einherjar', 'Hero of Hroth'],
];
export function realmRank(rp: number) {
  let r = 0;
  while (r + 1 < REALM_RANKS.length && rp >= REALM_RANKS[r + 1]) r++;
  return r;
}

// ---------- Names ----------

const SYL: [string[], string[], string[]][] = [
  [['Ald', 'Bran', 'Cor', 'Ed', 'Gar', 'Hal', 'Is', 'Lor', 'Mer', 'Os', 'Per', 'Row', 'Tris', 'Wil', 'Ely', 'Gwen', 'Ros', 'Mar'], ['a', 'e', 'i', 'o', 'ar', 'el', 'en', 'is'], ['ric', 'wyn', 'mund', 'iel', 'ith', 'an', 'ard', 'ine', 'ot', 'ell', 'a']],
  [['Ae', 'Bri', 'Cae', 'Dei', 'Fio', 'Gra', 'Lia', 'Nia', 'Oi', 'Rho', 'Sio', 'Tad', 'Ul', 'Eo', 'Mae', 'Cia'], ['n', 'r', 'l', 'th', 'dh', 'v', 'nn'], ['ach', 'ra', 'wen', 'agh', 'an', 'ith', 'ael', 'id', 'a', 'eth']],
  [['Bjo', 'Dag', 'Ei', 'Gun', 'Hal', 'Ing', 'Kol', 'Rag', 'Sig', 'Thor', 'Ulf', 'Vig', 'Ast', 'Fre', 'Hel', 'Sol'], ['r', 'n', 'nd', 'l', 'rd', 'g'], ['ar', 'a', 'vald', 'rid', 'ulf', 'ny', 'mar', 'leif', 'hild', 'grim', 'is']],
];
export function realmName(realm: RealmId, r: () => number): string {
  const [a, b, c] = SYL[realm];
  const p = (arr: string[]) => arr[Math.floor(r() * arr.length)];
  let n = p(a) + (r() < 0.5 ? p(b) : '') + p(c);
  if (n.length > 11) n = n.slice(0, 11);
  return n[0].toUpperCase() + n.slice(1).toLowerCase();
}
