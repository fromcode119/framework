#!/usr/bin/env node
'use strict';

// Run the Next.js admin panel from its own package directory.
// Works whether installed globally, via npx, or as a workspace dependency.
const path = require('path');
const { spawn } = require('child_process');

const pkgDir = path.resolve(__dirname, '..');
const port = process.env.ADMIN_PORT || process.env.PORT || '3001';
const cmd = process.env.NODE_ENV === 'production' ? 'start' : 'dev';

// Resolve `next` relative to this package so it always finds the right binary
let nextBin;
try {
  nextBin = require.resolve('next/dist/bin/next', { paths: [pkgDir] });
} catch {
  console.error('[fromcode-admin] Could not resolve the "next" binary. Run: npm install inside @fromcode119/admin');
  process.exit(1);
}

const args = cmd === 'start' ? [nextBin, 'start', '-p', port] : [nextBin, 'dev', '--webpack', '-H', '0.0.0.0', '-p', port];

const child = spawn(process.execPath, args, {
  cwd: pkgDir,
  stdio: 'inherit',
  env: { ...process.env, PORT: port },
});

child.on('exit', code => process.exit(code ?? 0));
