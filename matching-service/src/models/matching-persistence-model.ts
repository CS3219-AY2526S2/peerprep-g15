import mongoose, { Schema } from 'mongoose';
import type { Difficulty, MatchResult } from './matching-model';

export interface QueueDocument {
    userId: string;
    topic: string;
    difficulty: Difficulty;
    proficiency?: number;
    joinedAt: Date;
}

export interface MatchDocument {
    matchId: string;
    userIds: [string, string];
    topic: string;
    difficulty: Difficulty;
    createdAt: Date;
}

const queueSchema = new Schema<QueueDocument>(
    {
        userId: { type: String, required: true, unique: true, index: true },
        topic: { type: String, required: true, trim: true },
        difficulty: { type: String, required: true, enum: ['easy', 'medium', 'hard'] },
        proficiency: { type: Number },
        joinedAt: { type: Date, required: true },
    },
    { timestamps: false },
);

const matchSchema = new Schema<MatchDocument>(
    {
        matchId: { type: String, required: true, unique: true, index: true },
        userIds: { type: [String], required: true, index: true },
        topic: { type: String, required: true, trim: true },
        difficulty: { type: String, required: true, enum: ['easy', 'medium', 'hard'] },
        createdAt: { type: Date, required: true },
    },
    { timestamps: false },
);

export const QueueModel = mongoose.model<QueueDocument>('MatchingQueue', queueSchema);
export const MatchModel = mongoose.model<MatchDocument>('MatchingMatch', matchSchema);

export function queueDocumentToEntry(document: QueueDocument) {
    return {
        userId: document.userId,
        topic: document.topic,
        difficulty: document.difficulty,
        proficiency: document.proficiency,
        joinedAt: document.joinedAt.toISOString(),
    };
}

export function matchDocumentToResult(document: MatchDocument): MatchResult {
    return {
        matchId: document.matchId,
        userIds: document.userIds,
        topic: document.topic,
        difficulty: document.difficulty,
        createdAt: document.createdAt.toISOString(),
    };
}
