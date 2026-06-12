import { Rng } from "../core/rng.js";
import type { Simulation, Params } from "../core/types.js";
import { paintGrid, lerpRgb, rgb } from "../ui/painter.js";

export interface TrafficState {
  /** Car positions in ring order (not necessarily ascending after wrap). */
  readonly pos: Int32Array;
  readonly vel: Int32Array;
  readonly rngState: number;
  readonly tick: number;
  /** Recent rows for the space-time diagram; 255 = empty cell, else speed. */
  readonly history: ReadonlyArray<Uint8Array>;
}

export const ROAD_LENGTH = 480;
const HISTORY_ROWS = 320;
const EMPTY_CELL = 255;
const C_BG = rgb(10, 12, 16);
const JAM: [number, number, number] = [255, 90, 80];
const FLOW: [number, number, number] = [122, 215, 255];

function snapshot(pos: Int32Array, vel: Int32Array): Uint8Array {
  const row = new Uint8Array(ROAD_LENGTH).fill(EMPTY_CELL);
  for (let i = 0; i < pos.length; i++) row[pos[i]] = vel[i];
  return row;
}

export const traffic: Simulation<TrafficState> = {
  id: "traffic",
  name: "Traffic Jams",
  blurb: "Phantom jams from nothing",
  description:
    "Cars on a ring road follow three rules: speed up if you can, slow down to avoid " +
    "the car ahead, and occasionally dawdle at random. The picture scrolls time downward " +
    "— each row is one moment. Jams appear out of nowhere and roll backward " +
    "against traffic, even though every driver is just reacting to the car in front.",
  whatToTry:
    "Set dawdling to 0: perfect free flow at max speed. Nudge it to 0.1 at density " +
    "0.3 and watch phantom jam waves ripple backward. The jam is real; no one caused it.",
  params: [
    { key: "density", label: "Car density", min: 0.05, max: 0.6, step: 0.01, default: 0.22, reinit: true },
    { key: "vmax", label: "Speed limit", min: 1, max: 8, step: 1, default: 5 },
    { key: "pSlow", label: "Dawdling p", min: 0, max: 1, step: 0.02, default: 0.3 },
  ],
  series: [
    { key: "speedNorm", label: "Avg speed / limit", color: "#7ad7ff" },
    { key: "flow", label: "Flow", color: "#9ece6a" },
  ],
  maxStepsPerFrame: 8,

  init(seed: number, p: Params): TrafficState {
    const rng = new Rng(seed);
    const n = Math.max(1, Math.round(p.density * ROAD_LENGTH));
    const slots = rng.shuffled(Array.from({ length: ROAD_LENGTH }, (_, i) => i));
    const pos = new Int32Array(slots.slice(0, n).sort((a, b) => a - b));
    const vel = new Int32Array(n);
    return {
      pos,
      vel,
      rngState: rng.state(),
      tick: 0,
      history: [snapshot(pos, vel)],
    };
  },

  step(s: TrafficState, p: Params): TrafficState {
    const rng = Rng.fromState(s.rngState);
    const n = s.pos.length;
    const pos = new Int32Array(n);
    const vel = new Int32Array(n);

    for (let i = 0; i < n; i++) {
      const ahead = s.pos[(i + 1) % n];
      const gap = n === 1 ? ROAD_LENGTH : (ahead - s.pos[i] + ROAD_LENGTH) % ROAD_LENGTH;
      let v = Math.min(s.vel[i] + 1, p.vmax, gap - 1);
      if (v > 0 && rng.bool(p.pSlow)) v--;
      vel[i] = v;
      pos[i] = (s.pos[i] + v) % ROAD_LENGTH;
    }

    const history = [...s.history, snapshot(pos, vel)];
    if (history.length > HISTORY_ROWS) history.shift();

    return { pos, vel, rngState: rng.state(), tick: s.tick + 1, history };
  },

  render(s, ctx, view) {
    const cells = new Uint8Array(ROAD_LENGTH * HISTORY_ROWS).fill(EMPTY_CELL);
    const offset = HISTORY_ROWS - s.history.length;
    s.history.forEach((row, r) => cells.set(row, (offset + r) * ROAD_LENGTH));
    const grid = { w: ROAD_LENGTH, h: HISTORY_ROWS, cells };
    const vmax = Math.max(1, currentVmax(s));
    paintGrid(ctx, view, grid, "traffic", (v) =>
      v === EMPTY_CELL ? C_BG : lerpRgb(JAM, FLOW, v / vmax),
    );
  },

  stats(s, p) {
    const n = s.pos.length;
    let sum = 0;
    let stopped = 0;
    for (let i = 0; i < n; i++) {
      sum += s.vel[i];
      if (s.vel[i] === 0) stopped++;
    }
    return {
      tick: s.tick,
      cars: n,
      speedNorm: n > 0 ? sum / n / Math.max(1, p.vmax) : 0,
      flow: sum / ROAD_LENGTH,
      stopped,
    };
  },
};

function currentVmax(s: TrafficState): number {
  let m = 1;
  for (let i = 0; i < s.vel.length; i++) if (s.vel[i] > m) m = s.vel[i];
  return m;
}
