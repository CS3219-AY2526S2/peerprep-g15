import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        dir: 'src/tests',
        include: ['**/*.test.ts'],
        exclude: ['**/dist/**', '**/node_modules/**'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['src/**/*.ts'],
            exclude: ['src/tests/**', 'dist/**'],
        },
    },
});
