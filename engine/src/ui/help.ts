/** Ayuda accesible: contenido estructurado y apertura vía overlay del shell. */

import type { EnginePlugin } from '../core/plugins.js';
import { getDocument, SHELL_SERVICE, type UIShell } from './shell.js';

export const HELP_SERVICE = 'ui.help';

export interface HelpEntry {
  readonly keys: string;
  readonly description: string;
}

export interface HelpContent {
  readonly title: string;
  readonly entries: readonly HelpEntry[];
}

export const DEFAULT_HELP: HelpContent = {
  title: 'Ayuda',
  entries: [
    { keys: '← → / A D', description: 'Mover' },
    { keys: '↑ ↓ / W S', description: 'Mover arriba y abajo' },
    { keys: 'Espacio', description: 'Acción principal' },
    { keys: 'P / Esc', description: 'Pausa' },
    { keys: 'R', description: 'Reiniciar' },
  ],
};

export interface HelpOptions {
  readonly content?: HelpContent;
  readonly shell?: UIShell;
  readonly doc?: Document;
  readonly root?: HTMLElement;
}

export interface HelpUI {
  readonly content: HelpContent;
  readonly element: HTMLElement | null;
  readonly isOpen: boolean;
  open(): void;
  close(): void;
  dispose(): void;
}

export function formatHelp(content: HelpContent): string {
  return content.entries.map((entry) => `${entry.keys} — ${entry.description}`).join('\n');
}

export function createHelp(options: HelpOptions = {}): HelpUI {
  const content = options.content ?? DEFAULT_HELP;
  const shell = options.shell ?? null;
  const doc = options.doc ?? getDocument();
  let root: HTMLElement | null = options.root ?? null;
  let element: HTMLElement | null = null;
  let open = false;

  if (doc && shell === null) {
    if (!root) root = doc.body ?? null;
    if (root) {
      element = doc.createElement('section');
      element.className = 'arcade-help';
      element.hidden = true;
      const heading = doc.createElement('h2');
      heading.textContent = content.title;
      const list = doc.createElement('dl');
      for (const entry of content.entries) {
        const key = doc.createElement('dt');
        key.textContent = entry.keys;
        const description = doc.createElement('dd');
        description.textContent = entry.description;
        list.appendChild(key);
        list.appendChild(description);
      }
      element.appendChild(heading);
      element.appendChild(list);
      root.appendChild(element);
    }
  }

  return {
    content,
    element,
    get isOpen(): boolean {
      return open;
    },
    open(): void {
      open = true;
      if (shell) shell.openOverlay(content.title, formatHelp(content));
      else if (element) element.hidden = false;
    },
    close(): void {
      open = false;
      if (shell) shell.closeOverlay();
      else if (element) element.hidden = true;
    },
    dispose(): void {
      element?.remove();
      open = false;
    },
  };
}

export function helpPlugin(options: HelpOptions = {}): EnginePlugin {
  let help: HelpUI | undefined;

  return {
    id: HELP_SERVICE,
    version: '1.0.0',
    install(api): void {
      const shell = options.shell ?? (api.services.has(SHELL_SERVICE)
        ? api.services.get<UIShell>(SHELL_SERVICE)
        : null);
      const created = createHelp({
        ...(shell !== null ? { shell } : {}),
        ...(options.content !== undefined ? { content: options.content } : {}),
      });
      help = created;
      api.services.provide(HELP_SERVICE, created);
    },
    dispose(): void {
      help?.dispose();
    },
  };
}
