#!/usr/bin/env node
/**
 * Local Cloudflare Workers + D1 dev runner on port 3000.
 * Builds the Vite frontend, applies idempotent local D1 migrations,
 * and launches `wrangler dev` serving static assets + Worker API routes.
 */

import { spawn, spawnSync } from 'node:child_process';

const PORT = String(process.env.PORT || 3000);
const HOST = '0.0.0.0';

function runStep(cmd, args) {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

// 1. Build Vite SPA bundle into dist/
runStep('npx', ['vite', 'build']);

// 2. Apply Cloudflare D1 migrations to local state (idempotent & non-destructive)
runStep('npx', ['wrangler', 'd1', 'migrations', 'apply', 'ecodrive-db', '--local', '--force']);

// 3. Forward optional runtime secrets from host environment to local Worker
const wranglerArgs = [
  'wrangler',
  'dev',
  '--local',
  '--port',
  PORT,
  '--ip',
  HOST,
];

const secretKeys = [
  'GEMINI_API_KEY',
  'GOOGLE_MAPS_API_KEY',
  'VITE_GOOGLE_MAPS_API_KEY',
  'ADMIN_ACCESS_CODE',
];

for (const key of secretKeys) {
  const val = process.env[key];
  if (typeof val === 'string' && val.trim() !== '') {
    wranglerArgs.push('--var', `${key}:${val}`);
  }
}

const child = spawn('npx', wranglerArgs, {
  stdio: 'inherit',
  env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    child.kill(sig);
  });
}
