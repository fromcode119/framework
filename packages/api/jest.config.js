module.exports = {
  transform: {
    '^.+\\.tsx?$': [require.resolve('ts-jest'), { tsconfig: 'tsconfig.json' }],
  },
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^@fromcode119/core$': '<rootDir>/../core/src',
    '^@fromcode119/auth$': '<rootDir>/../auth/src',
    '^@fromcode119/database$': '<rootDir>/../database/src',
    '^@fromcode119/media$': '<rootDir>/../media/src',
    '^@fromcode119/sdk$': '<rootDir>/../sdk/src',
    '^@fromcode119/cache$': '<rootDir>/../cache/src',
    '^@fromcode119/email$': '<rootDir>/../email/src',
    '^@fromcode119/scheduler$': '<rootDir>/../scheduler/src',
    '^@fromcode119/marketplace-client$': '<rootDir>/../marketplace-client/src',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
