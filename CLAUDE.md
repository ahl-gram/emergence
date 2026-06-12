# Emergence

Agent-based modeling playground: classic emergence simulations in TypeScript with a vanilla canvas UI. Zero runtime dependencies.

## Commands

- `npm run build` — tsc to `dist/`
- `npm test` — build + node:test over `dist/test/**/*.test.js` (don't pass a bare directory to `node --test`; Node 26 rejects it)
- `npm start` — build + static server at http://localhost:4173
- `npm run watch` — tsc incremental

## Architecture

- `src/core/` — engine: `Rng` (mulberry32, state stored as a plain number), `Grid` over typed arrays, `Simulation<S>` interface, sim registry
- `src/sims/` — one file per simulation, each exports a `Simulation<S>` object
- `src/ui/` — browser-only code: app loop, param controls, strip chart, `paintGrid` ImageData renderer
- `src/test/` — node:test suites; they import sims but never touch DOM APIs

## Conventions

- **Determinism is the spine of the test suite.** `init(seed, params)` and `step(state, params)` are pure; all randomness flows through `Rng`, whose internal state is carried inside sim state (`rngState: number`) via `Rng.fromState(...)` / `rng.state()`. Same seed ⇒ identical run, so behavioral tests (e.g. "polarization rises above 0.7") are exact, not flaky.
- **No mutation of inputs.** Steps build fresh typed arrays / object arrays and return new state. Mutating a locally-constructed buffer during a step is fine; mutating the incoming state is never fine — tests assert this per sim.
- **Sims never touch the DOM** outside their `render`/`onPointer` functions, so Node can import them for tests. `paintGrid` caches offscreen canvases internally.
- Imports use explicit `.js` extensions (NodeNext resolution; same emitted code runs in browser and Node).
- New sim checklist: implement `Simulation<S>` in `src/sims/<name>.ts`, register in `src/core/registry.ts`, add `src/test/<name>.test.ts` with at least determinism + no-mutation + one behavioral invariant.

## Gotchas

- Headless screenshot verification: `"/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" --headless --disable-gpu --user-data-dir=/tmp/bh --screenshot=/tmp/shot.png --window-size=1320,900 --virtual-time-budget=8000 "http://localhost:4173/#<simId>?seed=N"` — virtual time budget fast-forwards rAF so the sim actually runs before capture.
- TS drops index signatures when spreading `Params` into an object literal; access overridden keys from the literal or annotate with `: Params`.
- Param changes marked `reinit: true` re-run `init`; others apply live on the next step.
