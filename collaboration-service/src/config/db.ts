import mongoose from 'mongoose';

export async function connectDB(uri: string, dbName: string) {
    if (!uri) throw new Error('MONGO_URI is missing');
    if (!dbName) throw new Error('MONGO_DB_NAME is missing');

    await mongoose.connect(uri, { dbName });
    console.log('MongoDB connected');
}

connectDB(process.env.MONGO_URI!, process.env.MONGO_DB_NAME!)
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
