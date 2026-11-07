/**
 * MindRush - Educational Mode Application Entry Point
 * Reads category from URL params, loads questions, validates, and mounts the educational engine.
 */

import { QUESTION_BANK, CATEGORY_NAMES, validateQuestionBank, getQuestionsByType, getAllQuestionsShuffled } from './game/educational-questions.js';
import { EducationalEngine, EDU_CONFIG } from './game/educational-engine.js';

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
});
