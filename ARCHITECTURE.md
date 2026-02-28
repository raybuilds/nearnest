# Architecture

## 1. System Philosophy

NearNest is a corridor-scoped student housing governance system.
Trust is enforced through measurable visibility rules, not manual authority.
Occupancy is identity-bound through a location-encoded public occupant ID.
Behavioral events (complaints, SLA outcomes, incident flags) continuously influence trust.
Governance combines baseline compliance, behavioral scoring, and audit escalation.
Dawn is an interaction layer that executes existing APIs, not a policy override.
Data integrity is enforced at both transaction and database constraint levels.

## 2. Core Architectural Layers

### A. Geographic Layer (Corridors)

- `Corridor` is the smallest enforcement boundary for discovery, complaints, and governance.
- Student demand verification (`VDPEntry`) and unit visibility are corridor-scoped.
- Occupant IDs encode location using `cityCode -> corridorCode -> unit/room mapping`.
- Most cross-role operations enforce corridor consistency before processing.

### B. Identity Layer

- `User` is role-bearing (`student`, `landlord`, `admin`) and JWT-authenticated.
- Role profiles (`Student`, `Landlord`) are separated from auth credentials.
- Occupancy identity is represented by `Occupant.publicId` (12-digit location-bound token).
- Occupancy lifecycle is immutable: check-in creates `Occupancy` + active `Occupant`; check-out closes occupancy and archives occupant (`active=false`).
- Occupant ID is never mutated in-place; each occupancy period gets its own record.
- Slot allocation is concurrency-safe and bounded by capacity + encodable slot limits.

### C. Governance Layer

- Structural baseline: binary approval (`structuralApproved`) backed by checklist truthiness.
- Operational baseline: binary approval (`operationalBaselineApproved`) backed by checklist truthiness.
- Behavioral trust: numeric `trustScore` recalculated from complaint history.
- Visibility gate for student discovery is strict:
  - `status = approved`
  - `structuralApproved = true`
  - `operationalBaselineApproved = true`
  - `trustScore >= 50`
- Audit escalation can force `auditRequired=true` and suspend units on trigger conditions.

### D. Behavioral Engine

Trust logic is deterministic and penalty-based:

- Base score starts at `75`.
- Severity penalty: `severity * 2` per complaint.
- Unresolved penalty: `-5` for unresolved complaints.
- SLA breach penalty: `-3` when resolved after SLA deadline.
- Recurrence penalty (rolling 30-day window): after 3 complaints, each extra complaint applies additional penalty.
- Score is floored at `0`.

This produces explainable, repeatable trust outcomes from behavioral history.

### E. Complaint System

- Complaints are append-only behavioral records; no edit/delete endpoints are exposed.
- Complaint creation can target `unitId` directly or resolve via `occupantId` to `occupantRecordId`.
- Ownership enforcement: students can only file as themselves and within their corridor.
- Enumeration resistance: invalid/unowned occupant IDs return generic invalid responses.
- Resolution is timestamped (`resolvedAt`) and role-gated (landlord/admin).
- Student-facing unit complaint views are aggregate/sanitized while preserving own-history visibility.

### F. Concurrency and Data Integrity

- Database constraints:
  - `Occupant.publicId` unique globally.
  - `@@unique([unitId, roomNumber, occupantIndex, active])` prevents duplicate active slot assignment.
- Check-in is transactional with row-level unit lock (`FOR UPDATE`).
- Capacity enforcement occurs inside the transaction (no over-capacity race window).
- Conflict handling retries on unique conflict (`P2002`) before failing.
- Backfill integrity script (`scripts/backfillOccupants.js`) repairs legacy active occupancies with occupant records using the same transactional strategy.
- Occupancy lifecycle remains immutable and auditable over time.

### G. Media Storage

- Storage is abstracted through `services/storageService.js` (local disk implementation with normalized storage keys).
- Media metadata is stored in `UnitMedia` and served through API, not raw public filesystem paths.
- Submission flow locks evidence (`locked=true`) to prevent post-submission mutation.
- Streaming is RBAC-gated via `/media/:id` with corridor/visibility checks for students.
- Design is local-first with S3-compatible abstraction boundary at service layer.

### H. AI Layer (Dawn)

Dawn is a role-scoped assistant that executes existing routes.
It does not override governance logic.
It does not mutate trust directly.
It does not bypass RBAC.

Additional constraints:

- Dawn requires valid JWT context and infers intents per role.
- It delegates actions through the same backend endpoints used by the product UI.
- All validation, trust recalculation, and policy enforcement still happen in underlying routes/services.

## 3. Security Principles

- Role-based access control (`requireRole`) on protected routes.
- JWT authentication (`verifyToken`) for identity propagation.
- Environment-based secret enforcement (`JWT_SECRET` required at startup).
- No public admin registration (`/auth/register` allows only `student` and `landlord`).
- No public anonymous complaint submission (complaint route requires authenticated student role).
- Enumeration-safe error behavior for occupant-bound complaint submission.
- Complaint records are immutable after creation (resolve-only mutation path).
- Data-level integrity constraints are enforced in PostgreSQL via Prisma schema constraints.

## 4. System Guarantees

- No over-capacity check-in under concurrent requests.
- No duplicate active occupant slot for the same unit/room/index tuple.
- No complaint spoofing across student identities.
- No cross-corridor complaint filing by students.
- No structural/operational approval without checklist truth conditions.
- No student visibility without approved status + both baselines + trust threshold.
- No direct trust override endpoint; trust changes through governed flows.

## 5. Deployment Notes

- Backend requires environment configuration, including:
  - `DATABASE_URL` (PostgreSQL)
  - `JWT_SECRET` (mandatory)
- Frontend API base URL is environment-driven (`NEXT_PUBLIC_API_URL`).
- Apply migrations before runtime (`npx prisma migrate deploy`) and generate client.
- PostgreSQL is required as primary relational store.
- Media is stored locally by default under upload root with abstraction ready for object storage migration.
- Optional integrity repair script available for legacy occupancy backfill (`node scripts/backfillOccupants.js`).
