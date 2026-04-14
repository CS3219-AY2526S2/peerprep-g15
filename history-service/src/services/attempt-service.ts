import { randomUUID } from 'crypto';
import {
    AttemptModel,
    type AttemptDocument,
    type AttemptTestCaseResult,
} from '../models/attempt-model';

export interface SaveAttemptInput {
    userId: string;
    roomId?: string;
    questionId?: string | number;
    questionTitle?: string;
    language: string;
    code: string;
    passed: boolean;
    results?: AttemptTestCaseResult[];
    error?: string | null;
    submittedAt?: string | number | Date;
}

export interface AttemptHistoryQuery {
    userId: string;
    limit?: number;
    skip?: number;
}

export interface AttemptHistoryResult {
    items: AttemptDocument[];
    total: number;
    limit: number;
    skip: number;
}

function toDate(value: string | number | Date | undefined) {
    if (!value) {
        return new Date();
    }

    const submittedAt = new Date(value);
    if (Number.isNaN(submittedAt.getTime())) {
        return new Date();
    }

    return submittedAt;
}

export async function saveAttempt(input: SaveAttemptInput) {
    const document = await AttemptModel.create({
        attemptId: randomUUID(),
        userId: input.userId.trim(),
        roomId: input.roomId?.trim() || '',
        questionId: input.questionId,
        questionTitle: input.questionTitle?.trim() || '',
        language: input.language.trim(),
        code: input.code,
        passed: input.passed,
        results: input.results ?? [],
        error: input.error ?? null,
        submittedAt: toDate(input.submittedAt),
    });

    return document.toObject();
}

export async function getAttemptHistory(query: AttemptHistoryQuery): Promise<AttemptHistoryResult> {
    const limit = Math.min(Math.max(Math.trunc(query.limit ?? 50), 1), 200);
    const skip = Math.max(Math.trunc(query.skip ?? 0), 0);
    const [items, total] = await Promise.all([
        AttemptModel.find({ userId: query.userId.trim() })
            .sort({ submittedAt: -1, _id: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        AttemptModel.countDocuments({ userId: query.userId.trim() }),
    ]);

    return {
        items,
        total,
        limit,
        skip,
    };
}
