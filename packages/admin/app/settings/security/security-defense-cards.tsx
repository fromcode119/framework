import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FrameworkIcons } from '@fromcode119/react';
import type { SecurityDefenseCardsProps } from './security-defense-cards.interfaces';

export class SecurityDefenseCards extends React.Component<SecurityDefenseCardsProps> {
  render(): React.ReactNode {
    const { stats } = this.props;
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card title="Defense Modules" className="h-full">
          <div className="space-y-6 pt-4">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-3">
                <FrameworkIcons.Fingerprint size={18} className="text-indigo-500" />
                <span className="text-xs font-semibold tracking-wide">Integrity Checking</span>
              </div>
              <Badge variant="success">Active</Badge>
            </div>
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-3">
                <FrameworkIcons.Key size={18} className="text-indigo-500" />
                <span className="text-xs font-semibold tracking-wide">Signature Enforcement</span>
              </div>
              <Badge variant={stats.signatureEnforced ? 'success' : 'gray'}>
                {stats.signatureEnforced ? 'Enforced' : 'Optional'}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-3">
                <FrameworkIcons.Eye size={18} className="text-indigo-500" />
                <span className="text-xs font-semibold tracking-wide">Anomaly Detection</span>
              </div>
              <Badge variant="success">Active</Badge>
            </div>
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-3">
                <FrameworkIcons.Shield size={18} className="text-green-500" />
                <span className="text-xs font-semibold tracking-wide">Hardening Level</span>
              </div>
              <Badge variant="success">Production</Badge>
            </div>
          </div>
        </Card>

        <Card title="Suspicious Activity" className="h-full">
          <div className="space-y-4 pt-4">
            {stats.monitor?.suspiciousPlugins?.length > 0 ? (
              stats.monitor.suspiciousPlugins.map((p: any) => (
                <div key={p.slug} className="flex items-center justify-between p-4 rounded-2xl bg-red-500/5 border border-red-500/10">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-semibold tracking-wide">{p.slug}</span>
                    <span className="text-[10px] text-slate-500 font-medium tracking-wide mt-1">{p.count} denials recorded</span>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                </div>
              ))
            ) : (
              <div className="p-10 flex flex-col items-center justify-center opacity-40">
                <FrameworkIcons.Check size={32} className="text-green-500 mb-3" />
                <p className="text-[10px] font-semibold tracking-wide">No suspicious patterns detected</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }
}
