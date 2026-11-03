/**
 * Error raised by every provider client. It always carries a message that is
 * safe and meaningful to show to the user.
 */
export class ProviderError extends Error {
  /**
   * @param {string} message
   * @param {{ provider?: string, status?: number, cause?: unknown }} [options]
   */
  constructor(message, { provider, status, cause } = {}) {
    super(message, { cause });
    this.name = 'ProviderError';
    /** @type {string | undefined} */
    this.provider = provider;
    /** @type {number | undefined} HTTP status code, when the failure came from a response. */
    this.status = status;
  }
}

/**
 * Extracts a human readable message from the (JSON or text) body of a failed
 * response. Every provider wraps errors slightly differently:
 * - OpenAI / xAI / Anthropic / Gemini: `{ error: { message } }`
 * - Ollama: `{ error: "..." }`
 *
 * @param {string} body
 * @returns {string}
 */
export function extractErrorMessage(body) {
  if (!body) return '';
  try {
    const json = JSON.parse(body);
    const payload = Array.isArray(json) ? json[0] : json;
    const error = payload?.error ?? payload;
    if (typeof error === 'string') return error;
    if (typeof error?.message === 'string') return error.message;
    if (typeof payload?.message === 'string') return payload.message;
  } catch {
    // not JSON – fall through to the raw text
  }
  return body.length > 300 ? `${body.slice(0, 300)}…` : body;
}

/**
 * Builds a `ProviderError` from a non-2xx `Response`.
 *
 * @param {Response} response
 * @param {string} provider
 * @returns {Promise<ProviderError>}
 */
export async function errorFromResponse(response, provider) {
  let body = '';
  try {
    body = await response.text();
  } catch {
    // ignore unreadable bodies
  }
  const message =
    extractErrorMessage(body) || response.statusText || 'Request failed';
  const detail = /[.!?]$/.test(message) ? message : `${message}.`;
  let hint = '';
  if (response.status === 401 || response.status === 403) {
    hint = ' Check your API key.';
  } else if (response.status === 404) {
    hint = ' Check the model name and base URL.';
  } else if (response.status === 429) {
    hint = ' Rate limit or quota exceeded.';
  }
  return new ProviderError(
    `${provider} error (${response.status}): ${detail}${hint}`,
    { provider, status: response.status },
  );
}

/**
 * Converts low-level fetch failures (network down, CORS rejections, …) into a
 * `ProviderError`. Abort errors are re-thrown unchanged so callers can detect
 * a user initiated cancellation.
 *
 * @param {unknown} error
 * @param {string} provider
 * @returns {never}
 */
export function rethrowNetworkError(error, provider) {
  if (error instanceof ProviderError) throw error;
  if (/** @type {Error} */ (error)?.name === 'AbortError') throw error;
  throw new ProviderError(
    `Could not reach ${provider}. Check your network connection, the base URL and that the endpoint allows browser (CORS) requests.`,
    { provider, cause: error },
  );
}
