import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecordSectionCard } from '@/components/collection/edit/view/record-section-card.client';
import { RecordSectionFields } from '@/components/collection/edit/record-section-fields';

/**
 * A saved record's section reads first and is changed in a sheet. These render the real card and sheet
 * and assert what is on screen: which values are listed, that Cancel puts the values back, and that a
 * failed save keeps the sheet open with the reason.
 */
describe('RecordSectionCard', () => {
  const fields = [
    { name: 'fullName', type: 'text', label: 'Name' },
    { name: 'phone', type: 'text', label: 'Phone' },
    { name: 'note', type: 'text', label: 'Note' },
    { name: 'email', type: 'email', label: 'Email', required: true },
    { name: 'items', type: 'json', label: 'Items', admin: { component: 'OrderItems' } },
  ];
  const section = { key: 'customer', title: 'Customer', fields };
  const renderField = (field: any) => <input key={field.name} aria-label={`field ${field.name}`} readOnly />;

  const mount = (overrides: Record<string, any> = {}) => {
    const props: any = {
      section,
      formData: { fullName: 'Милена Моллова', phone: '0878663848', note: '', email: '' },
      renderField,
      handlePatch: vi.fn(),
      handleSubmit: vi.fn().mockResolvedValue({}),
      saving: false,
      recordTitle: 'ORD-000002',
      ...overrides,
    };
    render(<RecordSectionCard {...props} />);
    return props;
  };

  it('lists the values that are set and a required one that is not, and nothing else', () => {
    mount();
    expect(screen.getByText('Милена Моллова')).toBeInTheDocument();
    expect(screen.getByText('0878663848')).toBeInTheDocument();
    expect(screen.queryByText('Note')).toBeNull();
    expect(screen.getByText('Email')).toBeInTheDocument();
    // A field with its own component stays on the card, working in place.
    expect(screen.getByLabelText('field items')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the section fields in a sheet named after the record', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const dialog = screen.getByRole('dialog', { name: 'Customer' });
    expect(dialog).toHaveTextContent('ORD-000002');
    for (const name of ['fullName', 'phone', 'note', 'email']) expect(screen.getByLabelText(`field ${name}`)).toBeInTheDocument();
  });

  it('puts the values back on Cancel', () => {
    const props = mount();
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(props.handlePatch).toHaveBeenCalledWith({ fullName: 'Милена Моллова', phone: '0878663848', note: '', email: '' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('saves and closes', async () => {
    const props = mount();
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(props.handleSubmit).toHaveBeenCalledTimes(1);
  });

  it('stays open with the reason when the save fails', async () => {
    mount({ handleSubmit: vi.fn().mockRejectedValue(new Error('no')), saveError: 'Phone is not valid' });
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Phone is not valid');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('offers no Edit when every field is locked for good', () => {
    const locked = [{ name: 'number', type: 'text', label: 'Number', admin: { readOnly: true, readOnlyOverride: 'never' } }];
    render(<RecordSectionCard section={{ key: 'x', title: 'Order', fields: locked }} formData={{ number: '7' }} renderField={renderField} handlePatch={vi.fn()} handleSubmit={vi.fn()} saving={false} />);
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull();
  });
});

describe('RecordSectionFields', () => {
  it('treats a switch left off, a blank localised text and an empty list as nothing to show', () => {
    expect(RecordSectionFields.isEmpty({ type: 'boolean' }, false)).toBe(true);
    expect(RecordSectionFields.isEmpty({ type: 'text' }, { en: '', bg: ' ' })).toBe(true);
    expect(RecordSectionFields.isEmpty({ type: 'array' }, [])).toBe(true);
    expect(RecordSectionFields.isEmpty({ type: 'number' }, 0)).toBe(false);
    expect(RecordSectionFields.isEmpty({ type: 'boolean' }, true)).toBe(false);
  });
});
