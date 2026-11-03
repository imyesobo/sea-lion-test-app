import { expect } from '@open-wc/testing';
import {
  OpenAIClient,
  OpenAICompatibleClient,
  OpenRouterClient,
  XAIClient,
} from '../src/services/clients/openai-client.js';
import { ProviderError } from '../src/services/errors.js';
import {
  collect,
  jsonResponse,
  mockFetch,
  streamResponse,
} from './helpers/mock-fetch.js';

const messages = [
  { role: 'system', content: 'Be brief.' },
  { role: 'user', content: 'Hello' },
];

/** @param {string} json */
const sse = json => `data: ${json}\n\n`;

describe('OpenAIClient', () => {
  it('posts to /chat/completions with bearer auth and returns the answer', async () => {
    const { fetch, calls } = mockFetch(
      jsonResponse({ choices: [{ message: { content: 'Hi there!' } }] }),
    );
    const client = new OpenAIClient({ apiKey: ' sk-test ', fetch });

    const answer = await client.chat({ model: 'gpt-4o-mini', messages });

    expect(answer).to.equal('Hi there!');
    expect(calls).to.have.length(1);
    expect(calls[0].url).to.equal('https://api.openai.com/v1/chat/completions');
    expect(calls[0].init.method).to.equal('POST');
    expect(calls[0].headers.Authorization).to.equal(
      ['Bearer', 'sk-test'].join(' '),
    );
    expect(calls[0].headers['Content-Type']).to.equal('application/json');
    expect(calls[0].body).to.deep.equal({
      model: 'gpt-4o-mini',
      messages,
      stream: false,
    });
  });

  it('streams tokens from SSE chunks until [DONE]', async () => {
    const { fetch, calls } = mockFetch(
      streamResponse([
        sse('{"choices":[{"delta":{"role":"assistant"}}]}'),
        sse('{"choices":[{"delta":{"content":"Hel"}}]}') +
          'data: {"choices":[{"delta":{"con',
        'tent":"lo"}}]}\n\n',
        sse('[DONE]'),
        sse('{"choices":[{"delta":{"content":"ignored"}}]}'),
      ]),
    );
    const client = new OpenAIClient({ apiKey: 'sk-test', fetch });

    const tokens = await collect(
      client.chat({ model: 'gpt-4o-mini', messages, stream: true }),
    );

    expect(tokens).to.deep.equal(['Hel', 'lo']);
    expect(calls[0].body.stream).to.equal(true);
  });

  it('surfaces HTTP errors with the provider message and a hint', async () => {
    const { fetch } = mockFetch(
      jsonResponse(
        { error: { message: 'Incorrect API key provided' } },
        { status: 401 },
      ),
    );
    const client = new OpenAIClient({ apiKey: 'sk-bad', fetch });

    const error = await client
      .chat({ model: 'gpt-4o-mini', messages })
      .catch(e => e);

    expect(error).to.be.instanceOf(ProviderError);
    expect(error.status).to.equal(401);
    expect(error.message).to.equal(
      'OpenAI error (401): Incorrect API key provided. Check your API key.',
    );
  });

  it('surfaces errors embedded in the stream', async () => {
    const { fetch } = mockFetch(
      streamResponse([sse('{"error":{"message":"overloaded"}}')]),
    );
    const client = new OpenAIClient({ apiKey: 'sk-test', fetch });

    const error = await collect(
      client.chat({ model: 'gpt-4o-mini', messages, stream: true }),
    ).catch(e => e);

    expect(error).to.be.instanceOf(ProviderError);
    expect(error.message).to.equal('OpenAI error: overloaded');
  });

  it('turns network failures into a readable error', async () => {
    const { fetch } = mockFetch(new TypeError('Failed to fetch'));
    const client = new OpenAIClient({ apiKey: 'sk-test', fetch });

    const error = await client
      .chat({ model: 'gpt-4o-mini', messages })
      .catch(e => e);

    expect(error).to.be.instanceOf(ProviderError);
    expect(error.message).to.contain('OpenAI');
  });

  it('lets AbortError through untouched', async () => {
    const abort = new DOMException('The user aborted a request.', 'AbortError');
    const { fetch } = mockFetch(abort);
    const client = new OpenAIClient({ apiKey: 'sk-test', fetch });

    const error = await client
      .chat({ model: 'gpt-4o-mini', messages })
      .catch(e => e);

    expect(error).to.equal(abort);
  });

  it('validates the request synchronously, before any HTTP call', () => {
    const { fetch, calls } = mockFetch();

    expect(() =>
      new OpenAIClient({ fetch }).chat({ model: 'gpt-4o-mini', messages }),
    ).to.throw(ProviderError, 'an API key is required');
    expect(() =>
      new OpenAIClient({ apiKey: 'k', fetch }).chat({ model: ' ', messages }),
    ).to.throw(ProviderError, 'a model name is required');
    expect(() =>
      new OpenAIClient({ apiKey: 'k', fetch }).chat({
        model: 'm',
        messages: [],
      }),
    ).to.throw(ProviderError, 'at least one message is required');
    expect(calls).to.have.length(0);
  });
});

describe('XAIClient', () => {
  it('uses the xAI endpoint', async () => {
    const { fetch, calls } = mockFetch(
      jsonResponse({ choices: [{ message: { content: 'ok' } }] }),
    );
    await new XAIClient({ apiKey: 'xai-key', fetch }).chat({
      model: 'grok-4',
      messages,
    });
    expect(calls[0].url).to.equal('https://api.x.ai/v1/chat/completions');
  });
});

describe('OpenRouterClient', () => {
  it('uses the OpenRouter gateway, bearer auth and site attribution', async () => {
    const { fetch, calls } = mockFetch(
      jsonResponse({ choices: [{ message: { content: 'routed' } }] }),
    );
    const client = new OpenRouterClient({ apiKey: 'sk-or-v1-abc', fetch });

    const answer = await client.chat({
      model: 'anthropic/claude-sonnet-4.5',
      messages,
    });

    expect(answer).to.equal('routed');
    expect(calls[0].url).to.equal(
      'https://openrouter.ai/api/v1/chat/completions',
    );
    expect(calls[0].headers.Authorization).to.equal(
      ['Bearer', 'sk-or-v1-abc'].join(' '),
    );
    expect(calls[0].headers['X-Title']).to.equal(OpenRouterClient.appTitle);
    expect(calls[0].headers['HTTP-Referer']).to.equal(window.location.origin);
    expect(calls[0].body.model).to.equal('anthropic/claude-sonnet-4.5');
    expect(calls[0].body.messages).to.deep.equal(messages);
  });

  it('lets the site URL be overridden or hidden', async () => {
    const { fetch, calls } = mockFetch(
      jsonResponse({ choices: [{ message: { content: 'ok' } }] }),
      jsonResponse({ choices: [{ message: { content: 'ok' } }] }),
    );

    await new OpenRouterClient({
      apiKey: 'k',
      siteUrl: 'https://example.com/app/',
      fetch,
    }).chat({ model: 'openai/gpt-4o-mini', messages });
    await new OpenRouterClient({
      apiKey: 'k',
      siteUrl: '',
      fetch,
    }).chat({ model: 'openai/gpt-4o-mini', messages });

    expect(calls[0].headers['HTTP-Referer']).to.equal(
      'https://example.com/app',
    );
    expect(calls[1].headers).not.to.have.property('HTTP-Referer');
  });

  it('streams OpenAI-style SSE chunks and surfaces in-stream errors', async () => {
    const { fetch } = mockFetch(
      streamResponse([
        sse('{"choices":[{"delta":{"content":"Hell"}}]}'),
        sse('{"choices":[{"delta":{"content":"o"}}]}'),
        sse('[DONE]'),
      ]),
      streamResponse([sse('{"error":{"message":"no endpoints found"}}')]),
    );

    const tokens = await collect(
      new OpenRouterClient({ apiKey: 'k', fetch }).chat({
        model: 'meta-llama/llama-3.3-70b-instruct',
        messages,
        stream: true,
      }),
    );
    expect(tokens).to.deep.equal(['Hell', 'o']);

    const error = await collect(
      new OpenRouterClient({ apiKey: 'k', fetch }).chat({
        model: 'unknown/model',
        messages,
        stream: true,
      }),
    ).catch(e => e);
    expect(error).to.be.instanceOf(ProviderError);
    expect(error.message).to.equal('OpenRouter error: no endpoints found');
  });

  it('requires an API key before any HTTP call', () => {
    const { fetch, calls } = mockFetch();

    expect(() =>
      new OpenRouterClient({ fetch }).chat({
        model: 'openai/gpt-4o-mini',
        messages,
      }),
    ).to.throw(ProviderError, 'an API key is required');
    expect(calls).to.have.length(0);
  });
});

describe('OpenAICompatibleClient', () => {
  it('requires a base URL', () => {
    expect(() =>
      new OpenAICompatibleClient({ fetch: mockFetch().fetch }).chat({
        model: 'm',
        messages,
      }),
    ).to.throw(ProviderError, 'a base URL is required');
  });

  it('works without a key and normalises trailing slashes', async () => {
    const { fetch, calls } = mockFetch(
      jsonResponse({ choices: [{ message: { content: 'ok' } }] }),
    );
    const client = new OpenAICompatibleClient({
      baseUrl: 'http://localhost:1234/v1//',
      fetch,
    });

    expect(await client.chat({ model: 'local', messages })).to.equal('ok');
    expect(calls[0].url).to.equal('http://localhost:1234/v1/chat/completions');
    expect(calls[0].headers).not.to.have.property('Authorization');
  });
});
