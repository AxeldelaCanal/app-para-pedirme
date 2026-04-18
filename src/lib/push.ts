import webpush from 'web-push'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
const VAPID_EMAIL = process.env.VAPID_EMAIL ?? 'mailto:admin@example.com'

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE)
}

export async function sendPush(
  subscription: webpush.PushSubscription,
  payload: { title: string; body: string; tag?: string }
) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
  } catch (err) {
    console.error('[push] Error enviando notificación:', err)
  }
}
