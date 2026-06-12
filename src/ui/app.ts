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
const landingEl = $<HTMLElement>("landing");
const appEl = $<HTMLElement>("app");
const galleryEl = $<HTMLElement>("gallery");

const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("no 2d context");
const view: View = { width: canvas.width, height: canvas.height };

/** Steps to evolve each thumbnail before its single static render. Default
 *  below; overrides for sims that need more (or less) to read at a glance. */
const PREVIEW_STEPS: Record<string, number> = {
  langton: 700, "gray-scott": 700, snowflake: 420, dla: 280, physarum: 220,
  spirals: 220, ripple: 220, evolve: 220, rps: 160, hopfield: 8,
  percolation: 1, gravity: 90, fluid: 110, sandpile: 200, ants: 260,
};
const DEFAULT_PREVIEW_STEPS = 120;
let inApp = false;
let galleryBuilt = false;

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
  if (inApp && app.running) {
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

// --- landing / routing ---

/** The sim named by the URL hash, or null when the hash is empty (gallery). */
function hashSimId(): string | null {
  const raw = location.hash.replace(/^#/, "").split("?")[0];
  return raw && simById(raw) ? raw : null;
}

function renderThumb(sim: AnySimulation, thumb: HTMLCanvasElement): void {
  const tctx = thumb.getContext("2d");
  if (!tctx) return;
  const tview: View = { width: thumb.width, height: thumb.height };
  const p = defaultParams(sim.params);
  let state = sim.init(3, p);
  const steps = PREVIEW_STEPS[sim.id] ?? DEFAULT_PREVIEW_STEPS;
  for (let i = 0; i < steps; i++) state = sim.step(state, p);
  sim.render(state, tctx, tview);
}

function buildGallery(): void {
  if (galleryBuilt) return;
  galleryBuilt = true;
  $<HTMLElement>("simcount").textContent = String(sims.length);
  const queue: Array<[AnySimulation, HTMLCanvasElement]> = [];
  for (const sim of sims) {
    const card = document.createElement("a");
    card.className = "card";
    card.href = `#${sim.id}`;

    const thumb = document.createElement("canvas");
    thumb.width = 240;
    thumb.height = 150;

    const body = document.createElement("div");
    body.className = "card-body";
    const name = document.createElement("div");
    name.className = "card-name";
    name.textContent = sim.name;
    const blurb = document.createElement("div");
    blurb.className = "card-blurb";
    blurb.textContent = sim.blurb;
    body.append(name, blurb);

    card.append(thumb, body);
    galleryEl.append(card);
    queue.push([sim, thumb]);
  }

  // render thumbnails one per frame so the page appears instantly
  let i = 0;
  const tick = () => {
    if (i >= queue.length) return;
    const [sim, thumb] = queue[i++];
    try {
      renderThumb(sim, thumb);
    } catch {
      /* a broken thumbnail must never break the gallery */
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function showLanding(): void {
  inApp = false;
  setRunning(false);
  appEl.hidden = true;
  landingEl.hidden = false;
  document.title = "Emergence — simple rules, complex behavior";
  buildGallery();
}

function showApp(id: string): void {
  const target = parseHash();
  app.seed = target.seed;
  app.speed = target.speed;
  seedInput.value = String(app.seed);
  landingEl.hidden = true;
  appEl.hidden = false;
  inApp = true;
  selectSim(simById(id) ?? sims[0]);
  setRunning(true);
}

function route(): void {
  const id = hashSimId();
  if (id) showApp(id);
  else showLanding();
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

window.addEventListener("hashchange", route);

$<HTMLAnchorElement>("gallerybtn").addEventListener("click", (e) => {
  e.preventDefault();
  if (location.hash) location.hash = ""; // fires hashchange -> route -> showLanding
  else route();
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

route();
requestAnimationFrame(loop);
