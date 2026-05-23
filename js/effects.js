/**
 * effects.js - Audio-visual feedback effects for the Math Study Game.
 * Exposes effects globally on window for local file:// execution.
 */

// ----------------------------------------------------
// 1. Success Sound (Trumpet Fanfare)
// ----------------------------------------------------

/**
 * Attempts to play the trumpet-fanfare.mp3.
 * If it fails (due to missing asset or browser permissions),
 * it falls back to a Web Audio API synthesized fanfare.
 */
function playSuccessSound() {
  const mp3Path = 'assets/sounds/trumpet-fanfare.mp3';
  const audio = new Audio(mp3Path);
  
  // Set volume
  audio.volume = 0.5;

  audio.play()
    .then(() => {
      console.log("Fanfare MP3 played successfully.");
    })
    .catch((err) => {
      console.warn("Could not play MP3 fanfare (using synthesizer fallback):", err.message);
      synthesizeTrumpetFanfare();
    });
}

/**
 * Synthesizes a bright, brassy trumpet fanfare using the Web Audio API.
 * Uses detuned sawtooth oscillators and low-pass filter sweeps.
 */
function synthesizeTrumpetFanfare() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      console.warn("Web Audio API is not supported in this browser.");
      return;
    }

    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Fanfare Notes (Hz): C4 (261.63), G4 (392.00), C5 (523.25), E5 (659.25), G5 (783.99)
    const fanfareNotes = [
      { f: 261.63, start: 0.0, duration: 0.12 },
      { f: 392.00, start: 0.12, duration: 0.12 },
      { f: 523.25, start: 0.24, duration: 0.12 },
      { f: 659.25, start: 0.36, duration: 0.12 },
      { f: 783.99, start: 0.48, duration: 0.60 }
    ];

    fanfareNotes.forEach((note) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const osc3 = ctx.createOscillator();

      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc3.type = 'triangle';

      osc1.frequency.setValueAtTime(note.f, now + note.start);
      osc2.frequency.setValueAtTime(note.f * 1.006, now + note.start);
      osc3.frequency.setValueAtTime(note.f * 0.994, now + note.start);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, now + note.start);
      filter.frequency.exponentialRampToValueAtTime(1000, now + note.start + note.duration);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0, now + note.start);
      gainNode.gain.linearRampToValueAtTime(0.15, now + note.start + 0.04);
      gainNode.gain.setValueAtTime(0.15, now + note.start + note.duration - 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.duration);

      osc1.connect(filter);
      osc2.connect(filter);
      osc3.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start(now + note.start);
      osc2.start(now + note.start);
      osc3.start(now + note.start);

      osc1.stop(now + note.start + note.duration);
      osc2.stop(now + note.start + note.duration);
      osc3.stop(now + note.start + note.duration);
    });
  } catch (e) {
    console.error("Failed to synthesize trumpet fanfare:", e);
  }
}

// ----------------------------------------------------
// 2. Digital Fractals Confetti Engine
// ----------------------------------------------------

const NEON_COLORS = [
  '#00ffcc',
  '#ff00ff',
  '#39ff14',
  '#ff007f',
  '#ffff00',
  '#00ffff',
  '#ff5f1f'
];

class FractalParticle {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.angle = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.15;
    this.baseSize = Math.random() * 12 + 10;
    this.size = this.baseSize;
    this.opacity = 1.0;
    this.decay = Math.random() * 0.015 + 0.008;
    this.color = NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)];
    
    const types = ['triangle', 'hexagon', 'starburst'];
    this.type = types[Math.floor(Math.random() * types.length)];
    this.depth = Math.random() > 0.5 ? 3 : 2;
    this.life = 0;
    this.waveFreq = Math.random() * 0.05 + 0.02;
    this.waveAmp = Math.random() * 1.5 + 0.5;
  }

  update() {
    this.life += 1;
    this.x += this.vx + Math.sin(this.life * this.waveFreq) * this.waveAmp;
    this.y += this.vy + Math.cos(this.life * this.waveFreq) * 0.5;
    this.vx *= 0.98;
    this.vy *= 0.98;
    this.vy += 0.08;
    this.angle += this.rotationSpeed;
    this.opacity -= this.decay;
    return this.opacity > 0;
  }

  draw(ctx) {
    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = this.opacity;
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;

    if (this.type === 'triangle') {
      this.drawFractalTriangle(ctx, this.x, this.y, this.size, this.angle, this.depth);
    } else if (this.type === 'hexagon') {
      this.drawFractalHexagon(ctx, this.x, this.y, this.size, this.angle, this.depth);
    } else {
      this.drawStarburst(ctx, this.x, this.y, this.size, this.angle);
    }

    ctx.restore();
  }

  drawFractalTriangle(ctx, x, y, size, angle, depth) {
    if (depth <= 0) return;
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.866, size * 0.5);
    ctx.lineTo(-size * 0.866, size * 0.5);
    ctx.closePath();
    ctx.stroke();
    
    ctx.restore();

    const r = size;
    const nextSize = size * 0.45;
    
    const v1x = x + r * Math.sin(angle);
    const v1y = y - r * Math.cos(angle);
    
    const v2x = x + r * Math.sin(angle + (2 * Math.PI) / 3);
    const v2y = y - r * Math.cos(angle + (2 * Math.PI) / 3);
    
    const v3x = x + r * Math.sin(angle + (4 * Math.PI) / 3);
    const v3y = y - r * Math.cos(angle + (4 * Math.PI) / 3);

    this.drawFractalTriangle(ctx, v1x, v1y, nextSize, -angle * 0.8, depth - 1);
    this.drawFractalTriangle(ctx, v2x, v2y, nextSize, -angle * 0.8, depth - 1);
    this.drawFractalTriangle(ctx, v3x, v3y, nextSize, -angle * 0.8, depth - 1);
  }

  drawFractalHexagon(ctx, x, y, size, angle, depth) {
    if (depth <= 0) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      ctx.lineTo(size * Math.cos(a), size * Math.sin(a));
    }
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      ctx.moveTo(0, 0);
      ctx.lineTo(size * Math.cos(a), size * Math.sin(a));
    }
    ctx.stroke();

    ctx.restore();

    this.drawFractalHexagon(ctx, x, y, size * 0.5, -angle * 1.5, depth - 1);
  }

  drawStarburst(ctx, x, y, size, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    
    const branches = 6;
    ctx.beginPath();
    for (let i = 0; i < branches; i++) {
      const a = (i * Math.PI * 2) / branches;
      ctx.moveTo(0, 0);
      ctx.lineTo(size, 0);
      
      const bx = size * 0.6;
      ctx.moveTo(bx, 0);
      ctx.lineTo(bx + size * 0.25, size * 0.15);
      ctx.moveTo(bx, 0);
      ctx.lineTo(bx + size * 0.25, -size * 0.15);
      
      ctx.rotate(Math.PI * 2 / branches);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function triggerDigitalFractalsConfetti() {
  let canvas = document.getElementById('fractal-confetti-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'fractal-confetti-canvas';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';
    document.body.appendChild(canvas);
  }

  const ctx = canvas.getContext('2d');
  
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  const particles = [];
  
  const spawnPoints = [
    { x: canvas.width / 2, y: canvas.height * 0.6, count: 60 },
    { x: canvas.width * 0.15, y: canvas.height * 0.8, count: 20 },
    { x: canvas.width * 0.85, y: canvas.height * 0.8, count: 20 }
  ];

  spawnPoints.forEach(point => {
    for (let i = 0; i < point.count; i++) {
      const speed = Math.random() * 12 + 4;
      const angle = (point.x < canvas.width / 2) 
        ? -Math.random() * Math.PI * 0.45 
        : (point.x > canvas.width / 2)
          ? -Math.random() * Math.PI * 0.45 - Math.PI * 0.55 
          : -Math.random() * Math.PI;

      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - (Math.random() * 4);
      
      particles.push(new FractalParticle(point.x, point.y, vx, vy));
    }
  });

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let activeCount = 0;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (p.opacity > 0) {
        p.update();
        p.draw(ctx);
        activeCount++;
      }
    }
    
    if (activeCount > 0) {
      requestAnimationFrame(tick);
    } else {
      window.removeEventListener('resize', resizeCanvas);
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    }
  }

  requestAnimationFrame(tick);
}

// Expose globally for offline execution without modules
window.playSuccessSound = playSuccessSound;
window.triggerDigitalFractalsConfetti = triggerDigitalFractalsConfetti;
