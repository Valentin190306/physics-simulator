import { describe, expect, it } from 'vitest';
import {
  centralDifference,
  derivativeErrorVsH,
  sampleSeries,
  TEST_FUNCTIONS,
  type Series,
} from '../src/math/derivative';

describe('derivación numérica', () => {
  it('interpola linealmente una serie', () => {
    const series: Series = { t: [0, 1, 2], y: [0, 10, 20] };
    expect(sampleSeries(series, 0.5)).toBeCloseTo(5, 10);
    expect(sampleSeries(series, 1.5)).toBeCloseTo(15, 10);
    expect(sampleSeries(series, -1)).toBe(0);
    expect(sampleSeries(series, 5)).toBe(20);
  });

  it('aproxima la derivada de sin(t) con diferencia central', () => {
    const dt = 0.001;
    const t: number[] = [];
    const y: number[] = [];
    for (let i = 0; i <= 2000; i++) {
      const time = i * dt;
      t.push(time);
      y.push(Math.sin(time));
    }
    const series: Series = { t, y };
    const derivative = centralDifference(series, 1, 0.01);
    expect(derivative).toBeCloseTo(Math.cos(1), 3);
  });

  it('el error de la derivada crece con h grandes (truncamiento)', () => {
    const sin = TEST_FUNCTIONS[0];
    const hs = [1e-5, 1e-3, 0.1, 0.4];
    const points = derivativeErrorVsH(sin.f, sin.df, hs, sin.range, 20);
    const small = points.find((p) => p.h === 1e-3)?.err ?? 0;
    const large = points.find((p) => p.h === 0.4)?.err ?? 0;
    expect(large).toBeGreaterThan(small * 100);
  });
});
