import { createClient } from 'redis';

const redis = createClient({ // Create redis client
    socket: {
        host: process.env.REDIS_HOST || 'localhost', // Default Redis host
        port: process.env.REDIS_PORT || 6379, // Default Redis port
    }
});

async function connectRedis() {
  try {
    await redis.connect();
    console.log('Connected to Redis');
  } catch (err) {
    console.error('Redis Connection Error:', err);
  }
}

export { redis, connectRedis };