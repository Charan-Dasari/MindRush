/**
 * MindRush — How to Play Modal & Gesture Instructions Verification Test
 */

import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('=== MindRush How to Play Modal Verification Test ===\n');

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${description}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL  ${description}`);
    console.error(`        ${err.message}`);
    process.exitCode = 1;
  }
}

const ROOT = process.cwd();
const dashboardHtmlPath = path.join(ROOT, 'public/dashboard.html');
const dashboardHtml = fs.readFileSync(dashboardHtmlPath, 'utf8');

// 1. Verify Image Assets Exist
console.log('--- 1. Gesture Image Assets Verification ---');

test('gesture-open-palm.png exists in public/assets/images and is non-empty', () => {
  const imgPath = path.join(ROOT, 'public/assets/images/gesture-open-palm.png');
  assert.ok(fs.existsSync(imgPath), 'gesture-open-palm.png must exist');
  const stat = fs.statSync(imgPath);
  assert.ok(stat.size > 10000, 'gesture-open-palm.png must be a valid image file');
});

test('gesture-v-sign.png exists in public/assets/images and is non-empty', () => {
  const imgPath = path.join(ROOT, 'public/assets/images/gesture-v-sign.png');
  assert.ok(fs.existsSync(imgPath), 'gesture-v-sign.png must exist');
  const stat = fs.statSync(imgPath);
  assert.ok(stat.size > 10000, 'gesture-v-sign.png must be a valid image file');
});

test('gesture-closed-fist.png exists in public/assets/images and is non-empty', () => {
  const imgPath = path.join(ROOT, 'public/assets/images/gesture-closed-fist.png');
  assert.ok(fs.existsSync(imgPath), 'gesture-closed-fist.png must exist');
  const stat = fs.statSync(imgPath);
  assert.ok(stat.size > 10000, 'gesture-closed-fist.png must be a valid image file');
});

// 2. Verify Modal HTML Structure
console.log('\n--- 2. Modal HTML Content & Accuracy Verification ---');

test('instructionsModal exists with proper mission guide title and close buttons', () => {
  assert.ok(dashboardHtml.includes('id="instructionsModal"'), 'Modal must have id="instructionsModal"');
  assert.ok(dashboardHtml.includes("openModal('instructionsModal')"), 'Topbar button must open instructionsModal');
  assert.ok(dashboardHtml.includes("closeModal('instructionsModal')"), 'Close button must close instructionsModal');
  assert.ok(dashboardHtml.includes('HOW TO PLAY MINDRUSH'), 'Title must be HOW TO PLAY MINDRUSH');
});

test('Step 1: Open Palm movement instruction and image reference', () => {
  assert.ok(dashboardHtml.includes('assets/images/gesture-open-palm.png'), 'Must reference gesture-open-palm.png');
  assert.ok(dashboardHtml.includes('Open Palm: Movement'), 'Step 1 heading must be Open Palm: Movement');
  assert.ok(
    dashboardHtml.includes('Show your open palm and move your hand left or right to control the paddle or spaceship.'),
    'Step 1 instruction text must match requirement'
  );
  assert.ok(dashboardHtml.includes('Skyfall &amp; Space Invader'), 'Step 1 must specify Skyfall & Space Invader');
});

test('Step 2: V Sign pause/resume instruction and image reference', () => {
  assert.ok(dashboardHtml.includes('assets/images/gesture-v-sign.png'), 'Must reference gesture-v-sign.png');
  assert.ok(dashboardHtml.includes('V Sign: Pause / Resume'), 'Step 2 heading must be V Sign: Pause / Resume');
  assert.ok(
    dashboardHtml.includes('Raise your index and middle fingers in a V shape to pause or resume the game.'),
    'Step 2 instruction text must match requirement'
  );
  assert.ok(
    dashboardHtml.includes('Hold the gesture steadily for a brief moment to activate.'),
    'Step 2 must mention holding briefly to activate'
  );
});

test('Step 3: Closed Fist shooting instruction and image reference', () => {
  assert.ok(dashboardHtml.includes('assets/images/gesture-closed-fist.png'), 'Must reference gesture-closed-fist.png');
  assert.ok(dashboardHtml.includes('Closed Fist: Shoot'), 'Step 3 heading must be Closed Fist: Shoot');
  assert.ok(
    dashboardHtml.includes('Make a fist to shoot continuously in Educational Space Invader. Release your fist to stop shooting.'),
    'Step 3 instruction text must match requirement'
  );
  assert.ok(
    dashboardHtml.includes('Applies to Educational Space Invader only — Skyfall uses paddle catching.'),
    'Step 3 must clarify it applies to Educational Space Invader only, not Skyfall'
  );
});

test('Step 4: Keyboard controls optional reference', () => {
  assert.ok(dashboardHtml.includes('Keyboard Controls Available'), 'Step 4 heading must be Keyboard Controls Available');
  assert.ok(
    dashboardHtml.includes('Prefer keyboard controls? Switch to Keyboard Controls from the Control Method setting in the pause menu.'),
    'Step 4 instruction text must match requirement'
  );
  assert.ok(dashboardHtml.includes('Skyfall'), 'Step 4 must reference Skyfall keyboard controls');
  assert.ok(dashboardHtml.includes('Educational Space Invader'), 'Step 4 must reference Educational Space Invader keyboard controls');
  assert.ok(dashboardHtml.includes('Pause / Resume'), 'Step 4 must reference Esc for Pause/Resume');
});

test('Outdated mouse/touchpad movement instructions are completely removed', () => {
  // Ensure mouse/touchpad movement is no longer mentioned in instructionsModal
  const startIdx = dashboardHtml.indexOf('id="instructionsModal"');
  const endIdx = dashboardHtml.indexOf('id="profileModal"');
  assert.ok(startIdx !== -1 && endIdx !== -1, 'instructionsModal content must be extractable');
  const modalContent = dashboardHtml.substring(startIdx, endIdx);
  assert.equal(modalContent.includes('touchpad'), false, 'Touchpad must be removed');
  assert.equal(modalContent.includes('mouse, touchpad'), false, 'mouse, touchpad must be removed');
  assert.equal(modalContent.includes('KEYBOARD & MOUSE SUPPORTED'), false, 'Footer must not say KEYBOARD & MOUSE SUPPORTED');
  assert.ok(modalContent.includes('GESTURE &amp; KEYBOARD SUPPORTED'), 'Footer must state GESTURE & KEYBOARD SUPPORTED');
});

// 3. Verify CSS & Responsive Styling
console.log('\n--- 3. CSS & Responsive Styling Verification ---');

test('CSS includes gesture-thumb-box with object-fit: contain and rounded styling', () => {
  assert.ok(dashboardHtml.includes('.gesture-thumb-box'), 'Must have .gesture-thumb-box class');
  assert.ok(dashboardHtml.includes('.gesture-thumb-img'), 'Must have .gesture-thumb-img class');
  assert.ok(dashboardHtml.includes('object-fit: contain'), 'Image must use object-fit: contain');
  assert.ok(dashboardHtml.includes('.gesture-step-card'), 'Must have .gesture-step-card class');
  assert.ok(dashboardHtml.includes('@media (max-width: 580px)'), 'Must have responsive media query for gesture cards');
});

console.log('\n========================================');
console.log(`Results: ${passed}/${passed + failed} assertions passed.`);
if (failed === 0) {
  console.log('ALL HOW TO PLAY MODAL TESTS PASSED SUCCESSFULLY!');
} else {
  console.error(`FAILED: ${failed} assertions failed.`);
}
console.log('========================================');
