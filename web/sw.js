/* RingTracker – Service Worker: macht die App offline nutzbar.
   Die Seite selbst kommt zuerst aus dem Netz (Updates kommen sofort an), sonst aus dem Cache. */
const CACHE = "ringtracker-v1";
const FILES = ["./", "index.html", "rt.css", "rt-import.js", "rt-beispiel.js", "rt-app.js", "manifest.webmanifest",
               "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"];

self.addEventListener("install", ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", ev => {
  ev.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", ev => {
  const req = ev.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  // Netz zuerst, damit Änderungen nach einem Push sofort da sind; offline aus dem Cache
  ev.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("index.html")))
  );
});
