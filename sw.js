/* ============================================================
   Service worker: guarda la app en el celular para usarla sin internet.
   IMPORTANTE: cada vez que cambies cualquier archivo de la app,
   sube el número de VERSION (v1 → v2 → v3...) para que el celular
   descargue la versión nueva. Tus datos NO se borran al actualizar.
   ============================================================ */
const VERSION = 'v2';
const CACHE = `mi-panel-${VERSION}`;

const ARCHIVOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/estilos.css',
  'js/util.js',
  'js/datos.js',
  'js/app.js',
  'js/pantallas/hoy.js',
  'js/pantallas/tareas.js',
  'js/pantallas/habitos.js',
  'js/pantallas/dinero.js',
  'js/pantallas/mas.js',
  'js/pantallas/ajustes.js',
  'fuentes/bricolage-grotesque.woff2',
  'fuentes/figtree.woff2',
  'iconos/icono-192.png',
  'iconos/icono-512.png',
  'iconos/icono-maskable-192.png',
  'iconos/icono-maskable-512.png',
  'iconos/apple-touch-icon.png',
];

// Al instalar: descarga y guarda todos los archivos, y se activa enseguida (skipWaiting)
// para que el celular use la versión nueva sin tener que cerrar la app.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ARCHIVOS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

// Al activar: borra las cachés de versiones anteriores y toma el control de la app abierta (clients.claim).
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(nombres.filter((n) => n.startsWith('mi-panel-') && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Por si una versión quedó esperando, la app puede pedirle que se active.
self.addEventListener('message', (e) => {
  if (e.data === 'saltar') self.skipWaiting();
});

// Primero la caché (rápido y sin internet); si no está, se pide a internet y se guarda.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const enCache = await cache.match(req, { ignoreSearch: true });
    if (enCache) return enCache;
    if (req.mode === 'navigate') {
      const inicio = await cache.match('index.html');
      if (inicio) return inicio;
    }
    try {
      const resp = await fetch(req);
      if (resp.ok && resp.type === 'basic') cache.put(req, resp.clone());
      return resp;
    } catch (err) {
      // (statusText solo admite caracteres sin acento)
      return new Response('Sin conexión', { status: 503, statusText: 'Sin conexion', headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
