# Downgrade Defense X — Design

**Date:** 2026-08-23

## Goal

Add **Downgrade Defense X** to the Attack Dice Pool configuration. After gathering the main defense pool, convert up to X red defense dice to white, then roll. Cover rolls are unchanged. This is a calculator helper, not a named Legion Quick Guide keyword.

## Product decisions

| Topic | Decision |
| --- | --- |
| Placement | Attack Keywords, after Pierce |
| White defender | No-op; control stays enabled |
| Dice converted | Full gathered pool, including Danger Sense extras |
| X larger than red dice | Convert all available red dice; leftover X does nothing |
| Cover | Never affected |
| Uncanny Luck | Reroll each die as its current color; spend red first, then white |
| Quick Guide | No `guideAnchor` |
| Upgrade Defense | Out of scope |
| Raw dice roller | Out of scope |

## Rules

**When:** After the engine computes `totalDefenseDice` (remaining successes after cover, armor, backup, shields, dodge/outmaneuver, plus `min(suppressionTokens, dangerSenseX)` extra dice). Before rolling those dice.

**Conversion** (`splitDowngradedDefensePool` returns `{ red, white }`):

- If `defenseDieColor` is white, or X ≤ 0: all `totalDefenseDice` stay that color (`{ red: total, white: 0 }` or `{ red: 0, white: total }`).
- If `defenseDieColor` is red and X > 0: `white = min(X, totalDefenseDice)`, `red = totalDefenseDice - white`.

Empty, invalid, negative, or non-integer X is treated as 0 (same as Pierce).

**Uncanny Luck (mixed pool):**

1. Eligibility is unchanged: dice that would not become blocks after defense surge conversion and defense surge tokens.
2. Each rerolled die keeps its color (a downgraded die rerolls as white).
3. Among rerollable dice, spend Uncanny Luck on **red first**, then white. Same-color pools are unchanged.

Example: 5 red gathered, Downgrade 2, Uncanny Luck 1, one red blank and one white blank → reroll the red blank.

## Architecture

Pure helper in `src/engine/simulate.ts` (exported for tests):

`splitDowngradedDefensePool(defenseDieColor, totalDefenseDice, downgradeDefenseX) → { red, white }`

Wounds simulation (`simulateWounds` and `simulateWoundsFromAttackResults`):

1. Compute `totalDefenseDice` as today.
2. Split with the helper.
3. Roll mixed `DefenseDieOutcome[]` (red then white), same shape as `rollDefensePoolDetailed`.
4. Apply Uncanny Luck via the per-die-color helper (`applyUncannyLuckRerollsToOutcomes`), with rerollable indices ordered red then white.
5. Resolve blocks, Pierce/Impervious, wounds as today.

Cover continues to use `coverDieColor` only (`dugIn ? 'red' : 'white'`).

`downgradeDefenseX` is threaded like Pierce: `PoolConfig` → `computePoolResults` → `calculateWounds` → both simulate functions (new parameter after `uncannyLuckX`). `calculateAttackPool` is unchanged.

Standalone `calculateDefensePool` / `getDefenseDistributionForDiceCount` are unchanged. Downgrade is an attack-vs-defense step, not a raw defense-pool option. Changing Uncanny Luck selection to red-first in the shared outcomes helper is in scope, because that helper is what wounds will use; it does not require adding `downgradeDefenseX` to standalone defense APIs.

Do not refactor the long simulate parameter lists into an options object.

## Data model

- `PoolConfig.downgradeDefenseX: string` — `''` means 0.
- `DEFAULT_POOL_CONFIG.downgradeDefenseX: ''`
- Engine params: `downgradeDefenseX?: number`, normalized with `Math.max(0, Math.floor(...))`.

## UI

- `NumberInputWithControls` in Attack Keywords after Pierce.
- `id="downgrade-defense-x"`
- Label: **Downgrade Defense**
- `min={0}`
- No `guideAnchor`
- Tooltip: "Convert up to X red defense dice to white after gathering the defense pool (including Danger Sense extras). No effect if the defender rolls white. Does not affect cover. Uncanny Luck rerolls red dice first."
- State: `downgradeDefenseX` as `useState<string>('')`. Reset to `''`. Init from URL like Pierce.
- Always enabled, including when defense is White.

## URL state

| State | Key | Default | Omit when |
| --- | --- | --- | --- |
| downgradeDefenseX | `downDef` | `0` | `0` |

Follow `url-state-new-inputs`: `UrlPoolState`, `DEFAULT_URL_STATE_POOL`, `parsePool` / `buildFragment`, App init/sync/reset, `poolConfigEditor` setters and `configToUrlPoolState`, comparison `a.` prefix.

## Share and snapshots

When the count is greater than 0, list **Downgrade Defense N** with the other attack keywords in `describeActiveModifiers` and `formatPoolSnapshot` (after Pierce).

## Testing

**Helper**

- White + any X → all white.
- Red + 0 → all red.
- Red + X < pool → `{ red: pool - X, white: X }`.
- Red + X > pool → all white.

**Simulation**

- Same seed, Red defender, Downgrade 2 vs 0 → expected wounds higher or equal.
- White defender, Downgrade 2 vs 0 → identical wounds.
- Cover dice color and count ignore `downgradeDefenseX`; a cover-present scenario yields the same cover cancellations with or without X.

**Uncanny Luck**

- Mixed rerollable red and white faces: chosen indices are red first.
- Existing same-color Uncanny Luck tests remain valid.

**URL / share**

- `downDef=2` parse/build round-trip; omitted at 0.
- Modifier and snapshot tests include the label when set.

## Out of scope

- Upgrade Defense
- Cover rolls
- Raw dice roller UI
- Legion Quick Guide link
- Mixed red/white as a user-facing Defense Pool control (defender is still Red or White)
- Refactoring simulate/calculateWounds to an options object
