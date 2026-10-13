// Utilidades para exportar CSV de forma segura.
//
// Los textos de la bitácora pueden venir de usuarios sin autenticar (p. ej. el
// correo de un intento de login fallido). Dos riesgos al abrir el archivo en
// una hoja de cálculo:
//  1. Una comilla sin duplicar rompe la celda y permite inyectar columnas.
//  2. Una celda que empieza con = + - @ (o tab / retorno de carro) puede
//     interpretarse como fórmula.

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\r\n');
}
