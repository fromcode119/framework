import React from 'react';
import { Card } from '@/components/ui/card';
import { FrameworkIcons } from '@fromcode119/react';

export class IntegrationEmptyState extends React.Component {
  render(): React.ReactNode {
    return (
      <div className="p-8 lg:p-12">
        <Card className="p-10 text-center">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-indigo-50 text-indigo-600 mb-4">
            <FrameworkIcons.Orbit size={22} />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">No integration types registered</h2>
          <p className="mt-2 text-sm text-slate-500">
            Register at least one integration type in the API runtime to configure providers.
          </p>
        </Card>
      </div>
    );
  }
}
