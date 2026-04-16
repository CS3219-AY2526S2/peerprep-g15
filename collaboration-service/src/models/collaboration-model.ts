import { time } from 'console';
import mongoose, { Schema } from 'mongoose';

const sessionSchema = new mongoose.Schema(
    {
        roomId: String,
        userIds: [String],
        questionId: String,
        code: String,
        language: String,
        status: {
            type: String,
            enum: ['pending', 'active', 'ended'], // add 'pending' for language selection phase
            default: 'pending', // starts as pending
        },
        languageVotes: {
            // track what each user voted
            type: Map,
            of: String, // { userId: 'python', userId2: 'javascript' }
        },
        messages: [
            {
                senderId: String,
                username: String,
                content: String,
                timestamp: { type: Date, default: Date.now },
            },
        ],
        yjsState: { type: Buffer, default: null },
        attempts: [
            {
                code: String,
                language: String,
                passed: Boolean,
                results: Schema.Types.Mixed,
                submittedAt: { type: Date, default: Date.now },
            },
        ],
    },
    { timestamps: true },
);

export const Session = mongoose.model('Session', sessionSchema);
