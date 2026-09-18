# Optimal Attack Rerolls (Surge, Tokens, Critical, Ram)

**Date:** 2026-09-17

## Goal

Aim and Observe should reroll only dice that will still be misses after surge conversion, surge tokens, and Critical. Defense Uncanny Luck already follows this idea; this spec brings attack rerolls (and Ram’s use of leftover surges) in line with it. Ram runs **after** rerolls, so Aim/Observe do **not** reserve misses for Ram — a failed reroll can still be converted.

Motivating case: 2 red dice, Surge Conversion = None, many Aim/Observe tokens. Today the app reports avg total **1.72** and **73.68%** chance of 2 successes, because it only rerolls blanks and leftover surges stay dead. After this change that pool should approach **2.00** and **~100%**.

## Product decisions

| Topic                       | Decision                                                                                                                                                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hits and crits              | Never rerolled                                                                                                                                                                                                                                               |
| Surge → Hit or Surge → Crit | Surges are already successes; reroll blanks only                                                                                                                                                                                                             |
| Surge None                  | Keep `min(surges, Critical X + surge tokens)` surges; leftover surges are misses                                                                                                                                                                             |
| Ram X                       | After rerolls and surge conversion, convert leftover **blanks**, then leftover **surges**, then leftover Ram upgrades **hits**. Do not spend Ram on a surge that Critical / surge conversion / surge tokens will convert. Crits are always better than hits. |
| Aim / Observe               | Each round, reroll up to capacity among unconverted misses (blanks and leftover surges). Do **not** reserve misses for Ram. Re-evaluate at the start of every round                                                                                          |
| Color priority              | Among dice we do reroll, red then black then white. Among surges we keep for conversion, keep worse colors first so better colors remain available to reroll                                                                                                 |
| Defense                     | Uncanny Luck already rerolls blanks, plus leftover surges when surge is off. No defense math change                                                                                                                                                          |
| URL / new controls          | None                                                                                                                                                                                                                                                         |
| Out of scope                | Rerolling hits to fish for crits vs Armor/Cover; changing Aim/Observe/Precise capacities; raw dice roller                                                                                                                                                    |

## Rules

Game order: roll → reroll (Aim/Observe) → convert surges (Critical, surge chart, surge tokens) → modify dice (Ram).

The calculator looks ahead at surge conversion, surge tokens, and Critical when choosing rerolls, then still applies those converters and Ram after rerolls. It does not hold dice back for Ram, because Ram still converts whatever miss remains after a failed reroll.

### Surge conversion capacity

- Surge → Hit or Surge → Crit: **all** surges convert. Leftover surges = 0.
- Surge None: leftover surges = `max(0, surgeCount − Critical X − surge tokens)`.

### Ram (after conversion)

`applyRam` spends X in this order:

1. Remaining **blanks** → crits
2. Remaining **leftover surges** → crits
3. Remaining **hits** → crits

Never convert a surge that still has Critical / surge conversion / surge token capacity. Those are already hits or crits before Ram.

### Reroll selection (each Aim/Observe round)

A die is a **kept success** if it is a hit, a crit, or a surge that surge conversion will spend.

Everything else that is still a miss (blanks and leftover surges) is **rerollable**. Aim/Observe do **not** reserve misses for Ram: Ram runs after rerolls, so a failed reroll is still converted. Cap at that round’s capacity (Aim: 2 + Precise; Observe: 1). Same die at most once per round; a later round may reroll it again if it is still a miss.

Example: Surge None, Critical 1, Ram 1, faces = 2 surges + 1 blank, 1 Observe. Keep 1 surge for Critical. Reroll the leftover surge or the blank. After rerolls, Ram still converts a remaining miss (or upgrades a hit if no miss remains).

## Architecture

Stay in `src/engine/simulate.ts`. Mirror `getRerollableDefenseIndices`:

- `leftoverSurgesAfterConversion(surgeCount, criticalX, surge, surgeTokens): number`
- `getRerollableAttackIndices(outcomes, context): number[]`
- `AttackRerollContext`: `{ surge, criticalX, surgeTokens }`

Thread that context into `applyRerollsByRounds` and both simulation loops (`simulateAttackPool`, `simulateWounds`). `applyRam` gains an optional leftover-surge count (default 0 so existing blank/hit cases stay valid). Call sites pass leftover surges from the helper after `resolveStep`.

No `computePoolResults` / URL / type-shape changes.

## UI

Update tooltips only:

- **Aim:** each token rerolls up to 2 dice that would not become hits or crits (after surge conversion, tokens, and Critical).
- **Observe:** each token rerolls 1 such die.
- **Ram:** after rerolls, convert up to X leftover blanks or surges to crits, then leftover Ram converts hits. Does not spend on surges that Critical, surge conversion, or surge tokens will convert. Aim/Observe do not hold dice for Ram.

## Tests

**Unit (`simulate.test.ts`):**

- Leftover surge counts for surge hit/crit vs none, with Critical and tokens.
- `getRerollableAttackIndices` table: surge hit → blanks only; surge none → blanks + leftover surges; Ram does not reserve misses; hits/crits never listed.
- `applyRam` leftover surge → crit; does not consume a surge that was already converted (leftoverSurges = 0).
- Color: red miss rerolled before white miss; white surge preferred for conversion-keep.

**Simulation (`probability.test.ts`):**

- 2 red, surge none, many Aim/Observe: `expectedTotal` close to 2, P(total = 2) close to 1 (today 1.72 / 73.68%).
- Same pool with Surge → Hit stays at 2.00 / 100% (no regression).
- 1 white, surge none, Ram 1, no rerolls: leftover surge is a crit; `expectedTotal` close to 1 (today surge is wasted, 7/8).
- Surge → Hit + Ram: Ram still does not consume converted surges; still converts blanks then leftover hits.
- 2 white, surge hit, Ram 1, 1 Aim: rerolls blanks Ram would have converted; `expectedTotal` greater than 1.8 (reservation scored ~1.76).

**Defense:** existing Uncanny Luck rerollable-index tests remain the spec; do not change them.

**UI:** Aim/Observe/Ram tooltip copy if covered by tests; otherwise App tooltip strings only.

## Edge cases

- Zero Aim/Observe: identical to today except Ram now converts leftover surges.
- Ram 0: reroll all leftover misses (blanks + unconverted surges).
- Ram covering every miss: still reroll those misses; Ram converts whatever remains after rerolls (blanks, leftover surges, then hits).
- Critical X + tokens + Ram: spend conversion on surges first; Ram converts remaining misses after rerolls.
- Invalid / negative X values: still treated as 0.
- Mixed pool: red reroll priority unchanged among rerollable dice.
