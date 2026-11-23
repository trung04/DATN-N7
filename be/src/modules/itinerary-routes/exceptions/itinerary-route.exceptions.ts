import { DomainException } from '../../../common/exceptions/domain.exception';

export class ItineraryRouteNotFoundException extends DomainException {
  constructor() {
    super(
      'No stored route exists for the requested itinerary day and profile.',
      'ITINERARY_ROUTE_NOT_FOUND',
      'not_found',
    );
  }
}

export class ItineraryRouteExpiredException extends DomainException {
  constructor(expiresAt: Date) {
    super(
      `The stored route expired at ${expiresAt.toISOString()} and must be regenerated.`,
      'ITINERARY_ROUTE_EXPIRED',
      'gone',
    );
  }
}

export class ItineraryRouteStaleException extends DomainException {
  constructor() {
    super(
      'The itinerary stops changed after this route was generated.',
      'ITINERARY_ROUTE_STALE',
      'conflict',
    );
  }
}

export class ItineraryRouteDateException extends DomainException {
  constructor() {
    super(
      'Route date must be within the itinerary date range.',
      'ITINERARY_ROUTE_DATE_INVALID',
      'validation',
    );
  }
}

export class ItineraryRouteWaypointsException extends DomainException {
  constructor(
    message = 'At least two itinerary stops with coordinates are required.',
  ) {
    super(message, 'ITINERARY_ROUTE_WAYPOINTS_INVALID', 'validation');
  }
}

export class MapboxDirectionsNotConfiguredException extends DomainException {
  constructor() {
    super(
      'Mapbox Directions is not configured.',
      'MAPBOX_DIRECTIONS_NOT_CONFIGURED',
      'service_unavailable',
    );
  }
}

export class MapboxDirectionsUnavailableException extends DomainException {
  constructor() {
    super(
      'Mapbox Directions is temporarily unavailable.',
      'MAPBOX_DIRECTIONS_UNAVAILABLE',
      'service_unavailable',
    );
  }
}

export class MapboxDirectionsRateLimitedException extends DomainException {
  constructor() {
    super(
      'Mapbox Directions rate limit was exceeded.',
      'MAPBOX_DIRECTIONS_RATE_LIMITED',
      'rate_limited',
    );
  }
}

export class MapboxDirectionsResponseException extends DomainException {
  constructor() {
    super(
      'Mapbox Directions returned an invalid or unusable route.',
      'MAPBOX_DIRECTIONS_RESPONSE_INVALID',
      'bad_gateway',
    );
  }
}
