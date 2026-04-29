self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const hasFocus = clientList.some((c) => c.focused)
      if (hasFocus) return

      return self.registration.showNotification(data.title ?? 'Nuevo pedido', {
        body: data.body ?? '',
        icon: '/icon-192.png',
        tag: data.tag ?? 'ride',
        data: { url: '/dashboard' },
      })
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          return client.focus()
        }
      }
      return clients.openWindow(self.registration.scope + 'dashboard')
    })
  )
})
