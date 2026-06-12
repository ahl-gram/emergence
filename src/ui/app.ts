import { sims, simById } from "../core/registry.js";
import { defaultParams, type AnySimulation, type Params, type View } from "../core/types.js";
import { buildParamControls } from "./controls.js";
import { StripChart } from "./chart.js";

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el as T;
}

const canvas = $<HTMLCanvasElement>("view");
const chartCanvas = $<HTMLCanvasElement>("chart");
const simList = $<HTMLElement>("simlist");
const paramsBox = $<HTMLElement>("params");
const statsBox = $<HTMLElement>("stats");
const playBtn = $<HTMLButtonElement>("playpause");
const speedInput = $<HTMLInputElement>("speed");
const speedVal = $<HTMLElement>("speedval");
const seedInput = $<HTMLInputElement>("seed");
const fpsBox = $<HTMLElement>("fps");

const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("no 2d context");
const view: View = { width: canvas.width, height: canvas.height };

interface App {
  sim: AnySimulation;
  params: Params;
  seed: number;
  state: unknown;
  running: boolean;
  speed: number;
  chart: StripChart | null;
}

function parseHash(): { id: string; seed: number; speed: number } {
  const [rawId, query] = location.hash.replace(/^#/, "").split("?");
  const id = rawId && simById(rawId) ? rawId : sims[0].id;
  const params = new URLSearchParams(query ?? "");
  const seed = Number(params.get("seed"));
  const speed = Number(params.get("speed"));
  return {
    id,
    seed: Number.isFinite(seed) && seed !== 0 ? Math.floor(seed) : 1,
    speed: Number.isFinite(speed) && speed > 0 ? Math.min(10, Math.floor(speed)) : 0,
  };
}

const initial = parseHash();
const app: App = {
  sim: simById(initial.id) ?? sims[0],
  params: {},
  seed: initial.seed,
  state: null,
  running: true,
  speed: initial.speed,
  chart: null,
};

function maxSpeed(): number {
  return Math.round(Math.log2(app.sim.maxStepsPerFrame ?? 64));
}

function stepsPerFrame(): number {
  return 2 ** app.speed;
}

function syncHash(): void {
  history.replaceState(null, "", `#${app.sim.id}?seed=${app.seed}`);
}

function reinit(): void {
  app.state = app.sim.init(app.seed, app.params);
  app.chart?.reset();
  draw();
}

function selectSim(sim: AnySimulation): void {
  app.sim = sim;
  app.params = defaultParams(sim.params);
  app.speed = Math.min(app.speed, maxSpeed());
  speedInput.max = String(maxSpeed());
  speedInput.value = String(app.speed);
  speedVal.textContent = `×${stepsPerFrame()}`;

  if (sim.series && sim.series.length > 0) {
    chartCanvas.hidden = false;
    app.chart = new StripChart(chartCanvas, sim.series, sim.chartMode === "normalized");
  } else {
    chartCanvas.hidden = true;
    app.chart = null;
  }

  $<HTMLElement>("aboutname").textContent = sim.name;
  $<HTMLElement>("aboutdesc").textContent = sim.description;
  $<HTMLElement>("abouttry").textContent = sim.whatToTry;
  document.title = `${sim.name} — Emergence`;

  buildParamControls(paramsBox, sim.params, app.params, (spec, value) => {
    app.params = { ...app.params, [spec.key]: value };
    if (spec.reinit) reinit();
  });

  for (const btn of simList.querySelectorAll("button")) {
    btn.classList.toggle("active", btn.dataset.sim === sim.id);
  }
  syncHash();
  reinit();
}

function draw(): void {
  app.sim.render(app.state, ctx!, view);
  const stats = app.sim.stats(app.state, app.params);
  statsBox.replaceChildren(
    ...Object.entries(stats).flatMap(([k, v], i) => {
      const value = document.createElement("b");
      value.textContent = fmt(v);
      return i === 0 ? [`${k} `, value] : [`  ·  ${k} `, value];
    }),
  );
  app.chart?.push(stats);
}

function fmt(v: number): string {
  if (Number.isInteger(v)) return v.toLocaleString();
  return v.toFixed(3);
}

let lastFrames: number[] = [];

function loop(now: number): void {
  if (app.running) {
    const n = stepsPerFrame();
    for (let i = 0; i < n; i++) {
      app.state = app.sim.step(app.state, app.params);
    }
    draw();
    lastFrames.push(now);
    lastFrames = lastFrames.filter((t) => now - t < 1000);
    fpsBox.textContent = `${lastFrames.length} fps`;
  }
  requestAnimationFrame(loop);
}

function setRunning(running: boolean): void {
  app.running = running;
  playBtn.textContent = running ? "⏸ pause" : "▶ play";
}

// --- wiring ---

for (const sim of sims) {
  const btn = document.createElement("button");
  btn.dataset.sim = sim.id;
  const blurb = document.createElement("span");
  blurb.className = "blurb";
  blurb.textContent = sim.blurb;
  btn.append(sim.name, blurb);
  btn.addEventListener("click", () => selectSim(sim));
  simList.append(btn);
}

playBtn.addEventListener("click", () => setRunning(!app.running));
$<HTMLButtonElement>("stepbtn").addEventListener("click", () => {
  setRunning(false);
  app.state = app.sim.step(app.state, app.params);
  draw();
});
$<HTMLButtonElement>("resetbtn").addEventListener("click", () => reinit());
$<HTMLButtonElement>("dice").addEventListener("click", () => {
  app.seed = Math.floor(Math.random() * 1_000_000);
  seedInput.value = String(app.seed);
  syncHash();
  reinit();
});

seedInput.value = String(app.seed);
seedInput.addEventListener("change", () => {
  const v = Number(seedInput.value);
  app.seed = Number.isFinite(v) ? Math.floor(v) : 1;
  seedInput.value = String(app.seed);
  syncHash();
  reinit();
});

speedInput.addEventListener("input", () => {
  app.speed = Number(speedInput.value);
  speedVal.textContent = `×${stepsPerFrame()}`;
});

document.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.code === "Space") {
    e.preventDefault();
    setRunning(!app.running);
  } else if (e.key === "s") {
    setRunning(false);
    app.state = app.sim.step(app.state, app.params);
    draw();
  } else if (e.key === "r") {
    reinit();
  }
});

window.addEventListener("hashchange", () => {
  const target = parseHash();
  if (target.id !== app.sim.id || target.seed !== app.seed) {
    app.seed = target.seed;
    seedInput.value = String(app.seed);
    selectSim(simById(target.id) ?? sims[0]);
  }
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

function pointer(e: PointerEvent): void {
  if (!app.sim.onPointer || e.buttons === 0) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  if (x < 0 || x >= 1 || y < 0 || y >= 1) return;
  app.state = app.sim.onPointer(app.state, x, y, e.buttons, app.params);
  if (!app.running) draw();
}

canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointer(e);
});
canvas.addEventListener("pointermove", pointer);

selectSim(app.sim);
setRunning(true);
requestAnimationFrame(loop);
