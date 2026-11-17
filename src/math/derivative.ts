/**
 * Herramientas de derivación numérica sobre series temporales registradas y
 * sobre funciones analíticas de prueba.
 */

export interface Series {
  t: number[];
  y: number[];
}

/** Interpolación lineal de una serie en el instante t (extremos incluidos). */
export function sampleSeries(series: Series, t: number): number {
  const { t: ts, y: ys } = series;
  const n = ts.length;
  if (n === 0) return 0;
  if (n === 1) return ys[0];
  if (t <= ts[0]) return ys[0];
  if (t >= ts[n - 1]) return ys[n - 1];

  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ts[mid] <= t) lo = mid;
    else hi = mid;
  }
  const span = ts[hi] - ts[lo];
  if (span <= 1e-12) return ys[hi];
  const u = (t - ts[lo]) / span;
  return ys[lo] + (ys[hi] - ys[lo]) * u;
}

/** Derivada central de una serie: [f(t+h) - f(t-h)] / 2h. */
export function centralDifference(series: Series, t: number, h: number): number {
  return (sampleSeries(series, t + h) - sampleSeries(series, t - h)) / (2 * h);
}

/**
 * Error medio absoluto de la derivada central de `f` frente a `df` para un
 * conjunto de pasos h. Es la base de la curva en U: truncamiento a la
 * izquierda, redondeo por coma flotante a la derecha.
 */
export function derivativeErrorVsH(
  f: (t: number) => number,
  df: (t: number) => number,
  hs: number[],
  range: [number, number] = [0.5, 2.5],
  samples = 40,
): { h: number; err: number }[] {
  const maxH = Math.max(...hs);
  const a = Math.max(range[0], -Infinity) + maxH;
  const b = Math.min(range[1], Infinity) - maxH;
  const result: { h: number; err: number }[] = [];

  if (b <= a) return result;

  for (const h of hs) {
    let sum = 0;
    for (let i = 0; i < samples; i++) {
      const t = a + ((b - a) * i) / (samples - 1);
      const numeric = (f(t + h) - f(t - h)) / (2 * h);
      sum += Math.abs(numeric - df(t));
    }
    result.push({ h, err: sum / samples });
  }
  return result;
}

export interface TestFunction {
  id: string;
  label: string;
  f: (t: number) => number;
  df: (t: number) => number;
  range: [number, number];
}

export const TEST_FUNCTIONS: TestFunction[] = [
  {
    id: 'sin',
    label: 'sin(t)',
    f: (t) => Math.sin(t),
    df: (t) => Math.cos(t),
    range: [0.5, 2.5],
  },
  {
    id: 'quadratic',
    label: 't²',
    f: (t) => t * t,
    df: (t) => 2 * t,
    range: [0.5, 2.5],
  },
  {
    id: 'exp',
    label: 'e^(−t)',
    f: (t) => Math.exp(-t),
    df: (t) => -Math.exp(-t),
    range: [0.5, 2.5],
  },
  {
    id: 'log',
    label: 'ln(1 + t)',
    f: (t) => Math.log(1 + t),
    df: (t) => 1 / (1 + t),
    range: [0.5, 2.5],
  },
];
