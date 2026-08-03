import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';

export class RecordInfo extends PureReactor {
  @prop declare id: string;
  @prop declare createdAt?: string | Date;
  @prop declare updatedAt?: string | Date;

  render(): ReactNode {
    const { id, createdAt, updatedAt } = this;
  return (
    <Card title="Record Info">
      <div className="space-y-4">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400 font-semibold tracking-wide">Identifier</span>
          <span className="text-slate-500 font-medium tracking-tighter bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">{id}</span>
        </div>
        {createdAt && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-semibold tracking-wide">Created</span>
            <span className="text-slate-500 font-medium">{new Date(createdAt).toLocaleString()}</span>
          </div>
        )}
        {updatedAt && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-semibold tracking-wide">Last Update</span>
            <span className="text-slate-500 font-medium">{new Date(updatedAt).toLocaleString()}</span>
          </div>
        )}
      </div>
    </Card>
  );
  }
}
