import { Vec2 } from '../math/vec2';

export interface Segment {
  a: Vec2;
  b: Vec2;
}

export interface StaticShape {
  points: Vec2[];
  segments: Segment[];
  fill: string;
  stroke: string;
}

export interface ShapeStyle {
  fill?: string;
  stroke?: string;
}

function segmentsFromPoints(points: Vec2[]): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i < points.length; i++) {
    segments.push({ a: points[i], b: points[(i + 1) % points.length] });
  }
  return segments;
}

export function polyShape(points: Vec2[], style: ShapeStyle = {}): StaticShape {
  return {
    points,
    segments: segmentsFromPoints(points),
    fill: style.fill ?? '#1b2a4a',
    stroke: style.stroke ?? '#3b5b8a',
  };
}

/** Rectángulo centrado en (cx, cy). */
export function rectShape(
  cx: number,
  cy: number,
  width: number,
  height: number,
  style: ShapeStyle = {},
): StaticShape {
  const hw = width / 2;
  const hh = height / 2;
  return polyShape(
    [
      new Vec2(cx - hw, cy - hh),
      new Vec2(cx + hw, cy - hh),
      new Vec2(cx + hw, cy + hh),
      new Vec2(cx - hw, cy + hh),
    ],
    style,
  );
}

/** Cuña triangular: superficie superior de A a B y relleno hasta el suelo. */
export function wedgeShape(a: Vec2, b: Vec2, baseY = 0, style: ShapeStyle = {}): StaticShape {
  return polyShape([a.clone(), b.clone(), new Vec2(b.x, baseY), new Vec2(a.x, baseY)], style);
}

/** Altura a la que llegan las paredes laterales: a efectos prácticos, infinito. */
const WALL_TOP = 1e4;

/** Marco del mundo: suelo, paredes izquierda y derecha (las paredes suben hasta WALL_TOP). */
export function frameShapes(width = 20): StaticShape[] {
  const wallBottom = -2;
  const wallHeight = WALL_TOP - wallBottom;
  const wallCy = (WALL_TOP + wallBottom) / 2;
  return [
    rectShape(width / 2, -0.5, width + 2, 1),
    rectShape(-0.5, wallCy, 1, wallHeight),
    rectShape(width + 0.5, wallCy, 1, wallHeight),
  ];
}

export function closestPointOnSegment(
  p: Vec2,
  a: Vec2,
  b: Vec2,
): { point: Vec2; t: number; dist: number } {
  const ab = b.sub(a);
  const denom = ab.lengthSq();
  const t = denom > 1e-12 ? Math.min(1, Math.max(0, p.sub(a).dot(ab) / denom)) : 0;
  const point = a.add(ab.mul(t));
  return { point, t, dist: point.sub(p).length() };
}
