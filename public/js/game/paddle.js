/**
 * MindRush — Paddle
 * Manages paddle position, input-driven movement, and rendering
 */

export class Paddle {
  constructor(config, canvasWidth, canvasHeight) {
    this.w = config.paddle?.width || 100;
    this.h = config.paddle?.height || 10;
    this.yOffset = config.paddle?.yOffset || 20;
    this.x = (canvasWidth - this.w) / 2;
    this.y = canvasHeight - this.yOffset;
  }

  /**
   * Updates paddle position based on input manager and viewport dimensions
   * @param {import('./input.js').InputManager} inputManager
   * @param {number} canvasWidth
   * @param {number} canvasHeight
   */
  update(inputManager, canvasWidth, canvasHeight) {
    this.x = inputManager.getPaddleX(canvasWidth, this.w);
    this.y = canvasHeight - this.yOffset;
  }

  /**
   * Renders the paddle on the p5 canvas
   * @param {any} p - p5 instance
   */
  display(p) {
    p.push();
    p.noStroke();
    p.fill(255);
    p.rect(this.x, this.y, this.w, this.h, 3);
    p.pop();
  }

  /**
   * Returns current bounding box
   */
  getBounds() {
    return {
      x: this.x,
      y: this.y,
      w: this.w,
      h: this.h
    };
  }
}
