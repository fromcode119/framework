import { KitCopy } from '@/app/kit/kit-copy';
import { SettingRow } from '@/components/ui/view/setting-row.client';
import { SettingRowWidth } from '@/components/ui/enums/setting-row-width.enum';
import { Card } from '@/components/ui/view/card.client';
import { Switch } from '@/components/ui/view/switch.client';
import { Select } from '@/components/ui/view/select.client';
import { NumberStepper } from '@/components/ui/number-stepper';
import { DateTimePicker } from '@/components/ui/date-time-picker/view/index.client';
import { DateTimePickerGranularity } from '@/components/ui/date-time-picker/enums/date-time-picker-granularity.enum';
import { KitPlay } from '@/app/kit/view/kit-play.client';
import { PersonField } from '@/components/collection/fields/view/person-field.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Hint } from '@/components/ui/view/hint.client';
import type { KitDoc } from '@/app/kit/kit-doc';

export class FieldsMoreKit {
  private static number(props: Record<string, any>, initial: number | string): any {
    return <div className="fc-kitdoc__cell"><KitPlay initial={initial}>{(value, set) => <NumberStepper {...props} value={value} onChange={set} />}</KitPlay></div>;
  }

  private static date(props: Record<string, any>): any {
    return <div className="fc-kitdoc__cell"><KitPlay initial="">{(value, set) => <DateTimePicker {...props} value={value} onChange={(next: string | null) => set(next || '')} />}</KitPlay></div>;
  }

  static docs(): KitDoc[] {
    return [
      {
        slug: 'number-stepper', name: 'NumberStepper', group: KitCopy.t('docs.fields-more.forms'),
        intro: KitCopy.t('docs.fields-more.aNumberThatIsNudged'),
        from: "import { NumberStepper } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.fields-more.plain'), demo: FieldsMoreKit.number({}, 3), code: '<NumberStepper value={quantity} onChange={setQuantity} />' },
          { title: KitCopy.t('docs.fields-more.limitsAndStep'), text: KitCopy.t('docs.fields-more.itStopsAtMinAnd'), demo: <>{FieldsMoreKit.number({ min: 0, max: 10 }, 0)}{FieldsMoreKit.number({ step: 5, min: 0 }, 15)}</>, code: '<NumberStepper min={0} max={10} … />\n<NumberStepper step={5} min={0} … />' },
          { title: KitCopy.t('docs.fields-more.emptyErrorDisabled'), demo: <>{FieldsMoreKit.number({ placeholder: KitCopy.t('docs.fields-more.days') }, '')}{FieldsMoreKit.number({ error: 'Must be at least 1' }, 0)}{FieldsMoreKit.number({ disabled: true }, 3)}</>, code: '<NumberStepper placeholder="Days" … />\n<NumberStepper error="Must be at least 1" … />\n<NumberStepper disabled … />' },
        ],
        options: [
          { name: 'value, onChange', type: 'number | string, (value) => void', does: KitCopy.t('docs.fields-more.theNumberAnEmptyField') },
          { name: 'min, max, step', type: 'number', initial: 'none, none, 1', does: KitCopy.t('docs.fields-more.whereItStopsAndHow') },
          { name: 'placeholder', type: 'string', does: KitCopy.t('docs.fields-more.shownWhileEmpty') },
          { name: 'error', type: 'string', does: KitCopy.t('docs.fields-more.whatIsWrongUnderThe') },
          { name: 'disabled', type: 'boolean', initial: 'false', does: KitCopy.t('docs.fields-more.notAvailable') },
        ],
      },
      {
        slug: 'person-field', name: 'PersonField', group: KitCopy.t('docs.fields-more.forms'),
        intro: KitCopy.t('docs.fields-more.someoneFromPeoplePickedBy'),
        from: "{ name: 'personId', type: 'number', admin: { component: 'PersonField', personFields: { name: 'fullName', email: 'email' } } }",
        examples: [
          { title: KitCopy.t('docs.fields-more.searchAndPick'), text: KitCopy.t('docs.fields-more.typeANameAnEmail'), demo: <div className="fc-kitdoc__cell"><KitPlay initial={null}>{(value, set) => <PersonField value={value} onChange={set} onPatch={() => undefined} field={{ admin: {} }} />}</KitPlay></div>, code: '<PersonField value={personId} onChange={setPersonId} onPatch={patch} field={field} />' },
          { title: KitCopy.t('docs.fields-more.readOnly'), demo: <div className="fc-kitdoc__cell"><PersonField value={null} field={{ admin: { readOnly: true } }} /></div>, code: "{ …, admin: { component: 'PersonField', readOnly: true } }" },
        ],
        options: [
          { name: 'value, onChange', type: 'number | null', does: KitCopy.t('docs.fields-more.thePersonSIdIn') },
          { name: 'admin.personFields', type: '{ name, email, phone }', does: KitCopy.t('docs.fields-more.whichOfTheCollectionS') },
          { name: 'admin.readOnly', type: 'boolean', initial: 'false', does: KitCopy.t('docs.fields-more.showsWhoIsLinkedCannot') },
        ],
      },
      {
        slug: 'setting-row', name: 'SettingRow', group: KitCopy.t('docs.fields-more.forms'),
        intro: KitCopy.t('docs.fields-more.oneSettingItsNameAnd'),
        from: "import { SettingRow, SettingRowWidth } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.fields-more.aSwitchANumberA'), flush: true, text: KitCopy.t('docs.fields-more.theControlIsAsWide'), demo: <Card noPadding><SettingRow title={KitCopy.t('docs.fields-more.twoFactorSignIn')} description={KitCopy.t('docs.fields-more.accountsMayAddASecond')} width={SettingRowWidth.AUTO}><KitPlay initial={true}>{(value, set) => <Switch checked={value} onChange={set} />}</KitPlay></SettingRow><SettingRow title={KitCopy.t('docs.fields-more.failedLoginsBeforeLockout')} description={KitCopy.t('docs.fields-more.howManyFailedSignIns')} width={SettingRowWidth.NARROW}><KitPlay initial={5}>{(value, set) => <NumberStepper value={value} onChange={set} min={1} />}</KitPlay></SettingRow><SettingRow title={KitCopy.t('docs.fields-more.defaultLanguage')} description={KitCopy.t('docs.fields-more.theLanguageANewVisitor')}><KitPlay initial="en">{(value, set) => <Select value={value} onChange={set} options={[{ label: KitCopy.t('docs.fields-more.english'), value: 'en' }, { label: KitCopy.t('docs.fields-more.bulgarian'), value: 'bg' }]} />}</KitPlay></SettingRow></Card>, code: '<Card noPadding>\n  <SettingRow title="Two-factor sign-in" description="Accounts may add a second factor." width={SettingRowWidth.AUTO}>\n    <Switch checked={on} onChange={setOn} />\n  </SettingRow>\n  <SettingRow title="Failed logins before lockout" width={SettingRowWidth.NARROW}>\n    <NumberStepper value={count} onChange={setCount} />\n  </SettingRow>\n</Card>' },
          { title: KitCopy.t('docs.fields-more.withAnExplanation'), flush: true, text: KitCopy.t('docs.fields-more.whatTheControlDoesPer'), demo: <Card noPadding><SettingRow title={KitCopy.t('docs.fields-more.underAttackMode')} description={KitCopy.t('docs.fields-more.everyVisitorPassesABrowser')} explanation="On: every request is checked first, which slows the first visit. Off: only requests that look like an attack are checked." width={SettingRowWidth.AUTO}><Switch checked={false} onChange={() => undefined} /></SettingRow></Card>, code: '<SettingRow title="Under attack mode" description="…" explanation="On: … Off: …" width={SettingRowWidth.AUTO}>…</SettingRow>' },
          { title: KitCopy.t('docs.fields-more.aControlUnderTheText'), flush: true, text: KitCopy.t('docs.fields-more.widePutsTheControlOn'), demo: <Card noPadding><SettingRow title={KitCopy.t('docs.fields-more.trustedRelays')} description={KitCopy.t('docs.fields-more.addressesWhoseForwardedHeadersAre')} wide><KitPlay initial="">{(value, set) => <NumberStepper value={value} onChange={set} placeholder={KitCopy.t('docs.fields-more.aWideControlStandsHere')} />}</KitPlay></SettingRow></Card>, code: '<SettingRow title="Trusted relays" description="…" wide>…</SettingRow>' },
          { title: KitCopy.t('docs.fields-more.twoControlsAShortOne'), flush: true, text: KitCopy.t('docs.fields-more.severalControlsOfOneSetting'), demo: <Card noPadding><SettingRow title={KitCopy.t('docs.fields-more.usageReport')} description={KitCopy.t('docs.fields-more.aWeeklyCountOfWhat')} width={SettingRowWidth.AUTO}><div className="fc-settings-group"><KitPlay initial={true}>{(value, set) => <Switch checked={value} onChange={set} />}</KitPlay><Button variant={ButtonVariant.SECONDARY}>{KitCopy.t('docs.fields-more.sendNow')}</Button></div></SettingRow><SettingRow title={KitCopy.t('docs.fields-more.keepBuilds')} description={KitCopy.t('docs.fields-more.howManyEarlierBuildsStay')}><div className="fc-settings-short fc-settings-short--narrow"><KitPlay initial={3}>{(value, set) => <NumberStepper min={0} value={value} onChange={set} />}</KitPlay></div></SettingRow><div className="fc-settings-note"><Hint>{KitCopy.t('docs.fields-more.nothingIsSentWhileThe')}</Hint></div></Card>, code: '<SettingRow title="Usage report" width={SettingRowWidth.AUTO}>\n  <div className="fc-settings-group">\n    <Switch … />\n    <Button variant={ButtonVariant.SECONDARY}>Send now</Button>\n  </div>\n</SettingRow>\n<SettingRow title="Keep builds">\n  <div className="fc-settings-short fc-settings-short--narrow"><NumberStepper … /></div>\n</SettingRow>\n<div className="fc-settings-note"><Hint>…</Hint></div>' },
        ],
        options: [
          { name: 'title', type: 'ReactNode', does: KitCopy.t('docs.fields-more.theSettingSName') },
          { name: 'description', type: 'ReactNode', does: KitCopy.t('docs.fields-more.oneLineUnderTheName') },
          { name: 'explanation', type: 'ReactNode', does: KitCopy.t('docs.fields-more.whatTheControlDoesBehind') },
          { name: 'children', type: 'ReactNode', does: KitCopy.t('docs.fields-more.theControl') },
          { name: 'width', type: 'SettingRowWidth', initial: 'FIELD', does: KitCopy.t('docs.fields-more.narrowFieldOrAutoHow') },
          { name: 'wide', type: 'boolean', initial: 'false', does: KitCopy.t('docs.fields-more.theControlOnALine') },
        ],
      },
      {
        slug: 'date-time-picker', name: 'DateTimePicker', group: KitCopy.t('docs.fields-more.forms'),
        intro: KitCopy.t('docs.fields-more.aDayOrADay'),
        from: "import { DateTimePicker } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.fields-more.aDay'), demo: FieldsMoreKit.date({ placeholder: KitCopy.t('docs.fields-more.date') }), code: '<DateTimePicker value={day} onChange={setDay} placeholder="Date" />' },
          { title: KitCopy.t('docs.fields-more.aDayAndATime'), text: KitCopy.t('docs.fields-more.minutestepSetsHowFineThe'), demo: <>{FieldsMoreKit.date({ showTime: true, placeholder: KitCopy.t('docs.fields-more.dateAndTime') })}{FieldsMoreKit.date({ showTime: true, minuteStep: 15, placeholder: KitCopy.t('docs.fields-more.every15Minutes') })}</>, code: '<DateTimePicker showTime value={at} onChange={setAt} />\n<DateTimePicker showTime minuteStep={15} … />' },
          { title: KitCopy.t('docs.fields-more.aTimeOfDayAlone'), text: KitCopy.t('docs.fields-more.aTimeIsNotA'), demo: FieldsMoreKit.date({ granularity: DateTimePickerGranularity.TIME, placeholder: KitCopy.t('docs.fields-more.time') }), code: '<DateTimePicker granularity={DateTimePickerGranularity.TIME} value={opensAt} onChange={setOpensAt} />' },
          { title: KitCopy.t('docs.fields-more.aMonthOrAYear'), demo: <>{FieldsMoreKit.date({ granularity: DateTimePickerGranularity.MONTH, placeholder: KitCopy.t('docs.fields-more.month') })}{FieldsMoreKit.date({ granularity: DateTimePickerGranularity.YEAR, placeholder: KitCopy.t('docs.fields-more.year') })}</>, code: '<DateTimePicker granularity={DateTimePickerGranularity.MONTH} … />' },
          { title: KitCopy.t('docs.fields-more.disabled'), demo: FieldsMoreKit.date({ disabled: true, placeholder: KitCopy.t('docs.fields-more.date') }), code: '<DateTimePicker disabled … />' },
        ],
        options: [
          { name: 'value, onChange', type: 'string, (value | null) => void', does: KitCopy.t('docs.fields-more.theMomentAsTextNull') },
          { name: 'showTime', type: 'boolean', initial: 'false', does: KitCopy.t('docs.fields-more.addsTheTimeOfDay') },
          { name: 'granularity', type: 'DateTimePickerGranularity', does: KitCopy.t('docs.fields-more.aDayAMomentOr') },
          { name: 'minuteStep', type: 'number', initial: '1', does: KitCopy.t('docs.fields-more.theStepOfTheMinutes') },
          { name: 'placeholder, disabled', type: 'string, boolean', does: KitCopy.t('docs.fields-more.shownWhileEmptyNotAvailable') },
        ],
      },
    ];
  }
}
