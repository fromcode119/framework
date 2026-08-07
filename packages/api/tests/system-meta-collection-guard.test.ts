import { SystemConstants } from '@fromcode119/core';
import { SystemMetaCollectionGuard } from '@api/services/system-meta-collection-guard';

const settingsCollection: any = { slug: 'settings', tableName: SystemConstants.TABLE.META };
const ordinaryCollection: any = { slug: 'pages', tableName: 'cms_pages' };

describe('SystemMetaCollectionGuard.guards', () => {
  it('recognises the system meta table by TABLE, not by collection slug', () => {
    expect(SystemMetaCollectionGuard.guards(settingsCollection)).toBe(true);
    expect(SystemMetaCollectionGuard.guards({ slug: 'renamed', tableName: SystemConstants.TABLE.META } as any)).toBe(true);
    expect(SystemMetaCollectionGuard.guards(ordinaryCollection)).toBe(false);
  });
});

describe('SystemMetaCollectionGuard.buildReadClause', () => {
  it('returns no clause for a collection that is not the meta table', () => {
    expect(SystemMetaCollectionGuard.buildReadClause(ordinaryCollection)).toBeNull();
  });

  it('restricts the meta table read to the declared settings keys', () => {
    const clause = SystemMetaCollectionGuard.buildReadClause(settingsCollection);

    expect(clause).toBeTruthy();
    const bound = JSON.stringify(clause);
    expect(bound).toContain(SystemConstants.META_KEY.SITE_NAME);
    // The namespaced secret keys, not the similarly-named declared settings
    // (`auth_password_reset_token_minutes` is a real, exposable setting).
    expect(bound).not.toContain('totp_secret');
    expect(bound).not.toContain('auth:password_reset_token');
    expect(bound).not.toContain('scim:token');
    expect(bound).not.toContain(SystemConstants.META_KEY.EMAIL_PROFILES);
  });
});

describe('SystemMetaCollectionGuard.allowsRecord', () => {
  it('allows any record of an unrelated collection', () => {
    expect(SystemMetaCollectionGuard.allowsRecord(ordinaryCollection, { key: 'anything' })).toBe(true);
  });

  it('allows a declared setting row', () => {
    expect(SystemMetaCollectionGuard.allowsRecord(settingsCollection, { key: SystemConstants.META_KEY.SITE_NAME })).toBe(true);
  });

  it('refuses an undeclared row fetched by name — the single-record bypass', () => {
    for (const key of ['auth:password_reset_token:abc', 'user:1:totp_secret', 'scim:token', 'integration_email_profiles']) {
      expect(SystemMetaCollectionGuard.allowsRecord(settingsCollection, { key })).toBe(false);
    }
  });

  it('refuses a missing record', () => {
    expect(SystemMetaCollectionGuard.allowsRecord(settingsCollection, null)).toBe(false);
  });
});

describe('SystemMetaCollectionGuard.ensureWritableKey', () => {
  it('is a no-op for a collection that is not the meta table', () => {
    expect(() => SystemMetaCollectionGuard.ensureWritableKey(ordinaryCollection, 'anything')).not.toThrow();
  });

  it('permits writing a declared setting', () => {
    expect(() => SystemMetaCollectionGuard.ensureWritableKey(settingsCollection, SystemConstants.META_KEY.SITE_NAME)).not.toThrow();
  });

  it('refuses minting an auth token or overwriting a secret through the collection API', () => {
    for (const key of ['auth:password_reset_token:victim', 'scim:token', 'user:1:totp_secret', undefined]) {
      let thrown: any = null;
      try {
        SystemMetaCollectionGuard.ensureWritableKey(settingsCollection, key);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeTruthy();
      expect(thrown.statusCode).toBe(403);
    }
  });
});
