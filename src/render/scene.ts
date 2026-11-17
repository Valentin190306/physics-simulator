import { Vec2 } from '../math/vec2';
import type { World } from '../physics/world';
import { Camera } from './camera';
import { drawArrow, prepareCanvas } from './canvas';

export interface DragState {
  start: Vec2;
  current: Vec2;
  speed: number;
}

export interface SceneOptions {
  selectedId: number | null;
  showTraces: boolean;
  showVectors: boolean;
  showContacts: boolean;
  drag: DragState | null;
  ghost: Vec2[] | null;
}

const COLORS = {
  bgTop: '#0a1020',
  bgBottom: '#121e38',
  grid: 'rgba(90, 130, 190, 0.11)',
  gridMajor: 'rgba(90, 130, 190, 0.22)',
  shapeFill: '#1b2a4a',
  shapeStroke: '#3b5b8a',
  velocity: '#80ed99',
  acceleration: '#ff8fab',
  contact: '#ffd166',
  ghost: 'rgba(76, 201, 240, 0.65)',
  selection: '#ffffff',
};

export function renderScene(
  canvas: HTMLCanvasElement,
  world: World,
  camera: Camera,
  options: SceneOptions,
): void {
  const prepared = prepareCanvas(canvas);
  if (!prepared) return;
  const { ctx, width, height } = prepared;
  camera.fit(width, height);

  const background = ctx.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, COLORS.bgTop);
  background.addColorStop(1, COLORS.bgBottom);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  drawGrid(ctx, camera, width, height);
  drawShapes(ctx, world, camera, width, height);
  if (options.showTraces) drawTraces(ctx, world, camera, width, height, options.selectedId);
  drawBodies(ctx, world, camera, width, height, options.selectedId);
  if (options.showVectors) drawVectors(ctx, world, camera, width, height, options.selectedId);
  if (options.showContacts) drawContacts(ctx, world, camera, width, height);
  if (options.drag && options.ghost) drawGhost(ctx, options.drag, options.ghost, camera, width, height);
  drawScaleBar(ctx, camera, height);
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  width: number,
  height: number,
): void {
  const bounds = camera.visibleBounds(width, height);
  const step = camera.ppm > 70 ? 0.5 : camera.ppm > 26 ? 1 : 5;
  const major = step * 5;

  const startX = Math.floor(bounds.minX / step) * step;
  const startY = Math.floor(bounds.minY / step) * step;

  ctx.lineWidth = 1;
  for (let x = startX; x <= bounds.maxX; x += step) {
    const sx = camera.worldToScreen(x, 0, width, height).x;
    const isMajor = Math.abs(x / major - Math.round(x / major)) < 1e-6;
    ctx.strokeStyle = isMajor ? COLORS.gridMajor : COLORS.grid;
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, height);
    ctx.stroke();
  }
  for (let y = startY; y <= bounds.maxY; y += step) {
    const sy = camera.worldToScreen(0, y, width, height).y;
    const isMajor = Math.abs(y / major - Math.round(y / major)) < 1e-6;
    ctx.strokeStyle = isMajor ? COLORS.gridMajor : COLORS.grid;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(width, sy);
    ctx.stroke();
  }
}

function drawShapes(
  ctx: CanvasRenderingContext2D,
  world: World,
  camera: Camera,
  width: number,
  height: number,
): void {
  for (const shape of world.shapes) {
    if (shape.points.length < 2) continue;
    ctx.beginPath();
    const first = camera.worldToScreen(shape.points[0].x, shape.points[0].y, width, height);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < shape.points.length; i++) {
      const point = camera.worldToScreen(shape.points[i].x, shape.points[i].y, width, height);
      ctx.lineTo(point.x, point.y);
    }
    ctx.closePath();
    ctx.fillStyle = shape.fill;
    ctx.fill();
    ctx.strokeStyle = shape.stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawTraces(
  ctx: CanvasRenderingContext2D,
  world: World,
  camera: Camera,
  width: number,
  height: number,
  selectedId: number | null,
): void {
  for (const body of world.bodies) {
    if (body.trace.length < 2) continue;
    const selected = body.id === selectedId;
    ctx.save();
    ctx.globalAlpha = selected ? 0.8 : 0.3;
    ctx.strokeStyle = body.color;
    ctx.lineWidth = selected ? 2 : 1.3;
    ctx.beginPath();
    const first = camera.worldToScreen(body.trace[0].x, body.trace[0].y, width, height);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < body.trace.length; i++) {
      const point = camera.worldToScreen(body.trace[i].x, body.trace[i].y, width, height);
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function drawBodies(
  ctx: CanvasRenderingContext2D,
  world: World,
  camera: Camera,
  width: number,
  height: number,
  selectedId: number | null,
): void {
  for (const body of world.bodies) {
    const center = camera.worldToScreen(body.position.x, body.position.y, width, height);
    const radius = Math.max(2, body.radius * camera.ppm);

    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = body.color;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.stroke();

    // Radio que muestra el giro.
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(
      center.x + Math.cos(body.angle) * radius * 0.82,
      center.y - Math.sin(body.angle) * radius * 0.82,
    );
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (body.id === selectedId) {
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius + 5, 0, Math.PI * 2);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = COLORS.selection;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

function drawVectors(
  ctx: CanvasRenderingContext2D,
  world: World,
  camera: Camera,
  width: number,
  height: number,
  selectedId: number | null,
): void {
  const bodies = selectedId === null ? world.bodies : world.bodies.filter((b) => b.id === selectedId);
  for (const body of bodies) {
    const center = camera.worldToScreen(body.position.x, body.position.y, width, height);

    const velocityScale = 0.18;
    let vx = body.velocity.x * velocityScale;
    let vy = body.velocity.y * velocityScale;
    const vLength = Math.hypot(vx, vy);
    if (vLength > 4) {
      vx = (vx / vLength) * 4;
      vy = (vy / vLength) * 4;
    }
    if (vLength > 0.02) {
      drawArrow(ctx, center.x, center.y, center.x + vx * camera.ppm, center.y - vy * camera.ppm, COLORS.velocity, 2);
    }

    const accel = world.acceleration(body, body.velocity.x, body.velocity.y);
    const accelScale = 0.07;
    let ax = accel.x * accelScale;
    let ay = accel.y * accelScale;
    const aLength = Math.hypot(ax, ay);
    if (aLength > 3) {
      ax = (ax / aLength) * 3;
      ay = (ay / aLength) * 3;
    }
    if (aLength > 0.02) {
      drawArrow(ctx, center.x, center.y, center.x + ax * camera.ppm, center.y - ay * camera.ppm, COLORS.acceleration, 1.6);
    }
  }
}

function drawContacts(
  ctx: CanvasRenderingContext2D,
  world: World,
  camera: Camera,
  width: number,
  height: number,
): void {
  for (const contact of world.contacts) {
    const point = camera.worldToScreen(contact.point.x, contact.point.y, width, height);
    ctx.beginPath();
    ctx.arc(point.x, point.y, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.contact;
    ctx.fill();

    const normalEnd = contact.point.add(contact.normal.mul(0.35));
    const end = camera.worldToScreen(normalEnd.x, normalEnd.y, width, height);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.75)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
}

function drawGhost(
  ctx: CanvasRenderingContext2D,
  drag: DragState,
  ghost: Vec2[],
  camera: Camera,
  width: number,
  height: number,
): void {
  if (ghost.length > 1) {
    ctx.save();
    ctx.beginPath();
    const first = camera.worldToScreen(ghost[0].x, ghost[0].y, width, height);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < ghost.length; i++) {
      const point = camera.worldToScreen(ghost[i].x, ghost[i].y, width, height);
      ctx.lineTo(point.x, point.y);
    }
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = COLORS.ghost;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  const start = camera.worldToScreen(drag.start.x, drag.start.y, width, height);
  const current = camera.worldToScreen(drag.current.x, drag.current.y, width, height);

  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(current.x, current.y);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const dx = drag.start.x - drag.current.x;
  const dy = drag.start.y - drag.current.y;
  const length = Math.hypot(dx, dy);
  if (length > 0.02) {
    const unitX = dx / length;
    const unitY = dy / length;
    drawArrow(
      ctx,
      start.x,
      start.y,
      start.x + unitX * (0.6 + drag.speed * 0.05) * camera.ppm,
      start.y - unitY * (0.6 + drag.speed * 0.05) * camera.ppm,
      '#4cc9f0',
      2,
    );
  }

  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#cfe3ff';
  ctx.fillText(`v₀ = ${drag.speed.toFixed(1)} m/s`, current.x + 12, current.y - 10);
}

function drawScaleBar(ctx: CanvasRenderingContext2D, camera: Camera, height: number): void {
  const candidates = [0.5, 1, 2, 5, 10];
  let meters = candidates[0];
  for (const candidate of candidates) {
    const px = candidate * camera.ppm;
    if (px >= 45 && px <= 130) {
      meters = candidate;
      break;
    }
    if (px < 45) meters = candidate;
  }
  const px = meters * camera.ppm;
  const x = 18;
  const y = height - 20;

  ctx.strokeStyle = 'rgba(220, 235, 255, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + px, y);
  ctx.moveTo(x, y - 5);
  ctx.lineTo(x, y + 5);
  ctx.moveTo(x + px, y - 5);
  ctx.lineTo(x + px, y + 5);
  ctx.stroke();

  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(220, 235, 255, 0.8)';
  ctx.fillText(`${meters} m`, x, y - 9);
}
