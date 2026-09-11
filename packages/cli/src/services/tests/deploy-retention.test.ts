import { describe, it, expect } from 'vitest';
import { ImageRetention } from '@cli/services/deploy/image-retention';
import { ReleaseHealthProbe } from '@cli/services/deploy/release-health-probe';

describe('ImageRetention', () => {
  const images = [
    'ghcr.io/fromcode119/framework-api:v0.2.13',
    'ghcr.io/fromcode119/framework-admin:v0.2.13',
    'ghcr.io/fromcode119/framework-api:v0.2.12',
    'ghcr.io/fromcode119/framework-api:v0.2.8',
    'postgres:15-alpine',
    'traefik:v3.3',
  ];

  it('keeps the live version and the rollback target', () => {
    const prunable = ImageRetention.prunable(images, ImageRetention.keepSet('v0.2.13', 'v0.2.12'));
    expect(prunable).toEqual(['ghcr.io/fromcode119/framework-api:v0.2.8']);
  });

  it('never touches images that are not ours', () => {
    const prunable = ImageRetention.prunable(images, ImageRetention.keepSet('v0.2.13', ''));
    expect(prunable).not.toContain('postgres:15-alpine');
    expect(prunable).not.toContain('traefik:v3.3');
  });

  /**
   * Re-deploying the same version must not collapse the keep-set to one entry and delete the only
   * image a rollback could use.
   */
  it('keeps the remembered rollback target when the same version is deployed again', () => {
    const prunable = ImageRetention.prunable(images, ImageRetention.keepSet('v0.2.13', 'v0.2.13'));
    expect(prunable).toContain('ghcr.io/fromcode119/framework-api:v0.2.12');

    const remembered = ImageRetention.prunable(images, ImageRetention.keepSet('v0.2.13', 'v0.2.12'));
    expect(remembered).not.toContain('ghcr.io/fromcode119/framework-api:v0.2.12');
  });
});

describe('ReleaseHealthProbe', () => {
  const body = '{"status":"ok","version":"0.2.13","maintenance":false}';

  it('accepts the deployed version with or without its v prefix', () => {
    expect(ReleaseHealthProbe.reports(body, 'v0.2.13')).toBe(true);
    expect(ReleaseHealthProbe.reports(body, '0.2.13')).toBe(true);
  });

  /** The previous release still answering 200 is the failure this check exists to catch. */
  it('rejects a healthy answer from the version being replaced', () => {
    expect(ReleaseHealthProbe.reports(body, 'v0.2.14')).toBe(false);
  });

  it('rejects an empty body rather than treating silence as success', () => {
    expect(ReleaseHealthProbe.reports('', 'v0.2.13')).toBe(false);
  });
});
