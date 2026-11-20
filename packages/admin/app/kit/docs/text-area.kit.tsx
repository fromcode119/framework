import { KitCopy } from '@/app/kit/kit-copy';
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
      slug: 'text-area', name: 'TextArea', group: KitCopy.t('docs.text-area.forms'),
      intro: KitCopy.t('docs.text-area.textThatRunsToMore'),
      from: "import { TextArea } from '@fromcode119/sdk/admin';",
      examples: [
        { title: KitCopy.t('docs.text-area.withALabel'), demo: TextAreaKit.field({ label: KitCopy.t('docs.text-area.description') }, 'Made of organic cotton, pre-washed, with a round neck.'), code: '<TextArea label="Description" value={text} onChange={(event) => setText(event.target.value)} />' },
        { title: KitCopy.t('docs.text-area.rows'), text: KitCopy.t('docs.text-area.howTallItStartsIs'), demo: TextAreaKit.field({ label: KitCopy.t('docs.text-area.note'), rows: 6, placeholder: KitCopy.t('docs.text-area.anythingTheNextPersonShould') }), code: '<TextArea label="Note" rows={6} placeholder="…" value={note} onChange={…} />' },
        { title: KitCopy.t('docs.text-area.withAnError'), demo: TextAreaKit.field({ label: KitCopy.t('docs.text-area.description'), error: 'A description is required' }), code: '<TextArea label="Description" error="A description is required" … />' },
        { title: KitCopy.t('docs.text-area.disabled'), demo: TextAreaKit.field({ label: KitCopy.t('docs.text-area.description'), disabled: true }, 'Made of organic cotton.'), code: '<TextArea label="Description" disabled value={text} />' },
      ],
      options: [
        { name: 'label', type: 'string', does: KitCopy.t('docs.text-area.theWordsAboveTheField') },
        { name: 'value, onChange', type: 'string, (event) => void', does: KitCopy.t('docs.text-area.whatItHoldsAndWhat') },
        { name: 'error', type: 'string', does: KitCopy.t('docs.text-area.whatIsWrongUnderThe') },
        { name: 'rows, placeholder, disabled…', type: 'textarea attributes', does: KitCopy.t('docs.text-area.everythingANativeTextArea') },
      ],
    };
  }
}
