import { Vec2 } from './vec2';
import type { Series } from './derivative';
import { sampleSeries } from './derivative';

export type QuadratureMethod = 'left' | 'right' | 'midpoint' | 'trapezoid' | 'simpson';

export const QUADRATURE_LABELS: Record<QuadratureMethod, string> = {
  left: 'Riemann izquierda',
  right: 'Riemann derecha',
  midpoint: 'Punto medio',
  trapezoid: 'Trapecio',
  simpson: 'Simpson',
};

/**
 * Integral definida de una función analítica mediante cuadratura compuesta.
 * Simpson necesita un número par de subintervalos; se ajusta automáticamente.
 */
export function integrateFunction(
  f: (x: number) => number,
  a: number,
  b: number,
  n: number,
  method: QuadratureMethod,
): number {
  const intervals = Math.max(1, Math.floor(n));
  if (b === a) return 0;
  if (b < a) return -integrateFunction(f, b, a, intervals, method);

  const h = (b - a) / intervals;

  switch (method) {
    case 'left': {
      let sum = 0;
      for (let i = 0; i < intervals; i++) sum += f(a + i * h);
      return sum * h;
    }
    case 'right': {
      let sum = 0;
      for (let i = 1; i <= intervals; i++) sum += f(a + i * h);
      return sum * h;
    }
    case 'midpoint': {
      let sum = 0;
      for (let i = 0; i < intervals; i++) sum += f(a + (i + 0.5) * h);
      return sum * h;
    }
    case 'trapezoid': {
      let sum = 0.5 * (f(a) + f(b));
      for (let i = 1; i < intervals; i++) sum += f(a + i * h);
      return sum * h;
    }
    case 'simpson': {
      const m = intervals + (intervals % 2);
      const hh = (b - a) / m;
      let sum = f(a) + f(b);
      for (let i = 1; i < m; i++) {
        sum += f(a + i * hh) * (i % 2 === 0 ? 2 : 4);
      }
      return (sum * hh) / 3;
    }
  }
}

/** Integral de una serie temporal muestreada (interpolación lineal). */
export function integrateSeries(
  series: Series,
  a: number,
  b: number,
  n: number,
  method: QuadratureMethod,
): number {
  return integrateFunction((t) => sampleSeries(series, t), a, b, n, method);
}

/** Longitud de una polilínea. */
export function pathLength(points: Vec2[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

/** Regresión lineal y = pendiente·x + intercepto sobre puntos (x, y). */
export function linearRegression(points: { x: number; y: number }[]): {
  slope: number;
  intercept: number;
} {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: 0 };
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
    sxx += p.x * p.x;
    sxy += p.x * p.y;
  }
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-15) return { slope: 0, intercept: 0 };
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}
