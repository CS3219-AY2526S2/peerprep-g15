import http from 'http';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../../app';

let mongod: MongoMemoryServer;

export async function startTestServer() {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    const app = createApp();
    const server = http.createServer(app);

    await new Promise<void>((resolve) => server.listen(0, resolve));
    return server;
}

export async function stopTestServer(server: http.Server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
    await mongod.stop();
}
