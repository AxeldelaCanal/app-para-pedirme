import { Resend } from 'resend'
import type { Ride } from '@/types'

const resend = new Resend(process.env.RESEND_API_KEY)
const TO = process.env.NOTIFICATION_EMAIL!
const FROM = process.env.RESEND_FROM ?? 'onboarding@resend.dev'

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires',
  })
}

function rideStops(ride: Ride) {
  const dests = ride.destinations?.length
    ? ride.destinations.map(d => d.address)
    : [ride.destination]
  return [ride.origin, ...dests].join(' → ')
}

export async function emailNuevoPedido(ride: Ride) {
  await resend.emails.send({
    from: FROM,
    to: TO,
    subject: `🚗 Nuevo pedido — ${ride.client_name}`,
    html: `
      <h2>Nuevo pedido de viaje</h2>
      <p><strong>Cliente:</strong> ${ride.client_name}</p>
      <p><strong>Teléfono:</strong> ${ride.client_phone}</p>
      <p><strong>Ruta:</strong> ${rideStops(ride)}</p>
      <p><strong>Fecha:</strong> ${formatDate(ride.scheduled_at)}</p>
      <p><strong>Precio:</strong> $${ride.price_ars.toLocaleString('es-AR')}</p>
      ${ride.notes ? `<p><strong>Notas:</strong> ${ride.notes}</p>` : ''}
      <br>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="background:#10b981;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Ver en el panel</a>
    `,
  }).catch(err => console.error('[email] emailNuevoPedido:', err))
}

export async function emailCancelacion(ride: Ride) {
  await resend.emails.send({
    from: FROM,
    to: TO,
    subject: `❌ Viaje cancelado — ${ride.client_name}`,
    html: `
      <h2>Viaje cancelado</h2>
      <p><strong>Cliente:</strong> ${ride.client_name} (${ride.client_phone})</p>
      <p><strong>Ruta:</strong> ${rideStops(ride)}</p>
      <p><strong>Fecha:</strong> ${formatDate(ride.scheduled_at)}</p>
    `,
  }).catch(err => console.error('[email] emailCancelacion:', err))
}

export async function emailCambiosPropuestos(ride: Ride) {
  await resend.emails.send({
    from: FROM,
    to: TO,
    subject: `✏️ Cambios propuestos — ${ride.client_name}`,
    html: `
      <h2>El cliente propuso cambios en un viaje aceptado</h2>
      <p><strong>Cliente:</strong> ${ride.client_name} (${ride.client_phone})</p>
      <p><strong>Ruta original:</strong> ${rideStops(ride)}</p>
      <p><strong>Fecha:</strong> ${formatDate(ride.scheduled_at)}</p>
      <br>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="background:#10b981;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Revisar en el panel</a>
    `,
  }).catch(err => console.error('[email] emailCambiosPropuestos:', err))
}

export async function emailPedidoModificado(ride: Ride) {
  await resend.emails.send({
    from: FROM,
    to: TO,
    subject: `🕐 Pedido modificado — ${ride.client_name}`,
    html: `
      <h2>El cliente modificó su pedido</h2>
      <p><strong>Cliente:</strong> ${ride.client_name} (${ride.client_phone})</p>
      <p><strong>Ruta:</strong> ${rideStops(ride)}</p>
      <p><strong>Fecha:</strong> ${formatDate(ride.scheduled_at)}</p>
      <br>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="background:#10b981;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Ver en el panel</a>
    `,
  }).catch(err => console.error('[email] emailPedidoModificado:', err))
}
