/* ═══════════════════════════════════════════════════════════════
   hub-cards.js — Miniaturas dibujadas en canvas por juego.
   Cada tarjeta del hub renderiza su escena firma en un mini-canvas
   de 56×56 (DPR-aware) en lugar de mostrar un SVG/emoji genérico.
   Exporta drawGameThumb(canvas, gameId) → true si dibujó la escena.
   ═══════════════════════════════════════════════════════════════ */

const S = 56;

const C = {
  bg: '#0c0922',
  cyan: '#00f0ff',
  pink: '#ff2d78',
  gold: '#ffb800',
  green: '#39ff14',
  purple: '#c084fc',
  red: '#ff5e7a',
  orange: '#ff8a65',
  blue: '#6ec6ff',
  yellow: '#ffe066',
  dim: '#7a78a0',
};

function backdrop(ctx) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, S, S);
}

function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function disc(ctx, color, x, y, r) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function ring(ctx, color, x, y, r, w = 2) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function poly(ctx, color, points, close = true, stroke = false, lw = 2) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  if (close) ctx.closePath();
  if (stroke) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.stroke();
  } else {
    ctx.fillStyle = color;
    ctx.fill();
  }
}

/* ── Escenas por juego ── */
const SCENES = {
  pong(ctx) {
    ctx.strokeStyle = 'rgba(122,120,160,0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(S / 2, 6);
    ctx.lineTo(S / 2, 50);
    ctx.stroke();
    ctx.setLineDash([]);
    rect(ctx, C.pink, 7, 15, 4, 22);
    rect(ctx, C.cyan, 45, 24, 4, 22);
    rect(ctx, C.gold, 25, 17, 5, 5);
  },

  breakout(ctx) {
    [C.pink, C.cyan, C.gold].forEach((col, r) => {
      for (let i = 0; i < 4; i++) rect(ctx, col, 3 + i * 13, 6 + r * 7, 11, 5);
    });
    rect(ctx, C.blue, 21, 47, 15, 4);
    disc(ctx, C.green, 32, 36, 2.5);
  },

  snake(ctx) {
    const body = [
      [2, 3],
      [3, 3],
      [4, 3],
      [5, 3],
      [5, 2],
      [5, 1],
    ];
    body.forEach(([cx, cy], i) => {
      ctx.globalAlpha = 1 - i * 0.12;
      rect(ctx, C.green, cx * 9 + 1, cy * 9 + 19, 8, 8);
    });
    ctx.globalAlpha = 1;
    disc(ctx, C.red, 14, 12, 3.5);
  },

  'dino-runner'(ctx) {
    ctx.fillStyle = C.dim;
    ctx.fillRect(2, 45, 52, 2);
    rect(ctx, C.green, 38, 32, 3, 13);
    rect(ctx, C.green, 35, 35, 3, 6);
    rect(ctx, C.green, 41, 37, 3, 5);
    rect(ctx, C.blue, 8, 33, 11, 8);
    rect(ctx, C.blue, 15, 25, 8, 9);
    rect(ctx, C.bg, 20, 27, 2, 2);
    rect(ctx, C.blue, 9, 41, 3, 4);
    rect(ctx, C.blue, 14, 41, 3, 4);
  },

  asteroids(ctx) {
    poly(
      ctx,
      C.dim,
      [
        [14, 10],
        [22, 8],
        [27, 14],
        [23, 21],
        [13, 20],
        [9, 14],
      ],
      true,
      true,
    );
    poly(
      ctx,
      C.dim,
      [
        [38, 26],
        [46, 24],
        [51, 31],
        [44, 38],
        [36, 34],
      ],
      true,
      true,
    );
    poly(ctx, C.cyan, [
      [28, 52],
      [22, 42],
      [28, 44],
      [34, 42],
    ]);
  },

  'space-invaders'(ctx) {
    const rows = [
      '..X.....X..',
      '...X...X...',
      '..XXXXXXX..',
      '.XX.XXX.XX.',
      'XXXXXXXXXXX',
      'X.XXXXXXX.X',
      'X.X.....X.X',
    ];
    const drawInvader = (color, ox, oy) => {
      rows.forEach((row, y) =>
        [...row].forEach((ch, x) => {
          if (ch === 'X') rect(ctx, color, ox + x * 3, oy + y * 3, 3, 3);
        }),
      );
    };
    drawInvader(C.pink, 11, 6);
    drawInvader(C.cyan, 11, 30);
    rect(ctx, C.green, 8, 51, 40, 3);
  },

  'flappy-bird'(ctx) {
    rect(ctx, C.green, 8, 0, 10, 22);
    rect(ctx, C.green, 6, 22, 14, 5);
    rect(ctx, C.green, 38, 34, 10, 22);
    rect(ctx, C.green, 36, 29, 14, 5);
    disc(ctx, C.yellow, 27, 27, 6);
    rect(ctx, C.orange, 22, 26, 7, 3);
    rect(ctx, C.bg, 29, 24, 2, 2);
  },

  pacman(ctx) {
    for (let i = 0; i < 4; i++) disc(ctx, '#fff', 10 + i * 9, 14, 1.8);
    ctx.fillStyle = C.yellow;
    ctx.beginPath();
    ctx.moveTo(22, 36);
    ctx.arc(22, 36, 10, 0.55, Math.PI * 2 - 0.55);
    ctx.closePath();
    ctx.fill();
    disc(ctx, C.red, 43, 34, 7);
    rect(ctx, '#fff', 40, 32, 2.5, 2.5);
    rect(ctx, '#fff', 45, 32, 2.5, 2.5);
  },

  tetris(ctx) {
    const cells = [
      [C.cyan, 1, 6],
      [C.cyan, 2, 6],
      [C.cyan, 3, 6],
      [C.cyan, 4, 6],
      [C.purple, 2, 5],
      [C.purple, 3, 5],
      [C.purple, 3, 4],
      [C.orange, 1, 5],
      [C.gold, 0, 6],
      [C.green, 5, 6],
    ];
    cells.forEach(([col, cx, cy]) => rect(ctx, col, cx * 9 + 1, cy * 7 + 1, 8, 6));
  },

  frogger(ctx) {
    ctx.fillStyle = 'rgba(0,240,255,0.18)';
    ctx.fillRect(0, 6, S, 16);
    rect(ctx, C.orange, 6, 11, 16, 5);
    rect(ctx, '#20204a', 0, 28, S, 16);
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(0, 36);
    ctx.lineTo(S, 36);
    ctx.stroke();
    ctx.setLineDash([]);
    rect(ctx, C.green, 23, 46, 9, 7);
    rect(ctx, C.bg, 25, 47, 2, 2);
    rect(ctx, C.bg, 29, 47, 2, 2);
  },

  galaga(ctx) {
    [
      [C.red, 16, 10],
      [C.red, 40, 10],
      [C.gold, 12, 20],
      [C.gold, 28, 20],
      [C.gold, 44, 20],
      [C.blue, 20, 30],
      [C.blue, 36, 30],
    ].forEach(([col, x, y]) => disc(ctx, col, x, y, 3));
    poly(ctx, '#fff', [
      [28, 40],
      [18, 52],
      [24, 49],
      [28, 52],
      [32, 49],
      [38, 52],
    ]);
  },

  centipede(ctx) {
    disc(ctx, C.orange, 12, 44, 3);
    disc(ctx, C.orange, 44, 40, 3);
    disc(ctx, C.orange, 30, 48, 3);
    for (let i = 0; i < 6; i++) {
      disc(
        ctx,
        i === 0 ? C.pink : C.purple,
        10 + i * 7,
        12 + Math.sin(i * 1.1) * 6 + 8,
        i === 0 ? 4.5 : 3.5,
      );
    }
    rect(ctx, '#fff', 8, 18, 2, 2);
    rect(ctx, '#fff', 12, 18, 2, 2);
  },

  digdug(ctx) {
    ['#5a3218', '#7a4420', '#5a3218', '#7a4420'].forEach((col, i) =>
      rect(ctx, col, 0, 8 + i * 12, S, 12),
    );
    ctx.fillStyle = C.bg;
    ctx.fillRect(24, 8, 8, 48);
    disc(ctx, C.blue, 28, 20, 6);
    rect(ctx, '#fff', 28, 26, 5, 6);
    rect(ctx, C.red, 33, 22, 12, 2);
  },

  'missile-command'(ctx) {
    [
      [8, 50],
      [28, 50],
      [48, 50],
    ].forEach(([x, y]) =>
      poly(ctx, C.cyan, [
        [x - 5, y],
        [x, y - 8],
        [x + 5, y],
      ]),
    );
    ctx.strokeStyle = C.red;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(10, 2);
    ctx.lineTo(26, 30);
    ctx.stroke();
    ctx.strokeStyle = C.gold;
    ctx.beginPath();
    ctx.moveTo(48, 2);
    ctx.lineTo(30, 26);
    ctx.stroke();
    ring(ctx, C.gold, 27, 31, 6, 2);
    ring(ctx, C.red, 27, 31, 3, 1.5);
  },

  'neon-nexus'(ctx) {
    ctx.strokeStyle = 'rgba(0,240,255,0.4)';
    ctx.lineWidth = 1.5;
    [
      [16, 14],
      [44, 18],
      [40, 44],
      [12, 40],
      [28, 28],
    ].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.moveTo(28, 28);
      ctx.lineTo(x, y);
      ctx.stroke();
    });
    poly(
      ctx,
      C.cyan,
      [
        [28, 18],
        [37, 23],
        [37, 33],
        [28, 38],
        [19, 33],
        [19, 23],
      ],
      true,
      true,
      2,
    );
    [
      [C.pink, 16, 14],
      [C.gold, 44, 18],
      [C.pink, 40, 44],
      [C.gold, 12, 40],
    ].forEach(([col, x, y]) => disc(ctx, col, x, y, 3));
    disc(ctx, C.cyan, 28, 28, 5);
  },

  'cell-swarm'(ctx) {
    disc(ctx, 'rgba(192,132,252,0.85)', 24, 26, 14);
    disc(ctx, 'rgba(90,40,140,0.9)', 24, 26, 6);
    ring(ctx, 'rgba(255,255,255,0.35)', 24, 26, 14, 1.5);
    disc(ctx, 'rgba(0,240,255,0.75)', 45, 14, 6);
    disc(ctx, 'rgba(255,45,120,0.75)', 43, 42, 5);
    disc(ctx, 'rgba(57,255,20,0.75)', 12, 46, 3.5);
  },

  'donkey-kong'(ctx) {
    ctx.strokeStyle = C.red;
    ctx.lineWidth = 3;
    [
      [6, 14, 50, 8],
      [50, 22, 6, 28],
      [6, 36, 50, 30],
      [50, 44, 6, 50],
    ].forEach(([x1, y1, x2, y2]) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });
    rect(ctx, '#8a5a2b', 8, 6, 12, 7);
    rect(ctx, '#6e441f', 10, 4, 8, 3);
    disc(ctx, C.gold, 30, 17, 3.5);
    disc(ctx, C.gold, 20, 31, 3.5);
  },

  defender(ctx) {
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 44);
    ctx.lineTo(8, 38);
    ctx.lineTo(16, 46);
    ctx.lineTo(26, 34);
    ctx.lineTo(34, 44);
    ctx.lineTo(44, 36);
    ctx.lineTo(56, 46);
    ctx.stroke();
    poly(ctx, C.cyan, [
      [28, 14],
      [22, 22],
      [28, 19],
      [34, 22],
    ]);
    disc(ctx, C.pink, 44, 12, 2.5);
    ring(ctx, 'rgba(0,240,255,0.35)', 28, 18, 11, 1);
  },

  joust(ctx) {
    ctx.fillStyle = 'rgba(122,120,160,0.5)';
    [
      [6, 12, 18, 4],
      [34, 20, 16, 4],
      [16, 44, 24, 4],
    ].forEach(([x, y, w, h]) => ctx.fillRect(x, y, w, h));
    disc(ctx, C.pink, 12, 9, 3.5);
    ctx.strokeStyle = C.pink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(15, 9);
    ctx.lineTo(26, 6);
    ctx.stroke();
    disc(ctx, C.cyan, 44, 17, 3.5);
    ctx.strokeStyle = C.cyan;
    ctx.beginPath();
    ctx.moveTo(41, 17);
    ctx.lineTo(31, 21);
    ctx.stroke();
  },
};

export function drawGameThumb(canvas, gameId) {
  const scene = SCENES[gameId];
  if (!scene || !canvas || typeof canvas.getContext !== 'function') return false;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = S * dpr;
  canvas.height = S * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  backdrop(ctx);
  scene(ctx);
  return true;
}
