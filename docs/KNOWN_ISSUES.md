# MindRush Known Issues & Limitations Register

This document tracks known technical limitations, non-blocking edge cases, and deferred architectural improvements identified during development and testing.

---

## 1. Active Known Issues

| ID | Component | Severity | Description | Impact | Recommended Next Action |
|---|---|---|---|---|---|
| **ISSUE-01** | `PyMuPDF` (`fitz`) | Low | Deprecation warning: *"The `fitz` API is deprecated and will be removed in future. Use `import pymupdf` instead."* | Warning logged during FastAPI startup. Non-breaking. | Replace `import fitz` with `import pymupdf as fitz` in `pdf_extractor.py`. |
| **ISSUE-02** | `Pydantic V2` Constraints | Low | Deprecation warning: `min_items` and `max_items` used instead of `min_length` and `max_length`. | Warning logged during pytest test execution. Non-breaking. | Update `schema_validator.py` field definitions to use `min_length=4, max_length=4`. |
| **ISSUE-03** | Mongoose Reserved Key | Low | Warning: *"`errors` is a reserved schema pathname and may break some functionality."* in `ValidationResult.js`. | Warning logged during Mongoose model compilation. Non-breaking. | Pass `{ suppressReservedKeysWarning: true }` in schema options or rename field to `validation_errors`. |
| **ISSUE-04** | Ollama Thinking Mode | Medium | Ollama `qwen3.5:4b` defaults to internal `<think>` reasoning tags, which consumed token budget and broke JSON parsing. | Resolved by setting `think: false` and `num_predict: 1024` in `ollama_client.py`. | Maintain explicit `think: false` configuration for all structured JSON generation endpoints. |
| **ISSUE-05** | Third-Party PDF Copyright | High (Distribution) | Educational Olympiad PDFs in `dataset/` cannot be redistributed under open-source licenses. | Potential copyright infringement if committed to public GitHub. | All `*.pdf` files in `dataset/` excluded via `.gitignore`; replaced with instructions in `dataset/README.md`. |
| **ISSUE-06** | AuditLog Immutability | Low | AuditLog append-only semantics are enforced at the application layer (Mongoose hooks), not database DBA layer. | Direct database shell access could bypass hooks. | Provision insert-only role in production MongoDB Atlas deployments. |
