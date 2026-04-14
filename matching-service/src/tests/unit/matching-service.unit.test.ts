import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createInMemoryMatchingRepository,
    getQueueStatus,
    joinQueue,
    leaveQueue,
    listQueuedUsers,
    pickBestWaitingUserIndex,
    resetMatchingState,
    setMatchingRepository,
} from '../../services/matching-service';
import { setQuestionServiceFetch } from '../../services/question-service';
import type { MatchResult, QueueEntry } from '../../models/matching-model';
import type { MatchingRepository } from '../../services/matching-service';

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

process.env.QUESTION_SERVICE_URL = 'http://localhost:3002';

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

test.beforeEach(async () => {
    setQuestionServiceFetch(mockQuestionFetch);
    setMatchingRepository(createInMemoryMatchingRepository());
    await resetMatchingState();
});

test.after(() => {
    setQuestionServiceFetch();
    setMatchingRepository();
});

test('capitalized existing match difficulty still hydrates match.question', async () => {
    const repository = createInMemoryMatchingRepository();
    setMatchingRepository(repository);

    await repository.saveMatch({
        matchId: 'match-cap-difficulty',
        userIds: ['user-cap-a', 'user-cap-b'],
        topic: 'arrays',
        difficulty: 'Easy' as unknown as 'easy' | 'medium' | 'hard',
        createdAt: new Date('2026-04-04T15:00:00.000Z').toISOString(),
    });

    const status = await getQueueStatus('user-cap-a', Date.now(), 'access-user-cap-a');
    assert.equal(status.state, 'matched');
    assert.equal(status.match?.question?.questionId, 1);
});

test('match with different topics does not happen after expansion window', async () => {
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

    assert.equal(secondJoin.state, 'queued');

    const queue = await listQueuedUsers(baseTimeMs + 30_000);
    assert.equal(queue.length, 2);
    assert.ok(queue.some((entry) => entry.userId === 'user-topic-a'));
    assert.ok(queue.some((entry) => entry.userId === 'user-topic-b'));
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

test('queued same-topic different-difficulty users can match on status poll after expansion window', async () => {
    const baseTimeMs = new Date('2026-04-04T13:30:00.000Z').getTime();

    const firstJoin = await joinQueue(
        {
            userId: 'user-status-rematch-a',
            topic: 'dp',
            difficulty: 'hard',
        },
        baseTimeMs,
        'access-user-status-rematch-a',
    );
    assert.equal(firstJoin.state, 'queued');

    const secondJoin = await joinQueue(
        {
            userId: 'user-status-rematch-b',
            topic: 'dp',
            difficulty: 'medium',
        },
        baseTimeMs + 10_000,
        'access-user-status-rematch-b',
    );
    assert.equal(secondJoin.state, 'queued');

    const statusAfterExpansion = await getQueueStatus(
        'user-status-rematch-b',
        baseTimeMs + 15_000,
        'access-user-status-rematch-b',
    );

    assert.equal(statusAfterExpansion.state, 'matched');
    const match = statusAfterExpansion.match as MatchResult;
    assert.equal(match.topic, 'dp');
    assert.equal(match.difficulty, 'medium');
    assert.ok(match.userIds.includes('user-status-rematch-a'));
    assert.ok(match.userIds.includes('user-status-rematch-b'));
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

test('queue priority does not expand to different topics after second wait window', () => {
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
    assert.equal(selectedIndex, -1);
});

test('edge case: same-topic boundary activates at 15s and remains topic-locked at 30s', () => {
    const waitingQueue: QueueEntry[] = [
        {
            userId: 'user-topic-only',
            topic: 'trees',
            difficulty: 'easy',
            joinedAt: '2026-04-04T10:00:00.000Z',
        },
        {
            userId: 'user-other-topic',
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

    const crossTopicJoiningUser: QueueEntry = {
        userId: 'user-join-cross-topic',
        topic: 'graphs',
        difficulty: 'medium',
        joinedAt: '2026-04-04T10:02:00.000Z',
    };
    const secondBoundaryIndex = pickBestWaitingUserIndex(
        waitingQueue,
        crossTopicJoiningUser,
        new Date('2026-04-04T10:00:30.000Z').getTime(),
    );
    assert.equal(secondBoundaryIndex, -1);
});

test('edge case fixed: duplicate join from the same user is idempotent', async () => {
    const firstJoin = await joinQueue(
        {
            userId: 'user-dup',
            topic: 'graphs',
            difficulty: 'easy',
        },
        Date.now(),
        'access-user-dup',
    );
    const secondJoin = await joinQueue(
        {
            userId: 'user-dup',
            topic: 'graphs',
            difficulty: 'easy',
        },
        Date.now() + 1,
        'access-user-dup',
    );

    assert.equal(firstJoin.state, 'queued');
    assert.equal(secondJoin.state, 'queued');

    const queue = await listQueuedUsers();
    const dupEntries = queue.filter((entry) => entry.userId === 'user-dup');
    assert.equal(dupEntries.length, 1);
});

test('duplicate enqueue conflict is treated as idempotent queued response', async () => {
    const existingEntry: QueueEntry = {
        userId: 'user-race-enqueue',
        topic: 'graphs',
        difficulty: 'easy',
        joinedAt: new Date('2026-04-04T10:00:00.000Z').toISOString(),
    };

    const duplicateKeyError = Object.assign(new Error('E11000 duplicate key error'), {
        code: 11000,
    });

    const repository: MatchingRepository = {
        async clear() {
            // No-op for this focused behavior test.
        },
        async purgeTimedOut() {
            // No-op for this focused behavior test.
        },
        async getMatchByUserId() {
            return null;
        },
        async getQueuedUserEntry(userId: string) {
            return userId === existingEntry.userId ? existingEntry : null;
        },
        async listQueuedUsers() {
            return [];
        },
        async enqueue() {
            throw duplicateKeyError;
        },
        async removeQueuedUser() {
            return null;
        },
        async saveMatch() {
            // No-op for this focused behavior test.
        },
        async endMatch() {
            return false;
        },
        async recordQueueEvent() {
            // No-op for this focused behavior test.
        },
        async recordMatchHistory() {
            // No-op for this focused behavior test.
        },
        async markMatchHistoryEnded() {
            // No-op for this focused behavior test.
        },
    };

    setMatchingRepository(repository);

    const result = await joinQueue(
        {
            userId: 'user-race-enqueue',
            topic: 'graphs',
            difficulty: 'easy',
        },
        Date.now(),
        'access-user-race-enqueue',
    );

    assert.equal(result.state, 'queued');
    assert.equal(result.entry?.userId, 'user-race-enqueue');
});

test('edge case fixed: repeated join does not self-match and later matches with another user', async () => {
    const firstJoin = await joinQueue(
        {
            userId: 'user-self',
            topic: 'arrays',
            difficulty: 'medium',
        },
        Date.now(),
        'access-user-self',
    );
    const secondJoin = await joinQueue(
        {
            userId: 'user-self',
            topic: 'arrays',
            difficulty: 'medium',
        },
        Date.now() + 1,
        'access-user-self',
    );

    const otherJoin = await joinQueue(
        {
            userId: 'user-other',
            topic: 'arrays',
            difficulty: 'medium',
        },
        Date.now() + 2,
        'access-user-other',
    );

    assert.equal(firstJoin.state, 'queued');
    assert.equal(secondJoin.state, 'queued');
    assert.equal(otherJoin.state, 'matched');

    const match = otherJoin.match as MatchResult;
    assert.deepEqual(match.userIds, ['user-self', 'user-other']);
});

test('edge case: matched state cannot be cleared through leave endpoint', async () => {
    const firstJoin = await joinQueue(
        {
            userId: 'user-stale-a',
            topic: 'dp',
            difficulty: 'hard',
        },
        Date.now(),
        'access-user-stale-a',
    );
    assert.equal(firstJoin.state, 'queued');

    const secondJoin = await joinQueue(
        {
            userId: 'user-stale-b',
            topic: 'dp',
            difficulty: 'hard',
        },
        Date.now() + 1,
        'access-user-stale-b',
    );
    assert.equal(secondJoin.state, 'matched');

    const left = await leaveQueue('user-stale-a');
    assert.equal(left, false);

    const status = await getQueueStatus('user-stale-a', Date.now() + 2, 'access-user-stale-a');
    assert.equal(status.state, 'matched');
});

test('edge case: in-memory queue state is lost after reset (restart simulation)', async () => {
    const queued = await joinQueue(
        {
            userId: 'user-restart',
            topic: 'strings',
            difficulty: 'easy',
        },
        Date.now(),
        'access-user-restart',
    );
    assert.equal(queued.state, 'queued');

    await resetMatchingState();

    const statusAfterReset = await getQueueStatus(
        'user-restart',
        Date.now() + 1,
        'access-user-restart',
    );
    assert.equal(statusAfterReset.state, 'not_found');
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
