import type { Request, Response, NextFunction } from 'express';
import { Question } from '../models/question-model';

function normalizeText(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\p{L}\p{N}\s]/gu, '');
}

function isMongoDuplicateKeyError(
    err: unknown,
): err is { code: number; keyPattern?: Record<string, number> } {
    return (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code?: number }).code === 11000
    );
}

export async function getQuestions(req: Request, res: Response, next: NextFunction) {
    try {
        const { difficulty, category } = req.query;
        const filter: Record<string, unknown> = {};

        if (typeof difficulty === 'string' && difficulty.trim() !== '') {
            filter.difficulty = difficulty.trim();
        }

        if (typeof category === 'string' && category.trim() !== '') {
            filter.categories = category.trim();
        }

        const questions = await Question.find(filter).sort({ questionId: 1 });
        res.status(200).json(questions);
    } catch (err) {
        next(err);
    }
}

export async function getQuestionById(req: Request, res: Response, next: NextFunction) {
    try {
        const questionId = Number(req.params.id);
        if (Number.isNaN(questionId)) {
            res.status(400).json({ message: 'Invalid question id' });
            return;
        }

        const question = await Question.findOne({ questionId });
        if (!question) {
            res.status(404).json({ message: 'Question not found' });
            return;
        }

        res.status(200).json(question);
    } catch (err) {
        next(err);
    }
}

export async function createQuestion(req: Request, res: Response, next: NextFunction) {
    try {
        const normalizedTitle = normalizeText(String(req.body.title ?? ''));

        const possibleDuplicate = await Question.findOne({ normalizedTitle })
            .select('questionId title')
            .lean();

        if (possibleDuplicate) {
            res.status(409).json({
                message: 'A question with a very similar title already exists',
                existingQuestion: possibleDuplicate,
            });
            return;
        }

        const question = await Question.create(req.body);
        res.status(201).json(question);
    } catch (err) {
        if (isMongoDuplicateKeyError(err)) {
            res.status(409).json({
                message: 'Duplicate question detected',
                details: err.keyPattern ?? {},
            });
            return;
        }

        next(err);
    }
}

export async function updateQuestion(req: Request, res: Response, next: NextFunction) {
    try {
        const questionId = Number(req.params.id);
        if (Number.isNaN(questionId)) {
            res.status(400).json({ message: 'Invalid question id' });
            return;
        }

        const expectedVersion = Number(req.body.__v);
        if (Number.isNaN(expectedVersion)) {
            res.status(400).json({
                message: 'Missing or invalid __v for concurrency control',
            });
            return;
        }

        const updatePayload = { ...req.body };

        delete updatePayload._id;
        delete updatePayload.questionId;
        delete updatePayload.__v;
        delete updatePayload.createdAt;
        delete updatePayload.updatedAt;

        const updatedQuestion = await Question.findOneAndUpdate(
            { questionId, __v: expectedVersion },
            {
                $set: updatePayload,
                $inc: { __v: 1 },
            },
            {
                new: true,
                runValidators: true,
                context: 'query',
            },
        );

        if (!updatedQuestion) {
            const existingQuestion = await Question.findOne({ questionId }).select('__v').lean();

            if (!existingQuestion) {
                res.status(404).json({ message: 'Question not found' });
                return;
            }

            res.status(409).json({
                message: 'Question was modified by another admin. Refresh and try again.',
                currentVersion: existingQuestion.__v,
            });
            return;
        }

        res.status(200).json(updatedQuestion);
    } catch (err) {
        if (isMongoDuplicateKeyError(err)) {
            res.status(409).json({
                message: 'Update would create a duplicate question',
                details: err.keyPattern ?? {},
            });
            return;
        }

        next(err);
    }
}

export async function deleteQuestion(req: Request, res: Response, next: NextFunction) {
    try {
        const questionId = Number(req.params.id);
        if (Number.isNaN(questionId)) {
            res.status(400).json({ message: 'Invalid question id' });
            return;
        }

        const deletedQuestion = await Question.findOneAndDelete({ questionId });
        if (!deletedQuestion) {
            res.status(404).json({ message: 'Question not found' });
            return;
        }

        res.status(200).json({ message: 'Question deleted successfully' });
    } catch (err) {
        next(err);
    }
}
