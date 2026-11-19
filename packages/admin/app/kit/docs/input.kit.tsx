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
      slug: 'input', name: 'Input', group: 'Forms',
      intro: 'One line of text. Every single-line field in the console is this one, 32px high with 13px text.',
      from: "import { Input } from '@fromcode119/sdk/admin';",
      examples: [
        { title: 'With a label', text: 'The label stands above the field, short, in sentence case.', demo: InputKit.field({ label: 'Title' }, 'Cotton T-shirt'), code: '<Input label="Title" value={title} onChange={(event) => setTitle(event.target.value)} />' },
        { title: 'Placeholder', text: 'An example of what goes in — never the label and never the explanation.', demo: InputKit.field({ label: 'Handle', placeholder: 'cotton-t-shirt' }), code: '<Input label="Handle" placeholder="cotton-t-shirt" value={handle} onChange={…} />' },
        { title: 'With an error', text: 'The field turns to the danger tone and says what is wrong under it.', demo: InputKit.field({ label: 'Handle', error: 'This handle is taken' }, 'cotton-t-shirt'), code: '<Input label="Handle" error="This handle is taken" value={handle} onChange={…} />' },
        { title: 'Disabled and read-only', text: 'Disabled is “not available now”. Read-only is “may be read, may not be changed” and keeps its text colour.', demo: <>{InputKit.field({ label: 'Disabled', disabled: true }, 'Cotton T-shirt')}{InputKit.field({ label: 'Read-only', readOnly: true }, 'prod_01M7R4')}</>, code: '<Input label="Disabled" disabled value={value} />\n<Input label="Read-only" readOnly value={value} />' },
        { title: 'Kinds', text: 'Anything a native input takes is passed through: the kind, a pattern, a length.', demo: <>{InputKit.field({ label: 'Email', type: 'email', placeholder: 'name@example.com' })}{InputKit.field({ label: 'Password', type: 'password' }, 'secret')}{InputKit.field({ label: 'Number', type: 'number' }, '12')}</>, code: '<Input label="Email" type="email" … />\n<Input label="Password" type="password" … />\n<Input label="Number" type="number" … />' },
        { title: 'Without a label', text: 'In a table cell or a toolbar, where what it is for is already said. Give it an aria-label.', demo: InputKit.field({ 'aria-label': 'Quantity', placeholder: 'Quantity' }), code: '<Input aria-label="Quantity" placeholder="Quantity" value={quantity} onChange={…} />' },
      ],
      options: [
        { name: 'label', type: 'string', does: 'The words above the field.' },
        { name: 'value, onChange', type: 'string, (event) => void', does: 'What the field holds and what happens when it is typed in.' },
        { name: 'error', type: 'string', does: 'What is wrong, shown under the field in the danger tone.' },
        { name: 'placeholder', type: 'string', does: 'An example of the value, shown while the field is empty.' },
        { name: 'disabled, readOnly', type: 'boolean', initial: 'false', does: 'Not available / may be read only.' },
        { name: 'className, inputClassName', type: 'string', does: 'A class on the wrapper / on the field itself. Not for sizes: the height and the text size are the kit’s.' },
        { name: 'type, name, maxLength…', type: 'input attributes', does: 'Everything a native input takes is passed through.' },
      ],
    };
  }
}
