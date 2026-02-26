export class AppError extends Error {
    statusCode: number;
    code: string;
    details?: unknown;

    constructor(statusCode: number, code: string, message: string, details?: unknown) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
    }

    // Used when client sends something invalid e.g. missing password or malformed JSON
    static badRequest(message = 'Bad request', details?: unknown) {
        return new AppError(400, 'BAD_REQUEST', message, details);
    }

    // Used when authentication fails or is missing e.g. wrong password or expired token
    static unauthorized(message = 'Unauthorized', details?: unknown) {
        return new AppError(401, 'UNAUTHORIZED', message, details);
    }

    // Used when authenticated user tries to access something they don't have permissions for e.g. user trying to access admin route
    static forbidden(message = 'Forbidden', details?: unknown) {
        return new AppError(403, 'FORBIDDEN', message, details);
    }

    // Used when a requested resource doesn't exist e.g. no user with given ID
    static notFound(message = 'Not found', details?: unknown) {
        return new AppError(404, 'NOT_FOUND', message, details);
    }

    // Used when trying to create a resource that already exists e.g. registering with an email that's already in use
    static conflict(message = 'Conflict', details?: unknown) {
        return new AppError(409, 'CONFLICT', message, details);
    }
}
