/* ============================================================
   Service Worker для «Диспетчер ЖКХ»
   Версия кэша: v1.0.0
   ============================================================ */

const CACHE_NAME = 'dzhkh-v1';
const RUNTIME_CACHE = 'dzhkh-runtime-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './master.html',
  './manifest.json',
  './oferta.html',
  './privacy.html'
];

self.addEventListener('install', (event) => {
  console.log('[SW] Установка...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Кэширую основные файлы');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('[SW] Ошибка кэширования:', err))
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Активация...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => {
            console.log('[SW] Удаляю старый кэш:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (url.hostname.includes('webhook.nodul.ru') ||
      url.hostname.includes('api.') ||
      url.hostname.includes('google-analytics') ||
      url.hostname.includes('mc.yandex')) {
    return;
  }

  if (!url.protocol.startsWith('http')) return;

  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('./index.html');
          });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        fetch(request).then((response) => {
          if (response && response.status === 200) {
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, response);
            });
          }
        }).catch(() => {});
        return cached;
      }

      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const responseClone = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => {
          cache.put(request, responseClone);
        });
        return response;
      }).catch(() => {
        if (request.destination === 'image') {
          return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#e2e8f0"/></svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
        }
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }
});