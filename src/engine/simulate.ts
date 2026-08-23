import type {
  DieColor,
  AttackPool,
  SurgeConversion,
  AttackResults,
  CriticalX,
  DefenseDieColor,
  DefenseSurgeConversion,
  DefensePool,
  DefenseResults,
  WoundsResults,
  CoverLevel,
} from '../types';
import { DICE, DEFENSE_DICE, DEFENSE_SIDES } from './dice-data';

export type AttackFace = 'crit' | 'surge' | 'hit' | 'blank';

export type DefenseFace = 'block' | 'surge' | 'blank';

export interface DefenseDieOutcome {
  color: DefenseDieColor;
  face: DefenseFace;
}

const SIDES = 8;

/** Roll one attack die; returns face type. Uses rng() in [0,1). */
export function rollOneAttackDie(
  color: DieColor,
  rng: () => number
): AttackFace {
  const die = DICE[color];
  const value = rng() * SIDES; // [0, 8)
  const cumul = [
    die.crit,
    die.crit + die.surge,
    die.crit + die.surge + die.hit,
    SIDES,
  ];
  if (value < cumul[0]) return 'crit';
  if (value < cumul[1]) return 'surge';
  if (value < cumul[2]) return 'hit';
  return 'blank';
}

export interface RawAttackCounts {
  crit: number;
  surge: number;
  hit: number;
  blank: number;
}

/** Per-die outcome for one attack die (used for repeated rerolls). */
export interface DieOutcome {
  color: DieColor;
  face: AttackFace;
}

export function rollAttackPool(
  pool: AttackPool,
  rng: () => number
): RawAttackCounts {
  const counts: RawAttackCounts = { crit: 0, surge: 0, hit: 0, blank: 0 };
  const colors: DieColor[] = ['red', 'black', 'white'];
  for (const color of colors) {
    const number = pool[color];
    for (let i = 0; i < number; i++) {
      const face = rollOneAttackDie(color, rng);
      counts[face]++;
    }
  }
  return counts;
}

/** Roll attack pool and return per-die outcomes (order: reds, blacks, whites). */
export function rollAttackPoolDetailed(
  pool: AttackPool,
  rng: () => number
): DieOutcome[] {
  const outcomes: DieOutcome[] = [];
  const colors: DieColor[] = ['red', 'black', 'white'];
  for (const color of colors) {
    const number = pool[color];
    for (let i = 0; i < number; i++) {
      outcomes.push({
        color,
        face: rollOneAttackDie(color, rng),
      });
    }
  }
  return outcomes;
}

export function rollDefensePoolDetailed(
  pool: DefensePool,
  rng: () => number
): DefenseDieOutcome[] {
  const outcomes: DefenseDieOutcome[] = [];
  const colors: DefenseDieColor[] = ['red', 'white'];
  for (const color of colors) {
    const number = pool[color];
    for (let dieIndex = 0; dieIndex < number; dieIndex++) {
      outcomes.push({
        color,
        face: rollOneDefenseDieOutcome(color, rng),
      });
    }
  }
  return outcomes;
}

/** Split a same-color gathered defense pool after Downgrade Defense X. */
export function splitDowngradedDefensePool(
  defenseDieColor: DefenseDieColor,
  totalDefenseDice: number,
  downgradeDefenseX: number
): DefensePool {
  const total = Math.max(0, Math.floor(totalDefenseDice));
  const normalizedDowngradeX = Math.max(0, Math.floor(downgradeDefenseX));
  if (defenseDieColor === 'white') {
    return { red: 0, white: total };
  }
  if (normalizedDowngradeX <= 0) {
    return { red: total, white: 0 };
  }
  const white = Math.min(normalizedDowngradeX, total);
  return { red: total - white, white };
}

/** Sum per-die outcomes to raw (crit, surge, hit, blank) counts. */
export function aggregateToRawCounts(outcomes: DieOutcome[]): RawAttackCounts {
  const counts: RawAttackCounts = { crit: 0, surge: 0, hit: 0, blank: 0 };
  for (const outcome of outcomes) {
    counts[outcome.face]++;
  }
  return counts;
}

function normalizeCriticalX(value: number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
}

function normalizeSurgeTokens(value: number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
}

function normalizeDefenseSurgeTokens(value: number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
}

/**
 * Impact converts hit results to critical results (vs Armor) before Armor cancels
 * hit results only.
 */
function resolveImpactThenArmor(
  hitsAfterCover: number,
  critsAfterCover: number,
  normalizedArmorX: number,
  normalizedImpactX: number
): { hitsAfterArmor: number; critsAfterImpact: number } {
  let hitsAfterImpact = hitsAfterCover;
  let critsAfterImpact = critsAfterCover;
  if (normalizedArmorX > 0 && normalizedImpactX > 0) {
    const convertedHitCount = Math.min(normalizedImpactX, hitsAfterCover);
    hitsAfterImpact = hitsAfterCover - convertedHitCount;
    critsAfterImpact = critsAfterCover + convertedHitCount;
  }
  const hitsCanceledByArmor = Math.min(normalizedArmorX, hitsAfterImpact);
  const hitsAfterArmor = hitsAfterImpact - hitsCanceledByArmor;
  return { hitsAfterArmor, critsAfterImpact };
}

/** Resolve defense roll: blocks + (surge block ? surges : min(tokens, surges)). */
export function resolveDefenseRoll(
  blocks: number,
  surges: number,
  surge: DefenseSurgeConversion,
  defenseSurgeTokens: number | undefined
): number {
  if (surge === 'block') return blocks + surges;
  return (
    blocks + Math.min(normalizeDefenseSurgeTokens(defenseSurgeTokens), surges)
  );
}

/** Indices of defense dice that contribute 0 blocks before reroll (for Uncanny Luck). */
export function getRerollableDefenseIndices(
  faces: DefenseFace[],
  surge: DefenseSurgeConversion,
  defenseSurgeTokens: number | undefined
): number[] {
  if (surge === 'block') {
    const indices: number[] = [];
    for (let index = 0; index < faces.length; index++) {
      if (faces[index] === 'blank') indices.push(index);
    }
    return indices;
  }
  const tokens = normalizeDefenseSurgeTokens(defenseSurgeTokens);
  const blankIndices: number[] = [];
  const surgeIndices: number[] = [];
  for (let index = 0; index < faces.length; index++) {
    if (faces[index] === 'blank') blankIndices.push(index);
    else if (faces[index] === 'surge') surgeIndices.push(index);
  }
  const convertedSurgeCount = Math.min(tokens, surgeIndices.length);
  const excessSurgeIndices = surgeIndices.slice(convertedSurgeCount);
  return [...blankIndices, ...excessSurgeIndices];
}

/** Among rerollable defense dice, spend Uncanny Luck on red before white. */
export function prioritizeRedDefenseRerollIndices(
  outcomes: DefenseDieOutcome[],
  rerollableIndices: number[]
): number[] {
  const redIndices: number[] = [];
  const whiteIndices: number[] = [];
  for (const index of rerollableIndices) {
    const outcome = outcomes[index];
    if (outcome === undefined) continue;
    if (outcome.color === 'red') redIndices.push(index);
    else whiteIndices.push(index);
  }
  return [...redIndices, ...whiteIndices];
}

/** Reroll up to X defense dice that would not become blocks (Uncanny Luck X). */
export function applyUncannyLuckRerolls(
  faces: DefenseFace[],
  uncannyLuckX: number,
  surge: DefenseSurgeConversion,
  defenseSurgeTokens: number | undefined,
  color: DefenseDieColor,
  rng: () => number
): void {
  const normalizedUncannyLuckX = Math.max(0, Math.floor(uncannyLuckX));
  if (normalizedUncannyLuckX <= 0) return;
  const rerollableIndices = getRerollableDefenseIndices(
    faces,
    surge,
    defenseSurgeTokens
  );
  const numToReroll = Math.min(
    normalizedUncannyLuckX,
    rerollableIndices.length
  );
  for (let rerollIndex = 0; rerollIndex < numToReroll; rerollIndex++) {
    const dieIndex = rerollableIndices[rerollIndex] as number;
    faces[dieIndex] = rollOneDefenseDieOutcome(color, rng);
  }
}

function applyUncannyLuckRerollsToOutcomes(
  outcomes: DefenseDieOutcome[],
  uncannyLuckX: number,
  surge: DefenseSurgeConversion,
  defenseSurgeTokens: number | undefined,
  rng: () => number
): void {
  const faces = outcomes.map((outcome) => outcome.face);
  const normalizedUncannyLuckX = Math.max(0, Math.floor(uncannyLuckX));
  if (normalizedUncannyLuckX <= 0) return;
  const rerollableIndices = prioritizeRedDefenseRerollIndices(
    outcomes,
    getRerollableDefenseIndices(faces, surge, defenseSurgeTokens)
  );
  const numToReroll = Math.min(
    normalizedUncannyLuckX,
    rerollableIndices.length
  );
  for (let rerollIndex = 0; rerollIndex < numToReroll; rerollIndex++) {
    const dieIndex = rerollableIndices[rerollIndex] as number;
    const outcome = outcomes[dieIndex];
    if (outcome === undefined) continue;
    outcome.face = rollOneDefenseDieOutcome(outcome.color, rng);
  }
}

/** Pierce blocks canceled after surge conversion; Impervious cancels one fewer when blocks > 0. */
export function pierceBlocksCancelled(
  blocks: number,
  pierceX: number,
  impervious: boolean
): number {
  const normalizedPierceX = Math.max(0, Math.floor(pierceX));
  if (normalizedPierceX === 0) return 0;
  if (impervious && blocks > 0) {
    return Math.max(0, normalizedPierceX - 1);
  }
  return normalizedPierceX;
}

/** Blocks remaining after Pierce (and Impervious) are applied. */
export function effectiveBlocksAfterPierce(
  blocks: number,
  pierceX: number,
  impervious: boolean
): number {
  return Math.max(
    0,
    blocks - pierceBlocksCancelled(blocks, pierceX, impervious)
  );
}

/** Roll one defense die; returns face type. Uses rng() in [0,1). */
export function rollOneDefenseDieOutcome(
  color: DefenseDieColor,
  rng: () => number
): DefenseFace {
  const die = DEFENSE_DICE[color];
  const blockFaces = die.block;
  const surgeFaces = die.surge;
  const value = rng() * DEFENSE_SIDES;
  if (value < blockFaces) return 'block';
  if (value < blockFaces + surgeFaces) return 'surge';
  return 'blank';
}

function coverToValue(cover: CoverLevel): number {
  return cover === 'none' ? 0 : cover === 'light' ? 1 : 2;
}

function valueToCover(value: number): CoverLevel {
  return value <= 0 ? 'none' : value === 1 ? 'light' : 'heavy';
}

/** Sharpshooter X: reduce cover by up to X steps (heavy→light→none). Suppressed: improve by 1 first (none→light, light→heavy). Cover X: improve by X, cap at heavy (2). Sharpshooter applies after. Used inside applyCover. */
export function getEffectiveCover(
  cover: CoverLevel,
  sharpshooterX: number,
  suppressed?: boolean,
  coverX?: number
): CoverLevel {
  const normalizedCoverX = Math.min(2, Math.max(0, Math.floor(coverX ?? 0)));
  const coverValue =
    coverToValue(cover) + (suppressed ? 1 : 0) + normalizedCoverX;
  let improved = valueToCover(Math.min(2, coverValue));
  const steps = Math.max(0, Math.floor(sharpshooterX));
  for (let index = 0; index < steps && improved !== 'none'; index++) {
    improved = improved === 'heavy' ? 'light' : 'none';
  }
  return improved;
}

/** Apply cover: roll hits with given defense die color (default white); light = blocks cancel hits, heavy = blocks+surges cancel hits; crits unchanged. Sharpshooter X reduces effective cover before rolling. */
export function applyCover(
  hits: number,
  crits: number,
  cover: CoverLevel,
  rng: () => number,
  sharpshooterX?: number,
  suppressed?: boolean,
  coverX?: number,
  coverDieColor?: DefenseDieColor
): { hits: number; crits: number } {
  const effective = getEffectiveCover(
    cover,
    sharpshooterX ?? 0,
    suppressed,
    coverX
  );
  if (effective === 'none' || hits <= 0) return { hits, crits };
  let blockCount = 0;
  let surgeCount = 0;
  for (let i = 0; i < hits; i++) {
    const face = rollOneDefenseDieOutcome(coverDieColor ?? 'white', rng);
    if (face === 'block') blockCount++;
    else if (face === 'surge') surgeCount++;
  }
  const hitsCancelled =
    effective === 'light'
      ? blockCount
      : Math.min(hits, blockCount + surgeCount);
  return { hits: Math.max(0, hits - hitsCancelled), crits };
}

/** Resolve (crit, surge, hit, blank) with Critical X then Surge Conversion (and Surge Tokens when surge is none) → (hits, crits). */
export function resolveStep(
  raw: RawAttackCounts,
  criticalX: number | undefined,
  surge: SurgeConversion,
  surgeTokens: number | undefined
): { hits: number; crits: number } {
  const normalizedCriticalX = normalizeCriticalX(criticalX);
  const normalizedSurgeTokens = normalizeSurgeTokens(surgeTokens);
  const surgesToCrit = Math.min(normalizedCriticalX, raw.surge);
  const surgesRemaining = raw.surge - surgesToCrit;
  let resolvedCrits = raw.crit + surgesToCrit;
  let resolvedHits = raw.hit;
  if (surge === 'crit') {
    resolvedCrits += surgesRemaining;
  } else if (surge === 'hit') {
    resolvedHits += surgesRemaining;
  } else {
    resolvedHits += Math.min(normalizedSurgeTokens, surgesRemaining);
  }
  return { hits: resolvedHits, crits: resolvedCrits };
}

function normalizeTokenCount(value: number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
}

/**
 * Reroll rounds: each Aim token = one round in which you may reroll up to (2 + preciseX) dice
 * simultaneously; each Observe token = one round in which you may reroll 1 die.
 * In a round you cannot reroll the same die twice; a die can be rerolled again in a later round.
 */
export function getRerollRounds(
  aimTokens: number,
  observeTokens: number,
  preciseX: number
): number[] {
  const aim = normalizeTokenCount(aimTokens);
  const observe = normalizeTokenCount(observeTokens);
  const preciseXVal = aim > 0 ? Math.max(0, Math.floor(preciseX) || 0) : 0;
  const aimCapacity = 2 + preciseXVal;
  const rounds: number[] = [];
  for (let i = 0; i < aim; i++) rounds.push(aimCapacity);
  for (let i = 0; i < observe; i++) rounds.push(1);
  return rounds;
}

/** Reroll priority by color: red (most hit faces) first, then black, then white. */
const REROLL_PRIORITY: Record<DieColor, number> = {
  red: 0,
  black: 1,
  white: 2,
};

/**
 * Apply rerolls by rounds: each round you may reroll up to roundCapacity dice (simultaneously).
 * Blanks are chosen by color priority: red first, then black, then white.
 * A die can be rerolled again in a later round but at most once per round.
 * Mutates outcomes in place.
 */
export function applyRerollsByRounds(
  outcomes: DieOutcome[],
  roundCapacities: number[],
  rng: () => number
): void {
  for (const roundCapacity of roundCapacities) {
    if (roundCapacity <= 0) continue;
    const blankIndices: number[] = [];
    for (let index = 0; index < outcomes.length; index++) {
      if (outcomes[index].face === 'blank') blankIndices.push(index);
    }
    if (blankIndices.length === 0) continue;
    blankIndices.sort(
      (indexA, indexB) =>
        REROLL_PRIORITY[outcomes[indexA]!.color] -
        REROLL_PRIORITY[outcomes[indexB]!.color]
    );
    const numToReroll = Math.min(roundCapacity, blankIndices.length);
    for (let i = 0; i < numToReroll; i++) {
      const chosenIndex = blankIndices[i] as number;
      const chosen = outcomes[chosenIndex];
      if (chosen === undefined) continue;
      chosen.face = rollOneAttackDie(chosen.color, rng);
    }
  }
}

/** Apply rerolls (by-round rules): used when callers have raw counts + pool. */
export function applyRerolls(
  rawCounts: RawAttackCounts,
  resolveResult: { hits: number; crits: number },
  pool: AttackPool,
  surge: SurgeConversion,
  aimTokens: number,
  observeTokens: number,
  preciseX: number,
  rng: () => number
): { hits: number; crits: number } {
  const roundCapacities = getRerollRounds(aimTokens, observeTokens, preciseX);
  const totalDice = pool.red + pool.black + pool.white;
  if (totalDice === 0 || roundCapacities.length === 0)
    return { ...resolveResult };
  const colors: DieColor[] = ['red', 'black', 'white'];
  const outcomes: DieOutcome[] = [];
  let critIndex = 0;
  let surgeIndex = 0;
  let hitIndex = 0;
  for (const color of colors) {
    const count = pool[color];
    for (let i = 0; i < count; i++) {
      const which =
        critIndex < rawCounts.crit
          ? 'crit'
          : surgeIndex < rawCounts.surge
            ? 'surge'
            : hitIndex < rawCounts.hit
              ? 'hit'
              : 'blank';
      if (which === 'crit') critIndex++;
      else if (which === 'surge') surgeIndex++;
      else if (which === 'hit') hitIndex++;
      outcomes.push({ color, face: which as AttackFace });
    }
  }
  applyRerollsByRounds(outcomes, roundCapacities, rng);
  const after = aggregateToRawCounts(outcomes);
  return resolveStep(after, undefined, surge, undefined);
}

/** Apply Ram X: convert up to X blanks to crits, then up to remaining X hits to crits. */
export function applyRam(
  hits: number,
  crits: number,
  blanksAfterReroll: number,
  ram: number
): { hits: number; crits: number } {
  const normalizedRam = normalizeTokenCount(ram);
  if (normalizedRam <= 0) return { hits, crits };
  const blanksConverted = Math.min(normalizedRam, blanksAfterReroll);
  let resolvedCrits = crits + blanksConverted;
  let resolvedHits = hits;
  const ramLeft = normalizedRam - blanksConverted;
  const hitsConverted = Math.min(ramLeft, resolvedHits);
  resolvedCrits += hitsConverted;
  resolvedHits -= hitsConverted;
  return { hits: resolvedHits, crits: resolvedCrits };
}

/** Run N attack simulations and aggregate to AttackResults. */
export function simulateAttackPool(
  pool: AttackPool,
  surge: SurgeConversion,
  criticalX: CriticalX,
  surgeTokens: number,
  aimTokens: number,
  observeTokens: number,
  preciseX: number,
  ram: number,
  runs: number,
  rng: () => number
): AttackResults {
  let sumHits = 0;
  let sumCrits = 0;
  const totalHistogram: Record<number, number> = {};
  const hitsCritsHistogram = new Map<string, number>();

  const roundCapacities = getRerollRounds(aimTokens, observeTokens, preciseX);

  for (let run = 0; run < runs; run++) {
    const outcomes = rollAttackPoolDetailed(pool, rng);
    applyRerollsByRounds(outcomes, roundCapacities, rng);
    const raw = aggregateToRawCounts(outcomes);
    const resolved = resolveStep(raw, criticalX, surge, surgeTokens);
    const blanksAfterReroll = raw.blank;
    const final = applyRam(
      resolved.hits,
      resolved.crits,
      blanksAfterReroll,
      ram
    );

    sumHits += final.hits;
    sumCrits += final.crits;
    const total = final.hits + final.crits;
    totalHistogram[total] = (totalHistogram[total] ?? 0) + 1;
    const key = `${final.hits},${final.crits}`;
    hitsCritsHistogram.set(key, (hitsCritsHistogram.get(key) ?? 0) + 1);
  }

  const expectedHits = sumHits / runs;
  const expectedCrits = sumCrits / runs;
  const expectedTotal = expectedHits + expectedCrits;

  const maxTotal = Math.max(...Object.keys(totalHistogram).map(Number), 0);
  const distribution = Array.from({ length: maxTotal + 1 }, (_, total) => ({
    total,
    probability: (totalHistogram[total] ?? 0) / runs,
  }));

  const distributionByHitsCrits = Array.from(hitsCritsHistogram.entries()).map(
    ([hitsCritsKey, count]) => {
      const [hits, crits] = hitsCritsKey.split(',').map(Number);
      return { hits, crits, probability: count / runs };
    }
  );

  let cumSum = 1;
  const cumulative = Array.from({ length: maxTotal + 1 }, (_, total) => {
    const entry = { total, probability: cumSum };
    cumSum -= (totalHistogram[total] ?? 0) / runs;
    return entry;
  });

  return {
    expectedHits,
    expectedCrits,
    expectedTotal,
    distribution,
    distributionByHitsCrits,
    cumulative,
  };
}

/** Roll one defense die; returns 1 for block, 0 for blank. */
export function rollOneDefenseDie(
  color: DefenseDieColor,
  surge: DefenseSurgeConversion,
  rng: () => number
): number {
  const die = DEFENSE_DICE[color];
  const blockFaces = surge === 'block' ? die.block + die.surge : die.block;
  return rng() * DEFENSE_SIDES < blockFaces ? 1 : 0;
}

/** Simulate N defense rolls for a pool; return DefenseResults. */
export function simulateDefensePool(
  pool: DefensePool,
  surge: DefenseSurgeConversion,
  defenseSurgeTokens: number | undefined,
  runs: number,
  rng: () => number,
  uncannyLuckX: number = 0
): DefenseResults {
  const normalizedDefenseSurgeTokens =
    normalizeDefenseSurgeTokens(defenseSurgeTokens);
  const normalizedUncannyLuckX = Math.max(0, Math.floor(uncannyLuckX));
  const histogram: Record<number, number> = {};
  let sumBlocks = 0;
  for (let run = 0; run < runs; run++) {
    const outcomes: DefenseDieOutcome[] = [];
    const colors: DefenseDieColor[] = ['red', 'white'];
    for (const color of colors) {
      const count = pool[color];
      for (let dieIndex = 0; dieIndex < count; dieIndex++) {
        outcomes.push({
          color,
          face: rollOneDefenseDieOutcome(color, rng),
        });
      }
    }
    applyUncannyLuckRerollsToOutcomes(
      outcomes,
      normalizedUncannyLuckX,
      surge,
      normalizedDefenseSurgeTokens,
      rng
    );
    let blockCount = 0;
    let surgeCount = 0;
    for (const outcome of outcomes) {
      if (outcome.face === 'block') blockCount++;
      else if (outcome.face === 'surge') surgeCount++;
    }
    const blocks = resolveDefenseRoll(
      blockCount,
      surgeCount,
      surge,
      normalizedDefenseSurgeTokens
    );
    sumBlocks += blocks;
    histogram[blocks] = (histogram[blocks] ?? 0) + 1;
  }
  const expectedBlocks = sumBlocks / runs;
  const maxTotal = Math.max(...Object.keys(histogram).map(Number), 0);
  const distribution = Array.from({ length: maxTotal + 1 }, (_, total) => ({
    total,
    probability: (histogram[total] ?? 0) / runs,
  }));
  let cumSum = 1;
  const cumulative = Array.from({ length: maxTotal + 1 }, (_, total) => {
    const entry = { total, probability: cumSum };
    cumSum -= (histogram[total] ?? 0) / runs;
    return entry;
  });
  return { expectedBlocks, distribution, cumulative };
}

/** Defense distribution for N dice of one color. */
export function getDefenseDistributionForDiceCountSim(
  diceCount: number,
  color: DefenseDieColor,
  surge: DefenseSurgeConversion,
  defenseSurgeTokens: number | undefined,
  runs: number,
  rng: () => number,
  uncannyLuckX: number = 0
): DefenseResults {
  const pool: DefensePool =
    color === 'red'
      ? { red: diceCount, white: 0 }
      : { red: 0, white: diceCount };
  return simulateDefensePool(
    pool,
    surge,
    defenseSurgeTokens,
    runs,
    rng,
    uncannyLuckX
  );
}

/** Run N full (attack + defense) simulations and aggregate to WoundsResults. */
export function simulateWounds(
  pool: AttackPool,
  surge: SurgeConversion,
  criticalX: CriticalX,
  surgeTokens: number,
  aimTokens: number,
  observeTokens: number,
  preciseX: number,
  ram: number,
  defenseDieColor: DefenseDieColor,
  defenseSurge: DefenseSurgeConversion,
  dodgeTokens: number,
  shieldTokens: number,
  outmaneuver: boolean,
  defenseSurgeTokens: number | undefined,
  cover: CoverLevel,
  lowProfile: boolean,
  suppressed: boolean = false,
  coverX: number = 0,
  coverDieColor: DefenseDieColor = 'white',
  sharpshooterX: number = 0,
  backup: boolean = false,
  armorX: number = 0,
  impactX: number = 0,
  pierceX: number = 0,
  impervious: boolean = false,
  suppressionTokens: number = 0,
  dangerSenseX: number = 0,
  uncannyLuckX: number = 0,
  downgradeDefenseX: number = 0,
  runs: number,
  rng: () => number
): WoundsResults {
  const normalizedDodge = Math.max(0, Math.floor(dodgeTokens));
  const normalizedShields = Math.max(0, Math.floor(shieldTokens));
  const normalizedDefenseSurgeTokens =
    normalizeDefenseSurgeTokens(defenseSurgeTokens);
  const normalizedPierceX = Math.max(0, Math.floor(pierceX));
  const normalizedCoverX = Math.min(2, Math.max(0, Math.floor(coverX)));
  const normalizedUncannyLuckX = Math.max(0, Math.floor(uncannyLuckX));
  const normalizedDowngradeDefenseX = Math.max(
    0,
    Math.floor(downgradeDefenseX)
  );
  const roundCapacities = getRerollRounds(aimTokens, observeTokens, preciseX);

  const woundsHistogram: Record<number, number> = {};
  let sumWounds = 0;

  for (let run = 0; run < runs; run++) {
    const outcomes = rollAttackPoolDetailed(pool, rng);
    applyRerollsByRounds(outcomes, roundCapacities, rng);
    const raw = aggregateToRawCounts(outcomes);
    const resolved = resolveStep(raw, criticalX, surge, surgeTokens);
    const blanksAfterReroll = raw.blank;
    const final = applyRam(
      resolved.hits,
      resolved.crits,
      blanksAfterReroll,
      ram
    );
    const hitsForCover =
      cover !== 'none' && lowProfile ? Math.max(0, final.hits - 1) : final.hits;
    const afterCover = applyCover(
      hitsForCover,
      final.crits,
      cover,
      rng,
      sharpshooterX,
      suppressed,
      normalizedCoverX,
      coverDieColor
    );
    const normalizedArmorX = Math.max(0, Math.floor(armorX));
    const normalizedImpactX = Math.max(0, Math.floor(impactX));
    const { hitsAfterArmor, critsAfterImpact } = resolveImpactThenArmor(
      afterCover.hits,
      afterCover.crits,
      normalizedArmorX,
      normalizedImpactX
    );
    const hitsAfterBackup = backup
      ? Math.max(0, hitsAfterArmor - 2)
      : hitsAfterArmor;
    const critsAfterShields = Math.max(0, critsAfterImpact - normalizedShields);
    const hitsAfterShields = Math.max(
      0,
      hitsAfterBackup - Math.max(0, normalizedShields - critsAfterImpact)
    );
    const defenseDice = outmaneuver
      ? Math.max(0, hitsAfterShields + critsAfterShields - normalizedDodge)
      : critsAfterShields + Math.max(0, hitsAfterShields - normalizedDodge);
    const normalizedSuppressionTokens = Math.max(
      0,
      Math.floor(suppressionTokens)
    );
    const normalizedDangerSenseX = Math.max(0, Math.floor(dangerSenseX));
    const dangerSenseExtra = Math.min(
      normalizedSuppressionTokens,
      normalizedDangerSenseX
    );
    const totalDefenseDice = defenseDice + dangerSenseExtra;
    const splitPool = splitDowngradedDefensePool(
      defenseDieColor,
      totalDefenseDice,
      normalizedDowngradeDefenseX
    );
    const defenseOutcomes = rollDefensePoolDetailed(splitPool, rng);
    applyUncannyLuckRerollsToOutcomes(
      defenseOutcomes,
      normalizedUncannyLuckX,
      defenseSurge,
      normalizedDefenseSurgeTokens,
      rng
    );
    let blockCount = 0;
    let surgeCount = 0;
    for (const outcome of defenseOutcomes) {
      if (outcome.face === 'block') blockCount++;
      else if (outcome.face === 'surge') surgeCount++;
    }
    const blocks = resolveDefenseRoll(
      blockCount,
      surgeCount,
      defenseSurge,
      normalizedDefenseSurgeTokens
    );
    const effectiveBlocks = effectiveBlocksAfterPierce(
      blocks,
      normalizedPierceX,
      impervious
    );
    const wounds = Math.max(0, defenseDice - effectiveBlocks);
    sumWounds += wounds;
    woundsHistogram[wounds] = (woundsHistogram[wounds] ?? 0) + 1;
  }

  const expectedWounds = sumWounds / runs;
  const maxWounds = Math.max(...Object.keys(woundsHistogram).map(Number), 0);
  const distribution = Array.from({ length: maxWounds + 1 }, (_, total) => ({
    total,
    probability: (woundsHistogram[total] ?? 0) / runs,
  }));
  let cumSum = 1;
  const cumulative = Array.from({ length: maxWounds + 1 }, (_, total) => {
    const entry = { total, probability: cumSum };
    cumSum -= (woundsHistogram[total] ?? 0) / runs;
    return entry;
  });
  return { expectedWounds, distribution, cumulative };
}

/** Run N wounds simulations by sampling (hits, crits) from attack results then rolling defense. */
export function simulateWoundsFromAttackResults(
  attackResults: AttackResults,
  defenseDieColor: DefenseDieColor,
  defenseSurge: DefenseSurgeConversion,
  dodgeTokens: number,
  shieldTokens: number,
  outmaneuver: boolean,
  defenseSurgeTokens: number | undefined,
  cover: CoverLevel,
  lowProfile: boolean,
  suppressed: boolean = false,
  coverX: number = 0,
  coverDieColor: DefenseDieColor = 'white',
  sharpshooterX: number = 0,
  backup: boolean = false,
  armorX: number = 0,
  impactX: number = 0,
  pierceX: number = 0,
  impervious: boolean = false,
  suppressionTokens: number = 0,
  dangerSenseX: number = 0,
  uncannyLuckX: number = 0,
  downgradeDefenseX: number = 0,
  runs: number,
  rng: () => number
): WoundsResults {
  const normalizedDodge = Math.max(0, Math.floor(dodgeTokens));
  const normalizedShields = Math.max(0, Math.floor(shieldTokens));
  const normalizedDefenseSurgeTokens =
    normalizeDefenseSurgeTokens(defenseSurgeTokens);
  const normalizedPierceX = Math.max(0, Math.floor(pierceX));
  const normalizedCoverX = Math.min(2, Math.max(0, Math.floor(coverX)));
  const normalizedUncannyLuckX = Math.max(0, Math.floor(uncannyLuckX));
  const normalizedDowngradeDefenseX = Math.max(
    0,
    Math.floor(downgradeDefenseX)
  );
  const normalizedSuppressionTokens = Math.max(
    0,
    Math.floor(suppressionTokens)
  );
  const normalizedDangerSenseX = Math.max(0, Math.floor(dangerSenseX));
  const dangerSenseExtra = Math.min(
    normalizedSuppressionTokens,
    normalizedDangerSenseX
  );
  const outcomes = attackResults.distributionByHitsCrits.filter(
    (entry) => entry.probability > 0
  );
  if (outcomes.length === 0) {
    return {
      expectedWounds: 0,
      distribution: [{ total: 0, probability: 1 }],
      cumulative: [{ total: 0, probability: 1 }],
    };
  }
  const woundsHistogram: Record<number, number> = {};
  let sumWounds = 0;
  for (let run = 0; run < runs; run++) {
    const roll = rng();
    let acc = 0;
    let hits = 0;
    let crits = 0;
    for (const entry of outcomes) {
      acc += entry.probability;
      if (roll < acc) {
        hits = entry.hits;
        crits = entry.crits;
        break;
      }
    }
    const hitsForCover =
      cover !== 'none' && lowProfile ? Math.max(0, hits - 1) : hits;
    const afterCover = applyCover(
      hitsForCover,
      crits,
      cover,
      rng,
      sharpshooterX,
      suppressed,
      normalizedCoverX,
      coverDieColor
    );
    const normalizedArmorX = Math.max(0, Math.floor(armorX));
    const normalizedImpactX = Math.max(0, Math.floor(impactX));
    const { hitsAfterArmor, critsAfterImpact } = resolveImpactThenArmor(
      afterCover.hits,
      afterCover.crits,
      normalizedArmorX,
      normalizedImpactX
    );
    const hitsAfterBackup = backup
      ? Math.max(0, hitsAfterArmor - 2)
      : hitsAfterArmor;
    const critsAfterShields = Math.max(0, critsAfterImpact - normalizedShields);
    const hitsAfterShields = Math.max(
      0,
      hitsAfterBackup - Math.max(0, normalizedShields - critsAfterImpact)
    );
    const defenseDice = outmaneuver
      ? Math.max(0, hitsAfterShields + critsAfterShields - normalizedDodge)
      : critsAfterShields + Math.max(0, hitsAfterShields - normalizedDodge);
    const totalDefenseDice = defenseDice + dangerSenseExtra;
    const splitPool = splitDowngradedDefensePool(
      defenseDieColor,
      totalDefenseDice,
      normalizedDowngradeDefenseX
    );
    const defenseOutcomes = rollDefensePoolDetailed(splitPool, rng);
    applyUncannyLuckRerollsToOutcomes(
      defenseOutcomes,
      normalizedUncannyLuckX,
      defenseSurge,
      normalizedDefenseSurgeTokens,
      rng
    );
    let blockCount = 0;
    let surgeCount = 0;
    for (const outcome of defenseOutcomes) {
      if (outcome.face === 'block') blockCount++;
      else if (outcome.face === 'surge') surgeCount++;
    }
    const blocks = resolveDefenseRoll(
      blockCount,
      surgeCount,
      defenseSurge,
      normalizedDefenseSurgeTokens
    );
    const effectiveBlocks = effectiveBlocksAfterPierce(
      blocks,
      normalizedPierceX,
      impervious
    );
    const wounds = Math.max(0, defenseDice - effectiveBlocks);
    sumWounds += wounds;
    woundsHistogram[wounds] = (woundsHistogram[wounds] ?? 0) + 1;
  }
  const expectedWounds = sumWounds / runs;
  const maxWounds = Math.max(...Object.keys(woundsHistogram).map(Number), 0);
  const distribution = Array.from({ length: maxWounds + 1 }, (_, total) => ({
    total,
    probability: (woundsHistogram[total] ?? 0) / runs,
  }));
  let cumSum = 1;
  const cumulative = Array.from({ length: maxWounds + 1 }, (_, total) => {
    const entry = { total, probability: cumSum };
    cumSum -= (woundsHistogram[total] ?? 0) / runs;
    return entry;
  });
  return { expectedWounds, distribution, cumulative };
}
