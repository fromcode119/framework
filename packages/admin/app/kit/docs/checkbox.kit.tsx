import { Checkbox } from '@/components/ui/view/checkbox.client';
import { KitPlay } from '@/app/kit/view/kit-play.client';
import type { KitDoc } from '@/app/kit/kit-doc';

export class CheckboxKit {
  static doc(): KitDoc {
    return {
      slug: 'checkbox', name: 'Checkbox', group: 'Forms',
      intro: 'A choice among several: rows to act on, scopes, kinds. For a single on/off use Switch.',
      from: "import { Checkbox } from '@fromcode119/sdk/admin';",
      examples: [
        { title: 'With a label', demo: <KitPlay initial={true}>{(value, set) => <Checkbox checked={value} onChange={set} label="Send a copy to the customer" />}</KitPlay>, code: '<Checkbox checked={copy} onChange={setCopy} label="Send a copy to the customer" />' },
        { title: 'States', demo: <><Checkbox checked onChange={() => undefined} label="Checked" /><Checkbox checked={false} onChange={() => undefined} label="Unchecked" /><Checkbox checked={false} indeterminate onChange={() => undefined} label="Some of them" /></>, code: '<Checkbox checked … />\n<Checkbox checked={false} … />\n<Checkbox checked={false} indeterminate … />' },
        { title: 'Disabled', demo: <><Checkbox checked disabled label="Checked" /><Checkbox checked={false} disabled label="Unchecked" /></>, code: '<Checkbox checked disabled label="Checked" />' },
        { title: 'A list of choices', text: 'One under the other, 8px apart.', demo: <div className="fc-kitdoc__stack">{['Orders', 'Products', 'Customers'].map((name) => <KitPlay key={name} initial={name !== 'Customers'}>{(value, set) => <Checkbox checked={value} onChange={set} label={name} />}</KitPlay>)}</div>, code: "{scopes.map((scope) => (\n  <Checkbox key={scope} checked={chosen.includes(scope)} onChange={() => toggle(scope)} label={scope} />\n))}" },
        { title: 'Without a label', text: 'In a table’s first column. `presentational` draws the box only, for a row that is itself the control.', demo: <><Checkbox checked onChange={() => undefined} /><Checkbox checked presentational /></>, code: '<Checkbox checked={selected} onChange={toggle} />\n<Checkbox checked={selected} presentational />' },
      ],
      options: [
        { name: 'checked', type: 'boolean', does: 'Whether it is ticked.' },
        { name: 'onChange', type: '(checked, event?) => void', does: 'What happens when it is pressed.' },
        { name: 'label', type: 'ReactNode', does: 'The words beside it; a node, so a row can keep its own markup.' },
        { name: 'indeterminate', type: 'boolean', initial: 'false', does: 'A dash: some, not all.' },
        { name: 'disabled', type: 'boolean', initial: 'false', does: 'Not available.' },
        { name: 'presentational', type: 'boolean', initial: 'false', does: 'The box only, with no button of its own.' },
      ],
    };
  }
}
