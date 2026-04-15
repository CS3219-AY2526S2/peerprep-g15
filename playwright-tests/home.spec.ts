import { expect, test } from '@playwright/test';
import { sampleQuestions, seedLocalStorage } from './fixtures';

test.describe('Home and matching flows', () => {
    test.beforeEach(async ({ page }) => {
        await seedLocalStorage(page, {
            accessToken: 'access-token-user',
            userId: 'u-user',
            name: 'Shane',
        });
    });

    test('shows a validation message when trying to match without selecting difficulty and category', async ({
        page,
    }) => {
        await page.route('http://localhost:3002/questions**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(sampleQuestions),
            });
        });

        let joinCalled = false;
        await page.route('http://localhost:3003/matching/join', async (route) => {
            joinCalled = true;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({}),
            });
        });

        await page.goto('/home');
        await page.getByRole('button', { name: 'Find Match' }).click();

        await expect(
            page.getByText('Please choose both a category and difficulty first.'),
        ).toBeVisible();

        expect(joinCalled).toBe(false);
    });

    test('filters questions and can queue then cancel matching', async ({ page }) => {
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

        let joinCalls = 0;
        await page.route('http://localhost:3003/matching/join', async (route) => {
            joinCalls += 1;
            expect(route.request().method()).toBe('POST');
            const payload = JSON.parse(route.request().postData() ?? '{}');
            expect(payload).toMatchObject({
                userId: 'u-user',
                topic: 'Array',
                difficulty: 'easy',
            });

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    message: 'Queued successfully',
                    entry: { userId: 'u-user' },
                }),
            });
        });

        await page.route('http://localhost:3003/matching/status/**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ state: 'queued' }),
            });
        });

        await page.route('http://localhost:3003/matching/leave', async (route) => {
            expect(route.request().method()).toBe('POST');
            const payload = JSON.parse(route.request().postData() ?? '{}');
            expect(payload).toEqual({ userId: 'u-user' });

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Left queue' }),
            });
        });

        await page.goto('/home');
        await expect(page.getByText('Welcome, Shane!')).toBeVisible();
        await expect(page.getByText('Array Sum')).toBeVisible();
        await expect(page.getByText('Linked List Basics')).toBeVisible();

        await page.getByLabel('Difficulty').selectOption('Easy');
        await page.getByLabel('Category').selectOption('Array');
        await page.getByRole('button', { name: 'Find Match' }).click();

        await expect(page.getByText('Waiting for another user to join...')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
        await expect(page.getByText('Array Sum')).toBeVisible();
        await expect(page.getByText('Linked List Basics')).toHaveCount(0);

        await page.getByRole('button', { name: 'Cancel' }).click();
        await expect(page.getByText('Matching cancelled.')).toBeVisible();
        expect(joinCalls).toBe(1);
    });

    test('navigates straight to a collaboration room when a match is found', async ({ page }) => {
        await page.route('http://localhost:3002/questions**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(sampleQuestions),
            });
        });

        await page.route('http://localhost:3003/matching/join', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    match: {
                        matchId: 'room-123',
                        userIds: ['u-user', 'u-partner'],
                        question: { questionId: 103 },
                    },
                }),
            });
        });

        await page.goto('/home');
        await page.getByLabel('Difficulty').selectOption('Hard');
        await page.getByLabel('Category').selectOption('Graph');
        await page.getByRole('button', { name: 'Find Match' }).click();

        await expect(page).toHaveURL('/collab/room-123');
    });

    test('shows a timeout message when no match is found in time', async ({ page }) => {
        await page.route('http://localhost:3002/questions**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(sampleQuestions),
            });
        });

        let statusCalls = 0;

        await page.route('http://localhost:3003/matching/join', async (route) => {
            expect(route.request().method()).toBe('POST');
            const payload = JSON.parse(route.request().postData() ?? '{}');
            expect(payload).toMatchObject({
                userId: 'u-user',
                topic: 'Array',
                difficulty: 'easy',
            });

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    message: 'Queued successfully',
                    entry: { userId: 'u-user' },
                }),
            });
        });

        await page.route('http://localhost:3003/matching/status/**', async (route) => {
            statusCalls += 1;

            const body = statusCalls < 2 ? { state: 'queued' } : { state: 'timed_out' };

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(body),
            });
        });

        await page.goto('/home');
        await page.getByLabel('Difficulty').selectOption('Easy');
        await page.getByLabel('Category').selectOption('Array');
        await page.getByRole('button', { name: 'Find Match' }).click();

        await expect(page.getByText('Waiting for another user to join...')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();

        await expect(page.getByText('Matching timed out. Please try again.')).toBeVisible({
            timeout: 10000,
        });

        await expect(page.getByRole('button', { name: 'Find Match' })).toBeVisible();
    });

    test('shows a queue not found message when the queue entry disappears', async ({ page }) => {
        await page.route('http://localhost:3002/questions**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(sampleQuestions),
            });
        });

        let statusCalls = 0;

        await page.route('http://localhost:3003/matching/join', async (route) => {
            expect(route.request().method()).toBe('POST');
            const payload = JSON.parse(route.request().postData() ?? '{}');
            expect(payload).toMatchObject({
                userId: 'u-user',
                topic: 'Array',
                difficulty: 'easy',
            });

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    message: 'Queued successfully',
                    entry: { userId: 'u-user' },
                }),
            });
        });

        await page.route('http://localhost:3003/matching/status/**', async (route) => {
            statusCalls += 1;

            const body = statusCalls < 2 ? { state: 'queued' } : { state: 'not_found' };

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(body),
            });
        });

        await page.goto('/home');
        await page.getByLabel('Difficulty').selectOption('Easy');
        await page.getByLabel('Category').selectOption('Array');
        await page.getByRole('button', { name: 'Find Match' }).click();

        await expect(page.getByText('Waiting for another user to join...')).toBeVisible();

        await expect(page.getByText('Queue entry not found or cancelled.')).toBeVisible({
            timeout: 10000,
        });

        await expect(page.getByRole('button', { name: 'Find Match' })).toBeVisible();
    });

    test('shows an error when starting matching fails', async ({ page }) => {
        await page.route('http://localhost:3002/questions**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(sampleQuestions),
            });
        });

        await page.route('http://localhost:3003/matching/join', async (route) => {
            expect(route.request().method()).toBe('POST');
            const payload = JSON.parse(route.request().postData() ?? '{}');
            expect(payload).toMatchObject({
                userId: 'u-user',
                topic: 'Array',
                difficulty: 'easy',
            });

            await route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({
                    message: 'Failed to start matching.',
                }),
            });
        });

        await page.goto('/home');
        await page.getByLabel('Difficulty').selectOption('Easy');
        await page.getByLabel('Category').selectOption('Array');
        await page.getByRole('button', { name: 'Find Match' }).click();

        await expect(page.getByText('Failed to start matching.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Find Match' })).toBeVisible();
    });
});
