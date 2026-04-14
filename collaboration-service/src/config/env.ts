export const config = {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT) || 3004,
    mongo: {
        uri: process.env.MONGO_URI ?? '',
        dbName: process.env.MONGO_DB_NAME ?? '',
    },
    userService: {
        baseUrl: process.env.USER_SERVICE_URL ?? 'http://localhost:3001',
        internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN ?? '',
    },
    questionService: {
        baseUrl: process.env.QUESTION_SERVICE_URL ?? 'http://localhost:3002',
        internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN ?? '',
    },
    matchingService: {
        baseUrl: process.env.MATCHING_SERVICE_URL ?? 'http://localhost:3003',
        internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN ?? '',
    },
};
