# INE Abierto

A Spanish-language statistics explorer for the **Instituto Nacional de Estadística**
JSON API at `https://servicios.ine.es/wstempus/js/ES/`. Independent project, not
affiliated with the INE. No API key, LLM, account, tracking, or backend is required.
Results come from INE requests, never invented answers or fallback demo data.

## Run

Requires Node.js 22+ and npm.

```sh
npm ci
npm start
```

Open <http://localhost:8000>. Browse operations → tables → series, or enter a
Tempus3 series code (the INE documentation uses `IPC251856`). Select the latest
1, 12, 24, 60, or 120 periods. A period follows the series frequency, not necessarily
a month. Results include units, scale, observation status, and source attribution.

- Catalog filtering is case/accent insensitive and limited to loaded results.
- Operations use the documented `page` parameter (500 results per API page).
- Tables and table series are fetched as complete lists; the UI renders 100 matches
  at a time with a “Mostrar 100 más” button. These endpoints do not document `page`.
- CSV includes source URLs, units, scale, data status, UTF-8 BOM, semicolon separators,
  and spreadsheet-formula protection. Missing values stay blank, not zero.
- JSON preserves the original response, including metadata and missing values.
- Shareable URLs use `?serie=IPC251856&periodos=12`; browser back/forward restores queries.
- Requests time out after 20 seconds. New requests cancel superseded requests,
  stale responses cannot replace current results, and failures have retry actions.

## Components and architecture

Lit 3, native ES modules, npm, Open-WC testing/linting, Modern Web development/test
servers, and Rollup production bundling. Mocha and Chai run in real Chromium via
`@open-wc/testing` and `@web/test-runner`.

**The actual `@yesobo/sea-lion` package is published and used, not a local stub.**
Its public tags are `sea-*`, not the illustrative `sl-*` names in the brief.
All controls and visual surfaces use its buttons, inputs, selects, cards, alerts,
badges, progress indicators, and separators. The published library has no layout,
data-table, or chat-message primitive: layouts use CSS and semantic containers
inside these surfaces; tabular data uses an accessible native table. This is a
statistics explorer rather than an AI chat, so no message bubbles are needed.

The public component contract consumed in `src/components.js`:

| Component       | Public interface used                                                            |
| --------------- | -------------------------------------------------------------------------------- |
| `sea-button`    | `variant`, `size`, `disabled`, `click`                                           |
| `sea-input`     | `label`, `help-text`, `.modelValue`, `model-value-changed`                       |
| `sea-select`    | `label`, `.modelValue`, `model-value-changed`, native `select` in `slot="input"` |
| `sea-card`      | `header`, default, and `footer` slots                                            |
| `sea-alert`     | `variant`, `title` and default slots                                             |
| `sea-badge`     | `variant`, default slot                                                          |
| `sea-progress`  | accessible label, indeterminate progress                                         |
| `sea-separator` | visual divider                                                                   |

Read Lion values from `event.currentTarget.modelValue`, not event detail. Buttons
use explicit click handlers; they are not assumed to submit a shadow-DOM form.
Shared styling uses the library's `--sl-*` theme tokens.

`src/ine-api.js` owns endpoint construction, validation, errors, formatting, and
downloads. `src/ine-app.js` owns navigation, cancellation, and rendering.
Remote text is escaped by Lit; no remote HTML is injected. Credentials are omitted.
Catalog/data payloads are validated; error objects never become empty-success UI.
Numeric unit/scale/type identifiers are displayed unchanged if names are absent.

## Verify

```sh
npx playwright install chromium
npm test
npm run lint
npm run build
npm run preview
```

To use an installed Chrome instead:
`CHROME_PATH=/usr/bin/google-chrome npm test`.
Root/container environments may require `CI=true` to disable Chromium sandboxing
for tests. This does not affect the shipped app.

Tests use explicitly synthetic contract fixtures (never bundled in production)
for catalog browsing, direct queries, accessibility, failure/retry, request races,
query navigation, exports, and API validation. CI runs lint, tests, and build and
uploads the static `dist/` artifact.

## Deploy and live-service verification

Deploy the contents of `dist/` to an HTTPS static host. No Node server is needed in
production. The emitted HTML references hashed local assets; serve HTML with short
caching and hashed assets with long immutable caching. Deploy the entire directory
atomically. Query-string links work without a server rewrite.

Recommended response headers: `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, and
`Permissions-Policy: camera=(), microphone=(), geolocation=()`. If enabling a CSP,
allow `connect-src https://servicios.ine.es`, local module scripts, Lit's component
styles, and `data:` images for the library's select chevron; verify against your
host's policy before rollout.

The browser must be able to resolve and reach INE and the service must permit
cross-origin browser requests. Failures are shown explicitly; there is no public
proxy, hidden demo mode, or `no-cors` workaround. If your deployment origin is
blocked by INE CORS policy, a controlled same-origin proxy is a separate deployment
requirement. Do not route requests through an untrusted public proxy.

**Live-service verification remains required before production rollout:** the
implementation environment could not resolve `servicios.ine.es`. The automated
tests verify documented contracts, not current upstream availability. From the
deployment origin, browse a real operation/table/series, open a direct series URL,
check units and periods against the source JSON, and download CSV/JSON.

API reference: <https://www.ine.es/dyngs/DAB/index.htm?cid=1100>.
This app uses `OPERACIONES_DISPONIBLES`, `TABLAS_OPERACION`, `SERIES_TABLA`, and
**`DATOS_SERIE`** (not `DATA_SERIE`), with `nult` and `tip=AM` for series data.
Preserve INE attribution and follow its current reuse conditions when publishing
derived outputs.
