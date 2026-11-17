import { describe, expect, it } from 'vitest';
import { integrateFunction, integrateSeries, linearRegression } from '../src/math/integral';

const exact = 1 / 3;
const f = (x: number) => x * x;

describe('integración numérica', () => {
  it('Simpson converge rápido en un polinomio', () => {
    const value = integrateFunction(f, 0, 1, 10, 'simpson');
    expect(value).toBeCloseTo(exact, 12);
  });

  it('trapecio converge como O(h²)', () => {
    const error = Math.abs(integrateFunction(f, 0, 1, 100, 'trapezoid') - exact);
    expect(error).toBeLessThan(2e-5);
  });

  it('Riemann izquierda y derecha acotan la integral', () => {
    const left = integrateFunction(f, 0, 1, 100, 'left');
    const right = integrateFunction(f, 0, 1, 100, 'right');
    expect(left).toBeLessThan(exact);
    expect(right).toBeGreaterThan(exact);
    expect(exact - left).toBeLessThan(0.01);
    expect(right - exact).toBeLessThan(0.01);
  });

  it('Simpson ajusta n impar a par', () => {
    const odd = integrateFunction(f, 0, 1, 5, 'simpson');
    expect(odd).toBeCloseTo(exact, 6);
  });

  it('integra una serie temporal muestreada', () => {
    const t: number[] = [];
    const y: number[] = [];
    for (let i = 0; i <= 1000; i++) {
      const x = i / 1000;
      t.push(x);
      y.push(x * x);
    }
    const value = integrateSeries({ t, y }, 0, 1, 200, 'simpson');
    expect(value).toBeCloseTo(exact, 4);
  });

  it('la regresión lineal recupera la pendiente', () => {
    const points = [
      { x: 0, y: 1 },
      { x: 1, y: 3 },
      { x: 2, y: 5 },
      { x: 3, y: 7 },
    ];
    const result = linearRegression(points);
    expect(result.slope).toBeCloseTo(2, 10);
    expect(result.intercept).toBeCloseTo(1, 10);
  });
});
