import { Vec2 } from '../math/vec2';
import { Body } from './body';
import { circleCircle, circleSegment, type Contact } from './collide';
import type { Segment, StaticShape } from './geometry';
import { correctContact, resolveContact } from './resolve';

export type AirModel = 'none' | 'linear' | 'quadratic';
export type Integrator = 'explicit' | 'semiImplicit' | 'rk4';

export interface WorldConfig {
  gravityY: number;
  airModel: AirModel;
  airDensity: number;
  dragCoefficient: number;
  windX: number;
  windY: number;
  integrator: Integrator;
}

export const DEFAULT_CONFIG: WorldConfig = {
  gravityY: -9.81,
  airModel: 'none',
  airDensity: 1.2,
  dragCoefficient: 0.6,
  windX: 0,
  windY: 0,
  integrator: 'semiImplicit',
};

const MAX_SUBSTEPS = 24;
const MAX_TRACE_POINTS = 700;
const TRACE_MIN_DISTANCE = 0.045;

export class World {
  bodies: Body[] = [];
  shapes: StaticShape[] = [];
  segments: Segment[] = [];
  contacts: Contact[] = [];
  config: WorldConfig = { ...DEFAULT_CONFIG };
  time = 0;

  addBody(body: Body): Body {
    this.bodies.push(body);
    return body;
  }

  removeBody(body: Body): void {
    this.bodies = this.bodies.filter((b) => b !== body);
  }

  clearBodies(): void {
    this.bodies = [];
    this.contacts = [];
  }

  setShapes(shapes: StaticShape[]): void {
    this.shapes = shapes;
    this.segments = shapes.flatMap((shape) => shape.segments);
  }

  setConfig(patch: Partial<WorldConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  resetClock(): void {
    this.time = 0;
    this.contacts = [];
  }

  /** Aceleración total (gravedad + arrastre atmosférico) para un cuerpo. */
  acceleration(body: Body, vx: number, vy: number): Vec2 {
    let ax = 0;
    let ay = this.config.gravityY;

    const { airModel, airDensity, dragCoefficient, windX, windY } = this.config;
    if (airModel !== 'none' && airDensity > 0 && dragCoefficient > 0) {
      const relX = vx - windX;
      const relY = vy - windY;
      const relSpeed = Math.hypot(relX, relY);

      if (relSpeed > 1e-9) {
        const area = Math.PI * body.radius * body.radius;
        if (airModel === 'quadratic') {
          const k = 0.5 * airDensity * dragCoefficient * area;
          ax += (-k * relSpeed * relX) * body.invMass;
          ay += (-k * relSpeed * relY) * body.invMass;
        } else {
          const b = 4 * airDensity * dragCoefficient * body.radius;
          ax += (-b * relX) * body.invMass;
          ay += (-b * relY) * body.invMass;
        }
      }
    }

    return new Vec2(ax, ay);
  }

  energyOf(body: Body): { ke: number; pe: number; total: number } {
    const ke = body.kineticEnergy;
    const pe = -body.mass * this.config.gravityY * body.position.y;
    return { ke, pe, total: ke + pe };
  }

  step(dt: number): void {
    if (dt <= 0) return;

    const substeps = this.computeSubsteps(dt);
    const h = dt / substeps;
    for (let i = 0; i < substeps; i++) {
      this.substep(h);
    }
    this.time += dt;
    this.updateTraces();
  }

  /**
   * Integra exactamente un paso, sin subdividir ni resolver colisiones.
   * Se usa en el análisis de convergencia para comparar integradores con
   * pasos controlados.
   */
  stepExact(dt: number): void {
    for (const body of this.bodies) {
      this.integrate(body, dt);
    }
    this.time += dt;
  }

  private computeSubsteps(dt: number): number {
    let maxSpeed = 0;
    let minRadius = Infinity;
    for (const body of this.bodies) {
      maxSpeed = Math.max(maxSpeed, body.speed);
      minRadius = Math.min(minRadius, body.radius);
    }
    if (!Number.isFinite(minRadius)) return 1;
    const travelled = maxSpeed * dt;
    const budget = Math.max(minRadius * 0.45, 0.02);
    return Math.max(1, Math.min(MAX_SUBSTEPS, Math.ceil(travelled / budget)));
  }

  private substep(h: number): void {
    for (const body of this.bodies) {
      this.integrate(body, h);
    }

    const contacts = this.buildContacts();
    this.contacts = contacts;

    for (let iteration = 0; iteration < 3; iteration++) {
      for (const contact of contacts) {
        resolveContact(contact);
      }
    }
    for (const contact of contacts) {
      correctContact(contact);
    }
  }

  private integrate(body: Body, h: number): void {
    const mode = this.config.integrator;

    if (mode === 'rk4') {
      this.integrateRk4(body, h);
      return;
    }

    const accel = this.acceleration(body, body.velocity.x, body.velocity.y);

    if (mode === 'explicit') {
      body.position.x += body.velocity.x * h;
      body.position.y += body.velocity.y * h;
      body.angle += body.angularVelocity * h;
      body.velocity.x += accel.x * h;
      body.velocity.y += accel.y * h;
    } else {
      body.velocity.x += accel.x * h;
      body.velocity.y += accel.y * h;
      body.position.x += body.velocity.x * h;
      body.position.y += body.velocity.y * h;
      body.angle += body.angularVelocity * h;
    }

    this.applyAngularDamping(body, h);
  }

  private integrateRk4(body: Body, h: number): void {
    const state = [
      body.position.x,
      body.position.y,
      body.velocity.x,
      body.velocity.y,
      body.angle,
      body.angularVelocity,
    ];

    const derivative = (s: number[]): number[] => {
      const accel = this.acceleration(body, s[2], s[3]);
      return [
        s[2],
        s[3],
        accel.x,
        accel.y,
        s[5],
        -body.rollingResistance * s[5],
      ];
    };

    const add = (s: number[], k: number[], scale: number): number[] =>
      s.map((value, i) => value + k[i] * scale);

    const k1 = derivative(state);
    const k2 = derivative(add(state, k1, h / 2));
    const k3 = derivative(add(state, k2, h / 2));
    const k4 = derivative(add(state, k3, h));

    for (let i = 0; i < state.length; i++) {
      state[i] += (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    }

    body.position.x = state[0];
    body.position.y = state[1];
    body.velocity.x = state[2];
    body.velocity.y = state[3];
    body.angle = state[4];
    body.angularVelocity = state[5];
  }

  private applyAngularDamping(body: Body, h: number): void {
    body.angularVelocity /= 1 + body.rollingResistance * h;
  }

  private buildContacts(): Contact[] {
    const contacts: Contact[] = [];
    const bodies = this.bodies;

    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      for (let j = i + 1; j < bodies.length; j++) {
        const contact = circleCircle(a, bodies[j]);
        if (contact) contacts.push(contact);
      }
      for (const segment of this.segments) {
        const contact = circleSegment(a, segment);
        if (contact) contacts.push(contact);
      }
    }

    return contacts;
  }

  private updateTraces(): void {
    for (const body of this.bodies) {
      if (body.position.sub(body.lastTracePoint).length() < TRACE_MIN_DISTANCE) continue;
      body.trace.push(body.position.clone());
      body.lastTracePoint = body.position.clone();
      if (body.trace.length > MAX_TRACE_POINTS) {
        body.trace.splice(0, body.trace.length - MAX_TRACE_POINTS);
      }
    }
  }

  /** Trayectoria prevista sin colisiones, para el slingshot. */
  predictTrajectory(
    start: Vec2,
    velocity: Vec2,
    radius: number,
    mass: number,
    duration = 2.6,
  ): Vec2[] {
    const ghost = new Body({
      position: start.clone(),
      velocity: velocity.clone(),
      radius,
      mass,
      restitution: 0,
      friction: 0,
      rollingResistance: 0,
    });

    const h = 1 / 240;
    const steps = Math.ceil(duration / h);
    const points: Vec2[] = [ghost.position.clone()];

    for (let i = 0; i < steps; i++) {
      const accel = this.acceleration(ghost, ghost.velocity.x, ghost.velocity.y);
      ghost.velocity = ghost.velocity.add(accel.mul(h));
      ghost.position = ghost.position.add(ghost.velocity.mul(h));
      if (i % 3 === 0) points.push(ghost.position.clone());
      if (ghost.position.y < -1 || ghost.position.x < -2 || ghost.position.x > 24) break;
    }

    return points;
  }
}
