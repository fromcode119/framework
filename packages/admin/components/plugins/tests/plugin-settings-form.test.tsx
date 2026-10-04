
import { createRef } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PluginSettingsForm } from '@/components/plugins/view/plugin-settings-form.client';
import { vi } from 'vitest';
import { AdminApi } from '@/lib/api';
import { AdminRuntimeContext } from '@/components/view/admin-runtime-context.client';
import { ThemeMode } from '@fromcode119/core/client';

/**
 * The form is a hook-free {@link AdminComponent}: it reads the plugin registry as
 * `this.runtime.plugins.triggerRefresh` off {@link AdminRuntimeContext}, NOT via
 * `ContextHooks.usePlugins()`. Rendering it bare leaves `this.context` at the context's `null`
 * default, so every post-save `triggerRefresh()` threw and was swallowed by the component's own
 * catch — the tests stayed green while the refresh path went completely unexercised. Mounting
 * inside the provider is what actually exercises it.
 *
 * `theme` must be a real {@link ThemeMode} member, not the raw string `'light'`: ThemeMode is a
 * reactor `Enum`, and `enumMember === 'light'` is always false.
 */
const triggerRefresh = vi.fn();
const onStateChange = vi.fn();
/** The page header drives the form from outside: Save submits it by id, Export/Import/Reset go through this handle. */
const formRef = createRef<PluginSettingsForm>();

const renderForm = (props: { pluginSlug: string }) =>
  render(
    <AdminRuntimeContext.context.Provider
      value={{ theme: ThemeMode.LIGHT, plugins: { triggerRefresh }, collections: [] } as any}
    >
      <PluginSettingsForm {...props} ref={formRef} formId="plugin-settings-form" onStateChange={onStateChange} />
    </AdminRuntimeContext.context.Provider>
  );

/** What the header's Save button does: it is a `type="submit"` tied to the form by `form=`. */
const save = () => fireEvent.submit(document.getElementById('plugin-settings-form') as HTMLFormElement);

vi.mock('@/lib/api', () => ({
  AdminApi: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    getURL: vi.fn((path: string) => `http://localhost:3000${path}`),
    getBaseUrl: vi.fn().mockReturnValue('http://localhost:3000/api')
  }
}));

vi.mock('@/lib/constants', async () => {
  const actual = await vi.importActual('@/lib/constants') as any;
  return {
    ...actual,
    // Ensure we use the real ENDPOINTS so paths match the component
  };
});

vi.mock('@/components/collection/view/field-renderer.client', () => ({
  FieldRenderer: ({ field, value, onChange }: any) => (
    <div data-testid={`field-${field.name}`}>
      <label>{field.label || field.name}</label>
      <input 
        value={value || ''} 
        onChange={(e) => onChange(e.target.value)} 
        data-testid={`input-${field.name}`}
      />
    </div>
  )
}));

describe('./plugin-settings-form', () => {
  const pluginSlug = 'sample-plugin';
  const mockSchema = {
    fields: [
      { name: 'siteName', label: 'Site Name', type: 'text' },
      { name: 'postsPerPage', label: 'Posts Per Page', type: 'number' }
    ],
    tabs: [
      { id: 'general', label: 'General', fields: ['siteName'] },
      { id: 'advanced', label: 'Advanced', fields: ['postsPerPage'] }
    ]
  };

  const mockSettings = {
    settings: {
      siteName: 'My Awesome Site',
      postsPerPage: 10
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (AdminApi.get as any).mockImplementation((url: string) => {
      if (url.includes('schema')) return Promise.resolve(mockSchema);
      return Promise.resolve(mockSettings);
    });
  });

  it('renders loading state then settings form', async () => {
    renderForm({ pluginSlug });
    
    // Wait for the loading to finish
    await waitFor(() => expect(screen.queryByText('Site Name')).toBeDefined());

    // Check tabs — the open one's label is also the section heading, so ask for the tab buttons.
    expect(screen.getByRole('button', { name: 'General' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Advanced' })).toBeDefined();
  });

  it('switches tabs and shows correct fields', async () => {
    renderForm({ pluginSlug });
    
    await waitFor(() => screen.getByText('Site Name'));
    
    // Only Site Name should be visible in General tab
    expect(screen.queryByText('Posts Per Page')).toBeNull();
    
    // Switch to Advanced
    fireEvent.click(screen.getByText('Advanced'));
    
    expect(screen.getByText('Posts Per Page')).toBeDefined();
    expect(screen.queryByText('Site Name')).toBeNull();
  });

  it('updates state when field changes', async () => {
    renderForm({ pluginSlug });
    
    await waitFor(() => screen.getByTestId('input-siteName'));
    
    const input = screen.getByTestId('input-siteName') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New Name' } });
    
    expect(input.value).toBe('New Name');
    // The header shows "Unsaved changes" and enables Save from what the form reports.
    expect(onStateChange).toHaveBeenLastCalledWith(true, false);
  });

  it('calls AdminApi.put when saving', async () => {
    (AdminApi.put as any).mockResolvedValue({ success: true });
    window.alert = vi.fn();

    renderForm({ pluginSlug });
    
    await waitFor(() => screen.getByTestId('input-siteName'));
    
    const input = screen.getByTestId('input-siteName');
    fireEvent.change(input, { target: { value: 'New Name' } });
    
    save();
    
    await waitFor(() => {
      expect(AdminApi.put).toHaveBeenCalledWith(expect.stringContaining(`/plugins/${pluginSlug}/settings`), expect.objectContaining({
        siteName: 'New Name'
      }));
    });

    // The save must also refresh the plugin registry so the rest of the admin picks up the change.
    await waitFor(() => expect(triggerRefresh).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/Settings saved successfully/i)).toBeDefined();
  });

  it('does not refresh the plugin registry when saving fails', async () => {
    (AdminApi.put as any).mockRejectedValue(Object.assign(new Error('Boom'), { status: 500 }));
    // The component logs the rejection itself; capture it so the expected failure is asserted
    // rather than printed as stray stderr.
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderForm({ pluginSlug });

    await waitFor(() => screen.getByTestId('input-siteName'));
    fireEvent.change(screen.getByTestId('input-siteName'), { target: { value: 'New Name' } });
    save();

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Not saved: Boom'));
    expect(triggerRefresh).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalledWith('Save error:', expect.objectContaining({ message: 'Boom' }));
    logged.mockRestore();
  });

  it('names the refused fields, even when they sit on another tab', async () => {
    (AdminApi.put as any).mockRejectedValue(Object.assign(new Error('Bad Request'), {
      status: 400,
      data: { errors: { postsPerPage: 'Too many.' } },
    }));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderForm({ pluginSlug });

    await waitFor(() => screen.getByTestId('input-siteName'));
    fireEvent.change(screen.getByTestId('input-siteName'), { target: { value: 'New Name' } });
    save();

    // The field sits on the other tab: the form must still say which one to correct.
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Not saved — correct: Posts Per Page'));
    logged.mockRestore();
  });

  it('calls AdminApi.post when resetting', async () => {
    (AdminApi.post as any).mockResolvedValue({ settings: { siteName: 'default' } });
    window.confirm = vi.fn().mockReturnValue(true);

    renderForm({ pluginSlug });
    
    await waitFor(() => screen.getByTestId('input-siteName'));
    formRef.current?.resetSettings();
    
    await waitFor(() => {
      expect(AdminApi.post).toHaveBeenCalledWith(expect.stringContaining(`/plugins/${pluginSlug}/settings/reset`));
    });

    // Reset takes the same refresh path as save, and was equally unexercised before.
    await waitFor(() => expect(triggerRefresh).toHaveBeenCalledTimes(1));
  });

  it('handles export by opening new window', async () => {
    window.open = vi.fn();
    renderForm({ pluginSlug });
    
    await waitFor(() => screen.getByTestId('input-siteName'));
    formRef.current?.exportSettings();
    
    expect(window.open).toHaveBeenCalledWith(expect.stringContaining(`/plugins/${pluginSlug}/settings/export`), '_blank');
  });
});
