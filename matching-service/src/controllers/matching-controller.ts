import type { NextFunction, Request, Response } from 'express';
import {
    getQueueStatus,
    joinQueue,
    leaveQueue,
    listQueuedUsers,
} from '../services/matching-service';
import type { AuthenticatedRequest } from '../middleware/auth-middleware';

function getRequiredString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export class MatchingController {
    static health(_req: Request, res: Response) {
        res.status(200).json({ status: 'ok', service: 'matching-service' });
    }

    static async join(req: Request, res: Response, next: NextFunction) {
        try {
            const auth = (req as AuthenticatedRequest).auth;
            const userId = getRequiredString(req.body?.userId);
            const topic = getRequiredString(req.body?.topic);
            const difficulty = getRequiredString(req.body?.difficulty);

            if (!userId || !topic || !difficulty) {
                return res.status(400).json({
                    message: 'userId, topic, and difficulty are required',
                });
            }

            if (!['easy', 'medium', 'hard'].includes(difficulty)) {
                return res.status(400).json({
                    message: 'difficulty must be easy, medium, or hard',
                });
            }

            if (auth?.userId !== userId) {
                return res.status(403).json({
                    message: 'Authenticated user does not match request userId',
                });
            }

            const result = await joinQueue({
                userId,
                topic,
                difficulty: difficulty as 'easy' | 'medium' | 'hard',
                proficiency:
                    typeof req.body?.proficiency === 'number' ? req.body.proficiency : undefined,
            });

            if (result.state === 'matched') {
                return res.status(200).json({
                    message: 'Matched successfully',
                    match: result.match,
                });
            }

            return res.status(202).json({
                message: 'Queued successfully',
                entry: result.entry,
            });
        } catch (err) {
            next(err);
        }
    }

    static async leave(req: Request, res: Response, next: NextFunction) {
        try {
            const auth = (req as AuthenticatedRequest).auth;
            const userId = getRequiredString(req.body?.userId);

            if (!userId) {
                return res.status(400).json({
                    message: 'userId is required',
                });
            }

            if (auth?.userId !== userId) {
                return res.status(403).json({
                    message: 'Authenticated user does not match request userId',
                });
            }

            const removed = await leaveQueue(userId);
            if (!removed) {
                return res.status(404).json({
                    message: 'User is not in queue',
                });
            }

            return res.status(200).json({
                message: 'Removed from queue',
            });
        } catch (err) {
            next(err);
        }
    }

    static async status(req: Request, res: Response, next: NextFunction) {
        try {
            const auth = (req as AuthenticatedRequest).auth;
            const userId = getRequiredString(req.params.userId || req.query.userId);

            if (!userId) {
                return res.status(400).json({
                    message: 'userId is required',
                });
            }

            if (auth?.userId !== userId) {
                return res.status(403).json({
                    message: 'Authenticated user does not match request userId',
                });
            }

            const status = await getQueueStatus(userId);
            return res.status(200).json(status);
        } catch (err) {
            next(err);
        }
    }

    static async queue(_req: Request, res: Response) {
        return res.status(200).json({
            queuedUsers: await listQueuedUsers(),
        });
    }
}
