import { render, screen } from '@testing-library/react';
import { StructuredReadOnlyField } from '@/components/collection/fields/view/structured-read-only-field.client';

/**
 * A carrier's answer nests six levels deep. Drawn as a heading per level it became a staircase that
 * filled the page; from the third level down the names are joined into the row's own label instead.
 */
describe('StructuredReadOnlyField, deeply nested values', () => {
  const value = {
    carrier: {
      codAmount: 481.48,
      responsePayload: { shipmentStatuses: { first: { status: 'Delivered', weight: 13 } } },
    },
  };

  it('keeps a heading for the first levels and joins the names below them', () => {
    render(<StructuredReadOnlyField value={value} field={{ name: 'providerData' }} />);
    expect(screen.getByRole('heading', { name: /Carrier/i })).toBeInTheDocument();
    expect(screen.getByText(/Shipment statuses › First › Status/i)).toBeInTheDocument();
    expect(screen.getByText('Delivered')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^First$/i })).toBeNull();
  });
});
