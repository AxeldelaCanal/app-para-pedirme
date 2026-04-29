import { Resend } from 'resend'
import type { Ride } from '@/types'

const resend = new Resend(process.env.RESEND_API_KEY)
const FALLBACK_TO = process.env.NOTIFICATION_EMAIL!
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

export async function emailNuevoPedido(ride: Ride, driverEmail?: string) {
  await resend.emails.send({
    from: FROM,
    to: driverEmail ?? FALLBACK_TO,
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

export async function emailCancelacion(ride: Ride, driverEmail?: string) {
  await resend.emails.send({
    from: FROM,
    to: driverEmail ?? FALLBACK_TO,
    subject: `❌ Viaje cancelado — ${ride.client_name}`,
    html: `
      <h2>Viaje cancelado</h2>
      <p><strong>Cliente:</strong> ${ride.client_name} (${ride.client_phone})</p>
      <p><strong>Ruta:</strong> ${rideStops(ride)}</p>
      <p><strong>Fecha:</strong> ${formatDate(ride.scheduled_at)}</p>
    `,
  }).catch(err => console.error('[email] emailCancelacion:', err))
}

export async function emailCambiosPropuestos(ride: Ride, driverEmail?: string) {
  await resend.emails.send({
    from: FROM,
    to: driverEmail ?? FALLBACK_TO,
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

export async function emailVerificacion(to: string, verifyLink: string) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: '✅ Verificá tu email — Panel del conductor',
    html: `
      <h2>Verificá tu email</h2>
      <p>Hacé clic en el link para activar tu cuenta. El link es válido por 24 horas.</p>
      <br>
      <a href="${verifyLink}" style="background:#10b981;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Verificar email</a>
      <br><br>
      <p style="color:#888;font-size:12px;">Si no te registraste, ignorá este mail.</p>
    `,
  }).catch(err => console.error('[email] emailVerificacion:', err))
}

export async function emailResetPassword(to: string, resetLink: string) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: '🔑 Restablecer contraseña — Panel del conductor',
    html: `
      <h2>Restablecer contraseña</h2>
      <p>Recibimos una solicitud para restablecer tu contraseña. El link es válido por 1 hora.</p>
      <br>
      <a href="${resetLink}" style="background:#10b981;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Restablecer contraseña</a>
      <br><br>
      <p style="color:#888;font-size:12px;">Si no pediste esto, ignorá este mail. Tu contraseña no cambia.</p>
    `,
  }).catch(err => console.error('[email] emailResetPassword:', err))
}

export async function emailPedidoModificado(ride: Ride, driverEmail?: string) {
  await resend.emails.send({
    from: FROM,
    to: driverEmail ?? FALLBACK_TO,
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
