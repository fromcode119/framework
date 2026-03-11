
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PluginSettingsForm from './plugin-settings-form';
import { vi } from 'vitest';
import { AdminApi } from '@/lib/api';

// Mock dependecies
vi.mock('@fromcode119/react', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    usePlugins: () => ({
      triggerRefresh: vi.fn(),
    }),
  };
});

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    getURL: vi.fn((path) => `http://localhost:3000${path}`),
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

vi.mock('@/components/theme-context', () => ({
  useTheme: () => ({ theme: 'light' })
}));

vi.mock('@/components/collection/field-renderer', () => ({
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
    render(<PluginSettingsForm pluginSlug={pluginSlug} />);
    
    // Wait for the loading to finish
    await waitFor(() => expect(screen.queryByText('Site Name')).toBeDefined());

    // Check tabs
    expect(screen.getByText('General')).toBeDefined();
    expect(screen.getByText('Advanced')).toBeDefined();
  });

  it('switches tabs and shows correct fields', async () => {
    render(<PluginSettingsForm pluginSlug={pluginSlug} />);
    
    await waitFor(() => screen.getByText('Site Name'));
    
    // Only Site Name should be visible in General tab
    expect(screen.queryByText('Posts Per Page')).toBeNull();
    
    // Switch to Advanced
    fireEvent.click(screen.getByText('Advanced'));
    
    expect(screen.getByText('Posts Per Page')).toBeDefined();
    expect(screen.queryByText('Site Name')).toBeNull();
  });

  it('updates state when field changes', async () => {
    render(<PluginSettingsForm pluginSlug={pluginSlug} />);
    
    await waitFor(() => screen.getByTestId('input-siteName'));
    
    const input = screen.getByTestId('input-siteName') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New Name' } });
    
    expect(input.value).toBe('New Name');
    expect(screen.getByText(/Unsaved changes/i)).toBeDefined();
  });

  it('calls AdminApi.put when saving', async () => {
    (AdminApi.put as any).mockResolvedValue({ success: true });
    window.alert = vi.fn();

    render(<PluginSettingsForm pluginSlug={pluginSlug} />);
    
    await waitFor(() => screen.getByTestId('input-siteName'));
    
    const input = screen.getByTestId('input-siteName');
    fireEvent.change(input, { target: { value: 'New Name' } });
    
    const saveButton = screen.getByRole('button', { name: /Save Settings/i });
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(AdminApi.put).toHaveBeenCalledWith(expect.stringContaining(`/plugins/${pluginSlug}/settings`), expect.objectContaining({
        siteName: 'New Name'
      }));
    });
  });

  it('calls AdminApi.post when resetting', async () => {
    (AdminApi.post as any).mockResolvedValue({ settings: { siteName: 'default' } });
    window.confirm = vi.fn().mockReturnValue(true);

    render(<PluginSettingsForm pluginSlug={pluginSlug} />);
    
    await waitFor(() => screen.getByText('Reset'));
    
    const resetButton = screen.getByText('Reset');
    fireEvent.click(resetButton);
    
    await waitFor(() => {
      expect(AdminApi.post).toHaveBeenCalledWith(expect.stringContaining(`/plugins/${pluginSlug}/settings/reset`));
    });
  });

  it('handles export by opening new window', async () => {
    window.open = vi.fn();
    render(<PluginSettingsForm pluginSlug={pluginSlug} />);
    
    await waitFor(() => screen.getByText('Export'));
    
    const exportButton = screen.getByText('Export');
    fireEvent.click(exportButton);
    
    expect(window.open).toHaveBeenCalledWith(expect.stringContaining(`/plugins/${pluginSlug}/settings/export`), '_blank');
  });
});
