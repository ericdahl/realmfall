import { describe, it, expect } from 'vitest';
import { World, SAVE_VERSION } from '../src/game/world';
import { MOB_BY_ID, ABILITIES, CLASS_IDS, CLASSES, ROLES } from '../src/game/data';
import { REALM_DEFS } from '../src/game/geo';
import { LINES, autoSpec, BUILDS, freePoints, lineCost, pointsAt, respecCost, spent } from '../src/game/specs';
import { migrateChar } from '../src/ui/save';
import { realmLevel, realmLevelText, raFree } from '../src/game/realm';
import { DUNGEONS, startOf, walkable, los as dungeonLos, route as dungeonRoute } from '../src/game/dungeon';
import { dist } from '../src/game/world';
import { classFor, type ClassId } from '../src/game/data';

describe('realm war', () => {
  it('keeps change hands within twenty minutes, and no realm takes everything', () => {
    const w = new World(1, { headless: true });
    w.run(60 * 20);
    expect(w.war.history.length).toBeGreaterThan(1);
    const owners = new Set(w.keeps.map((k) => k.owner));
    expect(owners.size).toBeGreaterThan(1);
  }, 120000);
});

describe('combat', () => {
  it('a level 5 warden beats a level 5 grey wolf', () => {
    const w = new World(2, { populate: false, headless: true });
    const c = World.newChar('Bot', 0, 'warden', 2);
    c.level = 5;
    c.x = -606; c.z = 350;
    const p = w.spawnPlayer(c);
    const m = w.makeMob(MOB_BY_ID.grey_wolf, 5, -606, 345);
    w.add(m);
    p.target = m.id;
    p.attacking = true;
    for (let i = 0; i < 20 * 60 && !m.dead && !p.dead; i++) {
      if (!p.queuedStyle && p.endu > 20) w.useAbility(p, 'slash');
      w.tick(0.05);
    }
    expect(m.dead).toBe(true);
    expect(w.char!.xp).toBeGreaterThan(0);
  });

  it('a hit interrupts a spell, Focus prevents it', () => {
    const w = new World(3, { populate: false, headless: true });
    const c = World.newChar('Bot', 0, 'wizard', 3);
    c.level = 10;
    c.specs = autoSpec('wizard', 10, BUILDS.wizard[0]);
    c.x = 606; c.z = 350;
    const p = w.spawnPlayer(c);
    const m = w.makeMob(MOB_BY_ID.brigand, 10, 606, 348);
    w.add(m);
    p.target = m.id;
    w.useAbility(p, 'fire_bolt');
    expect(p.cast).not.toBeNull();
    w.damage(p, m, 5, 'melee', false, 'hit');
    expect(p.cast).toBeNull();
    p.cds = {};
    w.useAbility(p, 'focus');
    w.useAbility(p, 'fire_bolt');
    w.damage(p, m, 5, 'melee', false, 'hit');
    expect(p.cast).not.toBeNull();
  });

  it('styles chain: Backhand only follows Slash', () => {
    const w = new World(4, { populate: false, headless: true });
    const c = World.newChar('Bot', 0, 'warden', 4);
    c.level = 8;
    c.x = -606; c.z = 350;
    const p = w.spawnPlayer(c);
    const m = w.makeMob(MOB_BY_ID.boar, 8, -606, 348);
    w.add(m);
    const bh = (w as any).styleBlocked(p, m, { req: { follow: 'slash' } });
    expect(bh).toMatch(/Slash/);
    p.lastStyle = { id: 'slash', t: w.t };
    expect((w as any).styleBlocked(p, m, { req: { follow: 'slash' } })).toBeNull();
  });
});

describe('progression', () => {
  it('levels up, earns points and learns abilities by training a line', () => {
    const w = new World(5, { populate: false, headless: true });
    const p = w.spawnPlayer(World.newChar('Bot', 2, 'hunter', 5));
    expect(p.abilities).toEqual(['aimed_shot', 'crippling_arrow', 'evasion']);
    w.gainXp(100000, '');
    expect(w.char!.level).toBeGreaterThan(5);
    expect(p.maxHp).toBeGreaterThan(100);
    expect(p.abilities).not.toContain('quick_shot');
    expect(freePoints(w.char!.level, w.char!.specs)).toBe(pointsAt(w.char!.level));
    for (let i = 0; i < 3; i++) expect(w.train('hunting')).toBeNull();
    expect(w.char!.specs.hunting).toBe(4);
    expect(p.abilities).toContain('quick_shot');
    expect(w.char!.hotbar).toContain('quick_shot');
  });

  it('lines cost n+1 to raise, stop at your level, and respec refunds them', () => {
    const w = new World(5, { populate: false, headless: true });
    const c = World.newChar('Bot', 0, 'warden', 5);
    c.level = 6;
    w.spawnPlayer(c);
    expect(pointsAt(6)).toBe(Math.floor(1.5 * (2 + 3 + 4 + 5 + 6)));
    expect(pointsAt(20)).toBe(313);
    for (let i = 0; i < 5; i++) expect(w.train('blades')).toBeNull();
    expect(c.specs.blades).toBe(6);
    expect(w.train('blades')).toMatch(/above your level/);
    expect(freePoints(6, c.specs)).toBe(30 - lineCost(6));
    for (let i = 0; i < 3; i++) expect(w.train('shields')).toBeNull(); // 2 + 3 + 4 of the 10 left
    expect(w.train('shields')).toMatch(/need 5 points/);
    c.hotbar[5] = 'backhand';
    expect(w.respec()).toMatch(/costs/); // 720 copper at level 6; a new hero has 150
    c.copper = 1000;
    expect(w.respec()).toBeNull();
    expect(c.copper).toBe(1000 - respecCost(6));
    expect(c.specs).toEqual({ blades: 1, shields: 1, defence: 1 });
    expect(c.hotbar).not.toContain('backhand');
    expect(w.player!.abilities).toEqual(['slash', 'shield_bash', 'riposte']);
  });

  it('spells and weapons hit harder with a higher line', () => {
    const w = new World(8, { populate: false, headless: true });
    const c = World.newChar('Bot', 0, 'wizard', 8);
    c.level = 15;
    const p = w.spawnPlayer(c);
    const fire = ABILITIES.fire_bolt;
    expect(w.powerLevel(p, fire)).toBe(1);
    c.specs.fire = 15;
    expect(w.powerLevel(p, fire)).toBe(15);
    c.specs.fire = 30;
    expect(w.powerLevel(p, fire)).toBe(15);
    const wd = World.newChar('Bot', 0, 'warden', 9);
    wd.level = 15;
    const q = w.spawnPlayer(wd);
    expect(w.weaponSpec(q, false)).toBeCloseTo(0.75 + 0.25 / 15);
    wd.specs.blades = 15;
    expect(w.weaponSpec(q, false)).toBe(1);
  });

  it('computer heroes spend their points within budget', () => {
    for (const cls of CLASS_IDS) for (const b of BUILDS[cls]) for (const lvl of [1, 5, 12, 20, 30]) {
      const sp = autoSpec(cls, lvl, b);
      expect(spent(sp)).toBeLessThanOrEqual(pointsAt(lvl));
      for (const v of Object.values(sp)) expect(v).toBeLessThanOrEqual(Math.max(1, lvl));
    }
    // a specialist maxes one line and gets the second to 14 by level 20
    expect(autoSpec('warden', 20, [1, 0.7, 0])).toEqual({ blades: 20, shields: 14, defence: 1 });
  });

  it('heroes from before lines get a build and a free respec', () => {
    const old = World.newChar('Old', 0, 'cleric', 10) as any;
    delete old.specs;
    old.version = 1;
    old.level = 14;
    old.hotbar = ['mend', 'smite', 'renew', 'sanctuary', null, null, null, null, null, null];
    migrateChar(old);
    expect(old.version).toBe(SAVE_VERSION);
    expect(old.cls).toBe('cleric');
    expect(old.freeRespec).toBe(true);
    expect(spent(old.specs)).toBeLessThanOrEqual(pointsAt(14));
    expect(old.specs.restoration).toBe(14);
    expect(old.hotbar).toContain('greater_mend');
    expect(old.hotbar).not.toContain('sanctuary'); // restoration 15
    for (const ab of ['mend', 'smite', 'renew']) expect(old.hotbar).toContain(ab);
  });

  it('heroes from before realm classes become their realm’s class of the same role', () => {
    const rc = { ...World.newChar('Old', 2, 'wizard', 11), cls: 'runecaller', version: 2, level: 12, specs: { fire: 12, frost: 1, storm: 9 } } as any;
    rc.hotbar = ['fire_bolt', 'frost_lance', 'root', 'focus', null, null, null, null, null, null];
    migrateChar(rc);
    expect(rc.cls).toBe('runecarver');
    expect(rc.specs).toEqual({ runes: 12, frost: 1, darkness: 9 });
    expect(rc.freeRespec).toBe(true);
    expect(rc.hotbar).toContain('frost_lance');
    expect(rc.hotbar).toContain('rune_bolt');
    expect(rc.hotbar).not.toContain('fire_bolt');
    const rg = { ...World.newChar('Old', 1, 'ranger', 12), version: 2, specs: { archery: 1, hunting: 1, survival: 1 } } as any;
    migrateChar(rg);
    expect(rg.cls).toBe('ranger');
    expect(rg.specs).toEqual({ archery: 1, hunting: 1, glamour: 1 });
    const wd = { ...World.newChar('Old', 0, 'warden', 13), version: 2 } as any;
    migrateChar(wd);
    expect(wd.cls).toBe('warden');
    expect(wd.specs).toEqual({ blades: 1, shields: 1, defence: 1 });
  });

});

describe('leading a warband', () => {
  it('soldiers follow the player and fight the player’s target', () => {
    const w = new World(6, { headless: true });
    w.run(20);
    const c = World.newChar('Bot', 0, 'warden', 6);
    c.level = 18;
    const p = w.spawnPlayer(c);
    const b = w.war.bands.find((x) => x.realm === 0)!;
    const s = w.get(b.members[0])!;
    p.x = s.x + 3;
    p.z = s.z;
    w.war.lead(s, p);
    // walk the player 60 m toward the centre
    for (let i = 0; i < 20 * 12; i++) {
      const d = Math.hypot(p.x, p.z);
      w.input.mx = -p.x / d;
      w.input.mz = -p.z / d;
      w.tick(0.05);
    }
    w.input.mx = w.input.mz = 0;
    w.run(4);
    const alive = b.members.map((id) => w.get(id)!).filter((e) => !e.dead);
    const near = alive.filter((e) => Math.hypot(e.x - p.x, e.z - p.z) < 15);
    expect(near.length).toBeGreaterThan(alive.length / 2);
  });
});

describe('realm classes', () => {
  it('every realm has one class of each role', () => {
    for (const r of REALM_DEFS) for (const role of ROLES) expect(CLASS_IDS.filter((c) => CLASSES[c].realm === r.id && CLASSES[c].arch === role)).toHaveLength(1);
  });

  it('every class has three lines whose abilities exist, start at 1 and climb', () => {
    for (const c of CLASS_IDS) {
      expect(LINES[c]).toHaveLength(3);
      expect(BUILDS[c].length).toBeGreaterThan(0);
      for (const l of LINES[c]) {
        const lv = l.abilities.map((a) => ABILITIES[a]?.level);
        expect(lv[0], `${c}/${l.id}`).toBe(1);
        for (let i = 1; i < lv.length; i++) expect(lv[i], `${c}/${l.id}/${l.abilities[i]}`).toBeGreaterThan(lv[i - 1]);
      }
    }
  });

  it('thorns hurt the attacker, drains heal the caster, dazzles make attacks miss', () => {
    const w = new World(11, { populate: false, headless: true });
    const p = w.spawnPlayer(World.newChar('Bot', 1, 'thornguard', 11));
    const m = w.makeMob(MOB_BY_ID.boar, 1, p.x + 2, p.z);
    w.add(m);
    w.addEffect(p, p, { type: 'thorns', dur: 30, value: 0.5 });
    const before = m.hp;
    (w as any).thorns(p, m, 10);
    expect(m.hp).toBe(before - 5);
    w.addEffect(m, p, { type: 'buff', dur: 10, stat: 'hit', value: -0.3, name: 'Dazzled' });
    expect(w.buffSum(m, 'hit')).toBeCloseTo(-0.3);
    const rc = World.newChar('Bot', 2, 'runecarver', 12);
    rc.level = 10;
    const q = w.spawnPlayer(rc);
    q.hp = 10;
    const foe = w.makeMob(MOB_BY_ID.brigand, 10, q.x + 6, q.z);
    w.add(foe);
    (w as any).resolve(q, ABILITIES.drain_life, foe);
    expect(foe.hp < foe.maxHp || q.hp === 10).toBe(true); // resisted spells do nothing
    if (foe.hp < foe.maxHp) expect(q.hp).toBeGreaterThan(10);
  });

  it('a level 8 hero of every class beats a level 6 wolf', () => {
    for (const c of CLASS_IDS) {
      const w = new World(20, { populate: false, headless: true });
      const ch = World.newChar('Bot', CLASSES[c].realm, c, 20);
      ch.level = 8;
      ch.specs = autoSpec(c, 8, BUILDS[c][0]);
      ch.x = -606; ch.z = 350;
      const p = w.spawnPlayer(ch);
      const m = w.makeMob(MOB_BY_ID.grey_wolf, 6, -606, 346);
      w.add(m);
      p.target = m.id;
      p.attacking = true;
      for (let i = 0; i < 20 * 90 && !m.dead && !p.dead; i++) {
        if (!p.cast) for (const ab of p.abilities) if (w.canUse(p, ab, m) === null && ABILITIES[ab].target === 'enemy') { w.useAbility(p, ab, m.id); break; }
        w.tick(0.05);
      }
      expect(m.dead, c).toBe(true);
    }
  });
});

describe('stealth', () => {
  const setup = (cls: 'cutthroat' | 'shade' | 'nightwolf' = 'cutthroat', level = 12, build = 0) => {
    const w = new World(30, { populate: false, headless: true });
    const ch = World.newChar('Bot', CLASSES[cls].realm, cls, 30);
    ch.level = level;
    ch.specs = autoSpec(cls, level, BUILDS[cls][build]);
    ch.x = -606; ch.z = 350;
    const p = w.spawnPlayer(ch);
    return { w, p };
  };

  it('a hidden hero is seen only up close, and attacking brings it out', () => {
    const { w, p } = setup();
    const m = w.makeMob(MOB_BY_ID.grey_wolf, 12, p.x + 20, p.z);
    w.add(m);
    expect(w.useAbility(p, 'stealth')).toBeNull();
    expect(p.stealthed).toBe(true);
    expect(w.canSee(m, p)).toBe(false);
    const r = w.detectRange(m, p);
    expect(r).toBeGreaterThan(1);
    expect(r).toBeLessThan(8);
    p.x = m.x - r + 0.2;
    expect(w.canSee(m, p)).toBe(true);
    p.x = m.x - r - 1;
    w.damage(p, m, 3, 'melee', false, 'hit');
    expect(p.stealthed).toBe(false);
  });

  it('monsters walk past a hidden hero, but not a visible one', () => {
    const { w, p } = setup('shade');
    const m = w.makeMob(MOB_BY_ID.grey_wolf, 12, p.x + 8, p.z);
    w.add(m);
    w.useAbility(p, 'stealth');
    w.run(3);
    expect(m.target).not.toBe(p.id);
    w.unhide(p);
    w.run(3);
    expect(m.target).toBe(p.id);
  });

  it('no hiding mid-fight, but Vanish shakes off pursuers', () => {
    const { w, p } = setup('cutthroat', 16, 1); // the Shadows build
    expect(p.abilities).toContain('vanish');
    const m = w.makeMob(MOB_BY_ID.dire_wolf, 16, p.x + 2, p.z);
    w.add(m);
    w.engage(m, p);
    m.target = p.id;
    m.threat.set(p.id, 50);
    expect(w.useAbility(p, 'stealth')).toMatch(/fight/);
    expect(w.useAbility(p, 'vanish')).toBeNull();
    expect(p.stealthed).toBe(true);
    expect(m.threat.has(p.id)).toBe(false);
    expect(m.target).toBeNull();
  });

  it('Ambush needs hiding and the target’s back; poisons land with every hit', () => {
    const { w, p } = setup('cutthroat', 12);
    const m = w.makeMob(MOB_BY_ID.brigand, 12, p.x + 2, p.z);
    w.add(m);
    m.facing = 0; // facing +x, away from the hero at its back
    expect(w.styleBlocked(p, m, ABILITIES.ambush)).toMatch(/hidden/);
    w.useAbility(p, 'stealth');
    expect(w.styleBlocked(p, m, ABILITIES.ambush)).toBeNull();
    m.facing = Math.PI; // turns to face the hero
    expect(w.styleBlocked(p, m, ABILITIES.ambush)).toMatch(/behind/);
    m.facing = 0;
    w.useAbility(p, 'deadly_poison');
    expect(p.stealthed).toBe(true); // poisons don't break stealth
    (w as any).defenseRoll = () => 'hit';
    p.queuedStyle = 'ambush';
    (w as any).swing(p, m, false);
    expect(p.stealthed).toBe(false);
    expect(w.events.some((ev) => ev.type === 'swing' && ev.style === 'ambush')).toBe(true);
    expect(m.effects.some((f) => f.type === 'dot')).toBe(true);
  });

  it('computer stealthers sneak up and open from hiding', () => {
    let opened = 0;
    for (const cls of ['cutthroat', 'shade', 'nightwolf'] as const) {
      const w = new World(40, { populate: false, headless: true });
      const e = w.makeCombatant('adventurer', cls, CLASSES[cls].realm, 12, -606, 350, 'Sneak');
      e.ai.mode = 'hunt';
      w.add(e);
      const m = w.makeMob(MOB_BY_ID.boar, 11, -606, 372);
      w.add(m);
      e.ai.huntId = m.id;
      w.run(25);
      if (w.events.some((ev) => ev.type === 'swing' && ev.id === e.id && (ev.style === 'ambush' || ev.style === 'garrote'))) opened++;
    }
    expect(opened).toBe(3);
  });
});

describe('realm abilities', () => {
  const hero = (cls: 'warden' | 'wizard' = 'warden', rp = 0) => {
    const w = new World(50, { populate: false, headless: true });
    const ch = World.newChar('Bot', CLASSES[cls].realm, cls, 50);
    ch.level = 20;
    ch.rp = rp;
    ch.specs = autoSpec(cls, 20, BUILDS[cls][0]);
    ch.x = -606; ch.z = 350;
    const p = w.spawnPlayer(ch);
    return { w, ch, p };
  };

  it('ten realm levels to a rank, a point for each', () => {
    expect(realmLevel(0)).toEqual({ rank: 0, sub: 0, index: 0 });
    expect(realmLevel(40)).toEqual({ rank: 0, sub: 1, index: 1 });
    expect(realmLevel(399)).toEqual({ rank: 0, sub: 9, index: 9 });
    expect(realmLevel(400)).toEqual({ rank: 1, sub: 0, index: 10 });
    expect(realmLevelText(1200)).toBe('3L0');
    expect(realmLevel(1e9).index).toBe(90);
  });

  it('buying levels costs points, and classes can only buy their own', () => {
    const { w, ch, p } = hero('warden', 400); // 10 points
    const hp = p.maxHp;
    expect(w.buyRealmAbility('toughness')).toBeNull(); // 1
    expect(w.buyRealmAbility('toughness')).toBeNull(); // 2
    expect(ch.ras.toughness).toBe(2);
    expect(p.maxHp).toBeGreaterThan(hp);
    expect(raFree(ch.rp, ch.ras)).toBe(7);
    expect(w.buyRealmAbility('mastery_magery')).toMatch(/power/);
    expect(w.buyRealmAbility('purge')).toMatch(/8 realm ability points/);
    expect(w.buyRealmAbility('charge')).toBeNull();
    expect(p.abilities).toContain('charge');
    expect(ch.hotbar).toContain('charge');
    ch.copper = 5000;
    expect(w.respecRealm()).toBeNull();
    expect(ch.ras).toEqual({});
    expect(p.abilities).not.toContain('charge');
    expect(ch.hotbar).not.toContain('charge');
  });

  it('passives do what they say', () => {
    const { w, ch, p } = hero('warden', 1e6);
    const before = { str: p.stats.str, evade: p.evade, weapon: w.weaponSpec(p, false) };
    for (const id of ['aug_str', 'aug_str', 'dodger', 'mastery_arms', 'determination', 'determination', 'avoid_magic'] as const) expect(w.buyRealmAbility(id)).toBeNull();
    expect(p.stats.str).toBe(before.str + 8);
    expect(p.evade).toBeCloseTo(before.evade + 0.01);
    expect(w.weaponSpec(p, false)).toBeCloseTo(before.weapon * 1.03);
    const m = w.makeMob(MOB_BY_ID.troll, 20, p.x + 2, p.z);
    w.add(m);
    w.addEffect(p, m, { type: 'stun', dur: 10 });
    const stun = p.effects.find((f) => f.type === 'stun')!;
    expect(stun.until - stun.start).toBeCloseTo(8);
    expect(ch.ras.avoid_magic).toBe(1);
  });

  it('Purge works while stunned and clears what holds you', () => {
    const { w, p } = hero('wizard', 1e6);
    expect(w.buyRealmAbility('purge')).toBeNull();
    expect(w.buyRealmAbility('raging_power')).toBeNull();
    const m = w.makeMob(MOB_BY_ID.troll, 20, p.x + 2, p.z);
    w.add(m);
    w.addEffect(p, m, { type: 'stun', dur: 6 });
    w.addEffect(p, m, { type: 'dot', dur: 10, value: 0.1 }, 50);
    expect(w.useAbility(p, 'fire_bolt')).toMatch(/stunned/);
    expect(w.useAbility(p, 'purge')).toBeNull();
    expect(p.effects.some((f) => f.type === 'stun' || f.type === 'dot')).toBe(false);
    p.power = 0;
    expect(w.useAbility(p, 'raging_power')).toBeNull();
    expect(p.power).toBe(p.maxPower);
  });

  it('heroes from 0.5 keep their class and lines and start with no realm abilities', () => {
    const old = { ...World.newChar('Old', 1, 'ranger', 51), version: 3, specs: { archery: 12, hunting: 4, glamour: 7 } } as any;
    delete old.ras;
    migrateChar(old);
    expect(old.version).toBe(SAVE_VERSION);
    expect(old.cls).toBe('ranger');
    expect(old.specs).toEqual({ archery: 12, hunting: 4, glamour: 7 });
    expect(old.freeRespec).toBeUndefined();
    expect(old.ras).toEqual({});
  });
});

describe('dungeons', () => {
  const d0 = DUNGEONS[0];

  it('rooms connect through doorways and walls block sight', () => {
    const s = startOf(d0);
    expect(walkable(d0, s.x, s.z, 0.6)).toBe(true);
    const boss = d0.spawns.find((x) => x.kind === 'boss')!;
    // walk the route from the door to the boss: every step stays inside
    let x = s.x, z = s.z;
    for (let i = 0; i < 4000 && Math.hypot(boss.x - x, boss.z - z) > 1; i++) {
      const wp = dungeonRoute(d0, x, z, boss.x, boss.z);
      const dd = Math.hypot(wp.x - x, wp.z - z);
      x += ((wp.x - x) / dd) * Math.min(0.5, dd);
      z += ((wp.z - z) / dd) * Math.min(0.5, dd);
      expect(walkable(d0, x, z)).toBe(true);
    }
    expect(Math.hypot(boss.x - x, boss.z - z)).toBeLessThan(1.5);
    expect(dungeonLos(d0, s.x, s.z, boss.x, boss.z)).toBe(false);
    expect(dungeonLos(d0, s.x, s.z, s.x + 6, s.z)).toBe(true);
  });

  it('entering spawns it fresh, leaving clears it, and dying inside brings you back to its door', () => {
    const w = new World(60, { populate: false, headless: true });
    const ch = World.newChar('Bot', 0, 'warden', 60);
    ch.level = 15;
    const p = w.spawnPlayer(ch);
    const en = w.entrances[0];
    p.x = en.x + 2; p.z = en.z;
    const it = w.interactable();
    expect(it && 'portal' in it && it.portal).toBe('enter');
    expect(w.enterDungeon(d0.id)).toBeNull();
    expect(w.geo.zoneAt(p.x, p.z).kind).toBe('dungeon');
    const inside = w.list.filter((e) => e.dungeon === d0.id);
    expect(inside.some((e) => e.rank === 'boss')).toBe(true);
    expect(inside.filter((e) => e.rank === 'mini')).toHaveLength(2);
    w.kill(p, inside[0]);
    w.release();
    expect(Math.hypot(p.x - startOf(d0).x, p.z - startOf(d0).z)).toBeLessThan(1);
    p.lastCombat = -99;
    expect(w.leaveDungeon()).toBeNull();
    expect(w.list.some((e) => e.dungeon === d0.id)).toBe(false);
    expect(w.geo.zoneAt(p.x, p.z).kind).toBe('home');
  });

  it('new monsters have their tricks: skeletons rise, wisps burst, wraiths lurk, callers mend, chiefs rage', () => {
    const w = new World(61, { populate: false, headless: true });
    const ch = World.newChar('Bot', 0, 'warden', 61);
    ch.level = 14;
    ch.x = -606; ch.z = 350;
    const p = w.spawnPlayer(ch);
    const sk = w.add(w.makeMob(MOB_BY_ID.skeleton, 12, p.x + 3, p.z));
    w.kill(sk, p);
    w.run(4);
    const risen = w.list.find((e) => e.mob?.id === 'skeleton' && !e.dead)!;
    expect(risen.rose).toBe(true);
    w.kill(risen, p);
    w.run(4);
    expect(w.list.some((e) => e.mob?.id === 'skeleton' && !e.dead)).toBe(false);
    const wisp = w.add(w.makeMob(MOB_BY_ID.wisp, 12, p.x + 2, p.z));
    const hp = p.hp;
    w.kill(wisp, p);
    expect(p.hp).toBeLessThan(hp);
    const wr = w.add(w.makeMob(MOB_BY_ID.ice_wraith, 14, p.x + 10, p.z));
    expect(w.canSee(p, wr)).toBe(false);
    p.x = wr.x - 2;
    expect(w.canSee(p, wr)).toBe(true);
    const gc = w.add(w.makeMob(MOB_BY_ID.grave_caller, 14, -580, 300));
    const pal = w.add(w.makeMob(MOB_BY_ID.ghoul, 14, -582, 300));
    pal.hp = Math.round(pal.maxHp * 0.3);
    gc.ai.mode = 'combat';
    gc.target = p.id;
    p.x = gc.x + 12; p.z = gc.z;
    let healed = false;
    for (let i = 0; i < 20 * 20 && !healed; i++) { w.tick(0.05); healed = pal.hp > pal.maxHp * 0.3 + 5; }
    expect(healed).toBe(true);
    const chief = w.add(w.makeMob(MOB_BY_ID.brigand_chief, 12, -560, 280));
    const dmg = chief.dmgMul;
    chief.hp = Math.round(chief.maxHp * 0.2);
    w.bossTick(chief);
    expect(chief.enraged).toBe(true);
    expect(chief.dmgMul).toBeCloseTo(dmg * 1.5);
  });
});

describe('companions', () => {
  const hero = (cls: ClassId = 'warden', level = 16) => {
    const w = new World(70, { populate: false, headless: true });
    const ch = World.newChar('Bot', CLASSES[cls].realm, cls, 70);
    ch.level = level;
    ch.specs = autoSpec(cls, level, BUILDS[cls][0]);
    ch.copper = 100000;
    ch.x = -606; ch.z = 350;
    const p = w.spawnPlayer(ch);
    return { w, ch, p };
  };

  it('hire up to three, they follow, and dismissing one keeps the rest', () => {
    const { w, ch, p } = hero();
    for (const r of ['healer', 'caster', 'archer'] as const) expect(w.hire(r)).toBeNull();
    expect(w.hire('tank')).toMatch(/full/);
    expect(w.companions()).toHaveLength(3);
    expect(w.companions().map((c) => c.cls).sort()).toEqual(['cleric', 'wizard', 'yeoman']);
    expect(ch.copper).toBe(100000 - 3 * World.hireCost(16));
    for (let i = 0; i < 20 * 8; i++) { w.input.mx = 1; w.input.mz = 0; w.tick(0.05); }
    w.input.mx = 0;
    w.run(4);
    for (const c of w.companions()) expect(dist(c, p)).toBeLessThan(9);
    w.dismiss(1);
    expect(ch.party.map((m) => m.role)).toEqual(['healer', 'archer']);
    expect(w.companions()).toHaveLength(2);
  });

  it('they fight what you fight, heal you, and get up after the fight', () => {
    const { w, ch, p } = hero();
    for (const r of ['healer', 'caster', 'tank'] as const) w.hire(r);
    w.run(1);
    const m = w.add(w.makeMob(MOB_BY_ID.troll, 17, p.x + 12, p.z, undefined, { rank: 'elite' }));
    p.target = m.id;
    p.attacking = true;
    w.engage(p, m);
    p.hp = Math.round(p.maxHp * 0.7);
    for (let i = 0; i < 20 * 120 && !m.dead; i++) w.tick(0.05);
    const healer = w.companions().find((c) => c.cls === 'cleric')!;
    const healed = w.events.some((ev) => ev.type === 'heal' && ev.id === p.id && ev.src === healer.id && ev.amount > 0);
    expect(m.dead).toBe(true);
    expect(healed).toBe(true);
    const share = [...m.dmgBy.entries()].filter(([id]) => id !== p.id).reduce((a, [, v]) => a + v, 0);
    expect(share).toBeGreaterThan(0);
    expect(ch.xp).toBeGreaterThan(0); // the party's kill is yours
    const c = w.companions()[0];
    w.kill(c, m);
    w.run(25);
    expect(w.companions().every((x) => !x.dead)).toBe(true);
  });

  it('the tank holds what is hitting the others', () => {
    const { w, p } = hero('wizard');
    w.hire('tank');
    w.run(1);
    const m = w.add(w.makeMob(MOB_BY_ID.brigand, 15, p.x + 4, p.z));
    w.engage(m, p);
    m.target = p.id;
    m.threat.set(p.id, 40);
    w.run(10);
    expect(m.dead || m.target === w.companions()[0].id).toBe(true);
  });

  it('heroes from 0.6 come with an empty company', () => {
    const old = { ...World.newChar('Old', 2, 'seer', 71), version: 4 } as any;
    delete old.party;
    migrateChar(old);
    expect(old.party).toEqual([]);
    expect(old.version).toBe(SAVE_VERSION);
  });

  it('a lieutenant falls to a group of four, but not to one hero alone', () => {
    const fight = (group: boolean) => {
      const { w, p } = hero('warden', 16);
      if (group) for (const r of ['healer', 'caster', 'archer'] as const) w.hire(r);
      const d0 = DUNGEONS[0];
      w.spawnInstance(d0);
      const mini = w.list.find((e) => e.boss === 'lady_ashgrave')!;
      p.lastCombat = -99;
      p.x = mini.x - 8; p.z = mini.z;
      w.gatherParty(false);
      p.target = mini.id;
      p.attacking = true;
      for (let i = 0; i < 20 * 240 && !mini.dead && !p.dead; i++) {
        if (!p.queuedStyle && p.endu > 15) w.useAbility(p, p.lastStyle?.id === 'slash' && p.abilities.includes('backhand') ? 'backhand' : 'slash');
        w.tick(0.05);
      }
      return { won: mini.dead, alive: !p.dead };
    };
    const g = fight(true);
    expect(g.won).toBe(true);
    const solo = fight(false);
    expect(solo.won && solo.alive).toBe(false);
  }, 60000);
});

describe('dungeon bosses', () => {
  const attempt = (dungeon: number, seed: number, level: number, group: boolean) => {
    const d = DUNGEONS[dungeon];
    const w = new World(seed, { populate: false, headless: true });
    const cls = classFor(d.realm, 'tank');
    const ch = World.newChar('Bot', d.realm, cls, seed);
    ch.level = level;
    ch.specs = autoSpec(cls, level, BUILDS[cls][0]);
    ch.copper = 1e6;
    const p = w.spawnPlayer(ch);
    if (group) for (const r of ['healer', 'caster', 'archer'] as const) w.hire(r);
    w.spawnInstance(d);
    const boss = w.list.find((e) => e.rank === 'boss')!;
    p.x = boss.x - 10; p.z = boss.z;
    w.gatherParty(false);
    p.target = boss.id;
    p.attacking = true;
    const opener = cls === 'huskarl' ? 'cleave' : 'slash';
    for (let i = 0; i < 20 * 300 && !boss.dead && !p.dead; i++) {
      // a plain tank: close in, keep swinging, turn on adds once the boss's are dead
      const t = w.get(p.target) ?? boss;
      if (t.dead) { p.target = (w.list.find((e) => e.dungeon && !e.dead && e.target != null) ?? boss).id; p.attacking = true; }
      if (Math.hypot(t.x - p.x, t.z - p.z) > t.radius + 2.5) w.moveToward(p, t.x, t.z, 0.05, t.radius + 2);
      if (!p.queuedStyle && p.endu > 15) w.useAbility(p, opener);
      w.tick(0.05);
    }
    return boss.dead && !p.dead;
  };

  it('a level 18 group of four beats each boss most of the time; a hero alone does not', () => {
    for (let d = 0; d < DUNGEONS.length; d++) {
      const wins = [301, 302, 303].filter((seed) => attempt(d, seed, 18, true)).length;
      expect(wins, DUNGEONS[d].name).toBeGreaterThanOrEqual(2);
      expect(attempt(d, 304, 18, false), `${DUNGEONS[d].name} solo`).toBe(false);
    }
  }, 120000);
});
