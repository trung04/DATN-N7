# Explore place pagination — TDD evidence

## Source and journeys

The journeys were derived from the reported `/explore` request fan-out:

1. A visitor opening `/explore` receives one server page of places instead of downloading every page.
2. A visitor selecting another page issues one request for that page and keeps filters in the URL.
3. Discovery filters for city and category are validated and applied by the places repository.
4. A visitor opening a place detail loads that place by ID instead of downloading the catalog.

## RED/GREEN report

| Guarantee | Test target | RED evidence | GREEN evidence |
|---|---|---|---|
| Discovery renders only the requested page and exposes pagination controls | `fe/src/features/public/explore-pagination.test.tsx` | `usePublicPlaces` had 0 calls and no `Trang 2` button existed | 3 tests passed |
| The API performs one `/places` request for the selected page | `fe/src/services/api/places-pagination.test.ts` | `TypeError: api.publicPlaces is not a function` | 3 tests passed |
| City/category filters reach the repository | `be/src/modules/places/services/places.service.spec.ts` | received options omitted `city` and `categoryCode` | relevant service suite passed |
| Query DTO normalizes and validates discovery filters | `be/src/modules/places/dtos/requests/list-places.request.spec.ts` | city remained untrimmed and invalid category was accepted | 2 tests passed |

RED checkpoint commits: `fce338f`, `913f9b6`. GREEN implementation checkpoint: `a6a2617`.

## Validation performed

- Frontend focused tests: 6/6 passed.
- Frontend full suite: 108/108 passed on the final run.
- Frontend TypeScript build: passed.
- Frontend Vite production build: passed.
- Frontend lint on the new hook/tests and adjacent type/admin files: passed.
- Backend `places` module: 15/15 tests passed.
- Backend build: passed.
- Backend lint: passed.

The repository-wide frontend lint remains red on pre-existing errors in auth, map, catalog, client, and mock files. The repository-wide backend suite has 9 pre-existing failures in bookings, hotel images, amenities, and room images; the `places` suite is green.

## Coverage and known gaps

- Backend `places` coverage run completed: 38.97% statements overall. The new list query DTO reached 88.23% statements; the existing repository/controller remain largely uncovered.
- Frontend coverage could not run because `@vitest/coverage-v8` is not installed. No dependency was added solely to manufacture a coverage result.
- `publicCatalog()` remains for legacy hotel/home/planner consumers. `/explore` and `/explore/:id` no longer use it; migrating the remaining consumers is a separate change because they depend on the combined hotel/room/place shape.
