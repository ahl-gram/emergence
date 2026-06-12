import { Rng } from "../core/rng.js";
import { makeGridOf, type Grid } from "../core/grid.js";
import type { Simulation, Params } from "../core/types.js";
import { paintGrid, lerpRgb, rgb } from "../ui/painter.js";

export interface SnowflakeState {
  /** Water amount per cell. A cell is "frozen" (ice) once its value >= 1. */
  readonly water: Grid<Float32Array>;
  readonly rngState: number;
  readonly tick: number;
  readonly frozen: number;
}

const W = 201;
const H = 201;
const BG: [number, number, number] = [8, 11, 20];
const ICE_LOW: [number, number, number] = [70, 130, 200];
const ICE_HIGH: [number, number, number] = [230, 245, 255];

/**
 * Reiter's hexagonal-lattice snowflake CA. The square grid is read with the
 * even/odd-row hex neighborhood (6 neighbors), which is what produces real
 * six-fold symmetry instead of a square crystal.
 */
function hexNeighbors(x: number, y: number): Array<[number, number]> {
  const even = y % 2 === 0;
  return even
    ? [[x - 1, y], [x + 1, y], [x - 1, y - 1], [x, y - 1], [x - 1, y + 1], [x, y + 1]]
    : [[x - 1, y], [x + 1, y], [x, y - 1], [x + 1, y - 1], [x, y + 1], [x + 1, y + 1]];
}

function isFrozen(water: Float32Array, x: number, y: number): boolean {
  if (x < 0 || x >= W || y < 0 || y >= H) return false;
  return water[y * W + x] >= 1;
}

export const snowflake: Simulation<SnowflakeState> = {
  id: "snowflake",
  name: "Snowflake",
  blurb: "Six-fold symmetry from a vapor field",
  description:
    "A field of water vapor, one frozen seed in the center. Cells next to the ice " +
    "(the boundary) lock in their water and grab a fixed gift of vapor; everywhere " +
    "else vapor diffuses. That is the whole rule — yet it grows a six-armed crystal " +
    "whose arms match without ever communicating, because they all read the same " +
    "diffusing field. Reiter's model of why no two snowflakes are alike, and why " +
    "all of them have six sides.",
  whatToTry:
    "Nudge vapor (β) across 0.5–0.7: low values grow stars and dendrites, high " +
    "values grow plates and hexagons — the same knob that makes temperature decide " +
    "a real snowflake's shape. Tiny changes in one number, wholly different crystals.",
  params: [
    { key: "beta", label: "Background vapor β", min: 0.3, max: 0.8, step: 0.005, default: 0.5, reinit: true },
    { key: "alpha", label: "Diffusion α", min: 0.5, max: 2, step: 0.01, default: 1.0 },
    { key: "gamma", label: "Vapor gift γ", min: 0, max: 0.01, step: 0.0005, default: 0.001 },
  ],
  series: [{ key: "frozen", label: "Ice cells", color: "#bfe3ff" }],
  maxStepsPerFrame: 4,

  init(seed: number, p: Params): SnowflakeState {
    const water = makeGridOf(W, H, Float32Array);
    water.cells.fill(p.beta);
    water.cells[(H >> 1) * W + (W >> 1)] = 1;
    return {
      water,
      rngState: new Rng(seed).state(),
      tick: 0,
      frozen: 1,
    };
  },

  step(s: SnowflakeState, p: Params): SnowflakeState {
    const prev = s.water.cells;
    const next = new Float32Array(prev.length);
    const halfAlpha = p.alpha / 2;

    // Reiter splits each cell's water into a diffusing part u and a frozen
    // part v. Receptive cells (ice, or touching ice) have u = 0; their water
    // is held and grows only by pulling diffused u from non-receptive
    // neighbors. Out-of-bounds neighbors act as a constant vapor bath β.
    const receptive = new Uint8Array(prev.length);
    const u = new Float32Array(prev.length);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let rec = prev[i] >= 1;
        if (!rec) {
          for (const [nx, ny] of hexNeighbors(x, y)) {
            if (isFrozen(prev, nx, ny)) { rec = true; break; }
          }
        }
        receptive[i] = rec ? 1 : 0;
        u[i] = rec ? 0 : prev[i];
      }
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let sum = 0;
        for (const [nx, ny] of hexNeighbors(x, y)) {
          sum += nx >= 0 && nx < W && ny >= 0 && ny < H ? u[ny * W + nx] : p.beta;
        }
        const avgU = sum / 6;
        if (receptive[i] === 1) {
          next[i] = prev[i] + p.gamma + halfAlpha * avgU;
        } else {
          next[i] = prev[i] + halfAlpha * (avgU - prev[i]);
        }
      }
    }

    let frozen = 0;
    for (let i = 0; i < next.length; i++) if (next[i] >= 1) frozen++;

    return {
      water: { w: W, h: H, cells: next },
      rngState: s.rngState,
      tick: s.tick + 1,
      frozen,
    };
  },

  render(s, ctx, view) {
    paintGrid(ctx, view, s.water, "snowflake", (v) => {
      if (v >= 1) {
        const t = Math.min(1, (v - 1) / 0.6);
        return lerpRgb(ICE_LOW, ICE_HIGH, t);
      }
      // faint vapor field
      const g = Math.min(1, v) * 0.25;
      return lerpRgb(BG, [40, 60, 90], g);
    });
  },

  stats(s) {
    return { tick: s.tick, frozen: s.frozen };
  },
};

export const SNOWFLAKE_WORLD = { w: W, h: H };
export { hexNeighbors, isFrozen };
