import { describe, it, expect } from 'vitest';
import { AddPluginHeldReasonMigration } from '@core/database/migrations/013_add_plugin_held_reason';

describe('013_add_plugin_held_reason', () => {
  it('is registered at version 13 with up/down', () => {
    // A migration module exports its CLASS — the loader instantiates it — so the test does too.
    const migration = new AddPluginHeldReasonMigration();
    expect(migration.version).toBe(13);
    expect(typeof migration.up).toBe('function');
    expect(typeof migration.down).toBe('function');
    expect(migration.name).toMatch(/held/i);
  });
});
