# Node TypeScript Boilerplate

Production-ready Node.js + TypeScript REST API boilerplate with JWT refresh-token rotation, WebSocket support (Socket.io or uWebSockets.js), Redis caching, Prisma ORM, BullMQ job queues, and a full integration test suite.

## Features

- **TypeScript** — strict mode, path aliases, compiled to `dist/`
- **Express** — REST API with global rate limiting, CORS, Helmet, CSRF protection
- **Authentication** — JWT access tokens + refresh-token rotation with reuse detection and per-session revocation
- **WebSockets** — switchable between Socket.io and uWebSockets.js via `SOCKET_DRIVER` env var; HMAC-secured private rooms for 1-to-1 and group sessions
- **Prisma 7** — PostgreSQL via `@prisma/adapter-pg` (driver-adapters engine)
- **Redis** — access-token blacklist, session cache
- **BullMQ** — background job queue backed by Redis; AES-256-GCM encrypted payloads, DB-logged job history, admin REST API, and CLI replay tool
- **Mail** — SendGrid or SMTP via nodemailer
- **Sentry** — optional error tracking with PII scrubbing
- **Docker** — multi-stage Dockerfile, `docker-compose.yml` for Postgres + Redis + app + Prisma Studio
- **Testing** — Vitest integration tests against a real Postgres test DB; unit tests with mocked Prisma/Redis

---

## Prerequisites

- Node.js 20+
- Docker + Docker Compose (for local Postgres and Redis)

---

## Getting Started

### 1. Clone and install

```sh
git clone https://github.com/sumitkumar193/node-typescript-boilerplate.git
cd node-typescript-boilerplate
npm install
```

### 2. Environment variables

```sh
cp .env.example .env
```

| Variable | Description |
|---|---|
| `PORT` | HTTP server port (default `4000`) |
| `SOCKET_DRIVER` | `uWebSocket` or `SocketIO` |
| `SOCKET_PORT` | uWebSockets.js listen port (only used when driver is `uWebSocket`) |
| `JWT_SECRET` | **Required.** Secret for signing access tokens |
| `JOB_ENCRYPTION_KEY` | **Required.** 64-char hex key for AES-256-GCM job payload encryption. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `BULLMQ_DB_LOGGING` | Log job lifecycle events to Postgres (default `false`) |
| `SOCKET_SECRET` | Secret for HMAC room tokens (falls back to `JWT_SECRET` if not set) |
| `SESSION_SECRET` | Cookie/session secret |
| `FRONTEND_URL` | Allowed CORS origin |
| `ALLOWED_ORIGINS` | Comma-separated additional allowed origins |
| `RATELIMIT` | Max requests per minute per IP on `/api/*` (default `100`) |
| `DATABASE_URL` | Postgres connection string |
| `CACHE_DRIVER` | `redis` or `valkey` |
| `REDIS_HOST / PORT / USERNAME / PASSWORD` | Redis connection |
| `MAIL_SERVICE` | `sendgrid` or `smtp` |
| `SENTRY_DSN` | Optional Sentry DSN |

### 3. Start infrastructure

```sh
docker compose up -d postgres redis
```

### 4. Run migrations

```sh
npx prisma migrate dev
```

### 5. Start development server

```sh
npm run dev
```

---

## Docker (full stack)

```sh
# Start everything: Postgres, Redis, app (2 replicas), Prisma Studio
docker compose up -d

# Prisma Studio is exposed on http://localhost:5555
```

The `docker-compose.yml` runs the app with 2 replicas behind a rolling-update policy. Static assets in `./public` are bind-mounted; user uploads use a named `storage` volume.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with `ts-node` + nodemon |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled output |
| `npm test` | Run full test suite (unit + integration) |
| `npm run lint` | ESLint + Prettier |

---

## API Reference

All routes are prefixed with `/api`.

### Auth — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/csrf-token` | — | Issue CSRF token cookie |
| `POST` | `/register` | CSRF | Register new user, returns token pair |
| `POST` | `/login` | CSRF | Login, returns token pair |
| `POST` | `/refresh` | — | Rotate refresh token, returns new token pair |
| `GET` | `/me` | Bearer | Get current user profile |
| `POST` | `/logout` | Bearer + CSRF | Revoke current session |
| `POST` | `/logout/all` | Bearer + CSRF | Revoke all sessions |
| `GET` | `/sessions` | Bearer | List active sessions |
| `DELETE` | `/sessions/:jti` | Bearer + CSRF | Revoke a specific session |
| `GET` | `/verify/:id` | Bearer | Get email verification info |
| `POST` | `/verify/:id` | Bearer + CSRF | Submit email verification |
| `PUT` | `/verify/regenerate` | Bearer + CSRF | Re-send verification email |
| `POST` | `/forgot-password` | CSRF | Send password-reset email |
| `GET` | `/forgot-password/:id` | — | Validate reset token |
| `POST` | `/forgot-password/:id` | CSRF | Reset password |

### Users — `/api/users`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/` | Bearer + Admin | Paginated user list |
| `GET` | `/:id` | Bearer | Get user by ID |
| `POST` | `/:id/disable` | Bearer + Admin + CSRF | Disable a user account |

### Admin Jobs — `/api/admin/jobs`

Requires Bearer token + Admin role.

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | List all registered queues |
| `GET` | `/:name/status` | Queue depth and counts |
| `GET` | `/:queueName/jobs` | Paginated job list for a queue |
| `GET` | `/logs` | Paginated job log history (DB) |
| `POST` | `/:queueName/:jobId/retry` | Retry a failed job |
| `POST` | `/logs/:jobLogId/replay` | Re-enqueue a job from its DB log |

**CLI replay** (bypasses HTTP, requires `JOB_ENCRYPTION_KEY` in env):

```sh
npm run replay-job <jobLogId>
```

---

### Socket Auth — `/api/socket`

HTTP endpoints that issue HMAC tokens for joining private WebSocket rooms.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/private` | Bearer | Get token for a 1-to-1 private room |
| `POST` | `/auth/group/create` | Bearer | Create a group room, get creator token |
| `POST` | `/auth/group/join` | Bearer | Get join token (requires prior `invite-user` socket event) |

---

## WebSocket

### Driver selection

Set `SOCKET_DRIVER` in `.env`:
- `SocketIO` — Socket.io on the same HTTP server port
- `uWebSocket` — uWebSockets.js on `SOCKET_PORT`

### Authentication

Connect with an `accessToken` cookie or send an `identify` event after connection:

```json
{ "event": "identify", "accessToken": "<jwt>" }
```

### Private rooms (1-to-1)

```
1. POST /api/socket/auth/private   { "targetUserId": 42 }
   ← { "roomId": "private-7-42", "token": "<hmac>" }

2. Emit: { "event": "join-private-room", "roomId": "private-7-42", "token": "<hmac>" }
```

Room IDs are canonical (`private-{min}-{max}`) so both participants get the same room regardless of who initiates.

### Group rooms

```
Creator:
1. POST /api/socket/auth/group/create
   ← { "roomId": "group-<uuid>", "token": "<hmac>" }
2. Emit: { "event": "join-private-room", "roomId": "group-<uuid>", "token": "<hmac>" }
3. Emit: { "event": "invite-user", "roomId": "group-<uuid>", "userId": 42 }
   ← target receives: { "event": "invited-to-room", "roomId": "group-<uuid>" }

Invitee:
4. POST /api/socket/auth/group/join   { "roomId": "group-<uuid>" }
   ← { "token": "<hmac>" }
5. Emit: { "event": "join-private-room", "roomId": "group-<uuid>", "token": "<hmac>" }
```

Tokens are HMAC-SHA256 (`SOCKET_SECRET`) bound to `userId:roomId` and verified with `timingSafeEqual`.

### Server-side emit helpers

```typescript
import Socket from '@services/Socket';       // Socket.io
import SocketUWS from '@services/uSocket';   // uWebSockets.js

// Broadcast to all connected clients
Socket.emit('event-name', { data: 'value' });

// Emit to a specific user
Socket.emitToUser(user, 'event-name', { data: 'value' });

// Emit to all users with a specific role
await Socket.emitToRole(role, 'event-name', { data: 'value' });

// Authenticated clients only
Socket.emitToAuthenticated('event-name', { data: 'value' });
```

---

## Testing

Tests use **Vitest** with real Postgres (unit tests mock Prisma/Redis).

### Setup test database

```sh
# Start Postgres container
docker compose up -d postgres

# Create the test DB and apply migrations
$env:DATABASE_URL="postgresql://<user>:<pass>@localhost:5432/<db>_test"
npx prisma migrate deploy
```

Create `.env.test`:
```
DATABASE_URL_TEST=postgresql://<user>:<pass>@localhost:5432/<db>_test
JWT_SECRET=test-secret
FRONTEND_URL=http://localhost:3000
```

### Run tests

```sh
npm test
```

The DB is cleared once at the start of each test run (via Vitest `globalSetup`). After tests finish the data persists — inspect it with:

```sh
# Windows PowerShell
$env:DATABASE_URL="postgresql://<user>:<pass>@localhost:5432/<db>_test"; npx prisma studio
```

### Test structure

```
tests/
├── globalSetup.ts          # One-time DB reset before the full run
├── setup.ts                # Per-file mocks (Mail, CSRF, Redis, rate limiter)
├── routes/
│   ├── AuthRoutes.test.ts  # Integration: auth endpoints against real DB
│   └── UserRoutes.test.ts  # Integration: user endpoints against real DB
└── services/
    ├── RefreshToken.test.ts        # Unit: token rotation logic with mocked Prisma
    └── JobPayloadEncryption.test.ts # Unit: AES-256-GCM job payload encrypt/decrypt
```

---

## Project Structure

```
├── src/
│   ├── index.ts                  # App entry point
│   ├── controllers/              # Request handlers
│   ├── routes/                   # Express routers
│   ├── middlewares/              # Auth, CSRF, rate limiting, RBAC, pagination
│   ├── cli/
│   │   └── replayJob.ts          # CLI: re-enqueue a job by DB log ID
│   ├── jobs/                     # BullMQ job definitions
│   ├── services/
│   │   ├── AuthService.ts        # Registration, login, password reset
│   │   ├── RefreshTokenService.ts # Token rotation, session management
│   │   ├── TokenService.ts       # JWT sign/verify helpers
│   │   ├── SocketAuthService.ts  # HMAC room tokens, group authorization
│   │   ├── Socket.ts             # Socket.io implementation
│   │   ├── uSocket.ts            # uWebSockets.js implementation
│   │   ├── RedisService.ts       # Redis client singleton
│   │   ├── MailService.ts        # Email sending (SendGrid / SMTP)
│   │   └── BullMQService.ts      # Background job queue (AES-256-GCM encrypted payloads)
│   ├── database/
│   │   ├── Prisma.ts             # Prisma client with pg adapter + extensions
│   │   └── Extensions/           # Custom Prisma model methods
│   ├── interfaces/               # Shared TypeScript types
│   ├── errors/                   # ApiException, AppException
│   └── validations/              # Joi schemas
├── prisma/
│   ├── schema.prisma             # Data model
│   └── migrations/               # Migration history
├── tests/                        # Test suite
├── docker-compose.yml
├── Dockerfile
├── vitest.config.ts
├── tsconfig.json
└── .env.example
```

---

## License

ISC

## Author

Sumit Kumar — [itsme.sumit96@gmail.com](mailto:itsme.sumit96@gmail.com)

## Contributing

Open an issue or submit a pull request.
