import type { ReactNode } from 'react';
import { Reactor, state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { Tabs } from '@/components/ui/view/tabs.client';
import { ProgressTabs } from '@/components/ui/view/progress-tabs.client';
import { RadioGroup } from '@/components/ui/view/radio-group.client';
import { Skeleton } from '@/components/ui/view/skeleton.client';
import { MediaRelationField } from '@/components/collection/view/media-relation-field.client';
import { ThemeMode } from '@fromcode119/core/client';
import { CommandPalette } from '@/components/ui/view/command-palette.client';
import { NotificationPanel } from '@/app/components/view/notification-panel.client';
import { Input } from '@/components/ui/view/input.client';
import { Tooltip } from '@/components/ui/view/tooltip.client';
import { Avatar } from '@/components/ui/view/avatar.client';
import { Divider } from '@/components/ui/view/divider.client';
import { FileDropzone } from '@/components/ui/view/file-dropzone.client';
import { ColorField } from '@/components/ui/view/color-field.client';
import { ChipInputField } from '@/components/ui/view/chip-input-field.client';
import { TagField } from '@/components/ui/tag-field/view/index.client';
import { CodeEditor } from '@/components/ui/view/code-editor.client';

/** The kit's remaining pieces: what chooses a view, what names a control, and the fields that are not a line of text. */
export class KitExtras extends Reactor {
  @state private tab = 'general';
  @state private step = 'organize';
  @state private palette = false;
  @state private paletteQuery = '';
  @state private menuQuery = '';
  @state private filled: any = null;
  @state private radio = 'fixed';
  @state private media: any = null;
  @state private file: File | null = null;
  @state private colour = '#3b82f6';
  @state private chips: string[] = ['cotton', 'summer'];
  @state private tags: string[] | string = ['New', 'Sale'];
  @state private code = '{\n  "handle": "cotton-t-shirt"\n}';

  @bound private setTab(id: string): void { this.tab = id; }
  @bound private openPalette(): void { this.paletteQuery = ''; this.palette = true; }
  @bound private closePalette(): void { this.palette = false; }
  @bound private setPaletteQuery(value: string): void { this.paletteQuery = value; }
  @bound private setMenuQuery(event: any): void { this.menuQuery = event.target.value; }
  @bound private setFilled(value: any): void { this.filled = value; }
  private static nothing(): void { /* a sample has nothing to do */ }
  @bound private setStep(id: string): void { this.step = id; }
  @bound private setRadio(value: string): void { this.radio = value; }
  @bound private setMedia(value: any): void { this.media = value; }
  @bound private setFile(file: File | null): void { this.file = file; }
  @bound private setColour(value: string): void { this.colour = value; }
  @bound private setChips(value: string[]): void { this.chips = value; }
  @bound private setTags(value: string[] | string): void { this.tags = value; }
  @bound private setCode(value: string): void { this.code = value; }

  private block(name: string, children: ReactNode): ReactNode {
    return (
      <RecordCard title={name} id={`kit-${name.toLowerCase().replace(/[^a-z]+/g, '-')}`}>
        <div className="fc-kit__row">{children}</div>
      </RecordCard>
    );
  }

  render(): ReactNode {
    const tabs = [
      { id: 'general', label: 'General' },
      { id: 'shipping', label: 'Shipping' },
      { id: 'developer', label: 'Developer' },
      { id: 'off', label: 'Disabled', disabled: true },
    ];
    return (
      <>
        {this.block('Tabs', <Tabs tabs={tabs} value={this.tab} onChange={this.setTab} label="Section" />)}
        <RecordCard title="Tabs heading a page" id="kit-tabbar">
          <nav className="fc-tabs fc-tabbar">
            {tabs.slice(0, 3).map((tab) => (
              <button key={tab.id} type="button" className={`fc-tab${tab.id === this.tab ? ' fc-tab--on' : ''}`} aria-current={tab.id === this.tab ? 'page' : undefined} onClick={() => this.setTab(tab.id)}>{tab.label}</button>
            ))}
          </nav>
        </RecordCard>
        {this.block('Menu search and shortcuts', (
          <>
            {/* The menu's search as it is drawn; the real one listens for ⌘K on the whole window, and a second
                one here would open a second search. */}
            <div className="fc-kit__nav">
              <div className="fc-nav-search">
                <FrameworkIcons.Search size={15} className="fc-nav-search__icon" />
                <Input type="search" value={this.menuQuery} onChange={this.setMenuQuery} placeholder="Search" aria-label="Search" inputClassName="fc-nav-search__field" />
                <button type="button" className="fc-nav-search__kbd" onClick={this.openPalette} aria-label="Search">⌘K</button>
              </div>
            </div>
            <kbd className="fc-kbd">G</kbd>
            <kbd className="fc-kbd">D</kbd>
            <kbd className="fc-kbd">⌘K</kbd>
            <Button variant={ButtonVariant.SECONDARY} onClick={this.openPalette}>Open the big search</Button>
          </>
        ))}
        <CommandPalette
          open={this.palette}
          onClose={this.closePalette}
          query={this.paletteQuery}
          onQuery={this.setPaletteQuery}
          placeholder="Search"
          empty="Nothing matches"
          items={['Dashboard', 'Orders', 'Products', 'Customers', 'Settings'].filter((name) => name.toLowerCase().includes(this.paletteQuery.toLowerCase())).map((name) => ({ id: name, label: name, hint: name === 'Orders' || name === 'Products' ? 'Commerce' : undefined, onSelect: this.closePalette }))}
        />
        <RecordCard title="Notifications" id="kit-notifications">
          <NotificationPanel
            deviceOn={false}
            onToggle={KitExtras.nothing}
            onFollow={KitExtras.nothing}
            onToggleDevice={KitExtras.nothing}
            notifications={[
              { id: '1', title: 'A plugin is waiting for approval', body: 'It was installed and is held until someone turns it on.', createdAt: new Date().toISOString(), source: 'system', read: false, link: '/plugins' },
              { id: '2', title: 'Backup finished', body: 'The nightly archive was written.', createdAt: new Date().toISOString(), source: 'system', read: true },
            ]}
          />
        </RecordCard>
        <RecordCard title="ProgressTabs" id="kit-progresstabs">
          <ProgressTabs
            label="Steps"
            value={this.step}
            onChange={this.setStep}
            steps={[
              { id: 'details', label: 'Details', status: 'completed' },
              { id: 'organize', label: 'Organize', status: 'in-progress' },
              { id: 'variants', label: 'Variants', status: 'not-started' },
              { id: 'inventory', label: 'Inventory', status: 'not-started', disabled: true },
            ]}
          />
        </RecordCard>
        {this.block('RadioGroup', (
          <>
            <div className="fc-kit__cell">
              <RadioGroup label="Kind" value={this.radio} onChange={this.setRadio} options={[{ value: 'fixed', label: 'Fixed amount' }, { value: 'percent', label: 'Percentage' }, { value: 'off', label: 'Disabled', disabled: true }]} />
            </div>
            <div className="fc-kit__cell fc-kit__cell--wide">
              <RadioGroup boxed label="Kind" value={this.radio} onChange={this.setRadio} options={[{ value: 'fixed', label: 'Fixed amount', description: 'The same sum off every order.' }, { value: 'percent', label: 'Percentage', description: 'A share of the order total.' }]} />
            </div>
          </>
        ))}
        {this.block('Skeleton', (
          <div className="fc-kit__skeleton">
            <Skeleton round width={36} height={36} />
            <div className="fc-kit__skeleton-lines"><Skeleton width="40%" /><Skeleton width="70%" height={16} /></div>
          </div>
        ))}
        {this.block('Tooltip', (
          <>
            <Tooltip content="Edit the record">
              <Button variant={ButtonVariant.SECONDARY} size={FieldSize.ICON} aria-label="Edit"><FrameworkIcons.Edit size={15} /></Button>
            </Tooltip>
            <Tooltip content="Shown under the control" side="bottom">
              <Button variant={ButtonVariant.SECONDARY}>Below</Button>
            </Tooltip>
          </>
        ))}
        {this.block('Avatar', (
          <>
            <Avatar fallback="K" size="2xsmall" />
            <Avatar fallback="K" size="xsmall" />
            <Avatar fallback="K" size="small" />
            <Avatar fallback="K" />
            <Avatar fallback="K" size="large" />
            <Avatar fallback="K" size="xlarge" />
          </>
        ))}
        {this.block('Divider', (
          <div className="fc-kit__cell fc-kit__cell--wide fc-kit__stack">
            <Divider />
            <Divider variant="dashed" />
            <div className="fc-kit__inline"><span className="fc-field-note">Left</span><Divider orientation="vertical" /><span className="fc-field-note">Right</span></div>
          </div>
        ))}
        {this.block('FileDropzone', (
          <div className="fc-kit__cell fc-kit__cell--wide"><FileDropzone file={this.file} onSelect={this.setFile} hint="One file, up to 20 MB" /></div>
        ))}
        {this.block('MediaRelationField', (
          <>
            <div className="fc-kit__cell"><MediaRelationField value={this.media} onChange={this.setMedia} theme={ThemeMode.LIGHT} /></div>
            <div className="fc-kit__cell"><MediaRelationField hasMany value={this.filled} onChange={this.setFilled} theme={ThemeMode.LIGHT} /></div>
          </>
        ))}
        {this.block('ColorField', <ColorField value={this.colour} onChange={this.setColour} />)}
        {this.block('ChipInputField', (
          <div className="fc-kit__cell fc-kit__cell--wide"><ChipInputField value={this.chips} onChange={this.setChips} field={{ admin: { placeholder: 'Add a value' } }} /></div>
        ))}
        {this.block('TagField', (
          <div className="fc-kit__cell fc-kit__cell--wide"><TagField value={this.tags} onChange={this.setTags} hasMany allowCreate placeholder="Add a tag" /></div>
        ))}
        {this.block('CodeEditor', (
          <div className="fc-kit__cell fc-kit__cell--wide"><CodeEditor value={this.code} onChange={this.setCode} language="json" height="120px" /></div>
        ))}
      </>
    );
  }
}
