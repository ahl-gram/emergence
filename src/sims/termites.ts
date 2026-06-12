import { Rng } from "../core/rng.js";
import { makeGrid, wrap, MOORE, type Grid } from "../core/grid.js";
import type { Simulation, Params } from "../core/types.js";
import { paintGrid, rgb } from "../ui/painter.js";

export interface Termite {
  readonly x: number;
  readonly y: number;
  readonly carrying: boolean;
}

export interface TermitesState {
  readonly chips: Grid<Uint8Array>;
  readonly termites: ReadonlyArray<Termite>;
  readonly rngState: number;
  readonly tick: number;
}

const W = 150;
const H = 100;
const C_EMPTY = rgb(12, 14, 19);
const C_CHIP = rgb(150, 200, 120);
const C_TERMITE = rgb(255, 157, 61);
const C_LADEN = rgb(255, 90, 80);

function localDensity(chips: Uint8Array, x: number, y: number): number {
  let n = 0;
  for (const [dx, dy] of MOORE) {
    if (chips[wrap(y + dy, H) * W + wrap(x + dx, W)]) n++;
  }
  return n / 8;
}

export const termites: Simulation<TermitesState> = {
  id: "termites",
  name: "Termite Sorting",
  blurb: "Tidy piles, no one in charge",
  description:
    "Wood chips are scattered at random and blind termites wander over them. A termite " +
    "with empty jaws that stumbles on a chip tends to pick it up if the chip sits alone; " +
    "a laden termite tends to drop its chip where chips already cluster. From those two " +
    "probabilities — and no memory, no map, no leader — the litter collects itself into " +
    "a few tidy piles. Real termites and ants sort their nests exactly this way.",
  whatToTry:
    "Give it time — like real nest-building, sorting is patient. Crank the speed and " +
    "watch the biggest pile climb as small heaps get cannibalized by big ones: the " +
    "same rich-get-richer that built the galaxies and the wealth in the other sims. " +
    "More termites sort faster; too many and they keep stirring the piles back up.",
  params: [
    { key: "termiteCount", label: "Termites", min: 20, max: 600, step: 20, default: 200, reinit: true },
    { key: "chipDensity", label: "Chip litter", min: 0.05, max: 0.4, step: 0.01, default: 0.18, reinit: true },
    { key: "k1", label: "Pickup shyness", min: 0.05, max: 0.6, step: 0.05, default: 0.35 },
    { key: "k2", label: "Drop eagerness", min: 0.05, max: 0.6, step: 0.05, default: 0.3 },
  ],
  series: [
    { key: "piles", label: "Distinct piles", color: "#9ece6a" },
    { key: "biggestPile", label: "Biggest pile", color: "#ff9d3d" },
  ],
  chartMode: "normalized",
  maxStepsPerFrame: 32,

  init(seed: number, p: Params): TermitesState {
    const rng = new Rng(seed);
    const chips = makeGrid(W, H);
    for (let i = 0; i < chips.cells.length; i++) {
      chips.cells[i] = rng.bool(p.chipDensity) ? 1 : 0;
    }
    const termites: Termite[] = Array.from({ length: p.termiteCount }, () => ({
      x: rng.int(W),
      y: rng.int(H),
      carrying: false,
    }));
    return { chips, termites, rngState: rng.state(), tick: 0 };
  },

  step(s: TermitesState, p: Params): TermitesState {
    const rng = Rng.fromState(s.rngState);
    const chips = s.chips.cells.slice();
    const termites = s.termites.map((t) => {
      const i = t.y * W + t.x;
      let carrying = t.carrying;
      const f = localDensity(chips, t.x, t.y);
      if (!carrying && chips[i] === 1) {
        const pPickup = (p.k1 / (p.k1 + f)) ** 2;
        if (rng.bool(pPickup)) {
          chips[i] = 0;
          carrying = true;
        }
      } else if (carrying && chips[i] === 0) {
        const pDrop = (f / (p.k2 + f)) ** 2;
        if (rng.bool(pDrop)) {
          chips[i] = 1;
          carrying = false;
        }
      }
      const [dx, dy] = MOORE[rng.int(8)];
      return { x: wrap(t.x + dx, W), y: wrap(t.y + dy, H), carrying };
    });
    return { chips: { w: W, h: H, cells: chips }, termites, rngState: rng.state(), tick: s.tick + 1 };
  },

  render(s, ctx, view) {
    paintGrid(ctx, view, s.chips, "termites", (v) => (v === 1 ? C_CHIP : C_EMPTY));
    const kx = view.width / W;
    const ky = view.height / H;
    for (const t of s.termites) {
      ctx.fillStyle = t.carrying ? C_LADEN_CSS : C_TERMITE_CSS;
      ctx.fillRect(t.x * kx, t.y * ky, Math.max(2, kx), Math.max(2, ky));
    }
  },

  stats(s) {
    const { piles, biggest } = countPiles(s.chips.cells);
    let chipTotal = 0;
    for (const v of s.chips.cells) chipTotal += v;
    let carried = 0;
    for (const t of s.termites) if (t.carrying) carried++;
    return {
      tick: s.tick,
      piles,
      biggestPile: biggest,
      chips: chipTotal + carried,
    };
  },
};

const C_TERMITE_CSS = "#ff9d3d";
const C_LADEN_CSS = "#ff5a50";

/** Flood-fill connected chip clusters (4-connectivity); ignore singletons as noise. */
function countPiles(cells: Uint8Array): { piles: number; biggest: number } {
  const seen = new Uint8Array(cells.length);
  const stack: number[] = [];
  let piles = 0;
  let biggest = 0;
  for (let start = 0; start < cells.length; start++) {
    if (cells[start] !== 1 || seen[start]) continue;
    let size = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length > 0) {
      const i = stack.pop()!;
      size++;
      const x = i % W;
      const y = (i - x) / W;
      const nb = [
        y * W + wrap(x - 1, W),
        y * W + wrap(x + 1, W),
        wrap(y - 1, H) * W + x,
        wrap(y + 1, H) * W + x,
      ];
      for (const j of nb) {
        if (cells[j] === 1 && !seen[j]) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    if (size >= 3) piles++; // count real heaps, not stray chips
    if (size > biggest) biggest = size;
  }
  return { piles, biggest };
}

export { countPiles };
export const TERMITES_WORLD = { w: W, h: H };
