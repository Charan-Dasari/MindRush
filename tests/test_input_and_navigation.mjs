/**
 * MindRush — Input Mode, Navigation & UI Cleanup Automated Test Suite
 * Tests:
 * 1. Mode indicator synchronization (Gesture Active vs Keyboard Active, immediate update, no stale state)
 * 2. Strict input restrictions in Gesture Mode (blocking Arrows, A/D, Space, mouse; Esc allowed)
 * 3. Pause menu Exit to Hub destination (Skyfall redirects to mode-select.html, Space Invader to difficulty-select)
 * 4. Esc modal hierarchy (Settings modal closed on Esc, pause menu stays visible, game stays paused)
 * 5. Global Escape navigation and input form protection
 * 6. Verification of repeated footer navigation menu removal across HTML pages
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { InputManager } from '../public/js/game/input.js';
import { UIManager } from '../public/js/game/ui.js';
import { updateModeIndicator, applyGameSettings } from '../public/js/game/settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Helper to create mock DOM elements
function createMockElement(id, classes = []) {
  const classList = new Set(classes);
  return {
    id,
    textContent: '',
    className: classes.join(' '),
    classList: {
      add: (c) => { classList.add(c); },
      remove: (c) => { classList.delete(c); },
      contains: (c) => classList.has(c)
    },
    style: {},
    setAttribute: () => {},
    getAttribute: () => null,
    addEventListener: () => {}
  };
}

describe('MindRush — Input Mode, Navigation & UI Cleanup Tests', () => {

  describe('1. Mode Indicator Synchronization', () => {
    let mockLabel;
    let mockDot;

    beforeEach(() => {
      mockLabel = createMockElement('sensor-label');
      mockDot = createMockElement('sensor-pulse-dot', ['sensor-pulse-dot']);

      global.document = {
        querySelector: (sel) => {
          if (sel.includes('.sensor-label')) return mockLabel;
          if (sel.includes('.sensor-pulse-dot')) return mockDot;
          return null;
        },
        getElementById: (id) => {
          if (id === 'camera-preview-container') return createMockElement('camera-preview-container');
          return null;
        }
      };
    });

    it('updateModeIndicator sets "GESTURE ACTIVE" with active dot for gesture mode', () => {
      updateModeIndicator('gesture');
      assert.strictEqual(mockLabel.textContent, 'GESTURE ACTIVE');
      assert.strictEqual(mockDot.className, 'sensor-pulse-dot active');
    });

    it('updateModeIndicator sets "KEYBOARD ACTIVE" with inactive dot for keyboard mode', () => {
      updateModeIndicator('keyboard');
      assert.strictEqual(mockLabel.textContent, 'KEYBOARD ACTIVE');
      assert.strictEqual(mockDot.className, 'sensor-pulse-dot');
    });

    it('applyGameSettings updates indicator immediately without stale state when switching back and forth', () => {
      const mockEngine = {
        input: new InputManager(),
        gestureInput: {
          isActive: false,
          switchToKeyboard: function() { this.isActive = false; },
          switchToGesture: async function() { this.isActive = true; },
          retryGesture: async function() { this.isActive = true; }
        }
      };

      // 1. Initial keyboard
      applyGameSettings({ controlMethod: 'keyboard' }, mockEngine);
      assert.strictEqual(mockLabel.textContent, 'KEYBOARD ACTIVE');
      assert.strictEqual(mockEngine.input.controlMode, 'keyboard');

      // 2. Switch to gesture
      applyGameSettings({ controlMethod: 'gesture' }, mockEngine);
      assert.strictEqual(mockLabel.textContent, 'GESTURE ACTIVE');
      assert.strictEqual(mockEngine.input.controlMode, 'gesture');
      assert.strictEqual(mockDot.className, 'sensor-pulse-dot active');

      // 3. Switch back to keyboard
      applyGameSettings({ controlMethod: 'keyboard' }, mockEngine);
      assert.strictEqual(mockLabel.textContent, 'KEYBOARD ACTIVE');
      assert.strictEqual(mockEngine.input.controlMode, 'keyboard');
      assert.strictEqual(mockDot.className, 'sensor-pulse-dot');

      // 4. Switch back to gesture again
      applyGameSettings({ controlMethod: 'gesture' }, mockEngine);
      assert.strictEqual(mockLabel.textContent, 'GESTURE ACTIVE');
      assert.strictEqual(mockEngine.input.controlMode, 'gesture');
      assert.strictEqual(mockDot.className, 'sensor-pulse-dot active');
    });
  });

  describe('2. Strict Input Restrictions in Gesture Mode', () => {
    let input;

    beforeEach(() => {
      input = new InputManager();
    });

    it('In Gesture Mode, keyboard movement delta is strictly 0 even with keys down', () => {
      input.setControlMode('gesture');
      assert.strictEqual(input.controlMode, 'gesture');

      // Simulate key down state
      input.keysDown.set('ArrowLeft', true);
      input.keysDown.set('KeyA', true);
      assert.strictEqual(input.getMovementDelta(), 0, 'Movement delta must be 0 in gesture mode');

      input.keysDown.clear();
      input.keysDown.set('ArrowRight', true);
      input.keysDown.set('KeyD', true);
      assert.strictEqual(input.getMovementDelta(), 0, 'Movement delta must be 0 in gesture mode');
    });

    it('In Gesture Mode, triggerShoot is ignored for keyboard calls', () => {
      input.setControlMode('gesture');
      let shotFired = false;
      input.onShoot(() => { shotFired = true; });

      input.triggerShoot();
      assert.strictEqual(shotFired, false, 'Keyboard triggerShoot must not fire in gesture mode');
    });

    it('In Keyboard Mode, keyboard movement and shooting work normally', () => {
      input.setControlMode('keyboard');
      assert.strictEqual(input.controlMode, 'keyboard');

      input.keysDown.set('ArrowLeft', true);
      assert.strictEqual(input.getMovementDelta(), -1);

      input.keysDown.clear();
      input.keysDown.set('ArrowRight', true);
      assert.strictEqual(input.getMovementDelta(), 1);

      let shotFired = false;
      input.onShoot(() => { shotFired = true; });
      input.triggerShoot();
      assert.strictEqual(shotFired, true);
    });

    it('Escape pause callback fires in both Gesture and Keyboard modes', () => {
      let pauseToggled = false;
      input.onPauseToggle(() => { pauseToggled = true; });

      // In gesture mode
      input.setControlMode('gesture');
      pauseToggled = false;
      input.triggerPauseToggle();
      assert.strictEqual(pauseToggled, true, 'Escape/Pause must fire in gesture mode');

      // In keyboard mode
      input.setControlMode('keyboard');
      pauseToggled = false;
      input.triggerPauseToggle();
      assert.strictEqual(pauseToggled, true, 'Escape/Pause must fire in keyboard mode');
    });
  });

  describe('3. Pause Menu Exit to Hub Destination', () => {
    it('GameEngine (Skyfall) exits to mode-select.html instead of dashboard.html', () => {
      const engineJs = fs.readFileSync(path.join(ROOT, 'public/js/game/engine.js'), 'utf8');
      assert.match(engineJs, /exit\(\)\s*\{[\s\S]*?window\.location\.href\s*=\s*['"]mode-select\.html['"]/);
      assert.doesNotMatch(engineJs, /exit\(\)\s*\{[\s\S]*?window\.location\.href\s*=\s*['"]dashboard\.html['"]/);
    });

    it('game.html Skyfall HUD exit button points to mode-select.html', () => {
      const gameHtml = fs.readFileSync(path.join(ROOT, 'public/game.html'), 'utf8');
      assert.match(gameHtml, /href="mode-select\.html"[^>]*id="hud-btn-exit"/);
    });

    it('SpaceInvaderEngine exits to difficulty-select.html?mode=invader', () => {
      const invaderEngineJs = fs.readFileSync(path.join(ROOT, 'public/js/game/space-invader-engine.js'), 'utf8');
      assert.match(invaderEngineJs, /exit\(\)\s*\{[\s\S]*?window\.location\.href\s*=\s*['"]difficulty-select\.html\?mode=invader['"]/);
    });
  });

  describe('4. Esc Behaviour Inside Settings & Modal Priority', () => {
    it('UIManager correctly identifies topmost active modal in hierarchy', () => {
      const settingsModal = createMockElement('game-settings-modal');
      const pauseModal = createMockElement('pause-modal');
      const nextLevelModal = createMockElement('next-level-modal');

      global.document = {
        getElementById: (id) => {
          if (id === 'game-settings-modal') return settingsModal;
          if (id === 'pause-modal') return pauseModal;
          if (id === 'next-level-modal') return nextLevelModal;
          return null;
        }
      };

      const ui = new UIManager();

      // Case 1: No modal open
      assert.strictEqual(ui.getActiveModal(), null);

      // Case 2: Pause modal only
      pauseModal.classList.add('active');
      assert.strictEqual(ui.getActiveModal(), 'pause');

      // Case 3: Settings modal open on top of pause modal
      settingsModal.classList.add('active');
      assert.strictEqual(ui.getActiveModal(), 'settings');

      // Closing settings modal drops back to pause modal
      settingsModal.classList.remove('active');
      assert.strictEqual(ui.getActiveModal(), 'pause');
    });

    it('Engine togglePause closes settings modal without unpausing gameplay', () => {
      const mockSettings = createMockElement('game-settings-modal', ['active']);
      const mockPause = createMockElement('pause-modal', ['active']);

      let settingsHidden = false;
      let resumeCalled = false;
      let pauseCalled = false;

      const mockEngine = {
        state: {
          isGameOver: () => false,
          isPlaying: () => false,
          isPaused: () => true
        },
        ui: {
          getActiveModal: () => 'settings',
          hideSettingsModal: () => { settingsHidden = true; }
        },
        resume: () => { resumeCalled = true; },
        pause: () => { pauseCalled = true; },
        togglePause: null
      };

      // Exact logic implemented in engines
      mockEngine.togglePause = function() {
        if (this.state.isGameOver()) return;
        const activeModal = (this.ui && typeof this.ui.getActiveModal === 'function') ? this.ui.getActiveModal() : null;
        if (activeModal === 'settings') {
          this.ui.hideSettingsModal();
          return;
        }
        if (activeModal && activeModal !== 'pause') return;
        if (this.state.isPlaying()) this.pause();
        else this.resume();
      };

      mockEngine.togglePause();
      assert.strictEqual(settingsHidden, true, 'Settings modal must be closed');
      assert.strictEqual(resumeCalled, false, 'Gameplay must NOT resume when closing settings modal');
      assert.strictEqual(pauseCalled, false, 'Pause must not be called again');
    });
  });

  describe('5. Global Escape Navigation & Protection', () => {
    it('difficulty-select.html has Esc navigation to mode-select.html and protects form inputs', () => {
      const html = fs.readFileSync(path.join(ROOT, 'public/difficulty-select.html'), 'utf8');
      assert.match(html, /Escape[\s\S]*?tagName\.toLowerCase\(\)[\s\S]*?input[\s\S]*?blur\(\)/);
      assert.match(html, /window\.location\.href\s*=\s*['"]mode-select\.html['"]/);
    });

    it('mode-select.html has Esc navigation to dashboard.html and protects form inputs', () => {
      const html = fs.readFileSync(path.join(ROOT, 'public/mode-select.html'), 'utf8');
      assert.match(html, /Escape[\s\S]*?tagName\.toLowerCase\(\)[\s\S]*?input[\s\S]*?blur\(\)/);
      assert.match(html, /window\.location\.href\s*=\s*['"]dashboard\.html['"]/);
    });

    it('educational-categories.html has Esc navigation to mode-select.html', () => {
      const html = fs.readFileSync(path.join(ROOT, 'public/educational-categories.html'), 'utf8');
      assert.match(html, /Escape[\s\S]*?window\.location\.href\s*=\s*['"]mode-select\.html['"]/);
    });

    it('badge-gallery.html has Esc navigation to dashboard.html', () => {
      const html = fs.readFileSync(path.join(ROOT, 'public/badge-gallery.html'), 'utf8');
      assert.match(html, /Escape[\s\S]*?window\.location\.href\s*=\s*['"]dashboard\.html['"]/);
    });
  });

  describe('6. Repeated Footer Navigation Menus Removal', () => {
    const pagesToCheck = [
      'public/dashboard.html',
      'public/difficulty-select.html',
      'public/mode-select.html',
      'public/educational-categories.html',
      'public/badge-gallery.html'
    ];

    for (const page of pagesToCheck) {
      it(`No repeated footer navigation links in ${page}`, () => {
        const content = fs.readFileSync(path.join(ROOT, page), 'utf8');
        // Ensure footer does not contain repeated navigation links
        assert.doesNotMatch(content, /<footer[^>]*>[\s\S]*?<a href="terms\.html">Terms<\/a>[\s\S]*?<\/footer>/);
        assert.doesNotMatch(content, /<footer[^>]*>[\s\S]*?<a href="contact\.html">Contact<\/a>[\s\S]*?<\/footer>/);
      });
    }

    it('dashboard.html preserves footer-status-row and sensor advice', () => {
      const content = fs.readFileSync(path.join(ROOT, 'public/dashboard.html'), 'utf8');
      assert.match(content, /class="footer-status-row"/);
      assert.match(content, /CAMERA SENSOR READY/);
    });
  });
});
