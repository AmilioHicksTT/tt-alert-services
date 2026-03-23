const { getDB } = require('../config/database');
const { getMessaging } = require('../config/firebase');

async function sendAreaNotification(districtCode, { title, body, data = {} }) {
  try {
    const db = getDB();

    // Get all FCM tokens for users in this district
    const query = districtCode
      ? `SELECT fcm_token FROM users WHERE district_code = $1 AND fcm_token IS NOT NULL`
      : `SELECT fcm_token FROM users WHERE fcm_token IS NOT NULL`;

    const params = districtCode ? [districtCode] : [];
    const { rows } = await db.query(query, params);

    if (!rows.length) return;

    const tokens = rows.map((r) => r.fcm_token).filter(Boolean);
    if (!tokens.length) return;

    const messaging = getMessaging();
    if (!messaging) return;

    // FCM multicast — send in batches of 500
    for (let i = 0; i < tokens.length; i += 500) {
      const batch = tokens.slice(i, i + 500);
      await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
        data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
        android: {
          priority: 'high',
          notification: {
            channelId: 'tt_alerts',
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: { sound: 'default', badge: 1 },
          },
        },
      });
    }
  } catch (err) {
    console.error('Push notification error:', err.message);
  }
}

async function sendDirectNotification(fcmToken, { title, body, data = {} }) {
  try {
    const messaging = getMessaging();
    if (!messaging) return;
    await messaging.send({
      token: fcmToken,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    });
  } catch (err) {
    console.error('Direct push error:', err.message);
  }
}

module.exports = { sendAreaNotification, sendDirectNotification };
