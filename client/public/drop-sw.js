self.addEventListener("push", event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "RarityGrid drop detected", body: event.data?.text() };
  }

  const show = self.registration.showNotification(
    payload.title || "RarityGrid drop detected",
    {
      body: payload.body || "A monitored Pokémon product is live.",
      icon: payload.icon || "/pwa-192.png",
      badge: "/pwa-192.png",
      tag: payload.tag || "raritygrid-drop",
      renotify: true,
      requireInteraction: true,
      data: { url: payload.url || "/drops" },
      actions: [{ action: "open", title: "Open product" }],
    }
  );
  const badge =
    "setAppBadge" in self.navigator
      ? self.navigator.setAppBadge(1)
      : Promise.resolve();
  event.waitUntil(Promise.all([show, badge]));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const clearBadge =
    "clearAppBadge" in self.navigator
      ? self.navigator.clearAppBadge()
      : Promise.resolve();
  let url = new URL(
    event.notification.data?.url || "/drops",
    self.location.origin
  );
  if (url.protocol !== "https:" && url.origin !== self.location.origin) {
    url = new URL("/drops", self.location.origin);
  }

  const open =
    url.origin !== self.location.origin
      ? self.clients.openWindow(url.href)
      : self.clients
          .matchAll({ type: "window", includeUncontrolled: true })
          .then(clients => {
            const sameOrigin = clients.find(client =>
              client.url.startsWith(self.location.origin)
            );
            if (sameOrigin && "focus" in sameOrigin) {
              sameOrigin.navigate(url.href);
              return sameOrigin.focus();
            }
            return self.clients.openWindow(url.href);
          });
  event.waitUntil(Promise.all([clearBadge, open]));
});
