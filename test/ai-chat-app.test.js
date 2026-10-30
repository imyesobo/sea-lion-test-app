import { html, fixture, expect, waitUntil } from '@open-wc/testing';
import { STORAGE_KEYS } from '../src/services/storage.js';
import { jsonResponse, streamResponse } from './helpers/mock-fetch.js';
import '../src/ai-chat-app.js';

/** @typedef {import('../src/ai-chat-app.js').AiChatApp} AiChatApp */

/**
 * Sends a message through the composer like a user would.
 *
 * @param {AiChatApp} el
 * @param {string} text
 */
async function send(el, text) {
  const composer = el.shadowRoot.querySelector('chat-composer');
  composer.shadowRoot.querySelector('sea-textarea').modelValue = text;
  await composer.updateComplete;
  composer.shadowRoot.querySelector('sea-button').click();
}

describe('<ai-chat-app>', () => {
  const originalFetch = window.fetch;
  /** @type {{ url: string, init: RequestInit }[]} */
  let requests;

  /** @param {...Response} responses */
  function stubFetch(...responses) {
    window.fetch = async (url, init) => {
      requests.push({ url: String(url), init });
      return responses.shift();
    };
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    requests = [];
  });

  afterEach(() => {
    window.fetch = originalFetch;
    localStorage.clear();
    sessionStorage.clear();
  });

  it('renders the empty state and passes the a11y audit', async () => {
    const el = await fixture(html`<ai-chat-app></ai-chat-app>`);
    expect(el.shadowRoot.querySelector('h1').textContent).to.contain('AI Chat');
    expect(el.shadowRoot.querySelector('credentials-panel')).to.exist;
    expect(el.messages).to.deep.equal([]);
    await expect(el).to.be.accessible();
  });

  it('shows a validation error and sends nothing when the key is missing', async () => {
    stubFetch();
    const el = /** @type {AiChatApp} */ (
      await fixture(html`<ai-chat-app></ai-chat-app>`)
    );

    await send(el, 'Hello');
    await el.updateComplete;

    expect(el.error).to.contain('API key is required');
    expect(el.shadowRoot.querySelector('sea-alert')).to.exist;
    expect(el.messages).to.deep.equal([]);
    expect(requests).to.have.length(0);
    expect(el.shadowRoot.querySelector('chat-composer').value).to.equal(
      'Hello',
    );
  });

  it('streams the assistant answer into the message list', async () => {
    localStorage.setItem(
      STORAGE_KEYS.credentials,
      JSON.stringify({ openai: { apiKey: 'sk-test', model: 'gpt-4o-mini' } }),
    );
    stubFetch(
      streamResponse([
        'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" there"}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    );
    const el = /** @type {AiChatApp} */ (
      await fixture(html`<ai-chat-app></ai-chat-app>`)
    );

    await send(el, 'Hello');
    await waitUntil(() => !el.loading, 'response did not finish');

    expect(requests[0].url).to.equal(
      'https://api.openai.com/v1/chat/completions',
    );
    expect(
      el.messages.map(({ role, content }) => ({ role, content })),
    ).to.deep.equal([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ]);
    expect(el.error).to.equal('');
  });

  it('shows provider errors and removes the empty assistant message', async () => {
    localStorage.setItem(
      STORAGE_KEYS.credentials,
      JSON.stringify({ openai: { apiKey: 'sk-bad' } }),
    );
    localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({ provider: 'openai', stream: false }),
    );
    stubFetch(
      jsonResponse(
        { error: { message: 'Incorrect API key provided' } },
        { status: 401 },
      ),
    );
    const el = /** @type {AiChatApp} */ (
      await fixture(html`<ai-chat-app></ai-chat-app>`)
    );

    await send(el, 'Hello');
    await waitUntil(() => !el.loading && el.error, 'no error shown');

    expect(el.error).to.contain('Incorrect API key provided');
    expect(el.messages.map(m => m.role)).to.deep.equal(['user']);
  });

  it('restores persisted history and clears it on "New chat"', async () => {
    localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({ persistHistory: true }),
    );
    localStorage.setItem(
      STORAGE_KEYS.history,
      JSON.stringify([{ id: '1', role: 'user', content: 'Earlier' }]),
    );
    const el = /** @type {AiChatApp} */ (
      await fixture(html`<ai-chat-app></ai-chat-app>`)
    );
    expect(el.messages).to.have.length(1);

    el.newChat();
    await el.updateComplete;

    expect(el.messages).to.deep.equal([]);
    expect(localStorage.getItem(STORAGE_KEYS.history)).to.equal(null);
  });
});
