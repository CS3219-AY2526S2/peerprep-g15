import request from 'supertest';
import { createApp } from '../../app';
import { createSession, getSession, endSession } from '../../services/collaboration-service';

// mock the service layer
jest.mock('../../services/collaboration-service');

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

// ─── POST /session ───────────────────────────────────────────

describe('POST /session', () => {
    it('should create a session and return 201', async () => {
        mockedCreateSession.mockResolvedValue(mockSession() as any);

        const res = await request(app)
            .post('/session')
            .send({ roomId: 'room1', userIds: ['user1', 'user2'], questionId: 'q1' });

        expect(res.status).toBe(201);
        expect(res.body.roomId).toBe('room1');
    });

    it('should return 400 if fields are missing', async () => {
        const res = await request(app).post('/session').send({ roomId: 'room1' }); // missing userIds and questionId

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Missing required fields');
    });

    it('should return 500 if service throws', async () => {
        mockedCreateSession.mockRejectedValue(new Error('DB error'));

        const res = await request(app)
            .post('/session')
            .send({ roomId: 'room1', userIds: ['user1', 'user2'], questionId: 'q1' });

        expect(res.status).toBe(500);
        expect(res.body.message).toBe('Internal server error');
    });
});

// ─── GET /session/:roomId ───────────────────────────────────────────

describe('GET /session/:roomId', () => {
    it('should return session if found', async () => {
        mockedGetSession.mockResolvedValue(mockSession() as any);

        const res = await request(app).get('/session/room1');

        expect(res.status).toBe(200);
        expect(res.body.roomId).toBe('room1');
    });

    it('should return 404 if session not found', async () => {
        mockedGetSession.mockResolvedValue(null);

        const res = await request(app).get('/session/fake-room');

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Session not found');
    });

    it('should return 500 if service throws', async () => {
        mockedGetSession.mockRejectedValue(new Error('DB error'));

        const res = await request(app).get('/session/room1');

        expect(res.status).toBe(500);
        expect(res.body.message).toBe('Internal server error');
    });
});

// ─── DELETE /session/:roomId ───────────────────────────────────────────

describe('DELETE /session/:roomId', () => {
    it('should end session and return 200', async () => {
        mockedEndSession.mockResolvedValue(mockSession({ status: 'ended' }) as any);

        const res = await request(app).delete('/session/room1');

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ended');
    });

    it('should return 404 if session not found', async () => {
        mockedEndSession.mockResolvedValue(null);

        const res = await request(app).delete('/session/fake-room');

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Session not found');
    });

    it('should return 500 if service throws', async () => {
        mockedEndSession.mockRejectedValue(new Error('DB error'));

        const res = await request(app).delete('/session/room1');

        expect(res.status).toBe(500);
        expect(res.body.message).toBe('Internal server error');
    });
});
