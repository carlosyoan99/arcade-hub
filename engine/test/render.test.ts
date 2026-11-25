import { describe, expect, it, vi } from 'vitest';
import { createClock } from '../src/core/clock.js';
import { createEvents } from '../src/core/events.js';
import { createPluginRegistry, createServiceRegistry } from '../src/core/plugins.js';
import { createRNG } from '../src/core/rng.js';
import { createScheduler } from '../src/core/scheduler.js';
import { createActionState } from '../src/input/actions.js';
import { computeLetterbox, createCanvasRenderer } from '../src/render/canvas2d.js';
import { createCamera } from '../src/render/camera.js';
import { eventFanoutPlugin, EVENT_FANOUT_SERVICE } from '../src/render/event-fanout.js';
import { createParticles, particlesPlugin, PARTICLES_SERVICE } from '../src/render/particles.js';
import { drawSprite, frameOrigin } from '../src/render/sprites.js';
import { drawBar, drawCorners, drawText } from '../src/render/ui-draw.js';

function stubContext() {
  const param = {
    value: 1,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    drawImage: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    globalAlpha: 1,
    fillStyle: '#000',
    strokeStyle: '#000',
    font: '10px sans-serif',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    lineWidth: 1,
    param,
  };
}

type StubContext = ReturnType<typeof stubContext>;
const asContext = (stub: StubContext): CanvasRenderingContext2D =>
  stub as unknown as CanvasRenderingContext2D;

function stubCanvas(width: number, height: number, clientWidth = 0, clientHeight = 0) {
  const ctx = stubContext();
  const canvas = {
    width,
    height,
    clientWidth,
    clientHeight,
    getContext: vi.fn(() => asContext(ctx)),
  };
  return { canvas: canvas as unknown as HTMLCanvasElement, ctx };
}

function makeRegistry(plugins: Parameters<typeof createPluginRegistry>[0]) {
  const clock = createClock(1 / 60);
  const services = createServiceRegistry();
  const events = createEvents(() => clock.tick);
  return {
    services,
    events,
    registry: createPluginRegistry(
      plugins,
      {
        clock,
        rng: createRNG(7),
        events,
        scheduler: createScheduler(clock),
        actions: createActionState(),
      },
      services,
    ),
  };
}

describe('canvas2d: resize y letterbox', () => {
  it('computeLetterbox es puro, centrado y respeta DPR', () => {
    const box = computeLetterbox(800, 600, 400, 300, 2);
    expect(box.scale).toBe(2);
    expect(box.css).toEqual({ x: 0, y: 0, width: 800, height: 600 });
    expect(box.device).toEqual({ x: 0, y: 0, width: 1600, height: 1200 });
  });

  it('abella lateralmente cuando el viewport es más ancho', () => {
    const box = computeLetterbox(1000, 500, 400, 300, 1);
    expect(box.scale).toBeCloseTo(5 / 3, 10);
    expect(box.css.width).toBeCloseTo(666.6667, 3);
    expect(box.css.x).toBeCloseTo(166.6667, 3);
    expect(box.css.y).toBe(0);
  });

  it('resize es determinista y ajusta el backing store al DPR inyectado', () => {
    const { canvas } = stubCanvas(10, 10, 1000, 500);
    const renderer = createCanvasRenderer(canvas, { width: 400, height: 300, dpr: 2 });
    const first = renderer.resize();
    const snapshot = {
      width: canvas.width,
      height: canvas.height,
      scale: first.scale,
      x: first.device.x,
    };
    const second = renderer.resize();
    expect(canvas.width).toBe(2000);
    expect(canvas.height).toBe(1000);
    expect(second.scale).toBe(snapshot.scale);
    expect(second.device.x).toBe(snapshot.x);
    expect(snapshot.width).toBe(2000);
  });

  it('toWorld invierte el letterbox', () => {
    const { canvas } = stubCanvas(10, 10, 800, 600);
    const renderer = createCanvasRenderer(canvas, { width: 400, height: 300, dpr: 1 });
    const point = renderer.toWorld(200, 150);
    expect(point.x).toBeCloseTo(100, 10);
    expect(point.y).toBeCloseTo(75, 10);
  });

  it('rechaza dimensiones inválidas', () => {
    expect(() => computeLetterbox(0, 10, 10, 10)).toThrow(RangeError);
    expect(() => createCanvasRenderer(stubCanvas(10, 10).canvas, { width: -1, height: 10 })).toThrow(
      RangeError,
    );
  });
});

describe('cámara', () => {
  it('follow con factor 1 salta y con 0.5 interpola', () => {
    const camera = createCamera({ width: 100, height: 100 });
    camera.follow({ x: 200, y: 200 });
    expect(camera.snapshot()).toEqual({ x: 200, y: 200, zoom: 1 });
    camera.set(0, 0);
    camera.follow({ x: 200, y: 200 }, 0.5);
    expect(camera.x).toBe(100);
    expect(camera.y).toBe(100);
  });

  it('clamp mantiene la vista dentro del mundo', () => {
    const camera = createCamera({ width: 100, height: 100 });
    camera.set(1000, -50);
    camera.clamp({ x: 0, y: 0, width: 400, height: 400 });
    expect(camera.snapshot()).toEqual({ x: 350, y: 50, zoom: 1 });
  });

  it('clamp centra si el mundo es más pequeño que la vista', () => {
    const camera = createCamera({ width: 100, height: 100 });
    camera.set(999, 999);
    camera.clamp({ x: 10, y: 20, width: 40, height: 40 });
    expect(camera.snapshot()).toEqual({ x: 30, y: 40, zoom: 1 });
  });

  it('apply Translation y escala en orden', () => {
    const stub = stubContext();
    const camera = createCamera({ width: 200, height: 100, x: 10, y: 20, zoom: 2 });
    camera.apply(asContext(stub));
    expect(stub.translate.mock.calls).toEqual([
      [100, 50],
      [-10, -20],
    ]);
    expect(stub.scale).toHaveBeenCalledWith(2, 2);
  });
});

describe('partículas', () => {
  it('avanza por ticks y libera partículas al expirar', () => {
    const system = createParticles({ rng: createRNG(1), capacity: 4 });
    const spawned = system.emit(5, 6, { count: 1, life: 3, speed: 0 });
    expect(spawned).toBe(1);
    expect(system.activeCount).toBe(1);
    const particle = system.particles[0];
    expect(particle).toBeDefined();

    system.update(2);
    expect(system.particles[0]?.life).toBe(1);
    expect(system.activeCount).toBe(1);
    system.update();
    expect(system.activeCount).toBe(0);
    expect(system.particles[0]?.active).toBe(false);
  });

  it('usa el RNG inyectado y respeta el pool', () => {
    const rng = createRNG(123);
    const before = rng.state;
    const system = createParticles({ rng, capacity: 2 });
    expect(system.emit(0, 0, { count: 5, life: 2, speed: 10 })).toBe(2);
    expect(system.activeCount).toBe(2);
    expect(rng.state).not.toBe(before);
    expect(system.emit(0, 0, { count: 1, life: 2, speed: 0 })).toBe(0);
  });

  it('convierte eventos del motor en emisiones', () => {
    const system = createParticles({
      rng: createRNG(9),
      emitters: [{ event: 'hit', count: 3, life: 2, speed: 1, color: '#f0f' }],
    });
    system.consume([
      { type: 'hit', payload: { x: 3, y: 4 }, tick: 0 },
      { type: 'hit', payload: { x: 'bad', y: 4 }, tick: 1 },
      { type: 'other', payload: { x: 1, y: 2 }, tick: 2 },
    ]);
    expect(system.activeCount).toBe(3);
    expect(system.particles[0]?.color).toBe('#f0f');
    expect(system.particles[0]?.x).toBe(3);
  });

  it('el plugin publica el servicio y reparte eventos sin drenar dos veces', () => {
    const { registry, services, events } = makeRegistry([
      eventFanoutPlugin(),
      particlesPlugin({
        emitters: [{ event: 'explode', count: 1, life: 4, speed: 0 }],
      }),
    ]);
    expect(services.has(PARTICLES_SERVICE)).toBe(true);
    const system = services.get<ReturnType<typeof createParticles>>(PARTICLES_SERVICE);
    expect(services.has(EVENT_FANOUT_SERVICE)).toBe(true);
    expect(system.activeCount).toBe(0);
    events.emit('explode', { x: 1, y: 2 });
    registry.postStep();
    expect(system.activeCount).toBe(1);
    expect(events.peek()).toEqual([]);
    expect(registry.plugins.map((plugin) => plugin.id)).toEqual([
      EVENT_FANOUT_SERVICE,
      PARTICLES_SERVICE,
    ]);
  });
});

describe('sprites y ui-draw', () => {
  it('frameOrigin calcula índices de atlas', () => {
    expect(frameOrigin(0, 4, 16, 16)).toEqual({ x: 0, y: 0 });
    expect(frameOrigin(5, 4, 16, 16)).toEqual({ x: 16, y: 16 });
  });

  it('drawSprite aplica transformaciones al ctx', () => {
    const stub = stubContext();
    const sprite = { image: {} as CanvasImageSource, frameWidth: 16, frameHeight: 16, anchorX: 0.5, anchorY: 0.5 };
    drawSprite(asContext(stub), sprite, {
      x: 10,
      y: 20,
      rotation: Math.PI / 2,
      flipX: true,
      alpha: 0.5,
      frame: 1,
      columns: 2,
    });
    expect(stub.translate).toHaveBeenCalledWith(10, 20);
    expect(stub.scale).toHaveBeenCalledWith(-1, 1);
    expect(stub.drawImage).toHaveBeenCalledWith(sprite.image, 16, 0, 16, 16, -8, -8, 16, 16);
    expect(stub.globalAlpha).toBe(0.5);
    expect(stub.restore).toHaveBeenCalled();
  });

  it('primitivas de HUD dibujan texto, barra y esquinas', () => {
    const stub = stubContext();
    const ctx = asContext(stub);
    drawText(ctx, 'Puntos', 1, 2, { color: '#fff' });
    drawBar(ctx, 0, 0, { width: 100, height: 10, value: 5, max: 10 });
    drawCorners(ctx, 0, 0, 100, 50);
    expect(stub.fillText).toHaveBeenCalledWith('Puntos', 1, 2, undefined);
    expect(stub.fillRect).toHaveBeenCalledWith(0, 0, 100, 10);
    expect(stub.fillRect).toHaveBeenCalledWith(0, 0, 50, 10);
    expect(stub.stroke).toHaveBeenCalled();
  });
});
