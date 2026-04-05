import { UserModel, type Role } from '../models/user-model';
import { AppError } from '../utils/app-error';

type ListUsersInput = {
    search?: string;
    role?: Role;
    page: number;
    limit: number;
};

// To prevent regex semantics in user search input
function escapeRegex(input: string) {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class AdminService {
    static async promote(targetUsername: string) {
        const username = targetUsername.trim().toLowerCase();

        const user = await UserModel.findOne({ username });
        if (!user) throw AppError.notFound('User not found');

        if (user.role === 'admin') {
            throw AppError.conflict('User is already an admin');
        }

        user.role = 'admin';
        user.refreshTokenHash = null;
        user.refreshTokenIssuedAt = null;

        await user.save();

        return user.toJSON();
    }

    static async demote(actorUserId: string, targetUsername: string) {
        const username = targetUsername.trim().toLowerCase();

        const user = await UserModel.findOne({ username });
        if (!user) throw AppError.notFound('User not found');

        if (user.role === 'user') {
            throw AppError.conflict('User is already a normal user');
        }

        if (user._id.toString() === actorUserId) {
            throw AppError.forbidden('Admins cannot demote themselves');
        }

        const adminCount = await UserModel.countDocuments({ role: 'admin' });
        if (adminCount <= 1) {
            throw AppError.forbidden('Cannot demote the last remaining admin');
        }

        user.role = 'user';
        user.refreshTokenHash = null;
        user.refreshTokenIssuedAt = null;

        await user.save();

        return user.toJSON();
    }

    static async deleteUser(actorUserId: string, targetUsername: string) {
        const username = targetUsername.trim().toLowerCase();

        const user = await UserModel.findOne({ username });
        if (!user) throw AppError.notFound('User not found');

        if (user._id.toString() === actorUserId) {
            throw AppError.forbidden('Admins cannot delete their own accounts');
        }

        if (user.role === 'admin') {
            const adminCount = await UserModel.countDocuments({ role: 'admin' });
            if (adminCount <= 1) {
                throw AppError.forbidden('Cannot delete the last remaining admin');
            }
        }

        await user.deleteOne();

        return username;
    }

    static async listUsers({ search, role, page, limit }: ListUsersInput) {
        const filter: Record<string, unknown> = {};

        if (role) {
            filter.role = role;
        }

        if (search) {
            const escapedSearch = escapeRegex(search);
            const regex = new RegExp(escapedSearch, 'i');
            filter.$or = [{ username: regex }, { displayName: regex }, { email: regex }];
        }

        const skip = (page - 1) * limit;

        const [users, total] = await Promise.all([
            UserModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
            UserModel.countDocuments(filter),
        ]);

        return {
            users: users.map((user) => user.toJSON()),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}
