-- Tabla de choferes
CREATE TABLE IF NOT EXISTS drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drivers_service" ON drivers FOR ALL USING (true);

-- driver_id en rides
ALTER TABLE rides ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES drivers(id);

-- driver_id en settings (la fila existente id=1 queda sin driver_id hasta el backfill)
ALTER TABLE settings ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES drivers(id);
