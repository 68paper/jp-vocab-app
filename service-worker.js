/**
 * service-worker.js
 * 정적 파일 캐싱 및 오프라인 동작 지원
 *
 * ── 전략 ─────────────────────────────────────────────────
 * Cache First: 캐시에 있으면 캐시 우선 반환
 * 캐시에 없으면 네트워크에서 가져온 후 캐시에 저장
 *
 * ── 업데이트 방법 ─────────────────────────────────────────
 * CACHE_VERSION 값을 올리면 다음 방문 시 새 캐시로 교체됨
 * 예) 'vocab-v1' → 'vocab-v2'
 */

const CACHE_VERSION = 'vocab-v1';

const STATIC_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  './css/main.css',
  './css/card.css',
  './css/calendar.css',
  './js/storage.js',
  './js/data.js',
  './js/csv.js',
  './js/quiz.js',
  './js/settings.js',
  './js/card.js',
  './js/calendar.js',
  './js/app.js',
];

// ── install: 정적 파일 캐싱 ───────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => {
        console.log('[SW] 정적 파일 캐싱 시작');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('[SW] 캐싱 완료');
        // 새 SW가 즉시 활성화되도록
        return self.skipWaiting();
      })
      .catch(err => console.error('[SW] 캐싱 실패:', err))
  );
});

// ── activate: 이전 캐시 정리 ──────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => {
            console.log('[SW] 이전 캐시 삭제:', key);
            return caches.delete(key);
          })
      ))
      .then(() => {
        console.log('[SW] 활성화 완료');
        // 열려 있는 모든 탭에 즉시 적용
        return self.clients.claim();
      })
  );
});

// ── fetch: Cache First 전략 ───────────────────────────────
self.addEventListener('fetch', (event) => {
  // GET 요청만 처리
  if (event.request.method !== 'GET') return;

  // 외부 리소스(Google Fonts 등)는 네트워크 우선
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // 앱 내부 리소스: Cache First
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;

        // 캐시 미스 시 네트워크에서 가져와서 캐시에 저장
        return fetch(event.request)
          .then(response => {
            // 유효한 응답만 캐시
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const responseClone = response.clone();
            caches.open(CACHE_VERSION)
              .then(cache => cache.put(event.request, responseClone));
            return response;
          })
          .catch(() => {
            // 오프라인 + 캐시 미스: index.html 반환 (SPA 폴백)
            if (event.request.destination === 'document') {
              return caches.match('./index.html');
            }
          });
      })
  );
});
