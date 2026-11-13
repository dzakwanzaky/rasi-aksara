// Rasi Aksara service worker: shows round notifications and opens the Checklist when one is tapped.
// No offline caching on purpose: staff must always see live data.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  const title = data.title || "Rasi Aksara";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "",
    tag: data.tag || "rasi-aksara",
    renotify: true,
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    data: { url: data.url || "/checklist" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/checklist", self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.location.origin) && "focus" in w) {
        await w.focus();
        if ("navigate" in w) await w.navigate(url).catch(() => {});
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});

