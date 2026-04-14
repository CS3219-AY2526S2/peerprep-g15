import { createClient } from 'redis';

type AppRedisClient = ReturnType<typeof createClient>;

let redisClient: AppRedisClient | null = null;

export async function connectRedis(url: string) {
    const client = createClient({ url });

    client.on('error', (err) => {
        console.error('Redis error:', err);
    });

    await client.connect();
    redisClient = client;
    console.log('Redis connected');
    return client;
}

export function getRedis() {
    if (!redisClient) {
        throw new Error('Redis client not initialized');
    }

    return redisClient;
}

export async function disconnectRedis() {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
    }
}
