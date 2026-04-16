import { z } from 'zod';

export const resolveAuthSchema = z.object({
    accessToken: z.string().trim().min(1, 'accessToken is required'),
});

export type ResolveAuthBody = z.infer<typeof resolveAuthSchema>;
