/**
 * Helpers to consume streaming HTTP bodies (`ReadableStream<Uint8Array>`) as
 * async iterables, without any third-party dependency.
 */

/**
 * Splits a byte stream into text lines (handles `\n` and `\r\n`). The last line
 * is emitted even when the stream does not end with a newline.
 *
 * @param {ReadableStream<Uint8Array>} stream
 * @returns {AsyncGenerator<string>}
 */
export async function* readLines(stream) {
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let index = buffer.indexOf('\n');
      while (index !== -1) {
        yield buffer.slice(0, index).replace(/\r$/, '');
        buffer = buffer.slice(index + 1);
        index = buffer.indexOf('\n');
      }
    }
    if (buffer) yield buffer.replace(/\r$/, '');
  } finally {
    reader.releaseLock();
  }
}

/**
 * @typedef {object} ServerSentEvent
 * @property {string} event Event name (`message` when omitted by the server).
 * @property {string} data Event payload (multiple `data:` lines are joined by `\n`).
 */

/**
 * Parses a Server-Sent Events stream (`text/event-stream`) as described in
 * https://html.spec.whatwg.org/multipage/server-sent-events.html.
 *
 * @param {ReadableStream<Uint8Array>} stream
 * @returns {AsyncGenerator<ServerSentEvent>}
 */
export async function* parseSSE(stream) {
  let event = '';
  /** @type {string[]} */
  let data = [];

  for await (const line of readLines(stream)) {
    if (line === '') {
      if (data.length)
        yield { event: event || 'message', data: data.join('\n') };
      event = '';
      data = [];
    } else if (!line.startsWith(':')) {
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'event') event = value;
      if (field === 'data') data.push(value);
    }
  }
  if (data.length) yield { event: event || 'message', data: data.join('\n') };
}

/**
 * Parses a newline-delimited JSON stream (used by Ollama).
 *
 * @param {ReadableStream<Uint8Array>} stream
 * @returns {AsyncGenerator<any>}
 */
export async function* parseNDJSON(stream) {
  for await (const line of readLines(stream)) {
    if (line.trim()) yield JSON.parse(line);
  }
}
