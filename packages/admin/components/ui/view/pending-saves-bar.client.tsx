import type { ReactNode } from 'react';
import { Reactor, state, bound } from '@fromcode119/react-class-components';
import { SettingsSaveBar } from '@/components/ui/view/settings-save-bar.client';
import { PendingSaves } from '@/lib/settings/pending-saves';

/**
 * The one save bar of a settings page whose cards keep their own values: shown while any of them has
 * something unsaved, it writes those and only those.
 */
export class PendingSavesBar extends Reactor {
  @state private dirty = false;
  @state private saving = false;
  private stop: (() => void) | null = null;

  componentDidMount(): void {
    this.stop = PendingSaves.subscribe(this.read);
    this.read();
  }

  componentWillUnmount(): void {
    this.stop?.();
  }

  @bound private read(): void {
    const dirty = PendingSaves.anyDirty();
    if (dirty !== this.dirty) this.dirty = dirty;
  }

  @bound private async save(): Promise<void> {
    this.saving = true;
    try {
      await PendingSaves.saveAll();
    } finally {
      this.saving = false;
      this.read();
    }
  }

  render(): ReactNode {
    return <SettingsSaveBar dirty={this.dirty} saving={this.saving} onSave={this.save} onDiscard={PendingSaves.discardAll} />;
  }
}
