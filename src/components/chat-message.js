import { LitElement, html, css } from 'lit';
import { baseStyles, t } from '../styles/shared-styles.js';
import '../sea-lion.js';

/**
 * `<chat-message>` – a single chat bubble.
 *
 * Content is rendered as plain text (never as HTML), so model output cannot
 * inject markup into the page.
 *
 * @attr {'user'|'assistant'|'system'} author - who wrote the message (maps to the API `role`)
 * @prop {string} content - message text
 * @prop {boolean} pending - shows the typing indicator while no text arrived yet
 * @prop {string} label - author label shown in the badge (defaults per role)
 */
export class ChatMessage extends LitElement {
  static properties = {
    author: { type: String, reflect: true },
    content: { type: String },
    pending: { type: Boolean, reflect: true },
    label: { type: String },
  };

  static styles = [
    baseStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.375rem;
        max-width: 100%;
      }

      :host([author='user']) {
        align-items: flex-end;
      }

      .bubble {
        max-width: min(100%, 44rem);
        padding: 0.625rem 0.875rem;
        border: 1px solid ${t('border')};
        border-radius: ${t('radius-xl')};
        border-top-left-radius: ${t('radius-sm')};
        background-color: ${t('card')};
        color: ${t('card-foreground')};
        box-shadow: ${t('shadow-xs')};
        font-size: ${t('text-sm')};
        line-height: 1.6;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }

      :host([author='user']) .bubble {
        border-color: transparent;
        border-top-left-radius: ${t('radius-xl')};
        border-top-right-radius: ${t('radius-sm')};
        background-color: ${t('primary')};
        color: ${t('primary-foreground')};
      }

      .typing {
        display: inline-flex;
        gap: 0.25rem;
        padding: 0.25rem 0;
      }

      .typing span {
        width: 0.4rem;
        height: 0.4rem;
        border-radius: 50%;
        background-color: ${t('muted-foreground')};
        animation: typing-bounce 1.2s infinite ease-in-out;
      }

      .typing span:nth-child(2) {
        animation-delay: 0.15s;
      }

      .typing span:nth-child(3) {
        animation-delay: 0.3s;
      }

      @keyframes typing-bounce {
        0%,
        80%,
        100% {
          opacity: 0.3;
          transform: translateY(0);
        }
        40% {
          opacity: 1;
          transform: translateY(-0.2rem);
        }
      }
    `,
  ];

  constructor() {
    super();
    this.author = 'assistant';
    this.content = '';
    this.pending = false;
    this.label = '';
  }

  get _authorLabel() {
    if (this.label) return this.label;
    if (this.author === 'user') return 'You';
    if (this.author === 'system') return 'System';
    return 'Assistant';
  }

  render() {
    const typing = this.pending && !this.content;
    return html`
      <sea-badge variant=${this.author === 'user' ? 'outline' : 'secondary'}
        >${this._authorLabel}</sea-badge
      >
      <div class="bubble">
        ${
          typing
            ? html`<span class="typing" role="status">
                <span></span><span></span><span></span>
                <span class="sr-only">${this._authorLabel} is typing…</span>
              </span>`
            : this.content
        }
      </div>
    `;
  }
}

customElements.define('chat-message', ChatMessage);
