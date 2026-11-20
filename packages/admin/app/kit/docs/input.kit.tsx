import { KitCopy } from '@/app/kit/kit-copy';
import { Input } from '@/components/ui/view/input.client';
import { KitPlay } from '@/app/kit/view/kit-play.client';
import type { KitDoc } from '@/app/kit/kit-doc';

export class InputKit {
  private static field(props: Record<string, any>, initial = ''): any {
    return (
      <div className="fc-kitdoc__cell">
        <KitPlay initial={initial}>{(value, set) => <Input {...props} value={value} onChange={(event: any) => set(event.target.value)} />}</KitPlay>
      </div>
    );
  }

  static doc(): KitDoc {
    return {
      slug: 'input', name: 'Input', group: KitCopy.t('docs.input.forms'),
      intro: KitCopy.t('docs.input.oneLineOfTextEvery'),
      from: "import { Input } from '@fromcode119/sdk/admin';",
      examples: [
        { title: KitCopy.t('docs.input.withALabel'), text: KitCopy.t('docs.input.theLabelStandsAboveThe'), demo: InputKit.field({ label: KitCopy.t('docs.input.title') }, 'Cotton T-shirt'), code: '<Input label="Title" value={title} onChange={(event) => setTitle(event.target.value)} />' },
        { title: KitCopy.t('docs.input.placeholder'), text: KitCopy.t('docs.input.anExampleOfWhatGoes'), demo: InputKit.field({ label: KitCopy.t('docs.input.handle'), placeholder: KitCopy.t('docs.input.cottonTShirt') }), code: '<Input label="Handle" placeholder="cotton-t-shirt" value={handle} onChange={…} />' },
        { title: KitCopy.t('docs.input.withAnError'), text: KitCopy.t('docs.input.theFieldTurnsToThe'), demo: InputKit.field({ label: KitCopy.t('docs.input.handle'), error: 'This handle is taken' }, 'cotton-t-shirt'), code: '<Input label="Handle" error="This handle is taken" value={handle} onChange={…} />' },
        { title: KitCopy.t('docs.input.disabledAndReadOnly'), text: KitCopy.t('docs.input.disabledIsNotAvailableNow'), demo: <>{InputKit.field({ label: KitCopy.t('docs.input.disabled'), disabled: true }, 'Cotton T-shirt')}{InputKit.field({ label: KitCopy.t('docs.input.readOnly'), readOnly: true }, 'prod_01M7R4')}</>, code: '<Input label="Disabled" disabled value={value} />\n<Input label="Read-only" readOnly value={value} />' },
        { title: KitCopy.t('docs.input.kinds'), text: KitCopy.t('docs.input.anythingANativeInputTakes'), demo: <>{InputKit.field({ label: KitCopy.t('docs.input.email'), type: 'email', placeholder: 'name@example.com' })}{InputKit.field({ label: KitCopy.t('docs.input.password'), type: 'password' }, 'secret')}{InputKit.field({ label: KitCopy.t('docs.input.number'), type: 'number' }, '12')}</>, code: '<Input label="Email" type="email" … />\n<Input label="Password" type="password" … />\n<Input label="Number" type="number" … />' },
        { title: KitCopy.t('docs.input.withoutALabel'), text: KitCopy.t('docs.input.inATableCellOr'), demo: InputKit.field({ 'aria-label': KitCopy.t('docs.input.quantity'), placeholder: KitCopy.t('docs.input.quantity') }), code: '<Input aria-label="Quantity" placeholder="Quantity" value={quantity} onChange={…} />' },
      ],
      options: [
        { name: 'label', type: 'string', does: KitCopy.t('docs.input.theWordsAboveTheField') },
        { name: 'value, onChange', type: 'string, (event) => void', does: KitCopy.t('docs.input.whatTheFieldHoldsAnd') },
        { name: 'error', type: 'string', does: KitCopy.t('docs.input.whatIsWrongShownUnder') },
        { name: 'placeholder', type: 'string', does: KitCopy.t('docs.input.anExampleOfTheValue') },
        { name: 'disabled, readOnly', type: 'boolean', initial: 'false', does: KitCopy.t('docs.input.notAvailableMayBeRead') },
        { name: 'className, inputClassName', type: 'string', does: KitCopy.t('docs.input.aClassOnTheWrapper') },
        { name: 'type, name, maxLength…', type: 'input attributes', does: KitCopy.t('docs.input.everythingANativeInputTakes') },
      ],
    };
  }
}
