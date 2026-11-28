/**
 * The simulation: every creature, soldier and keep, and the rules of combat.
 * No DOM. The renderer and UI read `entities`, `keeps`, and drain `events` and `logs`.
 */
import { Rng } from './rng';
import { Geo, REALM_DEFS, KEEPS, siteById, KEEP_HALF, FRONTIER_R, homeLevel, roadDist, type RealmId, type Site } from './geo';
import {
  ABILITIES, CLASSES, MOB_BY_ID, WEAPONS, RUN_SPEED, SPRINT_SPEED, MAX_LEVEL, xpToNext, mobXp, conColor, CON_XP,
  realmRank, RANK_TITLES, classFor, realmName, BOSSES, type BossDef, type Role, type AbilityDef, type ClassId, type MobDef, type EffectDef, type BuffStat,
} from './data';
import { classDerived, mobDerived } from './stats';
import { makeItem, potion, starterKit, SLOTS, shopPrice, type Item } from './items';
import type { Entity, Effect, GameEvent, LogKind, CharSave, Team, Kind, NpcRole, Task } from './types';
import { thinkMob, thinkCombatant } from './ai';
import { War, type KeepState } from './war';
import { populate } from './spawn';
import { clamp } from './noise';
import { DUNGEONS, DUNGEON_X, dungeonAt, dungeonById, walkable, los as dungeonLos, route as dungeonRoute, startOf, type DungeonDef } from './dungeon';
import { raValue, raActives, raFree, raBlocked, raCost, raRespecCost, RA_BY_ID, type RaId } from './realm';
import { LINES, BUILDS, autoSpec, baseSpecs, knownAbilities, lineOf, passiveFrac, freePoints, pointsForLevel, respecCost } from './specs';

/** 2: specialization lines (`specs`). 3: a class for each realm (`cls`). 4: realm abilities (`ras`). 5: companions (`party`). */
export const SAVE_VERSION = 5;
/** A dungeon's door outside, or the way out inside. */
export interface Portal { portal: 'enter' | 'leave'; dungeon: DungeonDef; x: number; z: number }
export type Interactable = Entity | KeepState | Portal;

export const TICK = 1 / 20;
/** XP kept with 0 to 3 companions along */
const GROUP_XP = [1, 0.9, 0.8, 0.7];
const mobDpsOf = (lvl: number) => 1.4 + lvl * 1.7;

export interface Segment { ax: number; az: number; bx: number; bz: number; door?: number }
export interface Circle { x: number; z: number; r: number }

export interface PlayerInput {
  mx: number; // desired world-space move direction (length 0..1)
  mz: number;
  face: number | null; // desired facing
  jump: boolean;
  sprint: boolean;
}

export interface LogLine { text: string; kind: LogKind; t: number }

export function angleTo(a: { x: number; z: number }, b: { x: number; z: number }) {
  return Math.atan2(b.z - a.z, b.x - a.x);
}
export function angDiff(a: number, b: number) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}
export const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

export class World {
  readonly seed: number;
  readonly geo: Geo;
  rng: Rng;
  t = 0;
  private acc = 0;
  private nextId = 1;
  entities = new Map<number, Entity>();
  list: Entity[] = [];
  player: Entity | null = null;
  char: CharSave | null = null;
  input: PlayerInput = { mx: 0, mz: 0, face: null, jump: false, sprint: false };
  events: GameEvent[] = [];
  logs: LogLine[] = [];
  segments: Segment[] = [];
  circles: Circle[] = [];
  houses: { x: number; z: number; w: number; d: number; rot: number; realm: RealmId }[] = [];
  war: War;
  keeps: KeepState[] = [];
  /** where each realm's dungeon opens in its home region */
  entrances: { dungeon: DungeonDef; x: number; z: number; facing: number }[] = [];
  /** the dungeon whose monsters are spawned (one at a time: the player's) */
  instance: string | null = null;
  private rising: { id: number; at: number }[] = [];
  private grid = new Map<number, Entity[]>();
  private secondTimer = 0;
  private chatTimer = 30;
  /** If false, the world runs without anyone watching (tests, balance runs). */
  headless = false;

  constructor(seed: number, opts: { populate?: boolean; headless?: boolean } = {}) {
    this.seed = seed;
    this.geo = new Geo(seed);
    this.rng = new Rng(seed * 7919 + 13);
    this.headless = !!opts.headless;
    this.war = new War(this);
    this.buildStatics();
    this.entrances = DUNGEONS.map((d) => ({ dungeon: d, ...this.findEntrance(d.realm) }));
    if (opts.populate !== false) populate(this);
  }

  // ---------- static geometry ----------

  private buildStatics() {
    KEEPS.forEach((site, i) => {
      const k = this.war.addKeep(site, i);
      this.keeps.push(k);
      const H = KEEP_HALF;
      const P = (u: number, v: number) => this.keepToWorld(site, u, v);
      const c = [P(H, -H), P(H, H), P(-H, H), P(-H, -H)];
      const gap = 3.6;
      const g1 = P(H, -gap), g2 = P(H, gap);
      this.segments.push({ ax: c[0].x, az: c[0].z, bx: g1.x, bz: g1.z });
      this.segments.push({ ax: g2.x, az: g2.z, bx: c[1].x, bz: c[1].z });
      this.segments.push({ ax: g1.x, az: g1.z, bx: g2.x, bz: g2.z, door: i });
      this.segments.push({ ax: c[1].x, az: c[1].z, bx: c[2].x, bz: c[2].z });
      this.segments.push({ ax: c[2].x, az: c[2].z, bx: c[3].x, bz: c[3].z });
      this.segments.push({ ax: c[3].x, az: c[3].z, bx: c[0].x, bz: c[0].z });
      for (const p of c) this.circles.push({ x: p.x, z: p.z, r: 3.6 });
      // the donjon at the back
      const d = [P(-21, -7), P(-13, -7), P(-13, 7), P(-21, 7)];
      for (let j = 0; j < 4; j++) this.segments.push({ ax: d[j].x, az: d[j].z, bx: d[(j + 1) % 4].x, bz: d[(j + 1) % 4].z });
      // gate towers either side of the opening
      for (const sv of [-1, 1]) { const g = P(H, sv * 4.6); this.circles.push({ x: g.x, z: g.z, r: 1.6 }); }
    });
    const r = new Rng(this.seed + 404);
    for (const def of REALM_DEFS) {
      const town = siteById(`town${def.id}`);
      const n = 9;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r.range(-0.12, 0.12);
        // leave the side facing the gate road open
        if (Math.abs(angDiff(a, town.facing)) < 0.42) continue;
        const rad = r.range(30, 42);
        const x = town.x + Math.cos(a) * rad, z = town.z + Math.sin(a) * rad;
        const w = r.range(6, 9), d = r.range(7, 11);
        const rot = a + Math.PI / 2;
        this.houses.push({ x, z, w, d, rot, realm: def.id });
        const cs = Math.cos(rot), sn = Math.sin(rot);
        const corner = (u: number, v: number) => ({ x: x + u * cs - v * sn, z: z + u * sn + v * cs });
        const q = [corner(-w / 2, -d / 2), corner(w / 2, -d / 2), corner(w / 2, d / 2), corner(-w / 2, d / 2)];
        for (let j = 0; j < 4; j++) this.segments.push({ ax: q[j].x, az: q[j].z, bx: q[(j + 1) % 4].x, bz: q[(j + 1) % 4].z });
      }
    }
  }

  /** A flat spot about level 13's distance from town, off the road, for the dungeon's door. */
  private findEntrance(realm: RealmId) {
    const town = siteById(`town${realm}`);
    const d = 60 + 12 * 27;
    for (let i = 0; i < 40; i++) {
      const a = town.facing + (i % 2 ? 1 : -1) * (0.35 + Math.floor(i / 2) * 0.05);
      const x = town.x + Math.cos(a) * d, z = town.z + Math.sin(a) * d;
      if (this.geo.ridge(x, z) < 0.06 && this.geo.height(x, z) > 1.5 && roadDist(x, z) > 16 && Math.abs(homeLevel(Math.hypot(x - town.x, z - town.z)) - 13) <= 1) {
        return { x, z, facing: Math.atan2(town.z - z, town.x - x) };
      }
    }
    const a = town.facing + 0.5;
    return { x: town.x + Math.cos(a) * d, z: town.z + Math.sin(a) * d, facing: a + Math.PI };
  }

  keepToWorld(site: Site, u: number, v: number) {
    const cs = Math.cos(site.facing), sn = Math.sin(site.facing);
    return { x: site.x + u * cs - v * sn, z: site.z + u * sn + v * cs };
  }
  worldToKeep(site: Site, x: number, z: number) {
    const dx = x - site.x, dz = z - site.z;
    const cs = Math.cos(site.facing), sn = Math.sin(site.facing);
    return { u: dx * cs + dz * sn, v: -dx * sn + dz * cs };
  }
  insideKeep(site: Site, x: number, z: number, pad = 0) {
    const { u, v } = this.worldToKeep(site, x, z);
    return Math.abs(u) < KEEP_HALF - pad && Math.abs(v) < KEEP_HALF - pad;
  }

  // ---------- entities ----------

  private baseEntity(kind: Kind, name: string, realm: Team, level: number, x: number, z: number): Entity {
    const e: Entity = {
      id: this.nextId++, kind, name, realm, level, hpMul: 1, dmgMul: 1,
      x, z, y: this.geo.standY(x, z), vy: 0, facing: this.rng.range(-Math.PI, Math.PI), speed: RUN_SPEED, moved: 0, radius: 0.55, scale: 1,
      hp: 1, maxHp: 1, power: 0, maxPower: 0, endu: 100,
      stats: { str: 50, con: 50, dex: 50, int: 50, pie: 50 },
      weapon: { kind: 'fists', dps: 1, speed: 3.5, range: 3.5, ranged: false },
      af: 0, parry: 0, block: 0, evade: 0, shield: false,
      target: null, attacking: false, swingAt: 0, queuedStyle: null, lastStyle: null, lastDefense: null, cast: null,
      cds: {}, effects: [], dead: false, deadAt: 0, lastCombat: -99, lastHurt: -99,
      threat: new Map(), dmgBy: new Map(), spawn: { x, z }, ai: { mode: 'idle', think: this.t + this.rng.range(0, 1) },
      sprinting: false, abilities: [],
    };
    return e;
  }

  add(e: Entity): Entity {
    this.entities.set(e.id, e);
    this.list.push(e);
    this.events.push({ type: 'spawn', id: e.id });
    return e;
  }

  remove(e: Entity) {
    this.entities.delete(e.id);
    const i = this.list.indexOf(e);
    if (i >= 0) this.list.splice(i, 1);
    this.events.push({ type: 'despawn', id: e.id });
    if (this.player && this.player.target === e.id) this.player.target = null;
  }

  makeCombatant(kind: Kind, cls: ClassId, realm: RealmId, level: number, x: number, z: number, name: string, hpMul = 1, dmgMul = 1): Entity {
    const e = this.baseEntity(kind, name, realm, level, x, z);
    e.cls = cls;
    e.hpMul = hpMul;
    e.dmgMul = dmgMul;
    this.applyDerived(e);
    e.hp = e.maxHp;
    e.power = e.maxPower;
    const builds = BUILDS[cls];
    e.specs = autoSpec(cls, level, builds[e.id % builds.length]);
    this.applyDerived(e);
    e.hp = e.maxHp;
    e.abilities = knownAbilities(cls, e.specs);
    return e;
  }

  makeMob(def: MobDef, level: number, x: number, z: number, named?: string, opts: { rank?: 'elite'; boss?: BossDef } = {}): Entity {
    const b = opts.boss;
    const e = this.baseEntity('mob', b?.name ?? named ?? def.name, -1, level, x, z);
    e.mob = def;
    e.named = !!named || !!b;
    e.hpMul = b ? b.hpMul : named ? 2.6 : opts.rank === 'elite' ? 1.8 : 1;
    e.dmgMul = b ? b.dmgMul : named ? 1.25 : opts.rank === 'elite' ? 1.1 : 1;
    e.scale = b ? b.scale : def.scale * (named ? 1.2 : 1);
    if (b) { e.boss = b.id; e.rank = b.boss ? 'boss' : 'mini'; e.phase = 0; }
    else if (opts.rank) e.rank = opts.rank;
    e.radius = 0.5 * e.scale + 0.1;
    e.speed = def.speed;
    const d = mobDerived(def, level, e.hpMul);
    Object.assign(e, { stats: d.stats, maxHp: d.maxHp, maxPower: d.maxPower, weapon: d.weapon, af: d.af, parry: d.parry, block: d.block, evade: d.evade, shield: d.shield });
    e.hp = e.maxHp;
    e.power = e.maxPower;
    e.abilities = b?.abilities ?? def.abilities ?? [];
    if (def.look) e.look = def.look;
    if (def.lurks) e.stealthed = true;
    return e;
  }

  makeNpc(role: NpcRole, name: string, realm: RealmId, x: number, z: number, facing: number): Entity {
    const e = this.baseEntity('npc', name, realm, 30, x, z);
    e.role = role;
    e.invulnerable = true;
    e.facing = facing;
    e.maxHp = e.hp = 1000;
    e.cls = classFor(realm, role === 'merchant' ? 'archer' : role === 'healer' ? 'healer' : role === 'teleporter' || role === 'gatekeeper' ? 'caster' : 'tank');
    return e;
  }

  applyDerived(e: Entity) {
    if (!e.cls) return;
    const gear = e.kind === 'player' && this.char ? this.char.equip : undefined;
    const d = classDerived(e.cls, e.level, gear, e.ras);
    const hpFrac = e.maxHp > 1 ? e.hp / e.maxHp : 1;
    e.stats = d.stats;
    e.maxHp = Math.round(d.maxHp * e.hpMul);
    e.maxPower = d.maxPower;
    e.weapon = d.weapon;
    e.af = d.af;
    e.parry = d.parry;
    e.block = d.block;
    e.evade = d.evade;
    e.shield = d.shield;
    if (e.specs) {
      // defensive lines: half the class's chance at 1, all of it at your level
      const f = (p: 'parry' | 'block' | 'evade') => 0.5 + 0.5 * (passiveFrac(e.cls!, e.specs!, e.level, p) ?? 1);
      e.parry *= f('parry');
      e.block *= f('block');
      e.evade *= f('evade');
    }
    e.hp = Math.min(e.maxHp, Math.round(e.maxHp * hpFrac));
    if (e.kind === 'player' && this.char) {
      const rr = realmRank(this.char.rp);
      e.title = RANK_TITLES[this.char.realm][rr];
    }
  }

  // ---------- player ----------

  static newChar(name: string, realm: RealmId, cls: ClassId, seed = Date.now()): CharSave {
    const rng = new Rng(seed);
    const town = siteById(`town${realm}`);
    const hotbar: (string | null)[] = new Array(10).fill(null);
    const specs = baseSpecs(cls);
    knownAbilities(cls, specs).forEach((a, i) => (hotbar[i] = a));
    return {
      version: SAVE_VERSION, id: `${Date.now().toString(36)}${Math.floor(rng.next() * 1e6).toString(36)}`,
      name, realm, cls, level: 1, xp: 0, copper: 150, rp: 0, specs, ras: {}, party: [],
      equip: starterKit(rng, cls), bag: [], potions: { health: 3, power: CLASSES[cls].powerStat ? 2 : 0 },
      hotbar, x: town.x + Math.cos(town.facing) * 8, z: town.z + Math.sin(town.facing) * 8,
      kills: 0, realmKills: 0, deaths: 0, task: null, created: Date.now(), played: 0,
    };
  }

  spawnPlayer(char: CharSave) {
    this.char = char;
    const e = this.baseEntity('player', char.name, char.realm, char.level, char.x, char.z);
    e.cls = char.cls;
    e.specs = char.specs;
    e.ras = char.ras;
    this.player = e;
    this.applyDerived(e);
    e.hp = e.maxHp;
    e.power = e.maxPower;
    e.abilities = [...knownAbilities(char.cls, char.specs), ...raActives(char.ras)];
    const town = siteById(`town${char.realm}`);
    e.facing = Math.atan2(town.z - char.z, town.x - char.x) + Math.PI;
    this.add(e);
    // a hero saved inside a dungeon wakes at its door
    const dg = dungeonAt(e.x, e.z);
    if (dg) {
      const en = this.entrances.find((x) => x.dungeon === dg)!;
      e.x = en.x + Math.cos(en.facing) * 6;
      e.z = en.z + Math.sin(en.facing) * 6;
    }
    char.party.forEach((_, i) => this.spawnCompanion(i));
    return e;
  }

  log(text: string, kind: LogKind) {
    this.logs.push({ text, kind, t: this.t });
    if (this.logs.length > 400) this.logs.splice(0, 100);
  }

  /** Message only shown if the entity is the player. */
  private plog(e: Entity, text: string, kind: LogKind) {
    if (e === this.player) this.log(text, kind);
  }

  // ---------- spatial queries ----------

  private rebuildGrid() {
    this.grid.clear();
    for (const e of this.list) {
      const k = ((Math.floor(e.x / 24) + 200) << 10) | (Math.floor(e.z / 24) + 200);
      let b = this.grid.get(k);
      if (!b) this.grid.set(k, (b = []));
      b.push(e);
    }
  }

  near(x: number, z: number, r: number, fn: (e: Entity) => void) {
    const x0 = Math.floor((x - r) / 24), x1 = Math.floor((x + r) / 24);
    const z0 = Math.floor((z - r) / 24), z1 = Math.floor((z + r) / 24);
    const r2 = r * r;
    for (let i = x0; i <= x1; i++)
      for (let j = z0; j <= z1; j++) {
        const b = this.grid.get(((i + 200) << 10) | (j + 200));
        if (!b) continue;
        for (const e of b) {
          const dx = e.x - x, dz = e.z - z;
          if (dx * dx + dz * dz <= r2) fn(e);
        }
      }
  }

  nearest(e: Entity, r: number, pred: (o: Entity) => boolean): Entity | null {
    let best: Entity | null = null, bd = r;
    this.near(e.x, e.z, r, (o) => {
      if (o === e || o.dead) return;
      const d = dist(e, o);
      if (d < bd && pred(o)) { bd = d; best = o; }
    });
    return best;
  }

  get(id: number | null | undefined) {
    return id == null ? undefined : this.entities.get(id);
  }

  hostile(a: Entity, b: Entity): boolean {
    if (a.dead || b.dead || a === b) return false;
    if (a.kind === 'npc' || b.kind === 'npc' || a.invulnerable || b.invulnerable) return false;
    if (a.realm === b.realm) return false;
    if (a.kind === 'door' && b.realm === -1) return false;
    if (b.kind === 'door' && a.realm === -1) return false;
    return true;
  }
  friendly(a: Entity, b: Entity) {
    if (a.kind === 'mob' && b.kind === 'mob') return !a.dead && !b.dead;
    return !a.dead && !b.dead && a.realm === b.realm && a.realm !== -1 && b.kind !== 'door' && b.kind !== 'npc';
  }

  // ---------- main loop ----------

  step(dt: number) {
    this.acc += Math.min(dt, 0.25);
    let n = 0;
    while (this.acc >= TICK && n < 5) {
      this.tick(TICK);
      this.acc -= TICK;
      n++;
    }
    if (n === 5) this.acc = 0;
  }

  /** Runs the world for `secs` seconds as fast as possible (tests and balance). */
  run(secs: number) {
    const steps = Math.round(secs / TICK);
    for (let i = 0; i < steps; i++) this.tick(TICK);
  }

  tick(dt: number) {
    this.t += dt;
    this.rebuildGrid();
    const p = this.player;
    // a target that slips into the shadows is lost
    if (p) {
      const pt = this.get(p.target);
      if (pt && !this.canSee(p, pt)) { p.target = null; p.attacking = false; }
    }
    if (this.rising.length) this.raiseTheDead();
    for (const e of this.list.slice()) {
      if (e.dead) {
        if (e.kind !== 'player' && e.kind !== 'door' && e.kind !== 'companion' && this.t - e.deadAt > (e.kind === 'mob' ? 24 : 16)) {
          this.remove(e);
          if (e.kind === 'mob' && e.respawn != null) this.war.scheduleRespawn(e);
        }
        continue;
      }
      if (e.kind === 'npc') continue;
      this.updateEffects(e);
      if (!e.dead && e.kind !== 'door') {
        if (e === p) this.playerControl(e, dt);
        else if (this.awake(e)) {
          if (e.kind === 'mob') thinkMob(this, e, dt);
          else thinkCombatant(this, e, dt);
        }
        if (!e.dead) this.combat(e);
      }
      e.y = this.geo.standY(e.x, e.z) + (e.kind === 'player' ? this.jumpY(e, dt) : 0);
      if (e.mob?.shape === 'sprite') e.y += 1.2;
    }
    this.secondTimer -= dt;
    if (this.secondTimer <= 0) {
      this.secondTimer += 1;
      this.everySecond();
    }
  }

  /** Monsters far from anyone who could fight them stand still. */
  private awake(e: Entity) {
    if (e.kind !== 'mob') return true;
    if (e.ai.mode !== 'idle' && e.ai.mode !== 'wander') return true;
    if (this.t < e.ai.think) return false;
    let any = false;
    this.near(e.x, e.z, 120, (o) => {
      if (!any && (o.kind === 'player' || o.kind === 'adventurer')) any = true;
    });
    if (!any) e.ai.think = this.t + 1.5 + this.rng.next();
    return any;
  }

  private jumpY(e: Entity, dt: number) {
    const self = e as Entity & { jy?: number };
    if (self.jy === undefined) self.jy = 0;
    if (this.input.jump && self.jy <= 0) e.vy = 6.5;
    if (self.jy > 0 || e.vy > 0) {
      e.vy -= 20 * dt;
      self.jy = Math.max(0, self.jy + e.vy * dt);
      if (self.jy === 0) e.vy = 0;
    }
    return self.jy;
  }

  private everySecond() {
    for (const e of this.list) {
      if (e.dead || e.kind === 'npc') continue;
      const ooc = this.t - e.lastCombat > 7;
      const resting = e.ai.mode === 'rest';
      if (e.kind === 'door') {
        if (ooc && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.01);
        continue;
      }
      const hpRate = ooc ? (resting ? 0.12 : e.kind === 'player' ? 0.05 : 0.04) : 0.004;
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * hpRate);
      if (e.maxPower) e.power = Math.min(e.maxPower, e.power + e.maxPower * (ooc ? 0.07 : 0.012));
      if (e.sprinting && e.moved > 0) {
        e.endu = Math.max(0, e.endu - 5 * (1 - raValue(e.ras, 'long_wind')));
        if (e.endu <= 0) {
          e.sprinting = false;
          this.plog(e, 'You are too tired to sprint.', 'error');
        }
      } else e.endu = Math.min(100, e.endu + (ooc ? 12 : 3.5) + this.buffSum(e, 'endu'));
      if (e.kind === 'mob' && e.ai.mode === 'return') e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.2);
    }
    this.war.everySecond();
    this.reviveCompanions();
    if (this.char && this.player) {
      this.char.played += 1;
      this.char.x = this.player.x;
      this.char.z = this.player.z;
    }
    this.chatTimer -= 1;
    if (this.chatTimer <= 0 && this.player) {
      this.chatTimer = this.rng.range(30, 70);
      this.war.ambientChat();
    }
  }

  // ---------- movement ----------

  /** Moves an entity toward (tx, tz) at its speed. Returns remaining distance. */
  moveToward(e: Entity, tx: number, tz: number, dt: number, stopAt = 0, speedMul = 1): number {
    const wp = this.route(e, tx, tz);
    const dx = wp.x - e.x, dz = wp.z - e.z;
    const d = Math.hypot(dx, dz);
    const total = Math.hypot(tx - e.x, tz - e.z);
    if (total <= stopAt) return total;
    const sp = this.speedOf(e) * speedMul * dt;
    if (sp <= 0) return total;
    const step = Math.min(sp, Math.max(0, (wp.x === tx && wp.z === tz ? d - stopAt : d)));
    if (d > 0.001) {
      e.facing = Math.atan2(dz, dx);
      this.moveBy(e, (dx / d) * step, (dz / d) * step);
    }
    return total - step;
  }

  speedOf(e: Entity): number {
    let s = e.speed;
    let snare = 0;
    for (const f of e.effects) {
      if (f.type === 'stun' || f.type === 'root') return 0;
      if (f.type === 'snare') snare = Math.max(snare, f.value);
      if (f.type === 'buff' && f.stat === 'speed') s *= 1 + f.value;
    }
    if (e.cast) return 0;
    s *= 1 - snare;
    if (e.stealthed) {
      // slow in the shadows at first, nearly full speed with Shadows at your level
      const f = e.cls && e.specs ? passiveFrac(e.cls, e.specs, e.level, 'stealth') ?? 1 : 1;
      s *= 0.6 + 0.3 * f;
    } else if (e.sprinting) s *= SPRINT_SPEED;
    if (this.geo.height(e.x, e.z) < -0.5) s *= 0.6;
    if (e.ai.mode === 'return') s *= 1.4;
    return s;
  }

  moveBy(e: Entity, dx: number, dz: number) {
    let nx = e.x + dx, nz = e.z + dz;
    const dg = e.x > DUNGEON_X - 300 ? dungeonAt(e.x, e.z) : undefined;
    if (dg) {
      // slide along the walls; anyone somehow outside them may move anywhere to get back in
      const r = e.radius;
      if (walkable(dg, e.x, e.z, r) && !walkable(dg, nx, nz, r)) {
        if (walkable(dg, nx, e.z, r)) nz = e.z;
        else if (walkable(dg, e.x, nz, r)) nx = e.x;
        else { nx = e.x; nz = e.z; }
      }
      e.moved += Math.hypot(nx - e.x, nz - e.z);
      e.x = nx;
      e.z = nz;
      return;
    }
    if (e.kind === 'player') {
      const h0 = this.geo.height(e.x, e.z), h1 = this.geo.height(nx, nz);
      const step = Math.hypot(dx, dz);
      if (h1 - h0 > step * 1.25 && h1 > 12) {
        nx = e.x;
        nz = e.z;
      }
    }
    const r = e.radius;
    for (const s of this.segments) {
      if (s.door !== undefined && !this.war.doorClosed(s.door, e.realm)) continue;
      if (Math.min(s.ax, s.bx) - 3 > nx || Math.max(s.ax, s.bx) + 3 < nx || Math.min(s.az, s.bz) - 3 > nz || Math.max(s.az, s.bz) + 3 < nz) continue;
      const sx = s.bx - s.ax, sz = s.bz - s.az;
      const len2 = sx * sx + sz * sz;
      const t = clamp(((nx - s.ax) * sx + (nz - s.az) * sz) / len2, 0, 1);
      const px = s.ax + sx * t, pz = s.az + sz * t;
      const ox = nx - px, oz = nz - pz;
      const d = Math.hypot(ox, oz);
      const wall = r + 0.9;
      if (d < wall) {
        if (d > 1e-4) {
          nx = px + (ox / d) * wall;
          nz = pz + (oz / d) * wall;
        } else {
          // exactly on the wall: push back the way we came
          nx = e.x;
          nz = e.z;
        }
      }
    }
    for (const c of this.circles) {
      const ox = nx - c.x, oz = nz - c.z;
      const d = Math.hypot(ox, oz);
      if (d < c.r + r && d > 1e-4) {
        nx = c.x + (ox / d) * (c.r + r);
        nz = c.z + (oz / d) * (c.r + r);
      }
    }
    const rr = Math.hypot(nx, nz);
    if (rr > 1185) {
      nx *= 1185 / rr;
      nz *= 1185 / rr;
    }
    e.moved += Math.hypot(nx - e.x, nz - e.z);
    e.x = nx;
    e.z = nz;
  }

  /** Next waypoint on the way to (tx, tz): through a keep's gate if the walls are in the way. */
  route(e: Entity, tx: number, tz: number): { x: number; z: number } {
    if (e.x > DUNGEON_X - 300) {
      const dg = dungeonAt(e.x, e.z);
      if (dg) return dungeonRoute(dg, e.x, e.z, tx, tz);
    }
    for (const k of this.keeps) {
      const s = k.site;
      if (Math.abs(e.x - s.x) > 90 && Math.abs(tx - s.x) > 90) continue;
      if (Math.abs(e.z - s.z) > 90 && Math.abs(tz - s.z) > 90) continue;
      const a = this.worldToKeep(s, e.x, e.z), b = this.worldToKeep(s, tx, tz);
      const H = KEEP_HALF;
      const inA = Math.abs(a.u) < H && Math.abs(a.v) < H;
      const inB = Math.abs(b.u) < H && Math.abs(b.v) < H;
      if (inA === inB) {
        if (inA) return { x: tx, z: tz };
        // both outside: if the straight line crosses the keep, go round the front
        if (segCrossesBox(a.u, a.v, b.u, b.v, H + 2)) {
          const side = Math.sign(a.v || 1);
          if (a.u < H + 4) return this.keepToWorld(s, H + 9, side * (H + 9));
          return this.keepToWorld(s, H + 9, Math.sign(b.v || 1) * (H + 9));
        }
        continue;
      }
      {
        if (inA) {
          // leaving: go to the gate from inside
          if (a.u > H - 5 && Math.abs(a.v) < 3) return this.keepToWorld(s, H + 6, 0);
          return this.keepToWorld(s, H - 4, 0);
        }
        // entering
        if (a.u > H - 1 && Math.abs(a.v) < 3) return this.keepToWorld(s, H - 6, 0);
        if (a.u < H + 3) return this.keepToWorld(s, H + 9, Math.sign(a.v || 1) * (H + 9));
        if (Math.abs(a.v) > 2.5) return this.keepToWorld(s, H + 5, 0);
        return this.keepToWorld(s, H - 6, 0);
      }
    }
    return { x: tx, z: tz };
  }

  private playerControl(e: Entity, dt: number) {
    const inp = this.input;
    e.moved = 0;
    e.sprinting = inp.sprint && e.endu > 0;
    const len = Math.hypot(inp.mx, inp.mz);
    if (len > 0.01) {
      if (e.cast) {
        const ab = ABILITIES[e.cast.ab];
        this.interrupt(e, ab.kind === 'shot' ? 'You move and lose your shot!' : 'You move and interrupt your spellcast!');
      }
      const sp = this.speedOf(e) * Math.min(1, len) * dt;
      this.moveBy(e, (inp.mx / len) * sp, (inp.mz / len) * sp);
    }
    if (inp.face != null) e.facing = inp.face;
    else {
      const t = this.get(e.target);
      if (t && !t.dead && len < 0.01 && (e.attacking || e.cast)) e.facing = angleTo(e, t);
    }
  }

  // ---------- effects ----------

  addEffect(e: Entity, src: Entity, def: EffectDef, hitDmg = 0, healAmt = 0) {
    if (e.dead) return;
    const now = this.t;
    let name = def.type as string;
    let value = 'value' in def ? def.value : 0;
    let stat: Effect['stat'];
    let perTick: number | undefined;
    if (def.type === 'buff') { name = def.name; stat = def.stat; }
    if (def.type === 'dot') { perTick = Math.max(1, Math.round(hitDmg * def.value)); name = 'bleed'; }
    if (def.type === 'hot') { perTick = Math.max(1, Math.round(healAmt)); name = def.name ?? 'Renew'; }
    if (def.type === 'absorb') { value = Math.round(e.maxHp * def.value); name = def.name ?? 'Rune Ward'; }
    if (def.type === 'restore') {
      if (def.what === 'hp') {
        e.hp = Math.min(e.maxHp, e.hp + Math.round(e.maxHp * def.value));
        this.plog(e, 'You shrug off your wounds.', 'heal');
      } else if (def.what === 'power') {
        e.power = Math.min(e.maxPower, e.power + e.maxPower * def.value);
        this.plog(e, 'Power surges through you.', 'spell');
      } else {
        e.endu = Math.min(100, e.endu + def.value);
        this.plog(e, 'You catch your second wind.', 'spell');
      }
      return;
    }
    if (def.type === 'purge') {
      e.effects = e.effects.filter((f) => !(f.type === 'stun' || f.type === 'root' || f.type === 'snare' || f.type === 'dot' || f.type === 'taunt' || (f.type === 'buff' && f.value < 0)));
      this.plog(e, 'You purge every ill effect from yourself!', 'spell');
      return;
    }
    if (def.type === 'thorns') name = 'Thorn Skin';
    if (def.type === 'hide') {
      if (e.stealthed) this.unhide(e);
      else this.hide(e);
      return;
    }
    if (def.type === 'vanish') {
      this.hide(e);
      for (const o of this.list) {
        o.threat.delete(e.id);
        if (o.target === e.id && o !== this.player) { o.target = null; o.attacking = false; }
      }
      return;
    }
    if (def.type === 'step') {
      // src appears just behind e
      src.x = e.x - Math.cos(e.facing) * (e.radius + 1.1);
      src.z = e.z - Math.sin(e.facing) * (e.radius + 1.1);
      src.y = this.geo.standY(src.x, src.z);
      src.facing = angleTo(src, e);
      this.plog(src, `You appear behind ${nm(e)}.`, 'spell');
      return;
    }
    if (def.type === 'imbue') name = def.name;
    if (def.type === 'freedom') { name = 'Stand Fast'; e.effects = e.effects.filter((f) => f.type !== 'snare' && f.type !== 'root'); }
    if ((def.type === 'snare' || def.type === 'root') && this.has(e, 'freedom')) {
      this.plog(src, `${cap(e.name)} stands fast!`, 'error');
      return;
    }
    if (def.type === 'stun' || def.type === 'root') {
      // short immunity after a stun or root wears off
      const imm = e.effects.find((f) => f.type === def.type);
      if (imm) return;
      if (((e as Entity & { immune?: Record<string, number> }).immune?.[def.type] ?? 0) > now) {
        this.plog(src, `${cap(e.name)} is immune!`, 'error');
        return;
      }
      if (def.type === 'stun' && e.cast) this.interrupt(e, 'You are stunned!');
      if (e.kind === 'lord' || e.kind === 'door') return;
    }
    // same effect from the same kind replaces
    const existing = e.effects.findIndex((f) => f.type === def.type && f.name === name);
    // Determination shortens what holds you
    const dur = def.type === 'stun' || def.type === 'root' || def.type === 'snare' ? def.dur * (1 - raValue(e.ras, 'determination')) : def.dur;
    const eff: Effect = { type: def.type, name, until: now + dur, start: now, value, stat, src: src.id, perTick, nextTick: now + 1, proc: def.type === 'imbue' ? def.proc : undefined };
    if (existing >= 0) e.effects[existing] = eff;
    else e.effects.push(eff);
    if (def.type === 'taunt') {
      e.threat.set(src.id, (e.threat.get(src.id) ?? 0) + 5000);
      e.target = src.id;
    }
    if (def.type === 'stun') { this.plog(e, 'You are stunned!', 'hit-in'); this.plog(src, `${cap(e.name)} is stunned!`, 'spell'); }
    if (def.type === 'root') { this.plog(e, 'You are rooted to the ground!', 'hit-in'); this.plog(src, `${cap(e.name)} is rooted!`, 'spell'); }
    if (def.type === 'snare') this.plog(src, `${cap(e.name)} slows down!`, 'spell');
    if (def.type === 'buff' || def.type === 'absorb' || def.type === 'hot' || def.type === 'freedom' || def.type === 'thorns' || def.type === 'imbue') this.events.push({ type: 'buff', id: e.id, name });
  }

  private updateEffects(e: Entity) {
    const now = this.t;
    for (let i = e.effects.length - 1; i >= 0; i--) {
      const f = e.effects[i];
      if (f.nextTick !== undefined && now >= f.nextTick && (f.type === 'dot' || f.type === 'hot')) {
        f.nextTick += 1;
        const src = this.get(f.src);
        if (f.type === 'dot') this.damage(e, src ?? e, f.perTick ?? 1, 'bleed', false, 'hit');
        else this.heal(e, src ?? e, f.perTick ?? 1, true);
        if (e.dead) return;
      }
      if (now >= f.until || (f.type === 'absorb' && f.value <= 0)) {
        e.effects.splice(i, 1);
        if (f.type === 'stun' || f.type === 'root') {
          const im = ((e as Entity & { immune?: Record<string, number> }).immune ??= {});
          im[f.type] = now + (f.type === 'stun' ? 8 : 12);
        }
        if (e === this.player && (f.type === 'buff' || f.type === 'absorb' || f.type === 'freedom' || f.type === 'thorns' || f.type === 'imbue')) this.log(`${f.name} fades.`, 'spell');
      }
    }
  }

  has(e: Entity, type: Effect['type']) {
    return e.effects.some((f) => f.type === type);
  }
  buffSum(e: Entity, stat: BuffStat) {
    let s = 0;
    for (const f of e.effects) if (f.type === 'buff' && f.stat === stat) s += f.value;
    return s;
  }
  stunned(e: Entity) {
    return this.has(e, 'stun');
  }

  // ---------- combat ----------

  /** Auto-attack swings and finishing casts. */
  private combat(e: Entity) {
    if (this.stunned(e)) return;
    if (e.cast && this.t >= e.cast.end) this.finishCast(e);
    if (!e.attacking || e.cast) return;
    const t = this.get(e.target);
    if (!t || t.dead || !this.hostile(e, t)) {
      if (e === this.player && t?.dead) e.attacking = false;
      return;
    }
    if (!this.canSee(e, t)) return;
    const d = dist(e, t) - t.radius - e.radius;
    const w = e.weapon;
    let ranged = w.ranged;
    let range = w.range;
    if (w.ranged && d < 4) { ranged = false; range = 3.5; }
    if (d > range + 0.4) return;
    if (this.t < e.swingAt) return;
    if (Math.abs(angDiff(angleTo(e, t), e.facing)) > 1.4) {
      if (e === this.player && this.t - ((e as Entity & { nvMsg?: number }).nvMsg ?? -9) > 3) {
        (e as Entity & { nvMsg?: number }).nvMsg = this.t;
        this.log('Your target is not in view.', 'error');
      }
      return;
    }
    const speedMul = ranged ? 1 : w.ranged ? 0.75 : 1;
    e.swingAt = this.t + (w.speed * speedMul) / (1 + this.buffSum(e, 'haste'));
    this.swing(e, t, ranged);
  }

  private swing(a: Entity, d: Entity, ranged: boolean) {
    let style: AbilityDef | null = null;
    if (a.queuedStyle && !ranged) {
      const s = ABILITIES[a.queuedStyle];
      a.queuedStyle = null;
      const why = this.styleBlocked(a, d, s);
      if (why) this.plog(a, why, 'error');
      else if (a.endu < s.cost) this.plog(a, 'You are too fatigued to perform that style!', 'error');
      else style = s;
    }
    if (a.stealthed) this.unhide(a);
    this.events.push({ type: 'swing', id: a.id, target: d.id, style: style?.id });
    if (ranged) this.events.push({ type: 'projectile', from: a.id, to: d.id, school: 'arrow' });
    this.engage(a, d);
    const res = this.defenseRoll(a, d, ranged ? 'ranged' : 'melee');
    const noun = a.kind === 'player' ? (ranged ? 'bow' : a.weapon.ranged ? 'dagger' : WEAPONS[a.weapon.kind].noun) : '';
    if (res !== 'hit') {
      this.reportAvoid(a, d, res);
      a.lastStyle = null;
      return;
    }
    let mult = 1 + (style?.bonus ?? 0);
    if (style) {
      a.endu -= style.cost;
      a.lastStyle = { id: style.id, t: this.t };
    } else a.lastStyle = null;
    if (!ranged && a.cls) mult *= CLASSES[a.cls].melee;
    mult *= this.weaponSpec(a, ranged);
    const base = a.weapon.dps * a.weapon.speed * this.statMul(a, ranged ? 'dex' : 'str');
    const { amount, crit } = this.mitigate(a, d, base * mult * this.rng.range(0.85, 1.15), ranged ? 0.1 : 0.08, true);
    if (a === this.player) {
      const what = d === this.player ? 'yourself' : `the ${d.name}`;
      if (style) this.log(`You perform your ${style.name} perfectly!`, 'hit-out');
      this.log(`You ${ranged ? 'shoot' : 'attack'} ${nm(d, what)} with your ${noun} and hit for ${amount} damage!${crit ? ' (Critical hit!)' : ''}`, 'hit-out');
    } else if (d === this.player) {
      const verb = a.mob ? WEAPONS[a.weapon.kind].verb : ranged ? 'shoots' : 'hits';
      this.log(`${capNm(a)} ${verb} you${style ? ` with ${style.name}` : ''} for ${amount} damage!${crit ? ' (Critical hit!)' : ''}`, 'hit-in');
    }
    this.damage(d, a, amount, ranged ? 'arrow' : 'melee', crit, 'hit');
    if (!ranged) this.thorns(d, a, amount);
    if (style?.effects) for (const f of style.effects) this.addEffect(d, a, f, amount);
    if (!ranged) for (const f of a.effects) if (f.type === 'imbue' && f.proc && !d.dead) this.addEffect(d, a, f.proc, amount);
  }

  styleBlocked(a: Entity, d: Entity, s: AbilityDef): string | null {
    const r = s.req;
    if (!r) return null;
    if (r.follow && (!a.lastStyle || a.lastStyle.id !== r.follow)) return `You must perform ${ABILITIES[r.follow].name} first!`;
    if (r.after && (!a.lastDefense || a.lastDefense.kind !== r.after || this.t - a.lastDefense.t > 5)) return `You must ${r.after} first!`;
    if (r.stealth && !a.stealthed) return 'You must be hidden to do that!';
    if (r.pos) {
      const behind = Math.abs(angDiff(angleTo(d, a), d.facing));
      if (r.pos === 'behind') {
        if (behind < 2) return 'You must be behind your target!';
      } else if (behind < Math.PI / 3 && d.target === a.id) return 'You must be beside or behind your target!';
    }
    return null;
  }

  // ---------- stealth ----------

  /** How well a stealther hides: its Shadows line, never above its level. */
  stealthLevel(e: Entity) {
    return Math.min(e.level, e.specs?.shadows ?? e.level);
  }

  /** How close the viewer must come to see a hidden enemy. */
  detectRange(viewer: Entity, e: Entity) {
    let r = 3.5 + (viewer.level - this.stealthLevel(e)) * 0.3;
    if (viewer.cls && CLASSES[viewer.cls].arch === 'stealther') r += 3; // it takes one to know one
    if (viewer.kind === 'guard' || viewer.kind === 'lord') r += 3;
    return clamp(r, 1.5, 12);
  }

  /** Can the viewer see this entity? Friends and anyone not hiding are always seen. */
  canSee(viewer: Entity, e: Entity) {
    if (!e.stealthed || viewer === e || !this.hostile(viewer, e)) return true;
    return dist(viewer, e) <= this.detectRange(viewer, e);
  }

  /** Can a see b through the walls? Only dungeons have walls that block sight. */
  los(a: { x: number; z: number }, b: { x: number; z: number }) {
    if (a.x < DUNGEON_X - 300 && b.x < DUNGEON_X - 300) return true;
    const da = dungeonAt(a.x, a.z), db = dungeonAt(b.x, b.z);
    if (da !== db) return false;
    return !da || dungeonLos(da, a.x, a.z, b.x, b.z);
  }

  hide(e: Entity) {
    e.stealthed = true;
    e.attacking = false;
    e.sprinting = false;
    e.queuedStyle = null;
    if (e.cast) this.interrupt(e, 'You stop casting.');
    this.plog(e, 'You are now hidden.', 'spell');
    this.events.push({ type: 'buff', id: e.id, name: 'Stealth' });
  }

  unhide(e: Entity) {
    if (!e.stealthed) return;
    e.stealthed = false;
    this.plog(e, 'You are no longer hidden.', 'spell');
  }

  /** Thorn Skin: part of a melee hit comes back on the attacker. */
  private thorns(d: Entity, a: Entity, amount: number) {
    const f = d.effects.find((x) => x.type === 'thorns');
    if (!f || a.dead || d.dead) return;
    const back = Math.max(1, Math.round(amount * f.value));
    if (a === this.player) this.log(`Thorns bite you for ${back} damage!`, 'hit-in');
    else if (d === this.player) this.log(`Your thorns bite ${nm(a)} for ${back} damage!`, 'hit-out');
    this.damage(a, d, back, 'nature', false, 'hit');
  }

  /** Weapon lines: three-quarters damage at 1, full damage at your level. */
  weaponSpec(a: Entity, ranged: boolean) {
    const arms = 1 + raValue(a.ras, 'mastery_arms');
    if (!a.cls || !a.specs) return arms;
    const f = passiveFrac(a.cls, a.specs, a.level, ranged ? 'ranged' : 'melee');
    return (f === null ? 1 : 0.75 + 0.25 * f) * arms;
  }

  /** The level a spell or heal is cast at: its line's level, never above your own. */
  powerLevel(e: Entity, ab: AbilityDef) {
    if (!e.cls || !e.specs) return e.level;
    const l = lineOf(e.cls, ab.id);
    return l ? Math.min(e.level, e.specs[l.id] ?? 1) : e.level;
  }

  statMul(a: Entity, stat: 'str' | 'dex' | 'int' | 'pie') {
    return (1 + (a.stats[stat] - 50) / 120) * (1 + this.buffSum(a, 'dmg')) * a.dmgMul;
  }

  private defenseRoll(a: Entity, d: Entity, kind: 'melee' | 'ranged' | 'spell'): 'hit' | 'miss' | 'parry' | 'block' | 'evade' | 'resist' {
    const ld = d.level - a.level;
    if (kind === 'spell') {
      const resist = clamp(0.04 + ld * 0.03 - this.buffSum(a, 'hit'), 0.01, 0.6);
      return this.rng.chance(resist) ? 'resist' : 'hit';
    }
    if (d.kind === 'door') return 'hit';
    const miss = clamp(0.1 + ld * 0.025 - this.buffSum(a, 'hit'), 0.03, 0.6);
    if (this.rng.chance(miss)) return 'miss';
    if (this.stunned(d) || d.cast) return 'hit';
    const front = Math.abs(angDiff(angleTo(d, a), d.facing)) < 1.2;
    if (!front) return 'hit';
    const evade = d.evade + this.buffSum(d, 'evade');
    if (this.rng.chance(evade)) return 'evade';
    if (kind === 'melee' && d.parry > 0 && !d.weapon.ranged && this.rng.chance(d.parry)) return 'parry';
    if (d.shield && this.rng.chance(d.block)) return 'block';
    return 'hit';
  }

  private reportAvoid(a: Entity, d: Entity, res: string) {
    if (res === 'parry' || res === 'block' || res === 'evade') d.lastDefense = { kind: res, t: this.t };
    this.events.push({ type: 'dmg', id: d.id, src: a.id, amount: 0, crit: false, school: 'melee', result: res as 'miss' });
    if (a === this.player) {
      if (res === 'miss') this.log('You miss!', 'miss');
      else this.log(`${capNm(d)} ${res === 'evade' ? 'evades' : res === 'parry' ? 'parries' : res === 'block' ? 'blocks' : 'resists'} your attack!`, 'miss');
    } else if (d === this.player) {
      if (res === 'miss') this.log(`${capNm(a)} attacks you and misses!`, 'miss');
      else this.log(`You ${res} ${nm(a)}'s attack!`, 'miss');
    }
    if (res === 'block') this.interruptByHit(d);
    d.threat.set(a.id, (d.threat.get(a.id) ?? 0) + 1);
    if (d.target == null && d !== this.player) d.target = a.id;
  }

  private mitigate(a: Entity, d: Entity, raw: number, critChance: number, armor: boolean) {
    let dmg = raw * clamp(1 + 0.045 * (a.level - d.level), 0.35, 1.45);
    if (armor) {
      const af = d.af * (1 + this.buffSum(d, 'armor'));
      const absorb = Math.min(0.75, af / (af + 10 + 2 * a.level));
      dmg *= 1 - absorb;
    }
    const crit = this.rng.chance(critChance);
    if (crit) dmg *= 1.5;
    return { amount: Math.max(1, Math.round(dmg)), crit };
  }

  engage(a: Entity, d: Entity) {
    a.lastCombat = d.lastCombat = this.t;
    if (d !== this.player && (d.target == null || !this.get(d.target) || this.get(d.target)!.dead)) {
      if (d.kind !== 'door') d.target = a.id;
    }
    if (d.ai.mode === 'idle' || d.ai.mode === 'wander' || d.ai.mode === 'hunt' || d.ai.mode === 'rest') {
      if (d.kind !== 'player' && d.kind !== 'door') d.ai.mode = 'combat';
    }
    if (d.kind === 'mob' && d.mob?.social) this.pullSocial(d, a);
    if (d.keep !== undefined) this.war.underAttack(d.keep, a);
  }

  private pullSocial(m: Entity, attacker: Entity) {
    this.near(m.x, m.z, 12, (o) => {
      // a pack in a dungeon comes as one; in the wild, only their own kind
      const kin = m.dungeon ? o.dungeon === m.dungeon : o.mob?.id === m.mob?.id;
      if (o.kind === 'mob' && !o.dead && kin && (o.ai.mode === 'idle' || o.ai.mode === 'wander') && this.los(m, o)) {
        o.ai.mode = 'combat';
        o.target = attacker.id;
        o.threat.set(attacker.id, 1);
      }
    });
  }

  damage(d: Entity, a: Entity, amount: number, school: string, crit: boolean, result: 'hit') {
    if (d.dead || d.invulnerable) return;
    // Rune Ward and other absorbs
    const ab = d.effects.find((f) => f.type === 'absorb');
    if (ab && school !== 'bleed') {
      const soak = Math.min(ab.value, amount);
      ab.value -= soak;
      amount -= soak;
      if (d === this.player && soak > 0) this.log(`Your ward absorbs ${soak} damage.`, 'spell');
      if (amount <= 0) return;
    }
    if (d.stealthed) this.unhide(d);
    d.hp -= amount;
    d.lastHurt = this.t;
    d.lastCombat = this.t;
    a.lastCombat = this.t;
    // tanks draw far more attention than they deal in damage
    const threat = a.cls && CLASSES[a.cls].arch === 'tank' ? 2.5 : 1;
    d.threat.set(a.id, (d.threat.get(a.id) ?? 0) + amount * threat);
    d.dmgBy.set(a.id, (d.dmgBy.get(a.id) ?? 0) + amount);
    this.events.push({ type: 'dmg', id: d.id, src: a.id, amount, crit, school, result });
    if (school === 'bleed') {
      if (d === this.player) this.log(`You bleed for ${amount} damage.`, 'hit-in');
      else if (a === this.player) this.log(`${capNm(d)} bleeds for ${amount} damage.`, 'hit-out');
    }
    // damage breaks roots after the first couple of seconds
    const root = d.effects.find((f) => f.type === 'root');
    if (root && this.t - root.start > 2) {
      d.effects.splice(d.effects.indexOf(root), 1);
      this.plog(d, 'You can move again.', 'spell');
    }
    if (school !== 'bleed') this.interruptByHit(d);
    if (d.keep !== undefined) this.war.underAttack(d.keep, a);
    if (d.hp <= 0) this.kill(d, a);
  }

  heal(d: Entity, src: Entity, amount: number, tick = false) {
    if (d.dead) return;
    const real = Math.min(d.maxHp - d.hp, Math.round(amount));
    d.hp += real;
    this.events.push({ type: 'heal', id: d.id, src: src.id, amount: real });
    if (src === this.player) {
      if (d === src) this.log(`You heal yourself for ${real} hit points.${tick ? '' : ''}`, 'heal');
      else this.log(`You heal ${d.name} for ${real} hit points.`, 'heal');
    } else if (d === this.player && real > 0) this.log(`${capNm(src)} heals you for ${real} hit points.`, 'heal');
    // healing draws the attention of whatever is fighting the healed
    if (real > 0 && this.t - d.lastCombat < 6) {
      this.near(d.x, d.z, 40, (o) => {
        if (!o.dead && o.target === d.id && this.hostile(o, src)) o.threat.set(src.id, (o.threat.get(src.id) ?? 0) + real * 0.5);
      });
      src.lastCombat = this.t;
    }
  }

  private interruptByHit(d: Entity) {
    if (!d.cast || d.cast.focus) return;
    const ab = ABILITIES[d.cast.ab];
    if (ab.noInterrupt) return;
    this.interrupt(d, ab.kind === 'shot' ? 'You are hit and lose your shot!' : 'You are interrupted!');
  }

  interrupt(e: Entity, msg: string) {
    if (!e.cast) return;
    this.events.push({ type: 'castEnd', id: e.id, ab: e.cast.ab, ok: false });
    e.cast = null;
    this.plog(e, msg, 'error');
  }

  /** Is this ability usable now? Returns a reason if not. */
  canUse(e: Entity, abId: string, target: Entity | undefined): string | null {
    const ab = ABILITIES[abId];
    if (!ab) return 'Unknown ability.';
    if (e.dead) return 'You are dead.';
    if (!e.abilities.includes(abId) && e.kind !== 'mob') return `You do not know ${ab.name} yet.`;
    if (this.stunned(e) && !ab.whileStunned) return 'You are stunned!';
    if ((e.cds[abId] ?? 0) > this.t) return `You must wait ${Math.ceil(e.cds[abId] - this.t)} seconds to use ${ab.name} again!`;
    if (e.cast) return 'You are already busy!';
    if (ab.costType === 'endu' && e.endu < ab.cost) return 'You are too fatigued!';
    if (abId === 'stealth' && !e.stealthed && this.t - e.lastCombat < 5) return 'You can’t hide in the middle of a fight!';
    if (target && target !== e && this.hostile(e, target) && !this.canSee(e, target)) return 'You can’t see your target!';
    if (target && target !== e && !this.los(e, target)) return 'Your target is not in view!';
    if (ab.costType === 'power' && e.maxPower > 0 && e.power < (ab.cost / 100) * e.maxPower) return 'You don’t have enough power!';
    if (ab.target === 'enemy' || ab.target === 'enemyAoe') {
      if (!target || target.dead) return 'You need a target!';
      if (!this.hostile(e, target)) return 'You can’t attack that!';
      const range = ab.kind === 'style' ? e.weapon.ranged ? 3.6 : e.weapon.range : ab.range ?? 30;
      const d = dist(e, target) - target.radius - e.radius;
      if (d > range + 0.4) return 'Your target is too far away!';
      if (ab.kind === 'style' && e.weapon.ranged) return 'You need a melee weapon for that!';
    }
    if (ab.target === 'ally' && target && target !== e) {
      if (!this.friendly(e, target)) return null; // falls back to self
      if (dist(e, target) > (ab.range ?? 30)) return 'Your target is too far away!';
    }
    return null;
  }

  useAbility(e: Entity, abId: string, targetId: number | null = e.target): string | null {
    const ab = ABILITIES[abId];
    let target = this.get(targetId);
    if (ab && ab.target === 'ally' && (!target || !this.friendly(e, target))) target = e;
    const why = this.canUse(e, abId, target);
    if (why) {
      this.plog(e, why, 'error');
      return why;
    }
    if (e.stealthed && !ab.keepsHidden && ab.kind !== 'style') this.unhide(e);
    if (target && target !== e && (ab.target === 'enemy' || ab.target === 'enemyAoe' || ab.target === 'ally')) {
      if (e !== this.player || Math.hypot(this.input.mx, this.input.mz) < 0.01) e.facing = angleTo(e, target);
    }
    if (ab.kind === 'style') {
      e.queuedStyle = abId;
      e.attacking = true;
      if (target) e.target = target.id;
      this.plog(e, `You prepare to perform ${ab.name}!`, 'spell');
      return null;
    }
    if (ab.kind === 'shot' || ab.kind === 'spell') {
      let focus = false;
      const fi = e.effects.findIndex((f) => f.type === 'focus');
      if (fi >= 0 && ab.kind === 'spell') { focus = true; e.effects.splice(fi, 1); }
      e.cast = { ab: abId, start: this.t, end: this.t + (ab.cast ?? 2) / (1 + this.buffSum(e, 'haste')), target: target?.id ?? e.id, focus };
      this.events.push({ type: 'castStart', id: e.id, ab: abId });
      if (e === this.player) this.log(ab.kind === 'shot' ? `You prepare a ${ab.name}!` : `You begin casting a ${ab.name} spell!`, 'spell');
      if (target && this.hostile(e, target)) e.lastCombat = this.t;
      return null;
    }
    this.resolve(e, ab, target);
    return null;
  }

  private finishCast(e: Entity) {
    const c = e.cast!;
    const ab = ABILITIES[c.ab];
    const target = this.get(c.target);
    e.cast = null;
    if (!target || target.dead) {
      this.plog(e, 'Your target is gone.', 'error');
      this.events.push({ type: 'castEnd', id: e.id, ab: ab.id, ok: false });
      return;
    }
    const range = (ab.range ?? 30) + 6;
    if (target !== e && dist(e, target) > range) {
      this.plog(e, 'Your target is too far away!', 'error');
      this.events.push({ type: 'castEnd', id: e.id, ab: ab.id, ok: false });
      return;
    }
    this.events.push({ type: 'castEnd', id: e.id, ab: ab.id, ok: true });
    this.resolve(e, ab, target);
  }

  private pay(e: Entity, ab: AbilityDef) {
    if (ab.costType === 'endu') e.endu = Math.max(0, e.endu - ab.cost);
    else if (e.maxPower > 0) e.power = Math.max(0, e.power - (ab.cost / 100) * e.maxPower);
    if (ab.cd) e.cds[ab.id] = this.t + ab.cd;
  }

  private spellAmount(e: Entity, ab: AbilityDef) {
    const [a, b] = ab.power!;
    const stat = (e.cls && CLASSES[e.cls].powerStat) || (ab.school === 'holy' ? 'pie' : 'int');
    const mastery = 1 + raValue(e.ras, ab.heal ? 'mastery_healing' : 'mastery_magery');
    const mul = (e.mob ? 0.85 * e.dmgMul * (1 + this.buffSum(e, 'dmg')) : this.statMul(e, stat)) * mastery;
    return (a + b * this.powerLevel(e, ab)) * mul * this.rng.range(0.9, 1.1);
  }

  private resolve(e: Entity, ab: AbilityDef, target: Entity | undefined) {
    this.pay(e, ab);
    const victims: Entity[] = [];
    if (ab.target === 'enemy' && target) victims.push(target);
    if (ab.target === 'enemyAoe' && target) {
      this.near(target.x, target.z, ab.radius ?? 8, (o) => { if (this.hostile(e, o)) victims.push(o); });
      this.events.push({ type: 'aoe', x: target.x, z: target.z, r: ab.radius ?? 8, school: ab.school, id: e.id });
    }
    if (ab.target === 'pbaoe') {
      this.near(e.x, e.z, ab.radius ?? 8, (o) => { if (this.hostile(e, o)) victims.push(o); });
      this.events.push({ type: 'aoe', x: e.x, z: e.z, r: ab.radius ?? 8, school: ab.school, id: e.id });
    }
    if (ab.target === 'self') {
      for (const f of ab.effects ?? []) this.addEffect(e, e, f);
      if (e === this.player) this.log(`You use ${ab.name}.`, 'spell');
      return;
    }
    if (ab.target === 'ally' || ab.target === 'pbaoeAlly') {
      const allies: Entity[] = [];
      if (ab.target === 'ally') allies.push(target ?? e);
      else {
        this.near(e.x, e.z, ab.radius ?? 15, (o) => { if (o === e || this.friendly(e, o)) allies.push(o); });
        this.events.push({ type: 'aoe', x: e.x, z: e.z, r: ab.radius ?? 15, school: 'holy', id: e.id });
      }
      for (const t of allies) {
        if (ab.heal && ab.power) {
          const amt = this.spellAmount(e, ab);
          const hot = ab.effects?.find((f) => f.type === 'hot');
          if (hot) this.addEffect(t, e, hot, 0, amt);
          else this.heal(t, e, amt);
        }
        for (const f of ab.effects ?? []) if (f.type !== 'hot') this.addEffect(t, e, f);
      }
      if (e === this.player && !ab.heal) this.log(`You cast ${ab.name}.`, 'spell');
      return;
    }
    for (const v of victims) {
      if (!ab.keepsHidden) this.engage(e, v); // a Shadowstep doesn't alert its target
      if (ab.school !== 'melee' && ab.school !== 'ranged') this.events.push({ type: 'projectile', from: e.id, to: v.id, school: ab.school });
      else if (ab.school === 'ranged' && ab.target === 'enemy') this.events.push({ type: 'projectile', from: e.id, to: v.id, school: 'arrow' });
      let amount = 0, crit = false;
      if (ab.power) {
        const res = this.defenseRoll(e, v, 'spell');
        if (res !== 'hit') {
          this.reportAvoid(e, v, res);
          continue;
        }
        ({ amount, crit } = this.mitigate(e, v, this.spellAmount(e, ab) * (1 - raValue(v.ras, 'avoid_magic')), 0.06, false));
      } else if (ab.bonus !== undefined) {
        const ranged = ab.school === 'ranged';
        const res = this.defenseRoll(e, v, ranged ? 'ranged' : 'melee');
        if (res !== 'hit') {
          this.reportAvoid(e, v, res);
          continue;
        }
        const base = e.weapon.dps * e.weapon.speed * this.statMul(e, ranged ? 'dex' : 'str') * this.weaponSpec(e, ranged);
        ({ amount, crit } = this.mitigate(e, v, base * (1 + ab.bonus) * this.rng.range(0.9, 1.1), 0.1, !ab.pierce));
      }
      if (amount > 0) {
        if (e === this.player) this.log(`You hit ${nm(v)} with ${ab.name} for ${amount} damage!${crit ? ' (Critical hit!)' : ''}`, 'hit-out');
        else if (v === this.player) this.log(`${capNm(e)} hits you with ${ab.name} for ${amount} damage!`, 'hit-in');
        this.damage(v, e, amount, ab.school, crit, 'hit');
        if (ab.drain && !e.dead) this.heal(e, e, amount * ab.drain);
        if (ab.bonus !== undefined && ab.school === 'melee') this.thorns(v, e, amount);
      }
      for (const f of ab.effects ?? []) if (!v.dead) this.addEffect(v, e, f, amount);
    }
  }

  // ---------- death and rewards ----------

  kill(d: Entity, a: Entity) {
    d.hp = 0;
    d.dead = true;
    d.deadAt = this.t;
    d.cast = null;
    d.attacking = false;
    d.effects = [];
    this.events.push({ type: 'death', id: d.id });
    for (const o of this.list) if (o.target === d.id && o !== this.player) { o.target = null; o.attacking = false; }
    const p = this.player;
    if (d === p) {
      this.char!.deaths++;
      this.log(`You have been slain by ${nm(a)}!`, 'death');
      if (a.kind === 'mob' && this.char!.level > 1) {
        const loss = Math.round(xpToNext(this.char!.level) * 0.03);
        this.char!.xp = Math.max(0, this.char!.xp - loss);
        this.log(`You lose ${loss} experience points.`, 'xp');
      }
      return;
    }
    if (p && a === p) this.log(`You kill ${nm(d)}!`, 'death');
    else if (p && dist(p, d) < 60 && d.kind !== 'mob' && d.realm !== -1) {
      this.log(`${capNm(d)} has been killed by ${nm(a)}.`, 'death');
    }
    if (d.kind === 'door') this.war.breached(d);
    if (d.kind === 'lord') this.war.lordSlain(d, a);
    if (d.mob?.explodes) this.burst(d);
    if (d.mob?.rises && !d.rose) this.rising.push({ id: d.id, at: this.t + 3 });
    if (d.rank === 'boss' && p) this.log(`${d.name} is defeated!`, 'realm');
    if (p && !p.dead && !d.rose) this.reward(d, a);
  }

  /** Wisps and the like burst when they die, hurting everything hostile near them. */
  private burst(d: Entity) {
    const amount = Math.round(mobDpsOf(d.level) * 2.5 * d.dmgMul);
    this.events.push({ type: 'aoe', x: d.x, z: d.z, r: 6, school: 'energy', id: d.id });
    if (this.player && dist(this.player, d) < 40) this.log(`${capNm(d)} bursts in a flash of light!`, 'hit-in');
    // (hostile() says no to the dead, so check by hand)
    this.near(d.x, d.z, 6, (o) => { if (!o.dead && o.kind !== 'door' && o.kind !== 'npc' && !o.invulnerable && o.realm !== d.realm && this.los(d, o)) this.damage(o, d, amount, 'energy', false, 'hit'); });
  }

  /** Skeletons pull themselves back together, once. */
  private raiseTheDead() {
    for (const r of this.rising.slice()) {
      if (this.t < r.at) continue;
      this.rising.splice(this.rising.indexOf(r), 1);
      const d = this.get(r.id);
      if (!d || !d.dead || !d.mob) continue;
      const m = this.makeMob(d.mob, d.level, d.x, d.z, undefined, { rank: d.rank === 'elite' ? 'elite' : undefined });
      m.rose = true;
      m.hp = Math.round(m.maxHp * 0.5);
      m.dungeon = d.dungeon;
      m.respawn = undefined;
      m.facing = d.facing;
      this.remove(d);
      if (d.respawn != null) this.war.scheduleRespawn(d);
      this.add(m);
      if (this.player && dist(this.player, m) < 50) this.log(`The ${m.name} pulls itself back together!`, 'system');
      const foe = this.player && !this.player.dead && dist(this.player, m) < 30 ? this.player : null;
      if (foe) { m.ai.mode = 'combat'; m.target = foe.id; m.threat.set(foe.id, 1); }
    }
  }

  /** Mini-bosses and bosses call adds and enrage at set shares of their health; so do some field monsters. */
  bossTick(e: Entity) {
    const frac = e.hp / e.maxHp;
    const b = e.boss ? BOSSES[e.boss] : undefined;
    if (b?.summons) {
      b.summons.forEach((s, i) => {
        if (frac > s.at || (e.phase! & (1 << i))) return;
        e.phase! |= 1 << i;
        this.say(e, s.say);
        for (let k = 0; k < s.n; k++) {
          const a = (k / s.n) * Math.PI * 2;
          let x = e.x + Math.cos(a) * 5, z = e.z + Math.sin(a) * 5;
          const dg = dungeonAt(e.x, e.z);
          if (dg && !walkable(dg, x, z, 0.8)) { x = e.x; z = e.z; }
          const m = this.makeMob(MOB_BY_ID[s.mob], Math.max(1, e.level - 3), x, z);
          m.dungeon = e.dungeon;
          m.rose = true; // summoned dead stay down
          m.ai.mode = 'combat';
          m.target = e.target;
          if (e.target != null) m.threat.set(e.target, 1);
          this.add(m);
        }
      });
    }
    const at = b?.enrageAt ?? (e.mob?.enrage ? 0.3 : 0);
    if (!e.enraged && frac < at) {
      e.enraged = true;
      e.dmgMul *= 1.5;
      e.speed *= 1.2;
      if (this.player && dist(this.player, e) < 60) this.log(`${capNm(e)} flies into a rage!`, 'hit-in');
      this.events.push({ type: 'buff', id: e.id, name: 'Enraged' });
    }
  }

  /** A monster speaks: bosses taunt the group. */
  say(e: Entity, text: string) {
    if (this.player && dist(this.player, e) < 80) this.log(`${e.name} says, “${text}”`, 'say');
  }

  private reward(d: Entity, killer: Entity) {
    const p = this.player!;
    const ch = this.char!;
    let total = 0;
    for (const v of d.dmgBy.values()) total += v;
    // the party's damage counts as yours
    const party = this.partyIds();
    let mine = 0;
    for (const id of party) mine += d.dmgBy.get(id) ?? 0;
    const share = total > 0 ? mine / total : 0;
    const con = conColor(p.level, d.level);
    if (d.kind === 'mob') {
      if (share < 0.5 && !party.has(killer.id)) return;
      ch.kills++;
      const rankMul = d.rank === 'boss' ? 8 : d.rank === 'mini' ? 4 : d.rank === 'elite' ? 2 : d.named ? 3 : 1;
      const xp = Math.round(mobXp(d.level) * CON_XP[con] * rankMul * GROUP_XP[Math.min(3, ch.party.length)]);
      if (xp > 0) this.gainXp(xp, con === 'grey' ? '' : ` (${con})`);
      this.loot(d, con);
      const task = ch.task;
      if (task && d.mob?.id === task.mob && task.have < task.need) {
        task.have++;
        this.log(`Task: ${task.mobName} ${task.have}/${task.need}`, 'system');
        if (task.have >= task.need) this.log('Your task is done. Return to the Taskmaster for your reward.', 'system');
      }
      return;
    }
    if (d.realm === -1 || d.realm === ch.realm || d.kind === 'door') return;
    // realm enemy: points to anyone who helped, a little to anyone nearby
    let part = share;
    if (part === 0 && killer.realm === ch.realm && dist(p, d) < 70) part = 0.2;
    if (part === 0) return;
    const rpBase = (30 + d.level * 7) * (d.kind === 'lord' ? 6 : d.kind === 'guard' ? 1.2 : 1);
    const rp = Math.max(1, Math.round(rpBase * Math.max(0.2, Math.min(1, part * 1.6)) * (con === 'grey' ? 0.2 : 1)));
    this.gainRp(rp);
    if (share > 0) ch.realmKills++;
    const xp = Math.round(mobXp(d.level) * CON_XP[con] * 1.2 * Math.max(0.25, Math.min(1, part * 1.6)));
    if (xp > 0) this.gainXp(xp, '');
    if (share > 0.2) {
      const copper = Math.round(d.level * 15 * this.rng.range(0.6, 1.4));
      ch.copper += copper;
    }
  }

  gainRp(rp: number) {
    const ch = this.char!;
    const before = realmRank(ch.rp);
    ch.rp += rp;
    this.log(`You get ${rp} realm points!`, 'realm');
    const after = realmRank(ch.rp);
    if (after > before) {
      this.applyDerived(this.player!);
      this.log(`You have reached realm rank ${after + 1}: ${RANK_TITLES[ch.realm][after]}!`, 'realm');
      this.events.push({ type: 'levelup', level: -1 });
    }
  }

  gainXp(xp: number, note: string) {
    const ch = this.char!;
    if (ch.level >= MAX_LEVEL) return;
    ch.xp += xp;
    this.log(`You get ${xp} experience points.${note}`, 'xp');
    while (ch.level < MAX_LEVEL && ch.xp >= xpToNext(ch.level)) {
      ch.xp -= xpToNext(ch.level);
      ch.level++;
      this.levelUp();
    }
    if (ch.level >= MAX_LEVEL) ch.xp = 0;
  }

  private levelUp() {
    const ch = this.char!, p = this.player!;
    p.level = ch.level;
    this.applyDerived(p);
    p.hp = p.maxHp;
    p.power = p.maxPower;
    this.log(`You have reached level ${ch.level}!`, 'xp');
    this.events.push({ type: 'levelup', level: ch.level });
    for (const c of this.companions()) this.levelCompanion(c);
    this.log(`You get ${pointsForLevel(ch.level)} specialization points. You have ${freePoints(ch.level, ch.specs)} to spend: open Abilities (K) to train.`, 'system');
  }

  // ---------- specialization ----------

  /** Raises one of the hero's lines by a level. Returns a reason if it can't. */
  train(lineId: string): string | null {
    const ch = this.char!;
    const line = LINES[ch.cls].find((l) => l.id === lineId);
    if (!line) return 'Unknown line.';
    const cur = ch.specs[lineId] ?? 1;
    if (cur >= ch.level) return `${line.name} can't go above your level.`;
    if (freePoints(ch.level, ch.specs) < cur + 1) return `You need ${cur + 1} points to raise ${line.name}.`;
    ch.specs[lineId] = cur + 1;
    this.log(`You raise ${line.name} to ${cur + 1}.`, 'system');
    this.relearn();
    return null;
  }

  /** Buys the next level of a realm ability. Returns a reason if it can't. */
  buyRealmAbility(id: RaId): string | null {
    const ch = this.char!;
    const ra = RA_BY_ID[id];
    if (!ra) return 'Unknown realm ability.';
    const blocked = raBlocked(ch.cls, ra);
    if (blocked) return `${ra.name}: ${blocked.toLowerCase()}.`;
    const lv = ch.ras[id] ?? 0;
    if (lv >= ra.costs.length) return `${ra.name} is already at its highest level.`;
    const cost = raCost(ra, lv + 1) - raCost(ra, lv);
    if (raFree(ch.rp, ch.ras) < cost) return `You need ${cost} realm ability points for that.`;
    ch.ras[id] = lv + 1;
    if (ra.kind === 'passive') this.log(`${ra.name} rises to level ${lv + 1}.`, 'realm'); // actives: relearn says 'You learn'
    this.relearn();
    return null;
  }

  /** Refunds every realm ability point, for copper. */
  respecRealm(): string | null {
    const ch = this.char!;
    const cost = raRespecCost(ch.rp);
    if (ch.copper < cost) return `A realm ability respec costs ${moneyText(cost)}.`;
    ch.copper -= cost;
    for (const k of Object.keys(ch.ras)) delete ch.ras[k as RaId];
    this.log(`Your realm abilities are unlearned and their points returned. (${moneyText(cost)})`, 'realm');
    this.relearn();
    return null;
  }

  /** Clears every line back to 1 and refunds the points. */
  respec(): string | null {
    const ch = this.char!;
    const cost = ch.freeRespec ? 0 : respecCost(ch.level);
    if (ch.copper < cost) return `A respec costs ${moneyText(cost)}.`;
    ch.copper -= cost;
    ch.freeRespec = false;
    for (const k of Object.keys(ch.specs)) delete ch.specs[k];
    Object.assign(ch.specs, baseSpecs(ch.cls));
    this.log(`Your lines are back to 1. You have ${freePoints(ch.level, ch.specs)} points to spend.${cost ? ` (${moneyText(cost)})` : ''}`, 'system');
    this.relearn();
    return null;
  }

  /** After lines change: learn and forget abilities, and keep the hotbar to what you know. */
  private relearn() {
    const ch = this.char!, p = this.player!;
    const known = [...knownAbilities(ch.cls, ch.specs), ...raActives(ch.ras)];
    for (const a of known) {
      if (p.abilities.includes(a)) continue;
      this.log(`You learn ${ABILITIES[a].name}!`, 'system');
      const free = ch.hotbar.indexOf(null);
      if (free >= 0 && !ch.hotbar.includes(a)) ch.hotbar[free] = a;
    }
    p.abilities = known;
    ch.hotbar = ch.hotbar.map((a) => (a && known.includes(a) ? a : null));
    if (p.queuedStyle && !known.includes(p.queuedStyle)) p.queuedStyle = null;
    this.applyDerived(p);
  }

  private loot(d: Entity, con: string) {
    const ch = this.char!;
    if (con === 'grey') return;
    const mul = d.rank === 'boss' ? 12 : d.rank === 'mini' ? 5 : d.named ? 6 : d.rank === 'elite' ? 1.5 : 1;
    let copper = Math.round((d.level * 9 + this.rng.range(0, d.level * 8)) * mul);
    const cut = Math.round(copper * 0.1 * ch.party.length);
    copper -= cut;
    ch.copper += copper;
    this.log(`You pick up ${moneyText(copper)}.${cut ? ` (Your companions take ${moneyText(cut)}.)` : ''}`, 'loot');
    if (d.rank === 'boss') {
      // a boss always drops two artifacts named for it
      for (let i = 0; i < 2; i++) {
        const it = makeItem(this.rng, ch.cls, d.level + 1, { rarity: 3 });
        it.name = `${d.name.replace(/^The /, '')}’s ${it.name}`;
        this.giveItem(it);
      }
    } else {
      const chance = d.named || d.rank === 'mini' ? 1 : d.mob?.shape === 'humanoid' ? 0.26 : d.rank === 'elite' ? 0.24 : 0.16;
      if (this.rng.chance(chance)) {
        const it = makeItem(this.rng, ch.cls, d.level, d.named || d.rank === 'mini' ? { rarity: this.rng.chance(0.4) ? 3 : 2 } : {});
        this.giveItem(it);
      }
    }
    if (this.rng.chance(0.06)) {
      const kind = CLASSES[ch.cls].powerStat ? (this.rng.chance(0.5) ? 'power' : 'health') : 'health';
      ch.potions[kind]++;
      this.log(`You pick up a ${kind === 'health' ? 'Healing Draught' : 'Draught of Clarity'}.`, 'loot');
    }
  }

  giveItem(it: Item) {
    const ch = this.char!;
    if (ch.bag.length >= 30) {
      this.log(`Your backpack is full! The ${it.name} is lost.`, 'error');
      return false;
    }
    ch.bag.push(it);
    this.log(`You pick up ${aOrAn(it.name)} ${it.name}.`, 'loot');
    return true;
  }

  // ---------- player actions ----------

  equip(uid: number) {
    const ch = this.char!;
    const i = ch.bag.findIndex((it) => it.uid === uid);
    if (i < 0) return;
    const it = ch.bag[i];
    if (it.level > ch.level + 2) {
      this.log(`You must be level ${it.level - 2} to use that.`, 'error');
      return;
    }
    const old = ch.equip[it.slot];
    ch.bag.splice(i, 1);
    ch.equip[it.slot] = it;
    if (old) ch.bag.splice(i, 0, old);
    this.applyDerived(this.player!);
    this.log(`You equip the ${it.name}.`, 'system');
  }

  sell(uid: number) {
    const ch = this.char!;
    const i = ch.bag.findIndex((it) => it.uid === uid);
    if (i < 0) return;
    const it = ch.bag[i];
    ch.bag.splice(i, 1);
    ch.copper += it.value;
    this.log(`You sell the ${it.name} for ${moneyText(it.value)}.`, 'loot');
  }

  destroy(uid: number) {
    const ch = this.char!;
    const i = ch.bag.findIndex((it) => it.uid === uid);
    if (i >= 0) ch.bag.splice(i, 1);
  }

  shopStock(): Item[] {
    const ch = this.char!;
    const r = new Rng(this.seed + ch.level * 31 + ch.realm);
    return SLOTS.map((s) => makeItem(r, ch.cls, ch.level, { slot: s, rarity: 0, quality: 0.94 }));
  }

  potionPrice(kind: 'health' | 'power') {
    return potion(kind, this.char!.level).value * 3;
  }

  buy(it: Item | 'health' | 'power') {
    const ch = this.char!;
    const price = typeof it === 'string' ? this.potionPrice(it) : shopPrice(it);
    if (ch.copper < price) {
      this.log('You can’t afford that.', 'error');
      return false;
    }
    if (typeof it === 'string') {
      ch.copper -= price;
      ch.potions[it]++;
      this.log(`You buy a ${it === 'health' ? 'Healing Draught' : 'Draught of Clarity'} for ${moneyText(price)}.`, 'loot');
      return true;
    }
    if (ch.bag.length >= 30) {
      this.log('Your backpack is full!', 'error');
      return false;
    }
    ch.copper -= price;
    ch.bag.push({ ...it, uid: it.uid + 100000 + Math.floor(this.rng.next() * 1e6) });
    this.log(`You buy the ${it.name} for ${moneyText(price)}.`, 'loot');
    return true;
  }

  drink(kind: 'health' | 'power') {
    const ch = this.char!, p = this.player!;
    if (p.dead) return;
    if (ch.potions[kind] <= 0) return this.log('You have none left.', 'error');
    if ((p.cds.potion ?? 0) > this.t) return this.log(`You must wait ${Math.ceil(p.cds.potion - this.t)} seconds to drink another potion.`, 'error');
    if (kind === 'power' && !p.maxPower) return this.log('You have no use for that.', 'error');
    ch.potions[kind]--;
    p.cds.potion = this.t + 25;
    if (kind === 'health') this.heal(p, p, p.maxHp * 0.45);
    else {
      p.power = Math.min(p.maxPower, p.power + p.maxPower * 0.45);
      this.log('You feel your power return.', 'heal');
    }
  }

  toggleAttack() {
    const p = this.player!;
    const t = this.get(p.target);
    if (p.attacking) {
      p.attacking = false;
      this.log('You stop attacking.', 'system');
      return;
    }
    if (!t || !this.hostile(p, t)) return this.log('You need a target!', 'error');
    p.attacking = true;
    this.log(`You prepare to attack ${nm(t)}!`, 'system');
  }

  release() {
    const p = this.player!, ch = this.char!;
    if (!p.dead) return;
    const dest = this.bindPoint();
    p.dead = false;
    p.hp = Math.round(p.maxHp * 0.6);
    p.power = Math.round(p.maxPower * 0.6);
    p.endu = 100;
    p.x = dest.x;
    p.z = dest.z;
    p.target = null;
    p.attacking = false;
    p.threat.clear();
    p.dmgBy.clear();
    p.lastCombat = -99;
    ch.x = p.x;
    ch.z = p.z;
    this.log(`You release your spirit and return to ${dest.name}.`, 'system');
    this.gatherParty(true);
  }

  bindPoint(): { x: number; z: number; name: string } {
    const p = this.player!, ch = this.char!;
    const dg = dungeonAt(p.x, p.z);
    if (dg) return { ...startOf(dg), name: `the entrance of ${dg.name}` };
    if (Math.hypot(p.x, p.z) < FRONTIER_R + 30) {
      let best: { x: number; z: number; name: string } | null = null, bd = 1e9;
      for (const k of this.keeps) {
        if (k.owner !== ch.realm || this.t - k.lastAttacked < 20) continue;
        const d = dist(p, k.site);
        if (d < bd) { bd = d; best = { ...this.keepToWorld(k.site, -8, 0), name: k.site.name }; }
      }
      if (best) return best;
      const g = siteById(`gate${ch.realm}`);
      return { x: g.x + Math.cos(g.facing) * 6, z: g.z + Math.sin(g.facing) * 6, name: g.name };
    }
    const t = siteById(`town${ch.realm}`);
    return { x: t.x + Math.cos(t.facing) * 6, z: t.z + Math.sin(t.facing) * 6, name: t.name };
  }

  /** Places the player somewhere instantly (teleporters). */
  teleport(x: number, z: number, name: string) {
    const p = this.player!;
    if (this.t - p.lastCombat < 8) {
      this.log('You can’t travel while in combat!', 'error');
      return false;
    }
    p.x = x;
    p.z = z;
    p.target = null;
    p.attacking = false;
    this.log(`You are transported to ${name}.`, 'system');
    this.gatherParty(true);
    if (this.instance && !dungeonAt(x, z)) this.clearInstance();
    return true;
  }

  // ---------- dungeons ----------

  /** Spawns a dungeon's monsters fresh, clearing any other instance. */
  spawnInstance(d: DungeonDef) {
    this.clearInstance();
    this.instance = d.id;
    for (const s of d.spawns) {
      s.mobs.forEach((id, i) => {
        const a = (i / Math.max(1, s.mobs.length)) * Math.PI * 2;
        const r = s.kind === 'pack' ? 3 : 6;
        const m = this.makeMob(MOB_BY_ID[id], s.level - (s.kind === 'pack' ? 0 : 1), s.x + Math.cos(a) * r, s.z + Math.sin(a) * r, undefined, { rank: 'elite' });
        m.dungeon = d.id;
        this.add(m);
      });
      if (s.boss) {
        const b = BOSSES[s.boss];
        const m = this.makeMob(MOB_BY_ID[b.mob], s.level, s.x, s.z, undefined, { boss: b });
        m.dungeon = d.id;
        m.facing = Math.PI;
        this.add(m);
      }
    }
  }

  clearInstance() {
    if (!this.instance) return;
    for (const e of this.list.slice()) if (e.dungeon === this.instance) this.remove(e);
    this.rising = this.rising.filter((r) => this.get(r.id));
    this.instance = null;
  }

  enterDungeon(id: string): string | null {
    const p = this.player!, ch = this.char!;
    const d = dungeonById(id);
    if (!d) return 'There is no such place.';
    if (this.t - p.lastCombat < 8) return 'You can’t go in while in combat!';
    this.spawnInstance(d);
    const s = startOf(d);
    p.x = s.x;
    p.z = s.z;
    p.facing = s.facing;
    p.target = null;
    p.attacking = false;
    this.gatherParty(true);
    this.log(`You enter ${d.name}. Its monsters are levels ${d.levels[0]} to ${d.levels[1]}, and it is meant for a group of four.`, 'system');
    if (ch.party.length < 2) this.log('Hire companions from the Captain in town before you go far: few heroes survive this alone.', 'system');
    return null;
  }

  leaveDungeon(): string | null {
    const p = this.player!;
    const d = dungeonAt(p.x, p.z);
    if (!d) return null;
    if (this.t - p.lastCombat < 8) return 'You can’t leave while in combat!';
    const e = this.entrances.find((x) => x.dungeon === d)!;
    p.x = e.x + Math.cos(e.facing) * 6;
    p.z = e.z + Math.sin(e.facing) * 6;
    p.target = null;
    p.attacking = false;
    this.clearInstance();
    this.gatherParty(true);
    this.log(`You climb back out of ${d.name}. Its monsters will be waiting again next time.`, 'system');
    return null;
  }

  // ---------- companions ----------

  companions(): Entity[] {
    return this.list.filter((e) => e.kind === 'companion' && e.leader === this.player?.id);
  }

  /** The player and their companions. */
  partyIds(): Set<number> {
    const s = new Set<number>();
    if (this.player) s.add(this.player.id);
    for (const c of this.companions()) s.add(c.id);
    return s;
  }

  static hireCost(level: number) {
    return 40 + level * level * 3;
  }

  hire(role: Role): string | null {
    const ch = this.char!;
    if (ch.party.length >= 3) return 'Your party is full: three companions at most.';
    const cost = World.hireCost(ch.level);
    if (ch.copper < cost) return `Hiring costs ${moneyText(cost)}.`;
    ch.copper -= cost;
    const name = realmName(ch.realm, () => this.rng.next());
    ch.party.push({ role, name });
    const c = this.spawnCompanion(ch.party.length - 1);
    this.log(`${name} the ${CLASSES[c.cls!].name} joins you. (${moneyText(cost)})`, 'system');
    return null;
  }

  dismiss(slot: number) {
    const ch = this.char!;
    const m = ch.party[slot];
    if (!m) return;
    for (const c of this.companions()) this.remove(c);
    ch.party.splice(slot, 1);
    this.log(`${m.name} leaves your company.`, 'system');
    ch.party.forEach((_, i) => this.spawnCompanion(i));
  }

  private spawnCompanion(slot: number): Entity {
    const ch = this.char!, p = this.player!;
    const m = ch.party[slot];
    const cls = classFor(ch.realm, m.role);
    const at = this.behind(p, slot);
    const e = this.makeCombatant('companion', cls, ch.realm, ch.level, at.x, at.z, m.name);
    e.leader = p.id;
    e.slot = slot;
    e.title = CLASSES[cls].name;
    return this.add(e);
  }

  /** A spot a little behind someone, or right on them if a wall is in the way. */
  private behind(p: Entity, slot: number) {
    const x = p.x - Math.cos(p.facing) * (2 + slot), z = p.z - Math.sin(p.facing) * (2 + slot);
    const dg = dungeonAt(p.x, p.z);
    return dg && !(walkable(dg, x, z, 0.6) && dungeonLos(dg, p.x, p.z, x, z)) ? { x: p.x, z: p.z } : { x, z };
  }

  private levelCompanion(e: Entity) {
    const ch = this.char!;
    e.level = ch.level;
    const builds = BUILDS[e.cls!];
    e.specs = autoSpec(e.cls!, e.level, builds[e.id % builds.length]);
    this.applyDerived(e);
    e.hp = e.maxHp;
    e.power = e.maxPower;
    e.abilities = knownAbilities(e.cls!, e.specs);
  }

  /** Brings the party to the player; with revive, the fallen get up too. */
  gatherParty(revive: boolean) {
    const p = this.player;
    if (!p) return;
    for (const c of this.companions()) {
      if (c.dead) {
        if (!revive) continue;
        this.remove(c);
        const n = this.spawnCompanion(c.slot!);
        n.hp = Math.round(n.maxHp * 0.6);
        continue;
      }
      Object.assign(c, this.behind(p, c.slot!));
      c.target = null;
      c.attacking = false;
      c.threat.clear();
    }
  }

  /** Fallen companions get up once the fighting has stopped for a while. */
  private reviveCompanions() {
    const p = this.player;
    if (!p) return;
    const party = this.partyIds();
    for (const c of this.companions()) {
      if (!c.dead || this.t - c.deadAt < 10 || this.t - p.lastCombat < 10) continue;
      let fighting = false;
      this.near(c.x, c.z, 40, (o) => { if (!o.dead && o.target != null && party.has(o.target) && this.hostile(o, c)) fighting = true; });
      if (fighting) continue;
      this.remove(c);
      const n = this.spawnCompanion(c.slot!);
      n.x = c.x;
      n.z = c.z;
      n.hp = Math.round(n.maxHp * 0.5);
      this.log(`${n.name} gets back up.`, 'system');
    }
  }

  travelOptions(): { label: string; x: number; z: number; name: string }[] {
    const ch = this.char!, p = this.player!;
    const out: { label: string; x: number; z: number; name: string }[] = [];
    const town = siteById(`town${ch.realm}`), gate = siteById(`gate${ch.realm}`);
    const nearTown = dist(p, town) < 80;
    if (!nearTown) out.push({ label: town.name, x: town.x + Math.cos(town.facing) * 6, z: town.z + Math.sin(town.facing) * 6, name: town.name });
    if (dist(p, gate) > 40) out.push({ label: `${gate.name} (the Frontier)`, x: gate.x + Math.cos(gate.facing) * 8, z: gate.z + Math.sin(gate.facing) * 8, name: gate.name });
    if (!nearTown) {
      for (const k of this.keeps) {
        if (k.owner !== ch.realm || dist(p, k.site) < 40) continue;
        const safe = this.t - k.lastAttacked > 20;
        const pt = this.keepToWorld(k.site, -8, 0);
        out.push({ label: `${k.site.name}${safe ? '' : ' (under attack)'}`, ...pt, name: k.site.name });
      }
    }
    return out;
  }

  // ---------- tasks ----------

  offerTask(): Task | null {
    const ch = this.char!;
    const lv = ch.level;
    const town = siteById(`town${ch.realm}`);
    const cands = Object.values(MOB_BY_ID).filter((m) => m.levels[0] <= lv + 1 && m.levels[1] >= lv && (!m.realms || m.realms.includes(ch.realm)) && m.id !== 'rat' && !m.dungeon);
    if (!cands.length) return null;
    const r = new Rng(this.seed + ch.kills * 13 + lv);
    const m = r.pick(cands);
    // find where they live
    let zone = 'the wilds';
    let bd = 1e9;
    for (const e of this.list) {
      if (e.mob?.id === m.id && !e.named) {
        const d = dist(e, town);
        if (d < bd && Math.hypot(e.x, e.z) > FRONTIER_R) {
          bd = d;
          zone = this.geo.zoneAt(e.x, e.z).name;
        }
      }
    }
    const need = r.int(5, 8);
    return { mob: m.id, mobName: `${m.name}`, need, have: 0, xp: Math.round(mobXp(lv) * need * 0.8), copper: lv * 40 + 60, zone };
  }

  acceptTask(t: Task) {
    this.char!.task = t;
    this.log(`New task: slay ${t.need} ${plural(t.mobName)} in ${t.zone}.`, 'system');
  }

  completeTask() {
    const ch = this.char!;
    const t = ch.task;
    if (!t || t.have < t.need) return;
    ch.task = null;
    ch.copper += t.copper;
    this.log(`Task complete! You receive ${moneyText(t.copper)}.`, 'loot');
    this.gainXp(t.xp, ' (task)');
  }

  /** The thing the player can interact with right now, if any. */
  interactable(): Interactable | null {
    const p = this.player;
    if (!p || p.dead) return null;
    for (const en of this.entrances) if (Math.hypot(p.x - en.x, p.z - en.z) < 8) return { portal: 'enter', dungeon: en.dungeon, x: en.x, z: en.z };
    const dg = dungeonAt(p.x, p.z);
    if (dg) {
      const s = startOf(dg);
      if (Math.hypot(p.x - (s.x - 4), p.z - s.z) < 5) return { portal: 'leave', dungeon: dg, x: s.x - 4, z: s.z };
    }
    let best: Entity | null = null, bd = 7;
    this.near(p.x, p.z, 7, (o) => {
      if ((o.kind === 'npc' || (o.kind === 'soldier' && !o.dead && this.t - o.lastCombat > 3)) && o.realm === p.realm) {
        const d = dist(p, o);
        if (d < bd) { bd = d; best = o; }
      }
    });
    if (best) return best;
    for (const k of this.keeps) {
      if (k.owner === p.realm && dist(p, k.site) < 9) return k;
    }
    return null;
  }

  dump(): CharSave {
    const ch = this.char!;
    if (this.player) { ch.x = this.player.x; ch.z = this.player.z; }
    return ch;
  }
}

function segCrossesBox(au: number, av: number, bu: number, bv: number, h: number): boolean {
  // Liang–Barsky against the square |u|,|v| < h
  let t0 = 0, t1 = 1;
  const du = bu - au, dv = bv - av;
  const clip = (p: number, q: number) => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  return clip(-du, au + h) && clip(du, h - au) && clip(-dv, av + h) && clip(dv, h - av) && t0 <= t1;
}

export function cap(s: string) {
  return s[0].toUpperCase() + s.slice(1);
}
/** "the grey wolf" for monsters, a bare name for people. */
export function nm(e: Entity, fallback?: string) {
  if (fallback && e.kind === 'mob' && !e.named) return fallback;
  if (e.kind === 'mob' && !e.named) return `the ${e.name}`;
  if (e.kind === 'door') return `the gate of ${e.name}`;
  return e.name;
}
export function capNm(e: Entity) {
  return cap(nm(e));
}
export function moneyText(c: number) {
  const g = Math.floor(c / 10000), s = Math.floor((c % 10000) / 100), cc = c % 100;
  const parts = [];
  if (g) parts.push(`${g} gold`);
  if (s) parts.push(`${s} silver`);
  if (cc || !parts.length) parts.push(`${cc} copper`);
  return parts.join(', ');
}
export function plural(s: string) {
  if (s.endsWith('f')) return s.slice(0, -1) + 'ves';
  if (s.endsWith('man')) return s.slice(0, -3) + 'men';
  if (s.endsWith('s')) return s;
  if (s.endsWith('y') && !/[aeiou]y$/.test(s)) return s.slice(0, -1) + 'ies';
  return s + 's';
}
function aOrAn(s: string) {
  return /^[aeiou]/i.test(s) ? 'an' : 'a';
}
