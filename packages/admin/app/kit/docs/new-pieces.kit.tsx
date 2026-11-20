import { KitCopy } from '@/app/kit/kit-copy';
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
        slug: 'typography', name: 'Heading, Text, Label, Hint', group: KitCopy.t('docs.new-pieces.typography'),
        intro: KitCopy.t('docs.new-pieces.theConsoleSTypeAs'),
        from: "import { Heading, Text, Label, Hint } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.new-pieces.heading'), text: KitCopy.t('docs.new-pieces.threeLevelsH1NamesA'), demo: <div className="fc-kitdoc__stack"><Heading level="h1">{KitCopy.t('docs.new-pieces.headingH11828')}</Heading><Heading level="h2">{KitCopy.t('docs.new-pieces.headingH21624')}</Heading><Heading level="h3">{KitCopy.t('docs.new-pieces.headingH31420')}</Heading></div>, code: '<Heading level="h1">Products</Heading>\n<Heading level="h2">Details</Heading>\n<Heading level="h3">Dimensions</Heading>' },
          { title: KitCopy.t('docs.new-pieces.textSizes'), text: KitCopy.t('docs.new-pieces.smallIsTheConsoleS'), demo: <div className="fc-kitdoc__stack"><Text size="large">{KitCopy.t('docs.new-pieces.large1628AnOpening')}</Text><Text size="base">{KitCopy.t('docs.new-pieces.base1424AParagraph')}</Text><Text size="small">{KitCopy.t('docs.new-pieces.small1320ValuesRows')}</Text><Text size="xsmall">{KitCopy.t('docs.new-pieces.xsmall1220AQuiet')}</Text></div>, code: '<Text size="large">…</Text>\n<Text size="base">…</Text>\n<Text>…</Text>\n<Text size="xsmall">…</Text>' },
          { title: KitCopy.t('docs.new-pieces.weightAndColour'), demo: <div className="fc-kitdoc__stack"><Text>{KitCopy.t('docs.new-pieces.regular')}</Text><Text weight="plus">{KitCopy.t('docs.new-pieces.plusANameOrA')}</Text><Text muted>{KitCopy.t('docs.new-pieces.mutedWhatIsReadSecond')}</Text><Text size="xsmall" muted>{KitCopy.t('docs.new-pieces.mutedXsmallANote')}</Text></div>, code: '<Text weight="plus">Cotton T-shirt</Text>\n<Text muted>8 variants</Text>' },
          { title: KitCopy.t('docs.new-pieces.labelAndHint'), text: KitCopy.t('docs.new-pieces.forAControlThatCarries'), demo: <div className="fc-kitdoc__stack fc-kitdoc__cell"><Label htmlFor="kit-handle" optional="Optional">{KitCopy.t('docs.new-pieces.handle')}</Label><Input id="kit-handle" value="" placeholder={KitCopy.t('docs.new-pieces.cottonTShirt')} onChange={() => undefined} /><Hint>{KitCopy.t('docs.new-pieces.usedInTheProductS')}</Hint><Hint variant="error">{KitCopy.t('docs.new-pieces.thisHandleIsTaken')}</Hint></div>, code: '<Label htmlFor="handle" optional="Optional">Handle</Label>\n<Input id="handle" … />\n<Hint>Used in the product’s address.</Hint>\n<Hint variant="error">This handle is taken.</Hint>' },
        ],
        options: [
          { name: 'Heading level', type: "h1 · h2 · h3", initial: 'h1', does: KitCopy.t('docs.new-pieces.theSizeAndTheElement') },
          { name: 'Text size', type: "xsmall · small · base · large", initial: 'small', does: KitCopy.t('docs.new-pieces.theSizeAndItsLine') },
          { name: 'Text weight, muted', type: "regular · plus, boolean", does: KitCopy.t('docs.new-pieces.theMediumWeightTheQuiet') },
          { name: 'Text as', type: "p · span · div", initial: 'p', does: KitCopy.t('docs.new-pieces.theElement') },
          { name: 'Label htmlFor, optional', type: 'string, ReactNode', does: KitCopy.t('docs.new-pieces.theControlItNamesA') },
          { name: 'Hint variant', type: "info · error", initial: 'info', does: KitCopy.t('docs.new-pieces.anExplanationOrWhatIs') },
        ],
      },
      {
        slug: 'icon-badge', name: 'IconBadge', group: KitCopy.t('docs.new-pieces.data'),
        intro: KitCopy.t('docs.new-pieces.anIconInASmall'),
        from: "import { IconBadge } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.new-pieces.tones'), demo: <>{(['neutral', 'info', 'success', 'warning', 'danger'] as const).map((tone) => <IconBadge key={tone} tone={tone}><FrameworkIcons.Plugins size={14} /></IconBadge>)}</>, code: '<IconBadge tone="success"><Icon size={14} /></IconBadge>' },
          { title: KitCopy.t('docs.new-pieces.sizes'), demo: <><IconBadge><FrameworkIcons.Clock size={14} /></IconBadge><IconBadge size="large"><FrameworkIcons.Clock size={16} /></IconBadge></>, code: '<IconBadge><Icon size={14} /></IconBadge>\n<IconBadge size="large"><Icon size={16} /></IconBadge>' },
        ],
        options: [
          { name: 'tone', type: "neutral · info · success · warning · danger", initial: 'neutral', does: KitCopy.t('docs.new-pieces.theTint') },
          { name: 'size', type: "base · large", initial: 'base', does: KitCopy.t('docs.new-pieces.n24pxOr28px') },
        ],
      },
      {
        slug: 'inline-tip', name: 'InlineTip', group: KitCopy.t('docs.new-pieces.feedback'),
        intro: KitCopy.t('docs.new-pieces.aTipBesideTheFields'),
        from: "import { InlineTip } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.new-pieces.kinds'), demo: <div className="fc-kitdoc__stack fc-kitdoc__cell--wide"><InlineTip label={KitCopy.t('docs.new-pieces.tip')}>{KitCopy.t('docs.new-pieces.aHandleIsMadeFrom')}</InlineTip><InlineTip label={KitCopy.t('docs.new-pieces.done')} variant="success">{KitCopy.t('docs.new-pieces.theAddressIsVerified')}</InlineTip><InlineTip label={KitCopy.t('docs.new-pieces.warning')} variant="warning">{KitCopy.t('docs.new-pieces.changingTheHandleBreaksLinks')}</InlineTip><InlineTip label={KitCopy.t('docs.new-pieces.error')} variant="error">{KitCopy.t('docs.new-pieces.theCertificateCouldNotBe')}</InlineTip></div>, code: '<InlineTip label="Tip">A handle is made from the title when left empty.</InlineTip>\n<InlineTip label="Warning" variant="warning">Changing the handle breaks old links.</InlineTip>' },
        ],
        options: [
          { name: 'label', type: 'ReactNode', does: KitCopy.t('docs.new-pieces.theStrongWordItStarts') },
          { name: 'variant', type: "info · success · warning · error", initial: 'info', does: KitCopy.t('docs.new-pieces.theColourOfTheBar') },
        ],
      },
      {
        slug: 'popover', name: 'Popover', group: KitCopy.t('docs.new-pieces.overlays'),
        intro: KitCopy.t('docs.new-pieces.aSmallPanelThatOpens'),
        from: "import { Popover } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.new-pieces.withContent'), text: KitCopy.t('docs.new-pieces.itClosesOnAPress'), demo: <Popover label={KitCopy.t('docs.new-pieces.filter')} trigger={<span className="fc-toolbar-btn"><FrameworkIcons.Search size={15} />{KitCopy.t('docs.new-pieces.filter')}</span>}><div className="fc-kitdoc__stack"><Switch checked onChange={() => undefined} label={KitCopy.t('docs.new-pieces.inStockOnly')} /><Switch checked={false} onChange={() => undefined} label={KitCopy.t('docs.new-pieces.publishedOnly')} /></div></Popover>, code: '<Popover label="Filter" trigger={<span className="fc-toolbar-btn">Filter</span>}>\n  <Switch … label="In stock only" />\n  <Switch … label="Published only" />\n</Popover>' },
          { title: KitCopy.t('docs.new-pieces.sideAndEdge'), demo: <><Popover align="end" trigger={<span className="fc-toolbar-btn">{KitCopy.t('docs.new-pieces.alignedToTheEnd')}</span>}><span className="fc-field-note">{KitCopy.t('docs.new-pieces.opensInwardFromTheEnd')}</span></Popover><Popover side="top" trigger={<span className="fc-toolbar-btn">{KitCopy.t('docs.new-pieces.above')}</span>}><span className="fc-field-note">{KitCopy.t('docs.new-pieces.opensAboveTheControl')}</span></Popover></>, code: '<Popover align="end" …>…</Popover>\n<Popover side="top" …>…</Popover>' },
        ],
        options: [
          { name: 'trigger', type: 'ReactNode', does: KitCopy.t('docs.new-pieces.whatOpensIt') },
          { name: 'children', type: 'ReactNode', does: KitCopy.t('docs.new-pieces.whatItHolds') },
          { name: 'align', type: "start · end", initial: 'start', does: KitCopy.t('docs.new-pieces.whichEdgeOfTheControl') },
          { name: 'side', type: "bottom · top", initial: 'bottom', does: KitCopy.t('docs.new-pieces.underOrAbove') },
          { name: 'label', type: 'string', does: KitCopy.t('docs.new-pieces.itsNameForAScreen') },
        ],
      },
      {
        slug: 'affix-input', name: 'AffixInput', group: KitCopy.t('docs.new-pieces.forms'),
        intro: KitCopy.t('docs.new-pieces.aFieldWithAFixed'),
        from: "import { AffixInput } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.new-pieces.aPartBeforeAfterOr'), demo: <>{NewPiecesKit.affix({ label: KitCopy.t('docs.new-pieces.weight'), trailing: 'kg', alignEnd: true, inputMode: 'decimal' }, '0.4')}{NewPiecesKit.affix({ label: KitCopy.t('docs.new-pieces.address'), leading: 'https://' , placeholder: 'example.com' }, '')}{NewPiecesKit.affix({ label: KitCopy.t('docs.new-pieces.amount'), leading: 'EUR', trailing: '€', alignEnd: true, inputMode: 'decimal' }, '29.90')}</>, code: '<AffixInput label="Weight" trailing="kg" alignEnd value={weight} onChange={setWeight} />\n<AffixInput label="Address" leading="https://" value={host} onChange={setHost} />\n<AffixInput label="Amount" leading={code} trailing={sign} alignEnd value={amount} onChange={setAmount} />' },
          { title: KitCopy.t('docs.new-pieces.errorAndDisabled'), demo: <>{NewPiecesKit.affix({ label: KitCopy.t('docs.new-pieces.weight'), trailing: 'kg', alignEnd: true, error: 'Must be more than 0' }, '0')}{NewPiecesKit.affix({ label: KitCopy.t('docs.new-pieces.weight'), trailing: 'kg', alignEnd: true, disabled: true }, '0.4')}</>, code: '<AffixInput error="Must be more than 0" … />\n<AffixInput disabled … />' },
        ],
        options: [
          { name: 'value, onChange', type: 'string, (value) => void', does: KitCopy.t('docs.new-pieces.whatIsTypedWithoutThe') },
          { name: 'leading, trailing', type: 'ReactNode', does: KitCopy.t('docs.new-pieces.theFixedPartsWhatThey') },
          { name: 'alignEnd', type: 'boolean', initial: 'false', does: KitCopy.t('docs.new-pieces.theValueStandsAgainstThe') },
          { name: 'label, error', type: 'string', does: KitCopy.t('docs.new-pieces.theWordsAboveWhatIs') },
          { name: 'placeholder, disabled, inputMode…', type: 'native input attributes', does: KitCopy.t('docs.new-pieces.passedThrough') },
        ],
      },
      {
        slug: 'otp-input', name: 'OtpInput', group: KitCopy.t('docs.new-pieces.forms'),
        intro: KitCopy.t('docs.new-pieces.aShortCodeTypedA'),
        from: "import { OtpInput } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.new-pieces.sixDigits'), demo: <KitPlay initial="">{(value, set) => <OtpInput label={KitCopy.t('docs.new-pieces.code')} value={value} onChange={set} />}</KitPlay>, code: '<OtpInput label="Code" value={code} onChange={setCode} />' },
          { title: KitCopy.t('docs.new-pieces.inGroups'), demo: <KitPlay initial="123">{(value, set) => <OtpInput label={KitCopy.t('docs.new-pieces.code')} groupSize={3} value={value} onChange={set} />}</KitPlay>, code: '<OtpInput groupSize={3} … />' },
          { title: KitCopy.t('docs.new-pieces.fourRefusedDisabled'), demo: <><KitPlay initial="1234">{(value, set) => <OtpInput label={KitCopy.t('docs.new-pieces.code')} length={4} invalid value={value} onChange={set} />}</KitPlay><OtpInput label={KitCopy.t('docs.new-pieces.code')} length={4} disabled value="12" onChange={() => undefined} /></>, code: '<OtpInput length={4} invalid … />\n<OtpInput length={4} disabled … />' },
        ],
        options: [
          { name: 'value, onChange', type: 'string, (value) => void', does: KitCopy.t('docs.new-pieces.theCodeSoFar') },
          { name: 'length', type: 'number', initial: '6', does: KitCopy.t('docs.new-pieces.howManyCharacters') },
          { name: 'groupSize', type: 'number', does: KitCopy.t('docs.new-pieces.aDashAfterEveryThis') },
          { name: 'invalid, disabled, autoFocus', type: 'boolean', initial: 'false', does: KitCopy.t('docs.new-pieces.refusedNotAvailableTakesThe') },
          { name: 'label', type: 'string', does: KitCopy.t('docs.new-pieces.whatTheCodeIsFor') },
        ],
      },
    ];
  }
}
