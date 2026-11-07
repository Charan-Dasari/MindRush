/**
 * MindRush — Authentication Utilities
 * Password hashing with Argon2id and strict input validators
 */

import argon2 from 'argon2';

/**
 * Hash a plaintext password using Argon2id
 * @param {string} password 
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  return await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,       // 3 iterations
    parallelism: 4     // 4 threads
  });
}

/**
 * Verify a plaintext password against an Argon2id hash
 * @param {string} hash 
 * @param {string} password 
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(hash, password) {
  if (!hash || !password) return false;
  try {
    return await argon2.verify(hash, password);
  } catch (err) {
    return false;
  }
}

/**
 * Validate username format and length
 * Requirements: 3-16 chars, letters, numbers, underscores only
 * @param {string} username 
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required.' };
  }
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 16) {
    return { valid: false, error: 'Username must be between 3 and 16 characters.' };
  }
  const usernameRegex = /^[a-zA-Z0-9_]{3,16}$/;
  if (!usernameRegex.test(trimmed)) {
    return { valid: false, error: 'Username may only contain letters, numbers, and underscores.' };
  }
  return { valid: true };
}

/**
 * Validate password length and policy
 * Requirements: at least 8 characters
 * @param {string} password 
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required.' };
  }
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.' };
  }
  if (password.length > 128) {
    return { valid: false, error: 'Password cannot exceed 128 characters.' };
  }
  return { valid: true };
}

/**
 * Validate complete signup form payload
 * Required fields: fullName, username, dob, gender, password, confirmPassword, terms
 * Strictly NO phone number or mobile country code
 * @param {object} payload 
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSignupPayload(payload = {}) {
  const errors = [];

  // Reject phone number field if erroneously sent
  if (payload.phone !== undefined || payload.mobile !== undefined || payload.countryCode !== undefined) {
    errors.push('Phone numbers are not collected or permitted in MindRush.');
  }

  // 1. Full Name
  if (!payload.fullName || typeof payload.fullName !== 'string' || !payload.fullName.trim()) {
    errors.push('Full name is required.');
  } else if (payload.fullName.trim().length > 100) {
    errors.push('Full name cannot exceed 100 characters.');
  }

  // 2. Username
  const userCheck = validateUsername(payload.username);
  if (!userCheck.valid) {
    errors.push(userCheck.error);
  }

  // 3. Date of Birth
  if (!payload.dob) {
    errors.push('Date of birth is required.');
  } else {
    const dobDate = new Date(payload.dob);
    if (isNaN(dobDate.getTime())) {
      errors.push('Date of birth must be a valid date.');
    } else if (dobDate > new Date()) {
      errors.push('Date of birth cannot be in the future.');
    }
  }

  // 4. Gender (Required: Male or Female)
  if (payload.gender === undefined || payload.gender === null || String(payload.gender).trim() === '') {
    errors.push('Gender is required. Please select Male or Female.');
  } else {
    const trimmed = String(payload.gender).trim().toLowerCase();
    const allowedGenders = ['male', 'female'];
    if (!allowedGenders.includes(trimmed)) {
      errors.push('Please select a valid gender option (Male or Female).');
    }
  }

  // 5. Password
  const passCheck = validatePassword(payload.password);
  if (!passCheck.valid) {
    errors.push(passCheck.error);
  }

  // 6. Confirm Password
  if (payload.password !== payload.confirmPassword) {
    errors.push('Passwords do not match.');
  }

  // 7. Terms & Conditions
  if (!payload.terms || payload.terms === 'false' || payload.terms === false) {
    errors.push('You must agree to the Terms of Flight and Privacy Protocol.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
