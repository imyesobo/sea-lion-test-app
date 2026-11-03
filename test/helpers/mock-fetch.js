/**
 * Minimal `fetch` test double: records every call and answers with the
 * responses queued by the test.
 */

/**
 * Creates a `ReadableStream` that emits each string as a separate chunk.
 *
 * @param {string[]} chunks
 * @returns {ReadableStream<Uint8Array>}
 */
export function streamOf(chunks) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

/**
 * @param {unknown} body
 * @param {ResponseInit} [init]
 */
export const jsonResponse = (body, init = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

/**
 * @param {string[]} chunks
 * @param {string} [contentType]
 */
export const streamResponse = (chunks, contentType = 'text/event-stream') =>
  new Response(streamOf(chunks), {
    status: 200,
    headers: { 'Content-Type': contentType },
  });

/**
 * @param {...(Response | Error)} responses Queued answers, consumed in order.
 *   Errors are thrown (the returned promise rejects).
 */
export function mockFetch(...responses) {
  /** @type {{ url: string, init: RequestInit, body: any, headers: Record<string, string> }[]} */
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({
      url: String(url),
      init,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
      headers: /** @type {Record<string, string>} */ (init.headers ?? {}),
    });
    const next = responses.shift();
    if (!next) throw new Error(`Unexpected fetch to ${url}`);
    if (next instanceof Error) throw next;
    return next;
  };
  return { fetch, calls };
}

/**
 * Collects every item of an async iterable.
 *
 * @template T
 * @param {AsyncIterable<T>} iterable
 * @returns {Promise<T[]>}
 */
export async function collect(iterable) {
  const items = [];
  for await (const item of iterable) items.push(item);
  return items;
}
