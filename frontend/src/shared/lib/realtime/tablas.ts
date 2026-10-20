import { claves } from '../query/claves';

// Mapeo tabla -> dominios a invalidar (design.md §D3). Es a la vez la lista de suscripciones y la
// fuente de verdad que la migración de publicación debe igualar (ver tablasPublicadas.test.ts).
// Regla: toda tabla operativa nueva se suma acá + en una migración de publicación.
// Clave: "schema.tabla". Valor: dominios de `claves` cuyo `.todos()` se invalida.
export const TABLAS_REALTIME = {
  'pacientes.hoja_de_ruta': ['hojasDeRuta'],
  'pacientes.recorrido': ['hojasDeRuta'],
  'pacientes.historial_recorridos': ['hojasDeRuta'],
  'pacientes.recorridos': ['recorridosHabituales'],
  'pacientes.paciente': ['pacientes'],
  'pacientes.direcciones': ['pacientes'],
  'pacientes.cud': ['pacientes'],
  'pacientes.clinicos': ['pacientes'],
  'pacientes.personas_a_cargo': ['pacientes'],
  'pacientes.prestaciones': ['pacientes'],
  'pacientes.accesorios_pacientes': ['pacientes'],
  'obra_social.coberturas_paciente': ['pacientes'],
  'conductores.vehiculo': ['vehiculos'],
  'conductores.mantenimiento': ['vehiculos'],
  'conductores.habilitaciones_vehiculo': ['vehiculos'],
  'conductores.accesorios_vehiculo': ['vehiculos'],
  'conductores.conductores': ['conductores'],
  'conductores.conductores_vehiculos': ['conductores', 'vehiculos'],
  'facturacion.presupuesto': ['presupuestos'],
  'facturacion.presupuesto_linea': ['presupuestos'],
  'facturacion.autorizacion': ['autorizaciones', 'presupuestos'],
} as const satisfies Record<string, readonly (keyof typeof claves)[]>;

export type ClaveTabla = keyof typeof TABLAS_REALTIME;
export type DominioRealtime = (typeof TABLAS_REALTIME)[ClaveTabla][number];

/** Clave raíz de React Query (`claves.X.todos()`) de un dominio: invalida por prefijo. */
export type ClaveDominio = ReturnType<(typeof claves)[DominioRealtime]['todos']>;

export function claveDeDominio(dominio: DominioRealtime): ClaveDominio {
  return claves[dominio].todos();
}

function esClaveTabla(clave: string): clave is ClaveTabla {
  return clave in TABLAS_REALTIME;
}

export function dominiosDeTabla(schema: string, tabla: string): ClaveDominio[] {
  const clave = `${schema}.${tabla}`;
  return esClaveTabla(clave) ? TABLAS_REALTIME[clave].map(claveDeDominio) : [];
}
