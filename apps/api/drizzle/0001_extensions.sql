-- Extensiones necesarias (idempotente). En Docker también se cargan desde
-- infra/db/init.sql, pero esta migración garantiza cualquier entorno.
CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
