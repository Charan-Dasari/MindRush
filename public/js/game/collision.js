/**
 * MindRush — Collision Detection & Resolution
 * Guarantees that each object collision produces exactly ONE outcome
 */

import { unlockBadge, isCollectibleBadge } from './badges.js';

export class CollisionSystem {
  /**
   * Checks collision between paddle and a falling object
   * @param {import('./paddle.js').Paddle} paddle
   * @param {import('./objects.js').FallingObject} object
   * @returns {boolean}
   */
  checkCollision(paddle, object) {
    if (object.handled) return false;

    const bounds = paddle.getBounds();
    const halfW = object.w / 2;

    // AABB intersection check
    const isIntersecting = (
      object.x + halfW >= bounds.x &&
      object.x - halfW <= bounds.x + bounds.w &&
      object.y + halfW >= bounds.y &&
      object.y - halfW <= bounds.y + bounds.h + 8 // Slight tolerance for high fall speed
    );

    return isIntersecting;
  }

  /**
   * Resolves collision atomically: updates state and triggers sound
   * @param {import('./objects.js').FallingObject} object
   * @param {import('./state.js').GameState} state
   * @param {import('./audio.js').AudioManager} audio
   * @returns {object} Collision outcome report
   */
  resolveCollision(object, state, audio) {
    if (object.handled) return { ignored: true };
    object.handled = true;

    // Apply score and life changes
    if (object.points !== 0) {
      state.addScore(object.points);
    }

    if (object.lifeDelta !== 0) {
      state.modifyLives(object.lifeDelta);
    }

    // Play appropriate audio
    if (object.sound) {
      audio.play(object.sound);
    }

    // Persist collectible badge unlock upon collection (never on miss or spawn)
    if (isCollectibleBadge(object)) {
      unlockBadge(object);
    }

    return {
      points: object.points,
      lifeDelta: object.lifeDelta,
      sound: object.sound,
      isStar: object.isStar
    };
  }
}
