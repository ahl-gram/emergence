/**
 * The contract every simulation implements. Core rule: `init` and `step`
 * are pure — same seed and params always replay the same run. Steps never
 * mutate the incoming state; they build and return a new one. Rendering
 * is kept separate so the sim logic stays testable in Node.
 */
export type Params = Record<string, number>;

export interface ParamSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  /** Changing this param requires re-running init (e.g. population sizes). */
  reinit?: boolean;
  /** When present, render as a dropdown; the numeric value indexes this list. */
  options?: readonly string[];
}

export interface SeriesSpec {
  key: string;
  label: string;
  color: string;
}

export interface View {
  readonly width: number;
  readonly height: number;
}

export interface Simulation<S> {
  id: string;
  name: string;
  /** One-liner for the sim list. */
  blurb: string;
  /** The local rule, in plain language. */
  description: string;
  /** What global pattern emerges, and suggested experiments. */
  whatToTry: string;
  params: ParamSpec[];
  /** Stats keys to plot over time, if any. */
  series?: SeriesSpec[];
  /**
   * "shared" (default): one y-scale for all series.
   * "normalized": each series scaled to its own min/max — for comparing the
   * shape and phase of curves with very different magnitudes.
   */
  chartMode?: "shared" | "normalized";
  /** Cap on steps-per-frame the UI will offer (cheap sims can go higher). */
  maxStepsPerFrame?: number;
  init(seed: number, p: Params): S;
  step(state: S, p: Params): S;
  render(state: S, ctx: CanvasRenderingContext2D, view: View): void;
  stats(state: S, p: Params): Record<string, number>;
  /** Optional pointer interaction; x and y are normalized to [0, 1). */
  onPointer?(state: S, x: number, y: number, buttons: number, p: Params): S;
}

export function defaultParams(specs: ParamSpec[]): Params {
  return Object.fromEntries(specs.map((s) => [s.key, s.default]));
}

/** Type-erased view of a Simulation for registry/UI code. */
export type AnySimulation = Simulation<unknown>;
