import { rollupPluginHTML } from '@web/rollup-plugin-html';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

export default {
  input: 'index.html',
  output: {
    dir: 'dist',
    format: 'es',
    entryFileNames: 'assets/[name]-[hash].js',
    chunkFileNames: 'assets/[name]-[hash].js',
  },
  plugins: [rollupPluginHTML(), nodeResolve(), terser()],
};
