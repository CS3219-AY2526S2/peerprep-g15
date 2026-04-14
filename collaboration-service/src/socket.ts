import { Server } from 'socket.io';
import http from 'http';
import * as Y from 'yjs';
import {
    getSession,
    voteLanguage,
    endSession,
    handleDisconnect,
    submitCode,
    saveAttempt,
    addMessageToSession,
    persistYjsState,
} from './services/collaboration-service';
import { ExecutionSpec, TestCase } from './types/execution';
import { fetchQuestionById } from './services/question-service';
import { endMatchInMatchingService } from './services/matching-service';
import { resolveAuthUser } from './services/auth-service';

const disconnectTimers = new Map<string, NodeJS.Timeout>();
const languageTimers = new Map<string, NodeJS.Timeout>();
const runCodeTimers = new Map<string, NodeJS.Timeout>();
const roomDocs = new Map<string, Y.Doc>();
const persistTimers = new Map<string, NodeJS.Timeout>();

function debouncedPersistYjs(roomId: string) {
    if (persistTimers.has(roomId)) {
        clearTimeout(persistTimers.get(roomId)!);
    }

    const timer = setTimeout(async () => {
        persistTimers.delete(roomId);
        const doc = roomDocs.get(roomId);
        if (!doc) return;

        console.log(`[debounce] Saving yjsState for room ${roomId}`);

        await persistYjsState(
            roomId,
            Buffer.from(Y.encodeStateAsUpdate(doc)),
            doc.getText('code').toString(),
        );
    }, 2000);

    persistTimers.set(roomId, timer);
}

async function persistCode(roomId: string) {
    const doc = roomDocs.get(roomId);
    if (!doc) return;

    await persistYjsState(
        roomId,
        Buffer.from(Y.encodeStateAsUpdate(doc)),
        doc.getText('code').toString(),
    );
}

export function initSocket(server: http.Server) {
    const io = new Server(server, {
        cors: { origin: '*' },
    });

    io.use(async (socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error('Missing auth token'));

        try {
            const user = await resolveAuthUser(token);
            socket.data.userId = user.id;
            socket.data.username = user.username;
            next();
        } catch (err) {
            next(new Error('Invalid or expired token'));
        }
    });

    io.on('connection', (socket) => {
        console.log('user connected:', socket.id);

        socket.on('join-room', async (roomId: string) => {
            const { userId, username } = socket.data;
            const session = await getSession(roomId);

            if (!session || !session.userIds.includes(userId)) {
                socket.emit('join-error', { message: 'Invalid session or user' });
                return;
            }

            socket.join(roomId);
            socket.data.roomId = roomId;
            socket.data.userId = userId;
            socket.data.username = username;

            socket.to(roomId).emit('partner-info', { userId, username });

            const socketsInRoom = await io.in(roomId).fetchSockets();
            for (const s of socketsInRoom) {
                if (s.id !== socket.id && s.data.username) {
                    socket.emit('partner-info', {
                        userId: s.data.userId,
                        username: s.data.username,
                    });
                }
            }

            if (disconnectTimers.has(userId)) {
                clearTimeout(disconnectTimers.get(userId)!);
                disconnectTimers.delete(userId);
                io.to(roomId).emit('user-reconnected', { userId });
            }

            if (!roomDocs.has(roomId) && session?.yjsState) {
                const doc = new Y.Doc();
                Y.applyUpdate(doc, new Uint8Array(session.yjsState));
                roomDocs.set(roomId, doc);
            }

            let question = null;
            if (session?.questionId) {
                question = await fetchQuestionById(session.questionId);
            }

            socket.emit('session-state', { session, question });

            if (roomDocs.has(roomId)) {
                const state = Y.encodeStateAsUpdate(roomDocs.get(roomId)!);
                socket.emit('yjs-sync', state);
            }

            if (session?.messages?.length) {
                socket.emit('chat-history', session.messages);
            }

            const usersInRoom = io.sockets.adapter.rooms.get(roomId)?.size ?? 0;
            if (usersInRoom === 2) {
                io.to(roomId).emit('user-joined', { timeRemaining: 30 });
            }

            if (usersInRoom === 2 && !languageTimers.has(roomId)) {
                const timer = setTimeout(async () => {
                    const currentSession = await getSession(roomId);
                    if (currentSession?.status === 'pending') {
                        await endSession(roomId);
                        await endMatchInMatchingService(roomId);
                        io.to(roomId).emit('language-timeout');
                    }
                }, 30000);

                languageTimers.set(roomId, timer);
            }
        });

        socket.on('lock-in', async (roomId: string, language: string) => {
            try {
                const { userId } = socket.data;
                const session = await voteLanguage(roomId, userId, language);

                if (session?.status === 'active') {
                    clearTimeout(languageTimers.get(roomId)!);
                    languageTimers.delete(roomId);

                    if (session.yjsState) {
                        const doc = new Y.Doc();
                        Y.applyUpdate(doc, new Uint8Array(session.yjsState));
                        roomDocs.set(roomId, doc);
                    }

                    io.to(roomId).emit('session-started', {
                        language: session.language,
                        yjsState: session.yjsState,
                    });
                } else if (session?.status === 'ended') {
                    clearTimeout(languageTimers.get(roomId)!);
                    languageTimers.delete(roomId);
                    await endMatchInMatchingService(roomId);
                    io.to(roomId).emit('language-mismatch');
                } else {
                    io.to(roomId).emit('user-locked-in', { userId });
                }
            } catch (err: any) {
                socket.emit('lock-in-error', { message: err?.message || 'Lock-in failed' });
            }
        });

        socket.on('yjs-update', (roomId: string, update: Uint8Array) => {
            if (!roomDocs.has(roomId)) roomDocs.set(roomId, new Y.Doc());

            const doc = roomDocs.get(roomId)!;
            Y.applyUpdate(doc, update);
            socket.to(roomId).emit('yjs-update', update);

            debouncedPersistYjs(roomId);
        });

        socket.on('disconnect', async () => {
            const { roomId, userId } = socket.data;
            console.log('=== DISCONNECT === roomId:', roomId, 'userId:', userId);

            if (!roomId || !userId) return;

            const session = await getSession(roomId);
            const usersInRoom = io.sockets.adapter.rooms.get(roomId)?.size ?? 0;

            if (session?.status === 'active') {
                await persistCode(roomId);
                io.to(roomId).emit('user-disconnected', { userId });

                const timer = setTimeout(async () => {
                    const sessionEnded = await handleDisconnect(roomId);
                    if (sessionEnded) {
                        await endMatchInMatchingService(roomId);
                        roomDocs.delete(roomId);
                        persistTimers.delete(roomId);
                        io.to(roomId).emit('session-ended', { reason: 'disconnect' });
                    }
                }, 30000);

                disconnectTimers.set(userId, timer);
            } else if (session?.status === 'pending' && usersInRoom >= 1) {
                await endSession(roomId);
                roomDocs.delete(roomId);
                persistTimers.delete(roomId);
                io.to(roomId).emit('session-ended', { reason: 'disconnect' });
            }
        });

        socket.on(
            'run-code',
            async (
                roomId: string,
                code: string,
                language: string,
                testCases: TestCase[],
                executionSpec: ExecutionSpec,
            ) => {
                const { userId } = socket.data;
                const session = await getSession(roomId);
                if (!session) return;
                if (session.status !== 'active') return;
                if (!session.userIds.includes(userId)) return;

                if (runCodeTimers.has(roomId)) {
                    clearTimeout(runCodeTimers.get(roomId)!);
                }

                const timer = setTimeout(async () => {
                    runCodeTimers.delete(roomId);

                    try {
                        await persistCode(roomId);
                        io.to(roomId).emit('code-executing');

                        const result = await submitCode(
                            roomId,
                            code,
                            language,
                            testCases,
                            executionSpec,
                        );

                        io.to(roomId).emit('code-result', result);
                    } catch (err: any) {
                        io.to(roomId).emit('code-error', {
                            message: err?.message || 'Execution failed',
                        });
                    }
                }, 500);

                runCodeTimers.set(roomId, timer);
            },
        );

        socket.on(
            'submit-code',
            async (
                roomId: string,
                code: string,
                language: string,
                testCases: TestCase[],
                executionSpec: ExecutionSpec,
            ) => {
                const { userId } = socket.data;
                const session = await getSession(roomId);
                if (!session || session.status !== 'active') return;
                if (!session.userIds.includes(userId)) return;

                try {
                    await persistCode(roomId);
                    io.to(roomId).emit('code-executing');

                    const result = await submitCode(
                        roomId,
                        code,
                        language,
                        testCases,
                        executionSpec,
                    );

                    await saveAttempt(roomId, code, language, result.passed, result.results);

                    io.to(roomId).emit('submit-result', result);
                } catch (err: any) {
                    io.to(roomId).emit('code-error', {
                        message: err?.message || 'Execution failed',
                    });
                }
            },
        );

        socket.on('leave-session', async (roomId: string) => {
            await persistCode(roomId);
            await endSession(roomId);
            await endMatchInMatchingService(roomId);
            roomDocs.delete(roomId);
            persistTimers.delete(roomId);
            io.to(roomId).emit('session-ended', { reason: 'left' });
            socket.leave(roomId);
        });

        socket.on('send-message', async (data) => {
            const { roomId, content } = data;
            const { userId, username } = socket.data;

            await addMessageToSession(roomId, {
                senderId: userId,
                username,
                content,
            });

            socket.to(roomId).emit('receive-message', {
                senderId: userId,
                username,
                content,
                timestamp: new Date(),
            });
        });
    });

    return io;
}
