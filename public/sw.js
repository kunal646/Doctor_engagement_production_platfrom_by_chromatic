self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: "Doctor Engagement Update",
      body: event.data.text(),
      url: "/",
      tag: "doctor-engagement-update",
    };
  }

  const title = payload.title || "Doctor Engagement Update";
  const options = {
    body: payload.body || "There is a new update waiting for you.",
    data: {
      url: payload.url || "/",
    },
    tag: payload.tag || "doctor-engagement-update",
    badge: "/icon.svg",
    icon: "/icon.svg",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          if (client.url.includes(self.location.origin)) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    }),
  );
});
