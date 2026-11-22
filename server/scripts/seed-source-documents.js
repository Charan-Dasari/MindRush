/**
 * MindRush — Source Documents Seed Script (T041)
 * Parses the 4 CMO PDF papers in MindRush-AI/dataset/standard 1/mathematics/
 * into source_documents and source_questions collections.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { SourceDocument } from '../models/SourceDocument.js';
import { SourceQuestion } from '../models/SourceQuestion.js';
import { aiClient } from '../services/ai-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATASET_DIR = path.resolve(__dirname, '..', '..', 'MindRush-AI', 'dataset', 'standard 1', 'mathematics');

const PDF_FILES = [
  'Class-1_31.pdf',
  'class_1_0.pdf',
  'CMO-previous-year-for-Class-1.pdf',
  'CMO-Sample-Paper-for-Class-1.pdf'
];

export async function seedSourceDocuments() {
  console.log('[SEED] Ingesting CMO Standard 1 Mathematics source documents...');
  let totalSeededQuestions = 0;

  for (const filename of PDF_FILES) {
    const fullPath = path.join(DATASET_DIR, filename);
    if (!fs.existsSync(fullPath)) {
      console.warn(`[SEED] File not found: ${fullPath}`);
      continue;
    }

    const fileBuffer = fs.readFileSync(fullPath);
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    let doc = await SourceDocument.findOne({ file_path: fullPath });
    if (!doc) {
      doc = await SourceDocument.create({
        filename,
        file_path: fullPath,
        file_hash: fileHash,
        file_format: 'pdf',
        curriculum_id: 'cmo_std_1_math',
        standard: 1,
        subject: 'Mathematics',
        license_info: 'Educational olympiad material used for reference modeling',
        processing_status: 'pending'
      });
    }

    // Call extraction endpoint or parse locally
    try {
      const extRes = await aiClient.extractDocument({ file_path: fullPath });
      const extractedQs = extRes.questions || [];

      // Remove previously seeded questions for this doc
      await SourceQuestion.deleteMany({ document_id: doc._id });

      const sqDocs = extractedQs.map(q => ({
        document_id: doc._id,
        question_text: q.question_text,
        options: q.options || [],
        correct_answer: null,
        has_answer_key: false,
        curriculum_id: 'cmo_std_1_math',
        standard: 1,
        subject: 'Mathematics',
        topic: 'Olympiad Reference'
      }));

      if (sqDocs.length > 0) {
        await SourceQuestion.insertMany(sqDocs);
      }

      await SourceDocument.findByIdAndUpdate(doc._id, {
        processing_status: 'extracted',
        extracted_question_count: sqDocs.length
      });

      console.log(`[SEED] ${filename}: Extracted ${sqDocs.length} questions`);
      totalSeededQuestions += sqDocs.length;
    } catch (err) {
      console.error(`[SEED] Extraction error for ${filename}:`, err.message);
      await SourceDocument.findByIdAndUpdate(doc._id, {
        processing_status: 'error'
      });
    }
  }

  console.log(`[SEED] Complete. Total source reference questions seeded: ${totalSeededQuestions}`);
  return totalSeededQuestions;
}

if (process.argv[1] && process.argv[1].endsWith('seed-source-documents.js')) {
  seedSourceDocuments()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
