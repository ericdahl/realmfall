/**
 * Release notes shown in game (click the version on the title screen).
 * Add an entry at the top with every version bump; tests/changelog.test.ts checks it matches package.json.
 * Write for players: what they will see, not what changed in the code.
 */
export interface Release { version: string; date: string; title: string; notes: string[] }

export const CHANGELOG: Release[] = [
  {
    version: '0.7.0',
    date: '2026-11-28',
    title: 'Dungeons, companions and new monsters',
    notes: [
      'Each realm has a dungeon for a group of four, levels 13 to 18: Barrowdeep, an old king’s barrow under Valmora’s downs; Rotheart Hollow, a grove gone sour beneath Eldwyn’s wood; and Hrimgard Deep, the ice caves under Hroth’s glacier. Their doors are on the war map.',
      'Inside: packs of elite monsters that come together, two lieutenants, and a boss with a script. The Barrow King calls up his dead, the Rotheart roots the whole party and sheds wisps, and Hrimthurs breathes frost and cracks open the walls. Bosses always drop two artifacts named for them. Every visit starts fresh; die inside and you wake at the dungeon’s door.',
      'The new Captain in every town hires companions: up to three, your level and realm, any of the five roles. They follow you, fight what you fight, hold monsters off the others if they are tanks, heal and bless the party if they are healers, and get back up once a fight is over. Click a companion’s frame under yours to target them. They take a tenth of the coin you find, and a fuller party earns a little less experience per kill.',
      'Twelve new monsters, each with a trick: skeletons that get back up once, will-o’-wisps that burst when they die, ice wraiths you cannot see until they are close, grave callers who mend their friends, hill ogres who rush you, brigand chiefs who fly into a rage, plus shore crabs, storm harpies, ghouls, spriggans, ice crawlers and frost giants.',
      'Your heroes keep everything; their company starts empty.',
    ],
  },
  {
    version: '0.6.0',
    date: '2026-11-28',
    title: 'Realm abilities',
    notes: [
      'Realm points now buy something. Each realm rank has ten realm levels (shown as 3L4), and every realm level gives a realm ability point.',
      'Spend them in the new Realm window (L, or the Realm button, which glows when you can buy). Passives come in five levels: Toughness, Augmented Strength, Constitution, Dexterity or Acuity, Mastery of Arms, Mastery of Magery, Mastery of Healing, Determination (stuns, roots and snares wear off sooner), Avoidance of Magic, Dodger and Long Wind.',
      'Actives go on your hotbar: Purge breaks every stun, root, snare and poison and works while stunned; Ignore Pain heals 40% of your health; Charge makes you fast and unstoppable for 15 seconds; Raging Power refills your power.',
      'You can respec your realm abilities for copper. The K key now opens only the Abilities window; L opens the Realm window.',
      'Your existing heroes keep the realm points they have earned and can spend them right away.',
    ],
  },
  {
    version: '0.5.1',
    date: '2026-11-27',
    title: 'Valmora wears red, Hroth wears blue',
    notes: ['Valmora’s colour is now red and Hroth’s is blue, on banners, tabards, keeps, the map and the title screen. Eldwyn stays green.'],
  },
  {
    version: '0.5.0',
    date: '2026-11-27',
    title: 'Stealth',
    notes: [
      'A fifth class for every realm, the stealther: the Cutthroat of Valmora, the Shade of Eldwyn and the Nightwolf of Hroth. All three fight with daggers and the Shadows line; the Cutthroat adds poisons, the Shade the night’s tricks, the Nightwolf savagery.',
      'Stealth (out of combat) hides you. Enemies only see you once they are close: about three and a half metres at your level, farther if they out-level your Shadows line, and farther still for other stealthers and keep guards. You move more slowly while hidden, less so as Shadows rises.',
      'Attacking, casting or being hurt brings you out of hiding. Open with Ambush from behind or Garrote to stun; Shadowstep puts you behind a target without giving you away, and Vanish hides you even mid-fight and makes your pursuers lose you.',
      'Hidden enemies vanish from view, from the minimap and from targeting until you see them. You and hidden realm-mates show as shadows.',
      'Other heroes and warbands now include stealthers, who sneak up and open from hiding.',
    ],
  },
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
