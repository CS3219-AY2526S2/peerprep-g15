import type { NextFunction, Request, Response } from 'express';
import {
    getQueueStatus,
    joinQueue,
    leaveQueue,
    listQueuedUsers,
    endMatch,
} from '../services/matching-service';
import type { AuthenticatedRequest } from '../middleware/auth-middleware';

function getRequiredString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function getBearerToken(header: string | undefined) {
    if (!header) {
        return undefined;
    }

    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
        return undefined;
    }

    return token;
}

export class MatchingController {
    static health(_req: Request, res: Response) {
        res.status(200).json({ status: 'ok', service: 'matching-service' });
    }

    static async join(req: Request, res: Response, next: NextFunction) {
        try {
            const auth = (req as AuthenticatedRequest).auth;
            const accessToken = getBearerToken(req.headers.authorization);
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

            const result = await joinQueue(
                {
                    userId,
                    topic,
                    difficulty: difficulty as 'easy' | 'medium' | 'hard',
                    proficiency:
                        typeof req.body?.proficiency === 'number'
                            ? req.body.proficiency
                            : undefined,
                },
                undefined,
                accessToken,
            );

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

    static async end(req: Request, res: Response, next: NextFunction) {
        try {
            const matchId = getRequiredString(req.body?.matchId);

            if (!matchId) {
                return res.status(400).json({
                    message: 'matchId is required',
                });
            }

            const removed = await endMatch(matchId);
            if (!removed) {
                return res.status(404).json({
                    message: 'Match not found',
                });
            }

            return res.status(200).json({
                message: 'Match ended successfully',
            });
        } catch (err) {
            next(err);
        }
    }
}
