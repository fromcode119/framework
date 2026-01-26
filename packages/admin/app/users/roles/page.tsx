'use client';

import React from 'react';

export default function RolesPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Role Management</h1>
      <p className="text-gray-600 dark:text-gray-400">
        This page will allow you to define and manage global roles and their associated permissions.
        Currently, roles are stored as tags on individual user profiles.
      </p>
      
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">System Roles</h2>
        <ul className="space-y-4">
          <li className="flex items-center justify-between p-3 border rounded">
            <div>
              <span className="font-mono bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm mr-2">admin</span>
              <span className="text-sm text-gray-500">Full system access</span>
            </div>
            <span className="text-xs text-gray-400">System Protected</span>
          </li>
          <li className="flex items-center justify-between p-3 border rounded">
            <div>
              <span className="font-mono bg-green-100 text-green-800 px-2 py-1 rounded text-sm mr-2">editor</span>
              <span className="text-sm text-gray-500">Can manage content</span>
            </div>
            <button className="text-blue-500 text-sm">Edit</button>
          </li>
          <li className="flex items-center justify-between p-3 border rounded">
            <div>
              <span className="font-mono bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm mr-2">user</span>
              <span className="text-sm text-gray-500">Regular account</span>
            </div>
            <button className="text-blue-500 text-sm">Edit</button>
          </li>
        </ul>
      </div>
    </div>
  );
}
