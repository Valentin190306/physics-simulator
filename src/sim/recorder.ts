import type { Body } from '../physics/body';
import type { World } from '../physics/world';

export interface RecordedFrame {
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  ax: number;
  ay: number;
  ke: number;
  pe: number;
  energy: number;
}

const CAPACITY = 3600;

/** Registro temporal del cuerpo seleccionado para gráficas y cálculo. */
export class Recorder {
  frames: RecordedFrame[] = [];
  bodyId: number | null = null;

  clear(bodyId: number | null = null): void {
    this.frames = [];
    this.bodyId = bodyId;
  }

  record(world: World, body: Body): void {
    if (this.bodyId !== body.id) {
      this.clear(body.id);
    }

    const accel = world.acceleration(body, body.velocity.x, body.velocity.y);
    const energy = world.energyOf(body);

    this.frames.push({
      t: world.time,
      x: body.position.x,
      y: body.position.y,
      vx: body.velocity.x,
      vy: body.velocity.y,
      speed: body.speed,
      ax: accel.x,
      ay: accel.y,
      ke: energy.ke,
      pe: energy.pe,
      energy: energy.total,
    });

    if (this.frames.length > CAPACITY) {
      this.frames.splice(0, 240);
    }
  }

  get latest(): RecordedFrame | null {
    return this.frames.length ? this.frames[this.frames.length - 1] : null;
  }

  series(key: 'x' | 'y' | 'vx' | 'vy' | 'speed' | 'ax' | 'ay' | 'ke' | 'pe' | 'energy'): {
    t: number[];
    y: number[];
  } {
    const t = new Array<number>(this.frames.length);
    const y = new Array<number>(this.frames.length);
    for (let i = 0; i < this.frames.length; i++) {
      t[i] = this.frames[i].t;
      y[i] = this.frames[i][key];
    }
    return { t, y };
  }

  timeRange(): [number, number] {
    if (!this.frames.length) return [0, 1];
    return [this.frames[0].t, this.frames[this.frames.length - 1].t];
  }

  pathLength(): number {
    let total = 0;
    for (let i = 1; i < this.frames.length; i++) {
      total += Math.hypot(
        this.frames[i].x - this.frames[i - 1].x,
        this.frames[i].y - this.frames[i - 1].y,
      );
    }
    return total;
  }

  displacement(): number {
    if (this.frames.length < 2) return 0;
    const first = this.frames[0];
    const last = this.frames[this.frames.length - 1];
    return Math.hypot(last.x - first.x, last.y - first.y);
  }

  /** Posiciones registradas, para dibujar la traza exacta del cuerpo. */
  points(): { x: number; y: number }[] {
    return this.frames.map((frame) => ({ x: frame.x, y: frame.y }));
  }
}
