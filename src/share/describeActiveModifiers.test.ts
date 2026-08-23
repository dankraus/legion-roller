import { describe, it, expect } from 'vitest';
import { describeActiveModifiers } from './describeActiveModifiers';
import { DEFAULT_POOL_CONFIG } from '../poolResults';

describe('describeActiveModifiers', () => {
  it('returns an empty array for a default config', () => {
    expect(describeActiveModifiers(DEFAULT_POOL_CONFIG)).toEqual([]);
  });

  it('lists non-default keyword, token, surge and cover values', () => {
    const labels = describeActiveModifiers({
      ...DEFAULT_POOL_CONFIG,
      surge: 'hit',
      aimTokens: '2',
      criticalX: '1',
      pierceX: '1',
      downgradeDefenseX: '2',
      cover: 'light',
      outmaneuver: true,
    });
    expect(labels).toContain('Surge→Hit');
    expect(labels).toContain('Aim 2');
    expect(labels).toContain('Critical 1');
    expect(labels).toContain('Pierce 1');
    expect(labels).toContain('Downgrade Defense Dice X 2');
    expect(labels).toContain('Cover Light');
    expect(labels).toContain('Outmaneuver');
  });

  it('ignores zero/empty numeric fields', () => {
    expect(
      describeActiveModifiers({ ...DEFAULT_POOL_CONFIG, aimTokens: '0' })
    ).toEqual([]);
  });

  it('does not produce a "White defense" label (shown as a defense line instead)', () => {
    expect(
      describeActiveModifiers({
        ...DEFAULT_POOL_CONFIG,
        defenseDieColor: 'white',
      })
    ).not.toContain('White defense');
  });

  it('lists Cover dice Red when cover die color is red', () => {
    expect(
      describeActiveModifiers({
        ...DEFAULT_POOL_CONFIG,
        coverDieColor: 'red',
      })
    ).toContain('Cover dice Red');
  });

  it('omits Cover dice Red when white', () => {
    expect(describeActiveModifiers(DEFAULT_POOL_CONFIG)).not.toContain(
      'Cover dice Red'
    );
  });
});
