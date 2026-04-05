import { Session } from '../models/collaboration-model';
import { LANGUAGE_MAP } from '../config/constants';
// @ts-ignore
import axios from 'axios';

interface Judge0Response {
    stdout: string;
    stderr: string;
    status: {
        description: string;
    };
    time: string;
    memory: number;
}

// create a new session when two users are matched
export async function createSession(roomId: string, userIds: string[], questionId: string) {
    const session = new Session({ roomId, userIds, questionId });
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
    // check if user already locked in
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
            // both locked in same language, start session
            return await Session.findOneAndUpdate(
                { roomId },
                { status: 'active', language: languages[0] },
                { new: true },
            );
        } else {
            // different languages, end session
            return await endSession(roomId);
        }
    }

    // only one user locked in, waiting for the other
    return session;
}

export async function executeCode(roomId: string, code: string, language: string) {
    const session = await getSession(roomId);

    if (!session) throw new Error('Session not found');
    if (session.status !== 'active') throw new Error('Session is not active');

    const languageId = LANGUAGE_MAP[language];
    if (!languageId) throw new Error('Unsupported language');

    const response: any = await axios.post(
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
        status: response.data.status.description,
        time: response.data.time,
        memory: response.data.memory,
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
        return true; // tells socket that session ended
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
