import type { SeriesSpec } from "../core/types.js";

const MAX_POINTS = 960;

/** Rolling time-series chart for sim stats (population curves, order parameters…). */
export class StripChart {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly series: SeriesSpec[];
  private readonly normalized: boolean;
  private data: Map<string, number[]>;

  constructor(canvas: HTMLCanvasElement, series: SeriesSpec[], normalized = false) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("could not create chart 2d context");
    this.ctx = ctx;
    this.series = series;
    this.normalized = normalized;
    this.data = new Map(series.map((s) => [s.key, []]));
  }

  reset(): void {
    this.data = new Map(this.series.map((s) => [s.key, []]));
    this.draw();
  }

  push(values: Record<string, number>): void {
    for (const s of this.series) {
      const arr = this.data.get(s.key);
      if (!arr) continue;
      const v = values[s.key];
      arr.push(Number.isFinite(v) ? v : 0);
      if (arr.length > MAX_POINTS) arr.shift();
    }
    this.draw();
  }

  private draw(): void {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = "#11151f";
    ctx.fillRect(0, 0, w, h);

    let n = 0;
    for (const arr of this.data.values()) n = Math.max(n, arr.length);
    if (n < 2) return;

    const sharedRange = this.normalized ? null : this.range([...this.data.values()].flat());

    const top = 6;
    const bottom = h - 6;
    for (const s of this.series) {
      const arr = this.data.get(s.key);
      if (!arr || arr.length < 2) continue;
      const [min, max] = sharedRange ?? this.range(arr);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < arr.length; i++) {
        const x = (i / (MAX_POINTS - 1)) * (w - 8) + 4;
        const y = bottom - ((arr[i] - min) / (max - min)) * (bottom - top);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.font = "11px ui-monospace, Menlo, monospace";
    let lx = 10;
    for (const s of this.series) {
      const arr = this.data.get(s.key);
      const last = arr && arr.length > 0 ? arr[arr.length - 1] : 0;
      const label = `${s.label} ${formatNum(last)}`;
      ctx.fillStyle = s.color;
      ctx.fillText(label, lx, 16);
      lx += ctx.measureText(label).width + 18;
    }
    if (sharedRange) {
      ctx.fillStyle = "#7d8aa0";
      const maxText = formatNum(sharedRange[1]);
      ctx.fillText(maxText, w - ctx.measureText(maxText).width - 8, 16);
      const minText = formatNum(sharedRange[0]);
      ctx.fillText(minText, w - ctx.measureText(minText).width - 8, h - 8);
    } else {
      ctx.fillStyle = "#7d8aa0";
      const note = "each curve scaled to its own range";
      ctx.fillText(note, w - ctx.measureText(note).width - 8, 16);
    }
  }

  private range(values: number[]): [number, number] {
    let min = Infinity;
    let max = -Infinity;
    for (const v of values) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const pad = (max - min) * 0.06;
    return [min - pad, max + pad];
  }
}

function formatNum(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(3);
}
