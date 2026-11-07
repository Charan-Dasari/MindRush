/**
 * MindRush — Difficulty Configurations
 * Defines speed, spawn rules, scoring tables, badge pools, and achievements for Easy, Medium, Hard, and Insane
 */

export const PROGRESSION_KEYS = {
  INSANE_UNLOCKED: 'mindrush_insane_unlocked',
  HARD_BEATEN: 'mindrush_hard_beaten'
};

export const EDU_PROGRESSION_KEYS = {
  MEDIUM_UNLOCKED: 'mindrush_edu_unlocked_medium',
  HARD_UNLOCKED: 'mindrush_edu_unlocked_hard',
  INSANE_UNLOCKED: 'mindrush_edu_unlocked_insane'
};

export {
  BADGE_STORAGE_KEY,
  COLLECTIBLE_BADGES,
  getUnlockedBadges,
  isBadgeUnlocked,
  unlockBadge,
  getUnlockedBadgeCount,
  getTotalBadgeCount,
  resetBadgeCollection,
  isCollectibleBadge,
  resolveBadgeId
} from './badges.js';

import { getScopedStorageKey } from './storage.js';

const _memoryStorage = {};
let _activeProgressionUserId = null;

export function setProgressionUserContext(userId) {
  _activeProgressionUserId = userId ? String(userId) : null;
}

export function clearProgressionUserContext() {
  _activeProgressionUserId = null;
  for (const k in _memoryStorage) {
    delete _memoryStorage[k];
  }
}

export function getProgressionKey(baseKey) {
  return getScopedStorageKey(baseKey, _activeProgressionUserId);
}

/**
 * Checks if Insane difficulty has been unlocked by beating Hard mode
 * @returns {boolean}
 */
export function isInsaneUnlocked() {
  const key = getProgressionKey(PROGRESSION_KEYS.INSANE_UNLOCKED);
  try {
    if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem(key);
      if (val !== null) {
        return val === 'true';
      }
      return false;
    }
    return _memoryStorage[key] === 'true';
  } catch (e) {
    return false;
  }
}

/**
 * Persists unlock status for Insane difficulty upon conquering Hard mode
 * @returns {boolean}
 */
export function unlockInsane() {
  const keyInsane = getProgressionKey(PROGRESSION_KEYS.INSANE_UNLOCKED);
  const keyHard = getProgressionKey(PROGRESSION_KEYS.HARD_BEATEN);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(keyInsane, 'true');
      localStorage.setItem(keyHard, 'true');
    }
    _memoryStorage[keyInsane] = 'true';
    _memoryStorage[keyHard] = 'true';
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Resets unlock progression back to initial locked state (for testing or profile resets)
 * @returns {boolean}
 */
export function resetProgression() {
  const keyInsane = getProgressionKey(PROGRESSION_KEYS.INSANE_UNLOCKED);
  const keyHard = getProgressionKey(PROGRESSION_KEYS.HARD_BEATEN);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(keyInsane);
      localStorage.removeItem(keyHard);
      localStorage.removeItem(PROGRESSION_KEYS.INSANE_UNLOCKED);
      localStorage.removeItem(PROGRESSION_KEYS.HARD_BEATEN);
    }
    delete _memoryStorage[keyInsane];
    delete _memoryStorage[keyHard];
    delete _memoryStorage[PROGRESSION_KEYS.INSANE_UNLOCKED];
    delete _memoryStorage[PROGRESSION_KEYS.HARD_BEATEN];
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Checks if an Educational Mode difficulty tier is unlocked
 * Easy is always unlocked.
 * Medium requires beating Easy (>= 4/5 questions).
 * Hard requires beating Medium (>= 4/5 questions).
 * Insane requires beating Hard (>= 4/5 questions).
 * @param {string} diffKey
 * @returns {boolean}
 */
export function isEduDifficultyUnlocked(diffKey) {
  const diff = String(diffKey || '').toLowerCase();
  if (diff === 'easy' || diff === '') return true;
  let baseKey;
  if (diff === 'medium') baseKey = EDU_PROGRESSION_KEYS.MEDIUM_UNLOCKED;
  else if (diff === 'hard') baseKey = EDU_PROGRESSION_KEYS.HARD_UNLOCKED;
  else if (diff === 'insane') baseKey = EDU_PROGRESSION_KEYS.INSANE_UNLOCKED;
  else return false;

  const key = getProgressionKey(baseKey);
  try {
    if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem(key);
      if (val !== null) {
        return val === 'true';
      }
      return false;
    }
    return _memoryStorage[key] === 'true';
  } catch (e) {
    return false;
  }
}

/**
 * Unlocks an Educational Mode difficulty tier
 * @param {string} diffKey - 'medium', 'hard', or 'insane'
 * @returns {boolean}
 */
export function unlockEduDifficulty(diffKey) {
  const diff = String(diffKey || '').toLowerCase();
  let baseKey;
  if (diff === 'medium') baseKey = EDU_PROGRESSION_KEYS.MEDIUM_UNLOCKED;
  else if (diff === 'hard') baseKey = EDU_PROGRESSION_KEYS.HARD_UNLOCKED;
  else if (diff === 'insane') baseKey = EDU_PROGRESSION_KEYS.INSANE_UNLOCKED;
  else return false;

  const key = getProgressionKey(baseKey);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, 'true');
    }
    _memoryStorage[key] = 'true';
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Resets Educational Mode unlock progression back to initial locked state
 * @returns {boolean}
 */
export function resetEduProgression() {
  const keys = [
    EDU_PROGRESSION_KEYS.MEDIUM_UNLOCKED,
    EDU_PROGRESSION_KEYS.HARD_UNLOCKED,
    EDU_PROGRESSION_KEYS.INSANE_UNLOCKED
  ];
  try {
    for (const baseKey of keys) {
      const key = getProgressionKey(baseKey);
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
        localStorage.removeItem(baseKey);
      }
      delete _memoryStorage[key];
      delete _memoryStorage[baseKey];
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Checks if a completed Educational level unlocks the next difficulty tier
 * Completing 5 questions with >= 4 correct unlocks the next tier.
 * @param {string} currentTier - current difficulty ('easy', 'medium', 'hard')
 * @param {number} correctAnswers - count of correct answers in the level
 * @param {number} totalQuestions - level total (default 5)
 * @returns {string|null} newly unlocked tier name or null
 */
export function checkEduUnlockEligibility(currentTier, correctAnswers, totalQuestions = 5) {
  const tier = String(currentTier || '').toLowerCase();
  if (correctAnswers >= 4) {
    if (tier === 'easy') {
      unlockEduDifficulty('medium');
      return 'medium';
    } else if (tier === 'medium') {
      unlockEduDifficulty('hard');
      return 'hard';
    } else if (tier === 'hard') {
      unlockEduDifficulty('insane');
      return 'insane';
    }
  }
  return null;
}

/**
 * Educational Invader Difficulty Configurations
 * Defines lives, question timer, speeds, hostile attacks, and bosses for Std. 1 Maths
 */
export const EDU_INVADER_CONFIGS = {
  easy: {
    id: 'easy',
    name: 'Easy',
    lives: 3,
    timer: 30, // seconds per question
    ufoSpeed: 1.5,
    ufoCount: 4,
    hasHostileFire: false,
    attackInterval: 0,
    hasBoss: false,
    scoreMultiplier: 1,
    pointsPerCorrect: 100,
    lifePenaltyWrong: 1,
    questionsPerLevel: 5
  },
  medium: {
    id: 'medium',
    name: 'Medium',
    lives: 3,
    timer: 25, // seconds per question
    ufoSpeed: 2.0,
    ufoCount: 4,
    hasHostileFire: true,
    attackInterval: 120, // frames (~2s)
    hasBoss: false,
    scoreMultiplier: 1.5,
    pointsPerCorrect: 150,
    lifePenaltyWrong: 1,
    questionsPerLevel: 5
  },
  hard: {
    id: 'hard',
    name: 'Hard',
    lives: 2,
    timer: 20, // seconds per question
    ufoSpeed: 2.5,
    ufoCount: 4,
    hasHostileFire: true,
    attackInterval: 90, // frames (~1.5s)
    hasBoss: true,
    bossType: 'glider',
    bossHp: 12,
    bossAttackInterval: 120,
    bossTimerBonus: 30, // +30s added to question timer upon defeat
    bossRespawnDelay: 300, // 5 seconds (60fps * 5)
    scoreMultiplier: 2,
    pointsPerCorrect: 200,
    lifePenaltyWrong: 1,
    questionsPerLevel: 5
  },
  insane: {
    id: 'insane',
    name: 'Insane',
    lives: 1,
    timer: 15, // seconds per question
    ufoSpeed: 3.0,
    ufoCount: 4,
    hasHostileFire: true,
    attackInterval: 60, // frames (~1s)
    hasBoss: true,
    bossType: 'kraken',
    bossHp: 20,
    bossAttackInterval: 90,
    bossTimerBonus: 30, // +30s added to question timer upon defeat
    bossRespawnDelay: 300, // 5 seconds
    scoreMultiplier: 3,
    pointsPerCorrect: 300,
    lifePenaltyWrong: 1,
    questionsPerLevel: 5
  }
};

export function getEduInvaderConfig(tier) {
  const key = String(tier || 'easy').toLowerCase();
  return EDU_INVADER_CONFIGS[key] || EDU_INVADER_CONFIGS.easy;
}

export const NEGATIVE_OBJECTS = {
  regular_red_ball: {
    id: 'regular_red_ball',
    shape: 'regular_red_ball',
    color: [255, 30, 40],
    points: 0,
    lifeDelta: -1,
    sound: 'redBall',
    w: 18,
    description: 'Hazardous Red Orb (-1 Life)'
  },
  spiky_red_ball: {
    id: 'spiky_red_ball',
    shape: 'spiky_red_ball',
    color: [255, 0, 0],
    points: 0,
    lifeDelta: -1,
    sound: 'redBall',
    w: 18,
    description: 'Spiky Hazard Bomb (-1 Life)'
  },
  orange_flame: {
    id: 'orange_flame',
    shape: 'orange_flame',
    color: [255, 120, 0],
    points: 0,
    lifeDelta: -1,
    sound: 'redBall',
    w: 20,
    description: 'Orange Flame Hazard (-1 Life)'
  },
  hazard_cross: {
    id: 'hazard_cross',
    shape: 'hazard_cross',
    color: [255, 60, 20],
    points: 0,
    lifeDelta: -3,
    sound: 'redBall',
    w: 22,
    description: 'Severe Hazard Cross (-3 Lives)'
  }
};

export function isNegativeObject(obj) {
  if (!obj) return false;
  const id = obj.id || obj.shape;
  return id === 'regular_red_ball' ||
         id === 'spiky_red_ball' ||
         id === 'red_ball' ||
         id === 'orange_flame' ||
         id === 'flame' ||
         id === 'hazard_cross' ||
         id === 'cross' ||
         (typeof obj.lifeDelta === 'number' && obj.lifeDelta < 0);
}

export const NEW_BADGES = {
  blue_spiral_shell: {
    id: 'blue_spiral_shell',
    shape: 'blue_spiral_shell',
    color: [0, 190, 255],
    points: 25,
    lifeDelta: 0,
    sound: 'paddle',
    w: 20,
    description: 'Blue Spiral Shell Badge (+25 Pts)'
  },
  pink_heart_diamond: {
    id: 'pink_heart_diamond',
    shape: 'pink_heart_diamond',
    color: [255, 50, 150],
    points: 0,
    lifeDelta: 1,
    sound: 'lifePlus',
    w: 22,
    description: 'Pink Heart-Diamond (+1 Life)'
  },
  crescent_moon: {
    id: 'crescent_moon',
    shape: 'crescent_moon',
    color: [220, 40, 160],
    points: 20,
    lifeDelta: 0,
    sound: 'paddle',
    w: 20,
    description: 'Crescent Moon Badge (+20 Pts)'
  },
  bronze_star: {
    id: 'bronze_star',
    shape: 'bronze_star',
    color: [215, 140, 45],
    points: 50,
    lifeDelta: 0,
    sound: 'paddle',
    w: 22,
    description: 'Bronze Eight-Pointed Star (+50 Pts)'
  },
  purple_shuriken: {
    id: 'purple_shuriken',
    shape: 'purple_shuriken',
    color: [160, 40, 220],
    points: -20,
    lifeDelta: 0,
    sound: 'losePoints',
    w: 22,
    description: 'Purple Shuriken Emblem (-20 Pts)'
  }
};

export const DIFFICULTIES = {
  easy: {
    id: 'easy',
    name: 'Easy',
    ballSpeed: 3,
    spawnRate: 45,
    spawnJitter: 12, // ±12 frame randomness on spawn timing
    maxBalls: 15,
    paddle: {
      width: 100,
      height: 10,
      yOffset: 20
    },
    // Heart rule: 1UP heart does not spawn in Easy
    heartConfig: null,
    // Badge-inspired Easy pool: original MindRush designs
    shapes: [
      {
        id: 'regular_red_ball',
        shape: 'regular_red_ball',
        color: [255, 30, 40],
        points: 0,
        lifeDelta: -1,
        sound: 'redBall',
        w: 16,
        description: 'Hazardous Red Orb (-1 Life)'
      },
      {
        id: 'silver_hexagon',
        shape: 'silver_hexagon',
        color: [200, 200, 210],
        points: 10,
        lifeDelta: 0,
        sound: 'paddle',
        w: 16,
        description: 'Silver Hexagon Badge (+10 Pts)'
      },
      {
        id: 'water_droplet',
        shape: 'water_droplet',
        color: [0, 175, 255],
        points: 10,
        lifeDelta: 0,
        sound: 'paddle',
        w: 16,
        description: 'Water Droplet Badge (+10 Pts)'
      },
      {
        id: 'golden_sunburst',
        shape: 'golden_sunburst',
        color: [255, 200, 0],
        points: 20,
        lifeDelta: 0,
        sound: 'paddle',
        w: 17,
        description: 'Golden Sunburst Badge (+20 Pts)'
      },
      {
        id: 'green_crystal',
        shape: 'green_crystal',
        color: [0, 220, 80],
        points: 20,
        lifeDelta: 0,
        sound: 'paddle',
        w: 17,
        description: 'Green Crystal Leaf (+20 Pts)'
      }
    ],
    // Special star spawns once at score >= 250
    specialStar: {
      threshold: 250,
      object: {
        id: 'golden_star',
        shape: 'star',
        color: [255, 255, 0],
        points: 100,
        lifeDelta: 0,
        sound: 'goldenBall',
        w: 25,
        isStar: true,
        description: 'Golden Lucky Star (+100 Pts)'
      }
    },
    nextLevel: {
      threshold: 500,
      target: 'medium',
      message: "Congratulations! You've reached 500 points. Do you want to proceed to Medium difficulty?"
    },
    achievements: {
      onLoad: { id: 'mamma', name: 'Mamma Mia!', desc: 'Welcome to Easy mode!' },
      score500: { id: 'vagrant', name: 'Vagrant!', desc: 'Reached 500 points in Easy mode!' },
      score1000: { id: 'mercenary', name: 'Mercenary!', desc: 'Reached 1000 points in Easy mode!' }
    }
  },

  medium: {
    id: 'medium',
    name: 'Medium',
    ballSpeed: 4,
    spawnRate: 45,
    spawnJitter: 10, // ±10 frame randomness on spawn timing
    maxBalls: 15,
    paddle: {
      width: 100,
      height: 10,
      yOffset: 20
    },
    // 1UP Heart configuration: Maximum 3 spawns per complete game run
    heartConfig: {
      maxSpawns: 3,
      cooldownFrames: 360, // Minimum ~6s spacing between spawns
      spawnChance: 0.12     // 12% probability on spawn tick when ready
    },
    // Pink Heart-Diamond bonus life: Capped at maximum 2 spawns per run in Medium
    pinkDiamondConfig: {
      maxSpawns: 2,
      cooldownFrames: 450, // Minimum ~7.5s spacing between spawns
      spawnChance: 0.10     // 10% probability on spawn tick when ready
    },
    shapes: [
      {
        id: 'water_droplet',
        shape: 'water_droplet',
        color: [0, 175, 255],
        points: 10,
        lifeDelta: 0,
        sound: 'paddle',
        w: 18,
        description: 'Water Droplet Badge (+10 Pts)'
      },
      {
        id: 'green_crystal',
        shape: 'green_crystal',
        color: [0, 220, 80],
        points: 20,
        lifeDelta: 0,
        sound: 'paddle',
        w: 18,
        description: 'Green Crystal Leaf (+20 Pts)'
      },
      {
        id: 'golden_ring',
        shape: 'golden_ring',
        color: [255, 215, 0],
        points: 25,
        lifeDelta: 0,
        sound: 'paddle',
        w: 20,
        description: 'Golden Ring Badge (+25 Pts)'
      },
      {
        id: 'ice_crystal',
        shape: 'ice_crystal',
        color: [80, 230, 255],
        points: 50,
        lifeDelta: 0,
        sound: 'paddle',
        w: 22,
        description: 'Ice Prism Badge (+50 Pts)'
      },
      {
        id: 'purple_spiked_emblem',
        shape: 'purple_spiked_emblem',
        color: [140, 30, 180],
        points: -20,
        lifeDelta: 0,
        sound: 'losePoints',
        w: 20,
        description: 'Purple Spiked Emblem (-20 Pts)'
      },
      {
        id: 'blue_spiral_shell',
        shape: 'blue_spiral_shell',
        color: [0, 190, 255],
        points: 25,
        lifeDelta: 0,
        sound: 'paddle',
        w: 20,
        description: 'Blue Spiral Shell Badge (+25 Pts)'
      },
      {
        id: 'crescent_moon',
        shape: 'crescent_moon',
        color: [220, 40, 160],
        points: 20,
        lifeDelta: 0,
        sound: 'paddle',
        w: 20,
        description: 'Crescent Moon Badge (+20 Pts)'
      },
      {
        id: 'bronze_star',
        shape: 'bronze_star',
        color: [215, 140, 45],
        points: 50,
        lifeDelta: 0,
        sound: 'paddle',
        w: 22,
        description: 'Bronze Eight-Pointed Star (+50 Pts)'
      },
      {
        id: 'purple_shuriken',
        shape: 'purple_shuriken',
        color: [160, 40, 220],
        points: -20,
        lifeDelta: 0,
        sound: 'losePoints',
        w: 22,
        description: 'Purple Shuriken Emblem (-20 Pts)'
      },
      {
        id: 'regular_red_ball',
        shape: 'regular_red_ball',
        color: [255, 30, 40],
        points: 0,
        lifeDelta: -1,
        sound: 'redBall',
        w: 16,
        description: 'Hazardous Red Orb (-1 Life)'
      },
      {
        id: 'red_ball',
        shape: 'red_ball',
        color: [255, 0, 0],
        points: 0,
        lifeDelta: -1, // Hazardous Red Ball in all difficulties
        sound: 'redBall',
        w: 16,
        description: 'Spiky Hazard Bomb (-1 Life)'
      }
    ],
    nextLevel: {
      threshold: 750,
      target: 'hard',
      message: "Congratulations! You've reached 750 points. Do you want to proceed to Hard difficulty?"
    },
    achievements: {
      onLoad: { id: 'zoomer', name: 'Zoomer!', desc: 'Welcome to Medium mode!' },
      score500: { id: 'booster', name: 'Booster!', desc: 'Reached 500 points in Medium mode!' },
      score1000: { id: 'wonderballs', name: 'Wonder balls!', desc: 'Reached 1000 points in Medium mode!' }
    }
  },

  hard: {
    id: 'hard',
    name: 'Hard',
    ballSpeed: 4.5,
    spawnRate: 45,
    spawnJitter: 8, // ±8 frame randomness on spawn timing
    maxBalls: 15,
    paddle: {
      width: 100,
      height: 18,
      yOffset: 12
    },
    // 1UP Heart configuration: Maximum 6 spawns per complete game run
    heartConfig: {
      maxSpawns: 6,
      cooldownFrames: 300, // Minimum ~5s spacing between spawns
      spawnChance: 0.14     // 14% probability on spawn tick when ready
    },
    // Pink Heart-Diamond bonus life: Capped at maximum 3 spawns per run in Hard
    pinkDiamondConfig: {
      maxSpawns: 3,
      cooldownFrames: 380, // Minimum ~6.3s spacing between spawns
      spawnChance: 0.12     // 12% probability on spawn tick when ready
    },
    shapes: [
      {
        id: 'water_droplet',
        shape: 'water_droplet',
        color: [0, 175, 255],
        points: 10,
        lifeDelta: 0,
        sound: 'paddle',
        w: 18,
        description: 'Water Droplet Badge (+10 Pts)'
      },
      {
        id: 'green_crystal',
        shape: 'green_crystal',
        color: [0, 220, 80],
        points: 20,
        lifeDelta: 0,
        sound: 'paddle',
        w: 18,
        description: 'Green Crystal Leaf (+20 Pts)'
      },
      {
        id: 'golden_ring',
        shape: 'golden_ring',
        color: [255, 215, 0],
        points: 25,
        lifeDelta: 0,
        sound: 'paddle',
        w: 20,
        description: 'Golden Ring Badge (+25 Pts)'
      },
      {
        id: 'ice_crystal',
        shape: 'ice_crystal',
        color: [80, 230, 255],
        points: 50,
        lifeDelta: 0,
        sound: 'paddle',
        w: 22,
        description: 'Ice Prism Badge (+50 Pts)'
      },
      {
        id: 'purple_spiked_emblem',
        shape: 'purple_spiked_emblem',
        color: [140, 30, 180],
        points: -20,
        lifeDelta: 0,
        sound: 'losePoints',
        w: 20,
        description: 'Purple Spiked Emblem (-20 Pts)'
      },
      {
        id: 'dark_triangular_emblem',
        shape: 'dark_triangular_emblem',
        color: [35, 45, 95],
        points: -30,
        lifeDelta: 0,
        sound: 'losePoints',
        w: 20,
        description: 'Dark Triangle Emblem (-30 Pts)'
      },
      {
        id: 'blue_spiral_shell',
        shape: 'blue_spiral_shell',
        color: [0, 190, 255],
        points: 25,
        lifeDelta: 0,
        sound: 'paddle',
        w: 20,
        description: 'Blue Spiral Shell Badge (+25 Pts)'
      },
      {
        id: 'crescent_moon',
        shape: 'crescent_moon',
        color: [220, 40, 160],
        points: 20,
        lifeDelta: 0,
        sound: 'paddle',
        w: 20,
        description: 'Crescent Moon Badge (+20 Pts)'
      },
      {
        id: 'bronze_star',
        shape: 'bronze_star',
        color: [215, 140, 45],
        points: 50,
        lifeDelta: 0,
        sound: 'paddle',
        w: 22,
        description: 'Bronze Eight-Pointed Star (+50 Pts)'
      },
      {
        id: 'purple_shuriken',
        shape: 'purple_shuriken',
        color: [160, 40, 220],
        points: -20,
        lifeDelta: 0,
        sound: 'losePoints',
        w: 22,
        description: 'Purple Shuriken Emblem (-20 Pts)'
      },
      {
        id: 'regular_red_ball',
        shape: 'regular_red_ball',
        color: [255, 30, 40],
        points: 0,
        lifeDelta: -1,
        sound: 'redBall',
        w: 16,
        description: 'Hazardous Red Orb (-1 Life)'
      },
      {
        id: 'red_ball',
        shape: 'red_ball',
        color: [255, 0, 0],
        points: 0,
        lifeDelta: -1, // Spiky Hazard Bomb
        sound: 'redBall',
        w: 16,
        description: 'Spiky Hazard Bomb (-1 Life)'
      },
      {
        id: 'orange_flame',
        shape: 'orange_flame',
        color: [255, 120, 0],
        points: 0,
        lifeDelta: -1, // Flame life hazard
        sound: 'redBall',
        w: 20,
        description: 'Orange Flame Hazard (-1 Life)'
      }
    ],
    nextLevel: {
      threshold: 1000,
      target: 'insane',
      message: "Legendary! You've conquered Hard difficulty with 1,000+ points! Insane difficulty is now UNLOCKED. Dare to enter the Madness?"
    },
    achievements: {
      onLoad: { id: 'crown', name: 'The Crown!', desc: 'Welcome to Hard mode!' },
      score500: { id: 'hunters_mark', name: "Hunter's Mark!", desc: 'Reached 500 points in Hard mode!' },
      score1000: { id: 'defender', name: 'Defender Of The Crown!', desc: 'Reached 1000 points in Hard mode!' }
    }
  },

  insane: {
    id: 'insane',
    name: 'Insane',
    ballSpeed: 5.6,
    spawnRate: 34,
    spawnJitter: 6, // ±6 frame randomness on spawn timing
    maxBalls: 12,
    paddle: {
      width: 90,
      height: 18,
      yOffset: 12
    },
    // 1UP Heart configuration: Maximum 4 spawns per complete game run
    heartConfig: {
      maxSpawns: 4,
      cooldownFrames: 420,
      spawnChance: 0.10
    },
    // Pink Heart-Diamond bonus life: Capped at maximum 2 spawns per run in Insane
    pinkDiamondConfig: {
      maxSpawns: 2,
      cooldownFrames: 500,
      spawnChance: 0.08
    },
    shapes: [
      {
        id: 'water_droplet',
        shape: 'water_droplet',
        color: [0, 175, 255],
        points: 10,
        lifeDelta: 0,
        sound: 'paddle',
        w: 18,
        description: 'Water Droplet Badge (+10 Pts)'
      },
      {
        id: 'green_crystal',
        shape: 'green_crystal',
        color: [0, 220, 80],
        points: 20,
        lifeDelta: 0,
        sound: 'paddle',
        w: 18,
        description: 'Green Crystal Leaf (+20 Pts)'
      },
      {
        id: 'golden_ring',
        shape: 'golden_ring',
        color: [255, 215, 0],
        points: 25,
        lifeDelta: 0,
        sound: 'paddle',
        w: 20,
        description: 'Golden Ring Badge (+25 Pts)'
      },
      {
        id: 'ice_crystal',
        shape: 'ice_crystal',
        color: [80, 230, 255],
        points: 50,
        lifeDelta: 0,
        sound: 'paddle',
        w: 22,
        description: 'Ice Prism Badge (+50 Pts)'
      },
      {
        id: 'purple_spiked_emblem',
        shape: 'purple_spiked_emblem',
        color: [140, 30, 180],
        points: -20,
        lifeDelta: 0,
        sound: 'losePoints',
        w: 20,
        description: 'Purple Spiked Hazard Trap (-20 Pts)'
      },
      {
        id: 'dark_triangular_emblem',
        shape: 'dark_triangular_emblem',
        color: [35, 45, 95],
        points: -30,
        lifeDelta: 0,
        sound: 'losePoints',
        w: 20,
        description: 'Dark Triangle Hazard Trap (-30 Pts)'
      },
      {
        id: 'blue_spiral_shell',
        shape: 'blue_spiral_shell',
        color: [0, 190, 255],
        points: 25,
        lifeDelta: 0,
        sound: 'paddle',
        w: 20,
        description: 'Blue Spiral Shell Badge (+25 Pts)'
      },
      {
        id: 'crescent_moon',
        shape: 'crescent_moon',
        color: [220, 40, 160],
        points: 20,
        lifeDelta: 0,
        sound: 'paddle',
        w: 20,
        description: 'Crescent Moon Badge (+20 Pts)'
      },
      {
        id: 'bronze_star',
        shape: 'bronze_star',
        color: [215, 140, 45],
        points: 50,
        lifeDelta: 0,
        sound: 'paddle',
        w: 22,
        description: 'Bronze Eight-Pointed Star (+50 Pts)'
      },
      {
        id: 'purple_shuriken',
        shape: 'purple_shuriken',
        color: [160, 40, 220],
        points: -20,
        lifeDelta: 0,
        sound: 'losePoints',
        w: 22,
        description: 'Purple Shuriken Hazard Trap (-20 Pts)'
      },
      {
        id: 'regular_red_ball',
        shape: 'regular_red_ball',
        color: [255, 30, 40],
        points: 0,
        lifeDelta: -1,
        sound: 'redBall',
        w: 18,
        description: 'Hazardous Red Orb (-1 Life)'
      },
      {
        id: 'red_ball',
        shape: 'red_ball',
        color: [255, 0, 0],
        points: 0,
        lifeDelta: -1,
        sound: 'redBall',
        w: 18,
        description: 'Spiky Hazard Bomb (-1 Life)'
      },
      {
        id: 'orange_flame',
        shape: 'orange_flame',
        color: [255, 120, 0],
        points: 0,
        lifeDelta: -1,
        sound: 'redBall',
        w: 20,
        description: 'Orange Flame Hazard (-1 Life)'
      },
      {
        id: 'hazard_cross',
        shape: 'hazard_cross',
        color: [255, 60, 20],
        points: 0,
        lifeDelta: -3,
        sound: 'redBall',
        w: 22,
        description: 'Severe Hazard Cross (-3 Lives)'
      }
    ],
    nextLevel: null,
    achievements: {
      onLoad: { id: 'madness', name: 'Into The Madness!', desc: 'Welcome to Insane mode!' },
      score500: { id: 'insane_survivor', name: 'Chaos Survivor!', desc: 'Reached 500 points in Insane mode!' },
      score1000: { id: 'insane_master', name: 'MindRush God!', desc: 'Reached 1000 points in Insane mode!' }
    }
  },

  showcase: {
    id: 'showcase',
    name: 'Showcase',
    ballSpeed: 0,
    spawnRate: 999999,
    spawnJitter: 0,
    maxBalls: 5,
    paddle: {
      width: 100,
      height: 10,
      yOffset: 20
    },
    heartConfig: null,
    shapes: [
      NEW_BADGES.blue_spiral_shell,
      NEW_BADGES.pink_heart_diamond,
      NEW_BADGES.crescent_moon,
      NEW_BADGES.bronze_star,
      NEW_BADGES.purple_shuriken
    ]
  }
};

/**
 * Returns normalized difficulty configuration based on URL param or fallback
 * @param {string|null} param
 * @returns {typeof DIFFICULTIES.easy}
 */
export function getDifficultyConfig(param) {
  if (!param) return DIFFICULTIES.easy;
  const key = String(param).trim().toLowerCase();
  return DIFFICULTIES[key] || DIFFICULTIES.easy;
}
