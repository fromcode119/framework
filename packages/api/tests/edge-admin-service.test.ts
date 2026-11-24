import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseFactory } from '@fromcode119/database';
import { EdgeIdentity, SystemConstants } from '@fromcode119/core';
import { EdgeIdentityMigration } from '@core/database/migrations/074_edge_identity';
import { EdgeAdminService } from '@api/services/security/edge-admin-service';

/** Settings → Security → Edges on a real database: nothing is recorded the operator could not use. */
describe('EdgeAdminService', () => {
  let file = '';
  let db: any;
  let apiHost = '';
  const settings = new Map<string, string>();
  const previousKey = process.env.SECRET_KEY;
  const actor = { id: 1, email: 'ops@example.test' };

  beforeEach(async () => {
    process.env.SECRET_KEY = 'test-secret-key-for-edge-admin-0123456789';
    file = path.join(os.tmpdir(), `fromcode-edge-admin-${Date.now()}-${Math.random()}.db`);
    db = DatabaseFactory.create(`sqlite:${file}`);
    await db.connect();
    await new EdgeIdentityMigration().up(db);
    settings.clear();
    settings.set(SystemConstants.META_KEY.EDGE_CONTROL_ADDRESS, '203.0.113.5');
    settings.set(SystemConstants.META_KEY.EDGE_CONTROL_PORT, '8443');
    apiHost = '';
  });
  afterEach(async () => {
    await db.disconnect?.();
    fs.rmSync(file, { force: true });
    process.env.SECRET_KEY = previousKey;
  });

  const service = () => new EdgeAdminService({ audit: { logAction: async () => undefined } }, new EdgeIdentity(db, settings, () => apiHost), settings);

  it('records no edge and says why while the platform has no API address', async () => {
    expect(await service().add('Relay', actor)).toBeNull();
    const overview = await service().overview();
    expect(overview.edges).toEqual([]);
    expect(overview.controlProblem).toBe('api_url');
    expect(overview.control).toBeNull();
  });

  it('adds an edge with a join command that pins the root once the API address is set', async () => {
    apiHost = 'api.platform.test';
    const added = await service().add('Relay', actor);
    expect(added?.command).toMatch(/^fromcode system edge join --control 203\.0\.113\.5:8443 --token \S+ --root sha256:[0-9a-f]{64} --state /);
    expect((await service().overview()).controlProblem).toBe('');
  });
});
