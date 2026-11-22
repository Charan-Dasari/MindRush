# Educational Source Materials Directory

This directory is designated for educational source material papers (such as Crest Mathematics Olympiad past papers and sample question sets) used by the MindRush AI extraction and reference modeling pipeline.

## Public Distribution & Copyright Compliance

Original third-party competition papers and proprietary educational PDFs are **strictly excluded from Git tracking** (`.gitignore`) to respect intellectual property and publication rights.

## How to Ingest Source Materials for Development:

1. Place your permitted Standard 1 Mathematics Olympiad PDF papers into:
   `MindRush-AI/dataset/standard 1/mathematics/`
2. Run the automated source ingestion and extraction script:
   ```bash
   node server/scripts/seed-source-documents.js
   ```
3. The system will:
   - Compute deterministic SHA-256 integrity checksums for each document.
   - Enforce canonical path containment (preventing path traversal).
   - Extract question stems and options using PyMuPDF.
   - Populate `source_documents` and `source_questions` in MongoDB as few-shot reference context.
