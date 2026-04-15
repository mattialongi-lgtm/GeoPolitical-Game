/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/backend'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.jest.json',
      },
    ],
  },
  collectCoverageFrom: [
    'backend/services/service-result.ts',
    'backend/services/http-result.mapper.ts',
    'backend/services/extraction.service.ts',
    // TODO: re-enable once we add focused unit tests for EconomyService.
    // 'backend/services/economy.service.ts',
    'backend/services/governance.service.ts',
    'backend/services/user.service.ts',
    'backend/errors/**/*.ts',
    'backend/middleware/**/*.ts',
    'backend/utils/logger.ts',
    // TODO: re-enable once covered by auth middleware tests.
    '!backend/middleware/authenticate.middleware.ts',
    '!**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
};
