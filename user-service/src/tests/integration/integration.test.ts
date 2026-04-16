import '../setup/setup-db';
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../../app';
import { createTestUser, makeAccessToken } from '../helpers/user';

function getSetCookieHeader(res: { headers: Record<string, unknown> }): string[] {
    const value = res.headers['set-cookie'];
    if (!value) return [];
    return Array.isArray(value) ? value : [String(value)];
}

const app = createApp();

describe('User service integration', () => {
    describe('Health flows', () => {
        it('GET /health should return service health', async () => {
            const res = await request(app).get('/health');

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                status: 'ok',
                service: 'user-service',
            });
        });
    });

    describe('Auth flows', () => {
        it('POST /auth/register should create a user and return access token + refresh cookie', async () => {
            const res = await request(app).post('/auth/register').send({
                username: 'alice',
                displayName: 'Alice',
                email: 'alice@example.com',
                password: 'password123',
            });

            expect(res.status).toBe(201);
            expect(res.body.user.username).toBe('alice');
            expect(res.body.user.email).toBe('alice@example.com');
            expect(res.body.accessToken).toBeTypeOf('string');

            const setCookie = getSetCookieHeader(res);
            expect(setCookie.length).toBeGreaterThan(0);
            expect(setCookie.some((cookie) => cookie.includes('refreshToken='))).toBe(true);
            expect(setCookie.some((cookie) => cookie.includes('HttpOnly'))).toBe(true);
        });

        it('POST /auth/register should reject duplicate username', async () => {
            await request(app).post('/auth/register').send({
                username: 'alice',
                displayName: 'Alice',
                email: 'alice@example.com',
                password: 'password123',
            });

            const res = await request(app).post('/auth/register').send({
                username: 'alice',
                displayName: 'Alice 2',
                email: 'alice2@example.com',
                password: 'password123',
            });

            expect(res.status).toBe(409);
            expect(res.body.error.code).toBe('CONFLICT');
        });

        it('POST /auth/register should reject invalid email', async () => {
            const res = await request(app).post('/auth/register').send({
                username: 'bademail',
                displayName: 'Bad Email',
                email: 'not-an-email',
                password: 'password123',
            });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('BAD_REQUEST');
        });

        it('POST /auth/register should reject missing password', async () => {
            const res = await request(app).post('/auth/register').send({
                username: 'nopassword',
                displayName: 'No Password',
                email: 'nopassword@example.com',
            });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('BAD_REQUEST');
        });

        it('POST /auth/login should log in with username', async () => {
            await request(app).post('/auth/register').send({
                username: 'bob',
                displayName: 'Bob',
                email: 'bob@example.com',
                password: 'password123',
            });

            const res = await request(app).post('/auth/login').send({
                identifier: 'bob',
                password: 'password123',
            });

            expect(res.status).toBe(200);
            expect(res.body.user.username).toBe('bob');
            expect(res.body.accessToken).toBeTypeOf('string');

            const cookies = getSetCookieHeader(res);
            expect(cookies.some((cookie) => cookie.includes('refreshToken='))).toBe(true);
        });

        it('POST /auth/login should log in with email', async () => {
            await request(app).post('/auth/register').send({
                username: 'charlie',
                displayName: 'Charlie',
                email: 'charlie@example.com',
                password: 'password123',
            });

            const res = await request(app).post('/auth/login').send({
                identifier: 'charlie@example.com',
                password: 'password123',
            });

            expect(res.status).toBe(200);
            expect(res.body.user.email).toBe('charlie@example.com');
        });

        it('POST /auth/login should reject wrong password', async () => {
            await request(app).post('/auth/register').send({
                username: 'dave',
                displayName: 'Dave',
                email: 'dave@example.com',
                password: 'password123',
            });

            const res = await request(app).post('/auth/login').send({
                identifier: 'dave',
                password: 'wrongpassword',
            });

            expect(res.status).toBe(401);
            expect(res.body.error.code).toBe('UNAUTHORIZED');
        });

        it('POST /auth/login should reject invalid body', async () => {
            const res = await request(app).post('/auth/login').send({
                identifier: '',
                password: '',
            });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('BAD_REQUEST');
        });

        it('POST /auth/refresh should issue a new access token when refresh cookie is valid', async () => {
            const registerRes = await request(app).post('/auth/register').send({
                username: 'eve',
                displayName: 'Eve',
                email: 'eve@example.com',
                password: 'password123',
            });

            const cookie = getSetCookieHeader(registerRes);

            const refreshRes = await request(app).post('/auth/refresh').set('Cookie', cookie);

            expect(refreshRes.status).toBe(200);
            expect(refreshRes.body.accessToken).toBeTypeOf('string');

            const refreshCookies = getSetCookieHeader(refreshRes);
            expect(refreshCookies.some((cookieStr) => cookieStr.includes('refreshToken='))).toBe(
                true,
            );
        });

        it('POST /auth/refresh should fail without refresh cookie', async () => {
            const res = await request(app).post('/auth/refresh');

            expect(res.status).toBe(401);
            expect(res.body.error.code).toBe('UNAUTHORIZED');
        });

        it('POST /auth/refresh should reject invalid refresh token', async () => {
            const res = await request(app)
                .post('/auth/refresh')
                .set('Cookie', ['refreshToken=not-a-real-token']);

            expect(res.status).toBe(401);
            expect(res.body.error.code).toBe('UNAUTHORIZED');
        });

        it('POST /auth/logout should clear refresh cookie', async () => {
            const registerRes = await request(app).post('/auth/register').send({
                username: 'frank',
                displayName: 'Frank',
                email: 'frank@example.com',
                password: 'password123',
            });

            const cookie = getSetCookieHeader(registerRes);

            const logoutRes = await request(app).post('/auth/logout').set('Cookie', cookie);

            expect(logoutRes.status).toBe(200);
            expect(logoutRes.body.message).toBe('Logged out');

            const logoutCookies = getSetCookieHeader(logoutRes);
            expect(logoutCookies.some((cookieStr) => cookieStr.includes('refreshToken='))).toBe(
                true,
            );

            const refreshRes = await request(app).post('/auth/refresh').set('Cookie', cookie);

            expect(refreshRes.status).toBe(401);
        });

        it('POST /auth/logout should still succeed without refresh cookie', async () => {
            const res = await request(app).post('/auth/logout');

            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Logged out');
        });
    });

    describe('Home flows', () => {
        it('GET /home should allow an authenticated user', async () => {
            const { user } = await createTestUser({
                username: 'homeuser',
                email: 'homeuser@example.com',
                role: 'user',
            });

            const accessToken = makeAccessToken(user._id.toString(), user.role);

            const res = await request(app)
                .get('/home')
                .set('Authorization', `Bearer ${accessToken}`);

            expect(res.status).toBe(200);
            expect(res.body.message).toBe('User home');
            expect(res.body.user.username).toBe('homeuser');
        });

        it('GET /home should reject missing auth token', async () => {
            const res = await request(app).get('/home');

            expect(res.status).toBe(401);
            expect(res.body.error.code).toBe('UNAUTHORIZED');
        });
    });

    describe('Me flows', () => {
        it('GET /me should return the authenticated user', async () => {
            const { user } = await createTestUser({
                username: 'meuser',
                displayName: 'Me User',
                email: 'meuser@example.com',
            });

            const accessToken = makeAccessToken(user._id.toString(), user.role);

            const res = await request(app).get('/me').set('Authorization', `Bearer ${accessToken}`);

            expect(res.status).toBe(200);
            expect(res.body.user.username).toBe('meuser');
            expect(res.body.user.email).toBe('meuser@example.com');
        });

        it('GET /me should reject missing auth token', async () => {
            const res = await request(app).get('/me');

            expect(res.status).toBe(401);
            expect(res.body.error.code).toBe('UNAUTHORIZED');
        });

        it('PATCH /me should update username, displayName, email, preferredLanguages, and skillLevel', async () => {
            const { user } = await createTestUser({
                username: 'olduser',
                displayName: 'Old User',
                email: 'olduser@example.com',
            });

            const accessToken = makeAccessToken(user._id.toString(), user.role);

            const res = await request(app)
                .patch('/me')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    username: 'newuser',
                    displayName: 'New User',
                    email: 'newuser@example.com',
                    preferredLanguages: ['TypeScript', 'Python'],
                    skillLevel: 'intermediate',
                });

            expect(res.status).toBe(200);
            expect(res.body.user.username).toBe('newuser');
            expect(res.body.user.displayName).toBe('New User');
            expect(res.body.user.email).toBe('newuser@example.com');
            expect(res.body.user.preferredLanguages).toEqual(['TypeScript', 'Python']);
            expect(res.body.user.skillLevel).toBe('intermediate');
        });

        it('PATCH /me should change password when currentPassword is correct', async () => {
            const { user } = await createTestUser({
                username: 'changepw',
                email: 'changepw@example.com',
                password: 'oldpassword123',
            });

            const accessToken = makeAccessToken(user._id.toString(), user.role);

            const res = await request(app)
                .patch('/me')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    currentPassword: 'oldpassword123',
                    newPassword: 'newpassword123',
                });

            expect(res.status).toBe(200);
            expect(res.body.user.username).toBe('changepw');
        });

        it('PATCH /me should reject empty patch body', async () => {
            const { user } = await createTestUser({
                username: 'emptypatch',
                email: 'emptypatch@example.com',
            });

            const accessToken = makeAccessToken(user._id.toString(), user.role);

            const res = await request(app)
                .patch('/me')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('BAD_REQUEST');
        });

        it('PATCH /me should reject providing only currentPassword without newPassword', async () => {
            const { user } = await createTestUser({
                username: 'currentonly',
                email: 'currentonly@example.com',
                password: 'password123',
            });

            const accessToken = makeAccessToken(user._id.toString(), user.role);

            const res = await request(app)
                .patch('/me')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    currentPassword: 'password123',
                });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('BAD_REQUEST');
        });

        it('PATCH /me should reject invalid skill level', async () => {
            const { user } = await createTestUser({
                username: 'badskill',
                email: 'badskill@example.com',
            });

            const accessToken = makeAccessToken(user._id.toString(), user.role);

            const res = await request(app)
                .patch('/me')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    skillLevel: 'expert',
                });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('BAD_REQUEST');
        });

        it('PATCH /me should reject password change when currentPassword is wrong', async () => {
            const { user } = await createTestUser({
                username: 'wrongpw',
                email: 'wrongpw@example.com',
                password: 'oldpassword123',
            });

            const accessToken = makeAccessToken(user._id.toString(), user.role);

            const res = await request(app)
                .patch('/me')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    currentPassword: 'wrongpassword',
                    newPassword: 'newpassword123',
                });

            expect(res.status).toBe(401);
            expect(res.body.error.code).toBe('UNAUTHORIZED');
        });

        it('PATCH /me should reject updating to an existing username', async () => {
            await createTestUser({
                username: 'existinguser',
                email: 'existinguser@example.com',
            });

            const { user } = await createTestUser({
                username: 'renameuser',
                email: 'renameuser@example.com',
            });

            const accessToken = makeAccessToken(user._id.toString(), user.role);

            const res = await request(app)
                .patch('/me')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    username: 'existinguser',
                });

            expect(res.status).toBe(409);
            expect(res.body.error.code).toBe('CONFLICT');
        });

        it('PATCH /me should reject updating to an existing email', async () => {
            await createTestUser({
                username: 'existingemailuser',
                email: 'existingemail@example.com',
            });

            const { user } = await createTestUser({
                username: 'changeemailuser',
                email: 'changeemailuser@example.com',
            });

            const accessToken = makeAccessToken(user._id.toString(), user.role);

            const res = await request(app)
                .patch('/me')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    email: 'existingemail@example.com',
                });

            expect(res.status).toBe(409);
            expect(res.body.error.code).toBe('CONFLICT');
        });

        it('PATCH /me should invalidate the old refresh cookie after password change', async () => {
            const registerRes = await request(app).post('/auth/register').send({
                username: 'pwrotate',
                displayName: 'PW Rotate',
                email: 'pwrotate@example.com',
                password: 'oldpassword123',
            });

            const cookie = getSetCookieHeader(registerRes);
            const accessToken = registerRes.body.accessToken as string;

            const patchRes = await request(app)
                .patch('/me')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    currentPassword: 'oldpassword123',
                    newPassword: 'newpassword123',
                });

            expect(patchRes.status).toBe(200);

            const refreshRes = await request(app).post('/auth/refresh').set('Cookie', cookie);

            expect(refreshRes.status).toBe(401);
            expect(refreshRes.body.error.code).toBe('UNAUTHORIZED');
        });

        it('DELETE /me should delete a normal user account', async () => {
            const { user } = await createTestUser({
                username: 'deleteme',
                email: 'deleteme@example.com',
                role: 'user',
            });

            const accessToken = makeAccessToken(user._id.toString(), user.role);

            const res = await request(app)
                .delete('/me')
                .set('Authorization', `Bearer ${accessToken}`);

            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Account deleted successfully');
        });

        it('DELETE /me should reject deleting the last remaining admin', async () => {
            const { user } = await createTestUser({
                username: 'soleadmin',
                email: 'soleadmin@example.com',
                role: 'admin',
            });

            const accessToken = makeAccessToken(user._id.toString(), user.role);

            const res = await request(app)
                .delete('/me')
                .set('Authorization', `Bearer ${accessToken}`);

            expect(res.status).toBe(403);
            expect(res.body.error.code).toBe('FORBIDDEN');
        });
    });

    describe('Internal auth flows', () => {
        it('POST /internal/auth/resolve should resolve a valid access token', async () => {
            const { user } = await createTestUser({
                username: 'internaluser',
                email: 'internal@example.com',
                role: 'user',
            });

            const accessToken = makeAccessToken(user._id.toString(), user.role);

            const res = await request(app)
                .post('/internal/auth/resolve')
                .set('X-Internal-Service-Token', process.env.INTERNAL_SERVICE_TOKEN!)
                .send({ accessToken });

            expect(res.status).toBe(200);
            expect(res.body.user.username).toBe('internaluser');
            expect(res.body.user.role).toBe('user');
        });

        it('POST /internal/auth/resolve should reject missing internal token', async () => {
            const { user } = await createTestUser({
                username: 'missingtoken',
                email: 'missingtoken@example.com',
            });

            const accessToken = makeAccessToken(user._id.toString(), user.role);

            const res = await request(app).post('/internal/auth/resolve').send({ accessToken });

            expect(res.status).toBe(403);
            expect(res.body.error.code).toBe('FORBIDDEN');
        });

        it('POST /internal/auth/resolve should reject invalid access token', async () => {
            const res = await request(app)
                .post('/internal/auth/resolve')
                .set('X-Internal-Service-Token', process.env.INTERNAL_SERVICE_TOKEN!)
                .send({ accessToken: 'not-a-real-token' });

            expect(res.status).toBe(401);
            expect(res.body.error.code).toBe('UNAUTHORIZED');
        });
    });

    describe('Admin flows', () => {
        it('GET /admin/home should allow admins', async () => {
            const { user } = await createTestUser({
                username: 'admin1',
                email: 'admin1@example.com',
                role: 'admin',
            });

            const accessToken = makeAccessToken(user._id.toString(), user.role);

            const res = await request(app)
                .get('/admin/home')
                .set('Authorization', `Bearer ${accessToken}`);

            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Admin home');
            expect(res.body.auth.userId).toBe(user._id.toString());
        });

        it('GET /admin/home should reject normal users', async () => {
            const { user } = await createTestUser({
                username: 'normal1',
                email: 'normal1@example.com',
                role: 'user',
            });

            const accessToken = makeAccessToken(user._id.toString(), user.role);

            const res = await request(app)
                .get('/admin/home')
                .set('Authorization', `Bearer ${accessToken}`);

            expect(res.status).toBe(403);
            expect(res.body.error.code).toBe('FORBIDDEN');
        });

        it('GET /admin/users should return paginated users', async () => {
            const { user: admin } = await createTestUser({
                username: 'admin6',
                email: 'admin6@example.com',
                role: 'admin',
            });

            await createTestUser({
                username: 'usera',
                email: 'usera@example.com',
                role: 'user',
            });

            await createTestUser({
                username: 'userb',
                email: 'userb@example.com',
                role: 'user',
            });

            const accessToken = makeAccessToken(admin._id.toString(), admin.role);

            const res = await request(app)
                .get('/admin/users?page=1&limit=10')
                .set('Authorization', `Bearer ${accessToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.users)).toBe(true);
            expect(res.body.pagination.page).toBe(1);
            expect(res.body.pagination.limit).toBe(10);
        });

        it('GET /admin/users should support search', async () => {
            const { user: admin } = await createTestUser({
                username: 'admin7',
                email: 'admin7@example.com',
                role: 'admin',
            });

            await createTestUser({
                username: 'searchtarget',
                displayName: 'Search Target',
                email: 'searchtarget@example.com',
                role: 'user',
            });

            await createTestUser({
                username: 'someoneelse',
                email: 'someoneelse@example.com',
                role: 'user',
            });

            const accessToken = makeAccessToken(admin._id.toString(), admin.role);

            const res = await request(app)
                .get('/admin/users?search=searchtarget')
                .set('Authorization', `Bearer ${accessToken}`);

            expect(res.status).toBe(200);
            expect(
                res.body.users.some((u: { username: string }) => u.username === 'searchtarget'),
            ).toBe(true);
        });

        it('GET /admin/users should reject invalid pagination query', async () => {
            const { user: admin } = await createTestUser({
                username: 'admin-bad-query',
                email: 'admin-bad-query@example.com',
                role: 'admin',
            });

            const accessToken = makeAccessToken(admin._id.toString(), admin.role);

            const res = await request(app)
                .get('/admin/users?page=0&limit=100')
                .set('Authorization', `Bearer ${accessToken}`);

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('BAD_REQUEST');
        });

        it('POST /admin/promote should promote a normal user to admin', async () => {
            const { user: admin } = await createTestUser({
                username: 'admin2',
                email: 'admin2@example.com',
                role: 'admin',
            });

            await createTestUser({
                username: 'targetuser',
                email: 'targetuser@example.com',
                role: 'user',
            });

            const accessToken = makeAccessToken(admin._id.toString(), admin.role);

            const res = await request(app)
                .post('/admin/promote')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ username: 'targetuser' });

            expect(res.status).toBe(200);
            expect(res.body.message).toBe('User promoted to admin');
            expect(res.body.user.username).toBe('targetuser');
            expect(res.body.user.role).toBe('admin');
        });

        it('POST /admin/promote should reject invalid body', async () => {
            const { user: admin } = await createTestUser({
                username: 'admin-invalid-promote',
                email: 'admin-invalid-promote@example.com',
                role: 'admin',
            });

            const accessToken = makeAccessToken(admin._id.toString(), admin.role);

            const res = await request(app)
                .post('/admin/promote')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ username: '' });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('BAD_REQUEST');
        });

        it('POST /admin/promote should reject promoting an existing admin', async () => {
            const { user: admin } = await createTestUser({
                username: 'admin3',
                email: 'admin3@example.com',
                role: 'admin',
            });

            await createTestUser({
                username: 'alreadyadmin',
                email: 'alreadyadmin@example.com',
                role: 'admin',
            });

            const accessToken = makeAccessToken(admin._id.toString(), admin.role);

            const res = await request(app)
                .post('/admin/promote')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ username: 'alreadyadmin' });

            expect(res.status).toBe(409);
            expect(res.body.error.code).toBe('CONFLICT');
        });

        it('POST /admin/promote should return not found for nonexistent user', async () => {
            const { user: admin } = await createTestUser({
                username: 'admin-promote-missing',
                email: 'admin-promote-missing@example.com',
                role: 'admin',
            });

            const accessToken = makeAccessToken(admin._id.toString(), admin.role);

            const res = await request(app)
                .post('/admin/promote')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ username: 'doesnotexist' });

            expect(res.status).toBe(404);
            expect(res.body.error.code).toBe('NOT_FOUND');
        });

        it('POST /admin/demote should demote another admin when at least one admin remains', async () => {
            const { user: admin1 } = await createTestUser({
                username: 'admin4',
                email: 'admin4@example.com',
                role: 'admin',
            });

            await createTestUser({
                username: 'admin5',
                email: 'admin5@example.com',
                role: 'admin',
            });

            const accessToken = makeAccessToken(admin1._id.toString(), admin1.role);

            const res = await request(app)
                .post('/admin/demote')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ username: 'admin5' });

            expect(res.status).toBe(200);
            expect(res.body.message).toBe('User demoted to normal user');
            expect(res.body.user.role).toBe('user');
        });

        it('POST /admin/demote should reject self-demotion', async () => {
            const { user: admin } = await createTestUser({
                username: 'selfdemote',
                email: 'selfdemote@example.com',
                role: 'admin',
            });

            await createTestUser({
                username: 'otheradmin',
                email: 'otheradmin@example.com',
                role: 'admin',
            });

            const accessToken = makeAccessToken(admin._id.toString(), admin.role);

            const res = await request(app)
                .post('/admin/demote')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ username: 'selfdemote' });

            expect(res.status).toBe(403);
            expect(res.body.error.code).toBe('FORBIDDEN');
        });

        it('POST /admin/demote should return not found for nonexistent user', async () => {
            const { user: admin } = await createTestUser({
                username: 'admin-demote-missing',
                email: 'admin-demote-missing@example.com',
                role: 'admin',
            });

            await createTestUser({
                username: 'backupadmin2',
                email: 'backupadmin2@example.com',
                role: 'admin',
            });

            const accessToken = makeAccessToken(admin._id.toString(), admin.role);

            const res = await request(app)
                .post('/admin/demote')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ username: 'doesnotexist' });

            expect(res.status).toBe(404);
            expect(res.body.error.code).toBe('NOT_FOUND');
        });

        it('DELETE /admin/users/:username should delete a normal user', async () => {
            const { user: admin } = await createTestUser({
                username: 'admin8',
                email: 'admin8@example.com',
                role: 'admin',
            });

            await createTestUser({
                username: 'deletetarget',
                email: 'deletetarget@example.com',
                role: 'user',
            });

            const accessToken = makeAccessToken(admin._id.toString(), admin.role);

            const res = await request(app)
                .delete('/admin/users/deletetarget')
                .set('Authorization', `Bearer ${accessToken}`);

            expect(res.status).toBe(200);
            expect(res.body.message).toContain('deletetarget');
        });

        it('DELETE /admin/users/:username should reject self-deletion', async () => {
            const { user: admin } = await createTestUser({
                username: 'selfdeleteadmin',
                email: 'selfdeleteadmin@example.com',
                role: 'admin',
            });

            await createTestUser({
                username: 'backupadmin',
                email: 'backupadmin@example.com',
                role: 'admin',
            });

            const accessToken = makeAccessToken(admin._id.toString(), admin.role);

            const res = await request(app)
                .delete('/admin/users/selfdeleteadmin')
                .set('Authorization', `Bearer ${accessToken}`);

            expect(res.status).toBe(403);
            expect(res.body.error.code).toBe('FORBIDDEN');
        });

        it('DELETE /admin/users/:username should return not found for nonexistent user', async () => {
            const { user: admin } = await createTestUser({
                username: 'admin-delete-missing',
                email: 'admin-delete-missing@example.com',
                role: 'admin',
            });

            const accessToken = makeAccessToken(admin._id.toString(), admin.role);

            const res = await request(app)
                .delete('/admin/users/doesnotexist')
                .set('Authorization', `Bearer ${accessToken}`);

            expect(res.status).toBe(404);
            expect(res.body.error.code).toBe('NOT_FOUND');
        });
    });

    it('POST /admin/promote should invalidate the target user refresh cookie', async () => {
        const { user: admin } = await createTestUser({
            username: 'promoteadmin',
            email: 'promoteadmin@example.com',
            role: 'admin',
        });

        const registerRes = await request(app).post('/auth/register').send({
            username: 'promotetarget',
            displayName: 'Promote Target',
            email: 'promotetarget@example.com',
            password: 'password123',
        });

        const targetCookie = getSetCookieHeader(registerRes);
        const adminAccessToken = makeAccessToken(admin._id.toString(), admin.role);

        const promoteRes = await request(app)
            .post('/admin/promote')
            .set('Authorization', `Bearer ${adminAccessToken}`)
            .send({ username: 'promotetarget' });

        expect(promoteRes.status).toBe(200);
        expect(promoteRes.body.user.role).toBe('admin');

        const refreshRes = await request(app).post('/auth/refresh').set('Cookie', targetCookie);

        expect(refreshRes.status).toBe(401);
        expect(refreshRes.body.error.code).toBe('UNAUTHORIZED');
    });

    it('POST /admin/demote should invalidate the target admin refresh cookie', async () => {
        const { user: actor } = await createTestUser({
            username: 'demoteactor',
            email: 'demoteactor@example.com',
            role: 'admin',
        });

        const registerRes = await request(app).post('/auth/register').send({
            username: 'demotetarget',
            displayName: 'Demote Target',
            email: 'demotetarget@example.com',
            password: 'password123',
        });

        const actorAccessToken = makeAccessToken(actor._id.toString(), actor.role);

        const promoteRes = await request(app)
            .post('/admin/promote')
            .set('Authorization', `Bearer ${actorAccessToken}`)
            .send({ username: 'demotetarget' });

        expect(promoteRes.status).toBe(200);
        expect(promoteRes.body.user.role).toBe('admin');

        const targetCookie = getSetCookieHeader(registerRes);

        const demoteRes = await request(app)
            .post('/admin/demote')
            .set('Authorization', `Bearer ${actorAccessToken}`)
            .send({ username: 'demotetarget' });

        expect(demoteRes.status).toBe(200);
        expect(demoteRes.body.user.role).toBe('user');

        const refreshRes = await request(app).post('/auth/refresh').set('Cookie', targetCookie);

        expect(refreshRes.status).toBe(401);
        expect(refreshRes.body.error.code).toBe('UNAUTHORIZED');
    });

    it('POST /admin/demote should make the target old admin access token fail on admin routes', async () => {
        const { user: actor } = await createTestUser({
            username: 'dbcheckactor',
            email: 'dbcheckactor@example.com',
            role: 'admin',
        });

        const registerRes = await request(app).post('/auth/register').send({
            username: 'dbchecktarget',
            displayName: 'DB Check Target',
            email: 'dbchecktarget@example.com',
            password: 'password123',
        });

        const actorAccessToken = makeAccessToken(actor._id.toString(), actor.role);

        const promoteRes = await request(app)
            .post('/admin/promote')
            .set('Authorization', `Bearer ${actorAccessToken}`)
            .send({ username: 'dbchecktarget' });

        expect(promoteRes.status).toBe(200);

        const targetId = promoteRes.body.user.id as string;
        const staleAdminToken = makeAccessToken(targetId, 'admin');

        const demoteRes = await request(app)
            .post('/admin/demote')
            .set('Authorization', `Bearer ${actorAccessToken}`)
            .send({ username: 'dbchecktarget' });

        expect(demoteRes.status).toBe(200);

        const adminHomeRes = await request(app)
            .get('/admin/home')
            .set('Authorization', `Bearer ${staleAdminToken}`);

        expect(adminHomeRes.status).toBe(403);
        expect(adminHomeRes.body.error.code).toBe('FORBIDDEN');
    });
});
