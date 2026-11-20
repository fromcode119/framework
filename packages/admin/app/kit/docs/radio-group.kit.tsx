import { KitCopy } from '@/app/kit/kit-copy';
import { RadioGroup } from '@/components/ui/view/radio-group.client';
import { KitPlay } from '@/app/kit/view/kit-play.client';
import type { KitDoc } from '@/app/kit/kit-doc';

export class RadioGroupKit {
  private static readonly PLAIN = [{ value: 'all', label: KitCopy.t('docs.radio-group.everyProduct') }, { value: 'some', label: KitCopy.t('docs.radio-group.chosenProducts') }, { value: 'none', label: KitCopy.t('docs.radio-group.noProducts'), disabled: true }];
  private static readonly TOLD = [{ value: 'fixed', label: KitCopy.t('docs.radio-group.fixedAmount'), description: KitCopy.t('docs.radio-group.theSameSumOffEvery') }, { value: 'percent', label: KitCopy.t('docs.radio-group.percentage'), description: KitCopy.t('docs.radio-group.aShareOfTheOrder') }];

  private static group(props: Record<string, any>, initial: string): any {
    return <div className="fc-kitdoc__cell fc-kitdoc__cell--wide"><KitPlay initial={initial}>{(value, set) => <RadioGroup {...(props as any)} value={value} onChange={set} />}</KitPlay></div>;
  }

  static doc(): KitDoc {
    return {
      slug: 'radio-group', name: 'RadioGroup', group: KitCopy.t('docs.radio-group.forms'),
      intro: KitCopy.t('docs.radio-group.oneChoiceOutOfA'),
      from: "import { RadioGroup } from '@fromcode119/sdk/admin';",
      examples: [
        { title: KitCopy.t('docs.radio-group.plain'), demo: RadioGroupKit.group({ label: KitCopy.t('docs.radio-group.appliesTo'), options: RadioGroupKit.PLAIN }, 'all'), code: "<RadioGroup label=\"Applies to\" value={scope} onChange={setScope}\n  options={[{ value: 'all', label: 'Every product' }, { value: 'some', label: 'Chosen products' }]} />" },
        { title: KitCopy.t('docs.radio-group.withDescriptions'), demo: RadioGroupKit.group({ label: KitCopy.t('docs.radio-group.kind'), options: RadioGroupKit.TOLD }, 'fixed'), code: "options={[{ value: 'fixed', label: 'Fixed amount', description: 'The same sum off every order.' }, …]}" },
        { title: KitCopy.t('docs.radio-group.boxed'), text: KitCopy.t('docs.radio-group.eachChoiceInABox'), demo: RadioGroupKit.group({ label: KitCopy.t('docs.radio-group.kind'), options: RadioGroupKit.TOLD, boxed: true }, 'fixed'), code: '<RadioGroup boxed label="Kind" … />' },
        { title: KitCopy.t('docs.radio-group.boxedTwoColumns'), demo: RadioGroupKit.group({ label: KitCopy.t('docs.radio-group.kind'), options: RadioGroupKit.TOLD, boxed: true, twoColumns: true }, 'percent'), code: '<RadioGroup boxed twoColumns label="Kind" … />' },
        { title: KitCopy.t('docs.radio-group.disabled'), text: KitCopy.t('docs.radio-group.theWholeGroupOrOne'), demo: RadioGroupKit.group({ label: KitCopy.t('docs.radio-group.appliesTo'), options: RadioGroupKit.PLAIN, disabled: true }, 'some'), code: '<RadioGroup disabled … />' },
      ],
      options: [
        { name: 'options', type: '{ value, label, description?, disabled? }[]', does: KitCopy.t('docs.radio-group.theChoices') },
        { name: 'value, onChange', type: 'string, (value) => void', does: KitCopy.t('docs.radio-group.theChosenValueAndWhat') },
        { name: 'label', type: 'string', does: KitCopy.t('docs.radio-group.whatIsBeingChosenAlso') },
        { name: 'boxed', type: 'boolean', initial: 'false', does: KitCopy.t('docs.radio-group.eachChoiceInItsOwn') },
        { name: 'twoColumns', type: 'boolean', initial: 'false', does: KitCopy.t('docs.radio-group.boxesSideBySideWhere') },
        { name: 'disabled', type: 'boolean', initial: 'false', does: KitCopy.t('docs.radio-group.theWholeGroupIsNot') },
      ],
    };
  }
}
