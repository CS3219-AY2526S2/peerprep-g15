import { z } from 'zod';
import { SkillLevels } from '../models/user-model';

export const updateMeSchema = z
    .object({
        username: z.string().trim().min(3).max(30).optional(),
        email: z
            .string()
            .trim()
            .email()
            .transform((v) => v.toLowerCase())
            .optional(),
        preferredLanguages: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
        skillLevel: z.enum(SkillLevels).optional(),

        currentPassword: z.string().min(1).optional(),
        newPassword: z.string().min(8).max(72).optional(),
    })
    .refine(
        (obj) => {
            const hasCurrent = !!obj.currentPassword;
            const hasNew = !!obj.newPassword;
            return (hasCurrent && hasNew) || (!hasCurrent && !hasNew);
        },
        {
            message: 'To change password, provide both currentPassword and newPassword',
        },
    );
