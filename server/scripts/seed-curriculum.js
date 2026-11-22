#!/usr/bin/env node
/**
 * MindRush — Curriculum and Counter Seed Script
 * 
 * Initializes:
 * 1. Standard 1 Mathematics CMO Curriculum record (curricula collection)
 *    - Academic year is optional metadata (defaults to null, not hardcoded).
 *    - Does not overwrite existing curriculum records on repeated runs.
 * 2. Atomic counter for published question IDs (counters collection, starting at 1000)
 *    - Uses $setOnInsert so repeated runs never reset existing counters.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { connectDB } from '../db.js';
import { Curriculum, MongoCurriculumModel } from '../models/Curriculum.js';
import { Counter, MongoCounterModel } from '../models/Counter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const CMO_CURRICULUM_DATA = {
  curriculum_id: 'cmo-math-olympiad',
  name: 'Crest Mathematics Olympiad',
  board: 'CREST',
  country: 'India',
  academic_year: null, // Preserved as optional metadata, not hardcoded
  syllabus_version: 'v1.0',
  standards: [
    {
      standard: 1,
      subjects: [
        {
          subject_id: 'mathematics',
          name: 'Mathematics',
          topics: [
            {
              topic_id: 'addition',
              name: 'Addition',
              subtopics: [
                {
                  subtopic_id: 'single-digit-addition',
                  name: 'Single Digit Addition (0-9)',
                  learning_outcomes: [
                    'Understand concept of addition as combining quantities',
                    'Solve single-digit addition without carry'
                  ],
                  allowed_concepts: ['numbers 0-9', 'plus sign', 'equals sign'],
                  prerequisite_concepts: ['number recognition 0-9', 'counting']
                }
              ],
              difficulty_definitions: {
                easy: 'Addition of two single-digit numbers with sum <= 10 (e.g. 4 + 3)',
                medium: 'Word problem addition with sums <= 15 (e.g. 3 apples + 4 apples)',
                hard: 'Missing addend single-digit addition (e.g. 4 + ? = 9)'
              }
            },
            {
              topic_id: 'subtraction',
              name: 'Subtraction',
              subtopics: [
                {
                  subtopic_id: 'single-digit-subtraction',
                  name: 'Single Digit Subtraction (0-9)',
                  learning_outcomes: [
                    'Understand concept of subtraction as taking away',
                    'Solve single-digit subtraction without borrow'
                  ],
                  allowed_concepts: ['numbers 0-9', 'minus sign', 'equals sign'],
                  prerequisite_concepts: ['number recognition 0-9', 'counting backward']
                }
              ],
              difficulty_definitions: {
                easy: 'Direct subtraction of two numbers <= 10 (e.g. 8 - 3)',
                medium: 'Word problem subtraction with numbers <= 10',
                hard: 'Two-step basic word problems'
              }
            },
            {
              topic_id: 'numerals',
              name: 'Numerals & Number Sense',
              subtopics: [
                {
                  subtopic_id: 'tens-and-ones',
                  name: 'Tens and Ones / Before & After',
                  learning_outcomes: [
                    'Identify numbers up to 100',
                    'Understand tens and ones place value',
                    'Identify numbers before, after, and between'
                  ],
                  allowed_concepts: ['numbers 1-100', 'tens and ones'],
                  prerequisite_concepts: ['number recognition 0-20']
                }
              ],
              difficulty_definitions: {
                easy: 'Number before or after a given 2-digit number (e.g. after 58)',
                medium: 'Place value identification: X tens and Y ones',
                hard: 'Comparison: which number is greatest among four 2-digit numbers'
              }
            }
          ]
        }
      ]
    }
  ]
};

export async function seedCurriculumAndCounters() {
  console.log('========================================================');
  console.log(' MindRush — Seeding Curriculum & Atomic Counters');
  console.log('========================================================');

  const connected = await connectDB();
  console.log(connected ? '[DB] Connected to MongoDB.' : '[DB] Operating in local memory fallback.');

  // 1. Seed Curriculum Idempotently
  console.log('[SEED] Checking curriculum:', CMO_CURRICULUM_DATA.curriculum_id);
  const existingCurr = await Curriculum.findOne({ curriculum_id: CMO_CURRICULUM_DATA.curriculum_id });
  let curriculumSeeded = false;
  if (existingCurr) {
    console.log(`[SEED] Curriculum '${CMO_CURRICULUM_DATA.curriculum_id}' already exists. Preserving existing record.`);
  } else {
    await Curriculum.create(CMO_CURRICULUM_DATA);
    console.log(`[SUCCESS] Curriculum '${CMO_CURRICULUM_DATA.curriculum_id}' seeded successfully.`);
    curriculumSeeded = true;
  }

  // 2. Initialize Atomic Counter Idempotently
  console.log('[SEED] Initializing sequence counter: published_question_id = 1000');
  const counter = await Counter.initSequence('published_question_id', 1000);
  console.log(`[SUCCESS] Counter initialized: ${counter._id || 'published_question_id'} = ${counter.seq}`);

  console.log('[SEED] Completed successfully.');
  return {
    curriculumId: CMO_CURRICULUM_DATA.curriculum_id,
    curriculumSeeded,
    counterSeq: counter.seq
  };
}

async function main() {
  try {
    await seedCurriculumAndCounters();
  } catch (err) {
    console.error('[ERROR] Seeding failed:', err);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
