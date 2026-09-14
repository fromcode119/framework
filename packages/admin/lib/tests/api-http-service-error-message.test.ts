import { describe, expect, it } from 'vitest';

const { AdminApiHttpService } = await import('@/lib/api-http-service');

const jsonResponse = (status: number, body: unknown): Response => ({
  ok: false,
  status,
  statusText: 'Bad Request',
  headers: new Headers({ 'content-type': 'application/json' }),
  json: async () => body,
  text: async () => JSON.stringify(body),
} as unknown as Response);

/**
 * A refusal has to reach the operator as the SENTENCE, not as the code token.
 *
 * `updateSettings` refuses a siteless save with `{error: 'site_required', message: 'Setting(s) … belong
 * to a site. Choose a site first …'}`. Preferring `error` put the bare words "site_required" in the
 * toast and threw away the half that named the keys and said what to do — which is how "Settings saves
 * nothing in platform scope" was reported with no clue as to why.
 */
describe('AdminApiHttpService.parseResponse error message', () => {
  it('prefers the human sentence when the body carries both a code and a message', async () => {
    const body = { error: 'site_required', message: 'Setting(s) timezone belong to a site. Choose a site first.' };

    await expect(AdminApiHttpService.parseResponse(jsonResponse(400, body), '/settings'))
      .rejects.toThrow('Setting(s) timezone belong to a site. Choose a site first.');
  });

  it('still uses `error` when it is the only thing the endpoint sent', async () => {
    const body = { error: 'Unknown or read-only settings key(s): nonsense' };

    await expect(AdminApiHttpService.parseResponse(jsonResponse(400, body), '/settings'))
      .rejects.toThrow('Unknown or read-only settings key(s): nonsense');
  });

  it('carries the status through for callers that branch on it', async () => {
    await expect(AdminApiHttpService.parseResponse(jsonResponse(403, { error: 'platform_admin_required', message: 'Only a platform admin may change them.' }), '/settings'))
      .rejects.toMatchObject({ status: 403, message: 'Only a platform admin may change them.' });
  });
});
