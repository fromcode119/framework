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
  /** "Edit" stands in the card's head, never inside the ⋯. */
  const openEdit = () => fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

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
    openEdit();
    const dialog = screen.getByRole('dialog', { name: 'Customer' });
    expect(dialog).toHaveTextContent('ORD-000002');
    for (const name of ['fullName', 'phone', 'note', 'email', 'items']) expect(dialog.querySelector(`[aria-label="field ${name}"]`)).not.toBeNull();
    // The fields sit inside the card (in place of its rows from 640px), not in a layer over the page.
    const card = dialog.closest('.fc-record-card');
    expect(card).not.toBeNull();
    expect(card).toHaveClass('fc-record-card--editing');
  });

  it('puts the values back on Cancel', () => {
    const props = mount();
    openEdit();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(props.handlePatch).toHaveBeenCalledWith({ fullName: 'Милена Моллова', phone: '0878663848', note: '', email: '' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('saves and closes', async () => {
    const props = mount();
    openEdit();
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(props.handleSubmit).toHaveBeenCalledTimes(1);
  });

  it('stays open with the reason when the save fails', async () => {
    mount({ handleSubmit: vi.fn().mockRejectedValue(new Error('no')), saveError: 'Phone is not valid' });
    openEdit();
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Phone is not valid');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('offers no Edit when every field is locked for good', () => {
    const locked = [{ name: 'number', type: 'text', label: 'Number', admin: { readOnly: true, readOnlyOverride: 'never' } }];
    render(<RecordSectionCard section={{ key: 'x', title: 'Order', fields: locked }} formData={{ number: '7' }} renderField={renderField} handlePatch={vi.fn()} handleSubmit={vi.fn()} saving={false} />);
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    // Nothing offered for the section: no ⋯ either.
    expect(screen.queryByRole('button', { name: 'Section actions' })).toBeNull();
  });

  it('offers no Edit for fields the runtime writes, locked with no declared way in', () => {
    const written = [
      { name: 'createdAt', type: 'datetime', label: 'Created', admin: { readOnly: true } },
      { name: 'requestKey', type: 'text', label: 'Request key', admin: { readOnly: true } },
    ];
    render(<RecordSectionCard section={{ key: 'x', title: 'Record', fields: written }} formData={{ requestKey: 'k-1' }} renderField={renderField} handlePatch={vi.fn()} handleSubmit={vi.fn()} saving={false} />);
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('keeps every field of the card while editing — locked and recorded ones as they read, nothing swapped', () => {
    const withRecord = [
      { name: 'note', type: 'text', label: 'Note' },
      { name: 'snapshot', type: 'json', label: 'Checkout record', admin: { component: 'StructuredReadOnlyField' } },
      { name: 'facts', type: 'json', label: 'Facts', admin: { component: 'PluginFacts', readOnly: true } },
      { name: 'stamp', type: 'text', label: 'Stamp', admin: { readOnly: true } },
    ];
    render(<RecordSectionCard section={{ key: 'x', title: 'Record', fields: withRecord }} formData={{ note: 'a', snapshot: { cart: 17 }, facts: { a: 1 } }} renderField={renderField} handlePatch={vi.fn()} handleSubmit={vi.fn()} saving={false} />);
    expect(screen.getByText('Checkout record')).toBeInTheDocument();
    expect(screen.getByText('Facts')).toBeInTheDocument();
    openEdit();
    const dialog = screen.getByRole('dialog');
    // The editable field, and the recorded values under their names, in the section's order.
    expect(dialog.querySelector('[aria-label="field note"]')).not.toBeNull();
    expect(dialog.querySelector('[aria-label="field snapshot"]')).not.toBeNull();
    expect(dialog.querySelector('[aria-label="field facts"]')).not.toBeNull();
    expect(dialog).toHaveTextContent('Checkout record');
    const names = [...dialog.querySelectorAll('[aria-label^="field "]')].map((node) => node.getAttribute('aria-label'));
    expect(names).toEqual(['field note', 'field snapshot', 'field facts']);
    // An empty locked field has nothing to read and nothing to type: the card did not show it either.
    expect(dialog.querySelector('[aria-label="field stamp"]')).toBeNull();
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
