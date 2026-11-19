import { FrameworkIcons } from '@fromcode119/react';
import { Reactor, state, bound } from '@fromcode119/react-class-components';
import type { ReactNode } from 'react';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { EditSheet } from '@/components/ui/view/edit-sheet.client';
import { FocusModal } from '@/components/ui/view/focus-modal.client';
import { CommandBar } from '@/components/ui/view/command-bar.client';
import { CommandBarCommand } from '@/components/ui/view/command-bar-command.client';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import { Tooltip } from '@/components/ui/view/tooltip.client';
import { Popover } from '@/components/ui/view/popover.client';
import { Checkbox } from '@/components/ui/view/checkbox.client';
import { Switch } from '@/components/ui/view/switch.client';
import { Input } from '@/components/ui/view/input.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { NotificationContextStore } from '@/components/view/notification-context-store.client';
import type { INotificationContextType } from '@/components/interfaces/notification-context-type.interface';
import { KitPlay } from '@/app/kit/view/kit-play.client';
import type { KitDoc } from '@/app/kit/kit-doc';

/** Saving, as the console shows it: the button spins, the sheet leaves, a toast says it is done. */
class SavingDemo extends Reactor {
  static contextType = NotificationContextStore.context;
  declare context: INotificationContextType | undefined;
  @state private shown = false;
  @state private saving = false;

  @bound private open(): void { this.shown = true; }
  @bound private close(): void { this.shown = false; this.saving = false; }
  @bound private save(): void {
    this.saving = true;
    window.setTimeout(() => {
      this.shown = false;
      this.saving = false;
      this.context?.notify(NotificationType.SUCCESS, 'Saved', 'The product was saved.');
    }, 900);
  }

  render(): ReactNode {
    return (
      <>
        <Button variant={ButtonVariant.SECONDARY} onClick={this.open}>Edit and save</Button>
        <EditSheet isOpen={this.shown} onClose={this.close} onSave={this.save} saving={this.saving} title="Edit product" subtitle="Cotton T-shirt">
          <div className="fc-field-stack"><Input label="Title" value="Cotton T-shirt" onChange={() => undefined} /></div>
        </EditSheet>
      </>
    );
  }
}

export class MotionKit {
  private static opens(label: string, render: (open: boolean, close: () => void) => any): any {
    return (
      <KitPlay initial={false}>
        {(open, set) => (<><Button variant={ButtonVariant.SECONDARY} onClick={() => set(true)}>{label}</Button>{render(Boolean(open), () => set(false))}</>)}
      </KitPlay>
    );
  }

  static doc(): KitDoc {
    return {
      slug: 'motion', name: 'Motion', group: 'Foundations',
      intro: 'How the console moves. Three durations and one curve, for everything: what was asked for arrives in 200ms, leaves in 150ms, and what answers the pointer takes 150ms. Nothing gets a number of its own. A reader who asked for less motion gets none.',
      from: '--fc-dur-overlay: 200ms;  --fc-dur-exit: 150ms;  --fc-dur-ui: 150ms;  --fc-ease: cubic-bezier(0.4, 0, 0.2, 1);',
      examples: [
        { title: 'Opening and closing', text: 'The ground fades. A dialog rises 8px and grows from 97%. A sheet comes in from the side it is hinged to. The full-screen modal rises without growing. Each leaves the way it came, a little quicker.', demo: <>{MotionKit.opens('Dialog', (open, close) => <ConfirmDialog isOpen={open} onClose={close} onConfirm={close} title="Publish the product?" description="It becomes visible in the shop at once." confirmLabel="Publish" />)}{MotionKit.opens('Sheet', (open, close) => <EditSheet isOpen={open} onClose={close} onSave={close} title="Edit product"><div className="fc-field-stack"><Input label="Title" value="Cotton T-shirt" onChange={() => undefined} /></div></EditSheet>)}{MotionKit.opens('Focus modal', (open, close) => <FocusModal isOpen={open} label="Create product" onClose={close} onConfirm={close}><div className="fc-kitdoc__cell"><Input label="Title" value="" onChange={() => undefined} /></div></FocusModal>)}</>, code: '/* Nothing to write: every overlay of the kit moves by itself. */' },
        { title: 'Saving', text: 'Three things in a row: the button turns to a spinner and stops taking presses; when the save is done the sheet leaves; a toast rises at the corner to say so. A failed save keeps the sheet open and says what is wrong inside it.', demo: <SavingDemo />, code: '<EditSheet isOpen={open} onSave={save} saving={saving} error={error} … />\n// after a save that worked:\nnotify(NotificationType.SUCCESS, \'Saved\', \'The product was saved.\');' },
        { title: 'Menus, popovers, tooltips', text: 'These open beside the control that asked for them, so they travel half as far (4px) and at the pointer’s speed (150ms).', demo: <><Dropdown align={HorizontalAlign.LEFT} items={[{ label: 'Edit', onClick: () => undefined }, { label: 'Duplicate', onClick: () => undefined }]} trigger={<span className="fc-toolbar-btn"><FrameworkIcons.More size={15} />Menu</span>} /><Popover trigger={<span className="fc-toolbar-btn">Popover</span>}><span className="fc-field-note">A panel of its own content.</span></Popover><Tooltip content="A few words"><Button variant={ButtonVariant.SECONDARY}>Tooltip</Button></Tooltip></>, code: '/* Dropdown, Popover and Tooltip move by themselves. */' },
        { title: 'The bar of commands', text: 'It comes up from the foot of the screen when something is selected, and goes back down when nothing is.', demo: MotionKit.opens('Select 2 rows', (open, close) => <CommandBar open={open} value="2 selected"><CommandBarCommand label="Publish" onClick={close} /><CommandBarCommand label={<FrameworkIcons.Close size={15} />} title="Clear selection" onClick={close} /></CommandBar>), code: '<CommandBar open={selected.length > 0} value={`${selected.length} selected`}>…</CommandBar>' },
        { title: 'What answers the pointer', text: 'A button darkens while it is held. A checkbox pops and draws its tick. A switch slides. All in 150ms.', demo: <><Button variant={ButtonVariant.PRIMARY}>Press and hold</Button><Button variant={ButtonVariant.SECONDARY}>Press and hold</Button><KitPlay initial={false}>{(value, set) => <Checkbox checked={value} onChange={set} label="Tick me" />}</KitPlay><KitPlay initial={false}>{(value, set) => <Switch checked={value} onChange={set} label="Flip me" />}</KitPlay></>, code: '/* Built into Button, Checkbox and Switch. */' },
        { title: 'Something new of your own', text: 'A panel that is not one of the kit’s overlays takes the class `fc-enter` to arrive like them; `fc-enter--fade` only fades, `fc-enter--menu` is the short, quick one. To leave as well, keep it drawn for the exit with `OverlayPresence` and put `data-state` on it.', demo: <span className="fc-field-note">See the code.</span>, code: '<div className="fc-enter">…</div>\n<div className="fc-enter fc-enter--fade">…</div>\n<div className="fc-enter fc-enter--menu">…</div>' },
      ],
      options: [
        { name: '--fc-dur-overlay', type: '200ms', does: 'Something that was asked for arrives: a dialog, a sheet, a toast.' },
        { name: '--fc-dur-exit', type: '150ms', does: 'The same thing leaves.' },
        { name: '--fc-dur-ui', type: '150ms', does: 'What answers the pointer: a hover, a press, a menu, a tooltip.' },
        { name: '--fc-ease', type: 'cubic-bezier(0.4, 0, 0.2, 1)', does: 'The one curve.' },
        { name: '--fc-rise', type: '8px', does: 'How far an overlay travels on its way in.' },
        { name: 'prefers-reduced-motion', type: 'the reader’s setting', does: 'Turns every one of these off and leaves the finished state.' },
      ],
    };
  }
}
