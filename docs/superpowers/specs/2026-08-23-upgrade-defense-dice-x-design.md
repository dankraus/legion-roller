# Upgrade Defense Dice X — Design

**Date:** 2026-08-23

## Goal

Add **Upgrade Defense Dice X** to the Defense Dice Pool configuration. After the main defense pool is gathered, convert up to X white defense dice to red, then roll. Cover rolls are unchanged. This is a calculator helper, not a named Legion Quick Guide keyword.

Builds on the shipped **Downgrade Defense Dice X** work (`splitDowngradedDefensePool`, mixed-pool rolling, Uncanny Luck red-first). Do not change that helper.

## Product decisions

| Topic | Decision |
| --- | --- |
| Placement | Defense Keywords, after Uncanny Luck |
| Label | **Upgrade Defense Dice X** (matches live Downgrade label style) |
| Red defender | Control stays enabled; engine no-ops unless Downgrade created white dice |
| Dice converted | Full gathered pool, including Danger Sense extras |
| X larger than white dice | Convert all available white dice; leftover X does nothing |
| Cover | Never affected |
| Uncanny Luck | Unchanged: reroll each die as its current color; spend red first, then white |
| Quick Guide | No `guideAnchor` |
| Downgrade composition | Downgrade first, then Upgrade |
| Raw dice roller | Out of scope |
| `splitDowngradedDefensePool` | Do not change |

## Rules

**When:** After the engine computes `totalDefenseDice` (remaining successes after cover, armor, backup, shields, dodge/outmaneuver, plus `min(suppressionTokens, dangerSenseX)` extra dice). After Downgrade Defense, before rolling those dice.

**Conversion** (`applyUpgradeDefenseToPool` takes a `{ red, white }` pool and returns a new pool):

- Normalize X with `Math.max(0, Math.floor(X))`. Empty, invalid, negative, or non-integer X is 0 (same as Pierce / Downgrade).
- `converted = min(X, pool.white)`
- Return `{ red: pool.red + converted, white: pool.white - converted }`

A red-only pool (`white === 0`) is unchanged. A white-only pool converts up to X dice to red.

**Compose with Downgrade Defense:**

```
splitDowngradedDefensePool(color, totalDefenseDice, downgradeDefenseX)
  → applyUpgradeDefenseToPool(thatPool, upgradeDefenseX)
```

Example: Red defender, 5 gathered dice, Downgrade 2, Upgrade 1 → `{ red: 4, white: 1 }`.

**Uncanny Luck:** No new selection rules. An upgraded die is red and therefore preferred for rerolls. Existing `prioritizeRedDefenseRerollIndices` / `applyUncannyLuckRerollsToOutcomes` already do this.

## Architecture

Pure helper in `src/engine/simulate.ts` (exported for tests):

`applyUpgradeDefenseToPool(pool: DefensePool, upgradeDefenseX: number): DefensePool`

Do **not** modify `splitDowngradedDefensePool`.

Wounds simulation (`simulateWounds` and `simulateWoundsFromAttackResults`):

1. Compute `totalDefenseDice` as today.
2. `splitPool = splitDowngradedDefensePool(defenseDieColor, totalDefenseDice, downgradeDefenseX)`
3. `upgradedPool = applyUpgradeDefenseToPool(splitPool, upgradeDefenseX)`
4. `rollDefensePoolDetailed(upgradedPool, rng)`
5. Apply Uncanny Luck via existing `applyUncannyLuckRerollsToOutcomes` (already red-first via `prioritizeRedDefenseRerollIndices`).
6. Resolve blocks, Pierce/Impervious, wounds as today.

Cover continues to use the cover die color only. Do not pass upgrade or downgrade into `applyCover`.

`upgradeDefenseX` is a new parameter **immediately after** `downgradeDefenseX` (before `runs`) on both simulate functions and on `calculateWounds`. Existing call sites insert `0, // upgradeDefenseX` in that slot. `calculateAttackPool` is unchanged.

Standalone `calculateDefensePool` / `getDefenseDistributionForDiceCount` are unchanged. Upgrade is an attack-vs-defense gather step, not a raw defense-pool editor.

Do not refactor the long simulate parameter lists into an options object.

## Data model

- `PoolConfig.upgradeDefenseX: string` — `''` means 0.
- `DEFAULT_POOL_CONFIG.upgradeDefenseX: ''`
- Engine params: `upgradeDefenseX?: number`, normalized with `Math.max(0, Math.floor(...))`.

Code identifiers follow `downgradeDefenseX`. The user-facing label is **Upgrade Defense Dice X**.

## UI

- `NumberInputWithControls` in Defense Keywords after Uncanny Luck (same component as Downgrade Defense Dice X; **omit** `guideAnchor`).
- `id="upgrade-defense-dice-x"`
- Label: **Upgrade Defense Dice X**
- `min={0}`
- Tooltip: "Convert up to X white defense dice to red after gathering the defense pool (including Danger Sense extras). No effect when there are no white dice. Does not affect cover. Uncanny Luck rerolls red dice first."
- State: `upgradeDefenseX` as `useState<string>('')`. Reset to `''`. Init from URL like `downgradeDefenseX`.
- Always enabled, including when defense is Red.

## URL state

| State | Key | Default | Omit when |
| --- | --- | --- | --- |
| upgradeDefenseX | `upDef` | `0` | `0` |

Pairs with existing `downDef`. Follow `.cursor/rules/url-state-new-inputs.mdc`: `UrlPoolState`, `DEFAULT_URL_STATE_POOL`, `parseFragment` / `buildFragment`, App init/sync/reset, `poolConfigEditor` setters and `configToUrlPoolState`, comparison `a.` prefix.

## Share and snapshots

When the count is greater than 0, list **Upgrade Defense Dice X N** with the other **defense** keywords in `describeActiveModifiers` and `formatPoolSnapshot` (after Uncanny Luck). Do not list it under Attack keywords.

## Testing

**Helper**

- `{ red: 0, white: 5 }` + 0 → unchanged.
- `{ red: 0, white: 5 }` + 2 → `{ red: 2, white: 3 }`.
- `{ red: 0, white: 2 }` + 4 → `{ red: 2, white: 0 }` (leftover X unused).
- `{ red: 4, white: 0 }` + any X → unchanged.
- Negative / non-integer X → 0.

**Compose**

- `splitDowngradedDefensePool('red', 5, 2)` then `applyUpgradeDefenseToPool(..., 1)` → `{ red: 4, white: 1 }`.

**Simulation**

- Same seed, White defender, Upgrade 2 vs 0 → expected wounds lower or equal.
- Red defender, Upgrade 2 vs 0, Downgrade 0 → identical wounds.
- Cover dice color and count ignore `upgradeDefenseX`; a cover-present scenario yields the same cover cancellations with or without X.

**Uncanny Luck**

- Existing red-first tests stay valid.
- White defender, Upgrade 1, mixed rerollable red and white faces: chosen indices are red first.

**URL / share**

- `upDef=2` parse/build round-trip; omitted at 0.
- Modifier and snapshot tests include **Upgrade Defense Dice X** on the defense list when set.

## Out of scope

- Changing `splitDowngradedDefensePool`
- Cover rolls
- Raw dice roller UI
- Legion Quick Guide link
- Mixed red/white as a user-facing Defense Pool control (defender is still Red or White)
- Refactoring simulate/calculateWounds to an options object
