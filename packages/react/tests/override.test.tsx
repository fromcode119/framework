import { render, screen } from '@testing-library/react';
import { Reactor } from '@fromcode119/react-class-components';
import { Override } from '@react/view/override.client';
import { OverridesContext } from '@react/context/overrides-context';

/**
 * Reproduces the verify-pass finding: a registered override component that throws in
 * `componentDidMount` must fall back to the caller's own children (`content`), the same fallback the
 * other three failure paths (no component registered, invalid component type, synchronous throw)
 * already return. Before the fix, `PluginMountErrorBoundary` was rendered with no `renderFallback`
 * prop, so a lifecycle throw fell through to `?? null` and discarded `content` even though it was
 * sitting right there.
 */
class ThrowsOnMount extends Reactor {
  componentDidMount(): void {
    throw new Error('override component crashed on mount');
  }

  render(): null {
    return null;
  }
}

describe('Override', () => {
  it('renders the children fallback when a registered override component throws on mount', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <OverridesContext.Context.Provider
        value={{
          'frontend.layout.main': { component: ThrowsOnMount, priority: 0, pluginSlug: 'broken-plugin' },
        }}
      >
        <Override name="frontend.layout.main">
          <div data-testid="original-content">original storefront body</div>
        </Override>
      </OverridesContext.Context.Provider>,
    );

    expect(screen.getByTestId('original-content')).toBeTruthy();
    expect(screen.getByText('original storefront body')).toBeTruthy();

    consoleErrorSpy.mockRestore();
  });

  it('renders the explicit fallback prop (not children) when a registered override throws on mount', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <OverridesContext.Context.Provider
        value={{
          'frontend.layout.main': { component: ThrowsOnMount, priority: 0, pluginSlug: 'broken-plugin' },
        }}
      >
        <Override name="frontend.layout.main" fallback={<div data-testid="explicit-fallback">fallback body</div>} />
      </OverridesContext.Context.Provider>,
    );

    expect(screen.getByTestId('explicit-fallback')).toBeTruthy();

    consoleErrorSpy.mockRestore();
  });
});
