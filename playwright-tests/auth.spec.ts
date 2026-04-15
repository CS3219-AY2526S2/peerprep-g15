import { expect, test } from '@playwright/test';
import { adminLoginResponse, sampleQuestions, adminUsers, userLoginResponse } from './fixtures';

test.describe('Authentication flows', () => {
    test('signs a new user up and returns to the login page', async ({ page }) => {
        await page.route('**/auth/register', async (route) => {
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

    test('logs in a normal user and opens the user home page', async ({ page }) => {
        await page.route('**/auth/login', async (route) => {
            expect(route.request().method()).toBe('POST');
            const payload = JSON.parse(route.request().postData() ?? '{}');
            expect(payload).toEqual({ identifier: 'user@example.com', password: 'password123' });

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(userLoginResponse),
            });
        });

        await page.route('**/questions**', async (route) => {
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

        await page.route('**/admin/users**', async (route) => {
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
        await page.route('**/auth/login', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(adminLoginResponse),
            });
        });

        await page.route('**/questions**', async (route) => {
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

        await page.route('**/admin/users**', async (route) => {
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
});
