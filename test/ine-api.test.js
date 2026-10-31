import { expect } from '@open-wc/testing';
import {
  API_BASE,
  catalog,
  loadSeries,
  seriesUrl,
  requestJson,
  validateSeries,
  toCsv,
  formatValue,
  periodLabel,
} from '../src/ine-api.js';
import { data, mockFetch } from './fixtures.js';

async function failure(promise, message) {
  try {
    await promise;
  } catch (error) {
    expect(error.message).to.include(message);
    return;
  }
  throw new Error('Expected request to fail');
}

describe('INE API', () => {
  it('uses DATOS_SERIE, normalized codes, supported periods and friendly metadata', () => {
    expect(seriesUrl(' ipc251856 ', 24)).to.equal(
      `${API_BASE}DATOS_SERIE/IPC251856?nult=24&tip=AM`,
    );
    expect(() => seriesUrl('../bad')).to.throw('código');
    expect(() => seriesUrl('IPC1', 999)).to.throw('periodos');
  });

  it('uses pagination only for endpoints which document it', async () => {
    const urls = [];
    const fetcher = url => {
      urls.push(url);
      return mockFetch(url);
    };
    await catalog('operations', undefined, 2, { fetcher });
    await catalog('tables', 25, 1, { fetcher });
    await catalog('series', 50913, 1, { fetcher });
    expect(urls).to.deep.equal([
      `${API_BASE}OPERACIONES_DISPONIBLES?page=2`,
      `${API_BASE}TABLAS_OPERACION/25`,
      `${API_BASE}SERIES_TABLA/50913`,
    ]);
  });

  it('validates catalogs and series without coercing missing values to zero', async () => {
    expect(
      await loadSeries('IPC251856', 12, { fetcher: mockFetch }),
    ).to.deep.equal(data);
    expect(formatValue(null)).to.equal('No disponible');
    expect(formatValue(0)).to.equal('0');
    expect(periodLabel(data.Data[0])).to.equal('Enero / 2024');
    expect(() =>
      validateSeries({ ...data, Data: [{ Anyo: 2024, Valor: 'NaN' }] }),
    ).to.throw('formato');
    await failure(
      catalog('operations', null, 1, {
        fetcher: async () => Response.json({ error: 'bad' }),
      }),
      'formato',
    );
    await failure(
      catalog('series', 1, 1, {
        fetcher: async () => Response.json([{ Nombre: 'bad', Id: 1 }]),
      }),
      'formato',
    );
  });

  it('accepts genuinely empty catalogs and observations', async () => {
    expect(
      await catalog('operations', null, 1, {
        fetcher: async () => Response.json([]),
      }),
    ).to.deep.equal([]);
    expect(validateSeries({ ...data, Data: [] }).Data).to.deep.equal([]);
  });

  it('surfaces HTTP, JSON, and network failures', async () => {
    await failure(
      requestJson(API_BASE, {
        fetcher: async () => new Response('', { status: 429 }),
      }),
      'HTTP 429',
    );
    await failure(
      requestJson(API_BASE, {
        fetcher: async () => new Response('<html>error</html>'),
      }),
      'JSON',
    );
    await failure(
      requestJson(API_BASE, {
        fetcher: async () => {
          throw new TypeError('Failed to fetch');
        },
      }),
      'conectar',
    );
  });

  it('times out slow requests and preserves caller cancellations', async () => {
    const fetcher = (url, { signal }) =>
      new Promise((resolve, reject) => {
        if (signal.aborted) reject(signal.reason);
        signal.addEventListener('abort', () => reject(signal.reason), {
          once: true,
        });
      });
    await failure(requestJson(API_BASE, { fetcher, timeout: 5 }), 'demasiado');
    const controller = new AbortController();
    const pending = requestJson(API_BASE, {
      fetcher,
      signal: controller.signal,
    });
    controller.abort(new Error('Cancelled by caller'));
    await failure(pending, 'Cancelled by caller');
  });

  it('exports quoted CSV with provenance, nulls, numeric negatives and formula protection', () => {
    const csv = toCsv(
      {
        ...data,
        Nombre: '=HYPERLINK("bad")',
        Data: [...data.Data, { Anyo: 2025, Valor: -2, FK_Periodo: 1 }],
      },
      'https://example.test',
    );
    expect(csv).to.include('"\u0027=HYPERLINK(""bad"")"');
    expect(csv).to.include('"0"');
    expect(csv).to.include('"-2"');
    expect(csv).to.include('"2024";"";');
    expect(csv).to.include('https://example.test');
    expect(csv.startsWith('\uFEFF')).to.equal(true);
  });
});
