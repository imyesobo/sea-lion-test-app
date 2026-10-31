import { LitElement, html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import './components.js';
import { appStyles } from './app-styles.js';
import {
  catalog,
  loadSeries,
  seriesCode,
  seriesUrl,
  PAGE_SIZE,
  label,
  periodLabel,
  formatValue,
  toCsv,
  download,
} from './ine-api.js';

const levels = {
  operations: 'Operaciones',
  tables: 'Tablas',
  series: 'Series',
};
const normalize = value =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export class IneApp extends LitElement {
  static styles = appStyles;
  static properties = {
    items: { state: true },
    level: { state: true },
    page: { state: true },
    displayCount: { state: true },
    filter: { state: true },
    operation: { state: true },
    table: { state: true },
    catalogBusy: { state: true },
    catalogError: { state: true },
    code: { state: true },
    periods: { state: true },
    data: { state: true },
    dataBusy: { state: true },
    dataError: { state: true },
    source: { state: true },
    notice: { state: true },
  };

  constructor() {
    super();
    this.items = [];
    this.level = 'operations';
    this.page = 1;
    this.displayCount = 100;
    this.filter = '';
    this.operation = null;
    this.table = null;
    this.code = '';
    this.periods = '12';
    this.data = null;
    this.dataBusy = false;
    this.catalogBusy = false;
    this.catalogError = '';
    this.dataError = '';
    this.source = '';
    this.notice = '';
    this.onNavigation = () => this.restoreQuery();
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('popstate', this.onNavigation);
    this.loadCatalog();
    this.restoreQuery();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('popstate', this.onNavigation);
    this.catalogController?.abort();
    this.dataController?.abort();
  }

  restoreQuery() {
    const params = new URLSearchParams(window.location.search);
    this.code = params.get('serie') ?? '';
    this.periods = params.get('periodos') ?? '12';
    this.dataController?.abort();
    this.data = null;
    this.source = '';
    this.dataError = '';
    this.dataBusy = false;
    if (this.code) this.querySeries(false);
  }

  async loadCatalog() {
    this.catalogController?.abort();
    const controller = new AbortController();
    this.catalogController = controller;
    this.catalogBusy = true;
    this.catalogError = '';
    this.items = [];
    this.displayCount = 100;
    try {
      const id = this.level === 'tables' ? this.operation.Id : this.table?.Id;
      const items = await catalog(this.level, id, this.page, {
        signal: controller.signal,
      });
      if (!controller.signal.aborted) this.items = items;
    } catch (error) {
      if (!controller.signal.aborted) this.catalogError = error.message;
    } finally {
      if (!controller.signal.aborted) this.catalogBusy = false;
    }
  }

  selectItem(item) {
    if (this.level === 'series') {
      this.code = item.COD ?? item.Codigo;
      this.querySeries();
      return;
    }
    if (this.level === 'operations') {
      this.operation = item;
      this.level = 'tables';
    } else {
      this.table = item;
      this.level = 'series';
    }
    this.page = 1;
    this.filter = '';
    this.loadCatalog();
  }

  back() {
    if (this.level === 'series') {
      this.level = 'tables';
      this.table = null;
    } else {
      this.level = 'operations';
      this.operation = null;
    }
    this.page = 1;
    this.filter = '';
    this.loadCatalog();
  }

  changePage(delta) {
    this.page += delta;
    this.loadCatalog();
  }

  async querySeries(updateHistory = true) {
    this.dataController?.abort();
    const controller = new AbortController();
    this.dataController = controller;
    this.data = null;
    this.source = '';
    this.dataError = '';
    this.notice = '';
    this.dataBusy = true;
    try {
      const code = seriesCode(this.code);
      const periods = this.periods;
      const source = seriesUrl(code, periods);
      this.code = code;
      if (updateHistory) {
        const url = new URL(window.location.href);
        url.search = new URLSearchParams({
          serie: code,
          periodos: periods,
        });
        window.history.pushState(null, '', url);
      }
      const data = await loadSeries(code, periods, {
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        this.data = data;
        this.source = source;
        this.loadedCode = code;
        this.loadedPeriods = periods;
        this.loadedAt = new Date().toLocaleString('es-ES');
      }
    } catch (error) {
      if (!controller.signal.aborted) this.dataError = error.message;
    } finally {
      if (!controller.signal.aborted) this.dataBusy = false;
    }
  }

  exportData(format) {
    const filename = `${this.loadedCode}-${this.loadedPeriods}`;
    if (format === 'csv') {
      download(
        toCsv(this.data, this.source),
        `${filename}.csv`,
        'text/csv;charset=utf-8',
      );
    } else {
      download(
        JSON.stringify(this.data, null, 2),
        `${filename}.json`,
        'application/json',
      );
    }
    this.notice = `Descarga ${format.toUpperCase()} preparada.`;
  }

  async share() {
    const url = new URL(window.location.href);
    url.search = new URLSearchParams({
      serie: this.loadedCode,
      periodos: this.loadedPeriods,
    });
    try {
      await navigator.clipboard.writeText(url.href);
      this.notice = 'Enlace copiado al portapapeles.';
    } catch {
      this.notice = `No se pudo copiar automáticamente. Copia este enlace: ${url.href}`;
    }
  }

  renderCatalog() {
    const visible = this.items.filter(item =>
      normalize(
        `${item.Nombre} ${item.Codigo ?? item.COD ?? item.Id}`,
      ).includes(normalize(this.filter)),
    );
    return html`
      <sea-card>
        <div slot="header">
          <span class="eyebrow">01 / Explorar el catálogo</span>
          <h2>${levels[this.level]}</h2>
          <p class="muted">
            ${this.table?.Nombre ?? this.operation?.Nombre ?? 'Encuentra una estadística por su operación.'}
          </p>
        </div>
        <div>
          ${this.level !== 'operations' ? html`<sea-button variant="ghost" size="sm" @click=${this.back}>Volver a ${this.level === 'series' ? 'tablas' : 'operaciones'}</sea-button>` : nothing}
          <sea-input
            label="Filtrar resultados cargados"
            .modelValue=${this.filter}
            @model-value-changed=${event => {
              this.filter = String(event.currentTarget.modelValue ?? '');
            }}
          ></sea-input>
          <div aria-live="polite" role="status">
            ${
              this.catalogBusy
                ? html`<sea-progress
                      aria-label="Cargando catálogo"
                    ></sea-progress>
                    <p>Cargando ${levels[this.level].toLowerCase()}…</p>`
                : nothing
            }
          </div>
          ${this.catalogError ? html`<sea-alert variant="destructive" role="alert"><span slot="title">No se ha podido cargar el catálogo</span>${this.catalogError}</sea-alert><sea-button variant="outline" @click=${this.loadCatalog}>Reintentar catálogo</sea-button>` : nothing}
          ${
            !this.catalogBusy && !this.catalogError
              ? html`
                  <p class="muted">
                    ${visible.length} de ${this.items.length} resultados
                    cargados
                  </p>
                  <div class="catalog-list">
                    ${repeat(
                      visible.slice(0, this.displayCount),
                      item => item.Id ?? item.COD ?? item.Codigo,
                      item =>
                        html` <sea-button
                          variant="outline"
                          @click=${() => this.selectItem(item)}
                        >
                          <span class="item"
                            >${item.Nombre}<small
                              >${item.COD ?? item.Codigo ?? item.Id}</small
                            ></span
                          >
                        </sea-button>`,
                    )}
                  </div>
                  ${
                    visible.length > this.displayCount
                      ? html`<sea-button
                          variant="outline"
                          @click=${() => {
                            this.displayCount += 100;
                          }}
                          >Mostrar 100 más</sea-button
                        >`
                      : nothing
                  }
                  ${!visible.length ? html`<p>No hay resultados${this.filter ? ' para este filtro en esta página' : ''}.</p>` : nothing}
                `
              : nothing
          }
          ${
            this.level === 'operations'
              ? html`<div class="row between">
                    <sea-button
                      size="sm"
                      variant="outline"
                      ?disabled=${this.page === 1 || this.catalogBusy}
                      @click=${() => this.changePage(-1)}
                      >Anterior</sea-button
                    >
                    <span>Página ${this.page}</span>
                    <sea-button
                      size="sm"
                      variant="outline"
                      ?disabled=${this.items.length < PAGE_SIZE || this.catalogBusy}
                      @click=${() => this.changePage(1)}
                      >Siguiente</sea-button
                    >
                  </div>
                  <p class="source muted">
                    El filtro busca en la página actual. Cada página contiene
                    hasta 500 resultados.
                  </p>`
              : nothing
          }
        </div>
      </sea-card>
    `;
  }

  renderResults() {
    if (this.dataBusy)
      return html`<sea-card
        ><div role="status">
          <sea-progress aria-label="Consultando serie"></sea-progress>
          <p>Consultando datos oficiales…</p>
        </div></sea-card
      >`;
    if (this.dataError)
      return html`<sea-card
        ><sea-alert variant="destructive" role="alert"
          ><span slot="title">No se ha podido consultar la serie</span
          >${this.dataError}</sea-alert
        ><sea-button
          slot="footer"
          variant="outline"
          @click=${() => this.querySeries()}
          >Reintentar consulta</sea-button
        ></sea-card
      >`;
    if (!this.data)
      return html`<sea-card
        ><div class="empty">
          <div class="empty-mark" aria-hidden="true">▥</div>
          <h2>De la pregunta al dato</h2>
          <p class="muted">
            Selecciona una operación, una tabla y una serie.<br />También puedes
            introducir un código directamente.
          </p>
          <sea-badge variant="secondary"
            >Sin registro · Sin clave API</sea-badge
          >
        </div></sea-card
      >`;
    const { data } = this;
    const rows = [...data.Data].sort(
      (a, b) =>
        b.Anyo - a.Anyo ||
        Number(b.Fecha ?? b.FK_Periodo) - Number(a.Fecha ?? a.FK_Periodo),
    );
    return html`
      <sea-card>
        <div slot="header">
          <span class="eyebrow">03 / Resultados oficiales</span>
          <h2>${data.Nombre}</h2>
          <sea-badge variant="secondary">${this.loadedCode}</sea-badge>
        </div>
        <div>
          <div class="summary">
            <div>
              <small>Último dato devuelto</small
              ><strong
                >${rows.length ? formatValue(rows[0].Valor) : 'Sin datos'}</strong
              ><small
                >${rows.length ? periodLabel(rows[0]) : 'No hay observaciones'}</small
              >
            </div>
            <div>
              <small>Unidad</small
              ><strong>${label(data.Unidad ?? data.FK_Unidad)}</strong>
            </div>
            <div>
              <small>Escala</small
              ><strong>${label(data.Escala ?? data.FK_Escala)}</strong
              ><small>${rows.length} observaciones</small>
            </div>
          </div>
          <div class="row">
            <sea-button
              variant="outline"
              ?disabled=${!rows.length}
              @click=${() => this.exportData('csv')}
              >Descargar CSV</sea-button
            >
            <sea-button
              variant="outline"
              @click=${() => this.exportData('json')}
              >Descargar JSON</sea-button
            >
            <sea-button variant="ghost" @click=${this.share}
              >Copiar enlace</sea-button
            >
          </div>
          <p role="status" aria-live="polite" class="source">${this.notice}</p>
          ${
            rows.length
              ? html`<div
                  class="table-wrap"
                  tabindex="0"
                  role="region"
                  aria-label="Datos de la serie"
                >
                  <table>
                    <caption>
                      Periodos más recientes primero. Los valores no disponibles
                      no se sustituyen por cero.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Periodo / año</th>
                        <th scope="col">Valor</th>
                        <th scope="col">Tipo de dato</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${rows.map(
                        row =>
                          html`<tr>
                            <td>${periodLabel(row)}</td>
                            <td>${formatValue(row.Valor)}</td>
                            <td>${label(row.TipoDato ?? row.FK_TipoDato)}</td>
                          </tr>`,
                      )}
                    </tbody>
                  </table>
                </div>`
              : html`<sea-alert
                  >No hay observaciones para esta serie y selección de
                  periodos.</sea-alert
                >`
          }
          <sea-separator></sea-separator>
          <p class="source">
            Fuente: Instituto Nacional de Estadística (INE). Consultado:
            ${this.loadedAt}.<br /><a
              href=${this.source}
              target="_blank"
              rel="noopener noreferrer"
              >Ver respuesta original del INE (nueva pestaña)</a
            >
          </p>
          <p class="source muted">
            Las unidades, escalas y tipos se muestran tal como los devuelve el
            INE. Si solo se proporciona un identificador, se conserva sin
            interpretarlo. Los datos pueden estar sujetos a revisión.
          </p>
        </div>
      </sea-card>
    `;
  }

  render() {
    return html`
      <sea-button
        class="skip"
        @click=${() => this.shadowRoot.querySelector('#main').focus()}
        >Saltar al contenido</sea-button
      >
      <header>
        <div class="brand">INE<span> Abierto</span></div>
        <div class="row">
          <span class="muted">Estadísticas para entender nuestro entorno</span
          ><sea-badge variant="outline">Datos públicos</sea-badge>
        </div>
      </header>
      <main id="main" tabindex="-1">
        <section class="hero" aria-labelledby="title">
          <span class="eyebrow">Explorador de estadísticas · España</span>
          <h1>Los datos oficiales,<br />a tu alcance.</h1>
          <p class="muted">
            Explora el catálogo del INE, consulta series temporales y llévate
            los datos que necesitas. Directamente desde la fuente.
          </p>
        </section>
        <div class="workspace">
          ${this.renderCatalog()}
          <div class="stack">
            <sea-card>
              <div slot="header">
                <span class="eyebrow">02 / Consultar una serie</span>
                <h2>¿Ya conoces el código?</h2>
                <p class="muted">
                  Introduce un código Tempus3 o elige una serie del catálogo.
                </p>
              </div>
              <div>
                <sea-input
                  label="Código de serie"
                  help-text="Ejemplo de la documentación del INE: IPC251856"
                  .modelValue=${this.code}
                  @model-value-changed=${event => {
                    this.code = String(event.currentTarget.modelValue ?? '');
                  }}
                  @keydown=${event => {
                    if (event.key === 'Enter' && !this.dataBusy)
                      this.querySeries();
                  }}
                ></sea-input>
                <sea-select
                  label="Últimos periodos"
                  .modelValue=${this.periods}
                  @model-value-changed=${event => {
                    this.periods = String(event.currentTarget.modelValue);
                  }}
                >
                  <select slot="input">
                    <option value="1">Último periodo</option>
                    <option value="12">12 periodos</option>
                    <option value="24">24 periodos</option>
                    <option value="60">60 periodos</option>
                    <option value="120">120 periodos</option>
                  </select>
                </sea-select>
                <p class="source muted">
                  La duración de cada periodo depende de la frecuencia de la
                  serie.
                </p>
              </div>
              <div slot="footer" class="row">
                <sea-button
                  ?disabled=${this.dataBusy || !this.code.trim()}
                  @click=${() => this.querySeries()}
                  >Consultar serie</sea-button
                >
              </div>
            </sea-card>
            <section
              aria-label="Resultados de la consulta"
              aria-busy=${this.dataBusy}
            >
              ${this.renderResults()}
            </section>
          </div>
        </div>
      </main>
      <footer>
        <sea-separator></sea-separator>
        <p>
          Proyecto independiente, no afiliado al INE. Fuente de datos:
          <a
            href="https://www.ine.es/"
            target="_blank"
            rel="noopener noreferrer"
            >Instituto Nacional de Estadística</a
          >.
          <a
            href="https://www.ine.es/dyngs/DAB/index.htm?cid=1100"
            target="_blank"
            rel="noopener noreferrer"
            >Documentación de la API</a
          >.
        </p>
      </footer>
    `;
  }
}

customElements.define('ine-app', IneApp);
