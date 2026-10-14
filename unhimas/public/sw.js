self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() || '' };
  }

  const title = payload.title || 'UNHIMAS';
  const options = {
    body: payload.body || 'You have a new notification.',
    icon: '/unhimas_logo.jpg',
    badge: '/unhimas_logo.jpg',
    data: { url: payload.url || '/' },
    tag: payload.tag || payload.id,
    renotify: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const target = new URL(event.notification.data?.url || '/', self.location.origin);
  if (target.origin !== self.location.origin) {
    target.pathname = '/';
    target.search = '';
    target.hash = '';
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => new URL(client.url).origin === target.origin);
      if (existingClient) {
        return existingClient.navigate(target.href).then((client) => client?.focus());
      }
      return self.clients.openWindow(target.href);
    })
  );
});
