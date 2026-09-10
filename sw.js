/* Nintendo Switch 게임 라이브러리 — Service Worker
   정적 리소스를 캐싱해 오프라인에서도 목록 확인/검색/체크가 가능하도록 합니다.

   전략:
   - 앱 코드(HTML/CSS/JS)는 "네트워크 우선"으로 가져옵니다. 온라인 상태라면
     항상 최신 버전을 받고, 실패했을 때만(오프라인) 캐시로 대체합니다.
     → 배포 후 캐시가 예전 화면을 계속 보여주는 문제를 방지합니다.
   - 아이콘 등 거의 바뀌지 않는 정적 파일만 "캐시 우선"으로 처리합니다.
*/

const CACHE_NAME = 'game-library-v2';

const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/data.js',
  './js/app.js',
  './manifest.json'
];
const STATIC_ASSETS = [
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll([...APP_SHELL, ...STATIC_ASSETS]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isAppShellRequest(url){
  return APP_SHELL.some((path) => url.endsWith(path.replace('./', '/')) || url.endsWith(path));
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;
  const isNavigate = event.request.mode === 'navigate';

  // 앱 셸(HTML/CSS/JS) + 페이지 이동: 네트워크 우선, 실패 시 캐시
  if (isNavigate || isAppShellRequest(url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // 그 외(아이콘 등 정적 파일): 캐시 우선, 없으면 네트워크
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
