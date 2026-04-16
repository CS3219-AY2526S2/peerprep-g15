import 'dotenv/config';
import http from 'http';
import { createApp } from '../../app';
import { connectDB } from '../../config/db';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer | undefined;

export async function startTestServer() {
    // Start mongodb-memory-server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Connect to in-memory MongoDB
    await connectDB(mongoUri, 'history-service-test');

    const app = createApp();
    const server = http.createServer(app);

    await new Promise<void>((resolve) => server.listen(0, resolve));

    return server;
}

export async function stopTestServer(server: http.Server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
    if (mongoServer) {
        await mongoServer.stop();
    }
}

export function getBaseUrl(server: http.Server) {
    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Test server is not listening on a TCP port');
    }

    return `http://127.0.0.1:${address.port}`;
}
