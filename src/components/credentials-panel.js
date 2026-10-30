import { LitElement, html, css, nothing } from 'lit';
import { live } from 'lit/directives/live.js';
import { PROVIDERS, getProvider } from '../services/providers.js';
import { baseStyles, t } from '../styles/shared-styles.js';
import '../sea-lion.js';

/**
 * @typedef {import('../services/storage.js').ProviderCredentials} ProviderCredentials
 *
 * @typedef {object} ChatConfig
 * @property {import('../services/providers.js').ProviderId} provider
 * @property {Record<string, ProviderCredentials>} credentials Per provider id.
 * @property {import('../services/storage.js').Persistence} persistence
 * @property {boolean} stream
 * @property {boolean} persistHistory
 */

/**
 * `<credentials-panel>` – provider selector, credential fields and preferences.
 *
 * Controlled component: it renders `config` and reports every edit through a
 * `config-change` event; the parent owns the state and the persistence.
 *
 * @prop {ChatConfig} config
 * @prop {'saved' | 'unsaved' | 'empty'} credentialsStatus
 * @prop {boolean} hasHistory - enables the "Clear history" button
 * @fires config-change - `detail: { config }` with the updated configuration
 * @fires save-credentials - the user clicked "Save credentials"
 * @fires clear-credentials - the user clicked "Clear credentials"
 * @fires clear-history - the user clicked "Clear history"
 */
export class CredentialsPanel extends LitElement {
  static properties = {
    config: { type: Object },
    credentialsStatus: { type: String, attribute: 'credentials-status' },
    hasHistory: { type: Boolean, attribute: 'has-history' },
  };

  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }

      h2 {
        margin: 0;
        font-size: ${t('text-base')};
        font-weight: 600;
      }

      p {
        margin: 0;
      }

      .fields {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        width: 100%;
      }

      .actions sea-button {
        flex: 1 1 auto;
      }

      .status {
        min-height: 1.25rem;
      }

      .status[data-status='saved'] {
        color: ${t('foreground')};
      }
    `,
  ];

  constructor() {
    super();
    /** @type {ChatConfig} */
    this.config = {
      provider: 'openai',
      credentials: {},
      persistence: 'local',
      stream: true,
      persistHistory: false,
    };
    this.credentialsStatus = 'empty';
    this.hasHistory = false;
  }

  /** @returns {ProviderCredentials} */
  get _current() {
    return this.config.credentials?.[this.config.provider] ?? {};
  }

  /**
   * @param {Partial<ChatConfig>} patch
   */
  _emit(patch) {
    const config = { ...this.config, ...patch };
    this.dispatchEvent(
      new CustomEvent('config-change', {
        detail: { config },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * @param {keyof ProviderCredentials} field
   * @param {string} value
   */
  _updateCredential(field, value) {
    const current = this._current;
    if ((current[field] ?? '') === value) return;
    this._emit({
      credentials: {
        ...this.config.credentials,
        [this.config.provider]: { ...current, [field]: value },
      },
    });
  }

  /**
   * Reads the `modelValue` of the element the listener is attached to. Lion
   * form events bubble, so `event.target` may be a nested control (e.g. a
   * `<sea-radio>` inside the group).
   *
   * @param {Event} event
   * @returns {any}
   */
  static _valueOf(event) {
    return /** @type {any} */ (event.currentTarget).modelValue;
  }

  _onProviderChange(event) {
    const provider = CredentialsPanel._valueOf(event);
    if (getProvider(provider) && provider !== this.config.provider) {
      this._emit({ provider });
    }
  }

  _onPersistenceChange(event) {
    const persistence = CredentialsPanel._valueOf(event);
    if (
      (persistence === 'local' || persistence === 'session') &&
      persistence !== this.config.persistence
    ) {
      this._emit({ persistence });
    }
  }

  /**
   * @param {keyof ProviderCredentials} field
   * @param {Event} event
   */
  _onCredentialInput(field, event) {
    const value = CredentialsPanel._valueOf(event);
    this._updateCredential(field, typeof value === 'string' ? value : '');
  }

  /**
   * @param {'stream' | 'persistHistory'} key
   * @param {Event} event
   */
  _onToggle(key, event) {
    const { checked } = /** @type {any} */ (event.currentTarget);
    if (checked !== this.config[key]) this._emit({ [key]: checked });
  }

  _fire(name) {
    this.dispatchEvent(
      new CustomEvent(name, { bubbles: true, composed: true }),
    );
  }

  _statusText() {
    const where =
      this.config.persistence === 'session' ? 'sessionStorage' : 'localStorage';
    switch (this.credentialsStatus) {
      case 'saved':
        return `Credentials saved in ${where}.`;
      case 'unsaved':
        return 'Unsaved changes – credentials are only kept in memory.';
      default:
        return 'No credentials saved.';
    }
  }

  render() {
    const provider = getProvider(this.config.provider) ?? PROVIDERS[0];
    const current = this._current;

    return html`
      <sea-card>
        <div slot="header">
          <h2>Provider &amp; credentials</h2>
          <p class="muted">
            Stored only in this browser and sent only to the selected provider.
          </p>
        </div>

        <div class="fields">
          <sea-select
            label="Provider"
            name="provider"
            .modelValue=${live(provider.id)}
            @model-value-changed=${this._onProviderChange}
          >
            <select slot="input">
              ${PROVIDERS.map(
                item =>
                  html`<option
                    value=${item.id}
                    ?selected=${item.id === provider.id}
                  >
                    ${item.label}
                  </option>`,
              )}
            </select>
          </sea-select>

          <sea-input
            label="Model"
            name="model"
            autocomplete="off"
            .placeholder=${provider.defaultModel || 'model-name'}
            .modelValue=${live(current.model ?? '')}
            @model-value-changed=${e => this._onCredentialInput('model', e)}
          ></sea-input>

          ${
            provider.acceptsApiKey
              ? html`<sea-input
                  label=${
                    provider.requiresApiKey ? 'API key' : 'API key (optional)'
                  }
                  name="apiKey"
                  type="password"
                  autocomplete="off"
                  .modelValue=${live(current.apiKey ?? '')}
                  @model-value-changed=${e => this._onCredentialInput('apiKey', e)}
                >
                  ${
                    provider.keyUrl
                      ? html`<span slot="help-text"
                          ><a
                            href=${provider.keyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            >Get your ${provider.label} API key</a
                          ></span
                        >`
                      : nothing
                  }
                </sea-input>`
              : nothing
          }
          ${
            provider.acceptsBaseUrl
              ? html`<sea-input
                  label=${
                    provider.requiresBaseUrl
                      ? 'Base URL'
                      : 'Base URL (optional)'
                  }
                  name="baseUrl"
                  type="url"
                  autocomplete="off"
                  .placeholder=${
                    provider.defaultBaseUrl || 'https://example.com/v1'
                  }
                  .modelValue=${live(current.baseUrl ?? '')}
                  @model-value-changed=${e => this._onCredentialInput('baseUrl', e)}
                >
                  <span slot="help-text"
                    >${
                      provider.id === 'ollama'
                        ? html`Start Ollama with
                            <code
                              >OLLAMA_ORIGINS=${window.location.origin}</code
                            >
                            so the browser may call it.
                            <a
                              href=${provider.keyUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              >Download Ollama</a
                            >`
                        : 'Root of an OpenAI-compatible API (…/v1).'
                    }</span
                  >
                </sea-input>`
              : nothing
          }

          <sea-radio-group
            name="persistence"
            label="Remember credentials"
            .modelValue=${live(this.config.persistence)}
            @model-value-changed=${this._onPersistenceChange}
          >
            <sea-radio
              label="This device (localStorage)"
              .choiceValue=${'local'}
              ?checked=${this.config.persistence !== 'session'}
            ></sea-radio>
            <sea-radio
              label="This tab only (sessionStorage)"
              .choiceValue=${'session'}
              ?checked=${this.config.persistence === 'session'}
            ></sea-radio>
          </sea-radio-group>

          <sea-switch
            label="Stream responses"
            name="stream"
            .checked=${live(this.config.stream)}
            @model-value-changed=${e => this._onToggle('stream', e)}
          ></sea-switch>

          <sea-switch
            label="Save chat history"
            name="persistHistory"
            .checked=${live(this.config.persistHistory)}
            @model-value-changed=${e => this._onToggle('persistHistory', e)}
          ></sea-switch>

          <p
            class="status muted"
            role="status"
            data-status=${this.credentialsStatus}
          >
            ${this._statusText()}
          </p>
        </div>

        <div slot="footer" class="actions">
          <sea-button
            class="save"
            @click=${() => this._fire('save-credentials')}
            >Save credentials</sea-button
          >
          <sea-button
            class="clear"
            variant="outline"
            @click=${() => this._fire('clear-credentials')}
            >Clear credentials</sea-button
          >
          <sea-button
            class="clear-history"
            variant="ghost"
            ?disabled=${!this.hasHistory}
            @click=${() => this._fire('clear-history')}
            >Clear history</sea-button
          >
        </div>
      </sea-card>
    `;
  }
}

customElements.define('credentials-panel', CredentialsPanel);
