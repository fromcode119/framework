import React from 'react';

export class SettingRow extends React.Component<any> {
  render(): React.ReactNode {
    const { icon: Icon, title, description, children, theme } = this.props;
    return (
      <div className={`py-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b last:border-0 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
        <div className="flex gap-4">
          <div className={`p-2.5 rounded-xl h-fit ${theme === 'dark' ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
            {Icon ? <Icon size={20} /> : <div className="w-5 h-5" />}
          </div>
          <div>
            <h3 className={`font-semibold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{title}</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm leading-relaxed">{description}</p>
          </div>
        </div>
        <div className="flex-shrink-0">
          {children}
        </div>
      </div>
    );
  }
}
