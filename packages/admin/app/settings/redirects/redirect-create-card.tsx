import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop, state, bound } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { Input } from '@/components/ui/view/input.client';
import { Select } from '@/components/ui/view/select.client';

/** The "add a rule" form of Settings → Redirects. Owns only its draft; submission is the page's. */
export class RedirectCreateCard extends PureReactor {
  private static readonly TYPE_OPTIONS = [
    { label: '301 Permanent', value: '301' },
    { label: '302 Temporary', value: '302' },
  ];

  @prop declare theme: ThemeMode;
  @prop declare isSubmitting: boolean;
  @prop declare onCreate: (input: { fromPath: string; toPath: string; type: string; notes: string }) => Promise<boolean>;

  @state fromPath = '';
  @state toPath = '';
  @state type = '301';
  @state notes = '';

  private get canSubmit(): boolean {
    return Boolean(this.fromPath.trim() && this.toPath.trim()) && !this.isSubmitting;
  }

  @bound async handleSubmit(): Promise<void> {
    if (!this.canSubmit) return;
    const created = await this.onCreate({
      fromPath: this.fromPath.trim(),
      toPath: this.toPath.trim(),
      type: this.type,
      notes: this.notes.trim(),
    });
    if (created) {
      this.fromPath = '';
      this.toPath = '';
      this.type = '301';
      this.notes = '';
    }
  }

  @bound handleTypeChange(value: string): void {
    this.type = value;
  }

  render(): ReactNode {
    return (
      <Card title="Add Redirect" icon={<FrameworkIcons.Plus size={16} />}>
        <div className="flex flex-col md:flex-row gap-3 md:items-end pt-1">
          <div className="flex-1">
            <Input
              label="From path"
              placeholder="/old-page"
              value={this.fromPath}
              onChange={(event: any) => { this.fromPath = String(event?.target?.value ?? ''); }}
            />
          </div>
          <div className="flex-1">
            <Input
              label="To path or URL"
              placeholder="/new-page or https://…"
              value={this.toPath}
              onChange={(event: any) => { this.toPath = String(event?.target?.value ?? ''); }}
            />
          </div>
          <div className="w-full md:w-44">
            <Select
              theme={this.theme}
              value={this.type}
              onChange={this.handleTypeChange}
              options={RedirectCreateCard.TYPE_OPTIONS}
            />
          </div>
          <Button
            icon={<FrameworkIcons.Plus size={15} strokeWidth={2} />}
            onClick={this.handleSubmit}
            isLoading={this.isSubmitting}
            disabled={!this.canSubmit}
            className="h-9 px-4 rounded-lg font-semibold text-xs text-white"
          >
            Add
          </Button>
        </div>
        <div className="mt-3">
          <Input
            label="Notes (optional)"
            placeholder="Why this redirect exists"
            value={this.notes}
            onChange={(event: any) => { this.notes = String(event?.target?.value ?? ''); }}
          />
        </div>
      </Card>
    );
  }
}
