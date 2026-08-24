import type { PoolConfig, SurgeConversion, CoverLevel } from './types';
import { pointCostValue } from './share/pointCost';

export type PoolSnapshotLine = { label: string; value: string };
export type PoolSnapshotSection = {
  title: string;
  lines: PoolSnapshotLine[];
};

function countFromString(value: string): number {
  if (value === '') return 0;
  return Math.max(0, Math.floor(Number(value)) || 0);
}

export function formatAttackSurgeLabel(surge: SurgeConversion): string {
  if (surge === 'hit') return 'Hit';
  if (surge === 'crit') return 'Crit';
  return 'None';
}

function coverLabel(cover: CoverLevel): string {
  if (cover === 'light') return 'Light';
  if (cover === 'heavy') return 'Heavy';
  return 'None';
}

function addCountLine(lines: PoolSnapshotLine[], label: string, value: string) {
  const count = countFromString(value);
  if (count > 0) {
    lines.push({ label, value: String(count) });
  }
}

function addBooleanLine(
  lines: PoolSnapshotLine[],
  label: string,
  enabled: boolean
) {
  if (enabled) lines.push({ label, value: 'On' });
}

export function formatPoolSnapshot(config: PoolConfig): PoolSnapshotSection[] {
  const sections: PoolSnapshotSection[] = [];

  const tokenLines: PoolSnapshotLine[] = [];
  addCountLine(tokenLines, 'Surge tokens', config.surgeTokens);
  addCountLine(tokenLines, 'Aim', config.aimTokens);
  addCountLine(tokenLines, 'Observe', config.observeTokens);
  if (tokenLines.length > 0) {
    sections.push({ title: 'Tokens', lines: tokenLines });
  }

  const keywordLines: PoolSnapshotLine[] = [];
  addCountLine(keywordLines, 'Critical', config.criticalX);
  addCountLine(keywordLines, 'Precise', config.preciseX);
  addCountLine(keywordLines, 'Ram', config.ramX);
  addCountLine(keywordLines, 'Sharpshooter', config.sharpshooterX);
  addCountLine(keywordLines, 'Impact', config.impactX);
  addCountLine(keywordLines, 'Pierce', config.pierceX);
  addCountLine(
    keywordLines,
    'Downgrade Defense Dice X',
    config.downgradeDefenseX
  );
  if (keywordLines.length > 0) {
    sections.push({ title: 'Attack keywords', lines: keywordLines });
  }

  const defenseLines: PoolSnapshotLine[] = [
    {
      label: 'Defense die',
      value: config.defenseDieColor === 'white' ? 'White' : 'Red',
    },
    {
      label: 'Defense surge',
      value: config.defenseSurge === 'block' ? 'Block' : 'None',
    },
    { label: 'Cover', value: coverLabel(config.cover) },
    {
      label: 'Cover dice',
      value: config.coverDieColor === 'red' ? 'Red' : 'White',
    },
  ];
  addBooleanLine(defenseLines, 'Low Profile', config.lowProfile);
  addBooleanLine(defenseLines, 'Suppressed', config.suppressed);
  addBooleanLine(defenseLines, 'Backup', config.backup);
  addBooleanLine(defenseLines, 'Impervious', config.impervious);
  addBooleanLine(defenseLines, 'Outmaneuver', config.outmaneuver);
  addCountLine(defenseLines, 'Cover+', config.coverX);
  addCountLine(defenseLines, 'Armor', config.armorX);
  addCountLine(defenseLines, 'Danger Sense', config.dangerSenseX);
  addCountLine(defenseLines, 'Uncanny Luck', config.uncannyLuckX);
  addCountLine(defenseLines, 'Upgrade Defense Dice X', config.upgradeDefenseX);
  addCountLine(defenseLines, 'Def surge tokens', config.defenseSurgeTokens);
  addCountLine(defenseLines, 'Suppression', config.suppressionTokens);
  addCountLine(defenseLines, 'Dodge', config.dodgeTokens);
  addCountLine(defenseLines, 'Shield', config.shieldTokens);
  sections.push({ title: 'Defense', lines: defenseLines });

  if (pointCostValue(config) > 0) {
    sections.push({
      title: 'Cost',
      lines: [{ label: 'Point cost', value: config.pointCost }],
    });
  }

  return sections;
}
