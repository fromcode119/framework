import React from 'react';

export class SettingRow extends React.Component<any> {
  render(): React.ReactNode {
    const { icon: Icon, title, description, children, theme } = this.props;
    return (
      <div className={`py-4 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b last:border-0 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
        <div className="flex gap-3">
          <div className={`p-2 rounded-lg h-fit ${theme === 'dark' ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
            {Icon ? <Icon size={18} /> : <div className="w-[18px] h-[18px]" />}
          </div>
          <div>
            <h3 className={`text-sm font-semibold tracking-tight ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{title}</h3>
            <p className={`text-[13px] mt-0.5 max-w-md leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{description}</p>
          </div>
        </div>
        <div className="flex-shrink-0">
          {children}
        </div>
      </div>
    );
  }
}
