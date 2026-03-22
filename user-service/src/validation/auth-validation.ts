import { z } from 'zod';
import { EMAIL_REGEX, USERNAME_REGEX } from '../utils/regex';

export const registerSchema = z.object({
    username: z
        .string()
        .trim()
        .min(3)
        .max(30)
        .regex(USERNAME_REGEX, 'Username cannot contain spaces'),
    displayName: z.string().trim().max(50).optional(),
    email: z
        .string()
        .trim()
        .transform((v) => v.toLowerCase())
        .refine((v) => EMAIL_REGEX.test(v), 'Invalid email address'),
    password: z.string().min(8).max(72),
});

export const loginSchema = z.object({
    identifier: z.string().trim().min(1),
    password: z.string().min(1),
});

export type RegisterBody = z.infer<typeof registerSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
