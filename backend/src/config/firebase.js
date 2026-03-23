const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

function initFirebase() {
  if (admin.apps.length) return;

  // Option 1: Load from service account JSON file
  const saPath = path.join(__dirname, '..', '..', 'firebase-service-account.json');
  if (fs.existsSync(saPath)) {
    const serviceAccount = require(saPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase Admin initialised (service account file)');
    return;
  }

  // Option 2: Load from environment variables (Render deployment)
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    console.log('Firebase Admin initialised (env vars)');
    return;
  }

  console.log('Firebase credentials not set — push notifications disabled');
}

function getMessaging() {
  if (!admin.apps.length) return null;
  return admin.messaging();
}

module.exports = { initFirebase, getMessaging };
