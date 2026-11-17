import { describe, expect, it } from 'vitest';
import { Vec2 } from '../src/math/vec2';
import { DEFAULT_CONFIG, type WorldConfig } from '../src/physics/world';
import { runConvergence, type LaunchSpec } from '../src/sim/convergence';

const config: WorldConfig = {
  ...DEFAULT_CONFIG,
  airModel: 'quadratic',
  airDensity: 1.2,
  dragCoefficient: 0.6,
  gravityY: -9.81,
};

const launch: LaunchSpec = {
  position: new Vec2(2, 1.5),
  velocity: new Vec2(8, 10),
  radius: 0.3,
  mass: 1,
  restitution: 0.5,
  friction: 0.3,
};

describe('análisis de convergencia', () => {
  it('mide órdenes O(dt) y O(dt⁴) con arrastre', () => {
    const results = runConvergence(config, launch, 2);
    const explicit = results.find((result) => result.integrator === 'explicit');
    const semi = results.find((result) => result.integrator === 'semiImplicit');
    const rk4 = results.find((result) => result.integrator === 'rk4');

    expect(explicit).toBeDefined();
    expect(semi).toBeDefined();
    expect(rk4).toBeDefined();

    expect(semi!.slope).toBeGreaterThan(0.8);
    expect(semi!.slope).toBeLessThan(1.3);
    expect(explicit!.slope).toBeGreaterThan(0.8);
    expect(explicit!.slope).toBeLessThan(1.3);
    expect(rk4!.slope).toBeGreaterThan(3.5);
  });
});
