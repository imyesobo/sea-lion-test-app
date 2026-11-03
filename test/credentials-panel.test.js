import { html, fixture, expect } from '@open-wc/testing';
import '../src/components/credentials-panel.js';
import { PROVIDERS } from '../src/services/providers.js';

/**
 * @param {string} provider
 * @returns {import('../src/components/credentials-panel.js').ChatConfig}
 */
function configFor(provider) {
  return {
    provider,
    credentials: Object.fromEntries(
      PROVIDERS.map(item => [
        item.id,
        { apiKey: '', baseUrl: '', model: item.defaultModel },
      ]),
    ),
    persistence: 'session',
    stream: true,
    persistHistory: false,
  };
}

/**
 * @param {string} provider
 */
async function renderPanel(provider) {
  const el = await fixture(html`
    <credentials-panel .config=${configFor(provider)}></credentials-panel>
  `);
  await el.updateComplete;
  return el;
}

describe('<credentials-panel>', () => {
  it('offers every provider from PROVIDERS, in order', async () => {
    const el = await renderPanel('openai');
    const options = [...el.shadowRoot.querySelectorAll('select option')];

    expect(options.map(option => option.value)).to.deep.equal(
      PROVIDERS.map(provider => provider.id),
    );
    expect(
      options.find(option => option.value === 'openrouter').textContent.trim(),
    ).to.equal('OpenRouter');
  });

  it('shows only model and key for OpenRouter', async () => {
    const el = await renderPanel('openrouter');
    const fields = [...el.shadowRoot.querySelectorAll('sea-input')];

    expect(fields.map(field => field.name)).to.deep.equal(['model', 'apiKey']);
    expect(fields[0].placeholder).to.equal('openai/gpt-4o-mini');
    expect(fields[1].type).to.equal('password');
    expect(fields[1].querySelector('a').href).to.equal(
      'https://openrouter.ai/keys',
    );
  });

  it('shows the base URL field only for providers that accept one', async () => {
    const withBaseUrl = await renderPanel('custom');
    const withoutBaseUrl = await renderPanel('anthropic');

    expect(
      [...withBaseUrl.shadowRoot.querySelectorAll('sea-input')].map(
        field => field.name,
      ),
    ).to.include('baseUrl');
    expect(
      [...withoutBaseUrl.shadowRoot.querySelectorAll('sea-input')].map(
        field => field.name,
      ),
    ).to.not.include('baseUrl');
  });
});
