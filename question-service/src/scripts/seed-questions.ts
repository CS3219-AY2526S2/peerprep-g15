import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { config } from '../config/env';
import { Question } from '../models/question-model';
import { sampleQuestions } from './sample-questions';

async function main() {
    await connectDB(config.mongo.uri, config.mongo.dbName);

    await Question.deleteMany({});

    for (const question of sampleQuestions) {
        await Question.create(question);
    }

    console.log(`Inserted ${sampleQuestions.length} questions`);
    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
});
