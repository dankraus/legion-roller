import type { PoolConfig } from '../types';

function countLabel(name: string, value: string): string | null {
  if (value === '') return null;
  const parsed = Math.max(0, Math.floor(Number(value)) || 0);
  return parsed > 0 ? `${name} ${parsed}` : null;
}

export function describeActiveModifiers(config: PoolConfig): string[] {
  const labels: (string | null)[] = [];

  if (config.surge === 'hit') labels.push('Surge→Hit');
  if (config.surge === 'crit') labels.push('Surge→Crit');

  labels.push(countLabel('Aim', config.aimTokens));
  labels.push(countLabel('Observe', config.observeTokens));
  labels.push(countLabel('Surge tokens', config.surgeTokens));
  labels.push(countLabel('Critical', config.criticalX));
  labels.push(countLabel('Precise', config.preciseX));
  labels.push(countLabel('Ram', config.ramX));
  labels.push(countLabel('Sharpshooter', config.sharpshooterX));
  labels.push(countLabel('Impact', config.impactX));
  labels.push(countLabel('Pierce', config.pierceX));
  labels.push(countLabel('Downgrade Defense Dice X', config.downgradeDefenseX));

  if (config.defenseSurge === 'block') labels.push('Def surge→Block');
  if (config.cover === 'light') labels.push('Cover Light');
  if (config.cover === 'heavy') labels.push('Cover Heavy');
  if (config.dugIn) labels.push('Dug In');
  if (config.lowProfile) labels.push('Low Profile');
  if (config.suppressed) labels.push('Suppressed');
  if (config.impervious) labels.push('Impervious');
  if (config.outmaneuver) labels.push('Outmaneuver');
  if (config.backup) labels.push('Backup');

  labels.push(countLabel('Cover+', config.coverX));
  labels.push(countLabel('Armor', config.armorX));
  labels.push(countLabel('Danger Sense', config.dangerSenseX));
  labels.push(countLabel('Uncanny Luck', config.uncannyLuckX));
  labels.push(countLabel('Dodge', config.dodgeTokens));
  labels.push(countLabel('Shield', config.shieldTokens));
  labels.push(countLabel('Def surge tokens', config.defenseSurgeTokens));
  labels.push(countLabel('Suppression', config.suppressionTokens));

  return labels.filter((label): label is string => label !== null);
}
