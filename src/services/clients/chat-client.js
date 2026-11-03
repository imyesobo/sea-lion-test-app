import {
  ProviderError,
  errorFromResponse,
  rethrowNetworkError,
} from '../errors.js';

/** HTTP authentication scheme used by OpenAI-style APIs. */
const AUTH_SCHEME = 'Bearer';

/**
 * @typedef {'system' | 'user' | 'assistant'} ChatRole
 *
 * @typedef {object} ChatMessage
 * @property {ChatRole} role
 * @property {string} content
 *
 * @typedef {object} ChatRequest
 * @property {string} model Model name, e.g. `gpt-4o-mini`.
 * @property {ChatMessage[]} messages Conversation so far (oldest first).
 * @property {boolean} [stream] When `true`, `chat()` returns an async iterable of text tokens.
 * @property {AbortSignal} [signal] Cancels the HTTP request (and the stream).
 *
 * @typedef {object} ChatClientOptions
 * @property {string} [apiKey]
 * @property {string} [baseUrl] Overrides the provider's default base URL.
 * @property {typeof fetch} [fetch] Custom fetch implementation (handy for tests).
 */

/**
 * Base class for every provider client.
 *
 * Subclasses describe *what* to send and *how* to read the answer through a
 * handful of template methods (`_endpoint`, `_headers`, `_body`,
 * `_parseCompletion`, `_parseStream`); this class takes care of validation,
 * the HTTP call and error handling.
 *
 * Usage:
 * ```js
 * const client = new OpenAIClient({ apiKey });
 * const text = await client.chat({ model, messages });            // full response
 * for await (const token of client.chat({ model, messages, stream: true })) { … } // streaming
 * ```
 */
export class ChatClient {
  /** Name used in error messages. */
  static providerName = 'Provider';

  /** Used when no `baseUrl` is given. */
  static defaultBaseUrl = '';

  /** Whether requests must be authenticated with an API key. */
  static requiresApiKey = true;

  /** @param {ChatClientOptions} [options] */
  constructor({ apiKey = '', baseUrl = '', fetch: fetchImpl } = {}) {
    const ctor = /** @type {typeof ChatClient} */ (this.constructor);
    this.providerName = ctor.providerName;
    this.apiKey = apiKey.trim();
    this.baseUrl = (baseUrl.trim() || ctor.defaultBaseUrl).replace(/\/+$/, '');
    this.requiresApiKey = ctor.requiresApiKey;
    /** @type {typeof fetch} */
    this.fetch = fetchImpl ?? ((...args) => globalThis.fetch(...args));
  }

  /**
   * Sends a chat request.
   *
   * @param {ChatRequest} request
   * @returns {Promise<string> | AsyncGenerator<string>} The full answer, or an
   *   async iterable yielding text tokens when `stream` is `true`.
   */
  chat(request) {
    this._validate(request);
    return request.stream ? this._stream(request) : this._complete(request);
  }

  /**
   * @param {ChatRequest} request
   * @protected
   */
  _validate({ model, messages }) {
    const fail = message => {
      throw new ProviderError(`${this.providerName}: ${message}`, {
        provider: this.providerName,
      });
    };
    if (!this.baseUrl) fail('a base URL is required.');
    if (this.requiresApiKey && !this.apiKey) fail('an API key is required.');
    if (!model || !model.trim()) fail('a model name is required.');
    if (!Array.isArray(messages) || messages.length === 0) {
      fail('at least one message is required.');
    }
  }

  /**
   * @param {ChatRequest} request
   * @returns {Promise<string>}
   * @protected
   */
  async _complete(request) {
    const response = await this._post({ ...request, stream: false });
    let json;
    try {
      json = await response.json();
    } catch (error) {
      throw new ProviderError(
        `${this.providerName}: the response is not valid JSON.`,
        { provider: this.providerName, cause: error },
      );
    }
    return this._parseCompletion(json);
  }

  /**
   * @param {ChatRequest} request
   * @returns {AsyncGenerator<string>}
   * @protected
   */
  async *_stream(request) {
    const response = await this._post({ ...request, stream: true });
    if (!response.body) {
      throw new ProviderError(
        `${this.providerName}: streaming is not supported by this browser.`,
        { provider: this.providerName },
      );
    }
    try {
      for await (const token of this._parseStream(response.body)) {
        if (token) yield token;
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new ProviderError(
          `${this.providerName}: received a malformed stream chunk.`,
          { provider: this.providerName, cause: error },
        );
      }
      rethrowNetworkError(error, this.providerName);
    }
  }

  /**
   * @param {ChatRequest} request
   * @returns {Promise<Response>}
   * @protected
   */
  async _post(request) {
    let response;
    try {
      response = await this.fetch(this._endpoint(request), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this._headers() },
        body: JSON.stringify(this._body(request)),
        signal: request.signal,
      });
    } catch (error) {
      rethrowNetworkError(error, this.providerName);
    }
    if (!response.ok) {
      throw await errorFromResponse(response, this.providerName);
    }
    return response;
  }

  /**
   * Throws a `ProviderError` for an error object embedded in a (streamed) payload.
   *
   * @param {any} error
   * @returns {never}
   * @protected
   */
  _throwPayloadError(error) {
    const message =
      typeof error === 'string' ? error : error?.message || 'Unknown error';
    throw new ProviderError(`${this.providerName} error: ${message}`, {
      provider: this.providerName,
    });
  }

  /**
   * Builds a bearer-token `Authorization` header when a key is configured.
   *
   * @returns {Record<string, string>}
   * @protected
   */
  _bearerAuth() {
    return this.apiKey
      ? { Authorization: `${AUTH_SCHEME} ${this.apiKey}` }
      : {};
  }

  /* ---------------------------------------------------------------------- */
  /* Template methods – override in subclasses                              */
  /* ---------------------------------------------------------------------- */

  /**
   * @param {ChatRequest} _request
   * @returns {string} Absolute URL to POST to.
   * @protected
   */
  _endpoint(_request) {
    throw new Error('Not implemented');
  }

  /**
   * @returns {Record<string, string>} Provider specific (auth) headers.
   * @protected
   */
  _headers() {
    return {};
  }

  /**
   * @param {ChatRequest} _request
   * @returns {object} JSON request body.
   * @protected
   */
  _body(_request) {
    throw new Error('Not implemented');
  }

  /**
   * @param {any} _json Parsed non-streaming response.
   * @returns {string}
   * @protected
   */
  _parseCompletion(_json) {
    throw new Error('Not implemented');
  }

  /**
   * @param {ReadableStream<Uint8Array>} _body
   * @returns {AsyncIterable<string>} Text tokens.
   * @protected
   */
  // eslint-disable-next-line require-yield
  async *_parseStream(_body) {
    throw new Error('Not implemented');
  }
}

/**
 * Splits system messages (sent separately by Anthropic and Gemini) from the
 * user / assistant turns.
 *
 * @param {ChatMessage[]} messages
 * @returns {{ system: string, turns: ChatMessage[] }}
 */
export function splitSystemMessages(messages) {
  const system = messages
    .filter(message => message.role === 'system')
    .map(message => message.content)
    .join('\n\n');
  const turns = messages.filter(message => message.role !== 'system');
  return { system, turns };
}
