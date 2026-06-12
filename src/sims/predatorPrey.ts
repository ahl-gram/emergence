import { Rng } from "../core/rng.js";
import { makeGridOf, wrap, type Grid } from "../core/grid.js";
import type { Simulation, Params } from "../core/types.js";
import { paintGrid, rgb } from "../ui/painter.js";

export interface Agent {
  readonly x: number;
  readonly y: number;
  readonly energy: number;
}

export interface PpState {
  /** 0 = grown grass; >0 = steps until regrown. */
  readonly grass: Grid<Int16Array>;
  readonly sheep: ReadonlyArray<Agent>;
  readonly wolves: ReadonlyArray<Agent>;
  readonly rngState: number;
  readonly tick: number;
}

const W = 120;
const H = 80;
const C_GROWN = rgb(38, 102, 58);
const C_BARE = rgb(54, 44, 31);

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

export const predatorPrey: Simulation<PpState> = {
  id: "predator-prey",
  name: "Wolves & Sheep",
  blurb: "Boom-bust population cycles",
  description:
    "Sheep wander, eat grass, and reproduce; wolves hunt sheep; eaten grass takes time " +
    "to regrow. No equation says 'oscillate' — yet populations boom and bust in offset " +
    "waves: sheep surge, wolves feast and multiply, sheep crash, wolves starve, grass " +
    "recovers, repeat. The Lotka–Volterra cycle, discovered by the agents themselves.",
  whatToTry:
    "Watch the chart through two full cycles. Then raise wolf reproduction and see the " +
    "whole system destabilize — predators that breed too fast eat themselves extinct.",
  params: [
    { key: "sheep0", label: "Sheep", min: 50, max: 1000, step: 10, default: 400, reinit: true },
    { key: "wolves0", label: "Wolves", min: 0, max: 300, step: 5, default: 60, reinit: true },
    { key: "regrow", label: "Grass regrow", min: 5, max: 100, step: 1, default: 30 },
    { key: "sheepGain", label: "Sheep gain", min: 1, max: 10, step: 1, default: 4 },
    { key: "wolfGain", label: "Wolf gain", min: 5, max: 50, step: 1, default: 24 },
    { key: "sheepRepro", label: "Sheep repro", min: 0, max: 0.2, step: 0.01, default: 0.04 },
    { key: "wolfRepro", label: "Wolf repro", min: 0, max: 0.2, step: 0.01, default: 0.05 },
  ],
  series: [
    { key: "sheep", label: "Sheep", color: "#e8eef7" },
    { key: "wolves", label: "Wolves", color: "#ff5a50" },
    { key: "grassPct", label: "Grass %", color: "#9ece6a" },
  ],
  chartMode: "normalized",
  maxStepsPerFrame: 8,

  init(seed: number, p: Params): PpState {
    const rng = new Rng(seed);
    const grass = makeGridOf(W, H, Int16Array);
    for (let i = 0; i < grass.cells.length; i++) {
      grass.cells[i] = rng.bool(0.5) ? 0 : rng.int(p.regrow) + 1;
    }
    const spawn = (energy: number): Agent => ({
      x: rng.int(W),
      y: rng.int(H),
      energy: rng.int(energy) + 1,
    });
    return {
      grass,
      sheep: Array.from({ length: p.sheep0 }, () => spawn(2 * p.sheepGain)),
      wolves: Array.from({ length: p.wolves0 }, () => spawn(2 * p.wolfGain)),
      rngState: rng.state(),
      tick: 0,
    };
  },

  step(s: PpState, p: Params): PpState {
    const rng = Rng.fromState(s.rngState);
    const grass = new Int16Array(s.grass.cells.length);
    for (let i = 0; i < grass.length; i++) {
      grass[i] = s.grass.cells[i] > 0 ? s.grass.cells[i] - 1 : 0;
    }

    const sheepNext: Agent[] = [];
    const sheepByCell = new Map<number, number[]>();
    for (const sheep of s.sheep) {
      const [dx, dy] = DIRS[rng.int(8)];
      const x = wrap(sheep.x + dx, W);
      const y = wrap(sheep.y + dy, H);
      const cell = y * W + x;
      let energy = sheep.energy - 1;
      if (grass[cell] === 0) {
        energy += p.sheepGain;
        grass[cell] = p.regrow;
      }
      if (energy <= 0) continue;
      if (energy >= 2 && rng.bool(p.sheepRepro)) {
        const lambEnergy = energy >> 1;
        energy -= lambEnergy;
        const lambIdx = sheepNext.length;
        sheepNext.push({ x, y, energy: lambEnergy });
        addToCell(sheepByCell, cell, lambIdx);
      }
      const idx = sheepNext.length;
      sheepNext.push({ x, y, energy });
      addToCell(sheepByCell, cell, idx);
    }

    const eaten = new Set<number>();
    const wolvesNext: Agent[] = [];
    for (const wolf of s.wolves) {
      const [dx, dy] = DIRS[rng.int(8)];
      const x = wrap(wolf.x + dx, W);
      const y = wrap(wolf.y + dy, H);
      const cell = y * W + x;
      let energy = wolf.energy - 1;
      const prey = sheepByCell.get(cell);
      if (prey) {
        const live = prey.find((i) => !eaten.has(i));
        if (live !== undefined) {
          eaten.add(live);
          energy += p.wolfGain;
        }
      }
      if (energy <= 0) continue;
      if (energy >= 2 && rng.bool(p.wolfRepro)) {
        const pupEnergy = energy >> 1;
        energy -= pupEnergy;
        wolvesNext.push({ x, y, energy: pupEnergy });
      }
      wolvesNext.push({ x, y, energy });
    }

    return {
      grass: { w: W, h: H, cells: grass },
      sheep: sheepNext.filter((_, i) => !eaten.has(i)),
      wolves: wolvesNext,
      rngState: rng.state(),
      tick: s.tick + 1,
    };
  },

  render(s, ctx, view) {
    paintGrid(ctx, view, s.grass, "pp", (v) => (v === 0 ? C_GROWN : C_BARE));
    const kx = view.width / W;
    const ky = view.height / H;
    ctx.fillStyle = "#e8eef7";
    for (const a of s.sheep) {
      ctx.fillRect(a.x * kx + 1, a.y * ky + 1, kx - 2, ky - 2);
    }
    ctx.fillStyle = "#ff5a50";
    for (const a of s.wolves) {
      ctx.fillRect(a.x * kx, a.y * ky, kx, ky);
    }
  },

  stats(s) {
    let grown = 0;
    for (let i = 0; i < s.grass.cells.length; i++) {
      if (s.grass.cells[i] === 0) grown++;
    }
    return {
      tick: s.tick,
      sheep: s.sheep.length,
      wolves: s.wolves.length,
      grassPct: (100 * grown) / s.grass.cells.length,
    };
  },
};

function addToCell(map: Map<number, number[]>, cell: number, idx: number): void {
  const list = map.get(cell);
  if (list) list.push(idx);
  else map.set(cell, [idx]);
}
