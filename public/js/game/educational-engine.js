/**
 * MindRush — Educational Mode Game Engine
 * Extends the base arcade engine with question-answer falling-object gameplay.
 *
 * Fixed Semi-Hard / Hardcore-Lite speed (between Medium and Hard).
 * No difficulty selection — always uses the fixed educational config.
 *
 * Scoring & Life Rules (Phase 2.4):
 *   - Progressive scoring schedule with bounded random variation
 *   - Correct answers award progressive positive points (0 lives lost)
 *   - Wrong answers apply progressive penalty AND deduct exactly 1 life
 *   - Missed answers apply larger progressive penalty AND deduct exactly 1 life
 *   - Red balls completely removed from Educational Mode
 *   - Zero lives triggers immediate Game Over
 */

import { GameState } from './state.js';
import { Paddle } from './paddle.js';
import { FallingObject } from './objects.js';
import { CollisionSystem } from './collision.js';
import { AudioManager } from './audio.js';
import { InputManager } from './input.js';
import { EducationalScoringManager } from './educational-scoring.js';
import { GestureInputManager } from './gesture-input.js';
import { getGameSettings } from './settings.js';

// -- Educational Mode fixed difficulty config (Semi-Hard / Hardcore-Lite) --
// Speed sits between Fun Mode Medium (3.5) and Hard (4.5)
export const EDU_CONFIG = {
  id: 'educational',
  name: 'Educational',
  ballSpeed: 3.8,
  spawnRate: 70,
  maxBalls: 6,
  paddle: {
    width: 120,
    height: 18,
    yOffset: 14
  }
};

// -- Educational Session States --
export const EDU_STATES = {
  SHOWING_QUESTION: 'showing_question',
  ANSWERS_FALLING: 'answers_falling',
  FEEDBACK: 'feedback',
  SESSION_COMPLETE: 'session_complete',
  GAME_OVER: 'game_over'
};

export class EducationalEngine {
  /**
   * @param {object[]} questions - validated question array for this session
   * @param {string} categoryName - display name for HUD
   */
  constructor(questions, categoryName) {
    if (!Array.isArray(questions)) {
      throw new Error('EducationalEngine requires an array of questions');
    }

    // Tightened, backward-compatible constructor normalizer (T036)
    this.questions = questions.map((q, qIndex) => {
      if (!q || typeof q !== 'object') {
        throw new Error(`INVALID_QUESTION: Question at index ${qIndex} is not an object`);
      }

      // Assert options is an array with length >= 2
      if (!Array.isArray(q.options) || q.options.length < 2) {
        throw new Error(`INVALID_OPTIONS: Question ${q.id || qIndex} options must be an array of length >= 2`);
      }

      // Explicitly reject undefined, null, empty string "", or whitespace-only correctAnswer
      if (q.correctAnswer === undefined || q.correctAnswer === null) {
        throw new Error(`INVALID_CORRECT_ANSWER: Question ${q.id || qIndex} has undefined/null correctAnswer`);
      }

      const rawAnswerStr = String(q.correctAnswer).trim();
      if (rawAnswerStr.length === 0) {
        throw new Error(`INVALID_CORRECT_ANSWER: Question ${q.id || qIndex} has empty/whitespace correctAnswer`);
      }

      const targetAnswer = rawAnswerStr;

      // Find all matching indices where String(opt).trim() === targetAnswer
      const matchingIndices = [];
      q.options.forEach((opt, idx) => {
        if (opt !== undefined && opt !== null && String(opt).trim() === targetAnswer) {
          matchingIndices.push(idx);
        }
      });

      if (matchingIndices.length === 0) {
        throw new Error(`ANSWER_NOT_IN_OPTIONS: Question ${q.id || qIndex} correctAnswer "${targetAnswer}" not found in options`);
      }

      if (matchingIndices.length > 1) {
        throw new Error(`AMBIGUOUS_OPTIONS: Question ${q.id || qIndex} has multiple options matching correctAnswer "${targetAnswer}"`);
      }

      const resolvedIndex = matchingIndices[0];

      // If correctIndex is specified, validate integer, bounds, and consistency
      if (q.correctIndex !== undefined) {
        if (!Number.isInteger(q.correctIndex)) {
          throw new Error(`INVALID_CORRECT_INDEX: Question ${q.id || qIndex} correctIndex must be an integer`);
        }
        if (q.correctIndex < 0 || q.correctIndex >= q.options.length) {
          throw new Error(`OUT_OF_BOUNDS_CORRECT_INDEX: Question ${q.id || qIndex} correctIndex is out of bounds`);
        }
        if (q.correctIndex !== resolvedIndex) {
          throw new Error(`CONFLICTING_CORRECT_INDEX: Question ${q.id || qIndex} correctIndex (${q.correctIndex}) conflicts with resolved index (${resolvedIndex})`);
        }
      }

      return {
        ...q,
        questionText: q.questionText || q.question || '',
        correctAnswer: targetAnswer,
        correctIndex: resolvedIndex
      };
    });

    this.categoryName = categoryName || 'Educational';

    // Core systems
    this.state = new GameState(3);
    this.audio = new AudioManager();
    this.input = new InputManager();
    this.collision = new CollisionSystem();
    this.gesture = new GestureInputManager();
    this.gestureInput = this.gesture;

    // Scoring progression manager (isolated configuration & bounded variation)
    this.scoringManager = new EducationalScoringManager();
    this.currentScoring = null;

    this.paddle = null;
    this.p5Instance = null;
    this.isReady = typeof window === 'undefined';
    this.cameraGate = null;

    // Educational session tracking
    this.eduState = EDU_STATES.SHOWING_QUESTION;
    this.currentQuestionIndex = 0;
    this.currentQuestion = null;
    this.answerObjects = [];
    this.feedbackText = '';
    this.feedbackDetail = '';
    this.feedbackColor = [255, 255, 255];
    this.feedbackTimer = 0;
    this.questionShowTimer = 0;
    this.answeredCorrectly = false;
    this.questionResolved = false;

    // Session stats
    this.totalAnswered = 0;
    this.totalCorrect = 0;
    this.totalWrong = 0;
    this.totalMissed = 0;

    // Answer stagger timing
    this._answerSpawnQueue = [];
    this._answerSpawnTimer = 0;

    // UI element refs
    this.pauseModal = null;
    this.gameOverModal = null;
    this.resultsModal = null;

    this._setupInputHandlers();
    this._setupGestureInput();
  }

  _setupGestureInput() {
    this.gesture.onGesture(({ normalizedX, isHandPresent }) => {
      if (!isHandPresent || !this.state.isPlaying() || this.input.controlMode !== 'gesture') return;
      // Do not overwrite horizontal position if user is actively pressing keyboard movement keys
      const delta = this.input.getMovementDelta();
      if (delta !== 0) return;

      if (this.p5Instance && this.paddle) {
        const halfW = this.paddle.w / 2;
        const minCenter = halfW;
        const maxCenter = this.p5Instance.width - halfW;
        const targetX = minCenter + normalizedX * (maxCenter - minCenter);
        this.input.setTargetX(targetX);
      }
    });

    this.gesture.onPauseToggle(() => {
      this.togglePause();
    });

    this.gesture.onStatus((statusObj) => {
      this._updateSensorHUD(statusObj);
    });

    this.gesture.onCameraDisconnect((msg) => {
      if (this.cameraGate) {
        this.cameraGate.handleRuntimeDisconnect(msg);
      } else {
        this.pause();
        this.input.setControlMode('keyboard');
        this._showNotification(msg || 'Camera disconnected. Game paused safely.');
        this._updateSensorHUD({ status: 'error', message: 'KEYBOARD SAFE MODE' });
      }
    });
  }

  _updateSensorHUD(statusObj) {
    if (typeof document === 'undefined') return;
    const label = document.querySelector('#hud-sensor-feedback .sensor-label');
    const dot = document.querySelector('#hud-sensor-feedback .sensor-pulse-dot');
    if (label && statusObj.message) {
      label.textContent = statusObj.message.toUpperCase();
    }
    if (dot) {
      dot.className = 'sensor-pulse-dot';
      if (statusObj.status === 'active' || statusObj.status === 'tracking') dot.classList.add('active');
      else if (statusObj.status === 'error' || statusObj.status === 'disconnected') dot.classList.add('error');
    }
  }

  _showNotification(msg) {
    if (typeof document === 'undefined') return;
    let notif = document.getElementById('gesture-notification');
    if (!notif) {
      notif = document.createElement('div');
      notif.id = 'gesture-notification';
      notif.className = 'gesture-notification';
      document.body.appendChild(notif);
    }
    notif.textContent = msg;
    notif.classList.remove('hidden');
    setTimeout(() => {
      if (notif) notif.classList.add('hidden');
    }, 4000);
  }

  _setupInputHandlers() {
    this.input.onPauseToggle(() => {
      this.togglePause();
    });

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.state.isPlaying()) {
          this.pause();
        }
      });
    }
  }

  /**
   * Mounts and boots the p5.js educational game sketch
   * @param {HTMLElement} container
   */
  mount(container) {
    const self = this;

    const sketch = (p) => {
      self.p5Instance = p;

      p.setup = () => {
        const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
        canvas.parent(container);
        self.paddle = new Paddle(EDU_CONFIG, p.width, p.height);
        self.input.setMouseEnabled(false);
        self._loadFirstQuestion();
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
        if (self.paddle) {
          self.paddle.update(self.input, p.width, p.height);
        }
      };

      p.draw = () => {
        self._gameLoop(p);
      };
    };

    new window.p5(sketch);
  }

  _loadFirstQuestion() {
    this.currentQuestionIndex = 0;
    this._startQuestion();
  }

  _startQuestion() {
    if (this.currentQuestionIndex >= this.questions.length) {
      this.eduState = EDU_STATES.SESSION_COMPLETE;
      this._showResultsScreen();
      return;
    }

    this.currentQuestion = this.questions[this.currentQuestionIndex];
    // Retrieve fixed scoring values for this question
    this.currentScoring = this.scoringManager.getScoringForQuestion(this.currentQuestionIndex);

    this.eduState = EDU_STATES.SHOWING_QUESTION;
    this.questionShowTimer = 90; // ~1.5 seconds showing question before answers fall
    this.questionResolved = false;
    this.answeredCorrectly = false;
    this.answerObjects = [];
    this._answerSpawnQueue = [];
    this._answerSpawnTimer = 0;
    this.feedbackText = '';
    this.feedbackDetail = '';
  }

  _prepareAnswerObjects(canvasWidth) {
    if (!this.currentQuestion) return;

    const q = this.currentQuestion;
    const colors = [
      [0, 200, 255],   // Cyan
      [100, 255, 100],  // Green
      [255, 200, 50],   // Gold
      [255, 100, 200]   // Pink
    ];

    // Create shuffled position indices for staggered horizontal placement
    const positions = [0, 1, 2, 3];
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = positions[i];
      positions[i] = positions[j];
      positions[j] = temp;
    }

    // Create answer objects with staggered spawn delays
    const staggerFrames = 25; // ~0.4s between each answer object
    for (let i = 0; i < 4; i++) {
      const posIdx = positions[i];
      const margin = 60;
      const usable = canvasWidth - margin * 2;
      const slotW = usable / 4;
      const x = margin + posIdx * slotW + slotW / 2;

      this._answerSpawnQueue.push({
        delay: i * staggerFrames,
        config: {
          x: x,
          y: -30,
          dy: EDU_CONFIG.ballSpeed,
          w: 28,
          color: colors[i],
          shape: 'edu_answer',
          points: 0,
          lifeDelta: 0,
          sound: 'paddle',
          description: q.options[i],
          _answerIndex: i,
          _isCorrect: i === q.correctIndex,
          _answerText: q.options[i]
        }
      });
    }
  }

  _gameLoop(p) {
    if (!this.isReady) {
      this._renderScene(p);
      return;
    }

    p.background(0);

    // State: Game Over (lost all lives)
    if (this.state.isGameOver()) {
      this.input.restoreCursor();
      if (!this.state.gameOverHandled) {
        this.state.gameOverHandled = true;
        this.eduState = EDU_STATES.GAME_OVER;
        this.audio.play('gameOver');
        this._showGameOverScreen();
      }
      this._renderScene(p);
      this._renderQuestionHUD(p);
      return;
    }

    // State: Session Complete
    if (this.eduState === EDU_STATES.SESSION_COMPLETE) {
      this.input.restoreCursor();
      this._renderScene(p);
      this._renderQuestionHUD(p);
      return;
    }

    // State: Paused
    if (this.state.isPaused()) {
      this.input.restoreCursor();
      this._showPauseModal();
      this._renderScene(p);
      this._renderQuestionHUD(p);
      return;
    }

    this._hidePauseModal();
    if (this.input.controlMode === 'gesture') {
      this.input.hideCursor();
    }
    this.input.setMouseEnabled(false);

    // Horizontal movement: Keyboard input (clamped strictly to playable paddle center boundaries)
    const delta = this.input.getMovementDelta();
    if (delta !== 0) {
      const speed = 10;
      const halfW = this.paddle ? this.paddle.w / 2 : 50;
      const minCenter = halfW;
      const maxCenter = Math.max(minCenter, p.width - halfW);
      this.input.currentX = Math.max(minCenter, Math.min(maxCenter, this.input.currentX + delta * speed));
    }

    // Update paddle
    if (this.paddle) {
      this.paddle.update(this.input, p.width, p.height);
    }

    // -- Educational State Machine --

    if (this.eduState === EDU_STATES.SHOWING_QUESTION) {
      this.questionShowTimer--;
      if (this.questionShowTimer <= 0) {
        this.eduState = EDU_STATES.ANSWERS_FALLING;
        this._prepareAnswerObjects(p.width);
      }
    }

    if (this.eduState === EDU_STATES.ANSWERS_FALLING) {
      // Spawn staggered answer objects
      if (this._answerSpawnQueue.length > 0) {
        this._answerSpawnTimer++;
        const toSpawn = [];
        for (let i = this._answerSpawnQueue.length - 1; i >= 0; i--) {
          this._answerSpawnQueue[i].delay--;
          if (this._answerSpawnQueue[i].delay <= 0) {
            toSpawn.push(this._answerSpawnQueue[i].config);
            this._answerSpawnQueue.splice(i, 1);
          }
        }
        for (const cfg of toSpawn) {
          const obj = new FallingObject(cfg);
          obj._answerIndex = cfg._answerIndex;
          obj._isCorrect = cfg._isCorrect;
          obj._answerText = cfg._answerText;
          this.answerObjects.push(obj);
        }
      }

      // Update answer objects + check collisions
      for (let i = this.answerObjects.length - 1; i >= 0; i--) {
        const obj = this.answerObjects[i];
        obj.update();

        if (obj.isOffscreen(p.height)) {
          this.answerObjects.splice(i, 1);
          continue;
        }

        // Check paddle collision (only if question not yet resolved and game not over)
        if (!this.questionResolved && !this.state.isGameOver() && this.paddle && this.collision.checkCollision(this.paddle, obj)) {
          obj.handled = true;
          this._resolveAnswer(obj);
          break;
        }
      }

      // Check if all answer objects have fallen offscreen without being caught
      if (this.answerObjects.length === 0 && this._answerSpawnQueue.length === 0 && !this.questionResolved && !this.state.isGameOver()) {
        this._resolveMissed();
      }
    }

    if (this.eduState === EDU_STATES.FEEDBACK) {
      this.feedbackTimer--;

      if (this.feedbackTimer <= 0) {
        this.currentQuestionIndex++;
        this._startQuestion();
      }
    }

    // -- Render --
    this._renderScene(p);
    this._renderQuestionHUD(p);
  }

  /**
   * Resolves player catching an answer badge.
   * Guarantees single resolution per question.
   * @param {object} answerObj
   */
  _resolveAnswer(answerObj) {
    if (this.questionResolved || this.state.isGameOver()) return;
    this.questionResolved = true;
    this.totalAnswered++;

    const scoring = this.currentScoring || this.scoringManager.getScoringForQuestion(this.currentQuestionIndex);

    if (answerObj._isCorrect) {
      this.totalCorrect++;
      this.answeredCorrectly = true;
      this.state.addScore(scoring.correct);
      // No life lost
      this.feedbackText = 'CORRECT! +' + scoring.correct + '  (0 LIVES LOST)';
      this.feedbackDetail = '';
      this.feedbackColor = [0, 255, 120];
      this.audio.play('paddle');
    } else {
      this.totalWrong++;
      this.answeredCorrectly = false;
      this.state.addScore(scoring.wrong); // negative penalty, floors at 0
      this.state.modifyLives(-1); // Exactly one life deducted

      const correctAns = this.currentQuestion.options[this.currentQuestion.correctIndex];
      this.feedbackText = 'WRONG! ' + scoring.wrong + '  (-1 LIFE)';
      this.feedbackDetail = 'Correct Answer: ' + correctAns;
      this.feedbackColor = [255, 60, 60];
      this.audio.play('losePoints');
    }

    // Check game over immediately
    if (this.state.isGameOver()) {
      this.answerObjects = [];
      this._answerSpawnQueue = [];
      this.eduState = EDU_STATES.GAME_OVER;
      this.state.gameOverHandled = true;
      this.audio.play('gameOver');
      this._showGameOverScreen();
      return;
    }

    this.eduState = EDU_STATES.FEEDBACK;
    this.feedbackTimer = 90; // ~1.5 seconds feedback

    // Clear remaining answer objects from play
    this.answerObjects = [];
    this._answerSpawnQueue = [];
  }

  /**
   * Resolves missed answer (all options fell past paddle).
   * Guarantees single resolution per question.
   */
  _resolveMissed() {
    if (this.questionResolved || this.state.isGameOver()) return;
    this.questionResolved = true;
    this.totalAnswered++;
    this.totalMissed++;
    this.answeredCorrectly = false;

    const scoring = this.currentScoring || this.scoringManager.getScoringForQuestion(this.currentQuestionIndex);

    this.state.addScore(scoring.missed); // larger negative penalty, floors at 0
    this.state.modifyLives(-1); // Exactly one life deducted

    const correctAns = this.currentQuestion.options[this.currentQuestion.correctIndex];
    this.feedbackText = 'MISSED! ' + scoring.missed + '  (-1 LIFE)';
    this.feedbackDetail = 'Correct Answer: ' + correctAns;
    this.feedbackColor = [255, 180, 0];
    this.audio.play('losePoints');

    // Check game over immediately
    if (this.state.isGameOver()) {
      this.answerObjects = [];
      this._answerSpawnQueue = [];
      this.eduState = EDU_STATES.GAME_OVER;
      this.state.gameOverHandled = true;
      this.audio.play('gameOver');
      this._showGameOverScreen();
      return;
    }

    this.eduState = EDU_STATES.FEEDBACK;
    this.feedbackTimer = 90;

    // Clear remaining answer objects
    this.answerObjects = [];
    this._answerSpawnQueue = [];
  }

  _renderScene(p) {
    // Draw answer objects with text labels
    for (const obj of this.answerObjects) {
      this._drawAnswerBadge(p, obj);
    }

    // Draw paddle
    if (this.paddle) {
      this.paddle.display(p);
    }
  }

  _drawAnswerBadge(p, obj) {
    const x = obj.x;
    const y = obj.y;
    const w = obj.w;
    const c = obj.color;

    p.push();

    // Glow effect
    p.drawingContext.shadowBlur = 18;
    p.drawingContext.shadowColor = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.5)';

    // Badge circle
    p.fill(c[0], c[1], c[2], 200);
    p.stroke(c[0], c[1], c[2]);
    p.strokeWeight(2);
    p.ellipse(x, y, w * 2, w * 2);

    // Reset shadow for text
    p.drawingContext.shadowBlur = 0;

    // Answer text inside badge
    p.fill(255);
    p.noStroke();
    p.textAlign(p.CENTER, p.CENTER);

    // Determine text size based on text length
    const text = obj._answerText || '';
    let textSize = 11;
    if (text.length > 20) textSize = 8;
    else if (text.length > 12) textSize = 9;
    else if (text.length > 8) textSize = 10;

    p.textSize(textSize);
    p.textFont('Poppins');
    p.textStyle(p.BOLD);

    // Word wrap for long text
    const maxWidth = w * 1.7;
    const words = text.split(' ');
    let lines = [];
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      if (p.textWidth(testLine) > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    const lineHeight = textSize + 2;
    const startY = y - ((lines.length - 1) * lineHeight) / 2;
    for (let li = 0; li < lines.length; li++) {
      p.text(lines[li], x, startY + li * lineHeight);
    }

    p.pop();
  }

  _renderQuestionHUD(p) {
    p.push();
    p.textFont('Press Start 2P');
    p.noStroke();

    // Score & Lives (top-left)
    p.fill(255);
    p.textSize(16);
    p.textAlign(p.LEFT);
    p.text('Score: ' + this.state.score, 24, 34);

    // Render lives in red or green
    if (this.state.lives > 1) {
      p.fill(0, 255, 120);
    } else {
      p.fill(255, 60, 60);
    }
    p.text('Lives: ' + this.state.lives, 24, 60);

    // Category badge (top-center)
    p.textSize(10);
    p.fill(157, 78, 221);
    p.textAlign(p.CENTER);
    p.text('EDU: ' + this.categoryName.toUpperCase(), p.width / 2, 28);

    // Progressive stakes display for active question
    if (this.currentScoring && this.eduState !== EDU_STATES.SESSION_COMPLETE && !this.state.isGameOver()) {
      p.fill(160, 200, 255);
      p.textSize(8);
      p.textFont('Poppins');
      p.textStyle(p.NORMAL);
      const stakes = 'Correct +' + this.currentScoring.correct + '  |  Wrong ' + this.currentScoring.wrong + ' (-1 Life)  |  Miss ' + this.currentScoring.missed + ' (-1 Life)';
      p.text(stakes, p.width / 2, 46);
    }

    // Question counter (top-right)
    p.textFont('Press Start 2P');
    p.fill(0, 240, 255);
    p.textSize(10);
    p.textAlign(p.RIGHT);
    const qNum = Math.min(this.currentQuestionIndex + 1, this.questions.length);
    p.text('Q' + qNum + '/' + this.questions.length, p.width - 24, 34);

    // Question text panel (top area)
    if (this.currentQuestion && this.eduState !== EDU_STATES.SESSION_COMPLETE && !this.state.isGameOver()) {
      p.fill(10, 15, 30, 200);
      p.stroke(0, 240, 255, 80);
      p.strokeWeight(1);
      const panelY = 80;
      const panelH = 60;
      p.rect(40, panelY, p.width - 80, panelH, 8);

      // Question text
      p.noStroke();
      p.fill(255);
      p.textAlign(p.CENTER, p.CENTER);
      p.textFont('Poppins');
      p.textSize(16);
      p.textStyle(p.BOLD);
      p.text(this.currentQuestion.questionText, p.width / 2, panelY + panelH / 2);
    }

    // "Get Ready..." text during question show phase
    if (this.eduState === EDU_STATES.SHOWING_QUESTION) {
      p.fill(0, 240, 255, 180);
      p.textFont('Orbitron');
      p.textSize(14);
      p.textAlign(p.CENTER);
      p.text('CATCH THE CORRECT ANSWER!', p.width / 2, 170);
    }

    // Feedback text rendering
    if (this.eduState === EDU_STATES.FEEDBACK) {
      const alpha = Math.min(255, this.feedbackTimer * 4);
      p.fill(this.feedbackColor[0], this.feedbackColor[1], this.feedbackColor[2], alpha);
      p.textFont('Orbitron');
      p.textSize(20);
      p.textAlign(p.CENTER);
      p.text(this.feedbackText, p.width / 2, p.height / 2 - 20);

      if (this.feedbackDetail) {
        p.fill(255, 255, 255, alpha);
        p.textFont('Poppins');
        p.textSize(15);
        p.textStyle(p.BOLD);
        p.text(this.feedbackDetail, p.width / 2, p.height / 2 + 15);
      }
    }

    p.pop();
  }

  // -- Results Screen --

  _showResultsScreen() {
    const modal = document.getElementById('edu-results-modal');
    if (!modal) return;

    const accuracy = this.totalAnswered > 0
      ? Math.round((this.totalCorrect / this.totalAnswered) * 100)
      : 0;

    const scoreEl = document.getElementById('edu-final-score');
    const answeredEl = document.getElementById('edu-total-answered');
    const correctEl = document.getElementById('edu-total-correct');
    const wrongEl = document.getElementById('edu-total-wrong');
    const missedEl = document.getElementById('edu-total-missed');
    const accuracyEl = document.getElementById('edu-accuracy');

    if (scoreEl) scoreEl.textContent = String(this.state.score);
    if (answeredEl) answeredEl.textContent = String(this.totalAnswered);
    if (correctEl) correctEl.textContent = String(this.totalCorrect);
    if (wrongEl) wrongEl.textContent = String(this.totalWrong);
    if (missedEl) missedEl.textContent = String(this.totalMissed);
    if (accuracyEl) accuracyEl.textContent = accuracy + '%';

    modal.classList.add('active');
  }

  _showGameOverScreen() {
    const modal = document.getElementById('edu-gameover-modal');
    if (!modal) return;

    const accuracy = this.totalAnswered > 0
      ? Math.round((this.totalCorrect / this.totalAnswered) * 100)
      : 0;

    const scoreEl = document.getElementById('edu-go-score');
    const answeredEl = document.getElementById('edu-go-answered');
    const correctEl = document.getElementById('edu-go-correct');
    const wrongEl = document.getElementById('edu-go-wrong');
    const missedEl = document.getElementById('edu-go-missed');
    const accuracyEl = document.getElementById('edu-go-accuracy');

    if (scoreEl) scoreEl.textContent = String(this.state.score);
    if (answeredEl) answeredEl.textContent = String(this.totalAnswered);
    if (correctEl) correctEl.textContent = String(this.totalCorrect);
    if (wrongEl) wrongEl.textContent = String(this.totalWrong);
    if (missedEl) missedEl.textContent = String(this.totalMissed);
    if (accuracyEl) accuracyEl.textContent = accuracy + '%';

    modal.classList.add('active');
  }

  _showPauseModal() {
    const modal = document.getElementById('edu-pause-modal');
    if (modal) modal.classList.add('active');
  }

  _hidePauseModal() {
    const modal = document.getElementById('edu-pause-modal');
    if (modal) modal.classList.remove('active');
  }

  // -- Controls --

  pause() {
    this.state.pause();
    this.input.restoreCursor();
    this._showPauseModal();
  }

  resume() {
    this.state.resume();
    if (this.input.controlMode === 'gesture') {
      this.input.hideCursor();
    }
    this._hidePauseModal();
  }

  togglePause() {
    if (this.state.isGameOver() || this.eduState === EDU_STATES.SESSION_COMPLETE) return;

    // Debounce to prevent synthetic or bubbling double-triggers
    const now = Date.now();
    if (this._lastPauseToggleTime && (now - this._lastPauseToggleTime < 250)) {
      return;
    }
    this._lastPauseToggleTime = now;

    if (this.state.isPlaying()) {
      this.pause();
    } else {
      this.resume();
    }
  }

  restart() {
    this.state.reset();
    this.scoringManager.reset();
    this.currentScoring = null;
    this.answerObjects = [];
    this._answerSpawnQueue = [];
    this.totalAnswered = 0;
    this.totalCorrect = 0;
    this.totalWrong = 0;
    this.totalMissed = 0;
    this.feedbackText = '';
    this.feedbackDetail = '';
    this.feedbackTimer = 0;

    // Hide all modals
    ['edu-pause-modal', 'edu-gameover-modal', 'edu-results-modal'].forEach(function(id) {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });

    if (this.input.controlMode === 'gesture') {
      this.input.hideCursor();
    }
    this._loadFirstQuestion();
  }

  exit() {
    if (this.gesture) {
      this.gesture.stop();
    }
    this.input.restoreCursor();
    window.location.href = 'educational-categories.html';
  }

  /**
   * Returns session statistics for testing
   */
  getSessionStats() {
    return {
      score: this.state.score,
      lives: this.state.lives,
      totalAnswered: this.totalAnswered,
      totalCorrect: this.totalCorrect,
      totalWrong: this.totalWrong,
      totalMissed: this.totalMissed,
      accuracy: this.totalAnswered > 0 ? Math.round((this.totalCorrect / this.totalAnswered) * 100) : 0,
      currentQuestionIndex: this.currentQuestionIndex,
      currentScoring: this.currentScoring,
      eduState: this.eduState,
      isGameOver: this.state.isGameOver(),
      isPaused: this.state.isPaused()
    };
  }
}

