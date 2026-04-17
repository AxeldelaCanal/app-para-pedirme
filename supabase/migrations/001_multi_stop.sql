-- Agrega soporte para múltiples destinos y navegación por etapas
ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS destinations JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS current_stop_index INT DEFAULT NULL;

-- Backfill: rides existentes obtienen destinations con su destino único
UPDATE rides
SET destinations = jsonb_build_array(
  jsonb_build_object(
    'address', destination,
    'lat', destination_lat,
    'lng', destination_lng
  )
)
WHERE destinations = '[]';
