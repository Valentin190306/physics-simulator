import { Vec2 } from '../math/vec2';
import { Body, BODY_COLORS } from '../physics/body';
import { frameShapes, polyShape, rectShape, wedgeShape, type StaticShape } from '../physics/geometry';
import type { WorldConfig } from '../physics/world';

export interface BodyDefaults {
  radius: number;
  mass: number;
  restitution: number;
  friction: number;
}

export interface PresetInfo {
  id: string;
  label: string;
  description: string;
}

export interface PresetResult {
  info: PresetInfo;
  shapes: StaticShape[];
  env: Partial<WorldConfig>;
  bodies: Body[];
}

export const PRESETS: PresetInfo[] = [
  {
    id: 'parabola',
    label: 'Tiro parabólico ideal',
    description: 'Sin aire: la trayectoria coincide con la parábola analítica. Ideal para comparar con la solución exacta.',
  },
  {
    id: 'atmosphere',
    label: 'Con atmósfera',
    description: 'Arrastre cuadrático: el alcance se acorta y la velocidad vertical tiende a la terminal.',
  },
  {
    id: 'terminal',
    label: 'Velocidad terminal',
    description: 'Tres bolas con distinta masa caen con arrastre. Todas convergen a v_t = √(mg/k).',
  },
  {
    id: 'bounce',
    label: 'Rebotes y energía',
    description: 'Misma caída con e = 1, 0.7 y 0.3. La energía total cuenta la historia.',
  },
  {
    id: 'ramp',
    label: 'Rampa con fricción',
    description: 'Dos bolas idénticas con distinto μ: una desliza, la otra rueda.',
  },
  {
    id: 'balls',
    label: 'Caja de bolas',
    description: 'Muchas colisiones: conservación de momento, pérdida de energía y broadphase.',
  },
  {
    id: 'obstacles',
    label: 'Circuito de obstáculos',
    description: 'Rampas y plataformas para lanzar y ver rebotes con fricción.',
  },
];

function info(id: string): PresetInfo {
  const found = PRESETS.find((preset) => preset.id === id);
  return found ?? PRESETS[0];
}

function makeBody(
  defaults: BodyDefaults,
  position: Vec2,
  velocity: Vec2,
  overrides: Partial<{ radius: number; mass: number; restitution: number; friction: number; color: string }> = {},
): Body {
  return new Body({
    position,
    velocity,
    radius: overrides.radius ?? defaults.radius,
    mass: overrides.mass ?? defaults.mass,
    restitution: overrides.restitution ?? defaults.restitution,
    friction: overrides.friction ?? defaults.friction,
    rollingResistance: 0.45,
    color: overrides.color,
  });
}

export function buildPreset(id: string, defaults: BodyDefaults): PresetResult {
  const preset = info(id);
  const shapes: StaticShape[] = frameShapes(20, 12);
  const bodies: Body[] = [];
  let env: Partial<WorldConfig> = {
    airModel: 'none',
    gravityY: -9.81,
    windX: 0,
    windY: 0,
  };

  switch (id) {
    case 'atmosphere': {
      env = { airModel: 'quadratic', airDensity: 1.2, dragCoefficient: 0.6, gravityY: -9.81 };
      bodies.push(makeBody(defaults, new Vec2(2.4, 2), new Vec2(9.5, 11.5), { color: '#4cc9f0' }));
      break;
    }
    case 'terminal': {
      env = { airModel: 'quadratic', airDensity: 1.2, dragCoefficient: 0.9 };
      const masses = [0.35, 1, 2.6];
      [5, 10, 15].forEach((x, i) => {
        bodies.push(
          makeBody(defaults, new Vec2(x, 11), Vec2.zero(), {
            mass: masses[i],
            radius: 0.3,
            restitution: 0.2,
            friction: 0.4,
            color: BODY_COLORS[i],
          }),
        );
      });
      break;
    }
    case 'bounce': {
      env = { airModel: 'none' };
      const restitutions = [1, 0.7, 0.3];
      [5, 10, 15].forEach((x, i) => {
        bodies.push(
          makeBody(defaults, new Vec2(x, 8.5), Vec2.zero(), {
            restitution: restitutions[i],
            friction: 0.25,
            radius: 0.34,
            color: BODY_COLORS[i],
          }),
        );
      });
      break;
    }
    case 'ramp': {
      env = { airModel: 'none' };
      shapes.push(wedgeShape(new Vec2(3, 7), new Vec2(14, 2), 0, { fill: '#182741' }));
      shapes.push(rectShape(15.4, 1.2, 2.2, 0.5, { fill: '#182741' }));
      bodies.push(
        makeBody(defaults, new Vec2(4.6, 8.2), Vec2.zero(), {
          friction: 0.02,
          restitution: 0.1,
          color: '#4cc9f0',
        }),
      );
      bodies.push(
        makeBody(defaults, new Vec2(5.8, 8.2), Vec2.zero(), {
          friction: 0.9,
          restitution: 0.1,
          color: '#f72585',
        }),
      );
      break;
    }
    case 'balls': {
      env = { airModel: 'none' };
      for (let i = 0; i < 36; i++) {
        const radius = 0.2 + Math.random() * 0.14;
        bodies.push(
          new Body({
            position: new Vec2(2 + Math.random() * 16, 1.2 + Math.random() * 9),
            velocity: new Vec2((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7),
            radius,
            mass: 0.6 + Math.random() * 1.2,
            restitution: 0.82,
            friction: 0.18,
            color: BODY_COLORS[i % BODY_COLORS.length],
          }),
        );
      }
      break;
    }
    case 'obstacles': {
      env = { airModel: 'quadratic', airDensity: 0.5, dragCoefficient: 0.5 };
      shapes.push(wedgeShape(new Vec2(7, 2.4), new Vec2(13.5, 6), 0, { fill: '#182741' }));
      shapes.push(rectShape(12, 8.2, 5.2, 0.45, { fill: '#182741' }));
      shapes.push(polyShape([new Vec2(3, 4.2), new Vec2(5, 5.3), new Vec2(5, 3.2)], { fill: '#182741' }));
      bodies.push(
        makeBody(defaults, new Vec2(1.6, 1.2), new Vec2(8, 9), {
          restitution: 0.7,
          friction: 0.3,
          color: '#4cc9f0',
        }),
      );
      bodies.push(
        makeBody(defaults, new Vec2(1.6, 1.2), new Vec2(10, 12), {
          radius: 0.22,
          mass: 0.8,
          restitution: 0.85,
          friction: 0.2,
          color: '#ffd166',
        }),
      );
      break;
    }
    default: {
      // parabola
      env = { airModel: 'none', gravityY: -9.81, windX: 0, windY: 0 };
      bodies.push(
        makeBody(defaults, new Vec2(2.2, 1.8), new Vec2(8.5, 10.5), {
          restitution: 0.72,
          friction: 0.3,
          color: '#4cc9f0',
        }),
      );
      break;
    }
  }

  return { info: preset, shapes, env, bodies };
}
