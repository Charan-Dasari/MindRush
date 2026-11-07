/**
 * MindRush — Audio Manager
 * Manages game sound effects and prevents duplicate play or browser autoplay exceptions
 */

export class AudioManager {
  constructor() {
    this.soundPaths = {
      paddle: 'assets/audio/marimba-bloop-2-188149.mp3',
      redBall: 'assets/audio/redball.mp3',
      goldenBall: 'assets/audio/level-up1.mp3',
      gameOver: 'assets/audio/Game-over.mp3',
      levelUp: 'assets/audio/level-up2.mp3',
      losePoints: 'assets/audio/roblox-death-sound-effect.mp3',
      lifePlus: 'assets/audio/level-up2.mp3',
      start: 'assets/audio/marimba-bloop-2-188149.mp3'
    };

    this.sounds = {};
    this.muted = false;
    this._initSounds();
  }

  _initSounds() {
    if (typeof Audio === 'undefined') return;
    for (const [key, path] of Object.entries(this.soundPaths)) {
      try {
        const audio = new Audio(path);
        audio.preload = 'auto';
        this.sounds[key] = audio;
      } catch (err) {
        console.warn(`[AudioManager] Failed to load sound: ${key}`, err);
      }
    }
  }

  /**
   * Plays a sound effect by name
   * @param {string} key
   */
  play(key) {
    if (this.muted) return;
    const sound = this.sounds[key];
    if (!sound) return;

    try {
      sound.currentTime = 0;
      const playPromise = sound.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          // Suppress browser autoplay policy warnings gracefully
          console.debug(`[AudioManager] Auto-play restriction for ${key}:`, err.message);
        });
      }
    } catch (err) {
      console.warn(`[AudioManager] Error playing sound ${key}:`, err);
    }
  }

  /**
   * Stops a sound effect by name
   * @param {string} key
   */
  stop(key) {
    const sound = this.sounds[key];
    if (sound) {
      try {
        sound.pause();
        sound.currentTime = 0;
      } catch (e) {
        // Ignore
      }
    }
  }

  /**
   * Sets mute status
   * @param {boolean} isMuted
   */
  setMuted(isMuted) {
    this.muted = !!isMuted;
    if (this.muted) {
      for (const audio of Object.values(this.sounds)) {
        try {
          audio.pause();
        } catch (e) {}
      }
    }
  }
}
