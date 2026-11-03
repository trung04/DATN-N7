# Layered modular monolith

Organize business capabilities under `src/modules/<capability>/`. Every module owns its controllers, services, repositories, entities, DTOs, and interfaces. Do not create global business controller/service/repository folders.

## Module skeleton

```text
modules/<capability>/
  <capability>.module.ts
  controllers/       # *.controller.ts
  services/          # *.service.ts
  repositories/      # *.repository.ts
  entities/          # *.entity.ts
  dtos/
    requests/        # *.request.ts
    responses/       # *.response.ts
  interfaces/        # *.repository.interface.ts, external capability interfaces
  integrations/      # External clients, e.g. ai/*.client.ts and contracts/
  mappers/           # Entity/response and external payload mapping
  exceptions/        # Business exceptions mapped centrally to HTTP
```

The starter module under `src/modules/app/` demonstrates controller/service wiring and preserves `GET /`. Its `.gitkeep` files retain the approved skeleton; future modules should add optional folders only when useful. Do not add fake persistence or business features just to populate folders.

## Responsibilities and dependencies

- Controllers validate HTTP input, call services, and return response DTOs. No database queries or business rules in controllers.
- Services implement business rules, resource authorization, transactions, and orchestration. Depend on repository/integration interfaces, not concrete clients or repositories. Keep HTTP request objects and provider payloads out of business logic.
- Repositories own database queries and persistence, implementing interfaces declared in `interfaces/`. They do not call controllers or external AI APIs.
- Entities define module-owned business data and relationships. TypeORM decorators define persistence metadata. Never return entities directly as public responses.
- DTOs define external request/response shapes. Services may accept validated request data or explicit service inputs; keep transport decorators/status handling out of service logic. Mappers construct public responses explicitly.
- Integrations implement external capability interfaces. Provider request/response schemas belong in `integrations/<provider>/contracts/`, separate from public HTTP DTOs.
- Controllers depend on services; services depend on interfaces; repositories/clients implement interfaces. Wire implementations with constructor injection in the owning module. Use symbol or abstract-class tokens because TypeScript interfaces do not exist at runtime.
- Map transport-neutral business exceptions centrally through HTTP filters. Do not put Nest HTTP exceptions in repositories or entities.

## Shared folders and ownership

- `src/config/`: validated environment/application configuration.
- `src/database/`: database setup and versioned `migrations/` once persistence is selected.
- `src/common/`: reusable technical decorators, guards, filters, interceptors, pipes, and DTOs. Keep business services inside their owning module.
- Modules export only services needed by other modules. Other modules import those services through Nest module exports; never read another module's repositories/tables directly.
- Keep dependencies acyclic. Fix ownership rather than defaulting to `forwardRef()`. Use in-process service calls by default; events need explicit delivery/failure semantics.

## Persistence and consistency

TypeORM with PostgreSQL is configured in `src/database/database.module.ts`. Feature modules register entities using `TypeOrmModule.forFeature`; repository implementations inject TypeORM repositories while services depend on module-local interfaces. Version migrations and keep automatic schema synchronization disabled. Enforce uniqueness and critical invariants in database constraints as well as services.

Services define transaction boundaries through repository/database abstractions. Keep network/AI calls outside DB transactions. Use an outbox when committed changes must reliably trigger jobs/events; make consumers idempotent. Bound queries, avoid N+1 relation loading, and handle concurrent updates deliberately.

Do not introduce CQRS, microservices, generic base repositories, or event buses without a concrete need.

## Verification

Colocate unit tests as `*.spec.ts`. Test service rules with fake repository/integration interfaces; test persistence constraints with disposable databases when relevant. Keep HTTP/cross-module integration tests under `test/`, including exported service collaboration and authorization failures.

Reference: [NestJS modules](https://docs.nestjs.com/modules). The folder names and boundaries above are project conventions.
