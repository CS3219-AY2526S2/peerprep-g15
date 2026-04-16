export {};

const ioClient = require('socket.io-client').io;
const axios = require('axios');

const SERVER_URL = 'http://localhost:3004';
const API_URL = 'http://localhost:3004/session';

async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTest() {
    try {
        // Step 1: Create a session via REST API
        console.log('=== Step 1: Creating session ===');
        const { data: session } = await axios.post(API_URL, {
            roomId: 'test-room-1',
            userIds: ['user1', 'user2'],
            questionId: 'q1',
        });
        console.log('Session created:', session.roomId, 'Status:', session.status);

        // Step 2: Connect two users via socket
        console.log('\n=== Step 2: Connecting users ===');
        const clientA = ioClient(SERVER_URL);
        const clientB = ioClient(SERVER_URL);

        await sleep(1000);

        // Step 3: Both join the room
        console.log('\n=== Step 3: Joining room ===');
        clientA.emit('join-room', 'test-room-1', 'user1');
        clientB.emit('join-room', 'test-room-1', 'user2');

        clientA.on('session-state', (s: any) => {
            console.log('Client A got session state:', s?.status);
        });

        clientB.on('session-state', (s: any) => {
            console.log('Client B got session state:', s?.status);
        });

        await sleep(1000);

        // Step 4: Both lock in same language
        console.log('\n=== Step 4: Language voting ===');

        clientA.on('session-started', (data: any) => {
            console.log('Session started! Language:', data.language);
        });

        clientA.emit('lock-in', 'test-room-1', 'user1', 'python');
        await sleep(500);
        clientB.emit('lock-in', 'test-room-1', 'user2', 'python');

        await sleep(1000);

        // Step 5: Code editing
        console.log('\n=== Step 5: Code editing ===');

        clientB.on('code-update', (code: any) => {
            console.log('Client B received code update:', code);
        });

        clientA.emit('code-change', 'test-room-1', 'print("hello world")');

        await sleep(1000);

        // Step 6: Chat messaging
        console.log('\n=== Step 6: Chat messaging ===');

        clientB.on('receive-message', (data: any) => {
            console.log('Client B received message:', data.username, ':', data.content);
        });

        clientA.on('receive-message', (data: any) => {
            console.log('Client A received message:', data.username, ':', data.content);
        });

        clientA.emit('send-message', {
            roomId: 'test-room-1',
            senderId: 'user1',
            username: 'kiran',
            content: 'hello can you see this?',
        });

        await sleep(1000);

        clientB.emit('send-message', {
            roomId: 'test-room-1',
            senderId: 'user2',
            username: 'partner',
            content: 'yes I can!',
        });

        await sleep(1000);

        // Step 6.5: Code execution
        console.log('\n=== Step 6.5: Code execution ===');

        clientA.on('code-executing', () => {
            console.log('Code is executing...');
        });

        clientA.on('code-result', (result: any) => {
            console.log('Execution result:', result);
        });

        clientA.on('code-error', (err: any) => {
            console.log('Execution error:', err.message);
        });

        clientB.on('code-result', (result: any) => {
            console.log('Client B also got result:', result);
        });

        clientA.emit('run-code', 'test-room-1', 'user1', 'print("hello world")', 'python');

        await sleep(5000); // judge0 takes a few seconds

        // Step 7: Check session in DB via REST
        console.log('\n=== Step 7: Checking session state ===');
        const { data: updatedSession } = await axios.get(`${API_URL}/test-room-1`);
        console.log('Session status:', updatedSession.status);
        console.log('Language:', updatedSession.language);
        console.log('Code:', updatedSession.code);
        console.log('Messages:', updatedSession.messages?.length, 'messages stored');

        // Step 8: Leave session
        console.log('\n=== Step 8: Leaving session ===');

        clientB.on('session-ended', (data: any) => {
            console.log('Client B got session ended:', data.reason);
        });

        clientA.emit('leave-session', 'test-room-1', 'user1');

        await sleep(1000);

        // Final check
        console.log('\n=== Final: Checking ended session ===');
        const { data: endedSession } = await axios.get(`${API_URL}/test-room-1`);
        console.log('Final status:', endedSession.status);

        console.log('\n=== All tests complete ===');
        clientA.disconnect();
        clientB.disconnect();
        process.exit(0);
    } catch (err: any) {
        console.error('Test failed:', err.message);
        process.exit(1);
    }
}

runTest();

//npx ts-node src/tests/manual/test-e2e.ts
