import { apiProxy } from './dev/api-proxy.mjs';

// import { hmrPlugin, presets } from '@open-wc/dev-server-hmr';

/** Use Hot Module replacement by adding --hmr to the start command */
const hmr = process.argv.includes('--hmr');

/**
 * Local OpenAI-compatible endpoint to mirror under this server's own origin.
 * Override without editing the file: UPSTREAM_API=http://127.0.0.1:1234/v1 npm start
 * Set it to an empty string to disable the proxy.
 */
const upstreamApi = process.env.UPSTREAM_API ?? 'http://127.0.0.1:8080/v1';
const upstreamOrigin = upstreamApi.replace(/\/v1\/?$/, '');

export default /** @type {import('@web/dev-server').DevServerConfig} */ ({
  open: '/',
  watch: !hmr,
  /** Resolve bare module imports */
  nodeResolve: {
    exportConditions: ['browser', 'development'],
  },

  /** Compile JS for older browsers. Requires @web/dev-server-esbuild plugin */
  // esbuildTarget: 'auto'

  /** Set appIndex to enable SPA routing */
  appIndex: './index.html',

  plugins: [
    /** Use Hot Module Replacement by uncommenting. Requires @open-wc/dev-server-hmr plugin */
    // hmr && hmrPlugin({ exclude: ['**/*/node_modules/**/*'], presets: [presets.litElement] }),
  ],

  /**
   * Same-origin proxy for endpoints that do not send CORS headers (see
   * dev/api-proxy.mjs). With it running, choose "Custom (OpenAI-compatible)"
   * in the app and use `http://localhost:8000/v1` as the base URL.
   */
  middleware: upstreamOrigin
    ? [
        apiProxy({
          target: upstreamOrigin,
          log: message => console.warn(`[proxy] ${message}`),
        }),
      ]
    : [],

  // See documentation for all available options
});
