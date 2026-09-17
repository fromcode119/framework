import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Select } from '@/components/ui/view/select.client';

/**
 * `isLoading` exists because six plugin fields were already passing it to a component that did not
 * declare it — React dropped the prop, so a select whose options were still in flight rendered as an
 * ordinary EMPTY menu, which reads as "nothing to choose" rather than "not yet".
 *
 * What the contract has to hold: the trigger is inert while loading (opening an empty menu is the
 * failure being fixed), and the affordance says so instead of showing the chevron.
 */
vi.mock('@fromcode119/react', async () => {
  const React = await import('react');
  const MockIcon = () => <div data-testid="chevron" />;
  return {
    FrameworkIcons: new Proxy({}, { get: () => MockIcon }),
    PluginComponent: class extends React.Component<any> {},
    ContextHooks: { usePlugins: vi.fn(() => ({})) },
    Slot: ({ children }: any) => <div>{children}</div>,
  };
});

describe('Select isLoading', () => {
  it('shows the chevron and stays operable when it is not loading', () => {
    render(<Select value="" onChange={() => {}} options={[{ label: 'One', value: '1' }]} placeholder="Pick" />);
    expect(screen.getByTestId('chevron')).toBeTruthy();
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false);
    expect(document.querySelector('.animate-spin')).toBeNull();
  });

  it('replaces the chevron and refuses to open while the options are loading', () => {
    render(<Select value="" onChange={() => {}} options={[]} placeholder="Pick" isLoading />);
    expect(screen.queryByTestId('chevron')).toBeNull();
    const trigger = screen.getByRole('button');
    expect((trigger as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(trigger);
    expect(screen.queryByText('Pick')).toBeTruthy();
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });
});
