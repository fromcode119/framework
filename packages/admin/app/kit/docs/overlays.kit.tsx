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

  static docs(): KitDoc[] {
    const items = [
      { label: 'Edit', icon: <FrameworkIcons.Edit size={15} />, onClick: () => undefined },
      { label: 'Duplicate', icon: <FrameworkIcons.Copy size={15} />, onClick: () => undefined },
      { label: 'Delete', icon: <FrameworkIcons.Trash size={15} />, variant: DropdownItemVariant.DANGER, onClick: () => undefined },
    ];
    return [
      {
        slug: 'dialogs', name: 'Dialogs', group: 'Overlays',
        intro: 'What opens over the page. A question is a 400px dialog in the middle. A form that edits part of a record is a sheet from the side. Making something new, with room to think, is the focus modal.',
        from: "import { ConfirmDialog, PromptDialog, Dialog, EditSheet, FocusModal } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'ConfirmDialog', text: 'A yes-or-no before something that matters. The confirming button says what it does; `variant` makes it the danger button for a removal.', demo: <>{OverlaysKit.opens('Confirm', (open, close) => <ConfirmDialog isOpen={open} onClose={close} onConfirm={close} title="Publish the product?" description="It becomes visible in the shop at once." confirmLabel="Publish" />)}{OverlaysKit.opens('Confirm a removal', (open, close) => <ConfirmDialog isOpen={open} onClose={close} onConfirm={close} title="Delete the product?" description="This removes the product and its variants. It cannot be undone." confirmLabel="Delete" variant={ButtonVariant.DANGER} />)}</>, code: '<ConfirmDialog\n  isOpen={open} onClose={close} onConfirm={remove}\n  title="Delete the product?"\n  description="This removes the product and its variants. It cannot be undone."\n  confirmLabel="Delete" variant={ButtonVariant.DANGER}\n/>' },
          { title: 'PromptDialog', text: 'One value asked for.', demo: OverlaysKit.opens('Prompt', (open, close) => <PromptDialog isOpen={open} onClose={close} onConfirm={close} title="Rename" description="The name shown in the list." defaultValue="Cotton T-shirt" />), code: '<PromptDialog isOpen={open} onClose={close} onConfirm={rename}\n  title="Rename" description="The name shown in the list." defaultValue={name} />' },
          { title: 'Dialog', text: 'The dialog itself, for a question with content of its own. `wide` is for a list to read before answering.', demo: <>{OverlaysKit.opens('Dialog', (open, close) => <Dialog isOpen={open} onClose={close} title="Restore the archive?" description="The site returns to how it was on 12 November." foot={<><Button variant={ButtonVariant.SECONDARY} onClick={close}>Cancel</Button><Button variant={ButtonVariant.PRIMARY} onClick={close}>Restore</Button></>}><p className="fc-field-note">Whatever the question needs under it.</p></Dialog>)}{OverlaysKit.opens('Wide dialog', (open, close) => <Dialog wide isOpen={open} onClose={close} title="Approve Finance Core" description="What it will be allowed to do." foot={<Button variant={ButtonVariant.PRIMARY} onClick={close}>Approve and turn on</Button>}><p className="fc-field-note">A list to read.</p></Dialog>)}</>, code: '<Dialog isOpen={open} onClose={close} title="Restore the archive?"\n  description="The site returns to how it was on 12 November."\n  foot={<>…buttons…</>}>\n  …\n</Dialog>' },
          { title: 'EditSheet', text: 'A part of a record edited beside the page it belongs to, 560px from the side, with Save and Cancel at its foot.', demo: OverlaysKit.opens('Sheet', (open, close) => <EditSheet isOpen={open} onClose={close} onSave={close} title="Edit product" subtitle="Cotton T-shirt"><div className="fc-field-stack"><Input label="Title" value="Cotton T-shirt" onChange={() => undefined} /></div></EditSheet>), code: '<EditSheet isOpen={open} onClose={close} onSave={save} saving={saving} error={error}\n  title="Edit product" subtitle="Cotton T-shirt">\n  …fields…\n</EditSheet>' },
          { title: 'FocusModal', text: 'The whole screen for making something new, in steps when it has them.', demo: OverlaysKit.opens('Focus modal', (open, close) => <FocusModal isOpen={open} label="Create product" onClose={close} onConfirm={close}><div className="fc-kitdoc__cell"><Input label="Title" value="" placeholder="Winter jacket" onChange={() => undefined} /></div></FocusModal>), code: '<FocusModal isOpen={open} label="Create product" onClose={close} onConfirm={create}\n  tabs={steps} activeTab={step} onTab={setStep}>\n  …\n</FocusModal>' },
        ],
        options: [
          { name: 'isOpen, onClose', type: 'boolean, () => void', does: 'Every overlay: whether it shows, and what closes it (Esc and the backdrop call it too).' },
          { name: 'title, description', type: 'string', does: 'The question and one sentence about it.' },
          { name: 'onConfirm, confirmLabel, cancelLabel', type: 'function, string', does: 'The answer and the words on the buttons.' },
          { name: 'isLoading / saving / busy', type: 'boolean', does: 'The answer is being carried out.' },
          { name: 'ConfirmDialog variant', type: 'ButtonVariant', initial: 'PRIMARY', does: 'DANGER for a removal.' },
          { name: 'Dialog wide, foot', type: 'boolean, ReactNode', does: 'A wider box; the buttons.' },
          { name: 'EditSheet onSave, error, foot', type: 'function, string, ReactNode', does: 'Saving, what went wrong, a foot of its own.' },
          { name: 'FocusModal tabs, activeTab, onTab, confirmDisabled', type: 'steps', does: 'Steps across its head and whether it may be confirmed yet.' },
        ],
      },
      {
        slug: 'dropdown', name: 'Dropdown', group: 'Overlays',
        intro: 'A menu of actions that opens from a control — most often a row’s or a card’s ⋯.',
        from: "import { Dropdown, DropdownItemVariant, HorizontalAlign } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'From a button', demo: <Dropdown align={HorizontalAlign.LEFT} items={items} trigger={<span className="fc-toolbar-btn"><FrameworkIcons.More size={15} />Menu</span>} />, code: "<Dropdown\n  align={HorizontalAlign.LEFT}\n  trigger={<span className=\"fc-toolbar-btn\"><FrameworkIcons.More size={15} />Menu</span>}\n  items={[\n    { label: 'Edit', icon: <FrameworkIcons.Edit size={15} />, onClick: edit },\n    { label: 'Delete', icon: <FrameworkIcons.Trash size={15} />, variant: DropdownItemVariant.DANGER, onClick: remove },\n  ]}\n/>" },
          { title: 'From a ⋯', text: 'Aligned to the end, so it opens inward from the edge of a row or a card.', demo: <Dropdown align={HorizontalAlign.RIGHT} items={items} trigger={<span className="fc-record-card__menu" aria-label="More"><FrameworkIcons.More size={15} /></span>} />, code: '<Dropdown align={HorizontalAlign.RIGHT} items={items}\n  trigger={<span className="fc-record-card__menu"><FrameworkIcons.More size={15} /></span>} />' },
        ],
        options: [
          { name: 'trigger', type: 'ReactNode', does: 'What opens it.' },
          { name: 'items', type: '{ label, icon?, onClick, variant? }[]', does: 'The actions; DANGER for a removal, which goes last.' },
          { name: 'align', type: 'HorizontalAlign', initial: 'LEFT', does: 'Which edge of the trigger the menu lines up with.' },
        ],
      },
      {
        slug: 'command-bar', name: 'CommandBar', group: 'Overlays',
        intro: 'The bar that rises at the foot of the screen while rows are selected, or while a form has unsaved changes: what is selected, then what can be done with it.',
        from: "import { CommandBar, CommandBarCommand } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'While something is selected', text: 'Press the button to show it; its last command clears it.', demo: OverlaysKit.opens('Select 2 rows', (open, close) => <CommandBar open={open} value="2 selected"><CommandBarCommand label="Publish" onClick={close} /><CommandBarCommand label="Export" icon={<FrameworkIcons.Download size={15} />} onClick={close} /><CommandBarCommand label="Delete" icon={<FrameworkIcons.Trash size={15} />} onClick={close} /><CommandBarCommand label={<FrameworkIcons.Close size={15} />} title="Clear selection" onClick={close} /></CommandBar>), code: '<CommandBar open={selected.length > 0} value={`${selected.length} selected`}>\n  <CommandBarCommand label="Publish" onClick={publish} />\n  <CommandBarCommand label="Delete" icon={<FrameworkIcons.Trash size={15} />} onClick={remove} />\n</CommandBar>' },
        ],
        options: [
          { name: 'open', type: 'boolean', does: 'Whether the bar is up.' },
          { name: 'value', type: 'ReactNode', does: 'What it speaks of: “2 selected”, “Unsaved changes”.' },
          { name: 'CommandBarCommand label, icon, onClick', type: 'ReactNode, ReactNode, () => void', does: 'One command.' },
          { name: 'CommandBarCommand disabled, title', type: 'boolean, string', does: 'Not available; the words for a command that is an icon alone.' },
        ],
      },
    ];
  }
}
