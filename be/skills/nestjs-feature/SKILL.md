---
name: nestjs-feature
description: Implement or review layered business features in this repository's NestJS backend, including REST endpoints, persistence, and cross-module workflows.
---

Read `be/AGENTS.md`, `be/rules/architecture.md`, and, for HTTP changes, `be/rules/rest-api.md` from the checkout root. Resolve paths against the checkout root even when working inside `be/`.

1. Inspect dependencies and adjacent contracts. Identify the owning module, authorization requirements, invariants, inputs/results, and observable failure cases.
2. Implement the smallest feature using controllers, services, repositories, entities, dtos/requests, dtos/responses, and interfaces. Add integrations, mappers, and exceptions when needed. Bind repository/client interfaces in the module and export only services needed by other modules.
3. Map persistence/external DTOs explicitly. Invoke exported services across modules rather than internal repositories.
4. Implement runtime validation, ownership checks, status/error semantics, and bounded queries. Update OpenAPI when present and environment/setup documentation when dependencies change.
5. Test business behavior, negative HTTP contracts, and relevant persistence constraints. Run the checks in `be/AGENTS.md`; report actual failures separately from environmental blockers.

For reviews, report concrete violations with file locations and affected behavior. For implementation, report changes, checks, and remaining integration blockers. Do not scaffold unrelated platform features or claim planned contracts are implemented.
