const CACHE_NAME = "safari-bingo-cache-v2";
const ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/data.js",
  "/app.js",
  "/manifest.webmanifest",
  "/public/icons/icon.svg",
  "/public/icons/mask-icon.svg",
  "/public/images/baboon.jpg",
  "/public/images/buffalo.jpg",
  "/public/images/cheetah.jpg",
  "/public/images/crocodile.jpg",
  "/public/images/dik-dik.jpg",
  "/public/images/eland.jpg",
  "/public/images/elephant.jpg",
  "/public/images/fish-eagle.jpg",
  "/public/images/gazelle.jpg",
  "/public/images/giraffe.jpg",
  "/public/images/hartebeest.jpg",
  "/public/images/hippo.jpg",
  "/public/images/hyena.jpg",
  "/public/images/impala.jpg",
  "/public/images/leopard.jpg",
  "/public/images/lion.jpg",
  "/public/images/ostrich.jpg",
  "/public/images/rhino.jpg",
  "/public/images/secretary-bird.jpg",
  "/public/images/serval.jpg",
  "/public/images/vervet-monkey.jpg",
  "/public/images/warthog.jpg",
  "/public/images/wild-dog.jpg",
  "/public/images/wildebeest.jpg",
  "/public/images/zebra.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/index.html")));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return networkResponse;
      });
    }),
  );
});
