import { createServer } from 'http';
import Client from 'socket.io-client';
import { createApp } from '../../app';
import { initSocket } from '../../socket';
import {
    getSession,
    voteLanguage,
    updateCode,
    endSession,
    handleDisconnect,
    executeCode,
    addMessageToSession,
} from '../../services/collaboration-service';

jest.mock('../../services/collaboration-service');

const mockedGetSession = jest.mocked(getSession);
const mockedVoteLanguage = jest.mocked(voteLanguage);
const mockedUpdateCode = jest.mocked(updateCode);
const mockedEndSession = jest.mocked(endSession);
const mockedExecuteCode = jest.mocked(executeCode);
const mockedAddMessageToSession = jest.mocked(addMessageToSession);

const mockSession = (overrides = {}) => ({
    roomId: 'room1',
    userIds: ['user1', 'user2'],
    questionId: 'q1',
    status: 'active',
    code: '',
    language: 'python',
    languageVotes: new Map(),
    messages: [],
    ...overrides,
});

let server: ReturnType<typeof createServer>;
let clientA: ReturnType<typeof Client>;
let clientB: ReturnType<typeof Client>;
let port: number;

beforeAll((done) => {
    const app = createApp();
    server = createServer(app);
    initSocket(server);
    server.listen(0, () => {
        port = (server.address() as any).port;
        done();
    });
});

afterAll((done) => {
    server.close(done);
});

beforeEach((done) => {
    jest.clearAllMocks();
    clientA = Client(`http://localhost:${port}`);
    clientB = Client(`http://localhost:${port}`);

    // wait for both to connect
    let connected = 0;
    const onConnect = () => {
        connected++;
        if (connected === 2) done();
    };
    clientA.on('connect', onConnect);
    clientB.on('connect', onConnect);
});

afterEach(() => {
    clientA.disconnect();
    clientB.disconnect();
});

// ─── join-room ───────────────────────────────────────────

describe('join-room', () => {
    it('should emit session-state to joining user', (done) => {
        mockedGetSession.mockResolvedValue(mockSession() as any);

        clientA.emit('join-room', 'room1', 'user1');

        clientA.on('session-state', (session: any) => {
            expect(session.roomId).toBe('room1');
            done();
        });
    });
});

// ─── lock-in ───────────────────────────────────────────

describe('lock-in', () => {
    it('should emit session-started when both users agree on language', (done) => {
        mockedVoteLanguage.mockResolvedValue(
            mockSession({ status: 'active', language: 'python' }) as any,
        );

        clientA.emit('join-room', 'room1', 'user1');
        clientA.emit('lock-in', 'room1', 'user1', 'python');

        clientA.on('session-started', (data: any) => {
            expect(data.language).toBe('python');
            done();
        });
    });

    it('should emit language-mismatch when users disagree', (done) => {
        mockedVoteLanguage.mockResolvedValue(mockSession({ status: 'ended' }) as any);

        clientA.emit('join-room', 'room1', 'user1');
        clientA.emit('lock-in', 'room1', 'user1', 'python');

        clientA.on('language-mismatch', () => {
            done();
        });
    });

    it('should emit user-locked-in when only one user voted', (done) => {
        mockedVoteLanguage.mockResolvedValue(mockSession({ status: 'pending' }) as any);

        clientA.emit('join-room', 'room1', 'user1');
        clientA.emit('lock-in', 'room1', 'user1', 'python');

        clientA.on('user-locked-in', (data: any) => {
            expect(data.userId).toBe('user1');
            done();
        });
    });
});

// ─── code-change ───────────────────────────────────────────

describe('code-change', () => {
    it('should emit code-update to other user', (done) => {
        mockedGetSession.mockResolvedValue(mockSession({ status: 'active' }) as any);
        mockedUpdateCode.mockResolvedValue(mockSession() as any);

        clientA.emit('join-room', 'room1', 'user1');
        clientB.emit('join-room', 'room1', 'user2');

        // wait for both to join then send code change
        setTimeout(() => {
            clientA.emit('code-change', 'room1', 'console.log("hello")');
        }, 100);

        clientB.on('code-update', (code: any) => {
            expect(code).toBe('console.log("hello")');
            done();
        });
    });

    it('should not emit code-update if session is not active', (done) => {
        mockedGetSession.mockResolvedValue(mockSession({ status: 'pending' }) as any);

        clientA.emit('join-room', 'room1', 'user1');
        clientB.emit('join-room', 'room1', 'user2');

        setTimeout(() => {
            clientA.emit('code-change', 'room1', 'console.log("hello")');
        }, 100);

        // should not receive code-update
        clientB.on('code-update', () => {
            done(new Error('should not have received code-update'));
        });

        // if nothing received after 500ms, test passes
        setTimeout(() => done(), 500);
    });
});

// ─── run-code ───────────────────────────────────────────

describe('run-code', () => {
    it('should emit code-result after execution', (done) => {
        mockedGetSession.mockResolvedValue(
            mockSession({ status: 'active', userIds: ['user1', 'user2'] }) as any,
        );
        mockedExecuteCode.mockResolvedValue({
            stdout: 'hello',
            stderr: '',
            status: 'Accepted',
            time: '0.01',
            memory: 1024,
        });

        clientA.emit('join-room', 'room1', 'user1');

        setTimeout(() => {
            clientA.emit('run-code', 'room1', 'user1', 'print("hello")', 'python');
        }, 100);

        clientA.on('code-result', (result: any) => {
            expect(result.stdout).toBe('hello');
            expect(result.status).toBe('Accepted');
            done();
        });
    }, 10000);

    it('should emit code-error if execution fails', (done) => {
        mockedGetSession.mockResolvedValue(
            mockSession({ status: 'active', userIds: ['user1', 'user2'] }) as any,
        );
        mockedExecuteCode.mockRejectedValue(new Error('Execution failed'));

        clientA.emit('join-room', 'room1', 'user1');

        setTimeout(() => {
            clientA.emit('run-code', 'room1', 'user1', 'print("hello")', 'python');
        }, 100);

        clientA.on('code-error', (err: any) => {
            expect(err.message).toBe('Execution failed');
            done();
        });
    }, 10000);
});

// ─── leave-session ───────────────────────────────────────────

describe('leave-session', () => {
    it('should emit session-ended to both users', (done) => {
        mockedEndSession.mockResolvedValue(mockSession({ status: 'ended' }) as any);

        clientA.emit('join-room', 'room1', 'user1');
        clientB.emit('join-room', 'room1', 'user2');

        setTimeout(() => {
            clientA.emit('leave-session', 'room1', 'user1');
        }, 100);

        clientB.on('session-ended', (data: any) => {
            expect(data.reason).toBe('left');
            done();
        });
    });
});

// ─── send-message ───────────────────────────────────────────

describe('send-message', () => {
    it('should broadcast message to other user in the room', (done) => {
        mockedAddMessageToSession.mockResolvedValue(mockSession() as any);

        clientA.emit('join-room', 'room1', 'user1');
        clientB.emit('join-room', 'room1', 'user2');

        setTimeout(() => {
            clientA.emit('send-message', {
                roomId: 'room1',
                senderId: 'user1',
                username: 'kiran',
                content: 'hello',
            });
        }, 100);

        clientB.on('receive-message', (data: any) => {
            expect(data.senderId).toBe('user1');
            expect(data.username).toBe('kiran');
            expect(data.content).toBe('hello');
            expect(data.timestamp).toBeDefined();
            done();
        });
    });

    it('should not send message back to the sender', (done) => {
        mockedAddMessageToSession.mockResolvedValue(mockSession() as any);

        clientA.emit('join-room', 'room1', 'user1');
        clientB.emit('join-room', 'room1', 'user2');

        setTimeout(() => {
            clientA.emit('send-message', {
                roomId: 'room1',
                senderId: 'user1',
                username: 'kiran',
                content: 'hello',
            });
        }, 100);

        clientA.on('receive-message', () => {
            done(new Error('sender should not receive their own message'));
        });

        setTimeout(() => done(), 500);
    });

    it('should save the message to the database', (done) => {
        mockedAddMessageToSession.mockResolvedValue(mockSession() as any);

        clientA.emit('join-room', 'room1', 'user1');

        setTimeout(() => {
            clientA.emit('send-message', {
                roomId: 'room1',
                senderId: 'user1',
                username: 'kiran',
                content: 'hello',
            });
        }, 100);

        setTimeout(() => {
            expect(mockedAddMessageToSession).toHaveBeenCalledWith('room1', {
                senderId: 'user1',
                username: 'kiran',
                content: 'hello',
            });
            done();
        }, 300);
    });
});

// ─── chat-history ───────────────────────────────────────────

describe('chat-history', () => {
    it('should send chat history when user joins room', (done) => {
        const messages = [
            { senderId: 'user1', username: 'kiran', content: 'hey', timestamp: new Date() },
            { senderId: 'user2', username: 'partner', content: 'sup', timestamp: new Date() },
        ];
        mockedGetSession.mockResolvedValue(mockSession({ messages }) as any);

        clientA.emit('join-room', 'room1', 'user1');

        clientA.on('chat-history', (history: any) => {
            expect(history).toHaveLength(2);
            expect(history[0].content).toBe('hey');
            expect(history[1].content).toBe('sup');
            done();
        });
    });

    it('should not emit chat-history if no messages exist', (done) => {
        mockedGetSession.mockResolvedValue(mockSession({ messages: [] }) as any);

        clientA.emit('join-room', 'room1', 'user1');

        clientA.on('chat-history', () => {
            done(new Error('should not emit chat-history for empty messages'));
        });

        setTimeout(() => done(), 500);
    });
});
