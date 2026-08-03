import { describe, it, expect } from 'vitest';
import { LifecycleService } from '@core/plugin/services/lifecycle-service';
import { PluginHealthNotificationTemplateService } from '@core/plugin/services/plugin-health-notification-template-service';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { PluginRegistryHealth } from '@core/plugin/services/enums/plugin-registry-health.enum';
import { PluginHeldReason } from '@core/plugin/services/enums/plugin-held-reason.enum';

const heldMap = () =>
  new Map<string, any>([
    ['ecommerce', { manifest: { slug: 'ecommerce' }, state: PluginState.INACTIVE, healthStatus: PluginRegistryHealth.WARNING, heldReason: PluginHeldReason.CAPABILITY_DRIFT }],
    ['mlm', { manifest: { slug: 'mlm' }, state: PluginState.ERROR, healthStatus: PluginRegistryHealth.ERROR, error: 'boom' }],
    ['cms', { manifest: { slug: 'cms' }, state: PluginState.ACTIVE, healthStatus: PluginRegistryHealth.HEALTHY }],
  ]);

describe('LifecycleService.summarizeHeldPlugins', () => {
  it('returns null when everything is healthy', () => {
    const healthy = new Map<string, any>([
      ['cms', { manifest: { slug: 'cms' }, state: PluginState.ACTIVE, healthStatus: PluginRegistryHealth.HEALTHY }],
    ]);
    expect(LifecycleService.summarizeHeldPlugins(healthy)).toBeNull();
  });

  it('collects held + errored plugins as DATA only (no markup or copy)', () => {
    const summary = LifecycleService.summarizeHeldPlugins(heldMap());
    expect(summary).not.toBeNull();
    expect(summary!.count).toBe(2);

    const ecommerce = summary!.plugins.find((p) => p.slug === 'ecommerce');
    expect(ecommerce).toMatchObject({ held: true, reason: PluginHeldReason.CAPABILITY_DRIFT });

    const mlm = summary!.plugins.find((p) => p.slug === 'mlm');
    expect(mlm).toMatchObject({ held: false, error: 'boom' });

    // Fallback WORDING must not leak into the data — the template owns it.
    const noReason = LifecycleService.summarizeHeldPlugins(
      new Map<string, any>([['x', { manifest: { slug: 'x' }, state: PluginState.INACTIVE, healthStatus: PluginRegistryHealth.WARNING }]]),
    )!;
    expect(noReason.plugins[0].reason).toBeUndefined();

    // The summary must carry NO rendered output — templates own subject/text/html.
    expect(summary as any).not.toHaveProperty('html');
    expect(summary as any).not.toHaveProperty('subject');
  });
});

describe('PluginHealthNotificationTemplateService.render', () => {
  it('renders subject/text/html from the Handlebars template files', () => {
    const data = LifecycleService.summarizeHeldPlugins(heldMap())!;
    const message = PluginHealthNotificationTemplateService.render(data);

    expect(message.subject).toMatch(/2 plugin\(s\) need attention/);
    expect(message.text).toContain('ecommerce');
    expect(message.text).toContain('capability_drift');
    expect(message.text).toContain('mlm');
    expect(message.text).toContain('boom');

    expect(message.html).toContain('<ul>');
    expect(message.html).toContain('<li>');
    expect(message.html).toContain('ecommerce');
    expect(message.html).toContain('capability_drift');
  });
});
