/**
 * Partículas con pool fijo y actualización por ticks de simulación.
 * El azar se toma de un RNG inyectado (en el plugin, un fork del RNG de la sim,
 * nunca el original). Los eventos del motor se convierten en emisiones.
 */

import type { EnginePlugin, PluginAPI } from '../core/plugins.js';
import type { RNG } from '../core/rng.js';
import type { GameEvent } from '../core/types.js';
import { EVENT_FANOUT_SERVICE, type EventFanout } from './event-fanout.js';

export const PARTICLES_SERVICE = 'particles';

export type ParticleShape = 'square' | 'circle' | 'line';

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Vida restante en ticks. */
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  /** Factor de frenado por tick, en [0, 1]. */
  drag: number;
  shape: ParticleShape;
}

export interface ParticleBurst {
  readonly count: number;
  readonly life: number;
  readonly speed: number;
  /** Velocidad adicional aleatoria en [0, spread). */
  readonly spread?: number;
  /** Dirección central en radianes. */
  readonly angle?: number;
  /** Amplitud angular en radianes; por defecto círculo completo. */
  readonly arc?: number;
  readonly gravity?: number;
  readonly drag?: number;
  readonly size?: number;
  readonly color?: string;
  readonly shape?: ParticleShape;
}

export interface ParticleEmitter extends ParticleBurst {
  /** Tipo de GameEvent que dispara la emisión. */
  readonly event: string;
}

export interface ParticleSystemOptions {
  readonly rng: RNG;
  readonly capacity?: number;
  readonly emitters?: readonly ParticleEmitter[];
}

export interface ParticleSystem {
  /** Pool completo; las partículas inactivas permanecen en el array. */
  readonly particles: readonly Particle[];
  readonly capacity: number;
  readonly activeCount: number;
  emit(x: number, y: number, burst: ParticleBurst): number;
  /** Avanza N ticks de simulación (uno por defecto). */
  update(ticks?: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  handle(event: GameEvent): void;
  consume(events: readonly GameEvent[]): void;
  clear(): void;
  snapshot(): Particle[];
  restore(particles: readonly Particle[]): void;
}

function positionOf(payload: unknown): { x: number; y: number } | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const candidate = payload as { x?: unknown; y?: unknown };
  if (
    typeof candidate.x !== 'number' ||
    typeof candidate.y !== 'number' ||
    !Number.isFinite(candidate.x) ||
    !Number.isFinite(candidate.y)
  ) {
    return null;
  }
  return { x: candidate.x, y: candidate.y };
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function blankParticle(): Particle {
  return {
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 0,
    size: 1,
    color: '#fff',
    gravity: 0,
    drag: 0,
    shape: 'square',
  };
}

export function createParticles(options: ParticleSystemOptions): ParticleSystem {
  const capacity = options.capacity ?? 256;
  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new RangeError('createParticles: capacity debe ser un entero > 0');
  }

  const pool: Particle[] = Array.from({ length: capacity }, blankParticle);
  const emitters = new Map<string, ParticleEmitter>();
  for (const emitter of options.emitters ?? []) emitters.set(emitter.event, emitter);
  let cursor = 0;

  function acquire(): Particle | null {
    for (let offset = 0; offset < capacity; offset++) {
      const index = (cursor + offset) % capacity;
      const particle = pool[index];
      if (particle !== undefined && !particle.active) {
        cursor = (index + 1) % capacity;
        return particle;
      }
    }
    return null;
  }

  const system: ParticleSystem = {
    particles: pool,
    capacity,
    get activeCount(): number {
      let count = 0;
      for (const particle of pool) if (particle.active) count++;
      return count;
    },
    emit(x: number, y: number, burst: ParticleBurst): number {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
      const requested = Math.floor(finite(burst.count, 0));
      const count = Math.max(0, Math.min(capacity, requested));
      const lifeValue = finite(burst.life, 1);
      const life = Number.isInteger(lifeValue) && lifeValue > 0 ? lifeValue : 1;
      const speed = Math.max(0, finite(burst.speed, 0));
      const spread = Math.max(0, finite(burst.spread, 0));
      const angle = finite(burst.angle, 0);
      const arc = finite(burst.arc, Math.PI * 2);
      const fullCircle = Math.abs(arc - Math.PI * 2) < 1e-9;
      const gravity = finite(burst.gravity, 0);
      const drag = Math.max(0, Math.min(1, finite(burst.drag, 0)));
      const size = Math.max(0, finite(burst.size, 2));
      const color = burst.color ?? '#fff';
      const shape = burst.shape ?? 'square';

      let spawned = 0;
      for (let i = 0; i < count; i++) {
        const particle = acquire();
        if (!particle) break;
        const direction = fullCircle
          ? options.rng.next() * Math.PI * 2
          : angle + (options.rng.next() - 0.5) * arc;
        const magnitude = speed + options.rng.next() * spread;
        particle.active = true;
        particle.x = x;
        particle.y = y;
        particle.vx = Math.cos(direction) * magnitude;
        particle.vy = Math.sin(direction) * magnitude;
        particle.life = life;
        particle.maxLife = life;
        particle.size = size;
        particle.color = color;
        particle.gravity = gravity;
        particle.drag = drag;
        particle.shape = shape;
        spawned++;
      }
      return spawned;
    },
    update(ticks: number = 1): void {
      if (!Number.isInteger(ticks) || ticks < 0) return;
      for (let step = 0; step < ticks; step++) {
        for (const particle of pool) {
          if (!particle.active) continue;
          particle.vy += particle.gravity;
          particle.vx *= 1 - particle.drag;
          particle.vy *= 1 - particle.drag;
          particle.x += particle.vx;
          particle.y += particle.vy;
          particle.life--;
          if (particle.life <= 0) particle.active = false;
        }
      }
    },
    draw(ctx: CanvasRenderingContext2D): void {
      ctx.save();
      for (const particle of pool) {
        if (!particle.active) continue;
        const ratio =
          particle.maxLife > 0 ? Math.max(0, Math.min(1, particle.life / particle.maxLife)) : 0;
        ctx.globalAlpha = ratio;
        if (particle.shape === 'circle') {
          ctx.fillStyle = particle.color;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (particle.shape === 'line') {
          ctx.strokeStyle = particle.color;
          ctx.beginPath();
          ctx.moveTo(particle.x, particle.y);
          ctx.lineTo(particle.x - particle.vx * 2, particle.y - particle.vy * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = particle.color;
          ctx.fillRect(
            particle.x - particle.size / 2,
            particle.y - particle.size / 2,
            particle.size,
            particle.size,
          );
        }
      }
      ctx.restore();
    },
    handle(event: GameEvent): void {
      const emitter = emitters.get(event.type);
      if (!emitter) return;
      const position = positionOf(event.payload);
      if (!position) return;
      system.emit(position.x, position.y, emitter);
    },
    consume(events: readonly GameEvent[]): void {
      for (const event of events) system.handle(event);
    },
    clear(): void {
      for (const particle of pool) particle.active = false;
      cursor = 0;
    },
    snapshot(): Particle[] {
      return pool.map((particle) => ({ ...particle }));
    },
    restore(particles: readonly Particle[]): void {
      for (let i = 0; i < capacity; i++) {
        const particle = pool[i];
        const source = particles[i];
        if (!particle || !source) continue;
        Object.assign(particle, source);
        particle.active = source.active === true;
      }
      cursor = 0;
    },
  };

  return system;
}

export interface ParticlesPluginOptions {
  readonly system?: ParticleSystem;
  readonly rng?: RNG;
  readonly capacity?: number;
  readonly emitters?: readonly ParticleEmitter[];
}

/**
 * Plugin de partículas. Requiere el distribuidor de eventos para no drenar dos
 * veces la cola del motor. El RNG se deriva con fork(): la simulación no cambia.
 */
export function particlesPlugin(options: ParticlesPluginOptions = {}): EnginePlugin {
  let system: ParticleSystem | undefined;

  return {
    id: PARTICLES_SERVICE,
    version: '1.0.0',
    requires: [EVENT_FANOUT_SERVICE],
    install(api: PluginAPI): void {
      const fanout = api.services.get<EventFanout>(EVENT_FANOUT_SERVICE);
      const created =
        options.system ??
        createParticles({
          rng: options.rng ?? api.rng.fork(0x50415254),
          ...(options.capacity !== undefined ? { capacity: options.capacity } : {}),
          ...(options.emitters !== undefined ? { emitters: options.emitters } : {}),
        });
      system = created;
      api.services.provide(PARTICLES_SERVICE, created);
      fanout.subscribe((events) => created.consume(events));
    },
    dispose(): void {
      system?.clear();
    },
  };
}
