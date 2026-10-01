import { describe, expect, it } from 'vitest';
import { SystemConstants } from '@fromcode119/core';
import { ServerRuntimeLimits } from '@api/server/server-runtime-limits';

describe('ServerRuntimeLimits.databasePoolMax', () => {
  const key = SystemConstants.META_KEY.DATABASE_POOL_MAX;

  it('is the declared default of 20 until the operator saves one, then the saved value', () => {
    expect(ServerRuntimeLimits.databasePoolMax(new Map())).toBe(20);
    expect(ServerRuntimeLimits.databasePoolMax(new Map([[key, '40']]))).toBe(40);
    expect(ServerRuntimeLimits.databasePoolMax(new Map([[key, '']]))).toBe(20);
  });
});
