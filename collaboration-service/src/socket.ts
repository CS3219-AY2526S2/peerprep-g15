import { Server } from 'socket.io';
import http from 'http';
import {
    getSession,
    voteLanguage,
    updateCode,
    endSession,
    handleDisconnect,
    executeCode,
    addMessageToSession,
} from './services/collaboration-service';

const disconnectTimers = new Map<string, NodeJS.Timeout>();
const languageTimers = new Map<string, NodeJS.Timeout>();
const runCodeTimers = new Map<string, NodeJS.Timeout>();

export function initSocket(server: http.Server) {
    const io = new Server(server, {
        cors: { origin: '*' },
    });

    io.on('connection', (socket) => {
        console.log('user connected:', socket.id);

        // user joins a room
        socket.on('join-room', async (roomId: string, userId: string, username: string) => {
            socket.join(roomId);
            socket.data.roomId = roomId;
            socket.data.userId = userId;
            socket.data.username = username;

            socket.to(roomId).emit('partner-info', { userId, username });

            // cancel disconnect timer if user reconnected
            if (disconnectTimers.has(userId)) {
                clearTimeout(disconnectTimers.get(userId));
                disconnectTimers.delete(userId);
                io.to(roomId).emit('user-reconnected', { userId });
            }

            const session = await getSession(roomId);
            socket.emit('session-state', session);

            //send chat history to the joining user
            if (session?.messages?.length) {
                socket.emit('chat-history', session.messages);
            }

            const usersInRoom = io.sockets.adapter.rooms.get(roomId)?.size ?? 0;

            if (usersInRoom === 2) {
                io.to(roomId).emit('user-joined', { timeRemaining: 30 });
            }

            // only start language timer once
            if (usersInRoom == 2 && !languageTimers.has(roomId)) {
                const timer = setTimeout(async () => {
                    const session = await getSession(roomId);
                    if (session?.status === 'pending') {
                        await endSession(roomId);
                        io.to(roomId).emit('language-timeout');
                    }
                }, 30000);
                languageTimers.set(roomId, timer);
            }
        });

        // user locks in language
        socket.on('lock-in', async (roomId: string, userId: string, language: string) => {
            const session = await voteLanguage(roomId, userId, language);

            if (session?.status === 'active') {
                // both locked in and agreed
                clearTimeout(languageTimers.get(roomId));
                languageTimers.delete(roomId);
                io.to(roomId).emit('session-started', { language: session.language });
            } else if (session?.status === 'ended') {
                // disagreed
                clearTimeout(languageTimers.get(roomId));
                languageTimers.delete(roomId);
                io.to(roomId).emit('language-mismatch');
            } else {
                // one user locked in, waiting for other
                io.to(roomId).emit('user-locked-in', { userId });
            }
        });

        // code change
        socket.on('code-change', async (roomId: string, code: string) => {
            const session = await getSession(roomId);
            if (!session || session.status !== 'active') return; // add this

            await updateCode(roomId, code);
            socket.to(roomId).emit('code-update', code);
        });

        // user disconnects
        socket.on('disconnect', async () => {
            const { roomId, userId } = socket.data;
            console.log('=== DISCONNECT === roomId:', roomId, 'userId:', userId);
            if (!roomId || !userId) return;

            const session = await getSession(roomId);
            const usersInRoom = io.sockets.adapter.rooms.get(roomId)?.size ?? 0;

            if (session?.status === 'active') {
                io.to(roomId).emit('user-disconnected', { userId });

                const timer = setTimeout(async () => {
                    const sessionEnded = await handleDisconnect(roomId);
                    if (sessionEnded) {
                        io.to(roomId).emit('session-ended', { reason: 'disconnect' });
                    }
                }, 30000);

                disconnectTimers.set(userId, timer);
            } else if (session?.status === 'pending' && usersInRoom >= 1) {
                // Only end if the other user is still there (meaning someone left after both joined)
                await endSession(roomId);
                io.to(roomId).emit('session-ended', { reason: 'disconnect' });
            }
        });

        // user runs code
        socket.on(
            'run-code',
            async (roomId: string, userId: string, code: string, language: string) => {
                const session = await getSession(roomId);
                if (!session) return;
                if (session.status !== 'active') return;
                if (!session.userIds.includes(userId)) return;

                // debounce per room
                if (runCodeTimers.has(roomId)) clearTimeout(runCodeTimers.get(roomId));
                const timer = setTimeout(async () => {
                    runCodeTimers.delete(roomId);
                    try {
                        io.to(roomId).emit('code-executing');
                        const result = await executeCode(roomId, code, language);
                        io.to(roomId).emit('code-result', result);
                    } catch (err) {
                        io.to(roomId).emit('code-error', { message: 'Execution failed' });
                    }
                }, 500);
                runCodeTimers.set(roomId, timer);
            },
        );

        socket.on(
            'submit-code',
            async (roomId: string, userId: string, code: string, language: string) => {
                const session = await getSession(roomId);
                if (!session || session.status !== 'active') return;
                if (!session.userIds.includes(userId)) return;

                try {
                    io.to(roomId).emit('code-executing');
                    const result = await executeCode(roomId, code, language);

                    // TODO: compare result.stdout with expected output from question service
                    // For now, just send the result and let frontend decide

                    const passed = result.status === 'Accepted' && !result.stderr;

                    io.to(roomId).emit('submit-result', {
                        stdout: result.stdout,
                        stderr: result.stderr,
                        status: result.status,
                        passed: passed,
                    });
                } catch (err) {
                    io.to(roomId).emit('code-error', { message: 'Execution failed' });
                }
            },
        );

        socket.on('leave-session', async (roomId: string, userId: string) => {
            await endSession(roomId); // call service directly
            io.to(roomId).emit('session-ended', { reason: 'left' });
            socket.leave(roomId);
        });

        //Adding message handling for chat functionality
        socket.on('send-message', async (data) => {
            const { roomId, senderId, username, content } = data;

            await addMessageToSession(roomId, { senderId, username, content });

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
