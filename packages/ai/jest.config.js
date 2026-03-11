module.exports = {
  transform: {
    '^.+\\.tsx?$': [require.resolve('ts-jest'), { tsconfig: '<rootDir>/../../tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^@fromcode119/ai$': '<rootDir>/src/index.ts',
    '^@fromcode119/core$': '<rootDir>/../core/src',
    '^@fromcode119/auth$': '<rootDir>/../auth/src',
    '^@fromcode119/database$': '<rootDir>/../database/src',
    '^@fromcode119/mcp$': '<rootDir>/../mcp/src',
    '^@fromcode119/react$': '<rootDir>/../react/src',
    '^@fromcode119/sdk$': '<rootDir>/../sdk/src',
  },
};
