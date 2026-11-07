/**
 * MindRush — Account Scoped Storage & Synchronization Manager
 * Associates badges, high scores, and progression with authenticated user accounts.
 * Prevents progress leakage between accounts while preserving guest mode and backward compatibility.
 */

let _inMemoryActiveUser = null;

/**
 * Returns the currently active authenticated user or null
 * @returns {object|null}
 */
export function getActiveUser() {
  if (_inMemoryActiveUser) return _inMemoryActiveUser;
  try {
    if (typeof sessionStorage !== 'undefined') {
      const stored = sessionStorage.getItem('mindrush_active_user');
      if (stored) {
        _inMemoryActiveUser = JSON.parse(stored);
        return _inMemoryActiveUser;
      }
    }
  } catch (e) {}
  return null;
}

/**
 * Sets the active authenticated user context across memory and sessionStorage
 * @param {object|null} user
 */
export function setActiveUser(user) {
  _inMemoryActiveUser = user ? { ...user } : null;
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (user) {
        sessionStorage.setItem('mindrush_active_user', JSON.stringify(user));
      } else {
        sessionStorage.removeItem('mindrush_active_user');
      }
    }
  } catch (e) {}
}

/**
 * Clears active user context on logout or account switch
 */
export function clearActiveUser() {
  _inMemoryActiveUser = null;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('mindrush_active_user');
    }
  } catch (e) {}
}

/**
 * Generates an account-isolated storage key.
 * If user is authenticated, scopes to `baseKey_${userId}`.
 * If unauthenticated/guest, returns `baseKey` to maintain guest progress and test compatibility.
 * @param {string} baseKey
 * @param {string} [explicitUserId]
 * @returns {string}
 */
export function getScopedStorageKey(baseKey, explicitUserId) {
  const userId = explicitUserId || (_inMemoryActiveUser ? (_inMemoryActiveUser.id || _inMemoryActiveUser.username) : null);
  if (userId) {
    return `${baseKey}_${userId}`;
  }
  // Try reading active user from sessionStorage if memory is cold
  const active = getActiveUser();
  if (active && (active.id || active.username)) {
    return `${baseKey}_${active.id || active.username}`;
  }
  return baseKey;
}

/**
 * Syncs user progress from the backend server into account-scoped browser storage
 * @returns {Promise<object|null>}
 */
export async function syncProgressFromServer() {
  if (typeof fetch === 'undefined') return null;
  try {
    const res = await fetch('/api/progress', { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.success && data.user) {
      setActiveUser(data.user);
      const uid = data.user.id || data.user.username;
      if (typeof localStorage !== 'undefined' && uid) {
        if (Array.isArray(data.badges)) {
          const badgeKey = `mindrush_unlocked_badges_${uid}`;
          localStorage.setItem(badgeKey, JSON.stringify(data.badges));
        }
        if (typeof data.highScore === 'number') {
          const scoreKey = `mindrush_high_score_${uid}`;
          const currentLocal = parseInt(localStorage.getItem(scoreKey) || '0', 10);
          const maxScore = Math.max(currentLocal, data.highScore);
          localStorage.setItem(scoreKey, String(maxScore));
        }
        if (typeof data.insaneUnlocked === 'boolean') {
          const insaneKey = `mindrush_insane_unlocked_${uid}`;
          localStorage.setItem(insaneKey, data.insaneUnlocked ? 'true' : 'false');
        }
      }
      return data;
    }
  } catch (e) {}
  return null;
}

/**
 * Pushes user progress to the server to persist into MongoDB
 * @param {object} progress
 * @returns {Promise<object|null>}
 */
export async function pushProgressToServer(progress) {
  if (typeof fetch === 'undefined') return null;
  try {
    const res = await fetch('/api/progress/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(progress)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {}
  return null;
}

/**
 * Submits flight score to the server leaderboard for the authenticated cadet
 * @param {number} score
 * @param {string} difficulty
 * @param {string} [mode] - 'skyfall' | 'space-invader'
 * @returns {Promise<boolean>}
 */
export async function submitScoreToServer(score, difficulty, mode = 'skyfall') {
  if (typeof fetch === 'undefined') return false;
  try {
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ score, difficulty, mode })
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

