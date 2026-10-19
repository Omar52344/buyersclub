-- Columna geográfica mantenida por trigger para consultas de proximidad.
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "location" geography(Point,4326);--> statement-breakpoint

UPDATE "branches"
SET "location" = ST_SetSRID(ST_MakePoint("lng", "lat"), 4326)::geography
WHERE "location" IS NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "branches_location_gist"
ON "branches" USING gist ("location");--> statement-breakpoint

CREATE OR REPLACE FUNCTION branches_set_location()
RETURNS trigger AS $$
BEGIN
  NEW."location" := ST_SetSRID(ST_MakePoint(NEW."lng", NEW."lat"), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS branches_location_trigger ON "branches";--> statement-breakpoint

CREATE TRIGGER branches_location_trigger
BEFORE INSERT OR UPDATE OF "lat", "lng" ON "branches"
FOR EACH ROW
EXECUTE FUNCTION branches_set_location();
