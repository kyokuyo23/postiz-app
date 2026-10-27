export default {
  displayName: 'nestjs-libraries',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: [
    '<rootDir>/src/security/__tests__/**/*.spec.ts',
    '<rootDir>/src/comments/__tests__/**/*.spec.ts',
    '<rootDir>/src/ai/__tests__/**/*.spec.ts',
  ],
  moduleNameMapper: {
    '^@gitroom/nestjs-libraries/(.*)$': '<rootDir>/src/$1',
    '^@gitroom/helpers/(.*)$': '<rootDir>/../helpers/src/$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { isolatedModules: true, diagnostics: false }],
  },
};
