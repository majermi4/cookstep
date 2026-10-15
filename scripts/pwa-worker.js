// VERSION and ASSETS are injected from the complete built frontend.
const VERSION = __PWA_VERSION__;
const ASSETS = __PWA_ASSETS__;
const CACHE = 'cookstep-shell-' + VERSION;
const paths = new Set(ASSETS);

self.addEventListener('install', event => {
  // Updates wait for explicit acceptance or for all old windows to close.
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      await Promise.all(ASSETS.map(async path => {
        // Hosting redirects /index.html to /. Fetch the canonical app route,
        // retaining the offline key used by navigation and older app shells.
        const response = await fetch(path === '/index.html' ? '/' : path, {cache: 'reload', credentials: 'same-origin', redirect: 'error'});
        const type = response.headers.get('content-type') || '';
        if (!response.ok || (path.endsWith('.html') ? !type.includes('text/html') : type.includes('text/html'))) {
          throw new Error('Offline download failed: ' + path);
        }
        await cache.put(path, response);
      }));
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await self.clients.claim();
    for (const key of await caches.keys()) {
      if (key.startsWith('cookstep-shell-') && key !== CACHE) await caches.delete(key);
    }
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Never intercept API, MCP, sign-in, private images, or other server routes.
  const path = request.mode === 'navigate' && ['/', '/index.html'].includes(url.pathname)
    ? '/index.html' : url.pathname;
  if (!paths.has(path)) return;
  event.respondWith((async () => {
    const cached = await (await caches.open(CACHE)).match(path);
    return cached || fetch(request);
  })());
});

async function ready(client) {
  return new Promise(resolve => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {channel.port1.close();resolve(false);}, 4000);
    channel.port1.onmessage = event => {
      clearTimeout(timer);channel.port1.close();resolve(event.data === true);
    };
    client.postMessage({type: 'COOKSTEP_CAN_UPDATE'}, [channel.port2]);
  });
}
self.addEventListener('message', event => {
  if (event.data?.type !== 'COOKSTEP_APPLY_UPDATE') return;
  event.waitUntil((async () => {
    const clients = (await self.clients.matchAll({type: 'window', includeUncontrolled: true}))
      .filter(client => ['/', '/index.html'].includes(new URL(client.url).pathname));
    const allowed = (await Promise.all(clients.map(ready))).every(Boolean);
    event.ports[0]?.postMessage({allowed});
    if (allowed) await self.skipWaiting();
  })());
});
