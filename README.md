# NearNest

NearNest is a role-based housing governance platform with:
- Student discovery and complaint protection
- Landlord operational control
- Admin governance and audit oversight

This repo contains:
- Backend: Node.js + Express + Prisma + PostgreSQL
- Frontend: Next.js 14 (App Router) + Tailwind CSS

## Core Concepts

- Corridor: locality/container for students, units, and institutions
- Unit: rental listing with trust, baseline approvals, checklist evidence, and media
- VDP (Verified Demand Pool): student eligibility gate before unit discovery
- Trust: computed unit trust score and trust band used for visibility/governance
- Complaints: immutable behavioral ledger used for SLA and audit signals
- Audit: governance history with corrective actions and resolution flow

## Role Model

- Student:
  - discover visible units
  - shortlist units
  - file complaints with severity + message
  - view own complaint history and transparent unit trust signals
- Landlord:
  - create/submit units
  - manage checklist and media
  - check in/out occupants
  - resolve complaints for owned units
  - monitor demand/risk signals
- Admin:
  - review/approve/reject/suspend units
  - edit checklist items in audit layer
  - manage audit logs and corrective plans
  - monitor complaint density and governance metrics

## Monorepo Structure

```text
.
├── index.js                  # backend entrypoint (port 5000)
├── routes/                   # Express route modules
├── engines/                  # trust scoring engine
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── seed.js                   # demo data seed script
└── frontend/                 # Next.js app (port 3000)
```

## Prerequisites

- Node.js 18+ (Node 20+ recommended)
- PostgreSQL 14+
- npm

## Environment Variables

Create `.env` in repo root:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/nearnest?schema=public"
JWT_SECRET="replace-with-a-strong-secret"
```

Notes:
- `JWT_SECRET` is required by backend auth middleware.
- Frontend currently calls backend at hardcoded `http://localhost:5000` (`frontend/lib/api.js`).

## Install

Backend deps:

```bash
npm install
```

Frontend deps:

```bash
cd frontend
npm install
```

## Database Setup

Apply migrations:

```bash
npx prisma migrate deploy
```

Generate Prisma client:

```bash
npx prisma generate
```

Seed demo data:

```bash
node seed.js
```

## Run

Backend (root):

```bash
node index.js
```

Frontend (`frontend/`):

```bash
npm run dev
```

Open:
- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:5000/`

## Authentication

- Register: `POST /auth/register` (student or landlord)
- Login: `POST /auth/login`
- Use returned JWT as `Authorization: Bearer <token>`

## Major API Areas

- Corridor and demand:
  - `GET /corridors`
  - `GET /corridor/:corridorId/overview`
  - `GET /corridor/:corridorId/demand`
- Student discovery and trust transparency:
  - `GET /units/:corridorId`
  - `GET /units/:corridorId/hidden-reasons`
  - `GET /student/unit/:id/details`
- Unit lifecycle and governance:
  - `POST /unit`
  - `POST /unit/:id/submit`
  - `PATCH /admin/unit/:id/review`
  - `GET /admin/unit/:id/details`
- Complaints:
  - `POST /complaint`
  - `PATCH /complaint/:complaintId/resolve`
  - `GET /complaints`
  - `GET /unit/:unitId/complaints`
- Occupancy and shortlist:
  - `POST /shortlist`
  - `POST /occupancy/check-in`
  - `PATCH /occupancy/:id/check-out`
- Dawn conversational layer:
  - `POST /dawn/query`

## Demo Tips

- Use seeded users and units after `node seed.js`.
- Test all 3 roles separately in different browser sessions/incognito windows.
- For governance demos, show:
  - complaint creation
  - SLA status changes
  - audit-trigger consequences
  - role-specific unit detail depth

## Known Notes

- Repository currently includes generated frontend build artifacts under `frontend/.next`.
- `routes/index.js` is a legacy route module and is not mounted by `index.js`.

## License

No license file is currently defined.
