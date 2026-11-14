// Service worker: офлайн-оболочка.
// Стратегии:
//  - навигации (index.html): сначала сеть (с обходом HTTP-кэша), при офлайне — кэш.
//    Так обновления сайта подхватываются сразу.
//  - ассеты (js/css с хэшем в имени): cache-first, они неизменяемы.
//  - запросы к Supabase (чужой origin) не перехватываются.
const CACHE = 'wp-shell-v2'

self.addEventListener('install', (e) => e.waitUntil(caches.delete('wp-shell-v1')).then(() => self.skipWaiting()))

self.addEventListener('activate', (e) => e.waitUntil(clients.claim()))

// Обновление по команде из приложения (баннер «Доступна новая версия»)
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (url.origin !== location.origin) return
  if (e.request.method !== 'GET') return

  const isNavigation = e.request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname === '/wedding-planner/'
  const isHashedAsset = /\/assets\/.+-\w{8}\.\w+$/.test(url.pathname)

  if (isHashedAsset) {
    // неизменяемые ассеты: смело из кэша
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(e.request)
        return cached || fetch(e.request).then((res) => {
          if (res.ok) cache.put(e.request, res.clone())
          return res
        })
      })
    )
    return
  }

  // всё остальное (html, manifest, sw, иконки): сеть прежде всего
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          caches.open(CACHE).then((cache) => cache.put(e.request, res.clone()))
        }
        return res
      })
      .catch(() => caches.open(CACHE).then((cache) => cache.match(e.request)))
  )
})
