import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app';

describe('health routes', () => {
    it('GET /health returns service status', async () => {
        const app = createApp();

        const res = await request(app).get('/health');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            status: 'ok',
            service: 'question-service',
        });
    });
});
