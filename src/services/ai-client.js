import { AnthropicClient } from './clients/anthropic-client.js';
import { GeminiClient } from './clients/gemini-client.js';
import { OllamaClient } from './clients/ollama-client.js';
import {
  OpenAIClient,
  OpenAICompatibleClient,
  XAIClient,
} from './clients/openai-client.js';
import { ProviderError } from './errors.js';

export { ChatClient } from './clients/chat-client.js';
export {
  AnthropicClient,
  GeminiClient,
  OllamaClient,
  OpenAIClient,
  OpenAICompatibleClient,
  XAIClient,
};
export { ProviderError } from './errors.js';

/** Maps a provider id (see `providers.js`) to its client class. */
export const CLIENTS = Object.freeze({
  openai: OpenAIClient,
  anthropic: AnthropicClient,
  gemini: GeminiClient,
  xai: XAIClient,
  ollama: OllamaClient,
  custom: OpenAICompatibleClient,
});

/**
 * Creates the client for a provider.
 *
 * @param {string} providerId One of the ids in `PROVIDERS`.
 * @param {import('./clients/chat-client.js').ChatClientOptions} [options]
 * @returns {import('./clients/chat-client.js').ChatClient}
 */
export function createChatClient(providerId, options = {}) {
  const Client = CLIENTS[/** @type {keyof typeof CLIENTS} */ (providerId)];
  if (!Client) {
    throw new ProviderError(`Unknown provider "${providerId}".`);
  }
  return new Client(options);
}
