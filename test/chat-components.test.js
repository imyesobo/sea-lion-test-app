import { html, fixture, expect, oneEvent } from '@open-wc/testing';
import '../src/components/chat-message.js';
import '../src/components/chat-composer.js';

/**
 * @param {Element} el
 * @param {string} text
 */
async function typeDraft(el, text) {
  const textarea = el.shadowRoot.querySelector('sea-textarea');
  textarea.modelValue = text;
  await el.updateComplete;
}

describe('<chat-message>', () => {
  it('renders content as text, never as HTML', async () => {
    const markup = '<img src=x onerror=alert(1)> **hi**';
    const el = await fixture(html`
      <chat-message author="assistant" .content=${markup}></chat-message>
    `);
    const bubble = el.shadowRoot.querySelector('.bubble');
    expect(bubble.querySelector('img')).to.equal(null);
    expect(bubble.textContent).to.contain('<img src=x onerror=alert(1)>');
  });

  it('shows a typing indicator while pending without content', async () => {
    const el = await fixture(html`
      <chat-message author="assistant" pending label="Claude"></chat-message>
    `);
    expect(el.shadowRoot.querySelector('.typing')).to.exist;
    expect(el.shadowRoot.querySelector('sea-badge').textContent).to.contain(
      'Claude',
    );

    el.content = 'Hel';
    await el.updateComplete;
    expect(el.shadowRoot.querySelector('.typing')).to.equal(null);
  });

  it('labels user messages with "You"', async () => {
    const el = await fixture(
      html`<chat-message author="user" content="Hi"></chat-message>`,
    );
    expect(el.shadowRoot.querySelector('sea-badge').textContent).to.contain(
      'You',
    );
  });

  it('passes the a11y audit', async () => {
    const el = await fixture(
      html`<chat-message author="user" content="Hi"></chat-message>`,
    );
    await expect(el).shadowDom.to.be.accessible();
  });
});

describe('<chat-composer>', () => {
  it('disables sending while the draft is empty', async () => {
    const el = await fixture(html`<chat-composer></chat-composer>`);
    const button = el.shadowRoot.querySelector('sea-button');
    expect(button.disabled).to.equal(true);

    await typeDraft(el, '  hello ');
    expect(button.disabled).to.equal(false);
  });

  it('sends the trimmed text on Enter and clears the draft', async () => {
    const el = await fixture(html`<chat-composer></chat-composer>`);
    await typeDraft(el, '  hello ');

    const textarea = el.shadowRoot.querySelector('sea-textarea');
    setTimeout(() =>
      textarea.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      ),
    );
    const { detail } = await oneEvent(el, 'send-message');

    expect(detail).to.deep.equal({ text: 'hello' });
    expect(el.value).to.equal('');
  });

  it('does not send on Shift+Enter', async () => {
    const el = await fixture(html`<chat-composer></chat-composer>`);
    await typeDraft(el, 'line 1');
    let sent = false;
    el.addEventListener('send-message', () => {
      sent = true;
    });

    el.shadowRoot.querySelector('sea-textarea').dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        shiftKey: true,
        bubbles: true,
      }),
    );

    expect(sent).to.equal(false);
    expect(el.value).to.equal('line 1');
  });

  it('sends when the send button is clicked', async () => {
    const el = await fixture(html`<chat-composer></chat-composer>`);
    await typeDraft(el, 'via button');

    setTimeout(() => el.shadowRoot.querySelector('sea-button').click());
    const { detail } = await oneEvent(el, 'send-message');

    expect(detail.text).to.equal('via button');
  });

  it('keeps the draft when the send event is cancelled', async () => {
    const el = await fixture(html`<chat-composer></chat-composer>`);
    el.addEventListener('send-message', event => event.preventDefault());
    await typeDraft(el, 'keep me');

    el.shadowRoot.querySelector('sea-button').click();

    expect(el.value).to.equal('keep me');
  });

  it('shows a stop button while busy', async () => {
    const el = await fixture(html`<chat-composer busy></chat-composer>`);
    const button = el.shadowRoot.querySelector('sea-button');
    expect(button.getAttribute('aria-label')).to.equal('Stop generating');

    setTimeout(() => button.click());
    await oneEvent(el, 'stop-generation');
  });
});
