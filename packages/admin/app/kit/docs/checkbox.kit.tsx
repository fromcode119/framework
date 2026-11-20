import { KitCopy } from '@/app/kit/kit-copy';
import { Checkbox } from '@/components/ui/view/checkbox.client';
import { KitPlay } from '@/app/kit/view/kit-play.client';
import type { KitDoc } from '@/app/kit/kit-doc';

export class CheckboxKit {
  static doc(): KitDoc {
    return {
      slug: 'checkbox', name: 'Checkbox', group: KitCopy.t('docs.checkbox.forms'),
      intro: KitCopy.t('docs.checkbox.aChoiceAmongSeveralRows'),
      from: "import { Checkbox } from '@fromcode119/sdk/admin';",
      examples: [
        { title: KitCopy.t('docs.checkbox.withALabel'), demo: <KitPlay initial={true}>{(value, set) => <Checkbox checked={value} onChange={set} label={KitCopy.t('docs.checkbox.sendACopyToThe')} />}</KitPlay>, code: '<Checkbox checked={copy} onChange={setCopy} label="Send a copy to the customer" />' },
        { title: KitCopy.t('docs.checkbox.states'), demo: <><Checkbox checked onChange={() => undefined} label={KitCopy.t('docs.checkbox.checked')} /><Checkbox checked={false} onChange={() => undefined} label={KitCopy.t('docs.checkbox.unchecked')} /><Checkbox checked={false} indeterminate onChange={() => undefined} label={KitCopy.t('docs.checkbox.someOfThem')} /></>, code: '<Checkbox checked … />\n<Checkbox checked={false} … />\n<Checkbox checked={false} indeterminate … />' },
        { title: KitCopy.t('docs.checkbox.disabled'), demo: <><Checkbox checked disabled label={KitCopy.t('docs.checkbox.checked')} /><Checkbox checked={false} disabled label={KitCopy.t('docs.checkbox.unchecked')} /></>, code: '<Checkbox checked disabled label="Checked" />' },
        { title: KitCopy.t('docs.checkbox.aListOfChoices'), text: KitCopy.t('docs.checkbox.oneUnderTheOther8px'), demo: <div className="fc-kitdoc__stack">{['Orders', 'Products', 'Customers'].map((name) => <KitPlay key={name} initial={name !== 'Customers'}>{(value, set) => <Checkbox checked={value} onChange={set} label={name} />}</KitPlay>)}</div>, code: "{scopes.map((scope) => (\n  <Checkbox key={scope} checked={chosen.includes(scope)} onChange={() => toggle(scope)} label={scope} />\n))}" },
        { title: KitCopy.t('docs.checkbox.withoutALabel'), text: KitCopy.t('docs.checkbox.inATableSFirst'), demo: <><Checkbox checked onChange={() => undefined} /><Checkbox checked presentational /></>, code: '<Checkbox checked={selected} onChange={toggle} />\n<Checkbox checked={selected} presentational />' },
      ],
      options: [
        { name: 'checked', type: 'boolean', does: KitCopy.t('docs.checkbox.whetherItIsTicked') },
        { name: 'onChange', type: '(checked, event?) => void', does: KitCopy.t('docs.checkbox.whatHappensWhenItIs') },
        { name: 'label', type: 'ReactNode', does: KitCopy.t('docs.checkbox.theWordsBesideItA') },
        { name: 'indeterminate', type: 'boolean', initial: 'false', does: KitCopy.t('docs.checkbox.aDashSomeNotAll') },
        { name: 'disabled', type: 'boolean', initial: 'false', does: KitCopy.t('docs.checkbox.notAvailable') },
        { name: 'presentational', type: 'boolean', initial: 'false', does: KitCopy.t('docs.checkbox.theBoxOnlyWithNo') },
      ],
    };
  }
}
