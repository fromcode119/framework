import { TextArea } from '@/components/ui/view/text-area.client';
import { KitPlay } from '@/app/kit/view/kit-play.client';
import type { KitDoc } from '@/app/kit/kit-doc';

export class TextAreaKit {
  private static field(props: Record<string, any>, initial = ''): any {
    return (
      <div className="fc-kitdoc__cell fc-kitdoc__cell--wide">
        <KitPlay initial={initial}>{(value, set) => <TextArea {...props} value={value} onChange={(event: any) => set(event.target.value)} />}</KitPlay>
      </div>
    );
  }

  static doc(): KitDoc {
    return {
      slug: 'text-area', name: 'TextArea', group: 'Forms',
      intro: 'Text that runs to more than a line: a description, a note.',
      from: "import { TextArea } from '@fromcode119/sdk/admin';",
      examples: [
        { title: 'With a label', demo: TextAreaKit.field({ label: 'Description' }, 'Made of organic cotton, pre-washed, with a round neck.'), code: '<TextArea label="Description" value={text} onChange={(event) => setText(event.target.value)} />' },
        { title: 'Rows', text: 'How tall it starts is `rows`; it can still be dragged taller.', demo: TextAreaKit.field({ label: 'Note', rows: 6, placeholder: 'Anything the next person should know' }), code: '<TextArea label="Note" rows={6} placeholder="…" value={note} onChange={…} />' },
        { title: 'With an error', demo: TextAreaKit.field({ label: 'Description', error: 'A description is required' }), code: '<TextArea label="Description" error="A description is required" … />' },
        { title: 'Disabled', demo: TextAreaKit.field({ label: 'Description', disabled: true }, 'Made of organic cotton.'), code: '<TextArea label="Description" disabled value={text} />' },
      ],
      options: [
        { name: 'label', type: 'string', does: 'The words above the field.' },
        { name: 'value, onChange', type: 'string, (event) => void', does: 'What it holds and what happens when it is typed in.' },
        { name: 'error', type: 'string', does: 'What is wrong, under the field.' },
        { name: 'rows, placeholder, disabled…', type: 'textarea attributes', does: 'Everything a native text area takes is passed through.' },
      ],
    };
  }
}
