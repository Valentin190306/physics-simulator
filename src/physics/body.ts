import { Vec2 } from '../math/vec2';

let nextId = 1;

export interface BodyOptions {
  position: Vec2;
  velocity?: Vec2;
  radius?: number;
  mass?: number;
  restitution?: number;
  friction?: number;
  rollingResistance?: number;
  color?: string;
  angle?: number;
  angularVelocity?: number;
}

const PALETTE = ['#4cc9f0', '#f72585', '#ffd166', '#80ed99', '#b388ff', '#ff8fab', '#4dd4ac'];

export class Body {
  readonly id: number;
  position: Vec2;
  velocity: Vec2;
  angle: number;
  angularVelocity: number;
  radius: number;
  mass: number;
  invMass: number;
  inertia: number;
  invInertia: number;
  restitution: number;
  friction: number;
  rollingResistance: number;
  color: string;

  /** Rastro visual de la trayectoria. */
  trace: Vec2[] = [];
  lastTracePoint: Vec2;

  constructor(opts: BodyOptions) {
    this.id = nextId++;
    this.position = opts.position.clone();
    this.velocity = (opts.velocity ?? Vec2.zero()).clone();
    this.angle = opts.angle ?? 0;
    this.angularVelocity = opts.angularVelocity ?? 0;
    this.radius = opts.radius ?? 0.28;
    this.mass = Math.max(0.01, opts.mass ?? 1);
    this.invMass = 1 / this.mass;
    this.inertia = 0.5 * this.mass * this.radius * this.radius;
    this.invInertia = 1 / this.inertia;
    this.restitution = opts.restitution ?? 0.7;
    this.friction = opts.friction ?? 0.35;
    this.rollingResistance = opts.rollingResistance ?? 0.45;
    this.color = opts.color ?? PALETTE[(this.id - 1) % PALETTE.length];
    this.lastTracePoint = this.position.clone();
    this.trace.push(this.position.clone());
  }

  get speed(): number {
    return this.velocity.length();
  }

  get kineticEnergy(): number {
    return 0.5 * this.mass * this.velocity.lengthSq() + 0.5 * this.inertia * this.angularVelocity ** 2;
  }

  resetTrace(): void {
    this.trace = [this.position.clone()];
    this.lastTracePoint = this.position.clone();
  }
}

export const BODY_COLORS = PALETTE;
