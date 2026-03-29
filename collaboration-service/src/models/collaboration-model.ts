import mongoose from 'mongoose';

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
    },
    { timestamps: true },
);

export const Session = mongoose.model('Session', sessionSchema);
