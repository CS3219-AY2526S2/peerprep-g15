// mock uuid and the service layer
jest.mock('uuid', () => ({ v4: jest.fn(() => 'mocked-room-id') }));
jest.mock('../../services/collaboration-service');

import request from 'supertest';
import { createApp } from '../../app';
import { createSession, getSession, endSession } from '../../services/collaboration-service';

const mockedCreateSession = jest.mocked(createSession);
const mockedGetSession = jest.mocked(getSession);
const mockedEndSession = jest.mocked(endSession);

const app = createApp();

const mockSession = (overrides = {}) => ({
    roomId: 'room1',
    userIds: ['user1', 'user2'],
    questionId: 'q1',
    status: 'pending',
    code: '',
    language: null,
    languageVotes: new Map(),
    ...overrides,
});

beforeEach(() => {
    jest.clearAllMocks();
});

// ─── POST /collab/create ───────────────────────────────────────────

describe('POST /collab/create', () => {
    it('should create a session and return 201', async () => {
        mockedCreateSession.mockResolvedValue(mockSession() as any);

        const res = await request(app)
            .post('/collab/create')
            .send({ roomId: 'room1', userIds: ['user1', 'user2'], questionId: 'q1' });

        expect(res.status).toBe(201);
        expect(res.body.roomId).toBe('room1');
    });

    it('should return 400 if fields are missing', async () => {
        const res = await request(app)
            .post('/collab/create')
            .send({ roomId: 'room1', userIds: ['user1'] }); // missing questionId

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Missing required fields');
    });

    it('should return 500 if service throws', async () => {
        mockedCreateSession.mockRejectedValue(new Error('DB error'));

        const res = await request(app)
            .post('/collab/create')
            .send({ roomId: 'room1', userIds: ['user1', 'user2'], questionId: 'q1' });

        expect(res.status).toBe(500);
        expect(res.body.message).toBe('Internal server error');
    });
});

// ─── GET /collab/room/:roomId ───────────────────────────────────────────

describe('GET /collab/room/:roomId', () => {
    it('should return session if found', async () => {
        mockedGetSession.mockResolvedValue(mockSession() as any);

        const res = await request(app).get('/collab/room/room1');

        expect(res.status).toBe(200);
        expect(res.body.roomId).toBe('room1');
    });

    it('should return 404 if session not found', async () => {
        mockedGetSession.mockResolvedValue(null);

        const res = await request(app).get('/collab/room/fake-room');

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Session not found');
    });

    it('should return 500 if service throws', async () => {
        mockedGetSession.mockRejectedValue(new Error('DB error'));

        const res = await request(app).get('/collab/room/room1');

        expect(res.status).toBe(500);
        expect(res.body.message).toBe('Internal server error');
    });
});

// ─── DELETE /collab/room/:roomId ───────────────────────────────────────────

describe('DELETE /collab/room/:roomId', () => {
    it('should end session and return 200', async () => {
        mockedEndSession.mockResolvedValue(mockSession({ status: 'ended' }) as any);

        const res = await request(app).delete('/collab/room/room1');

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ended');
    });

    it('should return 404 if session not found', async () => {
        mockedEndSession.mockResolvedValue(null);

        const res = await request(app).delete('/collab/room/fake-room');

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Session not found');
    });

    it('should return 500 if service throws', async () => {
        mockedEndSession.mockRejectedValue(new Error('DB error'));

        const res = await request(app).delete('/collab/room/room1');

        expect(res.status).toBe(500);
        expect(res.body.message).toBe('Internal server error');
    });
});
