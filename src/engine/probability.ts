import type {
  DieColor,
  SurgeConversion,
  AttackPool,
  AttackResults,
  CriticalX,
  DefenseDieColor,
  DefenseSurgeConversion,
  DefensePool,
  DefenseResults,
  WoundsResults,
  CoverLevel,
} from '../types';

export {
  DICE,
  DEFENSE_DICE,
  SIDES,
  DEFENSE_SIDES,
  type DefenseDieFaces,
} from './dice-data';

import { DICE, DEFENSE_DICE, SIDES, DEFENSE_SIDES } from './dice-data';
import { createSeededRng, DEFAULT_RUNS } from './rng';
import {
  simulateAttackPool,
  simulateWoundsFromAttackResults,
  getDefenseDistributionForDiceCountSim,
  simulateDefensePool,
} from './simulate';

export interface EffectiveProbabilities {
  crit: number;
  hit: number;
  blank: number;
}

/** Effective per-die probabilities with surge folded in (used for tests). */
export function getEffectiveProbabilities(
  color: DieColor,
  surge: SurgeConversion
): EffectiveProbabilities {
  const die = DICE[color];
  let crit = die.crit;
  let hit = die.hit;
  let blank = die.blank;

  if (surge === 'crit') {
    crit += die.surge;
  } else if (surge === 'hit') {
    hit += die.surge;
  } else {
    blank += die.surge;
  }

  return {
    crit: crit / SIDES,
    hit: hit / SIDES,
    blank: blank / SIDES,
  };
}

/** Effective per-die probabilities with defense surge folded in. */
export function getDefenseEffectiveProbabilities(
  color: DefenseDieColor,
  surge: DefenseSurgeConversion
): { block: number; blank: number } {
  const die = DEFENSE_DICE[color];
  let block = die.block;
  let blank = die.blank;
  if (surge === 'block') {
    block += die.surge;
  } else {
    blank += die.surge;
  }
  return {
    block: block / DEFENSE_SIDES,
    blank: blank / DEFENSE_SIDES,
  };
}

const SEED = 0;

export function calculateAttackPool(
  pool: AttackPool,
  surge: SurgeConversion,
  criticalX?: CriticalX,
  surgeTokens?: number,
  aimTokens?: number,
  observeTokens?: number,
  preciseX?: number,
  ramX?: number
): AttackResults {
  const rng = createSeededRng(SEED);
  return simulateAttackPool(
    pool,
    surge,
    criticalX,
    surgeTokens ?? 0,
    aimTokens ?? 0,
    observeTokens ?? 0,
    preciseX ?? 0,
    ramX ?? 0,
    DEFAULT_RUNS,
    rng
  );
}

export function getDefenseDistributionForDiceCount(
  diceCount: number,
  color: DefenseDieColor,
  surge: DefenseSurgeConversion,
  defenseSurgeTokens?: number,
  uncannyLuckX?: number
): DefenseResults {
  const rng = createSeededRng(SEED);
  const normalizedUncannyLuckX = Math.max(0, Math.floor(uncannyLuckX ?? 0));
  return getDefenseDistributionForDiceCountSim(
    diceCount,
    color,
    surge,
    defenseSurgeTokens,
    DEFAULT_RUNS,
    rng,
    normalizedUncannyLuckX
  );
}

export function calculateDefensePool(
  pool: DefensePool,
  surge: DefenseSurgeConversion,
  defenseSurgeTokens?: number,
  uncannyLuckX?: number
): DefenseResults {
  const rng = createSeededRng(SEED);
  const normalizedUncannyLuckX = Math.max(0, Math.floor(uncannyLuckX ?? 0));
  return simulateDefensePool(
    pool,
    surge,
    defenseSurgeTokens,
    DEFAULT_RUNS,
    rng,
    normalizedUncannyLuckX
  );
}

export function calculateWounds(
  attackResults: AttackResults,
  defenseDieColor: DefenseDieColor,
  defenseSurge: DefenseSurgeConversion,
  dodgeTokens?: number,
  shieldTokens?: number,
  outmaneuver?: boolean,
  defenseSurgeTokens?: number,
  cover?: CoverLevel,
  lowProfile?: boolean,
  suppressed?: boolean,
  coverX?: number,
  coverDieColor?: DefenseDieColor,
  sharpshooterX?: number,
  backup?: boolean,
  armorX?: number,
  impactX?: number,
  pierceX?: number,
  impervious?: boolean,
  suppressionTokens?: number,
  dangerSenseX?: number,
  uncannyLuckX?: number,
  downgradeDefenseX?: number,
  upgradeDefenseX?: number
): WoundsResults {
  const normalizedCoverX = Math.min(2, Math.max(0, Math.floor(coverX ?? 0)));
  const normalizedArmorX = Math.max(0, Math.floor(armorX ?? 0));
  const normalizedImpactX = Math.max(0, Math.floor(impactX ?? 0));
  const normalizedSuppressionTokens = Math.max(
    0,
    Math.floor(suppressionTokens ?? 0)
  );
  const normalizedDangerSenseX = Math.max(0, Math.floor(dangerSenseX ?? 0));
  const normalizedUncannyLuckX = Math.max(0, Math.floor(uncannyLuckX ?? 0));
  const normalizedDowngradeDefenseX = Math.max(
    0,
    Math.floor(downgradeDefenseX ?? 0)
  );
  const normalizedUpgradeDefenseX = Math.max(
    0,
    Math.floor(upgradeDefenseX ?? 0)
  );
  const rng = createSeededRng(SEED);
  return simulateWoundsFromAttackResults(
    attackResults,
    defenseDieColor,
    defenseSurge,
    dodgeTokens ?? 0,
    shieldTokens ?? 0,
    outmaneuver ?? false,
    defenseSurgeTokens ?? 0,
    cover ?? 'none',
    lowProfile ?? false,
    suppressed ?? false,
    normalizedCoverX,
    coverDieColor ?? 'white',
    sharpshooterX ?? 0,
    backup ?? false,
    normalizedArmorX,
    normalizedImpactX,
    pierceX ?? 0,
    impervious ?? false,
    normalizedSuppressionTokens,
    normalizedDangerSenseX,
    normalizedUncannyLuckX,
    normalizedDowngradeDefenseX,
    normalizedUpgradeDefenseX,
    DEFAULT_RUNS,
    rng
  );
}
