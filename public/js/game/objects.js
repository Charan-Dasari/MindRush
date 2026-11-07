/**
 * MindRush — Falling Objects & Spawner
 * Renders original badge-inspired shapes with dynamic colored glow,
 * vertical light trails, and subtle arcade motion effects
 */

export class FallingObject {
  constructor({
    x,
    y = -20,
    dx = 0,
    dy = 3,
    w = 18,
    color = [255, 255, 255],
    shape = 'circle',
    points = 10,
    lifeDelta = 0,
    sound = 'paddle',
    isStar = false,
    description = ''
  }) {
    this.x = x;
    this.y = y;
    this.dx = dx;
    this.dy = dy;
    this.w = w;
    this.color = color;
    this.shape = shape;
    this.points = points;
    this.lifeDelta = lifeDelta;
    this.sound = sound;
    this.isStar = isStar;
    this.description = description;
    this.handled = false;

    // Independent animation phase so badges don't pulse in lockstep
    this.animTicks = Math.floor(Math.random() * 120);
  }

  update() {
    this.x += this.dx;
    this.y += this.dy;
    this.animTicks++;
  }

  isOffscreen(canvasHeight) {
    // Extended boundary allows vertical trailing light streak to clear the canvas smoothly
    return this.y > canvasHeight + 50;
  }

  /**
   * Returns true if object incurs point loss or life penalty
   * @returns {boolean}
   */
  isHarmful() {
    return (this.points < 0) || (this.lifeDelta < 0);
  }

  /**
   * Resolves the signature glow and trail color for this badge
   * @returns {[number, number, number]}
   */
  getGlowColor() {
    switch (this.shape) {
      case 'water_droplet':
        return [0, 180, 255]; // Cyan/blue
      case 'green_crystal':
        return [0, 230, 90];  // Green
      case 'golden_ring':
      case 'star':
        return [255, 215, 0]; // Golden/yellow
      case 'golden_sunburst':
        return [255, 190, 0]; // Warm golden
      case 'silver_hexagon':
        return [180, 190, 220]; // Silver/steel blue
      case 'ice_crystal':
        return [80, 230, 255]; // Icy blue
      case 'purple_spiked_emblem':
        return [165, 40, 210]; // Purple/magenta
      case 'dark_triangular_emblem':
        return [220, 25, 45]; // Danger crimson/amber warning glow (distinct from blue collectibles)
      case 'regular_red_ball':
      case 'red_ball':
        return [255, 30, 40];  // Red
      case 'spiky_red_ball':
      case 'spiky_ball':
        return [255, 20, 35];  // Crimson Red
      case 'orange_flame':
      case 'flame':
        return [255, 125, 0];  // Orange
      case 'hazard_cross':
      case 'cross':
        return [255, 60, 20];  // Red/orange
      case 'heart':
      case 'drawHeart':
        return [255, 60, 130]; // Pink
      case 'blue_spiral_shell':
        return [0, 190, 255]; // Electric ocean blue/cyan
      case 'pink_heart_diamond':
        return [255, 50, 150]; // Radiant hot pink/magenta
      case 'crescent_moon':
        return [220, 40, 160]; // Luminous neon violet/magenta
      case 'bronze_star':
        return [215, 140, 45]; // Burnished bronze gold/amber
      case 'purple_shuriken':
        return [160, 40, 220]; // Electric deep purple
      default:
        if (this.color && this.color.length >= 3) {
          return [this.color[0], this.color[1], this.color[2]];
        }
        return [255, 255, 255];
    }
  }

  /**
   * Resolves trail dimensions and intensity
   */
  getTrailConfig() {
    switch (this.shape) {
      case 'ice_crystal':
      case 'golden_ring':
      case 'star':
      case 'golden_sunburst':
        // Rare or high-value objects have slightly stronger trails
        return { length: this.w * 2.5, baseW: this.w * 0.75, intensity: 1.0 };
      case 'heart':
      case 'drawHeart':
      case 'pink_heart_diamond':
        // Extra life recognizable pink trail
        return { length: this.w * 2.3, baseW: this.w * 0.75, intensity: 1.0 };
      case 'bronze_star':
        return { length: this.w * 2.4, baseW: this.w * 0.75, intensity: 1.0 };
      case 'purple_shuriken':
        return { length: this.w * 2.2, baseW: this.w * 0.7, intensity: 0.9 };
      case 'blue_spiral_shell':
      case 'crescent_moon':
        return { length: this.w * 2.0, baseW: this.w * 0.7, intensity: 0.85 };
      case 'hazard_cross':
      case 'cross':
      case 'orange_flame':
      case 'flame':
      case 'regular_red_ball':
      case 'spiky_red_ball':
      case 'spiky_ball':
      case 'red_ball':
        // Distinctive hazard trail
        return { length: this.w * 2.0, baseW: this.w * 0.7, intensity: 0.85 };
      default:
        // Subtle restrained trail for common badges
        return { length: this.w * 1.8, baseW: this.w * 0.65, intensity: 0.75 };
    }
  }

  /**
   * Resolves subtle decorative rotation without modifying collision coordinates
   */
  getDecorativeRotation() {
    const t = this.animTicks;
    switch (this.shape) {
      // Strictly upright badges — DO NOT ROTATE
      case 'heart':
      case 'drawHeart':
      case 'pink_heart_diamond':
        return 0; // Lobes strictly up, tip strictly down at all times!
      case 'water_droplet':
        return Math.sin(t * 0.05) * 0.03; // Gentle micro-sway (max ±1.7 degrees)
      case 'dark_triangular_emblem':
        return Math.sin(t * 0.04) * 0.04; // Micro-sway (tip remains pointing down)
      case 'orange_flame':
      case 'flame':
        return Math.sin(t * 0.08) * 0.03; // Flame points up with gentle sway
      case 'regular_red_ball':
        return 0; // Smooth circular silhouette, upright
      case 'hazard_cross':
      case 'cross':
        return Math.sin(t * 0.03) * 0.08; // Gentle noble rocking (preserves unmistakable upright + cross silhouette!)
      case 'spiky_red_ball':
      case 'spiky_ball':
      case 'red_ball':
        return (t * 0.015) % (Math.PI * 2); // Slow menacing rotation of spikes

      // Symmetrical geometric badges that benefit from gentle arcade rotation
      case 'golden_ring':
        return Math.sin(t * 0.03) * 0.15; // Slow rhythmic rocking
      case 'green_crystal':
        return Math.sin(t * 0.04) * 0.06; // Gentle crystal sway
      case 'ice_crystal':
        return Math.sin(t * 0.035) * 0.08; // Prismatic floating tilt
      case 'golden_sunburst':
        return (t * 0.012) % (Math.PI * 2); // Slow radiant spin
      case 'silver_hexagon':
        return Math.sin(t * 0.03) * 0.1; // Gentle hexagonal rocking
      case 'purple_spiked_emblem':
        return (t * 0.015) % (Math.PI * 2); // Smooth majestic spin
      case 'star':
        return (t * 0.018) % (Math.PI * 2); // Golden star twinkle spin
      case 'blue_spiral_shell':
        return Math.sin(t * 0.035) * 0.12; // Rhythmic nautilus rocking
      case 'crescent_moon':
        return -0.35 + Math.sin(t * 0.03) * 0.08; // Tilted lunar crescent with subtle sway
      case 'bronze_star':
        return (t * 0.01) % (Math.PI * 2); // Slow noble 8-pointed star rotation
      case 'purple_shuriken':
        return (t * 0.035) % (Math.PI * 2); // Dynamic aerodynamic shuriken spin
      default:
        return 0;
    }
  }

  /**
   * Renders the vertical light trail trailing above the falling badge
   */
  drawTrail(p, [r, g, b], trailConfig, pulse) {
    const ctx = p.drawingContext;
    const trailTop = -trailConfig.length * (0.95 + pulse * 0.1);
    const baseW = trailConfig.baseW;

    // Outer diffused trail
    const grad = ctx.createLinearGradient(0, -this.w * 0.2, 0, trailTop);
    const baseAlpha = 0.45 * trailConfig.intensity * pulse;
    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${baseAlpha})`);
    grad.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, ${baseAlpha * 0.45})`);
    grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

    ctx.fillStyle = grad;
    p.beginShape();
    p.vertex(-baseW / 2, -this.w * 0.2);
    p.vertex(baseW / 2, -this.w * 0.2);
    p.vertex(baseW * 0.15, trailTop);
    p.vertex(-baseW * 0.15, trailTop);
    p.endShape(p.CLOSE);

    // Inner bright core streak
    const coreGrad = ctx.createLinearGradient(0, -this.w * 0.2, 0, trailTop * 0.75);
    const coreAlpha = 0.65 * trailConfig.intensity * pulse;
    coreGrad.addColorStop(0, `rgba(255, 255, 255, ${coreAlpha})`);
    coreGrad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${coreAlpha * 0.4})`);
    coreGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

    ctx.fillStyle = coreGrad;
    p.beginShape();
    p.vertex(-baseW * 0.2, -this.w * 0.2);
    p.vertex(baseW * 0.2, -this.w * 0.2);
    p.vertex(0, trailTop * 0.75);
    p.endShape(p.CLOSE);
  }

  /**
   * Renders the soft radial aura glow around the badge
   */
  drawGlow(p, [r, g, b], pulse) {
    const ctx = p.drawingContext;
    const s = this.w / 2;
    const glowR = s * (1.7 + pulse * 0.4);

    const radGrad = ctx.createRadialGradient(0, 0, s * 0.25, 0, 0, glowR);
    const glowAlpha = 0.35 * pulse;
    radGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${glowAlpha})`);
    radGrad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${glowAlpha * 0.35})`);
    radGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Renders the badge on the p5 canvas with glow, trail, and decorative motion
   * @param {any} p - p5 instance
   */
  draw(p) {
    const s = this.w / 2;
    const glowColor = this.getGlowColor();
    const trailConfig = this.getTrailConfig();
    const pulse = Math.sin(this.animTicks * 0.08) * 0.15 + 0.85; // Oscillates between 0.70 and 1.0

    p.push();
    p.translate(this.x, this.y);

    // 1. Render vertical trailing streak
    this.drawTrail(p, glowColor, trailConfig, pulse);

    // 2. Render soft colored glow aura
    this.drawGlow(p, glowColor, pulse);

    // 3. Apply subtle decorative rotation (without altering collision position)
    const rot = this.getDecorativeRotation();
    if (rot !== 0) {
      p.rotate(rot);
    }

    // 4. Render badge geometric silhouette
    switch (this.shape) {
      // 1. Extra Life Heart (Upward lobes, downward tip - strictly upright)
      case 'heart':
      case 'drawHeart': {
        // Outer dark crimson contour
        p.stroke(130, 10, 35);
        p.strokeWeight(1.8);
        p.fill(225, 20, 65);
        p.beginShape();
        p.vertex(0, -s * 0.35);
        p.bezierVertex(s * 0.55, -s * 1.25, s * 1.35, -s * 0.35, s * 0.75, s * 0.45);
        p.bezierVertex(s * 0.45, s * 0.8, s * 0.15, s * 1.05, 0, s * 1.25);
        p.bezierVertex(-s * 0.15, s * 1.05, -s * 0.45, s * 0.8, -s * 0.75, s * 0.45);
        p.bezierVertex(-s * 1.35, -s * 0.35, -s * 0.55, -s * 1.25, 0, -s * 0.35);
        p.endShape(p.CLOSE);

        // Inner radiant ruby body
        p.noStroke();
        p.fill(255, 45, 95);
        p.beginShape();
        p.vertex(0, -s * 0.25);
        p.bezierVertex(s * 0.45, -s * 1.05, s * 1.15, -s * 0.25, s * 0.65, s * 0.4);
        p.bezierVertex(s * 0.38, s * 0.7, s * 0.12, s * 0.9, 0, s * 1.05);
        p.bezierVertex(-s * 0.12, s * 0.9, -s * 0.38, s * 0.7, -s * 0.65, s * 0.4);
        p.bezierVertex(-s * 1.15, -s * 0.25, -s * 0.45, -s * 1.05, 0, -s * 0.25);
        p.endShape(p.CLOSE);

        // Top-left curved gloss reflection (arcade specular sheen)
        p.fill(255, 255, 255, 220);
        p.beginShape();
        p.vertex(-s * 0.15, -s * 0.5);
        p.bezierVertex(-s * 0.35, -s * 1.05, -s * 0.85, -s * 0.75, -s * 0.75, -s * 0.2);
        p.bezierVertex(-s * 0.6, -s * 0.55, -s * 0.3, -s * 0.75, -s * 0.15, -s * 0.5);
        p.endShape(p.CLOSE);

        // Secondary dot glint on right lobe
        p.ellipse(s * 0.45, -s * 0.55, s * 0.25, s * 0.2);
        break;
      }

      // 2. Water Droplet (+10 Common)
      case 'water_droplet': {
        // Outer dark cobalt bezel
        p.stroke(10, 50, 115);
        p.strokeWeight(1.8);
        p.fill(0, 140, 225);
        p.beginShape();
        p.vertex(0, -s * 1.35);
        p.bezierVertex(s * 1.25, -s * 0.15, s * 1.2, s * 1.2, 0, s * 1.2);
        p.bezierVertex(-s * 1.2, s * 1.2, -s * 1.25, -s * 0.15, 0, -s * 1.35);
        p.endShape(p.CLOSE);

        // Inner bright cyan body
        p.noStroke();
        p.fill(0, 195, 255);
        p.beginShape();
        p.vertex(0, -s * 1.15);
        p.bezierVertex(s * 1.0, -s * 0.1, s * 0.95, s * 1.0, 0, s * 1.0);
        p.bezierVertex(-s * 0.95, s * 1.0, -s * 1.0, -s * 0.1, 0, -s * 1.15);
        p.endShape(p.CLOSE);

        // Soft internal glow
        p.fill(120, 235, 255, 180);
        p.ellipse(0, s * 0.25, s * 1.1, s * 0.9);

        // Left curved glossy reflection
        p.fill(255, 255, 255, 220);
        p.beginShape();
        p.vertex(-s * 0.12, -s * 0.85);
        p.bezierVertex(-s * 0.75, -s * 0.2, -s * 0.85, s * 0.5, -s * 0.55, s * 0.85);
        p.bezierVertex(-s * 0.7, s * 0.5, -s * 0.6, -s * 0.1, -s * 0.12, -s * 0.85);
        p.endShape(p.CLOSE);

        // Secondary bubble highlight
        p.ellipse(-s * 0.1, s * 0.45, s * 0.35, s * 0.25);
        break;
      }

      // 3. Green Crystal Leaf (+20 Positive)
      case 'green_crystal': {
        p.stroke(0, 70, 30);
        p.strokeWeight(1.5);

        // Left facet body (bright emerald green)
        p.fill(0, 230, 90);
        p.beginShape();
        p.vertex(0, -s * 1.35);
        p.vertex(-s * 0.55, -s * 0.4);
        p.vertex(-s * 0.8, s * 0.2);
        p.vertex(0, s * 1.35);
        p.vertex(0, 0);
        p.endShape(p.CLOSE);

        // Right facet body (deep forest emerald)
        p.fill(0, 155, 55);
        p.beginShape();
        p.vertex(0, -s * 1.35);
        p.vertex(s * 0.55, -s * 0.4);
        p.vertex(s * 0.8, s * 0.2);
        p.vertex(0, s * 1.35);
        p.vertex(0, 0);
        p.endShape(p.CLOSE);

        // Top-left upper facet highlight (mint green/white)
        p.noStroke();
        p.fill(160, 255, 195, 210);
        p.triangle(0, -s * 1.35, -s * 0.55, -s * 0.4, 0, -s * 0.1);

        // Central crisp ridge line
        p.stroke(210, 255, 230, 220);
        p.strokeWeight(1.2);
        p.line(0, -s * 1.35, 0, s * 1.35);

        // Specular highlight gleam
        p.fill(255, 255, 255, 230);
        p.noStroke();
        p.ellipse(-s * 0.2, -s * 0.45, s * 0.18, s * 0.35);
        break;
      }

      // 4. Golden Ring Badge (+25 Rare)
      case 'golden_ring': {
        // Outer dark bronze bezel
        p.stroke(120, 70, 0);
        p.strokeWeight(1.8);
        p.fill(245, 195, 10);
        p.ellipse(0, 0, s * 2.1, s * 2.1);

        // Outer ring bevel highlight (upper left crescent)
        p.noStroke();
        p.fill(255, 240, 100, 200);
        p.arc(0, 0, s * 1.95, s * 1.95, -p.PI * 0.85, -p.PI * 0.15);

        // Recessed dark golden groove
        p.stroke(140, 80, 0);
        p.strokeWeight(1.2);
        p.fill(185, 115, 0);
        p.ellipse(0, 0, s * 1.45, s * 1.45);

        // Central raised golden button/gem
        p.stroke(160, 95, 0);
        p.strokeWeight(1.2);
        p.fill(255, 215, 20);
        p.ellipse(0, 0, s * 1.05, s * 1.05);

        // Core gold glow
        p.noStroke();
        p.fill(255, 250, 160);
        p.ellipse(0, -s * 0.08, s * 0.75, s * 0.75);

        // High-contrast specular reflection
        p.fill(255, 255, 255, 230);
        p.ellipse(-s * 0.38, -s * 0.38, s * 0.35, s * 0.22);
        break;
      }

      // 4a. Silver Hexagon Badge (+10 Common)
      case 'silver_hexagon': {
        // Outer dark slate contour (faceted stone rim)
        const sides = 8;
        p.stroke(40, 48, 60);
        p.strokeWeight(1.8);
        p.fill(65, 75, 90);
        p.beginShape();
        for (let i = 0; i < sides; i++) {
          const a = (p.TWO_PI / sides) * i - p.HALF_PI;
          p.vertex(p.cos(a) * s * 1.25, p.sin(a) * s * 1.25);
        }
        p.endShape(p.CLOSE);

        // 8 faceted stone segments around outer ring
        p.noStroke();
        for (let i = 0; i < sides; i++) {
          const a1 = (p.TWO_PI / sides) * i - p.HALF_PI;
          const a2 = (p.TWO_PI / sides) * (i + 1) - p.HALF_PI;
          const lightFactor = (p.cos(a1 - p.PI * 0.75) + 1) / 2;
          const gray = 130 + lightFactor * 60;
          p.fill(gray, gray + 5, gray + 15);
          p.beginShape();
          p.vertex(p.cos(a1) * s * 1.2, p.sin(a1) * s * 1.2);
          p.vertex(p.cos(a2) * s * 1.2, p.sin(a2) * s * 1.2);
          p.vertex(p.cos(a2) * s * 0.85, p.sin(a2) * s * 0.85);
          p.vertex(p.cos(a1) * s * 0.85, p.sin(a1) * s * 0.85);
          p.endShape(p.CLOSE);
          // Dark groove separator line
          p.stroke(35, 42, 52);
          p.strokeWeight(1.2);
          p.line(p.cos(a1) * s * 1.2, p.sin(a1) * s * 1.2, p.cos(a1) * s * 0.85, p.sin(a1) * s * 0.85);
          p.noStroke();
        }

        // Inner beveled silver plate
        p.stroke(80, 90, 105);
        p.strokeWeight(1.2);
        p.fill(175, 185, 200);
        p.beginShape();
        for (let i = 0; i < sides; i++) {
          const a = (p.TWO_PI / sides) * i - p.HALF_PI;
          p.vertex(p.cos(a) * s * 0.82, p.sin(a) * s * 0.82);
        }
        p.endShape(p.CLOSE);

        // Inner faceted planes
        p.noStroke();
        p.fill(235, 240, 250, 190);
        p.triangle(-s * 0.7, -s * 0.4, 0, -s * 0.75, 0, 0);
        p.triangle(0, -s * 0.75, s * 0.4, -s * 0.7, 0, 0);
        p.triangle(-s * 0.7, -s * 0.4, -s * 0.75, 0, 0, 0);

        p.fill(125, 135, 150, 190);
        p.triangle(s * 0.75, 0, s * 0.7, s * 0.4, 0, 0);
        p.triangle(s * 0.7, s * 0.4, 0, s * 0.75, 0, 0);

        // Central boss
        p.fill(160, 170, 185);
        p.ellipse(0, 0, s * 0.45, s * 0.45);

        // Specular glint
        p.fill(255, 255, 255, 220);
        p.ellipse(-s * 0.25, -s * 0.28, s * 0.22, s * 0.16);
        break;
      }

      // 4b. Golden Sunburst Badge (+20 Common)
      case 'golden_sunburst': {
        const numRays = 8;
        const rOuter = s * 1.35;
        const rInner = s * 0.78;

        p.stroke(140, 85, 0);
        p.strokeWeight(1.2);
        for (let i = 0; i < numRays; i++) {
          const aCenter = (p.TWO_PI / numRays) * i - p.HALF_PI;
          const aLeft = aCenter - p.TWO_PI / (numRays * 2);
          const aRight = aCenter + p.TWO_PI / (numRays * 2);

          const tipX = p.cos(aCenter) * rOuter;
          const tipY = p.sin(aCenter) * rOuter;
          const leftX = p.cos(aLeft) * rInner;
          const leftY = p.sin(aLeft) * rInner;
          const rightX = p.cos(aRight) * rInner;
          const rightY = p.sin(aRight) * rInner;

          // Left facet of ray (bright sun gold)
          p.fill(255, 230, 45);
          p.triangle(0, 0, leftX, leftY, tipX, tipY);

          // Right facet of ray (warm deep amber gold)
          p.fill(225, 145, 0);
          p.triangle(0, 0, tipX, tipY, rightX, rightY);
        }

        // Golden circular bezel
        p.stroke(160, 95, 0);
        p.strokeWeight(1.5);
        p.fill(245, 185, 0);
        p.ellipse(0, 0, s * 1.15, s * 1.15);

        // Coral/orange central gem
        p.stroke(130, 40, 0);
        p.strokeWeight(1.2);
        p.fill(245, 75, 15);
        p.ellipse(0, 0, s * 0.95, s * 0.95);

        // Gem highlight / inner dome glow
        p.noStroke();
        p.fill(255, 140, 40, 220);
        p.ellipse(0, -s * 0.1, s * 0.75, s * 0.65);

        // Specular gloss glint
        p.fill(255, 255, 255, 230);
        p.ellipse(-s * 0.22, -s * 0.25, s * 0.28, s * 0.2);
        break;
      }

      // 5. Ice Crystal Prism (+50 High-Value Rare)
      case 'ice_crystal': {
        // Outer dark metal bezel prongs
        p.stroke(10, 45, 95);
        p.strokeWeight(1.8);
        p.fill(20, 65, 125);
        p.beginShape();
        p.vertex(0, -s * 1.45);
        p.vertex(s * 1.05, 0);
        p.vertex(0, s * 1.45);
        p.vertex(-s * 1.05, 0);
        p.endShape(p.CLOSE);

        // Prismatic facets
        p.stroke(10, 80, 150);
        p.strokeWeight(1.0);

        // Top-left facet (bright frost)
        p.fill(185, 245, 255);
        p.triangle(0, -s * 1.35, -s * 0.95, 0, 0, 0);

        // Top-right facet (sky ice)
        p.fill(85, 200, 255);
        p.triangle(0, -s * 1.35, s * 0.95, 0, 0, 0);

        // Bottom-left facet (vibrant electric cyan)
        p.fill(0, 155, 235);
        p.triangle(-s * 0.95, 0, 0, s * 1.35, 0, 0);

        // Bottom-right facet (deep sapphire)
        p.fill(0, 100, 185);
        p.triangle(s * 0.95, 0, 0, s * 1.35, 0, 0);

        // Central floating diamond facet
        p.noStroke();
        p.fill(245, 255, 255, 230);
        p.beginShape();
        p.vertex(0, -s * 0.45);
        p.vertex(s * 0.4, 0);
        p.vertex(0, s * 0.45);
        p.vertex(-s * 0.4, 0);
        p.endShape(p.CLOSE);

        // Specular frost glint
        p.fill(255, 255, 255, 240);
        p.ellipse(-s * 0.25, -s * 0.35, s * 0.25, s * 0.25);
        break;
      }

      // 6. Purple Spiked Emblem (-20 Negative Penalty Trap)
      case 'purple_spiked_emblem': {
        const numPoints = 8;
        const rOuter = s * 1.35;
        const rInner = s * 0.65;

        // Outer jagged saw-teeth / barbed hazard spikes
        p.stroke(40, 5, 55);
        p.strokeWeight(1.4);
        for (let i = 0; i < numPoints; i++) {
          const aCenter = (p.TWO_PI / numPoints) * i;
          const aLeft = aCenter - p.TWO_PI / (numPoints * 2);
          const aRight = aCenter + p.TWO_PI / (numPoints * 2);

          const tipX = p.cos(aCenter) * rOuter;
          const tipY = p.sin(aCenter) * rOuter;
          const leftX = p.cos(aLeft) * rInner;
          const leftY = p.sin(aLeft) * rInner;
          const rightX = p.cos(aRight) * rInner;
          const rightY = p.sin(aRight) * rInner;

          // Left facet (dark charcoal iron)
          p.fill(35, 12, 45);
          p.triangle(0, 0, leftX, leftY, tipX, tipY);

          // Right facet (toxic radioactive violet edge)
          p.fill(165, 30, 210);
          p.triangle(0, 0, tipX, tipY, rightX, rightY);
        }

        // Inner dark hazard warning disc with crimson warning rim
        p.stroke(220, 25, 45);
        p.strokeWeight(1.6);
        p.fill(20, 8, 30);
        p.ellipse(0, 0, s * 0.95, s * 0.95);

        // Toxic purple inner warning border
        p.stroke(185, 45, 235);
        p.strokeWeight(1.0);
        p.fill(38, 12, 50);
        p.ellipse(0, 0, s * 0.75, s * 0.75);

        // Prominent glowing white MINUS SIGN (unmistakable negative penalty indicator)
        p.noStroke();
        p.fill(255, 255, 255, 245);
        p.rect(-s * 0.32, -s * 0.08, s * 0.64, s * 0.16, 2);

        // Danger accent ticks on minus sign
        p.fill(255, 50, 80);
        p.rect(-s * 0.32, -s * 0.08, s * 0.1, s * 0.16, 1);
        p.rect(s * 0.22, -s * 0.08, s * 0.1, s * 0.16, 1);
        break;
      }

      // 7. Dark Triangular Emblem (-30 Stronger Negative Hazard Trap)
      case 'dark_triangular_emblem': {
        // Outer beveled frame (inverted shield/wedge with barbed stepped shoulders)
        p.stroke(60, 10, 25);
        p.strokeWeight(1.8);
        p.fill(18, 10, 28);

        p.beginShape();
        p.vertex(-s * 1.2, -s * 0.95);
        p.vertex(s * 1.2, -s * 0.95);
        p.vertex(s * 0.95, -s * 0.65);
        p.vertex(0, s * 1.3);
        p.vertex(-s * 0.95, -s * 0.65);
        p.endShape(p.CLOSE);

        // Danger crimson-amber warning border trim
        p.stroke(255, 45, 30);
        p.strokeWeight(1.4);
        p.noFill();
        p.beginShape();
        p.vertex(-s * 0.95, -s * 0.8);
        p.vertex(s * 0.95, -s * 0.8);
        p.vertex(0, s * 1.1);
        p.endShape(p.CLOSE);

        // Inner dark charcoal plate
        p.noStroke();
        p.fill(15, 6, 20);
        p.triangle(-s * 0.85, -s * 0.75, s * 0.85, -s * 0.75, 0, s * 0.95);

        // Warning amber-crimson inverted hazard triangle
        p.stroke(255, 60, 20);
        p.strokeWeight(1.2);
        p.fill(220, 25, 35);
        p.triangle(-s * 0.5, -s * 0.55, s * 0.5, -s * 0.55, 0, s * 0.4);

        // Prominent glowing white MINUS SIGN (unmistakable negative penalty indicator)
        p.noStroke();
        p.fill(255, 255, 255, 245);
        p.rect(-s * 0.32, -s * 0.22, s * 0.64, s * 0.16, 2);

        // Danger warning exclamation dot below minus sign
        p.fill(255, 220, 0);
        p.circle(0, s * 0.12, s * 0.18);
        break;
      }

      // 8. Hazardous Smooth Red Ball / Orb (-1 Life)
      case 'regular_red_ball': {
        // Outer dark charcoal/crimson rim (smooth circular silhouette)
        p.stroke(60, 10, 15);
        p.strokeWeight(1.8);
        p.fill(185, 20, 30);
        p.ellipse(0, 0, s * 1.9, s * 1.9);

        // Inner radiant crimson body
        p.noStroke();
        p.fill(235, 35, 45);
        p.ellipse(0, 0, s * 1.65, s * 1.65);

        // Warning groove ring
        p.stroke(80, 10, 18);
        p.strokeWeight(1.2);
        p.noFill();
        p.ellipse(0, 0, s * 1.25, s * 1.25);

        // Central warning hazard triangle
        p.fill(255, 215, 0); // Warning yellow
        p.noStroke();
        p.beginShape();
        p.vertex(0, -s * 0.45);
        p.vertex(s * 0.42, s * 0.32);
        p.vertex(-s * 0.42, s * 0.32);
        p.endShape(p.CLOSE);

        // Danger exclamation mark inside triangle
        p.fill(30, 5, 10);
        p.rect(-s * 0.05, -s * 0.22, s * 0.1, s * 0.28, 1);
        p.circle(0, s * 0.18, s * 0.1);

        // Specular curved gloss sheen on top-left (arcade glossy ball)
        p.fill(255, 255, 255, 210);
        p.beginShape();
        p.vertex(-s * 0.2, -s * 0.65);
        p.bezierVertex(-s * 0.55, -s * 0.55, -s * 0.65, -s * 0.2, -s * 0.6, s * 0.1);
        p.bezierVertex(-s * 0.45, -s * 0.1, -s * 0.4, -s * 0.4, -s * 0.2, -s * 0.65);
        p.endShape(p.CLOSE);

        // Secondary glint
        p.fill(255, 255, 255, 180);
        p.circle(-s * 0.35, -s * 0.35, s * 0.2);
        break;
      }

      // 9. Orange Flame Hazard (-1 Life)
      case 'flame':
      case 'orange_flame': {
        // Deep crimson outer contour
        p.stroke(140, 15, 0);
        p.strokeWeight(1.8);
        p.fill(235, 45, 0);

        // 3-tongued stylized flame silhouette
        p.beginShape();
        p.vertex(0, -s * 1.35);
        p.bezierVertex(s * 0.35, -s * 0.7, s * 0.55, -s * 0.6, s * 0.85, -s * 0.35);
        p.bezierVertex(s * 1.05, s * 0.25, s * 0.75, s * 0.85, 0, s * 1.15);
        p.bezierVertex(-s * 0.75, s * 0.85, -s * 1.05, s * 0.25, -s * 0.85, -s * 0.35);
        p.bezierVertex(-s * 0.55, -s * 0.6, -s * 0.35, -s * 0.7, 0, -s * 1.35);
        p.endShape(p.CLOSE);

        // Mid vibrant orange layer
        p.noStroke();
        p.fill(255, 125, 0);
        p.beginShape();
        p.vertex(0, -s * 1.05);
        p.bezierVertex(s * 0.25, -s * 0.5, s * 0.45, -s * 0.45, s * 0.65, -s * 0.2);
        p.bezierVertex(s * 0.8, s * 0.2, s * 0.55, s * 0.7, 0, s * 0.95);
        p.bezierVertex(-s * 0.55, s * 0.7, -s * 0.8, s * 0.2, -s * 0.65, -s * 0.2);
        p.bezierVertex(-s * 0.45, -s * 0.45, -s * 0.25, -s * 0.5, 0, -s * 1.05);
        p.endShape(p.CLOSE);

        // Inner bright yellow flame
        p.fill(255, 235, 45);
        p.beginShape();
        p.vertex(0, -s * 0.65);
        p.bezierVertex(s * 0.3, -s * 0.15, s * 0.35, s * 0.45, 0, s * 0.75);
        p.bezierVertex(-s * 0.35, s * 0.45, -s * 0.3, -s * 0.15, 0, -s * 0.65);
        p.endShape(p.CLOSE);

        // Core white fire spark
        p.fill(255, 255, 220, 220);
        p.ellipse(0, s * 0.1, s * 0.25, s * 0.45);
        break;
      }

      // 10. Severe Hazard Cross (-3 Lives) — strictly orthogonal cross (+), NOT tilted to an X
      case 'cross':
      case 'hazard_cross': {
        const armW = s * 0.7;
        const armL = s * 2.2;

        // Heavy golden armor border (orthogonal horizontal & vertical bars)
        p.stroke(140, 80, 0);
        p.strokeWeight(1.8);
        p.fill(225, 160, 0);
        p.rect(-armL / 2, -armW / 2, armL, armW, 3);
        p.rect(-armW / 2, -armL / 2, armW, armL, 3);

        // Crimson faceted cross arms
        p.stroke(100, 10, 0);
        p.strokeWeight(1.2);
        p.fill(220, 25, 15);
        const inL = armL - 4;
        const inW = armW - 4;
        p.rect(-inL / 2, -inW / 2, inL, inW, 2);
        p.rect(-inW / 2, -inL / 2, inW, inL, 2);

        // Shading on arms (half-shadow for 3D bevel)
        p.noStroke();
        p.fill(130, 10, 5, 160);
        p.rect(0, -inW / 2, inL / 2, inW / 2);
        p.rect(-inW / 2, 0, inW / 2, inL / 2);

        // Central golden warning diamond/square hub
        p.stroke(160, 100, 0);
        p.strokeWeight(1.5);
        p.fill(255, 200, 0);
        p.beginShape();
        p.vertex(0, -s * 0.55);
        p.vertex(s * 0.55, 0);
        p.vertex(0, s * 0.55);
        p.vertex(-s * 0.55, 0);
        p.endShape(p.CLOSE);

        // Core menacing red jewel / warning light
        p.stroke(120, 10, 0);
        p.strokeWeight(1.0);
        p.fill(255, 30, 20);
        p.ellipse(0, 0, s * 0.45, s * 0.45);

        // Specular glint
        p.noStroke();
        p.fill(255, 255, 255, 220);
        p.ellipse(-s * 0.12, -s * 0.12, s * 0.16, s * 0.16);
        break;
      }

      // 11. Hazardous Spiky Red Ball / Naval Mine Bomb (-1 Life, All difficulties)
      case 'spiky_red_ball':
      case 'spiky_ball':
      case 'red_ball': {
        const numSpikes = 8;
        const spikeR = s * 1.55;
        const baseR = s * 0.85;

        // Radial hazard spikes (naval mine / spike bomb design)
        p.stroke(50, 5, 10);
        p.strokeWeight(1.2);
        for (let i = 0; i < numSpikes; i++) {
          const aCenter = (p.TWO_PI / numSpikes) * i;
          const aLeft = aCenter - p.TWO_PI / (numSpikes * 3);
          const aRight = aCenter + p.TWO_PI / (numSpikes * 3);

          const tipX = p.cos(aCenter) * spikeR;
          const tipY = p.sin(aCenter) * spikeR;
          const leftX = p.cos(aLeft) * baseR;
          const leftY = p.sin(aLeft) * baseR;
          const rightX = p.cos(aRight) * baseR;
          const rightY = p.sin(aRight) * baseR;

          // Spike base (dark charcoal armor)
          p.fill(35, 8, 12);
          p.triangle(0, 0, leftX, leftY, tipX, tipY);

          // Spike tip facet (glowing crimson danger edge)
          p.fill(240, 30, 45);
          p.triangle(0, 0, tipX, tipY, rightX, rightY);
        }

        // Armored spherical mine body (dark crimson outer rim)
        p.stroke(40, 5, 8);
        p.strokeWeight(1.8);
        p.fill(175, 15, 25);
        p.ellipse(0, 0, s * 1.85, s * 1.85);

        // Inner vibrant danger core
        p.noStroke();
        p.fill(225, 30, 40);
        p.ellipse(0, 0, s * 1.55, s * 1.55);

        // Central armored warning hub plate
        p.stroke(70, 8, 12);
        p.strokeWeight(1.2);
        p.fill(30, 8, 12);
        p.ellipse(0, 0, s * 0.95, s * 0.95);

        // Core warning EXCLAMATION POINT (unmistakable hazard symbol)
        p.noStroke();
        p.fill(255, 220, 0); // High-voltage danger yellow
        p.rect(-s * 0.09, -s * 0.32, s * 0.18, s * 0.38, 2);
        p.circle(0, s * 0.22, s * 0.18);

        // Top detonator fuse cap with ignition spark
        p.fill(60, 60, 65);
        p.rect(-s * 0.16, -s * 1.08, s * 0.32, s * 0.2, 1);
        p.fill(255, 195, 40);
        p.circle(0, -s * 1.15, s * 0.18);
        break;
      }

      // 11. Golden Star (+100 Pts, Easy special spawn)
      case 'star': {
        const r1 = this.w;
        const r2 = this.w * 0.42;

        p.stroke(160, 100, 0);
        p.strokeWeight(1.2);
        for (let i = 0; i < 5; i++) {
          const aCenter = (p.TWO_PI / 5) * i - p.HALF_PI;
          const aLeft = aCenter - p.TWO_PI / 10;
          const aRight = aCenter + p.TWO_PI / 10;

          const tipX = p.cos(aCenter) * r1;
          const tipY = p.sin(aCenter) * r1;
          const leftX = p.cos(aLeft) * r2;
          const leftY = p.sin(aLeft) * r2;
          const rightX = p.cos(aRight) * r2;
          const rightY = p.sin(aRight) * r2;

          // Left facet (bright yellow/gold)
          p.fill(255, 240, 70);
          p.triangle(0, 0, leftX, leftY, tipX, tipY);

          // Right facet (deep warm gold)
          p.fill(225, 150, 0);
          p.triangle(0, 0, tipX, tipY, rightX, rightY);
        }

        // Center sparkling diamond
        p.stroke(180, 120, 0);
        p.strokeWeight(1.0);
        p.fill(255, 255, 200);
        p.beginShape();
        p.vertex(0, -r2 * 0.55);
        p.vertex(r2 * 0.55, 0);
        p.vertex(0, r2 * 0.55);
        p.vertex(-r2 * 0.55, 0);
        p.endShape(p.CLOSE);

        // Specular star glint
        p.noStroke();
        p.fill(255, 255, 255, 240);
        p.ellipse(-r2 * 0.15, -r2 * 0.15, r2 * 0.35, r2 * 0.35);
        break;
      }

      // 12. Blue Spiral Shell Badge (+25 Pts)
      case 'blue_spiral_shell': {
        // Outer dark cobalt bezel
        p.stroke(10, 35, 85);
        p.strokeWeight(1.8);
        p.fill(16, 55, 125);
        p.ellipse(0, 0, s * 2.15, s * 2.15);

        // Outer beveled rim
        p.stroke(15, 65, 150);
        p.strokeWeight(1.0);
        p.fill(20, 85, 185);
        p.ellipse(0, 0, s * 1.95, s * 1.95);

        // Top arc glow on rim
        p.noStroke();
        p.fill(80, 195, 255, 140);
        p.arc(0, 0, s * 1.95, s * 1.95, -p.PI * 0.85, -p.PI * 0.15);

        // Layer 1: Outer Nautilus Spiral Wave (Cerulean to electric cyan)
        p.stroke(8, 30, 75);
        p.strokeWeight(1.4);
        p.fill(0, 165, 240);
        p.beginShape();
        p.vertex(0, -s * 0.95);
        p.bezierVertex(s * 0.95, -s * 0.95, s * 1.0, s * 0.5, s * 0.25, s * 0.85);
        p.bezierVertex(-s * 0.65, s * 0.95, -s * 0.95, s * 0.25, -s * 0.8, -s * 0.4);
        p.bezierVertex(-s * 0.65, -s * 0.85, -s * 0.2, -s * 0.95, 0, -s * 0.95);
        p.endShape(p.CLOSE);

        // Layer 2: Mid Spiral Ridge (Bright electric cyan)
        p.stroke(5, 45, 105);
        p.strokeWeight(1.2);
        p.fill(0, 210, 255);
        p.beginShape();
        p.vertex(-s * 0.05, -s * 0.75);
        p.bezierVertex(s * 0.75, -s * 0.75, s * 0.8, s * 0.35, s * 0.2, s * 0.65);
        p.bezierVertex(-s * 0.45, s * 0.75, -s * 0.7, s * 0.15, -s * 0.55, -s * 0.28);
        p.bezierVertex(-s * 0.45, -s * 0.65, -s * 0.15, -s * 0.75, -s * 0.05, -s * 0.75);
        p.endShape(p.CLOSE);

        // Layer 3: Inner Deep Sapphire Coil Vortex
        p.stroke(8, 25, 65);
        p.strokeWeight(1.0);
        p.fill(10, 75, 160);
        p.beginShape();
        p.vertex(s * 0.05, -s * 0.5);
        p.bezierVertex(s * 0.55, -s * 0.5, s * 0.55, s * 0.28, s * 0.12, s * 0.45);
        p.bezierVertex(-s * 0.3, s * 0.5, -s * 0.45, s * 0.05, -s * 0.32, -s * 0.2);
        p.bezierVertex(-s * 0.22, -s * 0.45, -s * 0.05, -s * 0.5, s * 0.05, -s * 0.5);
        p.endShape(p.CLOSE);

        // Core eye of the shell
        p.noStroke();
        p.fill(80, 235, 255);
        p.ellipse(0, 0, s * 0.42, s * 0.42);
        p.fill(15, 55, 130);
        p.ellipse(0, 0, s * 0.22, s * 0.22);

        // Glossy Specular Sheen (Curved crest reflection)
        p.fill(255, 255, 255, 230);
        p.beginShape();
        p.vertex(-s * 0.15, -s * 0.88);
        p.bezierVertex(s * 0.5, -s * 0.88, s * 0.75, -s * 0.45, s * 0.65, -s * 0.2);
        p.bezierVertex(s * 0.55, -s * 0.35, s * 0.35, -s * 0.75, -s * 0.15, -s * 0.88);
        p.endShape(p.CLOSE);

        // Secondary dot highlight
        p.ellipse(-s * 0.25, -s * 0.2, s * 0.2, s * 0.14);
        break;
      }

      // 13. Pink Heart-Diamond (+1 Life Gemstone)
      case 'pink_heart_diamond': {
        // Outer dark crimson/magenta bezel
        p.stroke(110, 10, 45);
        p.strokeWeight(1.8);
        p.fill(175, 15, 75);

        // Upright heart outline
        p.beginShape();
        p.vertex(0, -s * 0.35);
        p.bezierVertex(s * 0.55, -s * 1.3, s * 1.35, -s * 0.35, s * 0.75, s * 0.5);
        p.bezierVertex(s * 0.45, s * 0.85, s * 0.15, s * 1.15, 0, s * 1.35);
        p.bezierVertex(-s * 0.15, s * 1.15, -s * 0.45, s * 0.85, -s * 0.75, s * 0.5);
        p.bezierVertex(-s * 1.35, -s * 0.35, -s * 0.55, -s * 1.3, 0, -s * 0.35);
        p.endShape(p.CLOSE);

        // Facets: Shaded gemstone polygons
        p.stroke(90, 8, 38);
        p.strokeWeight(1.0);

        // Center diamond table facet
        p.fill(255, 55, 135);
        p.beginShape();
        p.vertex(0, -s * 0.15);
        p.vertex(s * 0.45, -s * 0.1);
        p.vertex(s * 0.35, s * 0.4);
        p.vertex(0, s * 0.65);
        p.vertex(-s * 0.35, s * 0.4);
        p.vertex(-s * 0.45, -s * 0.1);
        p.endShape(p.CLOSE);

        // Top-left lobe facet (Bright rose fuchsia - light source)
        p.fill(255, 135, 195);
        p.triangle(-s * 0.45, -s * 0.1, 0, -s * 0.15, -s * 0.45, -s * 0.95);

        // Top-right lobe facet (Mid fuchsia)
        p.fill(255, 75, 155);
        p.triangle(0, -s * 0.15, s * 0.45, -s * 0.1, s * 0.45, -s * 0.95);

        // Central cleft shadow facets
        p.fill(195, 20, 90);
        p.triangle(0, -s * 0.35, -s * 0.3, -s * 0.6, 0, -s * 0.15);
        p.triangle(0, -s * 0.35, s * 0.3, -s * 0.6, 0, -s * 0.15);

        // Left pavilion facet (Luminous magenta)
        p.fill(240, 45, 130);
        p.triangle(-s * 0.45, -s * 0.1, -s * 0.35, s * 0.4, -s * 0.85, s * 0.1);

        // Right pavilion facet (Deep shadow magenta)
        p.fill(185, 15, 80);
        p.triangle(s * 0.45, -s * 0.1, s * 0.35, s * 0.4, s * 0.85, s * 0.1);

        // Lower tip left facet
        p.fill(225, 30, 115);
        p.triangle(-s * 0.35, s * 0.4, 0, s * 0.65, 0, s * 1.25);

        // Lower tip right facet
        p.fill(150, 10, 60);
        p.triangle(s * 0.35, s * 0.4, 0, s * 0.65, 0, s * 1.25);

        // Facet ridge lines (crisp light reflections)
        p.stroke(255, 220, 245, 190);
        p.strokeWeight(1.0);
        p.line(0, -s * 0.15, 0, s * 0.65);
        p.line(-s * 0.35, s * 0.4, 0, s * 1.25);
        p.line(s * 0.35, s * 0.4, 0, s * 1.25);

        // Specular glossy sheen on left lobe
        p.noStroke();
        p.fill(255, 255, 255, 230);
        p.ellipse(-s * 0.38, -s * 0.55, s * 0.28, s * 0.16);

        // Table diamond sparkle dot
        p.ellipse(-s * 0.12, s * 0.08, s * 0.15, s * 0.15);
        break;
      }

      // 14. Crescent Moon Badge (+20 Pts)
      case 'crescent_moon': {
        // Outer deep plum border
        p.stroke(75, 10, 65);
        p.strokeWeight(1.6);
        p.fill(160, 20, 110);
        p.beginShape();
        // Outer convex curve (from top horn to bottom horn)
        p.vertex(s * 0.2, -s * 1.25);
        p.bezierVertex(s * 1.1, -s * 0.8, s * 1.1, s * 0.8, s * 0.2, s * 1.25);
        // Inner concave curve (from bottom horn back to top horn)
        p.bezierVertex(s * 0.65, s * 0.5, s * 0.65, -s * 0.5, s * 0.2, -s * 1.25);
        p.endShape(p.CLOSE);

        // Inner beveled vibrant magenta body
        p.noStroke();
        p.fill(225, 35, 155);
        p.beginShape();
        p.vertex(s * 0.22, -s * 1.1);
        p.bezierVertex(s * 0.95, -s * 0.7, s * 0.95, s * 0.7, s * 0.22, s * 1.1);
        p.bezierVertex(s * 0.55, s * 0.45, s * 0.55, -s * 0.45, s * 0.22, -s * 1.1);
        p.endShape(p.CLOSE);

        // Soft internal neon glow core
        p.fill(255, 105, 205, 180);
        p.ellipse(s * 0.65, 0, s * 0.45, s * 0.95);

        // Convex rim gloss highlight streak
        p.fill(255, 255, 255, 220);
        p.beginShape();
        p.vertex(s * 0.35, -s * 0.95);
        p.bezierVertex(s * 0.85, -s * 0.6, s * 0.88, -s * 0.1, s * 0.8, s * 0.2);
        p.bezierVertex(s * 0.78, -s * 0.1, s * 0.75, -s * 0.5, s * 0.35, -s * 0.95);
        p.endShape(p.CLOSE);

        // Secondary glint near top horn
        p.ellipse(s * 0.32, -s * 0.8, s * 0.18, s * 0.12);
        break;
      }

      // 15. Bronze Eight-Pointed Star (+50 Pts)
      case 'bronze_star': {
        const numPoints = 8;
        const rOuter = s * 1.35;
        const rInner = s * 0.65;

        p.stroke(75, 40, 15);
        p.strokeWeight(1.2);
        for (let i = 0; i < numPoints; i++) {
          const aCenter = (p.TWO_PI / numPoints) * i - p.HALF_PI;
          const aLeft = aCenter - p.TWO_PI / (numPoints * 2);
          const aRight = aCenter + p.TWO_PI / (numPoints * 2);

          const tipX = p.cos(aCenter) * rOuter;
          const tipY = p.sin(aCenter) * rOuter;
          const leftX = p.cos(aLeft) * rInner;
          const leftY = p.sin(aLeft) * rInner;
          const rightX = p.cos(aRight) * rInner;
          const rightY = p.sin(aRight) * rInner;

          // Left facet: Bright burnished bronze/gold (facing light)
          p.fill(215, 150, 65);
          p.triangle(0, 0, leftX, leftY, tipX, tipY);

          // Right facet: Deep antique bronze shadow
          p.fill(130, 75, 25);
          p.triangle(0, 0, tipX, tipY, rightX, rightY);
        }

        // Bronze circular stepped bezel
        p.stroke(85, 45, 18);
        p.strokeWeight(1.4);
        p.fill(185, 120, 50);
        p.ellipse(0, 0, s * 1.05, s * 1.05);

        // Inner recessed dark ring
        p.fill(100, 55, 20);
        p.ellipse(0, 0, s * 0.8, s * 0.8);

        // Raised golden center gem/rivet
        p.stroke(140, 85, 25);
        p.strokeWeight(1.0);
        p.fill(245, 185, 60);
        p.ellipse(0, 0, s * 0.55, s * 0.55);

        // Specular golden gleam
        p.noStroke();
        p.fill(255, 245, 190, 230);
        p.ellipse(-s * 0.12, -s * 0.12, s * 0.22, s * 0.16);
        break;
      }

      // 16. Purple Shuriken Emblem (-20 Pts)
      case 'purple_shuriken': {
        const numBlades = 4;
        const bladeL = s * 1.45;
        const bladeW = s * 0.45;
        const baseR = s * 0.5;

        p.stroke(50, 12, 75);
        p.strokeWeight(1.4);

        for (let i = 0; i < numBlades; i++) {
          p.push();
          p.rotate((p.HALF_PI) * i);

          // Main blade body (deep purple)
          p.fill(120, 35, 175);
          p.beginShape();
          p.vertex(0, 0);
          p.vertex(-bladeW * 0.6, -baseR);
          p.vertex(0, -bladeL);
          p.vertex(bladeW * 0.7, -baseR * 0.9);
          p.endShape(p.CLOSE);

          // Beveled facet along trailing edge (bright violet highlight)
          p.noStroke();
          p.fill(175, 65, 235);
          p.triangle(0, 0, -bladeW * 0.6, -baseR, 0, -bladeL);

          // Shadow facet on leading edge (midnight plum)
          p.fill(75, 18, 115);
          p.triangle(0, 0, 0, -bladeL, bladeW * 0.7, -baseR * 0.9);

          // Blade ridge line
          p.stroke(215, 145, 255, 200);
          p.strokeWeight(1.0);
          p.line(0, 0, 0, -bladeL);

          p.pop();
        }

        // Center hazard warning hub plate with crimson penalty border
        p.stroke(220, 25, 45);
        p.strokeWeight(1.4);
        p.fill(22, 8, 32);
        p.rect(-s * 0.45, -s * 0.45, s * 0.9, s * 0.9, 3);

        // Inner toxic violet disc
        p.stroke(175, 40, 225);
        p.strokeWeight(1.0);
        p.fill(35, 12, 48);
        p.ellipse(0, 0, s * 0.65, s * 0.65);

        // Prominent glowing white MINUS SIGN (unmistakable negative penalty indicator)
        p.noStroke();
        p.fill(255, 255, 255, 245);
        p.rect(-s * 0.25, -s * 0.065, s * 0.5, s * 0.13, 1);

        // Danger red warning notches
        p.fill(255, 45, 75);
        p.rect(-s * 0.25, -s * 0.065, s * 0.08, s * 0.13, 1);
        p.rect(s * 0.17, -s * 0.065, s * 0.08, s * 0.13, 1);
        break;
      }

      // Fallbacks for legacy shape names
      case 'rectangle':
        p.fill(this.color[0], this.color[1], this.color[2]);
        p.noStroke();
        p.rect(-this.w / 2, -this.w / 2, this.w, this.w);
        break;

      case 'triangle':
      case 'orangeTriangle':
        p.fill(this.color[0], this.color[1], this.color[2]);
        p.noStroke();
        p.triangle(0, -this.w / 2, -this.w / 2, this.w / 2, this.w / 2, this.w / 2);
        break;

      case 'trefoil':
        p.fill(this.color[0], this.color[1], this.color[2]);
        p.noStroke();
        p.beginShape();
        for (let angle = 0; angle < p.TWO_PI; angle += 0.1) {
          const radius = this.w * p.cos(3 * angle);
          p.vertex(radius * p.cos(angle), radius * p.sin(angle));
        }
        p.endShape(p.CLOSE);
        break;

      case 'kite':
        p.fill(this.color[0], this.color[1], this.color[2]);
        p.noStroke();
        p.beginShape();
        p.vertex(0, -this.w);
        p.vertex(-this.w / 2, 0);
        p.vertex(0, this.w);
        p.vertex(this.w / 2, 0);
        p.endShape(p.CLOSE);
        break;

      case 'ring':
        p.fill(this.color[0], this.color[1], this.color[2]);
        p.noStroke();
        p.arc(0, 0, this.w * 2, this.w, p.PI, 0, p.PIE);
        break;

      case 'circle':
      default:
        p.fill(this.color[0], this.color[1], this.color[2]);
        p.noStroke();
        p.circle(0, 0, this.w);
        break;
    }

    p.pop();
  }
}

export class ObjectSpawner {
  constructor(config) {
    this.config = config;
    this.starSpawned = false;
    this.heartsSpawned = 0;
    this.lastHeartSpawnFrame = -999;
    this.pinkDiamondsSpawned = 0;
    this.lastPinkDiamondSpawnFrame = -999;
    // Randomized spawn timing: next spawn frame = frameCount + spawnRate ± jitter
    this._nextSpawnFrame = this._calcNextSpawn(0);
    // Track last 3 horizontal positions to avoid clustering
    this._recentXSlots = [];
    this._consecutiveHazards = 0;
  }

  /**
   * Calculates the next randomized spawn frame
   * @param {number} fromFrame - current frame to offset from
   * @returns {number}
   */
  _calcNextSpawn(fromFrame) {
    const jitter = this.config.spawnJitter || 0;
    const offset = jitter > 0
      ? Math.floor(Math.random() * jitter * 2) - jitter
      : 0;
    return fromFrame + this.config.spawnRate + offset;
  }

  /**
   * Picks a randomized horizontal position that avoids repeating
   * the same column as recent spawns
   * @param {number} canvasWidth
   * @returns {number}
   */
  _pickX(canvasWidth) {
    const margin = 30;
    const usable = canvasWidth - margin * 2;
    const numSlots = 6;
    const slotW = usable / numSlots;

    // Build available slot indices, excluding recently used ones
    let available = [];
    for (let i = 0; i < numSlots; i++) {
      if (!this._recentXSlots.includes(i)) {
        available.push(i);
      }
    }
    // If all slots were recently used, allow any
    if (available.length === 0) {
      available = Array.from({ length: numSlots }, (_, i) => i);
    }

    const slot = available[Math.floor(Math.random() * available.length)];
    // Track this slot and keep history to 3
    this._recentXSlots.push(slot);
    if (this._recentXSlots.length > 3) {
      this._recentXSlots.shift();
    }

    // Random position within the chosen slot
    return margin + slot * slotW + Math.random() * slotW;
  }

  /**
   * Resets all spawn tracking counters for a new game run
   */
  reset() {
    this.starSpawned = false;
    this.heartsSpawned = 0;
    this.lastHeartSpawnFrame = -999;
    this.pinkDiamondsSpawned = 0;
    this.lastPinkDiamondSpawnFrame = -999;
    this._nextSpawnFrame = this._calcNextSpawn(0);
    this._recentXSlots = [];
    this._consecutiveHazards = 0;
  }

  /**
   * Evaluates if a new object should spawn and returns it
   * @param {number} frameCount
   * @param {number} currentBallsCount
   * @param {number} canvasWidth
   * @param {number} score
   * @returns {FallingObject|null}
   */
  spawnIfReady(frameCount, currentBallsCount, canvasWidth, score) {
    // 1. Check special star threshold for Easy mode
    if (
      this.config.specialStar &&
      score >= this.config.specialStar.threshold &&
      !this.starSpawned
    ) {
      this.starSpawned = true;
      const starTemplate = this.config.specialStar.object;
      return new FallingObject({
        ...starTemplate,
        x: this._pickX(canvasWidth),
        dy: this.config.ballSpeed
      });
    }

    // 2. Randomized interval spawn (jitter-based timing)
    if (frameCount >= this._nextSpawnFrame && currentBallsCount < this.config.maxBalls) {
      // Schedule next spawn with fresh jitter
      this._nextSpawnFrame = this._calcNextSpawn(frameCount);

      // 2a. Check 1UP heart spawn rules with strict limits and spacing
      const heartCfg = this.config.heartConfig;
      if (
        heartCfg &&
        this.heartsSpawned < heartCfg.maxSpawns &&
        (frameCount - this.lastHeartSpawnFrame) >= heartCfg.cooldownFrames &&
        Math.random() < heartCfg.spawnChance
      ) {
        this.heartsSpawned++;
        this.lastHeartSpawnFrame = frameCount;

        return new FallingObject({
          id: '1up_heart',
          shape: 'heart',
          color: [255, 25, 70],
          points: 0,
          lifeDelta: 1,
          sound: 'lifePlus',
          w: 22,
          description: '1UP Extra Life Heart (+1 Life)',
          x: this._pickX(canvasWidth),
          dy: this.config.ballSpeed
        });
      }

      // 2b. Check Pink Heart-Diamond bonus-life rules with strict limit and spacing
      const pinkCfg = this.config.pinkDiamondConfig;
      if (
        pinkCfg &&
        this.pinkDiamondsSpawned < pinkCfg.maxSpawns &&
        (frameCount - this.lastPinkDiamondSpawnFrame) >= pinkCfg.cooldownFrames &&
        Math.random() < pinkCfg.spawnChance
      ) {
        this.pinkDiamondsSpawned++;
        this.lastPinkDiamondSpawnFrame = frameCount;

        return new FallingObject({
          id: 'pink_heart_diamond',
          shape: 'pink_heart_diamond',
          color: [255, 50, 150],
          points: 0,
          lifeDelta: 1,
          sound: 'lifePlus',
          w: 22,
          description: 'Pink Heart-Diamond (+1 Life)',
          x: this._pickX(canvasWidth),
          dy: this.config.ballSpeed
        });
      }

      // 2c. Standard difficulty badge pool selection
      const templates = this.config.shapes;
      const isHarmful = (t) => (t.points || 0) < 0 || (t.lifeDelta || 0) < 0;

      let template;
      // Controlled pacing: prevent frustrating walls of 3+ consecutive hazards
      if (this._consecutiveHazards >= 2) {
        const safePool = templates.filter(t => !isHarmful(t));
        template = safePool.length > 0
          ? safePool[Math.floor(Math.random() * safePool.length)]
          : templates[Math.floor(Math.random() * templates.length)];
      } else {
        template = templates[Math.floor(Math.random() * templates.length)];
      }

      if (isHarmful(template)) {
        this._consecutiveHazards = (this._consecutiveHazards || 0) + 1;
      } else {
        this._consecutiveHazards = 0;
      }

      return new FallingObject({
        ...template,
        x: this._pickX(canvasWidth),
        dy: this.config.ballSpeed,
        w: template.w || 18
      });
    }

    return null;
  }
}
