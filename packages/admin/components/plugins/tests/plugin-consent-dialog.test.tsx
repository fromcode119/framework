import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { AdminApi } from '@/lib/api';
import { AdminRuntimeContext } from '@/components/view/admin-runtime-context.client';
import { ThemeMode } from '@fromcode119/core/client';
import { PluginConsentDialog } from '@/components/plugins/view/plugin-consent-dialog.client';
import type { IPluginConsentSummary } from '@/components/plugins/interfaces/plugin-consent-summary.interface';

/**
 * The consent dialog is the only way a plugin gets approved. These pin what it promises the operator:
 * nothing is approved until they confirm they read it, what is sent back is exactly what was shown, and
 * a plugin that changed in the meantime is shown again rather than approved.
 */
vi.mock('@/lib/api', () => ({
  AdminApi: { get: vi.fn(), post: vi.fn(), getURL: vi.fn((path: string) => path), getBaseUrl: vi.fn().mockReturnValue('') },
}));

const summary = (extra: Partial<IPluginConsentSummary> = {}): IPluginConsentSummary => ({
  slug: 'courier', name: 'Courier', version: '2.1.0',
  entries: [
    { entry: 'network:any', kind: 'anyHost', host: '', risk: 'high', isNew: true },
    { entry: 'network:host:api.courier.example', kind: 'host', host: 'api.courier.example', risk: 'medium', isNew: true },
    { entry: 'hooks', kind: 'capability', host: '', risk: 'medium', isNew: false },
    { entry: 'i18n', kind: 'capability', host: '', risk: 'low', isNew: false },
  ],
  consent: ['hooks', 'i18n', 'network:any', 'network:host:api.courier.example'],
  requiresApproval: true, dropped: [], anyHostReason: 'Sends each label to the address you set.', invalidHosts: [],
  collections: ['shipments'], adminScreens: true, storefrontWidgets: 0, storefrontCode: false,
  isolated: true, memoryLimitMb: null, timeoutMs: null,
  ...extra,
});

const mount = (props: { summary: IPluginConsentSummary; onApproved?: (slug: string) => void }) =>
  render(
    <AdminRuntimeContext.context.Provider value={{ theme: ThemeMode.LIGHT, plugins: { triggerRefresh: vi.fn() }, collections: [] } as any}>
      <PluginConsentDialog summary={props.summary} onClose={vi.fn()} onApproved={props.onApproved ?? vi.fn()} />
    </AdminRuntimeContext.context.Provider>,
  );

describe('the plugin consent dialog', () => {
  beforeEach(() => {
    vi.mocked(AdminApi.post).mockReset();
  });

  it('shows each host and the plugin\'s own reason for reaching every host', () => {
    mount({ summary: summary() });

    expect(screen.getByText(/api\.courier\.example/)).toBeTruthy();
    expect(screen.getByText(/Sends each label to the address you set\./)).toBeTruthy();
  });

  it('keeps Approve disabled until the operator confirms they read it', () => {
    mount({ summary: summary() });
    const approve = screen.getByRole('button', { name: /Approve and turn on/ });

    expect((approve as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox'));
    expect((approve as HTMLButtonElement).disabled).toBe(false);
  });

  it('sends back exactly the list it showed', async () => {
    const onApproved = vi.fn();
    vi.mocked(AdminApi.post).mockResolvedValue({ success: true });
    mount({ summary: summary(), onApproved });

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Approve and turn on/ }));

    await waitFor(() => expect(onApproved).toHaveBeenCalledWith('courier'));
    expect(vi.mocked(AdminApi.post).mock.calls[0][1]).toEqual({ enabled: true, approve: summary().consent });
  });

  it('shows the new request when the plugin changed since the dialog opened, instead of approving', async () => {
    const onApproved = vi.fn();
    const changed = summary({ entries: [...summary().entries, { entry: 'email', kind: 'capability', host: '', risk: 'medium', isNew: true }] });
    vi.mocked(AdminApi.post).mockImplementation(async () => {
      throw Object.assign(new Error('needs approval'), { data: { code: 'PLUGIN_CONSENT_REQUIRED', summary: changed } });
    });
    mount({ summary: summary(), onApproved });

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Approve and turn on/ }));

    await waitFor(() => expect(screen.getByText(/request changed since you opened this/)).toBeTruthy());
    expect(screen.getByText(/Sends email/)).toBeTruthy();
    expect(onApproved).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: /Approve and turn on/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
