import { KitCopy } from '@/app/kit/kit-copy';
import { SearchField } from '@/components/ui/view/search-field.client';
import { KitPlay } from '@/app/kit/view/kit-play.client';
import type { KitDoc } from '@/app/kit/kit-doc';

export class SearchFieldKit {
  static doc(): KitDoc {
    return {
      slug: 'search-field', name: 'SearchField', group: KitCopy.t('docs.search-field.forms'),
      intro: KitCopy.t('docs.search-field.theSearchOverAList'),
      from: "import { SearchField } from '@fromcode119/sdk/admin';",
      examples: [
        { title: KitCopy.t('docs.search-field.emptyAndFilled'), text: KitCopy.t('docs.search-field.onceItHoldsTextIt'), demo: <><div className="fc-kitdoc__cell"><KitPlay initial="">{(value, set) => <SearchField value={value} onChange={set} placeholder={KitCopy.t('docs.search-field.search')} />}</KitPlay></div><div className="fc-kitdoc__cell"><KitPlay initial="cotton">{(value, set) => <SearchField value={value} onChange={set} placeholder={KitCopy.t('docs.search-field.search')} />}</KitPlay></div></>, code: '<SearchField value={query} onChange={setQuery} placeholder="Search" />' },
        { title: KitCopy.t('docs.search-field.fullWidth'), text: KitCopy.t('docs.search-field.itIsAsWideAs'), demo: <div className="fc-kitdoc__cell fc-kitdoc__cell--wide"><KitPlay initial="">{(value, set) => <SearchField value={value} onChange={set} placeholder={KitCopy.t('docs.search-field.searchProducts')} />}</KitPlay></div>, code: '<SearchField value={query} onChange={setQuery} placeholder="Search products" />' },
      ],
      options: [
        { name: 'value, onChange', type: 'string, (value) => void', does: KitCopy.t('docs.search-field.theTextAndWhatHappens') },
        { name: 'placeholder', type: 'string', does: KitCopy.t('docs.search-field.whatIsSearched') },
        { name: 'autoFocus', type: 'boolean', initial: 'false', does: KitCopy.t('docs.search-field.takesTheCursorWhenIt') },
        { name: 'className', type: 'string', does: KitCopy.t('docs.search-field.forItsPlaceInA') },
      ],
    };
  }
}
