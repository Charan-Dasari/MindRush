#!/usr/bin/env node
/**
 * MindRush — Secure Administrator Provisioning Script
 * Provisions an administrator account directly in MongoDB.
 * 
 * Invariants:
 * 1. Must abort if MongoDB is unavailable. Never creates or elevates in memory.
 * 2. Passwords are never accepted via command-line arguments.
 * 3. Password entry is always hidden and interactive.
 * 4. All exit paths close readline interface and Mongoose connections.
 * 
 * Usage:
 *   Interactive:     node server/scripts/create-admin.js
 *   With metadata:   node server/scripts/create-admin.js --username=sysadmin --fullName="System Admin" --dob=1990-01-01 --gender=male
 */

import readline from 'readline';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { connectDB } from '../db.js';
import { User, MongoUserModel } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { hashPassword } from '../utils/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key] = value !== undefined ? value : true;
    }
  });
  return args;
}

export function promptQuestion(rl, query, isHidden = false) {
  return new Promise((resolve, reject) => {
    if (!isHidden || !process.stdin.isTTY) {
      rl.question(query, answer => resolve(answer.trim()));
      return;
    }

    process.stdout.write(query);
    let input = '';
    
    // In raw mode, hide password keystrokes
    const wasRaw = Boolean(process.stdin.isRaw);
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();

    const onData = chunk => {
      const char = chunk.toString();
      if (char === '\n' || char === '\r' || char === '\u0004') {
        if (process.stdin.setRawMode) process.stdin.setRawMode(wasRaw);
        process.stdin.removeListener('data', onData);
        process.stdin.pause();
        process.stdout.write('\n');
        resolve(input.trim());
      } else if (char === '\u0008' || char === '\u007f') { // Backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else if (char === '\u0003') { // Ctrl+C
        if (process.stdin.setRawMode) process.stdin.setRawMode(wasRaw);
        process.stdin.removeListener('data', onData);
        process.stdin.pause();
        process.stdout.write('\n');
        const err = new Error('PROVISIONING_CANCELLED');
        err.code = 'USER_CANCELLED';
        reject(err);
      } else {
        input += char;
        process.stdout.write('*');
      }
    };

    process.stdin.on('data', onData);
  });
}

export function validateDob(dobString) {
  if (!dobString || typeof dobString !== 'string') {
    throw new Error('Date of birth is required.');
  }
  const match = dobString.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error('Invalid date of birth format. Use YYYY-MM-DD.');
  }
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error('Invalid calendar date for date of birth.');
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    throw new Error('Invalid calendar date for date of birth (e.g. non-existent day in month).');
  }

  const now = new Date();
  if (utcDate > now) {
    throw new Error('Date of birth cannot be in the future.');
  }
  if (year < 1900) {
    throw new Error('Date of birth year must be >= 1900.');
  }
  return utcDate;
}

export function validateGender(genderString) {
  if (!genderString || typeof genderString !== 'string') {
    throw new Error("Gender is required. Must be 'male' or 'female'.");
  }
  const normalized = genderString.toLowerCase().trim();
  if (!['male', 'female'].includes(normalized)) {
    throw new Error("Invalid gender. Must be 'male' or 'female'.");
  }
  return normalized;
}

export async function runAdminProvisioning(options = {}, rlInstance = null) {
  const isManagedRL = !rlInstance;
  const rl = rlInstance || readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    // 1. Mandatory MongoDB connection check - Abort if unavailable
    const isConnected = User.isMongoose();
    if (!isConnected) {
      throw new Error('MongoDB connection is unavailable. Administrator accounts cannot be created in in-memory fallback mode.');
    }

    let username = options.username;
    let fullName = options.fullName;
    let dob = options.dob;
    let gender = options.gender;

    // Security requirement: Never accept passwords via CLI arguments
    if (options.password) {
      console.warn('[SECURITY WARNING] Providing passwords via command-line arguments is strictly prohibited. Ignoring argument.');
    }

    if (!username) {
      username = await promptQuestion(rl, 'Enter Admin Username (3-16 chars): ');
    }
    username = (username || '').toLowerCase().trim();

    if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
      throw new Error('Invalid username format: 3-16 alphanumeric or underscore characters required.');
    }

    // Check if user already exists
    const existing = await User.findByUsername(username);
    if (existing) {
      if (existing.role === 'admin') {
        console.log(`[INFO] User '${username}' is already provisioned with role 'admin'.`);
        return { success: true, message: 'already_admin', user: existing };
      }
      console.log(`[INFO] Existing player account '${username}' found. Elevating role to 'admin'...`);
      await MongoUserModel.updateOne({ username }, { role: 'admin' });
      await AuditLog.log({
        actor_id: 'SYSTEM_CLI',
        action: 'ADMIN_ROLE_ELEVATE',
        target_collection: 'users',
        target_id: String(existing._id || existing.id),
        details: {
          username: existing.username,
          previous_role: existing.role,
          new_role: 'admin',
          provisioned_via: 'cli'
        }
      });
      console.log(`[SUCCESS] Account '${username}' elevated to role 'admin'.`);
      return { success: true, message: 'elevated', user: existing };
    }

    if (!fullName) {
      fullName = await promptQuestion(rl, 'Enter Full Name: ');
    }
    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      throw new Error('Full name is required.');
    }

    if (!dob) {
      dob = await promptQuestion(rl, 'Enter Date of Birth (YYYY-MM-DD): ');
    }
    const validatedDob = validateDob(dob);

    if (!gender) {
      gender = await promptQuestion(rl, 'Enter Gender (male/female): ');
    }
    const validatedGender = validateGender(gender);

    // Password must always be entered interactively with masking
    const password = await promptQuestion(rl, 'Enter Admin Password (min 8 chars): ', true);
    const confirm = await promptQuestion(rl, 'Confirm Admin Password: ', true);
    
    if (password !== confirm) {
      throw new Error('Passwords do not match.');
    }
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }

    console.log('[SECURITY] Generating Argon2id password hash...');
    const passwordHash = await hashPassword(password);

    console.log('[PROVISIONING] Creating administrator record in MongoDB...');
    const adminUser = await User.create({
      fullName: fullName.trim(),
      username,
      dob: validatedDob,
      gender: validatedGender,
      passwordHash,
      role: 'admin'
    });

    await AuditLog.log({
      actor_id: 'SYSTEM_CLI',
      action: 'ADMIN_CREATE',
      target_collection: 'users',
      target_id: String(adminUser._id || adminUser.id),
      details: {
        username: adminUser.username,
        fullName: adminUser.fullName,
        role: 'admin',
        provisioned_via: 'cli'
      }
    });

    console.log(`[SUCCESS] Administrator account '${adminUser.username}' created with role 'admin'.`);
    return { success: true, message: 'created', user: adminUser };
  } finally {
    if (isManagedRL) {
      rl.close();
    }
  }
}

async function main() {
  const args = parseArgs();
  console.log('========================================================');
  console.log(' MindRush — Secure Administrator Account Provisioning');
  console.log('========================================================');

  let rl = null;
  try {
    const connected = await connectDB();
    if (!connected || !User.isMongoose()) {
      console.error('[ERROR] MongoDB connection unavailable. Administrator accounts cannot be created in in-memory fallback.');
      process.exitCode = 1;
      return;
    }

    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    await runAdminProvisioning(args, rl);
  } catch (err) {
    console.error(`[ERROR] Provisioning failed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    if (rl) {
      rl.close();
    }
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }
}

// Only execute main when invoked directly via CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
