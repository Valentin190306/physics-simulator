# Sandbox de física 2D + laboratorio de cálculo

Simulador 2D en TypeScript y Canvas (sin motor externo) para lanzar círculos que
caen, chocan, ruedan y sienten arrastre atmosférico. Sobre la simulación se
construye un panel que demuestra técnicas de cálculo diferencial e integral:
derivadas numéricas, cuadraturas, convergencia de integradores y trabajo-energía.

## Alcance v1

- Círculos dinámicos con rotación (ruedan).
- Obstáculos estáticos: segmentos y polígonos (suelo, rampas, paredes, cajas).
- Gravedad, restitución, fricción de Coulomb, resistencia a la rodadura.
- Atmósfera sin fluidos: arrastre lineal o cuadrático + viento.
- Lanzamiento con slingshot y trayectoria fantasma.
- Trazas, vectores de velocidad/aceleración, puntos de contacto.
- Gráficas: posición, velocidad, aceleración, energía.
- Panel de cálculo: derivada numérica con barrido de `h`, Riemann/trapecio/
  Simpson, comparación con distancia recorrida, error vs `n`.
- Convergencia de integradores (Euler explícito, Euler semi-implícito, RK4).
- Presets didácticos.

Fuera de alcance: fluidos, polígonos dinámicos, joints, soft bodies, CCD
completo, 3D.

## Stack

Vite + TypeScript estricto + Canvas 2D + Vitest. Sin frameworks de UI.

## Estructura

```
src/
  math/vec2.ts
  math/derivative.ts
  math/integral.ts
  math/integrators.ts
  physics/body.ts
  physics/geometry.ts
  physics/collide.ts
  physics/resolve.ts
  physics/world.ts
  sim/recorder.ts
  sim/presets.ts
  render/camera.ts
  render/scene.ts
  render/charts.ts
  ui/app.ts
  ui/controls.ts
  ui/calculusPanel.ts
  ui/convergencePanel.ts
  main.ts
  style.css
tests/
  derivative.test.ts
  integral.test.ts
  integrators.test.ts
  collisions.test.ts
  drag.test.ts
```

## Física

Cuerpos: `m`, `I = ½mr²`, `invM`, `invI`, `e`, `μ`, `r`, `ω`.
Estáticos: segmentos y polígonos con `invM = invI = 0`.

Fuerzas por paso:

```
gravedad:  a = g
arrastre:  F = -k·|v_rel|·v_rel   (cuadrático, k = ½ρCdA, A = πr²)
           F = -b·v_rel           (lineal)
           v_rel = v - v_viento
rodadura:  τ = -c_ω·ω
```

Impulso normal en un contacto (n de A hacia B):

```
j = -(1+e)·(v_rel·n) / (invM_A + invM_B + (r_A×n)²·invI_A + (r_B×n)²·invI_B)
```

Fricción tangencial acotada a `|j_t| ≤ μ·j_n`. Corrección posicional con
`percent = 0.4` y `slop = 0.01 m`. Restitución desactivada por debajo de un
umbral de velocidad normal para evitar vibración en reposo.

Substepping adaptativo para evitar tunneling:

```
n = clamp(ceil(maxSpeed·dt / (r_min·0.5)), 1, 16)
```

## Panel de cálculo

- Derivada central de posiciones registradas vs velocidad del simulador;
  slider de `h` y curva de error vs `h` en log-log (truncamiento vs redondeo).
- Integral de `v(t)` para estimar distancia; métodos de Riemann izquierda,
  derecha, punto medio, trapecio y Simpson; comparación con distancia
  recorrida y desplazamiento.
- Energía cinética, potencial y total; deriva por integrador.
- Convergencia: mismo lanzamiento con `dt`, `dt/2`, `dt/4`; error final contra
  referencia RK4 de paso muy pequeño; pendiente medida.
- Línea de velocidad terminal `v_t = √(mg/k)` en la gráfica de velocidad.

## Hitos

| # | Entregable | Horas |
|---|---|---|
| M0 | Scaffold, loop fijo, cámara, cuerpo | 4–6 |
| M1 | Gravedad, arrastre, trazas, slingshot + ghost | 12–16 |
| M2 | Círculo–círculo, impulsos, restitución | 8–10 |
| M3 | Segmentos, fricción, rodadura | 12–16 |
| M4 | Registro, gráficas, derivada, cuadraturas | 12–18 |
| M5 | Drag analítico y convergencia | 10–14 |
| M6 | Presets, pulido, tests, README | 8–12 |

## Validación

- Derivada de `sin`, integral de `x²` contra valor exacto.
- Decaimiento exponencial y oscilador con integradores.
- Colisión elástica 1D contra fórmula analítica.
- Energía monótona decreciente con `e<1` y arrastre.
- Bola en reposo sin hundirse ni vibrar.
- Bola rápida sin atravesar el suelo.
- Trayectoria sin aire contra parábola analítica.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Tunneling | Substepping adaptativo |
| Jitter en reposo | Slop + restitución bajo umbral |
| Rodadura infinita | Resistencia a la rodadura |
| Arrastre inestable | Substepping / RK4 |
| Gráficas lentas | Buffers de tamaño fijo |
| UI acoplada | `AppState` único y paneles declarativos |
