/** Shell de UI accesible: menú, overlay de ayuda y región aria-live. Inerte en Node. */

import type { EnginePlugin } from '../core/plugins.js';

export const SHELL_SERVICE = 'ui.shell';

export interface MenuItem {
  readonly id: string;
  readonly label: string;
}

export type AnnouncePoliteness = 'polite' | 'assertive';

export interface ShellOptions {
  readonly title?: string;
  readonly doc?: Document;
  readonly root?: HTMLElement;
}

export interface UIShell {
  readonly element: HTMLElement | null;
  readonly liveRegion: HTMLElement | null;
  /** Nombre del overlay abierto, o null. */
  readonly overlayName: string | null;
  readonly lastAnnouncement: string;
  readonly menuItems: readonly MenuItem[];
  openOverlay(name: string, content?: string): void;
  closeOverlay(): void;
  announce(message: string, politeness?: AnnouncePoliteness): void;
  setMenu(items: readonly MenuItem[]): void;
  onSelect(handler: (id: string) => void): () => void;
  dispose(): void;
}

/** Documento global, o null en Node. Nunca lanza. */
export function getDocument(): Document | null {
  try {
    const doc = (globalThis as { document?: Document }).document;
    return doc ?? null;
  } catch {
    return null;
  }
}

export function createShell(options: ShellOptions = {}): UIShell {
  const doc = options.doc ?? getDocument();
  let root: HTMLElement | null = options.root ?? null;
  let element: HTMLElement | null = null;
  let live: HTMLElement | null = null;
  let overlay: HTMLElement | null = null;
  let overlayTitle: HTMLElement | null = null;
  let overlayBody: HTMLElement | null = null;
  let menu: HTMLElement | null = null;
  let currentOverlay: string | null = null;
  let lastAnnouncement = '';
  let menuItems: readonly MenuItem[] = [];
  const handlers = new Set<(id: string) => void>();

  if (doc) {
    if (!root) root = doc.body ?? null;
    if (root) {
      element = doc.createElement('div');
      element.className = 'arcade-shell';
      if (options.title !== undefined) element.setAttribute('aria-label', options.title);

      menu = doc.createElement('nav');
      menu.setAttribute('aria-label', 'Menú');

      overlay = doc.createElement('div');
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.hidden = true;
      overlayTitle = doc.createElement('h2');
      overlayBody = doc.createElement('div');
      overlay.appendChild(overlayTitle);
      overlay.appendChild(overlayBody);

      live = doc.createElement('div');
      live.className = 'arcade-shell-live';
      live.setAttribute('aria-live', 'polite');
      live.setAttribute('aria-atomic', 'true');

      element.appendChild(menu);
      element.appendChild(overlay);
      element.appendChild(live);
      root.appendChild(element);
    }
  }

  return {
    element,
    liveRegion: live,
    get overlayName(): string | null {
      return currentOverlay;
    },
    get lastAnnouncement(): string {
      return lastAnnouncement;
    },
    get menuItems(): readonly MenuItem[] {
      return menuItems;
    },
    openOverlay(name: string, content?: string): void {
      currentOverlay = name;
      if (overlay && overlayTitle && overlayBody) {
        overlayTitle.textContent = name;
        overlayBody.textContent = content ?? '';
        overlay.hidden = false;
      }
    },
    closeOverlay(): void {
      currentOverlay = null;
      if (overlay && overlayTitle && overlayBody) {
        overlay.hidden = true;
        overlayTitle.textContent = '';
        overlayBody.textContent = '';
      }
    },
    announce(message: string, politeness: AnnouncePoliteness = 'polite'): void {
      lastAnnouncement = message;
      if (live) {
        live.setAttribute('aria-live', politeness);
        live.textContent = message;
      }
    },
    setMenu(items: readonly MenuItem[]): void {
      menuItems = [...items];
      if (!menu || !doc) return;
      menu.replaceChildren();
      for (const item of menuItems) {
        const button = doc.createElement('button');
        button.type = 'button';
        button.textContent = item.label;
        button.dataset.action = item.id;
        button.addEventListener('click', () => {
          for (const handler of [...handlers]) handler(item.id);
        });
        menu.appendChild(button);
      }
    },
    onSelect(handler: (id: string) => void): () => void {
      handlers.add(handler);
      return (): void => {
        handlers.delete(handler);
      };
    },
    dispose(): void {
      element?.remove();
      handlers.clear();
      currentOverlay = null;
    },
  };
}

export function shellPlugin(options: ShellOptions = {}): EnginePlugin {
  let shell: UIShell | undefined;

  return {
    id: SHELL_SERVICE,
    version: '1.0.0',
    install(api): void {
      const created = createShell(options);
      shell = created;
      api.services.provide(SHELL_SERVICE, created);
    },
    dispose(): void {
      shell?.dispose();
    },
  };
}
