/**
 * Thin, failure-tolerant wrapper around Web Storage.
 *
 * - **Credentials** (API keys, base URLs, models per provider) are only written
 *   when the user clicks "Save credentials", either to `localStorage`
 *   (persistent) or `sessionStorage` (cleared when the tab closes). Saving to
 *   one area always removes the copy from the other one.
 * - **Settings** (selected provider, streaming, history persistence) contain no
 *   secrets and are kept in `localStorage`.
 * - **History** is optional and kept in `localStorage`.
 *
 * Every read is defensive: corrupted JSON or unavailable storage (private
 * mode, disabled cookies, quota exceeded) never throws.
 *
 * @typedef {'local' | 'session'} Persistence
 *
 * @typedef {object} ProviderCredentials
 * @property {string} [apiKey]
 * @property {string} [baseUrl]
 * @property {string} [model]
 *
 * @typedef {Record<string, ProviderCredentials>} CredentialsMap
 *
 * @typedef {object} StoredMessage
 * @property {string} id
 * @property {'user' | 'assistant' | 'system'} role
 * @property {string} content
 */

export const STORAGE_KEYS = Object.freeze({
  credentials: 'ai-chat-app:credentials',
  settings: 'ai-chat-app:settings',
  history: 'ai-chat-app:history',
});

/**
 * @param {Persistence} persistence
 * @returns {Storage | null}
 */
function area(persistence) {
  try {
    return persistence === 'session'
      ? globalThis.sessionStorage
      : globalThis.localStorage;
  } catch {
    return null;
  }
}

/**
 * @param {Storage | null} storage
 * @param {string} key
 * @returns {any}
 */
function readJSON(storage, key) {
  try {
    const raw = storage?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * @param {Storage | null} storage
 * @param {string} key
 * @param {unknown} value
 * @returns {boolean} `true` when the value was written.
 */
function writeJSON(storage, key, value) {
  try {
    storage?.setItem(key, JSON.stringify(value));
    return Boolean(storage);
  } catch {
    return false;
  }
}

/**
 * @param {Storage | null} storage
 * @param {string} key
 */
function remove(storage, key) {
  try {
    storage?.removeItem(key);
  } catch {
    // storage unavailable – nothing to remove
  }
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
const isPlainObject = value =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/* -------------------------------------------------------------------------- */
/* Credentials                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Persists the credentials of every provider.
 *
 * @param {CredentialsMap} credentials
 * @param {{ persistence?: Persistence }} [options]
 * @returns {boolean} `true` on success.
 */
export function saveCredentials(credentials, { persistence = 'local' } = {}) {
  const target = persistence === 'session' ? 'session' : 'local';
  const other = target === 'session' ? 'local' : 'session';
  const ok = writeJSON(area(target), STORAGE_KEYS.credentials, credentials);
  if (ok) remove(area(other), STORAGE_KEYS.credentials);
  return ok;
}

/**
 * Loads the saved credentials. `sessionStorage` wins over `localStorage`.
 *
 * @returns {{ credentials: CredentialsMap, persistence: Persistence } | null}
 */
export function loadCredentials() {
  /** @type {Persistence[]} */
  const order = ['session', 'local'];
  for (const persistence of order) {
    const credentials = readJSON(area(persistence), STORAGE_KEYS.credentials);
    if (isPlainObject(credentials)) return { credentials, persistence };
  }
  return null;
}

/** Removes saved credentials from both storage areas. */
export function clearCredentials() {
  remove(area('local'), STORAGE_KEYS.credentials);
  remove(area('session'), STORAGE_KEYS.credentials);
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * @param {Record<string, unknown>} settings Non-secret preferences.
 * @returns {boolean}
 */
export function saveSettings(settings) {
  return writeJSON(area('local'), STORAGE_KEYS.settings, settings);
}

/** @returns {Record<string, any>} */
export function loadSettings() {
  const settings = readJSON(area('local'), STORAGE_KEYS.settings);
  return isPlainObject(settings) ? settings : {};
}

/* -------------------------------------------------------------------------- */
/* History                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * @param {unknown} message
 * @returns {message is StoredMessage}
 */
function isValidMessage(message) {
  return (
    isPlainObject(message) &&
    typeof message.id === 'string' &&
    ['user', 'assistant', 'system'].includes(message.role) &&
    typeof message.content === 'string'
  );
}

/**
 * @param {StoredMessage[]} messages
 * @returns {boolean}
 */
export function saveHistory(messages) {
  const clean = messages
    .filter(isValidMessage)
    .map(({ id, role, content }) => ({ id, role, content }));
  return writeJSON(area('local'), STORAGE_KEYS.history, clean);
}

/** @returns {StoredMessage[]} */
export function loadHistory() {
  const history = readJSON(area('local'), STORAGE_KEYS.history);
  return Array.isArray(history) ? history.filter(isValidMessage) : [];
}

export function clearHistory() {
  remove(area('local'), STORAGE_KEYS.history);
}
