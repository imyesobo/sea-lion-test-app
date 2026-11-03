import { ChatClient } from './chat-client.js';
import { parseSSE } from '../streams.js';

/**
 * Client for the OpenAI Chat Completions API (`POST {baseUrl}/chat/completions`)
 * and every API that copies its shape (xAI, OpenRouter, custom OpenAI-compatible
 * servers such as LM Studio, vLLM, Groq, …).
 *
 * @see https://platform.openai.com/docs/api-reference/chat
 */
export class OpenAICompatibleClient extends ChatClient {
  static providerName = 'OpenAI-compatible endpoint';

  /** Custom endpoints may not need a key (e.g. local servers). */
  static requiresApiKey = false;

  _endpoint() {
    return `${this.baseUrl}/chat/completions`;
  }

  _headers() {
    return this._bearerAuth();
  }

  _body({ model, messages, stream }) {
    return {
      model: model.trim(),
      messages: messages.map(({ role, content }) => ({ role, content })),
      stream: Boolean(stream),
    };
  }

  _parseCompletion(json) {
    return json?.choices?.[0]?.message?.content ?? '';
  }

  async *_parseStream(body) {
    for await (const { data } of parseSSE(body)) {
      if (data === '[DONE]') return;
      const json = JSON.parse(data);
      if (json.error) this._throwPayloadError(json.error);
      const token = json.choices?.[0]?.delta?.content;
      if (token) yield token;
    }
  }
}

/** OpenAI (https://api.openai.com/v1/chat/completions). */
export class OpenAIClient extends OpenAICompatibleClient {
  static providerName = 'OpenAI';

  static defaultBaseUrl = 'https://api.openai.com/v1';

  static requiresApiKey = true;
}

/**
 * xAI Grok – OpenAI-compatible API at https://api.x.ai/v1.
 *
 * @see https://docs.x.ai/docs/api-reference
 */
export class XAIClient extends OpenAICompatibleClient {
  static providerName = 'xAI';

  static defaultBaseUrl = 'https://api.x.ai/v1';

  static requiresApiKey = true;
}

/**
 * OpenRouter – an OpenAI-compatible gateway in front of hundreds of models,
 * addressed with vendor-namespaced ids such as `anthropic/claude-sonnet-4.5`.
 * Requests go to `POST https://openrouter.ai/api/v1/chat/completions`, so the
 * request/response/streaming shape is inherited untouched.
 *
 * `HTTP-Referer` and `X-Title` are OpenRouter's optional site attribution
 * headers: they label your traffic in its dashboards and app rankings.
 * They are independent of the browser's `Referer` (which this app disables
 * through `<meta name="referrer" content="no-referrer">`), so sending them is
 * deliberate and only ever exposes the app's own origin.
 *
 * @typedef {import('./chat-client.js').ChatClientOptions & {
 *   siteUrl?: string Sent as `HTTP-Referer`; defaults to the page origin.
 * }} OpenRouterClientOptions
 *
 * @see https://openrouter.ai/docs/api-reference/overview
 */
export class OpenRouterClient extends OpenAICompatibleClient {
  static providerName = 'OpenRouter';

  static defaultBaseUrl = 'https://openrouter.ai/api/v1';

  static requiresApiKey = true;

  /** Name shown in OpenRouter's dashboards and public app rankings. */
  static appTitle = 'sea-lion-test-app';

  /** @param {OpenRouterClientOptions} [options] */
  constructor(options = {}) {
    super(options);
    const origin =
      options.siteUrl ??
      /** @type {Location?} */ (globalThis.location)?.origin ??
      '';
    this.siteUrl = origin.replace(/\/+$/, '');
  }

  /** @returns {Record<string, string>} */
  _headers() {
    const ctor = /** @type {typeof OpenRouterClient} */ (this.constructor);
    return {
      ...this._bearerAuth(),
      ...(ctor.appTitle ? { 'X-Title': ctor.appTitle } : {}),
      ...(this.siteUrl ? { 'HTTP-Referer': this.siteUrl } : {}),
    };
  }
}
