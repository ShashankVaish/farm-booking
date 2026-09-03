# Farmhouse Party Booking Platform

Indian marketplace for discovering and booking farmhouses, private villas, party houses, pool properties, weekend stays, and event venues.

Phase 1 delivers the backend foundation only: architecture, PostgreSQL + Prisma, authentication, roles, health checks, validation, logging, and tests. The customer frontend, map, booking engine, and Razorpay checkout are intentionally not built yet.

## Stack

- API: NestJS, TypeScript
- Database: PostgreSQL 16 + Prisma ORM
- Auth: JWT access tokens + hashed refresh tokens
- Local infrastructure: Docker Compose

## Repository layout

```text
farm-booking/
  apps/api/          NestJS modular monolith
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
