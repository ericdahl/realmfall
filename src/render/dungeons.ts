/** Dungeon interiors and their doors in the world, drawn from the rooms in game/dungeon.ts. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DUNGEONS, DUNGEON_FLOOR, WALL_H, startOf, type DungeonDef, type Rect, type Theme } from '../game/dungeon';
import type { World } from '../game/world';
import { Rng } from '../game/rng';
import { mat } from './palette';

export const THEMES: Record<Theme, { floor: string; wall: string; trim: string; glow: string; ambient: string; fog: string; door: string; mound: string }> = {
  crypt: { floor: '#7a7468', wall: '#9a9384', trim: '#5a544a', glow: '#ffb25a', ambient: '#ffe2bc', fog: '#14100c', door: '#a39f95', mound: '#5f7a3a' },
  grove: { floor: '#5e5a38', wall: '#6e5638', trim: '#4e7a32', glow: '#a8f070', ambient: '#d8f0c0', fog: '#0a140a', door: '#6b5030', mound: '#3f6a2a' },
  ice: { floor: '#b8d0dc', wall: '#e0f0f8', trim: '#8ab0c8', glow: '#8fd6ff', ambient: '#e0f0ff', fog: '#0e1822', door: '#c8d8e0', mound: '#e8eef2' },
};

const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

/** The stretches of a rectangle's edges that face no other room: those get walls. */
function walls(d: DungeonDef, r: Rect): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const edges = [
    { along: 'x' as const, at: r.z0, out: -1, a: r.x0, b: r.x1 },
    { along: 'x' as const, at: r.z1, out: 1, a: r.x0, b: r.x1 },
    { along: 'z' as const, at: r.x0, out: -1, a: r.z0, b: r.z1 },
    { along: 'z' as const, at: r.x1, out: 1, a: r.z0, b: r.z1 },
  ];
  for (const e of edges) {
    let spans: [number, number][] = [[e.a, e.b]];
    const probe = e.at + e.out * 0.3;
    for (const s of d.rects) {
      if (s === r) continue;
      const hit = e.along === 'x' ? s.z0 < probe && probe < s.z1 : s.x0 < probe && probe < s.x1;
      if (!hit) continue;
      const lo = e.along === 'x' ? s.x0 : s.z0, hi = e.along === 'x' ? s.x1 : s.z1;
      spans = spans.flatMap(([a, b]) => {
        const res: [number, number][] = [];
        if (lo > a) res.push([a, Math.min(b, lo)]);
        if (hi < b) res.push([Math.max(a, hi), b]);
        return res.filter(([x, y]) => y - x > 0.05);
      });
    }
    for (const [a, b] of spans) {
      const len = b - a, mid = (a + b) / 2, c = e.at + e.out * 0.5;
      const y = DUNGEON_FLOOR + WALL_H / 2;
      out.push(e.along === 'x' ? box(len + 1, WALL_H, 1, mid, y, c) : box(1, WALL_H, len + 1, c, y, mid));
    }
  }
  return out;
}

export function buildDungeons(w: World): THREE.Group {
  const group = new THREE.Group();
  const add = (gs: THREE.BufferGeometry[], m: THREE.Material, shadows = true) => {
    if (!gs.length) return;
    const mesh = new THREE.Mesh(mergeGeometries(gs, false)!, m);
    mesh.receiveShadow = true;
    mesh.castShadow = shadows;
    group.add(mesh);
  };
  for (const d of DUNGEONS) {
    const th = THEMES[d.theme];
    const rng = new Rng(d.ox + 17);
    const floor: THREE.BufferGeometry[] = [], wall: THREE.BufferGeometry[] = [], trim: THREE.BufferGeometry[] = [], glow: THREE.BufferGeometry[] = [];
    d.rects.forEach((r, i) => {
      floor.push(box(r.x1 - r.x0, 0.4, r.z1 - r.z0, (r.x0 + r.x1) / 2, DUNGEON_FLOOR - 0.2 - i * 0.002, (r.z0 + r.z1) / 2));
      wall.push(...walls(d, r));
      const wd = r.x1 - r.x0, dp = r.z1 - r.z0;
      // pillars in the big rooms
      if (wd > 25 && dp > 25) {
        for (const [u, v] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
          const x = r.x0 + wd * u, z = r.z0 + dp * v;
          if (d.theme === 'grove') trim.push(new THREE.CylinderGeometry(0.7, 1.3, WALL_H, 7).translate(x, DUNGEON_FLOOR + WALL_H / 2, z));
          else trim.push(box(1.4, WALL_H, 1.4, x, DUNGEON_FLOOR + WALL_H / 2, z));
        }
      }
      // torches, mushrooms or ice along the walls
      for (let k = 0; k < Math.max(2, Math.round((wd + dp) / 14)); k++) {
        const side = rng.int(0, 3);
        const x = side < 2 ? r.x0 + 1 + rng.next() * (wd - 2) : side === 2 ? r.x0 + 0.6 : r.x1 - 0.6;
        const z = side >= 2 ? r.z0 + 1 + rng.next() * (dp - 2) : side === 0 ? r.z0 + 0.6 : r.z1 - 0.6;
        if (d.theme === 'crypt') {
          trim.push(box(0.15, 0.6, 0.15, x, DUNGEON_FLOOR + 2.3, z));
          glow.push(box(0.3, 0.35, 0.3, x, DUNGEON_FLOOR + 2.75, z));
        } else if (d.theme === 'grove') {
          trim.push(new THREE.CylinderGeometry(0.08, 0.1, 0.5, 5).translate(x, DUNGEON_FLOOR + 0.25, z));
          glow.push(new THREE.SphereGeometry(0.35, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, DUNGEON_FLOOR + 0.5, z));
        } else {
          glow.push(new THREE.ConeGeometry(0.35, 1.6 + rng.next(), 5).translate(x, DUNGEON_FLOOR + 0.8, z));
        }
      }
      // a few theme props on the floor of rooms (not corridors)
      if (wd > 18 && dp > 18) {
        for (let k = 0; k < 4; k++) {
          const x = r.x0 + 3 + rng.next() * (wd - 6), z = r.z0 + 3 + rng.next() * (dp - 6);
          if (d.theme === 'crypt') trim.push(box(1.1, 0.8, 2.4, x, DUNGEON_FLOOR + 0.4, z).rotateY(0));
          else if (d.theme === 'grove') trim.push(new THREE.TorusGeometry(1.2, 0.25, 5, 8, Math.PI).rotateY(rng.next() * 3).translate(x, DUNGEON_FLOOR, z));
          else wall.push(new THREE.ConeGeometry(0.6, 2.4, 5).translate(x, DUNGEON_FLOOR + 1.2, z));
        }
      }
    });
    // the way out: a glowing ring on the floor and an arch behind it
    const s = startOf(d);
    const px = s.x - 4, pz = s.z;
    glow.push(new THREE.TorusGeometry(1.6, 0.12, 6, 24).rotateX(-Math.PI / 2).translate(px, DUNGEON_FLOOR + 0.1, pz));
    trim.push(box(0.8, 4, 0.8, px - 1, DUNGEON_FLOOR + 2, pz - 2.2), box(0.8, 4, 0.8, px - 1, DUNGEON_FLOOR + 2, pz + 2.2), box(0.8, 0.8, 5.2, px - 1, DUNGEON_FLOOR + 4.2, pz));
    add(floor, mat(th.floor));
    add(wall, mat(th.wall));
    add(trim, mat(th.trim));
    add(glow, new THREE.MeshBasicMaterial({ color: th.glow }), false);
  }
  // doors in the world: an arch over a dark stair
  for (const en of w.entrances) {
    const th = THEMES[en.dungeon.theme];
    const y = w.geo.height(en.x, en.z);
    const g: THREE.BufferGeometry[] = [];
    const cs = Math.cos(en.facing), sn = Math.sin(en.facing);
    const P = (u: number, v: number) => ({ x: en.x + u * cs - v * sn, z: en.z + u * sn + v * cs });
    for (const v of [-2.4, 2.4]) { const p = P(0, v); g.push(box(1, 4.2, 1, p.x, y + 2, p.z).rotateY(0)); }
    const c = P(0, 0);
    g.push(new THREE.BoxGeometry(1.2, 1, 6.2).rotateY(-en.facing).translate(c.x, y + 4.4, c.z));
    // a few standing stones around it
    for (const [u, v] of [[3, -5], [3, 5], [-1, -7], [-1, 7]]) { const p = P(u, v); g.push(box(0.8, 2.2, 0.8, p.x, y + 1, p.z)); }
    add(g, mat(th.door));
    // the mound the stair goes down into
    add([new THREE.SphereGeometry(6, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.3, 0.7, 1.2).translate(P(-7, 0).x, y - 0.4, P(-7, 0).z)], mat(th.mound));
    const hole = new THREE.PlaneGeometry(3.8, 3.8).rotateY(-en.facing + Math.PI / 2).translate(P(0.3, 0).x, y + 1.9, P(0.3, 0).z);
    add([hole], new THREE.MeshBasicMaterial({ color: '#050403', side: THREE.DoubleSide }), false);
  }
  return group;
}
