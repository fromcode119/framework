import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EditSheet } from '@/components/ui/view/edit-sheet.client';
import { EditSheetUnsaved } from '@/components/ui/view/edit-sheet-unsaved';

vi.mock('@fromcode119/react', async () => {
  const React = await import('react');
  const MockIcon = () => <div data-testid="mock-icon" />;
  return {
    FrameworkIcons: new Proxy({}, { get: () => MockIcon }),
    PluginComponent: class extends React.Component<any> {},
    ContextHooks: { usePlugins: vi.fn(() => ({})) },
    Slot: ({ children }: any) => <div>{children}</div>,
  };
});

/**
 * An order's lines are changed by a correction the panel applies itself. The sheet's Save submitted the
 * form, which held none of it, reported success and closed — and the change the operator typed was gone.
 */
describe('a change the sheet does not save', () => {
  const sheet = (children: any, onSave = vi.fn()) => {
    render(<EditSheet isOpen title="Items" onClose={vi.fn()} onSave={onSave}>{children}</EditSheet>);
    return onSave;
  };

  it('holds Save and says what to do while it is on screen', () => {
    const onSave = sheet(<div {...EditSheetUnsaved.mark('Apply or discard the correction first')}>pending</div>);
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Apply or discard the correction first');
  });

  it('saves as before when nothing is pending', () => {
    const onSave = sheet(<div>fields</div>);
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
