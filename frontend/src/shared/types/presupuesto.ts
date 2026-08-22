// Tipos del dominio de Presupuestos y Autorizaciones (US-200, RF-200 a RF-205,
// knowledge-base/04_modelo_de_datos.md §Presupuesto/Autorizacion). Insumo de Facturación (FE-6):
// el cupo mensual autorizado (días/km) es la base del control de facturación (RN-PA-03, RN-FA-02).
// Contrato "tipos primero" (ver design.md de presupuestos-ui) — cuando el backend real (C-06) se
// archive, estos tipos no deberían necesitar reescritura.
//
// Cruce docx (docs/core/Traslados-Modelo-Datos.docx §Facturación) + KB, con 2 discrepancias de
// impacto backend documentadas en design.md ("⚠️ Discrepancias con Traslados-Modelo-Datos.docx",
// Decisiones 4 y 5): `montoAutorizado` y `vigenciaDesde` en `Autorizacion` son campos que el
// frontend agrega sobre el docx (que no los tiene) para poder validar RN-PA-01 y RN-PA-02 en UI —
// quedan opcionales y señalizados con `AvisoModeloDatos` en las pantallas correspondientes.
//
// `presupuestos-vigencia-datos-traslado-vista-previa` (design.md §Discrepancias, 5 entradas
// nuevas): `Presupuesto.vigenciaDesde/vigenciaHasta`, `conDependencia` (en ambas entidades),
// `datosTraslado` (bloque de 10 columnas) y `ArchivoAdjunto.tipoMime` tampoco están en el docx.
// Mismo criterio que arriba: opcionales, señalizados con `AvisoModeloDatos`.

import type { DiaSemana } from './recorridoHabitual';

/** Unión cerrada de estados de una autorización (US-200). Nunca `string` libre. */
export type EstadoAutorizacion = 'pendiente' | 'autorizada' | 'judicializada' | 'rechazada';

/**
 * Referencia a un único archivo adjunto (design.md Decisión 3, Discrepancia 1): el docx modela
 * un solo "Archivo" por Presupuesto y por Autorización, NO una colección multi-documento — por
 * eso NO se reutiliza `DocumentChecklist` (multi-doc) ni se extiende `EntidadDocumental`
 * (`documento.ts`). La subida real a storage es responsabilidad del backend; acá es solo la
 * referencia (nombre + fecha de carga).
 */
export interface ArchivoAdjunto {
  nombre: string;
  /** ISO date en que se cargó el archivo. */
  cargadoEn: string;
  /**
   * Clave del objeto dentro del bucket de Storage (`{entidadId}/{uuid}-{nombreSeguro}`,
   * integracion-documentos-autorizaciones design.md D5) — necesaria para borrar el objeto viejo al
   * reemplazar o quitar el archivo. Opcional (no `clave: string` a secas, desviación documentada
   * respecto a tasks.md 3.3): `ArchivoAdjunto` es compartido con `Presupuesto`, cuyo flujo de carga
   * real de archivo sigue fuera de alcance de este change — `archivo_url` de Presupuesto todavía
   * guarda una URL, no una clave de bucket (`mapArchivoUrl`/`PresupuestoForm.tsx` no tienen de dónde
   * sacar una `clave` real hoy). Volverlo obligatorio hubiera forzado inventar un valor ahí, mismo
   * antipatrón que el proyecto ya viene corrigiendo. Para `Autorizacion` (este change) siempre viene
   * poblada cuando hay archivo (ver `autorizacionMapping.parseArchivo`).
   */
  clave?: string;
  /**
   * Tipo MIME del archivo (`presupuestos-vigencia-datos-traslado-vista-previa` design.md D6c,
   * Discrepancia 5 — ausente del docx). Poblado desde `File.type` en `uploadArchivo` en el momento
   * de subir (dato exacto, no inferido). `undefined` en filas subidas antes del 2026-08-18 (el
   * bucket `documentos-autorizaciones` está vivo desde esa fecha) o en `Presupuesto` (cuyo `archivo`
   * sigue sin flujo real de subida, ver comentario de `clave` arriba): esas filas usan un fallback
   * por extensión SOLO en la vista previa (`VistaPreviaArchivo`, D6 "Fallback acotado"), nunca
   * reconstruido acá.
   */
  tipoMime?: string;
}

/**
 * Línea de desglose de un presupuesto de modalidad `general` (REAPERTURA #13, decisión explícita
 * de la usuaria 2026-08-16 — el brief de `facturacion-cambios-ui` WU1 pide persistir el desglose
 * que antes vivía solo en el estado del formulario; documentado en
 * `knowledge-base/04_modelo_de_datos.md` §Discrepancias y CHANGES.md con ⚠️). Se persiste en
 * `facturacion.presupuesto_linea` (migración `20260816110000_presupuesto_lineas.sql`), insertada
 * en la MISMA transacción que el presupuesto por sus RPC (código de error nuevo 45404 para líneas
 * malformadas).
 */
export interface PresupuestoLinea {
  /** Id de la fila real de `facturacion.presupuesto_linea`. En el payload de alta el id local
   * del formulario NO viaja: el mapping lo descarta (ver `presupuestoMapping.ts` 2.7). */
  id: string;
  /** Referencia por id a `pacientes.prestaciones`; el nombre se resuelve client-side (idem
   * `prestacionId`). */
  prestacionId: string;
  /** Importe de la línea, NUMERIC(10,2) en la base. */
  monto: number;
  /** Posición de la línea dentro del desglose (SMALLINT, default 0). */
  orden: number;
}

/**
 * Bloque de datos del formulario de traslado presentado a la obra social
 * (`presupuestos-vigencia-datos-traslado-vista-previa` design.md D2, Discrepancia 4 — ausente del
 * docx). Declaración CONGELADA al momento del presupuesto — NO una referencia viva a
 * `RecorridoHabitual` (`pacientes.recorridos`, RF-110): esa tabla es el estado ACTUAL del paciente y
 * cambia cuando el paciente cambia de escuela; este bloque es lo que se presentó y quedó autorizado
 * en una fecha, y no debe reescribirse retroactivamente (D2, motivo 1). Se reusa el tipo escalar
 * `DiaSemana` de `recorridoHabitual.ts` — la unión cerrada de 7 valores es el mismo concepto en los
 * dos dominios — pero NUNCA la entidad `RecorridoHabitual` ni sus filas: "no compartir tipos entre
 * los dos dominios" ya está escrito ahí (`recorridoHabitual.ts:1-12`), sería la tercera vez que el
 * repo rompe esa regla (D2, motivo 4).
 */
export interface DatosTraslado {
  /** Origen/destino del tramo de ida, texto declarado en el formulario — no una FK a
   * `Paciente.direcciones` (D2, motivo 3): puede no corresponder a ninguna dirección vigente, y el
   * paciente puede mudarse sin que el presupuesto ya presentado cambie. */
  origenIda?: string;
  destinoIda?: string;
  /**
   * Origen/destino del tramo de vuelta. `undefined` cuando el traslado no tiene tramo de vuelta —
   * junto con `kmVuelta`, es la señal que deriva `tieneVuelta` en `calculoViajes.ts` (D4); no hay
   * columna booleana aparte para eso.
   */
  origenVuelta?: string;
  destinoVuelta?: string;
  /** Formato `'HH:MM'`, mismo criterio que `RecorridoHabitual.hora` (D2). */
  horarioEntrada?: string;
  horarioSalida?: string;
  /** Kilómetros de ida/vuelta, carga manual (KB `04_modelo_de_datos.md:107`: "nomenclador, carga
   * manual"). Este change guarda `conDependencia` como booleano y deja el km manual — NO automatiza
   * su valor según CD/SD (Open Question 1, D3). */
  kmIda?: number;
  kmVuelta?: number;
  /**
   * Conjunto de días de la semana (`DiaSemana[]`, unión reusada de `recorridoHabitual.ts`, nunca la
   * entidad). Requerido (no opcional en esta interfaz) porque la columna real es
   * `TEXT[] NOT NULL DEFAULT '{}'`: "sin días cargados" se expresa como `[]`, nunca como
   * `undefined`.
   */
  diasSemana: DiaSemana[];
  /**
   * Días mensuales NEGOCIADOS con la obra social, tal como figuran en el formulario — NO "días
   * hábiles del mes" calculados (D2): derivarlo del calendario sería inventar el dato. Insumo de
   * `calcularViajesMensuales`/`calcularKmMensuales` (`calculoViajes.ts`, D4), que se derivan en vivo
   * y NUNCA se persisten (`viajesMensuales` deliberadamente no tiene columna).
   */
  diasMensuales?: number;
}

export interface Presupuesto {
  id: string;
  /** Referencia por id al paciente (FE-3), nunca embebido. */
  pacienteId: string;
  /** Referencia por id a la obra social (FE-2) a la que se dirige el presupuesto, nunca embebida. */
  obraSocialId: string;
  /** Importe único propuesto (docx: `Monto`). NO es un desglose por prestación (design.md Discrepancia 4).
   * Agregar `prestacionId` (PR 2 de `presupuesto-prestaciones`) NO cambia esto: `monto` sigue siendo
   * un único valor numérico en las dos modalidades (KB discrepancia #13, no reabierta — design.md D5). */
  monto: number;
  /** ISO date. */
  fechaEmision: string;
  archivo?: ArchivoAdjunto;
  /**
   * Referencia opcional a `pacientes.prestaciones` (`presupuesto-prestaciones`, design.md D1/D5/D9).
   * Poblado únicamente cuando la obra social del presupuesto tiene `modalidadFacturacion ===
   * 'por-prestacion'` (un presupuesto por prestación, alta vía `createLote`). En modalidad `general`
   * queda SIEMPRE `undefined` — el desglose por prestación de esa modalidad vive en `lineas`.
   */
  prestacionId?: string;
  /**
   * Desglose por prestación de la modalidad `general` (REAPERTURA #13, decisión usuaria
   * 2026-08-16): persistido en `facturacion.presupuesto_linea` desde la migración
   * `20260816110000_presupuesto_lineas.sql`. Ausente (`undefined`) en presupuestos de modalidad
   * `por-prestacion` y en presupuestos viejos creados sin desglose — `lineas: []` explícito solo
   * se produce cuando la EF así lo devuelve.
   */
  lineas?: PresupuestoLinea[];
  /**
   * Período que cubre el presupuesto (`presupuestos-vigencia-datos-traslado-vista-previa`
   * design.md D1, Discrepancia 1 — el docx solo tiene `Monto` + `Archivo`). Separado de
   * `fechaEmision` a propósito: es el malentendido que originó el pedido, un presupuesto puede
   * emitirse el 30/12 y valer recién desde febrero. Vive en `presupuesto`, nunca en
   * `presupuesto_linea` (D1, los 5 motivos). `AvisoModeloDatos` en `PresupuestoForm`/
   * `PresupuestoDetail`.
   */
  vigenciaDesde?: string;
  /** Ver `vigenciaDesde`. `undefined` mientras no se cargó un corte — nunca se infiere de
   * `fechaEmision` ni de ningún otro campo. `vigenciaHasta >= vigenciaDesde` cuando ambos están
   * cargados (validado en capa de aplicación, no con `CHECK` cruzado). */
  vigenciaHasta?: string;
  /**
   * "Con dependencia" PEDIDO por el presupuesto (design.md D3, Discrepancia 3 — el docx solo tiene
   * "dependencia y retorno" en `Factura`, no en `Presupuesto`). `undefined` = no se cargó, `false` =
   * SD decidido explícitamente — nunca un default `false` implícito, sería fabricar el dato para
   * presupuestos históricos. La obra social puede desmarcarlo en la autorización
   * (`Autorizacion.conDependencia`): mismo par pedido/concedido que `monto`→`montoAutorizado`.
   */
  conDependencia?: boolean;
  /**
   * Datos del formulario de traslado de la obra social (design.md D2, Discrepancia 4). Copiado una
   * sola vez desde `RecorridoHabitual` si la usuaria usa el botón "Traer de los destinos habituales
   * del paciente" (copy-on-create, sin FK, sin referencia viva — ver `DatosTraslado`).
   * `undefined` en presupuestos creados antes de este change o sin ninguno de estos datos cargados.
   */
  datosTraslado?: DatosTraslado;
}

export interface Autorizacion {
  id: string;
  /** Referencia por id al presupuesto que responde (relación 1---1, design.md Decisión 2), nunca embebido. */
  presupuestoId: string;
  estado: EstadoAutorizacion;
  /** ISO date en que la obra social respondió. */
  fechaRespuesta?: string;
  /**
   * Campo agregado por el frontend sobre el docx (design.md Discrepancias 2 y Decisión 4): la
   * Autorización del docx no tiene ningún monto, solo cupos. Se agrega para poder validar
   * RN-PA-01 (`montoAutorizado ≤ presupuesto.monto`) en UI — pendiente de confirmar con backend.
   */
  montoAutorizado?: number;
  /**
   * Campo agregado por el frontend sobre el docx (design.md Discrepancia 3 y Decisión 5),
   * independiente de `fechaRespuesta`: soporta la carga retroactiva (RN-PA-02) que el docx no
   * tiene dónde persistir — pendiente de confirmar con backend.
   */
  vigenciaDesde?: string;
  /**
   * Ver `Presupuesto.vigenciaHasta` (design.md D1, Discrepancia 2 — extiende la discrepancia ya
   * abierta de `vigenciaDesde`, que el docx tampoco tiene). Completa el par pedido/concedido: la
   * obra social puede autorizar un período más corto que el pedido. Regla de negocio candidata (D1,
   * validada en capa de aplicación, no con trigger nuevo): `vigenciaDesde >=
   * presupuesto.vigenciaDesde` y `vigenciaHasta <= presupuesto.vigenciaHasta`, cuando ambos lados
   * estén cargados.
   */
  vigenciaHasta?: string;
  /**
   * "Con dependencia" CONCEDIDO por la obra social (design.md D3, Discrepancia 3 — el docx solo
   * tiene "dependencia y retorno" en `Factura`). Desmarcable aunque `Presupuesto.conDependencia`
   * esté marcado — requisito literal de la usuaria: "lo carga ella, pero la obra social puede
   * denegarlo, tiene que poder desmarcarse". `undefined` = no se cargó, `false` = SD decidido.
   */
  conDependencia?: boolean;
  /** Cupo mensual de días habilitados a facturar (RN-PA-03). */
  cupoMensualDias?: number;
  /** Cupo mensual de kilómetros habilitados a facturar (RN-PA-03). */
  cupoMensualKm?: number;
  archivo?: ArchivoAdjunto;
}

/**
 * Proyección consumible por FE-6/Facturación (design.md Decisión 9, RN-PA-03, RN-FA-02): el
 * cupo mensual autorizado de un paciente, derivable de una `Autorizacion` + el `pacienteId` de su
 * `Presupuesto`. Deja el dato listo y consultable sin implementar el control de facturación acá.
 */
export interface CupoAutorizado {
  pacienteId: string;
  cupoMensualDias?: number;
  cupoMensualKm?: number;
  vigenciaDesde?: string;
}

/** Payload de alta de presupuesto: todo lo de Presupuesto salvo el id, que asigna el repository. */
export type NuevoPresupuesto = Omit<Presupuesto, 'id'>;

/** Payload de edición de presupuesto: actualización parcial, sin permitir cambiar el id. */
export type ActualizacionPresupuesto = Partial<Omit<Presupuesto, 'id'>>;

/** Payload de alta de autorización: todo lo de Autorizacion salvo el id, que asigna el repository. */
export type NuevaAutorizacion = Omit<Autorizacion, 'id'>;

/** Payload de edición de autorización: actualización parcial, sin permitir cambiar el id. */
export type ActualizacionAutorizacion = Partial<Omit<Autorizacion, 'id'>>;
