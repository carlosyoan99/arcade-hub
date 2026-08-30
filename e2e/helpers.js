import { games } from '../games.js';

export { games };

/** Errores de consola esperables en entornos headless con autoplay gate. */
export const BENIGN_ERRORS = [
  /AudioContext was not allowed to start/i,
  /play\(\) request was interrupted/i,
  /The request is not allowed by the user agent/i,
  /not allowed to start after user gesture/i,
  // El entorno de la suite puede no tener salida a internet: Google Fonts
  // falla con net::ERR_ADDRESS_UNREACHABLE. Los fallos de recursos locales se
  // siguen capturando vía httpErrors (requestfailed + isLocal).
  /Failed to load resource: net::ERR_(ADDRESS_UNREACHABLE|NAME_NOT_RESOLVED|CONNECTION_|EMPTY_RESPONSE)/i,
];

/**
 * Particularidades de arranque/movimiento de la suite, por id de juego. Solo
 * entran aquí los juegos que no responden a Space/Enter + flechas.
 */
export const GAME_HINTS = {
  // No arranca con teclas sueltas: pide escribir un nombre y Enter.
  'cell-swarm': { fill: { selector: '#nameInput', value: 'Arcade' } },
  // Sus diagonales son Q/E/A/D (WASD); las flechas no lo mueven.
  qbert: { moveKeys: ['KeyQ', 'KeyE', 'KeyA', 'KeyD'] },
  // Arrancan con dirección (flecha o WASD): Space es pausa en snake y no hace
  // nada en frogger. Al mandar ArrowUp en la primera ronda arrancan solos.
  snake: { startKeys: ['ArrowUp'] },
  frogger: { startKeys: ['ArrowUp'] },
};

export function isBenignMessage(text) {
  return BENIGN_ERRORS.some((re) => re.test(text));
}

const isFavicon = (url) => url.endsWith('/favicon.ico');

/**
 * True si la URL pertenece al mismo origen que el documento del hub (la app es
 * local y sin dependencias; así se ignoran recursos externos como Google Fonts,
 * que pueden no estar disponibles en el entorno de la suite).
 */
const isLocal = (url, pageUrl) => {
  try {
    return new URL(url).origin === new URL(pageUrl).origin;
  } catch {
    return false;
  }
};

/**
 * Escucha errores de consola, pageerrors y respuestas HTTP fallidas durante la
 * vida de una página. Con `filterUrl`, solo reporta mensajes cuyo origen
 * contiene esa URL (útil para aislar la actividad de un iframe dentro del hub).
 * Solo se consideran fallos HTTP de recursos del propio sitio (mismo origen).
 * @returns {{ errors: string[], httpErrors: string[], stop: () => void }}
 */
export function trackErrors(page, { filterUrl } = {}) {
  const errors = [];
  const httpErrors = [];
  const inScope = (url) => !filterUrl || (url ?? '').includes(filterUrl);

  const onConsole = (msg) => {
    if (msg.type() !== 'error' || isBenignMessage(msg.text())) return;
    if (inScope(msg.location()?.url ?? '')) errors.push(`console: ${msg.text()}`);
  };
  const onPageError = (err) => {
    if (inScope(String(err))) errors.push(`pageerror: ${err}`);
  };
  const onResponse = (res) => {
    if (
      res.status() >= 400 &&
      !isFavicon(res.url()) &&
      res.status() !== 404 &&
      isLocal(res.url(), page.url())
    ) {
      httpErrors.push(`HTTP ${res.status()} ${res.url()}`);
    }
  };
  const onRequestFailed = (req) => {
    if (!isFavicon(req.url()) && isLocal(req.url(), page.url())) {
      httpErrors.push(`REQUEST_FAILED ${req.url()} ${req.failure()?.errorText ?? ''}`);
    }
  };

  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('response', onResponse);
  page.on('requestfailed', onRequestFailed);

  return {
    errors,
    httpErrors,
    stop() {
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      page.off('response', onResponse);
      page.off('requestfailed', onRequestFailed);
    },
  };
}

/**
 * Estado de arranque de un juego. Acepta una Page (carga directa) o un Frame
 * (hub → iframe), que comparten evaluate().
 */
export function gameState(scope) {
  return scope.evaluate(() => {
    const loading = document.getElementById('loading');
    const overlay = document.getElementById('overlay');
    const canvas = document.getElementById('gameCanvas');
    // #overlay es position:fixed, así que offsetParent es siempre null y no
    // sirve como señal. Cada juego oculta su overlay a su manera: clase .hidden
    // con opacity:0 (la mayoría), display:none (qbert) o visibility. Se admite
    // cualquiera de esas tres para considerarlo comenzado.
    let started = !overlay;
    if (overlay) {
      const style = getComputedStyle(overlay);
      started =
        overlay.classList.contains('hidden') ||
        style.opacity === '0' ||
        style.display === 'none' ||
        style.visibility === 'hidden';
    }
    return {
      loadingGone: !loading || loading.classList.contains('hidden'),
      hasCanvas: !!canvas,
      hasOverlay: !!overlay,
      started,
    };
  });
}

/** Checksum de los píxeles de #gameCanvas (null si no hay canvas dibujable). */
export function canvasChecksum(scope) {
  return scope.evaluate(() => {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx || canvas.width === 0 || canvas.height === 0) return null;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 0;
    for (let i = 0; i < data.length; i += 64) hash = (hash * 33 + data[i]) >>> 0;
    return hash;
  });
}

/**
 * Dispara un keydown sintético en el documento del scope (Page o Frame).
 * page.keyboard no llega de forma fiable al iframe del hub en headless, pero
 * ningún juego comprueba isTrusted, así que un KeyboardEvent sintético es
 * funcionalmente igual y no depende del foco de la ventana. Se despacha sobre
 * document con bubbles → llega a los listeners de window (los juegos usan
 * onKey → window.addEventListener('keydown')).
 */
export function pressKey(scope, code) {
  return scope.evaluate((c) => {
    let key = c;
    if (c === 'Space') key = ' ';
    else if (c.startsWith('Key')) key = c.slice(3).toLowerCase();
    const ev = new KeyboardEvent('keydown', {
      code: c,
      key,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(ev);
  }, code);
}

/**
 * Espera a que el canvas esté dibujando (el checksum cambie desde la muestra
 * inicial). Algunos juegos abren con pantallas de "READY" que permanecen
 * estáticas un segundo y otros (qbert) NO animan pasivamente: esperan input
 * direccional del jugador. Por eso pasados ~2.5s de inactividad se envían
 * flechas para forzar movimiento real y re-verificar; solo se falla si el
 * canvas sigue congelado pese al input.
 */
export async function expectCanvasAnimating(
  scope,
  { timeout = 12000, moveKeys = ['ArrowLeft', 'ArrowRight', 'ArrowDown'] } = {},
) {
  const start = Date.now();
  let c0 = await canvasChecksum(scope);
  let d = 0;
  while (Date.now() - start < timeout) {
    if (Date.now() - start > 2500 && c0 !== null) {
      await pressKey(scope, moveKeys[d % moveKeys.length]);
      d++;
      await new Promise((r) => setTimeout(r, 120));
    }
    await new Promise((r) => setTimeout(r, 250));
    const c1 = await canvasChecksum(scope);
    if (c1 !== null && c1 !== c0) return;
    if (c0 === null) c0 = c1;
  }
  const last = await canvasChecksum(scope);
  throw new Error(`el canvas no animó (c0=${c0}, último=${last})`);
}

/**
 * Valores numéricos de campos de texto que parecen marcadores (score/puntos).
 * Señal adicional de gameplay; vacía en juegos que pintan el marcador en canvas.
 */
export function scoreFields(scope) {
  return scope.evaluate(() => {
    const fields = [];
    const seen = new Set();
    for (const el of document.querySelectorAll(
      '[id*="score" i], [id*="puntos" i], [id*="puntaje" i], [class*="score" i], [data-stat]',
    )) {
      const text = (el.textContent || '').trim();
      if (/^-?\d+$/.test(text)) {
        const key = `${el.id || el.className}:${text}`;
        if (!seen.has(key)) {
          seen.add(key);
          fields.push(parseInt(text, 10));
        }
      }
    }
    return fields;
  });
}

/**
 * Espera (con poll ligero) hasta que el estado del juego cumpla el predicado o
 * se agote el timeout. Devuelve el último estado leído.
 */
export async function waitForGameState(scope, predicate, { timeout = 10000, message } = {}) {
  const start = Date.now();
  for (;;) {
    const state = await gameState(scope);
    if (predicate(state)) return state;
    if (Date.now() - start > timeout) {
      throw new Error(
        `${message ?? 'el juego no alcanzó el estado esperado'}: ${JSON.stringify(state)}`,
      );
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}

/**
 * Busca (con poll) el iframe del juego cargado en el hub via hash #game/<id>.
 */
export async function waitForFrame(page, id, timeout = 10000) {
  const start = Date.now();
  for (;;) {
    const frame = page
      .frames()
      .find((f) => f.url().includes(`/games/${id}/`) && f.url().endsWith('index.html'));
    if (frame) return frame;
    if (Date.now() - start > timeout) throw new Error(`iframe de ${id} no apareció`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

/**
 * El entry overlay del hub nunca se oculta con display/opacity: se elimina del
 * DOM (dismissEntry grosero) o recibe la clase 'dismissed'.
 */
export const overlayGone = (page) =>
  page.evaluate(() => {
    const el = document.getElementById('entryOverlay');
    return !el || el.classList.contains('dismissed');
  });

/**
 * Instala un observer en el documento que anota `window.__entryOverlayAppeared`
 * en cuanto el entry overlay queda presente y NO oculto (aria-hidden != 'true'
 * y sin la clase 'dismissed'). Es inmune a la carrera con el auto-cierre de
 * ~7s: aunque el goto tarde (CPU contenida al correr la suite completa) y el
 * overlay ya se haya eliminado del DOM al inspeccionar, el flag queda registrado
 * durante la carga. addInitScript se ejecuta en CADA navegación (incl. reload),
 * así que el flag se reinicia y vuelve a registrarse para cada visita.
 */
export async function trackEntryOverlay(page) {
  await page.addInitScript(() => {
    window.__entryOverlayAppeared = false;
    const check = () => {
      const el = document.getElementById('entryOverlay');
      if (el && el.getAttribute('aria-hidden') !== 'true' && !el.classList.contains('dismissed')) {
        window.__entryOverlayAppeared = true;
      }
    };
    if (document.readyState !== 'loading') {
      check();
    } else {
      document.addEventListener('DOMContentLoaded', check);
    }
    try {
      new MutationObserver(check).observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'aria-hidden'],
      });
    } catch {
      // documentElement aún no disponible; DOMContentLoaded cubre el caso.
    }
  });
}

/**
 * Secuencia de arranque probada en todos los juegos del hub. Deja de enviar
 * inputs en cuanto el juego reporta `started` (una segunda tecla puede
 * reiniciarlo y bloquear su intro, como ocurre en defender). La secuencia por
 * defecto es Space/Enter; los juegos que arrancan con dirección (snake,
 * frogger) llevan startKeys en GAME_HINTS. No se envía click: un click en el
 * centro rompe juegos con HUD sensible (columns congela su loop). Las teclas se
 * despachan como eventos sintéticos directamente en el documento del scope
 * (page o frame), así el foco de la ventana es irrelevante.
 */
export async function bootGame(scope, { hints = {} } = {}) {
  if (hints.fill) {
    const input = scope.locator(hints.fill.selector);
    await input.fill(hints.fill.value);
    await input.press('Enter');
    await new Promise((r) => setTimeout(r, 300));
  }
  const startKeys = hints.startKeys ?? ['Space', 'Enter'];
  for (let i = 0; i < startKeys.length; i++) {
    if ((await gameState(scope)).started) break;
    await pressKey(scope, startKeys[i]);
    await new Promise((r) => setTimeout(r, 250));
  }
  await waitForGameState(scope, (s) => s.started && s.hasCanvas, {
    timeout: 5000,
    message: 'el juego no arrancó tras la secuencia de entrada',
  });
}
