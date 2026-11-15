import { render, screen } from '@testing-library/react';
import { NavItemView } from '@/app/components/view/sidebar-nav-item-view.client';

/**
 * A section's row opens one of the pages it is showing. The accounts list belongs to the platform and
 * is dropped inside a site, and it is also the Users section's own landing page — so the row would
 * have opened the one screen the menu had just decided not to offer.
 */
// jsdom has no scrollIntoView; the menu reveals the open page with it.
beforeAll(() => { (Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {}; });

const pages = [
  { path: '/users/people', label: 'People' },
  { path: '/users/roles', label: 'Roles' },
];

describe('a section row', () => {
  it('opens its first page when its own is not among them', () => {
    render(<NavItemView icon={null} label="Users" href="/users" subItems={pages} rawPathname="/users/people" active />);
    expect(screen.getByRole('link', { name: /Users/ })).toHaveAttribute('href', expect.stringContaining('/users/people'));
  });

  it('keeps its own page when it is one of them', () => {
    render(<NavItemView icon={null} label="Users" href="/users/roles" subItems={pages} rawPathname="/users/roles" active />);
    expect(screen.getByRole('link', { name: /Users/ })).toHaveAttribute('href', expect.stringContaining('/users/roles'));
  });
});
