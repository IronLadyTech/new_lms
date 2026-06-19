importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js');

// Firebase config is not secret — already exposed in browser JS bundle.
firebase.initializeApp({
  apiKey: 'AIzaSyAdrvMFjHpbgQ937cM4MhMsdpCDFf25kpc',
  authDomain: 'lmsironlady.firebaseapp.com',
  projectId: 'lmsironlady',
  storageBucket: 'lmsironlady.firebasestorage.app',
  messagingSenderId: '829229653695',
  appId: '1:829229653695:web:a144087bd1003910eff00a',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title = 'LMS', body = '' } = payload.notification || {};
  self.registration.showNotification(title, {
    body,
    icon: '/logo.png',
    badge: '/logo.png',
    tag: 'lms-reminder',
    data: payload.data || {},
  });
});

// Focus an existing tab (or open one) when the notification is clicked.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => 'focus' in c);
        if (existing) return existing.focus();
        return self.clients.openWindow('/');
      })
  );
});
