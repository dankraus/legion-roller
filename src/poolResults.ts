import type { PoolConfig, AttackResults, WoundsResults } from './types';
import { calculateAttackPool, calculateWounds } from './engine/probability';

export const DEFAULT_POOL_CONFIG: PoolConfig = {
  pool: { red: 0, black: 0, white: 0 },
  surge: 'none',
  criticalX: '',
  surgeTokens: '',
  aimTokens: '',
  observeTokens: '',
  preciseX: '',
  ramX: '',
  sharpshooterX: '',
  pierceX: '',
  impactX: '',
  downgradeDefenseX: '',
  pointCost: '',
  defenseDieColor: 'red',
  defenseSurge: 'none',
  defenseSurgeTokens: '',
  dodgeTokens: '',
  shieldTokens: '',
  outmaneuver: false,
  cover: 'none',
  dugIn: false,
  lowProfile: false,
  suppressed: false,
  coverX: '',
  armorX: '',
  impervious: false,
  suppressionTokens: '',
  dangerSenseX: '',
  uncannyLuckX: '',
  backup: false,
};

function toCount(value: string): number {
  if (value === '') return 0;
  return Math.max(0, Math.floor(Number(value)) || 0);
}

function toCoverX(value: string): number {
  return Math.min(2, toCount(value));
}

export interface PoolResults {
  results: AttackResults;
  woundsResults: WoundsResults;
}

export function computePoolResults(config: PoolConfig): PoolResults {
  const criticalX =
    config.criticalX === '' ? undefined : toCount(config.criticalX);

  const results = calculateAttackPool(
    config.pool,
    config.surge,
    criticalX,
    toCount(config.surgeTokens),
    toCount(config.aimTokens),
    toCount(config.observeTokens),
    toCount(config.preciseX),
    toCount(config.ramX)
  );

  const woundsResults = calculateWounds(
    results,
    config.defenseDieColor,
    config.defenseSurge,
    toCount(config.dodgeTokens),
    toCount(config.shieldTokens),
    config.outmaneuver,
    toCount(config.defenseSurgeTokens),
    config.cover,
    config.lowProfile,
    config.suppressed,
    toCoverX(config.coverX),
    config.dugIn,
    toCount(config.sharpshooterX),
    config.backup,
    toCount(config.armorX),
    toCount(config.impactX),
    toCount(config.pierceX),
    config.impervious,
    toCount(config.suppressionTokens),
    toCount(config.dangerSenseX),
    toCount(config.uncannyLuckX),
    toCount(config.downgradeDefenseX)
  );

  return { results, woundsResults };
}
