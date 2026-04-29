    const CACHE_NAME = 'gachi-timetable-cache-v1';

// キャッシュするファイルのリスト（実際に存在するファイル名を指定してください）
const urlsToCache = [
  './',
  './zikanwari.html',
  './zikanwari-main.js',
  './manifest.json'
  // './style.css', // もしCSSファイルがあれば追加してください
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // キャッシュがあればそれを返し、なければネットワークから取得する
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});