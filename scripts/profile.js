#!/usr/bin/env node
/**
 * scripts/profile.js — Performance profiling via Chrome DevTools Protocol
 *
 * Uso:  node scripts/profile.js [--game=<id>] [--duration=8000]
 */

import WebSocket from 'ws';
import http from 'http';
import { setTimeout as sleep } from 'timers/promises';

const DEBUG_PORT = 9222;
const BASE = 'http://localhost:8000';
const HEAVY_GAMES = ['neon-nexus', 'cell-swarm', 'defender', 'donkey-kong', 'joust'];
const DURATION = Number(
  process.argv.find((a) => a.startsWith('--duration='))?.split('=')[1] || 8000,
);
const SINGLE = process.argv.find((a) => a.startsWith('--game='))?.split('=')[1];
const GAMES = SINGLE ? [SINGLE] : HEAVY_GAMES;

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => resolve(JSON.parse(d)));
      })
      .on('error', reject);
  });
}

function httpPut(url) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'PUT' }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.end();
  });
}

// ── Minimal CDP over page WS ──
function cdpPage(wsUrl) {
  return new Promise((resolve) => {
    const ws = new WebSocket(wsUrl);
    let id = 1;
    const pending = {};

    ws.on('open', () => {
      resolve({
        send(method, params = {}) {
          return new Promise((res, rej) => {
            const mid = id++;
            pending[mid] = { res, rej };
            ws.send(JSON.stringify({ id: mid, method, params }));
          });
        },
        close() {
          ws.close();
        },
      });
    });

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.id && pending[msg.id]) {
        msg.error ? pending[msg.id].rej(msg.error) : pending[msg.id].res(msg.result);
        delete pending[msg.id];
      }
    });
  });
}

// ── Profile one game ──
async function profileGame(gameId) {
  const url = `${BASE}/games/${gameId}/index.html`;
  console.log(`  🎮 ${gameId}…`);

  // Create a new target (tab)
  const target = await httpPut(
    `http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(url)}`,
  );

  if (!target.webSocketDebuggerUrl) throw new Error('No WS URL on new target');
  const c = await cdpPage(target.webSocketDebuggerUrl);

  // Wait for page load
  await sleep(3500);

  // Enable Performance
  await c.send('Performance.enable');
  await c.send('Runtime.enable');

  // Inject observers
  await c.send('Runtime.evaluate', {
    expression: `
      window.__p = { lt: [], fps: [], cls: 0, mem: [] };
      try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__p.lt.push(e.duration); }).observe({ entryTypes: ['longtask'] }); } catch {}
      try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__p.cls += e.value; }).observe({ entryTypes: ['layout-shift'] }); } catch {}
      let _f=0,_t=performance.now();
      (function tick(){_f++;const n=performance.now();if(n-_t>=1000){window.__p.fps.push(_f);_f=0;_t=n}requestAnimationFrame(tick)})();
      setInterval(()=>{if(performance.memory)window.__p.mem.push({u:performance.memory.usedJSHeapSize,t:performance.memory.totalJSHeapSize})},2000);
    `,
  });

  // Profile for DURATION
  await sleep(DURATION);

  // Collect
  const raw = await c.send('Runtime.evaluate', {
    expression: 'JSON.stringify(window.__p)',
    returnByValue: true,
  });
  const p = JSON.parse(raw.result.value);

  const mRaw = await c.send('Performance.getMetrics');
  const m = Object.fromEntries(mRaw.metrics.map((x) => [x.name, x.value]));

  c.close();

  const fps = p.fps.length ? p.fps : [0];
  const avg = Math.round(fps.reduce((a, b) => a + b, 0) / fps.length);
  const lt = p.lt;
  const memU = p.mem.length
    ? Math.round(p.mem.reduce((a, x) => a + x.u, 0) / p.mem.length / 1048576)
    : 'N/A';
  const memX = p.mem.length ? Math.round(Math.max(...p.mem.map((x) => x.u)) / 1048576) : 'N/A';

  return {
    gameId,
    fpsAvg: avg,
    fpsMin: Math.min(...fps),
    fpsMax: Math.max(...fps),
    fpsSamples: fps.length,
    ltCount: lt.length,
    ltTotal: Math.round(lt.reduce((a, b) => a + b, 0)),
    ltMax: lt.length ? Math.round(Math.max(...lt)) : 0,
    cls: Math.round(p.cls * 1000) / 1000,
    heapAvg: memU,
    heapMax: memX,
    nodes: m.Nodes,
    layouts: m.LayoutCount,
    scriptMs: m.ScriptDuration ? Math.round(m.ScriptDuration * 1000) : 'N/A',
  };
}

// ── Main ──
async function main() {
  try {
    await httpGet(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
  } catch {
    console.error(
      '❌ Chrome no está en el puerto de debug. Ejecutá:\n  google-chrome --headless=new --no-sandbox --disable-gpu --remote-debugging-port=9222 about:blank',
    );
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log('  🏓 Arcade Hub — P10 Performance Profiling');
  console.log(`  Games: ${GAMES.join(', ')}  |  ${DURATION / 1000}s each`);
  console.log('═══════════════════════════════════════════════════════\n');

  const results = [];
  for (const g of GAMES) {
    try {
      results.push(await profileGame(g));
    } catch (e) {
      console.error(`  ❌ ${g}: ${e.message}`);
      results.push({ gameId: g, error: e.message });
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  📊 RESULTADOS');
  console.log('═══════════════════════════════════════════════════════\n');

  for (const r of results) {
    if (r.error) {
      console.log(`  ❌ ${r.gameId}: ${r.error}\n`);
      continue;
    }
    const fi = r.fpsAvg >= 55 ? '✅' : r.fpsAvg >= 30 ? '⚠️' : '🔴';
    const li = r.ltCount === 0 ? '✅' : r.ltCount <= 3 ? '⚠️' : '🔴';
    const ci = r.cls < 0.1 ? '✅' : r.cls < 0.25 ? '⚠️' : '🔴';
    console.log(`  ${r.gameId}`);
    console.log(
      `    ${fi} FPS: avg=${r.fpsAvg} min=${r.fpsMin} max=${r.fpsMax} (${r.fpsSamples} samples)`,
    );
    console.log(`    ${li} Long Tasks: ${r.ltCount} (${r.ltTotal}ms total, max ${r.ltMax}ms)`);
    console.log(`    ${ci} CLS: ${r.cls}`);
    console.log(`    📦 Heap: avg=${r.heapAvg}MB max=${r.heapMax}MB`);
    console.log(`    🔧 Nodes=${r.nodes} Layouts=${r.layouts} Script=${r.scriptMs}ms\n`);
  }

  const ok = results.filter((r) => !r.error);
  if (ok.length) {
    const aFps = Math.round(ok.reduce((a, r) => a + r.fpsAvg, 0) / ok.length);
    const tLt = ok.reduce((a, r) => a + r.ltCount, 0);
    const aCls = Math.round((ok.reduce((a, r) => a + r.cls, 0) / ok.length) * 1000) / 1000;
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  📈 GLOBAL: FPS avg=${aFps} | LT total=${tLt} | CLS=${aCls}`);
    const issues = [];
    for (const r of ok) {
      if (r.fpsAvg < 55) issues.push(`${r.gameId}: FPS bajo (${r.fpsAvg})`);
      if (r.ltCount > 5) issues.push(`${r.gameId}: ${r.ltCount} long tasks`);
      if (r.ltMax > 100) issues.push(`${r.gameId}: long task max ${r.ltMax}ms`);
      if (r.cls > 0.1) issues.push(`${r.gameId}: CLS ${r.cls}`);
      if (typeof r.heapMax === 'number' && r.heapMax > 100)
        issues.push(`${r.gameId}: heap ${r.heapMax}MB`);
    }
    if (issues.length) {
      console.log('\n  ⚠️  ISSUES:');
      for (const i of issues) console.log(`    • ${i}`);
    } else console.log('\n  ✅ Sin issues significativos');
  }
  console.log('');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
