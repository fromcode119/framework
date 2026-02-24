import React from 'react';
import { Card } from '../../components/ui/card';

interface RecordInfoProps {
  id: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export const RecordInfo: React.FC<RecordInfoProps> = ({ id, createdAt, updatedAt }) => {
  return (
    <Card title="Record Info">
      <div className="space-y-4">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400 font-semibold tracking-wide">Identifier</span>
          <span className="text-slate-500 font-medium tracking-tighter bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">{id}</span>
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
};
