"use client";

import React from 'react';
import Editor from '@monaco-editor/react';
import { useTheme } from '../theme-context';

interface CodeEditorProps {
  value?: string;
  onChange: (value: string) => void;
  language?: string;
  height?: string;
  disabled?: boolean;
  className?: string;
}

export const CodeEditor = ({ 
  value = "", 
  onChange, 
  language = "javascript", 
  height = "300px",
  disabled = false,
  className = "" 
}: CodeEditorProps) => {
  const { theme } = useTheme();

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${
      theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white shadow-sm'
    } ${className}`}>
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={(val) => onChange(val || "")}
        theme={theme === 'dark' ? 'vs-dark' : 'light'}
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
};
