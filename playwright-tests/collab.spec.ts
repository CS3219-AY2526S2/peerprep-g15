import { expect, test } from '@playwright/test';
import { seedLocalStorage } from './fixtures';

test.describe('Collaboration shell', () => {
    test.beforeEach(async ({ page }) => {
        await seedLocalStorage(page, {
            accessToken: 'access-token-user',
            userId: 'u-user',
            name: 'Shane',
        });
    });

    test('renders the waiting room state for a fresh room', async ({ page }) => {
        await page.goto('/collab/room-abc');
        await expect(page.getByText('Select Language')).toBeVisible();
        await expect(page.getByText('Waiting for partner to join...')).toBeVisible();
        await expect(page.getByText('Chat')).toBeVisible();
    });

    test('renders the partner joined lock-in state', async ({ page }) => {
        await page.goto('/collab/room-abc?testPartnerJoined=1');
        await expect(page.getByText('Select Language')).toBeVisible();
        await expect(page.getByText('Both users must agree on a language')).toBeVisible();
        await expect(page.locator('.badge.bg-warning')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Python' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'JavaScript' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Lock In' })).toBeVisible();
        await expect(page.getByText('Chat')).toBeVisible();
    });

    test('shows the partner locked-in message while waiting for the current user to lock in', async ({
        page,
    }) => {
        await page.goto('/collab/room-abc?testPartnerJoined=1&testPartnerLockedIn=1');
        await expect(page.getByText('Select Language')).toBeVisible();
        await expect(page.getByText('Both users must agree on a language')).toBeVisible();
        await expect(page.getByText('Your partner has locked in!')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Lock In' })).toBeVisible();
    });

    test('shows the locked-in waiting state for the current user', async ({ page }) => {
        await page.goto('/collab/room-abc?testPartnerJoined=1&testLanguage=python&testLockedIn=1');
        await expect(page.getByText('Select Language')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Locked In!' })).toBeVisible();
        await expect(page.getByText('Waiting for partner to lock in...')).toBeVisible();
    });

    test('renders the active collaboration session shell for Python', async ({ page }) => {
        await page.goto(
            '/collab/room-abc?testStatus=active&testLanguage=python&testPartnerName=Alex',
        );
        await expect(page.getByText('Active')).toBeVisible();
        await expect(page.getByText('PYTHON')).toBeVisible();
        await expect(page.getByText('Partner: Alex')).toBeVisible();
        await expect(page.getByText('Chat')).toBeVisible();
    });

    test('renders the active collaboration session shell for JavaScript', async ({ page }) => {
        await page.goto(
            '/collab/room-abc?testStatus=active&testLanguage=javascript&testPartnerName=Riley',
        );
        await expect(page.getByText('Active')).toBeVisible();
        await expect(page.getByText('JAVASCRIPT')).toBeVisible();
        await expect(page.getByText('Partner: Riley')).toBeVisible();
        await expect(page.getByText('Chat')).toBeVisible();
    });

    test('renders the language mismatch screen', async ({ page }) => {
        await page.goto('/collab/room-abc?testStatus=mismatch');
        await expect(page.getByText('Language Mismatch')).toBeVisible();
        await expect(
            page.getByText('You and your partner chose different languages.'),
        ).toBeVisible();
        await expect(page.getByRole('button', { name: 'Back to Home' })).toBeVisible();
    });

    test('returns to home when Back to Home is clicked from the mismatch screen', async ({
        page,
    }) => {
        await page.goto('/collab/room-abc?testStatus=mismatch');
        await expect(page.getByText('Language Mismatch')).toBeVisible();
        await page.getByRole('button', { name: 'Back to Home' }).click();
        await expect(page).toHaveURL('/home');
    });

    test('renders the timeout screen', async ({ page }) => {
        await page.goto('/collab/room-abc?testStatus=timeout');
        await expect(page.getByText('Time Out')).toBeVisible();
        await expect(page.getByText('Language selection timed out.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Back to Home' })).toBeVisible();
    });

    test('returns to home when Back to Home is clicked from the timeout screen', async ({
        page,
    }) => {
        await page.goto('/collab/room-abc?testStatus=timeout');
        await expect(page.getByText('Time Out')).toBeVisible();
        await page.getByRole('button', { name: 'Back to Home' }).click();
        await expect(page).toHaveURL('/home');
    });

    test('renders the session ended screen', async ({ page }) => {
        await page.goto('/collab/room-abc?testStatus=ended');
        await expect(page.getByText('Session Ended')).toBeVisible();
        await expect(page.getByText('The collaboration session has ended.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Back to Home' })).toBeVisible();
    });

    test('returns to home when Back to Home is clicked from the ended screen', async ({ page }) => {
        await page.goto('/collab/room-abc?testStatus=ended');
        await expect(page.getByText('Session Ended')).toBeVisible();
        await page.getByRole('button', { name: 'Back to Home' }).click();
        await expect(page).toHaveURL('/home');
    });

    test('returns to home when leaving an active session', async ({ page }) => {
        await page.goto(
            '/collab/room-abc?testStatus=active&testLanguage=python&testPartnerName=Alex',
        );

        await expect(page.getByText('Active')).toBeVisible();
        await page.getByRole('button', { name: /leave/i }).click();
        await expect(page).toHaveURL('/home');
    });

    test('shows the partner disconnected banner in an active session', async ({ page }) => {
        await page.goto(
            '/collab/room-abc?testStatus=active&testLanguage=python&testPartnerName=Alex&testPartnerDisconnected=1',
        );

        await expect(page.getByText('Active')).toBeVisible();
        await expect(page.getByText(/Partner disconnected\./)).toBeVisible();
        await expect(page.getByText(/Session will end in/)).toBeVisible();
    });

    test('does not show the disconnected banner in a normal active session', async ({ page }) => {
        await page.goto(
            '/collab/room-abc?testStatus=active&testLanguage=python&testPartnerName=Alex',
        );

        await expect(page.getByText('Active')).toBeVisible();
        await expect(page.getByText(/Partner disconnected\./)).toHaveCount(0);
    });
});
