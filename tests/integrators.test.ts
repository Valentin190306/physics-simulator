import { describe, expect, it } from 'vitest';
import { Vec2 } from '../src/math/vec2';
import { Body } from '../src/physics/body';
import { World } from '../src/physics/world';

function projectile(integrator: 'explicit' | 'semiImplicit' | 'rk4', dt: number): number {
  const world = new World();
  world.setConfig({ gravityY: -9.81, airModel: 'none', integrator });
  const body = world.addBody(
    new Body({ position: new Vec2(2, 2), velocity: new Vec2(5, 5), radius: 0.3, mass: 1 }),
  );
  const steps = Math.round(1 / dt);
  for (let i = 0; i < steps; i++) world.stepExact(dt);
  const analyticY = 2 + 5 * 1 - 0.5 * 9.81 * 1;
  return Math.abs(body.position.y - analyticY);
}

describe('integradores', () => {
  it('el tiro parabólico converge a la solución analítica', () => {
    const error = projectile('semiImplicit', 1 / 240);
    expect(error).toBeLessThan(0.05);
  });

  it('RK4 es mucho más preciso que Euler con el mismo paso', () => {
    const euler = projectile('semiImplicit', 1 / 30);
    const rk4 = projectile('rk4', 1 / 30);
    expect(rk4).toBeLessThan(euler * 0.01);
  });

  it('sin gravedad ni aire el movimiento es uniforme', () => {
    const world = new World();
    world.setConfig({ gravityY: 0, airModel: 'none', integrator: 'semiImplicit' });
    const body = world.addBody(
      new Body({ position: new Vec2(0, 0), velocity: new Vec2(3, -2), radius: 0.2, mass: 2 }),
    );
    world.stepExact(1);
    expect(body.position.x).toBeCloseTo(3, 10);
    expect(body.position.y).toBeCloseTo(-2, 10);
  });
});
