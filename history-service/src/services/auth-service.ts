import { config } from '../config/env';

export interface ResolvedAuthUser {
    id: string;
    role: 'user' | 'admin';
}

type FetchLike = (input: URL, init?: RequestInit) => Promise<Response>;

export class AuthResolutionError extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = 'AuthResolutionError';
    }
}

let fetchImpl: FetchLike = (input, init) => fetch(input, init);

export function setAuthServiceFetch(nextFetch?: FetchLike) {
    fetchImpl = nextFetch ?? ((input, init) => fetch(input, init));
}

function parseResolvedUser(payload: unknown): ResolvedAuthUser | null {
    if (!payload || typeof payload !== 'object') {
        return null;
    }

    const user = (payload as { user?: Record<string, unknown> }).user;
    if (!user) {
        return null;
    }

    const id = typeof user.id === 'string' ? user.id : '';
    const role = user.role === 'admin' || user.role === 'user' ? user.role : null;

    if (!id || !role) {
        return null;
    }

    return {
        id,
        role,
    };
}

export async function resolveAuthUser(accessToken: string): Promise<ResolvedAuthUser> {
    if (!config.internal.serviceToken) {
        throw new AuthResolutionError('Internal service token is not configured', 500);
    }

    const resolveUrl = new URL('/internal/auth/resolve', config.userService.baseUrl);

    let response: Response;
    try {
        response = await fetchImpl(resolveUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Service-Token': config.internal.serviceToken,
            },
            body: JSON.stringify({ accessToken }),
        });
    } catch {
        throw new AuthResolutionError('Auth service unavailable', 503);
    }

    if (response.status === 401) {
        throw new AuthResolutionError('Invalid or expired token', 401);
    }

    if (response.status === 403) {
        throw new AuthResolutionError('Auth service rejected the internal request', 500);
    }

    if (!response.ok) {
        throw new AuthResolutionError('Auth service unavailable', 503);
    }

    let payload: unknown;
    try {
        payload = await response.json();
    } catch {
        throw new AuthResolutionError('Invalid auth resolve response', 502);
    }

    const user = parseResolvedUser(payload);
    if (!user) {
        throw new AuthResolutionError('Invalid auth resolve response', 502);
    }

    return user;
}
