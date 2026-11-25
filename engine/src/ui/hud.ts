/** HUD DOM del motor: campos etiquetados actualizables sin lógica de juego. */

import type { EnginePlugin } from '../core/plugins.js';
import { getDocument } from './shell.js';

export const HUD_SERVICE = 'ui.hud';

export interface HudField {
  readonly label: string;
  readonly value: string | number;
}

export interface HudOptions {
  readonly doc?: Document;
  readonly root?: HTMLElement;
}

export interface Hud {
  readonly element: HTMLElement | null;
  readonly values: Readonly<Record<string, string>>;
  update(fields: readonly HudField[]): void;
  set(label: string, value: string | number): void;
  dispose(): void;
}

export function createHud(options: HudOptions = {}): Hud {
  const doc = options.doc ?? getDocument();
  let root: HTMLElement | null = options.root ?? null;
  let element: HTMLElement | null = null;
  const nodes = new Map<string, HTMLElement>();
  const values = new Map<string, string>();

  if (doc) {
    if (!root) root = doc.body ?? null;
    if (root) {
      element = doc.createElement('div');
      element.className = 'arcade-hud';
      element.setAttribute('role', 'status');
      root.appendChild(element);
    }
  }

  return {
    element,
    get values(): Readonly<Record<string, string>> {
      return Object.fromEntries(values);
    },
    set(label: string, value: string | number): void {
      if (label.length === 0) return;
      const text = String(value);
      values.set(label, text);
      let node = nodes.get(label);
      if (!node && doc && element) {
        node = doc.createElement('span');
        node.className = 'arcade-hud-field';
        node.dataset.label = label;
        node.textContent = `${label}: ${text}`;
        element.appendChild(node);
        nodes.set(label, node);
      }
      if (node) node.textContent = `${label}: ${text}`;
    },
    update(fields: readonly HudField[]): void {
      for (const field of fields) this.set(field.label, field.value);
    },
    dispose(): void {
      element?.remove();
      nodes.clear();
      values.clear();
    },
  };
}

export function hudPlugin(options: HudOptions = {}): EnginePlugin {
  let hud: Hud | undefined;

  return {
    id: HUD_SERVICE,
    version: '1.0.0',
    install(api): void {
      const created = createHud(options);
      hud = created;
      api.services.provide(HUD_SERVICE, created);
    },
    dispose(): void {
      hud?.dispose();
    },
  };
}
