# AI service API integration

Apply when a feature needs AI; do not add SDKs, queues, or separate services preemptively.

## Contracts and boundaries

- Define a capability interface such as `ItineraryGenerator` in the calling module's `interfaces/`. Services consume it; an AI client in `integrations/ai/` implements it through Nest DI. Keep external schemas in `integrations/ai/contracts/` and conversions in `mappers/`. Controllers, services, and entities must not depend on provider SDKs or provider JSON.
- Define internal request/result types and failure categories. Validate upstream payloads at runtime and map them into internal types. TypeScript alone does not validate network data.
- For team-owned AI services, agree on a versioned OpenAPI/JSON schema contract covering auth, request IDs, payload limits, locale/units/timezones, sync/job/stream behavior, errors, and compatibility. Keep contract fixtures/tests; never share ORM entities across services.
- Validate base URL, credentials, model selection, and deadlines in configuration. Use Compose DNS names for other containers, not `localhost`. Keep credentials server-side and use deployment-appropriate service authentication.

## Reliability

- Set an overall deadline and connection/read limits where supported. Abort the underlying request on deadline/cancellation; a promise timeout alone is insufficient.
- Retry only transient failures within bounded attempts/time using backoff and jitter; honor `Retry-After`. Do not retry auth/validation failures. Timeouts do not prove no work occurred: retry billable/non-idempotent requests only when upstream idempotency is actually enforced. Do not assume support for an idempotency header.
- Distinguish timeout, throttling, unavailability, auth, and invalid-output errors internally. Expose stable sanitized public errors.
- Bound concurrency, payload sizes, output/token counts, and per-user usage. Add circuit breaking when warranted. Any fallback must be explicit; never fabricate successful AI results.
- Keep network calls outside DB transactions. For long work, define persisted job states, ownership, retries, cancellation, expiration, and idempotency; return 202 plus status URL. Add a queue/outbox only when that workflow needs it.
- For streaming, document event framing, terminal errors, backpressure, disconnect cancellation, and proxy deadlines. Partial output is not a validated final result.

## Trust and data

- Prompts, retrieved content, model output, URLs, and tool arguments are untrusted. Model suggestions must not bypass authorization or directly execute SQL/shell/business mutations.
- Validate structured output and enforce domain rules independently. Allowlist tools/actions and authorize every action with trusted user context.
- Restrict upstream hosts and redirects; do not implement unrestricted user-directed fetches. For callbacks, verify signatures, timestamps, replay protection, and job ownership before updating state.
- Minimize personal data sent upstream. Do not log full prompts/responses/secrets by default. Define retention/redaction for stored artifacts; scope caches by tenant, authorization context, input, model, and prompt/schema version.

## Verification and operations

- Use fake HTTP servers/transport stubs to test request contracts, valid/malformed output, 401/403, 429 with retry hints, 5xx, deadlines, aborts, and retry exhaustion. Assert bounded retries and cancellation.
- Test services with fake integration interfaces. Keep routine tests offline and deterministic; optional live tests require supplied test credentials and explicit cost limits.
- Record trace/request IDs, latency, failure category, retry count, usage/cost when available, and model/prompt/schema versions without sensitive content. Propagate trace context using supported headers rather than forwarding arbitrary caller headers.
- Document environment settings, startup/service discovery, contract versions, and failure behavior. AI generation calls do not belong in health probes.

Reference: [NestJS HTTP client](https://docs.nestjs.com/application/http-module). These integration requirements are independent of the selected HTTP library/provider.
