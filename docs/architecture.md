# Architecture

Farmhouse Party Booking is a modular NestJS monolith. One deployable API owns the domain, database, and authorization. A Next.js client will be added in later phases; it will never be the source of truth for price, availability, payment status, or roles.

## Goals

- Production-grade foundations before product UI
- Backend-enforced authorization for CUSTOMER, OWNER, and ADMIN
- Database-level protection against double booking
- Server-calculated pricing and server-verified payments in later phases
- Location fields ready for map discovery (latitude / longitude, city, state)

## High-level shape

```text
Client (apps/web, Phase 2+)
    |
    v
NestJS API  (apps/api)
    |
    +-- Auth / Users / Roles
    +-- Properties / Search / Availability (later)
    +-- Bookings / Payments (later)
    +-- Reviews / Wishlist / Notifications (later)
    |
    v
PostgreSQL
```

## Frontend (Phase 2)

`apps/web` is a Next.js App Router site. It owns presentation, routing, and a typed API client. It is never the source of truth for price, availability, payment status, or roles.

Phase 2 includes the design token system, application shell, reusable UI, and placeholder routes. Search, booking, and portals are later phases.


## Modules (Phase 1)

| Module | Responsibility |
| --- | --- |
| `config` | Validated environment variables |
| `prisma` | Database client lifecycle |
| `health` | Liveness plus database check |
| `auth` | Register, login, logout, JWT, refresh tokens, roles |
| `payments` | Provider interface only (`PaymentProvider` → `RazorpayProvider` stub) |
| `common` | Filters, interceptors, guards, decorators, error envelope |

Future HTTP surfaces will live under:

- `/api/properties/*`
- `/api/search/*`
- `/api/availability/*`
- `/api/bookings/*`
- `/api/payments/*`
- `/api/reviews/*`
- `/api/wishlist/*`
- `/api/owner/*`
- `/api/admin/*`

## API envelope

Success:

```json
{
  "success": true,
  "data": {}
}
```

Failure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

Stack traces, password hashes, and secrets are never returned. Validation details may appear outside production.

## Authentication

- Passwords hashed with bcryptjs (cost from `BCRYPT_ROUNDS`)
- Short-lived JWT access tokens in the `Authorization: Bearer` header
- Refresh tokens stored as SHA-256 hashes; raw token is httpOnly cookie
- Logout revokes the current refresh token
- Global `JwtAuthGuard` with `@Public()` opt-out
- `RolesGuard` with `@Roles(...)`; ADMIN is allowed on owner-restricted routes
- Admin cannot be self-registered

Authorization is enforced in the API. Frontend role checks will be UX only.

## Data model

Core: User, OwnerProfile, Property, PropertyImage, Amenity, PropertyAmenity, Availability, Booking, Payment, Review, WishlistItem, Notification, SupportTicket, Coupon, RefreshToken.

Prepared for later: OwnerPayout, Commission, Refund, AuditLog, PropertyDocument.

Property statuses: DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, SUSPENDED.

Booking statuses: PENDING, PAYMENT_PENDING, CONFIRMED, CANCELLED, COMPLETED, FAILED, REFUNDED.

Payment statuses: CREATED, PENDING, SUCCESS, FAILED, REFUNDED.

Money uses `Decimal(12, 2)`. Coordinates use `Decimal(10, 7)` so map search can be added without a schema rewrite.

## Double booking

Two complementary constraints:

1. `Availability` is unique on `(propertyId, date)`.
2. `BookingNight` is unique on `(propertyId, date)`.

The booking engine (Phase 8) must insert one `BookingNight` row per occupied date inside a transaction. A concurrent insert for the same night fails uniqueness and cannot confirm a second booking. Availability rows are the calendar view (AVAILABLE / BOOKED / BLOCKED); they are not trusted from the client.

PostgreSQL exclusion constraints on booking date ranges can still be added later as defense in depth.

## Pricing (later)

The server will compute:

base + weekend/seasonal + extra guests + platform fee − coupon = total.

The client may display estimates. Confirmed amounts always come from the API.

## Payments (later)

```text
PaymentProvider
    └── RazorpayProvider
```

Bookings are confirmed only after server-side provider verification. A frontend “success” callback is never sufficient.

## Security baseline

- Helmet, CORS allowlist, cookie parser
- Global validation pipe (`whitelist`, `forbidNonWhitelisted`)
- Throttling (stricter on auth routes)
- Pino request logs with password / authorization redaction
- Secrets only from environment variables
- Parameterized Prisma queries

## Indexing

Indexes exist for city + status, coordinates, property type, customer bookings, owner property lists, payment lookup, and review listing. These support the search and dashboard queries planned for later phases.

## Testing

- Unit: env validation, password hashing, auth service, roles guard
- e2e: health, error envelope, register / login / me

## Out of scope for Phase 1

Frontend, map tiles, booking HTTP API, live Razorpay, media uploads, owner/admin UI, notifications delivery, and production deployment (Caddy, hardening audit).
