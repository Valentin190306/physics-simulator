import { describe, expect, it } from 'vitest';
import { Vec2 } from '../src/math/vec2';
import { Body } from '../src/physics/body';
import { World } from '../src/physics/world';

function terminalVelocityQuadratic(mass: number, radius: number, rho: number, cd: number): number {
  const k = 0.5 * rho * cd * Math.PI * radius * radius;
  return Math.sqrt((mass * 9.81) / k);
}

describe('arrastre atmosférico', () => {
  it('la caída cuadrática converge a la velocidad terminal', () => {
    const world = new World();
    world.setConfig({
      gravityY: -9.81,
      airModel: 'quadratic',
      airDensity: 1.2,
      dragCoefficient: 0.9,
    });
    const ball = world.addBody(
      new Body({
        position: new Vec2(0, 100),
        velocity: Vec2.zero(),
        radius: 0.3,
        mass: 1,
        restitution: 0.2,
        friction: 0,
      }),
    );

    for (let i = 0; i < 30 * 120; i++) world.step(1 / 120);

    const expected = terminalVelocityQuadratic(1, 0.3, 1.2, 0.9);
    expect(ball.velocity.y).toBeLessThan(0);
    expect(Math.abs(ball.velocity.y)).toBeCloseTo(expected, 1);
  });

  it('la caída lineal también alcanza su velocidad terminal', () => {
    const world = new World();
    world.setConfig({
      gravityY: -9.81,
      airModel: 'linear',
      airDensity: 1.2,
      dragCoefficient: 0.9,
    });
    const ball = world.addBody(
      new Body({
        position: new Vec2(0, 100),
        velocity: Vec2.zero(),
        radius: 0.3,
        mass: 1,
        restitution: 0.2,
        friction: 0,
      }),
    );

    for (let i = 0; i < 30 * 120; i++) world.step(1 / 120);

    const b = 4 * 1.2 * 0.9 * 0.3;
    const expected = 9.81 / b;
    expect(ball.velocity.y).toBeLessThan(0);
    expect(Math.abs(ball.velocity.y)).toBeCloseTo(expected, 1);
  });

  it('el arrastre disipa energía mecánica', () => {
    const world = new World();
    world.setConfig({ gravityY: -9.81, airModel: 'quadratic' });
    const ball = world.addBody(
      new Body({ position: new Vec2(0, 10), velocity: Vec2.zero(), radius: 0.3, mass: 1 }),
    );

    const initial = world.energyOf(ball).total;
    for (let i = 0; i < 120; i++) world.step(1 / 120);
    const final = world.energyOf(ball).total;
    expect(final).toBeLessThan(initial);
  });
});
