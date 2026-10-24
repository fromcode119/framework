import { describe, expect, it, vi } from 'vitest';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { FieldRenderer } from '@/components/collection/view/field-renderer.client';
import { CollectionEditControllerBuilder } from '@/components/collection/edit/view/collection-edit-controller-builder.client';

/**
 * An appearance that draws its own record editor gets the layout and the actions, never the save
 * pipeline itself: every field still goes through FieldRenderer bound to the record, and save/delete are
 * the page's own handlers, so a custom editor cannot skip validation, the delete confirmation or the
 * role gate.
 */
const viewModel = (overrides: Record<string, unknown> = {}): any => ({
  collection: { slug: 'rules' },
  isNew: false,
  resolvedTitleValue: 'Reviewer test rule',
  standardMainFieldSections: [{ key: 'main', title: 'Rule', fields: [{ name: 'name' }] }],
  fullWidthMainFieldSections: [{ key: 'wide', fields: [{ name: 'message' }] }],
  sidebarFieldSections: [{ title: 'Status', fields: [{ name: 'active' }] }],
  formData: { name: 'Reviewer test rule', message: 'Hi', active: true },
  fieldErrors: { name: ['Required'] },
  saving: false,
  isDirty: true,
  status: null,
  changeSummary: '',
  handleSubmit: vi.fn().mockResolvedValue(undefined),
  setShowDeleteConfirm: vi.fn(),
  handleInputChange: vi.fn(),
  handlePatch: vi.fn(),
  handleReadOnlyOverrideRequest: vi.fn(),
  readOnlyOverrideGranted: false,
  resolvedSlug: 'comment-replies-rules',
  pluginSettings: {},
  pluginSettingsSchema: {},
  theme: 'light',
  slugWarning: null,
  slugManuallyEdited: false,
  ...overrides,
});
const route = { listHref: '/comment-replies/rules', canSave: true, canDelete: true };

describe('CollectionEditControllerBuilder', () => {
  it('hands over every field section, main first and sidebar last', () => {
    const edit = CollectionEditControllerBuilder.build(viewModel(), route);
    expect(edit.sections.map((section) => section.fields[0].name)).toEqual(['name', 'message', 'active']);
    expect(edit.title).toBe('Reviewer test rule');
    expect(edit.listHref).toBe('/comment-replies/rules');
  });

  it('draws each field with the framework FieldRenderer bound to the record', () => {
    const vm = viewModel();
    const element: any = CollectionEditControllerBuilder.build(vm, route).renderField({ name: 'name' });
    expect(element.type).toBe(FieldRenderer);
    expect(element.props.value).toBe('Reviewer test rule');
    expect(element.props.errors).toEqual(['Required']);
    element.props.onChange('Renamed');
    expect(vm.handleInputChange).toHaveBeenCalledWith('name', 'Renamed');
  });

  it('saves and deletes through the page, so validation and the confirmation stay the framework\'s', () => {
    const vm = viewModel();
    const edit = CollectionEditControllerBuilder.build(vm, route);
    edit.save();
    expect(vm.handleSubmit).toHaveBeenCalledTimes(1);
    edit.requestDelete();
    expect(vm.setShowDeleteConfirm).toHaveBeenCalledWith(true);
  });

  it('keeps the role gate: no save without the right, no delete on a new record', () => {
    const readOnly = CollectionEditControllerBuilder.build(viewModel(), { ...route, canSave: false, canDelete: false });
    expect(readOnly.canSave).toBe(false);
    expect((readOnly.renderField({ name: 'name' }) as any).props.disabled).toBe(true);
    expect(CollectionEditControllerBuilder.build(viewModel({ isNew: true }), route).canDelete).toBe(false);
  });

  it('splits the save result into an error and a notice', () => {
    const failed = CollectionEditControllerBuilder.build(viewModel({ status: { type: NotificationType.ERROR, message: 'Nope' } }), route);
    expect([failed.error, failed.notice]).toEqual(['Nope', '']);
    const saved = CollectionEditControllerBuilder.build(viewModel({ status: { type: NotificationType.SUCCESS, message: 'Saved' } }), route);
    expect([saved.error, saved.notice]).toEqual(['', 'Saved']);
  });
});
