const Redis = require('ioredis');

let client;

async function connectRedis() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  // Upstash uses rediss:// (TLS) — enable tls when detected
  const tls = url.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined;

  client = new Redis(url, {
    lazyConnect: true,
    tls,
    retryStrategy: (times) => Math.min(times * 50, 2000),
  });

  await client.connect();
  console.log('Redis connected');
}

function getRedis() {
  if (!client) throw new Error('Redis not initialised. Call connectRedis first.');
  return client;
}

module.exports = { connectRedis, getRedis };
