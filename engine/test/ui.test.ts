import { describe, expect, it } from 'vitest';
import { createClock } from '../src/core/clock.js';
import { createEvents } from '../src/core/events.js';
import { createPluginRegistry, createServiceRegistry } from '../src/core/plugins.js';
import { createRNG } from '../src/core/rng.js';
import { createScheduler } from '../src/core/scheduler.js';
import { createActionState } from '../src/input/actions.js';
import { createStorage, memoryStorage } from '../src/store/storage.js';
import { createHelp, formatHelp, helpPlugin, HELP_SERVICE } from '../src/ui/help.js';
import { createHud, hudPlugin, HUD_SERVICE } from '../src/ui/hud.js';
import { createSettings, settingsPlugin, SETTINGS_SERVICE } from '../src/ui/settings.js';
import { createShell, shellPlugin, SHELL_SERVICE } from '../src/ui/shell.js';

describe('shell', () => {
  it('es inerte en Node pero mantiene el estado lógico', () => {
    const shell = createShell({ title: 'Prueba' });
    expect(shell.element).toBeNull();
    expect(shell.liveRegion).toBeNull();
    shell.setMenu([
      { id: 'play', label: 'Jugar' },
      { id: 'quit', label: 'Salir' },
    ]);
    expect(shell.menuItems.map((item) => item.id)).toEqual(['play', 'quit']);
    shell.openOverlay('Ayuda', 'texto');
    expect(shell.overlayName).toBe('Ayuda');
    shell.announce('Partida terminada', 'assertive');
    expect(shell.lastAnnouncement).toBe('Partida terminada');
    shell.closeOverlay();
    expect(shell.overlayName).toBeNull();
    shell.dispose();
  });

  it('registra callbacks de menú y permite darse de baja', () => {
    const shell = createShell();
    const seen: string[] = [];
    const off = shell.onSelect((id) => seen.push(id));
    off();
    expect(seen).toEqual([]);
    shell.dispose();
  });

  it('el plugin publica el servicio', () => {
    const clock = createClock(1 / 60);
    const services = createServiceRegistry();
    const registry = createPluginRegistry(
      [shellPlugin()],
      {
        clock,
        rng: createRNG(1),
        events: createEvents(() => clock.tick),
        scheduler: createScheduler(clock),
        actions: createActionState(),
      },
      services,
    );
    expect(services.has(SHELL_SERVICE)).toBe(true);
    registry.dispose();
  });
});

describe('hud y ayuda', () => {
  it('hud acumula campos sin DOM', () => {
    const hud = createHud();
    expect(hud.element).toBeNull();
    hud.update([
      { label: 'Puntos', value: 10 },
      { label: 'Vidas', value: 3 },
    ]);
    hud.set('Puntos', 20);
    expect(hud.values).toEqual({ Puntos: '20', Vidas: '3' });
    hud.dispose();
  });

  it('help usa el overlay del shell y formatea entradas', () => {
    const shell = createShell();
    const help = createHelp({
      shell,
      content: { title: 'Controles', entries: [{ keys: 'Space', description: 'Saltar' }] },
    });
    expect(formatHelp(help.content)).toBe('Space — Saltar');
    help.open();
    expect(help.isOpen).toBe(true);
    expect(shell.overlayName).toBe('Controles');
    help.close();
    expect(help.isOpen).toBe(false);
    expect(shell.overlayName).toBeNull();
    help.dispose();
  });

  it('los plugins de hud y ayuda publican sus servicios', () => {
    const clock = createClock(1 / 60);
    const services = createServiceRegistry();
    const registry = createPluginRegistry(
      [shellPlugin(), hudPlugin(), helpPlugin()],
      {
        clock,
        rng: createRNG(1),
        events: createEvents(() => clock.tick),
        scheduler: createScheduler(clock),
        actions: createActionState(),
      },
      services,
    );
    expect(services.has(HUD_SERVICE)).toBe(true);
    expect(services.has(HELP_SERVICE)).toBe(true);
    registry.dispose();
  });
});

describe('ajustes', () => {
  it('remapea teclas, persiste versión y respeta reduced motion inyectado', () => {
    const adapter = memoryStorage();
    const store = createStorage(adapter);
    const settings = createSettings({ store, reducedMotion: true, defaults: { Space: 'primary' } });
    expect(settings.reducedMotion).toBe(true);
    expect(settings.rebind('KeyF', 'fire')).toBe(true);
    expect(settings.snapshot()).toEqual({ Space: 'primary', KeyF: 'fire' });
    expect(settings.rebind('', 'fire')).toBe(false);

    settings.setReducedMotion(false);
    expect(settings.reducedMotion).toBe(false);
    const raw = store.raw('arcade.settings');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw ?? '{}')).toEqual({
      v: 1,
      data: { bindings: { Space: 'primary', KeyF: 'fire' }, reducedMotion: false },
    });

    settings.reset();
    expect(settings.snapshot()).toEqual({ Space: 'primary' });
    settings.dispose();
  });

  it('descarta datos de ajustes inválidos', () => {
    const adapter = memoryStorage({ 'arcade.settings': JSON.stringify({ v: 1, data: { bindings: 5, reducedMotion: false } }) });
    const settings = createSettings({ store: createStorage(adapter), defaults: { Enter: 'confirm' } });
    expect(settings.snapshot()).toEqual({ Enter: 'confirm' });
  });

  it('el plugin publica el servicio', () => {
    const clock = createClock(1 / 60);
    const services = createServiceRegistry();
    const registry = createPluginRegistry(
      [settingsPlugin({ store: createStorage(memoryStorage()) })],
      {
        clock,
        rng: createRNG(1),
        events: createEvents(() => clock.tick),
        scheduler: createScheduler(clock),
        actions: createActionState(),
      },
      services,
    );
    expect(services.has(SETTINGS_SERVICE)).toBe(true);
    registry.dispose();
  });
});
