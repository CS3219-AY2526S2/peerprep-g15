import type { NextFunction, Request, Response } from 'express';
import { getAttemptHistory, saveAttempt } from '../services/attempt-service';

function getRequiredString(value: unknown) {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function getOptionalString(value: unknown) {
	return typeof value === 'string' ? value.trim() : undefined;
}

function getOptionalNumber(value: unknown) {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === 'string' && value.trim().length > 0) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : undefined;
	}

	return undefined;
}

function getOptionalBoolean(value: unknown) {
	if (typeof value === 'boolean') {
		return value;
	}

	if (typeof value === 'string') {
		if (value.toLowerCase() === 'true') {
			return true;
		}

		if (value.toLowerCase() === 'false') {
			return false;
		}
	}

	return undefined;
}

function getOptionalDateLike(value: unknown) {
	if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) {
		return value;
	}

	return undefined;
}

export class AttemptController {
	static health(_req: Request, res: Response) {
		res.status(200).json({ status: 'ok', service: 'history-service' });
	}

	static async save(req: Request, res: Response, next: NextFunction) {
		try {
			const userId = getRequiredString(req.body?.userId);
			const language = getRequiredString(req.body?.language);
			const code = getRequiredString(req.body?.code);
			const passed = getOptionalBoolean(req.body?.passed);

			if (!userId || !language || !code || passed === undefined) {
				return res.status(400).json({
					message: 'userId, language, code, and passed are required',
				});
			}

			const saved = await saveAttempt({
				userId,
				roomId: getOptionalString(req.body?.roomId),
				questionId: req.body?.questionId,
				questionTitle: getOptionalString(req.body?.questionTitle),
				language,
				code,
				passed,
				results: Array.isArray(req.body?.results) ? req.body.results : undefined,
				error: getOptionalString(req.body?.error) ?? null,
				submittedAt: getOptionalDateLike(req.body?.submittedAt),
			});

			return res.status(201).json({
				message: 'Attempt saved successfully',
				attempt: saved,
			});
		} catch (err) {
			next(err);
		}
	}

	static async listByUser(req: Request, res: Response, next: NextFunction) {
		try {
			const userId = getRequiredString(req.params.userId);
			if (!userId) {
				return res.status(400).json({
					message: 'userId is required',
				});
			}

			const limit = getOptionalNumber(req.query.limit);
			const skip = getOptionalNumber(req.query.skip);
			const history = await getAttemptHistory({
				userId,
				limit,
				skip,
			});

			return res.status(200).json(history);
		} catch (err) {
			next(err);
		}
	}
}