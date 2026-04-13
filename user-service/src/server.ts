import 'dotenv/config';
import { createApp } from './app';
import { connectDB } from './config/db';
import { config } from './config/env';

async function start() {
    try {
        await connectDB(config.mongo.uri, config.mongo.dbName);

        const app = createApp();
        app.listen(config.port, () => {
            console.log(`User service listening on http://localhost:${config.port}`);
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Startup error:', message);
        process.exit(1);
    }
}

start();
