/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import type { AttackPool, AttackResults, DefensePool } from '../../types';
import { createSeededRng } from '../rng';
import {
  rollOneAttackDie,
  rollAttackPool,
  rollDefensePoolDetailed,
  type DefenseFace,
  type DefenseDieOutcome,
  resolveStep,
  applyRerolls,
  applyRam,
  simulateAttackPool,
  rollOneDefenseDie,
  resolveDefenseRoll,
  pierceBlocksCancelled,
  effectiveBlocksAfterPierce,
  rollOneDefenseDieOutcome,
  getRerollableDefenseIndices,
  prioritizeRedDefenseRerollIndices,
  applyUncannyLuckRerolls,
  applyCover,
  getEffectiveCover,
  simulateDefensePool,
  getDefenseDistributionForDiceCountSim,
  simulateWounds,
  simulateWoundsFromAttackResults,
  splitDowngradedDefensePool,
} from '../simulate';

describe('rollOneAttackDie', () => {
  it('returns one of crit, surge, hit, blank', () => {
    const rng = createSeededRng(999);
    const faces = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const face = rollOneAttackDie('red', rng);
      faces.add(face);
    }
    expect(faces).toEqual(new Set(['crit', 'surge', 'hit', 'blank']));
  });

  it('with fixed seed red die produces deterministic sequence', () => {
    const rng = createSeededRng(1);
    const results = Array.from({ length: 8 }, () =>
      rollOneAttackDie('red', rng)
    );
    expect(results).toHaveLength(8);
    const crits = results.filter((face) => face === 'crit').length;
    const hits = results.filter((face) => face === 'hit').length;
    expect(crits).toBeGreaterThanOrEqual(0);
    expect(hits).toBeGreaterThanOrEqual(0);
  });
});

describe('rollAttackPool', () => {
  it('zero pool returns all zeros', () => {
    const pool: AttackPool = { red: 0, black: 0, white: 0 };
    const rng = createSeededRng(1);
    const counts = rollAttackPool(pool, rng);
    expect(counts).toEqual({ crit: 0, surge: 0, hit: 0, blank: 0 });
  });

  it('single red die returns one face', () => {
    const pool: AttackPool = { red: 1, black: 0, white: 0 };
    const rng = createSeededRng(2);
    const counts = rollAttackPool(pool, rng);
    expect(counts.crit + counts.surge + counts.hit + counts.blank).toBe(1);
  });

  it('pool of 4 dice returns sum 4', () => {
    const pool: AttackPool = { red: 2, black: 1, white: 1 };
    const rng = createSeededRng(3);
    const counts = rollAttackPool(pool, rng);
    expect(counts.crit + counts.surge + counts.hit + counts.blank).toBe(4);
  });
});

describe('rollDefensePoolDetailed', () => {
  it('returns one outcome per die in red then white order', () => {
    const pool: DefensePool = { red: 2, white: 1 };
    const rng = createSeededRng(99);
    const outcomes = rollDefensePoolDetailed(pool, rng);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0]?.color).toBe('red');
    expect(outcomes[1]?.color).toBe('red');
    expect(outcomes[2]?.color).toBe('white');
    for (const outcome of outcomes) {
      expect(['block', 'surge', 'blank']).toContain(outcome.face);
    }
  });

  it('empty pool returns empty array', () => {
    const outcomes = rollDefensePoolDetailed(
      { red: 0, white: 0 },
      createSeededRng(1)
    );
    expect(outcomes).toEqual([]);
  });
});

describe('resolveStep', () => {
  it('no keywords: surges go to blank when surge none', () => {
    const result = resolveStep(
      { crit: 1, surge: 2, hit: 3, blank: 0 },
      0,
      'none',
      0
    );
    expect(result.hits).toBe(3);
    expect(result.crits).toBe(1);
  });

  it('surge to hit: all surges become hits', () => {
    const result = resolveStep(
      { crit: 0, surge: 2, hit: 1, blank: 0 },
      0,
      'hit',
      0
    );
    expect(result.hits).toBe(3);
    expect(result.crits).toBe(0);
  });

  it('Critical 1 with surge none and 1 token: one surge to crit, one surge to hit via token', () => {
    const result = resolveStep(
      { crit: 0, surge: 2, hit: 0, blank: 0 },
      1,
      'none',
      1
    );
    expect(result.crits).toBe(1);
    expect(result.hits).toBe(1);
  });
});

describe('applyRerolls', () => {
  it('zero reroll rounds (no Aim or Observe) leaves hits and crits unchanged', () => {
    const rng = createSeededRng(1);
    const result = applyRerolls(
      { crit: 0, surge: 0, hit: 1, blank: 2 },
      { hits: 1, crits: 0 },
      { red: 1, black: 0, white: 0 },
      'none',
      0,
      0,
      0,
      rng
    );
    expect(result.hits).toBe(1);
    expect(result.crits).toBe(0);
  });

  it('1 observe token with 1 blank: reroll adds 0 or 1 success', () => {
    const pool: AttackPool = { red: 0, black: 0, white: 1 };
    const raw = { crit: 0, surge: 0, hit: 0, blank: 1 };
    const resolved = { hits: 0, crits: 0 };
    const rng = createSeededRng(100);
    const result = applyRerolls(raw, resolved, pool, 'none', 0, 1, 0, rng);
    expect(result.hits + result.crits).toBeGreaterThanOrEqual(0);
    expect(result.hits + result.crits).toBeLessThanOrEqual(1);
  });
});

describe('applyRam', () => {
  it('Ram 0 leaves hits and crits unchanged', () => {
    const result = applyRam(2, 1, 0, 0);
    expect(result.hits).toBe(2);
    expect(result.crits).toBe(1);
  });

  it('Ram 1 with 1 blank converts that blank to 1 crit', () => {
    const result = applyRam(0, 0, 1, 1);
    expect(result.hits).toBe(0);
    expect(result.crits).toBe(1);
  });

  it('Ram 2 with 1 blank and 1 hit converts both to crits', () => {
    const result = applyRam(1, 0, 1, 2);
    expect(result.hits).toBe(0);
    expect(result.crits).toBe(2);
  });
});

describe('simulateAttackPool', () => {
  it('returns AttackResults shape with expectedTotal close to 6/8 for 1 red die, surge none', () => {
    const pool: AttackPool = { red: 1, black: 0, white: 0 };
    const rng = createSeededRng(1);
    const result = simulateAttackPool(
      pool,
      'none',
      undefined,
      0,
      0,
      0,
      0,
      0,
      50_000,
      rng
    );
    expect(result.expectedTotal).toBeCloseTo(6 / 8, 1);
    expect(result.expectedHits).toBeCloseTo(5 / 8, 1);
    expect(result.expectedCrits).toBeCloseTo(1 / 8, 1);
    const sumProb = result.distribution.reduce(
      (acc, entry) => acc + entry.probability,
      0
    );
    expect(sumProb).toBeCloseTo(1, 2);
  });
});

describe('resolveDefenseRoll', () => {
  it('surge block: returns blocks + surges', () => {
    expect(resolveDefenseRoll(2, 1, 'block', 0)).toBe(3);
    expect(resolveDefenseRoll(0, 2, 'block', 5)).toBe(2);
  });
  it('surge none, 0 tokens: returns blocks only', () => {
    expect(resolveDefenseRoll(2, 1, 'none', 0)).toBe(2);
  });
  it('surge none, tokens < surges: returns blocks + tokens', () => {
    expect(resolveDefenseRoll(1, 3, 'none', 2)).toBe(3);
  });
  it('surge none, tokens >= surges: returns blocks + surges', () => {
    expect(resolveDefenseRoll(1, 2, 'none', 5)).toBe(3);
  });
  it('normalizes negative/undefined defenseSurgeTokens to 0', () => {
    expect(resolveDefenseRoll(1, 1, 'none', undefined)).toBe(1);
    expect(resolveDefenseRoll(1, 1, 'none', -1)).toBe(1);
  });
});

describe('getRerollableDefenseIndices', () => {
  it('surge block: only blanks are rerollable', () => {
    const faces = ['block', 'surge', 'blank', 'blank'] as const;
    expect(getRerollableDefenseIndices([...faces], 'block', 0)).toEqual([2, 3]);
  });

  it('surge none, 0 tokens: blanks and all surges rerollable', () => {
    const faces = ['block', 'surge', 'blank', 'surge'] as const;
    expect(getRerollableDefenseIndices([...faces], 'none', 0)).toEqual([
      2, 1, 3,
    ]);
  });

  it('surge none, tokens convert first surges: excess surges rerollable', () => {
    const faces = ['surge', 'surge', 'surge', 'blank'] as const;
    expect(getRerollableDefenseIndices([...faces], 'none', 2)).toEqual([3, 2]);
  });

  it('all blocks: empty rerollable list', () => {
    expect(getRerollableDefenseIndices(['block', 'block'], 'none', 5)).toEqual(
      []
    );
  });
});

describe('prioritizeRedDefenseRerollIndices', () => {
  it('puts red rerollable indices before white', () => {
    const outcomes: DefenseDieOutcome[] = [
      { color: 'white', face: 'blank' },
      { color: 'red', face: 'blank' },
      { color: 'white', face: 'blank' },
      { color: 'red', face: 'surge' },
    ];
    expect(prioritizeRedDefenseRerollIndices(outcomes, [0, 1, 2, 3])).toEqual([
      1, 3, 0, 2,
    ]);
  });

  it('leaves a same-color list in original order', () => {
    const outcomes: DefenseDieOutcome[] = [
      { color: 'red', face: 'blank' },
      { color: 'red', face: 'surge' },
    ];
    expect(prioritizeRedDefenseRerollIndices(outcomes, [0, 1])).toEqual([0, 1]);
  });
});

describe('applyUncannyLuckRerolls', () => {
  it('uncannyLuckX 0 leaves faces unchanged', () => {
    const faces: DefenseFace[] = ['blank', 'block'];
    const rng = createSeededRng(1);
    applyUncannyLuckRerolls(faces, 0, 'block', 0, 'red', rng);
    expect(faces).toEqual(['blank', 'block']);
  });

  it('with seeded rng, X=2 increases average block count vs no reroll', () => {
    const runs = 2000;
    const rngNoReroll = createSeededRng(42);
    const rngReroll = createSeededRng(42);
    let sumBlocksNoReroll = 0;
    let sumBlocksReroll = 0;
    for (let run = 0; run < runs; run++) {
      const facesNoReroll: ('block' | 'surge' | 'blank')[] = [];
      const facesReroll: ('block' | 'surge' | 'blank')[] = [];
      for (let die = 0; die < 5; die++) {
        facesNoReroll.push(rollOneDefenseDieOutcome('red', rngNoReroll));
        facesReroll.push(rollOneDefenseDieOutcome('red', rngReroll));
      }
      let blockCount = 0;
      for (const face of facesNoReroll) {
        if (face === 'block') blockCount++;
      }
      sumBlocksNoReroll += blockCount;
      applyUncannyLuckRerolls(facesReroll, 2, 'block', 0, 'red', rngReroll);
      blockCount = 0;
      for (const face of facesReroll) {
        if (face === 'block') blockCount++;
      }
      sumBlocksReroll += blockCount;
    }
    expect(sumBlocksReroll / runs).toBeGreaterThan(sumBlocksNoReroll / runs);
  });
});

describe('rollOneDefenseDieOutcome', () => {
  it('red die: over many rolls block/surge/blank proportions match 3/1/2', () => {
    const rng = createSeededRng(42);
    const counts = { block: 0, surge: 0, blank: 0 };
    for (let i = 0; i < 6000; i++) {
      const face = rollOneDefenseDieOutcome('red', rng);
      counts[face]++;
    }
    expect(counts.block).toBeGreaterThan(2500);
    expect(counts.block).toBeLessThan(3500);
    expect(counts.surge).toBeGreaterThan(800);
    expect(counts.surge).toBeLessThan(1200);
    expect(counts.blank).toBeGreaterThan(1800);
    expect(counts.blank).toBeLessThan(2200);
  });
});

describe('defense simulation', () => {
  it('rollOneDefenseDie returns 0 or 1', () => {
    const rng = createSeededRng(1);
    const results = new Set<number>();
    for (let i = 0; i < 50; i++) {
      results.add(rollOneDefenseDie('red', 'none', rng));
    }
    expect(results).toEqual(new Set([0, 1]));
  });

  it('simulateDefensePool 0 dice returns 0 blocks', () => {
    const rng = createSeededRng(1);
    const result = simulateDefensePool(
      { red: 0, white: 0 },
      'none',
      undefined,
      100,
      rng
    );
    expect(result.expectedBlocks).toBe(0);
    expect(result.distribution[0].probability).toBeCloseTo(1, 2);
  });

  it('simulateDefensePool with uncannyLuckX 2 has higher expectedBlocks than 0', () => {
    const rngNone = createSeededRng(7);
    const rngUncanny = createSeededRng(7);
    const pool = { red: 4, white: 0 };
    const noUncanny = simulateDefensePool(
      pool,
      'block',
      undefined,
      5000,
      rngNone,
      0
    );
    const withUncanny = simulateDefensePool(
      pool,
      'block',
      undefined,
      5000,
      rngUncanny,
      2
    );
    expect(withUncanny.expectedBlocks).toBeGreaterThan(
      noUncanny.expectedBlocks
    );
  });

  it('getDefenseDistributionForDiceCountSim 1 red die surge none: expectedBlocks close to 3/6', () => {
    const rng = createSeededRng(1);
    const result = getDefenseDistributionForDiceCountSim(
      1,
      'red',
      'none',
      undefined,
      10_000,
      rng
    );
    expect(result.expectedBlocks).toBeCloseTo(3 / 6, 1);
  });
});

describe('getEffectiveCover', () => {
  it('none stays none for any X', () => {
    expect(getEffectiveCover('none', 0)).toBe('none');
    expect(getEffectiveCover('none', 1)).toBe('none');
    expect(getEffectiveCover('none', 2)).toBe('none');
  });

  it('light: 0 stays light, 1 becomes none, 2+ stays none', () => {
    expect(getEffectiveCover('light', 0)).toBe('light');
    expect(getEffectiveCover('light', 1)).toBe('none');
    expect(getEffectiveCover('light', 2)).toBe('none');
    expect(getEffectiveCover('light', 3)).toBe('none');
  });

  it('heavy: 0 stays heavy, 1 becomes light, 2+ becomes none', () => {
    expect(getEffectiveCover('heavy', 0)).toBe('heavy');
    expect(getEffectiveCover('heavy', 1)).toBe('light');
    expect(getEffectiveCover('heavy', 2)).toBe('none');
    expect(getEffectiveCover('heavy', 3)).toBe('none');
  });

  it('negative X treated as 0', () => {
    expect(getEffectiveCover('heavy', -1)).toBe('heavy');
    expect(getEffectiveCover('light', -1)).toBe('light');
  });

  it('suppressed true: improves cover by 1 then sharpshooter applies', () => {
    expect(getEffectiveCover('none', 0, true)).toBe('light');
    expect(getEffectiveCover('light', 0, true)).toBe('heavy');
    expect(getEffectiveCover('heavy', 0, true)).toBe('heavy');
    expect(getEffectiveCover('light', 1, true)).toBe('light');
  });

  it('coverX: improves by X then cap at heavy; sharpshooter applies after', () => {
    expect(getEffectiveCover('none', 0, false, 1)).toBe('light');
    expect(getEffectiveCover('none', 0, false, 2)).toBe('heavy');
    expect(getEffectiveCover('light', 0, false, 1)).toBe('heavy');
    expect(getEffectiveCover('heavy', 0, false, 2)).toBe('heavy');
    expect(getEffectiveCover('none', 0, true, 1)).toBe('heavy');
    expect(getEffectiveCover('heavy', 1, false, 1)).toBe('light');
  });
});

describe('applyCover', () => {
  it('none: returns hits and crits unchanged', () => {
    const rng = createSeededRng(42);
    expect(applyCover(3, 1, 'none', rng, 0)).toEqual({ hits: 3, crits: 1 });
    expect(applyCover(0, 2, 'none', rng, undefined)).toEqual({
      hits: 0,
      crits: 2,
    });
  });
  it('zero hits: returns 0 hits and crits unchanged', () => {
    const rng = createSeededRng(99);
    expect(applyCover(0, 1, 'light', rng, 0)).toEqual({ hits: 0, crits: 1 });
    expect(applyCover(0, 1, 'heavy', rng, 0)).toEqual({ hits: 0, crits: 1 });
  });
  it('light: crits unchanged', () => {
    const rng = createSeededRng(123);
    const result = applyCover(2, 3, 'light', rng, 0);
    expect(result.crits).toBe(3);
    expect(result.hits).toBeLessThanOrEqual(2);
  });
  it('heavy: crits unchanged, hits never exceed original', () => {
    const rng = createSeededRng(456);
    const result = applyCover(4, 2, 'heavy', rng, 0);
    expect(result.crits).toBe(2);
    expect(result.hits).toBeLessThanOrEqual(4);
    expect(result.hits).toBeGreaterThanOrEqual(0);
  });
  it('sharpshooter 2: heavy becomes none so hits and crits unchanged', () => {
    const rng = createSeededRng(1);
    expect(applyCover(3, 1, 'heavy', rng, 2)).toEqual({ hits: 3, crits: 1 });
  });
  it('sharpshooter 1: heavy becomes light so only blocks cancel hits', () => {
    const rng1 = createSeededRng(100);
    const rng2 = createSeededRng(100);
    const withHeavyAndSharpshooter1 = applyCover(4, 2, 'heavy', rng1, 1);
    const withLightNoSharpshooter = applyCover(4, 2, 'light', rng2, 0);
    expect(withHeavyAndSharpshooter1).toEqual(withLightNoSharpshooter);
  });
  it('suppressed true: none behaves like light', () => {
    const rng1 = createSeededRng(200);
    const rng2 = createSeededRng(200);
    const noneSuppressed = applyCover(2, 1, 'none', rng1, 0, true);
    const lightNoSuppressed = applyCover(2, 1, 'light', rng2, 0);
    expect(noneSuppressed).toEqual(lightNoSuppressed);
  });
  it('coverX 1: none behaves like light', () => {
    const rng1 = createSeededRng(300);
    const rng2 = createSeededRng(300);
    const noneCover1 = applyCover(2, 1, 'none', rng1, 0, false, 1);
    const lightNoCoverX = applyCover(2, 1, 'light', rng2, 0);
    expect(noneCover1).toEqual(lightNoCoverX);
  });
  it('coverDieColor red: with same seed can cancel more hits than white (red has more blocks)', () => {
    const rngWhite = createSeededRng(777);
    const rngRed = createSeededRng(777);
    const withWhite = applyCover(4, 2, 'heavy', rngWhite, 0);
    const withRed = applyCover(
      4,
      2,
      'heavy',
      rngRed,
      0,
      false,
      undefined,
      'red'
    );
    // Red die has 3 block faces vs white 1; so red should cancel at least as many hits
    expect(withRed.hits).toBeLessThanOrEqual(withWhite.hits);
  });
});

describe('simulateWounds', () => {
  it('1 red die vs red defense none, 0 dodge: expectedWounds close to 3/8', () => {
    // E[wounds] = E[attack] * (1 - P(block)) for 1v1 ≈ (6/8) * (1 - 3/6) = 3/8
    const pool: AttackPool = { red: 1, black: 0, white: 0 };
    const rng = createSeededRng(1);
    const result = simulateWounds(
      pool,
      'none',
      undefined,
      0,
      0,
      0,
      0,
      0,
      'red',
      'none',
      0,
      0, // shieldTokens
      false, // outmaneuver
      undefined, // defenseSurgeTokens
      'none', // cover
      false, // lowProfile
      false, // suppressed
      0, // coverX
      'white', // coverDieColor
      0, // sharpshooterX
      false, // backup
      0, // armorX
      0, // impactX
      0, // pierceX
      false, // impervious
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      20_000,
      rng
    );
    expect(result.expectedWounds).toBeCloseTo(3 / 8, 1);
  });
});

describe('shield tokens in wounds simulation', () => {
  it('1 hit 1 crit, 1 shield 1 dodge: 0 defense dice so expected wounds 0', () => {
    const attackResults = {
      expectedHits: 1,
      expectedCrits: 1,
      expectedTotal: 2,
      distribution: [],
      distributionByHitsCrits: [{ hits: 1, crits: 1, probability: 1 }],
      cumulative: [],
    };
    const runs = 1000;
    const rng = () => 0.5;
    const result = simulateWoundsFromAttackResults(
      attackResults,
      'red',
      'none',
      1, // dodgeTokens
      1, // shieldTokens
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
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rng
    );
    expect(result.expectedWounds).toBe(0);
  });
});

describe('defense surge tokens in wounds simulation', () => {
  it('with 1 hit 0 crits, surge none, 1 red defense die: 1 token yields higher avg blocks than 0 tokens', () => {
    const attackResults = {
      expectedHits: 1,
      expectedCrits: 0,
      expectedTotal: 1,
      distribution: [
        { total: 0, probability: 0 },
        { total: 1, probability: 1 },
      ],
      distributionByHitsCrits: [{ hits: 1, crits: 0, probability: 1 }],
      cumulative: [
        { total: 0, probability: 1 },
        { total: 1, probability: 0 },
      ],
    };
    const runs = 10_000;
    const rngZero = createSeededRng(100);
    const rngOne = createSeededRng(100);
    const resultZero = simulateWoundsFromAttackResults(
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
      0,
      false,
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rngZero
    );
    const resultOne = simulateWoundsFromAttackResults(
      attackResults,
      'red',
      'none',
      0,
      0,
      false,
      1,
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
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rngOne
    );
    const expectedBlocksZero = 1 - resultZero.expectedWounds;
    const expectedBlocksOne = 1 - resultOne.expectedWounds;
    expect(expectedBlocksOne).toBeGreaterThan(expectedBlocksZero);
  });
});

describe('cover in wounds simulation', () => {
  it('1 hit 0 crits: light cover yields lower expected wounds than none', () => {
    const attackResults = {
      expectedHits: 1,
      expectedCrits: 0,
      expectedTotal: 1,
      distribution: [
        { total: 0, probability: 0 },
        { total: 1, probability: 1 },
      ],
      distributionByHitsCrits: [{ hits: 1, crits: 0, probability: 1 }],
      cumulative: [
        { total: 0, probability: 1 },
        { total: 1, probability: 0 },
      ],
    };
    const runs = 10_000;
    const rngNone = createSeededRng(200);
    const rngLight = createSeededRng(200);
    const resultNone = simulateWoundsFromAttackResults(
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
      0,
      false,
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rngNone
    );
    const resultLight = simulateWoundsFromAttackResults(
      attackResults,
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
      0,
      false,
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rngLight
    );
    expect(resultLight.expectedWounds).toBeLessThan(resultNone.expectedWounds);
  });
  it('light cover with Low Profile on yields lower expected wounds than Low Profile off', () => {
    const attackResults = {
      expectedHits: 4,
      expectedCrits: 0,
      expectedTotal: 4,
      distribution: [
        { total: 0, probability: 0 },
        { total: 1, probability: 0 },
        { total: 2, probability: 0 },
        { total: 3, probability: 0 },
        { total: 4, probability: 1 },
      ],
      distributionByHitsCrits: [{ hits: 4, crits: 0, probability: 1 }],
      cumulative: [
        { total: 0, probability: 1 },
        { total: 1, probability: 0 },
        { total: 2, probability: 0 },
        { total: 3, probability: 0 },
        { total: 4, probability: 0 },
      ],
    };
    const runs = 10_000;
    const rngOff = createSeededRng(400);
    const rngOn = createSeededRng(400);
    const resultOff = simulateWoundsFromAttackResults(
      attackResults,
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
      0,
      false,
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rngOff
    );
    const resultOn = simulateWoundsFromAttackResults(
      attackResults,
      'red',
      'none',
      0,
      0,
      false,
      0,
      'light',
      true,
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
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rngOn
    );
    expect(resultOn.expectedWounds).toBeLessThan(resultOff.expectedWounds);
  });
  it('sharpshooter 1 with heavy cover yields higher expected wounds than no sharpshooter', () => {
    const attackResults = {
      expectedHits: 2,
      expectedCrits: 0,
      expectedTotal: 2,
      distribution: [
        { total: 0, probability: 0 },
        { total: 1, probability: 0 },
        { total: 2, probability: 1 },
      ],
      distributionByHitsCrits: [{ hits: 2, crits: 0, probability: 1 }],
      cumulative: [
        { total: 0, probability: 1 },
        { total: 1, probability: 0 },
        { total: 2, probability: 0 },
      ],
    };
    const runs = 10_000;
    const rngNoSharp = createSeededRng(300);
    const rngSharp = createSeededRng(300);
    const noSharpshooter = simulateWoundsFromAttackResults(
      attackResults,
      'red',
      'none',
      0,
      0,
      false,
      0,
      'heavy',
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
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rngNoSharp
    );
    const withSharpshooter1 = simulateWoundsFromAttackResults(
      attackResults,
      'red',
      'none',
      0,
      0,
      false,
      0,
      'heavy',
      false,
      false,
      0,
      'white',
      1,
      false,
      0,
      0,
      0,
      false,
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rngSharp
    );
    expect(withSharpshooter1.expectedWounds).toBeGreaterThan(
      noSharpshooter.expectedWounds
    );
  });
  it('cover none with Suppressed on yields lower expected wounds than Suppressed off', () => {
    const attackResults = {
      expectedHits: 3,
      expectedCrits: 0,
      expectedTotal: 3,
      distribution: [
        { total: 0, probability: 0 },
        { total: 1, probability: 0 },
        { total: 2, probability: 0 },
        { total: 3, probability: 1 },
      ],
      distributionByHitsCrits: [{ hits: 3, crits: 0, probability: 1 }],
      cumulative: [
        { total: 0, probability: 1 },
        { total: 1, probability: 0 },
        { total: 2, probability: 0 },
        { total: 3, probability: 0 },
      ],
    };
    const runs = 5000;
    const rngOff = createSeededRng(801);
    const rngOn = createSeededRng(801);
    const resultOff = simulateWoundsFromAttackResults(
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
      0, // coverX
      'white',
      0,
      false,
      0,
      0,
      0,
      false,
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rngOff
    );
    const resultOn = simulateWoundsFromAttackResults(
      attackResults,
      'red',
      'none',
      0,
      0,
      false,
      0,
      'none',
      false,
      true,
      0, // coverX
      'white',
      0,
      false,
      0,
      0,
      0,
      false,
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rngOn
    );
    expect(resultOn.expectedWounds).toBeLessThan(resultOff.expectedWounds);
  });
  it('cover none + coverX 1 yields lower expected wounds than cover none + coverX 0', () => {
    const attackResults = {
      distributionByHitsCrits: [{ hits: 2, crits: 0, probability: 1 }],
    } as AttackResults;
    const rng = createSeededRng(400);
    const woundsNoneCover0 = simulateWoundsFromAttackResults(
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
      0, // coverX
      'white',
      0,
      false,
      0,
      0,
      0,
      false,
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      10_000,
      rng
    );
    const woundsNoneCover1 = simulateWoundsFromAttackResults(
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
      1, // coverX
      'white',
      0,
      false,
      0,
      0,
      0,
      false,
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      10_000,
      rng
    );
    expect(woundsNoneCover1.expectedWounds).toBeLessThanOrEqual(
      woundsNoneCover0.expectedWounds
    );
  });
});

describe('cover die color in wounds simulation', () => {
  it('red cover dice with light cover yield lower or equal expected wounds than white', () => {
    const attackResults: AttackResults = {
      expectedHits: 2,
      expectedCrits: 0,
      expectedTotal: 2,
      distribution: [],
      distributionByHitsCrits: [{ hits: 2, crits: 0, probability: 1 }],
      cumulative: [],
    };
    const runs = 5000;
    const rng = createSeededRng(42);
    const woundsWhite = simulateWoundsFromAttackResults(
      attackResults,
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
      0,
      false,
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rng
    );
    const rngRed = createSeededRng(42);
    const woundsRed = simulateWoundsFromAttackResults(
      attackResults,
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
      'red',
      0,
      false,
      0,
      0,
      0,
      false,
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rngRed
    );
    expect(woundsRed.expectedWounds).toBeLessThanOrEqual(
      woundsWhite.expectedWounds
    );
  });
});

describe('backup in wounds simulation', () => {
  it('3 hits 0 crits: backup on yields lower expected wounds than backup off', () => {
    const attackResults = {
      expectedHits: 3,
      expectedCrits: 0,
      expectedTotal: 3,
      distribution: [
        { total: 0, probability: 0 },
        { total: 1, probability: 0 },
        { total: 2, probability: 0 },
        { total: 3, probability: 1 },
      ],
      distributionByHitsCrits: [{ hits: 3, crits: 0, probability: 1 }],
      cumulative: [
        { total: 0, probability: 1 },
        { total: 1, probability: 0 },
        { total: 2, probability: 0 },
        { total: 3, probability: 0 },
      ],
    };
    const runs = 10_000;
    const rngOff = createSeededRng(500);
    const rngOn = createSeededRng(500);
    const resultOff = simulateWoundsFromAttackResults(
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
      0, // coverX
      'white',
      0,
      false,
      0,
      0,
      0,
      false,
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rngOff
    );
    const resultOn = simulateWoundsFromAttackResults(
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
      0, // coverX
      'white',
      0,
      true,
      0,
      0,
      0,
      false,
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rngOn
    );
    // Backup removes 2 hits → 1 defense die instead of 3; fewer dice to roll, different wound distribution
    expect(resultOn.expectedWounds).toBeLessThan(resultOff.expectedWounds);
  });
});

describe('Pierce X in wounds simulation', () => {
  it('pierce 0 yields same result as baseline (no canceling blocks)', () => {
    const attackResults = {
      expectedHits: 1,
      expectedCrits: 0,
      expectedTotal: 1,
      distribution: [
        { total: 0, probability: 0 },
        { total: 1, probability: 1 },
      ],
      distributionByHitsCrits: [{ hits: 1, crits: 0, probability: 1 }],
      cumulative: [
        { total: 0, probability: 1 },
        { total: 1, probability: 0 },
      ],
    };
    const runs = 5_000;
    const rng = createSeededRng(900);
    const withPierce0 = simulateWoundsFromAttackResults(
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
      0,
      false,
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rng
    );
    const rng2 = createSeededRng(900);
    const again = simulateWoundsFromAttackResults(
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
      0,
      false,
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rng2
    );
    expect(again.expectedWounds).toBeCloseTo(withPierce0.expectedWounds, 10);
  });

  it('pierce 3 with 3 hits and 3 defense dice yields higher expected wounds than pierce 0', () => {
    const attackResults = {
      expectedHits: 3,
      expectedCrits: 0,
      expectedTotal: 3,
      distribution: [
        { total: 0, probability: 0 },
        { total: 1, probability: 0 },
        { total: 2, probability: 0 },
        { total: 3, probability: 1 },
      ],
      distributionByHitsCrits: [{ hits: 3, crits: 0, probability: 1 }],
      cumulative: [
        { total: 0, probability: 1 },
        { total: 1, probability: 0 },
        { total: 2, probability: 0 },
        { total: 3, probability: 0 },
      ],
    };
    const runs = 10_000;
    const rngZero = createSeededRng(1000);
    const rngThree = createSeededRng(1000);
    const pierce0 = simulateWoundsFromAttackResults(
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
      0,
      false,
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rngZero
    );
    const pierce3 = simulateWoundsFromAttackResults(
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
      0, // coverX
      'white',
      0,
      false,
      0,
      0,
      3,
      false,
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rngThree
    );
    expect(pierce3.expectedWounds).toBeGreaterThan(pierce0.expectedWounds);
  });
});

describe('Armor X in wounds simulation', () => {
  it('armorX 3 with 4 hits 1 crit yields lower or equal expected wounds than armorX 0', () => {
    const attackResults = {
      expectedHits: 4,
      expectedCrits: 1,
      expectedTotal: 5,
      distribution: [
        { total: 0, probability: 0 },
        { total: 1, probability: 0 },
        { total: 2, probability: 0 },
        { total: 3, probability: 0 },
        { total: 4, probability: 0 },
        { total: 5, probability: 1 },
      ],
      distributionByHitsCrits: [{ hits: 4, crits: 1, probability: 1 }],
      cumulative: [
        { total: 0, probability: 1 },
        { total: 1, probability: 0 },
        { total: 2, probability: 0 },
        { total: 3, probability: 0 },
        { total: 4, probability: 0 },
        { total: 5, probability: 0 },
      ],
    };
    const runs = 5000;
    const rngArmor0 = createSeededRng(2000);
    const rngArmor3 = createSeededRng(2000);
    const woundsArmor0 = simulateWoundsFromAttackResults(
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
      0,
      false,
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rngArmor0
    );
    const woundsArmor3 = simulateWoundsFromAttackResults(
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
      3,
      0,
      0,
      false,
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rngArmor3
    );
    expect(woundsArmor3.expectedWounds).toBeLessThanOrEqual(
      woundsArmor0.expectedWounds
    );
  });
});

describe('Impact X in wounds simulation', () => {
  it('impactX 2 with armorX 3 yields higher or equal expected wounds than impactX 0', () => {
    const attackResults = {
      expectedHits: 4,
      expectedCrits: 1,
      expectedTotal: 5,
      distribution: [
        { total: 0, probability: 0 },
        { total: 1, probability: 0 },
        { total: 2, probability: 0 },
        { total: 3, probability: 0 },
        { total: 4, probability: 0 },
        { total: 5, probability: 1 },
      ],
      distributionByHitsCrits: [{ hits: 4, crits: 1, probability: 1 }],
      cumulative: [
        { total: 0, probability: 1 },
        { total: 1, probability: 0 },
        { total: 2, probability: 0 },
        { total: 3, probability: 0 },
        { total: 4, probability: 0 },
        { total: 5, probability: 0 },
      ],
    };
    const runs = 5000;
    const rngImpact0 = createSeededRng(3000);
    const rngImpact2 = createSeededRng(3000);
    const woundsImpact0 = simulateWoundsFromAttackResults(
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
      3, // armorX
      0, // impactX
      0, // pierceX
      false,
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rngImpact0
    );
    const woundsImpact2 = simulateWoundsFromAttackResults(
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
      3, // armorX
      2, // impactX
      0, // pierceX
      false,
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rngImpact2
    );
    expect(woundsImpact2.expectedWounds).toBeGreaterThanOrEqual(
      woundsImpact0.expectedWounds
    );
  });

  it('impactX 2 with 2 hits 0 crits: armorX 2 and armorX 3 give identical wounds distribution', () => {
    const attackResults: AttackResults = {
      expectedHits: 2,
      expectedCrits: 0,
      expectedTotal: 2,
      distribution: [
        { total: 0, probability: 0 },
        { total: 1, probability: 0 },
        { total: 2, probability: 1 },
      ],
      distributionByHitsCrits: [{ hits: 2, crits: 0, probability: 1 }],
      cumulative: [
        { total: 0, probability: 1 },
        { total: 1, probability: 0 },
        { total: 2, probability: 0 },
      ],
    };
    const runs = 5000;
    const rngArmor2 = createSeededRng(4242);
    const rngArmor3 = createSeededRng(4242);
    const woundsArmor2 = simulateWoundsFromAttackResults(
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
      2,
      2,
      0,
      false,
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rngArmor2
    );
    const woundsArmor3 = simulateWoundsFromAttackResults(
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
      3,
      2,
      0,
      false,
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rngArmor3
    );
    expect(woundsArmor2.expectedWounds).toBe(woundsArmor3.expectedWounds);
    expect(woundsArmor2.distribution).toEqual(woundsArmor3.distribution);
  });
});

describe('pierceBlocksCancelled', () => {
  it('impervious with blocks reduces pierce by 1', () => {
    expect(pierceBlocksCancelled(5, 3, true)).toBe(2);
    expect(effectiveBlocksAfterPierce(5, 3, true)).toBe(3);
  });

  it('impervious with no blocks uses full pierce', () => {
    expect(pierceBlocksCancelled(0, 3, true)).toBe(3);
    expect(effectiveBlocksAfterPierce(0, 3, true)).toBe(0);
  });

  it('without impervious uses full pierce when blocks present', () => {
    expect(pierceBlocksCancelled(5, 3, false)).toBe(3);
    expect(effectiveBlocksAfterPierce(5, 3, false)).toBe(2);
  });

  it('pierce 1 with impervious and blocks cancels zero', () => {
    expect(pierceBlocksCancelled(2, 1, true)).toBe(0);
    expect(effectiveBlocksAfterPierce(2, 1, true)).toBe(2);
  });
});

describe('Impervious in wounds simulation', () => {
  it('impervious true with pierce 3 yields lower or equal expected wounds than impervious false', () => {
    const attackResults: AttackResults = {
      expectedHits: 2,
      expectedCrits: 0,
      expectedTotal: 2,
      distribution: [],
      distributionByHitsCrits: [{ hits: 2, crits: 0, probability: 1 }],
      cumulative: [],
    };
    const runs = 5000;
    const rngNoImpervious = createSeededRng(42);
    const rngImpervious = createSeededRng(42);
    const woundsNoImpervious = simulateWoundsFromAttackResults(
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
      3, // pierceX
      false,
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rngNoImpervious
    );
    const woundsImpervious = simulateWoundsFromAttackResults(
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
      3, // pierceX
      true,
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rngImpervious
    );
    expect(woundsImpervious.expectedWounds).toBeLessThanOrEqual(
      woundsNoImpervious.expectedWounds
    );
  });

  it('impervious true with pierce 2 yields lower or equal expected wounds than impervious false', () => {
    const attackResults: AttackResults = {
      expectedHits: 2,
      expectedCrits: 0,
      expectedTotal: 2,
      distribution: [],
      distributionByHitsCrits: [{ hits: 2, crits: 0, probability: 1 }],
      cumulative: [],
    };
    const runs = 5000;
    const rng = createSeededRng(42);
    const woundsNoImpervious = simulateWoundsFromAttackResults(
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
      false, // impervious
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rng
    );
    const woundsImpervious = simulateWoundsFromAttackResults(
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
      true, // impervious
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rng
    );
    expect(woundsImpervious.expectedWounds).toBeLessThanOrEqual(
      woundsNoImpervious.expectedWounds
    );
  });

  it('impervious with pierce 0 yields same expected wounds as no impervious', () => {
    const attackResults: AttackResults = {
      expectedHits: 2,
      expectedCrits: 0,
      expectedTotal: 2,
      distribution: [],
      distributionByHitsCrits: [{ hits: 2, crits: 0, probability: 1 }],
      cumulative: [],
    };
    const runs = 5000;
    const rngNoImpervious = createSeededRng(42);
    const rngImpervious = createSeededRng(42);
    const woundsNoImpervious = simulateWoundsFromAttackResults(
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
      0, // pierceX
      false,
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rngNoImpervious
    );
    const woundsImpervious = simulateWoundsFromAttackResults(
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
      0, // pierceX
      true,
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rngImpervious
    );
    expect(woundsImpervious.expectedWounds).toBeCloseTo(
      woundsNoImpervious.expectedWounds,
      10
    );
  });
});

describe('Uncanny Luck X in wounds simulation', () => {
  it('uncannyLuckX 2 yields lower or equal expected wounds than 0 for fixed attack', () => {
    const attackResults: AttackResults = {
      expectedHits: 3,
      expectedCrits: 1,
      expectedTotal: 4,
      distribution: [],
      distributionByHitsCrits: [{ hits: 3, crits: 1, probability: 1 }],
      cumulative: [],
    };
    const runs = 5000;
    const woundsNone = simulateWoundsFromAttackResults(
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
      0,
      false,
      0,
      0,
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      createSeededRng(42)
    );
    const woundsUncanny2 = simulateWoundsFromAttackResults(
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
      0,
      false,
      0,
      0,
      2, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      createSeededRng(42)
    );
    expect(woundsUncanny2.expectedWounds).toBeLessThanOrEqual(
      woundsNone.expectedWounds
    );
  });
});

describe('Danger Sense X in wounds simulation', () => {
  it('dangerSenseX 2 with 2 suppression yields lower or equal expected wounds than 0/0', () => {
    const attackResults: AttackResults = {
      expectedHits: 3,
      expectedCrits: 1,
      expectedTotal: 4,
      distribution: [],
      distributionByHitsCrits: [{ hits: 3, crits: 1, probability: 1 }],
      cumulative: [],
    };
    const runs = 5000;
    const rng = createSeededRng(42);
    const woundsNone = simulateWoundsFromAttackResults(
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
      0,
      false,
      0, // suppressionTokens
      0, // dangerSenseX
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rng
    );
    const woundsDangerSense2 = simulateWoundsFromAttackResults(
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
      0,
      false,
      2, // suppressionTokens
      2, // dangerSenseX
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rng
    );
    expect(woundsDangerSense2.expectedWounds).toBeLessThanOrEqual(
      woundsNone.expectedWounds
    );
  });

  it('Danger Sense 2 caps extra dice at 2: 3 tokens and 2 tokens yield same expected wounds', () => {
    const attackResults: AttackResults = {
      expectedHits: 3,
      expectedCrits: 1,
      expectedTotal: 4,
      distribution: [],
      distributionByHitsCrits: [{ hits: 3, crits: 1, probability: 1 }],
      cumulative: [],
    };
    const runs = 5000;
    const seed = 100;
    const rngTwoTokens = createSeededRng(seed);
    const rngThreeTokens = createSeededRng(seed);
    const woundsTwoTokens = simulateWoundsFromAttackResults(
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
      0,
      false,
      2, // suppressionTokens
      2, // dangerSenseX
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rngTwoTokens
    );
    const woundsThreeTokens = simulateWoundsFromAttackResults(
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
      0,
      false,
      3, // suppressionTokens
      2, // dangerSenseX
      0, // uncannyLuckX
      0, // downgradeDefenseX
      runs,
      rngThreeTokens
    );
    expect(woundsThreeTokens.expectedWounds).toBeCloseTo(
      woundsTwoTokens.expectedWounds,
      5
    );
  });
});

describe('splitDowngradedDefensePool', () => {
  it('keeps all dice white when the defender is white, for any X', () => {
    expect(splitDowngradedDefensePool('white', 5, 0)).toEqual({
      red: 0,
      white: 5,
    });
    expect(splitDowngradedDefensePool('white', 5, 3)).toEqual({
      red: 0,
      white: 5,
    });
  });

  it('keeps all dice red when X is 0', () => {
    expect(splitDowngradedDefensePool('red', 4, 0)).toEqual({
      red: 4,
      white: 0,
    });
  });

  it('converts min(X, total) red dice to white', () => {
    expect(splitDowngradedDefensePool('red', 5, 2)).toEqual({
      red: 3,
      white: 2,
    });
  });

  it('converts the whole pool when X is greater than total', () => {
    expect(splitDowngradedDefensePool('red', 2, 4)).toEqual({
      red: 0,
      white: 2,
    });
  });

  it('treats negative X as 0', () => {
    expect(splitDowngradedDefensePool('red', 3, -2)).toEqual({
      red: 3,
      white: 0,
    });
  });
});

describe('Downgrade Defense X in wounds simulation', () => {
  const attackResults: AttackResults = {
    expectedHits: 3,
    expectedCrits: 1,
    expectedTotal: 4,
    distribution: [],
    distributionByHitsCrits: [{ hits: 3, crits: 1, probability: 1 }],
    cumulative: [],
  };
  const runs = 5000;

  it('red defender: Downgrade 2 yields higher or equal expected wounds than 0', () => {
    const woundsNone = simulateWoundsFromAttackResults(
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
      0,
      false,
      0,
      0,
      0,
      0, // downgradeDefenseX
      runs,
      createSeededRng(42)
    );
    const woundsDowngrade2 = simulateWoundsFromAttackResults(
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
      0,
      false,
      0,
      0,
      0,
      2, // downgradeDefenseX
      runs,
      createSeededRng(42)
    );
    expect(woundsNone.expectedWounds).toBeCloseTo(2, 1);
    expect(woundsDowngrade2.expectedWounds).toBeCloseTo(8 / 3, 1);
  });

  it('white defender: Downgrade 2 matches Downgrade 0', () => {
    const woundsNone = simulateWoundsFromAttackResults(
      attackResults,
      'white',
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
      0,
      0,
      0,
      0,
      runs,
      createSeededRng(7)
    );
    const woundsDowngrade2 = simulateWoundsFromAttackResults(
      attackResults,
      'white',
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
      0,
      0,
      0,
      2,
      runs,
      createSeededRng(7)
    );
    expect(woundsDowngrade2.expectedWounds).toBeCloseTo(
      woundsNone.expectedWounds,
      10
    );
  });

  it('white defender with cover: Downgrade 2 matches Downgrade 0', () => {
    const woundsNone = simulateWoundsFromAttackResults(
      attackResults,
      'white',
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
      0,
      false,
      0,
      0,
      0,
      0,
      runs,
      createSeededRng(11)
    );
    const woundsDowngrade2 = simulateWoundsFromAttackResults(
      attackResults,
      'white',
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
      0,
      false,
      0,
      0,
      0,
      2,
      runs,
      createSeededRng(11)
    );
    expect(woundsDowngrade2.expectedWounds).toBeCloseTo(
      woundsNone.expectedWounds,
      10
    );
  });
});
