# Cover Dice Color — Design

**Date:** 2026-08-23

## Goal

Replace the **Dug In** checkbox with a **Cover dice** White/Red selector. Cover rolls use the selected defense die color. White is the default. This matches current Legion rules: more than one upgrade (Dug In, Hit the Dirt) can make the cover roll red, so the calculator should not name a single card.

## Product decisions

| Topic | Decision |
| --- | --- |
| Control | Radio group labeled **Cover dice**, White / Red |
| Default | White |
| When Cover is None | Control stays enabled; stored color is kept; engine does not roll cover |
| Independence | Cover dice never follows or writes **Defense dice** |
| URL | New key `cColor`; drop `dug` / `dugIn`; no migration of old `#dug=1` links |
| Quick Guide | No `guideAnchor` |
| Named upgrades | Out of scope (no Dug In or Hit the Dirt checkboxes) |

## Rules

Cover math is unchanged:

- Light cover: blocks cancel hits.
- Heavy cover: blocks and surges cancel hits.
- Crits bypass cover.
- Cover None: no cover roll, regardless of Cover dice color.

`applyCover` already takes `coverDieColor` (default `'white'`). Call sites pass the selected color instead of deriving it from `dugIn`.

## Architecture

Replace `dugIn: boolean` with `coverDieColor: DefenseDieColor` (`'red' | 'white'`) on `PoolConfig` and through the engine. Default `'white'`.

Do not keep a boolean alias. Do not refactor the long `simulateWounds` / `calculateWounds` parameter lists into an options object.

**Engine** (`src/engine/simulate.ts`, `src/engine/probability.ts`)

- `simulateWounds` and `simulateWoundsFromAttackResults`: replace the `dugIn: boolean = false` parameter (same position, after `coverX`) with `coverDieColor: DefenseDieColor = 'white'`. Pass that value into `applyCover`. Delete the `dugIn ? 'red' : 'white'` derivation.
- `calculateWounds`: replace `dugIn?: boolean` with `coverDieColor?: DefenseDieColor`; pass `coverDieColor ?? 'white'` into simulation.
- `computePoolResults`: pass `config.coverDieColor` in that slot.
- `applyCover` itself does not change.

**App wiring**

Thread `coverDieColor` the same way other pool fields are threaded today: App state → debounced inputs → `PoolConfig` → `computePoolResults`. Compare apply/load uses `applyConfigToEditor` (`setCoverDieColor` instead of `setDugIn`). Reset sets Cover dice to `'white'`.

## Data model

- `PoolConfig.coverDieColor: DefenseDieColor` — default `'white'`.
- `DEFAULT_POOL_CONFIG.coverDieColor: 'white'`.
- Remove `PoolConfig.dugIn`.
- `types.ts` Cover comment: cover rolls white or red defense dice from the Cover dice selector; only hits can be cancelled (crits bypass). Do not mention Dug In.

## UI

New `CoverDiceToggle` immediately after `CoverToggle`, replacing the Dug In `CheckboxToggle`.

- Same fieldset/radio pattern as `DefenseDiceToggle`.
- Reuse `defense-dice-toggle` styles (`DefenseDiceToggle.css`): first option gray, last option red. `DefenseDiceToggle` already lists White then Red, so Cover dice uses that same order.
- Option order: **White**, then **Red**.
- Radio `name="cover-dice"`.
- Legend: **Cover dice**.
- Tooltip (`title` on the fieldset): "Dice color for the cover roll. Independent of the main defense pool."
- Always enabled, including when Cover is None.
- No `guideAnchor`.
- App state: `useState<DefenseDieColor>(...)`, init from URL `cColor`, default `'white'`.
- Reset: `'white'`.

## URL state

| State | Key | Type | Default | Omit when |
| --- | --- | --- | --- | --- |
| coverDieColor | `cColor` | `'red' \| 'white'` | `'white'` | `'white'` |

Follow the existing URL-state checklist for new inputs: `UrlPoolState`, `DEFAULT_URL_STATE_POOL`, `parsePool` / `parseFragment` / `buildFragment`, App init/sync/reset, `PoolEditorSetters` / `applyConfigToEditor` / `configToUrlPoolState`, comparison `a.` prefix.

- On `UrlPoolState`, replace `dugIn: boolean` with `cColor: DefenseColorOption` (same type as `dColor`). Default `'white'`. Fragment key is `cColor`.
- Parse with `parseEnum(get('cColor'), D_COLOR_VALUES, 'white')`. Invalid or missing → white. Reuse `D_COLOR_VALUES` (`['red', 'white']`).
- Delete `poolKey` (it exists only to serialize `dugIn` as `dug`). After that, every pool field uses its property name as the fragment key.
- Do not read `dug`. Old `#dug=1` links open as white cover dice.

## Share and snapshots

**`formatPoolSnapshot`** (`src/poolSnapshot.ts`)

Always include a **Cover dice** line after **Cover**, same as **Defense die** (always shown, not only when non-default):

- `'white'` → `White`
- `'red'` → `Red`

Remove the **Dug In** boolean line (`addBooleanLine(..., 'Dug In', ...)`).

**`describeActiveModifiers`** (`src/share/describeActiveModifiers.ts`)

- If `coverDieColor === 'red'`, push `'Cover dice Red'` after the Cover Light / Cover Heavy labels.
- If white, omit (default).
- Remove `'Dug In'`.

## Testing

**Engine** (`src/engine/__tests__/simulate.test.ts`)

- Rename the Dug In wounds case: same seed, light cover, `coverDieColor: 'red'` vs `'white'` → expected wounds with red ≤ white.
- Existing `applyCover` red-vs-white test stays.
- Update positional `dugIn` arguments in simulate tests to `'white'` / `'red'`.

**URL** (`src/urlState.test.ts`)

- `cColor=red` parse/build round-trip; omitted at white.
- Invalid `cColor` → white.
- `dug` / `dug=1` does not set red.

**UI** (`src/components/CoverDiceToggle.test.tsx`)

- White and Red radios; White selected by default; choosing Red calls `onChange('red')`; control is not disabled.

**Snapshots / share**

- Default snapshot: Cover dice is `White` (`src/poolSnapshot.test.ts`).
- `coverDieColor: 'red'` → Cover dice `Red`; no Dug In line.
- `describeActiveModifiers`: red → contains `'Cover dice Red'`; white → does not (`src/share/describeActiveModifiers.test.ts`).

**Wiring**

- `src/poolConfigEditor.test.ts`: `setCoverDieColor` instead of `setDugIn`; `configToUrlPoolState` maps `cColor`.
- `DEFAULT_POOL_CONFIG` and App reset use `'white'`.

## Error handling

- Invalid or missing `cColor`: white.
- Cover None: stored color ignored by the engine (no cover roll).
- Cover dice and Defense dice may differ; both are valid.

## Out of scope

- Migrating old `#dug=1` URLs
- Named Dug In or Hit the Dirt controls
- Legion Quick Guide link
- Changing cover cancellation rules
- Combining Cover level and Cover dice into one control
- Updating historical Dug In docs under `docs/plans/` and older superpowers plans
- Refactoring `simulateWounds` / `calculateWounds` to an options object
