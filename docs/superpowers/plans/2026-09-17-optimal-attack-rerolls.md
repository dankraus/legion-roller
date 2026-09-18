# Optimal Attack Rerolls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aim/Observe reroll only attack dice that will still be misses after Critical, surge conversion/tokens, and Ram; Ram converts leftover blanks then leftover surges then hits.

**Architecture:** Add `leftoverSurgesAfterConversion` and `getRerollableAttackIndices` in `src/engine/simulate.ts`, mirroring Uncanny Luck’s defense helper. Each Aim/Observe round uses that index list. `applyRam` spends leftover surges after blanks and before hits. Defense Uncanny Luck is unchanged.

**Tech Stack:** TypeScript, Vitest (node environment for engine tests), React 19 tooltips in `App.tsx`.

## Global Constraints

- Full descriptive names for variables and parameters (never `c`, `s`, `h`, `b`, `d`, `p`, `n`, `x` for domain concepts). Loop counters `i`/`j` are fine.
- Hits and crits are never rerolled.
- Surge → Hit / Surge → Crit: all surges convert; leftover surges = 0.
- Surge None leftover surges = `max(0, surgeCount − Critical X − surge tokens)`.
- Ram spends blanks, then leftover surges, then hits. Ram never spends a surge that conversion still needs.
- Among rerollable misses, color order is red, then black, then white.
- Among surges kept for conversion, keep worse colors first (white, then black, then red).
- Do not change Uncanny Luck, URL state, Aim/Observe/Precise capacities, or the raw dice roller.
- Do not reroll hits to fish for crits vs Armor/Cover.
- Conventional commits (`feat:`, `test:`, `fix:`).
- If executing in isolation, create the worktree with `superpowers:using-git-worktrees` first.

**Spec:** `docs/superpowers/specs/2026-09-17-optimal-attack-rerolls-design.md`

---

## File Structure

**Create:** none.

**Modify:**

- `src/engine/simulate.ts` — leftover-surge helper, rerollable attack indices, `applyRerollsByRounds` context, `applyRam` leftover surges, wire `simulateAttackPool` / `simulateWounds` / `applyRerolls`
- `src/engine/__tests__/simulate.test.ts` — unit tests for helpers, ram leftover surges, reroll selection
- `src/engine/__tests__/probability.test.ts` — 2-red infinite-reroll ceiling; Ram + leftover surge expected totals
- `src/App.tsx` — Aim, Observe, and Ram tooltips

---

### Task 1: leftoverSurgesAfterConversion helper

**Files:**
- Modify: `src/engine/simulate.ts`
- Test: `src/engine/__tests__/simulate.test.ts`

**Interfaces:**
- Consumes: existing `SurgeConversion`; private `normalizeCriticalX` / `normalizeSurgeTokens` in `simulate.ts`
- Produces: `leftoverSurgesAfterConversion(surgeCount: number, criticalX: number | undefined, surge: SurgeConversion, surgeTokens: number | undefined): number`

- [ ] **Step 1: Write the failing tests**

Add `leftoverSurgesAfterConversion` to the import list from `'../simulate'` in `src/engine/__tests__/simulate.test.ts`.

Insert this describe immediately after the existing `resolveStep` describe (before `describe('applyRerolls'`):

```ts
describe('leftoverSurgesAfterConversion', () => {
  it('surge hit: all surges convert, leftover is 0', () => {
    expect(leftoverSurgesAfterConversion(4, 0, 'hit', 0)).toBe(0);
    expect(leftoverSurgesAfterConversion(4, 2, 'hit', 9)).toBe(0);
  });

  it('surge crit: all surges convert, leftover is 0', () => {
    expect(leftoverSurgesAfterConversion(3, 0, 'crit', 0)).toBe(0);
  });

  it('surge none: leftover is surges minus Critical X minus tokens', () => {
    expect(leftoverSurgesAfterConversion(5, 1, 'none', 2)).toBe(2);
    expect(leftoverSurgesAfterConversion(2, 5, 'none', 0)).toBe(0);
    expect(leftoverSurgesAfterConversion(2, 0, 'none', 2)).toBe(0);
  });

  it('treats missing Critical X and tokens as 0', () => {
    expect(leftoverSurgesAfterConversion(3, undefined, 'none', undefined)).toBe(
      3
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/engine/__tests__/simulate.test.ts`

Expected: FAIL — `leftoverSurgesAfterConversion` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/engine/simulate.ts`, immediately after `normalizeSurgeTokens`, add:

```ts
/** Surges that remain misses after Critical X and surge conversion / tokens. */
export function leftoverSurgesAfterConversion(
  surgeCount: number,
  criticalX: number | undefined,
  surge: SurgeConversion,
  surgeTokens: number | undefined
): number {
  if (surge === 'hit' || surge === 'crit') return 0;
  const converted = normalizeCriticalX(criticalX) + normalizeSurgeTokens(surgeTokens);
  return Math.max(0, surgeCount - converted);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/engine/__tests__/simulate.test.ts`

Expected: PASS for `leftoverSurgesAfterConversion`.

- [ ] **Step 5: Commit**

```bash
git add src/engine/simulate.ts src/engine/__tests__/simulate.test.ts
git commit -m "$(cat <<'EOF'
feat(engine): count leftover surges after conversion

EOF
)"
```

---

### Task 2: applyRam converts leftover surges after blanks

**Files:**
- Modify: `src/engine/simulate.ts` (`applyRam`)
- Test: `src/engine/__tests__/simulate.test.ts`

**Interfaces:**
- Consumes: `leftoverSurgesAfterConversion` from Task 1
- Produces: `applyRam(hits: number, crits: number, blanksAfterReroll: number, ram: number, leftoverSurges?: number): { hits: number; crits: number }` — fifth argument defaults to 0

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe('applyRam'` block in `src/engine/__tests__/simulate.test.ts`:

```ts
  it('Ram 1 with 0 blanks and 1 leftover surge converts that surge to a crit', () => {
    const result = applyRam(0, 0, 0, 1, 1);
    expect(result.hits).toBe(0);
    expect(result.crits).toBe(1);
  });

  it('Ram spends blanks before leftover surges, then leftover Ram converts hits', () => {
    const result = applyRam(2, 0, 1, 3, 1);
    expect(result.hits).toBe(1);
    expect(result.crits).toBe(3);
  });

  it('Ram 1 with leftoverSurges 0 does not invent a surge conversion', () => {
    const result = applyRam(0, 0, 0, 1, 0);
    expect(result.hits).toBe(0);
    expect(result.crits).toBe(0);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/engine/__tests__/simulate.test.ts`

Expected: FAIL — leftover surge is not converted (`crits` still 0).

- [ ] **Step 3: Write minimal implementation**

Replace `applyRam` in `src/engine/simulate.ts` with:

```ts
/** Apply Ram X: convert up to X blanks to crits, then leftover surges, then hits. */
export function applyRam(
  hits: number,
  crits: number,
  blanksAfterReroll: number,
  ram: number,
  leftoverSurges: number = 0
): { hits: number; crits: number } {
  const normalizedRam = normalizeTokenCount(ram);
  if (normalizedRam <= 0) return { hits, crits };
  const blanksConverted = Math.min(normalizedRam, blanksAfterReroll);
  let resolvedCrits = crits + blanksConverted;
  let ramLeft = normalizedRam - blanksConverted;
  const surgesConverted = Math.min(
    ramLeft,
    Math.max(0, Math.floor(leftoverSurges))
  );
  resolvedCrits += surgesConverted;
  ramLeft -= surgesConverted;
  let resolvedHits = hits;
  const hitsConverted = Math.min(ramLeft, resolvedHits);
  resolvedCrits += hitsConverted;
  resolvedHits -= hitsConverted;
  return { hits: resolvedHits, crits: resolvedCrits };
}
```

Do not change `simulateAttackPool` / `simulateWounds` call sites yet (fifth arg defaults to 0). Existing blank/hit Ram unit tests must still pass.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/engine/__tests__/simulate.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/simulate.ts src/engine/__tests__/simulate.test.ts
git commit -m "$(cat <<'EOF'
feat(engine): Ram converts leftover surges after blanks

EOF
)"
```

---

### Task 3: getRerollableAttackIndices

**Files:**
- Modify: `src/engine/simulate.ts`
- Test: `src/engine/__tests__/simulate.test.ts`

**Interfaces:**
- Consumes: `DieOutcome`, `leftoverSurgesAfterConversion`, `REROLL_PRIORITY`
- Produces:

```ts
export interface AttackRerollContext {
  surge: SurgeConversion;
  criticalX: number;
  surgeTokens: number;
  ramX: number;
}

export function getRerollableAttackIndices(
  outcomes: DieOutcome[],
  context: AttackRerollContext
): number[]
```

- [ ] **Step 1: Write the failing tests**

Add `getRerollableAttackIndices` and `type DieOutcome` to the simulate test imports.

Insert after the `leftoverSurgesAfterConversion` describe:

```ts
describe('getRerollableAttackIndices', () => {
  const noConverters: AttackRerollContext = {
    surge: 'none',
    criticalX: 0,
    surgeTokens: 0,
    ramX: 0,
  };

  it('never lists hits or crits', () => {
    const outcomes: DieOutcome[] = [
      { color: 'red', face: 'crit' },
      { color: 'red', face: 'hit' },
      { color: 'red', face: 'blank' },
    ];
    expect(getRerollableAttackIndices(outcomes, noConverters)).toEqual([2]);
  });

  it('surge hit: only blanks are rerollable', () => {
    const outcomes: DieOutcome[] = [
      { color: 'white', face: 'surge' },
      { color: 'white', face: 'blank' },
    ];
    expect(
      getRerollableAttackIndices(outcomes, {
        ...noConverters,
        surge: 'hit',
      })
    ).toEqual([1]);
  });

  it('surge none with no tokens: blanks and all surges are rerollable', () => {
    const outcomes: DieOutcome[] = [
      { color: 'white', face: 'surge' },
      { color: 'white', face: 'blank' },
    ];
    expect(getRerollableAttackIndices(outcomes, noConverters)).toEqual([1, 0]);
  });

  it('keeps Critical X and surge-token surges; leftover surges are rerollable', () => {
    const outcomes: DieOutcome[] = [
      { color: 'white', face: 'surge' },
      { color: 'white', face: 'surge' },
      { color: 'white', face: 'surge' },
      { color: 'white', face: 'blank' },
    ];
    expect(
      getRerollableAttackIndices(outcomes, {
        surge: 'none',
        criticalX: 1,
        surgeTokens: 1,
        ramX: 0,
      })
    ).toEqual([3, 2]);
  });

  it('Ram reserves leftover misses so they are not rerolled', () => {
    const outcomes: DieOutcome[] = [
      { color: 'white', face: 'blank' },
      { color: 'white', face: 'blank' },
    ];
    expect(
      getRerollableAttackIndices(outcomes, {
        ...noConverters,
        ramX: 1,
      })
    ).toEqual([0]);
  });

  it('rerolls red misses before white misses', () => {
    const outcomes: DieOutcome[] = [
      { color: 'white', face: 'blank' },
      { color: 'red', face: 'blank' },
    ];
    expect(getRerollableAttackIndices(outcomes, noConverters)).toEqual([1, 0]);
  });

  it('keeps a white surge for conversion so a red leftover surge can be rerolled', () => {
    const outcomes: DieOutcome[] = [
      { color: 'red', face: 'surge' },
      { color: 'white', face: 'surge' },
    ];
    expect(
      getRerollableAttackIndices(outcomes, {
        surge: 'none',
        criticalX: 1,
        surgeTokens: 0,
        ramX: 0,
      })
    ).toEqual([0]);
  });
});
```

Also add `AttackRerollContext` to the import type list (`import type { AttackPool, AttackResults, DefensePool }` can stay; `AttackRerollContext` is a value-adjacent type from simulate — import it as a type from `'../simulate'`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/engine/__tests__/simulate.test.ts`

Expected: FAIL — `getRerollableAttackIndices` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/engine/simulate.ts`, immediately before `applyRerollsByRounds`, add:

```ts
export interface AttackRerollContext {
  surge: SurgeConversion;
  criticalX: number;
  surgeTokens: number;
  ramX: number;
}

/** Indices of attack dice that would still be misses after conversion and Ram. */
export function getRerollableAttackIndices(
  outcomes: DieOutcome[],
  context: AttackRerollContext
): number[] {
  const blankIndices: number[] = [];
  const surgeIndices: number[] = [];
  for (let index = 0; index < outcomes.length; index++) {
    const face = outcomes[index]?.face;
    if (face === 'blank') blankIndices.push(index);
    else if (face === 'surge') surgeIndices.push(index);
  }

  const keepSurgeCount =
    context.surge === 'hit' || context.surge === 'crit'
      ? surgeIndices.length
      : Math.min(
          surgeIndices.length,
          normalizeCriticalX(context.criticalX) +
            normalizeSurgeTokens(context.surgeTokens)
        );

  surgeIndices.sort(
    (indexA, indexB) =>
      REROLL_PRIORITY[outcomes[indexB]!.color] -
      REROLL_PRIORITY[outcomes[indexA]!.color]
  );
  const leftoverSurgeIndices = surgeIndices.slice(keepSurgeCount);
  const failureIndices = [...blankIndices, ...leftoverSurgeIndices];
  failureIndices.sort(
    (indexA, indexB) =>
      REROLL_PRIORITY[outcomes[indexA]!.color] -
      REROLL_PRIORITY[outcomes[indexB]!.color]
  );
  const ramReservedCount = Math.min(
    normalizeTokenCount(context.ramX),
    failureIndices.length
  );
  return failureIndices.slice(0, failureIndices.length - ramReservedCount);
}
```

Move `REROLL_PRIORITY` above this function if it is currently declared after `applyRerollsByRounds`’s old comment block — keep it next to these helpers.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/engine/__tests__/simulate.test.ts`

Expected: PASS for `getRerollableAttackIndices`. If the Critical+token leftover index is `[3, 2]` vs another leftover surge index, fix the keep-from-worst-color sort so the leftover is the last remaining surge after white-first keep (all white here, so leftover is `surgeIndices.slice(2)` after reverse-priority sort that preserves original order among ties). With three white surges at 0,1,2, reverse-priority is stable → keep 0 and 1, leftover 2, plus blank 3. Expected `[3, 2]` after red-first sort of failures (same color, original relative order `[3, 2]`). Good.

- [ ] **Step 5: Commit**

```bash
git add src/engine/simulate.ts src/engine/__tests__/simulate.test.ts
git commit -m "$(cat <<'EOF'
feat(engine): select attack rerolls after conversion and Ram

EOF
)"
```

---

### Task 4: applyRerollsByRounds uses getRerollableAttackIndices

**Files:**
- Modify: `src/engine/simulate.ts` (`applyRerollsByRounds`, `applyRerolls`, `simulateAttackPool`, `simulateWounds`)
- Test: `src/engine/__tests__/simulate.test.ts`

**Interfaces:**
- Consumes: `getRerollableAttackIndices`, `AttackRerollContext`, `leftoverSurgesAfterConversion`
- Produces: `applyRerollsByRounds(outcomes, roundCapacities, rng, context)` mutates outcomes; simulations pass context and leftover surges into `applyRam`

- [ ] **Step 1: Write the failing test**

Add `applyRerollsByRounds` to the simulate test imports. Append:

```ts
describe('applyRerollsByRounds', () => {
  it('rerolls an unconverted surge when surge is none', () => {
    const outcomes: DieOutcome[] = [{ color: 'white', face: 'surge' }];
    applyRerollsByRounds(
      outcomes,
      [1],
      () => 0,
      { surge: 'none', criticalX: 0, surgeTokens: 0, ramX: 0 }
    );
    expect(outcomes[0]?.face).toBe('crit');
  });

  it('does not reroll a surge when surge converts to hit', () => {
    const outcomes: DieOutcome[] = [{ color: 'white', face: 'surge' }];
    applyRerollsByRounds(
      outcomes,
      [1],
      () => 0,
      { surge: 'hit', criticalX: 0, surgeTokens: 0, ramX: 0 }
    );
    expect(outcomes[0]?.face).toBe('surge');
  });

  it('does not reroll a miss reserved for Ram', () => {
    const outcomes: DieOutcome[] = [{ color: 'white', face: 'blank' }];
    applyRerollsByRounds(
      outcomes,
      [1],
      () => 0,
      { surge: 'none', criticalX: 0, surgeTokens: 0, ramX: 1 }
    );
    expect(outcomes[0]?.face).toBe('blank');
  });
});
```

`rng () => 0` makes `rollOneAttackDie` return `'crit'` (first face bucket).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/engine/__tests__/simulate.test.ts`

Expected: FAIL — unconverted surge is not rerolled (`face` stays `'surge'`).

- [ ] **Step 3: Write minimal implementation**

Change `applyRerollsByRounds` to take `context: AttackRerollContext` and replace the blanks-only scan with `getRerollableAttackIndices(outcomes, context)`.

Update the three call sites:

1. `applyRerolls` — add optional trailing args `criticalX = 0`, `surgeTokens = 0`, `ramX = 0`. Pass `{ surge, criticalX, surgeTokens, ramX }` into `applyRerollsByRounds`. After rerolls, call `resolveStep(after, criticalX, surge, surgeTokens)`. Do not apply Ram inside `applyRerolls` (existing tests cover rerolls only).

```ts
export function applyRerolls(
  rawCounts: RawAttackCounts,
  resolveResult: { hits: number; crits: number },
  pool: AttackPool,
  surge: SurgeConversion,
  aimTokens: number,
  observeTokens: number,
  preciseX: number,
  rng: () => number,
  criticalX: number = 0,
  surgeTokens: number = 0,
  ramX: number = 0
): { hits: number; crits: number }
```

2. `simulateAttackPool` — after `getRerollRounds`, build `const rerollContext: AttackRerollContext = { surge, criticalX: criticalX ?? 0, surgeTokens, ramX: ram }`. Pass it to `applyRerollsByRounds`. After `resolveStep`, call:

```ts
const leftoverSurges = leftoverSurgesAfterConversion(
  raw.surge,
  criticalX,
  surge,
  surgeTokens
);
const final = applyRam(
  resolved.hits,
  resolved.crits,
  raw.blank,
  ram,
  leftoverSurges
);
```

3. `simulateWounds` — same `rerollContext` and `applyRam` leftover-surge wiring as `simulateAttackPool`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/engine/__tests__/simulate.test.ts`

Expected: PASS. Existing `applyRerolls` tests still pass because extra args default to 0.

- [ ] **Step 5: Commit**

```bash
git add src/engine/simulate.ts src/engine/__tests__/simulate.test.ts
git commit -m "$(cat <<'EOF'
feat(engine): Aim and Observe reroll unconverted misses

EOF
)"
```

---

### Task 5: Probability regression tests for the motivating pools

**Files:**
- Test: `src/engine/__tests__/probability.test.ts`

**Interfaces:**
- Consumes: `calculateAttackPool` from `src/engine/probability.ts` (already wired to `simulateAttackPool`)
- Produces: none (tests only)

- [ ] **Step 1: Write the failing tests**

In `src/engine/__tests__/probability.test.ts`, inside `describe('Aim and Observe tokens'`, add:

```ts
  it('2 red, surge none, many Aim/Observe: leftover surges are rerolled toward 2 successes', () => {
    const pool: AttackPool = { red: 2, black: 0, white: 0 };
    const result = calculateAttackPool(pool, 'none', undefined, 0, 20, 20);
    expect(result.expectedTotal).toBeCloseTo(2, 1);
    const probabilityOfTwo =
      result.distribution.find((entry) => entry.total === 2)?.probability ?? 0;
    expect(probabilityOfTwo).toBeCloseTo(1, 1);
  });
```

Write this test before changing `probability.test.ts` Ram assertions. On current main it fails (1.72 / 73.68%). After Task 4 it is the regression lock.

Replace the Ram 1 / Ram 2 single-white-die comments and assertions that treat an unconverted surge as wasted:

`Ram 1 with 1 white die (surge none, no rerolls)`:

```ts
  it('Ram 1 with 1 white die (surge none, no rerolls): converts blank, leftover surge, or hit to crit', () => {
    const pool: AttackPool = { red: 0, black: 0, white: 1 };
    const ram1 = calculateAttackPool(pool, 'none', undefined, 0, 0, 0, 0, 1);
    expect(ram1.expectedCrits).toBeCloseTo(1);
    expect(ram1.expectedHits).toBeCloseTo(0);
    expect(ram1.expectedTotal).toBeCloseTo(1);
  });
```

`Ram 2 with 1 white die` — same expected 1 / 0 / 1 (single die cannot exceed 1 success).

Keep `Ram works with surge to hit` as a greater-than crits check (Ram must not steal converted surges; it still converts blanks then hits).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/engine/__tests__/probability.test.ts`

Expected if run before Task 4: FAIL on expectedTotal ~1.72 vs 2. If Task 4 is already done: the new 2-red test PASSES; Ram white-die test FAILS until Task 2+4 leftover surges are wired through `simulateAttackPool`.

- [ ] **Step 3: No additional production code** unless the Ram white-die simulation still reports 7/8 — then the Task 4 `simulateAttackPool` leftover-surge `applyRam` argument is missing; add it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/engine/__tests__/probability.test.ts src/engine/__tests__/simulate.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/__tests__/probability.test.ts
git commit -m "$(cat <<'EOF'
test(engine): lock optimal Aim/Observe and Ram leftover-surge totals

EOF
)"
```

---

### Task 6: Aim, Observe, and Ram tooltips

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: none
- Produces: updated `title` strings on Aim, Observe, and Ram inputs

- [ ] **Step 1: Write the failing test**

There is no existing tooltip assertion. Add a focused App/component test only if a current test already renders those inputs and can query `title`. If not, skip a new UI test and change the strings in Step 3 (copy-only). Prefer adding to an existing App render test if one already mounts the Aim input.

If no App test mounts the controls, do not create a large App test for three title strings.

- [ ] **Step 2: If a test was added, run it to verify it fails**

Run: `npm test -- src/App.test.tsx` (or the file that renders the inputs)

Expected: FAIL on old tooltip text.

- [ ] **Step 3: Update copy in `src/App.tsx`**

Aim `title`:

`Each Aim token: reroll up to 2 dice that would not become hits or crits (after surge conversion, surge tokens, Critical, and Ram).`

Observe `title`:

`Each Observe token: reroll 1 die that would not become a hit or crit (after surge conversion, surge tokens, Critical, and Ram).`

Ram `title`:

`After rerolls, convert up to X leftover blanks or surges to crits, then leftover Ram converts hits. Does not spend on surges that Critical, surge conversion, or surge tokens will convert.`

- [ ] **Step 4: Run the full gate**

Run: `npm test && npm run lint && npm run build`

Expected: all tests pass, lint clean, build succeeds (existing >500 kB chunk warning is OK).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "$(cat <<'EOF'
fix(ui): describe Aim, Observe, and Ram conversion-aware rerolls

EOF
)"
```
