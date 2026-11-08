# DATN-N7 — Tourism App

Development repository: https://github.com/trung04/DATN-N7

## Current status

This repository is an initial project scaffold. It does not yet serve a complete tourism application.

| Component | Current state |
| --- | --- |
| Backend (`be/`) | NestJS modular API with PostgreSQL features and Redis-backed rotating login sessions. |
| Frontend (`fe/`) | Package manifest, Dockerfile, and Nginx configuration only. Source files, `index.html`, TypeScript configuration, and `package-lock.json` are missing, so it cannot build or serve yet. |
| PostgreSQL | Local PostgreSQL 17 service with persistent storage and a health check. |
| Redis | Local Redis 7 service with append-only persistence. |

The backend configures PostgreSQL through TypeORM, general caching through Keyv, and rotating opaque authentication sessions through Redis. Several business APIs are implemented, but authorization guards have not yet been applied to every management route.

## Backend agent guidance

Start with [be/AGENTS.md](be/AGENTS.md). It links the project conventions for [layered modules](be/rules/architecture.md), [REST APIs](be/rules/rest-api.md), and [AI service communication](be/rules/ai-services.md).

Reusable workflows are available as [nestjs-feature](be/skills/nestjs-feature/SKILL.md) and [ai-service-integration](be/skills/ai-service-integration/SKILL.md). Ask your agent to read the relevant `SKILL.md` before the task. These repository-local files are not automatically installed skills in every agent tool. The rules guide new implementation; they do not mean the starter already provides those capabilities.

## Development requirements

Backend source follows this structure:

```text
be/src/
  main.ts
  app.module.ts                 # Root composition and telemetry
  config/
  database/migrations/
  common/
    decorators/
    guards/
    filters/
    interceptors/
    pipes/
    dto/
  modules/
    app/                        # Existing starter; GET / → Hello World!
      app.module.ts
      controllers/
      services/
      repositories/
      entities/
      dtos/requests/
      dtos/responses/
      interfaces/
      integrations/
      mappers/
      exceptions/
```

New business modules follow the same module-local layout. Controllers call services, services use repository/integration interfaces, and concrete repositories/clients are wired in the module. Empty folders are retained with `.gitkeep` as a skeleton; no database or AI functionality is implemented by those placeholders. Tests are colocated as `*.spec.ts`, with HTTP/cross-module tests under `be/test/`.

- Docker Engine or Docker Desktop with Docker Compose.
- Git.
- For running the backend outside Docker: Node.js 24 and npm. Docker uses Node.js 24.

## Clone and configure

```bash
git clone https://github.com/trung04/DATN-N7.git
cd DATN-N7
```

Place the team-provided database environment file at `.env` in the repository root. Compose expects these variables:

```dotenv
POSTGRES_DB=<team-provided-database-name>
POSTGRES_USER=<team-provided-user>
POSTGRES_PASSWORD=<team-provided-password>
```

Compose uses these values to initialize a **local PostgreSQL container**. It does not connect to a separately hosted shared database. To use a remote database later, the backend connection configuration and Compose settings must be adapted.

Nest ConfigModule loads `be/.env` when present; Compose environment variables take precedence. The file is optional inside Docker. For host development, copy `be/.env.example` to `be/.env`, replace database placeholders with the team-provided values, and use localhost hosts. Compose supplies its own database credentials and internal hosts `postgres` and `redis`. Keep any Observe keys in your local environment; telemetry connectivity remains unverified.

## Start the backend development environment

Run from the repository root:

```bash
docker compose --profile backend up --build -d
docker compose --profile backend logs -f backend
```

This starts PostgreSQL, Redis, and the backend. Backend source is mounted from `be/`, and Nest runs in watch mode. Dependencies live in a separate Docker volume.

Once the backend starts successfully:

```bash
curl http://localhost:3000/
```

Expected response: `Hello World!`

| Service | Address |
| --- | --- |
| Backend from the host | `http://localhost:3000` |
| PostgreSQL from the host | `localhost:5432` |
| PostgreSQL from Compose containers | `postgres:5432` |
| Redis from Compose containers | `redis:6379` |
| Redis from the host | `localhost:6379` |

Redis is published on loopback port 6379 for host development. PostgreSQL is published on host port 5432; stop any conflicting local database or change the mapping before starting Compose.

Plain `docker compose up -d` starts only PostgreSQL and Redis. The backend and frontend services require their respective profiles.

After backend dependency changes, update the dependency volume and restart:

```bash
docker compose --profile backend run --rm --no-deps backend npm ci
docker compose --profile backend restart backend
```

## Frontend development status

The frontend is not runnable yet. Before enabling its Compose profile, add the frontend implementation, Vite/TypeScript configuration, HTML entry point, and an npm lockfile.

The existing Compose frontend service builds the production Nginx image and maps it to `http://localhost:8080`; it does not provide Vite hot reload. Its `/api/` location currently returns HTTP 502 deliberately because an API proxy has not been configured. The Compose `VITE_*` build arguments are also not consumed by the current Dockerfile.

## Backend commands outside Docker

Create `be/.env` first, then:

```bash
cd be
npm ci
npm run start:dev
```

Validation commands:

```bash
npm run lint
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

Use Node.js 24 for checks; host Node.js 22 has an ESM test-loading incompatibility. Existing `be/dist` ownership may block rebuilding on this host. The starter HTTP e2e test imports only its feature module and does not verify live database/cache connectivity. Full Compose verification requires Docker socket access.

## Stop services

```bash
docker compose --profile backend --profile frontend down
```

Named volumes retain database data and backend dependencies. Adding `--volumes` deletes those volumes, including the local database data.

## Database and Redis configuration

PostgreSQL is configured in `be/src/database/database.module.ts` using `TypeOrmModule.forRootAsync` and validated `ConfigService` values. Redis caching is configured in `be/src/common/cache/redis-cache.module.ts` using Nest CacheModule and the Keyv Redis adapter.

- Required database settings: `DATABASE_HOST`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`.
- Database defaults: port 5432, pool size 10, connect timeout 5000 ms, TLS disabled. `DATABASE_SSL=true` enables certificate-verified TLS; use the deployment's trusted CA configuration for private certificates.
- Redis defaults: localhost:6379, database 0, connect timeout 5000 ms, TLS disabled. Optional `REDIS_USERNAME`/`REDIS_PASSWORD` support authenticated instances; `REDIS_TLS=true` enables TLS. Compose's local Redis has no authentication configured.
- Cache TTL is in milliseconds (`CACHE_TTL_MS=60000`), and keys use the `tourism:cache` namespace. Redis connects on first cache access; application startup alone does not prove Redis availability. CacheModule disconnects its stores during shutdown, and Nest shutdown hooks are enabled.
- Authentication uses the `tourism:auth` Redis namespace. `AUTH_ACCESS_TTL_MS` defaults to 15 minutes, `AUTH_REFRESH_TTL_MS` defaults to seven days, and refresh/logout requests accept only the configured `FRONTEND_ORIGIN`.
- PostgreSQL connects during startup with bounded retries. TypeORM `synchronize` and automatic migration execution are disabled. No schema is created automatically; add reviewed migrations when entities are introduced. A standalone migration CLI data source is not configured yet.

Feature modules register their own entities using `TypeOrmModule.forFeature([Entity])`. Inject TypeORM repositories into the module's repository implementations; services consume repository interfaces. Do not inject TypeORM repositories directly into controllers or bypass another module's services.

For caching, inject `CACHE_MANAGER` from `@nestjs/cache-manager` with the `Cache` type from `cache-manager` into the service/integration that needs it. Use `get`, `set`, and `del` with explicit, tenant-aware keys. A cache is not a durable store for critical workflow state or distributed locks.

For host development, start infrastructure with `docker compose up -d postgres redis`, configure `be/.env` using the shared database values and localhost hosts, then run `npm ci` and `npm run start:dev` inside `be/`. For Docker development, refresh the dependency volume after pulling dependency updates using the command above, then run `docker compose --profile backend up --build -d`.

References: [Nest TypeORM](https://docs.nestjs.com/data/typeorm), [Nest configuration](https://docs.nestjs.com/application/configuration), [Nest caching](https://docs.nestjs.com/techniques/caching).
