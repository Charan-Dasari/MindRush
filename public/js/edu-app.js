/**
 * MindRush - Educational Mode Application Entry Point
 * Reads category from URL params, loads questions, validates, and mounts the educational engine.
 */

import { QUESTION_BANK, CATEGORY_NAMES, validateQuestionBank, getQuestionsByType, getAllQuestionsShuffled } from './game/educational-questions.js';
import { EducationalEngine, EDU_CONFIG } from './game/educational-engine.js';
import { getGameSettings, saveGameSettings, applyGameSettings } from './game/settings.js';
import { CameraGate } from './game/camera-gate.js';

document.addEventListener('DOMContentLoaded', function() {
  // Prevent context menu and selection during gameplay
  document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
  document.addEventListener('selectstart', function(e) { e.preventDefault(); });

  // Parse URL params
  const urlParams = new URLSearchParams(window.location.search);
  const categoryType = urlParams.get('type') || 'TYPE_1';

  // Validate the question bank
  const validation = validateQuestionBank(QUESTION_BANK);
  if (!validation.valid) {
    console.warn('[MindRush Educational] Question bank has validation errors:', validation.errors);
  }

  const validQuestions = validation.questions;

  // Get questions for selected category (or all if invalid type)
  let sessionQuestions;
  let categoryName;

  if (CATEGORY_NAMES[categoryType]) {
    sessionQuestions = getQuestionsByType(validQuestions, categoryType);
    categoryName = CATEGORY_NAMES[categoryType];
  } else {
    sessionQuestions = getAllQuestionsShuffled(validQuestions);
    categoryName = 'All Categories';
  }

  if (sessionQuestions.length === 0) {
    console.error('[MindRush Educational] No valid questions found for type:', categoryType);
    alert('No questions available for this category. Returning to categories.');
    window.location.href = 'educational-categories.html';
    return;
  }

  // Update page title
  document.title = 'MindRush - Educational: ' + categoryName;

  // Bind modal buttons
  _bindModalButtons();

  // Mount educational engine
  const container = document.getElementById('canvas-container');
  const engine = new EducationalEngine(sessionQuestions, categoryName);
  engine.mount(container);

  // Expose for testing
  window.__MINDRUSH_EDU_ENGINE__ = engine;
  applyGameSettings(getGameSettings(), engine);
  _setupControlModeUI(engine);
  _setupInGameSettingsModal(engine);
  const gate = new CameraGate({ engine });
  engine.cameraGate = gate;
  gate.start();

  function _bindModalButtons() {
    // Pause modal
    var resumeBtn = document.getElementById('edu-btn-resume');
    var restartBtn = document.getElementById('edu-btn-restart');
    var exitBtn = document.getElementById('edu-btn-exit');
    var pauseBtn = document.getElementById('btn-pause-header');

    // Results modal
    var playAgainBtn = document.getElementById('edu-btn-play-again');
    var resultsExitBtn = document.getElementById('edu-btn-results-exit');

    // Game over modal
    var goRestartBtn = document.getElementById('edu-btn-go-restart');
    var goExitBtn = document.getElementById('edu-btn-go-exit');

    if (pauseBtn) {
      pauseBtn.addEventListener('click', function() {
        if (window.__MINDRUSH_EDU_ENGINE__) {
          window.__MINDRUSH_EDU_ENGINE__.togglePause();
        }
      });
    }

    if (resumeBtn) {
      resumeBtn.addEventListener('click', function() {
        if (window.__MINDRUSH_EDU_ENGINE__) {
          window.__MINDRUSH_EDU_ENGINE__.resume();
        }
      });
    }

    if (restartBtn) {
      restartBtn.addEventListener('click', function() {
        if (window.__MINDRUSH_EDU_ENGINE__) {
          window.__MINDRUSH_EDU_ENGINE__.restart();
        }
      });
    }

    if (exitBtn) {
      exitBtn.addEventListener('click', function() {
        if (window.__MINDRUSH_EDU_ENGINE__) {
          window.__MINDRUSH_EDU_ENGINE__.exit();
        }
      });
    }

    if (playAgainBtn) {
      playAgainBtn.addEventListener('click', function() {
        if (window.__MINDRUSH_EDU_ENGINE__) {
          window.__MINDRUSH_EDU_ENGINE__.restart();
        }
      });
    }

    if (resultsExitBtn) {
      resultsExitBtn.addEventListener('click', function() {
        if (window.__MINDRUSH_EDU_ENGINE__) {
          window.__MINDRUSH_EDU_ENGINE__.exit();
        }
      });
    }

    if (goRestartBtn) {
      goRestartBtn.addEventListener('click', function() {
        if (window.__MINDRUSH_EDU_ENGINE__) {
          window.__MINDRUSH_EDU_ENGINE__.restart();
        }
      });
    }

    if (goExitBtn) {
      goExitBtn.addEventListener('click', function() {
        if (window.__MINDRUSH_EDU_ENGINE__) {
          window.__MINDRUSH_EDU_ENGINE__.exit();
        }
      });
    }
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
    const settingsBtn = document.getElementById('edu-btn-settings');
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
