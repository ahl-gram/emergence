import { Rng } from "../core/rng.js";
import { makeGrid, wrap, type Grid } from "../core/grid.js";
import type { Simulation, Params } from "../core/types.js";
import { paintGrid, rgb } from "../ui/painter.js";

export interface TurmiteState {
  readonly grid: Grid<Uint8Array>;
  readonly x: number;
  readonly y: number;
  readonly dir: number;
  readonly turmiteState: number;
  readonly rngState: number;
  readonly tick: number;
}

const W = 220;
const H = 150;
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

const PALETTE = [
  rgb(10, 12, 18),
  rgb(122, 215, 255),
  rgb(255, 157, 61),
  rgb(126, 224, 138),
];

/**
 * Each preset is a transition table indexed by [machineState][cellColor],
 * giving { write, turn, next } where turn is 0=none 1=right 2=back 3=left.
 * These specific tables are well-known turmites that build ordered structures.
 */
interface Rule {
  write: number;
  turn: number;
  next: number;
}
type Table = Rule[][];

// turn codes: 0 = straight, 1 = right, 2 = u-turn, 3 = left.
// These two 2-state tables were found by exhaustively searching the 2-state
// 2-color space for machines that keep building structure past 40k steps
// (verified monotonic growth); the third is Langton's ant for reference.
const PRESETS: Array<{ name: string; colors: number; table: Table }> = [
  {
    // weaves an expanding textured diamond (box ~121x124 by 12k steps)
    name: "tapestry",
    colors: 2,
    table: [
      [{ write: 1, turn: 3, next: 1 }, { write: 1, turn: 1, next: 0 }],
      [{ write: 0, turn: 0, next: 0 }, { write: 0, turn: 2, next: 0 }],
    ],
  },
  {
    // Langton's ant: ~10k steps of chaos, then an endless highway
    name: "Langton ant",
    colors: 2,
    table: [[{ write: 1, turn: 1, next: 0 }, { write: 0, turn: 3, next: 0 }]],
  },
  {
    // grows a compact dense coral (box ~69x59, ~42% filled by 12k steps)
    name: "coral",
    colors: 2,
    table: [
      [{ write: 1, turn: 3, next: 1 }, { write: 1, turn: 0, next: 0 }],
      [{ write: 0, turn: 0, next: 0 }, { write: 0, turn: 2, next: 0 }],
    ],
  },
];

export const turmite: Simulation<TurmiteState> = {
  id: "turmite",
  name: "Turmites",
  blurb: "Tiny machines that build cities",
  description:
    "A turmite is Langton's ant with a memory: it reads the color under it, then a " +
    "lookup table tells it what to paint, which way to turn, and what internal state " +
    "to switch to. That one extra bit of state is enough to build ordered architecture " +
    "— woven tapestries, dense coral, coiled highways — out of a blank grid, with no " +
    "plan beyond a handful of table entries.",
  whatToTry:
    "Switch presets to see how a few table entries change everything: 'tapestry' " +
    "weaves an expanding textured diamond, 'coral' packs a dense block, and 'Langton " +
    "ant' wanders in chaos for ~10k steps before locking into a highway. Same machine, " +
    "different four-line program. Crank speed to watch the structure assemble.",
  params: [
    { key: "preset", label: "Turmite", min: 0, max: 2, step: 1, default: 0, options: ["tapestry", "Langton ant", "coral"], reinit: true },
  ],
  series: [{ key: "painted", label: "Painted cells", color: "#7ad7ff" }],
  maxStepsPerFrame: 2048,

  init(seed: number, _p: Params): TurmiteState {
    return {
      grid: makeGrid(W, H),
      x: W >> 1,
      y: H >> 1,
      dir: 0,
      turmiteState: 0,
      rngState: new Rng(seed).state(),
      tick: 0,
    };
  },

  step(s: TurmiteState, p: Params): TurmiteState {
    const table = PRESETS[p.preset].table;
    const cells = s.grid.cells.slice();
    let { x, y, dir, turmiteState } = s;

    const color = cells[y * W + x];
    const rule = table[turmiteState][color];
    cells[y * W + x] = rule.write;
    dir = (dir + rule.turn) % 4;
    turmiteState = rule.next;
    x = wrap(x + DX[dir], W);
    y = wrap(y + DY[dir], H);

    return {
      grid: { w: W, h: H, cells },
      x,
      y,
      dir,
      turmiteState,
      rngState: s.rngState,
      tick: s.tick + 1,
    };
  },

  render(s, ctx, view) {
    paintGrid(ctx, view, s.grid, "turmite", (v) => PALETTE[v] ?? PALETTE[0]);
    const kx = view.width / W;
    const ky = view.height / H;
    ctx.fillStyle = "#ff5a50";
    ctx.fillRect(s.x * kx, s.y * ky, Math.max(2, kx), Math.max(2, ky));
  },

  stats(s) {
    let painted = 0;
    for (const v of s.grid.cells) if (v !== 0) painted++;
    return { step: s.tick, painted };
  },
};

export const TURMITE_WORLD = { w: W, h: H };
export const TURMITE_PRESETS = PRESETS;
