import { Rng } from "../core/rng.js";
import type { Simulation, Params } from "../core/types.js";
import { paintGrid, rgb } from "../ui/painter.js";

export interface Walker {
  readonly x: number;
  readonly y: number;
  /** +1 walks right, -1 walks left. */
  readonly dir: number;
}

export interface PedestriansState {
  readonly walkers: ReadonlyArray<Walker>;
  readonly rngState: number;
  readonly tick: number;
  readonly movedLastStep: number;
}

const W = 160;
const H = 48;
const C_BG = rgb(12, 14, 19);
const C_RIGHT = rgb(122, 215, 255);
const C_LEFT = rgb(255, 157, 61);

export const pedestrians: Simulation<PedestriansState> = {
  id: "pedestrians",
  name: "Pedestrian Lanes",
  blurb: "Sidewalk choreography, no choreographer",
  description:
    "Two crowds walk an endless corridor in opposite directions. Each person just " +
    "steps forward if they can, or sidesteps around whoever is in the way. Out of " +
    "pure collision-avoidance, the crowds sort themselves into one-way lanes — the " +
    "same unspoken choreography you join every day on a busy sidewalk.",
  whatToTry:
    "Raise density toward 0.4 and lanes give way to gridlock — the corridor's " +
    "capacity is an emergent number nobody set. The lane order parameter on the " +
    "chart is the city planner's view of a phenomenon no walker can see.",
  params: [
    { key: "density", label: "Crowding", min: 0.05, max: 0.5, step: 0.01, default: 0.22, reinit: true },
  ],
  series: [
    { key: "laneOrder", label: "Lane order", color: "#7ad7ff" },
    { key: "flow", label: "Walking speed", color: "#9ece6a" },
  ],
  maxStepsPerFrame: 8,

  init(seed: number, p: Params): PedestriansState {
    const rng = new Rng(seed);
    const cells = rng.shuffled(Array.from({ length: W * H }, (_, i) => i));
    const count = Math.floor(W * H * p.density);
    const walkers: Walker[] = cells.slice(0, count).map((cell, i) => ({
      x: cell % W,
      y: Math.floor(cell / W),
      dir: i % 2 === 0 ? 1 : -1,
    }));
    return { walkers, rngState: rng.state(), tick: 0, movedLastStep: 0 };
  },

  step(s: PedestriansState, _p: Params): PedestriansState {
    const rng = Rng.fromState(s.rngState);
    const occupied = new Uint8Array(W * H);
    const oncoming = new Int8Array(W * H); // walker direction per cell, 0 if empty
    for (const w of s.walkers) {
      occupied[w.y * W + w.x] = 1;
      oncoming[w.y * W + w.x] = w.dir;
    }

    // How clear does row `y` look to a walker heading `dir` from column `x`?
    const oncomersAhead = (x: number, y: number, dir: number): number => {
      let count = 0;
      for (let k = 1; k <= 4; k++) {
        const cx = (x + dir * k + W) % W;
        if (oncoming[y * W + cx] === -dir) count++;
      }
      return count;
    };

    const next: Walker[] = new Array(s.walkers.length);
    const order = rng.shuffled(s.walkers.map((_, i) => i));
    let moved = 0;

    for (const i of order) {
      const w = s.walkers[i];
      const fx = (w.x + w.dir + W) % W;
      let candidates: Array<[number, number]>;

      if (!occupied[w.y * W + fx]) {
        candidates = [[fx, w.y]];
      } else {
        // blocked: dodge toward whichever neighboring row looks clearer ahead
        const rows = [w.y - 1, w.y + 1].filter((y) => y >= 0 && y < H);
        const scored = rows.map((y) => ({ y, score: oncomersAhead(w.x, y, w.dir) }));
        scored.sort((a, b) => a.score - b.score || (rng.bool(0.5) ? -1 : 1));
        candidates = [];
        for (const { y } of scored) candidates.push([fx, y]);
        for (const { y } of scored) candidates.push([w.x, y]);
      }

      let placed = false;
      for (const [cx, cy] of candidates) {
        const cell = cy * W + cx;
        if (occupied[cell]) continue;
        occupied[w.y * W + w.x] = 0;
        occupied[cell] = 1;
        next[i] = { x: cx, y: cy, dir: w.dir };
        if (cx !== w.x) moved++;
        placed = true;
        break;
      }
      if (!placed) next[i] = w;
    }

    return {
      walkers: next,
      rngState: rng.state(),
      tick: s.tick + 1,
      movedLastStep: moved,
    };
  },

  render(s, ctx, view) {
    const cells = new Uint8Array(W * H);
    for (const w of s.walkers) cells[w.y * W + w.x] = w.dir === 1 ? 1 : 2;
    paintGrid(ctx, view, { w: W, h: H, cells }, "pedestrians", (v) =>
      v === 1 ? C_RIGHT : v === 2 ? C_LEFT : C_BG,
    );
  },

  stats(s) {
    let orderSum = 0;
    let rowsCounted = 0;
    for (let y = 0; y < H; y++) {
      let right = 0;
      let left = 0;
      for (const w of s.walkers) {
        if (w.y !== y) continue;
        if (w.dir === 1) right++;
        else left++;
      }
      const total = right + left;
      if (total >= 3) {
        orderSum += Math.abs(right - left) / total;
        rowsCounted++;
      }
    }
    return {
      step: s.tick,
      laneOrder: rowsCounted > 0 ? orderSum / rowsCounted : 0,
      flow: s.walkers.length > 0 ? s.movedLastStep / s.walkers.length : 0,
    };
  },
};

export const PED_WORLD = { w: W, h: H };
