import 'dotenv/config';

import { createApp } from './app';
import { connectRedis } from './config/redis';
import { config } from './config/env';

async function start() {
    try {
        await connectRedis(config.redis.url);

        const app = createApp();

        app.listen(config.port, () => {
            console.log(`Matching service listening on http://localhost:${config.port}`);
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Startup error:', message);
        process.exit(1);
    }
}

start();
