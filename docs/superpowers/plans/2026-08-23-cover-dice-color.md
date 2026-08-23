# Cover Dice Color Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Dug In checkbox with a Cover dice White/Red selector so cover rolls use an explicit die color (default white).

**Architecture:** Swap `dugIn: boolean` for `coverDieColor: DefenseDieColor` on `PoolConfig` and through `simulateWounds` / `simulateWoundsFromAttackResults` / `calculateWounds`. `applyCover` already takes `coverDieColor`; stop deriving it from a boolean. URL key is `cColor` (omit when white). UI is `CoverDiceToggle` after Cover. No Quick Guide link. No migration of `#dug=1`.

**Tech Stack:** TypeScript, Vitest, React 19 Testing Library, existing `DefenseDiceToggle` / `urlState` / `computePoolResults` patterns.

## Global Constraints

- Full descriptive names for variables and parameters (never `c`, `s`, `h`, `b`, `d`, `p`, `n`, `x` for domain concepts). Loop counters `i`/`j` are fine.
- No `guideAnchor` on Cover dice.
- Cover math is unchanged (light = blocks; heavy = blocks+surges; crits bypass; Cover none does not roll).
- Cover dice never follows or writes Defense dice.
- Do not keep a `dugIn` boolean alias.
- Do not refactor simulate / `calculateWounds` parameter lists into an options object.
- Do not migrate old `#dug=1` URLs.
- Do not change `applyCover` beyond receiving the selected color from call sites (it already accepts `coverDieColor`).
- Do not edit historical Dug In docs under `docs/plans/`.
- Do not include unrelated working-tree edits (`src/components/DefenseDiceToggle.*`, `docs/superpowers/plans/2026-08-23-downgrade-defense-x.md`) in these commits.
- Follow conventional commits (`feat:`, `test:`).
- After each task, format only files you touched: `npx prettier --write <files>`.
- If executing in isolation, create the worktree with `superpowers:using-git-worktrees` first.

**Spec:** `docs/superpowers/specs/2026-08-23-cover-dice-color-design.md`

---

## File Structure

**Create:**

- `src/components/CoverDiceToggle.tsx` — White/Red radio group labeled Cover dice
- `src/components/CoverDiceToggle.css` — first option gray, last option red (White then Red)
- `src/components/CoverDiceToggle.test.tsx` — radios, default White, onChange Red, not disabled

**Modify:**

- `src/engine/simulate.ts` — `coverDieColor` param on `simulateWounds` and `simulateWoundsFromAttackResults`
- `src/engine/probability.ts` — `coverDieColor` on `calculateWounds`
- `src/engine/__tests__/simulate.test.ts` — wounds test + positional args
- `src/types.ts` — `PoolConfig.coverDieColor`; Cover comment
- `src/poolResults.ts` — default + `computePoolResults`
- `src/poolResults.test.ts` — `'white'` in the `calculateWounds` positional slot
- `src/urlState.ts` — `cColor`; delete `poolKey`
- `src/urlState.test.ts` — parse/build/`dug` ignored
- `src/poolConfigEditor.ts` — `setCoverDieColor` + `cColor` mapping
- `src/poolConfigEditor.test.ts` — setter mock
- `src/poolSnapshot.ts` / `src/poolSnapshot.test.ts` — always show Cover dice
- `src/share/describeActiveModifiers.ts` / `.test.ts` — `Cover dice Red` when red
- `src/App.tsx` — state, reset, URL init, replace checkbox

---

### Task 1: Engine `coverDieColor` parameter

**Files:**
- Modify: `src/engine/simulate.ts`
- Modify: `src/engine/probability.ts`
- Modify: `src/engine/__tests__/simulate.test.ts`
- Modify: `src/poolResults.ts` (temporary map `config.dugIn ? 'red' : 'white'` so `calculateWounds` typechecks until Task 2)
- Modify: `src/poolResults.test.ts` (the `calculateWounds` call currently passes `false` in the dugIn slot)

**Interfaces:**
- Consumes: `applyCover(..., coverDieColor)` already in `simulate.ts`; `DefenseDieColor` from `src/types.ts`
- Produces: `simulateWounds(..., coverDieColor: DefenseDieColor = 'white', sharpshooterX = 0, ...)` — same position as today’s `dugIn` (immediately after `coverX`). Same for `simulateWoundsFromAttackResults`. `calculateWounds(..., coverDieColor?: DefenseDieColor, ...)` passes `coverDieColor ?? 'white'`.

- [ ] **Step 1: Rewrite the wounds test to use colors**

`coverDieColor` sits in the middle of a positional list (`runs` / `rng` come after it), so you cannot omit it without also dropping later arguments. Do not add an “omitted equals white” call.

In `src/engine/__tests__/simulate.test.ts`, rename `describe('Dug In in wounds simulation', ...)` to `describe('cover die color in wounds simulation', ...)`. Change the example name to `'red cover dice with light cover yield lower or equal expected wounds than white'`. Rename locals `woundsDugInOff` / `woundsDugInOn` to `woundsWhite` / `woundsRed`. In the two `simulateWoundsFromAttackResults` calls, replace the boolean in the slot after `coverX` (`false` then `true`) with `'white'` then `'red'`. Keep the same `attackResults` object, `runs = 5000`, `createSeededRng(42)`, and `toBeLessThanOrEqual` assertion.

Keep the existing `applyCover` example `coverDieColor red: with same seed can cancel more hits than white`.

- [ ] **Step 2: Run the file (may still pass while the param is a boolean)**

Run: `npm test -- src/engine/__tests__/simulate.test.ts`

Expected: the file still runs. Both `'white'` and `'red'` are truthy, so while `dugIn` is a boolean both calls use red cover dice and `toBeLessThanOrEqual` can pass vacuously. Implement Step 3 anyway — this is a signature migration, not a new formula.

- [ ] **Step 3: Implement engine parameter**

In `src/engine/simulate.ts`, on **both** `simulateWounds` and `simulateWoundsFromAttackResults`, replace:

```ts
  dugIn: boolean = false,
```

with:

```ts
  coverDieColor: DefenseDieColor = 'white',
```

Delete both of these lines:

```ts
  const coverDieColor: DefenseDieColor = dugIn ? 'red' : 'white';
```

`applyCover` already receives `coverDieColor` as its last argument — leave that call as-is.

In `src/engine/probability.ts` `calculateWounds`, replace:

```ts
  dugIn?: boolean,
```

with:

```ts
  coverDieColor?: DefenseDieColor,
```

and replace `dugIn ?? false` in the `simulateWoundsFromAttackResults` call with:

```ts
    coverDieColor ?? 'white',
```

In `src/engine/__tests__/simulate.test.ts`, change `false, // dugIn` to `'white', // coverDieColor`.

Search the same file for other `simulateWounds` / `simulateWoundsFromAttackResults` calls that pass a boolean in that slot (the argument after `coverX`). Replace leftover `false` with `'white'` and `true` with `'red'`. `npx tsc -b --pretty false` will list remaining mismatches.

In `src/poolResults.ts`, until Task 2, pass color without renaming `PoolConfig` yet:

```ts
    config.dugIn ? 'red' : 'white',
```

in the `calculateWounds` argument that currently is `config.dugIn`.

In `src/poolResults.test.ts`, in the `calculateWounds(...)` call, replace the `false` that sits in the old dugIn slot (after `coverX`’s `0`, before `sharpshooterX`) with `'white'`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/engine/__tests__/simulate.test.ts src/poolResults.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/simulate.ts src/engine/probability.ts src/engine/__tests__/simulate.test.ts src/poolResults.ts src/poolResults.test.ts
git commit -m "feat(engine): pass coverDieColor instead of dugIn boolean"
```

---

### Task 2: `PoolConfig.coverDieColor` and URL `cColor`

Change the data model and URL in **one** commit so nothing has to map a boolean to a color as an intermediate step.

**Files:**
- Modify: `src/types.ts`
- Modify: `src/poolResults.ts`
- Modify: `src/urlState.ts`
- Modify: `src/urlState.test.ts`
- Modify: `src/poolConfigEditor.ts`
- Modify: `src/poolConfigEditor.test.ts`
- Modify: `src/App.tsx` (`poolStateToConfig` plus any `PoolConfig` literals; checkbox UI stays until Task 5)
- Modify: `src/poolSnapshot.ts` / `src/share/describeActiveModifiers.ts` only if `tsc` fails on `config.dugIn` — prefer the real snapshot/share edits in Task 3; a one-line delete of `config.dugIn` is enough to compile if you have not reached Task 3 yet.

**Interfaces:**
- Consumes: `DefenseDieColor`; existing `DefenseColorOption` and `D_COLOR_VALUES` in `urlState.ts`
- Produces: `PoolConfig.coverDieColor: DefenseDieColor` default `'white'`. `UrlPoolState.cColor: DefenseColorOption` default `'white'`. `PoolEditorSetters.setCoverDieColor`. `configToUrlPoolState` sets `cColor: config.coverDieColor`. `poolStateToConfig` sets `coverDieColor: pool.cColor`. `poolKey` is deleted. `dug` is not read.

- [ ] **Step 1: Write the failing URL and editor tests**

In `src/poolConfigEditor.test.ts`, rename `setDugIn: vi.fn()` to `setCoverDieColor: vi.fn()`. After `applyConfigToEditor(config, setters)`, add:

```ts
    expect(setters.setCoverDieColor).toHaveBeenCalledWith('white');
```

In the `configToUrlPoolState` example, add:

```ts
    expect(state.cColor).toBe('white');
```

Add inside `describe('parseFragment')` in `src/urlState.test.ts`:

```ts
    it('validates cColor enum and falls back to white for invalid', () => {
      expect(parseFragment('#cColor=invalid').cColor).toBe('white');
      expect(parseFragment('#cColor=red').cColor).toBe('red');
      expect(parseFragment('#cColor=white').cColor).toBe('white');
    });

    it('ignores legacy dug=1 and does not set red cover dice', () => {
      expect(parseFragment('#dug=1').cColor).toBe('white');
      expect(parseFragment('#dugIn=1').cColor).toBe('white');
    });
```

Add inside `describe('buildFragment')`:

```ts
    it('omits cColor at default white and roundtrips red', () => {
      expect(
        buildFragment({ ...DEFAULT_URL_STATE, cColor: 'white' })
      ).not.toContain('cColor');
      const fragment = buildFragment({
        ...DEFAULT_URL_STATE,
        cColor: 'red',
      });
      expect(fragment).toContain('cColor=red');
      expect(parseFragment('#' + fragment).cColor).toBe('red');
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/urlState.test.ts`

Expected: FAIL — `cColor` is not on the parsed state.

- [ ] **Step 3: Implement types, defaults, URL, editor, and App mapping**

`src/types.ts` — replace the Cover comment and `PoolConfig.dugIn`:

```ts
/** Cover rolls white or red defense dice from the Cover dice selector before main defense; only hits can be cancelled (crits bypass). */
export type CoverLevel = 'none' | 'light' | 'heavy';
```

On `PoolConfig`, replace `dugIn: boolean` with `coverDieColor: DefenseDieColor`.

`src/poolResults.ts` — `DEFAULT_POOL_CONFIG`: replace `dugIn: false` with `coverDieColor: 'white'`. Pass `config.coverDieColor` into `calculateWounds` (replace Task 1’s `config.dugIn ? 'red' : 'white'`).

`src/poolConfigEditor.ts`:

- `setDugIn: (value: boolean) => void` → `setCoverDieColor: (value: DefenseDieColor) => void`
- `setters.setDugIn(config.dugIn)` → `setters.setCoverDieColor(config.coverDieColor)`

Then URL state. In `src/urlState.ts` `UrlPoolState`, replace `dugIn: boolean` with:

```ts
  cColor: DefenseColorOption;
```

`DEFAULT_URL_STATE_POOL`: replace `dugIn: false` with `cColor: 'white'`.

**Delete** `poolKey` entirely. Change `parsePool`’s `get` to:

```ts
  const get = (key: keyof UrlPoolState) => params.get(prefix + key);
```

Replace `dugIn: parseBoolean(get('dugIn'))` with:

```ts
    cColor: parseEnum(
      get('cColor'),
      D_COLOR_VALUES,
      DEFAULT_URL_STATE_POOL.cColor
    ),
```

In `poolEntries`, replace `poolKey(key)` with `key`:

```ts
        `${prefix}${key}=${encodeURIComponent(serialized)}`
```

`src/poolConfigEditor.ts` `configToUrlPoolState`: replace `dugIn: config.dugIn` with:

```ts
    cColor: config.coverDieColor,
```

`src/App.tsx` `poolStateToConfig`: replace `dugIn: pool.dugIn` with `coverDieColor: pool.cColor`. In `simulationInputs` / `liveConfig`, use `coverDieColor` instead of `dugIn`. Checkbox state may stay `dugIn` until Task 5 **only if** you map `coverDieColor: dugIn ? 'red' : 'white'` when building `PoolConfig`. Prefer `useState<DefenseDieColor>` in Task 5; `poolStateToConfig` must set `coverDieColor: pool.cColor`.

If `src/poolSnapshot.ts` or `src/share/describeActiveModifiers.ts` still read `config.dugIn`, delete those reads so `tsc` passes (Task 3 adds Cover dice copy).

- [ ] **Step 4: Run tests**

Run: `npm test -- src/urlState.test.ts src/poolConfigEditor.test.ts src/poolResults.test.ts src/engine/__tests__/simulate.test.ts`

Then: `npx tsc -b --pretty false`

Expected: tests PASS. `tsc` PASS, or only leftover `config.dugIn` in snapshot/share — delete those reads (Task 3 restores Cover dice copy).

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/poolResults.ts src/urlState.ts src/urlState.test.ts src/poolConfigEditor.ts src/poolConfigEditor.test.ts src/App.tsx src/poolSnapshot.ts src/share/describeActiveModifiers.ts
git commit -m "feat: replace dugIn with coverDieColor and URL cColor"
```

---

### Task 3: Snapshots and share modifiers

**Files:**
- Modify: `src/poolSnapshot.ts`
- Modify: `src/poolSnapshot.test.ts`
- Modify: `src/share/describeActiveModifiers.ts`
- Modify: `src/share/describeActiveModifiers.test.ts`

**Interfaces:**
- Consumes: `PoolConfig.coverDieColor`
- Produces: snapshot line `{ label: 'Cover dice', value: 'White' | 'Red' }` always after Cover. Share label `'Cover dice Red'` only when red.

- [ ] **Step 1: Write the failing tests**

In `src/poolSnapshot.test.ts`, in `'always includes structural defense fields'`, add:

```ts
    expect(lineValue(sections, 'Defense', 'Cover dice')).toBe('White');
```

Replace `'includes optional defense modifier when non-default'` with:

```ts
  it('shows Cover dice Red when coverDieColor is red and never Dug In', () => {
    const sections = formatPoolSnapshot({
      ...DEFAULT_POOL_CONFIG,
      coverDieColor: 'red',
    });
    expect(lineValue(sections, 'Defense', 'Cover dice')).toBe('Red');
    expect(lineValue(sections, 'Defense', 'Dug In')).toBeUndefined();
  });
```

In `src/share/describeActiveModifiers.test.ts`, add:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/poolSnapshot.test.ts src/share/describeActiveModifiers.test.ts`

Expected: FAIL — no Cover dice line / still Dug In / no Cover dice Red label.

- [ ] **Step 3: Implement snapshot and share copy**

`src/poolSnapshot.ts` — after `{ label: 'Cover', value: coverLabel(config.cover) }`, push:

```ts
    {
      label: 'Cover dice',
      value: config.coverDieColor === 'red' ? 'Red' : 'White',
    },
```

Delete `addBooleanLine(defenseLines, 'Dug In', config.dugIn)`.

`src/share/describeActiveModifiers.ts` — replace `if (config.dugIn) labels.push('Dug In')` with:

```ts
  if (config.coverDieColor === 'red') labels.push('Cover dice Red');
```

Keep this immediately after the Cover Light / Cover Heavy pushes.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/poolSnapshot.test.ts src/share/describeActiveModifiers.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/poolSnapshot.ts src/poolSnapshot.test.ts src/share/describeActiveModifiers.ts src/share/describeActiveModifiers.test.ts
git commit -m "feat: show Cover dice color in snapshots and share text"
```

---

### Task 4: `CoverDiceToggle` component

**Files:**
- Create: `src/components/CoverDiceToggle.tsx`
- Create: `src/components/CoverDiceToggle.css`
- Create: `src/components/CoverDiceToggle.test.tsx`

**Interfaces:**
- Consumes: `DefenseDieColor` from `src/types.ts`; `SurgeToggle.css` option layout
- Produces: `CoverDiceToggle({ value, onChange }: { value: DefenseDieColor; onChange: (value: DefenseDieColor) => void })`

Copy the structure of `src/components/DefenseDiceToggle.tsx`. Do **not** change `DefenseDiceToggle` option order or CSS in this feature (defense default is red and stays listed however it is today). Cover dice is White then Red with its own first=gray / last=red CSS so the chips match the labels.

- [ ] **Step 1: Write the failing test**

Create `src/components/CoverDiceToggle.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CoverDiceToggle } from './CoverDiceToggle';

describe('CoverDiceToggle', () => {
  it('renders White and Red radios with White selected by default', () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <CoverDiceToggle value="white" onChange={onChange} />
    );
    const white = getByRole('radio', { name: 'White' });
    const red = getByRole('radio', { name: 'Red' });
    expect(white).toBeChecked();
    expect(red).not.toBeChecked();
    expect(white).toBeEnabled();
    expect(red).toBeEnabled();
    expect(getByRole('group', { name: 'Cover dice' })).toHaveAttribute(
      'title',
      'Dice color for the cover roll. Independent of the main defense pool.'
    );
  });

  it('calls onChange with red when Red is chosen', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { getByRole } = render(
      <CoverDiceToggle value="white" onChange={onChange} />
    );
    await user.click(getByRole('radio', { name: 'Red' }));
    expect(onChange).toHaveBeenCalledWith('red');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/CoverDiceToggle.test.tsx`

Expected: FAIL — `CoverDiceToggle` is not defined / module not found.

- [ ] **Step 3: Implement component**

`src/components/CoverDiceToggle.css` (clone `DefenseDiceToggle.css` selectors, rename the root class, first-child gray, last-child red):

```css
.cover-dice-toggle .surge-toggle__option:first-child {
  background: #f9fafb;
  border: 2px solid #d1d5db;
}

.cover-dice-toggle
  .surge-toggle__option:first-child.surge-toggle__option--active {
  background: #e5e7eb;
  border-color: #6b7280;
  box-shadow: 0 0 0 2px #6b7280;
  color: #1f2937;
  font-weight: 600;
}

.cover-dice-toggle .surge-toggle__option:last-child {
  background: #fee2e2;
  border: 2px solid #ef4444;
}

.cover-dice-toggle
  .surge-toggle__option:last-child.surge-toggle__option--active {
  background: #fecaca;
  border-color: #b91c1c;
  box-shadow: 0 0 0 2px #b91c1c;
  color: #991b1b;
  font-weight: 600;
}
```

If `DefenseDiceToggle.tsx` uses `surge-toggle__option` (with two underscores) rather than `surge-toggle__option`, **copy those class names exactly** from `DefenseDiceToggle.tsx` into both the new TSX and this CSS so chips actually apply.

`src/components/CoverDiceToggle.tsx`:

```tsx
import type { DefenseDieColor } from '../types';
import './SurgeToggle.css';
import './CoverDiceToggle.css';

interface CoverDiceToggleProps {
  value: DefenseDieColor;
  onChange: (value: DefenseDieColor) => void;
}

const OPTIONS: { value: DefenseDieColor; label: string }[] = [
  { value: 'white', label: 'White' },
  { value: 'red', label: 'Red' },
];

export function CoverDiceToggle({ value, onChange }: CoverDiceToggleProps) {
  return (
    <fieldset
      className="surge-toggle cover-dice-toggle"
      title="Dice color for the cover roll. Independent of the main defense pool."
    >
      <legend className="surge-toggle__legend">Cover dice</legend>
      <div className="surge-toggle__options">
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`surge-toggle__option ${
              value === option.value ? 'surge-toggle__option--active' : ''
            }`}
          >
            <input
              type="radio"
              name="cover-dice"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="surge-toggle__radio"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
```

Match `DefenseDiceToggle.tsx` class names one-for-one (`surge-toggle__legend` vs `surge-toggle__legend`, etc.).

- [ ] **Step 4: Run test**

Run: `npm test -- src/components/CoverDiceToggle.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/CoverDiceToggle.tsx src/components/CoverDiceToggle.css src/components/CoverDiceToggle.test.tsx
git commit -m "feat(ui): add CoverDiceToggle white/red selector"
```

---

### Task 5: App wiring

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `CoverDiceToggle`, `pool.cColor`, `PoolEditorSetters.setCoverDieColor`
- Produces: App state `coverDieColor: DefenseDieColor`, default `'white'`, reset `'white'`, always-enabled control after Cover

- [ ] **Step 1: Replace state, mapping, reset, and UI**

Import:

```ts
import { CoverDiceToggle } from './components/CoverDiceToggle';
```

Replace:

```ts
  const [dugIn, setDugIn] = useState<boolean>(
    () => initialFromUrl?.dugIn ?? false
  );
```

with:

```ts
  const [coverDieColor, setCoverDieColor] = useState<DefenseDieColor>(
    () => initialFromUrl?.cColor ?? 'white'
  );
```

In `simulationInputs` / dependency arrays / `liveConfig`, replace `dugIn` with `coverDieColor`.

In `poolEditorSetters`, replace `setDugIn` with `setCoverDieColor`.

In reset (`handleReset` / equivalent), replace `setDugIn(false)` with `setCoverDieColor('white')`.

Replace the Dug In `CheckboxToggle` immediately after `CoverToggle` with:

```tsx
              <CoverDiceToggle
                value={coverDieColor}
                onChange={setCoverDieColor}
              />
```

Grep `App.tsx` for `dugIn`, `setDugIn`, `Dug In`, `dug-in`. There should be zero hits.

- [ ] **Step 2: Run tests and typecheck**

Run: `npm test -- src/poolConfigEditor.test.ts src/urlState.test.ts src/poolSnapshot.test.ts src/share/describeActiveModifiers.test.ts src/components/CoverDiceToggle.test.tsx src/engine/__tests__/simulate.test.ts src/poolResults.test.ts`

Then: `npx tsc -b --pretty false`

Expected: tests PASS; `tsc` exits 0. If `tsc` reports remaining `dugIn`, fix those files in this task (do not leave a boolean alias).

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(ui): replace Dug In checkbox with Cover dice selector"
```

---

### Task 6: Full verification

**Files:** none new (fix only if the gate fails)

- [ ] **Step 1: Repo-wide grep**

Run: `rg -n "dugIn|Dug In|dug-in|setDugIn" src`

Expected: no matches under `src/`. Hits under `docs/plans/` are out of scope.

- [ ] **Step 2: Full gate**

Run:

```bash
npm test && npm run lint && npm run build
```

Expected: all pass. Prettier issues: `npx prettier --write` on files this branch touched, then re-run lint.

- [ ] **Step 3: Manual URL check** (optional but specified by `url-state-new-inputs`)

`npm run dev`, open `#cover=light&cColor=red` — Cover is Light, Cover dice is Red, expected wounds move vs the same URL without `cColor`. Open `#dug=1` — Cover dice stays White.

- [ ] **Step 4: Commit only if Step 1–2 required extra fixes**

```bash
git add -u src
git commit -m "fix: remove remaining dugIn references"
```

Skip this commit if the tree is already clean.

---

## Self-review (spec coverage)

| Spec requirement | Task |
| --- | --- |
| `coverDieColor` on engine, default white | 1 |
| `applyCover` math unchanged | 1 (call sites only) |
| `PoolConfig.coverDieColor`, default white | 2 |
| Types comment without Dug In | 2 |
| URL `cColor`, omit white, no `dug` migration, delete `poolKey` | 2 |
| Snapshot always Cover dice White/Red after Cover | 3 |
| Share `Cover dice Red` only when red | 3 |
| `CoverDiceToggle` White then Red, tooltip, always enabled, no guide | 4–5 |
| App after Cover, reset white, independent of Defense dice | 5 |
| Full grep + test/lint/build | 6 |
