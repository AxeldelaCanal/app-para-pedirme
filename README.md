# Pedí tu viaje

App PWA para reservar viajes con precio fijo y confirmación directa por WhatsApp. Incluye panel de control privado para el conductor con notificaciones push en tiempo real.

## Qué hace

**Clientes** acceden a `/` y completan un formulario de 4 pasos:
1. Origen y destinos (soporte multi-parada, drag & drop para reordenar)
2. Precio calculado automáticamente según distancia y duración real (Google Maps)
3. Fecha y hora del viaje
4. Nombre y teléfono de contacto

Al confirmar, reciben una página de resumen con opción de cancelar o editar el viaje.

**Conductor** accede a `/dashboard` con contraseña y desde ahí:
- Ve todos los pedidos en tiempo real (polling cada 10s + Supabase Realtime)
- Acepta, rechaza o completa viajes (abre WhatsApp con mensaje pre-cargado)
- Recibe notificaciones push aunque la app esté cerrada o en segundo plano
- Ve estadísticas de ganancias por período (hoy, semana, mes, total)
- Ordena pedidos pendientes por proximidad al último destino aceptado
- Configura tarifas y teléfono de contacto desde el mismo panel

## Stack

- **Framework**: Next.js 15 (App Router)
- **Base de datos**: Supabase (PostgreSQL + Realtime)
- **Mapas y distancias**: Google Maps API (Places Autocomplete + Distance Matrix)
- **Estilos**: Tailwind CSS v4
- **Drag & drop**: @dnd-kit
- **Notificaciones**: Web Push API + web-push (VAPID) + Resend (email)
- **Deploy**: Vercel

## Arquitectura

```
/                     → BookingForm (wizard 4 pasos, público)
/confirmation/[id]    → Resumen del viaje, cancelar o editar
/editar/[id]          → Editor completo: origen, destinos múltiples, fecha/hora, precio
/dashboard            → Panel del conductor (protegido por cookie)
/dashboard/login      → Login del conductor
```

Dos manifests PWA separados:
- `/manifest.json` → `start_url: "/"` para clientes
- `/manifest-dashboard.json` → `start_url: "/dashboard"` para el conductor

## Variables de entorno

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_KEY=        # Places Autocomplete (client-side)
GOOGLE_MAPS_API_KEY=                # Distance Matrix (server-side)
DASHBOARD_PASSWORD=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=       # Web Push notifications
VAPID_PRIVATE_KEY=
VAPID_EMAIL=                        # mailto:tu@email.com
RESEND_API_KEY=                     # Email notifications (resend.com)
NOTIFICATION_EMAIL=                 # Email donde llegan los avisos
NEXT_PUBLIC_APP_URL=                # URL de producción (ej: https://app-para-pedirme.vercel.app)
```

## Base de datos (Supabase)

### Tabla `rides`

| Columna | Tipo | Descripción |
|---|---|---|
| id | uuid | PK generado automáticamente |
| client_name | text | Nombre del cliente |
| client_phone | text | Teléfono del cliente |
| origin | text | Dirección de origen |
| origin_lat / origin_lng | float8 | Coordenadas de origen |
| destination | text | Última parada (compatibilidad) |
| destination_lat / destination_lng | float8 | Coordenadas última parada |
| destinations | jsonb | Array de paradas `[{address, lat, lng}]` |
| current_stop_index | int4 | null = no iniciado; número = parada actual |
| scheduled_at | timestamptz | Fecha y hora del viaje |
| distance_km | float8 | Distancia calculada |
| duration_min | float8 | Duración estimada |
| price_ars | int4 | Precio en pesos argentinos |
| status | text | pending / accepted / rejected / completed / cancelled |
| notes | text | Notas del cliente (opcional) |
| pending_changes | jsonb | Cambios propuestos por el cliente en viajes aceptados |
| created_at | timestamptz | Timestamp de creación |

### Tabla `settings`

| Columna | Tipo | Descripción |
|---|---|---|
| id | int4 | Siempre 1 (fila única) |
| base_fare | float8 | Tarifa base en ARS |
| price_per_km | float8 | Precio por km |
| price_per_min | float8 | Precio por minuto |
| booking_fee | float8 | Cargo de reserva |
| driver_phone | text | Teléfono del conductor para WhatsApp |
| push_subscription | jsonb | Suscripción push activa del conductor |
| updated_at | timestamptz | Última actualización |

### Migración requerida

```sql
ALTER TABLE settings ADD COLUMN push_subscription jsonb;
```

## Correr localmente

```bash
npm install
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

Las push notifications requieren HTTPS. En localhost funcionan en Chrome/Edge. En producción funcionan en cualquier browser que soporte Web Push.

## Comandos

```bash
npm run dev      # Servidor de desarrollo (localhost:3000)
npm run lint     # ESLint
```

## Flujos clave

### Pedido de cambios en viaje aceptado

Si el cliente edita un viaje ya aceptado que no ha comenzado (`current_stop_index === null`), los cambios quedan en `pending_changes` y el conductor debe aprobarlos o rechazarlos desde el panel. Si el viaje ya comenzó, los cambios se aplican directamente.

### Notificaciones al conductor

Cuando un cliente crea o modifica un viaje, el servidor dispara dos canales en paralelo:

- **Email** (Resend): llega instantáneo con los datos del cliente y un botón al panel. Funciona en cualquier dispositivo sin configuración extra.
- **Web Push**: requiere que el conductor active las alertas desde el panel. Registra un Service Worker (`public/sw.js`) y guarda la suscripción en `settings.push_subscription`. El SW muestra la notificación aunque la app esté cerrada. En iOS solo funciona si el dashboard está instalado como PWA en la pantalla de inicio.

### Detección de conflictos de horario

Al aceptar un viaje, el panel calcula si hay conflicto con viajes ya aceptados usando distancia Haversine entre el último destino del viaje anterior y el origen del nuevo, asumiendo 40 km/h de velocidad promedio con 10 minutos de buffer.
