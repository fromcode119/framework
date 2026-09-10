import type { ReactNode } from 'react';
import { prop, state, bound } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { NumberStepper } from '@/components/ui/number-stepper';
import { TagField } from '@/components/ui/tag-field/view/index.client';
import { MediaShareController } from '@/app/media/media-share-controller';
import { AdminConstants } from '@/lib/constants/admin.constants';

/**
 * Changing the terms of a share that has ALREADY gone out.
 *
 * Without this the feature was write-once: an operator who wanted to give someone another week had to
 * send a second link, leaving two live URLs where they believed there was one — and no way to shorten a
 * deadline they had set too generously. Because the token is a row rather than a signed blob, the same
 * URL keeps working while its terms change, so nothing needs re-sending.
 *
 * Blank fields mean "leave alone". They are not pre-filled with the current values, because a share's
 * grants can legitimately differ from each other (people added later, terms edited since) and showing
 * one of them as though it were the share's would be a value no control produced.
 */
export class MediaShareEditForm extends AdminComponent {
  @prop declare shareId: number;
  @prop declare onChanged: () => void;

  @state private expiryDays: number | string = '';
  @state private maxDownloads: number | string = '';
  @state private recipients: string[] = [];
  @state private busy = false;
  @state private notice = '';

  private get hasTermsChange(): boolean {
    return String(this.expiryDays).trim() !== '' || String(this.maxDownloads).trim() !== '';
  }

  @bound private async handleApply(): Promise<void> {
    this.patch({ busy: true, notice: '' });
    try {
      const patch: { expiryDays?: number; maxDownloads?: number } = {};
      if (String(this.expiryDays).trim() !== '') patch.expiryDays = Number(this.expiryDays);
      if (String(this.maxDownloads).trim() !== '') patch.maxDownloads = Number(this.maxDownloads);

      const messages: string[] = [];
      if (Object.keys(patch).length) {
        const changed = await MediaShareController.updateShare(this.shareId, patch);
        messages.push(`${changed} link(s) updated`);
      }

      const emails = MediaShareController.normalizeRecipients(this.recipients);
      if (emails.length) {
        const failed = await MediaShareController.addRecipients(this.shareId, emails, patch);
        messages.push(failed.length ? `${emails.length - failed.length} sent, failed: ${failed.join(', ')}` : `${emails.length} invited`);
      }

      this.patch({ expiryDays: '', maxDownloads: '', recipients: [], notice: messages.join(' · ') });
      this.onChanged();
    } catch (error: any) {
      this.notice = String(error?.message || 'That did not work.');
    } finally {
      this.busy = false;
    }
  }

  render(): ReactNode {
    const canApply = this.hasTermsChange || MediaShareController.normalizeRecipients(this.recipients).length > 0;

    return (
      <div className="px-4 py-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium opacity-70">Extend by (days)</label>
            <NumberStepper value={this.expiryDays} min={0} onChange={(value) => this.patch({ expiryDays: value })} />
            <p className="mt-1 text-[10px] opacity-50">Counted from today. 0 = stops expiring. Blank leaves it as it is.</p>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium opacity-70">Max downloads</label>
            <NumberStepper value={this.maxDownloads} min={0} onChange={(value) => this.patch({ maxDownloads: value })} />
            <p className="mt-1 text-[10px] opacity-50">0 = unlimited. Blank leaves it as it is.</p>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium opacity-70">Add people</label>
          {/* Same picker as the create dialog: suggests from `people` and still accepts a typed
              address, because sharing with someone who has no account is half the feature. */}
          <TagField
            value={this.recipients}
            onChange={(value: string[] | string) => this.patch({ recipients: Array.isArray(value) ? value : [String(value || '')] })}
            placeholder="Type an email, or pick someone"
            suggestionsLabel="People"
            theme={this.theme}
            allowCreate
            apiOverrides={{ suggest: AdminConstants.ENDPOINTS.SYSTEM.PEOPLE_SUGGEST }}
          />
          <p className="mt-1 text-[10px] opacity-50">Each new person gets their own link, by email — existing links are untouched.</p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] opacity-60">{this.notice}</span>
          <Button variant={ButtonVariant.SECONDARY} disabled={!canApply || this.busy} onClick={this.handleApply}>
            {this.busy ? 'Applying…' : 'Apply changes'}
          </Button>
        </div>
      </div>
    );
  }
}
