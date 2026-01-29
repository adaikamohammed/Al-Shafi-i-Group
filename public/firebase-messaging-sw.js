importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in the
// messagingSenderId.
firebase.initializeApp({
    apiKey: "AIzaSyCVZOpgoz76g5AQDnPyRTzPB6UoT2YYKL8",
    authDomain: "al-shafi-i-quran-school.web.app",
    projectId: "al-shafi-i-quran-school",
    storageBucket: "al-shafi-i-quran-school.appspot.com",
    messagingSenderId: "833438544513",
    appId: "1:833438544513:web:e141646e143dc4ac851380",
    databaseURL: "https://al-shafi-i-quran-school-default-rtdb.firebaseio.com"
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    // Customize notification here
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/logo.png' // Use your app logo
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
