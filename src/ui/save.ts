import type { CharSave } from '../game/types';
import { SAVE_VERSION } from '../game/world';
import { bumpUid } from '../game/items';
import { autoSpec, BUILDS, knownAbilities } from '../game/specs';

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
      if (c.version < 2) migrateSpecs(c);
    }
    return out;
  } catch {
    return [];
  }
}

/** Heroes from before specialization lines get the class's usual build and a free respec. */
export function migrateSpecs(c: CharSave) {
  c.specs = autoSpec(c.cls, c.level, BUILDS[c.cls][0]);
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
