/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const worker = self as unknown as ServiceWorkerGlobalScope;
const CACHE_NAME = `axial-${version}`;
const STATIC_ASSETS = [...build, ...files];

worker.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => cache.addAll(STATIC_ASSETS))
			.then(() => worker.skipWaiting())
	);
});

worker.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((cacheNames) =>
				Promise.all(
					cacheNames
						.filter((cacheName) => cacheName.startsWith('axial-') && cacheName !== CACHE_NAME)
						.map((cacheName) => caches.delete(cacheName))
				)
			)
			.then(() => worker.clients.claim())
	);
});

worker.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);
	if (url.origin !== worker.location.origin) return;

	if (event.request.mode === 'navigate') {
		event.respondWith(networkFirst(event.request));
		return;
	}

	if (STATIC_ASSETS.includes(url.pathname)) {
		event.respondWith(cacheFirst(event.request));
	}
});

async function networkFirst(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE_NAME);

	try {
		const response = await fetch(request);
		cache.put(request, response.clone());
		return response;
	} catch {
		return (await cache.match(request)) ?? (await cache.match('/')) ?? Response.error();
	}
}

async function cacheFirst(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE_NAME);
	const cached = await cache.match(request);

	if (cached) return cached;

	const response = await fetch(request);
	cache.put(request, response.clone());
	return response;
}
