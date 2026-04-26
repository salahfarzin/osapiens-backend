/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/__tests__/**',
    ],
    projects: [
        {
            displayName: 'unit',
            testEnvironment: 'node',
            roots: ['<rootDir>/src'],
            testMatch: ['**/__tests__/unit/**/*.test.ts'],
            clearMocks: true,
            transform: {
                '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
            },
        },
        {
            displayName: 'integration',
            testEnvironment: 'node',
            roots: ['<rootDir>/src'],
            testMatch: ['**/__tests__/integration/**/*.test.ts'],
            clearMocks: true,
            transform: {
                '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
            },
        },        {
            displayName: 'e2e',
            testEnvironment: 'node',
            roots: ['<rootDir>/src'],
            testMatch: ['**/__tests__/e2e/**/*.test.ts'],
            clearMocks: true,
            transform: {
                '^.+\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
            },
        },    ],
};
