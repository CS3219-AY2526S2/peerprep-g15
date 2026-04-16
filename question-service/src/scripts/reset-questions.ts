import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { config } from '../config/env';
import { Question } from '../models/question-model';

async function main() {
    await connectDB(config.mongo.uri, config.mongo.dbName);
    const result = await Question.deleteMany({});
    console.log(`Deleted ${result.deletedCount ?? 0} questions`);
    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
});
