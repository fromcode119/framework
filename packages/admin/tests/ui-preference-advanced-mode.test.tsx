import { afterEach, describe, expect, it } from 'vitest';
import { ClientRuntimeConstants } from '@fromcode119/core/client';
import { UiPreferenceService } from '@/lib/services/ui-preference-service';

/**
 * A browser with no stored choice was treated as having chosen the assistant, so every new address
 * (a domain switch, another browser, cleared site data) opened the console on the assistant instead
 * of the admin.
 */
describe('UiPreferenceService.readAdvancedMode', () => {
  const key = ClientRuntimeConstants.ADMIN_UI.STORAGE_KEYS.ADVANCED_MODE;
  afterEach(() => window.localStorage.clear());

  it('opens the admin when this browser has stored no choice', () => {
    expect(new UiPreferenceService().readAdvancedMode()).toBe(true);
  });

  it('keeps the admin once "back to admin" stored it', () => {
    window.localStorage.setItem(key, 'true');
    expect(new UiPreferenceService().readAdvancedMode()).toBe(true);
  });

  it('opens the assistant only when the browser stored that choice', () => {
    window.localStorage.setItem(key, 'false');
    expect(new UiPreferenceService().readAdvancedMode()).toBe(false);
  });
});
