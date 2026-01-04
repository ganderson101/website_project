// game2.js — Runaway Ball Runner
// Simple endless runner: jump over obstacles, score increases over time

(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const cw = canvas.width; // 800
  const ch = canvas.height; // 200

  // Ground level
  const groundY = ch - 20;

  // Helper: get ground height at x position (slope from left to right)
  function getGroundYAtX(x) {
    return groundY - 20 + (20 * x) / cw; // slope from -20 to 0
  }

  // Dino (now a circle/ball)
  const dino = {
    x: 50,
    r: 20, // radius instead of w/h
    y: getGroundYAtX(50) - 20, // on the ground
    vy: 0,
    gravity: 1.2,
    jumpPower: -18,
    isJumping: false,
  };

  // Obstacles (cacti)
  let obstacles = [];
  let obstacleTimer = 0;
  const obstacleInterval = 80; // frames between spawns

  // Power-ups
  let powerups = [];
  let activeEffects = {
    shield: false,
    slowMo: false,
    doublePts: false,
  };
  let effectTimers = {
    shield: 0,
    slowMo: 0,
    doublePts: 0,
  };
  let slowMoTransition = 1.0; // 1.0 = full speed, 0.5 = half speed

  // Particles (for effects)
  let particles = [];

  // Score & game state
  let score = 0;
  let highScore = 0;
  let difficulty = "easy"; // easy, medium, hard

  // Get high score key based on difficulty
  function getHighScoreKey() {
    return `game2_highScore_${difficulty}`;
  }

  // Load high score for current difficulty
  function loadHighScore() {
    const key = getHighScoreKey();
    try {
      highScore = Number(localStorage.getItem(key)) || 0;
    } catch (e) {
      highScore = 0;
    }
  }

  loadHighScore(); // Initial load with easy difficulty

  let running = false;
  let rafId = null;
  let canRestart = true; // Prevent immediate restart after death
  let gameSpeed = 5; // scrolling speed
  let speedIncrement = 0; // gradual speed increase
  let scoreTimer = 0; // frames counter for score increment
  let obstacleIntervalCurrent = 80; // changes based on difficulty
  let nextObstacleIn = 80; // randomized countdown to next spawn
  let parallaxOffset = 0; // for background scrolling

  // Set random interval for next obstacle spawn
  function setRandomObstacleInterval() {
    // Vary interval by ±30% of base interval
    const variance = obstacleIntervalCurrent * 0.3;
    nextObstacleIn =
      obstacleIntervalCurrent - variance + Math.random() * (variance * 2);
  }
  function updateHighScore() {
    if (score > highScore) {
      highScore = score;
      const key = getHighScoreKey();
      try {
        localStorage.setItem(key, String(highScore));
      } catch (e) {
        // ignore
      }
    }
  }

  // Show/hide overlay
  function showOverlay(title, text) {
    const overlay = document.getElementById("game-overlay");
    document.getElementById("overlay-title").textContent = title;
    document.getElementById("overlay-text").textContent = text;
    overlay.classList.add("show");
    document.getElementById("restart-btn").style.display = "inline-block";
  }

  function hideOverlay() {
    document.getElementById("game-overlay").classList.remove("show");
    document.getElementById("restart-btn").style.display = "none";
  }

  // Initialize game
  function startGame() {
    // Cancel any existing animation frame first
    if (rafId) cancelAnimationFrame(rafId);

    dino.y = getGroundYAtX(dino.x) - dino.r;
    dino.vy = 0;
    dino.isJumping = false;
    obstacles = [];
    obstacleTimer = 0;
    powerups = [];
    particles = [];
    parallaxOffset = 0;
    activeEffects = { shield: false, slowMo: false, doublePts: false };
    effectTimers = { shield: 0, slowMo: 0, doublePts: 0 };
    score = 0;
    scoreTimer = 0;
    gameSpeed = 5;
    speedIncrement = 0;
    setRandomObstacleInterval();

    // Set difficulty parameters
    if (difficulty === "easy") {
      obstacleIntervalCurrent = 100; // slower spawns
      // speedIncrement will be slower (handled in update)
    } else if (difficulty === "medium") {
      obstacleIntervalCurrent = 80; // normal
    } else if (difficulty === "hard") {
      obstacleIntervalCurrent = 60; // faster spawns
    } else {
      // insane
      obstacleIntervalCurrent = 45; // very fast spawns
    }

    hideOverlay();
    running = true;
    loop();
  }

  function restartGame() {
    if (rafId) cancelAnimationFrame(rafId);
    startGame();
  }

  // Jump
  function jump() {
    if (!dino.isJumping) {
      dino.vy = dino.jumpPower;
      dino.isJumping = true;
      // Create jump particles
      spawnJumpParticles();
    }
  }

  // Spawn jump particles (dust cloud)
  function spawnJumpParticles() {
    for (let i = 0; i < 8; i++) {
      particles.push({
        x: dino.x,
        y: dino.y + dino.r,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 2 + 1,
        life: 15,
        maxLife: 15,
        size: 3 + Math.random() * 2,
      });
    }
  }

  // Spawn power-up
  function spawnPowerup() {
    const types = ["shield", "slowMo", "doublePts"];
    const type = types[Math.floor(Math.random() * types.length)];

    // Try to find a position that doesn't overlap with obstacles
    let attempts = 0;
    let validPosition = false;
    let spawnX, spawnY;

    while (!validPosition && attempts < 20) {
      spawnX = cw + Math.random() * 200; // Random position ahead
      spawnY = getGroundYAtX(spawnX) - 50;

      // Check if this position overlaps with any obstacle
      validPosition = true;
      for (const obs of obstacles) {
        // Check AABB collision
        if (
          spawnX < obs.x + obs.w &&
          spawnX + 20 > obs.x &&
          spawnY < obs.y + obs.h &&
          spawnY + 20 > obs.y
        ) {
          validPosition = false;
          break;
        }
      }
      attempts++;
    }

    // Only spawn if we found a valid position
    if (validPosition) {
      powerups.push({
        x: spawnX,
        y: spawnY,
        w: 20,
        h: 20,
        type,
      });
    }
  }

  // Activate power-up
  function activatePowerup(type) {
    if (type === "shield") {
      activeEffects.shield = true;
      effectTimers.shield = 999999; // Lasts until used
    } else if (type === "slowMo") {
      activeEffects.slowMo = true;
      effectTimers.slowMo = 120; // 2 seconds
    } else if (type === "doublePts") {
      activeEffects.doublePts = true;
      effectTimers.doublePts = 300; // 5 seconds
    }
  }

  // Spawn obstacle
  function spawnObstacle() {
    const types = ["tire", "cone", "barrier", "box", "sign", "rock"];
    const type = types[Math.floor(Math.random() * types.length)];
    let w, h;

    // Height multiplier based on score (increases difficulty)
    const heightScale = 1 + Math.min(score / 500, 0.8); // up to 1.8x at score 400+

    if (type === "tire") {
      w = 35;
      h = 35 * heightScale;
    } else if (type === "cone") {
      w = 25;
      h = 50 * heightScale;
    } else if (type === "barrier") {
      w = 35 + Math.random() * 25;
      h = (40 + Math.random() * 20) * heightScale;
    } else if (type === "box") {
      w = 30;
      h = 35 * heightScale;
    } else if (type === "sign") {
      w = 15;
      h = 55 * heightScale;
    } else {
      // rock
      w = 40 + Math.random() * 15;
      h = (30 + Math.random() * 15) * heightScale;
    }

    obstacles.push({
      x: cw,
      y: getGroundYAtX(cw) - h, // sit on ground at right edge
      w,
      h,
      type,
    });

    // 15% chance to spawn a power-up instead of/with obstacle
    if (Math.random() < 0.15) {
      spawnPowerup();
    }
  }

  // Update game state
  function update() {
    if (!running) return;

    // Dino physics
    dino.vy += dino.gravity;
    dino.y += dino.vy;

    // Ground check - ball sits on the slope
    const groundAtBall = getGroundYAtX(dino.x);
    if (dino.y >= groundAtBall - dino.r) {
      dino.y = groundAtBall - dino.r;
      dino.vy = 0;
      dino.isJumping = false;
    }

    // Spawn obstacles with randomized intervals
    obstacleTimer++;
    if (obstacleTimer > nextObstacleIn) {
      spawnObstacle();
      obstacleTimer = 0;
      setRandomObstacleInterval();
    }

    // Increment score over time (every 6 frames = +1 point)
    scoreTimer++;
    if (scoreTimer >= 6) {
      let points = 1;
      if (activeEffects.doublePts) points = 2;
      score += points;
      updateHighScore();
      scoreTimer = 0;
    }

    // Update parallax offset
    parallaxOffset += gameSpeed * 0.3; // slower than game speed
    if (parallaxOffset > 40) parallaxOffset = 0;

    // Update power-up effects timers
    for (const effect in effectTimers) {
      if (effectTimers[effect] > 0) {
        effectTimers[effect]--;
        if (effectTimers[effect] === 0) {
          activeEffects[effect] = false;
        }
      }
    }

    // Smooth slowMo transition (ramp speed up gradually when effect ends)
    if (activeEffects.slowMo) {
      // Target is 0.5 speed
      slowMoTransition = Math.max(0.5, slowMoTransition - 0.05);
    } else {
      // Ramp back up to full speed gradually
      slowMoTransition = Math.min(1.0, slowMoTransition + 0.02);
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Move and check power-ups
    for (let i = powerups.length - 1; i >= 0; i--) {
      const pu = powerups[i];
      pu.x -= gameSpeed;
      // Check collision with ball
      if (
        dino.x < pu.x + pu.w &&
        dino.x + dino.r * 2 > pu.x &&
        dino.y < pu.y + pu.h &&
        dino.y + dino.r * 2 > pu.y
      ) {
        activatePowerup(pu.type);
        powerups.splice(i, 1);
        continue;
      }
      // Remove off-screen
      if (pu.x + pu.w < 0) powerups.splice(i, 1);
    }

    // Move obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.x -= gameSpeed;
      // Keep obstacle on the slope ground
      obs.y = getGroundYAtX(obs.x) - obs.h;
      // Remove off-screen
      if (obs.x + obs.w < 0) {
        obstacles.splice(i, 1);
        continue;
      }

      // Collision detection (circle vs rectangle)
      // For rocks, use a tighter collision box since they have an irregular shape
      let collisionW = obs.w;
      let collisionH = obs.h;
      let collisionX = obs.x;

      if (obs.type === "rock") {
        collisionW = obs.w * 0.7;
        collisionX = obs.x + obs.w * 0.15;
      }

      const closestX = Math.max(
        collisionX,
        Math.min(dino.x, collisionX + collisionW)
      );
      const closestY = Math.max(obs.y, Math.min(dino.y, obs.y + collisionH));
      const distX = dino.x - closestX;
      const distY = dino.y - closestY;
      const distance = Math.sqrt(distX * distX + distY * distY);

      if (distance < dino.r) {
        // Check if shield is active
        if (activeEffects.shield) {
          activeEffects.shield = false;
          effectTimers.shield = 0;
          // Create shield burst particles
          for (let j = 0; j < 15; j++) {
            particles.push({
              x: dino.x,
              y: dino.y,
              vx: (Math.random() - 0.5) * 8,
              vy: (Math.random() - 0.5) * 8,
              life: 20,
              maxLife: 20,
              size: 2 + Math.random() * 3,
            });
          }
        } else {
          // Game over
          running = false;
          canRestart = false; // Prevent immediate restart
          cancelAnimationFrame(rafId);
          setTimeout(() => {
            showOverlay(
              "GAME OVER",
              `Score: ${score} | High Score: ${highScore}`
            );
            // Allow restart after a delay
            setTimeout(() => {
              canRestart = true;
            }, 500);
          }, 20);
          return;
        }
      }
    }

    // Increase speed gradually (based on difficulty)
    let speedMultiplier = 0.001; // medium
    if (difficulty === "easy") {
      speedMultiplier = 0.0005;
    } else if (difficulty === "hard") {
      speedMultiplier = 0.0015;
    } else if (difficulty === "insane") {
      speedMultiplier = 0.0025; // crazy speed increase
    }
    speedIncrement += speedMultiplier;
    gameSpeed = 5 + speedIncrement;

    // Apply slowMo transition smoothly (no sudden changes)
    gameSpeed *= slowMoTransition;
  }

  // Draw
  function draw() {
    // Clear
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cw, ch);

    // Parallax background (clouds scrolling smoothly from right)
    // Use a static offset that doesn't need continuous calculation
    const cloudOffset = (gameSpeed * 2) % (cw + 200);
    ctx.fillStyle = "rgba(200, 200, 220, 0.15)";

    // Draw multiple clouds continuously without expensive modulo in loop
    for (let i = 0; i < 5; i++) {
      const baseX = cw + i * 200 - cloudOffset;

      // Cloud shape (three circles)
      ctx.beginPath();
      ctx.arc(baseX, 50, 25, 0, Math.PI * 2);
      ctx.arc(baseX + 30, 40, 35, 0, Math.PI * 2);
      ctx.arc(baseX + 60, 50, 25, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ground line (tilted downward slope)
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY - 20); // left side higher
    ctx.lineTo(cw, groundY); // right side lower
    ctx.stroke();

    // Ground fill below the line
    ctx.fillStyle = "rgba(85, 85, 85, 0.3)";
    ctx.beginPath();
    ctx.moveTo(0, groundY - 20);
    ctx.lineTo(cw, groundY);
    ctx.lineTo(cw, ch);
    ctx.lineTo(0, ch);
    ctx.closePath();
    ctx.fill();

    // Dino (circle/ball)

    // Shield visual - blue orb around ball
    if (activeEffects.shield) {
      // Outer blue orb (semi-transparent)
      const pulseAlpha = 0.25 + Math.sin(Date.now() * 0.005) * 0.1;
      ctx.fillStyle = `rgba(0, 153, 255, ${pulseAlpha})`;
      ctx.beginPath();
      ctx.arc(dino.x, dino.y, dino.r + 10, 0, Math.PI * 2);
      ctx.fill();

      // Bright inner ring
      ctx.strokeStyle = "#0099ff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(dino.x, dino.y, dino.r + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Ball itself
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(dino.x, dino.y, dino.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();

    // Obstacles (tires, cones, barriers)
    for (const obs of obstacles) {
      if (obs.type === "tire") {
        // Draw tire (circle with hole)
        ctx.fillStyle = "#333";
        ctx.beginPath();
        ctx.arc(
          obs.x + obs.w / 2,
          obs.y + obs.h / 2,
          obs.w / 2,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.closePath();
        // Inner hole
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(
          obs.x + obs.w / 2,
          obs.y + obs.h / 2,
          obs.w / 4,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.closePath();
      } else if (obs.type === "cone") {
        // Draw traffic cone (triangle + stripes)
        ctx.fillStyle = "#ff6600";
        ctx.beginPath();
        ctx.moveTo(obs.x + obs.w / 2, obs.y);
        ctx.lineTo(obs.x, obs.y + obs.h);
        ctx.lineTo(obs.x + obs.w, obs.y + obs.h);
        ctx.closePath();
        ctx.fill();
        // White stripes
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obs.x + obs.w * 0.3, obs.y + obs.h * 0.4);
        ctx.lineTo(obs.x + obs.w * 0.7, obs.y + obs.h * 0.4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(obs.x + obs.w * 0.2, obs.y + obs.h * 0.7);
        ctx.lineTo(obs.x + obs.w * 0.8, obs.y + obs.h * 0.7);
        ctx.stroke();
      } else if (obs.type === "barrier") {
        // Draw barrier (rectangle with stripes)
        ctx.fillStyle = "#ffcc00";
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        // Black diagonal stripes
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3;
        for (let i = 0; i < obs.w + obs.h; i += 10) {
          ctx.beginPath();
          ctx.moveTo(obs.x + i, obs.y);
          ctx.lineTo(obs.x, obs.y + i);
          ctx.stroke();
        }
      } else if (obs.type === "box") {
        // Draw cardboard box (brown rectangle with tape)
        ctx.fillStyle = "#8B4513";
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        // Tape
        ctx.strokeStyle = "#D2691E";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y + obs.h / 2);
        ctx.lineTo(obs.x + obs.w, obs.y + obs.h / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(obs.x + obs.w / 2, obs.y);
        ctx.lineTo(obs.x + obs.w / 2, obs.y + obs.h);
        ctx.stroke();
      } else if (obs.type === "sign") {
        // Draw warning sign (red pole with yellow triangle)
        ctx.fillStyle = "#cc0000";
        ctx.fillRect(
          obs.x + obs.w / 2 - 3,
          obs.y + obs.h * 0.4,
          6,
          obs.h * 0.6
        );
        // Triangle sign
        ctx.fillStyle = "#ffcc00";
        ctx.beginPath();
        ctx.moveTo(obs.x + obs.w / 2, obs.y);
        ctx.lineTo(obs.x, obs.y + obs.h * 0.45);
        ctx.lineTo(obs.x + obs.w, obs.y + obs.h * 0.45);
        ctx.closePath();
        ctx.fill();
        // Exclamation mark
        ctx.fillStyle = "#000";
        ctx.fillRect(
          obs.x + obs.w / 2 - 2,
          obs.y + obs.h * 0.1,
          4,
          obs.h * 0.2
        );
        ctx.fillRect(obs.x + obs.w / 2 - 2, obs.y + obs.h * 0.35, 4, 4);
      } else if (obs.type === "rock") {
        // Draw rock (irregular grey polygon)
        ctx.fillStyle = "#666";
        ctx.beginPath();
        ctx.moveTo(obs.x + obs.w * 0.2, obs.y + obs.h);
        ctx.lineTo(obs.x + obs.w * 0.1, obs.y + obs.h * 0.6);
        ctx.lineTo(obs.x + obs.w * 0.3, obs.y + obs.h * 0.2);
        ctx.lineTo(obs.x + obs.w * 0.5, obs.y);
        ctx.lineTo(obs.x + obs.w * 0.7, obs.y + obs.h * 0.3);
        ctx.lineTo(obs.x + obs.w * 0.9, obs.y + obs.h * 0.5);
        ctx.lineTo(obs.x + obs.w * 0.8, obs.y + obs.h);
        ctx.closePath();
        ctx.fill();
        // Highlights
        ctx.fillStyle = "#888";
        ctx.beginPath();
        ctx.arc(
          obs.x + obs.w * 0.4,
          obs.y + obs.h * 0.4,
          obs.w * 0.1,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }

    // Power-ups
    for (const pu of powerups) {
      // Color based on type
      let color = "#00ff00";
      if (pu.type === "shield") color = "#0099ff";
      else if (pu.type === "slowMo") color = "#ffaa00";
      else if (pu.type === "doublePts") color = "#ff00ff";

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pu.x + pu.w / 2, pu.y + pu.h / 2, pu.w / 2, 0, Math.PI * 2);
      ctx.fill();

      // Draw simple logo based on type
      const cx = pu.x + pu.w / 2;
      const cy = pu.y + pu.h / 2;
      ctx.strokeStyle = "#000";
      ctx.fillStyle = "#000";
      ctx.lineWidth = 2;

      if (pu.type === "shield") {
        // Shield icon - rounded shield shape
        ctx.beginPath();
        ctx.moveTo(cx, cy - 8);
        ctx.lineTo(cx + 6, cy - 4);
        ctx.lineTo(cx + 6, cy + 2);
        ctx.lineTo(cx, cy + 8);
        ctx.lineTo(cx - 6, cy + 2);
        ctx.lineTo(cx - 6, cy - 4);
        ctx.closePath();
        ctx.stroke();
      } else if (pu.type === "slowMo") {
        // Clock icon - circle with hands
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, cy - 4);
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + 3, cy);
        ctx.stroke();
      } else if (pu.type === "doublePts") {
        // x2 multiplier icon
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("x2", cx, cy);
      }
    }

    // Particles (dust/air effect)
    for (const p of particles) {
      const alpha = p.life / p.maxLife;
      // Use tan/brown dust color that fades with increased transparency
      ctx.fillStyle = `rgba(200, 170, 130, ${alpha * 0.5})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Active effects indicator
    let effectText = "";
    if (activeEffects.shield) effectText += "Shield ";
    if (activeEffects.slowMo) effectText += "SlowMo ";
    if (activeEffects.doublePts) effectText += "2x ";
    if (effectText) {
      ctx.fillStyle = "#ffff00";
      ctx.font = "14px monospace";
      ctx.textAlign = "left";
      ctx.fillText(effectText, 20, 30);
    }

    // Score
    ctx.fillStyle = "#fff";
    ctx.font = "20px monospace";
    ctx.textAlign = "right";
    ctx.fillText(`Score: ${score}`, cw - 20, 30);
    ctx.fillText(`High: ${highScore}`, cw - 20, 55);
  }

  // Game loop
  function loop() {
    update();
    draw();
    rafId = requestAnimationFrame(loop);
  }

  // Input: jump on space, up arrow, or mousedown/touch
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      if (!running && canRestart) {
        startGame();
      } else if (running) {
        jump();
      }
    }
  });

  // Window-level mousedown to catch clicks anywhere on the page
  window.addEventListener("mousedown", (e) => {
    // Ignore clicks on buttons, links, and form elements
    if (
      e.target.tagName === "BUTTON" ||
      e.target.tagName === "A" ||
      e.target.classList.contains("difficulty-btn")
    ) {
      return;
    }

    // Check if click is horizontally within canvas bounds
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX;

    // Allow clicks within canvas width, any vertical position
    if (x >= rect.left && x <= rect.right) {
      e.preventDefault();
      if (!running && canRestart) {
        startGame();
      } else if (running) {
        jump();
      }
    }
  });

  // Touch support (mobile) - on canvas
  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      if (!running && canRestart) {
        startGame();
      } else if (running) {
        jump();
      }
    },
    { passive: false }
  );

  // Buttons
  document.getElementById("start-btn").addEventListener("click", () => {
    if (!running) startGame();
  });

  document.getElementById("restart-btn").addEventListener("click", () => {
    restartGame();
  });

  // Difficulty selection
  document.querySelectorAll(".difficulty-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!running) {
        // Remove active from all buttons
        document.querySelectorAll(".difficulty-btn").forEach((b) => {
          b.classList.remove("active");
        });
        // Add active to clicked button
        btn.classList.add("active");
        // Set difficulty and load corresponding high score
        difficulty = btn.getAttribute("data-difficulty");
        loadHighScore();
      }
    });
  });
})();
