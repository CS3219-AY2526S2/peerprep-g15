import { expect, test } from '@playwright/test';
import { adminLoginResponse, sampleQuestions, adminUsers, userLoginResponse } from './fixtures';

test.describe('Authentication flows', () => {
    test('signs a new user up and returns to the login page', async ({ page }) => {
        await page.route('http://localhost:3001/auth/register', async (route) => {
            expect(route.request().method()).toBe('POST');
            const payload = JSON.parse(route.request().postData() ?? '{}');
            expect(payload).toEqual({
                username: 'shane',
                displayName: 'Shane',
                email: 'shane@example.com',
                password: 'secret123',
            });

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    accessToken: 'registered-token',
                    user: { id: 'u-new', displayName: 'Shane', role: 'user' },
                }),
            });
        });

        await page.goto('/signup');
        await page.getByLabel('Username').fill('shane');
        await page.getByLabel('Display Name').fill('Shane');
        await page.getByLabel('Email').fill('shane@example.com');
        await page.getByLabel('Password').fill('secret123');
        await page.getByRole('button', { name: 'Sign Up' }).click();

        await expect(page).toHaveURL('/');
        await expect(page.getByLabel('Email address')).toBeVisible();
        await expect
            .poll(() => page.evaluate(() => localStorage.getItem('accessToken')))
            .toBe('registered-token');
    });

    test('shows an error when signup fails and stays on the signup page', async ({ page }) => {
        await page.route('http://localhost:3001/auth/register', async (route) => {
            expect(route.request().method()).toBe('POST');

            await route.fulfill({
                status: 400,
                contentType: 'application/json',
                body: JSON.stringify({
                    message: 'Registration failed. Please try again.',
                }),
            });
        });

        await page.goto('/signup');
        await page.getByLabel('Username').fill('shane');
        await page.getByLabel('Display Name').fill('Shane');
        await page.getByLabel('Email').fill('shane@example.com');
        await page.getByLabel('Password').fill('secret123');
        await page.getByRole('button', { name: 'Sign Up' }).click();

        await expect(page).toHaveURL('/signup');
        await expect(page.getByText('Registration failed. Please try again.')).toBeVisible();
    });

    test('shows a backend validation message when signup fails with a specific error', async ({
        page,
    }) => {
        await page.route('http://localhost:3001/auth/register', async (route) => {
            await route.fulfill({
                status: 409,
                contentType: 'application/json',
                body: JSON.stringify({
                    message: 'Email already in use.',
                }),
            });
        });

        await page.goto('/signup');
        await page.getByLabel('Username').fill('shane');
        await page.getByLabel('Display Name').fill('Shane');
        await page.getByLabel('Email').fill('shane@example.com');
        await page.getByLabel('Password').fill('secret123');
        await page.getByRole('button', { name: 'Sign Up' }).click();

        await expect(page).toHaveURL('/signup');
        await expect(page.getByText('Email already in use.')).toBeVisible();
    });

    test('logs in a normal user and opens the user home page', async ({ page }) => {
        await page.route('http://localhost:3001/auth/login', async (route) => {
            expect(route.request().method()).toBe('POST');
            const payload = JSON.parse(route.request().postData() ?? '{}');
            expect(payload).toEqual({ identifier: 'user@example.com', password: 'password123' });

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(userLoginResponse),
            });
        });

        await page.route('http://localhost:3002/questions**', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(sampleQuestions),
                });
                return;
            }
            await route.fallback();
        });

        await page.route('http://localhost:3001/admin/users**', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ users: adminUsers }),
                });
                return;
            }
            await route.fallback();
        });

        await page.goto('/');
        await page.getByLabel('Email address').fill('user@example.com');
        await page.getByLabel('Password').fill('password123');
        await page.getByRole('button', { name: 'Enter Workspace' }).click();

        await expect(page).toHaveURL('/home');
        await expect(page.getByText('Welcome, Shane!')).toBeVisible();
        await expect.poll(() => page.evaluate(() => localStorage.getItem('userId'))).toBe('u-user');
        await expect.poll(() => page.evaluate(() => localStorage.getItem('name'))).toBe('Shane');
    });

    test('logs in an admin user and opens the admin dashboard', async ({ page }) => {
        await page.route('http://localhost:3001/auth/login', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(adminLoginResponse),
            });
        });

        await page.route('http://localhost:3002/questions**', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(sampleQuestions),
                });
                return;
            }
            await route.fallback();
        });

        await page.route('http://localhost:3001/admin/users**', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ users: adminUsers }),
                });
                return;
            }
            await route.fallback();
        });

        await page.goto('/');
        await page.getByLabel('Email address').fill('admin@example.com');
        await page.getByLabel('Password').fill('adminpass');
        await page.getByRole('button', { name: 'Enter Workspace' }).click();

        await expect(page).toHaveURL('/admin/home');
        await expect(page.getByText('Admin Dashboard')).toBeVisible();
        await expect
            .poll(() => page.evaluate(() => localStorage.getItem('name')))
            .toBe('Admin Annie');
    });

    test('shows an error for invalid login and stays on the login page', async ({ page }) => {
        await page.route('http://localhost:3001/auth/login', async (route) => {
            expect(route.request().method()).toBe('POST');
            const payload = JSON.parse(route.request().postData() ?? '{}');
            expect(payload).toEqual({ identifier: 'user@example.com', password: 'wrongpass' });

            await route.fulfill({
                status: 401,
                contentType: 'application/json',
                body: JSON.stringify({
                    message: 'Login failed. Please try again.',
                }),
            });
        });

        await page.goto('/');
        await page.getByLabel('Email address').fill('user@example.com');
        await page.getByLabel('Password').fill('wrongpass');
        await page.getByRole('button', { name: 'Enter Workspace' }).click();

        await expect(page).toHaveURL('/');
        await expect(page.getByText('Login failed. Please try again.')).toBeVisible();
    });
    test('logs out a signed-in user and returns to the login page', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('accessToken', 'access-token-user');
            localStorage.setItem('userId', 'u-user');
            localStorage.setItem('name', 'Shane');
        });

        await page.route('http://localhost:3002/questions**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(sampleQuestions),
            });
        });

        await page.goto('/home');
        await expect(page.getByText('Welcome, Shane!')).toBeVisible();

        await page.getByRole('button', { name: 'Shane' }).click();
        await page.getByRole('button', { name: 'Logout' }).click();

        await expect(page).toHaveURL('/');
        await expect(page.getByLabel('Email address')).toBeVisible();
        await expect
            .poll(() => page.evaluate(() => localStorage.getItem('accessToken')))
            .toBe(null);
    });
});
