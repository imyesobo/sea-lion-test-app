import { ChatClient } from './chat-client.js';
import { parseSSE } from '../streams.js';

/**
 * Client for the OpenAI Chat Completions API (`POST {baseUrl}/chat/completions`)
 * and every API that copies its shape (xAI, custom OpenAI-compatible servers
 * such as LM Studio, vLLM, OpenRouter, Groq, …).
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
