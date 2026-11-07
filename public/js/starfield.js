/**
 * MINDRUSH — 60FPS Parallax Starfield & Constellation Synapse Canvas
 * Visual Reference: prototype.html
 */
export function initStarfield(canvasId = 'parallaxStarfieldCanvas') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const ctx = canvas.getContext('2d');
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  const starCount = 130;
  const stars = [];

  for (let i = 0; i < starCount; i++) {
    const depth = Math.random() < 0.55 ? 1 : Math.random() < 0.85 ? 2 : 3;
    const baseSpeed = depth === 1 ? 0.08 : depth === 2 ? 0.22 : 0.42;
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size:
        depth === 1
          ? Math.random() * 1.2 + 0.8
          : depth === 2
          ? Math.random() * 1.6 + 1.2
          : Math.random() * 2.2 + 1.6,
      speedX: baseSpeed * (Math.random() * 0.4 + 0.8),
      speedY: (Math.random() * 0.04 - 0.02) * depth,
      baseAlpha:
        depth === 1
          ? Math.random() * 0.4 + 0.2
          : depth === 2
          ? Math.random() * 0.5 + 0.35
          : Math.random() * 0.4 + 0.6,
      twinkleSpeed: Math.random() * 0.03 + 0.012,
      twinkleOffset: Math.random() * Math.PI * 2,
      colorType:
        Math.random() < 0.3 ? 'cyan' : Math.random() < 0.5 ? 'gold' : 'white',
      isConstellationNode: i < 30
    });
  }

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);

  let animId;
  function render(timestamp) {
    ctx.clearRect(0, 0, width, height);

    // Constellation lines
    const nodes = stars.filter((s) => s.isConstellationNode);
    const maxDist = 140;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const p1 = nodes[i];
        const p2 = nodes[j];
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < maxDist * maxDist) {
          const dist = Math.sqrt(distSq);
          const factor = 1 - dist / maxDist;
          const pulse = 0.5 + 0.5 * Math.sin(timestamp * 0.003 + p1.x * 0.01);
          const lineAlpha = factor * 0.2 * pulse;

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);

          if (p1.colorType === 'cyan' || p2.colorType === 'cyan') {
            ctx.strokeStyle = `rgba(56, 189, 248, ${lineAlpha * 1.5})`;
            ctx.lineWidth = 0.9;
          } else if (p1.colorType === 'gold' || p2.colorType === 'gold') {
            ctx.strokeStyle = `rgba(250, 204, 21, ${lineAlpha * 1.4})`;
            ctx.lineWidth = 0.9;
          } else {
            ctx.strokeStyle = `rgba(245, 248, 255, ${lineAlpha})`;
            ctx.lineWidth = 0.6;
          }
          ctx.stroke();

          // Minute energy pulse along star line
          if (pulse > 0.88 && dist > 45) {
            const sparkPos = (Math.sin(timestamp * 0.0035 + i) + 1) / 2;
            const sx = p1.x + (p2.x - p1.x) * sparkPos;
            const sy = p1.y + (p2.y - p1.y) * sparkPos;
            ctx.beginPath();
            ctx.arc(sx, sy, 1.4, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(250, 204, 21, ${lineAlpha * 3})`;
            ctx.fill();
          }
        }
      }
    }

    // Star Nodes
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      s.x += s.speedX;
      s.y += s.speedY;

      if (s.x > width + 8) s.x = -8;
      if (s.y > height + 8) s.y = -8;
      if (s.y < -8) s.y = height + 8;

      const alpha =
        s.baseAlpha +
        Math.sin(timestamp * s.twinkleSpeed + s.twinkleOffset) * 0.25;
      const clamped = Math.max(0.15, Math.min(0.95, alpha));

      if (s.isConstellationNode) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 2.2, 0, Math.PI * 2);
        ctx.fillStyle =
          s.colorType === 'cyan'
            ? `rgba(56, 189, 248, ${clamped * 0.18})`
            : `rgba(250, 204, 21, ${clamped * 0.18})`;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      if (s.colorType === 'cyan') {
        ctx.fillStyle = `rgba(56, 189, 248, ${clamped})`;
      } else if (s.colorType === 'gold') {
        ctx.fillStyle = `rgba(250, 204, 21, ${clamped})`;
      } else {
        ctx.fillStyle = `rgba(245, 248, 255, ${clamped})`;
      }
      ctx.fill();
    }

    animId = requestAnimationFrame(render);
  }

  // Check prefers-reduced-motion
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Single static render without continuous RAF
    render(0);
    return () => {};
  }

  animId = requestAnimationFrame(render);
  return () => {
    cancelAnimationFrame(animId);
    window.removeEventListener('resize', resize);
  };
}

// Auto-run if canvas is present
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('parallaxStarfieldCanvas')) {
      initStarfield('parallaxStarfieldCanvas');
    }
  });
}
