import { describe, it, expect } from 'vitest';
import { World, SAVE_VERSION } from '../src/game/world';
import { MOB_BY_ID, ABILITIES, CLASS_IDS, CLASSES, ROLES } from '../src/game/data';
import { REALM_DEFS } from '../src/game/geo';
import { LINES, autoSpec, BUILDS, freePoints, lineCost, pointsAt, respecCost, spent } from '../src/game/specs';
import { migrateChar } from '../src/ui/save';

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
