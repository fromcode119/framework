import { RadioGroup } from '@/components/ui/view/radio-group.client';
import { KitPlay } from '@/app/kit/view/kit-play.client';
import type { KitDoc } from '@/app/kit/kit-doc';

export class RadioGroupKit {
  private static readonly PLAIN = [{ value: 'all', label: 'Every product' }, { value: 'some', label: 'Chosen products' }, { value: 'none', label: 'No products', disabled: true }];
  private static readonly TOLD = [{ value: 'fixed', label: 'Fixed amount', description: 'The same sum off every order.' }, { value: 'percent', label: 'Percentage', description: 'A share of the order’s total.' }];

  private static group(props: Record<string, any>, initial: string): any {
    return <div className="fc-kitdoc__cell fc-kitdoc__cell--wide"><KitPlay initial={initial}>{(value, set) => <RadioGroup {...(props as any)} value={value} onChange={set} />}</KitPlay></div>;
  }

  static doc(): KitDoc {
    return {
      slug: 'radio-group', name: 'RadioGroup', group: 'Forms',
      intro: 'One choice out of a few, all of them on screen at once.',
      from: "import { RadioGroup } from '@fromcode119/sdk/admin';",
      examples: [
        { title: 'Plain', demo: RadioGroupKit.group({ label: 'Applies to', options: RadioGroupKit.PLAIN }, 'all'), code: "<RadioGroup label=\"Applies to\" value={scope} onChange={setScope}\n  options={[{ value: 'all', label: 'Every product' }, { value: 'some', label: 'Chosen products' }]} />" },
        { title: 'With descriptions', demo: RadioGroupKit.group({ label: 'Kind', options: RadioGroupKit.TOLD }, 'fixed'), code: "options={[{ value: 'fixed', label: 'Fixed amount', description: 'The same sum off every order.' }, …]}" },
        { title: 'Boxed', text: 'Each choice in a box of its own, the chosen one outlined — for a choice that decides what the rest of the form is.', demo: RadioGroupKit.group({ label: 'Kind', options: RadioGroupKit.TOLD, boxed: true }, 'fixed'), code: '<RadioGroup boxed label="Kind" … />' },
        { title: 'Boxed, two columns', demo: RadioGroupKit.group({ label: 'Kind', options: RadioGroupKit.TOLD, boxed: true, twoColumns: true }, 'percent'), code: '<RadioGroup boxed twoColumns label="Kind" … />' },
        { title: 'Disabled', text: 'The whole group, or one option (see “No products” above).', demo: RadioGroupKit.group({ label: 'Applies to', options: RadioGroupKit.PLAIN, disabled: true }, 'some'), code: '<RadioGroup disabled … />' },
      ],
      options: [
        { name: 'options', type: '{ value, label, description?, disabled? }[]', does: 'The choices.' },
        { name: 'value, onChange', type: 'string, (value) => void', does: 'The chosen value and what happens on a choice.' },
        { name: 'label', type: 'string', does: 'What is being chosen; also the group’s accessible name.' },
        { name: 'boxed', type: 'boolean', initial: 'false', does: 'Each choice in its own box.' },
        { name: 'twoColumns', type: 'boolean', initial: 'false', does: 'Boxes side by side where there is room.' },
        { name: 'disabled', type: 'boolean', initial: 'false', does: 'The whole group is not available.' },
      ],
    };
  }
}
