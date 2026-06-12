/**
 * Deterministic PRNG (mulberry32). Every simulation draws all randomness
 * from one of these so that a given seed always replays the same run.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  static fromState(state: number): Rng {
    const rng = new Rng(0);
    rng.s = state >>> 0;
    return rng;
  }

  /** Internal state, for storing inside immutable sim state between steps. */
  state(): number {
    return this.s;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** Uniform float in [a, b). */
  range(a: number, b: number): number {
    return a + this.next() * (b - a);
  }

  /** True with probability p. */
  bool(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }

  /** Fisher–Yates on a copy; the input array is never mutated. */
  shuffled<T>(arr: readonly T[]): T[] {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }
}
