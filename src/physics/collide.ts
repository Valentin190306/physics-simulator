import { Vec2 } from '../math/vec2';
import type { Body } from './body';
import { closestPointOnSegment, type Segment } from './geometry';

export interface Contact {
  /** Cuerpo dinámico. */
  a: Body;
  /** Segundo cuerpo dinámico, o null si el contacto es contra geometría estática. */
  b: Body | null;
  /** Normal unitaria que apunta de A hacia B. */
  normal: Vec2;
  penetration: number;
  /** Punto de contacto en coordenadas de mundo. */
  point: Vec2;
}

export function circleCircle(a: Body, b: Body): Contact | null {
  const delta = b.position.sub(a.position);
  const dist = delta.length();
  const radiusSum = a.radius + b.radius;
  if (dist >= radiusSum) return null;

  const normal = dist > 1e-9 ? delta.mul(1 / dist) : new Vec2(1, 0);
  const penetration = radiusSum - dist;
  const point = a.position.add(normal.mul(a.radius - penetration / 2));
  return { a, b, normal, penetration, point };
}

export function circleSegment(body: Body, segment: Segment): Contact | null {
  const { point, dist } = closestPointOnSegment(body.position, segment.a, segment.b);
  if (dist >= body.radius) return null;

  let normal: Vec2;
  let penetration: number;

  if (dist > 1e-9) {
    // De la superficie hacia el centro del círculo; el contacto apunta al revés.
    const towardSurface = point.sub(body.position).mul(1 / dist);
    normal = towardSurface;
    penetration = body.radius - dist;
  } else {
    // Centro justo sobre la arista: usar la normal del segmento hacia el centro.
    const edge = segment.b.sub(segment.a);
    let n = edge.perp().normalize();
    if (n.dot(body.position.sub(segment.a)) < 0) n = n.mul(-1);
    normal = n.mul(-1);
    penetration = body.radius;
  }

  return { a: body, b: null, normal, penetration, point };
}
