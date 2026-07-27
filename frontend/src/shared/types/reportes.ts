// Tipos de proyección del dominio de Reportes (US-800, RF-800 a RF-803,
// knowledge-base/06_funcionalidades.md §Épica 9). Fase FE-7, lado UI del change
// `C-11 panel-principal-reportes` — el único change del roadmap que NO introduce ninguna
// entidad nueva (design.md Contexto).
//
// Ninguno de estos tipos es una entidad persistible: todos son proyecciones derivadas,
// calculables en el momento a partir de `Factura`, `Cobro`, `Paciente`, `Vehiculo` y
// `HojaDeRuta` ya existentes. Ninguno requiere una tabla nueva en el backend `C-11` — son,
// junto con las funciones de `shared/lib/reportes/`, el contrato ejecutable de las vistas
// SQL / RPC que ese backend deberá proveer (design.md Decisión 1, Discrepancia 1). Se
// importan los tipos del dominio que hagan falta, nunca se redefinen.

import type { EstadoCud } from '../lib/pacientes/estadoCud';

/**
 * Período configurable del selector del reporte (design.md Decisión 4): unión cerrada, nunca
 * `number` libre, para que un valor no soportado sea un error de compilación en vez de un bug
 * en runtime.
 */
export type PeriodoMeses = 3 | 6 | 12;

/**
 * Un punto de la serie mensual (design.md Decisión 1 y 4): mes (1-12) + año + los tres montos
 * del mes. La `diferencia` es un campo propio (no se recalcula en cada componente) para que
 * ninguna vista tenga que repetir la resta `facturado - cobrado`.
 *
 * Reglas de atribución (design.md Decisiones 2 y 3, aplicadas por `facturadoVsCobrado` y
 * `resumenAnual`):
 * - `facturado`: se atribuye al período estructurado de la factura (`mesFacturado` /
 *   `anioFacturado`), y solo cuenta si la factura ya fue emitida (`facturado`, `cobrado` o
 *   `pagado-parcialmente` — nunca `a-facturar`).
 * - `cobrado`: se atribuye al mes de `Cobro.fecha` (cuándo entró la plata), sin importar el
 *   período de la factura que ese cobro salda.
 */
export interface PuntoPeriodo {
  mes: number;
  anio: number;
  facturado: number;
  cobrado: number;
  diferencia: number;
}

/** Serie de `facturadoVsCobrado` (design.md Decisión 1): un punto por mes del rango solicitado, más los totales del rango completo. */
export interface SerieFacturadoVsCobrado {
  puntos: PuntoPeriodo[];
  totalFacturado: number;
  totalCobrado: number;
  totalDiferencia: number;
}

/** Resumen de `resumenAnual` (design.md Decisión 1, US-800 RF-803): totales del año calendario más el desglose mes a mes (siempre 12 entradas). */
export interface ResumenAnual {
  anio: number;
  totalFacturado: number;
  totalCobrado: number;
  totalDiferencia: number;
  facturasEmitidas: number;
  facturasSaldadas: number;
  meses: PuntoPeriodo[];
}

/**
 * Proyección de una factura en mora (design.md Decisión 5, RF-801/RF-406): referencia por id a
 * la factura y al paciente, con el motivo de la alerta (saldo pendiente y días de atraso). No
 * embebe `Factura` ni `Paciente` completos — `facturasEnMora` solo recibe `facturas` y `cobros`
 * (nunca `pacientes`), así que el nombre del paciente lo resuelve el componente de presentación
 * a partir del `pacienteId` (mismo patrón que `RecorridoVehiculoConductor` resolviendo
 * vehículo/conductor por id), no la función pura.
 */
export interface FacturaEnMora {
  facturaId: string;
  pacienteId: string;
  saldoPendiente: number;
  diasDeAtraso: number;
}

/**
 * Proyección de un paciente con CUD por vencer o vencido (design.md Decisión 5, RF-801/RF-104):
 * referencia por id, con el estado de `estadoCud` (`'por-vencer'` o `'vencido'` — nunca
 * `'vigente'`, esos se excluyen antes de proyectar).
 */
export interface PacienteCudPorVencer {
  pacienteId: string;
  apellido: string;
  nombre: string;
  fechaVencimiento: string;
  estado: EstadoCud;
}

/** Qué señal de mantenimiento disparó la alerta de un vehículo (design.md Decisión 5, RN-VE-03/04). Un vehículo puede tener más de un motivo a la vez. */
export type MotivoAlertaMantenimiento =
  | { tipo: 'service-preventivo'; estado: 'alerta-intermedia' | 'vencido' }
  | { tipo: 'habilitacion'; habilitacion: 'vtv' | 'rto'; estado: 'por-vencer' | 'vencida' };

/**
 * Proyección de un vehículo con alguna alerta de mantenimiento (design.md Decisión 5,
 * RF-801/RN-VE-03/RN-VE-04): un vehículo con dos motivos aparece una sola vez, enumerando
 * ambos en `motivos`.
 */
export interface AlertaMantenimientoVehiculo {
  vehiculoId: string;
  patente: string;
  motivos: MotivoAlertaMantenimiento[];
}

/** Resumen agregado de la jornada (design.md Decisión 1, US-800 RF-800), calculado por `resumenDelDia`. */
export interface ResumenDelDia {
  fecha: string;
  cantidadRecorridos: number;
  cantidadParadas: number;
  cantidadPacientes: number;
}

/**
 * Detalle de un recorrido para el panel de recorridos del día (design.md §Decisiones,
 * `RecorridosDelDiaPanel`): vehículo y conductor ya resueltos por id (o `null` si la
 * referencia no se pudo resolver — Discrepancia n/a, ver spec `dashboard-recorridos-del-dia`
 * Scenario "Referencia inexistente"), cantidad de paradas del recorrido y si es manual.
 */
export interface DetalleRecorridoDelDia {
  recorridoId: string;
  vehiculoPatente: string | null;
  conductorNombre: string | null;
  cantidadParadas: number;
  manual: boolean;
}
