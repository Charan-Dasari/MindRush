/**
 * MindRush — Persistent Badge Collection System
 * Manages collectible badge definitions, persistent unlocking via localStorage,
 * duplicate prevention, and collection statistics.
 */

import { getScopedStorageKey } from './storage.js';

export const BADGE_STORAGE_KEY = 'mindrush_unlocked_badges';

let _activeBadgeUserId = null;
const _userMemoryBadgeStorage = new Map();

function getMemoryBadgeSet() {
  const key = getBadgeStorageKey();
  if (!_userMemoryBadgeStorage.has(key)) {
    _userMemoryBadgeStorage.set(key, new Set());
  }
  return _userMemoryBadgeStorage.get(key);
}

export function setBadgeUserContext(userId) {
  _activeBadgeUserId = userId ? String(userId) : null;
}

export function clearBadgeUserContext() {
  _activeBadgeUserId = null;
  _userMemoryBadgeStorage.clear();
}

export function getBadgeStorageKey(userId = _activeBadgeUserId) {
  return getScopedStorageKey(BADGE_STORAGE_KEY, userId);
}

/**
 * Canonical dictionary of all collectible badges in Skyfall.
 * Harmful hazard traps (mines, flames, crosses, shurikens, dark triangles) are strictly excluded.
 */
export const COLLECTIBLE_BADGES = {
  silver_hexagon: {
    id: 'silver_hexagon',
    shape: 'silver_hexagon',
    name: 'Silver Hexagon',
    points: 10,
    lifeDelta: 0,
    tier: 'Easy',
    color: [200, 200, 210],
    description: 'Foundational celestial badge awarding +10 points.'
  },
  water_droplet: {
    id: 'water_droplet',
    shape: 'water_droplet',
    name: 'Water Droplet',
    points: 10,
    lifeDelta: 0,
    tier: 'Easy',
    color: [0, 175, 255],
    description: 'Cool plasma condensate droplet awarding +10 points.'
  },
  golden_sunburst: {
    id: 'golden_sunburst',
    shape: 'golden_sunburst',
    name: 'Golden Sunburst',
    points: 20,
    lifeDelta: 0,
    tier: 'Easy',
    color: [255, 200, 0],
    description: 'Radiant solar energy badge awarding +20 points.'
  },
  green_crystal: {
    id: 'green_crystal',
    shape: 'green_crystal',
    name: 'Green Crystal Leaf',
    points: 20,
    lifeDelta: 0,
    tier: 'Easy',
    color: [0, 220, 80],
    description: 'Bioluminescent stellar mineral awarding +20 points.'
  },
  golden_star: {
    id: 'golden_star',
    shape: 'star',
    name: 'Golden Lucky Star',
    points: 100,
    lifeDelta: 0,
    tier: 'Easy (Score 250+)',
    color: [255, 255, 0],
    description: 'Rare milestone reward badge awarding +100 points.'
  },
  golden_ring: {
    id: 'golden_ring',
    shape: 'golden_ring',
    name: 'Golden Ring',
    points: 25,
    lifeDelta: 0,
    tier: 'Medium',
    color: [255, 215, 0],
    description: 'Ancient planetary orbit ring awarding +25 points.'
  },
  blue_spiral_shell: {
    id: 'blue_spiral_shell',
    shape: 'blue_spiral_shell',
    name: 'Blue Spiral Shell',
    points: 25,
    lifeDelta: 0,
    tier: 'Medium',
    color: [0, 190, 255],
    description: 'Galactic nautilus spiral badge awarding +25 points.'
  },
  crescent_moon: {
    id: 'crescent_moon',
    shape: 'crescent_moon',
    name: 'Crescent Moon',
    points: 20,
    lifeDelta: 0,
    tier: 'Medium',
    color: [220, 40, 160],
    description: 'Luminous lunar shard awarding +20 points.'
  },
  bronze_star: {
    id: 'bronze_star',
    shape: 'bronze_star',
    name: 'Bronze Eight-Pointed Star',
    points: 50,
    lifeDelta: 0,
    tier: 'Medium',
    color: [215, 140, 45],
    description: 'Burnished octagram star badge awarding +50 points.'
  },
  ice_crystal: {
    id: 'ice_crystal',
    shape: 'ice_crystal',
    name: 'Ice Prism Crystal',
    points: 50,
    lifeDelta: 0,
    tier: 'Medium',
    color: [80, 230, 255],
    description: 'Glacial cryo-gem awarding +50 points.'
  },
  pink_heart_diamond: {
    id: 'pink_heart_diamond',
    shape: 'pink_heart_diamond',
    name: 'Pink Heart-Diamond',
    points: 0,
    lifeDelta: 1,
    tier: 'Medium (Bonus)',
    color: [255, 50, 150],
    description: 'Radiant bonus life relic granting +1 extra life.'
  },
  '1up_heart': {
    id: '1up_heart',
    shape: 'heart',
    name: '1UP Extra Life Heart',
    points: 0,
    lifeDelta: 1,
    tier: 'Medium (Bonus)',
    color: [255, 25, 70],
    description: 'Vitality shield replenishment granting +1 extra life.'
  }
};

/**
 * Resolves any falling object instance or ID to its canonical collectible badge ID.
 * Returns null if the object is harmful or not a recognized collectible badge.
 * @param {object|string} objectOrId
 * @returns {string|null}
 */
export function resolveBadgeId(objectOrId) {
  if (!objectOrId) return null;

  let rawId = typeof objectOrId === 'string' ? objectOrId : objectOrId.id;
  let shape = typeof objectOrId === 'object' ? objectOrId.shape : null;

  // Aliases resolution
  if (rawId === 'heart' || shape === 'heart' || shape === 'drawHeart') {
    return '1up_heart';
  }
  if (rawId === 'star' || shape === 'star') {
    return 'golden_star';
  }

  if (rawId && COLLECTIBLE_BADGES[rawId]) {
    return rawId;
  }
  if (shape && COLLECTIBLE_BADGES[shape]) {
    return shape;
  }

  return null;
}

/**
 * Returns true if an object represents a positive collectible badge
 * @param {object} object
 * @returns {boolean}
 */
export function isCollectibleBadge(object) {
  if (!object) return false;
  // If object is explicitly harmful (points < 0 or lifeDelta < 0), it's never collectible
  if (typeof object.isHarmful === 'function' && object.isHarmful()) {
    return false;
  }
  if ((object.points !== undefined && object.points < 0) ||
      (object.lifeDelta !== undefined && object.lifeDelta < 0)) {
    return false;
  }
  return resolveBadgeId(object) !== null;
}

/**
 * Retrieves all currently unlocked badge IDs as an array of strings.
 * @returns {string[]}
 */
export function getUnlockedBadges() {
  const storageKey = getBadgeStorageKey();
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        const memSet = getMemoryBadgeSet();
        return Array.from(memSet);
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(id => typeof id === 'string' && COLLECTIBLE_BADGES[id]);
      }
      return [];
    }
    return Array.from(getMemoryBadgeSet());
  } catch (e) {
    return Array.from(getMemoryBadgeSet());
  }
}

/**
 * Checks if a specific badge has been unlocked
 * @param {string} badgeId
 * @returns {boolean}
 */
export function isBadgeUnlocked(badgeId) {
  const canonicalId = resolveBadgeId(badgeId);
  if (!canonicalId) return false;
  const unlocked = getUnlockedBadges();
  return unlocked.includes(canonicalId);
}

/**
 * Records a badge as unlocked in persistent storage when the player collects it.
 * Automatically ignores duplicates to prevent count inflation.
 * @param {object|string} objectOrId
 * @returns {boolean} True if the badge was newly unlocked, false if already unlocked or invalid
 */
export function unlockBadge(objectOrId) {
  const canonicalId = resolveBadgeId(objectOrId);
  if (!canonicalId || !COLLECTIBLE_BADGES[canonicalId]) {
    return false;
  }

  const current = new Set(getUnlockedBadges());
  if (current.has(canonicalId)) {
    return false; // Already unlocked; do not duplicate or inflate
  }

  current.add(canonicalId);
  const updatedList = Array.from(current);
  const storageKey = getBadgeStorageKey();

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(updatedList));
    }
    getMemoryBadgeSet().add(canonicalId);
    return true;
  } catch (e) {
    getMemoryBadgeSet().add(canonicalId);
    return true;
  }
}

/**
 * Returns the count of unique badges collected so far
 * @returns {number}
 */
export function getUnlockedBadgeCount() {
  return getUnlockedBadges().length;
}

/**
 * Returns the total number of unique collectible badges in Skyfall
 * @returns {number}
 */
export function getTotalBadgeCount() {
  return Object.keys(COLLECTIBLE_BADGES).length;
}

/**
 * Resets badge collection back to 0 unlocked (for testing and fresh profile state)
 * @returns {boolean}
 */
export function resetBadgeCollection() {
  const storageKey = getBadgeStorageKey();
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(storageKey);
    }
    getMemoryBadgeSet().clear();
    return true;
  } catch (e) {
    getMemoryBadgeSet().clear();
    return false;
  }
}
