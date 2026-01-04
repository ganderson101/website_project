// game1.js — Simple Breakout-style game
// Beginner-friendly, commented, and uses keyboard (left/right) and mouse movement.

(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  // Scene sizes (canvas may be scaled by CSS on small screens)
  let cw = canvas.width; // 800
  let ch = canvas.height; // 500

  // Paddle
  const paddle = { w: 120, h: 12, x: (cw - 120) / 2, y: ch - 40, dx: 8 };

  // Balls array — supports multi-ball powerup
  let balls = [{ x: cw / 2, y: ch - 60, r: 8, dx: 4, dy: -4, stuck: false }];

  function drawBalls() {
    for (const b of balls) {
      if (b.stuck) {
        // draw as slightly dimmer ball to show it is stuck
        ctx.beginPath();
        ctx.fillStyle = "#ffd";
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
        ctx.beginPath();
        ctx.fillStyle = "#fff";
        ctx.arc(b.x, b.y, b.r - 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
      } else {
        ctx.beginPath();
        ctx.fillStyle = "#fff";
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
      }
    }
  }

  // Bricks grid
  const brick = {
    rows: 5,
    cols: 8,
    w: 80,
    h: 20,
    padding: 10,
    offsetTop: 40,
    offsetLeft: 40,
  };
  let bricks = [];

  let score = 0;
  let lives = 3;
  let shields = 0;
  let level = 1;
  let highScore = 0;
  const HS_KEY = "game1_highScore";
  try {
    highScore = Number(localStorage.getItem(HS_KEY)) || 0;
  } catch (e) {
    highScore = 0;
  }
  let running = false;
  let rightPressed = false;
  let leftPressed = false;
  let rafId = null;
  let paused = false; // when true the game is paused (not running)

  // Powerups: falling items that activate when caught by the paddle
  let powerups = [];
  const activeEffects = {};
  let tempMsgTimer = null;
  let pendingLevelScene = null; // { level, rows, speedFactor } when waiting for click-to-continue

  // create bricks
  function initBricks() {
    bricks = [];
    // density: probability a cell has a brick. Higher levels slightly sparser to increase difficulty
    const baseDensity = 0.75;
    const density = Math.max(0.35, baseDensity - (level - 1) * 0.04);
    // reinforce probability: some bricks are 'reinforced' and take 3 hits
    const reinforceProb = Math.min(0.35, 0.12 + (level - 1) * 0.03);
    // decide whether to stagger rows this level (randomized for variety)
    const doStagger = Math.random() < 0.6;
    // compute total row width and center the grid for a neat, aligned layout
    const totalRowW = brick.cols * (brick.w + brick.padding) - brick.padding;
    const leftStart = Math.round((cw - totalRowW) / 2);
    const staggerShift = Math.round((brick.w + brick.padding) / 2);

    for (let r = 0; r < brick.rows; r++) {
      bricks[r] = [];
      const rowOffset = doStagger && r % 2 === 1 ? staggerShift : 0;
      for (let c = 0; c < brick.cols; c++) {
        const x = leftStart + rowOffset + c * (brick.w + brick.padding);
        const y = brick.offsetTop + r * (brick.h + brick.padding);
        const status = Math.random() < density ? 1 : 0;
        // set hits: 3 for reinforced bricks, otherwise 1; 0 if absent
        const hits = status ? (Math.random() < reinforceProb ? 3 : 1) : 0;
        bricks[r][c] = { x, y, status, powerupType: null, hits };
      }
    }
    // ensure there is at least one brick (avoid empty levels)
    let any = false;
    for (let r = 0; r < brick.rows; r++)
      for (let c = 0; c < brick.cols; c++) if (bricks[r][c].status) any = true;
    if (!any) {
      const midR = Math.floor(brick.rows / 2);
      for (let c = 0; c < brick.cols; c++) {
        bricks[midR][c].status = 1;
        bricks[midR][c].hits = 1;
      }
    }

    // Ensure a reasonable number of reinforced bricks per level:
    // Level 1 -> 2-3, Level 2 -> 3-4, etc. (min = level+1, max = level+2)
    const present = [];
    for (let r = 0; r < brick.rows; r++)
      for (let c = 0; c < brick.cols; c++)
        if (bricks[r][c] && bricks[r][c].status) present.push({ r, c });

    const minReinforced = Math.min(present.length, level + 1);
    const maxReinforced = Math.min(present.length, level + 2);

    // Count current reinforced bricks (hits >= 3)
    const reinforcedList = present.filter((p) => bricks[p.r][p.c].hits >= 3);
    let currentReinforced = reinforcedList.length;

    // If there are too many reinforced due to randomness, demote some to normal bricks
    if (currentReinforced > maxReinforced) {
      // randomly remove some reinforcements until at or below max
      const toRemove = currentReinforced - maxReinforced;
      for (let i = 0; i < toRemove; i++) {
        const idx = randInt(0, reinforcedList.length - 1);
        const pick = reinforcedList.splice(idx, 1)[0];
        bricks[pick.r][pick.c].hits = 1;
        currentReinforced -= 1;
      }
    }

    // If too few, promote random candidates until we reach min
    if (currentReinforced < minReinforced) {
      const candidates = present.filter((p) => bricks[p.r][p.c].hits < 3);
      while (currentReinforced < minReinforced && candidates.length > 0) {
        const idx = randInt(0, candidates.length - 1);
        const pick = candidates.splice(idx, 1)[0];
        bricks[pick.r][pick.c].hits = 3;
        currentReinforced += 1;
      }
    }
  }

  function drawBricks() {
    // Base hue per level to give each level a distinct palette
    const baseHue = (level * 47) % 360;
    for (let r = 0; r < brick.rows; r++) {
      for (let c = 0; c < brick.cols; c++) {
        const b = bricks[r][c];
        if (b.status) {
          // hue shifts by row to create a vertical gradient across rows
          const hue =
            (baseHue + r * Math.floor(360 / Math.max(1, brick.rows))) % 360;
          // create a vertical gradient (lighter on top, darker on bottom)
          const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + brick.h);
          g.addColorStop(0, `hsl(${hue} 80% 62%)`);
          g.addColorStop(0.5, `hsl(${hue} 75% 50%)`);
          g.addColorStop(1, `hsl(${hue} 65% 36%)`);
          ctx.fillStyle = g;
          roundRect(ctx, b.x, b.y, brick.w, brick.h, 6, true, false);
          ctx.strokeStyle = "rgba(0,0,0,0.45)";
          ctx.lineWidth = 2;
          ctx.strokeRect(b.x, b.y, brick.w, brick.h);

          // If reinforced (hits > 1) draw a subtle grey pattern overlay (keeps brick look)
          if (b.hits && b.hits > 1) {
            ctx.save();
            // create a rounded-rect path and clip to it
            const px = b.x + 2;
            const py = b.y + 2;
            const pw = brick.w - 4;
            const ph = brick.h - 4;
            const pr = 6;
            ctx.beginPath();
            ctx.moveTo(px + pr, py);
            ctx.arcTo(px + pw, py, px + pw, py + ph, pr);
            ctx.arcTo(px + pw, py + ph, px, py + ph, pr);
            ctx.arcTo(px, py + ph, px, py, pr);
            ctx.arcTo(px, py, px + pw, py, pr);
            ctx.closePath();
            ctx.clip();

            // diagonal stripe lines (darker for visibility)
            ctx.strokeStyle = "rgba(40,40,40,0.92)";
            ctx.lineWidth = 3.2;
            const gap = 6;
            for (let i = -ph; i < pw + ph; i += gap) {
              ctx.beginPath();
              ctx.moveTo(px + i, py);
              ctx.lineTo(px + i + ph, py + ph);
              ctx.stroke();
            }

            // stronger speckle for texture (more visible)
            ctx.fillStyle = "rgba(255,255,255,0.12)";
            for (let yy = py + 4; yy < py + ph - 4; yy += 5) {
              for (
                let xx = px + (yy % 10 === 0 ? 4 : 0) + 4;
                xx < px + pw - 4;
                xx += 8
              ) {
                ctx.fillRect(xx, yy, 1, 1);
              }
            }

            // slightly stronger inner outline to help the pattern pop
            ctx.strokeStyle = "rgba(0,0,0,0.28)";
            ctx.lineWidth = 1.4;
            ctx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);

            ctx.restore();

            // draw cracks only when brick has been hit (hits < 3) or during brief hit flash
            if (b.hitFlash && b.hitFlash > 0)
              b.hitFlash = Math.max(0, b.hitFlash - 1);
            if ((b.hits && b.hits < 3) || (b.hitFlash && b.hitFlash > 0)) {
              drawCrackOverlay(
                b.x,
                b.y,
                brick.w,
                brick.h,
                b.hits,
                b.hitFlash || 0
              );
            }
          }
        }
      }
    }
  }

  // helper: rounded rectangle
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  // draw crack overlay for reinforced bricks; more visible as hits decrease
  function drawCrackOverlay(x, y, w, h, hits, flash) {
    ctx.save();
    ctx.lineCap = "round";
    // stronger cracks when fewer hits remain
    const strength = Math.max(0.3, (4 - hits) / 3); // hits:3->0.33, 2->0.66, 1->1
    const baseAlpha = 0.45 + 0.4 * strength; // 0.45..0.85
    const lw = 1.6 + 2.4 * strength; // 1.6..4
    const alpha = Math.min(1, baseAlpha + (flash ? (flash / 10) * 0.5 : 0));
    ctx.strokeStyle = `rgba(10,10,10,${alpha.toFixed(2)})`;
    ctx.lineWidth = lw;

    // primary crack: jagged vertical-ish line somewhere near center
    const cx = x + w * 0.5 + w * 0.06 * (hits - 2); // vary a bit
    let py = y + h * 0.08;
    const segments = hits === 2 ? 3 : 5;
    ctx.beginPath();
    ctx.moveTo(cx, py);
    for (let i = 0; i < segments; i++) {
      const nx = cx + randInt(-Math.round(w * 0.12), Math.round(w * 0.12));
      const ny =
        py +
        h / (segments + 1) +
        randInt(-Math.round(h * 0.04), Math.round(h * 0.04));
      ctx.lineTo(nx, ny);
      py = ny;
    }
    ctx.stroke();

    // branching cracks for heavy damage
    if (hits <= 1) {
      for (let b = 0; b < 2; b++) {
        ctx.beginPath();
        const sx = cx + randInt(-10, 10);
        const sy = y + h * (0.25 + 0.15 * b);
        ctx.moveTo(sx, sy);
        for (let k = 0; k < 3; k++) {
          const nx = sx + (k + 1) * randInt(-18, 18);
          const ny = sy + (k + 1) * randInt(10, 26);
          ctx.lineTo(nx, ny);
        }
        ctx.stroke();
      }
      // small chip at bottom-right of the crack
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath();
      ctx.moveTo(x + w * 0.7, y + h * 0.05);
      ctx.lineTo(x + w * 0.98, y + h * 0.14);
      ctx.lineTo(x + w * 0.86, y + h * 0.32);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
  // Powerup helpers
  // More powerups: enlarge (paddle), life (+1), slow (ball), multiball, sticky, shield, score
  const POWERUP_TYPES = [
    "enlarge",
    "life",
    "slow",
    "multiball",
    "sticky",
    "shield",
    "score",
  ];
  function spawnPowerup(x, y, type) {
    // choose a type randomly if not provided
    const t =
      type || POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    powerups.push({
      x: Math.round(x),
      y: Math.round(y),
      r: 16, // larger radius for easier catching
      dy: 0.9, // slightly slower fall
      type: t,
    });
  }

  function drawPowerups() {
    for (const p of powerups) {
      // Draw emoji directly (no filled circle) and make it bigger
      const emojiMap = {
        enlarge: "↔️",
        life: "💚+",
        slow: "🐢",
        multiball: "⚪×2",
        sticky: "🧲",
        shield: "🛡️",
        score: "⭐+150",
      };
      const label = emojiMap[p.type] || "?";
      // Font size scales with powerup radius; fallback for long labels
      const fontSize =
        label.length > 2 ? Math.max(14, p.r) : Math.max(20, p.r + 6);
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // draw subtle outline for contrast then fill (keeps emoji readable on any background)
      ctx.save();
      ctx.lineWidth = Math.max(3, Math.floor(fontSize / 6));
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.strokeText(label, p.x, p.y - 1);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, p.x, p.y - 1);
      ctx.restore();

      // gentle halo ring for visibility (very subtle)
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 6, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.closePath();
    }
  }
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function assignPowerupBricks(count) {
    // collect candidate bricks (only those currently present)
    const candidates = [];
    for (let r = 0; r < brick.rows; r++) {
      for (let c = 0; c < brick.cols; c++) {
        if (bricks[r][c]) bricks[r][c].powerupType = null; // clear any existing
        if (bricks[r][c] && bricks[r][c].status) candidates.push({ r, c });
      }
    }

    count = Math.max(0, Math.min(count, candidates.length));
    const selected = new Set();
    while (selected.size < count && candidates.length > 0) {
      selected.add(randInt(0, candidates.length - 1));
    }
    for (const idx of selected) {
      const { r, c } = candidates[idx];
      bricks[r][c].powerupType =
        POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    }
  }
  function activatePowerup(p) {
    if (!p || !p.type) return;
    if (p.type === "life") {
      lives += 1;
      showTempMessage("Life +1");
      return;
    }
    if (p.type === "enlarge") {
      // clear existing enlarge effect
      if (activeEffects.enlarge) {
        clearTimeout(activeEffects.enlarge.timeout);
        paddle.w = activeEffects.enlarge.origW;
      }
      activeEffects.enlarge = { origW: paddle.w };
      paddle.w = Math.min(cw, Math.round(paddle.w * 1.6));
      showTempMessage("Paddle enlarged for 10s");
      activeEffects.enlarge.timeout = setTimeout(() => {
        if (activeEffects.enlarge) {
          paddle.w = activeEffects.enlarge.origW;
          delete activeEffects.enlarge;
        }
      }, 10000);
      return;
    }
    if (p.type === "slow") {
      if (activeEffects.slow) clearTimeout(activeEffects.slow.timeout);
      activeEffects.slow = { orig: [] };
      // store current speeds for each ball
      for (const b of balls)
        activeEffects.slow.orig.push({ dx: b.dx, dy: b.dy });
      for (const b of balls) {
        b.dx *= 0.6;
        b.dy *= 0.6;
      }
      showTempMessage("Ball slowed for 10s");
      activeEffects.slow.timeout = setTimeout(() => {
        if (activeEffects.slow) {
          for (
            let i = 0;
            i < balls.length && i < activeEffects.slow.orig.length;
            i++
          ) {
            balls[i].dx = activeEffects.slow.orig[i].dx;
            balls[i].dy = activeEffects.slow.orig[i].dy;
          }
          delete activeEffects.slow;
        }
      }, 10000);
      return;
    }
    if (p.type === "multiball") {
      // spawn two extra balls based on existing ones
      const newBalls = [];
      for (const b of balls) {
        const b1 = { ...b, dx: b.dx * 0.9 + 1.2, dy: -Math.abs(b.dy) };
        const b2 = { ...b, dx: b.dx * 0.9 - 1.2, dy: -Math.abs(b.dy) };
        newBalls.push(b1, b2);
      }
      balls = balls.concat(newBalls);
      showTempMessage("Multi-ball!");
      return;
    }
    if (p.type === "sticky") {
      // sticky: paddle catches balls when they hit; lasts 10s
      if (activeEffects.sticky) clearTimeout(activeEffects.sticky.timeout);
      activeEffects.sticky = {};
      showTempMessage("Sticky paddle for 10s");
      activeEffects.sticky.timeout = setTimeout(() => {
        delete activeEffects.sticky;
        showTempMessage("Sticky ended");
      }, 10000);
      return;
    }
    if (p.type === "shield") {
      shields += 1;
      showTempMessage("Shield +1");
      return;
    }
    if (p.type === "score") {
      score += 150;
      updateHighScore();
      showTempMessage("Score +150");
      return;
    }
  }

  function clearEffects() {
    if (activeEffects.enlarge) {
      paddle.w = activeEffects.enlarge.origW;
      clearTimeout(activeEffects.enlarge.timeout);
      delete activeEffects.enlarge;
    }
    if (activeEffects.slow) {
      // restore per-ball original speeds when possible
      if (Array.isArray(activeEffects.slow.orig)) {
        for (
          let i = 0;
          i < activeEffects.slow.orig.length && i < balls.length;
          i++
        ) {
          balls[i].dx = activeEffects.slow.orig[i].dx;
          balls[i].dy = activeEffects.slow.orig[i].dy;
        }
      }
      clearTimeout(activeEffects.slow.timeout);
      delete activeEffects.slow;
    }
    if (activeEffects.sticky) {
      if (activeEffects.sticky.timeout)
        clearTimeout(activeEffects.sticky.timeout);
      delete activeEffects.sticky;
    }
    // clear shield count
    shields = 0;
  }

  function showTempMessage(msg, duration = 2000) {
    const el = document.getElementById("powerup-msg");
    if (!el) return;
    el.textContent = msg;
    if (tempMsgTimer) clearTimeout(tempMsgTimer);
    tempMsgTimer = setTimeout(() => {
      el.textContent = "";
      tempMsgTimer = null;
    }, duration);
  }

  function updateHighScore() {
    const hsEl = document.getElementById("highscore-display");
    if (score > highScore) {
      highScore = score;
      try {
        localStorage.setItem(HS_KEY, String(highScore));
      } catch (e) {}
      showTempMessage("New High Score!");
    }
    if (hsEl) hsEl.textContent = "High Score: " + highScore;
  }
  function drawPaddle() {
    // white paddle with subtle shadow and border for visibility
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 8;
    roundRect(ctx, paddle.x, paddle.y, paddle.w, paddle.h, 6);
    ctx.restore();
    // subtle border
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 2;
    ctx.strokeRect(paddle.x, paddle.y, paddle.w, paddle.h);
  }

  // drawBall removed — using drawBalls() for multiple balls instead.

  function drawHUD() {
    document.getElementById("score").textContent = "Score: " + score;
    document.getElementById("lives").textContent = "Lives: " + lives;
    const shieldsEl = document.getElementById("shields");
    if (shieldsEl) shieldsEl.textContent = "Shields: " + shields;
    const lvlEl = document.getElementById("level-display");
    if (lvlEl) lvlEl.textContent = "Level: " + level;
    const hsEl = document.getElementById("highscore-display");
    if (hsEl) hsEl.textContent = "High Score: " + highScore;
  }

  // collisionDetection removed — collision is handled per-ball in update()

  function checkWin() {
    for (let r = 0; r < brick.rows; r++) {
      for (let c = 0; c < brick.cols; c++)
        if (bricks[r][c].status) return false;
    }
    return true;
  }

  function resetBallAndPaddle() {
    paddle.x = (cw - paddle.w) / 2;
    balls = [
      {
        x: cw / 2,
        y: ch - 60,
        r: 8,
        dx: 4 * (Math.random() > 0.5 ? 1 : -1),
        dy: -4,
        stuck: false,
      },
    ];
  }

  function update() {
    // Move paddle
    if (rightPressed) paddle.x += paddle.dx;
    if (leftPressed) paddle.x -= paddle.dx;
    // Keep paddle in bounds
    paddle.x = Math.max(0, Math.min(cw - paddle.w, paddle.x));

    // Move and handle each ball (supports multiple balls)
    for (let bi = balls.length - 1; bi >= 0; bi--) {
      const b = balls[bi];

      // stuck balls follow the paddle
      if (b.stuck) {
        b.x = paddle.x + (b.stuckOffset || paddle.w / 2);
        b.y = paddle.y - b.r - 2;
        continue; // no physics while stuck
      }

      // Move with sub-steps to avoid tunnelling at high speed
      const maxMove = Math.max(Math.abs(b.dx), Math.abs(b.dy));
      // Use a tighter step size (half radius) to prevent skipping thin bricks at high speed
      const steps = Math.max(1, Math.ceil(maxMove / Math.max(1, b.r * 0.5)));
      let removed = false;
      let stopSubsteps = false;
      for (let s = 0; s < steps && !removed && !stopSubsteps; s++) {
        b.x += b.dx / steps;
        b.y += b.dy / steps;

        // Wall collision
        if (b.x + b.r > cw) {
          b.x = cw - b.r;
          b.dx = -b.dx;
        } else if (b.x - b.r < 0) {
          b.x = b.r;
          b.dx = -b.dx;
        }
        if (b.y - b.r < 0) {
          b.y = b.r;
          b.dy = -b.dy;
        }

        // Paddle collision (only when moving downward)
        if (
          b.dy > 0 &&
          b.y + b.r > paddle.y &&
          b.x > paddle.x &&
          b.x < paddle.x + paddle.w
        ) {
          if (activeEffects.sticky) {
            b.stuck = true;
            b.stuckOffset = b.x - paddle.x;
            b.dx = 0;
            b.dy = 0;
            showTempMessage("Ball stuck! Press SPACE or click to release");
          } else {
            const hitPos = (b.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
            b.dx = hitPos * 6;
            b.dy = -Math.abs(b.dy);
          }
          break; // skip remaining substeps this frame
        }

        // Brick collision per sub-step
        let broke = false;
        for (let r = 0; r < brick.rows && !broke; r++) {
          for (let c = 0; c < brick.cols && !broke; c++) {
            const br = bricks[r][c];
            if (br.status) {
              const pad = 4; // pixels of padding around brick for collision
              if (
                b.x + b.r > br.x - pad &&
                b.x - b.r < br.x + brick.w + pad &&
                b.y + b.r > br.y - pad &&
                b.y - b.r < br.y + brick.h + pad
              ) {
                // swept-circle vs rect: find closest point on brick to ball center
                const cx = Math.max(br.x, Math.min(b.x, br.x + brick.w));
                const cy = Math.max(br.y, Math.min(b.y, br.y + brick.h));
                let nx = b.x - cx;
                let ny = b.y - cy;
                let dist = Math.hypot(nx, ny);
                if (dist === 0) {
                  // fallback normal along movement direction
                  const mv = Math.hypot(b.dx, b.dy) || 1;
                  nx = b.dx / mv;
                  ny = b.dy / mv;
                  dist = 0.0001;
                } else {
                  nx /= dist; // normalize
                  ny /= dist;
                }
                // if overlapping (within radius + padding), resolve
                if (dist <= b.r + pad) {
                  // reflect velocity about normal
                  const dot = b.dx * nx + b.dy * ny;
                  b.dx = b.dx - 2 * dot * nx;
                  b.dy = b.dy - 2 * dot * ny;

                  // nudge ball out so it doesn't stay overlapping
                  const push = b.r + pad - dist + 0.5;
                  b.x += nx * push;
                  b.y += ny * push;

                  if (typeof br.hits === "undefined") br.hits = 1;
                  br.hits -= 1;
                  if (br.hits > 0) {
                    score += 5;
                    updateHighScore();
                    br.hitFlash = 10;
                    showTempMessage("Reinforced! " + br.hits + " hit(s) left");
                  } else {
                    br.status = 0;
                    score += 10;
                    updateHighScore();
                    if (br.powerupType)
                      spawnPowerup(
                        br.x + brick.w / 2,
                        br.y + brick.h,
                        br.powerupType
                      );
                    if (checkWin()) {
                      const nextLevel = level + 1;
                      const nextRows = Math.min(8, brick.rows + 1);
                      const speedFactor = Math.pow(1.2, nextLevel - 1);
                      pendingLevelScene = {
                        level: nextLevel,
                        rows: nextRows,
                        speedFactor,
                      };
                      running = false;
                      cancelAnimationFrame(rafId);
                      showLevelScene(nextLevel);
                    }
                  }
                  broke = true;
                  stopSubsteps = true; // prevent multiple hits in same frame
                }
              }
            }
          }
        }

        // Bottom (miss) for this ball
        if (b.y - b.r > ch) {
          // remove this ball
          balls.splice(bi, 1);
          removed = true;
          // if no balls left, handle life loss or shield
          if (balls.length === 0) {
            if (shields > 0) {
              shields -= 1;
              showTempMessage("Shield saved you!");
              resetBallAndPaddle();
            } else {
              lives -= 1;
              if (lives <= 0) {
                running = false;
                cancelAnimationFrame(rafId);
                setTimeout(() => {
                  showOverlay("YOU LOSE", "Game over. Try again!");
                }, 20);
                return;
              } else {
                resetBallAndPaddle();
              }
            }
          }
        }
      }
    }

    // Move powerups (fall slowly) and check paddle catches
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.y += p.dy;
      // caught by paddle
      if (
        p.y + p.r >= paddle.y &&
        p.x >= paddle.x &&
        p.x <= paddle.x + paddle.w
      ) {
        activatePowerup(p);
        powerups.splice(i, 1);
        continue;
      }
      // remove if below screen
      if (p.y - p.r > ch) powerups.splice(i, 1);
    }
  }

  function draw() {
    // Clear
    ctx.clearRect(0, 0, cw, ch);

    drawBricks();
    drawPaddle();
    drawBalls();
    drawPowerups();
    drawHUD();
  }

  function loop() {
    update();
    draw();
    if (running) rafId = requestAnimationFrame(loop);
  }

  // Controls
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") rightPressed = true;
    if (e.key === "ArrowLeft") leftPressed = true;
  });
  document.addEventListener("keyup", (e) => {
    if (e.key === "ArrowRight") rightPressed = false;
    if (e.key === "ArrowLeft") leftPressed = false;
  });

  // Pointer: move paddle with mouse, touch, or pointer movement anywhere on the page
  function updatePaddleFromClientX(clientX) {
    const rect = canvas.getBoundingClientRect();
    // Scale clientX to canvas coordinate system (account for CSS scaling)
    const mx = (clientX - rect.left) * (cw / rect.width);
    paddle.x = Math.max(0, Math.min(cw - paddle.w, mx - paddle.w / 2));
  }

  // Mouse move anywhere
  window.addEventListener("mousemove", (e) => {
    updatePaddleFromClientX(e.clientX);
  });
  // Release any stuck balls (SPACE or click the canvas)
  function releaseStuckBalls() {
    let released = false;
    for (const b of balls) {
      if (b.stuck) {
        b.stuck = false;
        b.dx = Math.random() * 6 - 3;
        b.dy = -4;
        released = true;
      }
    }
    if (released) showTempMessage("Released stuck balls");
  }

  // Space to release stuck balls
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") releaseStuckBalls();
  });

  // Click canvas to release stuck balls
  canvas.addEventListener("click", () => releaseStuckBalls());
  // Touch support (mobile): track the first touch
  window.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches && e.touches[0])
        updatePaddleFromClientX(e.touches[0].clientX);
    },
    { passive: true }
  );

  // Pointer events (unified input) as a fallback
  window.addEventListener("pointermove", (e) => {
    if (e.pointerType) updatePaddleFromClientX(e.clientX);
  });

  // Buttons
  document.getElementById("start-btn").addEventListener("click", () => {
    if (!running) {
      paused = false;
      const pb = document.getElementById("pause-btn");
      if (pb) {
        pb.textContent = "Pause";
        pb.setAttribute("aria-pressed", "false");
        pb.disabled = false;
      }
      running = true;
      loop();
    }
  });
  document
    .getElementById("restart-btn")
    .addEventListener("click", () => restartGame());

  // Pause button
  const pauseBtn = document.getElementById("pause-btn");
  if (pauseBtn) {
    pauseBtn.addEventListener("click", () => {
      togglePause();
    });
  }

  // Keyboard shortcut: 'P' to pause/resume
  document.addEventListener("keydown", (e) => {
    if (e.key === "p" || e.key === "P") togglePause();
  });

  function togglePause() {
    const pb = document.getElementById("pause-btn");
    if (!pb) return;
    if (paused) {
      // resume
      paused = false;
      pb.textContent = "Pause";
      pb.setAttribute("aria-pressed", "false");
      if (!running) {
        running = true;
        loop();
      }
    } else {
      // pause
      paused = true;
      pb.textContent = "Resume";
      pb.setAttribute("aria-pressed", "true");
      if (running) {
        running = false;
        cancelAnimationFrame(rafId);
      }
    }
  }

  function startGame() {
    brick.rows = 5; // reset to default layout
    initBricks();
    // assign between 2 and 8 powerups to random bricks
    assignPowerupBricks(randInt(2, 8));
    score = 0;
    lives = 3;
    level = 1;
    powerups = [];
    clearEffects();
    resetBallAndPaddle();
    try {
      hideOverlay();
    } catch (e) {}
    updateHighScore();
    draw();
  }

  function restartGame() {
    running = false;
    cancelAnimationFrame(rafId);
    brick.rows = 5; // reset to default layout
    initBricks();
    assignPowerupBricks(randInt(2, 8));
    score = 0;
    lives = 3;
    level = 1;
    powerups = [];
    clearEffects();
    resetBallAndPaddle();
    try {
      hideOverlay();
    } catch (e) {}
    updateHighScore();
    draw();
  }

  // Overlay helpers
  function showOverlay(title, message) {
    const o = document.getElementById("game-overlay");
    const pb = document.getElementById("pause-btn");
    if (pb) pb.disabled = true; // disable pause while overlay is visible
    if (!o) return;
    document.getElementById("overlay-title").textContent = title;
    document.getElementById("overlay-message").textContent = message;
    o.setAttribute("aria-hidden", "false");
  }
  function hideOverlay() {
    const o = document.getElementById("game-overlay");
    const pb = document.getElementById("pause-btn");
    if (pb) pb.disabled = false;
    if (!o) return;
    o.setAttribute("aria-hidden", "true");
  }

  function showLevelScene(n) {
    const ls = document.getElementById("level-scene");
    if (!ls) return;
    document.getElementById("level-scene-title").textContent = "Level " + n;
    ls.setAttribute("aria-hidden", "false");
    const pb = document.getElementById("pause-btn");
    if (pb) pb.disabled = true;
  }
  function hideLevelScene() {
    const ls = document.getElementById("level-scene");
    const pb = document.getElementById("pause-btn");
    if (pb) pb.disabled = false;
    if (!ls) return;
    ls.setAttribute("aria-hidden", "true");
  }

  function proceedToNextLevel() {
    if (!pendingLevelScene) return;
    level = pendingLevelScene.level;
    brick.rows = pendingLevelScene.rows;
    initBricks();
    assignPowerupBricks(randInt(2, 8));
    resetBallAndPaddle();
    // Apply speed multiplier for the level to balls
    for (const bb of balls) {
      bb.dx *= pendingLevelScene.speedFactor;
      bb.dy *= pendingLevelScene.speedFactor;
    }
    pendingLevelScene = null;
    hideLevelScene();
    // resume game loop
    if (!running) {
      running = true;
      loop();
    }
  }

  // Setup overlay button listeners after DOM is ready
  document.addEventListener("DOMContentLoaded", () => {
    const or = document.getElementById("overlay-restart");
    const overlay = document.getElementById("game-overlay");
    if (or)
      or.addEventListener("click", () => {
        hideOverlay();
        restartGame();
      });
    if (overlay)
      overlay.addEventListener("click", (e) => {
        if (e.target.id === "game-overlay") hideOverlay();
      });

    // level-scene click to continue
    const levelScene = document.getElementById("level-scene");
    if (levelScene)
      levelScene.addEventListener("click", () => {
        proceedToNextLevel();
      });
  });

  // Initialize on load
  startGame();
})();
