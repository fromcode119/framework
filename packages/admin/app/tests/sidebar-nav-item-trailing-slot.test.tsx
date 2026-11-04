import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SlotsContext } from '@fromcode119/react';
import { NavItemView } from '@/app/components/view/sidebar-nav-item-view.client';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

const Badge = ({ path, isMini }: { path: string; isMini: boolean }) => <b data-testid="badge">{`${path}:${isMini ? 'mini' : 'full'}`}</b>;
const Foreign = () => <b data-testid="foreign">x</b>;

const renderItem = (props: Record<string, unknown>) => render(
  <SlotsContext.Context.Provider value={{
    [NavItemView.trailingSlot('/pink-shop/orders')]: [
      { component: Badge, pluginSlug: 'pink-shop', priority: 1 } as any,
      { component: Foreign, pluginSlug: 'other', priority: 1 } as any,
    ],
  }}>
    <NavItemView label="Orders" href="/pink-shop/orders" rawPathname="/" {...props} />
  </SlotsContext.Context.Provider>,
);

describe('sidebar item trailing slot', () => {
  it('renders the owning plugin component, never another plugin\'s', () => {
    renderItem({ pluginSlug: 'pink-shop' });
    expect(screen.getByTestId('badge').textContent).toBe('/pink-shop/orders:full');
    expect(screen.queryByTestId('foreign')).toBeNull();
  });

  it('tells the component the sidebar is collapsed', () => {
    renderItem({ pluginSlug: 'pink-shop', isMini: true });
    expect(screen.getByTestId('badge').textContent).toBe('/pink-shop/orders:mini');
  });

  it('renders nothing for an item no plugin owns', () => {
    renderItem({});
    expect(screen.queryByTestId('badge')).toBeNull();
  });
});
