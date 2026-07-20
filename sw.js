// Service Worker — הסדר היומי
// אחראי על עבודה offline והתקנה כאפליקציה (PWA)
const CACHE = "hasseder-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// אסטרטגיית בקשות:
// - Firebase/Google (סנכרון) — תמיד רשת ישירה
// - ניווט / index.html — network-first: קודם רשת (כדי שעדכונים מ-GitHub יגיעו מיד),
//   ואם אין רשת — מהמטמון (offline)
// - שאר הקבצים (אייקונים וכו') — cache-first
self.addEventListener("fetch", (e) => {
  const url = e.request.url;
  if (url.includes("firestore.googleapis.com") || url.includes("googleapis.com") || url.includes("firebase")) {
    return;
  }
  if (e.request.method !== "GET") return;

  const isNavigation = e.request.mode === "navigate" ||
    url.endsWith("/index.html") || url.endsWith("/");

  if (isNavigation) {
    // network-first — עדכונים תמיד מגיעים, המטמון משמש רק ב-offline
    e.respondWith(
      fetch(e.request).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match(e.request).then((c) => c || caches.match("./index.html")))
    );
    return;
  }

  // cache-first לשאר
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        if (res && res.status === 200 && e.request.url.startsWith(self.location.origin)) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      });
    })
  );
});

// לחיצה על התראה — פותח/ממקד את האפליקציה
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ("focus" in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow("./index.html");
    })
  );
});
