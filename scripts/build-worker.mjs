// As libs de runtime ficam externas para usarem o node_modules do runner.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/server/worker.ts'],
  outfile: 'dist/worker.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['bullmq', 'ioredis', '@prisma/client'],
  define: { 'process.env.NODE_ENV': '"production"' },
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
});

console.log('dist/worker.js gerado');
