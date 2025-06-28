import { createClient } from 'redis';

const redis = createClient({ // Create redis client
    socket: {
        host: 'localhost',
        port: 6379, // Default Redis port
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