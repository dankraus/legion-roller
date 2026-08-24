import type {
  PoolConfig,
  AttackPool,
  SurgeConversion,
  DefenseDieColor,
  DefenseSurgeConversion,
  CoverLevel,
} from './types';
import type { UrlPoolState } from './urlState';

export type PoolEditorInputs = PoolConfig;

export type PoolEditorSetters = {
  setPool: (value: AttackPool) => void;
  setSurge: (value: SurgeConversion) => void;
  setCriticalX: (value: string) => void;
  setSurgeTokens: (value: string) => void;
  setAimTokens: (value: string) => void;
  setObserveTokens: (value: string) => void;
  setPreciseX: (value: string) => void;
  setRamX: (value: string) => void;
  setSharpshooterX: (value: string) => void;
  setPierceX: (value: string) => void;
  setImpactX: (value: string) => void;
  setDowngradeDefenseX: (value: string) => void;
  setPointCost: (value: string) => void;
  setDefenseDieColor: (value: DefenseDieColor) => void;
  setDefenseSurge: (value: DefenseSurgeConversion) => void;
  setDefenseSurgeTokens: (value: string) => void;
  setDodgeTokens: (value: string) => void;
  setShieldTokens: (value: string) => void;
  setOutmaneuver: (value: boolean) => void;
  setCover: (value: CoverLevel) => void;
  setCoverDieColor: (value: DefenseDieColor) => void;
  setLowProfile: (value: boolean) => void;
  setSuppressed: (value: boolean) => void;
  setCoverX: (value: string) => void;
  setArmorX: (value: string) => void;
  setImpervious: (value: boolean) => void;
  setSuppressionTokens: (value: string) => void;
  setDangerSenseX: (value: string) => void;
  setUncannyLuckX: (value: string) => void;
  setUpgradeDefenseX: (value: string) => void;
  setBackup: (value: boolean) => void;
};

export function readConfigFromEditor(inputs: PoolEditorInputs): PoolConfig {
  return { ...inputs };
}

export function applyConfigToEditor(
  config: PoolConfig,
  setters: PoolEditorSetters
): void {
  setters.setPool(config.pool);
  setters.setSurge(config.surge);
  setters.setCriticalX(config.criticalX);
  setters.setSurgeTokens(config.surgeTokens);
  setters.setAimTokens(config.aimTokens);
  setters.setObserveTokens(config.observeTokens);
  setters.setPreciseX(config.preciseX);
  setters.setRamX(config.ramX);
  setters.setSharpshooterX(config.sharpshooterX);
  setters.setPierceX(config.pierceX);
  setters.setImpactX(config.impactX);
  setters.setDowngradeDefenseX(config.downgradeDefenseX);
  setters.setPointCost(config.pointCost);
  setters.setDefenseDieColor(config.defenseDieColor);
  setters.setDefenseSurge(config.defenseSurge);
  setters.setDefenseSurgeTokens(config.defenseSurgeTokens);
  setters.setDodgeTokens(config.dodgeTokens);
  setters.setShieldTokens(config.shieldTokens);
  setters.setOutmaneuver(config.outmaneuver);
  setters.setCover(config.cover);
  setters.setCoverDieColor(config.coverDieColor);
  setters.setLowProfile(config.lowProfile);
  setters.setSuppressed(config.suppressed);
  setters.setCoverX(config.coverX);
  setters.setArmorX(config.armorX);
  setters.setImpervious(config.impervious);
  setters.setSuppressionTokens(config.suppressionTokens);
  setters.setDangerSenseX(config.dangerSenseX);
  setters.setUncannyLuckX(config.uncannyLuckX);
  setters.setUpgradeDefenseX(config.upgradeDefenseX);
  setters.setBackup(config.backup);
}

function toCount(value: string): number {
  if (value === '') return 0;
  return Math.max(0, Math.floor(Number(value)) || 0);
}

export function configToUrlPoolState(config: PoolConfig): UrlPoolState {
  return {
    r: config.pool.red,
    b: config.pool.black,
    w: config.pool.white,
    surge: config.surge,
    crit: toCount(config.criticalX),
    sTok: toCount(config.surgeTokens),
    aim: toCount(config.aimTokens),
    obs: toCount(config.observeTokens),
    precise: toCount(config.preciseX),
    ram: toCount(config.ramX),
    sharp: toCount(config.sharpshooterX),
    pierce: toCount(config.pierceX),
    impact: toCount(config.impactX),
    downDef: toCount(config.downgradeDefenseX),
    upDef: toCount(config.upgradeDefenseX),
    cost: config.pointCost,
    dColor: config.defenseDieColor,
    dSurge: config.defenseSurge,
    dSurgeTok: toCount(config.defenseSurgeTokens),
    dodge: toCount(config.dodgeTokens),
    shield: toCount(config.shieldTokens),
    out: config.outmaneuver,
    cover: config.cover,
    cColor: config.coverDieColor,
    lowProf: config.lowProfile,
    sup: config.suppressed,
    coverX: Math.min(2, toCount(config.coverX)),
    armor: toCount(config.armorX),
    imp: config.impervious,
    suppTok: toCount(config.suppressionTokens),
    danger: toCount(config.dangerSenseX),
    uLuck: toCount(config.uncannyLuckX),
    backup: config.backup,
  };
}
