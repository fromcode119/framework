import { KitCopy } from '@/app/kit/kit-copy';
import { Select } from '@/components/ui/view/select.client';
import { KitPlay } from '@/app/kit/view/kit-play.client';
import type { KitDoc } from '@/app/kit/kit-doc';

export class SelectKit {
  private static readonly OPTIONS = [{ label: KitCopy.t('docs.select.draft'), value: 'draft' }, { label: KitCopy.t('docs.select.published'), value: 'published' }, { label: KitCopy.t('docs.select.archived'), value: 'archived' }];

  private static field(props: Record<string, any>, initial = 'published'): any {
    return (
      <div className="fc-kitdoc__cell">
        <KitPlay initial={initial}>{(value, set) => <Select options={SelectKit.OPTIONS} {...props} value={value} onChange={set} />}</KitPlay>
      </div>
    );
  }

  static doc(): KitDoc {
    return {
      slug: 'select', name: 'Select', group: KitCopy.t('docs.select.forms'),
      intro: KitCopy.t('docs.select.oneChoiceOutOfA'),
      from: "import { Select } from '@fromcode119/sdk/admin';",
      examples: [
        { title: KitCopy.t('docs.select.withALabel'), demo: SelectKit.field({ label: KitCopy.t('docs.select.status') }), code: "<Select label=\"Status\" value={status} onChange={setStatus}\n  options={[{ label: 'Draft', value: 'draft' }, { label: 'Published', value: 'published' }]} />" },
        { title: KitCopy.t('docs.select.nothingChosen'), text: KitCopy.t('docs.select.thePlaceholderSaysWhatIs'), demo: SelectKit.field({ label: KitCopy.t('docs.select.status'), placeholder: KitCopy.t('docs.select.chooseAStatus') }, ''), code: '<Select label="Status" placeholder="Choose a status" value="" onChange={setStatus} options={options} />' },
        { title: KitCopy.t('docs.select.searchable'), text: KitCopy.t('docs.select.forAListLongEnough'), demo: SelectKit.field({ label: KitCopy.t('docs.select.status'), searchable: true }), code: '<Select label="Status" searchable value={status} onChange={setStatus} options={options} />' },
        { title: KitCopy.t('docs.select.clearable'), text: KitCopy.t('docs.select.whenNoneIsAValid'), demo: SelectKit.field({ label: KitCopy.t('docs.select.status'), clearable: true }), code: '<Select label="Status" clearable value={status} onChange={setStatus} options={options} />' },
        { title: KitCopy.t('docs.select.loadingAndDisabled'), demo: <>{SelectKit.field({ label: KitCopy.t('docs.select.loading'), isLoading: true })}{SelectKit.field({ label: KitCopy.t('docs.select.disabled'), disabled: true })}</>, code: '<Select label="Loading" isLoading … />\n<Select label="Disabled" disabled … />' },
        { title: KitCopy.t('docs.select.aNoteInTheMenu'), text: KitCopy.t('docs.select.oneQuietLineAtThe'), demo: SelectKit.field({ label: KitCopy.t('docs.select.status'), menuNote: 'Archived products are hidden from the shop.' }), code: '<Select label="Status" menuNote="Archived products are hidden from the shop." … />' },
        { title: KitCopy.t('docs.select.addingAnOption'), text: KitCopy.t('docs.select.withOncreateoptionWhateverIsTyped'), demo: SelectKit.field({ label: KitCopy.t('docs.select.tag'), searchable: true, onCreateOption: () => undefined, createOptionLabel: (input: string) => `Add “${input}”` }), code: '<Select label="Tag" searchable onCreateOption={addTag} createOptionLabel={(input) => `Add “${input}”`} … />' },
      ],
      options: [
        { name: 'value, onChange', type: 'string, (value) => void', does: KitCopy.t('docs.select.theChosenOptionSValue') },
        { name: 'options', type: '{ label, value }[]', does: KitCopy.t('docs.select.whatCanBeChosen') },
        { name: 'label', type: 'string', does: KitCopy.t('docs.select.theWordsAboveTheField') },
        { name: 'placeholder', type: 'string', does: KitCopy.t('docs.select.shownWhileNothingIsChosen') },
        { name: 'searchable', type: 'boolean', initial: 'false', does: KitCopy.t('docs.select.aSearchAtTheHead') },
        { name: 'onSearchChange, searching', type: '(text) => void, boolean', does: KitCopy.t('docs.select.forOptionsFetchedAsThe') },
        { name: 'clearable', type: 'boolean', initial: 'false', does: KitCopy.t('docs.select.letsTheChoiceBeRemoved') },
        { name: 'isLoading, disabled', type: 'boolean', initial: 'false', does: KitCopy.t('docs.select.optionsStillArrivingNotAvailable') },
        { name: 'menuNote', type: 'string', does: KitCopy.t('docs.select.aLineAtTheFoot') },
        { name: 'onCreateOption, createOptionLabel', type: 'functions', does: KitCopy.t('docs.select.letsAMissingOptionBe') },
        { name: 'onDeleteOption', type: '(value) => void', does: KitCopy.t('docs.select.putsARemoveControlOn') },
      ],
    };
  }
}
