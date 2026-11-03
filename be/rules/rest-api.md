# REST API contracts

These are conventions for new business endpoints; the starter `GET /` does not implement them yet.

## Routes and semantics

- Use `/api/v1`, plural kebab-case resources, and explicit identifiers, such as `/api/v1/trips/:tripId`. Configure prefix/versioning when implementing the first business endpoint.
- GET reads without side effects; POST creates or performs an explicitly modeled action; PUT replaces completely; PATCH updates selected fields; DELETE removes.
- Return 200 for bodies, 201 plus `Location` for creation, 202 plus a status-resource URL for accepted jobs, and 204 with no body when appropriate.
- Use 400 for invalid input, 401 for missing/invalid authentication, 403 for denied access, 404 for missing/concealed resources, 409 for conflicts, and 429 for rate limiting. Map upstream failures appropriately to 502/503/504 without exposing raw provider details.

## Boundaries and data

- Validate body, query, and path values at runtime using an approach compatible with installed NestJS. Reject unknown body fields; explicitly convert query values and enforce bounds. Install validation libraries deliberately; do not assume they exist.
- Request DTOs expose only writable fields. Explicitly map response DTOs; do not return ORM records, password hashes, tokens, or provider payloads.
- Guards authenticate; services authorize the specific resource/action and tenant/owner. Identity must come from trusted authentication context, not caller-supplied identity fields.
- Default list convention: `page=1`, `limit=20`, maximum `limit=100`, positive integers, deterministic sorting with an identifier tie-breaker. Whitelist filters/sort fields. Use documented opaque cursors instead for large/changing datasets when appropriate.
- Single responses are resource objects. Page-based collections use `{ "data": [], "meta": { "page": 1, "limit": 20, "total": 0 } }`. Document a separate cursor schema when used. Avoid redundant success wrappers.
- Use UTC ISO 8601 timestamps; document date-only/timezone semantics. Represent money with currency and integer minor units or a documented decimal representation.

## Errors and compatibility

- Adopt RFC 9457 `application/problem+json` errors: `type`, `title`, `status`, safe `detail`, and occurrence `instance` where available. Add stable `code`, `traceId`, and structured validation `errors` where needed. Do not make clients parse human-readable messages.
- Add central exception mapping when implementing this contract. Business exceptions remain transport-neutral; common HTTP filters map them to HTTP. Never expose stacks, SQL, secrets, or raw upstream responses.
- When OpenAPI is added, maintain schemas, auth requirements, pagination, examples, and error cases alongside endpoints. Document implemented behavior, not planned features.
- Keep changes within a version backward-compatible. Version breaking contracts explicitly. Test validation, status codes, serialization, ownership, and failure cases.
- For retryable creation/job submission, define idempotency-key scope, input fingerprint, concurrent requests, retention, and replay behavior. Enforce it persistently; reject reuse with different input.
- Configure intended CORS origins, body limits, correlation IDs, and rate limits appropriate to the feature. Separate liveness from readiness; never purchase AI generations in health checks.

References: [NestJS validation](https://docs.nestjs.com/techniques/validation), [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html). Route and response choices above are project conventions.
