import { z } from 'zod';
import { Roles } from '../models/user-model';
import { USERNAME_REGEX } from '../utils/regex';

export const roleChangeSchema = z.object({
    username: z
        .string()
        .trim()
        .min(3)
        .max(30)
        .regex(USERNAME_REGEX, 'Username cannot contain spaces')
        .transform((v) => v.toLowerCase()),
});

export const listUsersQuerySchema = z.object({
    search: z
        .string()
        .optional()
        .transform((v) => {
            const trimmed = v?.trim();
            return trimmed ? trimmed : undefined;
        }),
    role: z.enum(Roles).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type RoleChangeBody = z.infer<typeof roleChangeSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
