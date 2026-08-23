/**
 * @vitest-environment node
 * Engine tests are pure TS; no DOM needed.
 */
import { describe, it, expect } from 'vitest';
import {
  DICE,
  getEffectiveProbabilities,
  calculateAttackPool,
  DEFENSE_DICE,
  getDefenseEffectiveProbabilities,
  getDefenseDistributionForDiceCount,
  calculateDefensePool,
  calculateWounds,
} from '../probability';
import type { AttackPool, DefensePool } from '../../types';

describe('DICE definitions', () => {
  it('red die faces sum to 8', () => {
    const red = DICE.red;
    expect(red.crit + red.surge + red.hit + red.blank).toBe(8);
  });

  it('black die faces sum to 8', () => {
    const black = DICE.black;
    expect(black.crit + black.surge + black.hit + black.blank).toBe(8);
  });

  it('white die faces sum to 8', () => {
    const white = DICE.white;
    expect(white.crit + white.surge + white.hit + white.blank).toBe(8);
  });
});

describe('getEffectiveProbabilities', () => {
  it('with no surge conversion, surge counts as blank', () => {
    const result = getEffectiveProbabilities('red', 'none');
    expect(result.crit).toBeCloseTo(1 / 8);
    expect(result.hit).toBeCloseTo(5 / 8);
    expect(result.blank).toBeCloseTo(2 / 8);
  });

  it('with surge to hit, surge adds to hit', () => {
    const result = getEffectiveProbabilities('red', 'hit');
    expect(result.crit).toBeCloseTo(1 / 8);
    expect(result.hit).toBeCloseTo(6 / 8);
    expect(result.blank).toBeCloseTo(1 / 8);
  });

  it('with surge to crit, surge adds to crit', () => {
    const result = getEffectiveProbabilities('red', 'crit');
    expect(result.crit).toBeCloseTo(2 / 8);
    expect(result.hit).toBeCloseTo(5 / 8);
    expect(result.blank).toBeCloseTo(1 / 8);
  });

  it('white die with no surge conversion', () => {
    const result = getEffectiveProbabilities('white', 'none');
    expect(result.crit).toBeCloseTo(1 / 8);
    expect(result.hit).toBeCloseTo(1 / 8);
    expect(result.blank).toBeCloseTo(6 / 8);
  });
});

describe('calculateAttackPool', () => {
  it('zero dice returns zero everything', () => {
    const pool: AttackPool = { red: 0, black: 0, white: 0 };
    const result = calculateAttackPool(pool, 'none');
    expect(result.expectedHits).toBe(0);
    expect(result.expectedCrits).toBe(0);
    expect(result.expectedTotal).toBe(0);
    expect(result.distribution).toHaveLength(1);
    expect(result.distribution[0]).toEqual({ total: 0, probability: 1 });
  });

  it('single red die with no surge has correct expected values', () => {
    const pool: AttackPool = { red: 1, black: 0, white: 0 };
    const result = calculateAttackPool(pool, 'none');
    expect(result.expectedHits).toBeCloseTo(5 / 8);
    expect(result.expectedCrits).toBeCloseTo(1 / 8);
    expect(result.expectedTotal).toBeCloseTo(6 / 8);
  });

  it('single red die with surge to hit', () => {
    const pool: AttackPool = { red: 1, black: 0, white: 0 };
    const result = calculateAttackPool(pool, 'hit');
    expect(result.expectedHits).toBeCloseTo(6 / 8);
    expect(result.expectedCrits).toBeCloseTo(1 / 8);
    expect(result.expectedTotal).toBeCloseTo(7 / 8);
  });

  it('two red dice expected total is double one red die', () => {
    const pool: AttackPool = { red: 2, black: 0, white: 0 };
    const result = calculateAttackPool(pool, 'none');
    expect(result.expectedTotal).toBeCloseTo((2 * 6) / 8);
  });

  it('distribution probabilities sum to 1', () => {
    const pool: AttackPool = { red: 2, black: 1, white: 1 };
    const result = calculateAttackPool(pool, 'hit');
    const sum = result.distribution.reduce(
      (acc, entry) => acc + entry.probability,
      0
    );
    expect(sum).toBeCloseTo(1);
  });

  it('cumulative starts at 1 for at-least-0', () => {
    const pool: AttackPool = { red: 1, black: 1, white: 0 };
    const result = calculateAttackPool(pool, 'none');
    expect(result.cumulative[0]).toEqual({ total: 0, probability: 1 });
  });

  it('cumulative is non-increasing', () => {
    const pool: AttackPool = { red: 2, black: 2, white: 1 };
    const result = calculateAttackPool(pool, 'crit');
    for (let i = 1; i < result.cumulative.length; i++) {
      expect(result.cumulative[i].probability).toBeLessThanOrEqual(
        result.cumulative[i - 1].probability
      );
    }
  });

  it('returns distributionByHitsCrits that sums to 1 and matches total distribution', () => {
    const result = calculateAttackPool({ red: 1, black: 0, white: 0 }, 'none');
    expect(result.distributionByHitsCrits).toBeDefined();
    const sumByHitsCrits = result.distributionByHitsCrits.reduce(
      (acc, entry) => acc + entry.probability,
      0
    );
    expect(sumByHitsCrits).toBeCloseTo(1);
    const byTotal: Record<number, number> = {};
    for (const entry of result.distributionByHitsCrits) {
      const total = Math.round(entry.hits + entry.crits);
      byTotal[total] = (byTotal[total] ?? 0) + entry.probability;
    }
    for (const entry of result.distribution) {
      expect(byTotal[entry.total] ?? 0).toBeCloseTo(entry.probability);
    }
  });
});

describe('Critical X', () => {
  it('criticalX 0 or undefined matches no keyword', () => {
    const pool: AttackPool = { red: 1, black: 0, white: 0 };
    const withNone = calculateAttackPool(pool, 'hit');
    const withZero = calculateAttackPool(pool, 'hit', 0);
    const withUndefined = calculateAttackPool(pool, 'hit', undefined);
    expect(withZero.expectedHits).toBeCloseTo(withNone.expectedHits);
    expect(withZero.expectedCrits).toBeCloseTo(withNone.expectedCrits);
    expect(withUndefined.expectedHits).toBeCloseTo(withNone.expectedHits);
    expect(withUndefined.expectedCrits).toBeCloseTo(withNone.expectedCrits);
  });

  it('Critical 1 with surge to hit: one surge becomes crit instead of hit', () => {
    const pool: AttackPool = { red: 1, black: 0, white: 0 };
    const noKeyword = calculateAttackPool(pool, 'hit');
    const withCritical1 = calculateAttackPool(pool, 'hit', 1);
    expect(withCritical1.expectedCrits).toBeCloseTo(
      noKeyword.expectedCrits + 1 / 8
    );
    expect(withCritical1.expectedHits).toBeCloseTo(
      noKeyword.expectedHits - 1 / 8
    );
  });

  it('Critical 2 then Surge to Hit: 3 surges → 2 crits, 1 hit', () => {
    const pool: AttackPool = { red: 0, black: 0, white: 3 };
    const result = calculateAttackPool(pool, 'hit', 2);
    const sum = result.distribution.reduce(
      (acc, entry) => acc + entry.probability,
      0
    );
    expect(sum).toBeCloseTo(1);
    expect(result.expectedTotal).toBeGreaterThan(0);
  });

  it('distribution sums to 1 with Critical X', () => {
    const pool: AttackPool = { red: 2, black: 1, white: 1 };
    const result = calculateAttackPool(pool, 'hit', 2);
    const sum = result.distribution.reduce(
      (acc, entry) => acc + entry.probability,
      0
    );
    expect(sum).toBeCloseTo(1);
  });

  it('negative criticalX treated as 0', () => {
    const pool: AttackPool = { red: 1, black: 0, white: 0 };
    const result = calculateAttackPool(pool, 'hit', -1);
    const noKeyword = calculateAttackPool(pool, 'hit');
    expect(result.expectedCrits).toBeCloseTo(noKeyword.expectedCrits);
  });
});

describe('Surge Tokens', () => {
  it('with surge none, 1 token converts one surge to hit (single white die)', () => {
    const pool: AttackPool = { red: 0, black: 0, white: 1 };
    const noTokens = calculateAttackPool(pool, 'none', undefined, 0);
    const oneToken = calculateAttackPool(pool, 'none', undefined, 1);
    expect(noTokens.expectedHits).toBeCloseTo(1 / 8);
    expect(oneToken.expectedHits).toBeCloseTo(2 / 8);
    expect(oneToken.expectedCrits).toBeCloseTo(1 / 8);
  });

  it('surge to hit: surgeTokens do not affect result', () => {
    const pool: AttackPool = { red: 1, black: 0, white: 0 };
    const zero = calculateAttackPool(pool, 'hit', undefined, 0);
    const five = calculateAttackPool(pool, 'hit', undefined, 5);
    expect(five.expectedHits).toBeCloseTo(zero.expectedHits);
    expect(five.expectedCrits).toBeCloseTo(zero.expectedCrits);
  });

  it('surge to crit: surgeTokens do not affect result', () => {
    const pool: AttackPool = { red: 1, black: 0, white: 0 };
    const zero = calculateAttackPool(pool, 'crit', undefined, 0);
    const five = calculateAttackPool(pool, 'crit', undefined, 5);
    expect(five.expectedHits).toBeCloseTo(zero.expectedHits);
    expect(five.expectedCrits).toBeCloseTo(zero.expectedCrits);
  });

  it('Critical 1 + 1 token, surge none: token applies only to surges left after Critical X', () => {
    const pool: AttackPool = { red: 0, black: 0, white: 2 };
    const noKeywordNoToken = calculateAttackPool(pool, 'none');
    const critical1OneToken = calculateAttackPool(pool, 'none', 1, 1);
    expect(critical1OneToken.expectedCrits).toBeGreaterThan(
      noKeywordNoToken.expectedCrits
    );
    expect(critical1OneToken.expectedHits).toBeGreaterThan(
      noKeywordNoToken.expectedHits
    );
  });
});

describe('Aim and Observe tokens', () => {
  it('zero aim and observe: same as no tokens', () => {
    const pool: AttackPool = { red: 1, black: 0, white: 1 };
    const noTokens = calculateAttackPool(pool, 'none');
    const zeroBoth = calculateAttackPool(pool, 'none', undefined, 0, 0, 0);
    expect(zeroBoth.expectedHits).toBeCloseTo(noTokens.expectedHits);
    expect(zeroBoth.expectedCrits).toBeCloseTo(noTokens.expectedCrits);
  });

  it('1 Observe token with 1 white die (surge none): reroll 1 blank adds expected hit/crit', () => {
    const pool: AttackPool = { red: 0, black: 0, white: 1 };
    const noToken = calculateAttackPool(pool, 'none');
    const oneObserve = calculateAttackPool(pool, 'none', undefined, 0, 0, 1);
    expect(oneObserve.expectedHits).toBeGreaterThan(noToken.expectedHits);
    expect(oneObserve.expectedCrits).toBeGreaterThan(noToken.expectedCrits);
    expect(noToken.expectedHits).toBeCloseTo(1 / 8);
    expect(noToken.expectedCrits).toBeCloseTo(1 / 8);
    expect(oneObserve.expectedHits).toBeCloseTo(1 / 8 + (5 / 8) * (1 / 8), 1);
    expect(oneObserve.expectedCrits).toBeCloseTo(1 / 8 + (5 / 8) * (1 / 8), 1);
  });

  it('2 Observe with 1 white die: two rounds so can reroll that blank again if still blank', () => {
    const pool: AttackPool = { red: 0, black: 0, white: 1 };
    const oneObserve = calculateAttackPool(pool, 'none', undefined, 0, 0, 1);
    const twoObserve = calculateAttackPool(pool, 'none', undefined, 0, 0, 2);
    expect(twoObserve.expectedTotal).toBeGreaterThan(oneObserve.expectedTotal);
  });

  it('1 Aim token with 1 white die: one round, up to 2 dice, only 1 blank so same as 1 Observe', () => {
    const pool: AttackPool = { red: 0, black: 0, white: 1 };
    const oneObserve = calculateAttackPool(pool, 'none', undefined, 0, 0, 1);
    const oneAim = calculateAttackPool(pool, 'none', undefined, 0, 1, 0);
    expect(oneAim.expectedHits).toBeCloseTo(oneObserve.expectedHits);
    expect(oneAim.expectedCrits).toBeCloseTo(oneObserve.expectedCrits);
  });

  it('1 Aim token with 2 white dice: can reroll 2 blanks when both blank', () => {
    const pool: AttackPool = { red: 0, black: 0, white: 2 };
    const noToken = calculateAttackPool(pool, 'none');
    const oneAim = calculateAttackPool(pool, 'none', undefined, 0, 1, 0);
    expect(oneAim.expectedHits).toBeGreaterThan(noToken.expectedHits);
    expect(oneAim.expectedCrits).toBeGreaterThan(noToken.expectedCrits);
    expect(oneAim.expectedTotal).toBeGreaterThan(noToken.expectedTotal);
  });

  it('Observe tokens work regardless of Surge Conversion', () => {
    const pool: AttackPool = { red: 0, black: 0, white: 1 };
    const noTokenHit = calculateAttackPool(pool, 'hit');
    const oneObserveHit = calculateAttackPool(pool, 'hit', undefined, 0, 0, 1);
    expect(oneObserveHit.expectedHits).toBeGreaterThan(noTokenHit.expectedHits);
    expect(oneObserveHit.expectedCrits).toBeGreaterThan(
      noTokenHit.expectedCrits
    );
  });

  it('Aim tokens work regardless of Surge Conversion', () => {
    const pool: AttackPool = { red: 0, black: 0, white: 2 };
    const noTokenCrit = calculateAttackPool(pool, 'crit');
    const oneAimCrit = calculateAttackPool(pool, 'crit', undefined, 0, 1, 0);
    expect(oneAimCrit.expectedTotal).toBeGreaterThan(noTokenCrit.expectedTotal);
  });
});

describe('Precise keyword', () => {
  it('1 Aim + Precise 1: reroll capacity 3 (higher expected total than 1 Aim + Precise 0)', () => {
    const pool: AttackPool = { red: 0, black: 0, white: 3 };
    const oneAimNoPrecise = calculateAttackPool(
      pool,
      'none',
      undefined,
      0,
      1,
      0
    );
    const oneAimPrecise1 = calculateAttackPool(
      pool,
      'none',
      undefined,
      0,
      1,
      0,
      1
    );
    expect(oneAimPrecise1.expectedTotal).toBeGreaterThan(
      oneAimNoPrecise.expectedTotal
    );
    expect(oneAimPrecise1.expectedHits).toBeGreaterThan(
      oneAimNoPrecise.expectedHits
    );
  });

  it('2 Aim + Precise 1: reroll capacity 6', () => {
    const pool: AttackPool = { red: 0, black: 0, white: 5 };
    const twoAimPrecise0 = calculateAttackPool(
      pool,
      'none',
      undefined,
      0,
      2,
      0
    );
    const twoAimPrecise1 = calculateAttackPool(
      pool,
      'none',
      undefined,
      0,
      2,
      0,
      1
    );
    expect(twoAimPrecise1.expectedTotal).toBeGreaterThan(
      twoAimPrecise0.expectedTotal
    );
  });

  it('0 Aim + Precise 1: same as 0 Aim (precise ignored)', () => {
    const pool: AttackPool = { red: 0, black: 0, white: 2 };
    const zeroAim = calculateAttackPool(pool, 'none', undefined, 0, 0, 0);
    const zeroAimPrecise1 = calculateAttackPool(
      pool,
      'none',
      undefined,
      0,
      0,
      0,
      1
    );
    expect(zeroAimPrecise1.expectedHits).toBeCloseTo(zeroAim.expectedHits);
    expect(zeroAimPrecise1.expectedCrits).toBeCloseTo(zeroAim.expectedCrits);
  });
});

describe('Ram X keyword', () => {
  it('Ram 1 with 1 white die (surge none, no rerolls): converts blank or hit to crit', () => {
    const pool: AttackPool = { red: 0, black: 0, white: 1 };
    const noRam = calculateAttackPool(pool, 'none');
    // white die: 1 crit, 1 surge, 1 hit, 5 blank. Surge none → surge wasted.
    // Per outcome with Ram 1:
    //   crit(1/8): no blanks/hits to convert → crits=1
    //   surge(1/8): no blanks/hits → crits=0
    //   hit(1/8): 0 blanks, 1 hit → hit→crit → crits=1, hits=0
    //   blank(5/8): 1 blank→crit → crits=1
    // expectedCrits = (1+0+1+5)/8 = 7/8, expectedHits = 0
    const ram1 = calculateAttackPool(pool, 'none', undefined, 0, 0, 0, 0, 1);
    expect(ram1.expectedCrits).toBeGreaterThan(noRam.expectedCrits);
    expect(ram1.expectedTotal).toBeGreaterThan(noRam.expectedTotal);
    expect(ram1.expectedCrits).toBeCloseTo(7 / 8);
    expect(ram1.expectedHits).toBeCloseTo(0);
  });

  it('Ram 0 or undefined: same as no Ram', () => {
    const pool: AttackPool = { red: 1, black: 0, white: 1 };
    const noRam = calculateAttackPool(pool, 'hit');
    const ram0 = calculateAttackPool(pool, 'hit', undefined, 0, 0, 0, 0, 0);
    const ramUndef = calculateAttackPool(
      pool,
      'hit',
      undefined,
      0,
      0,
      0,
      0,
      undefined
    );
    expect(ram0.expectedHits).toBeCloseTo(noRam.expectedHits);
    expect(ram0.expectedCrits).toBeCloseTo(noRam.expectedCrits);
    expect(ramUndef.expectedHits).toBeCloseTo(noRam.expectedHits);
    expect(ramUndef.expectedCrits).toBeCloseTo(noRam.expectedCrits);
  });

  it('negative ramX treated as 0', () => {
    const pool: AttackPool = { red: 1, black: 0, white: 0 };
    const noRam = calculateAttackPool(pool, 'hit');
    const negRam = calculateAttackPool(pool, 'hit', undefined, 0, 0, 0, 0, -1);
    expect(negRam.expectedCrits).toBeCloseTo(noRam.expectedCrits);
    expect(negRam.expectedHits).toBeCloseTo(noRam.expectedHits);
  });

  it('Ram 2 with 1 white die (surge none, no rerolls): converts blank then hit to crit', () => {
    const pool: AttackPool = { red: 0, black: 0, white: 1 };
    // Per outcome (single die):
    //   crit: 0 blanks, 0 hits → ram does nothing. crits=1
    //   surge: 0 blanks, 0 hits (surge=none → wasted) → ram does nothing. crits=0
    //   hit: 0 blanks, 1 hit → ram converts 1 hit to crit. crits=1, hits=0
    //   blank: 1 blank → ram converts 1 blank to crit, ram left=1, 0 hits left → crits=1, hits=0
    // expectedCrits = (1 + 0 + 1 + 5*1)/8 = 7/8
    // expectedHits = 0
    const ram2 = calculateAttackPool(pool, 'none', undefined, 0, 0, 0, 0, 2);
    expect(ram2.expectedCrits).toBeCloseTo(7 / 8);
    expect(ram2.expectedHits).toBeCloseTo(0);
    expect(ram2.expectedTotal).toBeCloseTo(7 / 8);
  });

  it('Ram 1 + 1 Aim with white dice: Ram applies after rerolls, converts a remaining blank', () => {
    const pool: AttackPool = { red: 0, black: 0, white: 3 };
    const aimOnly = calculateAttackPool(pool, 'none', undefined, 0, 1, 0, 0, 0);
    const aimPlusRam = calculateAttackPool(
      pool,
      'none',
      undefined,
      0,
      1,
      0,
      0,
      1
    );
    expect(aimPlusRam.expectedCrits).toBeGreaterThan(aimOnly.expectedCrits);
    expect(aimPlusRam.expectedTotal).toBeGreaterThan(aimOnly.expectedTotal);
  });

  it('Ram works with surge to hit', () => {
    const pool: AttackPool = { red: 0, black: 0, white: 2 };
    const hitNoRam = calculateAttackPool(pool, 'hit');
    const hitRam1 = calculateAttackPool(pool, 'hit', undefined, 0, 0, 0, 0, 1);
    expect(hitRam1.expectedCrits).toBeGreaterThan(hitNoRam.expectedCrits);
  });

  it('Ram works with surge to crit', () => {
    const pool: AttackPool = { red: 0, black: 0, white: 2 };
    const critNoRam = calculateAttackPool(pool, 'crit');
    const critRam1 = calculateAttackPool(
      pool,
      'crit',
      undefined,
      0,
      0,
      0,
      0,
      1
    );
    expect(critRam1.expectedCrits).toBeGreaterThan(critNoRam.expectedCrits);
  });

  it('Critical X + Ram X: both apply (surges become crits via Critical, blanks via Ram)', () => {
    const pool: AttackPool = { red: 0, black: 0, white: 2 };
    const noKeywords = calculateAttackPool(pool, 'none');
    const critOnly = calculateAttackPool(pool, 'none', 1, 0, 0, 0, 0, 0);
    const critPlusRam = calculateAttackPool(pool, 'none', 1, 0, 0, 0, 0, 1);
    expect(critPlusRam.expectedCrits).toBeGreaterThan(critOnly.expectedCrits);
    expect(critPlusRam.expectedTotal).toBeGreaterThan(critOnly.expectedTotal);
    expect(critPlusRam.expectedTotal).toBeGreaterThan(noKeywords.expectedTotal);
  });
});

describe('DEFENSE_DICE definitions', () => {
  it('red defense die faces sum to 6', () => {
    const red = DEFENSE_DICE.red;
    expect(red.block + red.surge + red.blank).toBe(6);
  });

  it('white defense die faces sum to 6', () => {
    const white = DEFENSE_DICE.white;
    expect(white.block + white.surge + white.blank).toBe(6);
  });
});

describe('getDefenseEffectiveProbabilities', () => {
  it('red defense with none: surge counts as blank', () => {
    const result = getDefenseEffectiveProbabilities('red', 'none');
    expect(result.block).toBeCloseTo(3 / 6);
    expect(result.blank).toBeCloseTo(3 / 6);
  });

  it('red defense with block: surge adds to block', () => {
    const result = getDefenseEffectiveProbabilities('red', 'block');
    expect(result.block).toBeCloseTo(4 / 6);
    expect(result.blank).toBeCloseTo(2 / 6);
  });

  it('white defense with none', () => {
    const result = getDefenseEffectiveProbabilities('white', 'none');
    expect(result.block).toBeCloseTo(1 / 6);
    expect(result.blank).toBeCloseTo(5 / 6);
  });

  it('white defense with block', () => {
    const result = getDefenseEffectiveProbabilities('white', 'block');
    expect(result.block).toBeCloseTo(2 / 6);
    expect(result.blank).toBeCloseTo(4 / 6);
  });
});

describe('getDefenseDistributionForDiceCount', () => {
  it('0 dice returns 0 blocks with probability 1', () => {
    const result = getDefenseDistributionForDiceCount(0, 'red', 'none');
    expect(result.expectedBlocks).toBe(0);
    expect(result.distribution).toHaveLength(1);
    expect(result.distribution[0]).toEqual({ total: 0, probability: 1 });
  });

  it('1 red die with none has expected blocks 3/6', () => {
    const result = getDefenseDistributionForDiceCount(1, 'red', 'none');
    expect(result.expectedBlocks).toBeCloseTo(3 / 6);
  });

  it('1 white die with block has expected blocks 2/6', () => {
    const result = getDefenseDistributionForDiceCount(1, 'white', 'block');
    expect(result.expectedBlocks).toBeCloseTo(2 / 6);
  });
});

describe('calculateDefensePool', () => {
  it('zero dice returns zero blocks and single outcome', () => {
    const pool: DefensePool = { red: 0, white: 0 };
    const result = calculateDefensePool(pool, 'none');
    expect(result.expectedBlocks).toBe(0);
    expect(result.distribution).toHaveLength(1);
    expect(result.distribution[0]).toEqual({ total: 0, probability: 1 });
  });

  it('single red defense die with none has expected blocks 3/6', () => {
    const pool: DefensePool = { red: 1, white: 0 };
    const result = calculateDefensePool(pool, 'none');
    expect(result.expectedBlocks).toBeCloseTo(3 / 6);
  });

  it('single red defense die with block has expected blocks 4/6', () => {
    const pool: DefensePool = { red: 1, white: 0 };
    const result = calculateDefensePool(pool, 'block');
    expect(result.expectedBlocks).toBeCloseTo(4 / 6);
  });

  it('single white defense die with none has expected blocks 1/6', () => {
    const pool: DefensePool = { red: 0, white: 1 };
    const result = calculateDefensePool(pool, 'none');
    expect(result.expectedBlocks).toBeCloseTo(1 / 6, 1);
  });

  it('distribution probabilities sum to 1', () => {
    const pool: DefensePool = { red: 2, white: 1 };
    const result = calculateDefensePool(pool, 'block');
    const sum = result.distribution.reduce(
      (acc, entry) => acc + entry.probability,
      0
    );
    expect(sum).toBeCloseTo(1);
  });

  it('cumulative starts at 1 for at-least-0', () => {
    const pool: DefensePool = { red: 1, white: 0 };
    const result = calculateDefensePool(pool, 'none');
    expect(result.cumulative[0]).toEqual({ total: 0, probability: 1 });
  });
});

describe('calculateWounds', () => {
  it('zero attack dice yields 0 wounds', () => {
    const attackResults = calculateAttackPool(
      { red: 0, black: 0, white: 0 },
      'none'
    );
    const wounds = calculateWounds(attackResults, 'red', 'none');
    expect(wounds.expectedWounds).toBe(0);
    expect(wounds.distribution).toHaveLength(1);
    expect(wounds.distribution[0]).toEqual({ total: 0, probability: 1 });
  });

  it('attack always 1 success, red defense none: expected wounds 1 - 3/6', () => {
    const attackResults = calculateAttackPool(
      { red: 0, black: 0, white: 0 },
      'none'
    );
    const attackDist = [
      { total: 0, probability: 0 },
      { total: 1, probability: 1 },
      { total: 2, probability: 0 },
    ];
    const attackWithDist = {
      ...attackResults,
      distribution: attackDist,
      distributionByHitsCrits: [{ hits: 1, crits: 0, probability: 1 }],
    };
    const wounds = calculateWounds(attackWithDist, 'red', 'none');
    const sum = wounds.distribution.reduce(
      (acc, entry) => acc + entry.probability,
      0
    );
    expect(sum).toBeCloseTo(1);
    expect(wounds.expectedWounds).toBeCloseTo(1 - 3 / 6);
  });

  it('attack 50% 0 / 50% 2, red defense none: wounds distribution sums to 1', () => {
    const attackResults = calculateAttackPool(
      { red: 0, black: 0, white: 0 },
      'none'
    );
    const attackDist = [
      { total: 0, probability: 0.5 },
      { total: 1, probability: 0 },
      { total: 2, probability: 0.5 },
    ];
    const attackWithDist = {
      ...attackResults,
      distribution: attackDist,
      distributionByHitsCrits: [
        { hits: 0, crits: 0, probability: 0.5 },
        { hits: 2, crits: 0, probability: 0.5 },
      ],
    };
    const wounds = calculateWounds(attackWithDist, 'red', 'none');
    const sum = wounds.distribution.reduce(
      (acc, entry) => acc + entry.probability,
      0
    );
    expect(sum).toBeCloseTo(1);
  });

  it('attack pool red 1 none: wounds distribution sums to 1', () => {
    const attackResults = calculateAttackPool(
      { red: 1, black: 0, white: 0 },
      'none'
    );
    const wounds = calculateWounds(attackResults, 'red', 'none');
    const sum = wounds.distribution.reduce(
      (acc, entry) => acc + entry.probability,
      0
    );
    expect(sum).toBeCloseTo(1);
  });

  it('attack pool 2 red 1 black hit, red defense block: wounds distribution sums to 1', () => {
    const attackResults = calculateAttackPool(
      { red: 2, black: 1, white: 0 },
      'hit'
    );
    const wounds = calculateWounds(attackResults, 'red', 'block');
    const sum = wounds.distribution.reduce(
      (acc, entry) => acc + entry.probability,
      0
    );
    expect(sum).toBeCloseTo(1);
  });

  it('dodge 0 matches no-dodge wounds', () => {
    const attackResults = calculateAttackPool(
      { red: 2, black: 0, white: 0 },
      'none'
    );
    const noDodge = calculateWounds(attackResults, 'red', 'none');
    const dodgeZero = calculateWounds(attackResults, 'red', 'none', 0);
    expect(dodgeZero.expectedWounds).toBeCloseTo(noDodge.expectedWounds);
    expect(dodgeZero.distribution).toHaveLength(noDodge.distribution.length);
  });

  it('shield 0 matches no-shield wounds', () => {
    const attackResults = calculateAttackPool(
      { red: 2, black: 0, white: 0 },
      'none'
    );
    const noShield = calculateWounds(attackResults, 'red', 'none');
    const shieldZero = calculateWounds(attackResults, 'red', 'none', 0, 0);
    expect(shieldZero.expectedWounds).toBeCloseTo(noShield.expectedWounds);
    expect(shieldZero.distribution).toHaveLength(noShield.distribution.length);
  });

  it('more shield tokens reduces expected wounds', () => {
    const emptyPool = calculateAttackPool(
      { red: 0, black: 0, white: 0 },
      'none'
    );
    const attackWithHitsCrits = {
      ...emptyPool,
      distribution: [{ total: 3, probability: 1 }],
      distributionByHitsCrits: [{ hits: 2, crits: 1, probability: 1 }],
    };
    const woundsNoShield = calculateWounds(
      attackWithHitsCrits,
      'red',
      'none',
      0,
      0
    );
    const woundsOneShield = calculateWounds(
      attackWithHitsCrits,
      'red',
      'none',
      0,
      1
    );
    expect(woundsOneShield.expectedWounds).toBeLessThan(
      woundsNoShield.expectedWounds
    );
  });

  it('one outcome 3 hits 1 crit, 1 dodge: 3 defense dice, effective attack total 3', () => {
    const emptyPool = calculateAttackPool(
      { red: 0, black: 0, white: 0 },
      'none'
    );
    const attackWithHitsCrits = {
      ...emptyPool,
      distribution: [{ total: 4, probability: 1 }],
      distributionByHitsCrits: [{ hits: 3, crits: 1, probability: 1 }],
    };
    const wounds = calculateWounds(attackWithHitsCrits, 'red', 'none', 1);
    expect(wounds.expectedWounds).toBeDefined();
    const sum = wounds.distribution.reduce(
      (acc, entry) => acc + entry.probability,
      0
    );
    expect(sum).toBeCloseTo(1);
    // 1 dodge cancels 1 hit → effective total 3, defense rolls 3 red/none dice. Expected blocks 1.5 → expected wounds 3 - 1.5 = 1.5
    expect(wounds.expectedWounds).toBeCloseTo(1.5);
  });

  it('one outcome 1 hit 2 crits, 5 dodge: 2 defense dice (crits only), effective attack total 2', () => {
    const emptyPool = calculateAttackPool(
      { red: 0, black: 0, white: 0 },
      'none'
    );
    const attackWithHitsCrits = {
      ...emptyPool,
      distribution: [{ total: 3, probability: 1 }],
      distributionByHitsCrits: [{ hits: 1, crits: 2, probability: 1 }],
    };
    const wounds = calculateWounds(attackWithHitsCrits, 'red', 'none', 5);
    const sum = wounds.distribution.reduce(
      (acc, entry) => acc + entry.probability,
      0
    );
    expect(sum).toBeCloseTo(1);
    // 5 dodge caps at 1 hit → effective total 2, defense rolls 2 red/none dice. Expected blocks 1 → expected wounds 2 - 1 = 1
    expect(wounds.expectedWounds).toBeCloseTo(1);
  });

  it('more dodge tokens reduces expected wounds (dodged hits do not count)', () => {
    const attackResults = calculateAttackPool(
      { red: 2, black: 0, white: 0 },
      'none'
    );
    const woundsNoDodge = calculateWounds(attackResults, 'red', 'none');
    const woundsOneDodge = calculateWounds(attackResults, 'red', 'none', 1);
    const woundsTwoDodge = calculateWounds(attackResults, 'red', 'none', 2);
    expect(woundsOneDodge.expectedWounds).toBeLessThan(
      woundsNoDodge.expectedWounds
    );
    expect(woundsTwoDodge.expectedWounds).toBeLessThan(
      woundsOneDodge.expectedWounds
    );
  });

  it('outmaneuver on: 1 hit 1 crit 1 dodge → 1 defense die, expected wounds 0.5', () => {
    const emptyPool = calculateAttackPool(
      { red: 0, black: 0, white: 0 },
      'none'
    );
    const attackWithHitsCrits = {
      ...emptyPool,
      distribution: [{ total: 2, probability: 1 }],
      distributionByHitsCrits: [{ hits: 1, crits: 1, probability: 1 }],
    };
    const wounds = calculateWounds(
      attackWithHitsCrits,
      'red',
      'none',
      1,
      0,
      true
    );
    expect(wounds.expectedWounds).toBeCloseTo(0.5); // 1 die, expected blocks 0.5
  });

  it('outmaneuver off: 1 hit 1 crit 1 dodge → 1 defense die (dodge cancels hit only)', () => {
    const emptyPool = calculateAttackPool(
      { red: 0, black: 0, white: 0 },
      'none'
    );
    const attackWithHitsCrits = {
      ...emptyPool,
      distribution: [{ total: 2, probability: 1 }],
      distributionByHitsCrits: [{ hits: 1, crits: 1, probability: 1 }],
    };
    const wounds = calculateWounds(
      attackWithHitsCrits,
      'red',
      'none',
      1,
      0,
      false
    );
    expect(wounds.expectedWounds).toBeCloseTo(0.5); // 1 die (crit only), expected blocks 0.5
  });

  it('outmaneuver on reduces expected wounds vs off when crits and dodge present', () => {
    // 1 hit, 1 crit, 2 dodge: off → 1 die (dodge cancels hit, crit remains); on → 0 dice (both cancelled)
    const emptyPool = calculateAttackPool(
      { red: 0, black: 0, white: 0 },
      'none'
    );
    const attackWithHitsCrits = {
      ...emptyPool,
      distribution: [{ total: 2, probability: 1 }],
      distributionByHitsCrits: [{ hits: 1, crits: 1, probability: 1 }],
    };
    const woundsOff = calculateWounds(
      attackWithHitsCrits,
      'red',
      'none',
      2,
      0,
      false
    );
    const woundsOn = calculateWounds(
      attackWithHitsCrits,
      'red',
      'none',
      2,
      0,
      true
    );
    expect(woundsOn.expectedWounds).toBeLessThan(woundsOff.expectedWounds);
  });

  it('cover none with suppressed true yields lower expected wounds than suppressed false', () => {
    const emptyPool = calculateAttackPool(
      { red: 0, black: 0, white: 0 },
      'none'
    );
    const attackWithHits = {
      ...emptyPool,
      distribution: [{ total: 3, probability: 1 }],
      distributionByHitsCrits: [{ hits: 3, crits: 0, probability: 1 }],
    };
    const woundsSuppressedOff = calculateWounds(
      attackWithHits,
      'red',
      'none',
      undefined,
      undefined,
      undefined,
      undefined,
      'none',
      false,
      false // suppressed false: no effective cover
    );
    const woundsSuppressedOn = calculateWounds(
      attackWithHits,
      'red',
      'none',
      undefined,
      undefined,
      undefined,
      undefined,
      'none',
      false,
      true // suppressed true: effective cover light → fewer wounds
    );
    expect(woundsSuppressedOn.expectedWounds).toBeLessThan(
      woundsSuppressedOff.expectedWounds
    );
  });

  it('armorX reduces expected wounds (armorX 3 ≤ armorX 0)', () => {
    const emptyPool = calculateAttackPool(
      { red: 0, black: 0, white: 0 },
      'none'
    );
    const attackWithHits = {
      ...emptyPool,
      distribution: [{ total: 4, probability: 1 }],
      distributionByHitsCrits: [{ hits: 3, crits: 1, probability: 1 }],
    };
    const woundsArmor0 = calculateWounds(
      attackWithHits,
      'red',
      'none',
      0,
      0,
      false,
      0,
      'none',
      false,
      false,
      0,
      'white',
      0,
      false,
      0,
      0, // impactX
      0
    );
    const woundsArmor3 = calculateWounds(
      attackWithHits,
      'red',
      'none',
      0,
      0,
      false,
      0,
      'none',
      false,
      false,
      0,
      'white',
      0,
      false,
      3,
      0, // impactX
      0
    );
    expect(woundsArmor3.expectedWounds).toBeLessThanOrEqual(
      woundsArmor0.expectedWounds
    );
  });

  it('impactX increases expected wounds (impactX 2 >= impactX 0)', () => {
    const emptyPool = calculateAttackPool(
      { red: 0, black: 0, white: 0 },
      'none'
    );
    const attackWithHits = {
      ...emptyPool,
      distribution: [{ total: 4, probability: 1 }],
      distributionByHitsCrits: [{ hits: 3, crits: 1, probability: 1 }],
    };
    const woundsImpact0 = calculateWounds(
      attackWithHits,
      'red',
      'none',
      0,
      0,
      false,
      0,
      'none',
      false,
      false,
      0,
      'white',
      0,
      false,
      3, // armorX
      0, // impactX
      0 // pierceX
    );
    const woundsImpact2 = calculateWounds(
      attackWithHits,
      'red',
      'none',
      0,
      0,
      false,
      0,
      'none',
      false,
      false,
      0,
      'white',
      0,
      false,
      3, // armorX
      2, // impactX
      0 // pierceX
    );
    expect(woundsImpact2.expectedWounds).toBeGreaterThanOrEqual(
      woundsImpact0.expectedWounds
    );
  });

  it('impactX 2 with 2 hits 0 crits: armorX 2 and armorX 3 give identical expected wounds', () => {
    const emptyPool = calculateAttackPool(
      { red: 0, black: 0, white: 0 },
      'none'
    );
    const attackTwoHits = {
      ...emptyPool,
      distribution: [{ total: 2, probability: 1 }],
      distributionByHitsCrits: [{ hits: 2, crits: 0, probability: 1 }],
    };
    const woundsArmor2 = calculateWounds(
      attackTwoHits,
      'red',
      'none',
      0,
      0,
      false,
      0,
      'none',
      false,
      false,
      0,
      'white',
      0,
      false,
      2,
      2,
      0
    );
    const woundsArmor3 = calculateWounds(
      attackTwoHits,
      'red',
      'none',
      0,
      0,
      false,
      0,
      'none',
      false,
      false,
      0,
      'white',
      0,
      false,
      3,
      2,
      0
    );
    expect(woundsArmor2.expectedWounds).toBe(woundsArmor3.expectedWounds);
    expect(woundsArmor2.distribution).toEqual(woundsArmor3.distribution);
  });

  it('impervious true with pierce 2 yields lower or equal expected wounds than impervious false', () => {
    const pool = { red: 2, black: 0, white: 0 };
    const attackResults = calculateAttackPool(pool, 'hit');
    const woundsNoImpervious = calculateWounds(
      attackResults,
      'red',
      'none',
      0,
      0,
      false,
      0,
      'none',
      false,
      false,
      0,
      'white',
      0,
      false,
      0,
      0,
      2, // pierceX
      false // impervious
    );
    const woundsImpervious = calculateWounds(
      attackResults,
      'red',
      'none',
      0,
      0,
      false,
      0,
      'none',
      false,
      false,
      0,
      'white',
      0,
      false,
      0,
      0,
      2, // pierceX
      true // impervious
    );
    expect(woundsImpervious.expectedWounds).toBeLessThanOrEqual(
      woundsNoImpervious.expectedWounds
    );
  });

  it('Danger Sense X: expected wounds with suppressionTokens 2 and dangerSenseX 2 are less than or equal to 0/0', () => {
    const emptyPool = calculateAttackPool(
      { red: 0, black: 0, white: 0 },
      'none'
    );
    const attackWithHits = {
      ...emptyPool,
      distribution: [{ total: 3, probability: 1 }],
      distributionByHitsCrits: [{ hits: 3, crits: 0, probability: 1 }],
    };
    const woundsBaseline = calculateWounds(
      attackWithHits,
      'red',
      'none',
      0,
      0,
      false,
      0,
      'none',
      false,
      false,
      0,
      'white',
      0,
      false,
      0,
      0,
      0,
      false,
      0, // suppressionTokens
      0 // dangerSenseX
    );
    const woundsWithDangerSense2 = calculateWounds(
      attackWithHits,
      'red',
      'none',
      0,
      0,
      false,
      0,
      'none',
      false,
      false,
      0,
      'white',
      0,
      false,
      0,
      0,
      0,
      false,
      2, // suppressionTokens
      2 // dangerSenseX
    );
    expect(woundsWithDangerSense2.expectedWounds).toBeLessThanOrEqual(
      woundsBaseline.expectedWounds
    );
  });

  it('Uncanny Luck X: expected wounds with uLuck 2 are less than or equal to 0', () => {
    const pool: AttackPool = { red: 0, black: 0, white: 4 };
    const attackResults = calculateAttackPool(pool, 'none');
    const woundsNone = calculateWounds(
      attackResults,
      'red',
      'block',
      0,
      0,
      false,
      0,
      'none',
      false,
      false,
      0,
      'white',
      0,
      false,
      0,
      0,
      0,
      false,
      0,
      0,
      0
    );
    const woundsUncanny = calculateWounds(
      attackResults,
      'red',
      'block',
      0,
      0,
      false,
      0,
      'none',
      false,
      false,
      0,
      'white',
      0,
      false,
      0,
      0,
      0,
      false,
      0,
      0,
      2
    );
    expect(woundsUncanny.expectedWounds).toBeLessThanOrEqual(
      woundsNone.expectedWounds
    );
  });
});
