import { NumberStepper } from '@/components/ui/number-stepper';
import { DateTimePicker } from '@/components/ui/date-time-picker/view/index.client';
import { DateTimePickerGranularity } from '@/components/ui/date-time-picker/enums/date-time-picker-granularity.enum';
import { KitPlay } from '@/app/kit/view/kit-play.client';
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
        slug: 'number-stepper', name: 'NumberStepper', group: 'Forms',
        intro: 'A number that is nudged as often as it is typed: a quantity, a count of days.',
        from: "import { NumberStepper } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'Plain', demo: FieldsMoreKit.number({}, 3), code: '<NumberStepper value={quantity} onChange={setQuantity} />' },
          { title: 'Limits and step', text: 'It stops at `min` and `max` and moves by `step`.', demo: <>{FieldsMoreKit.number({ min: 0, max: 10 }, 0)}{FieldsMoreKit.number({ step: 5, min: 0 }, 15)}</>, code: '<NumberStepper min={0} max={10} … />\n<NumberStepper step={5} min={0} … />' },
          { title: 'Empty, error, disabled', demo: <>{FieldsMoreKit.number({ placeholder: 'Days' }, '')}{FieldsMoreKit.number({ error: 'Must be at least 1' }, 0)}{FieldsMoreKit.number({ disabled: true }, 3)}</>, code: '<NumberStepper placeholder="Days" … />\n<NumberStepper error="Must be at least 1" … />\n<NumberStepper disabled … />' },
        ],
        options: [
          { name: 'value, onChange', type: 'number | string, (value) => void', does: 'The number; an empty field gives an empty string.' },
          { name: 'min, max, step', type: 'number', initial: 'none, none, 1', does: 'Where it stops and how far a press moves it.' },
          { name: 'placeholder', type: 'string', does: 'Shown while empty.' },
          { name: 'error', type: 'string', does: 'What is wrong, under the field.' },
          { name: 'disabled', type: 'boolean', initial: 'false', does: 'Not available.' },
        ],
      },
      {
        slug: 'date-time-picker', name: 'DateTimePicker', group: 'Forms',
        intro: 'A day, or a day and a time, picked from a calendar or typed.',
        from: "import { DateTimePicker } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'A day', demo: FieldsMoreKit.date({ placeholder: 'Date' }), code: '<DateTimePicker value={day} onChange={setDay} placeholder="Date" />' },
          { title: 'A day and a time', text: '`minuteStep` sets how fine the minutes are.', demo: <>{FieldsMoreKit.date({ showTime: true, placeholder: 'Date and time' })}{FieldsMoreKit.date({ showTime: true, minuteStep: 15, placeholder: 'Every 15 minutes' })}</>, code: '<DateTimePicker showTime value={at} onChange={setAt} />\n<DateTimePicker showTime minuteStep={15} … />' },
          { title: 'A time of day alone', text: 'A time is not a moment: it carries no day and no zone — opening hours, a daily run.', demo: FieldsMoreKit.date({ granularity: DateTimePickerGranularity.TIME, placeholder: 'Time' }), code: '<DateTimePicker granularity={DateTimePickerGranularity.TIME} value={opensAt} onChange={setOpensAt} />' },
          { title: 'A month or a year', demo: <>{FieldsMoreKit.date({ granularity: DateTimePickerGranularity.MONTH, placeholder: 'Month' })}{FieldsMoreKit.date({ granularity: DateTimePickerGranularity.YEAR, placeholder: 'Year' })}</>, code: '<DateTimePicker granularity={DateTimePickerGranularity.MONTH} … />' },
          { title: 'Disabled', demo: FieldsMoreKit.date({ disabled: true, placeholder: 'Date' }), code: '<DateTimePicker disabled … />' },
        ],
        options: [
          { name: 'value, onChange', type: 'string, (value | null) => void', does: 'The moment as text; null when it is emptied.' },
          { name: 'showTime', type: 'boolean', initial: 'false', does: 'Adds the time of day.' },
          { name: 'granularity', type: 'DateTimePickerGranularity', does: 'A day, a moment, or a time of day alone.' },
          { name: 'minuteStep', type: 'number', initial: '1', does: 'The step of the minutes.' },
          { name: 'placeholder, disabled', type: 'string, boolean', does: 'Shown while empty / not available.' },
        ],
      },
    ];
  }
}
