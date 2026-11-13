import { describe, expect, it } from 'vitest';
import { AdminApiSessionGuardService } from '@/lib/api-session-guard-service';

describe('AdminApiSessionGuardService.needsNoSession', () => {
  it('leaves a signed-out person on every screen made for them', () => {
    for (const path of ['/login', '/forgot-password', '/reset-password', '/setup']) {
      expect(AdminApiSessionGuardService.needsNoSession(path)).toBe(true);
    }
  });

  it('still sends everything else to sign-in', () => {
    for (const path of ['/', '/users', '/settings/general', '/login-history', '/reset-password-log']) {
      expect(AdminApiSessionGuardService.needsNoSession(path)).toBe(false);
    }
  });
});
