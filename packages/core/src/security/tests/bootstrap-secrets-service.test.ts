import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { BootstrapSecretsService } from '@core/security/bootstrap-secrets-service';

/**
 * The three secrets a deployment cannot start without, generated once if nobody supplied them.
 *
 * The properties that matter are not "it returns a string": env must win so an existing deployment
 * is never second-guessed, and a generated secret must be STABLE across boots. Regenerating is not a
 * small fault — a new JWT secret signs every session out, and a new integration key makes every
 * stored SMTP and payment credential permanently undecryptable.
 */
describe('BootstrapSecretsService', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-secrets-'));
    vi.stubEnv('FROMCODE_DATA_DIR', dir);
    for (const key of ['JWT_SECRET', 'INTEGRATION_SECRET_KEY', 'INTERNAL_SERVICE_SECRET', 'SECRET_KEY']) {
      vi.stubEnv(key, '');
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('generates what nobody supplied, and makes it usable immediately', () => {
    const result = BootstrapSecretsService.ensure();

    expect(result.generated.sort()).toEqual(['INTEGRATION_SECRET_KEY', 'INTERNAL_SERVICE_SECRET', 'JWT_SECRET']);
    for (const key of result.generated) {
      // Production already refuses anything under 32 characters.
      expect(String(process.env[key]).length).toBeGreaterThanOrEqual(32);
    }
  });

  it('REUSES them on the next boot rather than generating again', () => {
    const first = BootstrapSecretsService.ensure();
    const jwt = process.env.JWT_SECRET;
    const integration = process.env.INTEGRATION_SECRET_KEY;

    // A restart: the process starts again with nothing in its environment.
    for (const key of first.generated) vi.stubEnv(key, '');
    const second = BootstrapSecretsService.ensure();

    expect(second.generated).toEqual([]);
    expect(process.env.JWT_SECRET).toBe(jwt);
    expect(process.env.INTEGRATION_SECRET_KEY).toBe(integration);
  });

  it('never overrides what the deployment supplied', () => {
    vi.stubEnv('JWT_SECRET', 'supplied-by-the-operator-and-long-enough-to-pass');

    const result = BootstrapSecretsService.ensure();

    expect(result.generated).not.toContain('JWT_SECRET');
    expect(process.env.JWT_SECRET).toBe('supplied-by-the-operator-and-long-enough-to-pass');
  });

  it('treats the older SECRET_KEY name as supplying the integration key', () => {
    vi.stubEnv('SECRET_KEY', 'legacy-name-still-in-use-by-older-deployments');

    const result = BootstrapSecretsService.ensure();

    expect(result.generated).not.toContain('INTEGRATION_SECRET_KEY');
  });

  it('writes the file readable only by its owner', () => {
    const { file } = BootstrapSecretsService.ensure();

    expect(fs.existsSync(file)).toBe(true);
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
  });

  it('regenerates rather than throwing when the file is corrupt, and repairs it', () => {
    const { file } = BootstrapSecretsService.ensure();
    fs.writeFileSync(file, '{ not json');
    for (const key of ['JWT_SECRET', 'INTEGRATION_SECRET_KEY', 'INTERNAL_SERVICE_SECRET']) vi.stubEnv(key, '');

    const result = BootstrapSecretsService.ensure();

    expect(result.generated.length).toBe(3);
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).JWT_SECRET).toBe(process.env.JWT_SECRET);
  });
});
