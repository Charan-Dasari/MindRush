/**
 * MindRush — Application Entry Point
 * Reads difficulty configuration from URL params and mounts the game engine
 */

import { getDifficultyConfig, NEW_BADGES, isInsaneUnlocked, setProgressionUserContext, isEduDifficultyUnlocked } from './game/difficulty.js?v=2';
import { GameEngine } from './game/engine.js?v=2';
import { SpaceInvaderEngine } from './game/space-invader-engine.js?v=2';
import { EducationalInvaderEngine } from './game/educational-invader-engine.js?v=2';
import { FallingObject } from './game/objects.js?v=2';
import { setBadgeUserContext } from './game/badges.js?v=2';
import { getActiveUser, syncProgressFromServer } from './game/storage.js?v=2';

document.addEventListener('DOMContentLoaded', async () => {
  // Prevent context menu and selection during gameplay
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('selectstart', (e) => e.preventDefault());

  // Establish user context from session
  const activeUser = getActiveUser();
  if (activeUser && (activeUser.id || activeUser.username)) {
    const uid = activeUser.id || activeUser.username;
    setBadgeUserContext(uid);
    setProgressionUserContext(uid);
  }
  try {
    const data = await syncProgressFromServer();
    if (data && data.user) {
      const uid = data.user.id || data.user.username;
      setBadgeUserContext(uid);
      setProgressionUserContext(uid);
    }
  } catch (e) {}

  // Parse URL difficulty and mode parameters
  const urlParams = new URLSearchParams(window.location.search);
  const difficultyParam = urlParams.get('difficulty');
  const modeParam = (urlParams.get('mode') || '').toLowerCase().trim();
  const isInvaderMode = modeParam === 'invader' || modeParam === 'space-invader';
  const isEduMode = modeParam === 'educational' || modeParam === 'edu';

  // Branch 1: Educational Mode — Space Invader Std. 1 Maths
  if (isEduMode) {
    const diffKey = (difficultyParam || 'easy').toLowerCase();
    // Enforce Educational difficulty progression locks
    if (!isEduDifficultyUnlocked(diffKey)) {
      window.location.href = `difficulty-select.html?mode=educational&locked=${diffKey}`;
      return;
    }

    document.title = `MindRush — Educational Mode (${diffKey.toUpperCase()})`;
    const diffNameEl = document.getElementById('hud-diff-name');
    if (diffNameEl) {
      diffNameEl.textContent = `STD. 1 MATHS • ${diffKey.toUpperCase()}`;
    }
    const exitBtn = document.getElementById('hud-btn-exit');
    if (exitBtn) {
      exitBtn.href = 'difficulty-select.html?mode=educational';
    }

    const container = document.getElementById('canvas-container');
    const engine = new EducationalInvaderEngine({ id: diffKey });
    engine.mount(container);
    window.__MINDRUSH_ENGINE__ = engine;
    return;
  }

  // Enforce Insane difficulty progression lock: player must beat Hard mode first
  if (difficultyParam && difficultyParam.trim().toLowerCase() === 'insane' && !isInsaneUnlocked()) {
    const redirectUrl = isInvaderMode
      ? 'difficulty-select.html?mode=invader&locked=insane'
      : 'difficulty-select.html?locked=insane';
    window.location.href = redirectUrl;
    return;
  }

  // Branch 1: Fun Mode — Space Invader
  if (isInvaderMode) {
    const diffKey = (difficultyParam || 'easy').toLowerCase();
    document.title = `MindRush — Space Invader (${diffKey.toUpperCase()})`;
    
    const diffNameEl = document.getElementById('hud-diff-name');
    if (diffNameEl) {
      diffNameEl.textContent = `SPACE INVADER • ${diffKey.toUpperCase()}`;
    }
    const exitBtn = document.getElementById('hud-btn-exit');
    if (exitBtn) {
      exitBtn.href = 'difficulty-select.html?mode=invader';
    }

    const container = document.getElementById('canvas-container');
    const engine = new SpaceInvaderEngine({ id: diffKey });
    engine.mount(container);
    window.__MINDRUSH_ENGINE__ = engine;
    return;
  }

  // Branch 2: Fun Mode — Object Falling (Skyfall)
  const config = getDifficultyConfig(difficultyParam);

  // Update document title and mode
  document.title = `MindRush — ${config.name} Difficulty`;
  const diffNameEl = document.getElementById('hud-diff-name');
  if (diffNameEl) {
    diffNameEl.textContent = `${config.name.toUpperCase()} MODE`;
  }

  // Mount game engine
  const container = document.getElementById('canvas-container');
  const engine = new GameEngine(config);
  engine.mount(container);

  // Expose engine to window for debugging and automated testing
  window.__MINDRUSH_ENGINE__ = engine;

  // If difficulty=showcase or ?showcase=true, render all 5 new badges stationary across canvas
  if (config.id === 'showcase' || urlParams.get('showcase') === 'true') {
    engine.spawner.spawnIfReady = () => null; // disable random spawner
    const keys = Object.keys(NEW_BADGES);
    let populated = false;
    const origGameLoop = engine._gameLoop.bind(engine);
    engine._gameLoop = function(p) {
      if (!populated && p && p.width) {
        populated = true;
        this.balls = [];
        keys.forEach((key, i) => {
          const cfg = NEW_BADGES[key];
          const spacing = p.width / (keys.length + 1);
          const x = spacing * (i + 1);
          const y = p.height * 0.48;
          const b = new FallingObject({ ...cfg, x, y, dy: 0, w: 50 });
          b.update = function() { this.animTicks++; }; // keep stationary at (x, y) while animating
          this.balls.push(b);
        });
      }
      origGameLoop(p);
    };
  }
});
