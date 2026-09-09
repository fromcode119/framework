import { describe, it, expect } from 'vitest';
import { PluginBootHealthReporter } from '@core/plugin/services/runtime/plugin-boot-health-reporter';
import { LifecycleService } from '@core/plugin/services/runtime/lifecycle-service';
import { PluginHealthNotificationTemplateService } from '@core/plugin/services/health/plugin-health-notification-template-service';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { PluginRegistryHealth } from '@core/plugin/services/enums/plugin-registry-health.enum';
import { PluginHeldReason } from '@core/plugin/services/enums/plugin-held-reason.enum';

const heldMap = () =>
  new Map<string, any>([
    ['alpha', { manifest: { slug: 'alpha' }, state: PluginState.INACTIVE, healthStatus: PluginRegistryHealth.WARNING, heldReason: PluginHeldReason.CAPABILITY_DRIFT }],
    ['beta', { manifest: { slug: 'beta' }, state: PluginState.ERROR, healthStatus: PluginRegistryHealth.ERROR, error: 'boom' }],
    ['gamma', { manifest: { slug: 'gamma' }, state: PluginState.ACTIVE, healthStatus: PluginRegistryHealth.HEALTHY }],
  ]);

describe('PluginBootHealthReporter.summarizeHeldPlugins', () => {
  it('returns null when everything is healthy', () => {
    const healthy = new Map<string, any>([
      ['alpha', { manifest: { slug: 'alpha' }, state: PluginState.ACTIVE, healthStatus: PluginRegistryHealth.HEALTHY }],
    ]);
    expect(PluginBootHealthReporter.summarizeHeldPlugins(healthy)).toBeNull();
  });

  it('collects held + errored plugins as DATA only (no markup or copy)', () => {
    const summary = PluginBootHealthReporter.summarizeHeldPlugins(heldMap());
    expect(summary).not.toBeNull();
    expect(summary!.count).toBe(2);

    const alpha = summary!.plugins.find((p) => p.slug === 'alpha');
    expect(alpha).toMatchObject({ held: true, reason: PluginHeldReason.CAPABILITY_DRIFT });

    const beta = summary!.plugins.find((p) => p.slug === 'beta');
    expect(beta).toMatchObject({ held: false, error: 'boom' });

    // Fallback WORDING must not leak into the data — the template owns it.
    const noReason = PluginBootHealthReporter.summarizeHeldPlugins(
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
    const data = PluginBootHealthReporter.summarizeHeldPlugins(heldMap())!;
    const message = PluginHealthNotificationTemplateService.render(data);

    expect(message.subject).toMatch(/2 plugin\(s\) need attention/);
    expect(message.text).toContain('alpha');
    expect(message.text).toContain('capability_drift');
    expect(message.text).toContain('beta');
    expect(message.text).toContain('boom');

    expect(message.html).toContain('<ul>');
    expect(message.html).toContain('<li>');
    expect(message.html).toContain('alpha');
    expect(message.html).toContain('capability_drift');
  });
});
