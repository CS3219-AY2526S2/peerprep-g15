import type { Request, Response, NextFunction } from 'express';
import { Question } from '../models/question-model';

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
        const question = await Question.create(req.body);
        res.status(201).json(question);
    } catch (err) {
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

        const updatedQuestion = await Question.findOneAndUpdate({ questionId }, req.body, {
            new: true,
            runValidators: true,
        });

        if (!updatedQuestion) {
            res.status(404).json({ message: 'Question not found' });
            return;
        }

        res.status(200).json(updatedQuestion);
    } catch (err) {
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
