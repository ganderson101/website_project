// game2.js — Ball Game Runner
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
  let gameSpeed = 5; // scrolling speed
  let speedIncrement = 0; // gradual speed increase
  let scoreTimer = 0; // frames counter for score increment
  let obstacleIntervalCurrent = 80; // changes based on difficulty
  let nextObstacleIn = 80; // randomized countdown to next spawn

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
      score += 1;
      updateHighScore();
      scoreTimer = 0;
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
        // Game over
        running = false;
        cancelAnimationFrame(rafId);
        setTimeout(() => {
          showOverlay(
            "GAME OVER",
            `Score: ${score} | High Score: ${highScore}`
          );
        }, 20);
        return;
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
  }

  // Draw
  function draw() {
    // Clear
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cw, ch);

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
      if (!running) {
        startGame();
      } else {
        jump();
      }
    }
  });

  canvas.addEventListener("mousedown", (e) => {
    e.preventDefault();
    if (!running) {
      startGame();
    } else {
      jump();
    }
  });

  // Touch support (mobile)
  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      if (!running) {
        startGame();
      } else {
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
