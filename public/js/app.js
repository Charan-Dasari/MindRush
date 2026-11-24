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
import { getGameSettings, saveGameSettings, applyGameSettings } from './game/settings.js';
import { CameraGate } from './game/camera-gate.js';

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
    applyGameSettings(getGameSettings(), engine);
    _setupControlModeUI(engine);
    _setupInGameSettingsModal(engine);
    const gate = new CameraGate({ engine });
    engine.cameraGate = gate;
    gate.start();
    return;
  }

  // Enforce Insane difficulty progression lock: player must beat Hard mode first in the target mode
  const targetProgressionMode = isInvaderMode ? 'space-invader' : 'skyfall';
  if (difficultyParam && difficultyParam.trim().toLowerCase() === 'insane' && !isInsaneUnlocked(targetProgressionMode)) {
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
    applyGameSettings(getGameSettings(), engine);
    _setupControlModeUI(engine);
    _setupInGameSettingsModal(engine);
    const gate = new CameraGate({ engine });
    engine.cameraGate = gate;
    gate.start();
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
  const exitBtn = document.getElementById('hud-btn-exit');
  if (exitBtn) {
    exitBtn.href = 'mode-select.html';
  }

  // Mount game engine
  const container = document.getElementById('canvas-container');
  const engine = new GameEngine(config);
  engine.mount(container);

  // Expose engine to window for debugging and automated testing
  window.__MINDRUSH_ENGINE__ = engine;
  applyGameSettings(getGameSettings(), engine);
  _setupControlModeUI(engine);
  _setupInGameSettingsModal(engine);
  const gate = new CameraGate({ engine });
  engine.cameraGate = gate;
  gate.start();

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

  function _setupControlModeUI(engine) {
    if (!engine) return;
    const previewContainer = document.getElementById('camera-preview-container');
    const previewVideo = document.getElementById('gesture-camera-preview');
    const gestureInst = engine.gestureInput || engine.gesture;

    if (gestureInst) {
      gestureInst.onStatus((statusObj) => {
        if (previewContainer && previewVideo && gestureInst.videoElement && gestureInst.isActive) {
          if (previewVideo.srcObject !== gestureInst.videoElement.srcObject) {
            previewVideo.srcObject = gestureInst.videoElement.srcObject;
            previewVideo.play().catch(() => {});
          }
          previewContainer.classList.remove('hidden');
        } else if (previewContainer) {
          previewContainer.classList.add('hidden');
        }
      });
    }
  }

  function _setupInGameSettingsModal(engine) {
    if (!engine) return;
    const settingsBtn = document.getElementById('btn-pause-settings');
    const settingsModal = document.getElementById('game-settings-modal');
    const closeXBtn = document.getElementById('btn-settings-close-x');
    const cancelBtn = document.getElementById('btn-settings-cancel');
    const saveBtn = document.getElementById('btn-settings-save');
    const optGesture = document.getElementById('opt-method-gesture');
    const optKeyboard = document.getElementById('opt-method-keyboard');
    const sfxCheckbox = document.getElementById('ingame-setting-sfx');
    const musicCheckbox = document.getElementById('ingame-setting-music');
    const volSlider = document.getElementById('ingame-setting-volume');
    const volDisplay = document.getElementById('ingame-vol-display');

    function populateModal() {
      const s = getGameSettings();
      if (s.controlMethod === 'keyboard') {
        if (optKeyboard) optKeyboard.checked = true;
      } else {
        if (optGesture) optGesture.checked = true;
      }
      if (sfxCheckbox) sfxCheckbox.checked = !!s.sfx;
      if (musicCheckbox) musicCheckbox.checked = !!s.music;
      if (volSlider) volSlider.value = s.volume ?? 80;
      if (volDisplay) volDisplay.textContent = (s.volume ?? 80) + '%';
    }

    function openSettings() {
      populateModal();
      if (settingsModal) settingsModal.classList.add('active');
    }

    function closeSettings() {
      if (settingsModal) settingsModal.classList.remove('active');
    }

    // Modal priority safeguard: Esc key while settings is open closes settings modal only
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.code === 'Escape') {
        if (settingsModal && settingsModal.classList.contains('active')) {
          e.preventDefault();
          e.stopImmediatePropagation();
          closeSettings();
        }
      }
    }, true);

    if (settingsBtn) {
      settingsBtn.onclick = (e) => {
        e.preventDefault();
        openSettings();
      };
    }
    if (closeXBtn) {
      closeXBtn.onclick = (e) => {
        e.preventDefault();
        closeSettings();
      };
    }
    if (cancelBtn) {
      cancelBtn.onclick = (e) => {
        e.preventDefault();
        closeSettings();
      };
    }
    if (saveBtn) {
      saveBtn.onclick = (e) => {
        e.preventDefault();
        const isKb = optKeyboard ? optKeyboard.checked : false;
        const newSettings = {
          controlMethod: isKb ? 'keyboard' : 'gesture',
          sfx: sfxCheckbox ? sfxCheckbox.checked : true,
          music: musicCheckbox ? musicCheckbox.checked : true,
          volume: volSlider ? parseInt(volSlider.value, 10) : 80
        };
        saveGameSettings(newSettings);
        applyGameSettings(newSettings, engine);
        closeSettings();
      };
    }
  }
});
