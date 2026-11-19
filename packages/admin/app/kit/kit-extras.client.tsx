import { Kbd } from '@/components/ui/view/kbd.client';
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
import { SidebarAccountCard } from '@/app/components/view/sidebar-account-card.client';
import { SidebarBrandHeader } from '@/app/sidebar-brand-header';
import { NavItemView } from '@/app/components/view/sidebar-nav-item-view.client';
import { SidebarSearch } from '@/app/sidebar-search.client';
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
  @state private level = 'platform';
  @state private kind = 'ai';
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
  @bound private setMenuQuery(value: string): void { this.menuQuery = value; }
  @bound private setFilled(value: any): void { this.filled = value; }
  private static nothing(): void { /* a sample has nothing to do */ }
  @bound private setLevel(id: string): void { this.level = id; }
  @bound private setKind(id: string): void { this.kind = id; }
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
          <div className="fc-kit__pad">
            <Tabs variant="bar" tabs={[...tabs.slice(0, 3), { id: 'security', label: 'Security', end: true }, { id: 'limits', label: 'Limits', end: true }]} value={this.tab} onChange={this.setTab} label="Section" />
          </div>
        </RecordCard>
        <RecordCard title="Tabs in two levels, more than fit a line" id="kit-tabstack">
          <div className="fc-kit__pad">
            <div className="fc-tabstack">
              <Tabs variant="bar" label="Owner" value={this.level} onChange={this.setLevel}
                tabs={[{ id: 'platform', label: 'Platform', icon: <FrameworkIcons.Settings size={15} /> }, { id: 'commerce', label: 'E-commerce Suite' }, { id: 'finance', label: 'Finance Core' }]} />
              <Tabs variant="second" label="Kind" value={this.kind} onChange={this.setKind}
                tabs={[['ai', 'AI Assistant'], ['jobs', 'Background Jobs'], ['email', 'Email Delivery'], ['sso', 'Federated Login (SSO)'], ['storage', 'File Storage'], ['mcp', 'MCP (Model Context Protocol)'], ['monitoring', 'Monitoring'], ['cache', 'System Cache'], ['search', 'Search'], ['sms', 'SMS'], ['payments', 'Payment Gateway']].map(([id, label]) => ({ id, label }))} />
            </div>
          </div>
        </RecordCard>
        {this.block('Menu search and shortcuts', (
          <>
            {/* The menu's own search, the same component the menu renders, inside the menu's own surface —
                told not to listen for ⌘K, which the real one beside it already does. */}
            <div className="fc-nav fc-kit__nav"><SidebarSearch query={this.menuQuery} onQuery={this.setMenuQuery} onPalette={this.openPalette} listens={false} /></div>
            <Kbd>G</Kbd>
            <Kbd>D</Kbd>
            <Kbd>⌘K</Kbd>
            <Button variant={ButtonVariant.SECONDARY} onClick={this.openPalette}>Open the big search</Button>
          </>
        ))}
        {this.block('Menu: head, rows, account', (
          <div className="fc-nav fc-kit__nav fc-kit__nav--menu">
            <SidebarBrandHeader isMini={false} platformName="Console" onClose={KitExtras.nothing} onCollapse={KitExtras.nothing} />
            <div className="fc-nav-list fc-kit__nav-rows">
              <NavItemView label="Dashboard" href="/kit" icon={<FrameworkIcons.Dashboard size={16} />} active shortcut="d" rawPathname="/kit" />
              <NavItemView label="Media" href="/media" icon={<FrameworkIcons.Image size={16} />} shortcut="m" rawPathname="/kit" />
              <NavItemView label="Settings" href="/settings/general" icon={<FrameworkIcons.Settings size={16} />} shortcut="s" rawPathname="/kit" />
            </div>
            <SidebarAccountCard />
          </div>
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
