import { LitElement, html, css } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { baseStyles } from '../styles/shared-styles.js';
import '../sea-lion.js';
import './chat-message.js';

/** Distance (px) from the bottom under which the list keeps following new content. */
const STICK_THRESHOLD = 64;

/**
 * `<chat-message-list>` – scrollable conversation log.
 *
 * Auto-scrolls to the newest message (also while tokens stream in) unless the
 * user scrolled up to read older messages.
 *
 * @prop {Array<{id: string, role: string, content: string, pending?: boolean}>} messages
 * @prop {string} assistantLabel - author label for assistant messages
 * @slot empty - content shown when there are no messages
 */
export class ChatMessageList extends LitElement {
  static properties = {
    messages: { type: Array },
    assistantLabel: { type: String, attribute: 'assistant-label' },
  };

  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
      }

      .log {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        max-width: var(--app-content-max-width, 52rem);
        margin: 0 auto;
        padding: 1.25rem 1rem;
      }

      .empty {
        display: grid;
        place-items: center;
        min-height: 100%;
        padding: 1.5rem 1rem;
      }
    `,
  ];

  constructor() {
    super();
    this.messages = [];
    this.assistantLabel = '';
    this._stickToBottom = true;
    this._onScroll = this._onScroll.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('scroll', this._onScroll, { passive: true });
  }

  disconnectedCallback() {
    this.removeEventListener('scroll', this._onScroll);
    super.disconnectedCallback();
  }

  /** Whether the view is currently scrolled to (near) the bottom. */
  get isAtBottom() {
    return (
      this.scrollHeight - this.scrollTop - this.clientHeight <= STICK_THRESHOLD
    );
  }

  /** Scrolls to the newest message. */
  scrollToBottom() {
    this.scrollTop = this.scrollHeight;
    this._stickToBottom = true;
  }

  _onScroll() {
    this._stickToBottom = this.isAtBottom;
  }

  updated(changed) {
    super.updated(changed);
    if (!changed.has('messages')) return;
    const previous = changed.get('messages') ?? [];
    const userJustSent = this.messages
      .slice(previous.length)
      .some(message => message.role === 'user');
    if (this._stickToBottom || userJustSent) this.scrollToBottom();
  }

  render() {
    if (!this.messages.length) {
      return html`<div class="empty"><slot name="empty"></slot></div>`;
    }
    return html`
      <div class="log" role="log" aria-label="Conversation">
        ${repeat(
          this.messages,
          message => message.id,
          message => html`
            <chat-message
              author=${message.role}
              .content=${message.content}
              .pending=${Boolean(message.pending)}
              .label=${message.role === 'assistant' ? this.assistantLabel : ''}
            ></chat-message>
          `,
        )}
      </div>
    `;
  }
}

customElements.define('chat-message-list', ChatMessageList);
