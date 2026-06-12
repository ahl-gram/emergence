import { Rng } from "../core/rng.js";
import { makeGrid, wrap, type Grid } from "../core/grid.js";
import type { Simulation, Params } from "../core/types.js";
import { paintGrid, rgb } from "../ui/painter.js";

export interface LangtonAnt {
  readonly x: number;
  readonly y: number;
  /** 0 = north, 1 = east, 2 = south, 3 = west. */
  readonly dir: number;
}

export interface LangtonState {
  readonly grid: Grid<Uint8Array>;
  readonly ants: ReadonlyArray<LangtonAnt>;
  readonly rngState: number;
  readonly tick: number;
}

const W = 240;
const H = 160;
const C_WHITE = rgb(11, 14, 20);
const C_BLACK = rgb(255, 184, 107);
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

export const langton: Simulation<LangtonState> = {
  id: "langton",
  name: "Langton's Ant",
  blurb: "Order after ten thousand steps of chaos",
  description:
    "One ant, two rules: on a dark cell turn right, on a lit cell turn left; flip the " +
    "cell and walk on. It scribbles chaotically for ~10,000 steps — then abruptly starts " +
    "building a diagonal 'highway', forever. The rule never changed. Nobody knows a proof " +
    "for why the highway must appear; it just always does.",
  whatToTry:
    "Crank the speed slider to max and wait for the highway. Then reset with several " +
    "ants — their flipped cells tangle each other's plans into new behavior.",
  params: [
    { key: "antCount", label: "Ants", min: 1, max: 32, step: 1, default: 1, reinit: true },
  ],
  maxStepsPerFrame: 1024,

  init(seed: number, p: Params): LangtonState {
    const rng = new Rng(seed);
    const grid = makeGrid(W, H);
    const list: LangtonAnt[] =
      p.antCount === 1
        ? [{ x: W >> 1, y: H >> 1, dir: 0 }]
        : Array.from({ length: p.antCount }, () => ({
            x: rng.int(W),
            y: rng.int(H),
            dir: rng.int(4),
          }));
    return { grid, ants: list, rngState: rng.state(), tick: 0 };
  },

  step(s: LangtonState, _p: Params): LangtonState {
    const cells = s.grid.cells.slice();
    const ants = s.ants.map((ant) => {
      const i = ant.y * W + ant.x;
      const dir = cells[i] === 0 ? (ant.dir + 1) % 4 : (ant.dir + 3) % 4;
      cells[i] = cells[i] === 0 ? 1 : 0;
      return {
        x: wrap(ant.x + DX[dir], W),
        y: wrap(ant.y + DY[dir], H),
        dir,
      };
    });
    return { grid: { w: W, h: H, cells }, ants, rngState: s.rngState, tick: s.tick + 1 };
  },

  render(s, ctx, view) {
    paintGrid(ctx, view, s.grid, "langton", (v) => (v === 0 ? C_WHITE : C_BLACK));
    const kx = view.width / W;
    const ky = view.height / H;
    ctx.fillStyle = "#ff5a50";
    for (const ant of s.ants) {
      ctx.fillRect(ant.x * kx, ant.y * ky, Math.max(2, kx), Math.max(2, ky));
    }
  },

  stats(s) {
    let black = 0;
    for (const v of s.grid.cells) black += v;
    return { step: s.tick, flippedCells: black };
  },
};

export const LANGTON_WORLD = { w: W, h: H };
