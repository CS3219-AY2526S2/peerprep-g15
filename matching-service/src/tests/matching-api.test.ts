import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp } from '../app';
import {
    getQueueStatus,
    joinQueue,
    listQueuedUsers,
    endMatch,
    createInMemoryMatchingRepository,
    pickBestWaitingUserIndex,
    resetMatchingState,
    setMatchingRepository,
} from '../services/matching-service';
import { setAuthServiceFetch } from '../services/auth-service.js';
import { setQuestionServiceFetch } from '../services/question-service';
import type { MatchResult, QueueEntry } from '../models/matching-model';

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

// Creates a deterministic access token and registers its resolved user payload.
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

// Simulates the user-service internal token resolution endpoint used by auth middleware.
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

// Shared HTTP helper for API tests with optional JSON body and Bearer token auth.
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
    // Route auth-service lookups to our in-memory mock and boot the app on a random port.
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
    // Ensure the HTTP server is closed and auth mock is reset after all tests.
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
    // Keep tests isolated by clearing queue/match state and token fixtures per test.
    await resetMatchingState();
    accessTokens.clear();
});

// API-level endpoint behavior tests.
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

test('match with different topics chooses one topic randomly and lower difficulty', async () => {
    const baseTimeMs = new Date('2026-04-04T12:00:00.000Z').getTime();

    await joinQueue(
        {
            userId: 'user-topic-a',
            topic: 'arrays',
            difficulty: 'hard',
        },
        baseTimeMs,
        'access-user-topic-a',
    );

    const secondJoin = await joinQueue(
        {
            userId: 'user-topic-b',
            topic: 'graphs',
            difficulty: 'easy',
        },
        baseTimeMs + 30_000,
        'access-user-topic-b',
    );

    assert.equal(secondJoin.state, 'matched');
    const match = secondJoin.match as MatchResult;
    assert.ok(match.topic === 'arrays' || match.topic === 'graphs');
    assert.equal(match.difficulty, 'easy');
    assert.ok(match.question);
    assert.equal(match.question?.difficulty, 'Easy');
    assert.ok(match.question?.categories.includes(match.topic));
});

test('match with same topic but different difficulty picks lower difficulty', async () => {
    const baseTimeMs = new Date('2026-04-04T13:00:00.000Z').getTime();

    await joinQueue(
        {
            userId: 'user-diff-a',
            topic: 'dp',
            difficulty: 'hard',
        },
        baseTimeMs,
        'access-user-diff-a',
    );

    const secondJoin = await joinQueue(
        {
            userId: 'user-diff-b',
            topic: 'dp',
            difficulty: 'medium',
        },
        baseTimeMs + 15_000,
        'access-user-diff-b',
    );

    assert.equal(secondJoin.state, 'matched');
    const match = secondJoin.match as MatchResult;
    assert.equal(match.topic, 'dp');
    assert.equal(match.difficulty, 'medium');
    assert.equal(match.question?.difficulty, 'Medium');
    assert.ok(match.question?.categories.includes('dp'));
});

test('when no question matches resolved topic and lower difficulty, users remain queued', async () => {
    const baseTimeMs = new Date('2026-04-04T14:00:00.000Z').getTime();

    await joinQueue(
        {
            userId: 'user-noq-a',
            topic: 'linked-list',
            difficulty: 'hard',
        },
        baseTimeMs,
        'access-user-noq-a',
    );

    const secondJoin = await joinQueue(
        {
            userId: 'user-noq-b',
            topic: 'linked-list',
            difficulty: 'easy',
        },
        baseTimeMs + 15_000,
        'access-user-noq-b',
    );

    assert.equal(secondJoin.state, 'queued');

    const queue = await listQueuedUsers(baseTimeMs + 15_000);
    const queuedIds = queue.map((entry) => entry.userId);
    assert.ok(queuedIds.includes('user-noq-a'));
    assert.ok(queuedIds.includes('user-noq-b'));
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

// Pure matching-priority function tests.
test('queue priority always prefers exact topic+difficulty match first', () => {
    const waitingQueue: QueueEntry[] = [
        {
            userId: 'user-p1',
            topic: 'graphs',
            difficulty: 'hard',
            proficiency: 2,
            joinedAt: '2026-04-04T10:00:00.000Z',
        },
        {
            userId: 'user-p2',
            topic: 'graphs',
            difficulty: 'easy',
            joinedAt: '2026-04-04T10:01:00.000Z',
        },
    ];

    const joiningUser: QueueEntry = {
        userId: 'user-new',
        topic: 'graphs',
        difficulty: 'hard',
        joinedAt: '2026-04-04T10:02:00.000Z',
    };

    const selectedIndex = pickBestWaitingUserIndex(
        waitingQueue,
        joiningUser,
        new Date('2026-04-04T10:02:00.000Z').getTime(),
    );
    assert.equal(selectedIndex, 0);
});

test('queue priority expands to topic-only after first wait window', () => {
    const waitingQueue: QueueEntry[] = [
        {
            userId: 'user-f1',
            topic: 'dp',
            difficulty: 'easy',
            joinedAt: '2026-04-04T10:00:00.000Z',
        },
        {
            userId: 'user-f2',
            topic: 'arrays',
            difficulty: 'medium',
            joinedAt: '2026-04-04T10:01:00.000Z',
        },
    ];

    const joiningUser: QueueEntry = {
        userId: 'user-later',
        topic: 'dp',
        difficulty: 'medium',
        joinedAt: '2026-04-04T10:02:00.000Z',
    };

    const selectedIndex = pickBestWaitingUserIndex(
        waitingQueue,
        joiningUser,
        new Date('2026-04-04T10:00:16.000Z').getTime(),
    );
    assert.equal(selectedIndex, 0);
});

test('queue priority falls back to FIFO after second wait window', () => {
    const waitingQueue: QueueEntry[] = [
        {
            userId: 'user-global-1',
            topic: 'strings',
            difficulty: 'easy',
            joinedAt: '2026-04-04T10:00:00.000Z',
        },
        {
            userId: 'user-global-2',
            topic: 'graphs',
            difficulty: 'hard',
            joinedAt: '2026-04-04T10:00:05.000Z',
        },
    ];

    const joiningUser: QueueEntry = {
        userId: 'user-incoming',
        topic: 'dp',
        difficulty: 'medium',
        joinedAt: '2026-04-04T10:02:00.000Z',
    };

    const selectedIndex = pickBestWaitingUserIndex(
        waitingQueue,
        joiningUser,
        new Date('2026-04-04T10:00:31.000Z').getTime(),
    );
    assert.equal(selectedIndex, 0);
});

// Edge-case and regression tests for known matching-service pitfalls.
test('edge case fixed: duplicate join from the same user is idempotent', async () => {
    // Why this matters: repeated clicks/retries should keep one queue entry and avoid accidental matches.
    const token = createToken('user-dup');

    const firstJoin = await request(
        'POST',
        '/matching/join',
        {
            userId: 'user-dup',
            topic: 'graphs',
            difficulty: 'easy',
        },
        token,
    );
    const secondJoin = await request(
        'POST',
        '/matching/join',
        {
            userId: 'user-dup',
            topic: 'graphs',
            difficulty: 'easy',
        },
        token,
    );

    assert.equal(firstJoin.status, 202);
    assert.equal(secondJoin.status, 202);

    const queue = await listQueuedUsers();
    const dupEntries = queue.filter((entry) => entry.userId === 'user-dup');
    assert.equal(dupEntries.length, 1);
});

test('edge case fixed: repeated join does not self-match and later matches with another user', async () => {
    // Why this matters: duplicate join retries should not create self-matches or consume extra queue slots.
    const tokenSelf = createToken('user-self');
    const tokenOther = createToken('user-other');

    const firstJoin = await request(
        'POST',
        '/matching/join',
        {
            userId: 'user-self',
            topic: 'arrays',
            difficulty: 'medium',
        },
        tokenSelf,
    );
    const secondJoin = await request(
        'POST',
        '/matching/join',
        {
            userId: 'user-self',
            topic: 'arrays',
            difficulty: 'medium',
        },
        tokenSelf,
    );

    const otherJoin = await request(
        'POST',
        '/matching/join',
        {
            userId: 'user-other',
            topic: 'arrays',
            difficulty: 'medium',
        },
        tokenOther,
    );

    assert.equal(firstJoin.status, 202);
    assert.equal(secondJoin.status, 202);
    assert.equal(otherJoin.status, 200);

    const otherJoinJson = otherJoin.json as { match: { userIds: [string, string] } };
    assert.deepEqual(otherJoinJson.match.userIds, ['user-self', 'user-other']);
});

test('edge case: matched state cannot be cleared through leave endpoint', async () => {
    // Why this matters: once matched, there is no API path to clear match state in memory.
    const tokenA = createToken('user-stale-a');
    const tokenB = createToken('user-stale-b');

    const firstJoin = await request(
        'POST',
        '/matching/join',
        {
            userId: 'user-stale-a',
            topic: 'dp',
            difficulty: 'hard',
        },
        tokenA,
    );
    assert.equal(firstJoin.status, 202);

    const secondJoin = await request(
        'POST',
        '/matching/join',
        {
            userId: 'user-stale-b',
            topic: 'dp',
            difficulty: 'hard',
        },
        tokenB,
    );
    assert.equal(secondJoin.status, 200);

    const left = await request(
        'POST',
        '/matching/leave',
        {
            userId: 'user-stale-a',
        },
        tokenA,
    );
    assert.equal(left.status, 404);

    const status = await getQueueStatus('user-stale-a');
    assert.equal(status.state, 'matched');
});

test('edge case: expansion boundaries activate exactly at 15s and 30s', () => {
    // Why this matters: tiny timing differences at threshold boundaries can change who gets matched.
    const waitingQueue: QueueEntry[] = [
        {
            userId: 'user-topic-only',
            topic: 'trees',
            difficulty: 'easy',
            joinedAt: '2026-04-04T10:00:00.000Z',
        },
        {
            userId: 'user-fifo',
            topic: 'arrays',
            difficulty: 'hard',
            joinedAt: '2026-04-04T10:00:01.000Z',
        },
    ];

    const joiningUser: QueueEntry = {
        userId: 'user-join',
        topic: 'trees',
        difficulty: 'medium',
        joinedAt: '2026-04-04T10:02:00.000Z',
    };

    const topicExpansionBoundaryIndex = pickBestWaitingUserIndex(
        waitingQueue,
        joiningUser,
        new Date('2026-04-04T10:00:15.000Z').getTime(),
    );
    assert.equal(topicExpansionBoundaryIndex, 0);

    const fifoJoiningUser: QueueEntry = {
        userId: 'user-join-fifo',
        topic: 'graphs',
        difficulty: 'medium',
        joinedAt: '2026-04-04T10:02:00.000Z',
    };
    const fifoBoundaryIndex = pickBestWaitingUserIndex(
        waitingQueue,
        fifoJoiningUser,
        new Date('2026-04-04T10:00:30.000Z').getTime(),
    );
    assert.equal(fifoBoundaryIndex, 0);
});

test('edge case: in-memory queue state is lost after reset (restart simulation)', async () => {
    // Why this matters: process restarts clear queue state because data is held in memory only.
    const token = createToken('user-restart');

    const queued = await request(
        'POST',
        '/matching/join',
        {
            userId: 'user-restart',
            topic: 'strings',
            difficulty: 'easy',
        },
        token,
    );
    assert.equal(queued.status, 202);

    resetMatchingState();

    const statusAfterReset = await request(
        'GET',
        '/matching/status/user-restart',
        undefined,
        token,
    );
    assert.equal(statusAfterReset.status, 200);
    assert.deepEqual(statusAfterReset.json, {
        userId: 'user-restart',
        state: 'not_found',
    });
});

test('queued user times out after 1 minute and is removed from queue', async () => {
    const joinedAtMs = new Date('2026-04-04T10:00:00.000Z').getTime();
    await joinQueue(
        {
            userId: 'user-timeout',
            topic: 'graphs',
            difficulty: 'easy',
        },
        joinedAtMs,
    );

    const timedOutStatus = await getQueueStatus('user-timeout', joinedAtMs + 60_000);
    assert.equal(timedOutStatus.state, 'timed_out');

    const queueAfterTimeout = await listQueuedUsers(joinedAtMs + 60_000);
    assert.equal(queueAfterTimeout.length, 0);

    const statusAfterRemoval = await getQueueStatus('user-timeout', joinedAtMs + 60_001);
    assert.equal(statusAfterRemoval.state, 'not_found');
});

test('expired queued users are never matched with new joiners', async () => {
    const baseTimeMs = new Date('2026-04-04T11:00:00.000Z').getTime();

    const firstJoin = await joinQueue(
        {
            userId: 'user-expired',
            topic: 'arrays',
            difficulty: 'medium',
        },
        baseTimeMs,
    );
    assert.equal(firstJoin.state, 'queued');

    const secondJoin = await joinQueue(
        {
            userId: 'user-fresh',
            topic: 'arrays',
            difficulty: 'medium',
        },
        baseTimeMs + 60_000,
    );

    assert.equal(secondJoin.state, 'queued');
    const currentQueue = await listQueuedUsers(baseTimeMs + 60_000);
    assert.equal(currentQueue.length, 1);
    assert.equal(currentQueue[0].userId, 'user-fresh');
});

test('POST /matching/end successfully ends a match', async () => {
    const tokenA = createToken('user-end-a');
    const tokenB = createToken('user-end-b');

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

    const status = await getQueueStatus('user-end-a');
    assert.equal(status.state, 'matched');
    assert.equal(typeof (status.match as any)?.endedAt, 'string');
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
