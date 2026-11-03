import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import { rollupPluginHTML as html } from '@web/rollup-plugin-html';

/**
 * Optional production build. The app is fully buildless during development
 * (`npm start`); this bundles it into `dist/` for static hosting.
 */
export default /** @type {import('rollup').RollupOptions} */ ({
  input: 'index.html',
  output: {
    dir: 'dist',
    entryFileNames: '[hash].js',
    chunkFileNames: '[hash].js',
    assetFileNames: '[hash][extname]',
    format: 'es',
  },
  preserveEntrySignatures: false,
  plugins: [
    html({ minify: true }),
    nodeResolve({ exportConditions: ['browser', 'production'] }),
    terser({ module: true }),
  ],
});
