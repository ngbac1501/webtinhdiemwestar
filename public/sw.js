const CACHE_NAME = 'westar-cache-v3';
const urlsToCache = [
    '/',
    '/index.html',
    '/login.html',
    '/index.js',
    '/assets/images/logows.png',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
    self.skipWaiting();
});

self.addEventListener('fetch', event => {
    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    
    // Check if the request is for a script, style, or HTML document
    const isNavigation = event.request.mode === 'navigate';
    const isScript = event.request.destination === 'script' || url.pathname.endsWith('.js');
    const isStyle = event.request.destination === 'style' || url.pathname.endsWith('.css');
    const isHtml = url.pathname.endsWith('.html') || url.pathname === '/';

    if (isNavigation || isScript || isStyle || isHtml) {
        // Network-First strategy: always fetch latest from network first when online
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Only cache successful basic responses
                    if (response && response.status === 200 && response.type === 'basic') {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Fall back to cache when offline
                    return caches.match(event.request).then(cachedResponse => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // Default offline fallback for navigation
                        if (isNavigation) {
                            return caches.match('/index.html');
                        }
                    });
                })
        );
    } else {
        // Cache-First strategy: standard assets (images, fonts, external CDNs)
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    if (response) {
                        return response;
                    }
                    return fetch(event.request).then(response => {
                        if (!response || response.status !== 200) {
                            return response;
                        }
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                        return response;
                    });
                }).catch(() => {
                    // Fallback in case of absolute failure
                    return new Response('', { status: 404 });
                })
        );
    }
});

self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('🧹 Cleaning old service worker cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});
