"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { FrameworkIcons } from '@fromcode119/react';
import { StringUtils } from '@fromcode119/core/client';
import { PublisherPortalConstants } from './publisher-portal-constants';
import { PublisherFieldShell } from './publisher-field';
import { PublisherFieldStyles } from './publisher-field-styles';
import type { PublisherFormProps } from './publisher-portal.interfaces';

export class PublisherForm extends React.Component<PublisherFormProps> {
  render(): React.ReactNode {
    const { theme, submissionType, formData, loading, onChange, onSubmit } = this.props;
    const inputClass = PublisherFieldStyles.inputClass(theme);

    return (
      <Card className={`p-10 border-0 shadow-2xl ${theme === 'dark' ? 'bg-slate-900/60 ring-1 ring-white/5' : 'bg-white shadow-slate-200'}`}>
        <form onSubmit={onSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <PublisherFieldShell theme={theme} label="Plugin Name">
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => onChange({ ...formData, name: e.target.value })}
                className={inputClass}
                placeholder="My Awesome Plugin"
              />
            </PublisherFieldShell>
            <PublisherFieldShell theme={theme} label="Identifier (Slug)">
              <input
                type="text"
                required
                value={formData.slug}
                onChange={e => onChange({ ...formData, slug: StringUtils.slugify(e.target.value) })}
                className={inputClass}
                placeholder="my-awesome-plugin"
              />
            </PublisherFieldShell>
          </div>

          <PublisherFieldShell theme={theme} label="Description">
            <textarea
              required
              value={formData.description}
              onChange={e => onChange({ ...formData, description: e.target.value })}
              className={`w-full p-5 rounded-2xl border-0 ring-1 font-semibold text-sm transition-all focus:ring-2 focus:ring-indigo-500 min-h-[120px] ${theme === 'dark' ? 'bg-slate-800 ring-white/10 text-white' : 'bg-slate-50 ring-slate-200 text-slate-900'}`}
              placeholder="What does your plugin do?"
            />
          </PublisherFieldShell>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <PublisherFieldShell theme={theme} label="Version">
              <input
                type="text"
                value={formData.version}
                onChange={e => onChange({ ...formData, version: e.target.value })}
                className={inputClass}
              />
            </PublisherFieldShell>
            <PublisherFieldShell theme={theme} label="Category">
              <select
                value={formData.category}
                onChange={e => onChange({ ...formData, category: e.target.value })}
                className={inputClass}
              >
                {PublisherPortalConstants.PUBLISHER_CATEGORY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </PublisherFieldShell>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {submissionType === 'plugin' ? (
              <PublisherFieldShell theme={theme} label="Capabilities (Comma Separated)">
                <input
                  type="text"
                  value={formData.capabilities}
                  onChange={e => onChange({ ...formData, capabilities: e.target.value })}
                  className={inputClass}
                  placeholder="api, database, hooks, content"
                />
              </PublisherFieldShell>
            ) : (
              <PublisherFieldShell theme={theme} label="Author Name">
                <input
                  type="text"
                  value={formData.author}
                  onChange={e => onChange({ ...formData, author: e.target.value })}
                  className={inputClass}
                  placeholder="Your Name or Team"
                />
              </PublisherFieldShell>
            )}
            <PublisherFieldShell theme={theme} label="Icon / Preview URL (Optional)">
              <input
                type="text"
                value={formData.iconUrl}
                onChange={e => onChange({ ...formData, iconUrl: e.target.value })}
                className={inputClass}
                placeholder="https://lucide.dev/icons/puzzle.svg"
              />
            </PublisherFieldShell>
          </div>

          <PublisherFieldShell theme={theme} label="Download URL (ZIP Archive)">
            <input
              type="url"
              required
              value={formData.downloadUrl}
              onChange={e => onChange({ ...formData, downloadUrl: e.target.value })}
              className={inputClass}
              placeholder="https://github.com/user/repo/releases/download/v1/plugin.zip"
            />
          </PublisherFieldShell>

          <button
            type="submit"
            disabled={loading}
            className={`w-full h-16 rounded-[1.5rem] bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase tracking-wide shadow-2xl shadow-indigo-600/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50`}
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <FrameworkIcons.Plus size={20} />
                <span>Submit Plugin to Review</span>
              </>
            )}
          </button>
        </form>
      </Card>
    );
  }
}
