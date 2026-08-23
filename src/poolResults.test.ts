import { describe, it, expect } from 'vitest';
import { computePoolResults, DEFAULT_POOL_CONFIG } from './poolResults';
import { calculateAttackPool, calculateWounds } from './engine/probability';

describe('computePoolResults', () => {
  it('matches calling the engine functions directly', () => {
    const config = {
      ...DEFAULT_POOL_CONFIG,
      pool: { red: 3, black: 1, white: 0 },
      surge: 'hit' as const,
      aimTokens: '2',
      criticalX: '1',
      pierceX: '1',
      downgradeDefenseX: '2',
      cover: 'light' as const,
      pointCost: '47',
    };

    const expectedAttack = calculateAttackPool(
      config.pool,
      'hit',
      1, // criticalX
      0, // surgeTokens
      2, // aimTokens
      0, // observeTokens
      0, // preciseX
      0 // ramX
    );
    const expectedWounds = calculateWounds(
      expectedAttack,
      'red',
      'none',
      0,
      0,
      false,
      0,
      'light',
      false,
      false,
      0,
      'white',
      0,
      false,
      0,
      0,
      1, // pierceX
      false,
      0,
      0,
      0,
      2
    );

    const { results, woundsResults } = computePoolResults(config);
    expect(results.expectedTotal).toBeCloseTo(expectedAttack.expectedTotal, 10);
    expect(woundsResults.expectedWounds).toBeCloseTo(
      expectedWounds.expectedWounds,
      10
    );
  });

  it('treats empty-string numeric fields as zero / undefined criticalX', () => {
    const { results } = computePoolResults({
      ...DEFAULT_POOL_CONFIG,
      pool: { red: 1, black: 0, white: 0 },
    });
    expect(results.expectedTotal).toBeGreaterThan(0);
  });
});
