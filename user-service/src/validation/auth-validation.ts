import { z } from 'zod';

export const registerSchema = z.object({
    username: z.string().trim().min(3).max(30),
    email: z
        .string()
        .trim()
        .email()
        .transform((v) => v.toLowerCase()),
    password: z.string().min(8).max(72),
});

export const loginSchema = z.object({
    identifier: z.string().trim().min(1),
    password: z.string().min(1),
});

export type RegisterBody = z.infer<typeof registerSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
