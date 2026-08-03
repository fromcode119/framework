import type { ReactNode } from 'react';

import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { Input } from '@/components/ui/view/input.client';

/** Manual install/update from a package URL — works whether or not the marketplace is configured. */
export class AppearanceInstallUrlCard extends PureReactor {
  @prop declare url: string;
  @prop declare busy: boolean;
  @prop declare onChange: (url: string) => void;
  @prop declare onInstall: () => void;

  @bound
  private handleChange(e: any): void {
    this.onChange(e?.target?.value ?? e);
  }

  render(): ReactNode {
    return (
      <Card title="Install from a package URL">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Input value={this.url} onChange={this.handleChange} placeholder="https://…/my-appearance.zip" className="flex-1 font-bold" />
          <Button icon={<FrameworkIcons.Download size={14} />} onClick={this.onInstall} disabled={this.busy || !this.url.trim()}>Install</Button>
        </div>
        <p className="text-[13px] text-slate-500 mt-2 leading-relaxed">
          A .zip containing <code>appearance.json</code> + <code>dist/</code>. Installing the same slug again <b>updates it in place</b> — appearances load at runtime, so no container rebuild is needed.
        </p>
      </Card>
    );
  }
}
