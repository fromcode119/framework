import { Select } from '@/components/ui/view/select.client';
import { KitPlay } from '@/app/kit/view/kit-play.client';
import type { KitDoc } from '@/app/kit/kit-doc';

export class SelectKit {
  private static readonly OPTIONS = [{ label: 'Draft', value: 'draft' }, { label: 'Published', value: 'published' }, { label: 'Archived', value: 'archived' }];

  private static field(props: Record<string, any>, initial = 'published'): any {
    return (
      <div className="fc-kitdoc__cell">
        <KitPlay initial={initial}>{(value, set) => <Select options={SelectKit.OPTIONS} {...props} value={value} onChange={set} />}</KitPlay>
      </div>
    );
  }

  static doc(): KitDoc {
    return {
      slug: 'select', name: 'Select', group: 'Forms',
      intro: 'One choice out of a list that is too long, or too rarely changed, to lay out as radios.',
      from: "import { Select } from '@fromcode119/sdk/admin';",
      examples: [
        { title: 'With a label', demo: SelectKit.field({ label: 'Status' }), code: "<Select label=\"Status\" value={status} onChange={setStatus}\n  options={[{ label: 'Draft', value: 'draft' }, { label: 'Published', value: 'published' }]} />" },
        { title: 'Nothing chosen', text: 'The placeholder says what is to be chosen.', demo: SelectKit.field({ label: 'Status', placeholder: 'Choose a status' }, ''), code: '<Select label="Status" placeholder="Choose a status" value="" onChange={setStatus} options={options} />' },
        { title: 'Searchable', text: 'For a list long enough to need finding in. The search is inside the menu.', demo: SelectKit.field({ label: 'Status', searchable: true }), code: '<Select label="Status" searchable value={status} onChange={setStatus} options={options} />' },
        { title: 'Clearable', text: 'When “none” is a valid answer, the field can be emptied again.', demo: SelectKit.field({ label: 'Status', clearable: true }), code: '<Select label="Status" clearable value={status} onChange={setStatus} options={options} />' },
        { title: 'Loading and disabled', demo: <>{SelectKit.field({ label: 'Loading', isLoading: true })}{SelectKit.field({ label: 'Disabled', disabled: true })}</>, code: '<Select label="Loading" isLoading … />\n<Select label="Disabled" disabled … />' },
        { title: 'A note in the menu', text: 'One quiet line at the foot of the menu, for what the list leaves out.', demo: SelectKit.field({ label: 'Status', menuNote: 'Archived products are hidden from the shop.' }), code: '<Select label="Status" menuNote="Archived products are hidden from the shop." … />' },
        { title: 'Adding an option', text: 'With `onCreateOption` whatever is typed and not found can be added from the menu.', demo: SelectKit.field({ label: 'Tag', searchable: true, onCreateOption: () => undefined, createOptionLabel: (input: string) => `Add “${input}”` }), code: '<Select label="Tag" searchable onCreateOption={addTag} createOptionLabel={(input) => `Add “${input}”`} … />' },
      ],
      options: [
        { name: 'value, onChange', type: 'string, (value) => void', does: 'The chosen option’s value and what happens on a choice.' },
        { name: 'options', type: '{ label, value }[]', does: 'What can be chosen.' },
        { name: 'label', type: 'string', does: 'The words above the field.' },
        { name: 'placeholder', type: 'string', does: 'Shown while nothing is chosen.' },
        { name: 'searchable', type: 'boolean', initial: 'false', does: 'A search at the head of the menu.' },
        { name: 'onSearchChange, searching', type: '(text) => void, boolean', does: 'For options fetched as the search is typed.' },
        { name: 'clearable', type: 'boolean', initial: 'false', does: 'Lets the choice be removed.' },
        { name: 'isLoading, disabled', type: 'boolean', initial: 'false', does: 'Options still arriving / not available.' },
        { name: 'menuNote', type: 'string', does: 'A line at the foot of the menu.' },
        { name: 'onCreateOption, createOptionLabel', type: 'functions', does: 'Lets a missing option be added from the menu.' },
        { name: 'onDeleteOption', type: '(value) => void', does: 'Puts a remove control on each option.' },
      ],
    };
  }
}
