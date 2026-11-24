# AGENTS.md

## Backend implementation rules

This backend is a NestJS modular monolith. Read [architecture](rules/architecture.md), [REST contracts](rules/rest-api.md), and, when calling AI APIs, [AI service integration](rules/ai-services.md) before editing the relevant code.

- Organize by business capability, with controllers, services, repositories, entities, `dtos/requests`, `dtos/responses`, interfaces, integrations, mappers, and exceptions inside each module.
- Controllers call services; services depend on repository/integration interfaces; repositories and external clients implement those interfaces. Business rules stay in services/entities, not controllers or database adapters.
- Export only services required by other modules. Never access another module's tables/repositories directly. Keep dependencies acyclic instead of defaulting to `forwardRef()`.
- These rules describe the target architecture. TypeORM/PostgreSQL and Redis cache connections are configured; business persistence/entities, authentication, API validation, OpenAPI, queues, and AI clients are not implemented. Add infrastructure only when needed by the requested feature.
- Inspect installed dependencies before selecting APIs. Docker targets Node.js 24. Use explicit runtime DI tokens for TypeScript interfaces.
- Test business rules and observable contracts, including authorization, validation, and integration failures. Routine tests must not require production data or paid AI calls.
- Run `npm run lint`, `npm run build`, and relevant unit/e2e tests; report actual results and blockers. Current Node 22 tests fail on ESM loading; existing `dist` permissions may block builds.
- Validate new environment settings at startup. Keep secrets out of source/logs/errors; use placeholders in examples. Keep the root README accurate.
- Reusable workflows are in [backend feature skill](skills/nestjs-feature/SKILL.md) and [AI integration skill](skills/ai-service-integration/SKILL.md). Agents may read these explicitly; they are portable Markdown workflows, not automatically installed plugins.

## Production data: NestJS Observe

The starter configures `ObserveModule` in `src/app.module.ts`. A functioning telemetry connection is not verified. Its key pair comes from `OBSERVE_APP_KEY` and `OBSERVE_APP_SECRET` in `.env`; never expose these values in logs or agent reports.

When a task depends on how the app behaves in production - an error users hit, a slow endpoint, a failing job, whether a release made things worse - work from that data, not from the code alone:

- The Observe MCP server answers those questions directly: errors with their traces and logs, slow operations, jobs, and what a release changed (`find_regressions`, `diff_release`). It is included on the Pro plan and above. In Claude Code: `claude mcp add observe --transport http https://observe-api.nestjs.com/mcp`, and the client opens a browser to approve. Other clients: https://www.observe.nestjs.com/documentation/mcp
- Without it, the user can open the request or error in the Observe dashboard and click **Copy agent prompt**, which hands over that page's trace, stack and logs as text.
