import { expect, test } from '@playwright/test';
import { adminUsers, sampleQuestions, seedLocalStorage } from './fixtures';

test.describe('Admin flows', () => {
    test.beforeEach(async ({ page }) => {
        await seedLocalStorage(page, {
            accessToken: 'access-token-admin',
            userId: 'u-admin',
            name: 'Admin Annie',
        });
    });

    test('loads the admin dashboard with recent questions and users', async ({ page }) => {
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
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ users: adminUsers }),
            });
        });

        await page.goto('/admin/home');
        await expect(page.getByText('Admin Dashboard')).toBeVisible();
        await expect(page.getByText('Total Questions')).toBeVisible();
        await expect(page.getByText('Total Users')).toBeVisible();
        await expect(page.getByText('Array Sum')).toBeVisible();
        await expect(page.getByText('alice@example.com')).toBeVisible();
    });

    test('searches, adds, edits, and deletes questions', async ({ page }) => {
        const questions: any[] = [...sampleQuestions];

        await page.route('http://localhost:3002/questions**', async (route) => {
            const url = new URL(route.request().url());
            const method = route.request().method();

            if (method === 'GET' && url.pathname === '/questions') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(questions),
                });
                return;
            }

            if (method === 'GET' && url.pathname === '/questions/101') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(questions[0]),
                });
                return;
            }

            if (method === 'POST' && url.pathname === '/questions') {
                const payload = JSON.parse(route.request().postData() ?? '{}');
                expect(payload).toMatchObject({
                    questionId: 1,
                    title: 'Binary Search',
                    difficulty: 'Medium',
                    sourceUrl: 'https://example.com/binary-search',
                });

                questions.push({
                    questionId: payload.questionId,
                    title: payload.title,
                    description: payload.description,
                    categories: payload.categories,
                    difficulty: payload.difficulty,
                    sourceUrl: payload.sourceUrl,
                    testCases: [],
                    supportedLanguages: ['python'],
                });

                await route.fulfill({
                    status: 201,
                    contentType: 'application/json',
                    body: JSON.stringify({ message: 'created' }),
                });
                return;
            }

            if (method === 'PUT' && url.pathname === '/questions/101') {
                const payload = JSON.parse(route.request().postData() ?? '{}');
                expect(payload).toMatchObject({
                    questionId: 101,
                    title: 'Array Sum Updated',
                    difficulty: 'Easy',
                });

                questions[0] = {
                    ...questions[0],
                    title: payload.title,
                    description: payload.description,
                    categories: payload.categories,
                    difficulty: payload.difficulty,
                    sourceUrl: payload.sourceUrl,
                } as (typeof questions)[number];

                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ message: 'updated' }),
                });
                return;
            }

            if (method === 'DELETE' && url.pathname === '/questions/102') {
                expect(route.request().headers().authorization).toBe('Bearer access-token-admin');
                questions.splice(1, 1);

                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ message: 'deleted' }),
                });
                return;
            }

            await route.fallback();
        });

        await page.goto('/admin/questions');
        await expect(page.getByRole('heading', { name: 'Questions' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Add Question' })).toBeVisible();

        await page.locator('#difficulty').selectOption('Hard');
        await page.locator('#category').selectOption('Graph');
        await page.getByRole('button', { name: 'Search' }).click();
        await expect(page.getByText('Graph Paths')).toBeVisible();
        await expect(page.getByText('Array Sum')).toHaveCount(0);

        await page.getByRole('button', { name: 'Add Question' }).click();
        await expect(page).toHaveURL('/admin/questions/add-question');
        await expect(page.getByRole('heading', { name: 'Add Question' })).toBeVisible();
        await expect(page.getByLabel('Question ID')).not.toHaveValue('');

        await page.getByLabel('Title').fill('Binary Search');
        await page.getByLabel('Description').fill('Find an element in a sorted array.');
        await page.getByLabel('Categories').fill('Array, Search');
        await page.getByLabel('Difficulty').selectOption('Medium');
        await page.getByLabel('Source URL').fill('https://example.com/binary-search');
        await page.getByRole('button', { name: 'Add Question' }).click();
        await expect(page).toHaveURL('/admin/questions');
        await expect(page.getByText('Binary Search')).toBeVisible();

        await page.getByRole('button', { name: 'Edit' }).first().click();
        await expect(page).toHaveURL('/admin/questions/edit-question/101');
        await expect(page.getByRole('heading', { name: 'Edit Question' })).toBeVisible();

        await page.getByLabel('Title').fill('Array Sum Updated');
        await page.getByRole('button', { name: 'Update Question' }).click();
        await expect(page).toHaveURL('/admin/questions');
        await expect(page.getByText('Array Sum Updated')).toBeVisible();

        page.once('dialog', (dialog) => dialog.accept());
        await page.getByRole('button', { name: 'Delete' }).nth(1).click();
        await expect(page.getByText('Linked List Basics')).toHaveCount(0);
    });

    test('shows an empty state when question filters return no results', async ({ page }) => {
        const questions: any[] = [...sampleQuestions];

        await page.route('http://localhost:3002/questions**', async (route) => {
            const url = new URL(route.request().url());
            const method = route.request().method();

            if (method === 'GET' && url.pathname === '/questions') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(questions),
                });
                return;
            }

            await route.fallback();
        });

        await page.goto('/admin/questions');
        await expect(page.getByRole('heading', { name: 'Questions' })).toBeVisible();

        await page.locator('#difficulty').selectOption('Easy');
        await page.locator('#category').selectOption('Graph');
        await page.getByRole('button', { name: 'Search' }).click();

        await expect(page.getByText('No questions found.')).toBeVisible();
    });

    test('shows an error when adding a question fails', async ({ page }) => {
        const questions: any[] = [...sampleQuestions];

        await page.route('http://localhost:3002/questions**', async (route) => {
            const url = new URL(route.request().url());
            const method = route.request().method();

            if (method === 'GET' && url.pathname === '/questions') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(questions),
                });
                return;
            }

            if (method === 'POST' && url.pathname === '/questions') {
                await route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        message: 'Failed to add question.',
                    }),
                });
                return;
            }

            await route.fallback();
        });

        await page.goto('/admin/questions/add-question');
        await expect(page.getByRole('heading', { name: 'Add Question' })).toBeVisible();

        await expect(page.getByLabel('Question ID')).not.toHaveValue('');
        await page.getByLabel('Title').fill('Binary Search');
        await page.getByLabel('Description').fill('Find an element in a sorted array.');
        await page.getByLabel('Categories').fill('Array, Search');
        await page.getByLabel('Difficulty').selectOption('Medium');
        await page.getByLabel('Source URL').fill('https://example.com/binary-search');
        await page.getByRole('button', { name: 'Add Question' }).click();

        await expect(page).toHaveURL('/admin/questions/add-question');
        await expect(page.getByText('Failed to add question.')).toBeVisible();
    });

    test('shows an error when editing a question fails', async ({ page }) => {
        const questions: any[] = [...sampleQuestions];

        await page.route('http://localhost:3002/questions**', async (route) => {
            const url = new URL(route.request().url());
            const method = route.request().method();

            if (method === 'GET' && url.pathname === '/questions/101') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(questions[0]),
                });
                return;
            }

            if (method === 'PUT' && url.pathname === '/questions/101') {
                await route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        message: 'Failed to update question.',
                    }),
                });
                return;
            }

            await route.fallback();
        });

        await page.goto('/admin/questions/edit-question/101');
        await expect(page.getByRole('heading', { name: 'Edit Question' })).toBeVisible();

        await page.getByLabel('Title').fill('Array Sum Updated');
        await page.getByRole('button', { name: 'Update Question' }).click();

        await expect(page).toHaveURL('/admin/questions/edit-question/101');
        await expect(page.getByText('Failed to update question.')).toBeVisible();
    });

    test('searches users and applies role actions', async ({ page }) => {
        const users: Array<{
            id: string;
            username: string;
            displayName: string;
            email: string;
            role: string;
            updatedAt: string;
        }> = adminUsers.map((u) => ({ ...u }));

        await page.route('http://localhost:3001/admin/**', async (route) => {
            const method = route.request().method();
            const url = new URL(route.request().url());

            if (method === 'GET' && url.pathname === '/admin/users') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ users }),
                });
                return;
            }

            if (method === 'POST' && url.pathname === '/admin/promote') {
                const payload = JSON.parse(route.request().postData() ?? '{}');
                expect(payload).toEqual({ username: 'alice' });

                const target = users.find((u) => u.username === 'alice');
                if (target) target.role = 'admin';

                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ message: 'promoted' }),
                });
                return;
            }

            if (method === 'POST' && url.pathname === '/admin/demote') {
                const payload = JSON.parse(route.request().postData() ?? '{}');
                expect(payload).toEqual({ username: 'alice' });

                const target = users.find((u) => u.username === 'alice');
                if (target) target.role = 'user';

                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ message: 'demoted' }),
                });
                return;
            }

            if (method === 'DELETE' && url.pathname === '/admin/users/alice') {
                expect(route.request().headers().authorization).toBe('Bearer access-token-admin');

                const index = users.findIndex((u) => u.username === 'alice');
                if (index !== -1) users.splice(index, 1);

                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ message: 'deleted' }),
                });
                return;
            }

            await route.fallback();
        });

        await page.goto('/admin/users');
        await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
        await expect(page.getByText('alice@example.com')).toBeVisible();

        await page.getByPlaceholder('Username').fill('alice');
        await page.getByRole('combobox', { name: 'Role' }).selectOption('user');
        await page.getByRole('button', { name: 'Search' }).click();

        await expect(page.getByText('alice@example.com')).toBeVisible();
        await expect(page.getByText('bob@example.com')).toHaveCount(0);

        page.once('dialog', (dialog) => dialog.accept());
        await page.getByRole('button', { name: 'Promote' }).click();

        await expect(page.locator('tbody tr').filter({ hasText: 'alice@example.com' })).toHaveCount(
            0,
        );

        await page.getByRole('combobox', { name: 'Role' }).selectOption('admin');
        await page.getByRole('button', { name: 'Search' }).click();

        const aliceAdminRow = page.locator('tbody tr').filter({ hasText: 'alice@example.com' });
        await expect(aliceAdminRow).toContainText('admin');

        page.once('dialog', (dialog) => dialog.accept());
        await page.getByRole('button', { name: 'Demote' }).click();

        await expect(page.locator('tbody tr').filter({ hasText: 'alice@example.com' })).toHaveCount(
            0,
        );

        await page.getByRole('combobox', { name: 'Role' }).selectOption('user');
        await page.getByRole('button', { name: 'Search' }).click();

        const aliceUserRow = page.locator('tbody tr').filter({ hasText: 'alice@example.com' });
        await expect(aliceUserRow).toContainText('user');

        page.once('dialog', (dialog) => dialog.accept());
        await page.getByRole('button', { name: 'Delete' }).click();
        await expect(page.locator('tbody tr').filter({ hasText: 'alice@example.com' })).toHaveCount(
            0,
        );
    });

    test('shows an empty state when user filters return no results', async ({ page }) => {
        const users = adminUsers.map((u) => ({ ...u }));

        await page.route('http://localhost:3001/admin/**', async (route) => {
            const method = route.request().method();
            const url = new URL(route.request().url());

            if (method === 'GET' && url.pathname === '/admin/users') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ users }),
                });
                return;
            }

            await route.fallback();
        });

        await page.goto('/admin/users');
        await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();

        await page.getByPlaceholder('Username').fill('charlie');
        await page.getByRole('combobox', { name: 'Role' }).selectOption('user');
        await page.getByRole('button', { name: 'Search' }).click();

        await expect(page.getByText('No users found.')).toBeVisible();
    });
});
