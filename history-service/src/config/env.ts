export const config = {
    get nodeEnv() {
        return process.env.NODE_ENV ?? 'development';
    },
    get port() {
        return Number(process.env.PORT) || 3005;
    },
    mongo: {
        get uri() {
            return process.env.MONGO_URI ?? '';
        },
        get dbName() {
            return process.env.MONGO_DB_NAME ?? '';
        },
    },
    userService: {
        get baseUrl() {
            return process.env.USER_SERVICE_URL ?? 'http://localhost:3001';
        },
    },
    internal: {
        get serviceToken() {
            return process.env.INTERNAL_SERVICE_TOKEN ?? '';
        },
    },
};
