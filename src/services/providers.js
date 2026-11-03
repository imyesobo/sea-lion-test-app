/**
 * Static metadata for every supported AI provider.
 *
 * The UI uses this to decide which credential fields to show, and the client
 * factory uses it for default base URLs and models.
 *
 * @typedef {'openai' | 'anthropic' | 'gemini' | 'xai' | 'openrouter' | 'ollama' | 'custom'} ProviderId
 *
 * @typedef {object} ProviderInfo
 * @property {ProviderId} id
 * @property {string} label Human readable name.
 * @property {boolean} requiresApiKey The API key field is shown and mandatory.
 * @property {boolean} acceptsApiKey The API key field is shown (possibly optional).
 * @property {boolean} requiresBaseUrl The base URL field is mandatory.
 * @property {boolean} acceptsBaseUrl The base URL field is shown.
 * @property {string} defaultBaseUrl Used when the user leaves the base URL empty.
 * @property {string} defaultModel Pre-filled model name.
 * @property {string} keyUrl Where to obtain an API key (or setup docs).
 */

/** @type {ReadonlyArray<ProviderInfo>} */
export const PROVIDERS = Object.freeze([
  {
    id: 'openai',
    label: 'OpenAI',
    requiresApiKey: true,
    acceptsApiKey: true,
    requiresBaseUrl: false,
    acceptsBaseUrl: false,
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    requiresApiKey: true,
    acceptsApiKey: true,
    requiresBaseUrl: false,
    acceptsBaseUrl: false,
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-5',
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    requiresApiKey: true,
    acceptsApiKey: true,
    requiresBaseUrl: false,
    acceptsBaseUrl: false,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.5-flash',
    keyUrl: 'https://aistudio.google.com/app/apikey',
  },
  {
    id: 'xai',
    label: 'xAI Grok',
    requiresApiKey: true,
    acceptsApiKey: true,
    requiresBaseUrl: false,
    acceptsBaseUrl: false,
    defaultBaseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-4',
    keyUrl: 'https://console.x.ai',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    requiresApiKey: true,
    acceptsApiKey: true,
    requiresBaseUrl: false,
    acceptsBaseUrl: false,
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    keyUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    requiresApiKey: false,
    acceptsApiKey: false,
    requiresBaseUrl: false,
    acceptsBaseUrl: true,
    defaultBaseUrl: 'http://localhost:11434',
    defaultModel: 'llama3.2',
    keyUrl: 'https://ollama.com/download',
  },
  {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    requiresApiKey: false,
    acceptsApiKey: true,
    requiresBaseUrl: true,
    acceptsBaseUrl: true,
    defaultBaseUrl: '',
    defaultModel: '',
    keyUrl: '',
  },
]);

/** @type {ProviderId} */
export const DEFAULT_PROVIDER = 'openai';

/**
 * @param {string} id
 * @returns {ProviderInfo | undefined}
 */
export function getProvider(id) {
  return PROVIDERS.find(provider => provider.id === id);
}
