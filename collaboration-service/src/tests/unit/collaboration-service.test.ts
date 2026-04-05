import {
    createSession,
    getSession,
    updateCode,
    voteLanguage,
    endSession,
    handleDisconnect,
    executeCode,
    addMessageToSession,
} from '../../services/collaboration-service';
import { Session } from '../../models/collaboration-model';
import axios from 'axios';

// mock the Session model and axios
jest.mock('../../models/collaboration-model');
jest.mock('axios');

const mockedSession = jest.mocked(Session);
const mockedAxios = jest.mocked(axios);

// helper to create a fake session object
const mockSession = (overrides = {}) => ({
    roomId: 'room1',
    userIds: ['user1', 'user2'],
    questionId: 'q1',
    status: 'pending',
    code: '',
    language: null,
    languageVotes: new Map(),
    messages: [],
    ...overrides,
});

beforeEach(() => {
    jest.clearAllMocks();
});

// ─── createSession ───────────────────────────────────────────

describe('createSession', () => {
    it('should create and save a session', async () => {
        const saveMock = jest.fn().mockResolvedValue(mockSession());
        mockedSession.mockImplementation(() => ({ save: saveMock }) as any);

        const result = await createSession('room1', ['user1', 'user2'], 'q1');

        expect(saveMock).toHaveBeenCalled();
        expect(result.roomId).toBe('room1');
    });
});

// ─── getSession ───────────────────────────────────────────

describe('getSession', () => {
    it('should return a session if found', async () => {
        mockedSession.findOne = jest.fn().mockResolvedValue(mockSession());

        const result = await getSession('room1');
        expect(result?.roomId).toBe('room1');
    });

    it('should return null if session not found', async () => {
        mockedSession.findOne = jest.fn().mockResolvedValue(null);

        const result = await getSession('fake-room');
        expect(result).toBeNull();
    });
});

// ─── updateCode ───────────────────────────────────────────

describe('updateCode', () => {
    it('should update the code in the session', async () => {
        mockedSession.findOneAndUpdate = jest
            .fn()
            .mockResolvedValue(mockSession({ code: 'console.log("hi")' }));

        const result = await updateCode('room1', 'console.log("hi")');
        expect(result?.code).toBe('console.log("hi")');
    });
});

// ─── endSession ───────────────────────────────────────────

describe('endSession', () => {
    it('should set session status to ended', async () => {
        mockedSession.findOneAndUpdate = jest
            .fn()
            .mockResolvedValue(mockSession({ status: 'ended' }));

        const result = await endSession('room1');
        expect(result?.status).toBe('ended');
    });
});

// ─── handleDisconnect ───────────────────────────────────────────

describe('handleDisconnect', () => {
    it('should end session and return true if session is active', async () => {
        mockedSession.findOne = jest.fn().mockResolvedValue(mockSession({ status: 'active' }));
        mockedSession.findOneAndUpdate = jest
            .fn()
            .mockResolvedValue(mockSession({ status: 'ended' }));

        const result = await handleDisconnect('room1');
        expect(result).toBe(true);
    });

    it('should return false if session is not active', async () => {
        mockedSession.findOne = jest.fn().mockResolvedValue(mockSession({ status: 'pending' }));

        const result = await handleDisconnect('room1');
        expect(result).toBe(false);
    });

    it('should return false if session not found', async () => {
        mockedSession.findOne = jest.fn().mockResolvedValue(null);

        const result = await handleDisconnect('room1');
        expect(result).toBe(false);
    });
});

// ─── voteLanguage ───────────────────────────────────────────

describe('voteLanguage', () => {
    it('should throw if user already locked in', async () => {
        const votes = new Map([['user1', 'python']]);
        mockedSession.findOne = jest.fn().mockResolvedValue(mockSession({ languageVotes: votes }));

        await expect(voteLanguage('room1', 'user1', 'python')).rejects.toThrow(
            'User has already locked in',
        );
    });

    it('should return session if only one user voted', async () => {
        mockedSession.findOne = jest.fn().mockResolvedValue(mockSession());
        const oneVote = new Map([['user1', 'python']]);
        mockedSession.findOneAndUpdate = jest
            .fn()
            .mockResolvedValue(mockSession({ languageVotes: oneVote }));

        const result = await voteLanguage('room1', 'user1', 'python');
        expect(result?.status).toBe('pending');
    });

    it('should start session if both users vote same language', async () => {
        mockedSession.findOne = jest.fn().mockResolvedValue(mockSession());
        const twoVotesSame = new Map([
            ['user1', 'python'],
            ['user2', 'python'],
        ]);
        mockedSession.findOneAndUpdate = jest
            .fn()
            .mockResolvedValueOnce(mockSession({ languageVotes: twoVotesSame }))
            .mockResolvedValueOnce(mockSession({ status: 'active', language: 'python' }));

        const result = await voteLanguage('room1', 'user1', 'python');
        expect(result?.status).toBe('active');
        expect(result?.language).toBe('python');
    });

    it('should end session if both users vote different languages', async () => {
        mockedSession.findOne = jest.fn().mockResolvedValue(mockSession());
        const twoVotesDiff = new Map([
            ['user1', 'python'],
            ['user2', 'javascript'],
        ]);
        mockedSession.findOneAndUpdate = jest
            .fn()
            .mockResolvedValueOnce(mockSession({ languageVotes: twoVotesDiff }))
            .mockResolvedValueOnce(mockSession({ status: 'ended' }));

        const result = await voteLanguage('room1', 'user1', 'python');
        expect(result?.status).toBe('ended');
    });
});

// ─── executeCode ───────────────────────────────────────────

describe('executeCode', () => {
    it('should throw if session not found', async () => {
        mockedSession.findOne = jest.fn().mockResolvedValue(null);

        await expect(executeCode('room1', 'code', 'python')).rejects.toThrow('Session not found');
    });

    it('should throw if session is not active', async () => {
        mockedSession.findOne = jest.fn().mockResolvedValue(mockSession({ status: 'pending' }));

        await expect(executeCode('room1', 'code', 'python')).rejects.toThrow(
            'Session is not active',
        );
    });

    it('should throw if language is unsupported', async () => {
        mockedSession.findOne = jest.fn().mockResolvedValue(mockSession({ status: 'active' }));

        await expect(executeCode('room1', 'code', 'brainfuck')).rejects.toThrow(
            'Unsupported language',
        );
    });

    it('should return code execution result', async () => {
        mockedSession.findOne = jest.fn().mockResolvedValue(mockSession({ status: 'active' }));
        (mockedAxios.post as jest.Mock).mockResolvedValue({
            data: {
                stdout: 'hello',
                stderr: '',
                status: { description: 'Accepted' },
                time: '0.01',
                memory: 1024,
            },
        });

        const result = await executeCode('room1', 'print("hello")', 'python');
        expect(result.stdout).toBe('hello');
        expect(result.status).toBe('Accepted');
    });

    it('should call judge0 with correct payload', async () => {
        mockedSession.findOne = jest.fn().mockResolvedValue(mockSession({ status: 'active' }));
        (mockedAxios.post as jest.Mock).mockResolvedValue({
            data: {
                stdout: 'hello',
                stderr: '',
                status: { description: 'Accepted' },
                time: '0.01',
                memory: 1024,
            },
        });

        await executeCode('room1', 'print("hello")', 'python');

        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://ce.judge0.com/submissions?wait=true',
            expect.objectContaining({
                source_code: 'print("hello")',
                language_id: expect.any(Number),
            }),
            expect.any(Object),
        );
    });

    // ─── addMessageToSession ───────────────────────────────────────────

    describe('addMessageToSession', () => {
        it('should add a message to the session', async () => {
            const message = { senderId: 'user1', username: 'kiran', content: 'hello' };
            const updatedSession = mockSession({
                messages: [{ ...message, timestamp: new Date() }],
            });

            mockedSession.findOneAndUpdate = jest.fn().mockResolvedValue(updatedSession);

            const result = await addMessageToSession('room1', message);

            expect(mockedSession.findOneAndUpdate).toHaveBeenCalledWith(
                { roomId: 'room1' },
                { $push: { messages: message } },
                { new: true },
            );
            expect(result?.messages).toHaveLength(1);
            expect(result?.messages[0].content).toBe('hello');
        });

        it('should return null if session not found', async () => {
            mockedSession.findOneAndUpdate = jest.fn().mockResolvedValue(null);

            const result = await addMessageToSession('room1', {
                senderId: 'user1',
                username: 'kiran',
                content: 'hello',
            });

            expect(result).toBeNull();
        });
    });
});
