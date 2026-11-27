/** How monsters, soldiers, guards and wandering adventurers decide what to do. */
import { ABILITIES, CLASSES, conColor } from './data';
import { siteById, homeLevel, FRONTIER_R } from './geo';
import type { Entity } from './types';
import { dist, angleTo, type World } from './world';

const LEASH = 70;

function validTarget(w: World, e: Entity): Entity | null {
  const t = w.get(e.target);
  if (!t || t.dead || !w.hostile(e, t) || !w.canSee(e, t)) return null;
  return t;
}

function topThreat(w: World, e: Entity): Entity | null {
  let best: Entity | null = null, bv = -1;
  for (const [id, v] of e.threat) {
    const o = w.get(id);
    if (!o || o.dead || !w.hostile(e, o)) {
      e.threat.delete(id);
      continue;
    }
    if (dist(e, o) > 90 || !w.canSee(e, o)) continue;
    if (v > bv) { bv = v; best = o; }
  }
  const taunt = e.effects.find((f) => f.type === 'taunt');
  if (taunt) {
    const t = w.get(taunt.src);
    if (t && !t.dead && w.canSee(e, t)) return t;
  }
  return best;
}

function try_(w: World, e: Entity, ab: string, target: Entity | null = null): boolean {
  if (!e.abilities.includes(ab)) return false;
  if ((e.cds[ab] ?? 0) > w.t || e.cast) return false;
  const tgt = target ?? w.get(e.target);
  if (w.canUse(e, ab, tgt) !== null) return false;
  return w.useAbility(e, ab, tgt?.id ?? null) === null;
}

/** Walks into weapon or spell range of the target and fights. */
function fight(w: World, e: Entity, t: Entity, dt: number) {
  e.target = t.id;
  e.attacking = true;
  const d = dist(e, t) - t.radius - e.radius;
  const role = e.cls ? CLASSES[e.cls].arch : null;
  const mob = e.mob;
  const caster = role === 'caster' || mob?.caster;
  const archer = role === 'archer' || mob?.ranged;
  const wantRange = caster ? 26 : archer ? 24 : e.weapon.range - 0.3;

  // Healing comes first for healers.
  if (role === 'healer' && !e.cast) {
    if (healSomeone(w, e)) return;
  }

  if (e.cast) {
    e.facing = angleTo(e, t);
    return;
  }

  // Hidden: get behind the target and open with Ambush, Garrote or a plain Stab.
  if (role === 'stealther' && e.stealthed) {
    e.attacking = !!e.queuedStyle;
    if (e.queuedStyle) return;
    if (d > 12 && d < 25 && try_(w, e, 'shadowstep', t)) return;
    const bx = t.x - Math.cos(t.facing) * (t.radius + e.radius + 0.9), bz = t.z - Math.sin(t.facing) * (t.radius + e.radius + 0.9);
    const behind = !w.styleBlocked(e, t, ABILITIES.ambush);
    const knows = (ab: string) => e.abilities.includes(ab);
    if (d <= e.weapon.range && (behind || !knows('ambush'))) {
      e.facing = angleTo(e, t);
      e.queuedStyle = behind && knows('ambush') ? 'ambush' : knows('garrote') ? 'garrote' : 'stab';
      e.attacking = true;
      return;
    }
    w.moveToward(e, bx, bz, dt, 0.3);
    return;
  }

  // Kiting: casters push away from melee once they have rooted it.
  if (caster && d < 7 && !mob) {
    for (const ab of ['frost_nova', 'sunflare', 'flame_ring', 'rune_blast']) if (try_(w, e, ab)) return;
    if (!w.has(t, 'root')) for (const ab of ['root', 'mana_bind', 'binding_rune']) if (try_(w, e, ab, t)) return;
    if (w.has(t, 'root') || w.has(t, 'snare')) {
      const a = angleTo(t, e);
      w.moveToward(e, e.x + Math.cos(a) * 10, e.z + Math.sin(a) * 10, dt);
      return;
    }
  }

  if (d > wantRange) {
    const stop = (caster || archer ? wantRange : e.weapon.range - 0.5) + t.radius + e.radius;
    w.moveToward(e, t.x, t.z, dt, stop * 0.95);
    // instants while closing
    if (role === 'archer' && d < 40) try_(w, e, 'quick_shot', t);
    if (role === 'tank' && d > 8 && d < 20 && t.target !== e.id) try_(w, e, 'entangle', t);
    return;
  }
  e.facing = angleTo(e, t);

  if (mob) {
    if (mob.caster && d > 5 && (e.cds.bog_bolt ?? 0) <= w.t && w.rng.chance(0.5)) {
      w.useAbility(e, 'bog_bolt', t.id);
      e.cds.bog_bolt = w.t + w.rng.range(5, 8);
      return;
    }
    if (mob.caster && d > e.weapon.range) {
      w.moveToward(e, t.x, t.z, dt, e.weapon.range * 0.9 + t.radius + e.radius);
      return;
    }
    if (e.abilities.includes('slam') && d < 5 && (e.cds.slam ?? 0) <= w.t) w.useAbility(e, 'slam', t.id);
    if (e.abilities.includes('venom') && !e.queuedStyle && w.rng.chance(0.02)) e.queuedStyle = 'venom';
    return;
  }

  switch (role) {
    case 'tank': {
      if (t.cast && try_(w, e, 'shield_bash', t)) return;
      if (e.hp < e.maxHp * 0.5) try_(w, e, 'rally', e);
      if (e.hp < e.maxHp * 0.35) try_(w, e, 'bulwark', e);
      if (e.hp > e.maxHp * 0.6) try_(w, e, 'berserk', e);
      if (t.target === e.id) try_(w, e, 'thorn_skin', e);
      if (countAllies(w, e, 15) >= 3) try_(w, e, 'war_cry', e);
      if (e.endu < 25) try_(w, e, 'second_wind', e);
      if ((w.has(e, 'snare') || w.has(e, 'root')) && d > 4) try_(w, e, 'stand_fast', e);
      if (countNear(w, e, e, 6) >= 3) {
        for (const ab of ['sweeping_blow', 'whirling_axe']) try_(w, e, ab, t);
        if (!w.has(t, 'snare')) try_(w, e, 'briar_patch', e);
      }
      if (!e.queuedStyle && e.endu > 20) {
        const ld = e.lastDefense;
        const knows = (ab: string) => e.abilities.includes(ab);
        const last = e.lastStyle?.id;
        if (ld && ld.kind === 'parry' && w.t - ld.t < 4 && knows('riposte')) e.queuedStyle = 'riposte';
        else if (ld && ld.kind === 'block' && w.t - ld.t < 4 && knows('shield_slam')) e.queuedStyle = 'shield_slam';
        else if (last === 'backhand' && knows('executioner')) e.queuedStyle = 'executioner';
        else if (last === 'slash' && knows('backhand')) e.queuedStyle = 'backhand';
        else if (last === 'gash' && knows('skullsplitter')) e.queuedStyle = 'skullsplitter';
        else if (last === 'cleave' && knows('gash')) e.queuedStyle = 'gash';
        else e.queuedStyle = knows('slash') ? 'slash' : 'cleave';
      }
      break;
    }
    case 'archer': {
      if (d < 5) {
        try_(w, e, 'quick_shot', t);
        try_(w, e, 'dazzle', t);
        if (e.hp < e.maxHp * 0.6) try_(w, e, 'evasion', e);
        if (e.hp < e.maxHp * 0.5) try_(w, e, 'shimmer', e);
        if (e.hp < e.maxHp * 0.4) try_(w, e, 'fleet_foot', e);
        return; // melee with the dagger
      }
      if (e.hp < e.maxHp * 0.5 && t.target !== e.id) try_(w, e, 'field_dressing', e);
      if (e.endu < 25) try_(w, e, 'second_wind', e);
      if (t.target === e.id && t.weapon.range > 6) try_(w, e, 'dazzle', t);
      if (!w.has(t, 'snare') && !w.has(t, 'root') && t.weapon.range < 6 && t.target === e.id && d < 16 && try_(w, e, 'pinning_shot', t)) return;
      if (!w.has(t, 'snare') && t.weapon.range < 6 && try_(w, e, 'crippling_arrow', t)) return;
      if (!w.has(t, 'dot') && w.rng.chance(0.3) && try_(w, e, 'barbed_arrow', t)) return;
      if (t.target !== e.id && try_(w, e, 'piercing_shot', t)) return;
      if (try_(w, e, 'quick_shot', t)) return;
      if (countNear(w, e, t, 8) >= 3 && try_(w, e, 'volley', t)) return;
      if (t.target !== e.id && try_(w, e, 'critical_shot', t)) return;
      try_(w, e, 'aimed_shot', t);
      break;
    }
    case 'caster': {
      if (e.power < e.maxPower * 0.1) return; // melee with the staff
      if (e.hp < e.maxHp * 0.6) for (const ab of ['arcane_shield', 'mana_ward']) if (try_(w, e, ab, e)) break;
      if (t.cast && try_(w, e, 'dread', t)) return;
      if (countNear(w, e, t, 9) >= 3) for (const ab of AOE_NUKES) if (try_(w, e, ab, t)) return;
      if (!w.has(t, 'snare') && t.weapon.range < 6) for (const ab of ['frost_lance', 'void_bolt']) if (try_(w, e, ab, t)) return;
      if (!w.has(t, 'dot')) for (const ab of ['immolate', 'entropy', 'wither']) if (try_(w, e, ab, t)) return;
      if (e.hp < e.maxHp * 0.7) for (const ab of ['soul_siphon', 'unmaking', 'drain_life']) if (try_(w, e, ab, t)) return;
      try_(w, e, 'arcane_surge', e);
      // nukes from the highest line first; the slow ones half the time
      const nukes = NUKES.filter((ab) => e.abilities.includes(ab)).sort((x, y) => w.powerLevel(e, ABILITIES[y]) - w.powerLevel(e, ABILITIES[x]));
      for (const ab of nukes) {
        if ((ABILITIES[ab].cast ?? 0) > 3 && w.rng.chance(0.5)) continue;
        if (try_(w, e, ab, t)) return;
      }
      break;
    }
    case 'stealther': {
      if (!e.effects.some((f) => f.type === 'imbue')) for (const ab of ['deadly_poison', 'crippling_poison']) if (try_(w, e, ab, e)) break;
      if (e.hp < e.maxHp * 0.25 && try_(w, e, 'vanish', e)) return;
      if (e.hp < e.maxHp * 0.6) try_(w, e, 'night_veil', e);
      if (t.target === e.id) try_(w, e, 'blind', t);
      try_(w, e, 'frenzy', e);
      try_(w, e, 'shadow_dance', e);
      if (countNear(w, e, e, 6) >= 3) {
        for (const ab of ['fan_of_knives', 'howl']) try_(w, e, ab, t);
        if (e.hp < e.maxHp * 0.5) try_(w, e, 'smoke_bomb', e);
      }
      if (d > 6) try_(w, e, 'pounce', t);
      if (!e.queuedStyle && e.endu > 15) {
        const knows = (ab: string) => e.abilities.includes(ab);
        const last = e.lastStyle?.id;
        if (last === 'twist' && knows('eviscerate')) e.queuedStyle = 'eviscerate';
        else if (last === 'stab' && knows('twist')) e.queuedStyle = 'twist';
        else if (knows('low_blow') && !w.styleBlocked(e, t, ABILITIES.low_blow)) e.queuedStyle = 'low_blow';
        else if (!w.has(t, 'dot') && knows('rend')) e.queuedStyle = 'rend';
        else if (!w.has(t, 'dot') && knows('moonblade')) e.queuedStyle = 'moonblade';
        else e.queuedStyle = 'stab';
      }
      break;
    }
    case 'healer': {
      if (t.cast) for (const ab of ['holy_stun', 'thunderstrike']) if (try_(w, e, ab, t)) return;
      if (d > 6 && e.power > e.maxPower * 0.4) {
        if (!w.has(t, 'snare') && t.weapon.range < 6 && t.target === e.id && try_(w, e, 'gale', t)) return;
        if (!w.has(t, 'dot')) for (const ab of ['holy_fire', 'swarm']) if (try_(w, e, ab, t)) return;
        for (const ab of ['smite', 'sting', 'spark']) if (try_(w, e, ab, t)) return;
      }
      break;
    }
  }
}

const AOE_NUKES = ['meteor', 'dawnstrike', 'great_rune', 'hailstorm'];
const NUKES = ['lightning', 'radiant_lance', 'oblivion', 'fire_bolt', 'light_bolt', 'rune_bolt', 'ice_shard', 'void_bolt', 'drain_life', 'frost_lance'];

function countAllies(w: World, e: Entity, r: number) {
  let n = 0;
  w.near(e.x, e.z, r, (o) => { if (o !== e && w.friendly(e, o)) n++; });
  return n;
}

function countNear(w: World, e: Entity, t: Entity, r: number) {
  let n = 0;
  w.near(t.x, t.z, r, (o) => { if (w.hostile(e, o)) n++; });
  return n;
}

function healSomeone(w: World, e: Entity): boolean {
  let best: Entity | null = null, bf = 0.68;
  w.near(e.x, e.z, 30, (o) => {
    if (o !== e && !w.friendly(e, o)) return;
    if (o.kind === 'door') return;
    const f = o.hp / o.maxHp;
    const bias = o.kind === 'player' ? 0.08 : 0;
    if (f - bias < bf) { bf = f - bias; best = o; }
  });
  if (!best) return false;
  const tgt: Entity = best;
  if (tgt.hp / tgt.maxHp < 0.35 && !w.has(tgt, 'absorb')) for (const ab of ['shield_of_faith', 'fates_ward']) if (try_(w, e, ab, tgt)) return true;
  if (!w.has(tgt, 'hot') && try_(w, e, 'renew', tgt)) return true;
  if (countHurt(w, e) >= 3 && try_(w, e, 'sanctuary', e)) return true;
  if (tgt.hp / tgt.maxHp < 0.4 && try_(w, e, 'greater_mend', tgt)) return true;
  return try_(w, e, 'mend', tgt);
}

function countHurt(w: World, e: Entity) {
  let n = 0;
  w.near(e.x, e.z, 15, (o) => { if ((o === e || w.friendly(e, o)) && o.hp < o.maxHp * 0.7) n++; });
  return n;
}

// ---------- monsters ----------

export function thinkMob(w: World, e: Entity, dt: number) {
  const ai = e.ai;
  e.moved = 0;
  if (w.stunned(e)) return;
  const def = e.mob!;
  if (ai.mode === 'return') {
    const left = w.moveToward(e, e.spawn.x, e.spawn.z, dt, 0.5);
    if (left < 1) {
      ai.mode = 'idle';
      e.hp = e.maxHp;
      e.threat.clear();
      e.dmgBy.clear();
    }
    return;
  }
  if (ai.mode === 'combat' || ai.mode === 'flee') {
    const t = topThreat(w, e) ?? validTarget(w, e);
    const far = Math.hypot(e.x - e.spawn.x, e.z - e.spawn.z);
    if (!t || far > LEASH) {
      evade(w, e);
      return;
    }
    if (def.flees && !ai.fled && e.hp < e.maxHp * 0.22) {
      ai.fled = true;
      ai.mode = 'flee';
      ai.restUntil = w.t + 4;
      if (w.player && dist(w.player, e) < 40) w.log(`The ${e.name} turns to flee!`, 'system');
    }
    if (ai.mode === 'flee') {
      if (w.t > (ai.restUntil ?? 0)) ai.mode = 'combat';
      const a = angleTo(t, e);
      e.attacking = false;
      w.moveToward(e, e.x + Math.cos(a) * 10, e.z + Math.sin(a) * 10, dt, 0, 0.8);
      return;
    }
    fight(w, e, t, dt);
    separate(w, e, t);
    return;
  }
  // idle or wandering: look for trouble
  if (def.aggro > 0 && w.t >= ai.think) {
    ai.think = w.t + 0.4 + w.rng.next() * 0.4;
    const t = w.nearest(e, def.aggro * (e.named ? 1.3 : 1), (o) => (o.kind === 'player' || o.kind === 'adventurer' || o.kind === 'soldier') && w.hostile(e, o) && conColor(o.level, e.level) !== 'grey' && w.canSee(e, o));
    if (t) {
      e.target = t.id;
      e.threat.set(t.id, 1);
      ai.mode = 'combat';
      w.engage(t, e);
      return;
    }
  }
  if (ai.mode === 'idle') {
    if ((ai.wanderAt ?? 0) < w.t) {
      ai.wanderAt = w.t + w.rng.range(6, 18);
      if (w.rng.chance(0.5)) {
        const a = w.rng.range(0, Math.PI * 2), r = w.rng.range(3, 12);
        ai.goal = { x: e.spawn.x + Math.cos(a) * r, z: e.spawn.z + Math.sin(a) * r };
        ai.mode = 'wander';
      }
    }
  } else if (ai.mode === 'wander' && ai.goal) {
    if (w.moveToward(e, ai.goal.x, ai.goal.z, dt, 0.3, 0.35) < 0.5) ai.mode = 'idle';
  }
}

function evade(_w: World, e: Entity) {
  e.ai.mode = 'return';
  e.target = null;
  e.attacking = false;
  e.cast = null;
  e.queuedStyle = null;
  e.threat.clear();
  e.ai.fled = false;
}

/** Keeps melee crowds from standing inside one another. */
function separate(w: World, e: Entity, t: Entity) {
  w.near(e.x, e.z, 2, (o) => {
    if (o === e || o === t || o.dead || o.kind === 'door' || o.kind === 'player') return;
    const dx = e.x - o.x, dz = e.z - o.z;
    const d = Math.hypot(dx, dz);
    const min = e.radius + o.radius;
    if (d > 0.01 && d < min) w.moveBy(e, (dx / d) * (min - d) * 0.3, (dz / d) * (min - d) * 0.3);
  });
}

// ---------- people ----------

export function thinkCombatant(w: World, e: Entity, dt: number) {
  e.moved = 0;
  const ai = e.ai;
  if (w.stunned(e)) return;

  // Choose an enemy.
  let t = topThreat(w, e) ?? validTarget(w, e);
  const engage = e.kind === 'soldier' ? 34 : e.kind === 'guard' ? 30 : e.kind === 'lord' ? 24 : 18;
  if (w.t >= ai.think) {
    ai.think = w.t + 0.35 + w.rng.next() * 0.3;
    if (!t || (e.kind === 'soldier' && t.kind === 'door')) {
      const pred = (o: Entity) =>
        w.hostile(e, o) && w.canSee(e, o) && o.kind !== 'door' && (e.kind !== 'adventurer' || o.kind === 'mob') && (o.kind !== 'mob' || e.kind === 'guard' || e.kind === 'adventurer' || o.target != null);
      const n = w.nearest(e, engage, pred);
      if (n) t = n;
    }
  }
  // Soldiers following the player fight what the player fights.
  if (e.kind === 'soldier') {
    const b = w.war.band(e);
    const p = b?.follow !== undefined ? w.get(b.follow) : undefined;
    if (p && !p.dead) {
      const pt = w.get(p.target);
      if (pt && w.hostile(e, pt) && w.canSee(e, pt) && dist(p, pt) < 45 && (p.attacking || p.cast || pt.target === p.id || w.t - p.lastCombat < 4)) t = pt;
    }
  }
  if (e.cls && CLASSES[e.cls].arch === 'healer' && !e.cast && w.t - e.lastCombat < 12 && healSomeone(w, e)) return;

  // Posts and leashes.
  const anchor = e.ai.post ?? (e.kind === 'soldier' ? w.war.anchorOf(e) : null);
  if (t && anchor) {
    const leash = e.kind === 'soldier' ? 70 : e.kind === 'lord' ? 30 : 48;
    if (Math.hypot(t.x - anchor.x, t.z - anchor.z) > leash) {
      t = null;
      e.threat.clear();
    }
  }

  if (t) {
    // stealthers slip into the shadows before they close in
    if (e.cls && CLASSES[e.cls].arch === 'stealther' && !e.stealthed && t.target !== e.id && dist(e, t) > 8 && w.t - e.lastCombat > 6) try_(w, e, 'stealth', e);
    ai.mode = 'combat';
    fight(w, e, t, dt);
    return;
  }
  e.attacking = false;
  e.target = null;
  if (e.cast) return;
  if (ai.mode === 'combat') ai.mode = e.kind === 'adventurer' ? 'hunt' : 'idle';

  switch (e.kind) {
    case 'guard':
    case 'lord': {
      const p = ai.post!;
      if (w.moveToward(e, p.x, p.z, dt, 0.4) < 0.6) {
        e.facing = p.facing;
        if (e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.02 * dt * 20 * 0.05);
      }
      return;
    }
    case 'soldier':
      w.war.soldierMove(e, dt);
      return;
    case 'adventurer':
      adventure(w, e, dt);
      return;
  }
}

function adventure(w: World, e: Entity, dt: number) {
  const ai = e.ai;
  if (ai.mode === 'rest') {
    if (e.hp >= e.maxHp * 0.95 && e.power >= e.maxPower * 0.9) ai.mode = 'hunt';
    return;
  }
  if (e.hp < e.maxHp * 0.55 || (e.maxPower && e.power < e.maxPower * 0.3)) {
    ai.mode = 'rest';
    return;
  }
  ai.mode = 'hunt';
  let prey = w.get(ai.huntId);
  if (!prey || prey.dead || (prey.target != null && prey.target !== e.id)) {
    prey = undefined;
    ai.huntId = undefined;
    let best: Entity | null = null, bd = 140;
    w.near(e.x, e.z, 140, (o) => {
      if (o.kind !== 'mob' || o.dead || o.ai.mode === 'combat' || o.ai.mode === 'return') return;
      const c = conColor(e.level, o.level);
      if (c !== 'blue' && c !== 'yellow' && c !== 'green') return;
      if (Math.hypot(o.x, o.z) < FRONTIER_R + 20) return;
      const d = dist(e, o);
      if (d < bd) { bd = d; best = o; }
    });
    if (best) ai.huntId = (best as Entity).id;
  }
  prey = w.get(ai.huntId);
  if (prey) {
    const d = dist(e, prey);
    const arch = e.cls ? CLASSES[e.cls].arch : 'tank';
    const reach = arch === 'caster' || arch === 'archer' ? 28 : arch === 'healer' ? 24 : arch === 'stealther' ? 6 : 2.5;
    if (arch === 'stealther' && !e.stealthed && d < 30 && w.t - e.lastCombat > 6) try_(w, e, 'stealth', e);
    if (d > reach) w.moveToward(e, prey.x, prey.z, dt, reach - 1);
    else {
      e.target = prey.id;
      if (!e.stealthed) w.engage(e, prey); // a hidden stealther opens with a style instead
      ai.mode = 'combat';
    }
    return;
  }
  // nothing near: walk toward ground that suits our level
  if (!ai.goal || Math.hypot(e.x - ai.goal.x, e.z - ai.goal.z) < 6) {
    const town = siteById(`town${e.realm}`);
    const want = 60 + (e.level - 1) * 27;
    for (let i = 0; i < 12; i++) {
      const a = town.facing + w.rng.range(-1.1, 1.1);
      const x = town.x + Math.cos(a) * want, z = town.z + Math.sin(a) * want;
      if (w.geo.ridge(x, z) < 0.15 && Math.hypot(x, z) > FRONTIER_R + 40 && Math.abs(homeLevel(Math.hypot(x - town.x, z - town.z)) - e.level) <= 2) {
        ai.goal = { x, z };
        break;
      }
    }
    ai.goal ??= { x: town.x, z: town.z };
  }
  w.moveToward(e, ai.goal.x, ai.goal.z, dt, 1, 0.85);
}

export { ABILITIES };
