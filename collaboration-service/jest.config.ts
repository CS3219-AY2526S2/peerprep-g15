import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    rootDir: './src/tests',
    testTimeout: 10000,
};

export default config;
