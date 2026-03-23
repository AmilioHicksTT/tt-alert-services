const admin = require('firebase-admin');

function initFirebase() {
  if (admin.apps.length) return;

  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY) {
    console.log('Firebase credentials not set — push notifications disabled');
    return;
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });

  console.log('Firebase Admin initialised');
}

function getMessaging() {
  return admin.messaging();
}

module.exports = { initFirebase, getMessaging };
