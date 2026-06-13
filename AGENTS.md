# AGENTS.md

Legion Dice Calculator — a client-side-only React 19 + TypeScript + Vite app for computing Star Wars: Legion attack/defense dice probabilities. There is no backend, database, or Docker dependency; all computation (exact math and Monte Carlo simulation) runs in the browser.

## Commands

| Task               | Command                                  | Notes                                                |
| ------------------ | ---------------------------------------- | ---------------------------------------------------- |
| Dev server         | `npm run dev`                            | Vite HMR on port 5173                                |
| Tests (one-shot)   | `npm test`                               | `vitest run`; currently 420 tests across 33 files    |
| Tests (watch)      | `npm run test:watch`                     | For local iteration only                             |
| Single test file   | `npm test -- src/path/to/file.test.ts`   | Preferred while iterating on a focused change        |
| Lint               | `npm run lint`                           | ESLint 9 flat config with typescript-eslint          |
| Format             | `npm run format` / `npm run format:check`| Prettier; only format files you touched (see below)  |
| Build              | `npm run build`                          | `tsc -b && vite build`, outputs to `dist/`           |

Node.js 20+ required locally; CI uses Node 24.

## Project layout

```
src/
├── engine/              # Pure-TS probability math + Monte Carlo simulation
│   ├── probability.ts   # Exact distributions, attack/defense pool resolution
│   ├── simulate.ts      # Monte Carlo (10,000 runs by default), rng.ts
│   └── __tests__/       # Engine tests; run in node environment (no DOM)
├── components/          # React components: one .tsx + co-located .css + .test.tsx
├── share/               # Share text/image export helpers (pure, tested)
├── App.tsx              # State orchestration (large); logic lives elsewhere
├── types.ts             # Shared domain types (AttackPool, DefensePool, ...)
├── poolResults.ts       # computePoolResults — the seam between App and engine
├── urlState.ts          # Hash-fragment encode/decode for shareable URLs
├── comparePoolState.ts, buildAppUrlState.ts, comparisonDeltas.ts,
│   poolConfigEditor.ts, poolSnapshot.ts, chartLegendOrder.ts, ...
│                        # Pure logic modules at src/ root, each with a
│                        # co-located .test.ts
└── test-setup.ts        # jsdom shims for Recharts (see gotchas)
```

Design docs live in `docs/plans/` (older keyword features) and `docs/superpowers/specs|plans/` (newer features). Larger features start with a dated design spec and an implementation plan with checkbox tasks before any code.

## How to write tests

Tests are co-located with the code they cover:

- Engine math → `src/engine/__tests__/*.test.ts`
- Pure logic modules → `src/<module>.test.ts` next to the module
- Components → `src/components/<Component>.test.tsx` next to the component

Conventions:

- The default test environment is **jsdom** (configured in `vitest.config.ts`, with `globals: true` and `setupFiles: './src/test-setup.ts'`). Engine tests are pure TS and opt out with a docblock at the top of the file:

  ```ts
  /**
   * @vitest-environment node
   * Engine tests are pure TS; no DOM needed.
   */
  ```

- Component tests use `@testing-library/react` (`render`, `screen`), `@testing-library/user-event` for interactions, and `@testing-library/jest-dom` matchers. Prefer accessible queries: `screen.getByRole('button', { name: /show exact values/i })` over test IDs.
- Feed component tests **real engine output** rather than hand-built mocks: build a config from `DEFAULT_POOL_CONFIG` and call `computePoolResults(config)` to get realistic results.
- Use `toBeCloseTo` for probability assertions in engine tests.
- When the same text appears for both attack and defense (e.g. "Red"), use `getAllByText` with a length assertion instead of `getByText`.
- For Recharts output, query rendered SVG via `screen.getByRole('img', { hidden: true })` or class selectors like `.recharts-legend-item-text`.

### Workflow for a change

1. Write the failing test first, run it scoped (`npm test -- src/path/to/file.test.ts`) to confirm it fails.
2. Implement, re-run scoped until green.
3. Before declaring done, run the full gate: `npm test && npm run lint && npm run build`.

When adding a feature, extract the logic into a pure `.ts` module (at `src/` root, in `src/share/`, or in `src/engine/`) and test it there; keep `App.tsx` and components as thin wiring. This is the single most consistent pattern in this repo's history.

## Conventions

- **No abbreviated names.** Use full descriptive names for variables and parameters (`crits`, `resultsA`, `valueB` — never `c`, `a`, `b`). Loop counters `i`/`j` are fine. Enforced by `.cursor/rules/no-abbreviations.mdc` and called out in code review.
- **Pool A before Pool B**, always — chart series, legends, tables. Recharts sorts legend items by value/label by default, which can put B first; use the sorter in `src/chartLegendOrder.ts`. Compare colors: A is blue `#2563eb`, B is amber `#f59e0b`.
- **Formatting:** Prettier is the formatter, but only format files you touched. Do not run repo-wide formatting inside a feature branch — it pollutes the PR diff.
- **Commits:** conventional-commit style (`feat:`, `fix:`, `docs:`, `style:`, `refactor:`). Commit per task during planned feature work. Do not push or open a PR unless the user asks.
- **New game keywords** should link to the Legion Quick Guide via `legionQuickGuideHref` / `guideAnchor` (see `src/legionQuickGuide.ts`).
- **Engine stability:** UI features generally should not modify `src/engine/`; go through the `computePoolResults` / `probability.ts` API.

## CI and deploy

`.github/workflows/deploy.yml` runs on pushes and PRs to `main`: Lint & Test → Build → deploy `dist/` to GitHub Pages (deploy only on `main`). Node 24, `npm ci`. A green local `npm test && npm run lint && npm run build` matches what CI checks.

## Gotchas

- **Recharts + jsdom:** jsdom has no layout engine, so `ResponsiveContainer` measures 0×0 and renders nothing. `src/test-setup.ts` installs a ResizeObserver mock and non-zero `offsetWidth`/`offsetHeight` to make charts render in tests. Don't bypass the setup file.
- **Chart percentages:** multiplying probabilities by 100 produces long floats in tooltips/labels; round with `toFixed(2)`-style helpers.
- **Fast Refresh lint:** exporting a helper from a component file trips `react-refresh/only-export-components`; move the helper to its own module instead.
- **Unused vars:** ESLint allows unused vars only when they match `/^_/u`.
- **Build warning:** the production build emits a >500 kB chunk warning; expected and non-blocking.
- **Stray worktrees / WIP:** Vitest discovers tests in `.worktrees/` if left around, and unrelated uncommitted edits can break the `npm run build` verification — verify on a clean tree.
