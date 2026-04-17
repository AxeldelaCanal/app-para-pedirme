-- Tabla de pedidos
create table rides (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  client_phone text not null,
  origin text not null,
  origin_lat double precision not null,
  origin_lng double precision not null,
  destination text not null,
  destination_lat double precision not null,
  destination_lng double precision not null,
  scheduled_at timestamptz not null,
  distance_km double precision not null,
  duration_min double precision not null,
  price_ars numeric not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
  destinations jsonb not null default '[]',
  current_stop_index int default null,
  created_at timestamptz not null default now()
);

-- Tabla de configuración de tarifas
create table settings (
  id int primary key default 1,
  base_fare numeric not null default 1200,
  price_per_km numeric not null default 450,
  price_per_min numeric not null default 45,
  booking_fee numeric not null default 300,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);

-- Insertar configuración inicial
insert into settings (id) values (1) on conflict do nothing;

-- Permisos (Row Level Security)
alter table rides enable row level security;
alter table settings enable row level security;

-- Política: lectura pública para rides (cliente necesita crear)
create policy "rides_insert" on rides for insert to anon with check (true);

-- Política: lectura/escritura desde el server (service role bypasses RLS)
create policy "rides_select_service" on rides for select using (true);
create policy "rides_update_service" on rides for update using (true);
create policy "settings_all" on settings for all using (true);
