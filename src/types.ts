export type DieColor = 'red' | 'black' | 'white';

export type SurgeConversion = 'none' | 'hit' | 'crit';

export interface DieFaces {
  crit: number;
  surge: number;
  hit: number;
  blank: number;
}

export interface AttackPool {
  red: number;
  black: number;
  white: number;
}

export interface AttackResults {
  expectedHits: number;
  expectedCrits: number;
  expectedTotal: number;
  distribution: { total: number; probability: number }[];
  distributionByHitsCrits: {
    hits: number;
    crits: number;
    probability: number;
  }[];
  cumulative: { total: number; probability: number }[];
}

/** Optional keyword: Critical X converts up to X surges to crits before Surge Conversion. */
export type CriticalX = number | undefined;

export type DefenseDieColor = 'red' | 'white';

export type DefenseSurgeConversion = 'none' | 'block';

/** Cover rolls white defense dice before main defense unless Dug In is on (then red); only hits can be cancelled (crits bypass). */
export type CoverLevel = 'none' | 'light' | 'heavy';

export interface DefensePool {
  red: number;
  white: number;
}

export interface DefenseResults {
  expectedBlocks: number;
  distribution: { total: number; probability: number }[];
  cumulative: { total: number; probability: number }[];
}

export interface WoundsResults {
  expectedWounds: number;
  distribution: { total: number; probability: number }[];
  cumulative: { total: number; probability: number }[];
}

/**
 * All inputs that define one attack+defense configuration.
 * Numeric keyword/token fields are kept as the raw string the inputs use
 * ('' means zero/unset); computePoolResults parses them.
 */
export interface PoolConfig {
  pool: AttackPool;
  surge: SurgeConversion;
  criticalX: string;
  surgeTokens: string;
  aimTokens: string;
  observeTokens: string;
  preciseX: string;
  ramX: string;
  sharpshooterX: string;
  pierceX: string;
  impactX: string;
  downgradeDefenseX: string;
  pointCost: string;
  defenseDieColor: DefenseDieColor;
  defenseSurge: DefenseSurgeConversion;
  defenseSurgeTokens: string;
  dodgeTokens: string;
  shieldTokens: string;
  outmaneuver: boolean;
  cover: CoverLevel;
  dugIn: boolean;
  lowProfile: boolean;
  suppressed: boolean;
  coverX: string;
  armorX: string;
  impervious: boolean;
  suppressionTokens: string;
  dangerSenseX: string;
  uncannyLuckX: string;
  backup: boolean;
}
