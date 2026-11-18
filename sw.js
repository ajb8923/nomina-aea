// Service Worker: cachea la app la primera vez que se visita con conexión,
// y a partir de ahí la sirve desde caché aunque no haya internet.
const CACHE_NAME = 'nomina-aea-cache-v3';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Se cachea cada archivo por separado: si uno falla (p.ej. un icono con
      // ruta incorrecta), los demás se guardan igualmente en vez de perderse todos.
      return Promise.allSettled(
        URLS_TO_CACHE.map(url =>
          cache.add(url).catch(err => console.warn('No se pudo cachear', url, err))
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Estrategia: RED PRIMERO (con conexión siempre se ve la última versión publicada) y, si no hay
// red o tarda más de 4 s, se usa la copia en caché para que siga funcionando offline.
self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;
  event.respondWith(
    new Promise(resolve => {
      let respondido = false;
      const usarCache = () => caches.match(event.request).then(c => { if(c && !respondido){ respondido = true; resolve(c); } return c; });
      const timer = setTimeout(usarCache, 4000);
      fetch(event.request, {cache:'no-cache'}).then(resp => {
        clearTimeout(timer);
        if(resp && resp.ok){
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        if(!respondido){ respondido = true; resolve(resp); }
      }).catch(() => { clearTimeout(timer); usarCache().then(c => { if(!c && !respondido){ respondido = true; resolve(Response.error()); } }); });
    })
  );
});
