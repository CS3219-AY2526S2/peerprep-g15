import type { NextFunction, Request, Response } from 'express';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('History service error:', err);
    res.status(500).json({ message });
}
