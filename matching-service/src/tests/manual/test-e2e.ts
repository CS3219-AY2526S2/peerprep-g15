export {};

type HttpMethod = 'GET' | 'POST';

type RequestResult = {
    status: number;
    body: unknown;
    headers: Headers;
};

type UserSession = {
    userId: string;
    accessToken: string;
    refreshCookie: string;
};

const BASE_URL = process.env.MATCHING_SERVICE_URL ?? 'http://localhost:3003/matching';
const USER_SERVICE_URL = process.env.USER_SERVICE_URL ?? 'http://localhost:3001';
const TOPIC = process.env.MANUAL_TEST_TOPIC ?? 'Algorithms';
const DIFFICULTY = (process.env.MANUAL_TEST_DIFFICULTY ?? 'medium').toLowerCase();
const USER_PASSWORD = process.env.MANUAL_TEST_USER_PASSWORD ?? 'Test@123';

const TEST_USERS = [
    {
        username: 'testusermatching3',
        displayName: 'Test User Matching 3',
        email: 'testmatching3@example.com',
    },
    {
        username: 'testusermatching',
        displayName: 'testusermatching',
        email: 'testmatching1@example.com',
    },
] as const;

type LoginResponse = {
    user: { id: string; username: string; email: string };
    accessToken: string;
};

type RefreshResponse = {
    accessToken: string;
};

function requireValue(value: string, name: string) {
    if (!value.trim()) {
        throw new Error(`Missing required env var: ${name}`);
    }
    return value;
}

async function request(
    baseUrl: string,
    method: HttpMethod,
    path: string,
    token?: string,
    body?: Record<string, unknown>,
): Promise<RequestResult> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    let parsedBody: unknown;
    try {
        parsedBody = await response.json();
    } catch {
        parsedBody = await response.text();
    }

    return {
        status: response.status,
        body: parsedBody,
        headers: response.headers,
    };
}

function printStep(label: string) {
    console.log(`\n=== ${label} ===`);
}

function getRefreshCookie(headers: Headers) {
    const setCookie = headers.get('set-cookie');
    if (!setCookie) {
        throw new Error('User service did not return a refresh cookie');
    }

    return setCookie.split(';')[0];
}

async function ensureUserServiceHealthy() {
    const health = await request(USER_SERVICE_URL, 'GET', '/health');
    if (health.status !== 200) {
        throw new Error(
            `User service health check failed (${health.status}): ${JSON.stringify(health.body)}`,
        );
    }
}

function buildAuthFailureMessage(username: string, operation: 'login' | 'refresh', body: unknown) {
    return [
        `${operation} failed for ${username}: ${JSON.stringify(body)}`,
        'Check that user-service is running, the seeded test user exists, and the password is correct.',
    ].join(' ');
}

async function createUserSession(label: string, usernamePrefix: string): Promise<UserSession> {
    const user = TEST_USERS.find((candidate) => candidate.username === usernamePrefix);
    if (!user) {
        throw new Error(`Unknown test user: ${usernamePrefix}`);
    }

    printStep(`${label}: Login user`);
    const loginResponse = await request(USER_SERVICE_URL, 'POST', '/auth/login', undefined, {
        identifier: user.username,
        password: USER_PASSWORD,
    });

    if (loginResponse.status !== 200) {
        throw new Error(buildAuthFailureMessage(user.username, 'login', loginResponse.body));
    }

    const loginBody = loginResponse.body as LoginResponse;
    const refreshCookie = getRefreshCookie(loginResponse.headers);

    printStep(`${label}: Refresh token`);
    const refreshResponse = await fetch(`${USER_SERVICE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
            Cookie: refreshCookie,
        },
    });

    if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();
        throw new Error(buildAuthFailureMessage(user.username, 'refresh', errorText));
    }

    const refreshBody = (await refreshResponse.json()) as RefreshResponse;
    const refreshedCookie = getRefreshCookie(refreshResponse.headers);

    console.log('Using test user:', user.username, user.displayName, user.email);
    console.log('Login access token received:', loginBody.accessToken.length > 0);
    console.log('Refresh access token received:', refreshBody.accessToken.length > 0);

    return {
        userId: loginBody.user.id,
        accessToken: refreshBody.accessToken,
        refreshCookie: refreshedCookie,
    };
}

async function runManualTest() {
    try {
        requireValue(USER_SERVICE_URL, 'USER_SERVICE_URL');

        printStep('Step 0: Check user-service health');
        await ensureUserServiceHealthy();
        console.log('User service is healthy');

        printStep('Step 1: Create user sessions through user-service');
        const user1 = await createUserSession('User 1', 'testusermatching3');
        const user2 = await createUserSession('User 2', 'testusermatching');

        printStep('Step 2: Health Check');
        const health = await request(BASE_URL, 'GET', '/health');
        console.log('Status:', health.status);
        console.log('Body:', health.body);

        printStep('Step 3: User 1 Joins Queue');
        const firstJoin = await request(BASE_URL, 'POST', '/join', user1.accessToken, {
            userId: user1.userId,
            topic: TOPIC,
            difficulty: DIFFICULTY,
        });
        console.log('Status:', firstJoin.status);
        console.log('Body:', firstJoin.body);

        printStep('Step 4: Check User 1 Status');
        const firstStatus = await request(
            BASE_URL,
            'GET',
            `/status/${user1.userId}`,
            user1.accessToken,
        );
        console.log('Status:', firstStatus.status);
        console.log('Body:', firstStatus.body);

        printStep('Step 5: User 2 Joins Queue (Should Match)');
        const secondJoin = await request(BASE_URL, 'POST', '/join', user2.accessToken, {
            userId: user2.userId,
            topic: TOPIC,
            difficulty: DIFFICULTY,
        });
        console.log('Status:', secondJoin.status);
        console.log('Body:', secondJoin.body);

        printStep('Step 6: Queue Snapshot');
        const queue = await request(BASE_URL, 'GET', '/queue', user1.accessToken);
        console.log('Status:', queue.status);
        console.log('Body:', queue.body);

        printStep('Step 7: User 1 Status After Matching');
        const matchedStatus = await request(
            BASE_URL,
            'GET',
            `/status/${user1.userId}`,
            user1.accessToken,
        );
        console.log('Status:', matchedStatus.status);
        console.log('Body:', matchedStatus.body);

        const maybeMatch =
            typeof secondJoin.body === 'object' && secondJoin.body !== null
                ? (secondJoin.body as { match?: { matchId?: string } }).match
                : undefined;

        if (maybeMatch?.matchId) {
            printStep('Step 8: End Match');
            const endMatch = await request(BASE_URL, 'POST', '/end', user1.accessToken, {
                matchId: maybeMatch.matchId,
            });
            console.log('Status:', endMatch.status);
            console.log('Body:', endMatch.body);
        } else {
            printStep('Step 8: End Match (Skipped)');
            console.log('No matchId returned from join response.');
        }

        console.log('\n=== Manual matching test complete ===');
        process.exit(0);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Manual test failed:', message);
        process.exit(1);
    }
}

runManualTest();

// Example:
// $env:USER_SERVICE_URL='http://localhost:3001'
// $env:MATCHING_SERVICE_URL='http://localhost:3003/matching'
// npx tsx src/tests/manual/test-e2e.ts
