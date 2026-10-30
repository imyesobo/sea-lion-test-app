import { LitElement, html, css } from 'lit';
import { baseStyles } from '../styles/shared-styles.js';
import { sendIcon, stopIcon } from '../styles/icons.js';
import '../sea-lion.js';

/**
 * `<chat-composer>` – message input with send / stop buttons.
 *
 * Enter sends the message, Shift+Enter inserts a new line.
 *
 * @prop {boolean} busy - a response is being generated (shows the stop button)
 * @prop {boolean} disabled - disables sending
 * @fires send-message - `detail: { text }`. Cancelable: when the listener calls
 *   `preventDefault()` the text is kept in the input (e.g. on validation errors).
 * @fires stop-generation - the user asked to stop the current response
 */
export class ChatComposer extends LitElement {
  static properties = {
    busy: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    _text: { state: true },
  };

  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }

      form {
        display: flex;
        align-items: flex-end;
        gap: 0.5rem;
        max-width: var(--app-content-max-width, 52rem);
        margin: 0 auto;
      }

      sea-textarea {
        flex: 1;
        min-width: 0;
      }

      .hint {
        max-width: var(--app-content-max-width, 52rem);
        margin: 0.375rem auto 0;
        font-size: 0.75rem;
      }

      @media (max-width: 40rem) {
        .hint {
          display: none;
        }
      }
    `,
  ];

  constructor() {
    super();
    this.busy = false;
    this.disabled = false;
    this._text = '';
  }

  /** @returns {HTMLElement & { modelValue: string } | null} */
  get _textarea() {
    return this.renderRoot.querySelector('sea-textarea');
  }

  /** Moves the keyboard focus into the message field. */
  focus() {
    this._textarea?.querySelector('textarea')?.focus();
  }

  /** Programmatically sets the draft text. */
  set value(text) {
    this._text = text;
    if (this._textarea) this._textarea.modelValue = text;
  }

  get value() {
    return this._text;
  }

  get _canSend() {
    return !this.disabled && !this.busy && this._text.trim().length > 0;
  }

  _onInput(event) {
    const { modelValue } = event.currentTarget;
    this._text = typeof modelValue === 'string' ? modelValue : '';
  }

  _onKeyDown(event) {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    this._send();
  }

  _onSubmit(event) {
    event.preventDefault();
    this._send();
  }

  _send() {
    if (!this._canSend) return;
    const text = this._text.trim();
    const accepted = this.dispatchEvent(
      new CustomEvent('send-message', {
        detail: { text },
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
    if (accepted) this.value = '';
  }

  _stop() {
    this.dispatchEvent(
      new CustomEvent('stop-generation', { bubbles: true, composed: true }),
    );
  }

  render() {
    return html`
      <form @submit=${this._onSubmit}>
        <sea-textarea
          label="Message"
          label-sr-only
          placeholder="Send a message…"
          rows="1"
          max-rows="8"
          name="message"
          .modelValue=${this._text}
          @model-value-changed=${this._onInput}
          @keydown=${this._onKeyDown}
        ></sea-textarea>
        ${
          this.busy
            ? html`<sea-button
                variant="outline"
                size="icon"
                aria-label="Stop generating"
                title="Stop generating"
                @click=${this._stop}
                >${stopIcon}</sea-button
              >`
            : html`<sea-button
                size="icon"
                aria-label="Send message"
                title="Send message"
                ?disabled=${!this._canSend}
                @click=${this._send}
                >${sendIcon}</sea-button
              >`
        }
      </form>
      <p class="hint muted">
        Enter to send · Shift + Enter for a new line · Keys never leave your
        browser except towards the selected provider.
      </p>
    `;
  }
}

customElements.define('chat-composer', ChatComposer);
