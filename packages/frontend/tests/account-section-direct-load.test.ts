import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocaleUrlStrategy } from '@fromcode119/core/client';
import { DynamicPageResolver } from '@/lib/dynamic-page-resolver';

/**
 * An account section opened directly — a bookmark, a refresh, a link in an email — is the account
 * page. Only the base page exists as content, so `/account/orders` resolved nothing and answered 404
 * on the live site while the same page reached by clicking inside the account worked.
 */
describe('an account section opened directly', () => {
  afterEach(() => vi.restoreAllMocks());

  const accountDoc = { type: 'pages', plugin: 'content', doc: { id: 6, slug: 'account' }, canonicalPath: '/account' };

  it('renders the account page, without redirecting away from the section', async () => {
    const resolve = vi.spyOn(DynamicPageResolver, 'resolveDocResult').mockImplementation(async (slug: string) =>
      (slug === 'account' ? accountDoc : { type: '', plugin: '', doc: null, canonicalPath: '' }) as any);

    const result = await DynamicPageResolver.resolveDocWithPermalinkFallbackResult('account/orders', {}, 'bg', LocaleUrlStrategy.QUERY);

    expect(result?.doc).toEqual(accountDoc.doc);
    expect(result?.canonicalPath).toBe('');
    expect(resolve).toHaveBeenLastCalledWith('account', {}, 'bg', LocaleUrlStrategy.QUERY);
  });

  it('leaves any other unresolved path unresolved', async () => {
    vi.spyOn(DynamicPageResolver, 'resolveDocResult').mockResolvedValue({ type: '', plugin: '', doc: null, canonicalPath: '' } as any);
    const result = await DynamicPageResolver.resolveDocWithPermalinkFallbackResult('accountant/orders', {}, 'bg', LocaleUrlStrategy.QUERY);
    expect(result?.doc ?? null).toBeNull();
  });
});
