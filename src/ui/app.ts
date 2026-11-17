import { Vec2 } from '../math/vec2';
import {
  centralDifference,
  derivativeErrorVsH,
  TEST_FUNCTIONS,
  type Series,
} from '../math/derivative';
import {
  integrateSeries,
  QUADRATURE_LABELS,
  type QuadratureMethod,
} from '../math/integral';
import { Body } from '../physics/body';
import { World, type AirModel, type Integrator } from '../physics/world';
import { Camera } from '../render/camera';
import { drawChart } from '../render/charts';
import type { ChartSeries } from '../render/charts';
import { renderScene, type DragState } from '../render/scene';
import { runConvergence, type ConvergenceSeries, type LaunchSpec } from '../sim/convergence';
import { buildPreset, PRESETS } from '../sim/presets';
import { Recorder, type RecordedFrame } from '../sim/recorder';

type TabId = 'motion' | 'energy' | 'calculus' | 'convergence';
type SignalId = 'x' | 'y' | 'speed';

const SLINGSHOT_STRENGTH = 3.2;
const MAX_LAUNCH_SPEED = 34;
const INTEGRATOR_LABELS: Record<Integrator, string> = {
  explicit: 'Euler explícito',
  semiImplicit: 'Euler semi-implícito',
  rk4: 'RK4',
};
const EXPECTED_SLOPES: Record<Integrator, string> = {
  explicit: '≈ +1',
  semiImplicit: '≈ +1',
  rk4: '≈ +4',
};
const SHORT_INTEGRATOR_LABELS: Record<Integrator, string> = {
  explicit: 'Euler',
  semiImplicit: 'Semi-impl.',
  rk4: 'RK4',
};

function must<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Elemento #${id} no encontrado`);
  return element as T;
}

function formatH(value: number): string {
  return value >= 0.01 ? value.toFixed(3) : value.toExponential(1);
}

export class App {
  private world = new World();
  private camera = new Camera();
  private recorder = new Recorder();

  private canvas!: HTMLCanvasElement;
  private chart!: HTMLCanvasElement;
  private chart2!: HTMLCanvasElement;
  private panelControls!: HTMLElement;
  private status!: HTMLElement;
  private fpsEl!: HTMLElement;
  private playBtn!: HTMLButtonElement;
  private presetSelect!: HTMLSelectElement;
  private presetDescription!: HTMLElement;
  private airModelSelect!: HTMLSelectElement;
  private gravityInput!: HTMLInputElement;
  private airDensityInput!: HTMLInputElement;
  private dragCdInput!: HTMLInputElement;
  private windInput!: HTMLInputElement;
  private radiusInput!: HTMLInputElement;
  private massInput!: HTMLInputElement;
  private restitutionInput!: HTMLInputElement;
  private frictionInput!: HTMLInputElement;
  private dtSelect!: HTMLSelectElement;
  private integratorSelect!: HTMLSelectElement;
  private speedSelect!: HTMLSelectElement;

  private selectedId: number | null = null;
  private paused = false;
  private speed = 1;
  private dt = 1 / 120;
  private accumulator = 0;
  private lastFrame = performance.now();
  private fpsSmooth = 60;
  private lastRecordTime = -Infinity;

  private drag: DragState | null = null;
  private ghost: Vec2[] = [];

  private showTraces = true;
  private showVectors = false;
  private showContacts = false;

  private activeTab: TabId = 'motion';
  private presetId = 'parabola';
  private lastLaunch: LaunchSpec | null = null;

  private deriveSignal: SignalId = 'x';
  private deriveH = 0.12;
  private quadMethod: QuadratureMethod = 'simpson';
  private quadN = 48;
  private testFunctionId = TEST_FUNCTIONS[0].id;
  private convergence: ConvergenceSeries[] = [];
  private convergenceBusy = false;
  private lastResultsPaint = 0;

  constructor() {
    this.cacheDom();
    this.populatePresets();
    this.bindToolbar();
    this.bindSliders();
    this.bindCanvas();
    this.bindKeyboard();
    this.bindTabs();
    this.applyPreset(this.presetId, true);
    this.buildControls();
    this.updatePlayButton();
    requestAnimationFrame(this.loop);
  }

  // ---------------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------------

  private cacheDom(): void {
    this.canvas = must<HTMLCanvasElement>('scene');
    this.chart = must<HTMLCanvasElement>('chart');
    this.chart2 = must<HTMLCanvasElement>('chart2');
    this.panelControls = must<HTMLElement>('panelControls');
    this.status = must<HTMLElement>('status');
    this.fpsEl = must<HTMLElement>('fps');
    this.playBtn = must<HTMLButtonElement>('playBtn');
    this.presetSelect = must<HTMLSelectElement>('presetSelect');
    this.presetDescription = must<HTMLElement>('presetDescription');
    this.airModelSelect = must<HTMLSelectElement>('airModel');
    this.gravityInput = must<HTMLInputElement>('gravity');
    this.airDensityInput = must<HTMLInputElement>('airDensity');
    this.dragCdInput = must<HTMLInputElement>('dragCd');
    this.windInput = must<HTMLInputElement>('windX');
    this.radiusInput = must<HTMLInputElement>('radius');
    this.massInput = must<HTMLInputElement>('mass');
    this.restitutionInput = must<HTMLInputElement>('restitution');
    this.frictionInput = must<HTMLInputElement>('friction');
    this.dtSelect = must<HTMLSelectElement>('dtSelect');
    this.integratorSelect = must<HTMLSelectElement>('integratorSelect');
    this.speedSelect = must<HTMLSelectElement>('speedSelect');
  }

  private populatePresets(): void {
    this.presetSelect.innerHTML = PRESETS.map(
      (preset) => `<option value="${preset.id}">${preset.label}</option>`,
    ).join('');
  }

  private bindToolbar(): void {
    this.playBtn.addEventListener('click', () => this.togglePause());
    must<HTMLButtonElement>('stepBtn').addEventListener('click', () => this.stepOnce());
    must<HTMLButtonElement>('resetBtn').addEventListener('click', () => this.applyPreset(this.presetId));
    must<HTMLButtonElement>('clearBtn').addEventListener('click', () => this.clearBodies());

    this.dtSelect.addEventListener('change', () => {
      this.dt = Number(this.dtSelect.value);
      this.accumulator = 0;
    });
    this.integratorSelect.addEventListener('change', () => {
      this.world.setConfig({ integrator: this.integratorSelect.value as Integrator });
    });
    this.speedSelect.addEventListener('change', () => {
      this.speed = Number(this.speedSelect.value);
    });

    this.presetSelect.addEventListener('change', () => {
      this.applyPreset(this.presetSelect.value);
    });
  }

  private bindSliders(): void {
    const radiusLabel = must<HTMLElement>('radiusValue');
    const massLabel = must<HTMLElement>('massValue');
    const restitutionLabel = must<HTMLElement>('restitutionValue');
    const frictionLabel = must<HTMLElement>('frictionValue');

    this.radiusInput.addEventListener('input', () => {
      radiusLabel.textContent = `${Number(this.radiusInput.value).toFixed(2)} m`;
    });
    this.massInput.addEventListener('input', () => {
      const mass = Number(this.massInput.value);
      massLabel.textContent = `${mass.toFixed(1)} kg`;
    });
    this.restitutionInput.addEventListener('input', () => {
      restitutionLabel.textContent = Number(this.restitutionInput.value).toFixed(2);
    });
    this.frictionInput.addEventListener('input', () => {
      frictionLabel.textContent = Number(this.frictionInput.value).toFixed(2);
    });

    const gravityLabel = must<HTMLElement>('gravityValue');
    this.gravityInput.addEventListener('input', () => {
      const g = Number(this.gravityInput.value);
      gravityLabel.textContent = `${g.toFixed(2)} m/s²`;
      this.world.setConfig({ gravityY: -g });
    });

    const densityLabel = must<HTMLElement>('airDensityValue');
    const cdLabel = must<HTMLElement>('dragCdValue');
    const windLabel = must<HTMLElement>('windXValue');

    this.airModelSelect.addEventListener('change', () => {
      this.world.setConfig({ airModel: this.airModelSelect.value as AirModel });
    });
    this.airDensityInput.addEventListener('input', () => {
      const value = Number(this.airDensityInput.value);
      densityLabel.textContent = `${value.toFixed(2)} kg/m³`;
      this.world.setConfig({ airDensity: value });
    });
    this.dragCdInput.addEventListener('input', () => {
      const value = Number(this.dragCdInput.value);
      cdLabel.textContent = value.toFixed(2);
      this.world.setConfig({ dragCoefficient: value });
    });
    this.windInput.addEventListener('input', () => {
      const value = Number(this.windInput.value);
      windLabel.textContent = `${value.toFixed(1)} m/s`;
      this.world.setConfig({ windX: value });
    });

    must<HTMLInputElement>('drawTraces').addEventListener('change', (event) => {
      this.showTraces = (event.target as HTMLInputElement).checked;
    });
    must<HTMLInputElement>('drawVectors').addEventListener('change', (event) => {
      this.showVectors = (event.target as HTMLInputElement).checked;
    });
    must<HTMLInputElement>('drawContacts').addEventListener('change', (event) => {
      this.showContacts = (event.target as HTMLInputElement).checked;
    });
  }

  private bindTabs(): void {
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.tabs button'));
    for (const button of buttons) {
      button.addEventListener('click', () => {
        this.activeTab = (button.dataset.tab as TabId) ?? 'motion';
        for (const other of buttons) other.classList.toggle('active', other === button);
        this.buildControls();
      });
    }
  }

  private buildControls(): void {
    const container = this.panelControls;

    if (this.activeTab === 'calculus') {
      const methodOptions = (Object.keys(QUADRATURE_LABELS) as QuadratureMethod[])
        .map(
          (method) =>
            `<option value="${method}" ${method === this.quadMethod ? 'selected' : ''}>${QUADRATURE_LABELS[method]}</option>`,
        )
        .join('');
      const functionOptions = TEST_FUNCTIONS.map(
        (fn) =>
          `<option value="${fn.id}" ${fn.id === this.testFunctionId ? 'selected' : ''}>${fn.label}</option>`,
      ).join('');

      container.innerHTML = `
        <div class="grid-2">
          <div class="control">
            <div class="label-row"><span>Señal</span></div>
            <select id="deriveSignal">
              <option value="x" ${this.deriveSignal === 'x' ? 'selected' : ''}>x(t)</option>
              <option value="y" ${this.deriveSignal === 'y' ? 'selected' : ''}>y(t)</option>
              <option value="speed" ${this.deriveSignal === 'speed' ? 'selected' : ''}>|v|(t)</option>
            </select>
          </div>
          <div class="control">
            <div class="label-row"><span>Método de cuadratura</span></div>
            <select id="quadMethod">${methodOptions}</select>
          </div>
        </div>
        <div class="control">
          <div class="label-row"><span>Paso h de la derivada</span><span id="hValue">${formatH(this.deriveH)} s</span></div>
          <input id="hSlider" type="range" min="-4" max="-0.3" step="0.02" value="${Math.log10(this.deriveH).toFixed(2)}" />
        </div>
        <div class="control">
          <div class="label-row"><span>Subintervalos n</span><span id="nValue">${this.quadN}</span></div>
          <input id="nSlider" type="range" min="2" max="200" step="1" value="${this.quadN}" />
        </div>
        <div class="results" id="calcResults">Sin datos todavía.</div>
        <div class="control" style="margin-top: 10px">
          <div class="label-row"><span>Función de prueba · curva de error vs h</span></div>
          <select id="testFn">${functionOptions}</select>
        </div>
      `;

      const signal = container.querySelector<HTMLSelectElement>('#deriveSignal');
      if (signal) {
        signal.addEventListener('change', () => {
          this.deriveSignal = signal.value as SignalId;
          this.lastResultsPaint = 0;
        });
      }
      const method = container.querySelector<HTMLSelectElement>('#quadMethod');
      if (method) {
        method.addEventListener('change', () => {
          this.quadMethod = method.value as QuadratureMethod;
          this.lastResultsPaint = 0;
        });
      }
      const hSlider = container.querySelector<HTMLInputElement>('#hSlider');
      const hValue = container.querySelector<HTMLElement>('#hValue');
      if (hSlider && hValue) {
        hSlider.addEventListener('input', () => {
          this.deriveH = Math.pow(10, Number(hSlider.value));
          hValue.textContent = `${formatH(this.deriveH)} s`;
          this.lastResultsPaint = 0;
        });
      }
      const nSlider = container.querySelector<HTMLInputElement>('#nSlider');
      const nValue = container.querySelector<HTMLElement>('#nValue');
      if (nSlider && nValue) {
        nSlider.addEventListener('input', () => {
          this.quadN = Number(nSlider.value);
          nValue.textContent = String(this.quadN);
          this.lastResultsPaint = 0;
        });
      }
      const testFn = container.querySelector<HTMLSelectElement>('#testFn');
      if (testFn) {
        testFn.addEventListener('change', () => {
          this.testFunctionId = testFn.value;
        });
      }
      return;
    }

    if (this.activeTab === 'convergence') {
      container.innerHTML = `
        <button type="button" id="runConv">Ejecutar análisis de convergencia</button>
        <div class="results" id="convResults">
          Compara el error final frente a una referencia RK4 con dt = 1/8192.
        </div>
      `;
      container.querySelector<HTMLButtonElement>('#runConv')?.addEventListener('click', () => {
        this.runConvergenceAnalysis();
      });
      return;
    }

    container.innerHTML = '';
  }

  private bindCanvas(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerCancel);
  }

  private bindKeyboard(): void {
    window.addEventListener('keydown', (event) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if (event.code === 'Space') {
        event.preventDefault();
        this.togglePause();
      } else if (event.key === 'r' || event.key === 'R') {
        this.applyPreset(this.presetId);
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        this.removeSelected();
      } else if (event.key === 's' || event.key === 'S') {
        this.stepOnce();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Simulación
  // ---------------------------------------------------------------------------

  private togglePause(): void {
    this.paused = !this.paused;
    this.updatePlayButton();
  }

  private updatePlayButton(): void {
    this.playBtn.textContent = this.paused ? 'Reanudar' : 'Pausar';
    this.playBtn.classList.toggle('primary', !this.paused);
  }

  private stepOnce(): void {
    this.world.step(this.dt);
    this.recordSelected();
  }

  private clearBodies(): void {
    this.world.clearBodies();
    this.world.resetClock();
    this.selectBody(null);
    this.accumulator = 0;
    this.lastRecordTime = -Infinity;
  }

  private removeSelected(): void {
    const body = this.selectedBody();
    if (!body) return;
    this.world.removeBody(body);
    this.selectBody(null);
  }

  private selectedBody(): Body | null {
    if (this.selectedId === null) return null;
    return this.world.bodies.find((body) => body.id === this.selectedId) ?? null;
  }

  private selectBody(body: Body | null): void {
    this.selectedId = body?.id ?? null;
    if (body) {
      this.recorder.clear(body.id);
      this.lastRecordTime = -Infinity;
      this.recordSelected();
    } else {
      this.recorder.clear(null);
    }
  }

  private recordSelected(): void {
    const body = this.selectedBody();
    if (!body) return;
    if (this.world.time === this.lastRecordTime) return;
    this.recorder.record(this.world, body);
    this.lastRecordTime = this.world.time;
  }

  private spawnBody(position: Vec2, velocity: Vec2): Body {
    const radius = Number(this.radiusInput.value);
    const mass = Number(this.massInput.value);
    const restitution = Number(this.restitutionInput.value);
    const friction = Number(this.frictionInput.value);

    const clamped = new Vec2(
      Math.min(19.6, Math.max(0.4, position.x)),
      Math.min(11.6, Math.max(0.4, position.y)),
    );

    const body = new Body({ position: clamped, velocity, radius, mass, restitution, friction });
    this.world.addBody(body);
    this.selectBody(body);
    this.lastLaunch = {
      position: clamped.clone(),
      velocity: velocity.clone(),
      radius,
      mass,
      restitution,
      friction,
    };
    return body;
  }

  private applyPreset(id: string, initial = false): void {
    const preset = PRESETS.find((item) => item.id === id) ?? PRESETS[0];
    this.presetId = preset.id;

    const defaults = {
      radius: Number(this.radiusInput.value),
      mass: Number(this.massInput.value),
      restitution: Number(this.restitutionInput.value),
      friction: Number(this.frictionInput.value),
    };

    const result = buildPreset(preset.id, defaults);
    this.world.clearBodies();
    this.world.resetClock();
    this.world.setShapes(result.shapes);
    this.world.setConfig({ ...result.env, integrator: this.world.config.integrator });
    for (const body of result.bodies) this.world.addBody(body);

    const last = result.bodies[result.bodies.length - 1] ?? null;
    this.selectBody(last);
    if (last) {
      this.lastLaunch = {
        position: last.position.clone(),
        velocity: last.velocity.clone(),
        radius: last.radius,
        mass: last.mass,
        restitution: last.restitution,
        friction: last.friction,
      };
    }

    this.accumulator = 0;
    this.ghost = [];
    this.drag = null;
    this.presetSelect.value = preset.id;
    this.presetDescription.textContent = preset.description;
    this.syncEnvironmentControls();
    if (!initial) this.convergence = [];
  }

  private syncEnvironmentControls(): void {
    const config = this.world.config;
    this.gravityInput.value = String(-config.gravityY);
    must<HTMLElement>('gravityValue').textContent = `${(-config.gravityY).toFixed(2)} m/s²`;
    this.airModelSelect.value = config.airModel;
    this.airDensityInput.value = String(config.airDensity);
    must<HTMLElement>('airDensityValue').textContent = `${config.airDensity.toFixed(2)} kg/m³`;
    this.dragCdInput.value = String(config.dragCoefficient);
    must<HTMLElement>('dragCdValue').textContent = config.dragCoefficient.toFixed(2);
    this.windInput.value = String(config.windX);
    must<HTMLElement>('windXValue').textContent = `${config.windX.toFixed(1)} m/s`;
  }

  // ---------------------------------------------------------------------------
  // Puntero / slingshot
  // ---------------------------------------------------------------------------

  private pointerWorld(event: PointerEvent): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    return this.camera.screenToWorld(
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect.width,
      rect.height,
    );
  }

  private bodyAt(point: Vec2): Body | null {
    for (let i = this.world.bodies.length - 1; i >= 0; i--) {
      const body = this.world.bodies[i];
      if (body.position.sub(point).length() <= body.radius + 0.07) return body;
    }
    return null;
  }

  private onPointerDown = (event: PointerEvent): void => {
    const point = this.pointerWorld(event);
    const body = this.bodyAt(point);
    if (body) {
      this.selectBody(body);
      return;
    }

    this.drag = { start: point.clone(), current: point.clone(), speed: 0 };
    this.ghost = [];
    this.accumulator = 0;
    this.canvas.setPointerCapture(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.drag) return;
    const current = this.pointerWorld(event);
    this.drag.current = current;

    const velocity = this.launchVelocity(this.drag);
    this.drag.speed = velocity.length();

    const radius = Number(this.radiusInput.value);
    const mass = Number(this.massInput.value);
    this.ghost = this.world.predictTrajectory(this.drag.start, velocity, radius, mass);
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.drag) return;
    const drag = this.drag;
    this.drag = null;
    this.ghost = [];

    const velocity = this.launchVelocity(drag);
    if (velocity.length() < 0.4) velocity.set(0, 0);
    this.spawnBody(drag.start, velocity);
    this.accumulator = 0;

    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
  };

  private onPointerCancel = (): void => {
    this.drag = null;
    this.ghost = [];
  };

  private launchVelocity(drag: DragState): Vec2 {
    const velocity = drag.start.sub(drag.current).mul(SLINGSHOT_STRENGTH);
    const speed = velocity.length();
    if (speed > MAX_LAUNCH_SPEED) return velocity.mul(MAX_LAUNCH_SPEED / speed);
    return velocity;
  }

  // ---------------------------------------------------------------------------
  // Bucle principal
  // ---------------------------------------------------------------------------

  private loop = (now: number): void => {
    const raw = Math.min(0.05, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    const instantFps = raw > 0 ? 1 / raw : 60;
    this.fpsSmooth += (instantFps - this.fpsSmooth) * 0.06;

    if (!this.paused && !this.drag) {
      this.accumulator += raw * this.speed;
      let steps = 0;
      while (this.accumulator >= this.dt && steps < 8) {
        this.world.step(this.dt);
        this.accumulator -= this.dt;
        steps++;
      }
      if (steps === 8) this.accumulator = 0;
    }

    this.recordSelected();

    renderScene(this.canvas, this.world, this.camera, {
      selectedId: this.selectedId,
      showTraces: this.showTraces,
      showVectors: this.showVectors,
      showContacts: this.showContacts,
      drag: this.drag,
      ghost: this.ghost,
    });

    this.renderCharts();
    this.updateStatus();
    requestAnimationFrame(this.loop);
  };

  private updateStatus(): void {
    const bodies = this.world.bodies.length;
    const contacts = this.world.contacts.length;
    const body = this.selectedBody();
    const selection = body
      ? `sel #${body.id} · v=${body.speed.toFixed(2)} m/s · E=${this.world.energyOf(body).total.toFixed(1)} J`
      : 'sin selección';
    this.status.textContent = `t = ${this.world.time.toFixed(2)} s · cuerpos ${bodies} · contactos ${contacts} · ${selection} · ${INTEGRATOR_LABELS[this.world.config.integrator]}`;
    this.fpsEl.textContent = `${this.fpsSmooth.toFixed(0)} fps`;
  }

  // ---------------------------------------------------------------------------
  // Gráficas
  // ---------------------------------------------------------------------------

  private renderCharts(): void {
    this.chart2.classList.toggle('hidden', this.activeTab !== 'calculus');

    switch (this.activeTab) {
      case 'motion':
        this.renderMotionChart();
        break;
      case 'energy':
        this.renderEnergyChart();
        break;
      case 'calculus':
        this.renderCalculusPanel();
        break;
      case 'convergence':
        this.renderConvergenceChart();
        break;
    }
  }

  private decimate(values: number[], color: string, label: string, width = 1.8): ChartSeries {
    const frames = this.recorder.frames;
    const stride = Math.max(1, Math.ceil(frames.length / 700));
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < frames.length; i += stride) {
      x.push(frames[i].t);
      y.push(values[i]);
    }
    if (frames.length && (frames.length - 1) % stride !== 0) {
      x.push(frames[frames.length - 1].t);
      y.push(values[values.length - 1]);
    }
    return { x, y, color, label, width };
  }

  private terminalVelocity(body: Body): number | null {
    const { airModel, airDensity, dragCoefficient, gravityY } = this.world.config;
    if (airModel === 'none' || airDensity <= 0 || dragCoefficient <= 0 || gravityY === 0) return null;
    const weight = body.mass * Math.abs(gravityY);
    if (airModel === 'quadratic') {
      const k = 0.5 * airDensity * dragCoefficient * Math.PI * body.radius * body.radius;
      return Math.sqrt(weight / k);
    }
    const b = 4 * airDensity * dragCoefficient * body.radius;
    return weight / b;
  }

  private renderMotionChart(): void {
    const frames = this.recorder.frames;
    if (frames.length < 2) {
      drawChart(this.chart, { series: [], emptyMessage: 'Sin datos: reanuda o pulsa Paso' });
      return;
    }

    const body = this.selectedBody();
    const terminal = body ? this.terminalVelocity(body) : null;
    const series = [
      this.decimate(frames.map((frame) => frame.y), '#4cc9f0', 'y (m)'),
      this.decimate(frames.map((frame) => frame.vy), '#80ed99', 'vy', 1.8),
      this.decimate(frames.map((frame) => frame.ay), '#ff8fab', 'ay', 1.4),
    ];

    const values = [...series.flatMap((item) => item.y)];
    if (terminal) values.push(-terminal);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.08 || 1;

    drawChart(this.chart, {
      series,
      xLabel: 't (s)',
      yLabel: 'posición / velocidad / aceleración',
      yRange: [min - pad, max + pad],
      referenceLines:
        terminal !== null
          ? [{ y: -terminal, color: '#ffd166', label: `v_t = ${terminal.toFixed(2)} m/s`, dash: [6, 4] }]
          : [],
    });
  }

  private renderEnergyChart(): void {
    const frames = this.recorder.frames;
    if (frames.length < 2) {
      drawChart(this.chart, { series: [], emptyMessage: 'Sin datos: reanuda o pulsa Paso' });
      return;
    }

    drawChart(this.chart, {
      series: [
        this.decimate(frames.map((frame) => frame.ke), '#4cc9f0', 'cinética'),
        this.decimate(frames.map((frame) => frame.pe), '#b388ff', 'potencial'),
        this.decimate(frames.map((frame) => frame.energy), '#80ed99', 'total', 2.2),
      ],
      xLabel: 't (s)',
      yLabel: 'energía (J)',
    });
  }

  private renderCalculusPanel(): void {
    const frames = this.recorder.frames;

    if (frames.length < 4) {
      drawChart(this.chart, { series: [], emptyMessage: 'Lanza o selecciona un cuerpo con datos' });
    } else {
      const [t0, t1] = this.recorder.timeRange();
      const h = this.deriveH;
      const signalValues = frames.map((frame) =>
        this.deriveSignal === 'x' ? frame.x : this.deriveSignal === 'y' ? frame.y : frame.speed,
      );
      const series: Series = { t: frames.map((frame) => frame.t), y: signalValues };

      const numeric: number[] = [];
      const truth: number[] = [];
      let errorSum = 0;
      let samples = 0;

      for (const frame of frames) {
        if (frame.t - h < t0 || frame.t + h > t1) {
          numeric.push(NaN);
          truth.push(NaN);
          continue;
        }
        const derivative = centralDifference(series, frame.t, h);
        const trueDerivative =
          this.deriveSignal === 'x'
            ? frame.vx
            : this.deriveSignal === 'y'
              ? frame.vy
              : (frame.vx * frame.ax + frame.vy * frame.ay) / Math.max(frame.speed, 1e-6);

        numeric.push(derivative);
        truth.push(trueDerivative);
        errorSum += Math.abs(derivative - trueDerivative);
        samples++;
      }

      const signalLabel =
        this.deriveSignal === 'x' ? 'x (m)' : this.deriveSignal === 'y' ? 'y (m)' : '|v| (m/s)';
      const derivativeLabel =
        this.deriveSignal === 'x' ? 'dx/dt ≈ vx' : this.deriveSignal === 'y' ? 'dy/dt ≈ vy' : 'd|v|/dt';

      drawChart(this.chart, {
        series: [
          this.decimate(signalValues, '#4cc9f0', signalLabel, 2),
          this.decimate(numeric, '#ffd166', `numérica h=${formatH(h)}`, 1.6),
          this.decimate(truth, '#80ed99', 'simulador', 1.4),
        ],
        xLabel: 't (s)',
        yLabel: 'señal y derivadas',
      });

      if (performance.now() - this.lastResultsPaint > 180) {
        this.lastResultsPaint = performance.now();
        this.paintCalculusResults(frames, samples, samples > 0 ? errorSum / samples : NaN, signalLabel, derivativeLabel);
      }
    }

    this.renderStepSizeCurve();
  }

  private paintCalculusResults(
    frames: RecordedFrame[],
    samples: number,
    meanError: number,
    signalLabel: string,
    derivativeLabel: string,
  ): void {
    const container = document.getElementById('calcResults');
    if (!container) return;

    const [t0, t1] = this.recorder.timeRange();
    const speedSeries: Series = {
      t: frames.map((frame) => frame.t),
      y: frames.map((frame) => frame.speed),
    };
    const path = this.recorder.pathLength();
    const displacement = this.recorder.displacement();
    const methods = Object.keys(QUADRATURE_LABELS) as QuadratureMethod[];

    const rows = methods
      .map((method) => {
        const value = integrateSeries(speedSeries, t0, t1, this.quadN, method);
        const error = Math.abs(value - path);
        const percent = path > 1e-9 ? (error / path) * 100 : 0;
        const highlight = method === this.quadMethod ? ' class="good"' : '';
        return `<tr${highlight}><td>${QUADRATURE_LABELS[method]}</td><td>${value.toFixed(3)} m · ${percent.toFixed(2)}%</td></tr>`;
      })
      .join('');

    const body = this.selectedBody();
    const terminal = body ? this.terminalVelocity(body) : null;

    container.innerHTML = `
      <b>${signalLabel}</b> · derivada central<br />
      ${derivativeLabel} · h = ${formatH(this.deriveH)} s · error medio = ${Number.isFinite(meanError) ? meanError.toExponential(2) : '—'} (${samples} muestras)<br />
      <b>Integral de |v| dt</b> · n = ${this.quadN} · trayectoria real = ${path.toFixed(3)} m<br />
      desplazamiento neto = ${displacement.toFixed(3)} m
      <table>${rows}</table>
      ${terminal !== null ? `v terminal = ${terminal.toFixed(2)} m/s` : ''}
    `;
  }

  private renderStepSizeCurve(): void {
    const test = TEST_FUNCTIONS.find((fn) => fn.id === this.testFunctionId) ?? TEST_FUNCTIONS[0];
    const hs: number[] = [];
    for (let exponent = -7; exponent <= -0.3; exponent += 0.2) {
      hs.push(Math.pow(10, exponent));
    }

    const points = derivativeErrorVsH(test.f, test.df, hs, test.range, 30);
    drawChart(this.chart2, {
      series: [
        {
          x: points.map((point) => point.h),
          y: points.map((point) => point.err),
          color: '#f72585',
          label: `error de la derivada de ${test.label}`,
          width: 2,
        },
      ],
      logX: true,
      logY: true,
      xLabel: 'h (s)',
      yLabel: 'error medio',
    });
  }

  private renderConvergenceChart(): void {
    if (!this.convergence.length) {
      drawChart(this.chart, {
        series: [],
        emptyMessage: 'Pulsa "Ejecutar análisis de convergencia"',
      });
      return;
    }

    drawChart(this.chart, {
      series: this.convergence.map((result) => ({
        x: result.points.map((point) => point.dt),
        y: result.points.map((point) => point.error),
        color: result.color,
        label: `${SHORT_INTEGRATOR_LABELS[result.integrator]} p=${result.slope.toFixed(1)}`,
        width: 2,
      })),
      logX: true,
      logY: true,
      xLabel: 'dt (s)',
      yLabel: 'error final (m)',
    });
  }

  private runConvergenceAnalysis(): void {
    if (this.convergenceBusy) return;
    this.convergenceBusy = true;

    const container = document.getElementById('convResults');
    if (container) container.textContent = 'Calculando…';

    const radius = Number(this.radiusInput.value);
    const mass = Number(this.massInput.value);
    const restitution = Number(this.restitutionInput.value);
    const friction = Number(this.frictionInput.value);
    const launch: LaunchSpec =
      this.lastLaunch ?? {
        position: new Vec2(2, 1.5),
        velocity: new Vec2(8, 10),
        radius,
        mass,
        restitution,
        friction,
      };

    window.setTimeout(() => {
      const analysisConfig = { ...this.world.config };
      if (analysisConfig.airModel === 'none') {
        analysisConfig.airModel = 'quadratic';
        analysisConfig.airDensity = Math.max(analysisConfig.airDensity, 1.2);
        analysisConfig.dragCoefficient = Math.max(analysisConfig.dragCoefficient, 0.6);
      }
      if (analysisConfig.gravityY === 0) analysisConfig.gravityY = -9.81;

      this.convergence = runConvergence(analysisConfig, launch, 2);
      this.convergenceBusy = false;

      if (!container) return;
      const rows = this.convergence
        .map(
          (result) =>
            `<div><b>${result.label}</b>: pendiente ${result.slope.toFixed(2)} (esperado ${EXPECTED_SLOPES[result.integrator]})</div>`,
        )
        .join('');
      container.innerHTML = `${rows}<div style="margin-top:6px">Pendiente positiva ⇒ error ∝ dt^p: al reducir dt, el error cae. Se usa arrastre cuadrático si el entorno no tiene aire. Referencia: RK4 con dt = 1/8192.</div>`;
    }, 30);
  }
}
