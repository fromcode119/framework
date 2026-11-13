import { render, screen } from '@testing-library/react';
import { ThemeMode } from '@fromcode119/core/client';
import { FieldRendererHeader } from '@/components/collection/field-renderer-header';

/**
 * `admin.hideLabel` suppresses the renderer's own label row.
 *
 * It exists for a control that prints its own heading — a summary that already names every line it
 * holds — where the renderer's label would be the same word twice, stacked. The order totals block
 * hit exactly that: "Subtotal" above a summary whose first row is "Subtotal".
 *
 * The option was READ here and declared in no interface at all, so nothing typed it and nothing
 * tested it: a rename or a stray refactor would have silently brought every suppressed label back,
 * and the only symptom would be a duplicated word on someone else's screen.
 */
const baseProps = {
  theme: ThemeMode.LIGHT,
  isFieldReadOnly: false,
  supportsReadOnlyOverride: false,
  readOnlyOverrideGranted: false,
  canRequestReadOnlyOverride: false,
  isLocalizedField: false,
  componentHandlesLocalization: false,
  shouldInlineLocaleSwitcher: false,
  onRequestReadOnlyOverride: () => {},
  localeSwitcher: () => null,
};

describe('FieldRendererHeader — hideLabel', () => {
  it('renders the label by default', () => {
    render(<FieldRendererHeader {...baseProps} field={{ name: 'subtotal', type: 'number' } as any} label="Subtotal" />);
    expect(screen.getByText('Subtotal')).toBeInTheDocument();
  });

  it('suppresses the label when the field declares hideLabel', () => {
    render(<FieldRendererHeader {...baseProps} field={{ name: 'subtotal', type: 'number', admin: { hideLabel: true } } as any} label="Subtotal" />);
    expect(screen.queryByText('Subtotal')).not.toBeInTheDocument();
  });

  it('keeps the lock beside a hidden label when the lock can be opened', () => {
    render(
      <FieldRendererHeader
        {...baseProps}
        isFieldReadOnly
        canRequestReadOnlyOverride
        field={{ name: 'total', type: 'number', admin: { hideLabel: true } } as any}
        label="Total"
      />,
    );
    expect(screen.queryByText('Total')).not.toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  /** A lock with no label beside it that opens nothing was a lone icon hanging above the control. */
  it('draws no row for a locked field with a hidden label that cannot be unlocked', () => {
    const { container } = render(
      <FieldRendererHeader
        {...baseProps}
        isFieldReadOnly
        field={{ name: 'stock', type: 'number', admin: { hideLabel: true } } as any}
        label="Stock"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  /** A field that does not declare it keeps its label even when its neighbour suppresses one. */
  it('does not leak the suppression to other fields', () => {
    render(<FieldRendererHeader {...baseProps} field={{ name: 'note', type: 'text', admin: {} } as any} label="Note" />);
    expect(screen.getByText('Note')).toBeInTheDocument();
  });
});
