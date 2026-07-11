/**
 * Parser CSV mínimo conforme a RFC 4180: respeta comillas dobles, comas y
 * saltos de línea internos dentro de campos entrecomillados. La TRD de Cotecnova
 * usa saltos de línea internos en la columna `Procedimiento`, por lo que NO se
 * puede dividir por líneas físicas.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Convierte un CSV en un arreglo de objetos usando la primera fila como
 * encabezado. Descarta filas vacías (primera celda en blanco).
 */
export function parseCsvObjects(text) {
  const rows = parseCsv(text);
  const header = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .filter((r) => r.length > 1 && r.some((c) => c.trim() !== ""))
    .map((r) => {
      const obj = {};
      header.forEach((h, i) => {
        obj[h] = (r[i] ?? "").trim();
      });
      return obj;
    });
}
