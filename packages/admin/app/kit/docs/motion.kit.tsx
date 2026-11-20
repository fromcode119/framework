import { KitCopy } from '@/app/kit/kit-copy';
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
        <Button variant={ButtonVariant.SECONDARY} onClick={this.open}>{KitCopy.t('docs.motion.editAndSave')}</Button>
        <EditSheet isOpen={this.shown} onClose={this.close} onSave={this.save} saving={this.saving} title={KitCopy.t('docs.motion.editProduct')} subtitle="Cotton T-shirt">
          <div className="fc-field-stack"><Input label={KitCopy.t('docs.motion.title')} value="Cotton T-shirt" onChange={() => undefined} /></div>
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
      slug: 'motion', name: 'Motion', group: KitCopy.t('docs.motion.foundations'),
      intro: KitCopy.t('docs.motion.howTheConsoleMovesThree'),
      from: '--fc-dur-overlay: 200ms;  --fc-dur-exit: 150ms;  --fc-dur-ui: 150ms;  --fc-ease: cubic-bezier(0.4, 0, 0.2, 1);',
      examples: [
        { title: KitCopy.t('docs.motion.openingAndClosing'), text: KitCopy.t('docs.motion.theGroundFadesADialog'), demo: <>{MotionKit.opens('Dialog', (open, close) => <ConfirmDialog isOpen={open} onClose={close} onConfirm={close} title={KitCopy.t('docs.motion.publishTheProduct')} description={KitCopy.t('docs.motion.itBecomesVisibleInThe')} confirmLabel="Publish" />)}{MotionKit.opens('Sheet', (open, close) => <EditSheet isOpen={open} onClose={close} onSave={close} title={KitCopy.t('docs.motion.editProduct')}><div className="fc-field-stack"><Input label={KitCopy.t('docs.motion.title')} value="Cotton T-shirt" onChange={() => undefined} /></div></EditSheet>)}{MotionKit.opens('Focus modal', (open, close) => <FocusModal isOpen={open} label={KitCopy.t('docs.motion.createProduct')} onClose={close} onConfirm={close}><div className="fc-kitdoc__cell"><Input label={KitCopy.t('docs.motion.title')} value="" onChange={() => undefined} /></div></FocusModal>)}</>, code: '/* Nothing to write: every overlay of the kit moves by itself. */' },
        { title: KitCopy.t('docs.motion.saving'), text: KitCopy.t('docs.motion.threeThingsInARow'), demo: <SavingDemo />, code: '<EditSheet isOpen={open} onSave={save} saving={saving} error={error} … />\n// after a save that worked:\nnotify(NotificationType.SUCCESS, \'Saved\', \'The product was saved.\');' },
        { title: KitCopy.t('docs.motion.menusPopoversTooltips'), text: KitCopy.t('docs.motion.theseOpenBesideTheControl'), demo: <><Dropdown align={HorizontalAlign.LEFT} items={[{ label: KitCopy.t('docs.motion.edit'), onClick: () => undefined }, { label: KitCopy.t('docs.motion.duplicate'), onClick: () => undefined }]} trigger={<span className="fc-toolbar-btn"><FrameworkIcons.More size={15} />{KitCopy.t('docs.motion.menu')}</span>} /><Popover trigger={<span className="fc-toolbar-btn">{KitCopy.t('docs.motion.popover')}</span>}><span className="fc-field-note">{KitCopy.t('docs.motion.aPanelOfItsOwn')}</span></Popover><Tooltip content={KitCopy.t('docs.motion.aFewWords')}><Button variant={ButtonVariant.SECONDARY}>{KitCopy.t('docs.motion.tooltip')}</Button></Tooltip></>, code: '/* Dropdown, Popover and Tooltip move by themselves. */' },
        { title: KitCopy.t('docs.motion.theBarOfCommands'), text: KitCopy.t('docs.motion.itComesUpFromThe'), demo: MotionKit.opens('Select 2 rows', (open, close) => <CommandBar open={open} value="2 selected"><CommandBarCommand label={KitCopy.t('docs.motion.publish')} onClick={close} /><CommandBarCommand label={<FrameworkIcons.Close size={15} />} title={KitCopy.t('docs.motion.clearSelection')} onClick={close} /></CommandBar>), code: '<CommandBar open={selected.length > 0} value={`${selected.length} selected`}>…</CommandBar>' },
        { title: KitCopy.t('docs.motion.whatAnswersThePointer'), text: KitCopy.t('docs.motion.aButtonDarkensWhileIt'), demo: <><Button variant={ButtonVariant.PRIMARY}>{KitCopy.t('docs.motion.pressAndHold')}</Button><Button variant={ButtonVariant.SECONDARY}>{KitCopy.t('docs.motion.pressAndHold')}</Button><KitPlay initial={false}>{(value, set) => <Checkbox checked={value} onChange={set} label={KitCopy.t('docs.motion.tickMe')} />}</KitPlay><KitPlay initial={false}>{(value, set) => <Switch checked={value} onChange={set} label={KitCopy.t('docs.motion.flipMe')} />}</KitPlay></>, code: '/* Built into Button, Checkbox and Switch. */' },
        { title: KitCopy.t('docs.motion.somethingNewOfYourOwn'), text: KitCopy.t('docs.motion.aPanelThatIsNot'), demo: <span className="fc-field-note">{KitCopy.t('docs.motion.seeTheCode')}</span>, code: '<div className="fc-enter">…</div>\n<div className="fc-enter fc-enter--fade">…</div>\n<div className="fc-enter fc-enter--menu">…</div>' },
      ],
      options: [
        { name: '--fc-dur-overlay', type: '200ms', does: KitCopy.t('docs.motion.somethingThatWasAskedFor') },
        { name: '--fc-dur-exit', type: '150ms', does: KitCopy.t('docs.motion.theSameThingLeaves') },
        { name: '--fc-dur-ui', type: '150ms', does: KitCopy.t('docs.motion.whatAnswersThePointerA') },
        { name: '--fc-ease', type: 'cubic-bezier(0.4, 0, 0.2, 1)', does: KitCopy.t('docs.motion.theOneCurve') },
        { name: '--fc-rise', type: '8px', does: KitCopy.t('docs.motion.howFarAnOverlayTravels') },
        { name: 'prefers-reduced-motion', type: 'the reader’s setting', does: KitCopy.t('docs.motion.turnsEveryOneOfThese') },
      ],
    };
  }
}
