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
  /** Every card head carries ONE control: the ⋯, whose first item is Edit. */
  const openEdit = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Section actions' }));
    // jsdom measures nothing, so the portalled panel never leaves its pre-measurement
    // `visibility: hidden`: it is in the document and clickable, but it has no accessible NAME while
    // it is hidden, so the item is reached by its title instead of by its role.
    fireEvent.click(screen.getByTitle('Edit'));
  };

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
    // A field whose value is DATA reads as data and is changed in the sheet; with no value recorded
    // there is nothing to read, so the card draws neither a value nor its editor.
    expect(screen.queryByLabelText('field items')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the section fields in a sheet named after the record', () => {
    mount();
    openEdit();
    const dialog = screen.getByRole('dialog', { name: 'Customer' });
    expect(dialog).toHaveTextContent('ORD-000002');
    for (const name of ['fullName', 'phone', 'note', 'email', 'items']) expect(dialog.querySelector(`[aria-label="field ${name}"]`)).not.toBeNull();
    // It is a dialog OVER the record, so it is drawn on `body` and not inside the card it edits. A
    // fixed overlay rendered inside the card obeys the card's stacking context, and the navigation
    // drew straight over it — which is what this assertion used to require.
    expect(dialog.closest('.fc-record-card')).toBeNull();
    expect(dialog.parentElement).toBe(document.body);
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
    // Nothing to edit and nothing offered for the section: no ⋯ at all.
    expect(screen.queryByRole('button', { name: 'Section actions' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Section actions' })).toBeNull();
  });

  it('offers no Edit for fields the runtime writes, locked with no declared way in', () => {
    const written = [
      { name: 'createdAt', type: 'datetime', label: 'Created', admin: { readOnly: true } },
      { name: 'requestKey', type: 'text', label: 'Request key', admin: { readOnly: true } },
    ];
    render(<RecordSectionCard section={{ key: 'x', title: 'Record', fields: written }} formData={{ requestKey: 'k-1' }} renderField={renderField} handlePatch={vi.fn()} handleSubmit={vi.fn()} saving={false} />);
    expect(screen.queryByRole('button', { name: 'Section actions' })).toBeNull();
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

  /**
   * A section none of whose fields is filled in states its own shape. It used to print one sentence,
   * "nothing filled in yet", which told the reader the one thing they already knew and hid the one thing
   * they needed: which fields the section offers.
   */
  it('names the rows of a section with nothing filled in, each with a dash, and says nothing else', () => {
    mount({ formData: { fullName: '', phone: '', note: '', email: '' }, section: { key: 'customer', title: 'Customer', fields: fields.filter((field) => !field.required) } });
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Phone')).toBeInTheDocument();
    expect(screen.getByText('Note')).toBeInTheDocument();
    // Name, Phone, Note and Items: the data field has no table to draw while it is empty, so it is a row too.
    expect(screen.getByText('Items')).toBeInTheDocument();
    expect(screen.getAllByText('\u2013')).toHaveLength(4);
    expect(screen.queryByText(/nothing filled in/i)).toBeNull();
  });

  /**
   * A field whose value would be read as a table draws nothing while it is empty, so the section would
   * say nothing at all. Named with a dash it still states what it holds.
   */
  it('names an empty section whose only field reads as data', () => {
    const data = [{ name: 'choiceGroups', type: 'array', label: 'Choice groups' }];
    mount({ formData: {}, section: { key: 'choices', title: 'Choices', fields: data } });
    expect(screen.getByText('Choice groups')).toBeInTheDocument();
    expect(screen.getByText('\u2013')).toBeInTheDocument();
  });

  /**
   * A field drawn in place by its own component (a picture, a block document) keeps that component's own
   * empty state — its "add an image" — and is not named a second time as a dash.
   */
  it('draws no dash for an empty section whose field owns its control', () => {
    const own = [{ name: 'images', type: 'media', label: 'Images', admin: { component: 'MediaField' } }];
    mount({ formData: {}, section: { key: 'media', title: 'Media', fields: own } });
    expect(screen.queryByText('\u2013')).toBeNull();
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
