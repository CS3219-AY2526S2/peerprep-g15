import { UserModel } from '../models/user-model';
import { AppError } from '../utils/app-error';
import { verifyAccessToken } from '../utils/jwt';

export class InternalAuthService {
    static async resolve(accessToken: string) {
        let payload: { sub: string; role: string; type: 'access' | 'refresh' };

        try {
            payload = verifyAccessToken(accessToken);
        } catch {
            throw AppError.unauthorized('Invalid or expired access token');
        }

        const user = await UserModel.findById(payload.sub);
        if (!user) {
            throw AppError.unauthorized('User no longer exists');
        }

        return {
            id: user._id.toString(),
            username: user.username,
            displayName: user.displayName,
            email: user.email,
            role: user.role,
        };
    }
}
