import http from 'http';
import { createApp } from './app';
import { initSocket } from './socket';
import { connectDB } from './config/db';
import { config } from './config/env';

const app = createApp();
const server = http.createServer(app);

initSocket(server);

connectDB(config.mongo.uri, config.mongo.dbName);

server.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
});
