import { describe, it, expect } from 'vitest';
import { World, SAVE_VERSION } from '../src/game/world';
import { MOB_BY_ID, ABILITIES, CLASS_IDS } from '../src/game/data';
import { autoSpec, BUILDS, freePoints, lineCost, pointsAt, respecCost, spent } from '../src/game/specs';
import { migrateSpecs } from '../src/ui/save';

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
    const c = World.newChar('Bot', 1, 'runecaller', 3);
    c.level = 10;
    c.specs = autoSpec('runecaller', 10, BUILDS.runecaller[0]);
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
    const p = w.spawnPlayer(World.newChar('Bot', 2, 'ranger', 5));
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
    const c = World.newChar('Bot', 1, 'runecaller', 8);
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
    migrateSpecs(old);
    expect(old.version).toBe(SAVE_VERSION);
    expect(old.freeRespec).toBe(true);
    expect(spent(old.specs)).toBeLessThanOrEqual(pointsAt(14));
    expect(old.specs.restoration).toBe(14);
    expect(old.hotbar).toContain('greater_mend');
    expect(old.hotbar).not.toContain('sanctuary'); // restoration 15
    for (const ab of ['mend', 'smite', 'renew']) expect(old.hotbar).toContain(ab);
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
