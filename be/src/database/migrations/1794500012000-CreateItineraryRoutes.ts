import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateItineraryRoutes1794500012000 implements MigrationInterface {
  name = 'CreateItineraryRoutes1794500012000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "itinerary_routes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "itinerary_id" uuid NOT NULL,
        "route_date" date NOT NULL,
        "profile" varchar(30) NOT NULL,
        "provider" varchar(20) NOT NULL DEFAULT 'MAPBOX',
        "status" varchar(20) NOT NULL,
        "geometry" geometry(LineString, 4326) NOT NULL,
        "distance_meters" integer NOT NULL,
        "duration_seconds" integer NOT NULL,
        "waypoints" jsonb NOT NULL,
        "legs" jsonb NOT NULL,
        "waypoint_signature" char(64) NOT NULL,
        "provider_route_ref" varchar(200),
        "generated_at" timestamptz NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_itinerary_routes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_itinerary_routes_itinerary"
          FOREIGN KEY ("itinerary_id") REFERENCES "itineraries"("id")
          ON DELETE CASCADE,
        CONSTRAINT "CHK_itinerary_routes_profile"
          CHECK ("profile" IN ('driving', 'driving-traffic', 'walking', 'cycling')),
        CONSTRAINT "CHK_itinerary_routes_provider"
          CHECK ("provider" = 'MAPBOX'),
        CONSTRAINT "CHK_itinerary_routes_status"
          CHECK ("status" IN ('CURRENT', 'STALE', 'SUPERSEDED')),
        CONSTRAINT "CHK_itinerary_routes_distance"
          CHECK ("distance_meters" >= 0),
        CONSTRAINT "CHK_itinerary_routes_duration"
          CHECK ("duration_seconds" >= 0),
        CONSTRAINT "CHK_itinerary_routes_expiry"
          CHECK (
            "expires_at" > "generated_at"
            AND "expires_at" <= "generated_at" + interval '30 days'
          )
      );
      CREATE INDEX "IDX_itinerary_routes_lookup"
        ON "itinerary_routes" (
          "itinerary_id", "route_date", "profile", "created_at" DESC
        );
      CREATE INDEX "IDX_itinerary_routes_expiry"
        ON "itinerary_routes" ("expires_at");
      CREATE UNIQUE INDEX "UQ_itinerary_routes_current"
        ON "itinerary_routes" ("itinerary_id", "route_date", "profile")
        WHERE "status" = 'CURRENT';
      CREATE INDEX "IDX_itinerary_routes_geometry"
        ON "itinerary_routes" USING GIST ("geometry");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "itinerary_routes"');
  }
}
