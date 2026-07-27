import type { IdentificadorOrigenFactura, OrigenCampoPlantilla } from '../../shared/types/obraSocial';

// Etiquetas legibles para los literales de origen de dato (obraSocial.ts). Únicos lugares de
// la UI que conocen el mapeo unión-literal → texto, para no repetirlo en cada select.
export const ORIGEN_CAMPO_LABELS: Record<OrigenCampoPlantilla, string> = {
  'paciente.nombre': 'Nombre del paciente',
  'paciente.dni': 'DNI del paciente',
  'paciente.numeroAfiliado': 'Número de afiliado',
  'paciente.domicilio': 'Domicilio del paciente',
  'traslado.prestacion': 'Prestación',
  'traslado.mesYAnio': 'Mes y año',
  'traslado.cantidadDias': 'Cantidad de días',
  'traslado.dependenciaYRetorno': 'Dependencia y retorno',
  'traslado.valorKm': 'Valor del km',
  'traslado.cantidadKm': 'Cantidad de km',
  'traslado.total': 'Total',
  'valor-manual': 'Valor manual',
};

export const ORIGEN_CAMPO_OPTIONS = Object.keys(ORIGEN_CAMPO_LABELS) as OrigenCampoPlantilla[];

// Valores de ejemplo (ilustrativos, no reales) para armar la vista previa de la línea de
// descripción de factura en PlantillaFacturaEditor — nunca se envían a ningún lado, solo se
// muestran con la aclaración "los valores reales se completan al generar cada factura".
export const ORIGEN_CAMPO_EJEMPLOS: Record<OrigenCampoPlantilla, string> = {
  'paciente.nombre': 'Juan García',
  'paciente.dni': '12.345.678',
  'paciente.numeroAfiliado': '12345678',
  'paciente.domicilio': 'Av. Siempreviva 742',
  'traslado.prestacion': 'Traslado ambulatorio',
  'traslado.mesYAnio': 'Julio 2026',
  'traslado.cantidadDias': '12',
  'traslado.dependenciaYRetorno': 'Ida y vuelta',
  'traslado.valorKm': '$150',
  'traslado.cantidadKm': '8 km',
  'traslado.total': '$18.000',
  'valor-manual': '(valor manual)',
};

export const IDENTIFICADOR_ORIGEN_LABELS: Record<IdentificadorOrigenFactura, string> = {
  'paciente.dni': 'DNI del paciente',
  'paciente.numeroAfiliado': 'Número de afiliado',
};

export const IDENTIFICADOR_ORIGEN_OPTIONS = Object.keys(IDENTIFICADOR_ORIGEN_LABELS) as IdentificadorOrigenFactura[];

// Default documentado para IN-01 (pregunta abierta Alta sin cerrar con el cliente — ver
// knowledge-base/10_preguntas_abiertas.md): mismo valor que usa el fixture de OSECAC
// (osecacFixture.ts) y el que toma toda obra social nueva hasta que se configure distinto.
export const DEFAULT_IDENTIFICADOR_ORIGEN: IdentificadorOrigenFactura = 'paciente.numeroAfiliado';
