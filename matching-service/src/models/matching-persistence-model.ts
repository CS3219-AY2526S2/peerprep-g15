import mongoose, { Schema } from 'mongoose';
import type { Difficulty, MatchResult, MatchedQuestion } from './matching-model';

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
    question?: MatchedQuestion;
    createdAt: Date;
    endedAt?: Date;
}

export type QueueHistoryEventType = 'queued' | 'matched' | 'left' | 'timed_out';

export interface QueueHistoryDocument {
    userId: string;
    topic: string;
    difficulty: Difficulty;
    eventType: QueueHistoryEventType;
    matchId?: string;
    occurredAt: Date;
}

export interface MatchHistoryDocument {
    matchId: string;
    userIds: [string, string];
    topic: string;
    difficulty: Difficulty;
    question?: MatchedQuestion;
    createdAt: Date;
    endedAt?: Date;
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
        question: {
            questionId: { type: Number },
            title: { type: String },
            difficulty: { type: String },
            categories: { type: [String] },
        },
        createdAt: { type: Date, required: true },
        endedAt: { type: Date },
    },
    { timestamps: false },
);

const queueHistorySchema = new Schema<QueueHistoryDocument>(
    {
        userId: { type: String, required: true, index: true },
        topic: { type: String, required: true, trim: true },
        difficulty: { type: String, required: true, enum: ['easy', 'medium', 'hard'] },
        eventType: {
            type: String,
            required: true,
            enum: ['queued', 'matched', 'left', 'timed_out'],
            index: true,
        },
        matchId: { type: String, index: true },
        occurredAt: { type: Date, required: true, index: true },
    },
    { timestamps: false },
);

const matchHistorySchema = new Schema<MatchHistoryDocument>(
    {
        matchId: { type: String, required: true, unique: true, index: true },
        userIds: { type: [String], required: true, index: true },
        topic: { type: String, required: true, trim: true },
        difficulty: { type: String, required: true, enum: ['easy', 'medium', 'hard'] },
        question: {
            questionId: { type: Number },
            title: { type: String },
            difficulty: { type: String },
            categories: { type: [String] },
        },
        createdAt: { type: Date, required: true, index: true },
        endedAt: { type: Date, index: true },
    },
    { timestamps: false },
);

export const QueueModel = mongoose.model<QueueDocument>('MatchingQueue', queueSchema);
export const MatchModel = mongoose.model<MatchDocument>('MatchingMatch', matchSchema);
export const QueueHistoryModel = mongoose.model<QueueHistoryDocument>(
    'MatchingQueueHistory',
    queueHistorySchema,
    'queue_history',
);
export const MatchHistoryModel = mongoose.model<MatchHistoryDocument>(
    'MatchingMatchHistory',
    matchHistorySchema,
    'match_history',
);

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
        question: document.question,
        createdAt: document.createdAt.toISOString(),
        endedAt: document.endedAt?.toISOString(),
    };
}
