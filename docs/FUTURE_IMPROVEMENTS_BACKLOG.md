# MindRush Feature 001 — Future Improvements & Non-Blocking Backlog

This backlog records non-blocking improvements and deferred items identified during Phase 1–8 implementation:

1. **Database-Level AuditLog Immutability**
   - *Current Implementation:* Immutability and append-only guarantees are enforced at the application/model layer (blocking Mongoose update/delete queries, document hooks, and bulkWrite).
   - *Deferred Item:* Configure MongoDB Atlas insert-only user role to enforce immutability at the raw database DBA level.

2. **Network/Proxy CSRF Boundary Extension**
   - *Current Implementation:* Enforced via `X-Requested-With: MindRush-Admin` custom header and Origin/Referer header verification against untrusted hosts.
   - *Deferred Item:* Supplement with double-submit cookie or synchronizer token pattern for non-browser HTTP clients if direct external API integrations are authorized.

3. **Session Cookie Production Flag**
   - *Current Implementation:* Dynamically configured to `secure: true` when `NODE_ENV === 'production'`.
   - *Deferred Item:* Enforce HSTS and secure cookie pre-conditions strictly at reverse-proxy boundary.

4. **Multi-Format Document Parsing (Phase 3b)**
   - *Current Implementation:* Strictly restricted to `.pdf` format.
   - *Deferred Item:* Ingest `.xlsx`, `.xls`, and `.docx` source materials in future expansion phases.

5. **Pydantic V2 Field Constraint Deprecation Warnings**
   - *Current Implementation:* `min_items` and `max_items` used in `schema_validator.py`.
   - *Deferred Item:* Transition syntax cleanly to `min_length` and `max_length` in future Pydantic upgrades.
