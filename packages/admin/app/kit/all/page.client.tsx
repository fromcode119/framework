import type { ReactNode } from 'react';
import { state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { Input } from '@/components/ui/view/input.client';
import { TextArea } from '@/components/ui/view/text-area.client';
import { Select } from '@/components/ui/view/select.client';
import { NumberStepper } from '@/components/ui/number-stepper';
import { DateTimePicker } from '@/components/ui/date-time-picker/view/index.client';
import { Checkbox } from '@/components/ui/view/checkbox.client';
import { Switch } from '@/components/ui/view/switch.client';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { StateBadge } from '@/components/ui/view/state-badge.client';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { Loader } from '@/components/ui/view/loader.client';
import { CopyValue } from '@/components/ui/view/copy-value.client';
import { ListSearchInput } from '@/components/ui/list-toolbar/view/list-search-input.client';
import { KitSurfaces } from '@/app/kit/kit-surfaces.client';
import { KitExtras } from '@/app/kit/kit-extras.client';
import { KitPages } from '@/app/kit/kit-pages.client';
import { KitType } from '@/app/kit/kit-type.client';

/**
 * Every console component on one sheet, each in its states, so the whole kit is judged in one look
 * and measured against the reference in one pass. Nothing here is a screen an operator uses; the
 * names are the components' own.
 */
export class KitSheetPage extends AdminComponent {
  @state private text = 'Cotton T-shirt';
  @state private choice = 'b';
  @state private amount: number | string = 3;
  @state private date = '';
  @state private on = true;
  @state private ticked = true;
  @state private query = '';

  @bound private setText(event: any): void { this.text = event.target.value; }
  @bound private setChoice(value: string): void { this.choice = value; }
  @bound private setAmount(value: number | string): void { this.amount = value; }
  @bound private setDate(value: string | null): void { this.date = value || ''; }
  @bound private setOn(value: boolean): void { this.on = value; }
  @bound private setTicked(value: boolean): void { this.ticked = value; }
  @bound private setQuery(value: string): void { this.query = value; }

  private block(name: string, children: ReactNode): ReactNode {
    return (
      <RecordCard title={name} id={`kit-${name.toLowerCase().replace(/[^a-z]+/g, '-')}`}>
        <div className="fc-kit__row">{children}</div>
      </RecordCard>
    );
  }

  render(): ReactNode {
    const options = [{ label: 'Draft', value: 'a' }, { label: 'Published', value: 'b' }, { label: 'Archived', value: 'c' }];
    return (
      <div className="fc-kit">
        {this.block('Button', (
          <>
            <Button variant={ButtonVariant.PRIMARY}>Primary</Button>
            <Button variant={ButtonVariant.SECONDARY}>Secondary</Button>
            <Button variant={ButtonVariant.GHOST}>Ghost</Button>
            <Button variant={ButtonVariant.DANGER}>Danger</Button>
            <Button variant={ButtonVariant.SECONDARY} icon={<FrameworkIcons.Plus size={15} />}>With icon</Button>
            <Button variant={ButtonVariant.SECONDARY} size={FieldSize.ICON} aria-label="Icon"><FrameworkIcons.Edit size={15} /></Button>
            <Button variant={ButtonVariant.PRIMARY} isLoading>Loading</Button>
            <Button variant={ButtonVariant.SECONDARY} disabled>Disabled</Button>
          </>
        ))}
        {this.block('Input', (
          <>
            <div className="fc-kit__cell"><Input label="Label" value={this.text} onChange={this.setText} /></div>
            <div className="fc-kit__cell"><Input label="Placeholder" value="" placeholder="Placeholder" onChange={this.setText} /></div>
            <div className="fc-kit__cell"><Input label="Error" value={this.text} error="This value is taken" onChange={this.setText} /></div>
            <div className="fc-kit__cell"><Input label="Disabled" value={this.text} disabled onChange={this.setText} /></div>
            <div className="fc-kit__cell"><ListSearchInput value={this.query} onSearch={this.setQuery} placeholder="Search" theme={this.theme} /></div>
          </>
        ))}
        {this.block('TextArea', (
          <div className="fc-kit__cell fc-kit__cell--wide"><TextArea label="Label" value={this.text} onChange={this.setText} /></div>
        ))}
        {this.block('Select', (
          <>
            <div className="fc-kit__cell"><Select label="Label" value={this.choice} onChange={this.setChoice} options={options} /></div>
            <div className="fc-kit__cell"><Select label="Searchable" searchable value={this.choice} onChange={this.setChoice} options={options} /></div>
            <div className="fc-kit__cell"><Select label="Disabled" disabled value={this.choice} onChange={this.setChoice} options={options} /></div>
          </>
        ))}
        {this.block('NumberStepper', (
          <div className="fc-kit__cell"><NumberStepper value={this.amount} onChange={this.setAmount} min={0} /></div>
        ))}
        {this.block('DateTimePicker', (
          <>
            <div className="fc-kit__cell"><DateTimePicker value={this.date} onChange={this.setDate} placeholder="Date" /></div>
            <div className="fc-kit__cell"><DateTimePicker value={this.date} onChange={this.setDate} showTime placeholder="Date and time" /></div>
          </>
        ))}
        {this.block('Checkbox', (
          <>
            <Checkbox checked={this.ticked} onChange={this.setTicked} label="Checked" />
            <Checkbox checked={false} onChange={this.setTicked} label="Unchecked" />
            <Checkbox checked={false} indeterminate onChange={this.setTicked} label="Indeterminate" />
            <Checkbox checked disabled label="Disabled" />
          </>
        ))}
        {this.block('Switch', (
          <>
            <Switch checked={this.on} onChange={this.setOn} label="On" />
            <Switch checked={false} onChange={this.setOn} label="Off" />
            <Switch checked disabled onChange={this.setOn} label="Disabled" />
          </>
        ))}
        {this.block('Badge', (
          <>
            <Badge variant={BadgeVariant.SUCCESS}>Success</Badge>
            <Badge variant={BadgeVariant.WARNING}>Warning</Badge>
            <Badge variant={BadgeVariant.DANGER}>Danger</Badge>
            <Badge variant={BadgeVariant.INFO}>Info</Badge>
            <Badge variant={BadgeVariant.DEFAULT}>Neutral</Badge>
            <StateBadge tone="success">Published</StateBadge>
            <StateBadge tone="warning">Draft</StateBadge>
            <StateBadge tone="danger">Rejected</StateBadge>
            <StateBadge tone="default">Proposed</StateBadge>
          </>
        ))}
        {this.block('CopyValue', <CopyValue value="prod_01M7R4CRJEHHPTTF1KVTJXKCEE" />)}
        {this.block('EmptyState', (
          <div className="fc-kit__cell fc-kit__cell--wide">
            <EmptyState icon={<FrameworkIcons.Search size={18} />} title="No records" hint="Nothing matches the filters in force." action={<Button variant={ButtonVariant.SECONDARY}>Clear filters</Button>} />
          </div>
        ))}
        {this.block('Loader', <Loader label="Loading" />)}
        <KitType />
        <KitExtras />
        <KitSurfaces />
        <KitPages />
      </div>
    );
  }
}
