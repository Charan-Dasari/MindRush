/**
 * MindRush — Pages & UI Verification Test Suite
 * Tests:
 * 1. Task 1: X Button removed from all difficulty briefing popups, Back & Continue preserved.
 * 2. Task 2: Signup page fields (no phone, no email), validation, password strength.
 * 3. Task 3: Login page structure, visibility toggle, real backend connection.
 * 4. Task 5: Dashboard session verification and logout flow.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = resolve(__dirname, '..', 'public');

const diffSelectHTML = readFileSync(resolve(publicDir, 'difficulty-select.html'), 'utf-8');
const registerHTML = readFileSync(resolve(publicDir, 'register.html'), 'utf-8');
const loginHTML = readFileSync(resolve(publicDir, 'login.html'), 'utf-8');
const dashboardHTML = readFileSync(resolve(publicDir, 'dashboard.html'), 'utf-8');
const eduCategoriesHTML = readFileSync(resolve(publicDir, 'educational-categories.html'), 'utf-8');

console.log('=== MindRush UI & Page Architecture Test Suite ===\n');

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

// ========================================================
// Task 1: Difficulty Briefing Popups Cleanup
// ========================================================
console.log('\n--- Task 1: Difficulty Briefing Popups Cleanup ---');

// 1. Extra X button removed from the guide-header
assert(
  !diffSelectHTML.includes('class="top-action-btn" onclick="closeDifficultyGuide()" aria-label="Close"'),
  'Extra X/Close button is removed from pre-game difficulty briefing popup'
);

assert(
  !diffSelectHTML.includes('<button class="top-action-btn" onclick="closeDifficultyGuide()">✕</button>'),
  'No X button exists inside guide-header'
);

// 2. Back and Continue buttons preserved
assert(
  diffSelectHTML.includes('id="btn-guide-back" onclick="closeDifficultyGuide()"'),
  'Back button (&larr; BACK) is preserved with closeDifficultyGuide handler'
);

assert(
  diffSelectHTML.includes('id="btn-guide-continue" onclick="handleContinueClick(event)"'),
  'Continue button (CONTINUE TO GAME &rarr;) is preserved with handleContinueClick handler'
);

// 3. Header layout remains clean and balanced
assert(
  diffSelectHTML.includes('class="guide-header"'),
  'guide-header container is maintained'
);
assert(
  diffSelectHTML.includes('id="guide-modal-title"'),
  'guide-modal-title dynamic title element is preserved'
);

// 4. Other modals still retain their close buttons (e.g. educational categories modal)
assert(
  eduCategoriesHTML.includes('class="modal-close-btn" onclick="closePrototypeModal()"'),
  'Unrelated modal close buttons are preserved in other screens'
);

// ========================================================
// Task 2: Signup Page Verification
// ========================================================
console.log('\n--- Task 2: Signup Page Structure & Validation ---');

// 1. Strictly NO phone number or country code
assert(!registerHTML.includes('id="phone"'), 'Signup form does NOT contain a phone input id="phone"');
assert(!registerHTML.includes('id="countryCode"'), 'Signup form does NOT contain countryCode selector');
assert(!registerHTML.includes('name="phone"'), 'Signup form does NOT contain name="phone"');
assert(!registerHTML.includes('name="countryCode"'), 'Signup form does NOT contain name="countryCode"');
assert(!registerHTML.includes('type="tel"'), 'Signup form does NOT contain type="tel" input');

// 2. Strictly NO email field
assert(!registerHTML.includes('name="email"'), 'Signup form does NOT contain name="email"');
assert(!registerHTML.includes('type="email"'), 'Signup form does NOT contain type="email"');

// 3. Required Fields: fullName, username, dob, gender, password, confirmPassword, terms
assert(registerHTML.includes('id="fullName"'), 'Field 1: Full name input (fullName) is present');
assert(registerHTML.includes('id="username"'), 'Field 2: Username input (username) is present');
assert(registerHTML.includes('id="dob"'), 'Field 3: Date of birth input (dob) is present');
assert(registerHTML.includes('id="gender"'), 'Field 4: Gender selector (gender) is present');
assert(registerHTML.includes('id="btn-gender-male"'), 'Male gender selection button is present');
assert(registerHTML.includes('id="btn-gender-female"'), 'Female gender selection button is present');
assert(registerHTML.includes('id="gender-error"'), 'Gender required error indicator is present');
assert(!registerHTML.includes('btn-gender-unspecified'), 'No unspecified or skip gender option exists');
assert(!registerHTML.includes('(OPTIONAL)'), 'Gender is marked required, not optional');
assert(registerHTML.includes('id="password"'), 'Field 5: Password input (password) is present');
assert(registerHTML.includes('id="confirmPassword"'), 'Field 6: Confirm password input (confirmPassword) is present');
assert(registerHTML.includes('id="terms"'), 'Field 7: Terms and conditions checkbox (terms) is present');

// 4. Real password strength calculation (not fake hardcoded bar)
assert(
  registerHTML.includes('function updatePasswordStrength()'),
  'Real password strength calculation function exists'
);
assert(
  registerHTML.includes('strength-bar-1') && registerHTML.includes('strength-bar-4'),
  'Dynamic 4-tier password strength bar elements exist'
);

// 5. Password visibility toggles
assert(
  registerHTML.includes('togglePasswordVisibility'),
  'Password visibility toggle function exists'
);

// 6. Inline validation & server error container (no alert())
assert(
  registerHTML.includes('id="general-alert"'),
  'Inline error container general-alert exists'
);
assert(
  !registerHTML.includes('alert('),
  'Signup JavaScript does not use fake alert() popups'
);

// 7. Real backend connection
assert(
  registerHTML.includes("fetch('/api/auth/signup'"),
  'Signup form submits to real backend /api/auth/signup'
);

// 8. Navigation links
assert(
  registerHTML.includes('href="login.html"'),
  'Signup page contains working link to login.html'
);
assert(
  registerHTML.includes('href="dashboard.html"'),
  'Signup page contains working link to dashboard.html'
);

// ========================================================
// Task 3: Login Page Verification
// ========================================================
console.log('\n--- Task 3: Login Page Structure & Real Authentication ---');

assert(loginHTML.includes('id="username-field"'), 'Login page has username field');
assert(loginHTML.includes('id="password-field"'), 'Login page has password field');
assert(loginHTML.includes('id="toggle-password"'), 'Login page has password visibility toggle');
assert(loginHTML.includes('id="btn-spinner"'), 'Login button has loading spinner');
assert(loginHTML.includes('id="general-alert"'), 'Login page has inline error alert container');
assert(!loginHTML.includes('alert('), 'Login page does not use fake alert() popups');
assert(loginHTML.includes("fetch('/api/auth/login'"), 'Login page submits to real backend /api/auth/login');
assert(loginHTML.includes('href="register.html"'), 'Login page links to register.html');
assert(loginHTML.includes('href="dashboard.html"'), 'Login page links to dashboard.html');

// ========================================================
// Task 5: Dashboard Session Flow & Protection
// ========================================================
console.log('\n--- Task 5: Dashboard Session Flow & Protection ---');

assert(
  dashboardHTML.includes('async function verifySession()'),
  'Dashboard defines verifySession function'
);
assert(
  dashboardHTML.includes("fetch('/api/auth/me'"),
  'Dashboard verifies active session via /api/auth/me'
);
assert(
  dashboardHTML.includes("window.location.replace('login.html')"),
  'Dashboard redirects unauthenticated users to login.html'
);
assert(
  dashboardHTML.includes('async function handleLogout()'),
  'Dashboard defines handleLogout function'
);
assert(
  dashboardHTML.includes("fetch('/api/auth/logout'"),
  'Dashboard logout calls /api/auth/logout to invalidate server session'
);
assert(
  dashboardHTML.includes('id="btn-logout"'),
  'Profile modal includes LOGOUT button'
);
assert(
  dashboardHTML.includes('id="top-cadet-name"'),
  'Dashboard topbar includes dynamic cadet profile name'
);

console.log(`\n========================================================`);
console.log(`UI & Page Architecture Results: ${passed} / ${total} assertions passed.`);
if (passed === total) {
  console.log(`ALL UI & PAGE ARCHITECTURE TESTS PASSED!`);
} else {
  console.error(`SOME TESTS FAILED.`);
  process.exitCode = 1;
}
