#!/usr/bin/env node
/**
 * R2 Transform — Migrates game scripts from manual RAF loop to createGameLoop()
 * Usage: node scripts/r2-transform.js games/<game>/script.js [games/<game2>/script.js ...]
 * 
 * Changes:
 * 1. Adds import { createGameLoop } from '../../shared/loop.js'
 * 2. Replaces `let animFrameId...function tick...` with `const loop = createGameLoop((dt) => {...})`
 * 3. Replaces cleanup's cancelAnimationFrame with loop.stop()
 * 4. Replaces boot's requestAnimationFrame with loop.start()
 */

const fs = require('fs');

function transform(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');
  const orig = code;
  const game = filePath.split('/')[1];

  // 1. Add import after display.js import (only if not already present)
  if (!code.includes('from \'../../shared/loop.js\'')) {
    code = code.replace(
      "import { setupCanvas } from '../../shared/display.js';",
      "import { setupCanvas } from '../../shared/display.js';\nimport { createGameLoop } from '../../shared/loop.js';"
    );
  }

  // 2. Replace tick function with createGameLoop
  // Pattern: `let animFrameId = null;` ... `function tick(t/time) {` ... `animFrameId = requestAnimationFrame(tick);` } 
  const tickMatch = code.match(
    /let animFrameId = null;\s*let (?:lt|lastTime) = 0;?\s*function tick\((?:t|time)\)\s*\{[\s\S]*?animFrameId = requestAnimationFrame\(tick\);\s*\}/
  );

  if (tickMatch) {
    const fullTick = tickMatch[0];
    
    // Extract the body: everything after `function tick(t/time) {` and before `animFrameId = requestAnimationFrame(tick); }`
    const bodyMatch = fullTick.match(
      /function tick\((?:t|time)\)\s*\{([\s\S]*?)animFrameId = requestAnimationFrame\(tick\);\s*\}/
    );
    
    if (bodyMatch) {
      let body = bodyMatch[1];
      
      // Remove the dt calculation lines (1-2 lines at the start)
      body = body.replace(/^\s*const dt = Math\.min\(\((?:t|time|lt) - (?:lt|lastTime)\) \/ 1000, 0\.05\);\s*(?:lt|lastTime) = (?:t|time);?\s*/m, '');
      
      // Remove any blank lines at the start
      body = body.replace(/^\s*\n/, '');
      
      // Wrap in createGameLoop
      const newTick = `const loop = createGameLoop((dt) => {${body}});`;
      
      code = code.replace(fullTick, newTick);
    }
  }

  // 3. Replace cleanup
  code = code.replace(
    /if \(animFrameId\) cancelAnimationFrame\(animFrameId\);/g,
    'loop.stop();'
  );

  // 4. Replace boot: `lastTime = t; tick(t)` variant
  code = code.replace(
    /animFrameId = requestAnimationFrame\(\(t\) => \{\s*(?:lastTime|lt) = t;\s*tick\(t\);\s*\}\);/g,
    'loop.start();'
  );

  if (code !== orig) {
    fs.writeFileSync(filePath, code, 'utf8');
    console.log(`✅ ${game}: transformed`);
  } else {
    console.log(`⚠️  ${game}: no changes (may already be transformed)`);
  }
}

// Process all files passed as arguments
const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node scripts/r2-transform.js <files...>');
  process.exit(1);
}
files.forEach(transform);
console.log(`\n📊 Processed ${files.length} files`);
