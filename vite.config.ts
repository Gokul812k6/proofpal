import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { Buffer } from 'node:buffer';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'workspace-api',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res) => {
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(Buffer.from(chunk));
          const headers = new Headers();
          for (const key of ['authorization', 'content-type']) {
            const value = req.headers[key];
            if (typeof value === 'string') headers.set(key, value);
          }
          const response = await fetch(`https://proofpay-api.proofpal-workspace.workers.dev/api${req.url}`, {
            method: req.method,
            headers,
            body: chunks.length ? new Blob([Uint8Array.from(Buffer.concat(chunks))]) : undefined,
            signal: AbortSignal.timeout(30000),
            redirect: 'error',
          });
          res.statusCode = response.status;
          for (const key of ['content-type', 'content-disposition', 'cache-control', 'x-content-type-options']) {
            const value = response.headers.get(key);
            if (value) res.setHeader(key, value);
          }
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Unable to connect to your workspace. Please try again shortly.' }));
        }
      });
    },
  }],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
