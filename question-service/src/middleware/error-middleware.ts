import type { Request, Response, NextFunction } from 'express';

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ message });
}
