import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdminRuntimeContext } from '@/components/admin-runtime-context';
import { AdminShellRegistry } from '@/lib/appearance/admin-shell-registry';
import AppearanceShellHost from './appearance-shell-host';

function SimpleShell({ children }: { children: React.ReactNode }) {
  return <div data-testid="simple-shell">{children}</div>;
}

describe('AppearanceShellHost', () => {
  it('renders the active appearance\'s registered shell, wrapping the page', () => {
    AdminShellRegistry.shared.register('simple', SimpleShell);
    render(
      <AdminRuntimeContext.context.Provider value={{ activeAppearanceId: 'simple' } as any}>
        <AppearanceShellHost><div>PAGE</div></AppearanceShellHost>
      </AdminRuntimeContext.context.Provider>
    );
    expect(screen.getByTestId('simple-shell')).toBeInTheDocument();
    expect(screen.getByText('PAGE')).toBeInTheDocument();
  });
});
