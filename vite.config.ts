import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';

export default defineConfig({ plugins: [react(), {
  name: 'release-version',
  generateBundle() {
    const revision = process.env.CF_PAGES_COMMIT_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ revision, builtAt: new Date().toISOString() }) });
  },
}], server: { host: '0.0.0.0', port: 5173 } });
