"use client";

import React from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { FrameworkIcons } from '../../lib/icons';
import { FieldRenderer } from '../../components/collection/field-renderer';

interface CollectionQuickEditCardProps {
  row: any;
  collection: any;
  resolvedSlug: string;
  quickEditFields: any[];
  quickEditData: Record<string, any>;
  setQuickEditData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  quickEditStatus: { type: 'success' | 'error'; message: string } | null;
  isLoadingRow: boolean;
  isSavingRow: boolean;
  onSave: () => void;
  onClose: () => void;
  theme: string;
  pluginSettings: Record<string, any>;
}

export const CollectionQuickEditCard: React.FC<CollectionQuickEditCardProps> = ({
  row,
  collection,
  resolvedSlug,
  quickEditFields,
  quickEditData,
  setQuickEditData,
  quickEditStatus,
  isLoadingRow,
  isSavingRow,
  onSave,
  onClose,
  theme,
  pluginSettings
}) => {
  const rowId = String(row.id);

  return (
    <Card className={`${theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h3 className={`text-base font-semibold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Quick Edit</h3>
          <p className="text-[11px] font-semibold tracking-wide text-slate-400">
            {collection?.name || resolvedSlug} · #{rowId}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
        >
          <FrameworkIcons.Close size={16} />
        </button>
      </div>

      <div className="p-5">
        {quickEditStatus && (
          <div
            className={`mb-4 rounded-xl px-4 py-3 text-sm font-semibold ${
              quickEditStatus.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            {quickEditStatus.message}
          </div>
        )}

        {isLoadingRow ? (
          <div className="py-12 text-center text-sm font-semibold text-slate-500">Loading record...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quickEditFields.map((field: any) => (
              <FieldRenderer
                key={field.name}
                field={field}
                value={quickEditData[field.name]}
                onChange={(nextValue) =>
                  setQuickEditData((prev) => ({
                    ...prev,
                    [field.name]: nextValue
                  }))
                }
                theme={theme as any}
                collectionSlug={resolvedSlug}
                pluginSettings={pluginSettings}
                isNew={false}
              />
            ))}
          </div>
        )}
      </div>

      <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Button
          onClick={onSave}
          isLoading={isSavingRow}
          icon={<FrameworkIcons.Save size={14} />}
          className="px-5"
        >
          Save
        </Button>
      </div>
    </Card>
  );
};
