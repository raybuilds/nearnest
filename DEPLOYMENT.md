# NearNest Deployment Guide

## Architecture

- Frontend: Vercel, deployed from `frontend/`
- Backend: Render or Railway, deployed from repo root
- Database: PostgreSQL via Neon or Supabase

## Backend Environment Variables

- `DATABASE_URL`
- `JWT_SECRET`
- `PORT`
- `FRONTEND_ORIGIN`
- `ALLOWED_ORIGINS`
- `API_BASE_URL`
- `UPLOAD_ROOT`

## Frontend Environment Variables

- `NEXT_PUBLIC_API_URL`

## Deployment Steps

1. Deploy the backend from the repo root.
   - Build command: `npm install`
   - Start command: `npm start`

2. Run Prisma migrations on the backend environment.

```bash
npm run prisma:migrate:deploy
```

3. Seed the database if you want demo data.

```bash
npm run seed
```

4. Deploy the frontend from `frontend/` as a separate Vercel project.

5. Set environment variables.
   - Backend:
     - `DATABASE_URL`
     - `JWT_SECRET`
     - `PORT`
     - `FRONTEND_ORIGIN`
     - optional: `ALLOWED_ORIGINS`, `API_BASE_URL`, `UPLOAD_ROOT`
   - Frontend:
     - `NEXT_PUBLIC_API_URL`

6. Test the deployment end to end.

## Validation Commands

Backend health check:

```bash
curl https://your-backend-url/health
```

Login test:

```bash
curl -X POST https://your-backend-url/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@nearnest.com\",\"password\":\"admin123\"}"
```

Frontend API fetch test:

```bash
curl https://your-backend-url/corridors
```

Dawn interaction test:

```bash
curl -X POST https://your-backend-url/dawn/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d "{\"message\":\"Explain trust score for unit 101\"}"
```

## Operational Notes

- `uploads/` is still local-only storage.
- For real production durability, replace local storage with S3, Cloudinary, or another object store.
- Rotate `JWT_SECRET` and other sensitive credentials regularly.
- Keep `.env` files out of Git and configure environment variables in the hosting platform.
