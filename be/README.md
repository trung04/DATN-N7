<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

For PostgreSQL/TypeORM and Redis connection settings and Docker setup, follow the [repository setup guide](../README.md#database-and-redis-configuration). ConfigModule loads `.env` when present; Compose-supplied environment variables take precedence. Use Node.js 24 for development and tests.

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Swagger / OpenAPI

With the backend running, interactive API documentation is available at:

- Swagger UI: `http://localhost:3000/api/docs`
- OpenAPI JSON: `http://localhost:3000/api/docs-json`
- OpenAPI YAML: `http://localhost:3000/api/docs-yaml`

The opaque `login_access` cookie is documented. Protected endpoints use this
session cookie and return `401` for an invalid session or `403` when the active
user lacks the required role or resource ownership.

## Authentication API

`POST /api/v1/auth/login` issues rotating opaque `login_access` and
`login_refresh` HttpOnly cookies. `POST /api/v1/auth/refresh` rotates both;
`POST /api/v1/auth/logout` revokes the session family; and
`GET /api/v1/auth/me` returns the active authenticated user.

Google login starts at `GET /api/v1/auth/google/start` and returns through
`GET /api/v1/auth/google/callback`. Configure `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, and the exact `GOOGLE_REDIRECT_URI`. Google identity
tokens are verified and discarded; only the Google subject is persisted.
Existing password accounts with the same email are not merged automatically.

Authorization is deny-by-default. Public reads are marked explicitly; admin
management uses `ADMIN`, hotel management uses `HOTEL_OWNER`, and booking
access is scoped to the booking tourist, the owning hotel account, or an
administrator as appropriate. Caller-supplied owner, tourist, and reviewer
identifiers are rejected in favor of the authenticated session identity.

## Amenities API

The backend exposes amenity management at `/api/v1/amenities` with create,
paginated list, detail, partial update, and delete operations. Reads are public;
write endpoints require `ADMIN`.

Apply pending database migrations before using persistence-backed endpoints:

```bash
npm run migration:show
npm run migration:run
```

List query parameters are `page`, `limit`, `search`, `sortBy`, and `sortOrder`.
The maximum page size is 100.

## Rooms API

Room management is available at `/api/v1/rooms`. A room belongs to a hotel by
`hotelId` and can be associated with up to 50 amenities through `amenityIds`.
The hotel foreign key is intentionally deferred until the hotel module exists;
amenity identifiers are validated through `AmenitiesService` and persisted in
the `room_amenities` join table.

Prices use an exact `numeric(12,2)` database column and include a three-letter
currency code, defaulting to `VND`. Operational statuses are `AVAILABLE`,
`MAINTENANCE`, and `OUT_OF_SERVICE`.

Room list query parameters are `page`, `limit`, `search`, `hotelId`, `roomType`,
`operationalStatus`, `sortBy`, and `sortOrder`.

## Users API

User management is available at `/api/v1/users` with create, paginated list,
detail, partial update, password reset, and delete operations. Usernames and
emails are normalized to lowercase and are unique case-insensitively.
Passwords are accepted only as write-only request fields and stored as bcrypt
hashes; password hashes and Google account identifiers are never returned.

List filters include `search`, `status`, `role`, `gender`, and
`isEmailVerified`.
Password reset uses `PUT /api/v1/users/:userId/password`. User management routes
require `ADMIN`; an administrator may also change a user's role through the
user update endpoint.

## Hotel Owners API

Hotel owner profiles are available at `/api/v1/hotel-owners` with create,
paginated list, detail, partial update, and delete operations. Each profile uses
`userId` as both its resource identifier and database primary key, enforcing a
one-to-one relationship with an existing user. User and hotel-owner deletion
are independent soft-delete operations.

Bank name, account number, and account holder are nullable. List queries support
`search`, `userId`, `sortBy`, and `sortOrder`. Creating, listing, or deleting
profiles requires `ADMIN`; an owner may read and update only their own profile.
Creating a profile promotes a non-admin user to `HOTEL_OWNER`.

## Itinerary Management API

Itineraries are managed at `/api/v1/itineraries`. Ordered stopovers are nested
under `/api/v1/itineraries/:itineraryId/stopovers`, and ordered activities are
managed at `/api/v1/stopovers/:stopoverId/activities`. All three resources
support create, paginated list, detail, partial update, and soft delete.

Itinerary date ranges, stopover/activity timestamp ranges, active child order,
currency, cost, and pagination inputs are validated at the API and database
boundaries. `placeId` remains a UUID without a foreign key until the places
module is implemented.

Users have `TOURIST`, `HOTEL_OWNER`, or `ADMIN` roles; newly created users
default to `TOURIST`. Deleting any currently implemented entity sets its
`deleted_at` timestamp, and normal repository queries omit deleted records.

## Hotels API

Hotel onboarding is available at `/api/v1/hotels`. New hotels start as `DRAFT`;
owners can update their data and attach documents before submitting them with
`PUT /api/v1/hotels/:hotelId/submit`. A non-expired `BUSINESS_LICENSE` document
is required, but rooms and cancellation policies are not required for
submission.

Admin review uses one endpoint,
`PATCH /api/v1/admin/hotels/:hotelId/status`, with the actions `APPROVE`,
`REJECT`, `SUSPEND`, and `REACTIVATE`. Reject and suspend actions require a
reason, and every submission or review action is recorded in
`hotel_review_histories`. Approved legal names, tax codes, and documents are
locked until a later legal-change workflow is implemented. Only `ACTIVE`
hotels may receive new rooms, cancellation policies, or bookings.

Public hotel reads expose only `ACTIVE` hotels. Owner management endpoints use
the authenticated `HOTEL_OWNER` identity, and `/api/v1/hotels/mine` lists the
current owner's hotels in every workflow state. `ownerUserId` is not accepted
when creating a hotel. Admin review requires `ADMIN`, and `reviewerUserId` is
derived from the active session rather than the request body.

## Places API

Place management is available at `/api/v1/places` with create, paginated list,
detail, partial update, and delete operations. Coordinates are optional but
latitude and longitude must be supplied or cleared together. Country codes use
the ISO alpha-2 format and timezone values must be valid IANA identifiers.

The database generates `search_document` and indexes it for full-text search.
`averageRating` is read-only through this API and defaults to zero until a
review capability owns rating aggregation. List filters include `search`,
`status`, `countryCode`, `provinceCode`, and `minRating`.

## Cancellation Policies API

Cancellation policy management is available at
`/api/v1/cancellation-policies` with create, paginated list, detail, partial
update, and delete operations. Policies belong directly to `hotelId`; there is
no hotel-owner user identifier in the database or API contract. Policy names
are unique per hotel without case sensitivity. New policies may only be added
to an active hotel.

`cancellationWindow` is an optional number of days from 0 to 3650 and
`cancellationFeeRate` is an optional percentage from 0 to 100. List queries
support `search`, `hotelId`, `sortBy`, and `sortOrder`. The hotel foreign key is
enforced for new data; existing legacy rows must be backfilled before validating
the constraint against historical data.

## Bookings API

Booking management is available at `/api/v1/bookings`. Creation initializes a
unique booking code and pending booking/payment/settlement/refund states. Basic
guest and booking status changes use `PATCH /api/v1/bookings/:bookingId`.
Creation accepts one to ten `roomIds`, date-only `checkInDate` and
`checkOutDate`, guest counts, and guest contact details. The backend verifies
that rooms are operational, belong to one hotel, use one currency, have enough
capacity, and are not reserved by another pending or confirmed booking for an
overlapping stay. Room prices and descriptive values are snapshotted in
`booking_rooms`; the number of nights, hotel, total amount, payable amount, and
commission rate are server-managed. `touristId` is derived from the authenticated
session. Tourists can access only their own bookings; hotel owners may list or
view bookings for hotels they own, while settlement and refund are admin-only.

`POST /api/v1/bookings` requires an `Idempotency-Key` header containing a new
UUID v4. Retrying the same normalized request with the same key returns the
original booking and sets `Idempotency-Replayed: true`; reusing that key with a
different body returns `409 IDEMPOTENCY_KEY_REUSED`. Keys are retained in
PostgreSQL for the configured TTL so retries remain safe across server
restarts.

Financial workflows use explicit endpoints:

- `PUT /api/v1/bookings/:bookingId/payment/vnpay`
- `GET /api/v1/payments/vnpay/ipn`
- `GET /api/v1/payments/vnpay/return`
- `PUT /api/v1/bookings/:bookingId/settlement`
- `PUT /api/v1/bookings/:bookingId/refund`

The payment endpoint creates one signed VNPAY Sandbox payment URL and lets the
customer choose a supported payment method on the VNPAY page.
Only a checksum-valid VNPAY IPN with matching terminal, booking, and amount can
change the booking to `PAID` and `CONFIRMED`; there is no public manual payment
completion endpoint. The return endpoint verifies and displays status but does
not mutate payment state. Refund requests call the VNPAY Sandbox refund API and
each booking permits only one refund request.

Add the credentials issued by the VNPAY Sandbox developer portal to `be/.env`:

```dotenv
VNPAY_TMN_CODE=your_sandbox_terminal_code
VNPAY_HASH_SECRET=your_sandbox_hash_secret
VNPAY_RETURN_URL=http://localhost:3000/api/v1/payments/vnpay/return
VNPAY_PAYMENT_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_REFUND_URL=https://sandbox.vnpayment.vn/merchant_webapi/api/transaction
VNPAY_REFUND_CREATE_BY=system
BOOKING_COMMISSION_RATE=15
BOOKING_HOLD_MINUTES=15
IDEMPOTENCY_KEY_TTL_HOURS=24
```

Register the public HTTPS IPN URL
`https://your-api-domain/api/v1/payments/vnpay/ipn` with VNPAY. A localhost or
tailnet-only IPN address cannot be called by VNPAY; use a public test domain or
HTTPS tunnel for end-to-end Sandbox testing. Secrets must never be committed.

Settlement commission and partner receivable amounts are calculated by the
service from the persisted commission rate. Bookings are not hard-deleted;
cancellation is represented by the `CANCELLED` status. Cancellation-policy and
hotel foreign keys are enforced for new data. The tourist foreign key remains
deferred until its owning module exists.

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

This project is already instrumented. To connect it, run this and approve the code it prints at [observe.nestjs.com/link](https://observe.nestjs.com/link) - signing up for free if you have no account:

```bash
$ npx @nestjs/observe link
```

It writes the app key and secret into `.env` and makes every `nest start` script (`start`, `start:dev`, `start:debug`) load it. In production, set `OBSERVE_APP_KEY` and `OBSERVE_APP_SECRET` in the environment instead.

Or do it by hand: create an application and an API key at [observe.nestjs.com](https://observe.nestjs.com), and set the pair as `OBSERVE_APP_KEY` and `OBSERVE_APP_SECRET` in the environment the app runs in.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
