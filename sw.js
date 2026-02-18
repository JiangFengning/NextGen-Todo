const CACHE_NAME = 'todo-master-v2';
const RUNTIME_CACHE = 'todo-master-runtime-v1';

const STATIC_CACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './script.js',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css'
];

self.addEventListener('install', event => {
  console.log('[SW] Install event triggered');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching static resources');
        return cache.addAll(STATIC_CACHE_URLS.map(url => new Request(url, { mode: 'cors' })))
          .catch(error => {
            console.error('[SW] Failed to cache some resources:', error);
            return cache.addAll(['./', './index.html', './manifest.json', './script.js']);
          });
      })
      .then(() => {
        console.log('[SW] Installation complete');
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activate event triggered');
  event.waitUntil(
    Promise.all([
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          console.log('[SW] Serving from cache:', request.url);
          return cachedResponse;
        }

        console.log('[SW] Fetching from network:', request.url);
        return fetch(request)
          .then(response => {
            if (!response || response.status !== 200 || response.type === 'error') {
              console.log('[SW] Network response invalid:', request.url);
              return response;
            }

            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE)
              .then(cache => {
                cache.put(request, responseToCache);
                console.log('[SW] Cached:', request.url);
              })
              .catch(error => {
                console.error('[SW] Failed to cache:', error);
              });

            return response;
          })
          .catch(error => {
            console.error('[SW] Network fetch failed:', error);
            return caches.match(request)
              .then(cachedResponse => {
                if (cachedResponse) {
                  console.log('[SW] Fallback to cache:', request.url);
                  return cachedResponse;
                }
                throw error;
              });
          });
      })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
