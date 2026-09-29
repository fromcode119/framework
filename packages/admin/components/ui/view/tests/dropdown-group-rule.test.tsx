import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { DropdownItemVariant } from '@/components/ui/enums/dropdown-item-variant.enum';

/**
 * The account menu's one rule sits above Sign out, and nowhere else.
 *
 * It used to fall on the last row of every group after the first, so the three-option language group
 * was split between its second and third choice — a line through the middle of one radio set.
 */
describe('Dropdown — group rule', () => {
  const noop = () => {};
  const items = [
    { label: 'View profile', onClick: noop },
    { label: 'Site default (English)', section: 'Language', selectable: true, selected: true, onClick: noop },
    { label: 'English', selectable: true, onClick: noop },
    { label: 'Български', selectable: true, onClick: noop },
    { label: 'vselenskiportal88', section: 'Sites', selectable: true, selected: true, scrolls: true, onClick: noop },
    { label: 'Add a site', onClick: noop },
    { label: 'Sign out', variant: DropdownItemVariant.DANGER, onClick: noop },
  ];

  it('draws a single rule, directly above the destructive action', () => {
    render(<Dropdown items={items} trigger={<span>Open</span>} />);
    fireEvent.click(screen.getByText('Open'));
    const rules = document.querySelectorAll('.h-px');
    expect(rules).toHaveLength(1);
    expect(rules[0]!.nextElementSibling?.getAttribute('title')).toBe('Sign out');
  });

  it('keeps Add a site and Sign out outside the scrolling site list', () => {
    render(<Dropdown items={items} trigger={<span>Open</span>} />);
    fireEvent.click(screen.getByText('Open'));
    const siteRow = document.querySelector('button[title="vselenskiportal88"]')!;
    const box = siteRow.closest('.overflow-y-auto.overscroll-contain');
    expect(box).not.toBeNull();
    expect(box!.querySelector('button[title="Add a site"]')).toBeNull();
    expect(box!.querySelector('button[title="Sign out"]')).toBeNull();
  });
});
