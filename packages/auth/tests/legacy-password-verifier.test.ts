import { describe, expect, it } from 'vitest';
import * as bcrypt from 'bcryptjs';
import { LegacyPasswordVerifier } from '@auth/passwords/legacy-password-verifier';
import { AuthTokenService } from '@auth/auth-token-service';

/**
 * Every vector below was produced by the platform's OWN code path in PHP 8.3 (password_hash, hash,
 * md5, sha1, and the published phpass reference), not by this implementation — so a pass means the
 * kernel agrees with the platform, not with itself.
 */
const PASSWORD = 'correct horse 9!';
const hex = (value: string) => Buffer.from(value, 'utf8').toString('hex');

describe('LegacyPasswordVerifier', () => {
  it.each([
    ['phpass, the openwall reference vector', 'test12345', '$P$9IQRaTwmfeRo7ud9Fh4E2PdI0S3r.L0'],
    ['WordPress phpass', PASSWORD, '$P$BsaltSALTfDaAX/UI6frCqZDMzLFN91'],
    ['phpBB phpass', PASSWORD, '$H$9abcdefghqce4oyLKp4XVd03uXk5Y6/'],
    ['Drupal 7 sha512 phpass', PASSWORD, '$S$DxyzXYZ12dGM7AkacUH5HkuBr7NbutIfq9IWmH/d3It3BAI4fs/B'],
    ['WordPress 6.8 bcrypt-sha384', PASSWORD, '$wp$2y$10$7kB21t4f0N32jOH2xxPFH.8s29rAmiaWbDO5jaILuBZqDvIWL8mLW'],
    ['Magento 2 sha256', PASSWORD, `$legacy$sha256-prefix$${hex('aBcDeFgHiJkLmNoPqRsTuVwXyZ012345')}$bef288e3102785841964a0d79c9dd93eabddebc9acded7869f03f5aa9b937f0b`],
    ['Magento 1 md5', PASSWORD, `$legacy$md5-prefix$${hex('xy')}$c08308827945220cedc0dd0533761d9d`],
    ['Joomla 2.5 md5', PASSWORD, `$legacy$md5-suffix$${hex('0123456789abcdef0123456789abcdef')}$fa5c4ea1fe033c858edf6afad324700b`],
    ['OpenCart sha1', PASSWORD, `$legacy$opencart-sha1$${hex('Ab3dE6gH9')}$2ed0ee39124a942d388c56213806a41f4e8f2048`],
    ['PrestaShop 1.6 cookie-key md5', PASSWORD, `$legacy$md5-prefix$${hex('Qx7pLm2Vn9Rt4Ks8Hd1Fg6Jw3Zc5Yb0Ua2Ie7Oo4Pn8Mm1Ll6Kk3Jj9Hh5Gg0Ff')}$86127f0bf88e4a310066854f47a9aefc`],
  ])('%s: accepts the right password and refuses a wrong one', async (_name, password, stored) => {
    expect(LegacyPasswordVerifier.handles(stored)).toBe(true);
    await expect(LegacyPasswordVerifier.verify(password, stored)).resolves.toBe(true);
    await expect(LegacyPasswordVerifier.verify(`${password}x`, stored)).resolves.toBe(false);
  });

  it('accepts Drupal\'s md5-prehashed U$S$ form', async () => {
    // Drupal 7 rewrote migrated Drupal 6 hashes as phpass-sha512 over md5(password), marked with `U`.
    const { createHash } = await import('crypto');
    const { PhpassHash } = await import('@auth/passwords/phpass-hash');
    const inner = PhpassHash.compute(createHash('md5').update(PASSWORD).digest('hex'), '$S$DxyzXYZ12') as string;
    await expect(LegacyPasswordVerifier.verify(PASSWORD, `U${inner}`)).resolves.toBe(true);
    await expect(LegacyPasswordVerifier.verify('nope', `U${inner}`)).resolves.toBe(false);
  });

  it('refuses a phpass hash whose iteration count is outside the real range, without computing it', async () => {
    // `U` in position 4 is log2 = 42: 2^42 rounds would never return.
    const start = Date.now();
    await expect(LegacyPasswordVerifier.verify('x', '$P$UsaltSALTfDaAX/UI6frCqZDMzLFN91')).resolves.toBe(false);
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it.each([
    '$legacy$unknown-scheme$00$abcd',
    '$legacy$md5-prefix$zz$c08308827945220cedc0dd0533761d9d',
    '$legacy$md5-prefix$abc$c08308827945220cedc0dd0533761d9d',
    '$legacy$md5-prefix$7879$',
    '$P$short',
    '',
  ])('treats the malformed hash %j as a mismatch, never a throw', async (stored) => {
    await expect(LegacyPasswordVerifier.verify(PASSWORD, stored)).resolves.toBe(false);
  });

  it('does not claim the framework\'s own bcrypt hashes', async () => {
    const own = await bcrypt.hash(PASSWORD, 4);
    expect(LegacyPasswordVerifier.handles(own)).toBe(false);
    expect(LegacyPasswordVerifier.handles('$2y$10$RldXvbJhGFUxDAr4cV/1jOrSLfp1sp.T1.wytVXLC6bhrr9aOtEz2')).toBe(false);
  });
});

describe('AuthTokenService password checks', () => {
  const service = new AuthTokenService('test-secret', () => undefined);

  it('verifies a legacy hash and asks for it to be replaced', async () => {
    const stored = '$P$BsaltSALTfDaAX/UI6frCqZDMzLFN91';
    await expect(service.comparePassword(PASSWORD, stored)).resolves.toBe(true);
    expect(service.needsRehash(stored)).toBe(true);
  });

  it('verifies PHP $2y$ bcrypt directly, with no rehash needed', async () => {
    const stored = '$2y$10$RldXvbJhGFUxDAr4cV/1jOrSLfp1sp.T1.wytVXLC6bhrr9aOtEz2';
    await expect(service.comparePassword(PASSWORD, stored)).resolves.toBe(true);
    await expect(service.comparePassword('wrong', stored)).resolves.toBe(false);
    expect(service.needsRehash(stored)).toBe(false);
  });

  it('leaves its own hashes alone', async () => {
    const own = await service.hashPassword(PASSWORD);
    await expect(service.comparePassword(PASSWORD, own)).resolves.toBe(true);
    expect(service.needsRehash(own)).toBe(false);
  });
});
