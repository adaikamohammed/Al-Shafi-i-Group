importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in the
// messagingSenderId.
firebase.initializeApp({
    apiKey: "PLACEHOLDER_API_KEY", // Will be replaced or these scripts need to check context
    authDomain: "al-shafi-i-group.firebaseapp.com",
    projectId: "al-shafi-i-group",
    storageBucket: "al-shafi-i-group.firebasestorage.app",
    messagingSenderId: "530591742388",
    appId: "1:530591742388:web:7f85820465548074696013",
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
