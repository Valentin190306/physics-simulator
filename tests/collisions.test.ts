import { describe, expect, it } from 'vitest';
import { Vec2 } from '../src/math/vec2';
import { Body } from '../src/physics/body';
import { circleCircle } from '../src/physics/collide';
import { frameShapes } from '../src/physics/geometry';
import { resolveContact } from '../src/physics/resolve';
import { World } from '../src/physics/world';

describe('colisiones', () => {
  it('dos masas iguales intercambian velocidad en un choque elástico', () => {
    const a = new Body({
      position: new Vec2(0, 0),
      velocity: new Vec2(1, 0),
      radius: 0.5,
      mass: 1,
      restitution: 1,
      friction: 0,
    });
    const b = new Body({
      position: new Vec2(0.9, 0),
      velocity: new Vec2(-1, 0),
      radius: 0.5,
      mass: 1,
      restitution: 1,
      friction: 0,
    });

    const contact = circleCircle(a, b);
    expect(contact).not.toBeNull();
    if (!contact) return;

    resolveContact(contact);
    expect(a.velocity.x).toBeCloseTo(-1, 6);
    expect(b.velocity.x).toBeCloseTo(1, 6);
  });

  it('conserva el momento lineal en un choque entre dos cuerpos', () => {
    const world = new World();
    world.setConfig({ gravityY: 0, airModel: 'none' });
    const a = world.addBody(
      new Body({
        position: new Vec2(5, 5),
        velocity: new Vec2(2, 0),
        radius: 0.4,
        mass: 1,
        restitution: 1,
        friction: 0,
      }),
    );
    const b = world.addBody(
      new Body({
        position: new Vec2(7, 5),
        velocity: new Vec2(-2, 0),
        radius: 0.4,
        mass: 1,
        restitution: 1,
        friction: 0,
      }),
    );

    const initialP = a.mass * a.velocity.x + b.mass * b.velocity.x;
    const initialK = a.kineticEnergy + b.kineticEnergy;

    for (let i = 0; i < 240; i++) world.step(1 / 240);

    const finalP = a.mass * a.velocity.x + b.mass * b.velocity.x;
    const finalK = a.kineticEnergy + b.kineticEnergy;
    expect(finalP).toBeCloseTo(initialP, 6);
    expect(finalK).toBeCloseTo(initialK, 3);
  });

  it('una bola en reposo no se hunde en el suelo', () => {
    const world = new World();
    world.setShapes(frameShapes(20, 12));
    world.setConfig({ gravityY: -9.81, airModel: 'none' });
    const ball = world.addBody(
      new Body({
        position: new Vec2(5, 0.6),
        velocity: Vec2.zero(),
        radius: 0.3,
        mass: 1,
        restitution: 0,
        friction: 0.6,
      }),
    );

    for (let i = 0; i < 480; i++) world.step(1 / 240);

    expect(ball.position.y).toBeGreaterThan(0.26);
    expect(ball.position.y).toBeLessThan(0.36);
    expect(Math.abs(ball.velocity.y)).toBeLessThan(0.05);
  });

  it('una bola rápida no atraviesa el suelo con substepping', () => {
    const world = new World();
    world.setShapes(frameShapes(20, 12));
    world.setConfig({ gravityY: -9.81, airModel: 'none' });
    const ball = world.addBody(
      new Body({
        position: new Vec2(10, 8),
        velocity: new Vec2(0, -40),
        radius: 0.25,
        mass: 1,
        restitution: 0.6,
        friction: 0.2,
      }),
    );

    for (let i = 0; i < 240; i++) world.step(1 / 240);

    expect(Number.isFinite(ball.position.y)).toBe(true);
    expect(ball.position.y).toBeGreaterThan(0.2);
  });
});
