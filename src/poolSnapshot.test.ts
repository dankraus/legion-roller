import { describe, it, expect } from 'vitest';
import { formatPoolSnapshot } from './poolSnapshot';
import { DEFAULT_POOL_CONFIG } from './poolResults';

function linesForTitle(
  sections: ReturnType<typeof formatPoolSnapshot>,
  title: string
) {
  return sections.find((section) => section.title === title)?.lines ?? [];
}

function lineValue(
  sections: ReturnType<typeof formatPoolSnapshot>,
  title: string,
  label: string
) {
  return linesForTitle(sections, title).find((line) => line.label === label)
    ?.value;
}

describe('formatPoolSnapshot', () => {
  it('omits Attack section (dice and surge shown in PoolDiceRow)', () => {
    const sections = formatPoolSnapshot(DEFAULT_POOL_CONFIG);
    expect(sections.some((section) => section.title === 'Attack')).toBe(false);
  });

  it('omits Tokens section when all token counts are default', () => {
    const sections = formatPoolSnapshot(DEFAULT_POOL_CONFIG);
    expect(sections.some((section) => section.title === 'Tokens')).toBe(false);
  });

  it('includes Tokens when a token count is set', () => {
    const sections = formatPoolSnapshot({
      ...DEFAULT_POOL_CONFIG,
      aimTokens: '2',
    });
    expect(lineValue(sections, 'Tokens', 'Aim')).toBe('2');
  });

  it('includes Attack keywords when critical is set', () => {
    const sections = formatPoolSnapshot({
      ...DEFAULT_POOL_CONFIG,
      criticalX: '1',
    });
    expect(lineValue(sections, 'Attack keywords', 'Critical')).toBe('1');
  });

  it('includes Downgrade Defense Dice X in Attack keywords when set', () => {
    const sections = formatPoolSnapshot({
      ...DEFAULT_POOL_CONFIG,
      downgradeDefenseX: '2',
    });
    expect(
      lineValue(sections, 'Attack keywords', 'Downgrade Defense Dice X')
    ).toBe('2');
  });

  it('always includes structural defense fields', () => {
    const sections = formatPoolSnapshot(DEFAULT_POOL_CONFIG);
    expect(lineValue(sections, 'Defense', 'Defense die')).toBe('Red');
    expect(lineValue(sections, 'Defense', 'Defense surge')).toBe('None');
    expect(lineValue(sections, 'Defense', 'Cover')).toBe('None');
  });

  it('includes optional defense modifier when non-default', () => {
    const sections = formatPoolSnapshot({
      ...DEFAULT_POOL_CONFIG,
      dugIn: true,
    });
    expect(lineValue(sections, 'Defense', 'Dug In')).toBe('On');
  });

  it('includes Cost section when point cost is set', () => {
    const sections = formatPoolSnapshot({
      ...DEFAULT_POOL_CONFIG,
      pointCost: '47',
    });
    expect(lineValue(sections, 'Cost', 'Point cost')).toBe('47');
  });
});
