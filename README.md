# NearNest

NearNest is a role-aware housing governance platform with three depth layers:
- Student: discovery + transparency + protection
- Landlord: operational control
- Admin: governance and enforcement oversight

It combines unit discovery, trust scoring, complaint-led governance, audits, occupancy, media evidence, and a conversational query layer (Dawn).

## Tech Stack

- Backend: Node.js, Express, Prisma, PostgreSQL, JWT auth
- Frontend: Next.js 14 (App Router), React 18, Tailwind CSS
- Storage: local disk abstraction via `services/storageService.js` + `UnitMedia` metadata in Postgres

## Monorepo Layout

```text
.
|-- index.js                         # backend entrypoint (port 5000)
|-- routes/                          # API routes (auth, unit, complaint, profile, etc.)
|-- engines/trustEngine.js           # trust scoring logic
|-- services/                        # storage + occupant ID helpers
|-- scripts/backfillOccupants.js     # one-time data repair helper
|-- prisma/
|   |-- schema.prisma
|   `-- migrations/
|-- seed.js                          # demo dataset + credentials
`-- frontend/                        # Next.js app (port 3000)
    |-- app/
    |-- components/
    `-- lib/api.js
```

## Core Domain Model

- Corridor: parent geography for students, units, institutions
- Unit: listing with status, trust score, baseline flags, checklist state, and media
- VDPEntry: Verified Demand Pool gating for student discovery
- Complaint: immutable behavioral event (severity/SLA/incident flags)
- AuditLog: governance actions and corrective plans
- Occupancy: check-in/out lifecycle
- Occupant: privacy-preserving, location-encoded public occupancy ID
- UnitMedia: media metadata with lockable evidence lifecycle

## Governance Model

- Trust Band:
  - `hidden` when trust score < 50
  - `standard` when 50-79
  - `priority` when 80+
- Visibility to students requires:
  - `status = approved`
  - `structuralApproved = true`
  - `operationalBaselineApproved = true`
  - `trustScore >= 50`
- Complaint pressure can trigger audit-required and suspension logic.

## Occupant ID System

12-digit public ID format:

`CC CCC HHH RRR I`

- `CC`: city code (2 digits)
- `CCC`: corridor code (3)
- `HHH`: hostel code (3)
- `RRR`: room number (3)
- `I`: occupant index (1)

Example: `120010280281`

Safety controls:
- Global uniqueness: `publicId @unique`
- Active slot uniqueness: `@@unique([unitId, roomNumber, occupantIndex, active])`
- Check-in is transactional with row lock + retry on `P2002`
- Checkout archives occupant (`active=false`), never deletes

## Roles and UI Depth

- Student:
  - `/dashboard`, `/profile`, `/complaints`, `/unit/{id}`, `/unit/{id}/complaints`
  - sees trust signals, media, availability, sanitized complaint aggregates
  - does not see audit internals or other students' private details
- Landlord:
  - unit creation/submission, checklists, media upload, occupancy check-in/out
  - complaint risk panel and unit operations
- Admin:
  - corridor/institution governance controls
  - unit review and full audit/compliance depth
  - complaint governance console

## Dawn (Conversational Layer)

Endpoint: `POST /dawn/query`

- Parses role-scoped intents from natural language
- Uses modular intent handlers in `services/dawnIntents/`:
  - `studentSearch`
  - `studentComplaintDraft`
  - `studentComplaintSummary`
  - `landlordRecurringIssues`
  - `landlordRiskSummary`
  - `adminCorridorAnalytics`
- Dispatches via intent map in `routes/dawn.js` (no monolithic switch)
- Reads data and routes actions through existing APIs only
- Must not bypass RBAC, validation, trust logic, or DB constraints
- Must not write directly to DB, mutate trust/status directly, or auto-trigger governance actions

Phase 1 Dawn capabilities:
- Student:
  - natural-language smart search (`maxRent`, `ac`, `maxDistance`) using `/units/:corridorId`
  - complaint drafting with automatic occupant/unit binding from authenticated profile context
  - unit complaint health summary (aggregate-only)
- Landlord:
  - recurring issue summary (30-day grouping by incident type)
  - deterministic soft recommendations (rule-based; no auto-action)
  - unit risk summary (trust/audit/density signals)
- Admin:
  - corridor complaint density ranking (30-day window)

Mutation safety:
- Complaint creation is always two-step in Dawn: draft -> confirm -> submit
- No silent submissions

## Environment Setup

### 1) Backend `.env` (repo root)

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/nearnest"
JWT_SECRET="replace-with-strong-secret"
```

### 2) Frontend env (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

`frontend/lib/api.js` reads `NEXT_PUBLIC_API_URL` with localhost fallback.

## Install

From repo root:

```bash
npm install
cd frontend
npm install
cd ..
```

## Database and Seed

```bash
npx prisma migrate deploy
npx prisma generate
node seed.js
```

If legacy occupancy data exists without occupant records:

```bash
node scripts/backfillOccupants.js
```

## Run Locally

Backend (root):

```bash
node index.js
```

Frontend:

```bash
cd frontend
npm run dev
```

URLs:
- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:5000/`

## Demo Credentials (from seed)

- Admin: `admin@nearnest.com` / `admin123`
- Student: `student@nearnest.com` / `student123`
- Student2: `student2@nearnest.test` / `student123`
- Student3: `student3@nearnest.test` / `student123`
- Landlord: `landlord@nearnest.com` / `landlord123`
- Landlord2: `landlord2@nearnest.test` / `landlord123`

## API Surface (Key Routes)

Auth:
- `POST /auth/register`
- `POST /auth/login`

Profile:
- `GET /profile` (role-aware payload)

Corridors / Demand:
- `GET /corridors`
- `GET /corridor/:corridorId/overview`
- `GET /corridor/:corridorId/demand`

Units:
- `POST /unit` (landlord)
- `POST /unit/:id/submit` (landlord)
- `GET /units/:corridorId` (student visible units)
- `GET /units/:corridorId/hidden-reasons` (student transparency)
- `GET /student/unit/:id/details` (student depth)
- `GET /admin/unit/:id/details` (admin depth)

Complaints:
- `POST /complaint` (student; accepts `unitId` or `occupantId`)
- `PATCH /complaint/:complaintId/resolve` (landlord/admin)
- `GET /complaints` (global role-specific dashboards)
- `GET /unit/:unitId/complaints` (unit-local complaint ledger)
  - student summary includes: `complaintsLast30Days`, `activeComplaints`, `avgResolutionHours30d`, `slaBreaches30d`, `trustScore`, `trustBand`

Occupancy:
- `POST /occupancy/check-in` (landlord)
- `PATCH /occupancy/:id/check-out` (landlord)

Media:
- `POST /unit/:id/media` (landlord draft uploads)
- `GET /media/:id` (RBAC-gated media streaming)

Audit / Admin:
- `PATCH /admin/unit/:id/review`
- `POST /admin/unit/:id/audit/trigger`
- `GET /admin/audit/:corridorId`
- `GET /admin/unit/:id/audit-logs`

Dawn:
- `POST /dawn/query`

## Important Invariants

- Complaints are append-only behavioral entries; no delete/edit endpoints
- Trust is system-calculated; no direct trust override endpoint
- Evidence can be locked after submission
- Occupant ID usage in complaints enforces:
  - active occupant record
  - ownership (`occupant.studentId == requester`)
  - corridor consistency
  - generic invalid-ID responses for enumeration resistance

## Operational Notes

- Backend has no `npm run dev` script; run with `node index.js` (or add your own nodemon script).
- `routes/index.js` is legacy and not mounted by `index.js`.
- `.next` should never be committed; cleanup is enforced in `.gitignore`.

## Test Coverage

Backend integration tests use Node test runner (`node --test tests/*.test.js`) and cover:
- auth/profile flow
- complaint ownership security checks
- occupancy concurrency invariants
- Dawn Phase 1 intents (student, landlord, admin)
- Dawn negative cases (no active occupancy complaint attempt, cross-landlord targeting rejection)

## Troubleshooting

- `Invalid or expired token`:
  - ensure backend uses the same `JWT_SECRET` as when token was issued
  - logout/login to refresh token
- Next.js `Cannot find module './XYZ.js'` in `.next`:
  - stop frontend process
  - delete `frontend/.next`
  - restart `npm run dev`
- Prisma `EPERM` on Windows generate:
  - stop backend process (DLL lock), then rerun `npx prisma generate`
- Prisma migration drift warning (`migrate dev` reset prompt):
  - use `npx prisma migrate deploy` for non-destructive apply

## Security and Privacy Boundaries

- Student views are sanitized and aggregate-driven
- No other-student identity exposure on complaint timelines in student views
- Landlord/admin have broader operational/governance visibility based on RBAC
- Media access passes through `/media/:id` checks (not direct filesystem exposure)

## License

No license file is currently present.
