// 毛球向上跳 — Service Worker
const CACHE = 'maoqiu-jump-v18';
const ASSETS = [
  './','./index.html','./audio.js','./themes.js','./game.js','./manifest.webmanifest',
  './icon-192.png','./icon-512.png','./icon-192-maskable.png','./icon-512-maskable.png',
  './assets/char_brown.png','./assets/char_pink.png','./assets/char_purple.png',
  './assets/char_blue.png','./assets/char_white.png'
];
// 注意：音频文件(themes/audio/*.mp3)体积大，按需加载，不预缓存；首次播放后由 fetch 处理器顺带缓存。
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  // 音频：网络优先，不阻塞、不强缓存（很大）
  if (url.indexOf('/themes/audio/') !== -1) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => cached))
  );
});
