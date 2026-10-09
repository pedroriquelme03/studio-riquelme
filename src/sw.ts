/// <reference lib="webworker" />
// Service worker do PWA: cache do painel + notificações push.
// O texto self.__WB_MANIFEST é obrigatório para o vite-plugin-pwa injetar o precache.

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkOnly } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

clientsClaim();
self.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), {
	denylist: [/^\/api\//],
}));

registerRoute(
	({ url }) => url.pathname.startsWith('/api/'),
	new NetworkOnly(),
);

registerRoute(
	({ request }) => request.destination === 'image',
	new CacheFirst({
		cacheName: 'sr-admin-images',
		plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 })],
	}),
);

self.addEventListener('push', (event) => {
	let payload: { title?: string; body?: string; url?: string; tag?: string } = {};
	try {
		payload = event.data?.json() ?? {};
	} catch {
		payload = { title: 'Studio Riquelme', body: event.data?.text() || '' };
	}

	event.waitUntil(self.registration.showNotification(payload.title || 'Studio Riquelme', {
		body: payload.body || '',
		icon: '/pwa/icon-192.png',
		badge: '/pwa/icon-192.png',
		lang: 'pt-BR',
		tag: payload.tag,
		data: { url: payload.url || '/admin' },
	}));
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const targetUrl = new URL(event.notification.data?.url || '/admin', self.location.origin).href;
	event.waitUntil((async () => {
		const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
		for (const client of windows) {
			if (client.url.includes('/admin') && 'focus' in client) {
				await client.focus();
				return;
			}
		}
		await self.clients.openWindow(targetUrl);
	})());
});
