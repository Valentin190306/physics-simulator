import { Vec2 } from '../math/vec2';

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export class Camera {
  center = new Vec2(10, 6);
  ppm = 50;

  fit(width: number, height: number, worldWidth = 20, worldHeight = 12, margin = 0.9): void {
    const usableW = Math.max(1, width);
    const usableH = Math.max(1, height);
    this.ppm = Math.min(usableW / (worldWidth + margin * 2), usableH / (worldHeight + margin * 2));
    this.center = new Vec2(worldWidth / 2, worldHeight / 2);
  }

  worldToScreen(x: number, y: number, width: number, height: number): { x: number; y: number } {
    return {
      x: (x - this.center.x) * this.ppm + width / 2,
      y: height / 2 - (y - this.center.y) * this.ppm,
    };
  }

  screenToWorld(sx: number, sy: number, width: number, height: number): Vec2 {
    return new Vec2(
      (sx - width / 2) / this.ppm + this.center.x,
      (height / 2 - sy) / this.ppm + this.center.y,
    );
  }

  visibleBounds(width: number, height: number): Bounds {
    return {
      minX: this.center.x - width / 2 / this.ppm,
      maxX: this.center.x + width / 2 / this.ppm,
      minY: this.center.y - height / 2 / this.ppm,
      maxY: this.center.y + height / 2 / this.ppm,
    };
  }
}
