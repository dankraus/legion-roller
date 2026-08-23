# Downgrade Defense X Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Downgrade Defense X on the Attack Pool so that after gathering the main defense pool, up to X red defense dice become white, then those mixed dice are rolled (cover unchanged).

**Architecture:** A pure `splitDowngradedDefensePool` helper turns `(color, totalDefenseDice, X)` into `{ red, white }`. Wounds simulation rolls that mixed pool via existing `rollDefensePoolDetailed`, then Uncanny Luck rerolls each die as its current color with red spent first. The UI is an attack-keyword number input; URL key is `downDef`. No Legion Quick Guide link.

**Tech Stack:** TypeScript, Vitest, React 19, existing `NumberInputWithControls` / `urlState` / `computePoolResults` patterns.

## Global Constraints

- Full descriptive names for variables and parameters (never `c`, `s`, `h`, `b`, `d`, `p`, `n`, `x` for domain concepts). Loop counters `i`/`j` are fine.
- No `guideAnchor` on this control.
- Cover rolls never use `downgradeDefenseX`.
- White defender: conversion is a no-op; the control stays enabled.
- Gathered pool includes Danger Sense extras (`totalDefenseDice`).
- Do not refactor simulate/calculateWounds parameter lists into an options object.
- Do not change standalone `calculateDefensePool` / `getDefenseDistributionForDiceCount` APIs.
- Follow `url-state-new-inputs` and conventional commits (`feat:`, `test:`).
- If executing in isolation, create the worktree with `superpowers:using-git-worktrees` first.

**Spec:** `docs/superpowers/specs/2026-08-23-downgrade-defense-x-design.md`

---

## File Structure

**Create:** none.

**Modify:**

- `src/engine/simulate.ts` — `splitDowngradedDefensePool`, `prioritizeRedDefenseRerollIndices`, Uncanny Luck ordering, mixed-pool wounds rolls, `downgradeDefenseX` param on `simulateWounds` and `simulateWoundsFromAttackResults`
- `src/engine/probability.ts` — pass `downgradeDefenseX` through `calculateWounds`
- `src/engine/__tests__/simulate.test.ts` — helper, Uncanny Luck order, wounds sim tests; insert `0` before `runs` at existing call sites
- `src/types.ts` — `PoolConfig.downgradeDefenseX`
- `src/poolResults.ts` — default + `computePoolResults`
- `src/poolResults.test.ts` — pass-through assertion
- `src/urlState.ts` — `downDef` on `UrlPoolState`
- `src/urlState.test.ts` — parse/build round-trip
- `src/poolConfigEditor.ts` — setter + URL mapping
- `src/poolConfigEditor.test.ts` — setter mock
- `src/App.tsx` — state, reset, UI input after Pierce, URL init
- `src/share/describeActiveModifiers.ts` — label after Pierce
- `src/share/describeActiveModifiers.test.ts`
- `src/poolSnapshot.ts` — attack keyword line after Pierce
- `src/poolSnapshot.test.ts`

---

### Task 1: splitDowngradedDefensePool helper

**Files:**
- Modify: `src/engine/simulate.ts`
- Test: `src/engine/__tests__/simulate.test.ts`

**Interfaces:**
- Consumes: `DefenseDieColor`, `DefensePool` from `src/types.ts`
- Produces: `splitDowngradedDefensePool(defenseDieColor: DefenseDieColor, totalDefenseDice: number, downgradeDefenseX: number): DefensePool`

- [ ] **Step 1: Write the failing tests**

Add this import to the existing simulate test import list from `'../simulate'`:

```ts
  splitDowngradedDefensePool,
```

Append at the end of `src/engine/__tests__/simulate.test.ts` (before the file’s last closing if any — after the last `describe` is fine):

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/engine/__tests__/simulate.test.ts -t "splitDowngradedDefensePool"`

Expected: FAIL (`splitDowngradedDefensePool` is not exported / not defined)

- [ ] **Step 3: Write minimal implementation**

In `src/engine/simulate.ts`, export this next to the other defense helpers (after `rollDefensePoolDetailed` is a good place):

```ts
/** Split a same-color gathered defense pool after Downgrade Defense X. */
export function splitDowngradedDefensePool(
  defenseDieColor: DefenseDieColor,
  totalDefenseDice: number,
  downgradeDefenseX: number
): DefensePool {
  const total = Math.max(0, Math.floor(totalDefenseDice));
  const normalizedDowngradeX = Math.max(0, Math.floor(downgradeDefenseX));
  if (defenseDieColor === 'white') {
    return { red: 0, white: total };
  }
  if (normalizedDowngradeX <= 0) {
    return { red: total, white: 0 };
  }
  const white = Math.min(normalizedDowngradeX, total);
  return { red: total - white, white };
}
```

- [ ] **Step 4: Run tests and make sure they pass**

Run: `npm test -- src/engine/__tests__/simulate.test.ts -t "splitDowngradedDefensePool"`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/simulate.ts src/engine/__tests__/simulate.test.ts
git commit -m "$(cat <<'EOF'
feat(engine): split defense pool for Downgrade Defense X

EOF
)"
```

---

### Task 2: Uncanny Luck spends red dice first

**Files:**
- Modify: `src/engine/simulate.ts` (`applyUncannyLuckRerollsToOutcomes`)
- Test: `src/engine/__tests__/simulate.test.ts`

**Interfaces:**
- Consumes: `DefenseDieOutcome`, `getRerollableDefenseIndices`
- Produces: `prioritizeRedDefenseRerollIndices(outcomes: DefenseDieOutcome[], rerollableIndices: number[]): number[]` — red indices first (stable), then white. Same-color input order is unchanged.

- [ ] **Step 1: Write the failing tests**

Add `prioritizeRedDefenseRerollIndices` to the simulate test imports.

Append:

```ts
describe('prioritizeRedDefenseRerollIndices', () => {
  it('puts red rerollable indices before white', () => {
    const outcomes: DefenseDieOutcome[] = [
      { color: 'white', face: 'blank' },
      { color: 'red', face: 'blank' },
      { color: 'white', face: 'blank' },
      { color: 'red', face: 'surge' },
    ];
    expect(
      prioritizeRedDefenseRerollIndices(outcomes, [0, 1, 2, 3])
    ).toEqual([1, 3, 0, 2]);
  });

  it('leaves a same-color list in original order', () => {
    const outcomes: DefenseDieOutcome[] = [
      { color: 'red', face: 'blank' },
      { color: 'red', face: 'surge' },
    ];
    expect(prioritizeRedDefenseRerollIndices(outcomes, [0, 1])).toEqual([
      0, 1,
    ]);
  });
});
```

Add `type DefenseDieOutcome` to the import from `'../simulate'` if it is not already imported (it is currently not; add it next to `DefenseFace`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/engine/__tests__/simulate.test.ts -t "prioritizeRedDefenseRerollIndices"`

Expected: FAIL (function not exported)

- [ ] **Step 3: Implement and use it in Uncanny Luck outcomes**

Add next to `getRerollableDefenseIndices` in `src/engine/simulate.ts`:

```ts
/** Among rerollable defense dice, spend Uncanny Luck on red before white. */
export function prioritizeRedDefenseRerollIndices(
  outcomes: DefenseDieOutcome[],
  rerollableIndices: number[]
): number[] {
  const redIndices: number[] = [];
  const whiteIndices: number[] = [];
  for (const index of rerollableIndices) {
    const outcome = outcomes[index];
    if (outcome === undefined) continue;
    if (outcome.color === 'red') redIndices.push(index);
    else whiteIndices.push(index);
  }
  return [...redIndices, ...whiteIndices];
}
```

In `applyUncannyLuckRerollsToOutcomes`, replace the `getRerollableDefenseIndices(...)` result with the prioritized list:

```ts
  const rerollableIndices = prioritizeRedDefenseRerollIndices(
    outcomes,
    getRerollableDefenseIndices(faces, surge, defenseSurgeTokens)
  );
```

Do not change `applyUncannyLuckRerolls` (single-color `DefenseFace[]` helper). Same-color pools stay equivalent.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/engine/__tests__/simulate.test.ts -t "prioritizeRedDefenseRerollIndices"`

Also run: `npm test -- src/engine/__tests__/simulate.test.ts -t "applyUncannyLuckRerolls"`

Expected: PASS (existing same-color Uncanny Luck tests still pass)

- [ ] **Step 5: Commit**

```bash
git add src/engine/simulate.ts src/engine/__tests__/simulate.test.ts
git commit -m "$(cat <<'EOF'
feat(engine): Uncanny Luck spends red defense dice first

EOF
)"
```

---

### Task 3: Mixed-pool wounds simulation

**Files:**
- Modify: `src/engine/simulate.ts` (`simulateWounds`, `simulateWoundsFromAttackResults`)
- Modify: `src/engine/probability.ts` (`calculateWounds`)
- Modify: `src/engine/__tests__/simulate.test.ts` (new tests + insert `0` before `runs` at every existing positional call)
- Modify: `src/engine/__tests__/probability.test.ts` only if `tsc` requires a new trailing arg (it should not: `calculateWounds` optional params stay optional)

**Interfaces:**
- Consumes: `splitDowngradedDefensePool`, `rollDefensePoolDetailed`, `applyUncannyLuckRerollsToOutcomes`
- Produces: `simulateWounds(..., uncannyLuckX = 0, downgradeDefenseX = 0, runs, rng)` and the same extra param on `simulateWoundsFromAttackResults`. `calculateWounds(..., uncannyLuckX?: number, downgradeDefenseX?: number)`.

**Call-site rule:** Adding `downgradeDefenseX` immediately before `runs` shifts every existing `simulateWounds` / `simulateWoundsFromAttackResults` call that already passes `runs`. TypeScript will error (`number` vs `() => number`). Fix by inserting `0, // downgradeDefenseX` immediately before `runs` (or `createSeededRng(...)` if that is the last arg after an inline runs literal). Do **not** add the argument to `calculateWounds` callers that omit trailing optionals.

- [ ] **Step 1: Write the failing wounds tests**

Append to `src/engine/__tests__/simulate.test.ts`:

```ts
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
      false,
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
      false,
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
    expect(woundsDowngrade2.expectedWounds).toBeGreaterThanOrEqual(
      woundsNone.expectedWounds
    );
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
      false,
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
      false,
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
      false,
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
      false,
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
```

Until the new parameter exists, write these tests with the extra `0`/`2` before `runs` so they fail on “Expected 23 arguments, but got 24” (or similar). That is the intended failing signal, then implementation adds the param.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/engine/__tests__/simulate.test.ts -t "Downgrade Defense X"`

Expected: FAIL (too many arguments / param not in signature)

- [ ] **Step 3: Add the parameter and roll mixed dice**

**`simulateWounds`** — add after `uncannyLuckX: number = 0`:

```ts
  downgradeDefenseX: number = 0,
```

Near the other `normalized*` locals:

```ts
  const normalizedDowngradeDefenseX = Math.max(
    0,
    Math.floor(downgradeDefenseX)
  );
```

Replace the same-color roll + `applyUncannyLuckRerolls` block (the loop that pushes `rollOneDefenseDieOutcome(defenseDieColor, rng)` then `applyUncannyLuckRerolls(...)`) with:

```ts
    const splitPool = splitDowngradedDefensePool(
      defenseDieColor,
      totalDefenseDice,
      normalizedDowngradeDefenseX
    );
    const defenseOutcomes = rollDefensePoolDetailed(splitPool, rng);
    applyUncannyLuckRerollsToOutcomes(
      defenseOutcomes,
      normalizedUncannyLuckX,
      defenseSurge,
      normalizedDefenseSurgeTokens,
      rng
    );
    let blockCount = 0;
    let surgeCount = 0;
    for (const outcome of defenseOutcomes) {
      if (outcome.face === 'block') blockCount++;
      else if (outcome.face === 'surge') surgeCount++;
    }
```

Leave `wounds = Math.max(0, defenseDice - effectiveBlocks)` unchanged (Danger Sense extras still do not count as wound slots).

**`simulateWoundsFromAttackResults`** — same new parameter, same `normalizedDowngradeDefenseX`, same replacement of the faces loop. Do **not** pass `downgradeDefenseX` into `applyCover`.

**`calculateWounds`** in `src/engine/probability.ts` — add `downgradeDefenseX?: number` after `uncannyLuckX?: number`. After `normalizedUncannyLuckX`:

```ts
  const normalizedDowngradeDefenseX = Math.max(
    0,
    Math.floor(downgradeDefenseX ?? 0)
  );
```

Pass `normalizedDowngradeDefenseX` into `simulateWoundsFromAttackResults` immediately before `DEFAULT_RUNS`.

- [ ] **Step 4: Fix existing simulate call sites**

In `src/engine/__tests__/simulate.test.ts`, every `simulateWounds(` and `simulateWoundsFromAttackResults(` that currently ends with `uncannyLuckX, runs, rng` must insert `0, // downgradeDefenseX` before `runs`.

Example — the first `simulateWounds` call today ends:

```ts
      0, // uncannyLuckX
      10_000,
      rng
```

Change to:

```ts
      0, // uncannyLuckX
      0, // downgradeDefenseX
      10_000,
      rng
```

There are many `simulateWoundsFromAttackResults` calls (Pierce, Armor, Impact, Impervious, Uncanny Luck, Danger Sense, cover, etc.). Apply the same insertion at each. Do not change `calculateWounds` tests unless TypeScript reports an error (it should not).

- [ ] **Step 5: Run tests**

Run: `npm test -- src/engine/__tests__/simulate.test.ts`

Run: `npm test -- src/engine/__tests__/probability.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/engine/simulate.ts src/engine/probability.ts src/engine/__tests__/simulate.test.ts src/engine/__tests__/probability.test.ts
git commit -m "$(cat <<'EOF'
feat(engine): apply Downgrade Defense X on the main defense roll

EOF
)"
```

---

### Task 4: PoolConfig, URL, UI, share, snapshots

**Files:**
- Modify: `src/types.ts`
- Modify: `src/poolResults.ts`
- Modify: `src/poolResults.test.ts`
- Modify: `src/urlState.ts`
- Modify: `src/urlState.test.ts`
- Modify: `src/poolConfigEditor.ts`
- Modify: `src/poolConfigEditor.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/share/describeActiveModifiers.ts`
- Modify: `src/share/describeActiveModifiers.test.ts`
- Modify: `src/poolSnapshot.ts`
- Modify: `src/poolSnapshot.test.ts`

**Interfaces:**
- Consumes: `calculateWounds(..., downgradeDefenseX)` from Task 3
- Produces: `PoolConfig.downgradeDefenseX: string`; `UrlPoolState.downDef: number` (default `0`, omitted when 0); App control `id="downgrade-defense-x"`; share/snapshot label `Downgrade Defense N`

- [ ] **Step 1: Write the failing plumbing tests**

**`src/urlState.test.ts`** — inside `describe('parseFragment')`, next to the `uLuck` test:

```ts
    it('parses downDef and roundtrips in buildFragment', () => {
      const parsed = parseFragment('#downDef=2');
      expect(parsed.downDef).toBe(2);
      const fragment = buildFragment({ ...DEFAULT_URL_STATE, downDef: 2 });
      expect(fragment).toContain('downDef=2');
      expect(parseFragment('#' + fragment).downDef).toBe(2);
    });

    it('omits downDef from the fragment when it is 0', () => {
      const fragment = buildFragment({ ...DEFAULT_URL_STATE, downDef: 0 });
      expect(fragment).not.toContain('downDef');
    });
```

**`src/share/describeActiveModifiers.test.ts`** — add `downgradeDefenseX: '2'` to the “lists non-default” config and:

```ts
    expect(labels).toContain('Downgrade Defense 2');
```

**`src/poolSnapshot.test.ts`** — add:

```ts
  it('includes Downgrade Defense in Attack keywords when set', () => {
    const sections = formatPoolSnapshot({
      ...DEFAULT_POOL_CONFIG,
      downgradeDefenseX: '2',
    });
    expect(lineValue(sections, 'Attack keywords', 'Downgrade Defense')).toBe(
      '2'
    );
  });
```

**`src/poolResults.test.ts`** — in the “matches calling the engine functions directly” test, add `downgradeDefenseX: '2'` to `config` and pass `2` as the last argument to `calculateWounds` (after the existing `0` uncannyLuckX argument).

**`src/poolConfigEditor.test.ts`** — add `setDowngradeDefenseX: vi.fn()` to the setters object. After `applyConfigToEditor`, it does not need a new assertion unless you set `downgradeDefenseX: '2'` on `config`; if you do, assert `setters.setDowngradeDefenseX` was called with `'2'`.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```
npm test -- src/urlState.test.ts src/share/describeActiveModifiers.test.ts src/poolSnapshot.test.ts src/poolResults.test.ts src/poolConfigEditor.test.ts
```

Expected: FAIL (missing `downDef` / `downgradeDefenseX`)

- [ ] **Step 3: Implement types and computePoolResults**

`src/types.ts` — on `PoolConfig`, after `impactX`:

```ts
  downgradeDefenseX: string;
```

`src/poolResults.ts` — `DEFAULT_POOL_CONFIG.downgradeDefenseX: ''` (after `impactX`). Pass `toCount(config.downgradeDefenseX)` as the last argument to `calculateWounds`.

- [ ] **Step 4: Implement URL state**

`src/urlState.ts`:

- `UrlPoolState`: `downDef: number;` after `impact`
- `DEFAULT_URL_STATE_POOL`: `downDef: 0,`
- `parsePool`: `downDef: parseNumber(get('downDef'), DEFAULT_URL_STATE_POOL.downDef),`

No custom serializer needed; `buildFragment` already omits default `0`.

- [ ] **Step 5: Implement poolConfigEditor**

`PoolEditorSetters`: `setDowngradeDefenseX: (value: string) => void;` (after `setImpactX`).

`applyConfigToEditor`: `setters.setDowngradeDefenseX(config.downgradeDefenseX);` after `setImpactX`.

`configToUrlPoolState`: `downDef: toCount(config.downgradeDefenseX),` after `impact`.

- [ ] **Step 6: Implement App.tsx**

`poolStateToConfig`: `downgradeDefenseX: numToInput(pool.downDef),` after `impactX`.

State (after `pierceX` / `impactX` is fine; keep it with attack keywords — after `impactX` is consistent with URL `downDef` sitting with `impact`/`pierce`):

```ts
  const [downgradeDefenseX, setDowngradeDefenseX] = useState<string>(() =>
    initialFromUrl
      ? initialFromUrl.downDef === 0
        ? ''
        : String(initialFromUrl.downDef)
      : ''
  );
```

Add `downgradeDefenseX` to `simulationInputs` and its dependency array, to `liveConfig`, and `setDowngradeDefenseX` to `poolEditorSetters`.

`handleReset`: `setDowngradeDefenseX('');` next to `setPierceX('')` / `setImpactX('')`.

In Attack Keywords, immediately after the Pierce `NumberInputWithControls`:

```tsx
              <NumberInputWithControls
                id="downgrade-defense-x"
                label="Downgrade Defense"
                value={downgradeDefenseX}
                onChange={setDowngradeDefenseX}
                min={0}
                title="Convert up to X red defense dice to white after gathering the defense pool (including Danger Sense extras). No effect if the defender rolls white. Does not affect cover. Uncanny Luck rerolls red dice first."
              />
```

Do **not** pass `guideAnchor`.

- [ ] **Step 7: Implement share and snapshot**

`src/share/describeActiveModifiers.ts` — after the Pierce `countLabel` line:

```ts
  labels.push(countLabel('Downgrade Defense', config.downgradeDefenseX));
```

`src/poolSnapshot.ts` — after Pierce in `keywordLines`:

```ts
  addCountLine(keywordLines, 'Downgrade Defense', config.downgradeDefenseX);
```

- [ ] **Step 8: Run plumbing tests, then the full gate**

Run:

```
npm test -- src/urlState.test.ts src/share/describeActiveModifiers.test.ts src/poolSnapshot.test.ts src/poolResults.test.ts src/poolConfigEditor.test.ts
```

Expected: PASS

Then: `npm test && npm run lint && npm run build`

Expected: all green. Production build may still emit the existing >500 kB chunk warning; that is non-blocking.

- [ ] **Step 9: Commit**

```bash
git add src/types.ts src/poolResults.ts src/poolResults.test.ts src/urlState.ts src/urlState.test.ts src/poolConfigEditor.ts src/poolConfigEditor.test.ts src/App.tsx src/share/describeActiveModifiers.ts src/share/describeActiveModifiers.test.ts src/poolSnapshot.ts src/poolSnapshot.test.ts
git commit -m "$(cat <<'EOF'
feat: add Downgrade Defense X to attack pool configuration

EOF
)"
```

---

## Self-review (spec coverage)

| Spec requirement | Task |
| --- | --- |
| `splitDowngradedDefensePool` red/white/cap/zero | Task 1 |
| Danger Sense extras included (uses `totalDefenseDice`) | Task 3 |
| White defender no-op | Tasks 1, 3 |
| Cover not affected | Task 3 (cover still `coverDieColor` only; white+cover identity test) |
| Uncanny Luck red first, same-color unchanged | Task 2 |
| Wounds path mixed `DefenseDieOutcome` + existing Pierce/Impervious | Task 3 |
| Standalone defense APIs unchanged | Task 3 (not touched) |
| `PoolConfig` / `computePoolResults` / App input after Pierce | Task 4 |
| No `guideAnchor` | Task 4 |
| Tooltip copy | Task 4 |
| Control always enabled | Task 4 (no disabled/hidden branch) |
| URL `downDef`, omit at 0 | Task 4 |
| Share + snapshot “Downgrade Defense N” | Task 4 |
| Upgrade Defense / dice roller / options-object refactor | Out of scope, no task |
