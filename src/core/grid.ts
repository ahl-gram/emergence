/**
 * 2D grids over typed arrays, treated as immutable between steps:
 * a step builds a fresh cells buffer and returns a new Grid object.
 */
export type Cells = Uint8Array | Int16Array | Int32Array | Float32Array;

export interface Grid<T extends Cells = Uint8Array> {
  readonly w: number;
  readonly h: number;
  readonly cells: T;
}

export function makeGrid(w: number, h: number): Grid<Uint8Array> {
  return { w, h, cells: new Uint8Array(w * h) };
}

export function makeGridOf<T extends Cells>(
  w: number,
  h: number,
  ctor: new (n: number) => T,
): Grid<T> {
  return { w, h, cells: new ctor(w * h) };
}

export function cloneGrid<T extends Cells>(g: Grid<T>): Grid<T> {
  return { w: g.w, h: g.h, cells: g.cells.slice() as T };
}

export function idx(g: { readonly w: number }, x: number, y: number): number {
  return y * g.w + x;
}

/** Torus wrap: maps any integer into [0, m). */
export function wrap(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export const MOORE: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

export const VON_NEUMANN: ReadonlyArray<readonly [number, number]> = [
  [0, -1], [-1, 0], [1, 0], [0, 1],
];

/** Count neighbors equal to `value`, wrapping at the edges. */
export function countWrap<T extends Cells>(
  g: Grid<T>,
  x: number,
  y: number,
  value: number,
  offsets: ReadonlyArray<readonly [number, number]>,
): number {
  let count = 0;
  for (const [dx, dy] of offsets) {
    const nx = wrap(x + dx, g.w);
    const ny = wrap(y + dy, g.h);
    if (g.cells[ny * g.w + nx] === value) count++;
  }
  return count;
}
