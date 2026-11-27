/**
 * Release notes shown in game (click the version on the title screen).
 * Add an entry at the top with every version bump; tests/changelog.test.ts checks it matches package.json.
 * Write for players: what they will see, not what changed in the code.
 */
export interface Release { version: string; date: string; title: string; notes: string[] }

export const CHANGELOG: Release[] = [
  {
    version: '0.4.0',
    date: '2026-11-27',
    title: 'A class for every realm',
    notes: [
      'Each realm now has its own four classes. Valmora: Warden, Yeoman, Wizard and Cleric. Eldwyn: Thornguard, Ranger, Mistweaver and Druid. Hroth: Huskarl, Hunter, Runecarver and Seer.',
      'Classes of the same role share some lines and differ in others. The Thornguard grows Thorn Skin and roots with briars; the Huskarl fights with an axe, Berserk and War Cry; the Ranger dazzles with glamour; the Mistweaver drains life through the void; the Runecarver binds with runes and drinks life through the dark; the Druid stings with swarms; the Seer calls lightning and hastes its realm-mates.',
      'About forty new abilities, with new effects: thorns that hurt whoever hits you, dazzles that make enemies miss, haste, and spells that heal you for part of the damage they do.',
      'Soldiers, guards and keep lords fight as their own realm’s classes, so the frontier sees each realm fight differently.',
      'Your heroes become their realm’s class of the same role (a Runecaller of Hroth is now a Runecarver, a Ranger of Valmora a Yeoman). Line levels carry over to the line in the same place, and every hero gets a free respec.',
    ],
  },
  {
    version: '0.3.1',
    date: '2026-11-27',
    title: 'A tidier endurance bar',
    notes: ['The endurance bar shows just the percentage, without the word Endurance.'],
  },
  {
    version: '0.3.0',
    date: '2026-11-27',
    title: 'Specialization lines',
    notes: [
      'Every class now has three specialization lines. Warden: Blades, Shields and Defence. Ranger: Archery, Hunting and Survival. Runecaller: Fire, Frost and Storm. Cleric: Restoration, Smiting and Enhancement.',
      'Each level gives you specialization points (one and a half times the level). Spend them in the Abilities window (K): raising a line from n to n+1 costs n+1 points, and no line can go above your level. The Abilities button glows when you have points to spend.',
      'A line unlocks its abilities as it rises and makes them stronger: spells and heals are as strong as their line, Blades and Archery raise weapon damage, and Shields, Defence and Survival raise block, parry and evade. You can’t max everything, so choose.',
      'Eighteen new abilities, among them Sweeping Blow, Shield Slam, Bulwark, Stand Fast, Pinning Shot, Barbed Arrow, Piercing Shot, Field Dressing, Immolate, Ice Shard, Frost Nova, Hailstorm, Holy Fire, Ward of Faith and Shield of Faith.',
      'Respec from the Abilities window: free up to level 5, then it costs copper. Heroes made before this version start with their class’s usual build and one free respec.',
      'Soldiers, guards and other heroes have builds of their own, so two Runecallers in a warband may fight quite differently.',
    ],
  },
  {
    version: '0.2.1',
    date: '2026-11-27',
    title: 'A green endurance bar',
    notes: [
      'The endurance bar under your power bar is now green and labelled, so you can see how much you have left for sprinting and styles.',
      'Hover over your health, power and endurance bars to see which is which.',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-11-27',
    title: 'New keys, a frame-rate readout and release notes',
    notes: [
      'A and D now strafe, Q and E turn. The arrow keys still turn.',
      'X switches sprint on and off; holding Shift still sprints. Sprint stops by itself when you run out of endurance.',
      'Add ?fps to the address, or tick Show frame rate in the Menu, to see frames per second, frame times, draw calls and triangles.',
      'Click the version number on the title screen (or Release notes in the Menu) to read what changed.',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-11-27',
    title: 'First playable',
    notes: [
      'Three realms, Valmora, Eldwyn and Hroth, each with a town, a home region and a gate onto the shared frontier.',
      'Four classes: Warden, Ranger, Runecaller and Cleric, with styles, cast interrupts and con-coloured enemies.',
      'Level 1 to 20 in monster camps that grow tougher away from town, with named monsters, loot, a merchant and kill tasks.',
      'AI warbands from every realm besiege and capture seven frontier keeps. Fight alongside them, or talk to a soldier and lead the whole warband.',
      'War map, minimap, day and night, and heroes that save to this browser.',
    ],
  },
];

export function changelogHtml(): string {
  return CHANGELOG.map((r) => `<section class="rel"><h4>${r.version} · ${r.title}</h4><small>${r.date}</small><ul>${r.notes.map((n) => `<li>${n}</li>`).join('')}</ul></section>`).join('');
}
