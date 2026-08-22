// Funciones puras de `autorizacion-mensual` (tasks.md 3.2-3.5, design.md D2/D7). Sin red, sin
// `any`, sin `as`, sin efectos. `Autorizacion.periodoMes` se persiste como `DATE` día-1 absoluto
// en ISO `YYYY-MM-01` (design.md D2): estas funciones son las que garantizan esa forma ANTES de
// que el `CHECK (periodo_mes IS NULL OR EXTRACT(DAY FROM periodo_mes) = 1)` de la base la
// rechace, y las que derivan todo lo demás (ordinal, etiqueta, coherencia con lo facturado) sin
// persistir una segunda fuente de verdad.

// -------------------------------------------------------------------------------------------
// 3.2 — normalizarPeriodoMes
// -------------------------------------------------------------------------------------------

/** Entrada con formato irreconocible para `normalizarPeriodoMes` (3.2). La firma de contrato de
 * design.md D2 declara `normalizarPeriodoMes(valor: string): string` — retorno NO opcional — así
 * que una entrada inválida no puede devolver un string inventado (fabricaría un dato financiero,
 * mismo criterio que D3 para `periodoMes` ausente) ni `undefined` (rompería la firma declarada).
 * Se lanza este error de dominio para que el llamador (formulario `<input type="month">`,
 * mapping) decida cómo mostrarlo. */
export class PeriodoMesInvalidoError extends Error {
  constructor(valor: string) {
    super(`"${valor}" no es un período de mes válido (se espera "YYYY-MM" o "YYYY-MM-DD").`);
    this.name = 'PeriodoMesInvalidoError';
  }
}

const PERIODO_MES_REGEX = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/;

/** `'2026-03'` o `'2026-03-15'` -> `'2026-03-01'` (design.md D2). Es lo que evita que el `CHECK`
 * de día 1 de la base sea la primera línea de defensa: el día se descarta, nunca se valida contra
 * "es realmente el día 1" (`<input type="month">` en D11 nunca produce un día distinto, pero un
 * valor mensual `YYYY-MM` es igual de válido de entrada). Lanza `PeriodoMesInvalidoError` si el
 * formato no matchea o el mes está fuera de 01-12. */
export function normalizarPeriodoMes(valor: string): string {
  const match = PERIODO_MES_REGEX.exec(valor);
  if (match === null) throw new PeriodoMesInvalidoError(valor);

  const [, anio, mes] = match;
  const mesNumero = Number(mes);
  if (mesNumero < 1 || mesNumero > 12) throw new PeriodoMesInvalidoError(valor);

  return `${anio}-${mes}-01`;
}

// -------------------------------------------------------------------------------------------
// 3.3 — ordinalMes
// -------------------------------------------------------------------------------------------

/** Posición 1-based de `periodoMes` entre los períodos CARGADOS de un mismo presupuesto,
 * ordenados ascendentemente por fecha (design.md D2, Decisión 2 — "nunca una columna persistida":
 * un mes salteado no corrompe la secuencia, y una carga fuera de orden se reordena por fecha, no
 * por posición de llegada, RN-PA-02).
 *
 * Decisiones (3.3, no explicitadas letra por letra en design.md):
 * - `periodoMes === undefined` (fila legacy) -> siempre `undefined`: una fila sin mes no tiene
 *   "Mes N" que mostrar.
 * - Las entradas `undefined` de `periodosDelPresupuesto` (otras filas legacy del mismo
 *   presupuesto) NO cuentan para la numeración de las filas con mes: el ordinal es "Mes N" entre
 *   los meses reales, no entre "todas las filas, incluida la que no tiene mes". Consistente con
 *   D10: las legacy se listan aparte, rotuladas "Sin mes cargado", no como "Mes 0" ni corriendo la
 *   numeración de las demás. */
export function ordinalMes(
  periodoMes: string | undefined,
  periodosDelPresupuesto: ReadonlyArray<string | undefined>,
): number | undefined {
  if (periodoMes === undefined) return undefined;

  const periodosConMes = periodosDelPresupuesto.filter(
    (periodo): periodo is string => periodo !== undefined,
  );
  const ordenados = Array.from(new Set(periodosConMes)).sort();
  const indice = ordenados.indexOf(periodoMes);

  return indice === -1 ? undefined : indice + 1;
}

// -------------------------------------------------------------------------------------------
// 3.4 — etiquetaPeriodoMes
// -------------------------------------------------------------------------------------------

const MESES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

/** `'2026-03-01'` -> `'marzo 2026'` (design.md D2, tabla de contrato). `undefined` ->
 * `'Sin mes cargado'`, NUNCA un mes inventado (D2/D3, textual) — mismo criterio que
 * `presupuestos-vigencia-…` usa para vigencia ausente. Este es solo el par "nombre de mes + año";
 * el prefijo "Mes N" que se ve en `PresupuestoDetail` (D10) lo antepone quien llama, combinando
 * esto con `ordinalMes` — no es responsabilidad de esta función. */
export function etiquetaPeriodoMes(periodoMes: string | undefined): string {
  if (periodoMes === undefined) return 'Sin mes cargado';

  const match = PERIODO_MES_REGEX.exec(periodoMes);
  if (match === null) throw new PeriodoMesInvalidoError(periodoMes);

  const [, anio, mes] = match;
  const nombreMes = MESES_ES[Number(mes) - 1];
  return `${nombreMes} ${anio}`;
}

// -------------------------------------------------------------------------------------------
// 3.5 — coincidePeriodoFacturado / validarCoherenciaPeriodo (D7)
// -------------------------------------------------------------------------------------------

export interface CoherenciaPeriodoInput {
  /** `undefined` = autorización legacy sin período (design.md D3). */
  periodoMes: string | undefined;
  /** 1-12, mismo tipo que `Factura.mesFacturado`. */
  mesFacturado: number;
  anioFacturado: number;
}

function partesPeriodoMes(periodoMes: string): { anio: number; mes: number } {
  return { anio: Number(periodoMes.slice(0, 4)), mes: Number(periodoMes.slice(5, 7)) };
}

/** Booleano simple: ¿el mes/año de `periodoMes` coincide con `(mesFacturado, anioFacturado)`?
 * (design.md D2, tabla de contrato — insumo de la preselección de D7: "cuando existe EXACTAMENTE
 * una autorización pendiente cuya `periodoMes` coincide… se preselecciona"). Una autorización
 * legacy (`periodoMes: undefined`) nunca coincide: no hay con qué comparar. */
export function coincidePeriodoFacturado({
  periodoMes,
  mesFacturado,
  anioFacturado,
}: CoherenciaPeriodoInput): boolean {
  if (periodoMes === undefined) return false;

  const { anio, mes } = partesPeriodoMes(periodoMes);
  return mes === mesFacturado && anio === anioFacturado;
}

/** Resultado del aviso de coherencia de D7 — Fase 6b. */
export type CoherenciaPeriodo = 'coincide' | 'no-coincide' | 'legacy-sin-periodo';

// Decisión (3.5): `coincidePeriodoFacturado` respeta la firma booleana de D2 (es el insumo
// "¿preselecciono o no?"), pero D7 exige que el AVISO de coherencia distinga "elegiste un mes que
// no coincide" de "esta fila es de antes de este change y no tiene mes que comparar" — son dos
// situaciones de negocio distintas y un booleano plano las fusionaría en el mismo `false`, dejando
// el mismo mensaje para ambas. Por eso `validarCoherenciaPeriodo` devuelve una unión de 3
// literales en vez de reusar el booleano de arriba.
/** Advertencia NO bloqueante de D7 (Fase 6b): distingue "coincide" / "no coincide" / "legacy sin
 * período" para que la UI muestre un mensaje distinto en cada caso, en el mismo lugar y tono que
 * `validarCupoFacturacion`/`validarMontoAutorizado` ya usan. Nunca bloquea el submit — eso lo
 * decide quien llama, no esta función. */
export function validarCoherenciaPeriodo(input: CoherenciaPeriodoInput): CoherenciaPeriodo {
  if (input.periodoMes === undefined) return 'legacy-sin-periodo';
  return coincidePeriodoFacturado(input) ? 'coincide' : 'no-coincide';
}
