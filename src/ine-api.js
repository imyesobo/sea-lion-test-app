export const API_BASE = 'https://servicios.ine.es/wstempus/js/ES/';
export const PAGE_SIZE = 500;

export function seriesCode(value) {
  const code = String(value).trim().toUpperCase();
  if (!/^[A-Z0-9]{1,40}$/.test(code)) {
    throw new Error(
      'Introduce un código de serie válido, por ejemplo IPC251856.',
    );
  }
  return code;
}

export function seriesUrl(code, periods = 12) {
  if (![1, 12, 24, 60, 120].includes(Number(periods))) {
    throw new Error('Selecciona un número de periodos válido.');
  }
  const url = new URL(`DATOS_SERIE/${seriesCode(code)}`, API_BASE);
  url.search = new URLSearchParams({ nult: periods, tip: 'AM' });
  return url.href;
}

export async function requestJson(
  url,
  { signal, fetcher = fetch, timeout = 20000 } = {},
) {
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(
    () => controller.abort(new DOMException('Timeout', 'TimeoutError')),
    timeout,
  );
  try {
    const response = await fetcher(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      credentials: 'omit',
    });
    if (!response.ok) {
      throw new Error(
        `El INE ha respondido con un error HTTP ${response.status}. Inténtalo de nuevo más tarde.`,
      );
    }
    try {
      return await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;
      throw new Error('El INE no ha devuelto un documento JSON válido.');
    }
  } catch (error) {
    if (signal?.aborted) throw signal.reason;
    if (controller.signal.aborted) {
      throw new Error(
        'El INE tarda demasiado en responder. Vuelve a intentarlo.',
      );
    }
    if (error instanceof TypeError) {
      throw new Error(
        'No se puede conectar con el INE. Comprueba tu conexión. El servicio puede estar temporalmente no disponible o bloquear el acceso desde este navegador (CORS).',
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export async function catalog(kind, id, page = 1, options = {}) {
  const endpoints = {
    operations: 'OPERACIONES_DISPONIBLES',
    tables: 'TABLAS_OPERACION',
    series: 'SERIES_TABLA',
  };
  if (!endpoints[kind] || !Number.isInteger(page) || page < 1) {
    throw new Error('Consulta de catálogo no válida.');
  }
  const path =
    kind === 'operations'
      ? endpoints[kind]
      : `${endpoints[kind]}/${seriesCode(id)}`;
  const url = new URL(path, API_BASE);
  // Only OPERACIONES_DISPONIBLES documents server-side pagination here.
  if (kind === 'operations') url.searchParams.set('page', page);
  const data = await requestJson(url.href, options);
  if (
    !Array.isArray(data) ||
    data.some(
      item =>
        !item ||
        typeof item.Nombre !== 'string' ||
        (kind === 'series'
          ? ![item.COD, item.Codigo].some(
              code => typeof code === 'string' && /^[A-Z0-9]+$/i.test(code),
            )
          : !Number.isInteger(item.Id)),
    )
  ) {
    throw new Error(
      'El catálogo recibido del INE tiene un formato inesperado.',
    );
  }
  return data;
}

export function validateSeries(data) {
  if (
    !data ||
    typeof data.Nombre !== 'string' ||
    !Array.isArray(data.Data) ||
    data.Data.some(
      row =>
        !row ||
        !Object.hasOwn(row, 'Valor') ||
        (row.Valor !== null &&
          !(typeof row.Valor === 'number' && Number.isFinite(row.Valor))) ||
        !Number.isInteger(row.Anyo),
    )
  ) {
    throw new Error('Los datos de la serie tienen un formato inesperado.');
  }
  return data;
}

export async function loadSeries(code, periods, options) {
  return validateSeries(await requestJson(seriesUrl(code, periods), options));
}

export function label(value) {
  if (value === null || value === undefined) return 'No indicado';
  if (typeof value === 'object')
    return String(value.Nombre ?? value.Id ?? 'No indicado');
  return String(value);
}

export function periodLabel(row) {
  return `${label(row.NombrePeriodo ?? row.Periodo ?? row.FK_Periodo)} / ${row.Anyo}`;
}

export function formatValue(value) {
  return value === null
    ? 'No disponible'
    : new Intl.NumberFormat('es-ES', { maximumFractionDigits: 10 }).format(
        value,
      );
}

function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  // Keep text from becoming executable spreadsheet formulas; preserve numbers.
  if (typeof value !== 'number' && /^[\s]*[=+\-@\t\r]/.test(text))
    text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(data, source) {
  const rows = [
    [
      'Serie',
      'Nombre',
      'Periodo',
      'Año',
      'Valor',
      'Unidad',
      'Escala',
      'Tipo de dato',
      'Fuente',
    ],
    ...data.Data.map(row => [
      data.COD,
      data.Nombre,
      label(row.NombrePeriodo ?? row.Periodo ?? row.FK_Periodo),
      row.Anyo,
      row.Valor,
      label(data.Unidad ?? data.FK_Unidad),
      label(data.Escala ?? data.FK_Escala),
      label(row.TipoDato ?? row.FK_TipoDato),
      source,
    ]),
  ];
  return `\uFEFF${rows.map(row => row.map(csvCell).join(';')).join('\r\n')}\r\n`;
}

export function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
