import type { AnySimulation } from "./types.js";
import { life } from "../sims/life.js";
import { boids } from "../sims/boids.js";
import { schelling } from "../sims/schelling.js";
import { fire } from "../sims/fire.js";
import { predatorPrey } from "../sims/predatorPrey.js";
import { traffic } from "../sims/traffic.js";
import { ants } from "../sims/ants.js";
import { sand } from "../sims/sand.js";
import { epidemic } from "../sims/epidemic.js";
import { langton } from "../sims/langton.js";
import { sandpile } from "../sims/sandpile.js";
import { dla } from "../sims/dla.js";
import { fireflies } from "../sims/fireflies.js";
import { grayScott } from "../sims/grayScott.js";
import { brain } from "../sims/brain.js";

export const sims: AnySimulation[] = [
  life as AnySimulation,
  brain as AnySimulation,
  boids as AnySimulation,
  schelling as AnySimulation,
  fire as AnySimulation,
  predatorPrey as AnySimulation,
  traffic as AnySimulation,
  ants as AnySimulation,
  sand as AnySimulation,
  epidemic as AnySimulation,
  langton as AnySimulation,
  sandpile as AnySimulation,
  dla as AnySimulation,
  fireflies as AnySimulation,
  grayScott as AnySimulation,
];

export function simById(id: string): AnySimulation | undefined {
  return sims.find((s) => s.id === id);
}
