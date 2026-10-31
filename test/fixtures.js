// Contract fixtures, not live statistics. Never imported by the application.
export const operations = [
  { Id: 25, Nombre: 'Índice de precios de consumo', Codigo: 'IPC' },
];
export const tables = [
  { Id: 50913, Nombre: 'Índices por comunidades', Codigo: 'N' },
];
export const series = [
  { Id: 1, Nombre: 'Índice general. Nacional.', Codigo: 'IPC251856' },
];
export const data = {
  COD: 'IPC251856',
  Nombre: 'Índice general. Nacional.',
  Unidad: 'Índice',
  Escala: 'Unidades',
  Data: [
    {
      Fecha: 1704067200000,
      Anyo: 2024,
      FK_Periodo: 1,
      NombrePeriodo: 'Enero',
      Valor: 0,
      TipoDato: 'Definitivo',
    },
    {
      Fecha: 1706745600000,
      Anyo: 2024,
      FK_Periodo: 2,
      NombrePeriodo: 'Febrero',
      Valor: null,
      TipoDato: 'No disponible',
    },
    {
      Fecha: 1709251200000,
      Anyo: 2024,
      FK_Periodo: 3,
      NombrePeriodo: 'Marzo',
      Valor: 112.45,
      TipoDato: 'Provisional',
    },
  ],
};

export function mockFetch(url) {
  const path = new URL(url).pathname;
  if (path.includes('OPERACIONES_DISPONIBLES'))
    return Promise.resolve(Response.json(operations));
  if (path.includes('TABLAS_OPERACION'))
    return Promise.resolve(Response.json(tables));
  if (path.includes('SERIES_TABLA'))
    return Promise.resolve(Response.json(series));
  if (path.includes('DATOS_SERIE')) return Promise.resolve(Response.json(data));
  throw new Error(`Unexpected test request: ${url}`);
}
