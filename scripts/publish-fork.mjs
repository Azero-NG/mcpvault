#!/usr/bin/env node
import { readFileSync, writeFileSync, copyFileSync, existsSync, unlinkSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const pkgPath = resolve(root, 'package.json');
const backupPath = resolve(root, 'package.json.bak');

const forkName = process.env.MCPVAULT_FORK_NAME;
const forkBin = process.env.MCPVAULT_FORK_BIN;
const dryRun = process.env.MCPVAULT_DRY_RUN === '1' || process.argv.includes('--dry-run');

if (!forkName) {
  console.error('MCPVAULT_FORK_NAME is required.');
  console.error('Example:');
  console.error('  MCPVAULT_FORK_NAME=@yourscope/mcpvault npm run publish:fork');
  console.error('  MCPVAULT_FORK_NAME=@yourscope/mcpvault MCPVAULT_FORK_BIN=mcpvault-mine npm run publish:fork');
  process.exit(1);
}

if (!forkName.startsWith('@') || !forkName.includes('/')) {
  console.error(`MCPVAULT_FORK_NAME must be a scoped name like @scope/name. Got: ${forkName}`);
  process.exit(1);
}

if (existsSync(backupPath)) {
  console.error(`Stale backup exists at ${backupPath}. Inspect and remove it before retrying.`);
  process.exit(1);
}

const original = JSON.parse(readFileSync(pkgPath, 'utf-8'));
copyFileSync(pkgPath, backupPath);

const patched = { ...original, name: forkName };
if (forkBin) {
  const originalBinPath = typeof original.bin === 'string'
    ? original.bin
    : (original.bin && Object.values(original.bin)[0]) || 'dist/server.js';
  patched.bin = { [forkBin]: originalBinPath };
}

writeFileSync(pkgPath, JSON.stringify(patched, null, 2) + '\n');

const publishCmd = dryRun
  ? 'npm publish --access public --dry-run'
  : 'npm publish --access public';

console.log(`Publishing ${forkName} v${original.version}${forkBin ? ` (bin: ${forkBin})` : ''}${dryRun ? ' [dry-run]' : ''}`);

let exitCode = 0;
try {
  execSync(publishCmd, { stdio: 'inherit', cwd: root });
} catch (err) {
  exitCode = typeof err.status === 'number' ? err.status : 1;
} finally {
  copyFileSync(backupPath, pkgPath);
  unlinkSync(backupPath);
  console.log('Restored original package.json');
}

process.exit(exitCode);
