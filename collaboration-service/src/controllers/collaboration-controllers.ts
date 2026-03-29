import { Request, Response } from 'express';
import { createSession, getSession, endSession } from '../services/collaboration-service';

export async function createSessionHandler(req: Request, res: Response) {
    try {
        const { roomId, userIds, questionId } = req.body;

        if (!roomId || !userIds || !questionId) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const session = await createSession(roomId, userIds, questionId);
        return res.status(201).json(session);
    } catch (err) {
        return res.status(500).json({ message: 'Internal server error' });
    }
}

export async function getSessionHandler(req: Request, res: Response) {
    try {
        const roomId = req.params.roomId as string;
        const session = await getSession(roomId);

        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        return res.status(200).json(session);
    } catch (err) {
        return res.status(500).json({ message: 'Internal server error' });
    }
}

export async function endSessionHandler(req: Request, res: Response) {
    try {
        const roomId = req.params.roomId as string;
        const session = await endSession(roomId);

        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        return res.status(200).json(session);
    } catch (err) {
        return res.status(500).json({ message: 'Internal server error' });
    }
}
