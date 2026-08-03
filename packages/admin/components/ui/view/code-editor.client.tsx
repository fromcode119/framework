import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import Editor from '@monaco-editor/react';
import { prop } from '@fromcode119/reactor';
import { AdminComponent } from '@/components/view/admin-component.client';

export class CodeEditor extends AdminComponent {
  @prop declare value?: string;
  @prop declare onChange: (value: string) => void;
  @prop declare language?: string;
  @prop declare height?: string;
  @prop declare disabled?: boolean;
  @prop declare className?: string;

  render(): ReactNode {
    const value = this.value ?? "";
    const onChange = this.onChange;
    const language = this.language ?? "javascript";
    const height = this.height ?? "300px";
    const disabled = this.disabled ?? false;
    const className = this.className ?? "";
    const theme = this.theme;

    return (
    <div className={`rounded-lg border overflow-hidden transition-all ${
      theme === ThemeMode.DARK ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white shadow-sm'
    } ${className}`}>
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={(val) => onChange(val || "")}
        theme={theme === ThemeMode.DARK ? 'vs-dark' : 'light'}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          lineNumbers: 'on',
          roundedSelection: false,
          scrollBeyondLastLine: false,
          readOnly: disabled,
          automaticLayout: true,
          padding: { top: 16, bottom: 16 },
          scrollbar: {
            vertical: 'visible',
            horizontal: 'visible',
            useShadows: false,
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10
          }
        }}
      />
    </div>
    );
  }
}
