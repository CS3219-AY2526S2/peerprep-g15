import bcrypt from 'bcrypt';
import { UserModel, type SkillLevel } from '../models/user-model';
import { AppError } from '../utils/app-error';

type UpdateMeInput = {
    username?: string;
    displayName?: string;
    email?: string;
    preferredLanguages?: string[];
    skillLevel?: SkillLevel;
    currentPassword?: string;
    newPassword?: string;
};

export class MeService {
    static async getMe(userId: string) {
        const user = await UserModel.findById(userId);
        if (!user) throw AppError.notFound('User not found');
        return user.toJSON();
    }

    static async updateMe(userId: string, patch: UpdateMeInput) {
        const user = await UserModel.findById(userId);
        if (!user) throw AppError.notFound('User not found');

        if (patch.username && patch.username.trim().toLowerCase() !== user.username) {
            const username = patch.username.trim().toLowerCase();

            const exists = await UserModel.findOne({
                username,
                _id: { $ne: userId },
            }).lean();

            if (exists) throw AppError.conflict('Username already in use');
            user.username = username;
        }

        if (patch.displayName) {
            user.displayName = patch.displayName.trim();
        }

        if (patch.email && patch.email.trim().toLowerCase() !== user.email) {
            const email = patch.email.trim().toLowerCase();

            const exists = await UserModel.findOne({
                email,
                _id: { $ne: userId },
            }).lean();

            if (exists) throw AppError.conflict('Email already in use');
            user.email = email;
        }

        if (patch.preferredLanguages) user.preferredLanguages = patch.preferredLanguages;
        if (patch.skillLevel) user.skillLevel = patch.skillLevel;

        if (patch.currentPassword && patch.newPassword) {
            const ok = await bcrypt.compare(patch.currentPassword, user.passwordHash);
            if (!ok) throw AppError.unauthorized('Current password is incorrect');

            const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
            user.passwordHash = await bcrypt.hash(patch.newPassword, saltRounds);
        }

        await user.save();
        return user.toJSON();
    }
}
