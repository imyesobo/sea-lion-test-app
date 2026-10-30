import { LitElement, html, css, nothing } from 'lit';
import { createChatClient } from './services/ai-client.js';
import {
  DEFAULT_PROVIDER,
  PROVIDERS,
  getProvider,
} from './services/providers.js';
import {
  clearCredentials,
  clearHistory,
  loadCredentials,
  loadHistory,
  loadSettings,
  saveCredentials,
  saveHistory,
  saveSettings,
} from './services/storage.js';
import { appTokens, baseStyles, t } from './styles/shared-styles.js';
import {
  alertIcon,
  closeIcon,
  plusIcon,
  settingsIcon,
} from './styles/icons.js';
import './sea-lion.js';
import './components/chat-composer.js';
import './components/chat-message-list.js';
import './components/credentials-panel.js';

/**
 * @typedef {import('./components/credentials-panel.js').ChatConfig} ChatConfig
 *
 * @typedef {object} UiMessage
 * @property {string} id
 * @property {'user' | 'assistant' | 'system'} role
 * @property {string} content
 * @property {boolean} [pending] Waiting for (more) tokens.
 */

/** Viewport width from which the settings sidebar is shown next to the chat. */
const WIDE_LAYOUT_QUERY = '(min-width: 60rem)';

/** @returns {string} */
function createId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

/**
 * Builds the initial configuration from defaults, saved settings and saved
 * credentials.
 *
 * @returns {{ config: ChatConfig, hasSavedCredentials: boolean }}
 */
function loadInitialConfig() {
  const settings = loadSettings();
  const saved = loadCredentials();

  /** @type {ChatConfig['credentials']} */
  const credentials = {};
  for (const provider of PROVIDERS) {
    credentials[provider.id] = {
      apiKey: '',
      baseUrl: '',
      model: provider.defaultModel,
      ...(saved?.credentials?.[provider.id] ?? {}),
    };
  }

  return {
    hasSavedCredentials: Boolean(saved),
    config: {
      provider: getProvider(settings.provider)
        ? settings.provider
        : DEFAULT_PROVIDER,
      credentials,
      persistence:
        saved?.persistence ??
        (settings.persistence === 'session' ? 'session' : 'local'),
      stream: settings.stream !== false,
      persistHistory: settings.persistHistory === true,
    },
  };
}

/**
 * `<ai-chat-app>` – root component.
 *
 * Owns the application state (configuration, conversation, loading / error
 * state), talks to the provider clients and persists data through the storage
 * helper. Child components are presentational and communicate via events:
 *
 * ```
 * <ai-chat-app>
 *   ├─ <credentials-panel>   config-change / save-credentials / clear-credentials / clear-history
 *   ├─ <chat-message-list>   └─ <chat-message>
 *   └─ <chat-composer>       send-message / stop-generation
 * ```
 */
export class AiChatApp extends LitElement {
  static properties = {
    config: { type: Object },
    messages: { type: Array },
    loading: { type: Boolean, reflect: true },
    error: { type: String },
    credentialsStatus: { type: String },
    settingsOpen: { type: Boolean, reflect: true, attribute: 'settings-open' },
  };

  static styles = [
    appTokens,
    baseStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100vh;
        height: 100dvh;
        background-color: ${t('background')};
      }

      header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.625rem 1rem;
        border-bottom: 1px solid ${t('border')};
        background-color: ${t('background')};
      }

      h1 {
        margin: 0;
        font-size: ${t('text-lg')};
        font-weight: 600;
        white-space: nowrap;
      }

      .header-meta {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-width: 0;
        flex: 1;
      }

      .header-meta sea-badge {
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .header-actions {
        display: flex;
        gap: 0.5rem;
      }

      .progress {
        height: 2px;
      }

      .progress sea-progress {
        height: 2px;
        border-radius: 0;
      }

      .layout {
        position: relative;
        display: flex;
        flex: 1;
        min-height: 0;
      }

      aside {
        flex: 0 0 var(--app-sidebar-width);
        overflow-y: auto;
        padding: var(--app-gap);
        border-right: 1px solid ${t('border')};
        background-color: ${t('background')};
      }

      main {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
        min-height: 0;
      }

      chat-message-list {
        flex: 1;
      }

      .empty {
        max-width: 28rem;
        text-align: center;
      }

      .empty h2 {
        margin: 0;
        font-size: ${t('text-lg')};
        font-weight: 600;
      }

      .error {
        width: 100%;
        max-width: var(--app-content-max-width);
        margin: 0 auto;
        padding: 0 1rem;
      }

      .error-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.5rem;
      }

      .composer {
        padding: 0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom));
        border-top: 1px solid ${t('border')};
        background-color: ${t('background')};
      }

      /* ---------------------------------------------------- small screens */
      @media (max-width: 59.99rem) {
        aside {
          position: absolute;
          inset: 0;
          z-index: 2;
          flex-basis: auto;
          border-right: 0;
        }
      }

      @media (max-width: 30rem) {
        .header-meta sea-badge {
          display: none;
        }
      }
    `,
  ];

  constructor() {
    super();
    const { config, hasSavedCredentials } = loadInitialConfig();
    /** @type {ChatConfig} */
    this.config = config;
    /** @type {UiMessage[]} */
    this.messages = config.persistHistory ? loadHistory() : [];
    this.loading = false;
    this.error = '';
    /** @type {'saved' | 'unsaved' | 'empty'} */
    this.credentialsStatus = hasSavedCredentials ? 'saved' : 'empty';
    const wide = globalThis.matchMedia?.(WIDE_LAYOUT_QUERY).matches ?? true;
    // Open the settings on wide screens, or when nothing is configured yet.
    this.settingsOpen = wide || !hasSavedCredentials;
    /** @type {AbortController | null} */
    this._abortController = null;
  }

  disconnectedCallback() {
    this._abortController?.abort();
    super.disconnectedCallback();
  }

  get _provider() {
    return getProvider(this.config.provider) ?? PROVIDERS[0];
  }

  get _providerCredentials() {
    return this.config.credentials[this.config.provider] ?? {};
  }

  /* ---------------------------------------------------------- settings */

  _onConfigChange(event) {
    const previous = this.config;
    /** @type {ChatConfig} */
    const config = event.detail.config;
    this.config = config;

    saveSettings({
      provider: config.provider,
      stream: config.stream,
      persistHistory: config.persistHistory,
      persistence: config.persistence,
    });

    if (
      config.credentials !== previous.credentials ||
      config.persistence !== previous.persistence
    ) {
      this.credentialsStatus = 'unsaved';
    }

    if (config.persistHistory !== previous.persistHistory) {
      if (config.persistHistory) this._persistHistory();
      else clearHistory();
    }
  }

  _onSaveCredentials() {
    const ok = saveCredentials(this.config.credentials, {
      persistence: this.config.persistence,
    });
    if (ok) {
      this.credentialsStatus = 'saved';
      this.error = '';
    } else {
      this.error =
        'Could not save credentials: browser storage is unavailable or full.';
    }
  }

  _onClearCredentials() {
    clearCredentials();
    const { credentials } = this.config;
    const cleared = Object.fromEntries(
      Object.entries(credentials).map(([id, value]) => [
        id,
        { ...value, apiKey: '' },
      ]),
    );
    this.config = { ...this.config, credentials: cleared };
    this.credentialsStatus = 'empty';
  }

  _toggleSettings() {
    this.settingsOpen = !this.settingsOpen;
  }

  /* ------------------------------------------------------------- chat */

  /** Starts a new conversation (and removes the persisted copy). */
  newChat() {
    this._abortController?.abort();
    this.messages = [];
    this.error = '';
    clearHistory();
    this.updateComplete.then(() =>
      this.renderRoot.querySelector('chat-composer')?.focus(),
    );
  }

  _persistHistory() {
    if (!this.config.persistHistory) return;
    const finished = this.messages.filter(
      message => !message.pending && message.content,
    );
    saveHistory(finished);
  }

  /**
   * @param {string} id
   * @param {(message: UiMessage) => UiMessage} update
   */
  _updateMessage(id, update) {
    this.messages = this.messages.map(message =>
      message.id === id ? update(message) : message,
    );
  }

  /**
   * Handles `send-message` from the composer.
   *
   * @param {CustomEvent<{ text: string }>} event
   */
  async _onSendMessage(event) {
    if (this.loading) {
      event.preventDefault();
      return;
    }

    const provider = this._provider;
    const { stream } = this.config;
    const { apiKey = '', baseUrl = '', model = '' } = this._providerCredentials;

    /** @type {UiMessage} */
    const userMessage = {
      id: createId(),
      role: 'user',
      content: event.detail.text,
    };
    const history = [...this.messages, userMessage]
      .filter(message => !message.pending && message.content)
      .map(({ role, content }) => ({ role, content }));

    const abortController = new AbortController();
    let result;
    try {
      const client = createChatClient(provider.id, { apiKey, baseUrl });
      result = client.chat({
        model,
        messages: history,
        stream,
        signal: abortController.signal,
      });
    } catch (error) {
      // Validation errors (missing key, model, …): keep the draft in the input.
      event.preventDefault();
      this.error = error.message;
      if (!this.settingsOpen) this.settingsOpen = true;
      return;
    }

    /** @type {UiMessage} */
    const assistantMessage = {
      id: createId(),
      role: 'assistant',
      content: '',
      pending: true,
    };
    this.messages = [...this.messages, userMessage, assistantMessage];
    this.error = '';
    this.loading = true;
    this._abortController = abortController;
    if (!globalThis.matchMedia?.(WIDE_LAYOUT_QUERY).matches) {
      this.settingsOpen = false;
    }

    try {
      if (stream) {
        for await (const token of /** @type {AsyncIterable<string>} */ (
          result
        )) {
          this._updateMessage(assistantMessage.id, message => ({
            ...message,
            content: message.content + token,
          }));
        }
      } else {
        const content = await /** @type {Promise<string>} */ (result);
        this._updateMessage(assistantMessage.id, message => ({
          ...message,
          content,
        }));
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        this.error = error?.message || 'Something went wrong.';
      }
    } finally {
      this._finishMessage(assistantMessage.id);
      if (this._abortController === abortController) {
        this._abortController = null;
        this.loading = false;
      }
      this._persistHistory();
    }
  }

  /**
   * Marks an assistant message as complete; drops it when nothing arrived.
   *
   * @param {string} id
   */
  _finishMessage(id) {
    this.messages = this.messages
      .map(message =>
        message.id === id ? { ...message, pending: false } : message,
      )
      .filter(message => message.id !== id || message.content);
  }

  _onStopGeneration() {
    this._abortController?.abort();
  }

  _dismissError() {
    this.error = '';
  }

  /* ----------------------------------------------------------- render */

  _renderError() {
    if (!this.error) return nothing;
    return html`
      <div class="error">
        <sea-alert variant="destructive" role="alert">
          <span slot="icon">${alertIcon}</span>
          <span slot="title">
            <span class="error-row">
              Request failed
              <sea-button
                variant="ghost"
                size="icon"
                aria-label="Dismiss error"
                @click=${this._dismissError}
                >${closeIcon}</sea-button
              >
            </span>
          </span>
          ${this.error}
        </sea-alert>
      </div>
    `;
  }

  render() {
    const provider = this._provider;
    const { model } = this._providerCredentials;

    return html`
      <header>
        <div class="header-meta">
          <h1>AI Chat</h1>
          <sea-badge variant="outline" title="Active provider and model">
            ${provider.label}${model ? ` · ${model}` : ''}
          </sea-badge>
        </div>
        <div class="header-actions">
          <sea-button
            class="settings-toggle"
            variant="outline"
            size="sm"
            aria-expanded=${String(this.settingsOpen)}
            aria-controls="settings"
            @click=${this._toggleSettings}
            >${settingsIcon} Settings</sea-button
          >
          <sea-button
            class="new-chat"
            size="sm"
            ?disabled=${!this.messages.length && !this.loading}
            @click=${this.newChat}
            >${plusIcon} New chat</sea-button
          >
        </div>
      </header>

      <div class="progress">
        ${
          this.loading
            ? html`<sea-progress
                aria-label="Generating response"
              ></sea-progress>`
            : nothing
        }
      </div>

      <div class="layout">
        <aside id="settings" ?hidden=${!this.settingsOpen}>
          <credentials-panel
            .config=${this.config}
            .credentialsStatus=${this.credentialsStatus}
            .hasHistory=${this.messages.length > 0}
            @config-change=${this._onConfigChange}
            @save-credentials=${this._onSaveCredentials}
            @clear-credentials=${this._onClearCredentials}
            @clear-history=${this.newChat}
          ></credentials-panel>
        </aside>

        <main>
          <chat-message-list
            .messages=${this.messages}
            .assistantLabel=${provider.label}
          >
            <div slot="empty" class="empty">
              <h2>Start a conversation</h2>
              <p class="muted">
                Pick a provider, enter your API key in Settings and send a
                message. Requests go straight from your browser to
                ${provider.label}.
              </p>
            </div>
          </chat-message-list>

          ${this._renderError()}

          <div class="composer">
            <chat-composer
              ?busy=${this.loading}
              @send-message=${this._onSendMessage}
              @stop-generation=${this._onStopGeneration}
            ></chat-composer>
          </div>
        </main>
      </div>
    `;
  }
}

customElements.define('ai-chat-app', AiChatApp);
