import { Vec2, clamp, cross, crossSV } from '../math/vec2';
import type { Body } from './body';
import type { Contact } from './collide';

const RESTITUTION_THRESHOLD = 0.6;
const POSITION_SLOP = 0.01;
const POSITION_PERCENT = 0.45;

function inverseMassTerm(body: Body | null, r: Vec2, n: Vec2): number {
  if (!body) return 0;
  const rn = cross(r, n);
  return body.invMass + rn * rn * body.invInertia;
}

function relativeVelocity(a: Body, b: Body | null, rA: Vec2, rB: Vec2): Vec2 {
  const va = a.velocity.add(crossSV(a.angularVelocity, rA));
  if (!b) return va.mul(-1);
  const vb = b.velocity.add(crossSV(b.angularVelocity, rB));
  return vb.sub(va);
}

function applyImpulse(body: Body | null, direction: Vec2, magnitude: number, r: Vec2): void {
  if (!body) return;
  const impulse = direction.mul(magnitude);
  body.velocity = body.velocity.add(impulse.mul(body.invMass));
  body.angularVelocity += body.invInertia * cross(r, impulse);
}

/**
 * Resuelve un contacto con impulso normal + fricción de Coulomb.
 * Se puede llamar varias veces por paso para aproximar un solver iterativo.
 */
export function resolveContact(contact: Contact): void {
  const { a, b, normal, point } = contact;
  const rA = point.sub(a.position);
  const rB = b ? point.sub(b.position) : Vec2.zero();

  const rv = relativeVelocity(a, b, rA, rB);
  const normalVelocity = rv.dot(normal);
  if (normalVelocity > 0) return; // se están separando

  const restitution = Math.min(a.restitution, b ? b.restitution : 1);
  const e = -normalVelocity < RESTITUTION_THRESHOLD ? 0 : restitution;

  const kNormal =
    inverseMassTerm(a, rA, normal) + inverseMassTerm(b, rB, normal);
  if (kNormal <= 1e-12) return;

  const jn = (-(1 + e) * normalVelocity) / kNormal;
  if (jn <= 0) return;

  applyImpulse(a, normal, -jn, rA);
  applyImpulse(b, normal, jn, rB);

  // Fricción: impulso tangencial acotado por la ley de Coulomb.
  const rv2 = relativeVelocity(a, b, rA, rB);
  const tangentialVelocity = rv2.sub(normal.mul(rv2.dot(normal)));
  const tangentLength = tangentialVelocity.length();
  if (tangentLength < 1e-7) return;

  const tangent = tangentialVelocity.mul(1 / tangentLength);
  const kTangent =
    inverseMassTerm(a, rA, tangent) + inverseMassTerm(b, rB, tangent);
  if (kTangent <= 1e-12) return;

  const mu = Math.sqrt(a.friction * (b ? b.friction : 1));
  const jt = clamp(-rv2.dot(tangent) / kTangent, -mu * jn, mu * jn);

  applyImpulse(a, tangent, -jt, rA);
  applyImpulse(b, tangent, jt, rB);
}

/** Corrección posicional tipo Baumgarte para sacar los cuerpos de la penetración. */
export function correctContact(contact: Contact): void {
  const { a, b, normal, penetration } = contact;
  const invSum = a.invMass + (b ? b.invMass : 0);
  if (invSum <= 1e-12 || penetration <= POSITION_SLOP) return;

  const correction = ((penetration - POSITION_SLOP) * POSITION_PERCENT) / invSum;
  a.position = a.position.sub(normal.mul(correction * a.invMass));
  if (b) b.position = b.position.add(normal.mul(correction * b.invMass));
}
