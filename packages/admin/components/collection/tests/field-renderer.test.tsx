import { ThemeMode } from '@fromcode119/core/client';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FieldRenderer } from '@/components/collection/view/field-renderer.client';

// Mock usePlugins
vi.mock('@fromcode119/react', async () => {
  const React = await import('react');
  const MockIcon = () => <div data-testid="mock-icon" />;
  return {
    /**
     * `FieldRenderer` is a `PluginComponent` subclass, so the mock has to supply a real base CLASS —
     * the suite omitted it and failed at import. It never surfaced because no vitest project collected
     * `.tsx` files, so this suite had never run at all.
     */
    PluginComponent: class extends React.Component<any> {
      get plugins() { return { collections: [], fieldComponents: {} }; }
      get collections() { return []; }
      get globalSettings() { return {}; }
    },
    ContextHooks: {
      usePlugins: vi.fn(() => ({
        collections: [],
        fieldComponents: {}
      })),
    },
    Slot: ({ children }: any) => <div>{children}</div>,
    FrameworkIcons: {
      Alert: MockIcon,
      Refresh: MockIcon,
      Lock: MockIcon,
      Check: MockIcon,
      Globe: MockIcon,
      Down: MockIcon,
      Close: MockIcon,
    }
  };
});

// Mock the UI components used by FieldRenderer
vi.mock('@/components/ui/view/input.client', () => ({
  Input: ({ onChange, value, placeholder }: any) => (
    <input 
      data-testid="mock-input" 
      value={value} 
      placeholder={placeholder}
      onChange={onChange} 
    />
  )
}));

vi.mock('@/components/ui/view/select.client', () => ({
  Select: ({ onChange, value, options }: any) => (
    <select data-testid="mock-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}));

describe('./field-renderer', () => {
  it('renders a text input for text type', () => {
    const field: any = { name: 'title', type: 'text', label: 'Title' };
    const onChange = vi.fn();
    
    render(
      <FieldRenderer 
        field={field} 
        value="" 
        onChange={onChange} 
        theme={ThemeMode.LIGHT} 
        collectionSlug="posts" 
      />
    );

    const input = screen.getByTestId('mock-input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'Enter Title...');
  });

  it('renders a textarea for textarea type', () => {
    const field: any = { name: 'content', type: 'textarea' };
    render(
      <FieldRenderer 
        field={field} 
        value="" 
        onChange={vi.fn()} 
        theme={ThemeMode.LIGHT} 
        collectionSlug="posts" 
      />
    );

    expect(screen.getByPlaceholderText('Enter Content...')).toBeInTheDocument();
  });

  it('renders a select for select type', () => {
    const field: any = { 
      name: 'status', 
      type: 'select', 
      options: [{ label: 'Draft', value: 'draft' }] 
    };
    render(
      <FieldRenderer 
        field={field} 
        value="draft" 
        onChange={vi.fn()} 
        theme={ThemeMode.LIGHT} 
        collectionSlug="posts" 
      />
    );

    expect(screen.getByTestId('mock-select')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('displays required asterisk if field is required', () => {
    const field: any = { name: 'title', type: 'text', required: true };
    render(
      <FieldRenderer 
        field={field} 
        value="" 
        onChange={vi.fn()} 
        theme={ThemeMode.LIGHT} 
        collectionSlug="posts" 
      />
    );

    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('shows slug warning if provided', () => {
    const field: any = { name: 'slug', type: 'text' };
    render(
      <FieldRenderer 
        field={field} 
        value="test" 
        onChange={vi.fn()} 
        theme={ThemeMode.LIGHT} 
        collectionSlug="posts" 
        slugWarning="Already taken"
      />
    );

    expect(screen.getByText('Already taken')).toBeInTheDocument();
  });

  it('renders a toggle (not a select) for checkbox type and reports changes', () => {
    const onChange = vi.fn();
    const field: any = {
      name: 'required',
      type: 'checkbox',
      label: 'Required Add-on'
    };
    render(
      <FieldRenderer
        field={field}
        value={false}
        onChange={onChange}
        theme={ThemeMode.LIGHT}
        collectionSlug="products"
      />
    );

    // Booleans render the BooleanToggleField switch, never a select (CLAUDE.md: boolean -> toggle).
    const toggle = screen.getByRole('switch');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('No')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-select')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('allows requesting a password override for read-only fields by default', () => {
    const onReadOnlyOverrideRequest = vi.fn();
    render(
      <FieldRenderer
        field={{ name: 'invoiceNumber', type: 'text', label: 'Invoice Number', admin: { readOnly: true } } as any}
        value="INV-001"
        onChange={vi.fn()}
        theme={ThemeMode.LIGHT}
        collectionSlug="invoices"
        onReadOnlyOverrideRequest={onReadOnlyOverrideRequest}
      />
    );

    // The affordance is the header's "Unlock edit" control. It used to be an invisible overlay laid
    // across the whole field, which said nothing the header did not and swallowed every click inside
    // the value — links, copy buttons, a table's scroll. What must not regress is the CAPABILITY.
    fireEvent.click(screen.getByTitle('Unlock "Invoice Number" to edit'));

    expect(onReadOnlyOverrideRequest).toHaveBeenCalledWith({
      name: 'invoiceNumber',
      label: 'Invoice Number'
    });
  });

  it('shows a read-only value as text rather than in an input', () => {
    render(
      <FieldRenderer
        field={{ name: 'trackingNumber', type: 'text', label: 'Tracking Number', admin: { readOnly: true } } as any}
        value="1051234567890"
        onChange={vi.fn()}
        theme={ThemeMode.LIGHT}
        collectionSlug="orders"
        onReadOnlyOverrideRequest={vi.fn()}
      />
    );

    expect(screen.getByText('1051234567890')).toBeInTheDocument();
    expect(document.querySelector('input')).toBeNull();
  });

  /**
   * The provenance belongs in the lock bar, not in a line below the field AS WELL. Printed in both
   * places it is the same sentence twice on one field, a few pixels apart.
   */
  it('shows who writes a read-only value once, in the lock bar', () => {
    render(
      <FieldRenderer
        field={{
          name: 'trackingNumber',
          type: 'text',
          label: 'Tracking Number',
          admin: { readOnly: true, description: 'Set by the logistics plugin.' },
        } as any}
        value=""
        onChange={vi.fn()}
        theme={ThemeMode.LIGHT}
        collectionSlug="orders"
        onReadOnlyOverrideRequest={vi.fn()}
      />
    );

    expect(screen.getAllByText('Set by the logistics plugin.')).toHaveLength(1);
  });

  it('keeps the description below an EDITABLE field, where there is no bar to carry it', () => {
    render(
      <FieldRenderer
        field={{
          name: 'internalNote',
          type: 'text',
          label: 'Internal Note',
          admin: { description: 'Only staff can see this.' },
        } as any}
        value=""
        onChange={vi.fn()}
        theme={ThemeMode.LIGHT}
        collectionSlug="orders"
      />
    );

    expect(screen.getByText('Only staff can see this.')).toBeInTheDocument();
  });

  /**
   * A locked toggle still looked flippable and a locked date still looked like a picker — the same
   * failure the text inputs had, in the field kinds that were left behind. These assert the VALUE
   * reads as a person would say it: an option's label, not its stored code; Yes/No, not `true`.
   */
  it('shows a read-only select as its option label, not its stored code', () => {
    render(
      <FieldRenderer
        field={{
          name: 'fulfillmentStatus',
          type: 'select',
          label: 'Fulfillment Status',
          options: [{ value: 'awaiting_dispatch', label: 'Awaiting dispatch' }],
          admin: { readOnly: true },
        } as any}
        value="awaiting_dispatch"
        onChange={vi.fn()}
        theme={ThemeMode.LIGHT}
        collectionSlug="orders"
        onReadOnlyOverrideRequest={vi.fn()}
      />
    );

    expect(screen.getByText('Awaiting dispatch')).toBeInTheDocument();
    expect(screen.queryByText('awaiting_dispatch')).not.toBeInTheDocument();
  });

  it('shows a read-only boolean as Yes or No, not true', () => {
    render(
      <FieldRenderer
        field={{ name: 'taxInclusive', type: 'boolean', label: 'Tax Inclusive', admin: { readOnly: true } } as any}
        value
        onChange={vi.fn()}
        theme={ThemeMode.LIGHT}
        collectionSlug="orders"
        onReadOnlyOverrideRequest={vi.fn()}
      />
    );

    expect(screen.getByText('Yes')).toBeInTheDocument();
  });

  it('keeps an unparseable date verbatim rather than blanking it', () => {
    render(
      <FieldRenderer
        field={{ name: 'createdDate', type: 'date', label: 'Created Date', admin: { readOnly: true } } as any}
        value="not-a-date"
        onChange={vi.fn()}
        theme={ThemeMode.LIGHT}
        collectionSlug="orders"
        onReadOnlyOverrideRequest={vi.fn()}
      />
    );

    expect(screen.getByText('not-a-date')).toBeInTheDocument();
  });

  it('does not lay a click-catching overlay over the value', () => {
    render(
      <FieldRenderer
        field={{ name: 'invoiceNumber', type: 'text', label: 'Invoice Number', admin: { readOnly: true } } as any}
        value="INV-001"
        onChange={vi.fn()}
        theme={ThemeMode.LIGHT}
        collectionSlug="invoices"
        onReadOnlyOverrideRequest={vi.fn()}
      />
    );

    expect(screen.queryByLabelText('Override read-only field Invoice Number')).not.toBeInTheDocument();
  });

  it('does not tell the operator to type into a field they cannot type into', () => {
    render(
      <FieldRenderer
        field={{ name: 'trackingNumber', type: 'text', label: 'Tracking Number', admin: { readOnly: true } } as any}
        value=""
        onChange={vi.fn()}
        theme={ThemeMode.LIGHT}
        collectionSlug="orders"
        onReadOnlyOverrideRequest={vi.fn()}
      />
    );

    // A read-only field renders no input at all now — it shows the value, or "Not set" when there is
    // none. The old behaviour printed `Enter Tracking Number...` inside a disabled box: an
    // instruction the operator could not follow, in a control that looked exactly like the editable
    // ones beside it.
    expect(screen.queryByPlaceholderText('Enter Tracking Number...')).not.toBeInTheDocument();
    expect(screen.getByText('Not set')).toBeInTheDocument();
    expect(document.querySelector('input')).toBeNull();
  });

  it('keeps read-only fields locked when the schema explicitly disables override', () => {
    render(
      <FieldRenderer
        field={{ name: 'invoiceNumber', type: 'text', label: 'Invoice Number', admin: { readOnly: true, readOnlyOverride: false } } as any}
        value="INV-001"
        onChange={vi.fn()}
        theme={ThemeMode.LIGHT}
        collectionSlug="invoices"
        onReadOnlyOverrideRequest={vi.fn()}
      />
    );

    expect(screen.queryByTitle('Unlock "Invoice Number" to edit')).not.toBeInTheDocument();
    expect(screen.getByText('Read only')).toBeInTheDocument();
  });
});
