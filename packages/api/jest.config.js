module.exports = {
  transform: {
    '^.+\\.tsx?$': [require.resolve('ts-jest'), { tsconfig: 'tsconfig.json' }],
  },
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^@fromcode/core$': '<rootDir>/../core/src',
    '^@fromcode/auth$': '<rootDir>/../auth/src',
    '^@fromcode/database$': '<rootDir>/../database/src',
    '^@fromcode/media$': '<rootDir>/../media/src',
    '^@fromcode/sdk$': '<rootDir>/../sdk/src',
    '^@fromcode/cache$': '<rootDir>/../cache/src',
    '^@fromcode/email$': '<rootDir>/../email/src',
    '^@fromcode/scheduler$': '<rootDir>/../scheduler/src',
    '^@fromcode/marketplace-client$': '<rootDir>/../marketplace-client/src',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
