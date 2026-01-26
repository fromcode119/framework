'use client';

import React from 'react';

export default function PermissionsPage() {
  const permissions = [
    { name: 'users:read', description: 'View user list and details', group: 'Users' },
    { name: 'users:write', description: 'Create and edit users', group: 'Users' },
    { name: 'users:delete', description: 'Remove users from system', group: 'Users' },
    { name: 'plugins:manage', description: 'Install and toggle plugins', group: 'System' },
    { name: 'settings:write', description: 'Modify global settings', group: 'System' },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Permission Registry</h1>
      <p className="text-gray-600 dark:text-gray-400">
        Review all available system permissions that can be assigned to roles or users.
      </p>

      <div className="mt-8 overflow-hidden bg-white dark:bg-gray-800 rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Group</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {permissions.map((p) => (
              <tr key={p.name}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="font-mono text-sm bg-purple-50 text-purple-700 px-2 py-1 rounded">
                    {p.name}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                  {p.group}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {p.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
