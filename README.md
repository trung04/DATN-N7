# DATN-N7 — Tourism App

Development repository: https://github.com/trung04/DATN-N7

## Current status

This repository is an initial project scaffold. It does not yet serve a complete tourism application.

| Component | Current state |
| --- | --- |
| Backend (`be/`) | NestJS starter with `GET /` returning `Hello World!`; development Docker target and watch mode configured. |
| Frontend (`fe/`) | Package manifest, Dockerfile, and Nginx configuration only. Source files, `index.html`, TypeScript configuration, and `package-lock.json` are missing, so it cannot build or serve yet. |
| PostgreSQL | Local PostgreSQL 17 service with persistent storage and a health check. |
| Redis | Local Redis 7 service with append-only persistence. |

The backend currently has no database/Redis integration, authentication, migrations, or application API beyond the starter route. Setting connection variables does not implement these features.

## Requirements

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

The backend start scripts also require `be/.env`. Create that file locally, even if it is empty. If your team uses NestJS Observe, add the supplied `OBSERVE_APP_KEY` and `OBSERVE_APP_SECRET` there. Without them, the code falls back to placeholder values; telemetry setup is not verified.

`be/.env.example` lists proposed application settings, but currently includes an invalid opening `<CodeBlock ...>` line. Remove that line if copying it into `be/.env`, and replace example credentials with your local values.

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

Redis has no host port mapping. PostgreSQL is published on host port 5432; stop any conflicting local database or change the mapping before starting Compose.

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

During the repository review, backend lint and TypeScript checking passed. Unit and end-to-end tests failed under the installed Node.js 22 runtime with an ESM loading error; rerun them under Node.js 24. A full build was blocked by permissions on existing `be/dist` artifacts. Container startup has not been verified because Docker socket access was denied in the review environment.

## Stop services

```bash
docker compose --profile backend --profile frontend down
```

Named volumes retain database data and backend dependencies. Adding `--volumes` deletes those volumes, including the local database data.
