# Upgrade Defense Dice X Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Upgrade Defense Dice X on the Defense Pool so that after gathering (and after Downgrade Defense), up to X white defense dice become red, then those mixed dice are rolled (cover unchanged).

**Architecture:** Do not change `splitDowngradedDefensePool`. Add `applyUpgradeDefenseToPool(pool, X)` that converts `min(X, white)` white dice to red. Wounds simulation runs split → upgrade → existing `rollDefensePoolDetailed` → existing Uncanny Luck (already red-first). UI is a defense-keyword number input with no Quick Guide link; URL key is `upDef`.

**Tech Stack:** TypeScript, Vitest, React 19, existing `NumberInputWithControls` / `urlState` / `computePoolResults` patterns.

## Global Constraints

- Full descriptive names for variables and parameters (never `c`, `s`, `h`, `b`, `d`, `p`, `n`, `x` for domain concepts). Loop counters `i`/`j` are fine.
- No `guideAnchor` on this control.
- Cover rolls never use `upgradeDefenseX` or `downgradeDefenseX`.
- Red defender: conversion is a no-op unless Downgrade created white dice; the control stays enabled.
- Gathered pool includes Danger Sense extras (`totalDefenseDice`).
- Compose order is always Downgrade, then Upgrade.
- Do not modify `splitDowngradedDefensePool`.
- Do not refactor simulate/calculateWounds parameter lists into an options object.
- Do not change standalone `calculateDefensePool` / `getDefenseDistributionForDiceCount` APIs.
- Do not change Uncanny Luck selection (already red-first).
- Follow `url-state-new-inputs` and conventional commits (`feat:`, `test:`).
- If executing in isolation, create the worktree with `superpowers:using-git-worktrees` first.

**Spec:** `docs/superpowers/specs/2026-08-23-upgrade-defense-dice-x-design.md`

---

## File Structure

**Create:** none.

**Modify:**

- `src/engine/simulate.ts` — `applyUpgradeDefenseToPool`; call it after `splitDowngradedDefensePool` in both wounds functions; `upgradeDefenseX` param immediately after `downgradeDefenseX`
- `src/engine/probability.ts` — pass `upgradeDefenseX` through `calculateWounds`
- `src/engine/__tests__/simulate.test.ts` — helper, compose, wounds sim tests; insert `0` before `runs` at existing call sites
- `src/types.ts` — `PoolConfig.upgradeDefenseX`
- `src/poolResults.ts` — default + `computePoolResults`
- `src/poolResults.test.ts` — pass-through assertion
- `src/urlState.ts` — `upDef` on `UrlPoolState`
- `src/urlState.test.ts` — parse/build round-trip
- `src/poolConfigEditor.ts` — setter + URL mapping
- `src/poolConfigEditor.test.ts` — setter mock
- `src/App.tsx` — state, reset, UI input after Uncanny Luck, URL init
- `src/share/describeActiveModifiers.ts` — label after Uncanny Luck
- `src/share/describeActiveModifiers.test.ts`
- `src/poolSnapshot.ts` — defense keyword line after Uncanny Luck
- `src/poolSnapshot.test.ts`

---

### Task 1: applyUpgradeDefenseToPool helper

**Files:**
- Modify: `src/engine/simulate.ts`
- Test: `src/engine/__tests__/simulate.test.ts`

**Interfaces:**
- Consumes: `DefensePool` from `src/types.ts`; existing `splitDowngradedDefensePool`
- Produces: `applyUpgradeDefenseToPool(pool: DefensePool, upgradeDefenseX: number): DefensePool`

- [ ] **Step 1: Write the failing tests**

Add this import to the existing simulate test import list from `'../simulate'`:

```ts
  applyUpgradeDefenseToPool,
```

Append at the end of `src/engine/__tests__/simulate.test.ts`:

```ts
describe('applyUpgradeDefenseToPool', () => {
  it('leaves the pool unchanged when X is 0', () => {
    expect(applyUpgradeDefenseToPool({ red: 0, white: 5 }, 0)).toEqual({
      red: 0,
      white: 5,
    });
  });

  it('converts min(X, white) white dice to red', () => {
    expect(applyUpgradeDefenseToPool({ red: 0, white: 5 }, 2)).toEqual({
      red: 2,
      white: 3,
    });
  });

  it('converts all white dice when X is greater than white', () => {
    expect(applyUpgradeDefenseToPool({ red: 0, white: 2 }, 4)).toEqual({
      red: 2,
      white: 0,
    });
  });

  it('leaves a red-only pool unchanged for any X', () => {
    expect(applyUpgradeDefenseToPool({ red: 4, white: 0 }, 3)).toEqual({
      red: 4,
      white: 0,
    });
  });

  it('treats negative X as 0', () => {
    expect(applyUpgradeDefenseToPool({ red: 1, white: 2 }, -2)).toEqual({
      red: 1,
      white: 2,
    });
  });

  it('treats non-integer X by flooring', () => {
    expect(applyUpgradeDefenseToPool({ red: 0, white: 3 }, 1.9)).toEqual({
      red: 1,
      white: 2,
    });
  });

  it('applies after splitDowngradedDefensePool: red 5, downgrade 2, upgrade 1', () => {
    const afterDowngrade = splitDowngradedDefensePool('red', 5, 2);
    expect(afterDowngrade).toEqual({ red: 3, white: 2 });
    expect(applyUpgradeDefenseToPool(afterDowngrade, 1)).toEqual({
      red: 4,
      white: 1,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/engine/__tests__/simulate.test.ts -t "applyUpgradeDefenseToPool"`

Expected: FAIL (`applyUpgradeDefenseToPool` is not exported / not defined)

- [ ] **Step 3: Write minimal implementation**

In `src/engine/simulate.ts`, immediately after `splitDowngradedDefensePool` (do not edit that function), add:

```ts
/** Convert up to X white defense dice to red after gathering (and after downgrade). */
export function applyUpgradeDefenseToPool(
  pool: DefensePool,
  upgradeDefenseX: number
): DefensePool {
  const normalizedUpgradeX = Math.max(0, Math.floor(upgradeDefenseX));
  const white = Math.max(0, Math.floor(pool.white));
  const red = Math.max(0, Math.floor(pool.red));
  if (normalizedUpgradeX <= 0 || white <= 0) {
    return { red, white };
  }
  const converted = Math.min(normalizedUpgradeX, white);
  return { red: red + converted, white: white - converted };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/engine/__tests__/simulate.test.ts -t "applyUpgradeDefenseToPool"`

Expected: PASS

Also run: `npm test -- src/engine/__tests__/simulate.test.ts -t "splitDowngradedDefensePool"`

Expected: PASS (existing helper unchanged)

- [ ] **Step 5: Commit**

```bash
git add src/engine/simulate.ts src/engine/__tests__/simulate.test.ts
git commit -m "$(cat <<'EOF'
feat(engine): convert white defense dice for Upgrade Defense X

EOF
)"
```

---

### Task 2: Apply upgrade on the main defense roll

**Files:**
- Modify: `src/engine/simulate.ts` (`simulateWounds`, `simulateWoundsFromAttackResults`)
- Modify: `src/engine/probability.ts` (`calculateWounds`)
- Modify: `src/engine/__tests__/simulate.test.ts` (new tests + insert `0` before `runs` at every existing positional call)

**Interfaces:**
- Consumes: `splitDowngradedDefensePool`, `applyUpgradeDefenseToPool`, `rollDefensePoolDetailed`, `applyUncannyLuckRerollsToOutcomes`
- Produces: `simulateWounds(..., downgradeDefenseX = 0, upgradeDefenseX = 0, runs, rng)` and the same extra param on `simulateWoundsFromAttackResults`. `calculateWounds(..., downgradeDefenseX?: number, upgradeDefenseX?: number)`.

**Call-site rule:** Adding `upgradeDefenseX` immediately after `downgradeDefenseX` (before `runs`) shifts every existing `simulateWounds` / `simulateWoundsFromAttackResults` call that already passes `runs`. TypeScript will error (`number` vs `() => number`). Fix by inserting `0, // upgradeDefenseX` immediately after the current `downgradeDefenseX` argument and immediately before `runs`. That includes calls that pass `2, // downgradeDefenseX`. Do **not** add the argument to `calculateWounds` callers that omit trailing optionals.

- [ ] **Step 1: Write the failing wounds tests**

Append to `src/engine/__tests__/simulate.test.ts`:

```ts
describe('Upgrade Defense X in wounds simulation', () => {
  const attackResults: AttackResults = {
    expectedHits: 3,
    expectedCrits: 1,
    expectedTotal: 4,
    distribution: [],
    distributionByHitsCrits: [{ hits: 3, crits: 1, probability: 1 }],
    cumulative: [],
  };
  const runs = 5000;

  it('white defender: Upgrade 2 yields lower or equal expected wounds than 0', () => {
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
      0, // downgradeDefenseX
      0, // upgradeDefenseX
      runs,
      createSeededRng(42)
    );
    const woundsUpgrade2 = simulateWoundsFromAttackResults(
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
      0, // downgradeDefenseX
      2, // upgradeDefenseX
      runs,
      createSeededRng(42)
    );
    expect(woundsUpgrade2.expectedWounds).toBeLessThanOrEqual(
      woundsNone.expectedWounds
    );
  });

  it('red defender: Upgrade 2 matches Upgrade 0 when Downgrade is 0', () => {
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
      0,
      0,
      runs,
      createSeededRng(7)
    );
    const woundsUpgrade2 = simulateWoundsFromAttackResults(
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
      0,
      2,
      runs,
      createSeededRng(7)
    );
    expect(woundsUpgrade2.expectedWounds).toBeCloseTo(
      woundsNone.expectedWounds,
      10
    );
  });

  it('white defender with cover: Upgrade 2 vs 0 does not change cover cancellations (wounds still drop or stay)', () => {
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
      0,
      runs,
      createSeededRng(11)
    );
    const woundsUpgrade2 = simulateWoundsFromAttackResults(
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
      2,
      runs,
      createSeededRng(11)
    );
    expect(woundsUpgrade2.expectedWounds).toBeLessThanOrEqual(
      woundsNone.expectedWounds
    );
  });

  it('red defender: Downgrade 2 then Upgrade 1 yields lower or equal wounds than Downgrade 2 alone', () => {
    const woundsDowngradeOnly = simulateWoundsFromAttackResults(
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
      0, // upgradeDefenseX
      runs,
      createSeededRng(13)
    );
    const woundsBoth = simulateWoundsFromAttackResults(
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
      1, // upgradeDefenseX
      runs,
      createSeededRng(13)
    );
    expect(woundsBoth.expectedWounds).toBeLessThanOrEqual(
      woundsDowngradeOnly.expectedWounds
    );
  });
});
```

Until the new parameter exists, these tests fail with “Expected N arguments, but got N+1”. That is the intended failing signal.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/engine/__tests__/simulate.test.ts -t "Upgrade Defense X"`

Expected: FAIL (too many arguments / param not in signature)

- [ ] **Step 3: Add the parameter and apply the helper**

**`simulateWounds`** — add after `downgradeDefenseX: number = 0,`:

```ts
  upgradeDefenseX: number = 0,
```

Near the other `normalized*` locals:

```ts
  const normalizedUpgradeDefenseX = Math.max(0, Math.floor(upgradeDefenseX));
```

Replace the block that currently does:

```ts
    const splitPool = splitDowngradedDefensePool(
      defenseDieColor,
      totalDefenseDice,
      normalizedDowngradeDefenseX
    );
    const defenseOutcomes = rollDefensePoolDetailed(splitPool, rng);
```

with:

```ts
    const splitPool = splitDowngradedDefensePool(
      defenseDieColor,
      totalDefenseDice,
      normalizedDowngradeDefenseX
    );
    const upgradedPool = applyUpgradeDefenseToPool(
      splitPool,
      normalizedUpgradeDefenseX
    );
    const defenseOutcomes = rollDefensePoolDetailed(upgradedPool, rng);
```

Do **not** pass `upgradeDefenseX` into `applyCover`. Leave Uncanny Luck and wound counting unchanged.

**`simulateWoundsFromAttackResults`** — same new parameter, same `normalizedUpgradeDefenseX`, same replacement of the split → roll pair. Do **not** pass `upgradeDefenseX` into `applyCover`.

**`calculateWounds`** in `src/engine/probability.ts` — add `upgradeDefenseX?: number` after `downgradeDefenseX?: number`. After `normalizedDowngradeDefenseX`:

```ts
  const normalizedUpgradeDefenseX = Math.max(
    0,
    Math.floor(upgradeDefenseX ?? 0)
  );
```

Pass `normalizedUpgradeDefenseX` into `simulateWoundsFromAttackResults` immediately after `normalizedDowngradeDefenseX` and immediately before `DEFAULT_RUNS`.

- [ ] **Step 4: Fix existing simulate call sites**

In `src/engine/__tests__/simulate.test.ts`, every `simulateWounds(` and `simulateWoundsFromAttackResults(` that currently ends with `downgradeDefenseX, runs, rng` must insert `0, // upgradeDefenseX` before `runs`.

There are many such calls (search for `// downgradeDefenseX` and for the un-commented last `0` immediately before `runs` in those two functions). Apply the same insertion at each. Do not change `calculateWounds` tests unless TypeScript reports an error (it should not).

Example — a call that today ends:

```ts
      0, // downgradeDefenseX
      runs,
      createSeededRng(42)
```

Change to:

```ts
      0, // downgradeDefenseX
      0, // upgradeDefenseX
      runs,
      createSeededRng(42)
```

A call that today ends `2, // downgradeDefenseX` then `runs` becomes:

```ts
      2, // downgradeDefenseX
      0, // upgradeDefenseX
      runs,
```

- [ ] **Step 5: Run tests**

Run: `npm test -- src/engine/__tests__/simulate.test.ts`

Run: `npm test -- src/engine/__tests__/probability.test.ts`

Expected: PASS (including existing Downgrade and Uncanny Luck red-first tests)

- [ ] **Step 6: Commit**

```bash
git add src/engine/simulate.ts src/engine/probability.ts src/engine/__tests__/simulate.test.ts
git commit -m "$(cat <<'EOF'
feat(engine): apply Upgrade Defense X on the main defense roll

EOF
)"
```

---

### Task 3: PoolConfig, URL, UI, share, snapshots

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
- Consumes: `calculateWounds(..., upgradeDefenseX)` from Task 2
- Produces: `PoolConfig.upgradeDefenseX: string`; `UrlPoolState.upDef: number` (default `0`, omitted when 0); App control `id="upgrade-defense-dice-x"`; share/snapshot label `Upgrade Defense Dice X N` on the defense list

- [ ] **Step 1: Write the failing plumbing tests**

**`src/urlState.test.ts`** — inside `describe('parseFragment')`, next to the `downDef` tests:

```ts
    it('parses upDef and roundtrips in buildFragment', () => {
      const parsed = parseFragment('#upDef=2');
      expect(parsed.upDef).toBe(2);
      const fragment = buildFragment({ ...DEFAULT_URL_STATE, upDef: 2 });
      expect(fragment).toContain('upDef=2');
      expect(parseFragment('#' + fragment).upDef).toBe(2);
    });

    it('omits upDef from the fragment when it is 0', () => {
      const fragment = buildFragment({ ...DEFAULT_URL_STATE, upDef: 0 });
      expect(fragment).not.toContain('upDef');
    });
```

**`src/share/describeActiveModifiers.test.ts`** — add `upgradeDefenseX: '2'` to the “lists non-default” config and:

```ts
    expect(labels).toContain('Upgrade Defense Dice X 2');
```

**`src/poolSnapshot.test.ts`** — add:

```ts
  it('includes Upgrade Defense Dice X in Defense when set', () => {
    const sections = formatPoolSnapshot({
      ...DEFAULT_POOL_CONFIG,
      upgradeDefenseX: '2',
    });
    expect(lineValue(sections, 'Defense', 'Upgrade Defense Dice X')).toBe('2');
  });
```

**`src/poolResults.test.ts`** — in the “matches calling the engine functions directly” test, add `upgradeDefenseX: '2'` to `config` and pass `2` as the last argument to `calculateWounds` (after the existing `2` downgradeDefenseX argument).

**`src/poolConfigEditor.test.ts`** — add `setUpgradeDefenseX: vi.fn()` to the setters object. After `applyConfigToEditor` with `upgradeDefenseX: '2'` on `config`, assert `setters.setUpgradeDefenseX` was called with `'2'`.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```
npm test -- src/urlState.test.ts src/share/describeActiveModifiers.test.ts src/poolSnapshot.test.ts src/poolResults.test.ts src/poolConfigEditor.test.ts
```

Expected: FAIL (missing `upDef` / `upgradeDefenseX`)

- [ ] **Step 3: Implement types and computePoolResults**

`src/types.ts` — on `PoolConfig`, after `uncannyLuckX`:

```ts
  upgradeDefenseX: string;
```

`src/poolResults.ts` — `DEFAULT_POOL_CONFIG.upgradeDefenseX: ''` (after `uncannyLuckX`). Pass `toCount(config.upgradeDefenseX)` as the last argument to `calculateWounds` (after `toCount(config.downgradeDefenseX)`).

- [ ] **Step 4: Implement URL state**

`src/urlState.ts`:

- `UrlPoolState`: `upDef: number;` after `downDef`
- `DEFAULT_URL_STATE_POOL`: `upDef: 0,`
- `parsePool`: `upDef: parseNumber(get('upDef'), DEFAULT_URL_STATE_POOL.upDef),`

No custom serializer needed; `buildFragment` already omits default `0`.

- [ ] **Step 5: Implement poolConfigEditor**

`PoolEditorSetters`: `setUpgradeDefenseX: (value: string) => void;` (after `setUncannyLuckX`).

`applyConfigToEditor`: `setters.setUpgradeDefenseX(config.upgradeDefenseX);` after `setUncannyLuckX`.

`configToUrlPoolState`: `upDef: toCount(config.upgradeDefenseX),` after `downDef`.

- [ ] **Step 6: Implement App.tsx**

`poolStateToConfig`: `upgradeDefenseX: numToInput(pool.upDef),` after `uncannyLuckX`.

State (with defense keywords, after `uncannyLuckX`):

```ts
  const [upgradeDefenseX, setUpgradeDefenseX] = useState<string>(() =>
    initialFromUrl
      ? initialFromUrl.upDef === 0
        ? ''
        : String(initialFromUrl.upDef)
      : ''
  );
```

Add `upgradeDefenseX` to `simulationInputs` and its dependency array, to `liveConfig`, and `setUpgradeDefenseX` to `poolEditorSetters`. In `handleReset`, `setUpgradeDefenseX('')` after `setUncannyLuckX('')`.

In Defense Keywords, **immediately after** the Uncanny Luck `NumberInputWithControls`, **before** the Tokens heading:

```tsx
              <NumberInputWithControls
                id="upgrade-defense-dice-x"
                label="Upgrade Defense Dice X"
                value={upgradeDefenseX}
                onChange={setUpgradeDefenseX}
                min={0}
                title="Convert up to X white defense dice to red after gathering the defense pool (including Danger Sense extras). No effect when there are no white dice. Does not affect cover. Uncanny Luck rerolls red dice first."
              />
```

Do **not** pass `guideAnchor`.

- [ ] **Step 7: Implement share and snapshots**

`src/share/describeActiveModifiers.ts` — after the Uncanny Luck `countLabel` line:

```ts
  labels.push(
    countLabel('Upgrade Defense Dice X', config.upgradeDefenseX)
  );
```

`src/poolSnapshot.ts` — after `addCountLine(..., 'Uncanny Luck', ...)`:

```ts
  addCountLine(defenseLines, 'Upgrade Defense Dice X', config.upgradeDefenseX);
```

- [ ] **Step 8: Run tests**

Run:

```
npm test -- src/urlState.test.ts src/share/describeActiveModifiers.test.ts src/poolSnapshot.test.ts src/poolResults.test.ts src/poolConfigEditor.test.ts
npm test
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/types.ts src/poolResults.ts src/poolResults.test.ts src/urlState.ts src/urlState.test.ts src/poolConfigEditor.ts src/poolConfigEditor.test.ts src/App.tsx src/share/describeActiveModifiers.ts src/share/describeActiveModifiers.test.ts src/poolSnapshot.ts src/poolSnapshot.test.ts
git commit -m "$(cat <<'EOF'
feat: add Upgrade Defense Dice X to defense pool configuration

EOF
)"
```

---

## Self-review (author)

**Spec coverage**

| Spec requirement | Task |
| --- | --- |
| `applyUpgradeDefenseToPool` white→red, leftover X unused, red-only no-op | Task 1 |
| Do not change `splitDowngradedDefensePool` | Task 1 constraint + compose test |
| Downgrade then Upgrade | Task 1 compose test + Task 2 wounds test |
| Wounds path after gather, cover untouched | Task 2 |
| Param immediately after `downgradeDefenseX` | Task 2 |
| Standalone defense APIs unchanged | Task 2 constraint |
| No Uncanny Luck rewrite | Task 2 constraint; existing red-first tests must stay green |
| UI after Uncanny Luck, no `guideAnchor`, always enabled | Task 3 |
| URL `upDef`, omit at 0 | Task 3 |
| Share/snapshot on defense list | Task 3 |

**Placeholders:** none.

**Type names:** `upgradeDefenseX` (code) / **Upgrade Defense Dice X** (label) / `upDef` (URL) used consistently across tasks.
