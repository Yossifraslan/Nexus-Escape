"use strict";

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[rand(0, arr.length - 1)];
}
function pad2(n) {
  return n.toString().padStart(2, "0");
}
function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${pad2(m)}:${pad2(s)}`;
}
function hexString(len) {
  let out = "0x";
  const chars = "0123456789ABCDEF";
  for (let i = 0; i < len; i++) out += chars[rand(0, 15)];
  return out;
}
function $(id) {
  return document.getElementById(id);
}

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  ensureContext() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  tone(
    freq,
    duration,
    { type = "sine", gain = 0.15, sweepTo = null, delay = 0 } = {},
  ) {
    if (this.muted) return;
    try {
      const ctx = this.ensureContext();
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = type;
      const startAt = ctx.currentTime + delay;
      osc.frequency.setValueAtTime(freq, startAt);
      if (sweepTo)
        osc.frequency.exponentialRampToValueAtTime(sweepTo, startAt + duration);
      amp.gain.setValueAtTime(0.0001, startAt);
      amp.gain.exponentialRampToValueAtTime(gain, startAt + 0.015);
      amp.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      osc.connect(amp).connect(ctx.destination);
      osc.start(startAt);
      osc.stop(startAt + duration + 0.05);
    } catch (e) {}
  }

  click() {
    this.tone(880, 0.06, { type: "square", gain: 0.08 });
  }
  toggle() {
    this.tone(520, 0.08, { type: "triangle", gain: 0.09 });
  }
  error() {
    this.tone(160, 0.22, { type: "sawtooth", gain: 0.12, sweepTo: 90 });
  }
  success() {
    [660, 880, 1320].forEach((f, i) =>
      this.tone(f, 0.18, { type: "sine", gain: 0.13, delay: i * 0.09 }),
    );
  }
  glitch() {
    for (let i = 0; i < 4; i++)
      this.tone(rand(120, 900), 0.04, {
        type: "square",
        gain: 0.06,
        delay: i * 0.035,
      });
  }
  alarm() {
    this.tone(440, 0.35, { type: "sawtooth", gain: 0.1, sweepTo: 220 });
  }
  victory() {
    [523, 659, 784, 1046].forEach((f, i) =>
      this.tone(f, 0.3, { type: "triangle", gain: 0.14, delay: i * 0.14 }),
    );
  }
  matchFound() {
    this.tone(720, 0.12, { type: "sine", gain: 0.1, sweepTo: 1100 });
  }
}

class ParticleField {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.points = [];
    this.running = false;
    this.resize = this.resize.bind(this);
    this.tick = this.tick.bind(this);
    window.addEventListener("resize", this.resize);
    this.resize();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    const count = Math.min(
      70,
      Math.floor((window.innerWidth * window.innerHeight) / 22000),
    );
    this.points = Array.from({ length: count }, () => ({
      x: Math.random() * this.canvas.width,
      y: Math.random() * this.canvas.height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.6 + 0.4,
    }));
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.tick();
  }

  stop() {
    this.running = false;
  }

  tick() {
    if (!this.running) return;
    const { ctx, canvas, points } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of points) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0, 234, 255, 0.55)";
      ctx.fill();
    }

    const maxDist = 130;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dx = points[i].x - points[j].x;
        const dy = points[i].y - points[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDist) {
          ctx.strokeStyle = `rgba(0, 234, 255, ${0.12 * (1 - dist / maxDist)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(points[i].x, points[i].y);
          ctx.lineTo(points[j].x, points[j].y);
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(this.tick);
  }
}

class Telemetry {
  constructor() {
    this.cpuFill = $("cpu-fill");
    this.secFill = $("sec-fill");
    this.clockEl = $("digital-clock");
    this.hexEl = $("hex-strip");
    this.logEl = $("system-log");
    this.intervalHandles = [];
    this.messages = [
      "PING nexus-core.local ... 4ms",
      "ROUTING TABLE UPDATED",
      "CACHE FLUSH: SECTOR 7",
      "INTRUSION SENSOR: NOMINAL",
      "PACKET LOSS: 0.02%",
      "REBALANCING LOAD ACROSS CORES",
      "ANOMALY LOGGED: LOW SEVERITY",
      "SUBPROCESS 0x4F SPAWNED",
      "MEMORY LATTICE INTEGRITY: 94%",
      "FIREWALL RULESET REFRESHED",
      "HEARTBEAT ACK FROM NODE 12",
      "ENCRYPTION HANDSHAKE COMPLETE",
    ];
  }

  start() {
    this.stop();
    this.updateClock();
    this.updateBars();
    this.updateHex();
    this.intervalHandles.push(setInterval(() => this.updateClock(), 1000));
    this.intervalHandles.push(setInterval(() => this.updateBars(), 1400));
    this.intervalHandles.push(setInterval(() => this.updateHex(), 2200));
    this.intervalHandles.push(setInterval(() => this.postLog(), 2600));
  }

  stop() {
    this.intervalHandles.forEach(clearInterval);
    this.intervalHandles = [];
  }

  updateClock() {
    const now = new Date();
    this.clockEl.textContent = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  }

  updateBars() {
    const cpu = 35 + Math.sin(Date.now() / 900) * 15 + rand(-8, 8);
    const sec = 55 + Math.cos(Date.now() / 1300) * 20 + rand(-6, 6);
    this.cpuFill.style.width = `${Math.max(6, Math.min(100, cpu))}%`;
    this.secFill.style.width = `${Math.max(6, Math.min(100, sec))}%`;
  }

  updateHex() {
    this.hexEl.textContent = hexString(8);
  }

  postLog() {
    const line = document.createElement("div");
    line.className = "log-line";
    line.textContent = `[${formatClock(Math.floor(Date.now() / 1000) % 3600)}] ${pick(this.messages)}`;
    this.logEl.appendChild(line);
    while (this.logEl.children.length > 5)
      this.logEl.removeChild(this.logEl.firstChild);
    setTimeout(() => line.remove(), 6000);
  }
}

class CountdownTimer {
  constructor(totalSeconds, { onTick, onExpire }) {
    this.total = totalSeconds;
    this.remaining = totalSeconds;
    this.onTick = onTick;
    this.onExpire = onExpire;
    this.handle = null;
  }

  start() {
    this.stop();
    this.handle = setInterval(() => {
      this.remaining -= 1;
      this.onTick(this.remaining);
      if (this.remaining <= 0) {
        this.stop();
        this.onExpire();
      }
    }, 1000);
  }

  stop() {
    if (this.handle) clearInterval(this.handle);
    this.handle = null;
  }

  addTime(seconds) {
    this.remaining = Math.min(this.total, this.remaining + seconds);
  }
}

class TerminalPuzzle {
  constructor(game) {
    this.game = game;
    this.solved = false;
    this.logEl = $("terminal-log");
    this.input = $("terminal-input");
    this.submitBtn = $("terminal-submit");
    this.clueGrid = $("clue-grid");
    this.generateCode();
    this.render();
    this.bind();
  }

  generateCode() {
    const first = rand(4, 9);
    const cores = rand(2, 8);
    const flagged = rand(0, 9);
    const last = (first * 2) % 10;
    this.code = [first, cores, flagged, last];
    this.coreCount = cores;
    this.flaggedCount = flagged;
  }

  bind() {
    this.submitBtn.addEventListener("click", () => this.tryCode());
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.tryCode();
    });
    this.input.addEventListener("input", () => {
      this.input.value = this.input.value.replace(/[^0-9]/g, "").slice(0, 4);
    });
  }

  render() {
    this.logEl.innerHTML = "";
    this.printLines([
      { text: "NEXUS TERMINAL v4.7", cls: "t-info" },
      { text: "SECURITY PROTOCOL ACTIVE", cls: "t-info" },
      { text: "Enter authorization sequence:", cls: "" },
    ]);

    this.clueGrid.innerHTML = `
      <div class="clue-card">The first number is <em>greater than 3</em>.</div>
      <div class="clue-card">CORES ONLINE: <em>${this.coreCount}</em> — the second number matches.</div>
      <div class="clue-card">SUBSYSTEMS FLAGGED: <em>${this.flaggedCount}</em> — the third number matches.</div>
      <div class="clue-card">The final number is <em>twice the first</em> (wrap past 9 back to 0).</div>
    `;
  }

  printLines(lines) {
    lines.forEach((l, i) => {
      const div = document.createElement("div");
      div.className = `t-line ${l.cls || ""}`;
      div.style.animationDelay = `${i * 90}ms`;
      div.textContent = l.text;
      this.logEl.appendChild(div);
    });
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  tryCode() {
    if (this.solved) return;
    const attempt = this.input.value;
    if (attempt.length !== 4) {
      this.printLines([
        { text: "> ERROR: sequence must be 4 digits.", cls: "t-error" },
      ]);
      this.game.audio.error();
      return;
    }
    const digits = attempt.split("").map(Number);
    const correct = digits.every((d, i) => d === this.code[i]);

    this.printLines([{ text: `> ${attempt}`, cls: "" }]);

    if (correct) {
      this.solved = true;
      this.printLines([{ text: "ACCESS GRANTED", cls: "t-success" }]);
      this.input.disabled = true;
      this.submitBtn.disabled = true;
      this.game.audio.success();
      this.game.collectFragment("terminal");
    } else {
      this.printLines([
        { text: "> ACCESS DENIED — sequence rejected.", cls: "t-error" },
      ]);
      this.game.audio.error();
      this.game.shake();
      this.input.value = "";
    }
  }
}

class SignalPuzzle {
  constructor(game) {
    this.game = game;
    this.solved = false;
    this.symbols = ["+", "-", "*", "/"];
    this.length = rand(6, 8);
    this.sequence = Array.from({ length: this.length }, () =>
      pick(this.symbols),
    );
    this.playerIndex = 0;
    this.mistakes = 0;
    this.maxMistakes = 3;
    this.isPlayingBack = false;

    this.canvas = $("signal-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.displayEl = $("signal-sequence-display");
    this.controlsEl = $("signal-controls");
    this.statusEl = $("signal-status");
    this.mistakesHint = $("signal-mistakes-hint");
    this.startBtn = $("signal-start-btn");

    this.wavePhase = 0;
    this.waveRunning = false;

    this.mistakesHint.textContent = `${this.maxMistakes} mistakes allowed.`;
    this.buildControls();
    this.buildSequenceDots();
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
    this.startBtn.addEventListener("click", () => this.beginPlayback());
  }

  resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * devicePixelRatio;
    this.canvas.height = rect.height * devicePixelRatio;
  }

  buildControls() {
    this.controlsEl.innerHTML = "";
    this.symbols.forEach((sym) => {
      const btn = document.createElement("button");
      btn.className = "signal-btn";
      btn.textContent = sym;
      btn.disabled = true;
      btn.addEventListener("click", () => this.handlePress(sym));
      this.controlsEl.appendChild(btn);
    });
  }

  buildSequenceDots() {
    this.displayEl.innerHTML = "";
    this.sequence.forEach(() => {
      const dot = document.createElement("span");
      dot.className = "seq-glyph";
      dot.textContent = "?";
      this.displayEl.appendChild(dot);
    });
  }

  setControlsEnabled(enabled) {
    [...this.controlsEl.children].forEach((b) => {
      b.disabled = !enabled;
    });
  }

  startWave() {
    if (this.waveRunning) return;
    this.waveRunning = true;
    const draw = () => {
      if (!this.waveRunning) return;
      const { ctx, canvas } = this;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.width,
        h = canvas.height,
        mid = h / 2;

      ctx.lineWidth = 2 * devicePixelRatio;
      ctx.strokeStyle = "rgba(0, 234, 255, 0.8)";
      ctx.beginPath();
      for (let x = 0; x < w; x += 4) {
        const distortion = this.isPlayingBack ? 1.6 : 0.7;
        const y =
          mid +
          Math.sin(x * 0.02 + this.wavePhase) * 18 * distortion +
          Math.sin(x * 0.05 + this.wavePhase * 1.7) * 6;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.strokeStyle = "rgba(255, 47, 216, 0.45)";
      ctx.beginPath();
      for (let x = 0; x < w; x += 4) {
        const y = mid + Math.sin(x * 0.03 - this.wavePhase * 1.3) * 10;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      this.wavePhase += 0.06;
      requestAnimationFrame(draw);
    };
    draw();
  }

  beginPlayback() {
    if (this.solved || this.isPlayingBack) return;
    this.startBtn.disabled = true;
    this.setControlsEnabled(false);
    this.playerIndex = 0;
    this.isPlayingBack = true;
    this.statusEl.textContent = "TRANSMITTING SEQUENCE...";
    this.startWave();

    [...this.displayEl.children].forEach((d) => {
      d.className = "seq-glyph";
      d.textContent = "?";
    });

    let i = 0;
    const step = () => {
      if (i > 0) this.displayEl.children[i - 1].classList.remove("revealed");
      if (i >= this.sequence.length) {
        this.isPlayingBack = false;
        this.statusEl.textContent = "YOUR TURN — repeat the sequence.";
        this.setControlsEnabled(true);
        [...this.displayEl.children].forEach((d) => {
          d.textContent = "?";
          d.className = "seq-glyph";
        });
        return;
      }
      const dot = this.displayEl.children[i];
      dot.textContent = this.sequence[i];
      dot.classList.add("revealed");
      this.game.audio.tone(
        440 + this.symbols.indexOf(this.sequence[i]) * 90,
        0.15,
        { type: "triangle", gain: 0.1 },
      );
      i += 1;
      setTimeout(step, 620);
    };
    step();
  }

  handlePress(sym) {
    if (this.solved || this.isPlayingBack) return;
    this.game.audio.click();
    const expected = this.sequence[this.playerIndex];
    const dot = this.displayEl.children[this.playerIndex];

    if (sym === expected) {
      dot.textContent = sym;
      dot.classList.add("correct");
      this.playerIndex += 1;
      if (this.playerIndex >= this.sequence.length) {
        this.solved = true;
        this.waveRunning = false;
        this.setControlsEnabled(false);
        this.statusEl.textContent = "SIGNAL DECODED";
        this.game.audio.success();
        this.game.collectFragment("signal");
      }
    } else {
      dot.textContent = sym;
      dot.classList.add("wrong");
      this.mistakes += 1;
      this.game.audio.error();
      this.game.shake();
      this.statusEl.textContent = `MISMATCH — ${this.maxMistakes - this.mistakes} attempts left.`;
      this.game.registerMistake();

      if (this.mistakes >= this.maxMistakes) {
        this.statusEl.textContent = "SEQUENCE LOST — RE-TRANSMITTING.";
        this.setControlsEnabled(false);
        this.mistakes = 0;
        setTimeout(() => {
          this.sequence = Array.from({ length: this.length }, () =>
            pick(this.symbols),
          );
          this.buildSequenceDots();
          this.startBtn.disabled = false;
          this.statusEl.textContent = "STANDBY — PRESS START";
        }, 900);
      } else {
        setTimeout(() => {
          this.playerIndex = 0;
          [...this.displayEl.children].forEach((d) => {
            d.textContent = "?";
            d.className = "seq-glyph";
          });
          this.startBtn.disabled = false;
          this.setControlsEnabled(false);
          this.statusEl.textContent = "PRESS START TO RETRY THE SEQUENCE.";
        }, 700);
      }
    }
  }
}

class MemoryPuzzle {
  constructor(game) {
    this.game = game;
    this.solved = false;
    this.glyphs = ["◈", "◆", "✦", "⬢", "⌬", "☍", "⟁", "⌗"];
    this.grid = $("memory-grid");
    this.mistakesEl = $("memory-mistakes");
    this.timerEl = $("memory-timer");
    this.pairsEl = $("memory-pairs");

    this.flipped = [];
    this.matchedCount = 0;
    this.mistakes = 0;
    this.elapsed = 0;
    this.locked = false;
    this.tickHandle = null;

    this.buildDeck();
    this.render();
  }

  buildDeck() {
    const deck = [...this.glyphs, ...this.glyphs]
      .map((sym) => ({ sym, id: Math.random() }))
      .sort(() => Math.random() - 0.5);
    this.deck = deck;
  }

  startClock() {
    if (this.tickHandle) return;
    this.tickHandle = setInterval(() => {
      this.elapsed += 1;
      this.timerEl.textContent = formatClock(this.elapsed);
    }, 1000);
  }

  render() {
    this.grid.innerHTML = "";
    this.deck.forEach((card, index) => {
      const el = document.createElement("div");
      el.className = "mem-card";
      el.dataset.index = index;
      el.innerHTML = `
        <div class="mem-card-inner">
          <div class="mem-face mem-face--back">?</div>
          <div class="mem-face mem-face--front">${card.sym}</div>
        </div>`;
      el.addEventListener("click", () => this.flip(index));
      this.grid.appendChild(el);
    });
  }

  flip(index) {
    if (this.solved || this.locked) return;
    const cardEl = this.grid.children[index];
    if (
      cardEl.classList.contains("flipped") ||
      cardEl.classList.contains("matched")
    )
      return;
    if (this.flipped.length >= 2) return;

    this.startClock();
    this.game.audio.click();
    cardEl.classList.add("flipped");
    this.flipped.push(index);

    if (this.flipped.length === 2) {
      this.locked = true;
      const [a, b] = this.flipped;
      const match = this.deck[a].sym === this.deck[b].sym;

      setTimeout(() => {
        if (match) {
          this.grid.children[a].classList.add("matched");
          this.grid.children[b].classList.add("matched");
          this.matchedCount += 1;
          this.pairsEl.textContent = this.matchedCount;
          this.game.audio.matchFound();

          if (this.matchedCount === this.glyphs.length) {
            this.finish();
          }
        } else {
          this.grid.children[a].classList.remove("flipped");
          this.grid.children[b].classList.remove("flipped");
          this.mistakes += 1;
          this.mistakesEl.textContent = this.mistakes;
          this.game.audio.error();
          this.game.registerMistake();
        }
        this.flipped = [];
        this.locked = false;
      }, 650);
    }
  }

  finish() {
    this.solved = true;
    clearInterval(this.tickHandle);
    this.game.audio.success();
    this.game.collectFragment("memory");
  }
}

class CorePuzzle {
  constructor(game) {
    this.game = game;
    this.solved = false;
    this.stage = $("core-stage");
    this.svg = $("core-svg");
    this.controls = $("core-controls");
    this.lockBanner = $("core-lock-banner");

    this.rings = [
      { radius: 150, step: rand(1, 3), target: 0, color: "var(--cyan)" },
      { radius: 110, step: rand(1, 3), target: 0, color: "var(--magenta)" },
      { radius: 70, step: rand(1, 3), target: 0, color: "var(--good)" },
    ];

    this.setLocked(true);
    this.buildSvg();
    this.buildControls();
  }

  setLocked(locked) {
    this.locked = locked;
    this.stage.classList.toggle("locked", locked);
    this.controls.classList.toggle("locked", locked);
    this.lockBanner.classList.toggle("visible", locked);
  }

  buildSvg() {
    const cx = 200,
      cy = 200;
    this.svg.innerHTML = this.rings
      .map(
        (ring, i) => `
      <g class="core-ring" id="ring-${i}">
        <circle cx="${cx}" cy="${cy}" r="${ring.radius}" fill="none"
          stroke="rgba(255,255,255,0.08)" stroke-width="10" />
        <path class="ring-path" d="M ${cx + ring.radius} ${cy} A ${ring.radius} ${ring.radius} 0 0 1 ${cx} ${cy + ring.radius}"
          fill="none" stroke="${ring.color}" stroke-width="10" stroke-linecap="round" />
      </g>
    `,
      )
      .join("");
    this.rings.forEach((ring, i) => this.applyRotation(i));
  }

  buildControls() {
    this.controls.innerHTML = "";
    this.rings.forEach((_, i) => {
      const btn = document.createElement("button");
      btn.className = "ring-btn";
      btn.textContent = `ROTATE RING ${i + 1}`;
      btn.addEventListener("click", () => this.rotate(i));
      this.controls.appendChild(btn);
    });
  }

  applyRotation(i) {
    const g = $(`ring-${i}`);
    const deg = this.rings[i].step * 90;
    g.style.transform = `rotate(${deg}deg)`;
    const aligned = this.rings[i].step % 4 === this.rings[i].target;
    g.classList.toggle("aligned", aligned);
  }

  rotate(i) {
    if (this.solved || this.locked) return;
    this.game.audio.toggle();
    this.rings[i].step = (this.rings[i].step + 1) % 4;
    this.applyRotation(i);

    const allAligned = this.rings.every((r) => r.step % 4 === r.target);
    if (allAligned) {
      this.solved = true;
      this.game.audio.success();
      this.game.collectFragment("core");
    }
  }
}

const HIGH_SCORE_KEY = "neonEscapeHighScore";
const TOTAL_SECONDS = 300;

class Game {
  constructor() {
    this.audio = new AudioEngine();
    this.particles = new ParticleField($("particle-canvas"));
    this.telemetry = new Telemetry();

    this.fragments = {
      terminal: false,
      signal: false,
      memory: false,
      core: false,
    };
    this.mistakes = 0;
    this.currentView = "terminal";
    this.isTransitioning = false;
    this.particles.start();
    this.bootSequence();
    this.bindStaticButtons();
    this.renderHighScore();
  }

  showScreen(id) {
    document
      .querySelectorAll(".screen")
      .forEach((s) => s.classList.remove("active"));
    $(id).classList.add("active");
  }

  shake() {
    const wrapper = $("shake-wrapper");
    wrapper.classList.remove("is-shaking");
    void wrapper.offsetWidth;
    wrapper.classList.add("is-shaking");
  }

  bootSequence() {
    this.showScreen("screen-boot");
    const log = $("boot-log");
    const lines = [
      "NEXUS-09 KERNEL BOOTING...",
      "MOUNTING PARTITION /containment...",
      "LOADING SECURITY MODULES...",
      "WARNING: INTEGRITY CHECK FAILED (3 sectors)",
      "ESTABLISHING REMOTE SESSION...",
      "CONNECTION ACCEPTED.",
    ];
    let i = 0;
    const next = () => {
      if (i < lines.length) {
        const div = document.createElement("div");
        const isWarn = lines[i].startsWith("WARNING");
        div.textContent = `> ${lines[i]}`;
        if (isWarn) div.className = "boot-ok";
        div.style.color = isWarn ? "var(--warn)" : "";
        log.appendChild(div);
        i += 1;
        setTimeout(next, 220);
      } else {
        setTimeout(() => {
          this.showScreen("screen-start");
          this.isTransitioning = false;
        }, 500);
      }
    };
    setTimeout(next, 300);
  }

  bindStaticButtons() {
    $("btn-init").addEventListener("click", () => this.startGame());
    $("btn-escape").addEventListener("click", () => this.playEscapeSequence());
    $("btn-play-again").addEventListener("click", () => this.reset());
    $("btn-retry").addEventListener("click", () => this.reset());

    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.switchView(btn.dataset.view));
    });

    const notesDrawer = $("notes-drawer");
    const notesInput = $("notes-input");
    $("notes-toggle").addEventListener("click", () => {
      const isOpen = notesDrawer.classList.toggle("open");
      notesDrawer.setAttribute("aria-hidden", String(!isOpen));
      $("notes-toggle").classList.toggle("active", isOpen);
      if (isOpen) notesInput.focus();
    });
    notesInput.value = localStorage.getItem("nexus09-field-notes") || "";
    notesInput.addEventListener("input", () => {
      localStorage.setItem("nexus09-field-notes", notesInput.value);
    });

    $("quiet-toggle").addEventListener("click", () => {
      const quiet = document.body.classList.toggle("quiet-mode");
      $("quiet-toggle").classList.toggle("active", quiet);
      this.audio.muted = quiet;
      localStorage.setItem("nexus09-quiet-mode", String(quiet));
    });
    if (localStorage.getItem("nexus09-quiet-mode") === "true") {
      document.body.classList.add("quiet-mode");
      $("quiet-toggle").classList.add("active");
      this.audio.muted = true;
    }
  }

  renderHighScore() {
    const best = localStorage.getItem(HIGH_SCORE_KEY);
    $("high-score-line").textContent = best
      ? `BEST RUN: ${best} PTS`
      : "NO BEST RUN YET - MAKE THIS ONE COUNT";
  }

  startGame() {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    this.audio.ensureContext();
    this.audio.glitch();

    const overlay = $("glitch-overlay");
    overlay.classList.add("playing");

    setTimeout(() => {
      overlay.classList.remove("playing");
      this.beginRun();
      this.isTransitioning = false;
    }, 640);
  }

  beginRun() {
    this.fragments = {
      terminal: false,
      signal: false,
      memory: false,
      core: false,
    };
    this.mistakes = 0;
    document
      .querySelectorAll(".pip")
      .forEach((p) => p.classList.remove("filled"));
    document
      .querySelectorAll(".nav-btn")
      .forEach((b) => b.classList.remove("done"));
    $("fragment-count").textContent = "0";
    $("system-state").textContent = "UNSTABLE";

    this.terminalPuzzle = new TerminalPuzzle(this);
    this.signalPuzzle = new SignalPuzzle(this);
    this.memoryPuzzle = new MemoryPuzzle(this);
    this.corePuzzle = new CorePuzzle(this);

    this.timer = new CountdownTimer(TOTAL_SECONDS, {
      onTick: (remaining) => this.onTick(remaining),
      onExpire: () => this.onExpire(),
    });
    this.onTick(TOTAL_SECONDS);
    this.timer.start();

    this.telemetry.start();
    this.switchView("terminal");
    this.showScreen("screen-game");
  }

  onTick(remaining) {
    const el = $("timer-value");
    el.textContent = formatClock(remaining);
    el.classList.toggle("timer-warn", remaining <= 180 && remaining > 60);
    el.classList.toggle("timer-critical", remaining <= 60);

    if (remaining === 180 || remaining === 60) {
      this.audio.alarm();
      this.shake();
    }
  }

  onExpire() {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.timer.stop();
    this.telemetry.stop();
    this.audio.alarm();
    this.shake();
    $("system-state").textContent = "LOCKED";
    this.showScreen("screen-lose");
  }

  switchView(name) {
    if (name === "core" && !this.canEnterCore()) {
      this.audio.error();
      this.switchView(this.currentView || "terminal");
      return;
    }
    this.currentView = name;
    this.audio.click();

    document
      .querySelectorAll(".nav-btn")
      .forEach((b) => b.classList.toggle("active", b.dataset.view === name));
    document
      .querySelectorAll(".view")
      .forEach((v) => v.classList.toggle("active", v.dataset.view === name));

    if (name === "core" && this.corePuzzle) this.corePuzzle.setLocked(false);
  }

  canEnterCore() {
    return (
      this.fragments.terminal && this.fragments.signal && this.fragments.memory
    );
  }

  collectFragment(key) {
    if (this.fragments[key]) return;
    this.fragments[key] = true;

    const pip = document.querySelector(`.pip[data-frag="${key}"]`);
    if (pip) pip.classList.add("filled");
    const navBtn = document.querySelector(`.nav-btn[data-view="${key}"]`);
    if (navBtn) navBtn.classList.add("done");

    const count = Object.values(this.fragments).filter(Boolean).length;
    $("fragment-count").textContent = count;
    this.shake();
    this.showFragmentToast(key, count);

    if (
      count === 3 &&
      this.fragments.terminal &&
      this.fragments.signal &&
      this.fragments.memory
    ) {
      $("core-lock-banner").textContent =
        "The core is awake. Bring the rings into alignment.";
      $("system-state").textContent = "DESTABILIZING";
    }

    if (count === 4) {
      $("system-state").textContent = "BREACH READY";
      setTimeout(() => this.showScreen("screen-final-ready"), 1400);
    }
  }

  showFragmentToast(key, count) {
    const labels = {
      terminal: "YOU FOUND THE FIRST PIECE",
      signal: "YOU CAUGHT THE SIGNAL",
      memory: "A MEMORY CAME BACK",
      core: "THE CORE IS YOURS",
    };
    const toast = $("fragment-toast");
    toast.innerHTML = `<div class="toast-title">${labels[key]}</div><div class="toast-sub">${count} of 4 pieces found</div>`;
    toast.classList.add("visible");
    setTimeout(() => toast.classList.remove("visible"), 2200);
  }

  registerMistake() {
    this.mistakes += 1;
  }

  playEscapeSequence() {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    this.timer.stop();
    this.telemetry.stop();
    this.showScreen("screen-escape-sequence");
    this.audio.glitch();

    const fill = $("shutdown-fill");
    const pctEl = $("shutdown-pct");
    const steps = [10, 30, 60, 90, 100];
    let i = 0;

    const advance = () => {
      if (i >= steps.length) {
        setTimeout(() => this.finishRun(), 500);
        return;
      }
      const value = steps[i];
      fill.style.width = `${value}%`;
      pctEl.textContent = `${value}%`;
      this.audio.tone(300 + value * 4, 0.12, { type: "square", gain: 0.08 });
      if (value === 100) this.shake();
      i += 1;
      setTimeout(advance, 480);
    };
    advance();
  }

  computeScore(remainingSeconds) {
    const timeBonus = remainingSeconds * 5;
    const fragmentBonus =
      Object.values(this.fragments).filter(Boolean).length * 500;
    const mistakePenalty = this.mistakes * 25;
    return Math.max(0, timeBonus + fragmentBonus - mistakePenalty);
  }

  rankFor(score) {
    if (score >= 3200) return { letter: "S", name: "SYSTEM BREAKER" };
    if (score >= 2400) return { letter: "A", name: "ELITE INTRUDER" };
    if (score >= 1600) return { letter: "B", name: "SECURITY BREACH" };
    return { letter: "C", name: "ROOKIE HACKER" };
  }

  finishRun() {
    const remaining = this.timer.remaining;
    const score = this.computeScore(remaining);
    const rank = this.rankFor(score);
    const puzzlesDone = Object.values(this.fragments).filter(Boolean).length;

    $("stat-time").textContent = formatClock(Math.max(0, remaining));
    $("stat-puzzles").textContent = `${puzzlesDone} / 4`;
    $("stat-mistakes").textContent = this.mistakes;
    $("stat-score").textContent = score;
    $("rank-letter").textContent = rank.letter;
    $("rank-name").textContent = rank.name;

    const prevBest = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);
    const note = $("high-score-note");
    if (score > prevBest) {
      localStorage.setItem(HIGH_SCORE_KEY, String(score));
      note.textContent = "NEW BEST RUN RECORDED.";
    } else {
      note.textContent = `PREVIOUS BEST: ${prevBest} PTS`;
    }

    this.audio.victory();
    this.showScreen("screen-win");
    this.isTransitioning = false;
  }

  reset() {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    this.renderHighScore();
    $("shutdown-fill").style.width = "0%";
    $("shutdown-pct").textContent = "0%";
    $("boot-log").innerHTML = "";
    this.bootSequence();
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.__game = new Game();
});
