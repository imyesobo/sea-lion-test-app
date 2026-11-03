import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

/**
 * Same-origin proxy for a local OpenAI-compatible endpoint that does not send
 * CORS headers.
 *
 * The app talks to the provider straight from the browser (there is no backend
 * of its own), so a local server that omits `Access-Control-Allow-Origin` is
 * blocked by the browser even though `curl` on the same machine succeeds. This
 * middleware mounts the endpoint under the dev server's own origin, which makes
 * the request same-origin and CORS irrelevant:
 *
 *   browser -> http://localhost:8000/v1/chat/completions
 *           -> http://127.0.0.1:8080/v1/chat/completions
 *
 * Bodies are streamed in both directions, so SSE (`stream: true`) works.
 */

/** Request/response headers that must not be forwarded (RFC 9110 §7.6.1). */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

/** Headers the proxy owns: the upstream's length is not the length we send. */
const REWRITTEN = new Set([
  'content-length',
  'host',
  'accept-encoding',
  'origin',
]);

/**
 * @param {object} options
 * @param {string} [options.mount] Path prefix served on the dev server, default `/v1`.
 * @param {string} options.target Upstream base URL, e.g. `http://127.0.0.1:8080`.
 * @param {(message: string) => void} [options.log] Called for proxy failures.
 * @returns {import('koa').Middleware}
 */
export function apiProxy({ mount = '/v1', target, log = () => {} }) {
  const upstream = new URL(target);
  const send = upstream.protocol === 'https:' ? httpsRequest : httpRequest;
  const prefix = mount.replace(/\/+$/, '');

  return async function proxy(ctx, next) {
    if (ctx.path !== prefix && !ctx.path.startsWith(`${prefix}/`))
      return next();

    const headers = {};
    for (const [name, value] of Object.entries(ctx.req.headers)) {
      const key = name.toLowerCase();
      if (HOP_BY_HOP.has(key) || REWRITTEN.has(key) || value === undefined)
        continue;
      headers[name] = Array.isArray(value) ? value.join(', ') : value;
    }
    headers.host = upstream.host;

    await new Promise(resolve => {
      const upstreamReq = send(
        {
          protocol: upstream.protocol,
          hostname: upstream.hostname,
          port: upstream.port || (upstream.protocol === 'https:' ? 443 : 80),
          method: ctx.method,
          path: ctx.url,
          headers,
        },
        upstreamRes => {
          ctx.status = upstreamRes.statusCode ?? 502;
          for (const [name, value] of Object.entries(upstreamRes.headers)) {
            const key = name.toLowerCase();
            if (
              HOP_BY_HOP.has(key) ||
              key === 'content-length' ||
              value === undefined
            )
              continue;
            ctx.set(name, Array.isArray(value) ? value.join(', ') : value);
          }
          ctx.body = upstreamRes; // a Node stream: Koa streams it (chunked) to the browser
          resolve();
        },
      );

      upstreamReq.on('error', error => {
        log(`${target}${ctx.url} failed: ${error.message}`);
        if (!ctx.res.headersSent) {
          ctx.status = 502;
          ctx.type = 'application/json';
          ctx.body = JSON.stringify({
            error: {
              message: `Dev server could not reach ${target}${ctx.url}: ${error.message}`,
            },
          });
        }
        resolve();
      });

      ctx.req.pipe(upstreamReq); // forwards the request body (also for SSE-less POSTs)
    });
  };
}
