import type { CharSave } from '../game/types';
import { SAVE_VERSION } from '../game/world';
import { bumpUid } from '../game/items';
import { autoSpec, BUILDS, knownAbilities, LINES } from '../game/specs';
import { CLASSES, OLD_CLASS_ROLE, classFor } from '../game/data';

const KEY = 'realmfall.chars';

export function loadChars(): CharSave[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as CharSave[];
    const out = list.filter((c) => c && c.version <= SAVE_VERSION && c.name);
    for (const c of out) {
      for (const it of [...Object.values(c.equip), ...c.bag]) if (it) bumpUid(it.uid);
      c.task ??= null;
      c.potions ??= { health: 0, power: 0 };
      migrateChar(c);
    }
    return out;
  } catch {
    return [];
  }
}

/** The lines of the four classes from before realm classes, in order. */
const OLD_LINES: Record<string, string[]> = {
  warden: ['blades', 'shields', 'defence'],
  ranger: ['archery', 'hunting', 'survival'],
  runecaller: ['fire', 'frost', 'storm'],
  cleric: ['restoration', 'smiting', 'enhancement'],
};

/**
 * Brings an old hero up to date. Version 1 had no specialization lines: the hero gets its
 * class's usual build. Version 2 had four classes shared by every realm: the hero becomes its
 * realm's class of the same role, each line's level carried to the line in the same place.
 * Either way it gets a free respec.
 */
export function migrateChar(c: CharSave) {
  if (c.version >= SAVE_VERSION) return;
  const oldCls = c.cls as string;
  const role = OLD_CLASS_ROLE[oldCls] ?? CLASSES[c.cls]?.arch ?? 'tank';
  c.cls = classFor(c.realm, role);
  if (c.specs && OLD_LINES[oldCls]) {
    const old = c.specs;
    c.specs = Object.fromEntries(LINES[c.cls].map((l, i) => [l.id, old[OLD_LINES[oldCls][i]] ?? 1]));
  } else c.specs = autoSpec(c.cls, c.level, BUILDS[c.cls][0]);
  c.freeRespec = true;
  const known = knownAbilities(c.cls, c.specs);
  c.hotbar = c.hotbar.map((a) => (a && known.includes(a) ? a : null));
  for (const a of known) {
    const free = c.hotbar.indexOf(null);
    if (free >= 0 && !c.hotbar.includes(a)) c.hotbar[free] = a;
  }
  c.version = SAVE_VERSION;
}

export function saveChar(c: CharSave) {
  try {
    const list = loadChars().filter((x) => x.id !== c.id);
    list.unshift(c);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked: play on without saving */
  }
}

export function deleteChar(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadChars().filter((x) => x.id !== id)));
  } catch {
    /* ignore */
  }
}

const SET_KEY = 'realmfall.settings';
export interface Settings { muted: boolean; shadows: boolean; fps: boolean }
export function loadSettings(): Settings {
  try {
    return { muted: false, shadows: true, fps: false, ...JSON.parse(localStorage.getItem(SET_KEY) ?? '{}') };
  } catch {
    return { muted: false, shadows: true, fps: false };
  }
}
export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SET_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
