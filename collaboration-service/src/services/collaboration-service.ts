import { Session } from '../models/collaboration-model';
import { LANGUAGE_MAP } from '../config/constants';
import { config } from '../config/env';
// @ts-ignore
import axios from 'axios';
import {
    buildSubmissionPayload,
    normalizeComparable,
    parseActualOutput,
    getComparator,
} from '../utils/execution-harness';
import { ExecutionSpec, SubmissionCaseResult, TestCase } from '../types/execution';
import { fetchQuestionById } from './question-service';
import { AppError } from '../utils/app-error';
import * as Y from 'yjs';

interface Judge0Response {
    stdout: string | null;
    stderr: string | null;
    compile_output?: string | null;
    message?: string | null;
    status: {
        description: string;
    };
    time: string | null;
    memory: number | null;
}

// create a new session when two users are matched
export async function createSession(roomId: string, userIds: string[], questionId: string) {
    const existing = await Session.findOne({ roomId });
    if (existing) return existing;

    const session = new Session({
        roomId,
        userIds,
        questionId,
        status: 'pending',
    });

    return await session.save();
}

// get a session by roomId
export async function getSession(roomId: string) {
    return await Session.findOne({ roomId });
}

export async function voteLanguage(roomId: string, userId: string, language: string) {
    const existing = await getSession(roomId);
    if (existing?.languageVotes?.get(userId)) {
        throw new AppError(400, 'User has already locked in');
    }

    const session = await Session.findOneAndUpdate(
        { roomId },
        { $set: { [`languageVotes.${userId}`]: language } },
        { new: true },
    );

    if (!session) throw new AppError(404, 'Session not found');
    if (!session.questionId) throw new AppError(400, 'Session has no questionId');

    const votes = session?.languageVotes;
    if (votes?.size === 2) {
        const languages = Array.from(votes.values());

        if (languages[0] === languages[1]) {
            const question = await fetchQuestionById(session.questionId);
            if (!question) throw new AppError(404, 'Question not found');
            const starterCode = question.starterCode?.[languages[0]] ?? '';

            const ydoc = new Y.Doc();
            const ytext = ydoc.getText('code');
            if (starterCode) {
                ytext.insert(0, starterCode);
            }

            const updated = await Session.findOneAndUpdate(
                { roomId },
                {
                    status: 'active',
                    language: languages[0],
                    yjsState: Buffer.from(Y.encodeStateAsUpdate(ydoc)),
                },
                { new: true },
            );
            ydoc.destroy();

            return updated;
        }

        return await endSession(roomId);
    }

    return session;
}

export async function persistYjsState(roomId: string, yjsState: Buffer, code: string) {
    return await Session.findOneAndUpdate({ roomId }, { yjsState, code }, { new: true });
}

export async function executeCode(roomId: string, code: string, language: string) {
    const session = await getSession(roomId);
    if (!session) throw new Error('Session not found');
    if (session.status !== 'active') throw new Error('Session is not active');

    const languageId = LANGUAGE_MAP[language];
    if (!languageId) throw new Error('Unsupported language');

    const response = await axios.post<Judge0Response>(
        'https://ce.judge0.com/submissions?wait=true',
        {
            source_code: code,
            language_id: languageId,
        },
        {
            headers: { 'Content-Type': 'application/json' },
        },
    );

    return {
        stdout: response.data.stdout,
        stderr: response.data.stderr,
        compileOutput: response.data.compile_output ?? null,
        message: response.data.message ?? null,
        status: response.data.status.description,
        time: response.data.time,
        memory: response.data.memory,
    };
}

export async function saveAttempt(
    roomId: string,
    code: string,
    language: string,
    passed: boolean,
    results: any,
) {
    return await Session.findOneAndUpdate(
        { roomId },
        {
            $push: {
                attempts: { code, language, passed, results, submittedAt: new Date() },
            },
        },
        { new: true },
    );
}

export async function saveAttemptForAllUsersInHistory(
    roomId: string,
    code: string,
    language: string,
    passed: boolean,
    results: any,
) {
    const session = await getSession(roomId);
    if (!session) {
        return;
    }

    const requestBody = {
        roomId,
        questionId: session.questionId,
        language,
        code,
        passed,
        results,
        submittedAt: new Date().toISOString(),
    };

    const requests = session.userIds.map(async (userId) => {
        const response = await fetch(`${config.historyService.baseUrl}/internal/save-attempt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-internal-service-token': config.historyService.internalServiceToken,
            },
            body: JSON.stringify({
                userId,
                ...requestBody,
            }),
        });

        if (!response.ok) {
            throw new Error(`History service returned status ${response.status}`);
        }
    });

    const outcomes = await Promise.allSettled(requests);
    const failed = outcomes.filter(
        (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected',
    );

    if (failed.length > 0) {
        console.error(
            `Failed to save ${failed.length} attempt(s) to history service for room ${roomId}`,
        );
    }
}

async function runSingleTestCase(
    code: string,
    language: string,
    languageId: number,
    testCase: TestCase,
    executionSpec: ExecutionSpec,
): Promise<SubmissionCaseResult> {
    const payload = buildSubmissionPayload(code, language, testCase, executionSpec);

    const response = await axios.post<Judge0Response>(
        'https://ce.judge0.com/submissions?wait=true',
        {
            ...payload,
            language_id: languageId,
        },
        {
            headers: { 'Content-Type': 'application/json' },
        },
    );

    const actualParsed = parseActualOutput(response.data.stdout);
    const expectedParsed = testCase.expectedOutput;

    const hasExecutionError =
        Boolean(response.data.stderr) ||
        Boolean(response.data.compile_output) ||
        Boolean(response.data.message);

    const passed =
        !hasExecutionError &&
        normalizeComparable(actualParsed, getComparator(executionSpec)) ===
            normalizeComparable(expectedParsed, getComparator(executionSpec));

    return {
        input: testCase.input,
        expected: expectedParsed,
        actual: actualParsed,
        passed,
        stderr: response.data.stderr ?? null,
        compileOutput: response.data.compile_output ?? null,
        message: response.data.message ?? null,
        status: response.data.status.description,
    };
}

export async function submitCode(
    roomId: string,
    code: string,
    language: string,
    testCases: TestCase[],
    executionSpec: ExecutionSpec,
) {
    const session = await getSession(roomId);
    if (!session) throw new Error('Session not found');
    if (session.status !== 'active') throw new Error('Session is not active');

    const languageId = LANGUAGE_MAP[language];
    if (!languageId) throw new Error('Unsupported language');

    if (!session.questionId) throw new Error('Session has no questionId');

    if (testCases.length === 0) {
        const result = await executeCode(roomId, code, language);
        const passed =
            result.status === 'Accepted' &&
            !result.stderr &&
            !result.compileOutput &&
            !result.message;

        return {
            passed,
            results: [],
            stdout: result.stdout,
            stderr: result.stderr,
            compileOutput: result.compileOutput,
            message: result.message,
            status: result.status,
        };
    }

    const results = await Promise.all(
        testCases.map((tc) => runSingleTestCase(code, language, languageId, tc, executionSpec)),
    );

    const passed = results.every((r) => r.passed);

    return {
        passed,
        results,
    };
}

// end a session
export async function endSession(roomId: string) {
    return await Session.findOneAndUpdate({ roomId }, { status: 'ended' }, { new: true });
}

export async function handleDisconnect(roomId: string) {
    const session = await getSession(roomId);
    if (session?.status === 'active') {
        await endSession(roomId);
        return true;
    }
    return false;
}

export async function addMessageToSession(
    roomId: string,
    message: { senderId: string; username: string; content: string },
) {
    return await Session.findOneAndUpdate(
        { roomId },
        { $push: { messages: message } },
        { new: true },
    );
}
