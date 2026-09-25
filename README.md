# Farmhouse Party Booking Platform

Indian platform for discovering and booking farmhouses, private villas, party houses, pool properties, weekend stays, and event venues.

Phase 1 delivers the backend foundation. Phase 2 adds the Next.js customer shell, design tokens, and reusable UI. Search, maps, booking, and dashboards are still later phases.

## Stack

- API: NestJS, TypeScript
- Web: Next.js, TypeScript
- Database: PostgreSQL 16 + Prisma ORM
- Auth: JWT access tokens + hashed refresh tokens
- Local infrastructure: Docker Compose

## Repository layout

```text
farm-booking/
  apps/api/          NestJS modular monolith
  apps/web/          Next.js customer site + design system
  docs/              Architecture notes
  docker-compose.yml PostgreSQL (and optional API profile)
  .env.example       Environment template
```

## Prerequisites

- Node.js 22+
- Docker Desktop
- npm 11+

## Setup

1. Copy environment files:

```powershell
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
```

Replace `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` with unique 32+ character secrets before any shared or production use.

2. Start PostgreSQL:

```powershell
docker compose up -d postgres
```

3. Install API dependencies, generate the Prisma client, and run migrations:

```powershell
cd apps/api
npm install
npx prisma generate
npx prisma migrate dev
```

4. Start the API:

```powershell
npm run start:dev
```

The API listens on `http://localhost:3001`.

5. Start the frontend:

```powershell
cd apps/web
npm install
npm run dev
```

The site listens on `http://localhost:3000`. Open `/design-system` to review tokens and components.

6. Optional: load sample listings for development:

```powershell
npm run db:seed:dev              # from the repo root
npm run db:seed:dev -- --reset   # remove the sample data again
```

This adds 8 approved sample listings (Lonavala, Alibaug, Pune, Goa, Udaipur, Jaipur, Gurugram, Karjat) with placeholder photos, amenities and a few blocked dates, plus three logins, all with the password `DevPass123!`: `meera.host@dev.baagly.test` and `arjun.host@dev.baagly.test` (hosts) and `guest@dev.baagly.test` (guest). Running it again refreshes the same rows instead of duplicating them.

It is development-only: the script (`apps/api/scripts/dev-seed.ts`) is not copied into the production Docker image, and it refuses to run when `NODE_ENV=production` or when `DATABASE_URL` points anywhere other than `localhost`.

## Health check

```powershell
curl http://localhost:3001/health
```

Expected shape:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "farmhouse-api",
    "database": "up"
  }
}
```

## Auth endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Create CUSTOMER or OWNER account |
| POST | `/api/auth/login` | Public | Issue access token + refresh cookie |
| POST | `/api/auth/logout` | Public | Revoke refresh token |
| GET | `/api/auth/me` | Bearer JWT | Current authenticated user |

Self-registration cannot create `ADMIN` accounts. Owner registration also creates an `OwnerProfile`.

## Quality commands

From `apps/web`:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

From `apps/api`:

```powershell
npm run typecheck
npm run lint
npm test
npm run test:e2e
npx prisma validate
```

## Environment

See `.env.example`. Real `.env` files are gitignored. Never commit secrets, payment credentials, or database passwords used outside local development.

## Phase 1 boundaries

Not included yet:

- Next.js frontend / design system
- Search, filters, and map UI
- Property, booking, review, and payment HTTP APIs
- Razorpay live integration
- Owner/admin dashboards
- Media uploads
