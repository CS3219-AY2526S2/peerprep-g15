import { Server } from 'socket.io';
import http from 'http';
import * as Y from 'yjs';
import {
    getSession,
    voteLanguage,
    updateCode,
    endSession,
    handleDisconnect,
    submitCode,
    addMessageToSession,
} from './services/collaboration-service';
import { ExecutionSpec, TestCase } from './types/execution';

const disconnectTimers = new Map<string, NodeJS.Timeout>();
const languageTimers = new Map<string, NodeJS.Timeout>();
const runCodeTimers = new Map<string, NodeJS.Timeout>();
const roomDocs = new Map<string, Y.Doc>();

async function persistCode(roomId: string) {
    const doc = roomDocs.get(roomId);
    if (!doc) return;

    const code = doc.getText('code').toString();
    if (code) await updateCode(roomId, code);
}

export function initSocket(server: http.Server) {
    const io = new Server(server, {
        cors: { origin: '*' },
    });

    io.on('connection', (socket) => {
        console.log('user connected:', socket.id);

        socket.on('join-room', async (roomId: string, userId: string, username: string) => {
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

            const session = await getSession(roomId);
            socket.emit('session-state', session);

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
                        io.to(roomId).emit('language-timeout');
                    }
                }, 30000);

                languageTimers.set(roomId, timer);
            }
        });

        socket.on('lock-in', async (roomId: string, userId: string, language: string) => {
            const session = await voteLanguage(roomId, userId, language);

            console.log('lock-in result:', {
                userId,
                status: session?.status,
                language: session?.language,
            });

            if (session?.status === 'active') {
                clearTimeout(languageTimers.get(roomId)!);
                languageTimers.delete(roomId);

                socket.emit('session-started', {
                    language: session.language,
                    insertStarter: true,
                });

                socket.to(roomId).emit('session-started', {
                    language: session.language,
                    insertStarter: false,
                });
            } else if (session?.status === 'ended') {
                clearTimeout(languageTimers.get(roomId)!);
                languageTimers.delete(roomId);
                io.to(roomId).emit('language-mismatch');
            } else {
                io.to(roomId).emit('user-locked-in', { userId });
            }
        });

        socket.on('yjs-update', (roomId: string, update: Uint8Array) => {
            if (!roomDocs.has(roomId)) roomDocs.set(roomId, new Y.Doc());

            const doc = roomDocs.get(roomId)!;
            Y.applyUpdate(doc, update);
            socket.to(roomId).emit('yjs-update', update);
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
                        roomDocs.delete(roomId);
                        io.to(roomId).emit('session-ended', { reason: 'disconnect' });
                    }
                }, 30000);

                disconnectTimers.set(userId, timer);
            } else if (session?.status === 'pending' && usersInRoom >= 1) {
                await endSession(roomId);
                roomDocs.delete(roomId);
                io.to(roomId).emit('session-ended', { reason: 'disconnect' });
            }
        });

        socket.on(
            'run-code',
            async (
                roomId: string,
                userId: string,
                code: string,
                language: string,
                testCases: TestCase[],
                executionSpec: ExecutionSpec,
            ) => {
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
                userId: string,
                code: string,
                language: string,
                testCases: TestCase[],
                executionSpec: ExecutionSpec,
            ) => {
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
            roomDocs.delete(roomId);
            io.to(roomId).emit('session-ended', { reason: 'left' });
            socket.leave(roomId);
        });

        socket.on('send-message', async (data) => {
            const { roomId, senderId, username, content } = data;

            await addMessageToSession(roomId, {
                senderId,
                username,
                content,
            });

            socket.to(roomId).emit('receive-message', {
                senderId,
                username,
                content,
                timestamp: new Date(),
            });
        });
    });

    return io;
}
