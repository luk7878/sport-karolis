import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'web',
  publicDir: '../public',
  plugins: [react()],
  build: {
    outDir: '../dist', emptyOutDir: true,
    rollupOptions: { input: Object.fromEntries([
      'index.html', 'platform/index.html', 'news/index.html', 'contacts/index.html',
      'news/article/index.html', 'project/index.html', 'admin/index.html',
      'admin/svetaine/index.html', 'admin/uzklausos/index.html'
    ].map(path => [path, resolve('web', path)])) }
  }
});
