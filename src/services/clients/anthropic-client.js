import { ChatClient, splitSystemMessages } from './chat-client.js';
import { parseSSE } from '../streams.js';

/**
 * Client for the Anthropic Messages API (`POST {baseUrl}/messages`).
 *
 * Calling the API from a browser requires the
 * `anthropic-dangerous-direct-browser-access` header, which acknowledges that
 * the key is exposed to the page (acceptable here: it is the user's own key and
 * never leaves their browser except towards Anthropic).
 *
 * @see https://docs.anthropic.com/en/api/messages
 */
export class AnthropicClient extends ChatClient {
  static providerName = 'Anthropic';

  static defaultBaseUrl = 'https://api.anthropic.com/v1';

  static apiVersion = '2023-06-01';

  /** `max_tokens` is mandatory for Anthropic. */
  static maxTokens = 4096;

  _endpoint() {
    return `${this.baseUrl}/messages`;
  }

  _headers() {
    return {
      'x-api-key': this.apiKey,
      'anthropic-version': AnthropicClient.apiVersion,
      'anthropic-dangerous-direct-browser-access': 'true',
    };
  }

  _body({ model, messages, stream }) {
    const { system, turns } = splitSystemMessages(messages);
    return {
      model: model.trim(),
      max_tokens: AnthropicClient.maxTokens,
      ...(system ? { system } : {}),
      messages: turns.map(({ role, content }) => ({ role, content })),
      stream: Boolean(stream),
    };
  }

  _parseCompletion(json) {
    return (json?.content ?? [])
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');
  }

  async *_parseStream(body) {
    for await (const { event, data } of parseSSE(body)) {
      if (event === 'message_stop') return;
      if (event === 'error') this._throwPayloadError(JSON.parse(data).error);
      if (event === 'content_block_delta') {
        const { delta } = JSON.parse(data);
        if (delta?.type === 'text_delta') yield delta.text;
      }
    }
  }
}
