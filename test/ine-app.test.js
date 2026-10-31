import {
  expect,
  fixture,
  html,
  waitUntil,
  fixtureCleanup,
} from '@open-wc/testing';
import '../src/ine-app.js';
import { data, operations, mockFetch } from './fixtures.js';

const buttons = app => [...app.shadowRoot.querySelectorAll('sea-button')];
const button = (app, text) =>
  buttons(app).find(item => item.textContent.includes(text));
const ready = app => waitUntil(() => !app.catalogBusy && !app.dataBusy);
const click = async (app, text) => {
  button(app, text).click();
  await ready(app);
  await app.updateComplete;
};

describe('INE explorer', () => {
  let originalFetch;
  let originalUrl;
  beforeEach(() => {
    originalFetch = window.fetch;
    originalUrl = window.location.href;
    window.history.replaceState(null, '', window.location.pathname);
    window.fetch = mockFetch;
  });
  afterEach(() => {
    fixtureCleanup();
    window.fetch = originalFetch;
    window.history.replaceState(null, '', originalUrl);
  });

  it('browses operations, tables, series, and renders accessible results with the real library', async () => {
    const app = await fixture(html`<ine-app></ine-app>`);
    await ready(app);
    await click(app, operations[0].Nombre);
    expect(app.level).to.equal('tables');
    await click(app, 'Índices por comunidades');
    expect(app.level).to.equal('series');
    await click(app, 'Índice general');
    expect(app.data).to.deep.equal(data);
    expect(app.shadowRoot.querySelectorAll('tbody tr').length).to.equal(3);
    expect(app.shadowRoot.textContent).to.include('No disponible');
    expect(window.location.search).to.equal('?serie=IPC251856&periodos=12');
    expect(button(app, 'Descargar CSV')).to.exist;
    await expect(app).to.be.accessible();
  });

  it('supports direct queries using Lion modelValue events and Enter', async () => {
    const app = await fixture(html`<ine-app></ine-app>`);
    await ready(app);
    const input = [...app.shadowRoot.querySelectorAll('sea-input')].find(
      item => item.label === 'Código de serie',
    );
    input.modelValue = 'ipc251856';
    input.dispatchEvent(
      new CustomEvent('model-value-changed', { bubbles: true }),
    );
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    await ready(app);
    expect(app.data.COD).to.equal('IPC251856');
  });

  it('restores shared queries and handles browser back to an empty query', async () => {
    window.history.replaceState(null, '', '?serie=IPC251856&periodos=24');
    const app = await fixture(html`<ine-app></ine-app>`);
    await ready(app);
    expect(app.loadedPeriods).to.equal('24');
    window.history.replaceState(null, '', window.location.pathname);
    window.dispatchEvent(new PopStateEvent('popstate'));
    await app.updateComplete;
    expect(app.data).to.equal(null);
  });

  it('shows catalog failures and retries without fabricated fallback data', async () => {
    window.fetch = async () => {
      throw new TypeError('offline');
    };
    const app = await fixture(html`<ine-app></ine-app>`);
    await ready(app);
    expect(app.catalogError).to.include('conectar');
    expect(app.items).to.deep.equal([]);
    window.fetch = mockFetch;
    await click(app, 'Reintentar catálogo');
    expect(app.items).to.deep.equal(operations);
  });

  it('rejects malformed direct query parameters and handles empty results', async () => {
    window.history.replaceState(null, '', '?serie=IPC1&periodos=999');
    const app = await fixture(html`<ine-app></ine-app>`);
    await ready(app);
    expect(app.dataError).to.include('periodos');
    app.periods = '12';
    window.fetch = async () => Response.json({ ...data, Data: [] });
    await app.querySeries();
    await app.updateComplete;
    expect(app.shadowRoot.textContent).to.include('No hay observaciones');
    expect(button(app, 'Descargar CSV').disabled).to.equal(true);
  });

  it('ignores stale responses and retains the submitted periods for downloads', async () => {
    const app = await fixture(html`<ine-app></ine-app>`);
    await ready(app);
    const responses = [];
    window.fetch = () => new Promise(resolve => responses.push(resolve));
    app.code = 'IPC1';
    const first = app.querySeries();
    app.code = 'IPC2';
    app.periods = '24';
    const second = app.querySeries();
    app.periods = '60';
    responses[1](Response.json({ ...data, COD: 'IPC2' }));
    await second;
    responses[0](Response.json({ ...data, COD: 'IPC1' }));
    await first;
    expect(app.data.COD).to.equal('IPC2');
    expect(app.loadedPeriods).to.equal('24');
  });

  it('filters names without accents and does not render remote markup', async () => {
    const app = await fixture(html`<ine-app></ine-app>`);
    await ready(app);
    app.filter = 'indice';
    await app.updateComplete;
    expect(button(app, operations[0].Nombre)).to.exist;
    app.items = [
      { Id: 5, Nombre: '<img src=x onerror=alert(1)>', Codigo: 'TEST' },
    ];
    app.filter = '';
    await app.updateComplete;
    expect(app.shadowRoot.querySelector('img')).to.equal(null);
    expect(app.shadowRoot.textContent).to.include('<img src=x');
  });

  it('pages operations and progressively renders unpaginated table series', async () => {
    const app = await fixture(html`<ine-app></ine-app>`);
    await ready(app);
    const many = Array.from({ length: 500 }, (_, index) => ({
      Id: index + 1,
      Nombre: `Operation ${index}`,
      Codigo: `OP${index}`,
    }));
    app.items = many;
    await app.updateComplete;
    expect(
      app.shadowRoot.querySelectorAll('.catalog-list sea-button').length,
    ).to.equal(100);
    await click(app, 'Mostrar 100 más');
    expect(
      app.shadowRoot.querySelectorAll('.catalog-list sea-button').length,
    ).to.equal(200);
    let requested;
    window.fetch = async url => {
      requested = url;
      return Response.json([]);
    };
    await click(app, 'Siguiente');
    expect(new URL(requested).searchParams.get('page')).to.equal('2');
    expect(button(app, 'Siguiente').disabled).to.equal(true);
    app.level = 'series';
    app.items = many;
    await app.updateComplete;
    expect(button(app, 'Siguiente')).to.equal(undefined);
  });

  it('ignores stale catalog responses after navigating back', async () => {
    const app = await fixture(html`<ine-app></ine-app>`);
    await ready(app);
    let resolveTables;
    window.fetch = url =>
      String(url).includes('TABLAS_OPERACION')
        ? new Promise(resolve => {
            resolveTables = resolve;
          })
        : mockFetch(url);
    app.selectItem(operations[0]);
    app.back();
    await ready(app);
    resolveTables(Response.json([{ Id: 8, Nombre: 'Stale table' }]));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(app.level).to.equal('operations');
    expect(app.items).to.deep.equal(operations);
  });

  it('provides a functional keyboard skip control', async () => {
    const app = await fixture(html`<ine-app></ine-app>`);
    await ready(app);
    await click(app, 'Saltar al contenido');
    expect(app.shadowRoot.activeElement.id).to.equal('main');
  });
});
