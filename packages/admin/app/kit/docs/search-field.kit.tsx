import { SearchField } from '@/components/ui/view/search-field.client';
import { KitPlay } from '@/app/kit/view/kit-play.client';
import type { KitDoc } from '@/app/kit/kit-doc';

export class SearchFieldKit {
  static doc(): KitDoc {
    return {
      slug: 'search-field', name: 'SearchField', group: 'Forms',
      intro: 'The search over a list. It gives the text as it is typed; the list decides what it matches.',
      from: "import { SearchField } from '@fromcode119/sdk/admin';",
      examples: [
        { title: 'Empty and filled', text: 'Once it holds text it shows a control to empty it.', demo: <><div className="fc-kitdoc__cell"><KitPlay initial="">{(value, set) => <SearchField value={value} onChange={set} placeholder="Search" />}</KitPlay></div><div className="fc-kitdoc__cell"><KitPlay initial="cotton">{(value, set) => <SearchField value={value} onChange={set} placeholder="Search" />}</KitPlay></div></>, code: '<SearchField value={query} onChange={setQuery} placeholder="Search" />' },
        { title: 'Full width', text: 'It is as wide as what holds it.', demo: <div className="fc-kitdoc__cell fc-kitdoc__cell--wide"><KitPlay initial="">{(value, set) => <SearchField value={value} onChange={set} placeholder="Search products" />}</KitPlay></div>, code: '<SearchField value={query} onChange={setQuery} placeholder="Search products" />' },
      ],
      options: [
        { name: 'value, onChange', type: 'string, (value) => void', does: 'The text and what happens as it is typed.' },
        { name: 'placeholder', type: 'string', does: 'What is searched.' },
        { name: 'autoFocus', type: 'boolean', initial: 'false', does: 'Takes the cursor when it appears.' },
        { name: 'className', type: 'string', does: 'For its place in a row (its width), never its look.' },
      ],
    };
  }
}
