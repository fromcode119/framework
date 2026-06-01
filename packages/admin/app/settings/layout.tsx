import React from 'react';

export default class SettingsLayout extends React.Component<{ children: React.ReactNode }> {
  render(): React.ReactNode {
    const { children } = this.props;
  return (
    <div className="flex-1 flex flex-col h-full">
      <main className="flex-1 overflow-y-auto min-w-0">
        {children}
      </main>
    </div>
  );
  }
}
