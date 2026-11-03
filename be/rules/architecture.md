# Layered modular monolith

Use feature folders under `src/modules/<capability>/` with `<capability>.module.ts` and, as needed, `presentation/http/`, `application/`, `domain/`, and `infrastructure/`. Do not create empty layers or organize the entire app into global controller/service/repository folders.

## Dependencies

- Presentation owns controllers, request/response DTOs, validation, and HTTP error mapping. No business decisions or database queries in controllers.
- Application owns use cases, transaction boundaries, authorization context, and ports for persistence/external capabilities. It must not depend on controllers, HTTP DTOs, ORM records, or concrete external clients.
- Domain owns business invariants, entities/value objects, and domain errors. Keep it independent of NestJS, transport, storage, and providers.
- Infrastructure implements ports and maps persistence/provider representations to internal types. Wire implementations in the owning Nest module, the composition root.
- Constructor injection is the default. Bind interfaces using symbols or abstract classes because interfaces do not exist at runtime. Nest decorators in application services are acceptable; keep business rules framework-independent.

## Ownership and consistency

- Each module owns its tables, repositories, and invariants. Other modules invoke a narrow exported application facade, never internal repositories or tables. Coordinate cross-module workflows through public contracts.
- Keep module dependencies acyclic. Use direct in-process calls by default; introduce events only with a concrete need and documented delivery/failure semantics.
- Put technical facilities such as logging/configuration in a small `platform/` area. Do not move business code there to evade ownership.
- Choose an ORM only when needed; none is selected yet. Version migrations and disable automatic schema synchronization in production. Enforce uniqueness and critical invariants in the database as well as application code.
- Define transaction boundaries in use cases through infrastructure abstractions. Keep network/AI requests outside database transactions. Use an outbox when committed changes must reliably trigger jobs/events; make consumers idempotent.
- Bound queries and relation loading; avoid N+1 queries. Map records to API responses explicitly.
- Do not introduce CQRS, microservices, generic base repositories, or event buses for a small feature without a demonstrated need.

## Verification

Test domain invariants without Nest, use cases with fake ports, persistence constraints against disposable databases when relevant, and HTTP contracts with Nest e2e tests. Test cross-module workflows through exported contracts.

Reference: [NestJS module encapsulation](https://docs.nestjs.com/modules). Layering and ownership above are project conventions.
