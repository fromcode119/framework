import { KitCopy } from '@/app/kit/kit-copy';
import { FrameworkIcons } from '@fromcode119/react';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { PromptDialog } from '@/components/ui/view/prompt-dialog.client';
import { Dialog } from '@/components/ui/view/dialog.client';
import { EditSheet } from '@/components/ui/view/edit-sheet.client';
import { FocusModal } from '@/components/ui/view/focus-modal.client';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import { DropdownItemVariant } from '@/components/ui/enums/dropdown-item-variant.enum';
import { CommandBar } from '@/components/ui/view/command-bar.client';
import { CommandBarCommand } from '@/components/ui/view/command-bar-command.client';
import { Input } from '@/components/ui/view/input.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Lightbox } from '@/components/ui/view/lightbox.client';
import { KitPlay } from '@/app/kit/view/kit-play.client';
import type { KitDoc } from '@/app/kit/kit-doc';

export class OverlaysKit {
  /** A button that opens what `render` gives, and the way to close it. */
  private static opens(label: string, render: (open: boolean, close: () => void) => any): any {
    return (
      <KitPlay initial={false}>
        {(open, set) => (
          <>
            <Button variant={ButtonVariant.SECONDARY} onClick={() => set(true)}>{label}</Button>
            {render(Boolean(open), () => set(false))}
          </>
        )}
      </KitPlay>
    );
  }

  /** Three plain pictures drawn here, so the viewer has something to show without a file. */
  private static readonly PICTURES = ['#6366f1', '#14b8a6', '#f59e0b'].map((fill, n) =>
    `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="${fill}"/><text x="600" y="430" font-family="sans-serif" font-size="96" fill="white" text-anchor="middle">${n + 1}</text></svg>`)}`);

  static docs(): KitDoc[] {
    const items = [
      { label: KitCopy.t('docs.overlays.edit'), icon: <FrameworkIcons.Edit size={15} />, onClick: () => undefined },
      { label: KitCopy.t('docs.overlays.duplicate'), icon: <FrameworkIcons.Copy size={15} />, onClick: () => undefined },
      { label: KitCopy.t('docs.overlays.delete'), icon: <FrameworkIcons.Trash size={15} />, variant: DropdownItemVariant.DANGER, onClick: () => undefined },
    ];
    return [
      {
        slug: 'dialogs', name: 'Dialogs', group: KitCopy.t('docs.overlays.overlays'),
        intro: KitCopy.t('docs.overlays.whatOpensOverThePage'),
        from: "import { ConfirmDialog, PromptDialog, Dialog, EditSheet, FocusModal } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.overlays.confirmdialog'), text: KitCopy.t('docs.overlays.aYesOrNoBefore'), demo: <>{OverlaysKit.opens('Confirm', (open, close) => <ConfirmDialog isOpen={open} onClose={close} onConfirm={close} title={KitCopy.t('docs.overlays.publishTheProduct')} description={KitCopy.t('docs.overlays.itBecomesVisibleInThe')} confirmLabel="Publish" />)}{OverlaysKit.opens('Confirm a removal', (open, close) => <ConfirmDialog isOpen={open} onClose={close} onConfirm={close} title={KitCopy.t('docs.overlays.deleteTheProduct')} description={KitCopy.t('docs.overlays.thisRemovesTheProductAnd')} confirmLabel="Delete" variant={ButtonVariant.DANGER} />)}</>, code: '<ConfirmDialog\n  isOpen={open} onClose={close} onConfirm={remove}\n  title="Delete the product?"\n  description="This removes the product and its variants. It cannot be undone."\n  confirmLabel="Delete" variant={ButtonVariant.DANGER}\n/>' },
          { title: KitCopy.t('docs.overlays.promptdialog'), text: KitCopy.t('docs.overlays.oneValueAskedFor'), demo: OverlaysKit.opens('Prompt', (open, close) => <PromptDialog isOpen={open} onClose={close} onConfirm={close} title={KitCopy.t('docs.overlays.rename')} description={KitCopy.t('docs.overlays.theNameShownInThe')} defaultValue="Cotton T-shirt" />), code: '<PromptDialog isOpen={open} onClose={close} onConfirm={rename}\n  title="Rename" description="The name shown in the list." defaultValue={name} />' },
          { title: KitCopy.t('docs.overlays.dialog'), text: KitCopy.t('docs.overlays.theDialogItselfForA'), demo: <>{OverlaysKit.opens('Dialog', (open, close) => <Dialog isOpen={open} onClose={close} title={KitCopy.t('docs.overlays.restoreTheArchive')} description={KitCopy.t('docs.overlays.theSiteReturnsToHow')} foot={<><Button variant={ButtonVariant.SECONDARY} onClick={close}>{KitCopy.t('docs.overlays.cancel')}</Button><Button variant={ButtonVariant.PRIMARY} onClick={close}>{KitCopy.t('docs.overlays.restore')}</Button></>}><p className="fc-field-note">{KitCopy.t('docs.overlays.whateverTheQuestionNeedsUnder')}</p></Dialog>)}{OverlaysKit.opens('Wide dialog', (open, close) => <Dialog wide isOpen={open} onClose={close} title={KitCopy.t('docs.overlays.approveFinanceCore')} description={KitCopy.t('docs.overlays.whatItWillBeAllowed')} foot={<Button variant={ButtonVariant.PRIMARY} onClick={close}>{KitCopy.t('docs.overlays.approveAndTurnOn')}</Button>}><p className="fc-field-note">{KitCopy.t('docs.overlays.aListToRead')}</p></Dialog>)}</>, code: '<Dialog isOpen={open} onClose={close} title="Restore the archive?"\n  description="The site returns to how it was on 12 November."\n  foot={<>…buttons…</>}>\n  …\n</Dialog>' },
          { title: KitCopy.t('docs.overlays.editsheet'), text: KitCopy.t('docs.overlays.aPartOfARecord'), demo: OverlaysKit.opens('Sheet', (open, close) => <EditSheet isOpen={open} onClose={close} onSave={close} title={KitCopy.t('docs.overlays.editProduct')} subtitle="Cotton T-shirt"><div className="fc-field-stack"><Input label={KitCopy.t('docs.overlays.title')} value="Cotton T-shirt" onChange={() => undefined} /></div></EditSheet>), code: '<EditSheet isOpen={open} onClose={close} onSave={save} saving={saving} error={error}\n  title="Edit product" subtitle="Cotton T-shirt">\n  …fields…\n</EditSheet>' },
          { title: KitCopy.t('docs.overlays.focusmodal'), text: KitCopy.t('docs.overlays.theWholeScreenForMaking'), demo: OverlaysKit.opens('Focus modal', (open, close) => <FocusModal isOpen={open} label={KitCopy.t('docs.overlays.createProduct')} onClose={close} onConfirm={close}><div className="fc-kitdoc__cell"><Input label={KitCopy.t('docs.overlays.title')} value="" placeholder={KitCopy.t('docs.overlays.winterJacket')} onChange={() => undefined} /></div></FocusModal>), code: '<FocusModal isOpen={open} label="Create product" onClose={close} onConfirm={create}\n  tabs={steps} activeTab={step} onTab={setStep}>\n  …\n</FocusModal>' },
          { title: KitCopy.t('docs.overlays.lightbox'), text: KitCopy.t('docs.overlays.aPictureOverTheWhole'), demo: (
            <KitPlay initial={false}>
              {(at, set) => (
                <>
                  <Button variant={ButtonVariant.SECONDARY} onClick={() => set(0)}>{KitCopy.t('docs.overlays.screenshots')}</Button>
                  <Lightbox isOpen={at !== false} images={OverlaysKit.PICTURES} currentIndex={at === false ? 0 : at} onNavigate={set} onClose={() => set(false)} title={KitCopy.t('docs.overlays.screenshots')} />
                </>
              )}
            </KitPlay>
          ), code: '<Lightbox isOpen={open} images={urls} currentIndex={index}\n  onNavigate={setIndex} onClose={close} title={name} />' },
        ],
        options: [
          { name: 'isOpen, onClose', type: 'boolean, () => void', does: KitCopy.t('docs.overlays.everyOverlayWhetherItShows') },
          { name: 'title, description', type: 'string', does: KitCopy.t('docs.overlays.theQuestionAndOneSentence') },
          { name: 'onConfirm, confirmLabel, cancelLabel', type: 'function, string', does: KitCopy.t('docs.overlays.theAnswerAndTheWords') },
          { name: 'isLoading / saving / busy', type: 'boolean', does: KitCopy.t('docs.overlays.theAnswerIsBeingCarried') },
          { name: 'ConfirmDialog variant', type: 'ButtonVariant', initial: 'PRIMARY', does: KitCopy.t('docs.overlays.dangerForARemoval') },
          { name: 'Dialog wide, foot', type: 'boolean, ReactNode', does: KitCopy.t('docs.overlays.aWiderBoxTheButtons') },
          { name: 'EditSheet onSave, error, foot', type: 'function, string, ReactNode', does: KitCopy.t('docs.overlays.savingWhatWentWrongA') },
          { name: 'FocusModal tabs, activeTab, onTab, confirmDisabled', type: 'steps', does: KitCopy.t('docs.overlays.stepsAcrossItsHeadAnd') },
          { name: 'FocusModal footNote', type: 'ReactNode', does: KitCopy.t('docs.overlays.whatTheButtonsWillAct') },
          { name: 'FocusModal wide', type: 'boolean', initial: 'false', does: KitCopy.t('docs.overlays.aGridOfPicturesRather') },
          { name: 'Lightbox images, currentIndex, onNavigate, title', type: 'string[], number, (index) => void, string', does: KitCopy.t('docs.overlays.thePicturesWhichOneShows') },
        ],
      },
      {
        slug: 'dropdown', name: 'Dropdown', group: KitCopy.t('docs.overlays.overlays'),
        intro: KitCopy.t('docs.overlays.aMenuOfActionsThat'),
        from: "import { Dropdown, DropdownItemVariant, HorizontalAlign } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.overlays.fromAButton'), demo: <Dropdown align={HorizontalAlign.LEFT} items={items} trigger={<span className="fc-toolbar-btn"><FrameworkIcons.More size={15} />{KitCopy.t('docs.overlays.menu')}</span>} />, code: "<Dropdown\n  align={HorizontalAlign.LEFT}\n  trigger={<span className=\"fc-toolbar-btn\"><FrameworkIcons.More size={15} />Menu</span>}\n  items={[\n    { label: 'Edit', icon: <FrameworkIcons.Edit size={15} />, onClick: edit },\n    { label: 'Delete', icon: <FrameworkIcons.Trash size={15} />, variant: DropdownItemVariant.DANGER, onClick: remove },\n  ]}\n/>" },
          { title: KitCopy.t('docs.overlays.fromA'), text: KitCopy.t('docs.overlays.alignedToTheEndSo'), demo: <Dropdown align={HorizontalAlign.RIGHT} items={items} trigger={<span className="fc-record-card__menu" aria-label={KitCopy.t('docs.overlays.more')}><FrameworkIcons.More size={15} /></span>} />, code: '<Dropdown align={HorizontalAlign.RIGHT} items={items}\n  trigger={<span className="fc-record-card__menu"><FrameworkIcons.More size={15} /></span>} />' },
        ],
        options: [
          { name: 'trigger', type: 'ReactNode', does: KitCopy.t('docs.overlays.whatOpensIt') },
          { name: 'items', type: '{ label, icon?, onClick, variant? }[]', does: KitCopy.t('docs.overlays.theActionsDangerForA') },
          { name: 'align', type: 'HorizontalAlign', initial: 'LEFT', does: KitCopy.t('docs.overlays.whichEdgeOfTheTrigger') },
        ],
      },
      {
        slug: 'command-bar', name: 'CommandBar', group: KitCopy.t('docs.overlays.overlays'),
        intro: KitCopy.t('docs.overlays.theBarThatRisesAt'),
        from: "import { CommandBar, CommandBarCommand } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.overlays.whileSomethingIsSelected'), text: KitCopy.t('docs.overlays.pressTheButtonToShow'), demo: OverlaysKit.opens('Select 2 rows', (open, close) => <CommandBar open={open} value="2 selected"><CommandBarCommand label={KitCopy.t('docs.overlays.publish')} onClick={close} /><CommandBarCommand label={KitCopy.t('docs.overlays.export')} icon={<FrameworkIcons.Download size={15} />} onClick={close} /><CommandBarCommand label={KitCopy.t('docs.overlays.delete')} icon={<FrameworkIcons.Trash size={15} />} onClick={close} /><CommandBarCommand label={<FrameworkIcons.Close size={15} />} title={KitCopy.t('docs.overlays.clearSelection')} onClick={close} /></CommandBar>), code: '<CommandBar open={selected.length > 0} value={`${selected.length} selected`}>\n  <CommandBarCommand label="Publish" onClick={publish} />\n  <CommandBarCommand label="Delete" icon={<FrameworkIcons.Trash size={15} />} onClick={remove} />\n</CommandBar>' },
        ],
        options: [
          { name: 'open', type: 'boolean', does: KitCopy.t('docs.overlays.whetherTheBarIsUp') },
          { name: 'value', type: 'ReactNode', does: KitCopy.t('docs.overlays.whatItSpeaksOf2') },
          { name: 'CommandBarCommand label, icon, onClick', type: 'ReactNode, ReactNode, () => void', does: KitCopy.t('docs.overlays.oneCommand') },
          { name: 'CommandBarCommand disabled, title', type: 'boolean, string', does: KitCopy.t('docs.overlays.notAvailableTheWordsFor') },
        ],
      },
    ];
  }
}
