import { z } from 'zod';
import { SkillLevels } from '../models/user-model';
import { EMAIL_REGEX, USERNAME_REGEX } from '../utils/regex';

export const updateMeSchema = z
    .object({
        username: z
            .string()
            .trim()
            .min(3)
            .max(30)
            .regex(USERNAME_REGEX, 'Username cannot contain spaces')
            .transform((v) => v.toLowerCase())
            .optional(),

        displayName: z.string().trim().max(50).optional(),

        email: z
            .string()
            .trim()
            .transform((v) => v.toLowerCase())
            .refine((v) => EMAIL_REGEX.test(v), 'Invalid email address')
            .optional(),

        preferredLanguages: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
        skillLevel: z.enum(SkillLevels).optional(),

        currentPassword: z.string().min(1).optional(),
        newPassword: z.string().min(8).max(72).optional(),
    })
    .refine((obj) => Object.keys(obj).length > 0, {
        message: 'At least one field must be provided',
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
