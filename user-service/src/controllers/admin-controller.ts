import type { Request, Response, NextFunction } from 'express';
import { getAuth } from '../utils/auth';
import { AppError } from '../utils/app-error';
import { AdminService } from '../services/admin-service';
import type { ValidatedQueryRequest } from '../middleware/validate';
import type { ListUsersQuery } from '../validation/admin-validation';

// This page should eventually be where admins have CRUD access to questions
export class AdminController {
    static async home(req: Request, res: Response, next: NextFunction) {
        try {
            const auth = getAuth(req);
            if (!auth) return next(AppError.unauthorized('Unauthorized'));

            return res.status(200).json({
                message: 'Admin home',
                auth,
            });
        } catch (err) {
            next(err);
        }
    }

    static async listUsers(req: Request, res: Response, next: NextFunction) {
        try {
            const auth = getAuth(req);
            if (!auth) return next(AppError.unauthorized('Unauthorized'));

            const { search, role, page, limit } = (req as ValidatedQueryRequest<ListUsersQuery>)
                .validatedQuery ?? {
                page: 1,
                limit: 10,
            };

            const result = await AdminService.listUsers({ search, role, page, limit });

            return res.status(200).json(result);
        } catch (err) {
            next(err);
        }
    }

    static async promote(req: Request, res: Response, next: NextFunction) {
        try {
            const auth = getAuth(req);
            if (!auth) return next(AppError.unauthorized('Unauthorized'));

            const { username } = req.body;
            const user = await AdminService.promote(username);

            return res.status(200).json({
                message: 'User promoted to admin',
                user,
            });
        } catch (err) {
            next(err);
        }
    }

    static async demote(req: Request, res: Response, next: NextFunction) {
        try {
            const auth = getAuth(req);
            if (!auth) return next(AppError.unauthorized('Unauthorized'));

            const { username } = req.body;
            const user = await AdminService.demote(auth.userId, username);

            return res.status(200).json({
                message: 'User demoted to normal user',
                user,
            });
        } catch (err) {
            next(err);
        }
    }

    static async deleteUser(req: Request, res: Response, next: NextFunction) {
        try {
            const auth = getAuth(req);
            if (!auth) return next(AppError.unauthorized('Unauthorized'));

            const username = req.params.username;

            if (typeof username !== 'string') {
                return next(AppError.badRequest('Invalid username parameter'));
            }

            const deletedUsername = await AdminService.deleteUser(auth.userId, username);

            return res.status(200).json({
                message: `User '${deletedUsername}' deleted successfully`,
            });
        } catch (err) {
            next(err);
        }
    }
}
