import { describe, expect, it } from 'vitest';
import { GuestEnvironment } from '@core/process/guest-environment';

describe('GuestEnvironment', () => {
  it('passes the allocator setting and nothing else', () => {
    const env = GuestEnvironment.build({ MALLOC_ARENA_MAX: '2', DATABASE_URL: 'postgres://secret', JWT_SECRET: 'x', PATH: '/usr/bin' } as NodeJS.ProcessEnv);
    expect(env).toEqual({ MALLOC_ARENA_MAX: '2' });
  });

  it('is empty when the host has no allocator setting', () => {
    expect(GuestEnvironment.build({ DATABASE_URL: 'postgres://secret' } as NodeJS.ProcessEnv)).toEqual({});
  });
});
