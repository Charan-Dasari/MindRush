/**
 * MindRush — Game Settings Manager
 * Centralized settings persistence for Control Method (Gesture vs Keyboard), SFX, Music, and Volume.
 */

export const DEFAULT_SETTINGS = {
  controlMethod: 'gesture', // 'gesture' | 'keyboard'
  sfx: true,
  music: true,
  volume: 80
};

const STORAGE_KEY = 'mindrush_game_settings';

/**
 * Retrieves the current game settings merged with defaults
 * @returns {object}
 */
export function getGameSettings() {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    }
  } catch (e) {
    console.warn('[Settings] Failed to read game settings:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

/**
 * Saves and persists updated game settings
 * @param {object} partialSettings
 * @returns {object}
 */
export function saveGameSettings(partialSettings) {
  try {
    const current = getGameSettings();
    const updated = { ...current, ...partialSettings };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
    return updated;
  } catch (e) {
    console.warn('[Settings] Failed to save game settings:', e);
    return { ...DEFAULT_SETTINGS, ...partialSettings };
  }
}

/**
 * Updates the HUD mode indicator immediately and reliably
 * @param {'gesture'|'keyboard'} mode
 */
export function updateModeIndicator(mode) {
  if (typeof document === 'undefined') return;
  const sensorLabel = document.querySelector('#hud-sensor-feedback .sensor-label');
  const sensorDot = document.querySelector('#hud-sensor-feedback .sensor-pulse-dot');
  if (mode === 'keyboard') {
    if (sensorLabel) {
      sensorLabel.textContent = 'KEYBOARD ACTIVE';
    }
    if (sensorDot) {
      sensorDot.className = 'sensor-pulse-dot';
    }
  } else if (mode === 'gesture') {
    if (sensorLabel) {
      sensorLabel.textContent = 'GESTURE ACTIVE';
    }
    if (sensorDot) {
      sensorDot.className = 'sensor-pulse-dot active';
    }
  }
}

/**
 * Applies game settings to an active engine without resetting game state
 * @param {object} settings
 * @param {object} engine
 */
export function applyGameSettings(settings, engine) {
  if (!settings || !engine) return;

  // 1. Audio adjustments
  if (engine.audio) {
    if (typeof engine.audio.setMuted === 'function') {
      engine.audio.setMuted(!settings.sfx);
    }
    if (typeof engine.audio.setVolume === 'function') {
      engine.audio.setVolume((settings.volume || 80) / 100);
    }
  }

  // 2. Control Method application
  const gestureInst = engine.gestureInput || engine.gesture;
  const inputInst = engine.input;
  const previewContainer = typeof document !== 'undefined' ? document.getElementById('camera-preview-container') : null;

  if (settings.controlMethod === 'keyboard') {
    // Safe keyboard mode: disable gesture tracking
    if (inputInst && typeof inputInst.setControlMode === 'function') {
      inputInst.setControlMode('keyboard');
    }
    if (gestureInst && typeof gestureInst.switchToKeyboard === 'function') {
      gestureInst.switchToKeyboard();
    }
    if (previewContainer) {
      previewContainer.classList.add('hidden');
    }
    updateModeIndicator('keyboard');
  } else if (settings.controlMethod === 'gesture') {
    // Gesture mode: switch input and immediately reflect GESTURE ACTIVE in HUD
    if (inputInst && typeof inputInst.setControlMode === 'function') {
      inputInst.setControlMode('gesture');
    }
    updateModeIndicator('gesture');

    if (gestureInst) {
      if (!gestureInst.isActive && typeof gestureInst.retryGesture === 'function') {
        gestureInst.retryGesture().then(() => {
          updateModeIndicator('gesture');
          if (previewContainer && gestureInst.isActive) {
            previewContainer.classList.remove('hidden');
          }
        }).catch((err) => {
          console.warn('[Settings] Gesture activation fallback to keyboard:', err.message || err);
          if (inputInst && typeof inputInst.setControlMode === 'function') {
            inputInst.setControlMode('keyboard');
          }
          const sensorLabel = typeof document !== 'undefined' ? document.querySelector('#hud-sensor-feedback .sensor-label') : null;
          const sensorDot = typeof document !== 'undefined' ? document.querySelector('#hud-sensor-feedback .sensor-pulse-dot') : null;
          if (sensorLabel) {
            sensorLabel.textContent = 'KEYBOARD ACTIVE (CAMERA ERROR)';
          }
          if (sensorDot) {
            sensorDot.className = 'sensor-pulse-dot';
          }
        });
      } else if (typeof gestureInst.switchToGesture === 'function') {
        gestureInst.switchToGesture().then(() => {
          updateModeIndicator('gesture');
          if (previewContainer && gestureInst.isActive) {
            previewContainer.classList.remove('hidden');
          }
        });
      }
    }

    if (previewContainer && gestureInst && gestureInst.isActive) {
      previewContainer.classList.remove('hidden');
    }
  }
}
