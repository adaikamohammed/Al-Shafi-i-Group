/**
 * Service Worker - مدرسة الإمام الشافعي القرآنية
 * دعم التصفح الكامل والتشغيل بدون إنترنت (PWA Offline-First)
 * استراتيجية Precache و Network-First مع Fallback ذكي
 */

const CACHE_NAME = 'shafii-v1.0-offline-ready';

const PRECACHE_ROUTES = [
  '/',
  '/login',
  '/dashboard',
  '/sessions',
  '/sessions/register',
  '/students',
  '/admin/admin-docs',
  '/management/penalties',
  '/settings',
  '/manifest.json',
  '/favicon.ico',
];

// ─── 1. التثبيت والتحميل المسبق للصفحات الأساسية ──────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ROUTES).catch((err) => {
        console.warn('PWA Precache warning (non-fatal):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ─── 2. التفعيل وتنظيف الكاشات القديمة ─────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ─── 3. اعتراض الطلبات وتوفير تجربة أوفلاين سلسة ───────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // استثناء طلبات Firebase و API الخارجية من الكاش (Network Only)
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('identitytoolkit') ||
    request.method !== 'GET'
  ) {
    return;
  }

  // أ. طلبات التنقل بين الصفحات (HTML Navigation): Network-First مع Fallback أوفلاين
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          // محاولة استرجاع نفس الصفحة المطلوبة من الكاش
          const cached = await caches.match(request);
          if (cached) return cached;

          // إذا لم تكن مخزنة سابقاً، فتح لوحة التحكم أو الصفحة الرئيسية كبديل
          const fallback = (await caches.match('/dashboard')) || 
                           (await caches.match('/sessions/register')) || 
                           (await caches.match('/')) || 
                           (await caches.match('/login'));
          if (fallback) return fallback;

          return new Response('Offline - المدرسة القرآنية للإمام الشافعي', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        })
    );
    return;
  }

  // ب. الأصول الثابتة (CSS, JS, Fonts, Images): Cache-First مع تحديث هادئ في الخلفية
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            request.method === 'GET' &&
            url.origin === location.origin
          ) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// ─── 4. تكامل رسائل FCM الخلفية ──────────────────────────────────────────────
try {
  importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

  firebase.initializeApp({
    apiKey: "AIzaSyCVZOpgoz76g5AQDnPyRTzPB6UoT2YYKL8",
    authDomain: "al-shafi-i-quran-school.web.app",
    projectId: "al-shafi-i-quran-school",
    storageBucket: "al-shafi-i-quran-school.appspot.com",
    messagingSenderId: "833438544513",
    appId: "1:833438544513:web:e141646e143dc4ac851380",
    databaseURL: "https://al-shafi-i-quran-school-default-rtdb.firebaseio.com"
  });

  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    console.log('[sw.js] Received background message ', payload);
    const notificationTitle = payload.notification?.title || 'المدرسة القرآنية للإمام الشافعي';
    const notificationOptions = {
      body: payload.notification?.body || '',
      icon: '/logo.png'
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (e) {
  // Silent fallback if FCM scripts fail to load offline
}
