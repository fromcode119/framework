import { render, screen } from '@testing-library/react';
import { Reactor } from '@fromcode119/react-class-components';
import { PluginMountErrorBoundary } from '@react/view/plugin-mount-error-boundary';

/**
 * Reproduces the production incident: a plugin/theme component throws in `componentDidMount`
 * (exactly the shape of the crash that blanked the whole storefront once). This asserts the boundary
 * contains that throw to its own subtree — the sibling block on the same page must keep rendering.
 */
class ThrowsOnMount extends Reactor {
  componentDidMount(): void {
    throw new Error('plugin API stand-in has no such method');
  }

  render(): null {
    return null;
  }
}

class HealthySibling extends Reactor {
  render() {
    return <div data-testid="healthy-sibling">healthy block</div>;
  }
}

describe('PluginMountErrorBoundary', () => {
  it('keeps a healthy sibling rendering when another slot component throws on mount', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <>
        <PluginMountErrorBoundary slotName="footer" pluginSlug="broken-plugin" componentName="ThrowsOnMount">
          <ThrowsOnMount />
        </PluginMountErrorBoundary>
        <PluginMountErrorBoundary slotName="footer" pluginSlug="ok-plugin" componentName="HealthySibling">
          <HealthySibling />
        </PluginMountErrorBoundary>
      </>,
    );

    expect(screen.getByTestId('healthy-sibling')).toBeTruthy();
    expect(screen.getByText('healthy block')).toBeTruthy();

    consoleErrorSpy.mockRestore();
  });

  it('logs the slot/plugin/component identity loudly on catch, and renders nothing for that subtree', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { container } = render(
      <PluginMountErrorBoundary slotName="footer" pluginSlug="broken-plugin" componentName="ThrowsOnMount">
        <ThrowsOnMount />
      </PluginMountErrorBoundary>,
    );

    expect(container.textContent).toBe('');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('slot="footer" plugin="broken-plugin" component="ThrowsOnMount"'),
      expect.any(Error),
      expect.anything(),
    );

    consoleErrorSpy.mockRestore();
  });
});
