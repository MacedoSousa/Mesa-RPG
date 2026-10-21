/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }] },
  moduleNameMapper: { '^@mesa/shared$': '<rootDir>/../shared/src/index.ts' },
  setupFiles: ['<rootDir>/tests/setupEnv.ts'],
  globalSetup: '<rootDir>/tests/globalSetup.ts',
  testTimeout: 30000,
};
