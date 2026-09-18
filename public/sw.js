/**
 * Service Worker - مدرسة الإمام الشافعي القرآنية
 * نظام التشغيل والتصفح الكامل بدون إنترنت (PWA Offline-First Engine v2.1)
 * يضمن تشغيل وتسجيل الحصص اليومية أوفلاين 100% بدون ظهور شاشة "لا يتوفر اتصال بالإنترنت"
 */

const CACHE_NAME = 'shafii-v2.4-sync-fix';

// المسارات الأساسية التي يتم تخزينها مسبقاً
const PRECACHE_ROUTES = [
  '/',
  '/login',
  '/dashboard',
  '/sessions',
  '/sessions/register',
  '/students',
  '/manifest.json',
  '/favicon.ico',
  '/logo.png'
];

// ─── 1. التثبيت والتحميل المسبق للصفحات الأساسية بشكل غير متوقف ──────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // استخدام allSettled لضمان عدم فشل التخزين إذا أعاد أي مسار إعادة توجيه (Redirect)
      await Promise.allSettled(
        PRECACHE_ROUTES.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'no-cache' });
            if (response && (response.ok || response.status === 200 || response.type === 'opaqueredirect')) {
              await cache.put(url, response);
            }
          } catch (err) {
            console.warn('[SW] Precache skipped for:', url, err);
          }
        })
      );
    }).then(() => self.skipWaiting())
  );
});

// ─── 2. التفعيل وتنظيف الكاشات القديمة وتولي السيطرة فوراً ─────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ─── 3. اعتراض الطلبات وتوفير تجربة أوفلاين متكاملة ───────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // استثناء طلبات Firebase وقواعد البيانات والـ API الخارجية
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('identitytoolkit') ||
    request.method !== 'GET'
  ) {
    return;
  }

  // ── أ. طلبات التنقل بين الصفحات (HTML Navigation) ─────────────────────────
  // مثل: النقر على رابط أو إدخال رابط الحصة /sessions/register?date=...&session=...
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      (async () => {
        // محاولة الشبكة أولاً مع مهلة سريعة (2.5 ثانية) لتفادي التعليق
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500);
          const networkResponse = await fetch(request, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            // تخزين نسخة من الصفحة مع رابطها الكامل
            cache.put(request, networkResponse.clone());
            // تخزين نسخة بدون query parameters كقالب عام للصفحة
            cache.put(url.pathname, networkResponse.clone());
            return networkResponse;
          }
        } catch (netErr) {
          // في حال عدم توفر إنترنت أو انتهاء المهلة، ننتقل فوراً للكاش
        }

        // البحث في الكاش: أولاً مع تجاهل الـ search params (?date=...&session=...)
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;

        // البحث عن قالب الصفحة حسب المسار الأساسي
        const pathname = url.pathname;
        if (pathname.startsWith('/sessions/register')) {
          const registerShell = await caches.match('/sessions/register', { ignoreSearch: true });
          if (registerShell) return registerShell;
        }

        if (pathname.startsWith('/sessions')) {
          const sessionsShell = await caches.match('/sessions', { ignoreSearch: true });
          if (sessionsShell) return sessionsShell;
        }

        if (pathname.startsWith('/dashboard')) {
          const dashboardShell = await caches.match('/dashboard', { ignoreSearch: true });
          if (dashboardShell) return dashboardShell;
        }

        if (pathname.startsWith('/students')) {
          const studentsShell = await caches.match('/students', { ignoreSearch: true });
          if (studentsShell) return studentsShell;
        }

        // Fallbacks عامة
        const generalFallback = (await caches.match('/dashboard', { ignoreSearch: true })) ||
                                (await caches.match('/sessions/register', { ignoreSearch: true })) ||
                                (await caches.match('/sessions', { ignoreSearch: true })) ||
                                (await caches.match('/', { ignoreSearch: true })) ||
                                (await caches.match('/login', { ignoreSearch: true }));

        if (generalFallback) return generalFallback;

        // في أقصى الحالات، نعيد صفحة HTML نظيفة بحالة 200 OK لمنع متصفح كروم من إظهار شاشة الخطأ
        return new Response(
          `<!DOCTYPE html>
          <html dir="rtl" lang="ar">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>المدرسة القرآنية للإمام الشافعي - وضع أوفلاين</title>
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; text-align: center; }
              .btn { margin-top: 20px; padding: 12px 24px; background: #059669; color: white; border: none; border-radius: 12px; font-weight: bold; cursor: pointer; }
            </style>
          </head>
          <body>
            <h2>المدرسة القرآنية للإمام الشافعي</h2>
            <p>أنت تعمل حالياً بدون اتصال بالإنترنت. جاري تشغيل النسخة المحلية المحفوظة...</p>
            <button class="btn" onclick="window.location.reload()">إعادة التحميل</button>
          </body>
          </html>`,
          {
            status: 200,
            statusText: 'OK',
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          }
        );
      })()
    );
    return;
  }

  // ── ب. طلبات Next.js RSC والبيانات الخاصة بالتنقل الداخلي ───────────────────
  const isRSC = url.searchParams.has('_rsc') || request.headers.get('RSC') === '1';
  if (isRSC) {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
            return networkResponse;
          }
        } catch (e) {
          // أوفلاين: محاولة المطابقة من الكاش مع تجاهل بارامترات البحث المتغيرة
          const cachedRSC = await caches.match(request, { ignoreSearch: true });
          if (cachedRSC) return cachedRSC;
        }

        // إذا لم يتوفر RSC أوفلاين، نعيد استجابة مقبولة تمنع توقف Next.js
        const matched = await caches.match(request, { ignoreSearch: true });
        if (matched) return matched;

        return new Response('', { status: 200, headers: { 'Content-Type': 'text/x-component' } });
      })()
    );
    return;
  }

  // ── ج. الأصول الثابتة (CSS, JS, Fonts, Images): Cache-First مع تحديث هادئ ─────
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
    const notificationTitle = payload.notification?.title || 'المدرسة القرآنية للإمام الشافعي';
    const notificationOptions = {
      body: payload.notification?.body || '',
      icon: '/logo.png'
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (e) {
  // Fallback هادئ إذا تعذر تحميل سكريبتات FCM بدون إنترنت
}
