import type { Grid, Cells } from "../core/grid.js";
import type { View } from "../core/types.js";

/** Pack r,g,b (0-255) into the little-endian ABGR format ImageData expects. */
export function rgb(r: number, g: number, b: number): number {
  return (0xff << 24) | (b << 16) | (g << 8) | r;
}

export function lerpRgb(a: [number, number, number], b: [number, number, number], t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return rgb(
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
  );
}

interface PainterCache {
  canvas: HTMLCanvasElement;
  ictx: CanvasRenderingContext2D;
  img: ImageData;
  u32: Uint32Array;
}

const painters = new Map<string, PainterCache>();

function getPainter(key: string, w: number, h: number): PainterCache {
  const existing = painters.get(key);
  if (existing && existing.canvas.width === w && existing.canvas.height === h) {
    return existing;
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ictx = canvas.getContext("2d");
  if (!ictx) throw new Error("could not create offscreen 2d context");
  const img = ictx.createImageData(w, h);
  const cache: PainterCache = {
    canvas,
    ictx,
    img,
    u32: new Uint32Array(img.data.buffer),
  };
  painters.set(key, cache);
  return cache;
}

/**
 * Draw a cell grid scaled to fill the view. `color` maps a cell value
 * (and its index, for value-independent effects) to a packed rgb() pixel.
 */
export function paintGrid<T extends Cells>(
  ctx: CanvasRenderingContext2D,
  view: View,
  g: Grid<T>,
  key: string,
  color: (value: number, i: number) => number,
): void {
  const p = getPainter(key, g.w, g.h);
  const cells = g.cells;
  const u32 = p.u32;
  for (let i = 0; i < cells.length; i++) {
    u32[i] = color(cells[i], i);
  }
  p.ictx.putImageData(p.img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(p.canvas, 0, 0, view.width, view.height);
}

export function clear(ctx: CanvasRenderingContext2D, view: View, cssColor: string): void {
  ctx.fillStyle = cssColor;
  ctx.fillRect(0, 0, view.width, view.height);
}
