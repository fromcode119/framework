import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AppearanceInstallUrlCardProps } from './appearance-install-url-card.interfaces';

/** Manual install/update from a package URL — works whether or not the marketplace is configured. */
export class AppearanceInstallUrlCard extends React.Component<AppearanceInstallUrlCardProps> {
  render(): React.ReactNode {
    const { url, busy, onChange, onInstall } = this.props;
    return (
      <Card title="Install from a package URL">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Input value={url} onChange={(e: any) => onChange(e?.target?.value ?? e)} placeholder="https://…/my-appearance.zip" className="flex-1 font-bold" />
          <Button icon={<FrameworkIcons.Download size={14} />} onClick={onInstall} disabled={busy || !url.trim()}>Install</Button>
        </div>
        <p className="text-[13px] text-slate-500 mt-2 leading-relaxed">
          A .zip containing <code>appearance.json</code> + <code>dist/</code>. Installing the same slug again <b>updates it in place</b> — appearances load at runtime, so no container rebuild is needed.
        </p>
      </Card>
    );
  }
}
