import { Vec2 } from '../math/vec2';
import { linearRegression } from '../math/integral';
import { Body } from '../physics/body';
import { World, type Integrator, type WorldConfig } from '../physics/world';

export interface LaunchSpec {
  position: Vec2;
  velocity: Vec2;
  radius: number;
  mass: number;
  restitution: number;
  friction: number;
}

export interface ConvergenceSeries {
  integrator: Integrator;
  label: string;
  color: string;
  points: { dt: number; error: number }[];
  slope: number;
  /** Longitud de la trayectoria de referencia, para expresar el error relativo. */
  referencePath: number;
}

const INTEGRATORS: { id: Integrator; label: string; color: string }[] = [
  { id: 'explicit', label: 'Euler explícito', color: '#ff6b6b' },
  { id: 'semiImplicit', label: 'Euler semi-implícito', color: '#4cc9f0' },
  { id: 'rk4', label: 'RK4', color: '#80ed99' },
];

const DTS = [1 / 30, 1 / 60, 1 / 120, 1 / 240, 1 / 480];

function simulate(
  config: WorldConfig,
  launch: LaunchSpec,
  dt: number,
  duration: number,
  integrator: Integrator,
): { position: Vec2; pathLength: number } {
  const world = new World();
  world.setConfig({ ...config, integrator });
  const body = world.addBody(
    new Body({
      position: launch.position.clone(),
      velocity: launch.velocity.clone(),
      radius: launch.radius,
      mass: launch.mass,
      restitution: launch.restitution,
      friction: launch.friction,
      rollingResistance: 0,
    }),
  );

  const steps = Math.max(1, Math.round(duration / dt));
  let pathLength = 0;
  let previous = body.position.clone();
  for (let i = 0; i < steps; i++) {
    world.stepExact(dt);
    pathLength += body.position.sub(previous).length();
    previous = body.position.clone();
  }
  return { position: body.position.clone(), pathLength };
}

export function runConvergence(
  config: WorldConfig,
  launch: LaunchSpec,
  duration = 2,
): ConvergenceSeries[] {
  const reference = simulate(config, launch, 1 / 8192, duration, 'rk4');

  return INTEGRATORS.map(({ id, label, color }) => {
    const points = DTS.map((dt) => {
      const simulated = simulate(config, launch, dt, duration, id);
      const error = Math.max(simulated.position.sub(reference.position).length(), 1e-15);
      return { dt, error };
    });

    const regression = linearRegression(
      points.map((point) => ({ x: Math.log10(point.dt), y: Math.log10(point.error) })),
    );

    return {
      integrator: id,
      label,
      color,
      points,
      slope: regression.slope,
      referencePath: reference.pathLength,
    };
  });
}
