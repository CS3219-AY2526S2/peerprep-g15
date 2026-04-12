import './setup-env';
import mongoose from 'mongoose';
import { beforeAll, beforeEach } from 'vitest';
import { connectDB } from '../../config/db';

beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
        await connectDB(process.env.MONGO_URI ?? '', process.env.MONGO_DB_NAME ?? '');
    }
});

beforeEach(async () => {
    const collections = mongoose.connection.collections;

    for (const key of Object.keys(collections)) {
        await collections[key].deleteMany({});
    }
});
