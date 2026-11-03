import { vi } from 'vitest';

vi.mock('@/components/collection/edit/view/collection-edit-derivations.client', () => ({
  CollectionEditDerivations: { build: () => ({ isNew: true }) },
}));

import { CollectionEditPageViewModelBuilder } from '@/components/collection/edit/view/collection-edit-page-view-model.client';

/** A page whose `setState` applies updaters the way React does, so the builder's `setFormData` runs for real. */
class FakePage {
  props = {};
  state: Record<string, any> = { formData: { name: 'Phone menu', slug: 'phone-menu' }, slugManuallyEdited: false };
  setState(update: any): void {
    this.state = { ...this.state, ...(typeof update === 'function' ? update(this.state) : update) };
  }
  updateState(key: string, value: unknown): void {
    this.state = { ...this.state, [key]: value };
  }
}

/** An imported or hand-edited slug is the operator's choice: the title must not regenerate it. */
describe('CollectionEditPageViewModelBuilder setFormData', () => {
  it('marks an imported slug as chosen, so the name does not overwrite it', () => {
    const page = new FakePage();
    CollectionEditPageViewModelBuilder.build(page).setFormData({ name: 'Phone menu', slug: 'mobile' });
    expect(page.state.formData.slug).toBe('mobile');
    expect(page.state.slugManuallyEdited).toBe(true);
  });

  it('marks a slug set through an updater function too', () => {
    const page = new FakePage();
    CollectionEditPageViewModelBuilder.build(page).setFormData((prev: any) => ({ ...prev, slug: 'mobile' }));
    expect(page.state.slugManuallyEdited).toBe(true);
  });

  it('leaves the generation on when the slug did not change', () => {
    const page = new FakePage();
    CollectionEditPageViewModelBuilder.build(page).setFormData({ name: 'Phone', slug: 'phone-menu' });
    expect(page.state.formData.name).toBe('Phone');
    expect(page.state.slugManuallyEdited).toBe(false);
  });

  it('leaves the generation on when the slug is emptied', () => {
    const page = new FakePage();
    CollectionEditPageViewModelBuilder.build(page).setFormData({ name: 'Phone menu', slug: '' });
    expect(page.state.slugManuallyEdited).toBe(false);
  });
});
