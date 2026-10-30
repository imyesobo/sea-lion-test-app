import { expect } from '@open-wc/testing';
import {
  AnthropicClient,
  CLIENTS,
  GeminiClient,
  OllamaClient,
  ProviderError,
  createChatClient,
} from '../src/services/ai-client.js';
import { PROVIDERS } from '../src/services/providers.js';
import {
  collect,
  jsonResponse,
  mockFetch,
  streamResponse,
} from './helpers/mock-fetch.js';

const messages = [
  { role: 'system', content: 'Be brief.' },
  { role: 'user', content: 'Hello' },
  { role: 'assistant', content: 'Hi!' },
  { role: 'user', content: 'How are you?' },
];

describe('createChatClient', () => {
  it('has a client for every provider in PROVIDERS', () => {
    for (const { id } of PROVIDERS) {
      expect(createChatClient(id)).to.be.instanceOf(CLIENTS[id]);
    }
  });

  it('throws on unknown providers', () => {
    expect(() => createChatClient('nope')).to.throw(ProviderError);
  });
});

describe('AnthropicClient', () => {
  it('sends the Anthropic headers and a separate system prompt', async () => {
    const { fetch, calls } = mockFetch(
      jsonResponse({
        content: [
          { type: 'text', text: 'Fine, ' },
          { type: 'tool_use', id: 'x' },
          { type: 'text', text: 'thanks.' },
        ],
      }),
    );
    const client = new AnthropicClient({ apiKey: 'sk-ant', fetch });

    const answer = await client.chat({ model: 'claude-sonnet-4-5', messages });

    expect(answer).to.equal('Fine, thanks.');
    expect(calls[0].url).to.equal('https://api.anthropic.com/v1/messages');
    expect(calls[0].headers).to.include({
      'x-api-key': 'sk-ant',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    });
    expect(calls[0].headers).not.to.have.property('Authorization');
    expect(calls[0].body).to.deep.equal({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: 'Be brief.',
      messages: messages.slice(1),
      stream: false,
    });
  });

  it('streams text deltas', async () => {
    const { fetch } = mockFetch(
      streamResponse([
        'event: message_start\ndata: {"type":"message_start"}\n\n',
        'event: content_block_delta\ndata: {"delta":{"type":"text_delta","text":"Hel"}}\n\n',
        'event: ping\ndata: {}\n\n',
        'event: content_block_delta\ndata: {"delta":{"type":"text_delta","text":"lo"}}\n\n',
        'event: message_stop\ndata: {}\n\n',
      ]),
    );
    const client = new AnthropicClient({ apiKey: 'sk-ant', fetch });

    const tokens = await collect(
      client.chat({ model: 'claude', messages, stream: true }),
    );

    expect(tokens).to.deep.equal(['Hel', 'lo']);
  });

  it('surfaces stream error events', async () => {
    const { fetch } = mockFetch(
      streamResponse([
        'event: error\ndata: {"error":{"type":"overloaded_error","message":"Overloaded"}}\n\n',
      ]),
    );
    const client = new AnthropicClient({ apiKey: 'sk-ant', fetch });

    const error = await collect(
      client.chat({ model: 'claude', messages, stream: true }),
    ).catch(e => e);

    expect(error).to.be.instanceOf(ProviderError);
    expect(error.message).to.equal('Anthropic error: Overloaded');
  });
});

describe('GeminiClient', () => {
  it('maps roles, system instruction and uses the key header', async () => {
    const { fetch, calls } = mockFetch(
      jsonResponse({
        candidates: [{ content: { parts: [{ text: 'Good' }, { text: '!' }] } }],
      }),
    );
    const client = new GeminiClient({ apiKey: 'g-key', fetch });

    const answer = await client.chat({ model: 'gemini-2.5-flash', messages });

    expect(answer).to.equal('Good!');
    expect(calls[0].url).to.equal(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    );
    expect(calls[0].url).not.to.contain('g-key');
    expect(calls[0].headers['x-goog-api-key']).to.equal('g-key');
    expect(calls[0].body).to.deep.equal({
      contents: [
        { role: 'user', parts: [{ text: 'Hello' }] },
        { role: 'model', parts: [{ text: 'Hi!' }] },
        { role: 'user', parts: [{ text: 'How are you?' }] },
      ],
      systemInstruction: { parts: [{ text: 'Be brief.' }] },
    });
  });

  it('streams through the SSE endpoint', async () => {
    const { fetch, calls } = mockFetch(
      streamResponse([
        'data: {"candidates":[{"content":{"parts":[{"text":"Go"}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":"od"}]}}]}\n\n',
      ]),
    );
    const client = new GeminiClient({ apiKey: 'g-key', fetch });

    const tokens = await collect(
      client.chat({ model: 'models/gemini-2.5-flash', messages, stream: true }),
    );

    expect(tokens).to.deep.equal(['Go', 'od']);
    expect(calls[0].url).to.equal(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse',
    );
  });

  it('reports blocked prompts', async () => {
    const { fetch } = mockFetch(
      jsonResponse({ promptFeedback: { blockReason: 'SAFETY' } }),
    );
    const error = await new GeminiClient({ apiKey: 'k', fetch })
      .chat({ model: 'gemini', messages })
      .catch(e => e);

    expect(error).to.be.instanceOf(ProviderError);
    expect(error.message).to.contain('SAFETY');
  });
});

describe('OllamaClient', () => {
  it('calls the local server without a key', async () => {
    const { fetch, calls } = mockFetch(
      jsonResponse({ message: { role: 'assistant', content: 'Local hi' } }),
    );
    const client = new OllamaClient({ fetch });

    expect(await client.chat({ model: 'llama3.2', messages })).to.equal(
      'Local hi',
    );
    expect(calls[0].url).to.equal('http://localhost:11434/api/chat');
    expect(calls[0].headers).not.to.have.property('Authorization');
    expect(calls[0].body.stream).to.equal(false);
  });

  it('streams NDJSON chunks until done', async () => {
    const { fetch } = mockFetch(
      streamResponse(
        [
          '{"message":{"content":"Lo"}}\n{"message":',
          '{"content":"cal"}}\n{"done":true}\n',
        ],
        'application/x-ndjson',
      ),
    );
    const tokens = await collect(
      new OllamaClient({ fetch }).chat({
        model: 'llama3.2',
        messages,
        stream: true,
      }),
    );
    expect(tokens).to.deep.equal(['Lo', 'cal']);
  });

  it('turns malformed stream chunks into a ProviderError', async () => {
    const { fetch } = mockFetch(
      streamResponse(['{"message":{"content":"ok"}}\nnot json\n']),
    );
    const error = await collect(
      new OllamaClient({ fetch }).chat({
        model: 'llama3.2',
        messages,
        stream: true,
      }),
    ).catch(e => e);

    expect(error).to.be.instanceOf(ProviderError);
    expect(error.message).to.contain('malformed');
  });
});
