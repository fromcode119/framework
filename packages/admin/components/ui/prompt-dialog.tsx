"use client";

import React from 'react';
import { AdminComponent } from '@/components/admin-component';
import { Button } from './button';
import { Input } from './input';
import { FrameworkIcons } from '@fromcode119/react';
import { RootFramework } from '@fromcode119/react';

const { Close: X } = FrameworkIcons;

interface PromptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  icon?: React.ReactNode;
  inputType?: 'text' | 'password';
}

interface PromptDialogState {
  value: string;
}

export class PromptDialog extends AdminComponent<PromptDialogProps, PromptDialogState> {
  private readonly inputRef = React.createRef<HTMLInputElement>();

  state: PromptDialogState = { value: this.props.defaultValue ?? '' };

  private syncOpenState(): void {
    if (typeof document === 'undefined') return;
    if (this.props.isOpen) {
      document.body.style.overflow = 'hidden';
      this.setState({ value: this.props.defaultValue ?? '' });
      setTimeout(() => this.inputRef.current?.focus(), 100);
    } else {
      document.body.style.overflow = 'unset';
    }
  }

  componentDidMount(): void {
    this.syncOpenState();
  }

  componentDidUpdate(prevProps: PromptDialogProps): void {
    if (prevProps.isOpen !== this.props.isOpen || prevProps.defaultValue !== this.props.defaultValue) {
      this.syncOpenState();
    }
  }

  componentWillUnmount(): void {
    if (typeof document !== 'undefined') document.body.style.overflow = 'unset';
  }

  private handleSubmit = (e?: React.FormEvent): void => {
    e?.preventDefault();
    const trimmed = this.state.value.trim();
    if (trimmed) {
      this.props.onConfirm(trimmed);
    }
  };

  render(): React.ReactNode {
    const {
      isOpen,
      onClose,
      title,
      description,
      placeholder = 'Enter value...',
      confirmLabel = 'Confirm',
      cancelLabel = 'Cancel',
      isLoading = false,
      icon,
      inputType = 'text',
    } = this.props;
    const theme = this.theme;
    const { value } = this.state;

    if (!isOpen) return null;

    return (
    <RootFramework>
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300" 
          onClick={onClose}
        />
        
        {/* Dialog */}
        <div className={`relative w-full max-w-md my-auto rounded-3xl border shadow-2xl p-8 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 ${
          theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-black/50' : 'bg-white border-slate-100 shadow-slate-200/50'
        }`}>
        <div className="flex items-start gap-4 mb-6">
          {icon && (
            <div className={`p-3 rounded-xl flex-shrink-0 ${
              theme === 'dark' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-indigo-50 text-indigo-600'
            }`}>
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className={`text-lg font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {title}
            </h3>
            {description && (
              <p className={`mt-1 text-sm leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                {description}
              </p>
            )}
          </div>
          <button 
            onClick={onClose}
            className={`p-1 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-500 hover:text-white' : 'hover:bg-slate-50 text-slate-400 hover:text-slate-900'}`}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={this.handleSubmit} className="space-y-6">
          <Input
            ref={this.inputRef}
            type={inputType}
            placeholder={placeholder}
            value={value}
            onChange={(e) => this.setState({ value: e.target.value })}
            disabled={isLoading}
            className="w-full"
            autoFocus
          />

          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              variant="ghost" 
              className="flex-1" 
              onClick={onClose}
              type="button"
              disabled={isLoading}
            >
              {cancelLabel}
            </Button>
            <Button 
              variant="primary" 
              className="flex-1" 
              type="submit"
              isLoading={isLoading}
              disabled={!value.trim()}
            >
              {confirmLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
    </RootFramework>
    );
  }
}
