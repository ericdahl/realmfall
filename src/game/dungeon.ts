/**
 * Dungeons: one per realm, built for a group of four. Each lies far outside the world disc
 * (there is no terrain there) as a set of axis-aligned rooms and corridors. A point is
 * walkable when it lies inside one of them; movement slides along their edges, routing
 * goes doorway to doorway, and walls block sight.
 */
import type { RealmId } from './geo';

export interface Rect { x0: number; z0: number; x1: number; z1: number }

export type Theme = 'crypt' | 'grove' | 'ice';

/** What waits in a room: a pack, a named mini-boss with escorts, or the boss. */
export interface DungeonSpawn {
  kind: 'pack' | 'mini' | 'boss';
  x: number;
  z: number;
  /** monster ids, one per monster (for mini and boss: the escorts) */
  mobs: string[];
  /** mini-boss or boss, from BOSSES */
  boss?: string;
  level: number;
}

export interface DungeonDef {
  id: string;
  realm: RealmId;
  name: string;
  theme: Theme;
  levels: [number, number];
  blurb: string;
  /** world position of the entrance hall's centre */
  ox: number;
  oz: number;
  rects: Rect[];
  spawns: DungeonSpawn[];
}

/** Dungeons start here on the x axis, far past the world's edge. */
export const DUNGEON_X = 2600;
/** The floor every dungeon stands on. */
export const DUNGEON_FLOOR = 2;
export const WALL_H = 4.5;

// The shared plan, in metres from the entrance hall's centre. Corridors run 2 m into the
// rooms they join, so the walkable areas overlap by more than anyone's width.
const PLAN: Rect[] = [
  { x0: -10, z0: -10, x1: 10, z1: 10 }, // 0 entrance hall
  { x0: 8, z0: -3, x1: 42, z1: 3 }, // 1 corridor east
  { x0: 40, z0: -15, x1: 72, z1: 15 }, // 2 first room
  { x0: 52, z0: 13, x1: 58, z1: 47 }, // 3 corridor north
  { x0: 40, z0: 45, x1: 72, z1: 77 }, // 4 first mini-boss
  { x0: 52, z0: -47, x1: 58, z1: -13 }, // 5 corridor south
  { x0: 38, z0: -79, x1: 72, z1: -45 }, // 6 side hall
  { x0: 70, z0: 57, x1: 102, z1: 63 }, // 7 corridor east
  { x0: 100, z0: 38, x1: 142, z1: 82 }, // 8 great hall
  { x0: 140, z0: 57, x1: 172, z1: 63 }, // 9 corridor east
  { x0: 170, z0: 43, x1: 202, z1: 77 }, // 10 second mini-boss
  { x0: 183, z0: 75, x1: 189, z1: 107 }, // 11 corridor north
  { x0: 164, z0: 105, x1: 208, z1: 149 }, // 12 boss chamber
];

interface Theme0 {
  pack: string[][];
  mini: [string, string, string[]][];
  boss: [string, string[]];
}

function build(id: string, realm: RealmId, name: string, theme: Theme, blurb: string, t: Theme0): DungeonDef {
  const ox = DUNGEON_X + realm * 600, oz = 0;
  const rects = PLAN.map((r) => ({ x0: r.x0 + ox, z0: r.z0 + oz, x1: r.x1 + ox, z1: r.z1 + oz }));
  const at = (x: number, z: number) => ({ x: x + ox, z: z + oz });
  const [p0, p1, p2, p3, p4, p5] = t.pack;
  const spawns: DungeonSpawn[] = [
    { kind: 'pack', ...at(50, -6), mobs: p0, level: 13 },
    { kind: 'pack', ...at(63, 7), mobs: p1, level: 14 },
    { kind: 'pack', ...at(46, -62), mobs: p2, level: 14 },
    { kind: 'pack', ...at(64, -70), mobs: p3, level: 15 },
    { kind: 'mini', ...at(56, 66), boss: t.mini[0][0], mobs: t.mini[0][2], level: 16 },
    { kind: 'pack', ...at(112, 50), mobs: p4, level: 15 },
    { kind: 'pack', ...at(130, 72), mobs: p5, level: 16 },
    { kind: 'mini', ...at(188, 60), boss: t.mini[1][0], mobs: t.mini[1][2], level: 17 },
    { kind: 'boss', ...at(186, 132), boss: t.boss[0], mobs: t.boss[1], level: 18 },
  ];
  return { id, realm, name, theme, levels: [13, 18], blurb, ox, oz, rects, spawns };
}

export const DUNGEONS: DungeonDef[] = [
  build('barrowdeep', 0, 'Barrowdeep', 'crypt', 'An old king’s barrow under the downs, where the dead will not stay buried.', {
    pack: [['skeleton', 'skeleton', 'ghoul'], ['ghoul', 'ghoul', 'grave_caller'], ['skeleton', 'skeleton', 'skeleton'], ['ghoul', 'grave_caller', 'skeleton'], ['skeleton', 'ghoul', 'ghoul', 'grave_caller'], ['wight', 'skeleton', 'grave_caller']],
    mini: [['sexton_mord', 'Sexton Mord', ['skeleton', 'skeleton']], ['lady_ashgrave', 'Lady Ashgrave', ['ghoul']]],
    boss: ['barrow_king', []],
  }),
  build('rotheart', 1, 'Rotheart Hollow', 'grove', 'A grove gone sour beneath the old wood, where the roots remember every grudge.', {
    pack: [['wisp', 'wisp', 'spriggan'], ['spriggan', 'sprite', 'sprite'], ['wisp', 'wisp', 'wisp'], ['spriggan', 'spriggan', 'wisp'], ['sprite', 'spriggan', 'wisp', 'wisp'], ['treant', 'wisp', 'sprite']],
    mini: [['mother_thistle', 'Mother Thistle', ['spriggan', 'wisp']], ['gloamwing', 'Gloamwing', ['wisp', 'wisp']]],
    boss: ['the_rotheart', []],
  }),
  build('hrimgard', 2, 'Hrimgard Deep', 'ice', 'Ice caves under the glacier, where a giant sleeps and the cold has teeth.', {
    pack: [['ice_crawler', 'ice_crawler', 'ice_wraith'], ['ice_wolf', 'ice_wolf', 'ice_wraith'], ['ice_crawler', 'ice_crawler', 'ice_crawler'], ['troll', 'ice_wraith'], ['ice_wolf', 'ice_wolf', 'ice_crawler', 'ice_wraith'], ['troll', 'ice_crawler', 'ice_wraith']],
    mini: [['skadis_hound', 'Skadi’s Hound', ['ice_wolf', 'ice_wolf']], ['pale_seer', 'The Pale Seer', ['ice_wraith']]],
    boss: ['hrimthurs', []],
  }),
];

export const dungeonById = (id: string) => DUNGEONS.find((d) => d.id === id);

/** The dungeon containing a point, if any. */
export function dungeonAt(x: number, z: number): DungeonDef | undefined {
  if (x < DUNGEON_X - 200) return undefined;
  return DUNGEONS.find((d) => x > d.ox - 60 && x < d.ox + 260 && z > d.oz - 120 && z < d.oz + 190);
}

const inside = (r: Rect, x: number, z: number, m = 0) => x >= r.x0 + m && x <= r.x1 - m && z >= r.z0 + m && z <= r.z1 - m;

/** Can something of this radius stand here? */
export function walkable(d: DungeonDef, x: number, z: number, radius = 0): boolean {
  return d.rects.some((r) => inside(r, x, z, radius));
}

/** Nothing but open floor between two points. */
export function los(d: DungeonDef, ax: number, az: number, bx: number, bz: number): boolean {
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(len / 0.7));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (!walkable(d, ax + (bx - ax) * t, az + (bz - az) * t)) return false;
  }
  return true;
}

function overlap(a: Rect, b: Rect): Rect | null {
  const r = { x0: Math.max(a.x0, b.x0), z0: Math.max(a.z0, b.z0), x1: Math.min(a.x1, b.x1), z1: Math.min(a.z1, b.z1) };
  return r.x0 < r.x1 && r.z0 < r.z1 ? r : null;
}

const links = new Map<string, { to: number; x: number; z: number }[][]>();
function graph(d: DungeonDef) {
  let g = links.get(d.id);
  if (!g) {
    g = d.rects.map(() => []);
    for (let i = 0; i < d.rects.length; i++)
      for (let j = 0; j < d.rects.length; j++) {
        if (i === j) continue;
        const o = overlap(d.rects[i], d.rects[j]);
        if (o) g[i].push({ to: j, x: (o.x0 + o.x1) / 2, z: (o.z0 + o.z1) / 2 });
      }
    links.set(d.id, g);
  }
  return g;
}

/** The next point to walk to on the way from (x, z) to (tx, tz): a doorway, or the target itself. */
export function route(d: DungeonDef, x: number, z: number, tx: number, tz: number): { x: number; z: number } {
  const g = graph(d);
  const from = d.rects.map((r, i) => (inside(r, x, z) ? i : -1)).filter((i) => i >= 0);
  const goal = new Set(d.rects.map((r, i) => (inside(r, tx, tz) ? i : -1)).filter((i) => i >= 0));
  if (!from.length || !goal.size || from.some((i) => goal.has(i))) return { x: tx, z: tz };
  // breadth-first over the rooms, remembering each room's doorway in
  const prev = new Map<number, { from: number; x: number; z: number }>();
  const queue = [...from];
  const seen = new Set(from);
  let end = -1;
  while (queue.length) {
    const i = queue.shift()!;
    if (goal.has(i)) { end = i; break; }
    for (const l of g[i]) {
      if (seen.has(l.to)) continue;
      seen.add(l.to);
      prev.set(l.to, { from: i, x: l.x, z: l.z });
      queue.push(l.to);
    }
  }
  if (end < 0) return { x: tx, z: tz };
  // walk back to the first doorway we are not already standing in
  const steps: { room: number; x: number; z: number }[] = [];
  for (let i = end; prev.has(i); i = prev.get(i)!.from) steps.unshift({ room: i, ...prev.get(i)! });
  for (const s of steps) if (!inside(d.rects[s.room], x, z)) return { x: s.x, z: s.z };
  return { x: tx, z: tz };
}

/** Where a group arrives and the portal out stands. */
export const startOf = (d: DungeonDef) => ({ x: d.ox - 4, z: d.oz, facing: 0 });
