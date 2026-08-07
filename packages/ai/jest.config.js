module.exports = {
  transform: {
    '^.+\\.tsx?$': [require.resolve('ts-jest'), { tsconfig: '<rootDir>/../../tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleNameMapper: {
    // Every typor-built package's PRIVATE alias for its own `src`, exactly as `vitest.plugins.config.ts`
    // repeats it. jest resolves modules itself and does NOT read tsconfig `paths`, so the root
    // tsconfig's mapping never reaches it and every `@ai/…` / `@core/…` import threw
    // `Cannot find module` — that took 4 of the 5 suites down before they ran a single test. The
    // cross-package ones are reachable too: `@fromcode119/core` below maps into `../core/src`, whose
    // own sources spell their imports `@core/…`.
    '^@ai/(.*)$': '<rootDir>/src/$1',
    '^@core/(.*)$': '<rootDir>/../core/src/$1',
    '^@database/(.*)$': '<rootDir>/../database/src/$1',
    '^@react/(.*)$': '<rootDir>/../react/src/$1',
    '^@api/(.*)$': '<rootDir>/../api/src/$1',
    '^@auth/(.*)$': '<rootDir>/../auth/src/$1',
    '^@cache/(.*)$': '<rootDir>/../cache/src/$1',
    '^@marketplace-client/(.*)$': '<rootDir>/../marketplace-client/src/$1',
    '^@media/(.*)$': '<rootDir>/../media/src/$1',
    '^@email/(.*)$': '<rootDir>/../email/src/$1',
    '^@scheduler/(.*)$': '<rootDir>/../scheduler/src/$1',
    '^@plugins/(.*)$': '<rootDir>/../plugins/src/$1',
    '^@mcp/(.*)$': '<rootDir>/../mcp/src/$1',
    '^@sdk/(.*)$': '<rootDir>/../sdk/src/$1',
    '^@nextjs/(.*)$': '<rootDir>/../next/src/$1',
    '^@cli/(.*)$': '<rootDir>/../cli/src/$1',
    '^@fromcode119/ai$': '<rootDir>/src/index.ts',
    '^@fromcode119/core$': '<rootDir>/../core/src',
    '^@fromcode119/auth$': '<rootDir>/../auth/src',
    '^@fromcode119/database$': '<rootDir>/../database/src',
    '^@fromcode119/mcp$': '<rootDir>/../mcp/src',
    '^@fromcode119/react$': '<rootDir>/../react/src',
    '^@fromcode119/sdk$': '<rootDir>/../sdk/src',
  },
};
