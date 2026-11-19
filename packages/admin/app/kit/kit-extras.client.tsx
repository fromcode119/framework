import type { ReactNode } from 'react';
import { Reactor, state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { Tabs } from '@/components/ui/view/tabs.client';
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
  @state private file: File | null = null;
  @state private colour = '#3b82f6';
  @state private chips: string[] = ['cotton', 'summer'];
  @state private tags: string[] | string = ['New', 'Sale'];
  @state private code = '{\n  "handle": "cotton-t-shirt"\n}';

  @bound private setTab(id: string): void { this.tab = id; }
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
