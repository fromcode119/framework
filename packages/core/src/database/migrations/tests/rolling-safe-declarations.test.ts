import { describe, expect, it } from 'vitest';
import { SignedTenantBindingMigration } from '@core/database/migrations/057_signed_tenant_binding';
import { PushSubscriptionsMigration } from '@core/database/migrations/058_push_subscriptions';
import { ChannelConsentsMigration } from '@core/database/migrations/059_channel_consents';

/**
 * A rolling deploy migrates while the previous release still serves, so the deploy reads each pending
 * migration's `rollingSafe`. Only what says so may roll; everything else keeps the restart path.
 */
describe('rollingSafe declarations', () => {
  it('a migration that says nothing keeps the restart path', () => {
    expect(new SignedTenantBindingMigration().rollingSafe === true).toBe(false);
  });

  it('the purely additive tables declare they can run beside the serving release', () => {
    expect(new PushSubscriptionsMigration().rollingSafe).toBe(true);
    expect(new ChannelConsentsMigration().rollingSafe).toBe(true);
  });
});
