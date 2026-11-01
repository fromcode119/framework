import { CollectionEditPageHandlers } from '@/components/collection/edit/view/collection-edit-page-handlers.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** A refusal the server names by its code reads in the console's language, under the label the form shows. */
describe('CollectionEditPageHandlers submit errors', () => {
  const collection = { fields: [{ name: 'name', label: 'Име' }, { name: 'key', label: 'Ключ' }] };
  const parse = (errors: unknown[]) => (CollectionEditPageHandlers as any).parseSubmitError({ data: { errors } }, collection);

  it('says a required field in the console language, by its shown label', () => {
    const { message, perField } = parse([{ field: 'name', code: 'required', message: 'Field "Name" is required' }]);
    const expected = AdminI18n.t('collection.edit.fieldRequired', { label: 'Име' });
    expect(expected).not.toBe('collection.edit.fieldRequired');
    expect(message).toBe(expected);
    expect(perField).toEqual({ name: [expected] });
  });

  it('keeps the server words for a refusal without a code', () => {
    const { message, perField } = parse([{ field: 'key', message: 'Already taken' }]);
    expect(message).toBe('Already taken');
    expect(perField).toEqual({ key: ['Already taken'] });
  });
});
