import type { Page } from '@playwright/test';

export type LocalAuthState = {
    accessToken?: string;
    userId?: string;
    name?: string;
};

export const seedLocalStorage = async (page: Page, values: LocalAuthState) => {
    await page.addInitScript((state) => {
        const entries = Object.entries(state) as Array<[string, string | undefined]>;
        for (const [key, value] of entries) {
            if (typeof value === 'string') {
                localStorage.setItem(key, value);
            }
        }
    }, values);
};

export const sampleQuestions = [
    {
        questionId: 101,
        title: 'Array Sum',
        difficulty: 'Easy',
        categories: ['Array', 'Math'],
        description: 'Sum the elements of an array.',
        sourceUrl: 'https://example.com/array-sum',
        testCases: [],
        supportedLanguages: ['python', 'javascript'],
    },
    {
        questionId: 102,
        title: 'Linked List Basics',
        difficulty: 'Medium',
        categories: ['Linked List'],
        description: 'Work with a linked list.',
        sourceUrl: 'https://example.com/linked-list',
        testCases: [],
        supportedLanguages: ['python', 'java'],
    },
    {
        questionId: 103,
        title: 'Graph Paths',
        difficulty: 'Hard',
        categories: ['Graph', 'DFS'],
        description: 'Count paths in a graph.',
        sourceUrl: 'https://example.com/graph-paths',
        testCases: [],
        supportedLanguages: ['python', 'cpp'],
    },
] as const;

export const adminUsers = [
    {
        id: 'u-1',
        username: 'alice',
        displayName: 'Alice Tan',
        email: 'alice@example.com',
        role: 'user',
        updatedAt: '2026-04-14T10:00:00.000Z',
    },
    {
        id: 'u-2',
        username: 'bob',
        displayName: 'Bob Lee',
        email: 'bob@example.com',
        role: 'admin',
        updatedAt: '2026-04-15T08:00:00.000Z',
    },
] as const;

export const userLoginResponse = {
    accessToken: 'access-token-user',
    user: {
        id: 'u-user',
        displayName: 'Shane',
        role: 'user',
    },
};

export const adminLoginResponse = {
    accessToken: 'access-token-admin',
    user: {
        id: 'u-admin',
        displayName: 'Admin Annie',
        role: 'admin',
    },
};
