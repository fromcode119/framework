import { render, screen } from '@testing-library/react';
import { FieldRendererFooter } from '@/components/collection/field-renderer-footer';
import { FieldProvenance } from '@/lib/collection/field-provenance';
import type { IFieldFallbackRule } from '@/lib/collection/interfaces/field-fallback-rule.interface';

/**
 * Renders the real footer, so this asserts what an operator SEES under an empty field — not just what
 * the resolver computed. This is the check that would have caught product 6 publishing a 10–15 day
 * delivery window with nothing on the product screen naming its source.
 */
describe('FieldRendererFooter provenance line', () => {
  const field: any = { name: 'leadTimeMinDays', type: 'number' };
  const HREF = '/admin/plugins/ecommerce/settings';

  /** The plugin's real settings schema shape: the single source of each setting's label and tab. */
  const SCHEMA = {
    tabs: [{ id: 'delivery', label: 'Delivery' }],
    fields: [
      { name: 'leadTimeDefaultMinDays', label: 'Made-to-order lead time — default min (working days)', tab: 'delivery' },
      { name: 'standardDispatchMinDays', label: 'In-stock dispatch — min (working days)', tab: 'delivery' },
    ],
  };

  const rules: IFieldFallbackRule[] = [
    {
      when: { field: 'madeToOrder', equals: true },
      settingKey: 'leadTimeDefaultMinDays',
      emptyMeans: 'no preparation window is shown.',
    },
    {
      when: { field: 'madeToOrder', equals: false },
      settingKey: 'standardDispatchMinDays',
      emptyMeans: 'no delivery window is shown for this product.',
    },
  ];

  const footer = (value: unknown, record: Record<string, any>, settings: Record<string, any>) => (
    <FieldRendererFooter
      field={field}
      resolvedFieldDescription=""
      provenance={FieldProvenance.resolve(rules, value, record, settings, HREF, SCHEMA)}
    />
  );

  it('names the value AND the setting when an empty field inherits', () => {
    render(footer('', { madeToOrder: 1 }, { leadTimeDefaultMinDays: 10 }));

    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText(/Made-to-order lead time — default min/)).toBeTruthy();
    const link = screen.getByRole('link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(HREF);
    expect(link.textContent).toContain('Delivery');
  });

  it('says nothing is shown when the inherited setting is itself blank', () => {
    render(footer('', { madeToOrder: 0 }, { standardDispatchMinDays: '' }));

    expect(screen.getByText(/no delivery window is shown for this product/)).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('stays silent when the operator set their own value', () => {
    const { container } = render(footer(7, { madeToOrder: 1 }, { leadTimeDefaultMinDays: 10 }));

    expect(container.textContent).toBe('');
  });

  it('renders nothing at all for a field that declares no fallback', () => {
    const { container } = render(
      <FieldRendererFooter field={field} resolvedFieldDescription="" provenance={null} />,
    );

    expect(container.textContent).toBe('');
  });
});
