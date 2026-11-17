# Conceptos y cálculos

Documento técnico del **Playground de cálculo · Física 2D**. Explica el modelo
físico, las fórmulas usadas, los métodos numéricos, cómo se registran los datos y
cómo se interpretan los paneles de la interfaz.

El código es la fuente de verdad: si se cambia una constante o una fórmula,
conviene actualizar este documento.

## Índice

1. [Resumen y unidades](#1-resumen-y-unidades)
2. [Modelo físico](#2-modelo-físico)
3. [Integración temporal (EDO)](#3-integración-temporal-edo)
4. [Colisiones y contactos](#4-colisiones-y-contactos)
5. [Arrastre atmosférico](#5-arrastre-atmosférico)
6. [Derivación numérica](#6-derivación-numérica)
7. [Integración numérica o cuadratura](#7-integración-numérica-o-cuadratura)
8. [Registro y muestreo](#8-registro-y-muestreo)
9. [Convergencia del integrador](#9-convergencia-del-integrador)
10. [Slingshot y predicción](#10-slingshot-y-predicción)
11. [Visualización y cámara](#11-visualización-y-cámara)
12. [Presets](#12-presets)
13. [Validación automática](#13-validación-automática)
14. [Limitaciones y simplificaciones](#14-limitaciones-y-simplificaciones)
15. [Guía de la interfaz](#15-guía-de-la-interfaz)
16. [Mapa de archivos](#16-mapa-de-archivos)
17. [Glosario](#17-glosario)

---

## 1. Resumen y unidades

El proyecto tiene dos capas:

1. **Simulación**: un motor de física 2D propio que integra círculos con
   gravedad, colisiones, fricción, rotación y arrastre.
2. **Laboratorio de cálculo**: paneles que usan los datos de la simulación, o
   funciones analíticas de prueba, para estudiar derivación, cuadratura y
   convergencia.

Unidades del Sistema Internacional:

| Magnitud | Unidad |
| --- | --- |
| Longitud | metro (m) |
| Masa | kilogramo (kg) |
| Tiempo | segundo (s) |
| Ángulo | radián (rad) |
| Velocidad | m/s |
| Aceleración | m/s² |
| Fuerza | newton (N) |
| Energía | joule (J) |
| Cantidad de movimiento | kg·m/s |

La escala del mundo es de **20 m × 12 m**. La cámara ajusta la vista para
mostrar ese rectángulo.

---

## 2. Modelo físico

### 2.1 Estado de un cuerpo

Cada cuerpo circular se describe con:

```
posición        p = (x, y)          m
velocidad       v = (vx, vy)        m/s
ángulo          θ                   rad
velocidad angular ω                 rad/s
radio           r                   m
masa            m                   kg
```

Propiedades derivadas:

```
inercia (disco)     I = ½·m·r²
inversa de masa     invM = 1/m
inversa de inercia  invI = 1/I
```

Los obstáculos son estáticos: no tienen masa ni inercia efectiva. Para ellos se
usa `invM = invI = 0`, de modo que los impulsos no los mueven.

Constantes por cuerpo:

| Propiedad | Valor por defecto | Rango en la interfaz |
| --- | --- | --- |
| Radio `r` | 0.30 m | 0.12–0.60 m |
| Masa `m` | 1.0 kg | 0.2–5.0 kg |
| Restitución `e` | 0.70 | 0–1 |
| Fricción `μ` | 0.35 | 0–1 |
| Resistencia a la rodadura `cω` | 0.45 s⁻¹ | fija |

### 2.2 Fuerzas y aceleraciones

La segunda ley de Newton se aplica como aceleración:

```
a = F_total / m
```

Fuerzas consideradas:

1. **Gravedad**

```
g = (0, g_y),    g_y = −9.81 m/s² por defecto
```

La interfaz permite ajustar `g` entre 0 y 20 m/s²; internamente se guarda
`gravityY = −g`.

2. **Arrastre atmosférico** (opcional; ver sección 5)

```
F_arrastre = −k·|v_rel|·v_rel      modelo cuadrático
F_arrastre = −b·v_rel              modelo lineal
v_rel = v − v_viento
```

3. **Resistencia a la rodadura**

Se modela como amortiguamiento angular, no como un torque de contacto
derivado de la deformación del cuerpo:

```
dω/dt = −cω·ω
```

En Euler explícito y semi-implícito se aplica como:

```
ω ← ω / (1 + cω·h)
```

En RK4 se usa directamente `dω/dt = −cω·ω` dentro del sistema de ecuaciones.

No se modelan fuerzas de flotación, sustentación, presión ni fluidos.

### 2.3 Energía

Energía cinética:

```
K = ½·m·|v|² + ½·I·ω²
```

El primer término es traslacional y el segundo rotacional.

Energía potencial gravitatoria, tomando `y = 0` como referencia:

```
U = −m·g_y·y
```

Con `g_y = −9.81`, esto equivale a `U = m·9.81·y`.

Energía mecánica total:

```
E = K + U
```

La energía no incluye el trabajo de las fuerzas de contacto. Por eso, en un
rebote con `e < 1` o con fricción, `E` disminuye; en un rebote perfectamente
elástico puede conservarse aproximadamente, pero no de forma exacta debido al
solver de impulsos y a la corrección posicional.

---

## 3. Integración temporal (EDO)

### 3.1 La EDO del movimiento

El estado completo de un cuerpo es:

```
s = (x, y, vx, vy, θ, ω)
```

La ecuación diferencial ordinaria (EDO) que se integra es:

```
dx/dt  = vx
dy/dt  = vy
dvx/dt = ax(x, y, vx, vy, t)
dvy/dt = ay(x, y, vx, vy, t)
dθ/dt  = ω
dω/dt  = −cω·ω
```

Las condiciones iniciales son la posición y la velocidad del lanzamiento. Es un
**problema de valor inicial**.

Con gravedad constante y sin aire, la solución analítica es una parábola:

```
x(t) = x₀ + vx₀·t
y(t) = y₀ + vy₀·t − ½·g·t²
```

Con arrastre cuadrático en 2D no hay una solución elemental simple, porque la
aceleración depende de `|v|·v` y acopla los ejes.

### 3.2 Euler explícito

Usa la derivada al inicio del paso para actualizar posición y velocidad:

```
x_{n+1} = x_n + vx_n·h
y_{n+1} = y_n + vy_n·h
vx_{n+1} = vx_n + ax_n·h
vy_{n+1} = vy_n + ay_n·h
θ_{n+1} = θ_n + ω_n·h
```

Error local: `O(h²)`. Error global: `O(h)`.

Es simple, pero puede ganar energía en sistemas oscilatorios y es el menos
preciso de los tres.

### 3.3 Euler semi-implícito

Actualiza primero la velocidad y usa la velocidad nueva para la posición:

```
vx_{n+1} = vx_n + ax_n·h
vy_{n+1} = vy_n + ay_n·h
x_{n+1} = x_n + vx_{n+1}·h
y_{n+1} = y_n + vy_{n+1}·h
θ_{n+1} = θ_n + ω_n·h
```

También es de **primer orden global** (`O(h)`), pero suele conservar mejor la
energía en osciladores y es el integrador por defecto del simulador.

### 3.4 RK4

Runge–Kutta de cuarto orden evalúa la derivada cuatro veces por paso:

```
k1 = f(t, s)
k2 = f(t + h/2, s + h·k1/2)
k3 = f(t + h/2, s + h·k2/2)
k4 = f(t + h, s + h·k3)

s_{n+1} = s_n + (h/6)·(k1 + 2k2 + 2k3 + k4)
```

Error local: `O(h⁵)`. Error global: `O(h⁴)`.

Es mucho más preciso, pero cuesta cuatro evaluaciones de la aceleración por
paso. En el proyecto se usa también como referencia de alta precisión en el
análisis de convergencia.

### 3.5 Orden y convergencia

Para un método de orden `p`:

```
error(h) ≈ C·h^p
log(error) ≈ log(C) + p·log(h)
```

En una gráfica log–log, la pendiente es el orden. Órdenes esperados:

| Método | Error local | Error global | Pendiente |
| --- | --- | --- | --- |
| Euler explícito | `O(h²)` | `O(h)` | +1 |
| Euler semi-implícito | `O(h²)` | `O(h)` | +1 |
| RK4 | `O(h⁵)` | `O(h⁴)` | +4 |

La sección 9 detalla cómo se mide en la app.

### 3.6 Substepping antitunneling

Un paso grande puede hacer que un cuerpo atraviese un obstáculo. Para reducirlo,
cada `dt` se divide en varios subpasos según la velocidad máxima y el radio
mínimo:

```
presupuesto = max(0.45·r_min, 0.02)
n = clamp(ceil(v_max·dt / presupuesto), 1, 24)
h = dt / n
```

En cada subpaso se integra, se detectan contactos, se resuelven tres veces y se
corrige la posición. No es detección continua de colisiones (CCD); es una
heurística que reduce mucho el riesgo con velocidades normales.

### 3.7 `stepExact`

Además del paso normal, el mundo expone `stepExact(dt)`, que integra
exactamente un paso **sin subdividir y sin resolver colisiones**. Se usa en el
análisis de convergencia para aislar el error del integrador.

---

## 4. Colisiones y contactos

### 4.1 Detección círculo–círculo

Para dos cuerpos `A` y `B`:

```
d = p_B − p_A
dist = |d|
si dist < r_A + r_B:
    n = d / dist                    (normal de A hacia B)
    penetración = r_A + r_B − dist
    punto de contacto ≈ p_A + n·(r_A − penetración/2)
```

Si los centros coinciden, se usa una normal arbitraria `(1, 0)`.

### 4.2 Detección círculo–segmento

Para cada segmento estático se busca el punto `q` del segmento más cercano al
centro del círculo:

```
q = punto más cercano del segmento a p
dist = |q − p|
si dist < r:
    n = (q − p) / dist        (del centro hacia la superficie)
    penetración = r − dist
```

Si `dist ≈ 0`, se usa la normal de la arista orientada hacia el centro y
`penetración = r`.

Cada cuerpo se prueba contra todos los segmentos, y cada par de cuerpos entre
sí. Un cuerpo puede generar varios contactos a la vez (por ejemplo, en una
esquina).

### 4.3 Impulso normal

Sea `n` la normal del contacto. La velocidad relativa en el punto de contacto es:

```
v_rel = (v_B + ω_B × r_B) − (v_A + ω_A × r_A)
```

donde `r_A` y `r_B` son los vectores desde el centro de cada cuerpo al punto de
contacto. Para un obstáculo estático, `v_B = 0` y los términos angulares de `B`
no existen.

La velocidad normal es:

```
v_n = v_rel · n
```

Si `v_n > 0`, los cuerpos se separan y no se aplica impulso. Si se acercan, el
impulso normal es:

```
j_n = −(1 + e)·v_n / K_n

K_n = invM_A + invM_B
    + (r_A × n)²·invI_A
    + (r_B × n)²·invI_B
```

Y se aplica:

```
A: Δv = −j_n·n / m_A        Δω = −invI_A·(r_A × (j_n·n))
B: Δv = +j_n·n / m_B        Δω = +invI_B·(r_B × (j_n·n))
```

Para un cuerpo estático no se aplica nada.

**Restitución:** se usa `e = 0` cuando `−v_n` es menor que `0.6 m/s`. Ese umbral
evita que un cuerpo en reposo rebote indefinidamente por errores numéricos. Si
la velocidad de impacto supera el umbral, se usa `min(e_A, e_B)`.

### 4.4 Fricción de Coulomb

Después del impulso normal se calcula la velocidad tangencial:

```
v_t = v_rel − (v_rel·n)·n
t = v_t / |v_t|
```

El impulso tangencial sin límite sería:

```
j_t = −(v_rel·t) / K_t

K_t = invM_A + invM_B
    + (r_A × t)²·invI_A
    + (r_B × t)²·invI_B
```

Pero la ley de Coulomb lo acota:

```
|j_t| ≤ μ·j_n
μ = √(μ_A·μ_B)
```

Si uno de los cuerpos es estático, se usa `μ = √(μ_A·1) = √μ_A`. El impulso se
aplica en dirección tangencial, con signo opuesto para `A` y `B`.

Esta fricción también genera torque, por lo que una bola puede empezar a girar
al deslizar.

### 4.5 Corrección posicional

Los impulsos corrigen velocidades, pero no sacan los cuerpos de la penetración.
Para eso se aplica una corrección tipo Baumgarte:

```
corrección = max(penetración − 0.01, 0)·0.45 / (invM_A + invM_B)

p_A ← p_A − n·corrección·invM_A
p_B ← p_B + n·corrección·invM_B
```

- `0.01 m` es la tolerancia (`slop`).
- `0.45` es el porcentaje de corrección por paso.
- Solo usa masa traslacional; no corrige orientación.

La corrección puede introducir algo de energía, pero evita que los cuerpos se
hundan visiblemente.

### 4.6 Iteraciones y orden

Por cada subpaso:

1. Integrar todos los cuerpos.
2. Construir todos los contactos.
3. Resolver los impulsos **3 veces** (aproximación a un solver iterativo).
4. Corregir posiciones una vez por contacto.

No hay *warm starting* ni acumulación de impulsos entre pasos. Es un solver
sencillo y suficiente para círculos.

---

## 5. Arrastre atmosférico

### 5.1 Modelos

El arrastre se calcula con la velocidad relativa al aire:

```
v_rel = (vx − viento_x, vy − viento_y)
```

En la interfaz solo se ajusta el viento horizontal; `windY` existe en la
configuración pero no tiene slider.

**Modelo cuadrático** (adecuado para una pelota en aire a velocidad cotidiana):

```
F = −k·|v_rel|·v_rel
k = ½·ρ·Cd·A
A = π·r²
```

donde `ρ` es la densidad del aire, `Cd` el coeficiente de arrastre y `A` el área
frontal del disco.

**Modelo lineal** (régimen viscoso, baja velocidad):

```
F = −b·v_rel
b = 4·ρ·Cd·r
```

Este `b` es una parametrización didáctica para que los sliders `ρ` y `Cd`
afecten a ambos modelos. **No es la ley de Stokes**, que sería `b = 6πμr` con
viscosidad dinámica `μ`.

**Sin aire:** no se aplica ninguna fuerza de arrastre.

### 5.2 Velocidad terminal

En caída vertical, la velocidad terminal se alcanza cuando el peso iguala al
arrastre.

Modelo cuadrático:

```
m·g = k·v_t²
v_t = √(m·g / k)
```

Modelo lineal:

```
m·g = b·v_t
v_t = m·g / b
```

Con `g = |gravityY|`. La app dibuja una línea de referencia `−v_t` en la
pestaña **Movimiento** cuando el aire está activo.

Consecuencias:

- En el modelo cuadrático, `v_t ∝ √m`: el doble de masa da ≈1.41 veces la
  velocidad terminal.
- En el modelo lineal, `v_t ∝ m`: el doble de masa da el doble de velocidad.
- La aproximación a la terminal es exponencial en el modelo lineal y algebraica
  (`tanh`) en el cuadrático.

### 5.3 Viento

El viento se resta de la velocidad del cuerpo antes de calcular el arrastre. Por
eso el arrastre no depende de la velocidad absoluta, sino de la velocidad
respecto del aire.

Con viento nulo y velocidad horizontal no nula, el arrastre tiene componente
horizontal. Eso explica que el vector de aceleración se incline aunque no haya
viento: la pelota “siente” aire quieto.

---

## 6. Derivación numérica

### 6.1 Diferencia central

Para una señal muestreada `f(t)`, la derivada en un instante se aproxima con:

```
D_h f(t) = [f(t + h) − f(t − h)] / (2h)
```

La app usa interpolación lineal entre muestras (`sampleSeries`), porque los
datos registrados no están necesariamente en los instantes `t ± h`.

### 6.2 Error de truncamiento y redondeo

Desarrollando por Taylor:

```
f(t + h) = f(t) + h·f′(t) + h²/2·f″(t) + h³/6·f‴(t) + …
f(t − h) = f(t) − h·f′(t) + h²/2·f″(t) − h³/6·f‴(t) + …
```

Al restar y dividir por `2h`:

```
D_h f(t) = f′(t) + (h²/6)·f‴(t) + O(h⁴)
```

El error de truncamiento dominante es:

```
E_truncamiento ≈ |f‴|·h² / 6
```

En coma flotante, restar dos valores casi iguales y dividir por `h` amplifica el
error de redondeo:

```
E_redondeo ≈ ε_máquina·|f| / h
```

con `ε_máquina ≈ 2.2×10⁻¹⁶` para doble precisión.

El error total es la suma de ambos efectos. El mínimo se obtiene igualando
aproximadamente las dos expresiones:

```
h* ≈ (6·ε_máquina·|f| / |f‴|)^(1/3)
```

Para magnitudes de orden 1, `h* ≈ 10⁻⁵`.

### 6.3 La curva en U

La pestaña **Derivadas e integrales** muestra una curva de error frente a `h` en
escala log–log para una función analítica de prueba.

- **Rama izquierda** (`h` grande): domina el truncamiento. En log–log, pendiente
  **+2**.
- **Rama derecha** (`h` muy chico): domina el redondeo. En log–log, pendiente
  **−1**.
- **Mínimo:** mejor compromiso entre ambos errores.

El error graficado es el **error absoluto medio** sobre 30 muestras:

```
E(h) = (1/N)·Σ |D_h f(t_i) − f′(t_i)|
```

No es un error relativo: no se divide por `|f′|`. Por eso funciones de distinta
magnitud pueden quedar desplazadas verticalmente.

### 6.4 Funciones de prueba

La app incluye cuatro funciones con derivada analítica exacta:

| Función | `f(t)` | `f′(t)` | `f‴(t)` | ¿Curva en U? |
| --- | --- | --- | --- | --- |
| Seno | `sin(t)` | `cos(t)` | `−cos(t)` | Sí |
| Cuadrática | `t²` | `2t` | `0` | No: solo redondeo |
| Exponencial | `e^(−t)` | `−e^(−t)` | `−e^(−t)` | Sí |
| Logaritmo | `ln(1+t)` | `1/(1+t)` | `2/(1+t)³` | Sí |

El caso `t²` es especial: la diferencia central es **exacta** para polinomios de
grado ≤ 2. No hay error de truncamiento, así que la curva no tiene la rama
izquierda; solo se ve el crecimiento por redondeo al achicar `h`. No es un bug.

### 6.5 Barrido de `h`

El barrido usa:

```
h = 10^e,  e = −7, −6.8, −6.6, …, −0.4
```

Son 34 valores, desde `10⁻⁷` hasta `10⁻⁰·⁴ ≈ 0.4`. Para cada `h` se evalúan 30
muestras dentro del rango de la función de prueba (`[0.5, 2.5]`).

Ese rango se recorta automáticamente por el `h` máximo del barrido:

```
a = 0.5 + h_max
b = 2.5 − h_max
```

Así `t ± h` nunca se sale del intervalo original, todos los `h` se evalúan en
la misma zona y no hay efectos de borde.

### 6.6 Datos analíticos frente a datos registrados

La curva en U usa funciones analíticas porque así la derivada de referencia es
exacta. Si se usaran los datos del `Recorder`, el error incluiría además:

- la interpolación lineal entre muestras,
- el intervalo de muestreo (~16.7 ms a 60 fps),
- el error del integrador que generó posición y velocidad,
- discontinuidades por colisiones.

Con datos registrados, el mínimo de la curva aparecería cerca del intervalo de
muestreo, no en `10⁻⁵`. El gráfico superior de la pestaña sí usa datos
registrados: compara la derivada numérica de `x(t)`, `y(t)` o `|v|(t)` contra
`vx`, `vy` o `d|v|/dt` del simulador.

### 6.7 Error práctico que muestra el panel

Para la señal elegida, la app calcula:

```
error_medio = media |D_h(señal) − derivada_simulador|
```

Ese valor es mucho mayor que el mínimo de la curva analítica porque mezcla todos
los errores anteriores. La etiqueta “error medio” del panel superior se refiere a
esa comparación práctica, no al error intrínseco de la fórmula.

---

## 7. Integración numérica o cuadratura

### 7.1 Objetivo

La cuadratura aproxima una integral definida:

```
∫ₐᵇ f(t) dt
```

En la app se usa para estimar la distancia recorrida integrando la rapidez:

```
distancia ≈ ∫ |v(t)| dt
```

y se compara con la longitud real de la trayectoria registrada.

### 7.2 Métodos

Con `n` subintervalos, `h = (b − a)/n` y `f_i = f(a + i·h)`:

**Riemann izquierda**

```
L_n = h·Σ_{i=0}^{n−1} f_i
```

**Riemann derecha**

```
R_n = h·Σ_{i=1}^{n} f_i
```

**Punto medio**

```
M_n = h·Σ_{i=0}^{n−1} f(a + (i + ½)·h)
```

**Trapecio**

```
T_n = h·[½f_0 + f_1 + f_2 + … + f_{n−1} + ½f_n]
```

**Simpson**

```
S_n = (h/3)·[f_0 + 4f_1 + 2f_2 + 4f_3 + … + 4f_{n−1} + f_n]
```

Simpson requiere un número **par** de subintervalos. Si el usuario elige un `n`
impar, el código lo ajusta al par siguiente.

### 7.3 Errores

| Método | Error global | Comentario |
| --- | --- | --- |
| Riemann izquierda | `O(h)` | Subestima funciones crecientes |
| Riemann derecha | `O(h)` | Sobrestima funciones crecientes |
| Punto medio | `O(h²)` | Mejor constante que trapecio |
| Trapecio | `O(h²)` | Promedia extremos |
| Simpson | `O(h⁴)` | Exacto hasta polinomios de grado 3 |

Para una función creciente, izquierda y derecha dan una cota inferior y superior
respectivamente. Ese sesgo sistemático es didáctico: muestra que el error no es
solo magnitud, también signo.

Simpson es exacto para `x²` porque su error depende de la cuarta derivada, que
es cero para polinomios de grado ≤ 3.

### 7.4 Trayectoria y desplazamiento

La app distingue dos cantidades:

- **Longitud de trayectoria**: suma de distancias entre muestras consecutivas.
  Es lo que se aproxima con `∫|v| dt`.
- **Desplazamiento neto**: distancia en línea recta entre la primera y la última
  posición.

```
trayectoria = Σ |p_{i+1} − p_i|
desplazamiento = |p_final − p_inicial|
```

En un movimiento con rebotes, la trayectoria puede ser mucho mayor que el
desplazamiento.

### 7.5 Limitación con datos registrados

`integrateSeries` interpola linealmente la serie temporal. Eso significa que la
función que se integra es **piecewise lineal**, no la función física original.
Por eso:

- Los órdenes `O(h)`, `O(h²)`, `O(h⁴)` se verifican en los tests con funciones
  analíticas suaves.
- En el panel con datos registrados, la precisión está limitada por el muestreo.
  Aumentar `n` por encima de la densidad de muestras no mejora indefinidamente.
- En colisiones, la rapidez tiene cambios bruscos y la cuadratura pierde
  precisión cerca de los impactos.

La comparación sigue siendo útil, pero debe interpretarse como “qué tan bien se
puede reconstruir la distancia con estos datos”, no como una demostración pura
del orden asintótico.

---

## 8. Registro y muestreo

El `Recorder` guarda el cuerpo seleccionado con estos campos:

```
t, x, y, vx, vy, speed, ax, ay, ke, pe, energy
```

Características:

- Se registra **un frame por frame de animación**, no por paso de física.
- A 60 fps, el intervalo de muestreo es ≈16.7 ms.
- La simulación puede ejecutar varios pasos de física entre frames.
- `lastRecordTime` evita guardar dos muestras con el mismo `t`.
- Capacidad: 3600 frames. Al llenarse, se eliminan los 240 más viejos.
- Las gráficas deciman a ~700 puntos para dibujar.
- Al cambiar de cuerpo se limpia el registro.
- Al pausar, no se agregan muestras.

Consecuencias:

- La derivada numérica y la cuadratura trabajan sobre datos de baja frecuencia
  comparados con `dt`.
- Las gráficas son suaves porque se interpola, pero esa interpolación no agrega
  información física.
- Para análisis de convergencia no se usa el `Recorder`: se simula aparte con
  `stepExact`.

---

## 9. Convergencia del integrador

### 9.1 Definición

Un integrador converge si el error tiende a cero al reducir el paso:

```
error(dt) → 0   cuando   dt → 0
```

Para un método de orden `p`:

```
error(dt) ≈ C·dt^p
```

En log–log:

```
log(error) = log(C) + p·log(dt)
```

La pendiente `p` es el orden observado.

### 9.2 Cómo se mide

`runConvergence` hace lo siguiente:

1. Usa el mismo lanzamiento y el mismo entorno.
2. Simula con:

```
dt = 1/30, 1/60, 1/120, 1/240, 1/480
```

3. Calcula una referencia con RK4 y `dt = 1/8192`.
4. Para cada integrador y cada `dt`, mide el error de la posición final:

```
error(dt) = |r_final(dt) − r_final(referencia)|
```

5. Ajusta una recta por mínimos cuadrados a `log10(error)` vs `log10(dt)`.
6. Muestra la pendiente.

La referencia es fiable porque el error de RK4 con `dt = 1/8192` es del orden de
`10⁻¹⁶`, cerca de la precisión de la máquina.

El error se acota inferiormente a `10⁻¹⁵` para evitar `log(0)`.

### 9.3 Qué se espera

| Método | Pendiente esperada |
| --- | --- |
| Euler explícito | ≈ +1 |
| Euler semi-implícito | ≈ +1 |
| RK4 | ≈ +4 |

Valores medidos en la app: aproximadamente **0.99**, **1.00** y **4.03**.

Una pendiente `p = 4` significa que al reducir `dt` a la mitad el error cae
alrededor de 16 veces. Una pendiente `p = 1`, que cae a la mitad.

### 9.4 Por qué se fuerza el arrastre

Si el entorno no tiene aire, el movimiento con gravedad constante es un
polinomio de grado 2. RK4 lo integra prácticamente de forma exacta, el error cae
al nivel de redondeo y su pendiente deja de ser medible.

Para que los tres métodos muestren su orden, el análisis activa arrastre
cuadrático si el entorno no tiene aire:

```
ρ = max(ρ, 1.2)
Cd = max(Cd, 0.6)
```

También fuerza `g = 9.81` si la gravedad es cero. Es una copia de la
configuración: no modifica la simulación visible.

### 9.5 Por qué no incluye colisiones

El análisis usa `stepExact`, que no resuelve contactos ni subdivide pasos. Los
rebotes introducen discontinuidades: la solución no es suave y el orden
asintótico deja de ser una propiedad limpia del integrador. El experimento mide
el vuelo libre con gravedad y arrastre, que es donde el orden teórico se puede
comprobar.

### 9.6 Qué no mide

- **Estabilidad:** un método puede converger con `dt → 0` y ser inestable con un
  `dt` grande.
- **Conservación de energía:** para eso está la pestaña **Energía**.
- **Error de toda la trayectoria:** se mide solo la posición final. Otra métrica
  podría dar constantes distintas, aunque el orden asintótico debería coincidir.
- **Efecto de las colisiones:** no forma parte del experimento.

---

## 10. Slingshot y predicción

### 10.1 Lanzamiento

El usuario arrastra desde un punto `start` hasta `current`. La velocidad inicial
es:

```
v₀ = (start − current)·3.2
```

Si `|v₀| > 34 m/s`, se escala al máximo. Si al soltar `|v₀| < 0.4 m/s`, se
considera un lanzamiento nulo y el cuerpo se crea en reposo.

La posición de creación se limita al mundo:

```
x ∈ [0.4, 19.6]
y ∈ [0.4, 11.6]
```

El cuerpo usa radio, masa, restitución y fricción de los sliders.

### 10.2 Trayectoria fantasma

Mientras se arrastra, se predice una trayectoria sin colisiones:

- Integrador semi-implícito con `h = 1/240`.
- Duración: 2.6 s.
- Se detiene si `y < −1`, `x < −2` o `x > 24`.
- Se guarda un punto cada 3 pasos.
- No considera obstáculos ni contacto con el suelo.

Es una ayuda visual, no una garantía de la trayectoria real. En la simulación,
las colisiones y la fricción cambian el resultado.

---

## 11. Visualización y cámara

La cámara ajusta la escala para mostrar un mundo de 20 × 12 m con un margen de
0.9 m por lado:

```
ppm = min(ancho / (20 + 2·0.9), alto / (12 + 2·0.9))
centro = (10, 6)
```

Transformación mundo → pantalla:

```
sx = (x − cx)·ppm + ancho/2
sy = alto/2 − (y − cy)·ppm
```

La inversa se usa para convertir el puntero a coordenadas del mundo.

Elementos dibujados:

- Fondo con degradado y rejilla adaptativa.
- Obstáculos estáticos.
- Trayectorias de los cuerpos.
- Cuerpos con radio y marca de rotación.
- Vectores de velocidad (verde) y aceleración (rosa), con escalas y topes
  visuales.
- Puntos de contacto y normales.
- Trayectoria fantasma del slingshot.
- Barra de escala.

Los vectores se recortan visualmente para no tapar la escena: velocidad a un
máximo de 4 unidades de mundo y aceleración a 3, después de aplicar las escalas
0.18 y 0.07 respectivamente.

---

## 12. Presets

| Preset | Entorno | Cuerpos y geometría | Qué demuestra |
| --- | --- | --- | --- |
| Tiro parabólico ideal | Sin aire, `g = 9.81` | Bola en `(2.2, 1.8)` con `v₀ = (8.5, 10.5)` | Comparación con la parábola analítica |
| Con atmósfera | Cuadrático, `ρ = 1.2`, `Cd = 0.6` | Bola en `(2.4, 2)` con `v₀ = (9.5, 11.5)` | Alcance reducido y trayectoria asimétrica |
| Velocidad terminal | Cuadrático, `ρ = 1.2`, `Cd = 0.9` | Tres bolas de masas 0.35, 1 y 2.6 kg en `y = 11` | `v_t = √(mg/k)` y dependencia con la masa |
| Rebotes y energía | Sin aire | Tres bolas con `e = 1, 0.7, 0.3` | Pérdida de energía en colisiones |
| Rampa con fricción | Sin aire | Cuña `(3,7)–(14,2)`, plataforma, dos bolas con `μ = 0.02` y `μ = 0.9` | Deslizamiento, rodadura y fricción |
| Caja de bolas | Sin aire | 36 bolas aleatorias, `e = 0.82`, `μ = 0.18` | Muchas colisiones y conservación de momento |
| Circuito de obstáculos | Cuadrático, `ρ = 0.5`, `Cd = 0.5` | Cuña, plataforma, triángulo y dos bolas | Rebotes con geometría y arrastre |

---

## 13. Validación automática

Los tests usan Vitest y cubren matemáticas y física.

### Derivación

- Interpolación lineal de una serie.
- Derivada central de `sin(t)` contra `cos(t)`.
- Crecimiento del error con `h` grandes.

### Cuadratura

- Simpson exacto para `x²`.
- Trapecio con error menor que `2×10⁻⁵` para 100 intervalos.
- Riemann izquierda/derecha acotando la integral.
- Ajuste de `n` impar en Simpson.
- Integración de una serie muestreada.
- Regresión lineal con pendiente e intercepto conocidos.

### Integradores

- Tiro parabólico contra la solución analítica.
- RK4 mucho más preciso que Euler con el mismo paso.
- Movimiento uniforme exacto sin gravedad ni aire.

### Colisiones

- Choque elástico 1D entre masas iguales: intercambio de velocidades.
- Conservación de momento lineal y energía cinética.
- Bola en reposo que no se hunde ni vibra.
- Bola rápida que no atraviesa el suelo gracias al substepping.

### Arrastre

- Velocidad terminal cuadrática contra `√(mg/k)`.
- Velocidad terminal lineal contra `mg/b`.
- Disipación de energía mecánica.

### Convergencia

- Pendientes de Euler y semi-implícito entre 0.8 y 1.3.
- Pendiente de RK4 mayor que 3.5.

Resultado actual: **20 tests en 6 archivos**, todos aprobados.

---

## 14. Limitaciones y simplificaciones

- **Solo círculos dinámicos.** No hay cajas dinámicas, joints, soft bodies ni
  polígonos rígidos en movimiento.
- **Colisiones por segmentos.** Los polígonos estáticos se representan por sus
  aristas; no hay un solver de interiores de polígono.
- **Sin CCD.** El substepping reduce el tunneling, pero no lo elimina en todos
  los casos extremos.
- **Solver de impulsos simple.** Tres iteraciones, sin warm starting ni
  acumulación de impulsos. Puede quedar algo de penetración residual.
- **Corrección posicional tipo Baumgarte.** Puede introducir energía; no es una
  proyección físicamente exacta.
- **Rodadura simplificada.** La resistencia a la rodadura es amortiguamiento
  angular, no un modelo de deformación.
- **Arrastre didáctico.** El modelo lineal no usa viscosidad dinámica real; es
  una parametrización con `ρ` y `Cd`.
- **Sin fluidos.** No se simula el aire como medio; solo se aplica una fuerza de
  arrastre.
- **Energía sin trabajo de contactos.** La energía total puede cambiar en
  colisiones; no se contabiliza el trabajo de las normales.
- **Muestreo limitado.** El `Recorder` guarda un frame por frame de animación,
  no por paso de física.
- **Convergencia en vuelo libre.** No incluye colisiones ni substepping.
- **Cámara fija.** El mundo visible es siempre 20 × 12 m.
- **Sin persistencia.** Al recargar se pierde el estado.
- **Panel de fases retirado.** El alcance actual no incluye espacio de fases ni
  campo vectorial.

---

## 15. Guía de la interfaz

### Barra superior

- **Pausar / Reanudar**: detiene o continúa la simulación (`Espacio`).
- **Paso**: avanza un `dt` (`S`).
- **Reset**: recarga el preset actual (`R`).
- **Limpiar**: elimina todos los cuerpos.
- **dt**: 1/60, 1/120 (por defecto) o 1/240 s.
- **Integrador temporal (EDO)**: Euler explícito, semi-implícito o RK4.
- **Velocidad**: 0.1×, 0.25×, 0.5×, 1× o 2×.
- **fps**: suavizado de fotogramas por segundo.

### Panel izquierdo

- Radio, masa, restitución y fricción del próximo cuerpo.
- Modelo de arrastre, densidad, `Cd` y viento horizontal.
- Gravedad.
- Dibujo: trayectorias, vectores, contactos.
- Presets y descripción.
- Ayuda de interacción.

### Pestañas del panel derecho

- **Movimiento**: `y(t)`, `vy(t)` y `ay(t)` del cuerpo seleccionado, con línea
  de velocidad terminal si hay aire.
- **Energía**: cinética, potencial y total.
- **Derivadas e integrales**: derivada numérica de la señal, comparación con la
  derivada del simulador, cuadraturas y curva de error vs `h`.
- **Convergencia del integrador**: análisis de orden con referencia RK4.

### Controles

| Acción | Cómo |
| --- | --- |
| Lanzar | Arrastrar en el lienzo y soltar |
| Seleccionar | Click en un cuerpo |
| Pausar | `Espacio` |
| Paso | `S` |
| Reset | `R` |
| Borrar seleccionado | `Supr` o `Backspace` |

### Experimentos sugeridos

1. **Tiro parabólico**: preset sin aire, comparar la trayectoria con la
   parábola y ver la energía.
2. **Arrastre**: activar modelo cuadrático y observar cómo se inclina el vector
   de aceleración y cómo aparece la velocidad terminal.
3. **Derivada**: elegir `sin(t)` en la curva de error, mover `h` y ver la U.
4. **Cuadratura**: comparar Riemann, trapecio y Simpson contra la longitud real.
5. **Convergencia**: ejecutar el análisis y comprobar pendientes +1, +1 y +4.

---

## 16. Mapa de archivos

```
src/
  math/
    vec2.ts          Vector 2D, producto cruz, utilidades
    derivative.ts    Interpolación, diferencia central, error vs h
    integral.ts      Riemann, trapecio, Simpson, regresión
  physics/
    body.ts          Cuerpo, masa, inercia, energía
    geometry.ts      Segmentos, polígonos, marco del mundo
    collide.ts       Detección círculo–círculo y círculo–segmento
    resolve.ts       Impulsos normal/tangencial y corrección posicional
    world.ts         Loop, integradores, fuerzas, substeps, predicción
  sim/
    recorder.ts      Registro temporal del cuerpo seleccionado
    presets.ts       Escenas didácticas
    convergence.ts   Barrido de dt y medición de orden
  render/
    camera.ts        Transformación mundo ↔ pantalla
    canvas.ts        Preparación de canvas y flechas
    scene.ts         Escena, trazas, vectores, contactos, slingshot
    charts.ts        Gráficas genéricas y escala logarítmica
  ui/
    app.ts           Estado, eventos, paneles y grabación
  main.ts
  style.css
tests/
  derivative.test.ts
  integral.test.ts
  integrators.test.ts
  collisions.test.ts
  drag.test.ts
  convergence.test.ts
```

---

## 17. Glosario

**EDO (ecuación diferencial ordinaria):** ecuación que relaciona una función de
una variable con sus derivadas. En el simulador, la variable es el tiempo.

**Integrador temporal:** método que avanza el estado de una EDO paso a paso
(Euler, RK4).

**Cuadratura:** método que aproxima una integral definida (Riemann, trapecio,
Simpson).

**Error de truncamiento:** error que aparece al reemplazar una operación exacta
por una aproximación (por ejemplo, cortar la serie de Taylor).

**Error de redondeo:** error causado por la representación finita de los números
en coma flotante.

**Restitución (`e`):** medida de cuánta velocidad normal se conserva en un
rebote. `e = 1` es elástico; `e = 0` es completamente inelástico.

**Fricción de Coulomb:** fuerza tangencial proporcional a la normal, acotada por
`μ·N`.

**Substepping:** dividir un paso de tiempo en varios más pequeños para mejorar
la estabilidad y reducir el tunneling.

**Tunneling:** atravesar un obstáculo sin detectar la colisión.

**Baumgarte:** técnica de corrección posicional que empuja los cuerpos para
sacar la penetración.

**Slingshot:** lanzamiento por arrastre, donde el vector de lanzamiento apunta
en sentido opuesto al arrastre.

**Velocidad terminal:** velocidad límite de caída cuando el peso y el arrastre
se equilibran.

**Pendiente de convergencia:** exponente `p` en `error ∝ dt^p`, medido como la
pendiente de la recta log–log.
