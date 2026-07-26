// Cross-platform preinstall script (replaces sh -c 'rm -f ...' which breaks on Windows)
import { unlinkSync } from 'fs';

// Remove lock files from other package managers if they exist
for (const f of ['package-lock.json', 'yarn.lock']) {
  try { unlinkSync(f); } catch { /* file doesn't exist — that's fine */ }
}

// Enforce pnpm
const agent = process.env.npm_config_user_agent ?? '';
if (agent && !agent.startsWith('pnpm/')) {
  console.error('Error: Please use pnpm instead of npm or yarn.');
  console.error('  npm install -g pnpm');
  process.exit(1);
}
