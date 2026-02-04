
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PluginSettingsForm } from './PluginSettingsForm';
import { vi } from 'vitest';
import { api } from '@/lib/api';

// Mock dependecies
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    getBaseUrl: vi.fn().mockReturnValue('http://localhost:3000/api')
  }
}));

vi.mock('@/components/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' })
}));

vi.mock('@/components/collection/FieldRenderer', () => ({
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

describe('PluginSettingsForm', () => {
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
    (api.get as any).mockImplementation((url: string) => {
      if (url.includes('schema')) return Promise.resolve(mockSchema);
      return Promise.resolve(mockSettings);
    });
  });

  it('renders loading state then settings form', async () => {
    render(<PluginSettingsForm pluginSlug="cms" />);
    
    // Wait for the loading to finish
    await waitFor(() => expect(screen.queryByText('Site Name')).toBeDefined());

    // Check tabs
    expect(screen.getByText('General')).toBeDefined();
    expect(screen.getByText('Advanced')).toBeDefined();
  });

  it('switches tabs and shows correct fields', async () => {
    render(<PluginSettingsForm pluginSlug="cms" />);
    
    await waitFor(() => screen.getByText('Site Name'));
    
    // Only Site Name should be visible in General tab
    expect(screen.queryByText('Posts Per Page')).toBeNull();
    
    // Switch to Advanced
    fireEvent.click(screen.getByText('Advanced'));
    
    expect(screen.getByText('Posts Per Page')).toBeDefined();
    expect(screen.queryByText('Site Name')).toBeNull();
  });

  it('updates state when field changes', async () => {
    render(<PluginSettingsForm pluginSlug="cms" />);
    
    await waitFor(() => screen.getByTestId('input-siteName'));
    
    const input = screen.getByTestId('input-siteName') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New Name' } });
    
    expect(input.value).toBe('New Name');
    expect(screen.getByText(/Unsaved changes/i)).toBeDefined();
  });

  it('calls api.put when saving', async () => {
    (api.put as any).mockResolvedValue({ success: true });
    window.alert = vi.fn();

    render(<PluginSettingsForm pluginSlug="cms" />);
    
    await waitFor(() => screen.getByTestId('input-siteName'));
    
    const input = screen.getByTestId('input-siteName');
    fireEvent.change(input, { target: { value: 'New Name' } });
    
    const saveButton = screen.getByRole('button', { name: /Save Settings/i });
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/plugins/cms/settings', expect.objectContaining({
        siteName: 'New Name'
      }));
    });
  });

  it('calls api.post when resetting', async () => {
    (api.post as any).mockResolvedValue({ settings: { siteName: 'default' } });
    window.confirm = vi.fn().mockReturnValue(true);

    render(<PluginSettingsForm pluginSlug="cms" />);
    
    await waitFor(() => screen.getByText('Reset'));
    
    const resetButton = screen.getByText('Reset');
    fireEvent.click(resetButton);
    
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/plugins/cms/settings/reset');
    });
  });

  it('handles export by opening new window', async () => {
    window.open = vi.fn();
    render(<PluginSettingsForm pluginSlug="cms" />);
    
    await waitFor(() => screen.getByText('Export'));
    
    const exportButton = screen.getByText('Export');
    fireEvent.click(exportButton);
    
    expect(window.open).toHaveBeenCalledWith(expect.stringContaining('/plugins/cms/settings/export'), '_blank');
  });
});
