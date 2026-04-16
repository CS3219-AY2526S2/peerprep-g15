import http from 'http';
import { createApp } from '../../app';
import { connectRedis, disconnectRedis } from '../../config/redis';
import { config } from '../../config/env';
import { resetMatchingState } from '../../services/matching-service';

export async function startTestServer() {
    await connectRedis(config.redis.url);
    await resetMatchingState();

    const app = createApp();
    const server = http.createServer(app);

    await new Promise<void>((resolve) => server.listen(0, resolve));
    return server;
}

export async function stopTestServer(server: http.Server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await resetMatchingState();
    await disconnectRedis();
}
