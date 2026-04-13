import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp } from '../../app';
import {
    createInMemoryMatchingRepository,
    resetMatchingState,
    setMatchingRepository,
} from '../../services/matching-service';
import { setAuthServiceFetch } from '../../services/auth-service.js';
import { setQuestionServiceFetch } from '../../services/question-service';

let server: Server;
let baseUrl: string;
const internalServiceToken = '9rjkfBsx5108G1TV3UX01BUXB';

type ResolvedUser = {
    id: string;
    username: string;
    displayName: string;
    email: string;
    role: 'user' | 'admin';
};

const accessTokens = new Map<string, ResolvedUser>();
const questions = [
    {
        questionId: 1,
        title: 'Array Pair Sum',
        difficulty: 'Easy',
        categories: ['arrays'],
    },
    {
        questionId: 2,
        title: 'Graph Traversal Basics',
        difficulty: 'Easy',
        categories: ['graphs'],
    },
    {
        questionId: 3,
        title: 'DP Warmup',
        difficulty: 'Medium',
        categories: ['dp'],
    },
    {
        questionId: 4,
        title: 'DP Starter',
        difficulty: 'Easy',
        categories: ['dp'],
    },
    {
        questionId: 5,
        title: 'Array Window Challenge',
        difficulty: 'Medium',
        categories: ['arrays'],
    },
    {
        questionId: 6,
        title: 'DP State Compression',
        difficulty: 'Hard',
        categories: ['dp'],
    },
];

process.env.INTERNAL_SERVICE_TOKEN = internalServiceToken;
process.env.USER_SERVICE_URL = 'http://localhost:3001';
process.env.QUESTION_SERVICE_URL = 'http://localhost:3002';

function createToken(userId: string, role: 'user' | 'admin' = 'user') {
    const token = `access-${userId}`;
    accessTokens.set(token, {
        id: userId,
        username: userId,
        displayName: userId,
        email: `${userId}@example.com`,
        role,
    });

    return token;
}

async function mockAuthResolveFetch(input: URL, init?: RequestInit) {
    if (!input.toString().endsWith('/internal/auth/resolve')) {
        return new Response('Not found', { status: 404 });
    }

    const headers = new Headers(init?.headers);
    if (headers.get('X-Internal-Service-Token') !== internalServiceToken) {
        return new Response(JSON.stringify({ message: 'Invalid internal service token' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const body = typeof init?.body === 'string' ? init.body : '';
    const parsed = body ? (JSON.parse(body) as { accessToken?: string }) : {};
    const user = parsed.accessToken ? accessTokens.get(parsed.accessToken) : undefined;

    if (!user) {
        return new Response(JSON.stringify({ message: 'Invalid or expired access token' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({ user }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

async function mockQuestionFetch(input: URL, init?: RequestInit) {
    const url = new URL(input.toString());
    if (url.pathname !== '/questions') {
        return new Response('Not found', { status: 404 });
    }

    const authorization = new Headers(init?.headers).get('Authorization');
    if (!authorization?.startsWith('Bearer access-')) {
        return new Response(JSON.stringify({ message: 'Missing or invalid token' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const difficulty = url.searchParams.get('difficulty');
    const filteredQuestions = difficulty
        ? questions.filter((question) => question.difficulty === difficulty)
        : questions;

    return new Response(JSON.stringify(filteredQuestions), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

async function request(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
    token?: string,
): Promise<{ status: number; json: unknown }> {
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

    return {
        status: response.status,
        json: await response.json(),
    };
}

test.before(async () => {
    setAuthServiceFetch(mockAuthResolveFetch);
    setQuestionServiceFetch(mockQuestionFetch);
    setMatchingRepository(createInMemoryMatchingRepository());

    const app = createApp();
    server = app.listen(0);

    await new Promise<void>((resolve) => {
        server.on('listening', () => resolve());
    });

    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
    await new Promise<void>((resolve, reject) => {
        server.close((err) => {
            if (err) reject(err);
            else resolve();
        });
    });

    setAuthServiceFetch();
    setQuestionServiceFetch();
    setMatchingRepository();
});

test.beforeEach(async () => {
    await resetMatchingState();
    accessTokens.clear();
});

test('GET /matching/health returns service health', async () => {
    const result = await request('GET', '/matching/health');

    assert.equal(result.status, 200);
    assert.deepEqual(result.json, {
        status: 'ok',
        service: 'matching-service',
    });
});

test('POST /matching/join queues first user and matches second user with same criteria', async () => {
    const tokenA = createToken('user-a');
    const tokenB = createToken('user-b');

    const firstJoin = await request(
        'POST',
        '/matching/join',
        {
            userId: 'user-a',
            topic: 'arrays',
            difficulty: 'easy',
        },
        tokenA,
    );

    assert.equal(firstJoin.status, 202);

    const secondJoin = await request(
        'POST',
        '/matching/join',
        {
            userId: 'user-b',
            topic: 'arrays',
            difficulty: 'easy',
        },
        tokenB,
    );

    assert.equal(secondJoin.status, 200);
    const secondJson = secondJoin.json as {
        message: string;
        match: {
            userIds: string[];
            topic: string;
            difficulty: string;
            question?: { questionId: number };
        };
    };
    assert.equal(secondJson.message, 'Matched successfully');
    assert.deepEqual(secondJson.match.userIds, ['user-a', 'user-b']);
    assert.equal(secondJson.match.topic, 'arrays');
    assert.equal(secondJson.match.difficulty, 'easy');
    assert.equal(secondJson.match.question?.questionId, 1);
});

test('GET /matching/status/:userId returns match with question when matched', async () => {
    const tokenA = createToken('user-status-a');
    const tokenB = createToken('user-status-b');

    const firstJoin = await request(
        'POST',
        '/matching/join',
        {
            userId: 'user-status-a',
            topic: 'arrays',
            difficulty: 'easy',
        },
        tokenA,
    );
    assert.equal(firstJoin.status, 202);

    const secondJoin = await request(
        'POST',
        '/matching/join',
        {
            userId: 'user-status-b',
            topic: 'arrays',
            difficulty: 'easy',
        },
        tokenB,
    );
    assert.equal(secondJoin.status, 200);

    const status = await request('GET', '/matching/status/user-status-a', undefined, tokenA);
    assert.equal(status.status, 200);

    const statusJson = status.json as {
        userId: string;
        state: string;
        match?: { matchId: string; question?: { questionId: number } };
    };

    assert.equal(statusJson.userId, 'user-status-a');
    assert.equal(statusJson.state, 'matched');
    assert.equal(typeof statusJson.match?.matchId, 'string');
    assert.equal(statusJson.match?.question?.questionId, 1);
});

test('POST /matching/join rejects invalid difficulty', async () => {
    const token = createToken('user-a');
    const result = await request(
        'POST',
        '/matching/join',
        {
            userId: 'user-a',
            topic: 'graphs',
            difficulty: 'expert',
        },
        token,
    );

    assert.equal(result.status, 400);
    assert.deepEqual(result.json, {
        message: 'difficulty must be easy, medium, or hard',
    });
});

test('POST /matching/leave removes queued user', async () => {
    const token = createToken('user-c');

    const queued = await request(
        'POST',
        '/matching/join',
        {
            userId: 'user-c',
            topic: 'dp',
            difficulty: 'hard',
        },
        token,
    );
    assert.equal(queued.status, 202);

    const left = await request(
        'POST',
        '/matching/leave',
        {
            userId: 'user-c',
        },
        token,
    );
    assert.equal(left.status, 200);

    const status = await request('GET', '/matching/status/user-c', undefined, token);
    assert.equal(status.status, 200);
    assert.deepEqual(status.json, {
        userId: 'user-c',
        state: 'not_found',
    });
});

test('GET /matching/status/:userId reports queued state', async () => {
    const token = createToken('user-d');

    await request(
        'POST',
        '/matching/join',
        {
            userId: 'user-d',
            topic: 'trees',
            difficulty: 'medium',
        },
        token,
    );

    const status = await request('GET', '/matching/status/user-d', undefined, token);
    assert.equal(status.status, 200);

    const statusJson = status.json as {
        userId: string;
        state: string;
        entry?: { topic: string; difficulty: string };
    };
    assert.equal(statusJson.userId, 'user-d');
    assert.equal(statusJson.state, 'queued');
    assert.equal(statusJson.entry?.topic, 'trees');
    assert.equal(statusJson.entry?.difficulty, 'medium');
});

test('matching endpoints reject missing auth token', async () => {
    const result = await request('POST', '/matching/join', {
        userId: 'user-no-auth',
        topic: 'arrays',
        difficulty: 'easy',
    });

    assert.equal(result.status, 401);
});

test('matching endpoints reject userId that does not match authenticated token', async () => {
    const token = createToken('user-token');
    const result = await request(
        'POST',
        '/matching/join',
        {
            userId: 'user-body',
            topic: 'arrays',
            difficulty: 'easy',
        },
        token,
    );

    assert.equal(result.status, 403);
});

test('POST /matching/end successfully ends a match', async () => {
    const tokenA = createToken('user-end-a');
    const tokenB = createToken('user-end-b');
    const tokenC = createToken('user-end-c');

    const joined = await request(
        'POST',
        '/matching/join',
        {
            userId: 'user-end-a',
            topic: 'arrays',
            difficulty: 'easy',
        },
        tokenA,
    );
    assert.equal(joined.status, 202);

    const matched = await request(
        'POST',
        '/matching/join',
        {
            userId: 'user-end-b',
            topic: 'arrays',
            difficulty: 'easy',
        },
        tokenB,
    );
    assert.equal(matched.status, 200);

    const matchedJson = matched.json as { match: { matchId: string } };
    const matchId = matchedJson.match.matchId;

    const ended = await request(
        'POST',
        '/matching/end',
        {
            matchId,
        },
        tokenA,
    );
    assert.equal(ended.status, 200);
    assert.deepEqual(ended.json, {
        message: 'Match ended successfully',
    });

    const status = await request('GET', '/matching/status/user-end-a', undefined, tokenA);
    assert.equal(status.status, 200);
    assert.deepEqual(status.json, {
        userId: 'user-end-a',
        state: 'not_found',
    });

    const rejoined = await request(
        'POST',
        '/matching/join',
        {
            userId: 'user-end-a',
            topic: 'arrays',
            difficulty: 'easy',
        },
        tokenA,
    );
    assert.equal(rejoined.status, 202);

    const joinedByC = await request(
        'POST',
        '/matching/join',
        {
            userId: 'user-end-c',
            topic: 'arrays',
            difficulty: 'easy',
        },
        tokenC,
    );
    assert.equal(joinedByC.status, 200);

    const matchedAgain = joinedByC.json as { match: { userIds: string[] } };
    assert.deepEqual(new Set(matchedAgain.match.userIds), new Set(['user-end-a', 'user-end-c']));
});

test('POST /matching/end returns 404 for non-existent match', async () => {
    const token = createToken('user-end-notfound');

    const result = await request(
        'POST',
        '/matching/end',
        {
            matchId: 'non-existent-match-id',
        },
        token,
    );

    assert.equal(result.status, 404);
    assert.deepEqual(result.json, {
        message: 'Match not found',
    });
});

test('POST /matching/end requires matchId', async () => {
    const token = createToken('user-end-noid');

    const result = await request('POST', '/matching/end', {}, token);

    assert.equal(result.status, 400);
    assert.deepEqual(result.json, {
        message: 'matchId is required',
    });
});
