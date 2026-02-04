import { test, expect } from '@playwright/test';

const PLUGINS_TO_TEST = ['cms', 'analytics', 'ecommerce'];

PLUGINS_TO_TEST.forEach(pluginSlug => {
  test.describe(`${pluginSlug} Plugin Settings`, () => {
    test(`should load ${pluginSlug} settings page`, async ({ page }) => {
      await page.goto(`/plugins/${pluginSlug}?tab=settings`);
      
      // Wait for page to load
      // Note: We use a more generic check since we don't know the exact title for every plugin
      const hasSettingsForm = await page.locator('button:has-text("Save Settings")').count() > 0;
      const noSettingsMessage = await page.locator('text=no configurable settings').count() > 0;
      
      expect(hasSettingsForm || noSettingsMessage).toBeTruthy();
    });
  });
});

test.describe('Old Singleton Routes', () => {
  test('should return 404 or redirect for legacy CMS settings route', async ({ page }) => {
    const response = await page.goto('/cms/cms/settings');
    // If it redirects to /plugins/cms?tab=settings or 404s, it's successful in being removed
    expect(response?.status()).toBe(404);
  });
});
