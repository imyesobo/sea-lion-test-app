# sea-lion-test-app — AI Chat

A client-side-only chat app for talking to AI providers straight from your
browser. It is built with [Lit](https://lit.dev) and the
[`@yesobo/sea-lion`](https://www.npmjs.com/package/@yesobo/sea-lion) web
components library, and follows the [Open Web Components](https://open-wc.org)
and [Modern Web](https://modern-web.dev) recommendations.

- Supported providers: **OpenAI**, **Anthropic**, **Google Gemini**, **xAI Grok**,
  a **local Ollama** server and any **OpenAI-compatible endpoint** (LM Studio,
  vLLM, OpenRouter, Groq, …).
- Answers can be streamed token by token (SSE / NDJSON over `fetch` +
  `ReadableStream`) or returned in one piece. While an answer streams you'll see
  a typing indicator and a **Stop** button.
- Credentials are kept in `localStorage` or `sessionStorage` (your choice).
  Chat history can optionally be persisted too.
- The layout is responsive: on narrow screens the settings panel becomes an
  overlay.
- There is no backend. The app is a static front-end with native ES modules
  and no build step during development.

## Getting started

Requirements: Node.js 20+ and npm.

```bash
npm i
npm start
```

`npm start` runs [`@web/dev-server`](https://modern-web.dev/docs/dev-server/overview/)
and opens the app at <http://localhost:8000>.

### Scripts

| Command               | What it does                                                                     |
| --------------------- | -------------------------------------------------------------------------------- |
| `npm start`           | Buildless dev server (`@web/dev-server`) with node-resolve and file watching     |
| `npm test`            | Unit tests with `@web/test-runner` + Mocha + Chai (headless Chrome) and coverage |
| `npm run test:watch`  | Same tests in watch mode                                                         |
| `npm run lint`        | ESLint (`@open-wc/eslint-config` + `eslint-plugin-lit`) and a Prettier check     |
| `npm run format`      | Auto-fixes ESLint issues and formats everything with Prettier                    |
| `npm run build`       | Optional production bundle in `dist/` (Rollup, minified, hashed)                 |
| `npm run start:build` | Serves the production bundle from `dist/`                                        |
| `npm run analyze`     | Generates `custom-elements.json` for the app's components                        |

The tests need a local Chrome/Chromium. `@web/test-runner-chrome` detects it
automatically.

## Using the app

1. Open **Settings** (it is already open on wide screens and on first use).
2. Pick a **Provider**. Only the fields that provider needs are shown:

   | Provider                   | API key  | Base URL                                   | Default model       |
   | -------------------------- | -------- | ------------------------------------------ | ------------------- |
   | OpenAI                     | required | –                                          | `gpt-4o-mini`       |
   | Anthropic                  | required | –                                          | `claude-sonnet-4-5` |
   | Google Gemini              | required | –                                          | `gemini-2.5-flash`  |
   | xAI Grok                   | required | –                                          | `grok-4`            |
   | Ollama (local)             | –        | optional (`http://localhost:11434`)        | `llama3.2`          |
   | Custom (OpenAI-compatible) | optional | required (e.g. `http://localhost:1234/v1`) | –                   |

3. Enter the API key (and the model / base URL if needed).
4. Choose where to **remember credentials**:
   - **This device (localStorage)** keeps them until you clear them.
   - **This tab only (sessionStorage)** forgets them when the tab closes.
5. Click **Save credentials**. If you don't save, the values you typed still
   work, but only until you reload the page.
6. Type a message and press **Enter** (**Shift + Enter** adds a new line), or
   click the send button.

Other actions:

- **Clear credentials** wipes the API keys from memory and from both storage
  areas. Model names and base URLs are kept.
- **Stream responses** switches between streaming and single-response mode.
- **Save chat history** stores the conversation in `localStorage` so it
  survives a reload. Turning it off deletes the stored copy.
- **New chat** (header) and **Clear history** (settings) clear the current
  conversation and any stored history.
- Errors such as an invalid key, rate limits, network/CORS failures or a wrong
  model name appear in a dismissible alert above the input. If validation
  fails (for example, a missing key), your message stays in the input.

Non-secret preferences are saved automatically to `localStorage`: the selected
provider, streaming, history and storage choice.

### Getting an API key

- **OpenAI**: <https://platform.openai.com/api-keys>
- **Anthropic**: <https://console.anthropic.com/settings/keys>. Browser calls
  send the `anthropic-dangerous-direct-browser-access: true` header, which
  Anthropic requires for CORS.
- **Google Gemini**: <https://aistudio.google.com/app/apikey>. The key is sent in
  the `x-goog-api-key` header, never in the URL.
- **xAI Grok**: <https://console.x.ai>
- **Ollama**: no key. [Install Ollama](https://ollama.com/download), pull a
  model (`ollama pull llama3.2`) and allow the app's origin:

  ```bash
  OLLAMA_ORIGINS=http://localhost:8000 ollama serve
  ```

- **Custom endpoint**: any server exposing `POST {baseUrl}/chat/completions` in
  the OpenAI format. The key is optional and is sent as a bearer token. The
  server must allow CORS from the app's origin.

### Local endpoints that do not send CORS headers

Many local servers answer `curl` on the same machine but send no
`Access-Control-Allow-Origin`, so the browser blocks the request and the app
reports _"Could not reach …"_. Two ways to fix it:

1. **Let the server answer for this origin** (preferred, no moving parts). For
   [llama.cpp](https://github.com/ggml-org/llama.cpp) pass
   `--cors-origins http://localhost:8000`; for a Strata `serve` server add
   `"cors_origins": ["http://localhost:8000"]` to its launch config; for Ollama
   start with `OLLAMA_ORIGINS=http://localhost:8000`. Restart the server.
2. **Proxy it through the dev server** (works without touching the server, and
   without restarting a model that takes minutes to load). `dev/api-proxy.mjs`
   mirrors the endpoint under the app's own origin, which makes the request
   same-origin and CORS irrelevant:

   ```text
   browser → http://localhost:8000/v1/chat/completions
           → http://127.0.0.1:8080/v1/chat/completions
   ```

   The upstream is `http://127.0.0.1:8080/v1` by default; change it with
   `UPSTREAM_API=http://127.0.0.1:1234/v1 npm start` or disable it with
   `UPSTREAM_API= npm start`. Then choose **Custom (OpenAI-compatible)** in the
   app and set the base URL to `http://localhost:8000/v1` — the dev server's own
   origin, not the upstream's.

   The proxy forwards `/v1/*` only (streaming included) and nothing else; it is
   part of the dev server config, so a production build never includes it.

## Security: keys stay in your browser

- Nothing passes through a backend you or this project control. Each request
  goes **directly from your browser to the selected provider** using `fetch`.
- Keys are stored only if you click **Save credentials**, and only in Web
  Storage on your device (`localStorage` or `sessionStorage`). **Clear
  credentials** removes them.
- `index.html` sets `<meta name="referrer" content="no-referrer">`. Model
  output is always rendered as **plain text**, never as HTML.
- Web Storage is readable by any script running on the same origin. Use your
  own keys, prefer **This tab only** on shared machines, use provider-side
  spending limits / scoped keys, and host the app on an origin you trust.

## Architecture

```
├── index.html                 # entry point: loads sea-lion tokens + <ai-chat-app>
├── src/
│   ├── ai-chat-app.js         # root component: state, persistence, send/stream/abort flow
│   ├── sea-lion.js            # registers the @yesobo/sea-lion elements the app uses
│   ├── components/
│   │   ├── chat-message.js       # <chat-message> bubble (plain text, typing indicator)
│   │   ├── chat-message-list.js  # <chat-message-list> role="log", auto-scroll
│   │   ├── chat-composer.js      # <chat-composer> textarea + send/stop button
│   │   └── credentials-panel.js  # <credentials-panel> provider, keys, storage, toggles
│   ├── services/
│   │   ├── providers.js       # provider metadata (fields, defaults, key URLs)
│   │   ├── ai-client.js       # createChatClient(providerId, options) factory
│   │   ├── clients/           # one thin client per provider API
│   │   │   ├── chat-client.js     # base class: validation, fetch, errors, streaming
│   │   │   ├── openai-client.js   # OpenAI, xAI, generic OpenAI-compatible
│   │   │   ├── anthropic-client.js
│   │   │   ├── gemini-client.js
│   │   │   └── ollama-client.js
│   │   ├── streams.js         # ReadableStream → lines / SSE events / NDJSON
│   │   ├── errors.js          # ProviderError + readable HTTP/network errors
│   │   └── storage.js         # credentials / settings / history in Web Storage
│   └── styles/                # shared styles (sea-lion design tokens) and icons
├── test/                      # Mocha + Chai tests (@open-wc/testing)
├── web-dev-server.config.mjs
├── web-test-runner.config.mjs
├── rollup.config.mjs          # optional production build
├── eslint.config.js
└── .prettierrc
```

**Data flow.** `<ai-chat-app>` holds the state: config, messages, loading and
error. Child components are controlled. They receive properties and report
user intent through events (`config-change`, `save-credentials`,
`send-message`, `stop-generation`, …). On `send-message` the root creates a
client with `createChatClient()`, appends the user message plus a pending
assistant message, then fills in the assistant message as tokens arrive. An
`AbortController` powers the Stop button.

**Provider clients.** Every client extends `ChatClient` and exposes a single
method:

```js
import { createChatClient } from './src/services/ai-client.js';

const client = createChatClient('openai', { apiKey, baseUrl /* optional */ });

// Full response
const text = await client.chat({ model: 'gpt-4o-mini', messages });

// Streaming: async iterable of text tokens
for await (const token of client.chat({
  model,
  messages,
  stream: true,
  signal,
})) {
  console.log(token);
}
```

`chat()` validates the request synchronously (missing key, model or messages)
and throws a `ProviderError`. HTTP, network/CORS and in-stream errors are
turned into a `ProviderError` with a readable message and `status`.
`AbortError` is passed through untouched. Subclasses only override the
template methods `_endpoint`, `_headers`, `_body`, `_parseCompletion` and
`_parseStream`. Pass `{ fetch }` to the constructor to inject a custom fetch,
which the tests do.

## About `@yesobo/sea-lion`

The UI is built only with `@yesobo/sea-lion` components. Version `1.0.1` is
published on npm, so this project uses **the real package** and needs no stub.
It is a shadcn-styled set of Lit/Lion web components with the `sea-` prefix:

| Element                           | Used for                                     | API used                                                                          |
| --------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------- |
| `<sea-button>`                    | send / stop, settings, new chat, save, clear | `variant`, `size`, `disabled`, `click`                                            |
| `<sea-input>`                     | model, API key, base URL                     | `label`, `help-text`, `type`, `placeholder`, `.modelValue`, `model-value-changed` |
| `<sea-textarea>`                  | message composer                             | `label-sr-only`, `rows`, `max-rows`, `.modelValue`                                |
| `<sea-select>`                    | provider picker (wraps a native `<select>`)  | `slot="input"`, `.modelValue`                                                     |
| `<sea-radio-group>`/`<sea-radio>` | localStorage vs sessionStorage               | `.choiceValue`, group `.modelValue`                                               |
| `<sea-switch>`                    | streaming, save history                      | `label`, `.checked`, `model-value-changed`                                        |
| `<sea-card>`                      | settings panel                               | `header`, default and `footer` slots                                              |
| `<sea-badge>`                     | message author, active provider              | `variant`                                                                         |
| `<sea-alert>`                     | error messages                               | `variant="destructive"`, `icon`, `title` and default slots                        |
| `<sea-progress>`                  | loading bar                                  | no `value` (indeterminate)                                                        |

Design tokens come from `@yesobo/sea-lion/src/tokens/tokens.css`, linked in
`index.html`. Component styles use them through the library's `t()` helper,
re-exported by `src/styles/shared-styles.js`. The library has no chat bubble
component, so `<chat-message>` is built in this app on top of `<sea-badge>`
and the sea-lion tokens.

### Updating or swapping the library

All registrations live in [`src/sea-lion.js`](src/sea-lion.js).

- **New version:** `npm i @yesobo/sea-lion@latest`.
- **Local checkout or fork:** run `npm i ../path/to/sea-lion` or
  `npm i github:<owner>/<repo>`.
- **All elements:** replace the per-component imports with
  `import '@yesobo/sea-lion/define.js';`.

If a future version renames or removes an element, only `src/sea-lion.js` and
the templates that use that tag need to change.

## Testing

```bash
npm test
```

The tests use `@open-wc/testing`, which bundles Mocha, Chai, `fixture()` and
an a11y helper. They run in a real browser through `@web/test-runner`, and
`fetch` is mocked so they never hit the network.

| File                            | Covers                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| `test/storage.test.js`          | credentials local/session switching, clearing, corrupted data, settings, history      |
| `test/streams.test.js`          | line splitting, SSE parsing across chunk boundaries, NDJSON                           |
| `test/openai-client.test.js`    | headers/body, non-streaming, streaming, HTTP/stream/network errors, abort, validation |
| `test/provider-clients.test.js` | Anthropic, Gemini and Ollama request/response shapes and streaming, client factory    |
| `test/chat-components.test.js`  | `<chat-message>` rendering and a11y, `<chat-composer>` Enter/Shift+Enter/button/stop  |
| `test/ai-chat-app.test.js`      | validation errors, streaming into the list, provider errors, history restore/clear    |
