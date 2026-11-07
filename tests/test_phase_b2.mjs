/**
 * MindRush — Phase B.2 Verification Test Suite
 * Tests:
 * 1. Pre-Game Briefing SVG Badge Artwork (no colored-square placeholders)
 * 2. Modal Controls (Back/Close dismiss, Continue launches once)
 * 3. Dashboard Badge Counts use real persistent data
 * 4. Removed Standalone Badge Gallery Links
 * 5. Custom Scrollbar CSS presence
 * 6. Root Entry Point redirect (index.html → dashboard.html)
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  COLLECTIBLE_BADGES,
  getUnlockedBadgeCount,
  getTotalBadgeCount,
  resetBadgeCollection,
  getUnlockedBadges,
  unlockBadge,
  isInsaneUnlocked,
  resetProgression
} from '../public/js/game/difficulty.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('=== MindRush Phase B.2 Verification Test Suite ===\n');

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    process.exitCode = 1;
  }
}

// Mock browser localStorage for Node.js
if (typeof globalThis.localStorage === 'undefined') {
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; }
  };
}

// Load HTML files for structural analysis
const publicDir = resolve(__dirname, '..', 'public');
const difficultyHTML = readFileSync(resolve(publicDir, 'difficulty-select.html'), 'utf-8');
const dashboardHTML = readFileSync(resolve(publicDir, 'dashboard.html'), 'utf-8');
const indexHTML = readFileSync(resolve(publicDir, 'index.html'), 'utf-8');
const modeSelectHTML = readFileSync(resolve(publicDir, 'mode-select.html'), 'utf-8');
const mainCSS = readFileSync(resolve(publicDir, 'css', 'main.css'), 'utf-8');

// ========================================================
// Test Group 1: Pre-Game Briefing SVG Badge Artwork
// ========================================================
console.log('\n--- Test Group 1: Pre-Game Briefing SVG Badge Artwork ---');

// Verify the getBadgeSVG function exists in difficulty-select.html
assert(
  difficultyHTML.includes('function getBadgeSVG('),
  'difficulty-select.html contains getBadgeSVG function'
);

// Verify SVG artwork for key collectible shapes
const badgeShapes = [
  'water_droplet', 'golden_sunburst', 'green_crystal', 'silver_hexagon',
  'star', 'golden_ring', 'blue_spiral_shell', 'crescent_moon',
  'bronze_star', 'ice_crystal', 'heart', 'pink_heart_diamond'
];
badgeShapes.forEach(shape => {
  assert(
    difficultyHTML.includes(`case '${shape}':`),
    `getBadgeSVG handles shape "${shape}"`
  );
});

// Verify SVG artwork for key hazard shapes
const hazardShapes = [
  'regular_red_ball', 'red_ball', 'purple_shuriken', 'dark_triangular_emblem',
  'orange_flame', 'hazard_cross'
];
hazardShapes.forEach(shape => {
  assert(
    difficultyHTML.includes(`case '${shape}':`),
    `getBadgeSVG handles hazard shape "${shape}"`
  );
});

// Verify guide-item-dot is now 24px with SVG support (not 14px colored square)
assert(
  difficultyHTML.includes('width: 24px') && difficultyHTML.includes('height: 24px'),
  'Guide item dot is 24px with SVG container (not 14px colored square)'
);

assert(
  difficultyHTML.includes('.guide-item-dot svg'),
  'CSS rule for SVG inside guide-item-dot exists'
);

// Verify SVG icons are injected into rows (using getBadgeSVG call)
assert(
  difficultyHTML.includes('getBadgeSVG(item.shapeId'),
  'Positive badge rows use getBadgeSVG for SVG icons'
);

// Verify shapeId is tracked for special objects
assert(
  difficultyHTML.includes("shapeId: 'star'"),
  'Golden Lucky Star tracks shapeId for SVG rendering'
);

assert(
  difficultyHTML.includes("shapeId: 'pink_heart_diamond'"),
  'Pink Heart-Diamond tracks shapeId for SVG rendering'
);

assert(
  difficultyHTML.includes("shapeId: 'heart'"),
  '1UP Heart tracks shapeId for SVG rendering'
);

assert(
  difficultyHTML.includes('resolveShapeIdForSVG(shape)'),
  'Standard shapes resolve shapeId via resolveShapeIdForSVG'
);

// ========================================================
// Test Group 2: Modal Controls (Back/Close/Continue)
// ========================================================
console.log('\n--- Test Group 2: Modal Controls (Back/Close/Continue) ---');

// Back button uses guide-footer-btn class (dashboard-matching style)
assert(
  difficultyHTML.includes('class="guide-footer-btn" id="btn-guide-back"'),
  'Back button uses guide-footer-btn class matching dashboard design'
);

// Continue button uses guide-footer-btn btn-continue
assert(
  difficultyHTML.includes('class="guide-footer-btn btn-continue" id="btn-guide-continue"'),
  'Continue button uses guide-footer-btn btn-continue class'
);

// Continue button has onclick handler for single-launch prevention
assert(
  difficultyHTML.includes('onclick="handleContinueClick(event)"'),
  'Continue button has handleContinueClick onclick handler'
);

// handleContinueClick function prevents double launch
assert(
  difficultyHTML.includes("function handleContinueClick") || difficultyHTML.includes("window.handleContinueClick"),
  'handleContinueClick function is defined'
);

assert(
  difficultyHTML.includes("classList.contains('launched')") && difficultyHTML.includes("event.preventDefault()"),
  'handleContinueClick prevents re-launch if already launched'
);

assert(
  difficultyHTML.includes("classList.add('launched')"),
  'handleContinueClick marks button as launched'
);

// Verify CSS for .launched state (disabled appearance)
assert(
  difficultyHTML.includes('.guide-footer-btn.btn-continue.launched'),
  'CSS rule for launched state (disabled appearance) exists'
);

// Back button calls closeDifficultyGuide (dismisses modal without starting game)
assert(
  difficultyHTML.includes('btn-guide-back" onclick="closeDifficultyGuide()"'),
  'Back button calls closeDifficultyGuide to dismiss without starting game'
);

// Task 1: Close (X) button is removed from difficulty briefing popup (Back button dismisses)
assert(
  !difficultyHTML.includes('onclick="closeDifficultyGuide()" aria-label="Close"'),
  'Close (X) button is removed from difficulty briefing popup (Task 1)'
);

// closeDifficultyGuide resets the launched state
assert(
  difficultyHTML.includes("continueBtn.classList.remove('launched')"),
  'closeDifficultyGuide resets Continue button launched state'
);

// Guide-footer-btn has proper styling (matching dashboard button design)
assert(
  difficultyHTML.includes('.guide-footer-btn {') && difficultyHTML.includes('border-radius: 14px'),
  'guide-footer-btn has proper styled button with border-radius matching dashboard'
);

// ========================================================
// Test Group 3: Dashboard Badge Counts & Persistent Data
// ========================================================
console.log('\n--- Test Group 3: Dashboard Badge Counts & Persistent Data ---');

// Reset to fresh state
resetBadgeCollection();
resetProgression();

assert(
  getUnlockedBadgeCount() === 0,
  'Fresh profile starts with 0 unlocked badges'
);

assert(
  getTotalBadgeCount() === 12,
  'Total badge count is 12'
);

// Dashboard uses real badge functions (not hardcoded)
assert(
  dashboardHTML.includes('getUnlockedBadgeCount()') && dashboardHTML.includes('getTotalBadgeCount()'),
  'Dashboard uses getUnlockedBadgeCount() and getTotalBadgeCount() from badge system'
);

assert(
  dashboardHTML.includes('getUnlockedBadges()'),
  'Dashboard renders badge list from getUnlockedBadges()'
);

assert(
  dashboardHTML.includes('COLLECTIBLE_BADGES'),
  'Dashboard iterates COLLECTIBLE_BADGES for the 12 collectible badges'
);

// Verify dashboard badge modal is populated dynamically (not hardcoded "14 / 28")
assert(
  !dashboardHTML.includes('14 / 28'),
  'Dashboard does NOT contain hardcoded "14 / 28" fake badge count'
);

// Profile modal badge count uses dynamic element
assert(
  dashboardHTML.includes('id="profile-badge-count"'),
  'Profile modal has dynamic badge count element'
);

// ========================================================
// Test Group 4: Removed Standalone Badge Gallery Links
// ========================================================
console.log('\n--- Test Group 4: Removed Standalone Badge Gallery Links ---');

// Dashboard: No badge-gallery.html in footer
assert(
  !dashboardHTML.includes('href="badge-gallery.html"'),
  'Dashboard footer does NOT link to badge-gallery.html'
);

// Dashboard: No "Open Full Interactive 3D Showcase" link
assert(
  !dashboardHTML.includes('Interactive 3D Showcase'),
  'Dashboard does NOT contain "Open Full Interactive 3D Showcase" link'
);

// Difficulty select: No badge-gallery.html in footer
assert(
  !difficultyHTML.includes('href="badge-gallery.html"'),
  'Difficulty select footer does NOT link to badge-gallery.html'
);

// Mode select: No badge-gallery.html in footer
assert(
  !modeSelectHTML.includes('href="badge-gallery.html"'),
  'Mode select footer does NOT link to badge-gallery.html'
);

// Index.html: No badge-gallery.html links (now a redirect)
assert(
  !indexHTML.includes('href="badge-gallery.html"'),
  'index.html does NOT link to badge-gallery.html'
);

// ========================================================
// Test Group 5: Custom Scrollbar CSS
// ========================================================
console.log('\n--- Test Group 5: Custom Scrollbar CSS ---');

assert(
  mainCSS.includes('::-webkit-scrollbar'),
  'main.css contains ::-webkit-scrollbar rule (Chromium support)'
);

assert(
  mainCSS.includes('::-webkit-scrollbar-thumb'),
  'main.css contains ::-webkit-scrollbar-thumb styling'
);

assert(
  mainCSS.includes('::-webkit-scrollbar-thumb:hover'),
  'main.css contains ::-webkit-scrollbar-thumb:hover state'
);

assert(
  mainCSS.includes('::-webkit-scrollbar-track'),
  'main.css contains ::-webkit-scrollbar-track styling'
);

assert(
  mainCSS.includes('scrollbar-width: thin'),
  'main.css includes Firefox scrollbar-width: thin fallback'
);

assert(
  mainCSS.includes('scrollbar-color:'),
  'main.css includes Firefox scrollbar-color fallback'
);

// Verify scrollbar applies to modal containers
assert(
  mainCSS.includes('.modal-popup-panel') && mainCSS.includes('.guide-modal-content'),
  'Custom scrollbar targets modal-popup-panel and guide-modal-content'
);

assert(
  mainCSS.includes('.guide-body'),
  'Custom scrollbar targets guide-body (pre-game briefing scrollable area)'
);

assert(
  mainCSS.includes('#dashboard-badges-list'),
  'Custom scrollbar targets dashboard-badges-list'
);

// ========================================================
// Test Group 6: Root Entry Point (index.html → dashboard.html)
// ========================================================
console.log('\n--- Test Group 6: Root Entry Point (index.html → dashboard.html) ---');

// index.html redirects to dashboard.html via meta refresh
assert(
  indexHTML.includes('url=dashboard.html'),
  'index.html contains meta refresh redirect to dashboard.html'
);

assert(
  indexHTML.includes('<meta http-equiv="refresh"'),
  'index.html uses meta http-equiv="refresh" for redirect'
);

// index.html has a fallback link
assert(
  indexHTML.includes('href="dashboard.html"'),
  'index.html has fallback anchor link to dashboard.html'
);

// index.html is minimal (not the full landing page)
assert(
  indexHTML.length < 1000,
  `index.html is a minimal redirect (${indexHTML.length} bytes, expected < 1000)`
);

// Dashboard still has essential structure
assert(
  dashboardHTML.includes('MINDRUSH'),
  'dashboard.html contains MINDRUSH hero title'
);

assert(
  dashboardHTML.includes('mode-select.html'),
  'dashboard.html links to mode-select.html for gameplay entry'
);

// ========================================================
// Test Group 7: Badge System Integrity After B.2 Changes
// ========================================================
console.log('\n--- Test Group 7: Badge System Integrity After B.2 Changes ---');

resetBadgeCollection();

// Unlock a few badges and verify counts
unlockBadge('water_droplet');
unlockBadge('golden_sunburst');
unlockBadge('bronze_star');

assert(
  getUnlockedBadgeCount() === 3,
  'After unlocking 3 badges, count is exactly 3'
);

assert(
  getTotalBadgeCount() === 12,
  'Total collectible badges still 12 (unchanged by B.2)'
);

// Duplicate prevention still works
const dupResult = unlockBadge('water_droplet');
assert(
  dupResult === false,
  'Duplicate unlock returns false (no inflation)'
);

assert(
  getUnlockedBadgeCount() === 3,
  'Count remains 3 after duplicate attempt'
);

// All 12 canonical badges still defined
assert(
  Object.keys(COLLECTIBLE_BADGES).length === 12,
  'COLLECTIBLE_BADGES registry still has exactly 12 entries'
);

// Reset cleanup
resetBadgeCollection();
resetProgression();

assert(
  getUnlockedBadgeCount() === 0,
  'Reset returns to 0 unlocked badges'
);

// ========================================================
// Summary
// ========================================================
console.log(`\n========================================================`);
console.log(`Phase B.2 Verification Results: ${passed} / ${total} assertions passed.`);
if (passed === total) {
  console.log('ALL PHASE B.2 AUTOMATED TESTS PASSED!');
} else {
  console.error(`${total - passed} test(s) FAILED.`);
}
console.log('========================================================\n');
