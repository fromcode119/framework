import { FrameworkIcons } from '@fromcode119/react';
import { Heading } from '@/components/ui/view/heading.client';
import { Text } from '@/components/ui/view/text.client';
import { Label } from '@/components/ui/view/label.client';
import { Hint } from '@/components/ui/view/hint.client';
import { IconBadge } from '@/components/ui/view/icon-badge.client';
import { InlineTip } from '@/components/ui/view/inline-tip.client';
import { Popover } from '@/components/ui/view/popover.client';
import { AffixInput } from '@/components/ui/view/affix-input.client';
import { OtpInput } from '@/components/ui/view/otp-input.client';
import { Switch } from '@/components/ui/view/switch.client';
import { Input } from '@/components/ui/view/input.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { KitPlay } from '@/app/kit/view/kit-play.client';
import type { KitDoc } from '@/app/kit/kit-doc';

export class NewPiecesKit {
  private static affix(props: Record<string, any>, initial: string): any {
    return <div className="fc-kitdoc__cell"><KitPlay initial={initial}>{(value, set) => <AffixInput {...(props as any)} value={value} onChange={set} />}</KitPlay></div>;
  }

  static docs(): KitDoc[] {
    return [
      {
        slug: 'typography', name: 'Heading, Text, Label, Hint', group: 'Typography',
        intro: 'The console’s type as components. A screen uses these instead of writing a size, a weight or a colour of its own — so the type of every screen changes here.',
        from: "import { Heading, Text, Label, Hint } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'Heading', text: 'Three levels. h1 names a page or a record, h2 a card, h3 a group inside a card.', demo: <div className="fc-kitdoc__stack"><Heading level="h1">Heading h1 · 18/28</Heading><Heading level="h2">Heading h2 · 16/24</Heading><Heading level="h3">Heading h3 · 14/20</Heading></div>, code: '<Heading level="h1">Products</Heading>\n<Heading level="h2">Details</Heading>\n<Heading level="h3">Dimensions</Heading>' },
          { title: 'Text sizes', text: '`small` is the console’s own size: values, rows, controls.', demo: <div className="fc-kitdoc__stack"><Text size="large">Large · 16/28 — an opening sentence.</Text><Text size="base">Base · 14/24 — a paragraph to read.</Text><Text size="small">Small · 13/20 — values, rows, controls.</Text><Text size="xsmall">Xsmall · 12/20 — a quiet second line.</Text></div>, code: '<Text size="large">…</Text>\n<Text size="base">…</Text>\n<Text>…</Text>\n<Text size="xsmall">…</Text>' },
          { title: 'Weight and colour', demo: <div className="fc-kitdoc__stack"><Text>Regular</Text><Text weight="plus">Plus — a name or a value inside text</Text><Text muted>Muted — what is read second</Text><Text size="xsmall" muted>Muted, xsmall — a note</Text></div>, code: '<Text weight="plus">Cotton T-shirt</Text>\n<Text muted>8 variants</Text>' },
          { title: 'Label and Hint', text: 'For a control that carries no label of its own. A hint explains; as `error` it says what is wrong.', demo: <div className="fc-kitdoc__stack fc-kitdoc__cell"><Label htmlFor="kit-handle" optional="Optional">Handle</Label><Input id="kit-handle" value="" placeholder="cotton-t-shirt" onChange={() => undefined} /><Hint>Used in the product’s address.</Hint><Hint variant="error">This handle is taken.</Hint></div>, code: '<Label htmlFor="handle" optional="Optional">Handle</Label>\n<Input id="handle" … />\n<Hint>Used in the product’s address.</Hint>\n<Hint variant="error">This handle is taken.</Hint>' },
        ],
        options: [
          { name: 'Heading level', type: "h1 · h2 · h3", initial: 'h1', does: 'The size, and the element.' },
          { name: 'Text size', type: "xsmall · small · base · large", initial: 'small', does: 'The size and its line height.' },
          { name: 'Text weight, muted', type: "regular · plus, boolean", does: 'The medium weight; the quiet colour.' },
          { name: 'Text as', type: "p · span · div", initial: 'p', does: 'The element.' },
          { name: 'Label htmlFor, optional', type: 'string, ReactNode', does: 'The control it names; a quiet word after it.' },
          { name: 'Hint variant', type: "info · error", initial: 'info', does: 'An explanation, or what is wrong.' },
        ],
      },
      {
        slug: 'icon-badge', name: 'IconBadge', group: 'Data',
        intro: 'An icon in a small tinted square: what kind of thing a row or a card is.',
        from: "import { IconBadge } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'Tones', demo: <>{(['neutral', 'info', 'success', 'warning', 'danger'] as const).map((tone) => <IconBadge key={tone} tone={tone}><FrameworkIcons.Plugins size={14} /></IconBadge>)}</>, code: '<IconBadge tone="success"><Icon size={14} /></IconBadge>' },
          { title: 'Sizes', demo: <><IconBadge><FrameworkIcons.Clock size={14} /></IconBadge><IconBadge size="large"><FrameworkIcons.Clock size={16} /></IconBadge></>, code: '<IconBadge><Icon size={14} /></IconBadge>\n<IconBadge size="large"><Icon size={16} /></IconBadge>' },
        ],
        options: [
          { name: 'tone', type: "neutral · info · success · warning · danger", initial: 'neutral', does: 'The tint.' },
          { name: 'size', type: "base · large", initial: 'base', does: '24px or 28px.' },
        ],
      },
      {
        slug: 'inline-tip', name: 'InlineTip', group: 'Feedback',
        intro: 'A tip beside the fields it explains: a coloured bar, a strong word, a sentence or two. For something about the whole page use Alert.',
        from: "import { InlineTip } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'Kinds', demo: <div className="fc-kitdoc__stack fc-kitdoc__cell--wide"><InlineTip label="Tip">A handle is made from the title when left empty.</InlineTip><InlineTip label="Done" variant="success">The address is verified.</InlineTip><InlineTip label="Warning" variant="warning">Changing the handle breaks links that point to the old one.</InlineTip><InlineTip label="Error" variant="error">The certificate could not be issued.</InlineTip></div>, code: '<InlineTip label="Tip">A handle is made from the title when left empty.</InlineTip>\n<InlineTip label="Warning" variant="warning">Changing the handle breaks old links.</InlineTip>' },
        ],
        options: [
          { name: 'label', type: 'ReactNode', does: 'The strong word it starts with.' },
          { name: 'variant', type: "info · success · warning · error", initial: 'info', does: 'The colour of the bar.' },
        ],
      },
      {
        slug: 'popover', name: 'Popover', group: 'Overlays',
        intro: 'A small panel that opens from a control and holds content of its own: a filter, a few fields, a note with an action. For a list of actions use Dropdown.',
        from: "import { Popover } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'With content', text: 'It closes on a press outside and on Esc.', demo: <Popover label="Filter" trigger={<span className="fc-toolbar-btn"><FrameworkIcons.Search size={15} />Filter</span>}><div className="fc-kitdoc__stack"><Switch checked onChange={() => undefined} label="In stock only" /><Switch checked={false} onChange={() => undefined} label="Published only" /></div></Popover>, code: '<Popover label="Filter" trigger={<span className="fc-toolbar-btn">Filter</span>}>\n  <Switch … label="In stock only" />\n  <Switch … label="Published only" />\n</Popover>' },
          { title: 'Side and edge', demo: <><Popover align="end" trigger={<span className="fc-toolbar-btn">Aligned to the end</span>}><span className="fc-field-note">Opens inward from the end.</span></Popover><Popover side="top" trigger={<span className="fc-toolbar-btn">Above</span>}><span className="fc-field-note">Opens above the control.</span></Popover></>, code: '<Popover align="end" …>…</Popover>\n<Popover side="top" …>…</Popover>' },
        ],
        options: [
          { name: 'trigger', type: 'ReactNode', does: 'What opens it.' },
          { name: 'children', type: 'ReactNode', does: 'What it holds.' },
          { name: 'align', type: "start · end", initial: 'start', does: 'Which edge of the control it lines up with.' },
          { name: 'side', type: "bottom · top", initial: 'bottom', does: 'Under or above.' },
          { name: 'label', type: 'string', does: 'Its name for a screen reader.' },
        ],
      },
      {
        slug: 'affix-input', name: 'AffixInput', group: 'Forms',
        intro: 'A field with a fixed part before or after what is typed: a unit, a code, a sign, a domain. The parts are shown, never typed, and never part of the value.',
        from: "import { AffixInput } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'A part before, after, or both', demo: <>{NewPiecesKit.affix({ label: 'Weight', trailing: 'kg', alignEnd: true, inputMode: 'decimal' }, '0.4')}{NewPiecesKit.affix({ label: 'Address', leading: 'https://' , placeholder: 'example.com' }, '')}{NewPiecesKit.affix({ label: 'Amount', leading: 'EUR', trailing: '€', alignEnd: true, inputMode: 'decimal' }, '29.90')}</>, code: '<AffixInput label="Weight" trailing="kg" alignEnd value={weight} onChange={setWeight} />\n<AffixInput label="Address" leading="https://" value={host} onChange={setHost} />\n<AffixInput label="Amount" leading={code} trailing={sign} alignEnd value={amount} onChange={setAmount} />' },
          { title: 'Error and disabled', demo: <>{NewPiecesKit.affix({ label: 'Weight', trailing: 'kg', alignEnd: true, error: 'Must be more than 0' }, '0')}{NewPiecesKit.affix({ label: 'Weight', trailing: 'kg', alignEnd: true, disabled: true }, '0.4')}</>, code: '<AffixInput error="Must be more than 0" … />\n<AffixInput disabled … />' },
        ],
        options: [
          { name: 'value, onChange', type: 'string, (value) => void', does: 'What is typed — without the parts.' },
          { name: 'leading, trailing', type: 'ReactNode', does: 'The fixed parts. What they say is the caller’s.' },
          { name: 'alignEnd', type: 'boolean', initial: 'false', does: 'The value stands against the end, the way a figure is read.' },
          { name: 'label, error', type: 'string', does: 'The words above; what is wrong.' },
          { name: 'placeholder, disabled, inputMode…', type: 'native input attributes', does: 'Passed through.' },
        ],
      },
      {
        slug: 'otp-input', name: 'OtpInput', group: 'Forms',
        intro: 'A short code typed a character a box — from an authenticator or a message. A pasted code fills every box.',
        from: "import { OtpInput } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'Six digits', demo: <KitPlay initial="">{(value, set) => <OtpInput label="Code" value={value} onChange={set} />}</KitPlay>, code: '<OtpInput label="Code" value={code} onChange={setCode} />' },
          { title: 'In groups', demo: <KitPlay initial="123">{(value, set) => <OtpInput label="Code" groupSize={3} value={value} onChange={set} />}</KitPlay>, code: '<OtpInput groupSize={3} … />' },
          { title: 'Four, refused, disabled', demo: <><KitPlay initial="1234">{(value, set) => <OtpInput label="Code" length={4} invalid value={value} onChange={set} />}</KitPlay><OtpInput label="Code" length={4} disabled value="12" onChange={() => undefined} /></>, code: '<OtpInput length={4} invalid … />\n<OtpInput length={4} disabled … />' },
        ],
        options: [
          { name: 'value, onChange', type: 'string, (value) => void', does: 'The code so far.' },
          { name: 'length', type: 'number', initial: '6', does: 'How many characters.' },
          { name: 'groupSize', type: 'number', does: 'A dash after every this many boxes.' },
          { name: 'invalid, disabled, autoFocus', type: 'boolean', initial: 'false', does: 'Refused / not available / takes the cursor.' },
          { name: 'label', type: 'string', does: 'What the code is, for a screen reader.' },
        ],
      },
    ];
  }
}
