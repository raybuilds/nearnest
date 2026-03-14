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
- Dawn route is modular and intent-mapped (no giant switch):
  - `student_search` -> `studentSearch`
  - `student_complaint` -> `studentComplaintDraft`
  - `student_complaint_summary` -> `studentComplaintSummary`
  - `landlord_recurring` -> `landlordRecurringIssues`
  - `landlord_risk` -> `landlordRiskSummary`
  - `admin_density` -> `adminCorridorAnalytics`
  - `explain_unit_trust` -> `explainUnitTrust`
- It delegates actions through the same backend endpoints used by the product UI.
- All validation, trust recalculation, and policy enforcement still happen in underlying routes/services.
- Dawn is non-authoritative:
  - no direct DB writes from Dawn handlers
  - no direct trustScore writes
  - no direct unit status updates
  - no automatic audit triggers
  - no structural/operational approval actions
- Mutation operations are confirmation-gated (draft -> explicit confirm -> API call).
- Soft recommendations are deterministic and rule-based:
  - water complaints >= 3 (30d) -> suggest plumbing review
  - SLA breaches >= 2 -> suggest response-process review
  - rising 14d complaint trend -> suggest monitoring
- Complaint intent supports common-area reporting by tagging `incidentType="common_area"` while still binding to an active unit context.

### I. NearNest Intelligence Layer

NearNest Intelligence is a dedicated deterministic reasoning layer under `services/intelligence/`.
It separates business intelligence and decision engines from route handlers, UI-facing orchestration, and infrastructure services.

- This layer contains the engines Dawn uses to:
  - analyze housing behavior
  - rank housing options
  - generate corridor and unit insights
  - explain trust changes
  - recommend operational remediation priorities
- Core modules in this layer include:
  - `services/intelligence/dawnInsightsEngine.js`
  - `services/intelligence/dawnRanking.js`
  - `services/intelligence/dawnCorridorInsightService.js`
  - `services/intelligence/dawnRemediationService.js`
  - `services/intelligence/dawnUnitHealthService.js`
  - `services/intelligence/trustExplanationService.js`
- This keeps the architecture cleanly separated into:
  - interface logic
  - decision intelligence
  - infrastructure services
- Infrastructure services such as storage, occupant identity generation, and Prisma wiring remain outside the intelligence layer.

### Dawn Insight Engine

NearNest uses a rule-based Dawn insight engine rather than an ML model for operational intelligence.
This keeps proactive guidance transparent, deterministic, and easy to audit.

- `services/intelligence/dawnInsightsEngine.js` evaluates current role context and returns explainable situational insights.
- `GET /dawn/insights` builds that context through existing authenticated APIs only.
- Student insights focus on active unit trust decline and unresolved complaints.
- Landlord insights focus on recurring complaints and SLA delay patterns.
- Admin insights focus on rising corridor complaint density and units nearing suspension.
- `services/intelligence/trustExplanationService.js` explains trust using visible drivers such as complaint recurrence, SLA breaches, unresolved complaints, and severity.
- Dawn does not query Prisma directly for these flows and does not perform trust or audit mutations.

### Dawn System Health Query

Dawn also supports a student-facing system health query for the currently occupied unit.
This feature summarizes housing conditions using existing authenticated APIs only, combining trust score, complaint volume, unresolved issues, and SLA performance into a read-only operational report.

- `services/intelligence/dawnUnitHealthService.js` builds a deterministic unit health report from `/profile`, `/unit/:id/complaints`, and `/units/:corridorId`.
- The report classifies the unit into `healthy`, `watch`, or `risk` bands using trust score thresholds and highlights recurring complaints or response delays as risk signals.
- The feature is informational only:
  - no trust score recalculation
  - no governance state mutation
  - no audit or enforcement side effects
- Dawn returns this as a structured `healthReport` payload so the frontend can render a dedicated card for operational transparency.

### Dawn Corridor Insight Engine

NearNest also supports corridor-wide behavioral insight generation through Dawn.
This capability analyzes recent complaint patterns, unit trust distribution, and SLA delay signals across a corridor to identify emerging housing risks before they become governance incidents.

- `services/intelligence/dawnCorridorInsightService.js` reads corridor context from existing APIs and applies deterministic insight rules.
- Corridor behavioral metrics are exposed through the existing corridor overview surface so Dawn can remain API-only and read-only.
- Insight generation focuses on:
  - recurring incident categories such as water complaints
  - units approaching the trust visibility threshold
  - increasing SLA breach patterns across the corridor
- The feature is observational only and does not trigger audits, trust recalculations, or suspension state changes.

### Dawn Remediation Advisor

NearNest also includes a landlord-facing Dawn remediation advisor.
This module analyzes behavioral housing data for the landlord's own units and recommends which operational issues should be fixed first.

- `services/intelligence/dawnRemediationService.js` computes a deterministic unit risk score from recent complaint volume, SLA breaches, unresolved complaints, and low trust score penalties.
- Dawn ranks units by remediation priority and returns the top items with specific operational recommendations.
- Recommendation logic is rule-based and explainable:
  - recurring complaints -> inspect infrastructure
  - repeated SLA breaches -> improve complaint response handling
  - unresolved complaints -> clear pending issues to stabilize trust
- The advisor is read-only and does not modify trust, governance, or enforcement state.

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
