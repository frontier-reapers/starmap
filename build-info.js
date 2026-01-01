// This file is auto-generated during build/deployment with git commit info
// It's used for cache-busting to ensure fresh data loads when the codebase changes

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
const timestamp = Date.now();

const buildInfo = {
  commit,
  timestamp,
  buildDate: new Date().toISOString()
};

console.log('Build info:', buildInfo);

// Write to public/build-info.json
const outPath = path.join(process.cwd(), 'public', 'build-info.json');
fs.writeFileSync(outPath, JSON.stringify(buildInfo, null, 2));
console.log(`Build info written to ${outPath}`);
// Also write to repository root so the deployed site (served from '/') can fetch /build-info.json
try {
  const rootOut = path.join(process.cwd(), 'build-info.json');
  fs.writeFileSync(rootOut, JSON.stringify(buildInfo, null, 2));
  console.log(`Build info also written to ${rootOut}`);
} catch (e) {
  // best-effort
}
