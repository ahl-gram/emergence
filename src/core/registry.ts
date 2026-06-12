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
import { ising } from "../sims/ising.js";
import { dilemma } from "../sims/dilemma.js";
import { wealth } from "../sims/wealth.js";
import { opinions } from "../sims/opinions.js";
import { pedestrians } from "../sims/pedestrians.js";
import { gravity } from "../sims/gravity.js";
import { percolation } from "../sims/percolation.js";
import { evolution } from "../sims/evolution.js";
import { spirals } from "../sims/spirals.js";
import { vicsek } from "../sims/vicsek.js";
import { turmite } from "../sims/turmite.js";
import { physarum } from "../sims/physarum.js";
import { rps } from "../sims/rps.js";
import { gas } from "../sims/gas.js";
import { snowflake } from "../sims/snowflake.js";
import { hopfield } from "../sims/hopfield.js";
import { termites } from "../sims/termites.js";

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
  ising as AnySimulation,
  dilemma as AnySimulation,
  wealth as AnySimulation,
  opinions as AnySimulation,
  pedestrians as AnySimulation,
  gravity as AnySimulation,
  percolation as AnySimulation,
  evolution as AnySimulation,
  spirals as AnySimulation,
  vicsek as AnySimulation,
  turmite as AnySimulation,
  physarum as AnySimulation,
  rps as AnySimulation,
  gas as AnySimulation,
  snowflake as AnySimulation,
  hopfield as AnySimulation,
  termites as AnySimulation,
];

export function simById(id: string): AnySimulation | undefined {
  return sims.find((s) => s.id === id);
}
