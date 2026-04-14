export {};

import type { Server } from 'http';
import { getBaseUrl, startTestServer, stopTestServer } from '../helpers/test-server';

type HttpMethod = 'GET' | 'POST';

type RequestResult = {
    status: number;
    body: unknown;
};

type AttemptResponse = {
    attemptId: string;
    userId: string;
    roomId?: string;
    questionId?: string | number;
    questionTitle?: string;
    language: string;
    code: string;
    passed: boolean;
    results?: Array<{ passed: boolean }>;
    error?: string | null;
    submittedAt: string;
};

const TEST_USER_ID = process.env.MANUAL_TEST_USER_ID ?? 'manual-user-1';
const TEST_ROOM_ID = process.env.MANUAL_TEST_ROOM_ID ?? 'manual-room-1';
const TEST_QUESTION_ID = process.env.MANUAL_TEST_QUESTION_ID ?? '42';
const TEST_QUESTION_TITLE = process.env.MANUAL_TEST_QUESTION_TITLE ?? 'Two Sum';
const TEST_LANGUAGE = process.env.MANUAL_TEST_LANGUAGE ?? 'typescript';

function printStep(label: string) {
    console.log(`\n=== ${label} ===`);
}

async function request(
    baseUrl: string,
    method: HttpMethod,
    path: string,
    body?: Record<string, unknown>,
): Promise<RequestResult> {
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
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
    };
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

function expectAttempt(value: unknown): AttemptResponse {
    assert(typeof value === 'object' && value !== null, 'Expected attempt object');
    return value as AttemptResponse;
}

async function runManualTest(server: Server) {
    const baseUrl = getBaseUrl(server);

    printStep('Step 0: Health Check');
    const health = await request(baseUrl, 'GET', '/health');
    console.log('Status:', health.status);
    console.log('Body:', health.body);
    assert(health.status === 200, 'Health check should return 200');

    printStep('Step 1: Save first attempt');
    const firstSave = await request(baseUrl, 'POST', '/save-attempt', {
        userId: TEST_USER_ID,
        roomId: TEST_ROOM_ID,
        questionId: TEST_QUESTION_ID,
        questionTitle: TEST_QUESTION_TITLE,
        language: TEST_LANGUAGE,
        code: 'function twoSum() { return []; }',
        passed: false,
        results: [
            {
                input: [2, 7, 11, 15],
                expected: [0, 1],
                actual: [0],
                passed: false,
                stderr: null,
                compileOutput: null,
                message: 'Wrong answer',
                status: 'Wrong Answer',
            },
        ],
        submittedAt: '2026-04-13T00:00:00.000Z',
    });
    console.log('Status:', firstSave.status);
    console.log('Body:', firstSave.body);
    assert(firstSave.status === 201, 'First save should return 201');

    const firstAttempt = expectAttempt((firstSave.body as { attempt?: unknown }).attempt);
    assert(firstAttempt.userId === TEST_USER_ID, 'Saved attempt should keep the userId');
    assert(firstAttempt.passed === false, 'Saved attempt should keep passed=false');

    printStep('Step 2: Save second attempt');
    const secondSave = await request(baseUrl, 'POST', '/save-attempt', {
        userId: TEST_USER_ID,
        roomId: TEST_ROOM_ID,
        questionId: TEST_QUESTION_ID,
        questionTitle: TEST_QUESTION_TITLE,
        language: TEST_LANGUAGE,
        code: 'function twoSum() { return [0, 1]; }',
        passed: true,
        results: [
            {
                input: [2, 7, 11, 15],
                expected: [0, 1],
                actual: [0, 1],
                passed: true,
                stderr: null,
                compileOutput: null,
                message: null,
                status: 'Accepted',
            },
        ],
    });
    console.log('Status:', secondSave.status);
    console.log('Body:', secondSave.body);
    assert(secondSave.status === 201, 'Second save should return 201');

    printStep('Step 3: Save attempt for another user');
    const otherUserSave = await request(baseUrl, 'POST', '/save-attempt', {
        userId: 'manual-user-2',
        roomId: 'manual-room-2',
        questionId: '7',
        questionTitle: 'Reverse String',
        language: 'python',
        code: 'def reverse_string(s):\n    return s[::-1]',
        passed: true,
        submittedAt: '2026-04-13T01:00:00.000Z',
    });
    console.log('Status:', otherUserSave.status);
    console.log('Body:', otherUserSave.body);
    assert(otherUserSave.status === 201, 'Other user save should return 201');

    printStep('Step 4: Retrieve first user history');
    const history = await request(baseUrl, 'GET', `/users/${TEST_USER_ID}/attempts`);
    console.log('Status:', history.status);
    console.log('Body:', history.body);
    assert(history.status === 200, 'History request should return 200');

    const historyBody = history.body as {
        items?: unknown[];
        total?: number;
        limit?: number;
        skip?: number;
    };
    assert(Array.isArray(historyBody.items), 'History response should include items');
    assert(historyBody.total === 2, 'History total should include two attempts for the user');
    assert(historyBody.items.length === 2, 'History items should include two attempts');

    printStep('Step 5: Paginated history check');
    const paginatedHistory = await request(
        baseUrl,
        'GET',
        `/users/${TEST_USER_ID}/attempts?limit=1&skip=1`,
    );
    console.log('Status:', paginatedHistory.status);
    console.log('Body:', paginatedHistory.body);
    assert(paginatedHistory.status === 200, 'Paginated history should return 200');
    const paginatedBody = paginatedHistory.body as { items?: unknown[]; total?: number };
    assert(Array.isArray(paginatedBody.items), 'Paginated history should include items');
    assert(paginatedBody.items.length === 1, 'Paginated history should return one item');
    assert(paginatedBody.total === 2, 'Paginated total should still be two');

    console.log('\n=== Manual history test complete ===');
}

async function main() {
    let server: Server | undefined;
    let exitCode = 0;
    try {
        server = await startTestServer();
        await runManualTest(server);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Manual test failed:', message);
        exitCode = 1;
    } finally {
        if (server) {
            await stopTestServer(server);
        }
    }

    process.exit(exitCode);
}

main();

// Example:
// Uses your real MongoDB configured via env vars.
// $env:MONGO_URI='mongodb://127.0.0.1:27017'
// $env:MONGO_DB_NAME='history-service-manual'
// npx tsx src/tests/manual/test-e2e.ts
