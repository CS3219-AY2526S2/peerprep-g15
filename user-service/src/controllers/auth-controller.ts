import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth-service';

function refreshCookieOptions() {
    const isProd = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true, // Not accessible via JavaScript, helps prevent XSS attacks
        secure: isProd,
        sameSite: 'lax' as const,
        path: '/auth',
    };
}

export class AuthController {
    static async register(req: Request, res: Response, next: NextFunction) {
        try {
            const { user, accessToken, refreshToken } = await AuthService.register(req.body);

            // Set refresh token in HttpOnly cookie and return access token in response body
            res.cookie('refreshToken', refreshToken, refreshCookieOptions())
                .status(201)
                .json({ user, accessToken });
        } catch (err) {
            next(err);
        }
    }

    static async login(req: Request, res: Response, next: NextFunction) {
        try {
            const { user, accessToken, refreshToken } = await AuthService.login(req.body);

            // Similarly, set refresh token in HttpOnly cookie and return access token in response body
            res.cookie('refreshToken', refreshToken, refreshCookieOptions())
                .status(200)
                .json({ user, accessToken });
        } catch (err) {
            next(err);
        }
    }

    static async refresh(req: Request, res: Response, next: NextFunction) {
        try {
            const refreshToken = req.cookies?.refreshToken as string | undefined;
            if (!refreshToken)
                return next(
                    require('../utils/app-error').AppError.unauthorized('Missing refresh token'),
                );

            const { accessToken, refreshToken: newRefreshToken } =
                await AuthService.refresh(refreshToken);

            res.cookie('refreshToken', newRefreshToken, refreshCookieOptions())
                .status(200)
                .json({ accessToken });
        } catch (err) {
            next(err);
        }
    }

    static async logout(req: Request, res: Response, next: NextFunction) {
        try {
            const refreshToken = req.cookies?.refreshToken as string | undefined;
            if (refreshToken) {
                await AuthService.logoutByRefreshToken(refreshToken);
            }

            res.clearCookie('refreshToken', { path: '/auth/refresh' })
                .status(200)
                .json({ message: 'Logged out' });
        } catch (err) {
            next(err);
        }
    }
}
