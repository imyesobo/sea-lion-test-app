import { ChatClient } from './chat-client.js';
import { parseNDJSON } from '../streams.js';

/**
 * Client for a local Ollama server (`POST {baseUrl}/api/chat`). No key needed.
 *
 * Streaming responses are newline-delimited JSON objects. Ollama must allow the
 * app's origin, e.g. `OLLAMA_ORIGINS=http://localhost:8000 ollama serve`.
 *
 * @see https://github.com/ollama/ollama/blob/main/docs/api.md#generate-a-chat-completion
 */
export class OllamaClient extends ChatClient {
  static providerName = 'Ollama';

  static defaultBaseUrl = 'http://localhost:11434';

  static requiresApiKey = false;

  _endpoint() {
    return `${this.baseUrl}/api/chat`;
  }

  _headers() {
    // Supports Ollama instances behind an authenticating reverse proxy.
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
    if (json?.error) this._throwPayloadError(json.error);
    return json?.message?.content ?? '';
  }

  async *_parseStream(body) {
    for await (const chunk of parseNDJSON(body)) {
      if (chunk.error) this._throwPayloadError(chunk.error);
      if (chunk.message?.content) yield chunk.message.content;
      if (chunk.done) return;
    }
  }
}
