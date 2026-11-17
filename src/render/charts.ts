import { prepareCanvas } from './canvas';

export interface ChartSeries {
  x: number[];
  y: number[];
  color: string;
  label: string;
  width?: number;
  dash?: number[];
}

export interface ChartReferenceLine {
  y: number;
  color: string;
  label?: string;
  dash?: number[];
}

export interface ChartOptions {
  series: ChartSeries[];
  xLabel?: string;
  yLabel?: string;
  xRange?: [number, number];
  yRange?: [number, number];
  logX?: boolean;
  logY?: boolean;
  referenceLines?: ChartReferenceLine[];
  emptyMessage?: string;
}

const STYLE = {
  bg: '#0d1426',
  plot: '#0a101e',
  grid: 'rgba(100, 140, 200, 0.16)',
  axis: 'rgba(150, 180, 220, 0.45)',
  text: '#8fa3c8',
  title: '#cfe3ff',
};

const MARGIN = { left: 52, right: 16, top: 30, bottom: 34 };

function extent(values: number[]): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  return [min, max];
}

function niceStep(span: number, count: number): number {
  if (span <= 0) return 1;
  const raw = span / count;
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / power;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * power;
}

function formatValue(value: number, span: number): string {
  if (!Number.isFinite(value)) return '';
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 10000 || abs < 0.001) return value.toExponential(1);
  const decimals = Math.max(0, Math.min(3, 2 - Math.floor(Math.log10(span))));
  return value.toFixed(decimals);
}

function formatLogTick(value: number): string {
  if (value >= 1000 || value < 0.001) return value.toExponential(0);
  const decimals = Math.max(0, -Math.floor(Math.log10(value)));
  return value.toFixed(Math.min(decimals, 4));
}

function logTicks(min: number, max: number): number[] {
  const start = Math.floor(Math.log10(min));
  const end = Math.floor(Math.log10(max));
  const decades = end - start + 1;
  const multipliers = decades <= 3 ? [1, 2, 5] : [1];
  const values: number[] = [];
  for (let power = start; power <= end; power++) {
    for (const multiplier of multipliers) {
      const value = multiplier * Math.pow(10, power);
      if (value >= min * 0.999 && value <= max * 1.001) values.push(value);
    }
  }
  return values;
}

function seriesDomain(
  series: ChartSeries[],
  key: 'x' | 'y',
  forced: [number, number] | undefined,
  log: boolean,
): [number, number] {
  if (forced) return forced;
  const values: number[] = [];
  for (const s of series) {
    for (const value of s[key]) {
      if (!log || value > 0) values.push(value);
    }
  }
  let [min, max] = extent(values);
  if (log) {
    min = Math.max(min, 1e-12);
    if (min === max) max = min * 10;
    return [min, max];
  }
  if (min === max) {
    const pad = Math.max(Math.abs(min) * 0.1, 1);
    return [min - pad, max + pad];
  }
  const pad = (max - min) * 0.06;
  return [min - pad, max + pad];
}

export function drawChart(canvas: HTMLCanvasElement, options: ChartOptions): void {
  const prepared = prepareCanvas(canvas);
  if (!prepared) return;
  const { ctx, width, height } = prepared;

  ctx.fillStyle = STYLE.bg;
  ctx.fillRect(0, 0, width, height);

  const hasData = options.series.some((s) => s.x.length > 1);
  const plot = {
    x: MARGIN.left,
    y: MARGIN.top,
    width: Math.max(10, width - MARGIN.left - MARGIN.right),
    height: Math.max(10, height - MARGIN.top - MARGIN.bottom),
  };

  const domainX = seriesDomain(options.series, 'x', options.xRange, Boolean(options.logX));
  let domainY = seriesDomain(options.series, 'y', options.yRange, Boolean(options.logY));
  if (options.logY) domainY = [Math.max(domainY[0], 1e-12), Math.max(domainY[1], domainY[0] * 10)];
  if (options.logX) {
    const xd = [Math.max(domainX[0], 1e-12), Math.max(domainX[1], domainX[0] * 10)] as [number, number];
    domainX[0] = xd[0];
    domainX[1] = xd[1];
  }

  const logMinX = Math.log10(domainX[0]);
  const logMaxX = Math.log10(domainX[1]);
  const logMinY = Math.log10(domainY[0]);
  const logMaxY = Math.log10(domainY[1]);

  const mapX = (value: number): number => {
    if (options.logX) return plot.x + ((Math.log10(value) - logMinX) / (logMaxX - logMinX)) * plot.width;
    return plot.x + ((value - domainX[0]) / (domainX[1] - domainX[0])) * plot.width;
  };
  const mapY = (value: number): number => {
    if (options.logY) return plot.y + plot.height - ((Math.log10(value) - logMinY) / (logMaxY - logMinY)) * plot.height;
    return plot.y + plot.height - ((value - domainY[0]) / (domainY[1] - domainY[0])) * plot.height;
  };

  // Fondo del área de trazado.
  ctx.fillStyle = STYLE.plot;
  ctx.fillRect(plot.x, plot.y, plot.width, plot.height);

  // Rejilla y etiquetas.
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillStyle = STYLE.text;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  if (options.logY) {
    for (const value of logTicks(domainY[0], domainY[1])) {
      const y = mapY(value);
      ctx.strokeStyle = STYLE.grid;
      ctx.beginPath();
      ctx.moveTo(plot.x, y);
      ctx.lineTo(plot.x + plot.width, y);
      ctx.stroke();
      ctx.fillText(formatLogTick(value), plot.x - 6, y);
    }
  } else {
    const step = niceStep(domainY[1] - domainY[0], 5);
    const start = Math.ceil(domainY[0] / step) * step;
    for (let value = start; value <= domainY[1] + step * 0.01; value += step) {
      const y = mapY(value);
      ctx.strokeStyle = STYLE.grid;
      ctx.beginPath();
      ctx.moveTo(plot.x, y);
      ctx.lineTo(plot.x + plot.width, y);
      ctx.stroke();
      ctx.fillText(formatValue(value, domainY[1] - domainY[0]), plot.x - 6, y);
    }
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  if (options.logX) {
    for (const value of logTicks(domainX[0], domainX[1])) {
      const x = mapX(value);
      ctx.strokeStyle = STYLE.grid;
      ctx.beginPath();
      ctx.moveTo(x, plot.y);
      ctx.lineTo(x, plot.y + plot.height);
      ctx.stroke();
      ctx.fillText(formatLogTick(value), x, plot.y + plot.height + 6);
    }
  } else {
    const step = niceStep(domainX[1] - domainX[0], 6);
    const start = Math.ceil(domainX[0] / step) * step;
    for (let value = start; value <= domainX[1] + step * 0.01; value += step) {
      const x = mapX(value);
      ctx.strokeStyle = STYLE.grid;
      ctx.beginPath();
      ctx.moveTo(x, plot.y);
      ctx.lineTo(x, plot.y + plot.height);
      ctx.stroke();
      ctx.fillText(formatValue(value, domainX[1] - domainX[0]), x, plot.y + plot.height + 6);
    }
  }

  // Líneas de referencia horizontales.
  if (options.referenceLines) {
    for (const line of options.referenceLines) {
      if (!Number.isFinite(line.y)) continue;
      const y = mapY(line.y);
      if (y < plot.y || y > plot.y + plot.height) continue;
      ctx.save();
      ctx.setLineDash(line.dash ?? [5, 5]);
      ctx.strokeStyle = line.color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(plot.x, y);
      ctx.lineTo(plot.x + plot.width, y);
      ctx.stroke();
      ctx.restore();
      if (line.label) {
        ctx.fillStyle = line.color;
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(line.label, plot.x + plot.width - 4, y - 3);
      }
    }
  }

  // Series.
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.x, plot.y, plot.width, plot.height);
  ctx.clip();
  for (const s of options.series) {
    if (s.x.length < 2) continue;
    ctx.beginPath();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width ?? 1.8;
    ctx.setLineDash(s.dash ?? []);
    let started = false;
    for (let i = 0; i < s.x.length; i++) {
      const xv = s.x[i];
      const yv = s.y[i];
      if (!Number.isFinite(xv) || !Number.isFinite(yv)) continue;
      if ((options.logX && xv <= 0) || (options.logY && yv <= 0)) continue;
      const px = mapX(xv);
      const py = mapY(yv);
      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
  }
  ctx.restore();
  ctx.setLineDash([]);

  // Leyenda.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '10px system-ui, sans-serif';
  let legendX = plot.x;
  const legendY = 15;
  const legendLimit = plot.x + plot.width;
  for (const s of options.series) {
    if (s.x.length < 1) continue;
    const available = legendLimit - (legendX + 18);
    if (available < 24) break;

    let label = s.label;
    if (ctx.measureText(label).width > available) {
      while (label.length > 2 && ctx.measureText(`${label}…`).width > available) {
        label = label.slice(0, -1);
      }
      label = `${label}…`;
    }

    ctx.strokeStyle = s.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(legendX, legendY);
    ctx.lineTo(legendX + 14, legendY);
    ctx.stroke();
    ctx.fillStyle = STYLE.title;
    ctx.fillText(label, legendX + 18, legendY);
    legendX += 18 + ctx.measureText(label).width + 14;
  }

  if (!hasData) {
    ctx.fillStyle = STYLE.text;
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(options.emptyMessage ?? 'Sin datos todavía', plot.x + plot.width / 2, plot.y + plot.height / 2);
  }

  // Etiquetas de ejes.
  ctx.fillStyle = STYLE.text;
  ctx.font = '10px system-ui, sans-serif';
  if (options.yLabel) {
    ctx.save();
    ctx.translate(11, plot.y + plot.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(options.yLabel, 0, 0);
    ctx.restore();
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  if (options.xLabel) ctx.fillText(options.xLabel, plot.x + plot.width, plot.y + plot.height + 26);
}

