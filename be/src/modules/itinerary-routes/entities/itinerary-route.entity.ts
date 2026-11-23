import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ItineraryRouteProfile {
  DRIVING = 'driving',
  DRIVING_TRAFFIC = 'driving-traffic',
  WALKING = 'walking',
  CYCLING = 'cycling',
}

export enum ItineraryRouteStatus {
  CURRENT = 'CURRENT',
  STALE = 'STALE',
  SUPERSEDED = 'SUPERSEDED',
}

export interface RouteLineString {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface ItineraryRouteWaypoint {
  stopoverId: string;
  order: number;
  requestedLocation: [number, number];
  snappedLocation: [number, number];
}

export interface ItineraryRouteLeg {
  fromStopoverId: string;
  toStopoverId: string;
  distanceMeters: number;
  durationSeconds: number;
}

@Entity({ name: 'itinerary_routes' })
@Index('IDX_itinerary_routes_lookup', [
  'itineraryId',
  'routeDate',
  'profile',
  'createdAt',
])
@Index('IDX_itinerary_routes_expiry', ['expiresAt'])
export class ItineraryRouteEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'itinerary_id', type: 'uuid' })
  itineraryId: string;

  @Column({ name: 'route_date', type: 'date' })
  routeDate: string;

  @Column({ type: 'varchar', length: 30 })
  profile: ItineraryRouteProfile;

  @Column({ type: 'varchar', length: 20, default: 'MAPBOX' })
  provider: 'MAPBOX';

  @Column({ type: 'varchar', length: 20 })
  status: ItineraryRouteStatus;

  @Column({
    type: 'geometry',
    spatialFeatureType: 'LineString',
    srid: 4326,
  })
  geometry: RouteLineString;

  @Column({ name: 'distance_meters', type: 'integer' })
  distanceMeters: number;

  @Column({ name: 'duration_seconds', type: 'integer' })
  durationSeconds: number;

  @Column({ type: 'jsonb' })
  waypoints: ItineraryRouteWaypoint[];

  @Column({ type: 'jsonb' })
  legs: ItineraryRouteLeg[];

  @Column({ name: 'waypoint_signature', type: 'char', length: 64 })
  waypointSignature: string;

  @Column({
    name: 'provider_route_ref',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  providerRouteRef: string | null;

  @Column({ name: 'generated_at', type: 'timestamptz' })
  generatedAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
