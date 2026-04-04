import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp } from '../app';
import { pickBestWaitingUserIndex, resetMatchingState } from '../services/matching-service';
import type { QueueEntry } from '../models/matching-model';

let server: Server;
let baseUrl: string;

async function request(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
): Promise<{ status: number; json: unknown }> {
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    return {
        status: response.status,
        json: await response.json(),
    };
}

test.before(async () => {
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
});

test.beforeEach(() => {
    resetMatchingState();
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
    const firstJoin = await request('POST', '/matching/join', {
        userId: 'user-a',
        topic: 'arrays',
        difficulty: 'easy',
    });

    assert.equal(firstJoin.status, 202);

    const secondJoin = await request('POST', '/matching/join', {
        userId: 'user-b',
        topic: 'arrays',
        difficulty: 'easy',
    });

    assert.equal(secondJoin.status, 200);
    const secondJson = secondJoin.json as { message: string; match: { userIds: string[] } };
    assert.equal(secondJson.message, 'Matched successfully');
    assert.deepEqual(secondJson.match.userIds, ['user-a', 'user-b']);
});

test('POST /matching/join rejects invalid difficulty', async () => {
    const result = await request('POST', '/matching/join', {
        userId: 'user-a',
        topic: 'graphs',
        difficulty: 'expert',
    });

    assert.equal(result.status, 400);
    assert.deepEqual(result.json, {
        message: 'difficulty must be easy, medium, or hard',
    });
});

test('POST /matching/leave removes queued user', async () => {
    const queued = await request('POST', '/matching/join', {
        userId: 'user-c',
        topic: 'dp',
        difficulty: 'hard',
    });
    assert.equal(queued.status, 202);

    const left = await request('POST', '/matching/leave', {
        userId: 'user-c',
    });
    assert.equal(left.status, 200);

    const status = await request('GET', '/matching/status/user-c');
    assert.equal(status.status, 200);
    assert.deepEqual(status.json, {
        userId: 'user-c',
        state: 'not_found',
    });
});

test('GET /matching/status/:userId reports queued state', async () => {
    await request('POST', '/matching/join', {
        userId: 'user-d',
        topic: 'trees',
        difficulty: 'medium',
    });

    const status = await request('GET', '/matching/status/user-d');
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

test('queue priority picks waiting user with closest proficiency distance', () => {
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
            difficulty: 'hard',
            proficiency: 8,
            joinedAt: '2026-04-04T10:01:00.000Z',
        },
    ];

    const joiningUser: QueueEntry = {
        userId: 'user-new',
        topic: 'graphs',
        difficulty: 'hard',
        proficiency: 7,
        joinedAt: '2026-04-04T10:02:00.000Z',
    };

    const selectedIndex = pickBestWaitingUserIndex(waitingQueue, joiningUser);
    assert.equal(selectedIndex, 1);
});

test('queue priority uses FIFO when proficiency distance is tied', () => {
    const waitingQueue: QueueEntry[] = [
        {
            userId: 'user-f1',
            topic: 'dp',
            difficulty: 'medium',
            proficiency: 4,
            joinedAt: '2026-04-04T10:00:00.000Z',
        },
        {
            userId: 'user-f2',
            topic: 'dp',
            difficulty: 'medium',
            proficiency: 6,
            joinedAt: '2026-04-04T10:01:00.000Z',
        },
    ];

    const joiningUser: QueueEntry = {
        userId: 'user-later',
        topic: 'dp',
        difficulty: 'medium',
        proficiency: 5,
        joinedAt: '2026-04-04T10:02:00.000Z',
    };

    const selectedIndex = pickBestWaitingUserIndex(waitingQueue, joiningUser);
    assert.equal(selectedIndex, 0);
});
