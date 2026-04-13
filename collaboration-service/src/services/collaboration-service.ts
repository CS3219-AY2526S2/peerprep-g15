import { Session } from '../models/collaboration-model';
import { LANGUAGE_MAP } from '../config/constants';
// @ts-ignore
import axios from 'axios';
import {
    buildSubmissionPayload,
    normalizeComparable,
    parseActualOutput,
    getComparator,
} from '../utils/execution-harness';
import { ExecutionSpec, SubmissionCaseResult, TestCase } from '../types/execution';

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

// update the code in the session
export async function updateCode(roomId: string, code: string) {
    return await Session.findOneAndUpdate({ roomId }, { code }, { new: true });
}

export async function voteLanguage(roomId: string, userId: string, language: string) {
    const existing = await getSession(roomId);
    if (existing?.languageVotes?.get(userId)) {
        throw new Error('User has already locked in');
    }

    const session = await Session.findOneAndUpdate(
        { roomId },
        { $set: { [`languageVotes.${userId}`]: language } },
        { new: true },
    );

    const votes = session?.languageVotes;
    if (votes?.size === 2) {
        const languages = Array.from(votes.values());

        if (languages[0] === languages[1]) {
            return await Session.findOneAndUpdate(
                { roomId },
                { status: 'active', language: languages[0] },
                { new: true },
            );
        }

        return await endSession(roomId);
    }

    return session;
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
