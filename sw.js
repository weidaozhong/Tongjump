// 毛球向上跳 — Service Worker
const CACHE = 'maoqiu-jump-v122';
const ASSETS = [
  './','./index.html','./logic.js','./audio.js','./themes.js','./game.js','./manifest.webmanifest',
  './icon-192.png','./icon-512.png','./icon-192-maskable.png','./icon-512-maskable.png',
  './assets/char_brown.png?v=2','./assets/char_pink.png?v=2','./assets/char_purple.png?v=2',
  './assets/char_blue.png?v=2','./assets/char_white.png?v=2',
  './assets/sutra.woff2'
];
// 音频文件(themes/audio/*.mp3)体积大：SW 不接管（见 fetch 处理器里 return），交给浏览器 HTTP 缓存(_headers 设 30 天)、边下边播。
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// 是否为「应用外壳」：HTML + 核心脚本 + manifest —— 这些必须始终拿最新代码
function isShell(url){
  return url.endsWith('/') || url.endsWith('/index.html') || /\.(js|webmanifest)(\?|$)/.test(url);
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  // 音频：SW 不接管，交给浏览器 HTTP 缓存（很大、边下边播）
  if (url.indexOf('/themes/audio/') !== -1) return;

  // 外壳(HTML/JS/manifest)：网络优先 —— 在线总是最新版，离线才回退缓存。
  // 这样推送新版本后，用户下一次普通刷新即拿到最新，不会再被旧缓存卡住。
  if (isShell(url)) {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // 图片等静态资源：缓存优先（少变、体积稳定，命中快）
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => cached))
  );
});
