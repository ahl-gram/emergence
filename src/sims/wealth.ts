import { Rng } from "../core/rng.js";
import type { Simulation, Params } from "../core/types.js";
import { clear } from "../ui/painter.js";

export interface WealthState {
  /** Wealth per agent, in integer cents so conservation is exact. */
  readonly wealth: ReadonlyArray<number>;
  readonly rngState: number;
  readonly tick: number;
}

const START_CENTS = 10000;

/** Gini coefficient of a wealth vector, 0 (equal) to ~1 (one owns all). */
export function gini(wealth: ReadonlyArray<number>): number {
  const n = wealth.length;
  if (n === 0) return 0;
  const sorted = [...wealth].sort((a, b) => a - b);
  let total = 0;
  let weighted = 0;
  for (let i = 0; i < n; i++) {
    total += sorted[i];
    weighted += sorted[i] * (i + 1);
  }
  if (total === 0) return 0;
  return (2 * weighted) / (n * total) - (n + 1) / n;
}

export const wealth: Simulation<WealthState> = {
  id: "wealth",
  name: "Wealth Condensation",
  blurb: "Inequality from pure coin flips",
  description:
    "Everyone starts with identical wealth. Pairs meet and wager a fraction of the " +
    "poorer partner's holdings on a fair coin — no skill, no cheating, no head start. " +
    "Wealth still condenses relentlessly toward a tiny elite, because losses hurt the " +
    "poor more than symmetric wins help them. The skyline is everyone's wealth, " +
    "sorted; the curve is the Lorenz curve sagging away from the line of equality.",
  whatToTry:
    "Watch the Gini index climb with zero unfairness in the rules. Then raise the " +
    "flat tax: a few percent of redistribution is enough to hold inequality at a " +
    "steady level instead of runaway condensation. The knob is small; the effect is not.",
  params: [
    { key: "agents", label: "People", min: 100, max: 2000, step: 50, default: 500, reinit: true },
    { key: "wager", label: "Wager fraction", min: 0.01, max: 0.5, step: 0.01, default: 0.1 },
    { key: "tax", label: "Flat tax / step", min: 0, max: 0.05, step: 0.001, default: 0 },
  ],
  series: [
    { key: "gini", label: "Gini index", color: "#ff9d3d" },
    { key: "top10", label: "Top 10% share", color: "#ff5a50" },
  ],
  maxStepsPerFrame: 64,

  init(seed: number, p: Params): WealthState {
    return {
      wealth: new Array(p.agents).fill(START_CENTS),
      rngState: new Rng(seed).state(),
      tick: 0,
    };
  },

  step(s: WealthState, p: Params): WealthState {
    const rng = Rng.fromState(s.rngState);
    const w = [...s.wealth];
    const n = w.length;

    const order = rng.shuffled(w.map((_, i) => i));
    for (let k = 0; k + 1 < n; k += 2) {
      const a = order[k];
      const b = order[k + 1];
      const stake = Math.floor(p.wager * Math.min(w[a], w[b]));
      if (stake <= 0) continue;
      if (rng.bool(0.5)) {
        w[a] += stake;
        w[b] -= stake;
      } else {
        w[a] -= stake;
        w[b] += stake;
      }
    }

    if (p.tax > 0) {
      let pot = 0;
      for (let i = 0; i < n; i++) {
        const levy = Math.floor(w[i] * p.tax);
        w[i] -= levy;
        pot += levy;
      }
      const share = Math.floor(pot / n);
      let remainder = pot - share * n;
      for (let i = 0; i < n; i++) {
        w[i] += share + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder--;
      }
    }

    return { wealth: w, rngState: rng.state(), tick: s.tick + 1 };
  },

  render(s, ctx, view) {
    clear(ctx, view, "#0a0c10");
    const sorted = [...s.wealth].sort((a, b) => a - b);
    const n = sorted.length;
    const max = Math.max(1, sorted[n - 1]);
    const total = sorted.reduce((acc, v) => acc + v, 0) || 1;

    // left 58%: sorted wealth skyline
    const skyW = view.width * 0.58;
    const baseY = view.height - 24;
    const plotH = view.height - 60;
    ctx.fillStyle = "#d9b36a";
    const barW = skyW / n;
    for (let i = 0; i < n; i++) {
      const h = (sorted[i] / max) * plotH;
      ctx.fillRect(8 + i * barW, baseY - h, Math.max(1, barW - 0.5), h);
    }
    ctx.fillStyle = "#7d8aa0";
    ctx.font = "13px ui-monospace, Menlo, monospace";
    ctx.fillText("everyone's wealth, sorted →", 8, baseY + 17);

    // right: Lorenz curve
    const lx = view.width * 0.64;
    const lw = view.width * 0.32;
    const ly = baseY;
    const lh = plotH;
    ctx.strokeStyle = "#3a4356";
    ctx.strokeRect(lx, ly - lh, lw, lh);
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + lw, ly - lh);
    ctx.stroke();
    ctx.strokeStyle = "#ff9d3d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    let acc = 0;
    for (let i = 0; i < n; i++) {
      acc += sorted[i];
      ctx.lineTo(lx + ((i + 1) / n) * lw, ly - (acc / total) * lh);
    }
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillText("Lorenz curve vs equality", lx, baseY + 17);
  },

  stats(s) {
    const sorted = [...s.wealth].sort((a, b) => a - b);
    const n = sorted.length;
    const total = sorted.reduce((acc, v) => acc + v, 0) || 1;
    let topSum = 0;
    const topCount = Math.max(1, Math.floor(n / 10));
    for (let i = n - topCount; i < n; i++) topSum += sorted[i];
    return {
      step: s.tick,
      gini: gini(s.wealth),
      top10: topSum / total,
      richest: sorted[n - 1] / 100,
    };
  },
};
