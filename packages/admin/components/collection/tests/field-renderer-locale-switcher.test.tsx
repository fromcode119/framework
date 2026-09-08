import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FieldRendererView } from '@/components/collection/field-renderer-view';

/**
 * Clicking the locale switcher must actually offer the languages.
 *
 * The switcher took its locale list from `plugins.settings`, which nothing supplies — not the admin
 * runtime provider, not `usePlugins()`, not the existing test mocks. So the registry was always empty:
 * the button rendered (it falls back to "EN"), clicking it toggled the menu open, and the menu mapped
 * over an empty array. From the outside that is indistinguishable from a dead button, which is exactly
 * how it was reported — twice, because the first two things I changed were not the cause.
 *
 * The locales live in `globalSettings.localization_locales` (Settings → Localization), which this same
 * component already receives as a prop and passes to its children.
 */
vi.mock('@fromcode119/react', async () => {
  const React = await import('react');
  const MockIcon = () => <div data-testid="mock-icon" />;
  return {
    PluginComponent: class extends React.Component<any> {
      get plugins() { return { collections: [], fieldComponents: {} }; }
      get collections() { return []; }
      get globalSettings() { return {}; }
    },
    ContextHooks: { usePlugins: vi.fn(() => ({ collections: [], fieldComponents: {} })) },
    Slot: ({ children }: any) => <div>{children}</div>,
    FrameworkIcons: {
      Alert: MockIcon, Refresh: MockIcon, Lock: MockIcon, Check: MockIcon,
      Globe: MockIcon, Down: MockIcon, Close: MockIcon,
    },
  };
});

const GLOBAL_SETTINGS = {
  localization_locales: [
    { code: 'en', name: 'English', enabled: true },
    { code: 'bg', name: 'Bulgarian', enabled: true },
  ],
  admin_default_locale: 'en',
};

function renderLocalizedField(globalSettings: Record<string, any>) {
  return render(
    <FieldRendererView
      field={{ name: 'siteName', label: 'Site name', type: 'text', localized: true } as any}
      value={{ en: 'Universe Portal', bg: 'Вселенски портал' }}
      onChange={vi.fn()}
      collectionSlug="settings-kappa"
      plugins={{ collections: [], fieldComponents: {} } as any}
      globalSettings={globalSettings}
    />,
  );
}

describe('localized field — the locale switcher offers the configured languages', () => {
  it('lists every configured locale once opened', () => {
    renderLocalizedField(GLOBAL_SETTINGS);

    const toggle = screen.getAllByRole('button').find((b) => /EN/i.test(b.textContent || ''));
    expect(toggle, 'no locale toggle rendered').toBeTruthy();
    fireEvent.click(toggle!);

    // The defect's signature: an open menu with nothing in it.
    expect(screen.getByText(/English/i)).toBeTruthy();
    expect(screen.getByText(/Bulgarian/i)).toBeTruthy();
  });

  it('shows no menu items before it is opened', () => {
    renderLocalizedField(GLOBAL_SETTINGS);
    expect(screen.queryByText(/Bulgarian/i)).toBeNull();
  });

  it('an install with no configured locales renders no switcher at all', () => {
    // Better to show nothing than a button that opens an empty box.
    const { container } = renderLocalizedField({});
    expect(container.textContent).not.toContain('Bulgarian');
  });
});
