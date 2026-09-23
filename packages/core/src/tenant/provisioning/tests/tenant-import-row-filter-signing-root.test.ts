import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SecretService } from '@core/security/secret-service';
import { SigningSecretService } from '@core/security/signing-secret-service';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantImportRowFilter } from '@core/tenant/provisioning/tenant-import-row-filter';

// The shape a site archive carries for its link-signing root.
const meta = { name: SystemConstants.TABLE.META } as any;
const rootRow = (value: string) => ({ key: SigningSecretService.ROOT_META_KEY, value });

describe('importing a site whose link-signing root was sealed elsewhere', () => {
  const saved = process.env.SECRET_KEY;
  let sealedByTheOldDeployment = '';

  beforeEach(() => {
    process.env.SECRET_KEY = 'the-exporting-deployment';
    sealedByTheOldDeployment = SecretService.encrypt('a'.repeat(64));
    process.env.SECRET_KEY = 'this-deployment';
  });
  afterEach(() => {
    process.env.SECRET_KEY = saved;
  });

  it('drops a root this deployment cannot open — kept, it made every signed link of the site throw', () => {
    const skip = TenantImportRowFilter.forTable(meta, new Set());
    expect(skip(rootRow(sealedByTheOldDeployment))).toBe(true);
  });

  it('keeps a root that opens here, so links already sent keep verifying', () => {
    const skip = TenantImportRowFilter.forTable(meta, new Set());
    expect(skip(rootRow(SecretService.encrypt('b'.repeat(64))))).toBe(false);
  });

  it('keeps a root resealed for transit under the passphrase the import was given', () => {
    const sealedForTransit = SecretService.encryptWith('c'.repeat(64), 'transit-passphrase');
    expect(TenantImportRowFilter.forTable(meta, new Set(), 'transit-passphrase')(rootRow(sealedForTransit))).toBe(false);
    expect(TenantImportRowFilter.forTable(meta, new Set())(rootRow(sealedForTransit))).toBe(true);
  });

  it('leaves every other unreadable secret to the existing secrets-arrive flow', () => {
    const skip = TenantImportRowFilter.forTable(meta, new Set());
    expect(skip({ key: 'integration_email_providers', value: sealedByTheOldDeployment })).toBe(false);
  });
});
