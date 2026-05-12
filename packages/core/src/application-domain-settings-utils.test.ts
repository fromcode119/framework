import { describe, expect, it } from 'vitest';
import { ApplicationDomainSettingsUtils } from './application-domain-settings-utils';

describe('ApplicationDomainSettingsUtils', () => {
  it('collects allowed domains from env urls, saved urls, and aliases', () => {
    expect(
      ApplicationDomainSettingsUtils.collectAllowedDomains({
        envAllowedDomains: 'old.example.com, preview.example.com',
        platformDomain: 'example.com',
        frontendUrl: 'https://v2.example.com',
        adminUrl: 'https://admin.example.com/panel',
        apiUrl: 'https://example.com/api',
        domainAliases: '["legacy.example.com", "preview.example.com"]',
      }),
    ).toEqual([
      'old.example.com',
      'preview.example.com',
      'example.com',
      'v2.example.com',
      'admin.example.com',
      'legacy.example.com',
    ]);
  });

  it('preserves previous primary hosts as aliases during a domain migration', () => {
    expect(
      ApplicationDomainSettingsUtils.mergeDomainAliasesForPrimaryChange({
        currentAliases: '["legacy.example.com"]',
        previousValues: [
          'https://v2.example.com',
          'https://v2.example.com/admin',
          'v2.example.com',
        ],
        nextValues: [
          'https://example.com',
          'https://example.com/admin',
          'example.com',
        ],
      }),
    ).toEqual([
      'legacy.example.com',
      'v2.example.com',
    ]);
  });

  it('accepts plain hostnames and json arrays when parsing aliases', () => {
    expect(ApplicationDomainSettingsUtils.parseDomainAliases('["One.Example.com", "two.example.com"]')).toEqual([
      'one.example.com',
      'two.example.com',
    ]);
    expect(ApplicationDomainSettingsUtils.parseDomainAliases('one.example.com, two.example.com')).toEqual([
      'one.example.com',
      'two.example.com',
    ]);
  });
});
