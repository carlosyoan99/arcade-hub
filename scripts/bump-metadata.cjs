#!/usr/bin/env node
/**
 * Bump metadata.json versions for all games after R1-R4 refactoring.
 * Usage: node scripts/bump-metadata.cjs
 */
const fs = require('fs');
const path = require('path');

const today = '2026-07-30';

// Changes by game (specific extras beyond the standard R1-R4)
const extras = {
  breakout: 'Vestigios 3D renombrados (ball.z, paddle.z → .y)',
  pong: 'Vestigios 3D renombrados (ball.z → .y)',
  'flappy-bird': 'Constantes extraídas (PIPE_MARGIN, BIRD_R, PIPE_SPAWN_MIN, etc.)',
  frogger: 'Constante extraída (TRUCK_SPEED_THRESHOLD)',
  tetris: 'Constantes extraídas (BASE_DROP_SPEED, SPEED_PER_LEVEL, MIN_DROP_SPEED)',
  galaga: 'Constantes extraídas (SHIP_MARGIN, MIN_DIVE_INTERVAL, MAX_DIVERS, etc.)',
};

const baseChanges = [
  'R1: shared/loop.js — game loop compartido con dt/RAF/cleanup unificados',
  'R4: @keyframes shimmerFlow extraído a shared/base.css',
  'P0: drawGlow() y feedbackBundle() para rendimiento y game feel',
];

const gameDirs = fs.readdirSync('games').filter((d) => {
  const meta = path.join('games', d, 'metadata.json');
  return fs.existsSync(meta);
});

gameDirs.forEach((game) => {
  const metaPath = path.join('games', game, 'metadata.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

  const parts = meta.version.split('.');
  const major = parseInt(parts[0], 10);
  const minor = parseInt(parts[1], 10);
  const patch = parseInt(parts[2], 10);
  const newVersion = `${major}.${minor + 1}.0`;

  const changes = [...baseChanges];
  if (extras[game]) changes.push(extras[game]);
  // R3 magic numbers for specific games
  if (['flappy-bird', 'frogger', 'tetris', 'galaga'].includes(game)) {
    if (!changes.some((c) => c.includes('Constantes'))) {
      changes.push('R3: Magic numbers extraídos a constantes nombradas');
    }
  }

  meta.version = newVersion;
  meta.lastModified = today;
  meta.changelog.push({
    version: newVersion,
    date: today,
    changes,
  });

  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');
  console.log(`✅ ${game}: ${meta.version.split('.')[0]}.${meta.version.split('.')[1] - 1}.${meta.version.split('.')[2]} → ${newVersion}`);
});

console.log(`\n📊 Updated ${gameDirs.length} metadata files`);
