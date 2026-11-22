import { describe, expect, it, vi } from 'vitest';
import { AdminConstants } from '@/lib/constants/admin.constants';

const redirectMock = vi.fn((path: string) => {
  throw new Error(`redirect:${path}`);
});

vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
}));

import { IntegrationTypeAliasPageRoute } from '@/app/settings/integrations/[type]/page';

describe('IntegrationTypeAliasPageRoute', () => {
  it('sends /settings/integrations/<type> to the integrations page with that type open', async () => {
    await expect(IntegrationTypeAliasPageRoute.render({ params: Promise.resolve({ type: 'email' }) })).rejects.toThrow(
      `redirect:${AdminConstants.ROUTES.SETTINGS.INTEGRATIONS_BY_TYPE('email')}`,
    );
  });
});
