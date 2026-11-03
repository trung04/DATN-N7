---
name: ai-service-integration
description: Add or review external AI API communication in this NestJS backend, including adapters, runtime contracts, timeouts, retries, jobs, and output validation.
---

Read `be/AGENTS.md`, `be/rules/architecture.md`, and `be/rules/ai-services.md` from the checkout root. Also read `be/rules/rest-api.md` when exposing HTTP endpoints.

1. Inspect the caller and actual upstream specification. Establish auth, schema/version, idempotency support, latency/cost budget, and sync/job/stream behavior. Do not invent endpoints or provider capabilities. When the contract is missing, implement only a clearly identified port/fake or request the missing contract before wiring live calls.
2. Define an application capability port and infrastructure adapter. Add provider mapping, runtime output validation, sanitized failure categories, and Nest DI bindings.
3. Configure base URL/credentials and an abortable deadline. Bound retries according to the actual idempotency contract, concurrency, and output sizes.
4. Keep remote calls outside database transactions. For jobs, define persistent states, authorization, idempotency, and recovery before exposing status endpoints.
5. Verify success, invalid output, auth errors, throttling, 5xx, deadline/abort, and retry exhaustion with fake HTTP/transport tests. Test business behavior through a fake port; keep routine checks offline.
6. Document setup, service discovery, compatibility, diagnostics, and unknowns. Check logs and public errors for sensitive content.

AI suggestions must pass schema validation, domain constraints, and normal application authorization before producing business mutations.
