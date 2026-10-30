import { ChatClient, splitSystemMessages } from './chat-client.js';
import { parseSSE } from '../streams.js';

/**
 * Client for the Google Gemini API (`models/{model}:generateContent` and
 * `models/{model}:streamGenerateContent?alt=sse`).
 *
 * The key is sent in the `x-goog-api-key` header rather than in the query
 * string so it does not end up in URLs / logs.
 *
 * @see https://ai.google.dev/api/generate-content
 */
export class GeminiClient extends ChatClient {
  static providerName = 'Google Gemini';

  static defaultBaseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  _endpoint({ model, stream }) {
    const name = encodeURIComponent(model.trim().replace(/^models\//, ''));
    return stream
      ? `${this.baseUrl}/models/${name}:streamGenerateContent?alt=sse`
      : `${this.baseUrl}/models/${name}:generateContent`;
  }

  _headers() {
    return { 'x-goog-api-key': this.apiKey };
  }

  _body({ messages }) {
    const { system, turns } = splitSystemMessages(messages);
    return {
      contents: turns.map(({ role, content }) => ({
        role: role === 'assistant' ? 'model' : 'user',
        parts: [{ text: content }],
      })),
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    };
  }

  _parseCompletion(json) {
    if (json?.error) this._throwPayloadError(json.error);
    const blockReason = json?.promptFeedback?.blockReason;
    if (blockReason && !json?.candidates?.length) {
      this._throwPayloadError(`the prompt was blocked (${blockReason}).`);
    }
    return (json?.candidates?.[0]?.content?.parts ?? [])
      .map(part => part.text ?? '')
      .join('');
  }

  async *_parseStream(body) {
    for await (const { data } of parseSSE(body)) {
      const text = this._parseCompletion(JSON.parse(data));
      if (text) yield text;
    }
  }
}
